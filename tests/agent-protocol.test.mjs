import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AgentTransport} from '../packages/agent/transport.mjs';
import {validateProtocol,protocolPin} from '../packages/agent/protocol.mjs';
import {normalizeConfig} from '../packages/agent/config.mjs';
import {checkLeasePolicy,materializeCases,sha256,immutableJson,readImmutable} from '../packages/agent/materialize.mjs';
import {compileBlueprint} from '../packages/core/compiler.mjs';
import {agentFixture} from './fixtures/agent-fixture.mjs';

test('pinned HTTP schemas preserve Engine identity and reject unknown fields/invalid shapes',()=>{
 const fixture=agentFixture();assert.match(protocolPin.sha256,/^[a-f0-9]{64}$/);validateProtocol('Lease',fixture.lease);
 assert.throws(()=>validateProtocol('Lease',{...fixture.lease,fence:0}));assert.throws(()=>validateProtocol('Lease',{...fixture.lease,runId:'fabricated'}));
 validateProtocol('Delivery',{deliverySequence:1,caseId:'case1',engineEventJson:'{"opaque":true}'});assert.throws(()=>validateProtocol('Delivery',{deliverySequence:1,caseId:'case1',engineEventJson:{}}));
 assert.throws(()=>validateProtocol('ResourceManifest',{resourceId:randomUUID(),name:'../escape.png',sha256:'a'.repeat(64),size:2,mimeType:'image/png'}));
 const decision={lease:{...fixture.lease,state:'closed'},directive:'observe',reason:'closed',cleanupState:'confirmed',completionReceipt:randomUUID(),deliveryClosed:true,evidenceStatus:'verified',operatorRecovery:null};
 validateProtocol('ReconcileDecision',decision);const missing={...decision};delete missing.completionReceipt;assert.throws(()=>validateProtocol('ReconcileDecision',missing));
 validateProtocol('InstanceReleaseRequest',{agentId:fixture.agentId,reportingInstanceId:randomUUID(),ownerInstanceId:fixture.instanceId,ownerStopped:true,receipts:[]});
 assert.throws(()=>validateProtocol('InstanceReleaseRequest',{agentId:fixture.agentId,reportingInstanceId:randomUUID(),ownerInstanceId:fixture.instanceId,ownerStopped:false,receipts:[]}));
 const recovered={...decision,lease:{...fixture.lease,state:'recovered'},deliveryClosed:false,operatorRecovery:{id:randomUUID(),confirmedAt:'2026-10-31T12:00:00.000Z',priorFence:1,newFence:2}};
 validateProtocol('ReconcileDecision',recovered);assert.throws(()=>validateProtocol('ReconcileDecision',{...recovered,operatorRecovery:{...recovered.operatorRecovery,confirmedAt:'2026-02-31T12:00:00Z'}}));assert.throws(()=>validateProtocol('ReconcileDecision',{...recovered,operatorRecovery:'recovered'}));
});
test('Agent HTTP bounds streamed bodies, refuses redirects, sanitizes server errors and times out',async t=>{
 const server=createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.url.endsWith('/redirect')){res.writeHead(302,{location:'http://example.invalid/private-token'});res.end();}else if(req.url.endsWith('/large')){res.write(' '.repeat(100));res.end(' '.repeat(100));}else if(req.url.endsWith('/hang')){}else{res.statusCode=403;res.end(JSON.stringify({code:'DENIED',message:'private-server-secret',requestId:randomUUID(),details:[]}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const transport=new AgentTransport({serverUrl:'http://127.0.0.1:'+server.address().port,token:'private-token',allowInsecureLocal:true,timeoutMs:100});
 await assert.rejects(transport.request('/api/v1/agent/redirect'),e=>e.code==='AGENT_PROTOCOL_INVALID'&&!e.message.includes('private'));
 await assert.rejects(transport.request('/api/v1/agent/large',{limit:100}),e=>e.code==='AGENT_PROTOCOL_LIMIT');
 await assert.rejects(transport.request('/api/v1/agent/rejected'),e=>e.status===403&&e.serverCode==='DENIED'&&!e.message.includes('private'));
 await assert.rejects(transport.request('/api/v1/agent/hang'),e=>e.code==='AGENT_HTTP_TIMEOUT');
 assert.throws(()=>new AgentTransport({serverUrl:'http://example.com',token:'token'}));assert.throws(()=>new AgentTransport({serverUrl:'https://user:secret@example.com',token:'token'}));
});
test('local policy defaults deny and intersects project, origins, credentials and production',()=>{
 const f=agentFixture();assert.equal(Object.keys(normalizeConfig({...f.config,resources:undefined}).resources).length,0);checkLeasePolicy(f.lease,normalizeConfig(f.config),f.expected);
 for(const change of [c=>c.projectIds=[],c=>c.resources['web-slot'].allowedOrigins=[],c=>c.resources['web-slot'].actions=[]]){const c=structuredClone(f.config);change(c);assert.throws(()=>checkLeasePolicy(f.lease,normalizeConfig(c),f.expected),e=>e.code==='AGENT_POLICY_DENIED');}
 const prod=structuredClone(f.lease),b=JSON.parse(prod.cases[0].blueprintJson);b.target.environment='production';prod.cases[0].blueprintJson=JSON.stringify(b);prod.cases[0].blueprintSnapshotHash=compileBlueprint(b).blueprintSnapshotHash;
 const config=normalizeConfig(f.config);assert.throws(()=>checkLeasePolicy(prod,config,f.expected));config.resources['web-slot'].allowProduction=true;assert.throws(()=>checkLeasePolicy(prod,config,f.expected));prod.executionPolicy.allowProduction=true;checkLeasePolicy(prod,config,f.expected);
 const secret=structuredClone(f.lease),sb=JSON.parse(secret.cases[0].blueprintJson);sb.flow.variables={...(sb.flow.variables||{}),token:{from:'secret',ref:'approved'}};secret.cases[0].blueprintJson=JSON.stringify(sb);secret.cases[0].blueprintSnapshotHash=compileBlueprint(sb).blueprintSnapshotHash;
 assert.throws(()=>checkLeasePolicy(secret,config,f.expected));config.credentials.approved='LOCAL_SECRET';config.resources['web-slot'].secretRefs=['approved'];assert.throws(()=>checkLeasePolicy(secret,config,f.expected));secret.executionPolicy.secretRefs=['approved'];checkLeasePolicy(secret,config,f.expected);
});
test('materialization preserves hash, safe subdirectories and immutable large lease references',async()=>{
 const f=agentFixture(),root=await mkdtemp(join(tmpdir(),'aqa-agent-materialize-')),bytes=Buffer.from('font bytes'),descriptor={resourceId:randomUUID(),name:'fonts/test.woff2',sha256:sha256(bytes),size:bytes.length,mimeType:'font/woff2'};f.lease.cases[0].resources=[descriptor];checkLeasePolicy(f.lease,normalizeConfig(f.config),f.expected);
 const transport={resource:async()=>({value:{...descriptor,base64:bytes.toString('base64')}})};const cases=await materializeCases(f.lease,root,transport,{agentId:f.agentId,instanceId:f.instanceId,fence:1});assert.deepEqual(await readFile(join(cases[0].root,descriptor.name)),bytes);
 const large={payload:'x'.repeat(5*1024*1024)},reference=await immutableJson(join(root,'large-lease.json'),large,7*1024*1024);assert.equal((await readImmutable(reference,7*1024*1024)).payload.length,large.payload.length);
 const bad=structuredClone(f.lease);bad.cases[0].resources.push({...descriptor,name:'FONTS/test.woff2',resourceId:randomUUID()});assert.throws(()=>checkLeasePolicy(bad,normalizeConfig(f.config),f.expected),e=>e.code==='AGENT_POLICY_DENIED');
 const mismatch=join(root,'mismatch');await mkdir(mismatch);await assert.rejects(materializeCases(f.lease,mismatch,{resource:async()=>({value:{...descriptor,base64:Buffer.from('wrong').toString('base64')}})},{}),e=>e.code==='AGENT_PROTOCOL_INVALID');
});

test('Agent rejects UNC and absolute resource paths before requesting resource bytes',async()=>{
 const names=['\\\\server\\share\\image.png','//server/share/image.png','C:\\outside\\image.png','C:/outside/image.png','/outside/image.png'];
 for(const name of names){
  const f=agentFixture(),bytes=Buffer.from('fixture'),resource={resourceId:randomUUID(),name,sha256:sha256(bytes),size:bytes.length,mimeType:'image/png'};f.lease.cases[0].resources=[resource];
  assert.throws(()=>validateProtocol('ResourceManifest',resource),undefined,name);
  assert.throws(()=>checkLeasePolicy(f.lease,normalizeConfig(f.config),f.expected),undefined,name);
  const root=await mkdtemp(join(tmpdir(),'aqa-agent-absolute-'));let downloads=0;
  await assert.rejects(materializeCases(f.lease,root,{resource:async()=>{downloads++;throw new Error('Resource request must not happen');}},{}),e=>e.code==='AGENT_POLICY_DENIED');
  assert.equal(downloads,0,name);
 }
});

test('Agent rejects old runtime, incompatible execution contract and wrong exact bundle hash',()=>{
 const f=agentFixture(),config=normalizeConfig(f.config);
 for(const change of [{engineVersion:'0.1.0-alpha.6'},{engineContractVersion:'0.3.0-draft.1'},{engineContractSha256:'b'.repeat(64)}]){
  assert.throws(()=>checkLeasePolicy({...f.lease,...change},config,f.expected),e=>e.code==='AGENT_POLICY_DENIED');
 }
});
