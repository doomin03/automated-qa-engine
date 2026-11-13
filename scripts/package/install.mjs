import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
export async function installPackage({ run, npm, artifacts }) {
    const packed = JSON.parse((await run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', artifacts])).stdout)[0];
    for (const file of ['packages/core/index.mjs', 'packages/core/index.d.ts', 'packages/core/schema-types.d.ts', 'packages/core/limits.mjs', 'packages/cli/output-child.mjs', 'packages/cli/metadata.mjs', 'runners/playwright/adapter.d.ts', 'runners/appium/adapter.d.ts', 'examples/consumer.mjs', 'docs/package-api.md', 'docs/xml-format.md', 'docs/design-checks.md', 'docs/appium.md'])
        assert(packed.files.some(f => f.path === file), 'Missing packed file: ' + file);
    const archive = join(artifacts, packed.filename), sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
    for (const file of ['packages/core/document-authoring.mjs', 'packages/core/document-authoring.d.ts', 'packages/cli/commands/document-authoring.mjs', 'contracts/authoring-release.json', 'contracts/schemas/qa-authoring.schema.json', 'docs/document-authoring.md', 'examples/composition.qa.json'])
        assert(packed.files.some(f => f.path === file), 'Missing document authoring package file: ' + file);
    const consumer = await mkdtemp(join(tmpdir(), 'aqa-package-consumer-'));
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'isolated-qa-consumer', private: true, type: 'module' }));
    await run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive], consumer);
    return { packed, archive, sha256, consumer };
}
