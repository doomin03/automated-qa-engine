import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {openAgentStore} from '../packages/agent/store.mjs';
const agentId='checkpoint-agent';
async function seed(root,options={}){
 const store=await openAgentStore(root,{agentId,...options});
 await store.set('claim:unknown',{body:{agentId,claimRequestId:'unknown'},phase:'requested'});
 await store.set('lease:active',{phase:'executing',cleanupState:'unknown'});
 await store.enqueue('lease:active',{caseId:'one',engineEventJson:'first'});await store.enqueue('lease:active',{caseId:'one',engineEventJson:'second'});await store.ack('lease:active',1);
 await store.set('historical:pending',{ack:false,reference:{sha256:'fixed'}});await store.set('receipt:closed',{completionReceipt:'fixed',acked:true});
 const body={agentId,claimRequestId:'empty'};await store.set('claim:empty',{body,phase:'requested'});await store.set('claim:empty',{body,phase:'empty',leaseId:null});return store;
}
async function preserved(store){assert.equal(store.get('claim:unknown').phase,'requested');assert.equal(store.get('lease:active').cleanupState,'unknown');assert.equal(store.pending('lease:active')[0].sequence,2);assert.equal(store.acknowledged('lease:active'),1);assert.equal(store.get('historical:pending').ack,false);assert.equal(store.get('receipt:closed').completionReceipt,'fixed');}
test('checkpoint retires confirmed empty claims and acknowledged payloads while preserving current uncertain state',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-checkpoint-')),store=await seed(root);const original=(await readFile(join(root,'journal.jsonl'),'utf8')).trim().split('\n').map(l=>JSON.parse(l).operation);
 assert(await store.compactEmptyClaims({force:true}));await preserved(store);assert.equal(store.get('claim:empty'),undefined);
 const retained=(await readFile(join(root,'journal.jsonl'),'utf8')).trim().split('\n').map(l=>JSON.parse(l).operation);
 assert(!retained.some(op=>op.key==='claim:empty'));assert(!retained.some(op=>op.kind==='delivery'&&op.sequence===1));
 assert.deepEqual(retained.filter(op=>op.kind==='set'),original.filter(op=>op.kind==='set'&&op.key!=='claim:empty'));
 assert.deepEqual(retained.find(op=>op.kind==='queue-base'),{kind:'queue-base',scope:'lease:active',ack:1,next:1});
 await store.set('after',{ok:true});await store.close();const reopened=await openAgentStore(root,{agentId});await preserved(reopened);assert.equal(reopened.get('after').ok,true);await reopened.close();
});
test('idle polling stays bounded across more operations than its journal entry budget',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-checkpoint-idle-')),store=await openAgentStore(root,{agentId,maxEntries:40});
 await store.set('claim:unknown',{phase:'requested'});
 for(let i=0;i<200;i++){const body={agentId,claimRequestId:String(i)};await store.set('claim:'+i,{body,phase:'requested'});await store.set('claim:'+i,{body,phase:'empty',leaseId:null});await store.compactEmptyClaims();assert(store.status().sequence<40);}
 assert.equal(store.get('claim:unknown').phase,'requested');await store.close();
});
test('crash on either side of atomic replace retains a complete old or new journal',async()=>{
 for(const phase of ['temporary-written','temporary-synced','before-replace','after-replace','reopened']){
  const root=await mkdtemp(join(tmpdir(),'aqa-checkpoint-crash-')),store=await seed(root);await store.close();
  const child=spawn(process.execPath,[resolve('tests/fixtures/agent-checkpoint-crash.mjs'),root,phase],{windowsHide:true,stdio:'ignore'});assert.equal(await new Promise(r=>child.on('close',r)),77);
  const recovered=await openAgentStore(root,{agentId});await preserved(recovered);const removed=['after-replace','reopened'].includes(phase);assert.equal(recovered.get('claim:empty')===undefined,removed);await recovered.close();
 }
});
test('failure before replace poisons writer without destroying the original journal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-checkpoint-error-')),store=await seed(root,{checkpointHook:async phase=>{if(phase==='before-replace')throw new Error('injected rename boundary failure');}});
 await assert.rejects(store.compactEmptyClaims({force:true}),e=>e.code==='AGENT_STATE_IO');assert(store.status().poisoned);await assert.rejects(store.set('unsafe',{}));await store.close();
 const recovered=await openAgentStore(root,{agentId});await preserved(recovered);assert.equal(recovered.get('claim:empty').phase,'empty');await recovered.close();
});
