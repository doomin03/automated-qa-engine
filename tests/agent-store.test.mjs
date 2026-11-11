import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,appendFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {openAgentStore} from '../packages/agent/store.mjs';

const temporary=()=>mkdtemp(join(tmpdir(),'aqa-agent-state-'));
test('agent journal preserves intent, ordered outbox and monotonic acknowledgements across restart',async()=>{
 const root=await temporary(),store=await openAgentStore(root,{agentId:'agent',instanceId:'first'});
 const intent={executionId:'job',phase:'intent',secretRefs:['reference-only']};await store.set('job',intent);intent.phase='changed';
 assert.equal(store.get('job').phase,'intent');assert(Object.isFrozen(store.get('job')));
 assert.deepEqual(await Promise.all([store.enqueue('job',{event:1}),store.enqueue('job',{event:2}),store.enqueue('job',{event:3})]),[1,2,3]);
 await store.ack('job',2);await store.ack('job',2);await assert.rejects(store.ack('job',1),e=>e.code==='AGENT_STATE_INVALID');await assert.rejects(store.ack('job',4),e=>e.code==='AGENT_STATE_INVALID');
 await store.close();await store.close();const recovered=await openAgentStore(root,{agentId:'agent',instanceId:'second'});
 assert.equal(recovered.get('job').phase,'intent');assert.equal(recovered.acknowledged('job'),2);assert.deepEqual(recovered.pending('job'),[{sequence:3,payload:{event:3}}]);assert.equal(await recovered.enqueue('job',{event:4}),4);await recovered.close();
});
test('agent single writer rejects active process and another agent identity',async()=>{
 const root=await temporary(),store=await openAgentStore(root,{agentId:'agent'});
 await assert.rejects(openAgentStore(root,{agentId:'agent'}),e=>e.code==='AGENT_ALREADY_RUNNING');
 await assert.rejects(openAgentStore(root,{agentId:'other'}),e=>e.code==='AGENT_STATE_INVALID');await store.close();
 await assert.rejects(openAgentStore(root,{agentId:'other'}),e=>e.code==='AGENT_STATE_INVALID');
});
test('dead child writer can be recovered without interpreting intent as new execution',async()=>{
 const root=await temporary(),module=new URL('../packages/agent/store.mjs',import.meta.url).href;
 const source=`import {openAgentStore} from ${JSON.stringify(module)};const store=await openAgentStore(${JSON.stringify(root)},{agentId:'agent'});await store.set('job',{phase:'started',childIdentity:'unknown'});process.exit(0);`;
 const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',source],{windowsHide:true,stdio:'pipe'});child.on('error',reject);child.on('close',done);});assert.equal(code,0);
 const store=await openAgentStore(root,{agentId:'agent'});assert.deepEqual(store.get('job'),{phase:'started',childIdentity:'unknown'});assert.deepEqual(store.pending('job'),[]);await store.close();
});
test('incomplete tail is discarded but completed corruption fails closed',async()=>{
 const root=await temporary();let store=await openAgentStore(root,{agentId:'agent'});await store.set('key',{value:1});await store.close();
 await appendFile(join(root,'journal.jsonl'),'{"partial":');store=await openAgentStore(root,{agentId:'agent'});assert.deepEqual(store.get('key'),{value:1});await store.set('next',2);await store.close();
 const text=await readFile(join(root,'journal.jsonl'),'utf8');assert(!text.includes('partial'));await writeFile(join(root,'journal.jsonl'),text.replace('"value":1','"value":9'));
 await assert.rejects(openAgentStore(root,{agentId:'agent'}),e=>e.code==='AGENT_STATE_INVALID');
});
test('state budgets stop writes before exceeding durable limits; uncertain gate is not stolen',async()=>{
 const root=await temporary(),store=await openAgentStore(root,{agentId:'agent',maxEntries:2});await store.set('key',1);await store.enqueue('scope',{event:1});
 await assert.rejects(store.set('key',2),e=>e.code==='AGENT_STATE_FULL');assert.equal(store.get('key'),1);assert.equal(store.status().sequence,2);await store.close();
 await writeFile(join(root,'writer.gate'),'unconfirmed');await assert.rejects(openAgentStore(root,{agentId:'agent'}),e=>e.code==='AGENT_LOCK_UNCERTAIN');assert.equal(await readFile(join(root,'writer.gate'),'utf8'),'unconfirmed');
});
