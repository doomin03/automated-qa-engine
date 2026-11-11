import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compileBlueprint } from './compiler.mjs';
import { resolveVariables } from './validation/variables.mjs';
import { ENGINE_VERSION } from './domain/version.mjs';
import { frozenSnapshot } from './domain/immutable.mjs';
import { validateSchema } from './schema.mjs';
import { QaError, ensure } from './errors.mjs';
import { prepareReferences } from './media/references.mjs';
import { cleanupRecorder } from './limits.mjs';
import { bounded, interrupted } from './runtime/deadline.mjs';
import { publicFailure, outcomeFor } from './runtime/failure.mjs';
import { createEventSink } from './runtime/events.mjs';
import { createRunArtifacts } from './runtime/artifacts.mjs';
import { executeNode } from './runtime/node.mjs';
import { initializeReport, persistResult } from './runtime/report.mjs';
export async function executeBlueprint(document, { adapter, reportDir = 'artifacts', timeoutMs = 60000, headless = true, signal = new AbortController().signal, secretResolver, allowProduction = false, referenceRoot, onEvent = () => { } } = {}) {
    const plan = compileBlueprint(document);
    ensure(adapter, 'ENGINE_ERROR', 'Runner adapter is required');
    const capabilities = adapter.getCapabilities();
    ensure(capabilities.platforms.includes(plan.blueprint.target.platform) && plan.requiredActions.every(a => capabilities.supportedActions.includes(a)), 'UNSUPPORTED_CAPABILITY', 'Runner does not support required capabilities');
    ensure(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000, 'INVALID_DOCUMENT', 'Run timeout must be 1..300000ms');
    ensure(allowProduction || plan.blueprint.target.environment !== 'production', 'POLICY_DENIED', 'Production execution requires explicit opt-in');
    const variables = resolveVariables(plan, secretResolver);
    const resources = await prepareReferences(plan.blueprint, referenceRoot);
    const secretInputs = new Set(Object.entries(plan.blueprint.flow.variables || {}).filter(([, v]) => v.from === 'secret').map(([k]) => k));
    const runId = 'run_' + randomUUID(), attempt = 1, dir = resolve(reportDir, runId);
    await initializeReport(dir, plan);
    const blueprint = plan.blueprint;
    const visitedNodes = [], cleanupErrors = [];
    const recordCleanup = cleanupRecorder(cleanupErrors), visited = new Set();
    const startedAt = new Date().toISOString(), deadline = performance.now() + timeoutMs;
    let outcome = 'passed', failure, current, activeNode;
    const remaining = () => Math.max(1, Math.floor(deadline - performance.now()));
    const nodes = new Map(blueprint.flow.nodes.map(n => [n.id, n]));
    const edges = blueprint.flow.edges;
    const successors = new Map();
    for (const edge of edges) {
        if (!successors.has(edge.from))
            successors.set(edge.from, []);
        successors.get(edge.from).push(edge);
    }
    const emit = createEventSink({ dir, runId, attempt, signal, onEvent, remaining, recordCleanup });
    const ledger = createRunArtifacts({ adapter, dir, containsSecrets: secretInputs.size > 0, recordCleanup });
    const evidence = ledger.capture;
    try {
        await emit('run.started', { blueprintSnapshotHash: plan.blueprintSnapshotHash });
        await bounded(() => adapter.startSession(blueprint.target, { headless, timeoutMs: remaining() }), signal, remaining(), 'session');
        current = blueprint.flow.entryNode;
        while (current) {
            if (signal.aborted)
                throw interrupted(signal);
            if (performance.now() >= deadline)
                throw new QaError('TIMEOUT', 'Run deadline exceeded', 'run');
            const node = nodes.get(current), started = performance.now(), artifactStart = ledger.count();
            visitedNodes.push(current);
            visited.add(current);
            activeNode = current;
            await emit('step.started', { nodeId: current });
            const { branch, nodeOutcome, nodeDiagnostic } = await executeNode(node, { blueprint, variables, secretInputs, resources }, { adapter, signal, deadline, collectObservation: ledger.collectObservation, evidence, emit });
            activeNode = undefined;
            await emit('step.finished', { nodeId: current, outcome: nodeOutcome, durationMs: performance.now() - started, ...(branch ? { branch } : {}), ...(nodeDiagnostic ? { failure: nodeDiagnostic } : {}), artifacts: ledger.snapshot(artifactStart) });
            current = successors.get(current)?.find(e => node.type !== 'branch' || e.label === branch)?.to;
        }
    }
    catch (error) {
        if (['captureText', 'captureValue'].includes(nodes.get(activeNode)?.action))
            ledger.suppress();
        failure = publicFailure(error, activeNode);
        outcome = outcomeFor(failure);
        if (activeNode) {
            if (outcome !== 'cancelled')
                await evidence(activeNode);
            await emit('step.finished', { nodeId: activeNode, outcome, failure, artifacts: ledger.snapshot() }, true);
        }
    }
    finally {
        try {
            await bounded(() => adapter.endSession(), new AbortController().signal, 5000, 'cleanup');
        }
        catch {
            const error = { code: 'CLEANUP_ERROR', message: 'Runner cleanup failed', phase: 'cleanup' };
            recordCleanup(error);
            if (outcome === 'passed') {
                outcome = 'infra_error';
                failure = error;
            }
        }
    }
    const artifacts = ledger.snapshot();
    const result = frozenSnapshot(validateSchema({ schemaVersion: 'qa.result/v1', runId, attempt, status: outcome === 'cancelled' ? 'cancelled' : 'finished', outcome, startedAt, finishedAt: new Date().toISOString(), ...(failure ? { failure } : {}), artifacts, executed: { engineVersion: ENGINE_VERSION, platform: blueprint.target.platform, flowSnapshotHash: plan.flowSnapshotHash, blueprintSnapshotHash: plan.blueprintSnapshotHash }, visitedNodes, unvisitedNodes: blueprint.flow.nodes.map(n => n.id).filter(id => !visited.has(id)), cleanupErrors }));
    await persistResult(dir, result);
    await emit('run.finished', { outcome, ...(failure ? { failure } : {}), artifacts, resultPath: 'result.json' });
    return { result, reportDir: dir, plan };
}
