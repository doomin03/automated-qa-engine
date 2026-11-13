import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {startDemoServer} from '../examples/server.mjs';
import {compileBlueprint,ENGINE_VERSION} from '../packages/core/compiler.mjs';
import {executeChild} from '../packages/agent/child.mjs';
import {LeaseGuard} from '../packages/agent/lease.mjs';
import {agentFixture} from './fixtures/agent-fixture.mjs';
test('lease cutoff uses request-start time and refuses stale fences or expired response',()=>{
 const f=agentFixture();let now=1000;const guard=new LeaseGuard(f.lease,0,{now:()=>now});assert.equal(guard.cutoff,25000);
 now=24000;guard.update({...f.lease,validForMs:10000},20000);assert.equal(guard.cutoff,25000);assert.throws(()=>guard.update({...f.lease,fence:2},20000));now=25000;assert.throws(()=>guard.check());assert(guard.signal.aborted);guard.dispose();
 const expired=new LeaseGuard({...f.lease,validForMs:4000},0,{now:()=>0});assert(expired.signal.aborted);expired.dispose();
});

test('native lost session response and cleanup timeout remain unknown despite a terminal result',async()=>{
 for(const mode of ['lost-session','cleanup-timeout','cancel-creation']){
  const controller=new AbortController();let sessions=0,deletes=0,late;
  const server=createServer((req,res)=>{if(req.url==='/session'){sessions++;if(mode==='lost-session'){res.destroy();return;}if(mode==='cancel-creation'){setTimeout(()=>controller.abort(),30);late=setTimeout(()=>res.end(JSON.stringify({value:{sessionId:'late-session',capabilities:{}}})),300);return;}}if(req.method==='DELETE'){deletes++;return;}res.setHeader('content-type','application/json');res.end(JSON.stringify({value:req.url==='/session'?{sessionId:'remote-session',capabilities:{}}:null}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const root=await mkdtemp(join(tmpdir(),'aqa-agent-native-unknown-')),nodes=[{id:'start',type:'start'},{id:'open',type:'action',action:'launch',params:{target:'app'}},{id:'end',type:'end'}];
   const b={schemaVersion:'qa.blueprint/v1',id:'native-unknown',target:{schemaVersion:'qa.target/v1',id:'android',platform:'android',environment:'test',launchTargets:{app:'org.example.qa'}},selectors:{schemaVersion:'qa.selectors/v1',id:'selectors',selectors:{}},flow:{schemaVersion:'qa.flow/v1',id:'flow',entryNode:'start',nodes,edges:[{from:'start',to:'open'},{from:'open',to:'end'}]}};
   const file=join(root,'blueprint.json'),appiumConfig=join(root,'appium.json');await writeFile(file,JSON.stringify(b));await writeFile(appiumConfig,JSON.stringify({endpoint:'http://127.0.0.1:'+server.address().port,requestTimeoutMs:100,capabilities:{'appium:automationName':'UiAutomator2','appium:udid':'protocol-fixture','appium:deviceName':'protocol-fixture'}}));
   const out=await executeChild({item:{root,file,caseId:'native',blueprintSnapshotHash:compileBlueprint(b).blueprintSnapshotHash},blueprint:b,expectedVersion:ENGINE_VERSION,config:{credentials:{},maxRunMs:3000},resource:{platform:'android',allowProduction:false},appiumConfig,signal:controller.signal,onEvent:async()=>{}});
   assert.equal(sessions,1);assert.equal(out.cleanupState,'unknown');assert(out.result,'real terminal result remains available');if(mode==='lost-session'){assert.equal(out.result.outcome,'infra_error');assert.equal(deletes,0);}else if(mode==='cancel-creation'){assert.equal(out.result.outcome,'cancelled');assert.equal(deletes,0);assert(out.result.cleanupErrors.some(e=>e.code==='CLEANUP_ERROR'));}else{assert.equal(deletes,1);assert(out.result.cleanupErrors.some(e=>e.code==='CLEANUP_ERROR'));}
  }finally{clearTimeout(late);server.closeAllConnections();await new Promise(r=>server.close(r));}
 }
});
test('Agent child CLI actual PASS/FAIL/cancel preserves Engine events and cleanup evidence',async t=>{
 const server=await startDemoServer();t.after(()=>server.close());const root=await mkdtemp(join(tmpdir(),'aqa-agent-child-'));
 for(const mode of ['passed','failed','cancelled']){
  const f=agentFixture(),b=f.blueprint;b.target.launchTargets.login=server.origin;b.target.allowedOrigins=[server.origin];
  if(mode==='failed')b.flow.nodes.find(n=>n.id==='home').params.expected='intentionally wrong';
  const dir=join(root,mode);await mkdir(dir);await writeFile(join(dir,'blueprint.json'),JSON.stringify(b));const item={root:dir,file:join(dir,'blueprint.json'),caseId:'case',blueprintSnapshotHash:compileBlueprint(b).blueprintSnapshotHash},controller=new AbortController(),events=[];
  const out=await executeChild({item,blueprint:b,expectedVersion:ENGINE_VERSION,config:f.config,resource:f.config.resources['web-slot'],signal:controller.signal,onEvent:async e=>{events.push(e);if(mode==='cancelled'&&e.type==='run.started')controller.abort();}});
  assert.equal(out.result?.outcome,mode);assert.equal(out.cleanupState,'confirmed');assert.equal(events.at(-1).type,'run.finished');assert.equal(events.at(-1).outcome,mode);if(mode!=='cancelled')assert(out.artifacts.length>0);
 }
});
