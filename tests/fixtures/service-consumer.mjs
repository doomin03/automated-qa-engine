import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {executeBlueprint,QaError,validateSchema,ENGINE_VERSION} from 'automated-qa-engine';
const packageDir=resolve('node_modules/automated-qa-engine'),cli=join(packageDir,'packages/cli/aqa.mjs');
const b=JSON.parse(await readFile(join(packageDir,'examples/login.qa.json'),'utf8'));
b.flow.variables={go:{from:'literal',value:true}};b.flow.entryNode='n0';
b.flow.nodes=Array.from({length:1000},(_,i)=>({id:'n'+i,...(i===0?{type:'start'}:i===999?{type:'end'}:{type:'branch',condition:{variable:'go',operator:'equals',value:true}})}));
b.flow.edges=[{from:'n0',to:'n1'},...b.flow.nodes.slice(1,-1).flatMap((n,i)=>[{from:n.id,to:'n'+(i+2),label:'true'},{from:n.id,to:'n999',label:'false'}])];
await mkdir('service-reports',{recursive:true});await writeFile('service.json',JSON.stringify(b));
async function call(args,{stalled=false}={}){const p=spawn(process.execPath,[cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',forced=false;if(!stalled)p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);const timer=setTimeout(()=>{forced=true;p.kill();},15000);const exited=new Promise(r=>p.on('exit',r)),closed=new Promise(r=>p.on('close',r));const code=await exited;clearTimeout(timer);if(stalled)p.stdout.destroy();else await closed;assert(!forced);return {code,stdout,stderr};}
const invalid=await call(['validate','service.json','extra']);assert.equal(invalid.code,2);assert.equal(JSON.parse(invalid.stdout).error.code,'INVALID_ARGUMENT');
const runs=[];
for(const mode of ['passed','timeout','stalled']){
 const report=resolve('service-reports',mode);await mkdir(report);
 const output=await call(['run','service.json','--json','--diagnostics','stderr','--timeout',mode==='passed'?'10000':'1500','--report',report],{stalled:mode==='stalled'});
 const [dir]=await readdir(report),reportDir=join(report,dir),result=validateSchema(JSON.parse(await readFile(join(reportDir,'result.json'),'utf8'))),events=(await readFile(join(reportDir,'events.jsonl'),'utf8')).trim().split('\n').map(s=>validateSchema(JSON.parse(s)));
 assert.equal(result.visitedNodes.length+result.unvisitedNodes.length,1000);assert.equal(result.executed.engineVersion,ENGINE_VERSION);assert.equal(events.at(-1).type,'run.finished');assert.equal(events.at(-1).outcome,result.outcome);
 if(mode==='passed'){assert.equal(result.outcome,'passed');assert.equal(output.code,0);}else{assert.equal(result.outcome,'failed');assert.equal(result.failure.code,'TIMEOUT');assert.equal(result.failure.phase,'run');assert.equal(output.code,mode==='stalled'?3:1);}
 if(mode!=='stalled'){const delivered=output.stdout.trim().split('\n').map(JSON.parse);assert.deepEqual(delivered,events);}
 runs.push({mode,reportDir,outcome:result.outcome,code:output.code,nodes:result.visitedNodes.length});
}
const custom=await executeBlueprint(b,{reportDir:'service-reports',adapter:{getCapabilities:()=>({platforms:['web'],supportedActions:[]}),startSession:async()=>{},endSession:async()=>{},captureEvidence:async()=>false},onEvent:()=>{throw new QaError('TIMEOUT','private-consumer-timeout');}});
assert.equal(custom.result.failure.code,'ENGINE_ERROR');assert.equal(custom.result.outcome,'infra_error');assert(!JSON.stringify(custom.result).includes('private-consumer'));
console.log(JSON.stringify({engineVersion:ENGINE_VERSION,invalidArguments:'rejected',runs,callbackOwnTimeout:'ENGINE_ERROR',callbackReport:custom.reportDir}));
