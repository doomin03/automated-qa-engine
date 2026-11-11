import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeModule,checkGraph} from '../scripts/architecture/graph.mjs';
const module=(path,source)=>analyzeModule(source,path);
test('architecture AST ignores comments/strings and rejects computed imports',()=>{
  const parsed=module('packages/core/a.mjs',`// import './bad.mjs'\nconst text="import('./bad.mjs')"; export * from './b.mjs'; import(\`./c.mjs\`); import(name);`);
  assert.equal(parsed.edges.length,3);
  assert.equal(checkGraph([parsed],{files:['packages/core/b.mjs','packages/core/c.mjs']}).errors[0].reason,'unapproved-computed-path');
});
test('architecture rejects transitive forbidden dependencies and ESM cycles',()=>{
  const modules=[module('packages/core/a.mjs',"import './bridge.mjs'"),module('packages/core/bridge.mjs',"export * from '../../cli/x.mjs'"),module('cli/x.mjs',"import '../packages/core/a.mjs'")];
  assert(checkGraph(modules).errors.some(e=>e.reason==='esm-cycle'));
  const forbidden=[module('packages/core/a.mjs',"import '../shared.mjs'"),module('packages/shared.mjs',"import '../runners/x.mjs'"),module('runners/x.mjs','')];
  assert(checkGraph(forbidden).errors.some(e=>e.reason==='forbidden-dependency'&&e.file==='packages/core/a.mjs'));
});
test('architecture process and worker paths require files but do not create ESM cycles',()=>{
  const modules=[module('packages/agent/child.mjs',"const cli=new URL('../cli/aqa.mjs',import.meta.url);"),module('packages/cli/aqa.mjs',"import '../agent/child.mjs'; new Worker(new URL('./worker.mjs',import.meta.url));")];
  assert.deepEqual(checkGraph(modules).errors.map(e=>e.reason),['missing-target']);
  assert(checkGraph(modules,{files:[...modules.map(m=>m.path),'packages/cli/worker.mjs']}).ok);
});
test('architecture computed exceptions bind exact location/expression and fail stale entries',()=>{
  const m=module('packages/core/a.mjs','import(name);');
  const e={file:m.path,...m.edges[0],targets:['packages/core/b.mjs'],reason:'fixture explicit target'};
  assert(checkGraph([m],{files:[m.path,...e.targets],exceptions:[e]}).ok);
  assert(!checkGraph([module(m.path,'\nimport(name);')],{files:e.targets,exceptions:[e]}).ok);
});
test('architecture rejects absolute, file URL and self-package dependency escapes',()=>{
  for(const target of ['file:///tmp/runners/a.mjs','C:/runtime/a.mjs','/runtime/a.mjs','automated-qa-engine/private']) {
    const graph=checkGraph([module('packages/core/a.mjs',`import ${JSON.stringify(target)};`)]);
    assert.equal(graph.errors[0].reason,'unsupported-local-specifier');
  }
  const self=[module('packages/core/a.mjs',"import 'automated-qa-engine/playwright'"),module('runners/playwright/adapter.mjs','')];
  assert(checkGraph(self).errors.some(e=>e.reason==='forbidden-dependency'));
});
test('architecture rejects aliased CommonJS loaders and detects namespace worker entries',()=>{
  const cases=[
    "import * as modules from 'node:module'; modules.createRequire(import.meta.url);",
    "import * as workers from 'node:worker_threads'; new workers.Worker('./missing.mjs');",
    "import {Worker as W} from 'worker_threads'; new W('./missing.mjs');",
    "import {Worker} from 'node:worker_threads'; import {URL as U} from 'url'; new Worker(new U('./missing.mjs',import.meta.url));",
    "new Worker(new URL('file:///C:/missing.mjs'));",
  ];
  for(const source of cases)assert.equal(checkGraph([module('packages/core/a.mjs',source)]).ok,false);
  for(const path of ['packages/core/bridge.js','packages/core/bridge.cjs','packages/core/bridge.ts'])assert.equal(checkGraph([module(path,'')]).ok,false);
});
