import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const engine = pkg.name === 'automated-qa-engine';
assert.match(process.versions.node, /^24\./, 'Use Node 24 from .node-version');
assert.equal(pkg.private, true, 'P0 tooling must not publish as a product');
assert.equal(pkg.devDependencies['@fission-ai/openspec'], '1.14.2');
assert.equal(pkg.packageManager, engine ? 'npm@11.16.0' : 'pnpm@10.34.8');
assert(existsSync(resolve(root, engine ? 'package-lock.json' : 'pnpm-lock.yaml')), 'Missing lockfile');
assert(!existsSync(resolve(root, engine ? 'pnpm-lock.yaml' : 'package-lock.json')), 'Mixed package managers');
for (const p of ['AGENTS.md', '.env.example', 'docs/architecture/repository-audit.md', 'docs/architecture/system-design.md', 'docs/planning/roadmap.md', 'docs/development.md', 'docs/validation.md']) {
  assert(existsSync(resolve(root, p)), 'Missing foundation file: ' + p);
}
assert.match(read('openspec/config.yaml'), /schema: spec-driven/);
assert.match(read('openspec/config.yaml'), /Language: Korean/);
const changes = engine ? ['qa-flow-schema-core', 'qa-playwright-runner', 'qa-ai-blueprint'] : ['qa-flow-editor', 'qa-platform-services'];
for (const change of changes) {
  const base = 'openspec/changes/' + change;
  for (const p of ['.openspec.yaml', 'proposal.md', 'design.md', 'tasks.md']) assert(existsSync(resolve(root, base, p)), 'Missing change artifact: ' + change + '/' + p);
  const proposal = read(base + '/proposal.md');
  for (const key of ['integrationId: automated-qa-foundation', 'contractVersion: 0.1.0-draft.1', 'dependsOn:', 'counterpartRepoChange:', 'acceptanceCriteria:']) assert(proposal.includes(key), 'Missing integration metadata: ' + key);
  assert.match(read(base + '/tasks.md'), /- \[[ x]\]/, 'Task tracking is required');
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(resolve(path, e.name)) : [resolve(path, e.name)]);
}
const docs = [resolve(root, 'README.md'), ...walk(resolve(root, 'docs')), ...walk(resolve(root, 'openspec'))].filter(p => p.endsWith('.md'));
let links = 0;
for (const file of docs) {
  const body = readFileSync(file, 'utf8');
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|#)/.test(href)) continue;
    const path = decodeURIComponent(href.split('#')[0]);
    if (!path) continue;
    const target = resolve(dirname(file), path);
    const fromRoot = relative(root, target);
    assert(!fromRoot.startsWith('..') && !isAbsolute(fromRoot), 'Nonportable local link: ' + file + ': ' + href);
    assert(existsSync(target), 'Broken local link: ' + file + ': ' + href);
    links++;
  }
}
if (engine) {
  const manifest = JSON.parse(read('contracts/manifest.json'));
  assert.equal(manifest.owner, pkg.name);
  assert.equal(manifest.contractVersion, '0.1.0-draft.1');
  assert.equal(manifest.status, 'preview');
  assert.equal(manifest.engineVersion, pkg.version);
  assert(!manifest.outcomes.includes('unrun'));
  assert.equal(new Set(manifest.schemas).size, manifest.schemas.length);
  assert(manifest.actions.includes('tap') && manifest.actions.includes('input'));
  assert(!manifest.actions.includes('click') && !manifest.actions.includes('fill'));
} else {
  assert(!existsSync(resolve(root, '.gitmodules')), 'Engine submodule is forbidden');
  assert(!existsSync(resolve(root, 'packages/engine')), 'Engine source copy is forbidden');
  const workspace = read('pnpm-workspace.yaml');
  assert(!workspace.includes('apps/app') && !workspace.includes('api_client_dart'), 'Dart directories are not pnpm packages');
  for (const p of ['apps/server', 'apps/web', 'apps/app', 'packages/contract', 'packages/api-client', 'packages/api_client_dart', 'packages/typescript-config']) assert(statSync(resolve(root, p)).isDirectory(), 'Missing planned boundary: ' + p);
}
console.log(pkg.name + ': foundation OK; ' + docs.length + ' Markdown files, ' + links + ' local links. Runtime tests run separately.');

