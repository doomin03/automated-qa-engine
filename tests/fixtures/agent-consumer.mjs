import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {compileBlueprint} from 'automated-qa-engine';
const packageRoot=fileURLToPath(new URL('../../',import.meta.resolve('automated-qa-engine'))),cli=join(packageRoot,'packages/cli/aqa.mjs'),release=JSON.parse(await readFile(join(packageRoot,'contracts/release.json'))),template=JSON.parse(await readFile(join(packageRoot,'examples/login.qa.json')));
const root=await mkdtemp(join(tmpdir(),'aqa-agent-consumer-')),runs=[];let clicks=0,onEffect=async()=>{};
const target=createServer(async(req,res)=>{if(req.url==='/effect'){clicks++;await onEffect();res.end('ok');return;}res.setHeader('content-type','text/html');res.end('<input data-testid="username"><button data-testid="submit" onclick="fetch(\'/effect\',{method:\'POST\'}).then(()=>document.querySelector(\'[data-testid=greeting]\').textContent=\'Welcome qa-user\')">Run</button><p data-testid="greeting"></p>');});
await new Promise(r=>target.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+target.address().port;
const digest=b=>createHash('sha256').update(b).digest('hex');
function createFixture(modes,{lostClaim=false,lostAck=false}={}){
 let lease,owner,retired=false,claimRequestId,claimCalls=0,acks=0,completeBody,closed=false;const events=[],receipts=[],uploaded=new Set(),receiptId=randomUUID();
 const cases=modes.map((mode,i)=>{const b=structuredClone(template);b.target.launchTargets.login=origin;b.target.allowedOrigins=[origin];if(mode==='failed'){const n=b.flow.nodes.find(n=>n.id==='home');n.params.expected='deliberate failure';n.timeoutMs=100;}return {caseId:'case'+i,blueprintJson:JSON.stringify(b),blueprintSnapshotHash:compileBlueprint(b).blueprintSnapshotHash,resources:[],publishedVersion:null};});
 const server=createServer(async(req,res)=>{
  try{
   assert.equal(req.headers.authorization,'Bearer fixture-token');let text='';for await(const c of req)text+=c;const body=text?JSON.parse(text):null,path=req.url;
   const send=value=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));};
   const deny=()=>{res.statusCode=409;send({code:'INSTANCE_CONFLICT',message:'Conflict',requestId:randomUUID(),details:[]});};
   if(path==='/api/v1/agent/reconcile'){
    const same=!owner||owner===body.instanceId||retired;
    send({agentId:'consumer-agent',instanceId:body.instanceId,instanceState:same?'active':'quarantined',decisions:!lease||retired?[]:[{lease:{...lease,state:closed?'closed':'quarantined',acceptedThrough:events.length},directive:closed?'observe':'quarantine',reason:'fixture-recovery',cleanupState:closed?'confirmed':'unknown',completionReceipt:closed?receiptId:null,deliveryClosed:closed,evidenceStatus:closed?'verified':'pending',operatorRecovery:null}],hasMore:false,nextCursor:null});return;
   }
   if(path==='/api/v1/agent/claims'){
    if(retired||owner&&owner!==body.instanceId){deny();return;}owner=body.instanceId;claimCalls++;
    if(!claimRequestId)claimRequestId=body.claimRequestId;assert.equal(claimRequestId,body.claimRequestId);
    lease??={agentId:'consumer-agent',instanceId:owner,leaseId:randomUUID(),executionId:randomUUID(),projectId:'project',jobAttempt:1,fence:1,resourceKey:'web-slot',cases,engineVersion:release.engineVersion,engineContractVersion:release.contractVersion,engineContractSha256:release.sha256,protocolVersion:'0.1.0-draft.1',state:'active',validForMs:30000,heartbeatIntervalMs:5000,requestTimeoutMs:5000,safetyMarginMs:5000,cancelRequested:false,acceptedThrough:0,executionPolicy:{resourceKey:'web-slot',platform:'web',allowedOrigins:[origin],nativeApps:[],secretRefs:[],allowProduction:false},suitePolicy:{stopOnFailure:false,publishedVersionId:null,publishedSha256:null}};
    if(lostClaim&&claimCalls===1){res.destroy();return;}send({claimRequestId,lease});return;
   }
   if(path.endsWith('/heartbeat')){send({leaseId:lease.leaseId,fence:1,validForMs:30000,cancelRequested:false,state:'active',acceptedThrough:events.length});return;}
   if(path.endsWith('/events')){for(const e of body.events){if(events[e.deliverySequence-1])assert.deepEqual(events[e.deliverySequence-1],e);else{assert.equal(e.deliverySequence,events.length+1);events.push(e);}}acks++;if(lostAck&&acks===1){res.destroy();return;}send({leaseId:lease.leaseId,fence:1,acceptedThrough:events.length});return;}
   if(path.endsWith('/complete')){
    if(completeBody)assert.deepEqual(completeBody,body);completeBody=body;
    for(const a of body.artifactManifest)if(!receipts.some(r=>r.caseId===a.caseId&&r.path===a.path))receipts.push({...a,artifactId:randomUUID()});
    closed=body.cleanupState==='confirmed'&&receipts.every(r=>uploaded.has(r.artifactId));
    send({leaseId:lease.leaseId,fence:1,accepted:true,acceptedThrough:events.length,completionReceipt:closed?receiptId:null,deliveryClosed:closed,evidenceStatus:closed?'verified':'pending',cleanupState:body.cleanupState,quarantined:false,artifacts:receipts.map(r=>({...r,uploaded:uploaded.has(r.artifactId)}))});return;
   }
   if(path.endsWith('/artifacts')){const receipt=receipts.find(r=>r.artifactId===body.artifactId),bytes=Buffer.from(body.base64,'base64');assert.equal(digest(bytes),receipt.sha256);assert.equal(bytes.length,receipt.size);uploaded.add(receipt.artifactId);send({...receipt,uploaded:true});return;}
   if(path.endsWith('/instances/release')){if(!closed||!body.ownerStopped){deny();return;}assert.equal(body.ownerInstanceId,owner);retired=true;send({agentId:'consumer-agent',reportingInstanceId:body.reportingInstanceId,ownerInstanceId:owner,released:true,remainingReceipts:0});return;}
   res.statusCode=404;send({code:'NOT_FOUND',message:'Missing route',requestId:randomUUID(),details:[]});
  }catch{res.statusCode=500;res.setHeader('content-type','application/json');res.end(JSON.stringify({code:'FIXTURE_FAILURE',message:'Fixture assertion failed',requestId:randomUUID(),details:[]}));}
 });
 return {server,result:()=>({claimCalls,acks,events,caseResults:completeBody?.caseResults||[],uploaded:uploaded.size,retired})};
}
try{
 for(const [name,modes,options]of [['replay',['passed'],{lostClaim:true,lostAck:true}],['ordered',['failed','passed'],{}],['restart',['passed'],{}]]){
  const fixture=createFixture(modes,options);await new Promise(r=>fixture.server.listen(0,'127.0.0.1',r));const serverUrl='http://127.0.0.1:'+fixture.server.address().port;
  const stateDir=join(root,name),configFile=join(root,name+'.json'),config={schemaVersion:'qa.agentConfig/v1',agentId:'consumer-agent',serverUrl,tokenEnv:'AQA_AGENT_FIXTURE_TOKEN',stateDir,allowInsecureLocal:true,projectIds:['project'],resources:{'web-slot':{platform:'web',allowedOrigins:[origin],nativeApps:[],secretRefs:[],actions:['launch','input','tap','assertText','screenshot'],allowProduction:false}},credentials:{},maxRunMs:10000};await writeFile(configFile,JSON.stringify(config));
  const before=clicks,child=spawn(process.execPath,[cli,'agent','--config',configFile,'--once'],{cwd:root,env:{...process.env,AQA_AGENT_FIXTURE_TOKEN:'fixture-token'},windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const timer=setTimeout(()=>child.kill('SIGKILL'),40000);
  onEffect=name==='restart'?async()=>{child.kill('SIGKILL');}:async()=>{};
  const code=await new Promise(r=>child.on('close',r));clearTimeout(timer);onEffect=async()=>{};
  if(name==='restart'){
   assert.notEqual(code,0);const again=spawn(process.execPath,[cli,'agent','--config',configFile,'--once'],{cwd:root,env:{...process.env,AQA_AGENT_FIXTURE_TOKEN:'fixture-token'},windowsHide:true,stdio:['ignore','pipe','pipe']});let restartError='';again.stdout.resume();again.stderr.on('data',b=>restartError+=b);const restartCode=await new Promise(r=>again.on('close',r));assert.equal(restartCode,3);assert.match(restartError,/AGENT_QUARANTINED/);assert.equal(clicks-before,1);assert.equal(fixture.result().claimCalls,1);
   // The harness owns this exact spawned child. Wait for natural pipe closure;
   // if it lingers, terminate only that test process without asserting cleanup.
   const lines=(await readFile(join(stateDir,'journal.jsonl'),'utf8')).trim().split('\n').map(JSON.parse),pid=lines.map(l=>l.operation.value?.childPid).filter(Boolean).at(-1);
   if(pid){for(let i=0;i<30;i++){try{process.kill(pid,0);}catch{break;}await new Promise(r=>setTimeout(r,100));}try{process.kill(pid,'SIGKILL');}catch{}}
   fixture.server.closeAllConnections();await new Promise(r=>fixture.server.close(r));runs.push({name,stateDir,sideEffects:1,restartCode,claimCalls:1,cleanupState:'unknown',reexecuted:false});continue;
  }
  fixture.server.closeAllConnections();await new Promise(r=>fixture.server.close(r));
  assert.equal(code,0,stderr);const result=fixture.result();assert.equal(clicks-before,modes.length);assert.deepEqual(result.caseResults.map(r=>JSON.parse(r.resultJson).outcome),modes);assert(result.retired);assert(result.uploaded>0);assert.equal(new Set(result.caseResults.map(r=>JSON.parse(r.resultJson).runId)).size,modes.length);if(name==='replay')assert.equal(result.claimCalls,2);
  runs.push({name,stateDir,outcomes:modes,sideEffects:clicks-before,claimCalls:result.claimCalls,eventDeliveries:result.events.length,artifactUploads:result.uploaded,statusEvents:stdout.trim().split('\n').map(JSON.parse)});
 }
}finally{target.closeAllConnections();await new Promise(r=>target.close(r));}
console.log(JSON.stringify({status:'passed',runtime:release.engineVersion,root,transport:'HTTP fixture, not Checker server',runs}));
