import { mkdir, writeFile, appendFile, readFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compileBlueprint, resolveVariables, ENGINE_VERSION } from './compiler.mjs';
import { validateSchema } from './schema.mjs';
import { QaError, ensure } from './errors.mjs';

function interrupted(signal) {
  return signal.reason instanceof QaError ? signal.reason : new QaError('CANCELLED','Execution cancelled','run');
}
function bounded(operation,signal,timeoutMs,phase) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted) { reject(interrupted(signal)); return; }
    const timer=setTimeout(()=>finish(new QaError('TIMEOUT','Execution deadline exceeded',phase)),timeoutMs);
    const onAbort=()=>finish(interrupted(signal));
    function finish(error,value) { clearTimeout(timer); signal.removeEventListener('abort',onAbort); error?reject(error):resolve(value); }
    signal.addEventListener('abort',onAbort,{once:true});
    Promise.resolve().then(operation).then(v=>finish(null,v),finish);
  });
}
function publicFailure(error,nodeId) {
  const e=error instanceof QaError ? error : new QaError('ENGINE_ERROR','Unexpected execution error','run');
  return {code:e.code,message:e.message,phase:e.phase,...(nodeId?{nodeId}:{})};
}
function outcomeFor(failure) {
  if(failure.code==='CANCELLED') return 'cancelled';
  if(['UNSUPPORTED_CAPABILITY','POLICY_DENIED','SECRET_NOT_FOUND'].includes(failure.code)) return 'blocked';
  if(['ASSERTION_FAILED','ELEMENT_NOT_FOUND'].includes(failure.code) || (failure.code==='TIMEOUT' && ['step','run'].includes(failure.phase))) return 'failed';
  return 'infra_error';
}
export async function executeBlueprint(document, {adapter,reportDir='artifacts',timeoutMs=60000,headless=true,signal=new AbortController().signal,secretResolver,allowProduction=false,onEvent=()=>{}}={}) {
  const plan=compileBlueprint(document);
  ensure(adapter,'ENGINE_ERROR','Runner adapter is required');
  const capabilities=adapter.getCapabilities();
  ensure(capabilities.platforms.includes(plan.blueprint.target.platform) && plan.requiredActions.every(a=>capabilities.supportedActions.includes(a)), 'UNSUPPORTED_CAPABILITY','Runner does not support required capabilities');
  ensure(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000,'INVALID_DOCUMENT','Run timeout must be 1..300000ms');
  ensure(allowProduction || plan.blueprint.target.environment!=='production','POLICY_DENIED','Production execution requires explicit opt-in');
  const variables=resolveVariables(plan,secretResolver);
  const secretInputs=new Set(Object.entries(plan.blueprint.flow.variables || {}).filter(([,v])=>v.from==='secret').map(([k])=>k));
  const runId='run_'+randomUUID(),attempt=1,dir=resolve(reportDir,runId);
  await mkdir(dir,{recursive:true});
  const blueprint=plan.blueprint;
  await writeFile(join(dir,'blueprint.json'),JSON.stringify(blueprint,null,2),{flag:'wx'});
  await writeFile(join(dir,'plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});
  let sequence=0,observerFailed=false;
  async function emit(type,payload={}) {
    const event=validateSchema({schemaVersion:'qa.runEvent/v1',runId,attempt,sequence:++sequence,type,timestamp:new Date().toISOString(),...payload});
    await appendFile(join(dir,'events.jsonl'),JSON.stringify(event)+'\n');
    if(!observerFailed) {
      try {
        // Observer delivery shares the run budget; terminal delivery has a
        // separate bound because the immutable result is already persisted.
        await bounded(()=>onEvent(event),type==='run.finished'?new AbortController().signal:signal,type==='run.finished'?1000:remaining(),'run');
      } catch {
        observerFailed=true;
        if(type!=='run.finished' && signal.aborted) throw interrupted(signal);
        throw new QaError('ENGINE_ERROR',type==='run.finished'?'Event delivery failed after terminal result was persisted':'Event consumer failed or exceeded the run deadline','run');
      }
    }
  }
  const artifacts=[],visitedNodes=[],cleanupErrors=[];
  const startedAt=new Date().toISOString(),deadline=performance.now()+timeoutMs;
  let outcome='passed',failure,current,activeNode;
  const remaining=()=>Math.max(1,Math.floor(deadline-performance.now()));
  const nodes=new Map(blueprint.flow.nodes.map(n=>[n.id,n]));
  const edges=blueprint.flow.edges;
  async function evidence(nodeId,evidenceSignal=new AbortController().signal) {
    try {
      const path='evidence-'+artifacts.length+'.png',full=join(dir,path);
      if(!await bounded(()=>adapter.captureEvidence(full,{containsSecrets:secretInputs.size>0}),evidenceSignal,3000,'cleanup')) return;
      const bytes=await readFile(full);
      const item={type:'screenshot',path,contentType:'image/png',sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
      artifacts.push(item);
    } catch { cleanupErrors.push({code:'EVIDENCE_ERROR',message:'Unable to capture evidence',phase:'cleanup',...(nodeId?{nodeId}:{})}); }
  }
  try {
    await emit('run.started',{blueprintSnapshotHash:plan.blueprintSnapshotHash});
    await bounded(()=>adapter.startSession(blueprint.target,{headless,timeoutMs:remaining()}),signal,remaining(),'session');
    current=blueprint.flow.entryNode;
    while(current) {
      if(signal.aborted) throw interrupted(signal);
      if(performance.now()>=deadline) throw new QaError('TIMEOUT','Run deadline exceeded','run');
      const node=nodes.get(current),started=performance.now();
      visitedNodes.push(current);
      activeNode=current;
      await emit('step.started',{nodeId:current});
      let branch;
      const nodeDeadline=Math.min(deadline,performance.now()+(node.timeoutMs || 10000));
      for(let retry=0;;retry++) {
        try {
          const budget=Math.max(1,Math.floor(nodeDeadline-performance.now()));
          if(performance.now()>=nodeDeadline) throw new QaError('TIMEOUT','Step deadline exceeded','step');
          const ctx={blueprint,variables,timeoutMs:budget,secretInputs};
          if(node.type==='branch') {
            const equal=variables[node.condition.variable]===node.condition.value;
            branch=String(node.condition.operator==='equals'?equal:!equal);
          } else if(node.type==='assertion') await bounded(()=>adapter.evaluateAssertion(node,ctx),signal,budget,'step');
          else if(node.type==='action') {
            if(node.action==='screenshot') await bounded(()=>evidence(current,signal),signal,budget,'step');
            else await bounded(()=>adapter.performAction(node,ctx),signal,budget,'step');
          }
          break;
        } catch(error) {
          const retryable=error instanceof QaError && ['ASSERTION_FAILED','ELEMENT_NOT_FOUND'].includes(error.code);
          if(!retryable || retry >= (node.retry?.maxRetries || 0) || performance.now()>=nodeDeadline || signal.aborted) throw error;
          await emit('step.retrying',{nodeId:current});
        }
      }
      activeNode=undefined;
      await emit('step.finished',{nodeId:current,outcome:'passed',durationMs:performance.now()-started,...(branch?{branch}:{}),artifacts:[]});
      current=edges.find(e=>e.from===current && (node.type!=='branch' || e.label===branch))?.to;
    }
  } catch(error) {
    failure=publicFailure(error,activeNode); outcome=outcomeFor(failure);
    if(activeNode) {
      if(outcome!=='cancelled') await evidence(activeNode);
      await emit('step.finished',{nodeId:activeNode,outcome,failure,artifacts:[...artifacts]});
    }
  } finally {
    try { await bounded(()=>adapter.endSession(),new AbortController().signal,5000,'cleanup'); }
    catch { cleanupErrors.push({code:'CLEANUP_ERROR',message:'Runner cleanup failed',phase:'cleanup'}); if(outcome==='passed') { outcome='infra_error'; failure=cleanupErrors.at(-1); } }
  }
  const result=validateSchema({schemaVersion:'qa.result/v1',runId,attempt,status:outcome==='cancelled'?'cancelled':'finished',outcome,startedAt,finishedAt:new Date().toISOString(),...(failure?{failure}:{}),artifacts,executed:{engineVersion:ENGINE_VERSION,platform:blueprint.target.platform,flowSnapshotHash:plan.flowSnapshotHash,blueprintSnapshotHash:plan.blueprintSnapshotHash},visitedNodes,unvisitedNodes:blueprint.flow.nodes.map(n=>n.id).filter(id=>!visitedNodes.includes(id)),cleanupErrors});
  await writeFile(join(dir,'evidence.json'),JSON.stringify(validateSchema({schemaVersion:'qa.evidence/v1',runId,attempt,artifacts}),null,2),{flag:'wx'});
  await writeFile(join(dir,'result.tmp'),JSON.stringify(result,null,2),{flag:'wx'});
  await rename(join(dir,'result.tmp'),join(dir,'result.json'));
  await emit('run.finished',{outcome,...(failure?{failure}:{}),artifacts,resultPath:'result.json'});
  return {result,reportDir:dir,plan};
}

