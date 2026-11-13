import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdtemp, mkdir, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listTemplates } from '../packages/core/document-authoring.mjs';
const exec = promisify(execFile), cli = resolve('packages/cli/aqa.mjs');
async function run(args) {
    try { const r = await exec(process.execPath, [cli, ...args], { timeout: 15000, windowsHide: true, maxBuffer: 5 * 1048576 }); return { ...r, code: 0 }; }
    catch (e) { return { stdout: e.stdout, stderr: e.stderr, code: e.code }; }
}
const b = JSON.parse(await readFile(new URL('../examples/login.qa.json', import.meta.url)));
const f = JSON.parse(await readFile(new URL('./fixtures/compose-inputs.json', import.meta.url))).fixtures[0];
const input = { schemaVersion: 'qa.composition/v1', assets: f.assets.map(({ id, format, source, sha256 }) => ({ id, format, source, sha256 })), instances: f.instances.map(({ id, assetId }) => ({ id, assetId })), links: f.links };
test('public CLI catalog, pinned create, compose envelope and explicit legacy plan/import/export roundtrip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aqa-compose-cli-'));
    const catalog = await run(['templates', 'list', '--json']);
    assert.equal(catalog.code, 0);
    assert.deepEqual(JSON.parse(catalog.stdout), listTemplates());
    const t = listTemplates().templates.find(t => t.id === 'web-input-check');
    const show = await run(['templates', 'show', t.id, '--template-version', t.version]);
    assert.deepEqual(JSON.parse(show.stdout), t);
    const bindings = join(dir, 'bindings.json');
    await writeFile(bindings, JSON.stringify({ id: 'input', target: b.target, selectors: b.selectors, launch: 'login', selector: 'username', value: 'qa-user' }));
    const created = await run(['templates', 'create', t.id, '--template-version', t.version, '--template-sha256', t.sha256, '--bindings', bindings]);
    assert.equal(created.code, 0, created.stdout);
    const source = join(dir, 'compose.json'), out = join(dir, 'result.json');
    await writeFile(source, JSON.stringify(input));
    assert.equal((await run(['compose', source, '--out', out, '--document-root', dir])).code, 0);
    const result = JSON.parse(await readFile(out, 'utf8'));
    const xml = join(dir, 'result.xml'); await writeFile(xml, result.xml);
    const plan = await run(['plan', xml]); assert.equal(plan.code, 0);
    assert.equal(JSON.parse(plan.stdout).blueprintSnapshotHash, result.blueprintSnapshotHash);
    const json = join(dir, 'imported.json'), exported = join(dir, 'exported.xml');
    assert.equal((await run(['import', xml, '--out', json])).code, 0);
    assert.equal((await run(['export', json, '--format', 'xml', '--out', exported])).code, 0);
    assert.equal(JSON.parse((await run(['plan', exported])).stdout).blueprintSnapshotHash, result.blueprintSnapshotHash);
    assert.ok(!(await readdir(dir)).some(n => n.startsWith('run_')));
});
test('CLI exclusive output, explicit root and junction containment preserve all original bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aqa-compose-path-')), inside = join(dir, 'inside'), outside = join(dir, 'outside');
    await mkdir(inside); await mkdir(outside);
    const source = join(inside, 'source.json'), existing = join(inside, 'out.json'), escaped = join(outside, 'new.json');
    const text = JSON.stringify(input); await writeFile(source, text); await writeFile(existing, 'PRESERVE');
    assert.equal((await run(['compose', source, '--out', source])).code, 2);
    assert.equal((await run(['compose', source, '--out', existing])).code, 2);
    assert.equal(await readFile(source, 'utf8'), text); assert.equal(await readFile(existing, 'utf8'), 'PRESERVE');
    assert.equal((await run(['compose', source, '--out', escaped, '--document-root', inside])).code, 4);
    const link = join(inside, 'link'); await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(join(outside, 'source.json'), text);
    assert.equal((await run(['compose', join(link, 'source.json'), '--document-root', inside])).code, 4);
    assert.equal((await run(['compose', source, '--out', join(link, 'out.json'), '--document-root', inside])).code, 4);
    assert.deepEqual(await readdir(outside), ['source.json']);
    assert.equal((await run(['compose', join(inside, '..', 'outside', 'source.json'), '--document-root', inside])).code, 4);
    if (process.platform === 'win32') {
        // Lexical escape is rejected before an SMB connection/realpath attempt.
        assert.equal((await run(['compose', '\\\\not-a-server.invalid\\share\\input.json', '--document-root', inside])).code, 4);
        assert.equal((await run(['compose', source, '--out', '\\\\not-a-server.invalid\\share\\out.json', '--document-root', inside])).code, 4);
    }
});
test('CLI rejects malformed UTF-8, oversized input, wrong flags and keeps diagnostics stderr separate', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aqa-compose-invalid-')), file = join(dir, 'bad.json');
    await writeFile(file, Buffer.from([0xff, 0xfe]));
    const r = await run(['compose', file, '--diagnostics', 'stderr']);
    assert.equal(r.code, 2); assert.equal(r.stdout, ''); assert.ok(JSON.parse(r.stderr).error);
    await writeFile(file, ' '.repeat(1048577)); assert.equal((await run(['compose', file])).code, 2);
    assert.equal((await run(['compose', file, '--headed'])).code, 2);
    assert.equal((await run(['compose', file, 'extra'])).code, 2);
    assert.equal((await run(['templates', 'show', 'empty'])).code, 2);
    assert.equal((await run(['templates', 'list', '--bindings', file])).code, 2);
    assert.equal((await run(['compose', dir])).code, 2);
    assert.equal((await run(['compose', join(dir, 'missing.json')])).code, 2);
    const source = join(dir, 'valid.json'); await writeFile(source, JSON.stringify(input));
    const failedWrite = await run(['compose', source, '--out', join(dir, 'missing-parent', 'new.json'), '--diagnostics', 'stderr']);
    assert.equal(failedWrite.code, 2); assert.equal(failedWrite.stdout, ''); assert.ok(JSON.parse(failedWrite.stderr).error);
});
test('public root import and independent authoring do not spawn, connect, fetch or execute adapters', async () => {
    const r = await exec(process.execPath, [resolve('tests/fixtures/document-authoring-pure.mjs')], { timeout: 15000, windowsHide: true });
    assert.equal(JSON.parse(r.stdout).effects, 0);
});
