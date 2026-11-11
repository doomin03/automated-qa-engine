import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
export async function compareInstalledFiles(packed, root, consumer) {
    const installedFiles = [];
    for (const file of packed.files) {
        const sourceHash = createHash('sha256').update(await readFile(join(root, file.path))).digest('hex'), installedHash = createHash('sha256').update(await readFile(join(consumer, 'node_modules/automated-qa-engine', file.path))).digest('hex');
        assert.equal(installedHash, sourceHash, 'Installed bytes differ: ' + file.path);
        installedFiles.push({ path: file.path, sha256: installedHash });
    }
    return installedFiles;
}
