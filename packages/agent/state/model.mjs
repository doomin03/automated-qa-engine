import {AgentError, requireAgent} from '../errors.mjs';
import {snapshot, validKey} from './codec.mjs';

export function createStateModel() {
  const values = new Map();
  const queues = new Map();

  function queue(scope) {
    if (!queues.has(scope)) queues.set(scope, {ack: 0, next: 0, entries: []});
    return queues.get(scope);
  }

  function validateAck(scope, through) {
    requireAgent(validKey(scope), 'AGENT_STATE_INVALID', 'Invalid ack scope');
    const current = queue(scope);
    requireAgent(Number.isSafeInteger(through) && through >= current.ack && through <= current.next,
      'AGENT_STATE_INVALID', 'Invalid acknowledgement cursor');
    return current.ack;
  }

  function apply(operation, journalVersion) {
    requireAgent(operation && typeof operation === 'object' && !Array.isArray(operation),
      'AGENT_STATE_INVALID', 'Invalid state operation');
    if (operation.kind === 'set') {
      requireAgent(validKey(operation.key) && Object.hasOwn(operation, 'value'),
        'AGENT_STATE_INVALID', 'Invalid state key');
      values.set(operation.key, snapshot(operation.value));
    } else if (operation.kind === 'queue-base') {
      requireAgent(journalVersion === 2 && validKey(operation.scope) && !queues.has(operation.scope) &&
        Number.isSafeInteger(operation.ack) && operation.ack >= 0 && operation.next === operation.ack,
        'AGENT_STATE_INVALID', 'Invalid checkpoint queue base');
      queues.set(operation.scope, {ack: operation.ack, next: operation.next, entries: []});
    } else if (operation.kind === 'delivery') {
      requireAgent(validKey(operation.scope), 'AGENT_STATE_INVALID', 'Invalid outbox scope');
      const current = queue(operation.scope);
      requireAgent(Number.isSafeInteger(operation.sequence) && operation.sequence === current.next + 1 &&
        Object.hasOwn(operation, 'payload'), 'AGENT_STATE_INVALID', 'Invalid outbox sequence');
      current.entries.push(snapshot({sequence: operation.sequence, payload: operation.payload}));
      current.next = operation.sequence;
    } else if (operation.kind === 'ack') {
      validateAck(operation.scope, operation.through);
      queue(operation.scope).ack = operation.through;
    } else {
      throw new AgentError('AGENT_STATE_INVALID', 'Unknown state operation');
    }
  }

  function retiredClaims(agentId) {
    // Preserve the established confirmed-empty claim rule. No lease is retired.
    return new Set([...values].filter(([key, value]) =>
      key.startsWith('claim:') && value?.phase === 'empty' && value.leaseId === null &&
      value.body?.agentId === agentId && key === 'claim:' + value.body.claimRequestId
    ).map(([key]) => key));
  }

  function checkpointProjection(retired) {
    const retained = [...values].filter(([key]) => !retired.has(key))
      .map(([key, value]) => ({kind: 'set', key, value}));
    for (const [scope, current] of queues) {
      if (current.ack) retained.push({kind: 'queue-base', scope, ack: current.ack, next: current.ack});
      for (const entry of current.entries) {
        if (entry.sequence > current.ack) {
          retained.push({kind: 'delivery', scope, sequence: entry.sequence, payload: entry.payload});
        }
      }
    }
    return retained;
  }

  function checkpointCommitted(retired) {
    for (const key of retired) values.delete(key);
    for (const current of queues.values()) {
      current.entries = current.entries.filter(entry => entry.sequence > current.ack);
    }
  }

  return {
    apply, validateAck, retiredClaims, checkpointProjection, checkpointCommitted,
    get: key => snapshot(values.get(key)),
    entries: (prefix = '') => snapshot([...values].filter(([key]) => key.startsWith(prefix))),
    pending: scope => snapshot((queues.get(scope)?.entries || [])
      .filter(item => item.sequence > (queues.get(scope)?.ack || 0))),
    acknowledged: scope => queues.get(scope)?.ack || 0,
    nextSequence: scope => queue(scope).next + 1,
    status: () => ({
      retainedKeys: values.size,
      queueScopes: queues.size,
      pendingEntries: [...queues.values()].reduce((count, current) => count +
        current.entries.filter(entry => entry.sequence > current.ack).length, 0),
      acknowledgedPayloadEntries: [...queues.values()].reduce((count, current) => count +
        current.entries.filter(entry => entry.sequence <= current.ack).length, 0),
    }),
  };
}
