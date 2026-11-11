import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readBounded } from '../core/resources.mjs';
import { validateSchema } from '../core/schema.mjs';
import { AgentError, requireAgent } from './errors.mjs';
import { sha256 } from './materialize.mjs';
import { protocolLimits } from './protocol.mjs';
const CLI = fileURLToPath(new URL('../cli/aqa.mjs', import.meta.url));
export async function executeChild({ item, blueprint, expectedVersion, config, resource, appiumConfig, signal, onEvent, onSpawn, env = process.env }) {
    const childEnv = { ...env };
    for (const key of Object.keys(childEnv))
        if (key.startsWith('AQA_SECRET_'))
            delete childEnv[key];
    for (const variable of Object.values(blueprint.flow.variables || {}))
        if (variable.from === 'secret') {
            const value = env[config.credentials[variable.ref]];
            requireAgent(typeof value === 'string', 'AGENT_POLICY_DENIED', 'Approved credential is unavailable');
            childEnv['AQA_SECRET_' + variable.ref.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()] = value;
        }
    const reportRoot = join(item.root, 'reports'), args = [CLI, 'run', item.file, '--json', '--diagnostics', 'stderr', '--control-stdin', '--document-root', item.root, '--reference-root', item.root, '--report', reportRoot, '--timeout', String(config.maxRunMs)];
    if (resource.allowProduction)
        args.push('--allow-production');
    if (appiumConfig)
        args.push('--appium-config', appiumConfig);
    signal?.throwIfAborted();
    const child = spawn(process.execPath, args, { cwd: item.root, env: childEnv, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let forced = false, cancelled = false, killTimer, runId, nextSequence = 1, terminal, streamError, stdoutBytes = 0;
    const events = [];
    const cancel = () => { if (cancelled)
        return; cancelled = true; if (!child.stdin.destroyed)
        child.stdin.write('{"type":"cancel"}\n', () => { }); killTimer = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, 10000); };
    child.stdin.on('error', () => { });
    child.stderr.on('data', () => { });
    const exited = new Promise(resolve => { child.once('error', () => resolve({ code: null, spawnError: true })); child.once('close', (code) => resolve({ code, spawnError: false })); });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted)
        cancel();
    try {
        await onSpawn?.({ pid: child.pid });
    }
    catch (error) {
        streamError = error;
        cancel();
    }
    const stream = (async () => {
        let pending = Buffer.alloc(0);
        try {
            for await (const chunk of child.stdout) {
                stdoutBytes += chunk.length;
                requireAgent(stdoutBytes <= 64 * 1024 * 1024, 'AGENT_CHILD_INVALID', 'Engine stream exceeded its byte budget');
                pending = Buffer.concat([pending, chunk]);
                for (let newline; (newline = pending.indexOf(10)) >= 0;) {
                    const line = pending.subarray(0, newline);
                    pending = pending.subarray(newline + 1);
                    requireAgent(line.length > 0 && line.length <= protocolLimits.engineJsonBytes, 'AGENT_CHILD_INVALID', 'Invalid Engine event line');
                    let event;
                    try {
                        event = validateSchema(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line)));
                    }
                    catch {
                        throw new AgentError('AGENT_CHILD_INVALID', 'Invalid Engine event');
                    }
                    requireAgent(event.schemaVersion === 'qa.runEvent/v1' && event.attempt === 1 && event.sequence === nextSequence && !terminal, 'AGENT_CHILD_INVALID', 'Engine event identity mismatch');
                    if (!runId) {
                        requireAgent(event.type === 'run.started' && event.blueprintSnapshotHash === item.blueprintSnapshotHash, 'AGENT_CHILD_INVALID', 'Engine start differs from pinned snapshot');
                        runId = event.runId;
                    }
                    requireAgent(event.runId === runId, 'AGENT_CHILD_INVALID', 'Mixed Engine run identities');
                    nextSequence++;
                    events.push(event);
                    if (event.type === 'run.finished')
                        terminal = event;
                    await onEvent(event);
                }
                requireAgent(pending.length <= protocolLimits.engineJsonBytes, 'AGENT_CHILD_INVALID', 'Engine event line exceeds its byte budget');
            }
            requireAgent(pending.length === 0, 'AGENT_CHILD_INVALID', 'Engine stream ended mid-event');
        }
        catch (error) {
            streamError = error;
            cancel();
            child.stdout.resume();
        }
    })();
    const exit = await exited;
    await stream;
    clearTimeout(killTimer);
    signal?.removeEventListener('abort', cancel);
    if (exit.spawnError || forced || streamError || !terminal || !runId)
        return { cleanupState: 'unknown', reason: forced ? 'CHILD_FORCED_TERMINATION' : 'CHILD_RESULT_UNCONFIRMED', events, exitCode: exit.code };
    try {
        const reportDir = join(reportRoot, runId), result = validateSchema(JSON.parse(await readBounded(join(reportDir, 'result.json'))));
        requireAgent(result.schemaVersion === 'qa.result/v1' && result.runId === runId && result.attempt === 1 && result.outcome === terminal.outcome && result.executed.engineVersion === expectedVersion && result.executed.blueprintSnapshotHash === item.blueprintSnapshotHash, 'AGENT_CHILD_INVALID', 'Engine result identity mismatch');
        const expectedExit = { passed: 0, failed: 1, infra_error: 3, blocked: 4, cancelled: 5 }[result.outcome];
        requireAgent(exit.code === expectedExit, 'AGENT_CHILD_INVALID', 'Engine exit differs from result');
        requireAgent(JSON.stringify(result.artifacts) === JSON.stringify(terminal.artifacts), 'AGENT_CHILD_INVALID', 'Terminal artifact manifest differs from result');
        const artifacts = [];
        let total = 0;
        requireAgent(result.artifacts.length <= 256, 'AGENT_CHILD_INVALID', 'Artifact count exceeds Agent upload budget');
        for (const descriptor of result.artifacts) {
            requireAgent(/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,250}\.(png|json)$/.test(descriptor.path), 'AGENT_CHILD_INVALID', 'Unsafe artifact path');
            const bytes = await readBounded(join(reportDir, descriptor.path), protocolLimits.artifactBytes);
            total += bytes.length;
            requireAgent(total <= protocolLimits.executionArtifactBytes && bytes.length === descriptor.size && sha256(bytes) === descriptor.sha256, 'AGENT_CHILD_INVALID', 'Artifact bytes differ from result');
            artifacts.push({ caseId: item.caseId, path: descriptor.path, sha256: descriptor.sha256, size: descriptor.size, mimeType: descriptor.contentType, localPath: join(reportDir, descriptor.path) });
        }
        const cleanupState = result.cleanupErrors.some(e => e.code === 'CLEANUP_ERROR') || (resource.platform !== 'web' && result.outcome === 'infra_error') ? 'unknown' : 'confirmed';
        return { result, reportDir, artifacts, cleanupState, reason: null, events, exitCode: exit.code };
    }
    catch {
        return { cleanupState: 'unknown', reason: 'CHILD_RESULT_UNCONFIRMED', events, exitCode: exit.code };
    }
}
