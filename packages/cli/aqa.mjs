#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { stringify } from 'yaml';
import { chromium } from 'playwright';
import { schema, supportedSchemas } from '../core/schema.mjs';
import { loadBlueprint, readDocument, parseSource } from '../core/documents.mjs';
import { compileBlueprint, ENGINE_VERSION, ACTIONS } from '../core/compiler.mjs';
import { executeBlueprint } from '../core/runner.mjs';
import { QaError, exitCode } from '../core/errors.mjs';
import { blueprintXml } from '../core/xml.mjs';
import { PlaywrightAdapter } from '../../runners/playwright/adapter.mjs';
import { startDemoServer } from '../../examples/server.mjs';

const json=o=>process.stdout.write(JSON.stringify(o)+'\n');
let controller;
try {
  const {values,positionals}=parseArgs({allowPositionals:true,strict:true,options:{
    json:{type:'boolean'},version:{type:'boolean'},help:{type:'boolean'},headed:{type:'boolean'},headless:{type:'boolean'},
    'allow-production':{type:'boolean'},report:{type:'string'},out:{type:'string'},format:{type:'string'},
    timeout:{type:'string'},selectors:{type:'string'},'target-manifest':{type:'string'},'secrets-file':{type:'string'},target:{type:'string'}
  }});
  const [command,file]=positionals;
  if(values.version) {json({engineVersion:ENGINE_VERSION});}
  else if(values.help || !command) {
    json({name:'aqa',engineVersion:ENGINE_VERSION,commands:['schema','template [--format json|yaml|xml]','import FILE [--out FILE]','export FILE --format xml [--out FILE]','validate FILE','plan FILE','run FILE [--report DIR] [--json]','run-suite FILE','doctor','devices','demo'],policy:'Import, export and validation never execute. Use run explicitly. Secrets only through environment or an ignored secrets file.'});
  } else if(command==='schema') json(schema);
  else if(command==='template') {
    const b=JSON.parse(await readFile(new URL('../../examples/login.qa.json',import.meta.url),'utf8'));
    const text=values.format==='xml'?blueprintXml(b):values.format==='yaml'?stringify(b):JSON.stringify(b,null,2)+'\n';
    if(values.format && !['xml','yaml','json'].includes(values.format)) throw new QaError('INVALID_ARGUMENT','Unsupported output format');
    if(values.out) await writeFile(values.out,text,{flag:'wx'}); else process.stdout.write(text);
  } else if(command==='doctor' || command==='devices') {
    let available=true; try {await access(chromium.executablePath());} catch {available=false;}
    json({schemaVersion:'qa.capabilities/v1',engineVersion:ENGINE_VERSION,supportedSchemas,platforms:['web'],supportedActions:ACTIONS,driverVersions:{playwright:'1.64.1'},targets:available?['chromium-headless']:[],...(command==='doctor'?{diagnostics:{browserInstalled:available,node:process.versions.node}}:{} )});
    if(!available) process.exitCode=3;
  } else {
    const secrets=values['secrets-file']?JSON.parse(await readFile(values['secrets-file'],'utf8')):{};
    const secretResolver=ref=>Object.hasOwn(secrets,ref)?secrets[ref]:process.env['AQA_SECRET_'+ref.replace(/[^a-zA-Z0-9]/g,'_').toUpperCase()];
    controller=new AbortController();
    const cancel=()=>controller.abort(new QaError('CANCELLED','Execution cancelled','run'));
    process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
    try {
      const run=async b=>{
        if(values.target && values.target!==b.target.platform) throw new QaError('UNSUPPORTED_CAPABILITY','Requested target does not match blueprint');
        return executeBlueprint(b,{adapter:new PlaywrightAdapter(),headless:!values.headed,reportDir:values.report || 'artifacts',timeoutMs:values.timeout?Number(values.timeout):60000,signal:controller.signal,secretResolver,allowProduction:!!values['allow-production'],onEvent:values.json && command!=='demo'?json:()=>{}});
      };
      if(command==='demo') {
        const server=await startDemoServer();
        try {
          const b=JSON.parse(await readFile(new URL('../../examples/login.qa.json',import.meta.url),'utf8'));
          b.target.launchTargets.login=server.origin;b.target.allowedOrigins=[server.origin];
          const pass=await run(b);b.flow.nodes.find(n=>n.id==='home').params.expected='deliberate mismatch';
          const fail=await run(b);
          json({pass:{outcome:pass.result.outcome,reportDir:pass.reportDir},fail:{outcome:fail.result.outcome,reportDir:fail.reportDir}});
          process.exitCode=pass.result.outcome==='passed'&&fail.result.outcome==='failed'?0:3;
        } finally {await server.close();}
      } else if(command==='run-suite') {
        const suite=await readDocument(file);
        if(suite.schemaVersion!=='qa.suite/v1') throw new QaError('INVALID_DOCUMENT','Expected suite');
        const runs=[];
        for(const tc of suite.cases) {
          const result=await run(await loadBlueprint(resolve(dirname(file),tc),{selectors:values.selectors,targetManifest:values['target-manifest']}));
          runs.push({runId:result.result.runId,outcome:result.result.outcome,reportDir:result.reportDir});
          if(controller.signal.aborted || (suite.execution.stopOnFailure&&result.result.outcome!=='passed')) break;
        }
        if(!values.json) json({suiteId:suite.id,runs});
        process.exitCode=runs.every(r=>r.outcome==='passed')?0:Math.max(...runs.map(r=>exitCode(r.outcome)));
      } else if(['import','export','validate','plan','run'].includes(command)) {
        if(!file) throw new QaError('INVALID_ARGUMENT','Input file required');
        const b=await loadBlueprint(file,{selectors:values.selectors,targetManifest:values['target-manifest']});
        const plan=compileBlueprint(b);
        if(command==='export') {
          if(values.format!=='xml') throw new QaError('INVALID_ARGUMENT','Export requires --format xml');
          const text=blueprintXml(b);
          const roundTrip=compileBlueprint(parseSource(text,'xml'));
          if(roundTrip.blueprintSnapshotHash!==plan.blueprintSnapshotHash) throw new QaError('INVALID_DOCUMENT','XML export would change the Blueprint');
          if(values.out) await writeFile(values.out,text,{flag:'wx'}); else process.stdout.write(text);
        }
        else if(command==='import') { const text=JSON.stringify(b,null,2)+'\n'; if(values.out) await writeFile(values.out,text,{flag:'wx'});else process.stdout.write(text); }
        else if(command==='validate') json({valid:true,blueprintId:b.id,nodeCount:b.flow.nodes.length,requiredActions:plan.requiredActions,secretRefs:plan.secretRefs});
        else if(command==='plan') json(plan);
        else { const output=await run(b); if(!values.json) json({outcome:output.result.outcome,runId:output.result.runId,reportDir:output.reportDir}); process.exitCode=exitCode(output.result.outcome); }
      } else throw new QaError('INVALID_ARGUMENT','Unknown command');
    } finally {process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
  }
} catch(error) {
  const e=error instanceof QaError?error:new QaError('INVALID_ARGUMENT','Unable to read input or arguments');
  json({error:{code:e.code,message:e.message,details:e.details}});
  process.exitCode=exitCode(e.code);
}

