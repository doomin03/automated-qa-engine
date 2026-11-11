import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
export async function verifyConsumer({ run, npm, root, consumer, packageVersion }) {
    for (const file of ['package-consumer.mjs', 'package-consumer-valid.ts', 'package-consumer-invalid.ts', 'design-consumer.mjs', 'authoring-consumer.mjs', 'agent-consumer.mjs', 'service-consumer.mjs'])
        await copyFile(join(root, 'tests/fixtures', file), join(consumer, file));
    const binVersion = JSON.parse((await run(npm, ['exec', '--offline', '--', 'aqa', '--version'], consumer)).stdout.trim());
    assert.equal(binVersion.engineVersion, packageVersion);
    const binHelp = JSON.parse((await run(npm, ['exec', '--offline', '--', 'aqa', '--help', '--json'], consumer)).stdout.trim());
    assert(binHelp.commands);
    const tsc = join(root, 'node_modules/typescript/bin/tsc');
    const flags = ['--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022'];
    await run(tsc, [...flags, 'package-consumer-valid.ts'], consumer);
    let rejected = false;
    try {
        await run(tsc, [...flags, 'package-consumer-invalid.ts'], consumer);
    }
    catch (e) {
        assert.match(e.stdout, /TS2322/);
        assert.match(e.stdout, /TS2740/);
        rejected = true;
    }
    assert(rejected, 'Invalid TypeScript consumer must fail');
    const result = await run(join(consumer, 'package-consumer.mjs'), [], consumer);
    const design = await run(join(consumer, 'design-consumer.mjs'), [], consumer);
    const authoring = await run(join(consumer, 'authoring-consumer.mjs'), [], consumer);
    const agent = await run(join(consumer, 'agent-consumer.mjs'), [], consumer);
    const service = await run(join(consumer, 'service-consumer.mjs'), [], consumer);
    return { binVersion, binHelp, result, design, authoring, agent, service };
}
