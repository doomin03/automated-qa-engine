import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openAgentStore} from '../packages/agent/store.mjs';
import {flushEvents,completeDelivery,historicalDelivery} from '../packages/agent/reporting.mjs';
import {sha256} from '../packages/agent/materialize.mjs';
import {agentFixture} from './fixtures/agent-fixture.mjs';
async function setup(t){const f=agentFixture(),root=await mkdtemp(join(tmpdir(),'aqa-agent-report-')),store=await openAgentStore(root,{agentId:f.agentId,instanceId:f.instanceId});t.after(()=>store.close());return {...f,root,store};}
test('event ACK cannot acknowledge unsent entries or an incomplete atomic batch',async t=>{
 const {lease,store}=await setup(t);for(let i=0;i<101;i++)await store.enqueue(lease.leaseId,{caseId:'case1',engineEventJson:'{}'});
 const transport={events:async(id,body)=>{assert.equal(body.events.length,100);return {value:{leaseId:id,fence:lease.fence,acceptedThrough:101}};}};
 await assert.rejects(flushEvents({store,transport,lease}),e=>e.code==='AGENT_PROTOCOL_INVALID');assert.equal(store.acknowledged(lease.leaseId),0);assert.equal(store.get('sent:'+lease.leaseId),100);
 transport.events=async id=>({value:{leaseId:id,fence:lease.fence,acceptedThrough:99}});await assert.rejects(flushEvents({store,transport,lease}));assert.equal(store.acknowledged(lease.leaseId),0);
 transport.events=async(id,body)=>({value:{leaseId:id,fence:lease.fence,acceptedThrough:body.events.at(-1).deliverySequence}});await flushEvents({store,transport,lease});assert.equal(store.acknowledged(lease.leaseId),101);
});
test('completion validates exact receipt set and repeats validation after upload',async t=>{
 const {lease,store,root}=await setup(t),bytes=Buffer.from('evidence'),path=join(root,'a.png');await writeFile(path,bytes);
 const source={caseId:'case1',path:'a.png',size:bytes.length,sha256:sha256(bytes),mimeType:'image/png',localPath:path},receipt={...source,artifactId:randomUUID(),uploaded:true};delete receipt.localPath;
 const base={leaseId:lease.leaseId,fence:lease.fence,accepted:true,acceptedThrough:0,completionReceipt:randomUUID(),deliveryClosed:true,evidenceStatus:'verified',cleanupState:'confirmed',quarantined:false,artifacts:[receipt]};
 for(const artifacts of [[],[receipt,receipt],[{...receipt,sha256:'0'.repeat(64)}]]){
  const transport={complete:async()=>({value:{...base,artifacts}})};await assert.rejects(completeDelivery({store,transport,lease,body:{},artifacts:[source]}),e=>e.code==='AGENT_PROTOCOL_INVALID');
 }
 let calls=0;const transport={complete:async()=>({value:++calls===1?{...base,deliveryClosed:false,completionReceipt:null,evidenceStatus:'pending',artifacts:[{...receipt,uploaded:false}]}:{...base,acceptedThrough:1}}),artifact:async()=>({value:receipt})};
 await assert.rejects(completeDelivery({store,transport,lease,body:{},artifacts:[source]}),e=>e.code==='AGENT_PROTOCOL_INVALID');assert.equal(calls,2);
});
test('historical event batches obey bytes as well as count and do not advance normal ACK',async t=>{
 const {lease,store}=await setup(t);for(let i=0;i<5;i++)await store.enqueue(lease.leaseId,{caseId:'case1',engineEventJson:'x'.repeat(700000)});
 const counts=[],transport={historical:async(id,body)=>{counts.push(body.events.length);assert(Buffer.byteLength(JSON.stringify(body.events))<=2*1024*1024);return {value:{recorded:true}};}};
 await historicalDelivery({store,transport,lease,instanceId:lease.instanceId,body:{caseResults:[],cleanupState:'unknown'},artifacts:[],saveIntent:async b=>({...b,evidenceRequestId:randomUUID()})});
 assert.deepEqual(counts,[2,2,1]);assert.equal(store.acknowledged(lease.leaseId),0);
});
