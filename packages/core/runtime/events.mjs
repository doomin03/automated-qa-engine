import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSchema } from '../schema.mjs';
import { QaError } from '../errors.mjs';
import { frozenSnapshot } from '../domain/immutable.mjs';
import { bounded, interrupted, INTERNAL_DEADLINE } from './deadline.mjs';
// Owns sequence and observer failure. Disk append errors never become observer errors.
export function createEventSink({ dir, runId, attempt, signal, onEvent, remaining, recordCleanup }) {
    let sequence = 0, observerFailed = false;
    async function emit(type, payload = {}, settlingFailure = false) {
        const event = frozenSnapshot(validateSchema({ schemaVersion: 'qa.runEvent/v1', runId, attempt, sequence: ++sequence, type, timestamp: new Date().toISOString(), ...payload }));
        await appendFile(join(dir, 'events.jsonl'), JSON.stringify(event) + '\n');
        if (!observerFailed) {
            try {
                // Observer delivery shares the run budget; terminal delivery has a
                // separate bound because the immutable result is already persisted.
                await bounded(() => onEvent(event), type === 'run.finished' ? new AbortController().signal : signal, type === 'run.finished' ? 1000 : remaining(), 'run');
            }
            catch (error) {
                observerFailed = true;
                if (settlingFailure) {
                    // The execution failure is already settled. Preserve it while still
                    // recording durable results; append/schema errors remain outside this catch.
                    recordCleanup({ code: 'ENGINE_ERROR', message: 'Event delivery interrupted after execution failure', phase: 'cleanup', ...(payload.nodeId ? { nodeId: payload.nodeId } : {}) });
                    return;
                }
                if (type !== 'run.finished' && signal.aborted)
                    throw interrupted(signal);
                if (type !== 'run.finished' && error?.[INTERNAL_DEADLINE])
                    throw new QaError('TIMEOUT', 'Run deadline exceeded during event delivery', 'run');
                throw new QaError('ENGINE_ERROR', type === 'run.finished' ? 'Event delivery failed after terminal result was persisted' : 'Event consumer failed or exceeded the run deadline', 'run');
            }
        }
    }
    return emit;
}
