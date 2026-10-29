import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeBlueprint,loadBlueprint,QaError,validateSchema } from 'automated-qa-engine';
import { PlaywrightAdapter } from 'automated-qa-engine/playwright';
import { startDemoServer } from '../examples/server.mjs';

async function env(t) {
  const server=await startDemoServer();t.after(()=>server.close());
  const blueprint=await loadBlueprint('examples/login.qa.json');
  blueprint.target.launchTargets.login=server.origin;blueprint.target.allowedOrigins=[server.origin];
  return {blueprint,adapter:new PlaywrightAdapter(),reportDir:await mkdtemp(join(tmpdir(),'aqa-lifecycle-'))};
}
async function inspect(reportDir) {
  const [run]=await readdir(reportDir), dir=join(reportDir,run);
  const result=validateSchema(JSON.parse(await readFile(join(dir,'result.json'),'utf8')));
  const events=(await readFile(join(dir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  events.forEach((event,index)=>{validateSchema(event);assert.equal(event.sequence,index+1);});
  assert.equal(events.at(-1).type,'run.finished');
  assert.equal(events.at(-1).outcome,result.outcome);
  const finished=events.filter(e=>e.type==='step.finished').map(e=>e.nodeId);
  assert.equal(new Set(finished).size,finished.length);
  return {result,events,dir};
}

for(const point of ['step.started','step.finished']) test('persistent callback rejection at '+point+' preserves terminal evidence and closes browser',async t=>{
  const {blueprint,adapter,reportDir}=await env(t);let rejected=0;
  const output=await executeBlueprint(blueprint,{adapter,reportDir,onEvent:event=>{
    if(event.type===point && event.nodeId==='name') {rejected++;throw new Error('private-secret-must-not-appear');}
    if(rejected) throw new Error('Callback must be disabled after rejection');
  }});
  assert.equal(output.result.outcome,'infra_error');assert.equal(output.result.failure.code,'ENGINE_ERROR');
  assert.equal(adapter.browser.isConnected(),false);assert.equal(rejected,1);
  const saved=await inspect(reportDir);assert(!JSON.stringify(saved).includes('private-secret'));
});

test('unresolved callback is bounded by run timeout and closes browser',async t=>{
  const {blueprint,adapter,reportDir}=await env(t), started=Date.now();
  const output=await executeBlueprint(blueprint,{adapter,reportDir,timeoutMs:1800,onEvent:event=>{
    if(event.type==='step.started' && event.nodeId==='name') return new Promise(()=>{});
  }});
  assert.equal(output.result.outcome,'infra_error');assert.equal(output.result.failure.code,'ENGINE_ERROR');
  assert(Date.now()-started<6000);assert.equal(adapter.browser.isConnected(),false);await inspect(reportDir);
});

test('AbortSignal interrupts unresolved observer, writes cancelled result and releases browser',async t=>{
  const {blueprint,adapter,reportDir}=await env(t),controller=new AbortController();
  const output=await executeBlueprint(blueprint,{adapter,reportDir,signal:controller.signal,onEvent:event=>{
    if(event.type==='step.started'&&event.nodeId==='name') {
      setTimeout(()=>controller.abort(),50);return new Promise(()=>{});
    }
  }});
  assert.equal(output.result.outcome,'cancelled');assert.equal(adapter.browser.isConnected(),false);await inspect(reportDir);
});

for(const hangs of [false,true]) test('terminal callback '+(hangs?'timeout':'rejection')+' rejects API but preserves immutable completed result',async t=>{
  const {blueprint,adapter,reportDir}=await env(t);
  await assert.rejects(executeBlueprint(blueprint,{adapter,reportDir,onEvent:event=>{
    if(event.type==='run.finished') {if(hangs)return new Promise(()=>{});throw new Error('private-terminal-secret');}
  }}),e=>e instanceof QaError && e.code==='ENGINE_ERROR' && e.phase==='run' && !e.message.includes('private-terminal-secret'));
  assert.equal(adapter.browser.isConnected(),false);
  const saved=await inspect(reportDir);assert.equal(saved.result.outcome,'passed');assert(!JSON.stringify(saved).includes('private-terminal-secret'));
});

test('hanging failure evidence is bounded and preserves original failure and cleanup',async()=>{
  const blueprint=await loadBlueprint('examples/login.qa.json'),reportDir=await mkdtemp(join(tmpdir(),'aqa-hanging-evidence-'));
  let closed=false;
  const adapter={
    getCapabilities:()=>({platforms:['web'],supportedActions:compileActions(blueprint)}),
    startSession:async()=>{},performAction:async()=>{throw new QaError('ASSERTION_FAILED','Original failure','step');},
    captureEvidence:()=>new Promise(()=>{}),endSession:async()=>{closed=true;}
  };
  const started=Date.now();
  const output=await executeBlueprint(blueprint,{adapter,reportDir});
  assert.equal(closed,true);assert(Date.now()-started<6000);
  assert.equal(output.result.failure.code,'ASSERTION_FAILED');assert.equal(output.result.outcome,'failed');
  assert.equal(output.result.cleanupErrors[0].code,'EVIDENCE_ERROR');await inspect(reportDir);
});
function compileActions(b) {return [...new Set(b.flow.nodes.flatMap(n=>n.action?[n.action]:[]))];}
