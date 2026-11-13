import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {agentFixture} from './fixtures/agent-fixture.mjs';
import {runAgent} from '../packages/agent/supervisor.mjs';
import {normalizeConfig} from '../packages/agent/config.mjs';
import {openAgentStore} from '../packages/agent/store.mjs';
import {immutableJson} from '../packages/agent/materialize.mjs';
async function oldState(){
 const f=agentFixture();f.config.stateDir=await mkdtemp(join(tmpdir(),'aqa-agent-recovery-'));
 const child=spawn(process.execPath,['-e','process.exit(0)'],{windowsHide:true,stdio:'ignore'}),ownerPid=child.pid;await new Promise(r=>child.on('close',r));
 const store=await openAgentStore(f.config.stateDir,{agentId:f.agentId,instanceId:f.instanceId}),root=join(store.root,'jobs',f.lease.leaseId);await mkdir(root,{recursive:true});
 const leaseReference=await immutableJson(join(root,'lease.json'),f.lease,7*1024*1024),record={root,leaseReference,ownerInstanceId:f.instanceId,ownerPid,phase:'reporting',cleanupState:'confirmed',caseResults:[],artifacts:[]};await store.set('lease:'+f.lease.leaseId,record);await store.close();return {...f,root,record};
}
test('restart recovers a lost completion receipt and retires old owner without reexecution',async()=>{
 const f=await oldState(),newInstance=randomUUID(),receipt=randomUUID(),releases=[];let oldReleased=false,claims=0;
 const transport={
  async reconcile(body){return {value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:oldReleased?'active':'observer',decisions:oldReleased?[]:[{lease:{...f.lease,state:'closed'},directive:'observe',reason:'closed',cleanupState:'confirmed',completionReceipt:receipt,deliveryClosed:true,evidenceStatus:'verified'}],hasMore:false,nextCursor:null}};},
  async release(body){releases.push(body);if(body.ownerInstanceId===f.instanceId){assert.equal(body.reportingInstanceId,newInstance);assert.deepEqual(body.receipts,[{leaseId:f.lease.leaseId,completionReceipt:receipt,acceptedThrough:0}]);oldReleased=true;}return {value:{...body,released:true,remainingReceipts:0}};},
  async claim(){claims++;return {value:null,status:204};},
 };
 await runAgent({config:normalizeConfig(f.config),expected:f.expected,instanceId:newInstance,transport,once:true});assert.equal(claims,1);assert.equal(releases.length,2);assert(releases.every(r=>r.ownerStopped));
});
test('restart replays the exact pending historical request and preserves quarantine',async()=>{
 const f=await oldState(),request={agentId:f.agentId,reportingInstanceId:f.instanceId,ownerInstanceId:f.instanceId,fence:1,evidenceRequestId:randomUUID(),events:[],caseResults:[],cleanupState:'unknown'};
 const store=await openAgentStore(f.config.stateDir,{agentId:f.agentId}),reference=await immutableJson(join(f.root,'history.json'),request,16*1024*1024);
 await store.set('lease:'+f.lease.leaseId,{...f.record,phase:'quarantined',cleanupState:'unknown'});await store.set('historical:'+request.evidenceRequestId,{leaseId:f.lease.leaseId,reference,ack:false});await store.close();let calls=0,claims=0;
 const transport={reconcile:async body=>({value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:'quarantined',decisions:[{lease:{...f.lease,state:'quarantined'},directive:'quarantine',reason:'unknown',cleanupState:'unknown',completionReceipt:null,deliveryClosed:false,evidenceStatus:'pending'}],hasMore:false,nextCursor:null}}),historical:async(id,body)=>{calls++;assert.deepEqual(body,request);return {value:{receiptId:randomUUID(),leaseId:id,recorded:true,executionPermission:false,resourceReleased:false,disposition:'historical_quarantine'}};},claim:async()=>{claims++;}};
 for(let i=0;i<2;i++)await assert.rejects(runAgent({config:normalizeConfig(f.config),expected:f.expected,transport,once:true}),e=>e.code==='AGENT_QUARANTINED');
 assert.equal(calls,1);assert.equal(claims,0);const verified=await openAgentStore(f.config.stateDir,{agentId:f.agentId});assert.equal(verified.get('historical:'+request.evidenceRequestId).ack,true);assert.equal(verified.acknowledged(f.lease.leaseId),0);await verified.close();
});
test('server-only outstanding lease cannot become execution permission on startup',async()=>{
 const f=agentFixture();f.config.stateDir=await mkdtemp(join(tmpdir(),'aqa-agent-unknown-'));let claims=0;
 const transport={reconcile:async body=>({value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:'observer',decisions:[{lease:f.lease,directive:'resume',reason:'lost-claim',cleanupState:'unknown',completionReceipt:null,deliveryClosed:false,evidenceStatus:'pending'}],hasMore:false,nextCursor:null}}),claim:async()=>{claims++;}};
 await assert.rejects(runAgent({config:normalizeConfig(f.config),expected:f.expected,transport,once:true}),e=>e.code==='AGENT_QUARANTINED');assert.equal(claims,0);
});
test('server omission of unresolved local lease blocks new claim and empty-owner release',async()=>{
 const f=await oldState();let claims=0,releases=0;
 const transport={reconcile:async body=>({value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:'active',decisions:[],hasMore:false,nextCursor:null}}),claim:async()=>{claims++;},release:async()=>{releases++;}};
 await assert.rejects(runAgent({config:normalizeConfig(f.config),expected:f.expected,transport,once:true}),e=>e.code==='AGENT_QUARANTINED');assert.equal(claims,0);assert.equal(releases,0);
});
test('empty idle owner is released only after old process absence and empty full reconcile',async()=>{
 const f=agentFixture();f.config.stateDir=await mkdtemp(join(tmpdir(),'aqa-agent-idle-owner-'));
 const child=spawn(process.execPath,['-e','process.exit(0)'],{windowsHide:true,stdio:'ignore'}),ownerPid=child.pid;await new Promise(r=>child.on('close',r));
 const store=await openAgentStore(f.config.stateDir,{agentId:f.agentId,instanceId:f.instanceId});await store.set('instance:'+f.instanceId,{instanceId:f.instanceId,ownerPid});await store.set('claim:lost',{phase:'requested',body:{agentId:f.agentId,instanceId:f.instanceId,claimRequestId:'lost'}});await store.close();let released=false,claims=0;
 const transport={reconcile:async body=>({value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:released?'active':'observer',decisions:[],hasMore:false,nextCursor:null}}),release:async body=>{if(body.ownerInstanceId===f.instanceId){assert.deepEqual(body.receipts,[]);released=true;}return {value:{agentId:f.agentId,reportingInstanceId:body.reportingInstanceId,ownerInstanceId:body.ownerInstanceId,released:true,remainingReceipts:0}};},claim:async()=>{claims++;return {value:null,status:204};}};
 await runAgent({config:normalizeConfig(f.config),expected:f.expected,transport,once:true});assert(released);assert.equal(claims,1);
});
test('operator recovery preserves original unknown cleanup and works alone or beside an unacknowledged closed receipt',async()=>{
 for(const mixed of [false,true]){
  const f=await oldState(),b=mixed?{...f.lease,leaseId:randomUUID(),executionId:randomUUID(),fence:2}:f.lease,recovery={id:randomUUID(),confirmedAt:'2026-10-31T12:00:00Z',priorFence:b.fence,newFence:b.fence+1},receipt=randomUUID();
  const store=await openAgentStore(f.config.stateDir,{agentId:f.agentId});let record=f.record;
  if(mixed){const root=join(store.root,'jobs',b.leaseId);await mkdir(root,{recursive:true});record={...f.record,root,leaseReference:await immutableJson(join(root,'lease.json'),b,7*1024*1024)};}
  await store.set('lease:'+b.leaseId,{...record,phase:'quarantined',cleanupState:'unknown'});await store.close();let released=false,oldRequests=0,claims=0;
  const decisions=[...(mixed?[{lease:{...f.lease,state:'closed'},directive:'observe',reason:'closed',cleanupState:'confirmed',completionReceipt:receipt,deliveryClosed:true,evidenceStatus:'verified',operatorRecovery:null}]:[]),{lease:{...b,state:'recovered'},directive:'observe',reason:'operator-stopped-process',cleanupState:'unknown',completionReceipt:null,deliveryClosed:false,evidenceStatus:'pending',operatorRecovery:recovery}];
  const transport={reconcile:async body=>({value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:released?'active':'observer',decisions:released?[]:decisions,hasMore:false,nextCursor:null}}),release:async body=>{if(body.ownerInstanceId===f.instanceId){oldRequests++;assert.deepEqual(body.receipts,mixed?[{leaseId:f.lease.leaseId,completionReceipt:receipt,acceptedThrough:0}]:[]);released=true;}return {value:{agentId:f.agentId,reportingInstanceId:body.reportingInstanceId,ownerInstanceId:body.ownerInstanceId,released:true,remainingReceipts:0}};},claim:async()=>{claims++;return {value:null,status:204};}};
  await runAgent({config:normalizeConfig(f.config),expected:f.expected,transport,once:true});assert.equal(oldRequests,1);assert.equal(claims,1);
  const verified=await openAgentStore(f.config.stateDir,{agentId:f.agentId}),saved=verified.get('lease:'+b.leaseId);assert.equal(saved.phase,'recovered');assert.equal(saved.cleanupState,'unknown');assert.deepEqual(saved.operatorRecovery,recovery);assert.equal(saved.receipt,undefined);await verified.close();
 }
});
test('operator recovery cannot bypass a live old PID or non-increasing fence',async()=>{
 for(const mode of ['live','fence']){
  const f=await oldState();if(mode==='live'){const store=await openAgentStore(f.config.stateDir,{agentId:f.agentId});await store.set('lease:'+f.lease.leaseId,{...f.record,ownerPid:process.pid,phase:'quarantined',cleanupState:'unknown'});await store.close();}
  let releases=0,claims=0;const transport={reconcile:async body=>({value:{agentId:f.agentId,instanceId:body.instanceId,instanceState:'observer',decisions:[{lease:{...f.lease,state:'recovered'},directive:'observe',reason:'operator',cleanupState:'unknown',completionReceipt:null,deliveryClosed:false,evidenceStatus:'pending',operatorRecovery:{id:randomUUID(),confirmedAt:'2026-10-31T12:00:00Z',priorFence:1,newFence:mode==='fence'?1:2}}],hasMore:false,nextCursor:null}}),claim:async()=>{claims++;},release:async()=>{releases++;}};
  await assert.rejects(runAgent({config:normalizeConfig(f.config),expected:f.expected,transport,once:true}),e=>e.code===(mode==='fence'?'AGENT_PROTOCOL_INVALID':'AGENT_QUARANTINED'));assert.equal(releases,0);assert.equal(claims,0);
 }
});
