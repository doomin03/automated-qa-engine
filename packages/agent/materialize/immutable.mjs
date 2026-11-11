import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readBounded } from '../../core/io/files.mjs';
import { boundedJson } from '../protocol.mjs';
import { requireAgent, AgentError } from '../errors.mjs';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function immutableJson(path, value, max) { const bytes = Buffer.from(boundedJson(value, max)); const file = await open(path, 'wx', 0o600); try {
    await file.writeFile(bytes);
    await file.sync();
}
finally {
    await file.close();
} return { path, sha256: sha256(bytes), size: bytes.length }; }
export async function readImmutable(reference, max) { const bytes = await readBounded(reference.path, max); requireAgent(bytes.length === reference.size && sha256(bytes) === reference.sha256, 'AGENT_STATE_INVALID', 'Immutable state bytes changed'); try {
    return JSON.parse(bytes);
}
catch {
    throw new AgentError('AGENT_STATE_INVALID', 'Invalid immutable JSON');
} }
