import { createHash } from 'node:crypto';
import { ensure, QaError } from '../errors.mjs';
import { readBounded, containedPath } from '../io/files.mjs';
import { PNG_MAX_BYTES, inspectPng } from './png.mjs';
export async function prepareReferences(blueprint, root) {
    const resources = new Map();
    const assets = [...(blueprint.target.profile?.fonts || []), ...(blueprint.references || []).flatMap(r => r.images)];
    ensure(assets.length <= 128, 'INVALID_DOCUMENT', 'Too many reference assets');
    let totalBytes = 0;
    for (const asset of assets) {
        let bytes;
        try {
            bytes = await readBounded(await containedPath(root, asset.path), PNG_MAX_BYTES);
        }
        catch (error) {
            if (error instanceof QaError)
                throw error;
            throw new QaError('INVALID_DOCUMENT', 'Reference resource is unavailable');
        }
        ensure(createHash('sha256').update(bytes).digest('hex') === asset.sha256, 'INVALID_DOCUMENT', 'Reference hash mismatch');
        totalBytes += bytes.length;
        ensure(totalBytes <= 64 * 1024 * 1024, 'INVALID_DOCUMENT', 'Reference bundle exceeds 64 MiB');
        if ('region' in asset)
            inspectPng(bytes);
        resources.set(asset.path, bytes);
    }
    return resources;
}
