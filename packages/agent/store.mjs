import {mkdir, realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireAgent} from './errors.mjs';
import {MAX_BYTES, MAX_ENTRIES, validKey, stateJson, snapshot} from './state/codec.mjs';
import {acquireLock} from './state/lock.mjs';
import {createStateModel} from './state/model.mjs';
import {openJournal} from './state/journal.mjs';

/** Durable local primitives only; HTTP lease interpretation belongs to supervisor. */
export async function openAgentStore(path, {
  agentId, instanceId = randomUUID(), maxBytes = MAX_BYTES, maxEntries = MAX_ENTRIES,
  checkpointHook = async () => {},
} = {}) {
  requireAgent(validKey(agentId) && validKey(instanceId),
    'AGENT_STATE_INVALID', 'Agent and instance identities are required');
  requireAgent(Number.isInteger(maxBytes) && maxBytes >= 4096 && maxBytes <= MAX_BYTES &&
    Number.isInteger(maxEntries) && maxEntries > 0 && maxEntries <= MAX_ENTRIES,
    'AGENT_STATE_INVALID', 'Invalid state budget');
  await mkdir(resolve(path), {recursive: true, mode: 0o700});
  const root = await realpath(resolve(path));
  const releaseLock = await acquireLock(root, agentId, instanceId);
  const model = createStateModel();
  const journal = await openJournal(root, {
    agentId, maxBytes, maxEntries, model, releaseLock, checkpointHook,
  });

  return {
    root, agentId, instanceId,
    get: model.get,
    entries: model.entries,
    pending: model.pending,
    acknowledged: model.acknowledged,
    status: () => snapshot({...journal.status(), ...model.status(), lifetimeBounded: true}),
    compactEmptyClaims: ({force = false} = {}) => journal.serial(() => journal.checkpoint(force)),
    set: (key, value) => {
      requireAgent(validKey(key), 'AGENT_STATE_INVALID', 'Invalid state key');
      const copy = JSON.parse(stateJson(value));
      return journal.serial(() => journal.commit({kind: 'set', key, value: copy}));
    },
    enqueue: (scope, payload) => {
      requireAgent(validKey(scope), 'AGENT_STATE_INVALID', 'Invalid outbox scope');
      const copy = JSON.parse(stateJson(payload));
      return journal.serial(async () => {
        const next = model.nextSequence(scope);
        requireAgent(Number.isSafeInteger(next), 'AGENT_STATE_FULL', 'Outbox sequence budget exhausted');
        await journal.commit({kind: 'delivery', scope, sequence: next, payload: copy});
        return next;
      });
    },
    ack: (scope, through) => journal.serial(async () => {
      const previous = model.validateAck(scope, through);
      if (through !== previous) await journal.commit({kind: 'ack', scope, through});
    }),
    close: journal.close,
  };
}
