import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {runAgent} from '../packages/agent/supervisor.mjs';
import {normalizeConfig} from '../packages/agent/config.mjs';
import {AgentError} from '../packages/agent/errors.mjs';
import {materializeNativeConfig} from '../packages/agent/materialize.mjs';
import {validateProtocol} from '../packages/agent/protocol.mjs';
import {compileBlueprint} from '../packages/core/compiler.mjs';
import {agentFixture} from './fixtures/agent-fixture.mjs';

function fixtureTransport(f,{loseClaim=false,loseAck=false,onDelivery=()=>{}}={}){
 const state={claimIds:[],events:[],results:[],receipts:[],claims:0,acks:0,release:false,uploads:new Set()};
 const envelope=value=>({value,startedAt:performance.now(),status:200});
 return {state,
  async reconcile(body){validateProtocol('ReconcileRequest',body);return envelope({agentId:f.agentId,instanceId:body.instanceId,instanceState:'active',decisions:[],hasMore:false,nextCursor:null});},
  async claim(body){validateProtocol('ClaimRequest',body);state.claims++;state.claimIds.push(body.claimRequestId);if(loseClaim&&state.claims===1)throw new AgentError('AGENT_HTTP_FAILURE','Response lost');return envelope({claimRequestId:body.claimRequestId,lease:f.lease});},
  async heartbeat(id,body){validateProtocol('HeartbeatRequest',body);return envelope({leaseId:id,fence:f.lease.fence,validForMs:30000,cancelRequested:false,state:'active',acceptedThrough:state.events.length});},
  async events(id,body){validateProtocol('EventsRequest',body);for(const e of body.events){const prior=state.events[e.deliverySequence-1];if(prior)assert.deepEqual(prior,e);else{assert.equal(e.deliverySequence,state.events.length+1);state.events.push(e);onDelivery(JSON.parse(e.engineEventJson));}}state.acks++;if(loseAck&&state.acks===1)throw new AgentError('AGENT_HTTP_FAILURE','Ack lost');return envelope({leaseId:id,fence:f.lease.fence,acceptedThrough:state.events.length});},
  async complete(id,body){validateProtocol('CompleteRequest',body);state.results=body.caseResults;state.executionStatus=body.executionStatus;
   const artifacts=body.artifactManifest.map(a=>{let r=state.receipts.find(r=>r.caseId===a.caseId&&r.path===a.path);if(!r){r={...a,artifactId:randomUUID(),uploaded:false};state.receipts.push(r);}return {...r,uploaded:state.uploads.has(r.artifactId)};});
   const closed=body.cleanupState==='confirmed'&&artifacts.every(a=>a.uploaded);
   state.completionReceipt??=randomUUID();return envelope({leaseId:id,fence:f.lease.fence,accepted:true,acceptedThrough:state.events.length,completionReceipt:closed?state.completionReceipt:null,deliveryClosed:closed,evidenceStatus:closed?'verified':'pending',cleanupState:body.cleanupState,quarantined:body.cleanupState!=='confirmed',artifacts});},
  async artifact(id,body){validateProtocol('ArtifactUploadRequest',body);state.uploads.add(body.artifactId);return envelope({...state.receipts.find(r=>r.artifactId===body.artifactId),uploaded:true});},
  async release(body){validateProtocol('InstanceReleaseRequest',body);assert.equal(body.ownerStopped,true);state.release=true;return envelope({agentId:f.agentId,reportingInstanceId:body.reportingInstanceId,ownerInstanceId:body.ownerInstanceId,released:true,remainingReceipts:0});},
 };
}
async function setup(t,modes){
 let clicks=0;
 const server=createServer((req,res)=>{if(req.url==='/click'){clicks++;res.end('ok');return;}res.setHeader('content-type','text/html');res.end('<input data-testid="username"><button data-testid="submit" onclick="fetch(\'/click\',{method:\'POST\'}).then(()=>document.querySelector(\'[data-testid=greeting]\').textContent=\'Welcome qa-user\')">Submit</button><p data-testid="greeting"></p>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const f=agentFixture(),origin='http://127.0.0.1:'+server.address().port;
 f.config.stateDir=await mkdtemp(join(tmpdir(),'aqa-agent-supervisor-'));f.config.resources['web-slot'].allowedOrigins=[origin];f.lease.executionPolicy.allowedOrigins=[origin];
 f.lease.cases=modes.map((mode,index)=>{const b=structuredClone(f.blueprint);b.target.allowedOrigins=[origin];b.target.launchTargets.login=origin;if(mode==='failed'){b.flow.nodes.find(n=>n.id==='home').params.expected='wrong';b.flow.nodes.find(n=>n.id==='home').timeoutMs=100;}return {...f.lease.cases[0],caseId:'case'+index,blueprintJson:JSON.stringify(b),blueprintSnapshotHash:compileBlueprint(b).blueprintSnapshotHash};});
 return {f,clicks:()=>clicks};
}
test('supervisor actual PASS retries claim and event ACK loss without repeating target side effects',async t=>{
 const {f,clicks}=await setup(t,['passed']),transport=fixtureTransport(f,{loseClaim:true,loseAck:true});
 await runAgent({config:normalizeConfig(f.config),expected:f.expected,instanceId:f.instanceId,transport,once:true});
 assert.equal(clicks(),1);assert.equal(transport.state.claims,2);assert.equal(new Set(transport.state.claimIds).size,1);assert.equal(JSON.parse(transport.state.results[0].resultJson).outcome,'passed');assert(transport.state.release);assert(transport.state.uploads.size>0);
});
test('supervisor ordered Suite preserves per-case identity and stops after failure or cancellation',async t=>{
 for(const mode of ['continue','stop','cancel']){
  const {f,clicks}=await setup(t,mode==='cancel'?['passed','passed']:['failed','passed']);f.lease.suitePolicy.stopOnFailure=mode!=='continue';const controller=new AbortController();
  const transport=fixtureTransport(f,{onDelivery:e=>{if(mode==='cancel'&&e.type==='run.started')controller.abort();}});
  await runAgent({config:normalizeConfig(f.config),expected:f.expected,instanceId:f.instanceId,transport,once:true,signal:controller.signal});
  assert.equal(transport.state.results.length,mode==='continue'?2:1);
  const outcomes=transport.state.results.map(r=>JSON.parse(r.resultJson).outcome);assert.deepEqual(outcomes,mode==='continue'?['failed','passed']:mode==='stop'?['failed']:['cancelled']);
  assert.equal(new Set(transport.state.results.map(r=>JSON.parse(r.resultJson).runId)).size,transport.state.results.length);
  if(mode!=='cancel')assert.equal(clicks(),mode==='continue'?2:1);
 }
});
test('native Agent fixes approved session app/activity config before any child starts',async()=>{
 const f=agentFixture(),root=await mkdtemp(join(tmpdir(),'aqa-native-policy-')),file=join(root,'operator.json');
 const config={endpoint:'http://127.0.0.1:4723',capabilities:{'appium:automationName':'UiAutomator2','appium:udid':'local-device','appium:deviceName':'test','appium:appPackage':'com.test.app','appium:appActivity':'.Main'}};
 const local={platform:'android',appiumConfig:file,nativeApps:[{platform:'android',appId:'com.test.app',activities:['.Main']}]};f.lease.executionPolicy.nativeApps=structuredClone(local.nativeApps);
 await writeFile(file,JSON.stringify(config));const fixed=await materializeNativeConfig(f.lease,local,root);await writeFile(file,'changed');assert.deepEqual(JSON.parse(await readFile(fixed)),config);
 for(const caps of [{'appium:appPackage':'com.other.app'},{'appium:appActivity':'.Other'},{'appium:autoLaunch':false},{'appium:appWaitPackage':'*'}]){await writeFile(file,JSON.stringify({...config,capabilities:{...config.capabilities,...caps}}));await assert.rejects(materializeNativeConfig(f.lease,local,root),e=>e.code==='AGENT_POLICY_DENIED');}
 const missing=structuredClone(config);delete missing.capabilities['appium:appPackage'];await writeFile(file,JSON.stringify(missing));await assert.rejects(materializeNativeConfig(f.lease,local,root),e=>e.code==='AGENT_POLICY_DENIED');
});
test('unsupported Agent native startup override is blocked before POST session',async t=>{
 let sessions=0;const server=createServer((req,res)=>{sessions++;res.setHeader('content-type','application/json');res.end('{}');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
 const f=agentFixture();f.config.stateDir=await mkdtemp(join(tmpdir(),'aqa-agent-native-override-'));
 const appiumConfig=join(f.config.stateDir,'appium.json');await writeFile(appiumConfig,JSON.stringify({endpoint:'http://127.0.0.1:'+server.address().port,capabilities:{'appium:automationName':'UiAutomator2','appium:udid':'local','appium:deviceName':'test','appium:appPackage':'com.test.app','appium:appActivity':'.Main','appium:optionalIntentArguments':'unsupported'}}));
 const apps=[{platform:'android',appId:'com.test.app',activities:['.Main']}];f.config.resources['web-slot']={platform:'android',appiumConfig,allowedOrigins:[],nativeApps:apps,secretRefs:[],actions:['launch','input','tap','assertText','screenshot']};f.lease.executionPolicy={resourceKey:'web-slot',platform:'android',allowedOrigins:[],nativeApps:apps,secretRefs:[],allowProduction:false};
 const b=f.blueprint;b.target.platform='android';b.target.launchTargets={login:'com.test.app'};delete b.target.allowedOrigins;for(const selector of Object.values(b.selectors.selectors))selector.android={strategy:'id',value:'com.test.app:id/element'};
 f.lease.cases[0].blueprintJson=JSON.stringify(b);f.lease.cases[0].blueprintSnapshotHash=compileBlueprint(b).blueprintSnapshotHash;
 const transport=fixtureTransport(f);await runAgent({config:normalizeConfig(f.config),expected:f.expected,instanceId:f.instanceId,transport,once:true});assert.equal(transport.state.executionStatus,'blocked');assert.equal(transport.state.results.length,0);assert.equal(sessions,0);
});
