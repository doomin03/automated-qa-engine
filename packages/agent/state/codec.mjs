import {createHash} from 'node:crypto';
import {AgentError, requireAgent} from '../errors.mjs';

export const MAX_RECORD = 4 * 1024 * 1024;
export const MAX_BYTES = 64 * 1024 * 1024;
export const MAX_ENTRIES = 20000;
export const validKey = key => typeof key === 'string' && key.length > 0 &&
  key.length <= 256 && !/[\u0000-\u001f]/.test(key);

export function snapshot(value) {
  const copy = structuredClone(value);
  function freeze(item) {
    if (item && typeof item === 'object') {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
    return item;
  }
  return freeze(copy);
}

export function stateJson(value) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    throw new AgentError('AGENT_STATE_INVALID', 'State must be JSON serializable');
  }
  requireAgent(typeof text === 'string' && Buffer.byteLength(text) <= MAX_RECORD,
    'AGENT_STATE_INVALID', 'State record exceeds its limit');
  return text;
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseRecord(line) {
  try {
    return JSON.parse(line);
  } catch {
    throw new AgentError('AGENT_STATE_INVALID', 'Corrupt state journal');
  }
}

export function validateRecord(record, {version, sequence, previousHash, agentId}) {
  requireAgent([1, 2].includes(version) && record.version === version &&
    record.sequence === sequence && record.previousHash === previousHash &&
    record.agentId === agentId, 'AGENT_STATE_INVALID', 'State journal identity or version mismatch');
  const {sha256, ...base} = record;
  requireAgent(sha256 === hash(stateJson(base)), 'AGENT_STATE_INVALID', 'State journal hash mismatch');
}

export function encodeRecord(operation, {version, sequence, previousHash, agentId}) {
  // Field order is part of the existing v1/v2 journal bytes and hash chain.
  const base = {version, sequence, previousHash, agentId, operation};
  const digest = hash(stateJson(base));
  const line = stateJson({...base, sha256: digest}) + '\n';
  return {digest, line, size: Buffer.byteLength(line)};
}
