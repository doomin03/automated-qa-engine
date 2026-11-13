import { performance } from 'node:perf_hooks';
import { QaError, ensure } from '../errors.mjs';
import { bounded, interrupted } from './deadline.mjs';
// Executes one node with one deadline across retries. Variables are the run frame.
export async function executeNode(node, { blueprint, variables, secretInputs, resources }, { adapter, signal, deadline, collectObservation, evidence, emit }) {
    const current = node.id;
    let branch, nodeOutcome = 'passed', nodeDiagnostic;
    const nodeDeadline = Math.min(deadline, performance.now() + (node.timeoutMs || 10000));
    const deadlinePhase = nodeDeadline === deadline ? 'run' : 'step';
    for (let retry = 0;; retry++) {
        let budgetSignal;
        try {
            const budget = Math.max(1, Math.floor(nodeDeadline - performance.now()));
            if (performance.now() >= nodeDeadline)
                throw new QaError('TIMEOUT', 'Execution deadline exceeded', deadlinePhase);
            budgetSignal = AbortSignal.timeout(budget);
            const stepSignal = AbortSignal.any([signal, budgetSignal]);
            const ctx = { blueprint, variables, timeoutMs: budget, secretInputs, resources, signal: stepSignal };
            if (node.type === 'branch') {
                const equal = variables[node.condition.variable] === node.condition.value;
                branch = String(node.condition.operator === 'equals' ? equal : !equal);
            }
            else if (node.type === 'assertion')
                await bounded(async () => collectObservation(await adapter.evaluateAssertion(node, ctx), node.id, stepSignal), signal, budget, deadlinePhase);
            else if (node.type === 'action') {
                if (['captureText', 'captureValue'].includes(node.action)) {
                    delete variables[node.params.variable];
                    ensure(typeof adapter.capture === 'function', 'UNSUPPORTED_CAPABILITY', 'Adapter does not implement capture');
                    const captured = await bounded(() => adapter.capture(node, ctx), signal, budget, deadlinePhase);
                    if (stepSignal.aborted)
                        throw new QaError('TIMEOUT', 'Capture deadline exceeded', deadlinePhase);
                    ensure(typeof captured === 'string' && captured.length <= 16384, 'ENGINE_ERROR', 'Invalid adapter capture value');
                    variables[node.params.variable] = captured;
                }
                else if (node.action === 'screenshot') {
                    const state = await bounded(() => evidence(current, stepSignal, budget), signal, budget, deadlinePhase);
                    if (state === 'capacity')
                        throw new QaError('ENGINE_ERROR', 'Run evidence capacity exceeded', 'step');
                    if (signal.aborted)
                        throw interrupted(signal);
                    if (stepSignal.aborted || performance.now() >= nodeDeadline)
                        throw new QaError('TIMEOUT', 'Execution deadline exceeded', deadlinePhase);
                    if (state !== 'captured') {
                        const code = state === 'skipped' ? 'UNSUPPORTED_CAPABILITY' : 'EVIDENCE_ERROR', message = state === 'skipped' ? 'Evidence unavailable by runner policy' : 'Unable to capture required evidence';
                        if (node.params.required)
                            throw new QaError(code, message, 'step');
                        nodeOutcome = 'skipped';
                        nodeDiagnostic = { code, message, phase: 'step', nodeId: current };
                    }
                }
                else
                    await bounded(() => adapter.performAction(node, ctx), signal, budget, deadlinePhase);
            }
            break;
        }
        catch (error) {
            if (signal.aborted)
                throw interrupted(signal);
            // Only the runner's expired budget signal may reclassify an adapter
            // TIMEOUT. An arbitrary early adapter error retains its own phase.
            if (deadlinePhase === 'run' && budgetSignal?.aborted && error instanceof QaError && error.code === 'TIMEOUT')
                throw new QaError('TIMEOUT', 'Run deadline exceeded', 'run');
            const retryable = error instanceof QaError && ['ASSERTION_FAILED', 'ELEMENT_NOT_FOUND'].includes(error.code);
            if (!retryable || retry >= (node.retry?.maxRetries || 0) || performance.now() >= nodeDeadline || signal.aborted)
                throw error;
            await emit('step.retrying', { nodeId: current });
        }
    }
    return { branch, nodeOutcome, nodeDiagnostic };
}
