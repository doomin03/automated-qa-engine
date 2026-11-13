import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateSchema } from './schema.mjs';
import { ensure, QaError } from './errors.mjs';
import { inspectPng } from './resources.mjs';
import { reserveArtifacts } from './limits.mjs';
export async function saveObservation(observation, nodeId, dir, artifacts, signal) {
    const active = () => ensure(!signal?.aborted, 'TIMEOUT', 'Observation deadline exceeded');
    active();
    if (observation === undefined)
        return;
    ensure(observation && typeof observation === 'object', 'ENGINE_ERROR', 'Invalid adapter observation');
    const { images = [], ...fields } = observation;
    ensure(Array.isArray(images) && images.length <= 3, 'ENGINE_ERROR', 'Invalid observation images');
    reserveArtifacts(artifacts, images.length + 1);
    const report = validateSchema({ schemaVersion: 'qa.checkReport/v1', ...fields, nodeId, artifactRefs: [] });
    ensure(Buffer.byteLength(JSON.stringify(report)) <= 1024 * 1024, 'ENGINE_ERROR', 'Observation exceeds byte limit');
    const roles = new Set();
    async function save(bytes, type, extension, contentType) {
        active();
        const path = 'check-' + artifacts.length + '.' + extension;
        await writeFile(join(dir, path), bytes, { flag: 'wx' });
        active();
        artifacts.push({ type, path, contentType, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length });
        return path;
    }
    for (const image of images) {
        ensure(image && ['baseline', 'actual', 'diff'].includes(image.role) && !roles.has(image.role) && image.bytes instanceof Uint8Array, 'ENGINE_ERROR', 'Invalid observation image');
        roles.add(image.role);
        const bytes = Buffer.from(image.bytes);
        inspectPng(bytes);
        report.artifactRefs.push({ role: image.role, path: await save(bytes, 'screenshot', 'png', 'image/png') });
    }
    validateSchema(report);
    await save(Buffer.from(JSON.stringify(report, null, 2)), 'check-report', 'json', 'application/json');
    if (report.verdict !== 'passed')
        throw new QaError(report.verdict === 'blocked' ? 'UNSUPPORTED_CAPABILITY' : 'ASSERTION_FAILED', 'Check ' + report.reason, 'step');
}
