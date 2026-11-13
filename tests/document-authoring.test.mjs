import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { listTemplates, createTemplate, composeBlueprint } from '../packages/core/document-authoring.mjs';
import { compileBlueprint } from '../packages/core/compiler.mjs';
import { parseSource } from '../packages/core/documents.mjs';
import { blueprintXml } from '../packages/core/xml.mjs';
import { canonicalJson } from '../packages/core/domain/canonical.mjs';
import { validateAuthoring } from '../packages/core/document-authoring/validation.mjs';
const sha = v => createHash('sha256').update(v).digest('hex');
const fixtures = JSON.parse(await readFile(new URL('./fixtures/compose-inputs.json', import.meta.url))).fixtures;
const baseline = JSON.parse(await readFile(new URL('./fixtures/compose-dart-baseline.json', import.meta.url))).results;
const example = JSON.parse(await readFile(new URL('../examples/login.qa.json', import.meta.url)));
const input = f => ({ schemaVersion: 'qa.composition/v1', assets: f.assets.map(({ id, format, source, sha256 }) => ({ id, format, source, sha256 })), instances: f.instances.map(({ id, assetId }) => ({ id, assetId })), links: f.links });
const error = (fn, expected) => assert.throws(fn, e => {
    assert.ok(e.details.diagnostics.length > 0);
    validateAuthoring('failure', { error: { code: e.code, message: e.message, details: e.details } });
    if (expected) assert.equal(e.details.diagnostics[0].code, expected);
    return true;
});
function request(id, bindings) {
    const t = listTemplates().templates.find(t => t.id === id);
    return { templateId: id, version: t.version, sha256: t.sha256, bindings };
}
test('actual Dart golden: four accepted and three rejected compositions, exact namespace/refs/exit labels', () => {
    for (const f of fixtures) {
        const old = baseline.find(v => v.id === f.id);
        if (!old.accepted) { error(() => composeBlueprint(input(f))); continue; }
        const result = composeBlueprint(input(f));
        assert.equal(canonicalJson(result.blueprint), canonicalJson(old.blueprint), f.id);
        assert.equal(result.blueprintSnapshotHash, 'sha256:' + old.canonicalBlueprintSha256);
        const mapped = Object.fromEntries(Object.entries(old.sourceMap).map(([key, { sourceFile, ...value }]) => [key, value]));
        assert.deepEqual(result.sourceMap.nodes, mapped);
        assert.equal(compileBlueprint(parseSource(result.xml, 'xml')).blueprintSnapshotHash, result.blueprintSnapshotHash);
        assert.deepEqual(composeBlueprint(input(f)), result);
    }
});
test('composition order independence, JSON source, immutable detached output and synthetic identities', () => {
    const original = input(fixtures.find(f => f.id === 'mixed-three'));
    const a = composeBlueprint(original), reordered = structuredClone(original);
    for (const key of ['assets', 'instances', 'links']) reordered[key].reverse();
    assert.deepEqual(composeBlueprint(reordered), a);
    const json = structuredClone(original);
    for (const asset of json.assets) {
        asset.source = JSON.stringify(parseSource(asset.source, asset.format));
        asset.format = 'json'; asset.sha256 = sha(asset.source);
    }
    const b = composeBlueprint(json);
    assert.equal(b.xml, a.xml);
    assert.equal(b.blueprintSnapshotHash, a.blueprintSnapshotHash);
    assert.deepEqual(a.sourceMap.syntheticNodes, ['composition_start', 'composition_end']);
    assert.equal(a.sourceMap.nodes.composition_start, undefined);
    assert.throws(() => { a.blueprint.flow.nodes[1].id = 'changed'; }, TypeError);
    original.instances[0].id = 'changed';
    assert.notEqual(a.sourceMap.nodes[a.blueprint.flow.nodes[1].id].instanceId, 'changed');
});
test('template catalog pins, four actual types, empty is not a composable action block', () => {
    assert.equal(listTemplates().templates.length, 4);
    const empty = createTemplate(request('empty', { id: 'empty', target: example.target }));
    assert.equal(empty.blueprint.flow.nodes.length, 2);
    assert.equal(empty.sourceMap, null);
    error(() => composeBlueprint({ schemaVersion: 'qa.composition/v1', assets: [{ id: 'a', format: 'xml', source: empty.xml, sha256: sha(empty.xml) }], instances: [{ id: 'i', assetId: 'a' }], links: [] }), 'BLOCK_BOUNDARY');
    const bindings = { id: 'web', target: example.target, selectors: example.selectors, launch: 'login', selector: 'username' };
    const click = createTemplate(request('web-open-click', bindings));
    assert.deepEqual(click.blueprint.flow.nodes.flatMap(n => n.action || []), ['launch', 'waitFor', 'tap']);
    const secret = createTemplate(request('web-input-check', { ...bindings, value: { secretRef: 'TEST_INPUT' } }));
    assert.equal(secret.blueprint.flow.variables.templateInput.ref, 'TEST_INPUT');
    assert.equal(secret.blueprint.flow.nodes.find(n => n.action === 'assertValue').params.expectedRef, 'templateInput');
    const native = createTemplate(request('native-open-check', { id: 'native', target: { schemaVersion: 'qa.target/v1', id: 'native', platform: 'android', environment: 'local', launchTargets: { app: 'com.example.app' } }, selectors: { schemaVersion: 'qa.selectors/v1', id: 's', selectors: { title: { android: { strategy: 'accessibilityId', value: 'title' } } } }, launch: 'app', selector: 'title' }));
    assert.equal(native.blueprint.target.platform, 'android');
    error(() => createTemplate({ ...request('empty', { id: 'e', target: example.target }), sha256: 'a'.repeat(64) }), 'TEMPLATE_PIN');
    error(() => createTemplate(request('web-open-click', { ...bindings, selector: undefined })));
    error(() => createTemplate(request('web-open-click', { ...bindings, endpoint: 'not-accepted' })), 'TEMPLATE_BINDING');
});
test('source hashes, duplicate IDs, unsupported paths and targets fail with bounded sanitized diagnostics', () => {
    const good = input(fixtures[0]);
    const badHash = structuredClone(good); badHash.assets[0].sha256 = '0'.repeat(64);
    error(() => composeBlueprint(badHash), 'SOURCE_HASH');
    error(() => composeBlueprint({ ...good, assets: [...good.assets, good.assets[0]] }), 'DUPLICATE_ID');
    error(() => composeBlueprint({ ...good, sourceFile: '../outside.xml' }), 'AUTHORING_SCHEMA');
    const bad = structuredClone(good);
    const b = parseSource(bad.assets[0].source, 'xml');
    b.flow.nodes.find(n => n.params?.selector).params.selector = 'PRIVATE_SECRET_MARKER';
    bad.assets[0].source = JSON.stringify(b); bad.assets[0].format = 'json'; bad.assets[0].sha256 = sha(bad.assets[0].source);
    assert.throws(() => composeBlueprint(bad), e => {
        assert.equal(e.code, 'INVALID_FLOW');
        assert.ok(!JSON.stringify(e).includes('PRIVATE_SECRET_MARKER'));
        return true;
    });
});
test('direct inputs reject accessors and over-budget payloads without executing user code', () => {
    let calls = 0;
    const getter = { get assets() { calls++; return []; } };
    error(() => composeBlueprint(getter));
    error(() => composeBlueprint({ toJSON() { calls++; return {}; } }));
    error(() => composeBlueprint({ x: 'x'.repeat(1048577) }));
    error(() => composeBlueprint(Object.create({ dangerous: true })));
    error(() => composeBlueprint({ [Symbol('private')]: 1 }));
    assert.equal(calls, 0);
});
test('composition rejects more than 1000 output nodes without returning a partial document', () => {
    const b = structuredClone(example);
    b.flow.nodes = [{ id: 'start', type: 'start' }, ...Array.from({ length: 20 }, (_, i) => ({ id: 'shot' + i, type: 'action', action: 'screenshot', params: {} })), { id: 'end', type: 'end' }];
    b.flow.edges = b.flow.nodes.slice(1).map((n, i) => ({ from: b.flow.nodes[i].id, to: n.id }));
    const source = blueprintXml(b), instances = Array.from({ length: 51 }, (_, i) => ({ id: 'i' + i, assetId: 'a' }));
    error(() => composeBlueprint({ schemaVersion: 'qa.composition/v1', assets: [{ id: 'a', format: 'xml', source, sha256: sha(source) }], instances, links: instances.slice(1).map((n, i) => ({ from: instances[i].id, to: n.id })) }), 'OUTPUT_LIMIT');
});
test('published authoring catalog/schema exact hashes and execution/Agent/history bytes remain unchanged', async () => {
    const baseline = JSON.parse(await readFile(new URL('./fixtures/document-authoring-preservation.json', import.meta.url)));
    for (const [path, expected] of Object.entries(baseline.files)) assert.equal(sha(await readFile(new URL('../' + path, import.meta.url))), expected, path);
    const release = JSON.parse(await readFile(new URL('../contracts/authoring-release.json', import.meta.url)));
    const bytes = await readFile(new URL('../contracts/releases/' + release.artifact, import.meta.url));
    assert.equal(sha(bytes), release.sha256);
    assert.equal(sha(await readFile(new URL('../contracts/schemas/qa-authoring.schema.json', import.meta.url))), release.schemaSha256);
    assert.deepEqual(JSON.parse(bytes).catalog, listTemplates());
    assert.equal(sha(await readFile(new URL('./fixtures/compose-inputs.json', import.meta.url))), '7303f33e9cec0c609612a539b7cb33a349431165f1b35bbdb7415f3e51386c22');
    assert.equal(sha(await readFile(new URL('./fixtures/compose-dart-baseline.json', import.meta.url))), 'ad48a9ca0b9bca28d1d6e9a2d850f42d99f3608517281dfdb2d9b69d4e8420a4');
});
