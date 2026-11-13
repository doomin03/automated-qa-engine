import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeBlueprint, loadBlueprint, QaError } from 'automated-qa-engine';
import { createHash } from 'node:crypto';

test('settlement release preserves execution authoring Agent and alpha9 release bytes', async () => {
  const files = JSON.parse(await readFile(new URL('./fixtures/event-settlement-preservation.json', import.meta.url)));
  for (const [file, expected] of Object.entries(files)) {
    const actual = createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex');
    assert.equal(actual, expected, file);
  }
  const metadata = JSON.parse(await readFile(new URL('../contracts/authoring-release.json', import.meta.url)));
  assert.match(metadata.artifact, /^qa-authoring-[0-9A-Za-z.-]+-engine-[0-9A-Za-z.-]+\.json$/);
  assert(!metadata.artifact.includes('..'));
});

async function exercise(mode, observerMode = 'healthy', cleanupFails = false) {
  const blueprint = await loadBlueprint('examples/login.qa.json');
  const controller = new AbortController();
  const received = [];
  let ended = 0;
  const started = performance.now();
  const out = await executeBlueprint(blueprint, {
    reportDir: await mkdtemp(join(tmpdir(), 'aqa-settlement-')),
    signal: controller.signal,
    timeoutMs: mode === 'timeout' ? 120 : 3000,
    adapter: {
      getCapabilities: () => ({ platforms: ['web'], supportedActions: blueprint.flow.nodes.flatMap(n => n.action ? [n.action] : []) }),
      startSession: async () => {},
      performAction: async () => {
        if (mode === 'timeout') return new Promise(() => {});
        if (mode === 'assertion') throw new QaError('ASSERTION_FAILED', 'Original assertion', 'step');
        controller.abort();
        throw new QaError('CANCELLED', 'Execution cancelled', 'run');
      },
      captureEvidence: async () => false,
      endSession: async () => { ended++; if (cleanupFails) throw new Error('private-cleanup-secret'); },
    },
    onEvent: async event => {
      received.push(event);
      if (event.type === 'step.finished' && event.outcome !== 'passed') {
        if (observerMode === 'reject') throw new Error('private-observer-secret');
        if (observerMode === 'hang') return new Promise(() => {});
        if (observerMode === 'late-abort') {
          controller.abort();
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    },
  });
  const result = JSON.parse(await readFile(join(out.reportDir, 'result.json'), 'utf8'));
  const durable = (await readFile(join(out.reportDir, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(ended, 1);
  assert.deepEqual(out.result, result);
  durable.forEach((e, i) => assert.equal(e.sequence, i + 1));
  assert.equal(durable.at(-1).type, 'run.finished');
  assert.equal(durable.at(-1).outcome, result.outcome);
  assert(!JSON.stringify({ result, durable }).includes('private-'));
  assert(performance.now() - started < 2500);
  return { result, received, durable };
}

for (const mode of ['cancel', 'timeout']) test('healthy settlement observer receives terminal after ' + mode, async () => {
  const { result, received, durable } = await exercise(mode);
  assert.equal(result.outcome, mode === 'cancel' ? 'cancelled' : 'failed');
  assert.equal(result.failure.code, mode === 'cancel' ? 'CANCELLED' : 'TIMEOUT');
  assert.equal(result.failure.phase, 'run');
  assert.deepEqual(result.cleanupErrors, []);
  assert.deepEqual(received, durable);
});

for (const observer of ['reject', 'hang']) test('real settlement observer ' + observer + ' retains cancellation', async () => {
  const { result, received } = await exercise('cancel', observer);
  assert.equal(result.outcome, 'cancelled');
  assert.equal(result.cleanupErrors[0].code, 'ENGINE_ERROR');
  assert.equal(received.at(-1).type, 'step.finished');
  assert.equal(received.at(-1).outcome, 'cancelled');
});

test('abort inside healthy failure observer preserves assertion and delivers terminal', async () => {
  const { result, received, durable } = await exercise('assertion', 'late-abort');
  assert.equal(result.failure.code, 'ASSERTION_FAILED');
  assert.equal(result.failure.nodeId, 'open');
  assert.deepEqual(result.cleanupErrors, []);
  assert.deepEqual(received, durable);
});

test('real cleanup failure remains distinct from healthy cancellation delivery', async () => {
  const { result, received } = await exercise('cancel', 'healthy', true);
  assert.equal(result.outcome, 'cancelled');
  assert.deepEqual(result.cleanupErrors, [{ code: 'CLEANUP_ERROR', message: 'Runner cleanup failed', phase: 'cleanup' }]);
  assert.equal(received.at(-1).type, 'run.finished');
});
