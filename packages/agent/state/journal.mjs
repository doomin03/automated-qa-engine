import {open, rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AgentError, requireAgent} from '../errors.mjs';
import {encodeRecord, parseRecord, validateRecord, stateJson, snapshot} from './codec.mjs';
import {readRegular} from './lock.mjs';

export async function openJournal(root, {agentId, maxBytes, maxEntries, model, releaseLock, checkpointHook}) {
  const path = join(root, 'journal.jsonl');
  let sequence = 0;
  let lastHash = '0'.repeat(64);
  let bytes = 0;
  let file;
  let closed = false;
  let poisoned = false;
  let tail = Promise.resolve();
  let operations = [];
  let journalVersion = 1;

  try {
    let existing;
    try {
      existing = await readRegular(path, maxBytes);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      existing = Buffer.alloc(0);
    }
    const lastNewline = existing.lastIndexOf(10);
    const complete = existing.subarray(0, lastNewline + 1);
    for (const line of complete.toString('utf8').split('\n').filter(Boolean)) {
      const record = parseRecord(line);
      if (sequence === 0) journalVersion = record.version;
      validateRecord(record, {version: journalVersion, sequence: sequence + 1, previousHash: lastHash, agentId});
      model.apply(record.operation, journalVersion);
      operations.push(snapshot(record.operation));
      sequence++;
      lastHash = record.sha256;
    }
    requireAgent(sequence <= maxEntries, 'AGENT_STATE_FULL', 'State journal entry budget exceeded');
    bytes = complete.length;
    if (existing.length !== bytes) {
      const recovery = await open(path, 'r+');
      try {
        await recovery.truncate(bytes);
        await recovery.sync();
      } finally {
        await recovery.close();
      }
    }
    file = await open(path, 'a+');
  } catch (error) {
    await file?.close();
    await releaseLock();
    throw error;
  }

  function serial(operation) {
    const result = tail.then(async () => {
      requireAgent(!closed && !poisoned, 'AGENT_STATE_CLOSED', 'State writer is unavailable');
      return operation();
    });
    tail = result.catch(() => {});
    return result;
  }

  async function checkpoint(force = false) {
    const retired = model.retiredClaims(agentId);
    if (!force && retired.size < 128 && sequence < maxEntries - 4 && bytes < maxBytes - 16384) return false;
    const retained = model.checkpointProjection(retired);
    if (retained.length >= operations.length) return false;
    const temporary = join(root, '.checkpoint-' + randomUUID() + '.jsonl');
    let output;
    let nextSequence = 0;
    let nextHash = '0'.repeat(64);
    let nextBytes = 0;
    try {
      output = await open(temporary, 'wx', 0o600);
      for (const operation of retained) {
        const encoded = encodeRecord(operation, {
          version: 2, sequence: ++nextSequence, previousHash: nextHash, agentId,
        });
        nextHash = encoded.digest;
        nextBytes += encoded.size;
        requireAgent(nextBytes <= maxBytes && nextSequence <= maxEntries,
          'AGENT_STATE_FULL', 'Checkpoint exceeds state budget');
        await output.writeFile(encoded.line);
      }
      await checkpointHook('temporary-written');
      await output.sync();
      await checkpointHook('temporary-synced');
      await output.close();
      output = undefined;
      await file.close();
      await checkpointHook('before-replace');
      await rename(temporary, path);
      await checkpointHook('after-replace');
      file = await open(path, 'a+');
      await file.sync();
      await checkpointHook('reopened');

      // Only a completed replacement changes live cursors and the retained model.
      operations = retained;
      sequence = nextSequence;
      lastHash = nextHash;
      bytes = nextBytes;
      journalVersion = 2;
      model.checkpointCommitted(retired);
      return true;
    } catch (error) {
      poisoned = true;
      await output?.close().catch(() => {});
      throw new AgentError('AGENT_STATE_IO', 'Unable to atomically checkpoint retained Agent state');
    }
  }

  async function commit(operation) {
    if (sequence >= maxEntries || bytes + Buffer.byteLength(stateJson(operation)) + 512 > maxBytes) {
      await checkpoint(true);
    }
    const encoded = encodeRecord(operation, {
      version: journalVersion, sequence: sequence + 1, previousHash: lastHash, agentId,
    });
    requireAgent(bytes + encoded.size <= maxBytes && sequence < maxEntries,
      'AGENT_STATE_FULL', 'State budget exhausted; execution must stop');
    try {
      await file.writeFile(encoded.line);
      await file.sync();
    } catch {
      poisoned = true;
      throw new AgentError('AGENT_STATE_IO', 'Unable to persist execution state');
    }
    // Acknowledgement/state become visible only after the append is durable.
    model.apply(operation, journalVersion);
    operations.push(snapshot(operation));
    sequence++;
    lastHash = encoded.digest;
    bytes += encoded.size;
  }

  function close() {
    const result = tail.then(async () => {
      if (closed) return;
      closed = true;
      try {
        await file.close();
      } finally {
        await releaseLock();
      }
    });
    tail = result.catch(() => {});
    return result;
  }

  return {
    serial, commit, checkpoint, close,
    status: () => ({
      sequence, bytes, maxBytes, maxEntries, closed, poisoned, journalVersion,
      remainingEntries: maxEntries - sequence, remainingBytes: maxBytes - bytes,
    }),
  };
}
