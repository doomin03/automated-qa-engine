import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {openAgentStore} from '../packages/agent/store.mjs';

const agentId='service-retention';
const temporary=()=>mkdtemp(join(tmpdir(),'aqa-service-retention-'));

test('completed jobs exceed the journal operation budget while retaining tombstones and monotonic delivery identities',async()=>{
 const root=await temporary(),file=join(root,'immutable-result.json');await writeFile(file,'immutable evidence');
 let store=await openAgentStore(root,{agentId,maxEntries:128});
 for(let i=0;i<12;i++){
  const id='job-'+i;await store.set('lease:'+id,{phase:'executing',cleanupState:'unknown'});
  for(let j=0;j<20;j++)assert.equal(await store.enqueue(id,{event:j+1}),j+1);
  await store.ack(id,20);await store.set('lease:'+id,{phase:'closed',cleanupState:'confirmed',receipt:'receipt-'+i,reference:{path:file}});
 }
 await store.compactEmptyClaims({force:true});const status=store.status();
 assert.equal(status.journalVersion,2);assert.equal(status.pendingEntries,0);assert.equal(status.acknowledgedPayloadEntries,0);assert.equal(status.lifetimeBounded,true);assert(status.remainingEntries>0);
 await store.close();store=await openAgentStore(root,{agentId,maxEntries:128});
 for(let i=0;i<12;i++){assert.equal(store.get('lease:job-'+i).receipt,'receipt-'+i);assert.equal(store.acknowledged('job-'+i),20);assert.deepEqual(store.pending('job-'+i),[]);}
 assert.equal(await store.enqueue('job-0',{event:21}),21);assert.equal(await readFile(file,'utf8'),'immutable evidence');await store.close();
});

test('checkpoint preserves latest unknown/active/history/receipt values and every unacknowledged payload',async()=>{
 const root=await temporary();let store=await openAgentStore(root,{agentId});
 for(let i=0;i<20;i++)await store.set('lease:uncertain',{phase:'executing',cleanupState:'unknown',fence:i,root:'retained'});
 await store.set('claim:requested',{phase:'requested',body:{claimRequestId:'unknown'}});
 await store.set('historical:unconfirmed',{ack:false,reference:{sha256:'immutable'}});await store.set('released:owner',{released:false});
 await store.set('lease:closed',{phase:'closed',receipt:'must-prevent-reexecution'});
 await store.enqueue('uncertain',{payload:'acked'});await store.enqueue('uncertain',{payload:'pending-2'});await store.enqueue('uncertain',{payload:'pending-3'});await store.ack('uncertain',1);
 assert(await store.compactEmptyClaims({force:true}));await store.close();store=await openAgentStore(root,{agentId});
 assert.deepEqual(store.get('lease:uncertain'),{phase:'executing',cleanupState:'unknown',fence:19,root:'retained'});
 assert.equal(store.get('claim:requested').phase,'requested');assert.equal(store.get('historical:unconfirmed').ack,false);assert.equal(store.get('released:owner').released,false);assert.equal(store.get('lease:closed').receipt,'must-prevent-reexecution');
 assert.deepEqual(store.pending('uncertain'),[{sequence:2,payload:{payload:'pending-2'}},{sequence:3,payload:{payload:'pending-3'}}]);assert.equal(store.acknowledged('uncertain'),1);
 assert.equal(await store.enqueue('uncertain',{payload:'pending-4'}),4);await assert.rejects(store.ack('uncertain',0));await assert.rejects(store.ack('uncertain',5));await store.close();
});

test('v1 journals migrate only on checkpoint and v2 queue bases retain next sequence after restart',async()=>{
 const root=await temporary();let store=await openAgentStore(root,{agentId});
 await store.enqueue('scope',{value:1});await store.enqueue('scope',{value:2});await store.ack('scope',2);await store.close();
 const before=(await readFile(join(root,'journal.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert(before.every(r=>r.version===1));
 store=await openAgentStore(root,{agentId});assert.equal(store.acknowledged('scope'),2);assert(await store.compactEmptyClaims({force:true}));await store.set('lease:scope',{phase:'closed'});await store.close();
 const after=(await readFile(join(root,'journal.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert(after.every(r=>r.version===2));assert.equal(after[0].operation.kind,'queue-base');
 // The former reader requires version === 1 on every record: no silently
 // downgraded cursor can be reconstructed from a v2 checkpoint.
 assert.notEqual(after[0].version,1);
 store=await openAgentStore(root,{agentId});assert.equal(await store.enqueue('scope',{value:3}),3);await store.ack('scope',3);await store.close();
});

test('retained tombstones remain bounded and capacity exhaustion never discards them',async()=>{
 const root=await temporary();let store=await openAgentStore(root,{agentId,maxEntries:8});
 for(let i=0;i<8;i++)await store.set('lease:'+i,{phase:'closed',receipt:'receipt-'+i});
 assert.equal(await store.compactEmptyClaims({force:true}),false);await assert.rejects(store.set('lease:overflow',{}),e=>e.code==='AGENT_STATE_FULL');
 assert.equal(store.status().remainingEntries,0);assert.equal(store.status().retainedKeys,8);await store.close();
 store=await openAgentStore(root,{agentId,maxEntries:8});for(let i=0;i<8;i++)assert.equal(store.get('lease:'+i).receipt,'receipt-'+i);assert.equal(store.get('lease:overflow'),undefined);await store.close();
});

test('hashed v2 journals reject duplicate or invalid queue bases instead of rolling back ACKs',async()=>{
 for(const operations of [
  [{kind:'queue-base',scope:'scope',ack:5,next:5},{kind:'queue-base',scope:'scope',ack:1,next:1}],
  [{kind:'queue-base',scope:'scope',ack:5,next:6}],
  [{kind:'queue-base',scope:'scope',ack:5,next:5},{kind:'delivery',scope:'scope',sequence:5,payload:{}}]
 ]){
  const root=await temporary();let previousHash='0'.repeat(64),sequence=0;const lines=[];
  for(const operation of operations){const base={version:2,sequence:++sequence,previousHash,agentId,operation};const sha256=createHash('sha256').update(JSON.stringify(base)).digest('hex');lines.push(JSON.stringify({...base,sha256}));previousHash=sha256;}
  await writeFile(join(root,'journal.jsonl'),lines.join('\n')+'\n');await assert.rejects(openAgentStore(root,{agentId}),e=>e.code==='AGENT_STATE_INVALID');
 }
});
