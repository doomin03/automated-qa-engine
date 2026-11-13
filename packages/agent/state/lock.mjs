import {open, lstat, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AgentError, requireAgent} from '../errors.mjs';
import {stateJson} from './codec.mjs';

// Both the lock and journal reject symlinks and oversized state files.
export async function readRegular(path, max) {
  const stat = await lstat(path);
  requireAgent(stat.isFile() && !stat.isSymbolicLink() && stat.size <= max,
    'AGENT_STATE_INVALID', 'State file is not a bounded regular file');
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(max + 1);
    let used = 0;
    while (used < bytes.length) {
      const {bytesRead} = await file.read(bytes, used, bytes.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    requireAgent(used <= max, 'AGENT_STATE_INVALID', 'State file exceeds its limit');
    return bytes.subarray(0, used);
  } finally {
    await file.close();
  }
}

async function readOwner(path) {
  try {
    return JSON.parse((await readRegular(path, 4096)).toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new AgentError('AGENT_LOCK_UNCERTAIN', 'Cannot confirm lock ownership');
  }
}

function absent(pid) {
  requireAgent(Number.isInteger(pid) && pid > 0, 'AGENT_LOCK_UNCERTAIN', 'Invalid lock owner');
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

export async function acquireLock(root, agentId, instanceId) {
  const gatePath = join(root, 'writer.gate');
  const lockPath = join(root, 'writer.lock');
  let gate;
  try {
    gate = await open(gatePath, 'wx');
  } catch {
    throw new AgentError('AGENT_LOCK_UNCERTAIN',
      'Another writer is acquiring state; stale gate requires operator verification');
  }
  const owner = {agentId, instanceId, pid: process.pid, nonce: randomUUID()};
  try {
    await gate.writeFile(stateJson(owner));
    await gate.sync();
    const identityPath = join(root, 'identity.json');
    const identity = await readOwner(identityPath);
    if (identity) {
      requireAgent(identity.agentId === agentId, 'AGENT_STATE_INVALID', 'State belongs to another agent');
    } else {
      const identityFile = await open(identityPath, 'wx');
      try {
        await identityFile.writeFile(stateJson({agentId}));
        await identityFile.sync();
      } finally {
        await identityFile.close();
      }
    }
    const prior = await readOwner(lockPath);
    if (prior) {
      requireAgent(prior.agentId === agentId, 'AGENT_STATE_INVALID', 'State belongs to another agent');
      requireAgent(absent(prior.pid), 'AGENT_ALREADY_RUNNING',
        'State writer is active or its absence cannot be confirmed');
      await unlink(lockPath);
    }
    const file = await open(lockPath, 'wx');
    try {
      await file.writeFile(stateJson(owner));
      await file.sync();
    } finally {
      await file.close();
    }
  } finally {
    await gate.close();
    await unlink(gatePath);
  }
  return async () => {
    const current = await readOwner(lockPath);
    requireAgent(current?.nonce === owner.nonce && current?.instanceId === instanceId,
      'AGENT_LOCK_UNCERTAIN', 'State lock owner changed');
    await unlink(lockPath);
  };
}
