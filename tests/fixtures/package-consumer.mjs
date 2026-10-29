import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadBlueprint,compileBlueprint,executeBlueprint,validateSchema,ENGINE_VERSION } from 'automated-qa-engine';
import { PlaywrightAdapter } from 'automated-qa-engine/playwright';

const packageDir=resolve('node_modules/automated-qa-engine');
const pkg=JSON.parse(await readFile(join(packageDir,'package.json'),'utf8'));
const cli=join(packageDir,pkg.bin.aqa);
assert.equal(ENGINE_VERSION,pkg.version);
const call=args=>new Promise((done,reject)=>{
  const p=spawn(process.execPath,[cli,...args],{windowsHide:true});
  let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  p.on('error',reject);p.on('close',code=>done({code,stdout,stderr}));
});
const server=createServer((req,res)=>{
  res.setHeader('content-type','text/html');
  res.end('<input data-testid="username"><button data-testid="submit" onclick="document.querySelector(\'[data-testid=greeting]\').textContent=\'Welcome \'+document.querySelector(\'input\').value">Go</button><p data-testid="greeting"></p>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const runs=[];
await mkdir('reports',{recursive:true});
try {
  const version=await call(['--version']);assert.equal(version.code,0);assert.equal(JSON.parse(version.stdout).engineVersion,ENGINE_VERSION);
  const template=await call(['template']);assert.equal(template.code,0);
  const blueprint=JSON.parse(template.stdout);
  blueprint.id='external-consumer-test';blueprint.target.launchTargets.login=origin;blueprint.target.allowedOrigins=[origin];
  blueprint.flow.variables.username.value='package-user';blueprint.flow.nodes.find(n=>n.id==='home').params.expected='Welcome package-user';
  for(const outcome of ['passed','failed','cancelled']) {
    const b=structuredClone(blueprint),controller=new AbortController(),events=[];
    if(outcome==='failed')b.flow.nodes.find(n=>n.id==='home').params.expected='WRONG';
    const adapter=new PlaywrightAdapter();
    const output=await executeBlueprint(b,{adapter,reportDir:'reports',signal:controller.signal,onEvent:e=>{
      events.push(e);if(outcome==='cancelled'&&e.type==='step.started'&&e.nodeId==='name')controller.abort();
    }});
    assert.equal(output.result.outcome,outcome);assert.equal(adapter.browser.isConnected(),false);
    await verifyResult(output.reportDir,outcome);
    events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);});
    runs.push({transport:'api',outcome,reportDir:output.reportDir});
  }
  for(const failed of [false,true]) {
    const b=structuredClone(blueprint),name=failed?'fail':'pass';
    if(failed)b.flow.nodes.find(n=>n.id==='home').params.expected='WRONG';
    await writeFile(name+'.json',JSON.stringify(b));
    const exported=await call(['export',name+'.json','--format','xml','--out',name+'.xml']);assert.equal(exported.code,0,exported.stdout);
    const imported=await loadBlueprint(name+'.xml');
    assert.deepEqual(compileBlueprint(imported),compileBlueprint(b));
    const run=await call(['run',name+'.xml','--json','--report','reports']);
    assert.equal(run.code,failed?1:0,run.stdout);assert.equal(run.stderr,'');
    const events=run.stdout.trim().split('\n').map(JSON.parse),terminal=events.at(-1);
    events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);});
    assert.equal(terminal.type,'run.finished');
    const reportDir=resolve('reports',terminal.runId);await verifyResult(reportDir,failed?'failed':'passed');
    runs.push({transport:'installed-cli-xml',outcome:terminal.outcome,exitCode:run.code,reportDir});
  }
  const report={engineVersion:ENGINE_VERSION,packageImport:import.meta.resolve('automated-qa-engine'),installedBin:cli,runs};
  await writeFile('consumer-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await new Promise(done=>server.close(done));}

async function verifyResult(dir,outcome) {
  const result=validateSchema(JSON.parse(await readFile(join(dir,'result.json'),'utf8')));
  const evidence=validateSchema(JSON.parse(await readFile(join(dir,'evidence.json'),'utf8')));
  assert.equal(result.outcome,outcome);assert.equal(result.executed.engineVersion,ENGINE_VERSION);
  if(outcome!=='cancelled') assert(result.artifacts.length>0);
  const events=(await readFile(join(dir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);});
  assert.equal(events.at(-1).outcome,outcome);
  assert.deepEqual(result.artifacts,evidence.artifacts);
  for(const artifact of result.artifacts) assert.equal(createHash('sha256').update(await readFile(join(dir,artifact.path))).digest('hex'),artifact.sha256);
}
