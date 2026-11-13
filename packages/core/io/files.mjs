import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { ensure } from '../errors.mjs';
export async function readBounded(file, maxBytes = 1024 * 1024) {
    const handle = await open(file, 'r');
    try {
        ensure((await handle.stat()).isFile(), 'INVALID_DOCUMENT', 'Input must be a regular file');
        const buffer = Buffer.alloc(maxBytes + 1);
        let offset = 0;
        while (offset < buffer.length) {
            const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null);
            if (!bytesRead)
                break;
            offset += bytesRead;
        }
        ensure(offset <= maxBytes, 'INVALID_DOCUMENT', 'Input exceeds byte limit');
        return buffer.subarray(0, offset);
    }
    finally {
        await handle.close();
    }
}
export async function containedPath(root, path) {
    ensure(root && typeof path === 'string' && !isAbsolute(path) && !path.includes('\0'), 'INVALID_DOCUMENT', 'A relative resource path and explicit root are required');
    const base = await realpath(root), full = await realpath(resolve(base, path)), rel = relative(base, full);
    ensure(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep), 'POLICY_DENIED', 'Resource escapes reference root');
    return full;
}
export async function documentPath(file, documentRoot) {
    if (!documentRoot)
        return file;
    const root = await realpath(documentRoot), full = await realpath(resolve(file)), rel = relative(root, full);
    ensure(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep), 'POLICY_DENIED', 'Document escapes document root');
    return full;
}
