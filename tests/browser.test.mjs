import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { executeBlueprint } from '../packages/core/runner.mjs';
import { PlaywrightAdapter } from '../runners/playwright/adapter.mjs';
import { validateSchema } from '../packages/core/schema.mjs';
import { startDemoServer } from '../examples/server.mjs';
const original=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url)));
async function environment(t) {
  const server=await startDemoServer();t.after(()=>server.close());
  const b=structuredClone(original);b.target.allowedOrigins=[server.origin];b.target.launchTargets.login=server.origin;
  const reportDir=await mkdtemp(join(tmpdir(),'aqa-browser-'));
  return {b,reportDir};
}
test('real browser PASS and deliberate FAIL produce isolated validated evidence',async t=>{
  const {b,reportDir}=await environment(t);
  const adapter=new PlaywrightAdapter();
  const pass=await executeBlueprint(b,{adapter,reportDir});
  assert.equal(pass.result.outcome,'passed');assert.equal(adapter.browser.isConnected(),false);
  b.flow.nodes.find(n=>n.id==='home').params.expected='WRONG';
  const fail=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),reportDir});
  assert.equal(fail.result.outcome,'failed');assert.equal(fail.result.failure.code,'ASSERTION_FAILED');
  assert.equal(fail.result.failure.nodeId,'home');assert(fail.result.unvisitedNodes.includes('end'));
  assert.notEqual(pass.result.runId,fail.result.runId);
  for(const output of [pass,fail]) {
    validateSchema(output.result);
    const events=(await readFile(join(output.reportDir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);});
    assert.equal(events.at(-1).type,'run.finished');
    assert.equal(output.result.artifacts.length,1);
    for(const artifact of output.result.artifacts) {
      const bytes=await readFile(join(output.reportDir,artifact.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);
    }
  }
});
test('missing selector fails with evidence; no fabricated success',async t=>{
  const {b,reportDir}=await environment(t);b.selectors.selectors.submit.web.value='missing';b.flow.nodes[3].timeoutMs=300;
  const out=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),reportDir});
  assert.equal(out.result.outcome,'failed');
  assert(['ELEMENT_NOT_FOUND','TIMEOUT'].includes(out.result.failure.code));
});
test('cancel releases browser and marks later nodes unvisited',async t=>{
  const {b,reportDir}=await environment(t);const adapter=new PlaywrightAdapter(),controller=new AbortController();
  const out=await executeBlueprint(b,{adapter,reportDir,signal:controller.signal,onEvent:e=>{if(e.type==='step.started'&&e.nodeId==='name')controller.abort();}});
  assert.equal(out.result.outcome,'cancelled');assert.equal(adapter.browser.isConnected(),false);
  assert(out.result.unvisitedNodes.includes('submit'));
});
test('run deadline cleans up a real browser',async t=>{
  const {b,reportDir}=await environment(t);b.selectors.selectors.submit.web.value='missing';const adapter=new PlaywrightAdapter();
  const out=await executeBlueprint(b,{adapter,reportDir,timeoutMs:1800});
  assert.equal(out.result.outcome,'failed');assert.equal(adapter.browser.isConnected(),false);
});
test('browser disconnect is infra_error and session closes',async t=>{
  const {b,reportDir}=await environment(t);const adapter=new PlaywrightAdapter();
  const out=await executeBlueprint(b,{adapter,reportDir,onEvent:async e=>{if(e.type==='step.started'&&e.nodeId==='name')await adapter.browser.close();}});
  assert.equal(out.result.outcome,'infra_error');assert.equal(out.result.failure.code,'RUNNER_CRASH');
});
test('secret runs do not persist plaintext or screenshots',async t=>{
  const {b,reportDir}=await environment(t);b.flow.variables.username={from:'secret',ref:'login.name'};
  b.flow.nodes.find(n=>n.id==='home').params.expected='WRONG';
  const secret='private-value-never-store';
  const out=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),reportDir,secretResolver:()=>secret});
  assert.equal(out.result.outcome,'failed');assert.equal(out.result.artifacts.length,0);
  for(const name of ['result.json','events.jsonl','blueprint.json','plan.json','evidence.json']) assert(!(await readFile(join(out.reportDir,name),'utf8')).includes(secret));
});
test('branch visits only selected path',async t=>{
  const {b,reportDir}=await environment(t);
  b.flow.nodes=[{id:'start',type:'start'},{id:'choose',type:'branch',condition:{variable:'username',operator:'equals',value:'qa-user'}},{id:'yes',type:'end'},{id:'no',type:'end'}];
  b.flow.edges=[{from:'start',to:'choose'},{from:'choose',to:'yes',label:'true'},{from:'choose',to:'no',label:'false'}];
  const out=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),reportDir});
  assert.equal(out.result.outcome,'passed');assert.deepEqual(out.result.unvisitedNodes,['no']);
});
test('production requires explicit opt-in before session start',async t=>{
  const {b,reportDir}=await environment(t);b.target.environment='production';
  await assert.rejects(executeBlueprint(b,{adapter:new PlaywrightAdapter(),reportDir}),e=>e.code==='POLICY_DENIED');
});

