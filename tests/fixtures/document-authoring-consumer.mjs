import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { listTemplates, createTemplate, composeBlueprint, blueprintXml, compileBlueprint, parseSource, executeBlueprint, validateSchema } from 'automated-qa-engine';
import { PlaywrightAdapter } from 'automated-qa-engine/playwright';
const sha = v => createHash('sha256').update(v).digest('hex');
const root = resolve('document-authoring-resources'); await mkdir(root, { recursive: true });
const packageRoot = resolve('node_modules/automated-qa-engine'), cli = join(packageRoot, 'packages/cli/aqa.mjs');
const release = JSON.parse(await readFile(join(packageRoot, 'contracts/authoring-release.json')));
assert.match(release.artifact, /^qa-authoring-[0-9A-Za-z.-]+\.json$/);
assert(!release.artifact.includes('..'));
assert.equal(sha(await readFile(join(packageRoot, 'contracts/releases', release.artifact))), release.sha256);
assert.equal(sha(await readFile(join(packageRoot, 'contracts/schemas/qa.schema.json'))), release.executionSchemaSha256);
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<input id="name"><button id="submit">Submit</button>'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const target = { schemaVersion: 'qa.target/v1', id: 'local', platform: 'web', environment: 'local', allowedOrigins: [origin], launchTargets: { form: origin } };
const selectors = { schemaVersion: 'qa.selectors/v1', id: 'selectors', selectors: { name: { web: { strategy: 'css', value: '#name' } }, missing: { web: { strategy: 'css', value: '#absent' } } } };
const template = listTemplates().templates.find(t => t.id === 'web-input-check');
const generated = createTemplate({ templateId: template.id, version: template.version, sha256: template.sha256, bindings: { id: 'form', target, selectors, launch: 'form', selector: 'name', value: 'public-input' } });
const pass = structuredClone(generated.blueprint);
pass.flow.nodes.splice(-1, 0, { id: 'shot', type: 'action', action: 'screenshot', params: { required: true } });
pass.flow.edges = pass.flow.nodes.slice(1).map((n, i) => ({ from: pass.flow.nodes[i].id, to: n.id }));
const fail = structuredClone(pass); Object.assign(fail.flow.nodes.find(n => n.action === 'assertValue'), { timeoutMs: 100, params: { selector: 'name', expected: 'deliberately-wrong' } });
const cancel = structuredClone(pass); Object.assign(cancel.flow.nodes.find(n => n.action === 'waitFor'), { timeoutMs: 10000, params: { selector: 'missing' } });
function composition(blueprint) {
    const source = blueprintXml(blueprint);
    return { schemaVersion: 'qa.composition/v1', assets: [{ id: 'form', format: 'xml', source, sha256: sha(source) }], instances: [{ id: 'first', assetId: 'form' }, { id: 'second', assetId: 'form' }], links: [{ from: 'first', to: 'second' }] };
}
function call(args, cancelId) {
    return new Promise((done, reject) => {
        const child = spawn(process.execPath, [cli, ...args], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', buffer = '', sent = false;
        const timer = setTimeout(() => { child.kill(); reject(new Error('Installed CLI watchdog')); }, 30000);
        child.stdout.on('data', bytes => {
            stdout += bytes; buffer += bytes;
            let end;
            while ((end = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
                if (!cancelId || !line) continue;
                const e = JSON.parse(line);
                if (!sent && e.type === 'step.started' && e.nodeId === cancelId) { sent = true; child.stdin.write('{"type":"cancel"}\n'); }
            }
        });
        child.stderr.on('data', b => stderr += b);
        child.on('error', e => { clearTimeout(timer); reject(e); });
        child.on('close', code => { clearTimeout(timer); done({ code, stdout, stderr, cancelSent: sent }); });
    });
}
const runs = [];
async function verify(dir, outcome, authored, transport) {
    const result = validateSchema(JSON.parse(await readFile(join(dir, 'result.json'))));
    const events = (await readFile(join(dir, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(result.outcome, outcome); assert.equal(events.at(-1).outcome, outcome);
    for (const [i, e] of events.entries()) { validateSchema(e); assert.equal(e.sequence, i + 1); assert.equal(e.runId, result.runId); if (e.nodeId && !authored.sourceMap.syntheticNodes.includes(e.nodeId)) assert.ok(authored.sourceMap.nodes[e.nodeId]); }
    const actualPlan = JSON.parse(await readFile(join(dir, 'plan.json')));
    assert.equal(actualPlan.blueprintSnapshotHash, authored.blueprintSnapshotHash);
    for (const artifact of result.artifacts) assert.equal(sha(await readFile(join(dir, artifact.path))), artifact.sha256);
    if (outcome === 'failed') assert.equal(authored.sourceMap.nodes[result.failure.nodeId].sourceNodeId, pass.flow.nodes.find(n => n.action === 'assertValue').id);
    runs.push({ transport, outcome, runId: result.runId, reportDir: dir, blueprintSnapshotHash: authored.blueprintSnapshotHash, sourceMap: authored.sourceMap, artifactCount: result.artifacts.length });
}
try {
    for (const [name, blueprint, outcome, code] of [['pass', pass, 'passed', 0], ['fail', fail, 'failed', 1], ['cancel', cancel, 'cancelled', 5]]) {
        const input = composition(blueprint), authored = composeBlueprint(input);
        assert.equal(compileBlueprint(parseSource(authored.xml, 'xml')).blueprintSnapshotHash, authored.blueprintSnapshotHash);
        const source = join(root, name + '.composition.json'); await writeFile(source, JSON.stringify(input));
        const transformed = await call(['compose', source]); assert.equal(transformed.code, 0, transformed.stdout + transformed.stderr);
        assert.deepEqual(JSON.parse(transformed.stdout), authored);
        const xml = join(root, name + '.xml'); await writeFile(xml, authored.xml);
        const cancelId = Object.keys(authored.sourceMap.nodes).find(id => authored.sourceMap.nodes[id].instanceId === 'first' && authored.sourceMap.nodes[id].sourceNodeId === blueprint.flow.nodes.find(n => n.action === 'waitFor').id);
        const controller = new AbortController(), observed = [];
        let cancelTimer;
        const adapter = new PlaywrightAdapter();
        let executed;
        try {
            executed = await executeBlueprint(authored.blueprint, {
                adapter, reportDir: root, signal: controller.signal,
                onEvent: event => {
                    observed.push(event);
                    if (name === 'cancel' && event.type === 'step.started' && event.nodeId === cancelId)
                        cancelTimer = setTimeout(() => controller.abort(), 30);
                },
            });
        } finally { clearTimeout(cancelTimer); }
        assert.equal(adapter.browser.isConnected(), false);
        assert.deepEqual(executed.result.cleanupErrors, []);
        assert.equal(observed.at(-1).type, 'run.finished');
        const durable = (await readFile(join(executed.reportDir, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
        assert.deepEqual(observed, durable);
        await verify(executed.reportDir, outcome, authored, 'api');
        Object.assign(runs.at(-1), { observerSequencesEqualDurable: true, observerTerminalReceived: true, browserDisconnected: true, cleanupErrors: executed.result.cleanupErrors });
        const run = await call(['run', xml, '--report', root, '--json', '--control-stdin', '--diagnostics', 'stderr'], name === 'cancel' ? cancelId : undefined);
        assert.equal(run.code, code, run.stderr);
        if (name === 'cancel') assert.equal(run.cancelSent, true);
        const terminal = run.stdout.trim().split('\n').map(JSON.parse).at(-1);
        assert.equal(terminal.type, 'run.finished');
        const outputEvents = run.stdout.trim().split('\n').map(JSON.parse);
        const savedEvents = (await readFile(join(root, terminal.runId, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
        assert.deepEqual(outputEvents, savedEvents);
        assert.deepEqual(JSON.parse(await readFile(join(root, terminal.runId, 'result.json'))).cleanupErrors, []);
        await verify(join(root, terminal.runId), outcome, authored, 'cli');
        Object.assign(runs.at(-1), { outputSequencesEqualDurable: true, exitCode: run.code, cleanupErrors: [] });
    }
    console.log(JSON.stringify({ status: 'passed', authoringRelease: release, runs }));
} finally { await new Promise(r => server.close(r)); }
