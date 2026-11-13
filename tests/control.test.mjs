import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { attachControl,requestedDiagnostic } from '../packages/cli/control.mjs';
import {createOutput} from '../packages/cli/output.mjs';
import { startDemoServer } from '../examples/server.mjs';
import { validateSchema } from '../packages/core/schema.mjs';

test('bounded control handles chunking, CRLF, duplicate cancel and listener cleanup',()=>{
  const input=new PassThrough();let cancelled=0;
  attachControl(input,{onCancel:()=>cancelled++,onInvalid:()=>assert.fail('unexpected invalid')});
  input.write(Buffer.from('{"type":'));input.write(Buffer.from('"cancel"}\r\n{"type":"cancel"}\n'));
  assert.equal(cancelled,1);assert.equal(input.listenerCount('data'),0);
});

for(const [name,bytes] of [
  ['unknown',Buffer.from('{"type":"secret-unknown"}\n')],
  ['extra key',Buffer.from('{"type":"cancel","value":"private-secret"}\n')],
  ['bad JSON',Buffer.from('{private-secret}\n')],
  ['invalid UTF8',Buffer.from([0xff,10])],
  ['oversized line',Buffer.alloc(4097,32)],
  ['oversized chunk',Buffer.alloc(65537,32)],
  ['partial EOF',Buffer.from('{"type":"cancel"}')],
]) test('control rejects '+name+' once without exposing input',async()=>{
  const input=new PassThrough();let rejected=0;
  attachControl(input,{onCancel:()=>assert.fail('unexpected cancel'),onInvalid:()=>rejected++});
  input.end(bytes);await new Promise(done=>setImmediate(done));
  assert.equal(rejected,1);assert.equal(input.listenerCount('data'),0);
});

test('control EOF does not cancel and diagnostics selector is explicit',async()=>{
  const input=new PassThrough();
  attachControl(input,{onCancel:()=>assert.fail('EOF cancelled'),onInvalid:()=>assert.fail('EOF invalid')});
  input.end();await new Promise(done=>setImmediate(done));assert.equal(input.listenerCount('data'),0);
  assert.equal(requestedDiagnostic(['--diagnostics','stderr','--unknown']),'stderr');
  assert.equal(requestedDiagnostic(['--','--diagnostics=stderr']),'stdout');
});

test('bounded output rejects oversized message and remains failed without retry',async()=>{
  const output=createOutput({maxBytes:4});
  for(let i=0;i<2;i++)await assert.rejects(output.stdout.json({private:'output-detail'}),e=>e.code==='ENGINE_ERROR'&&!e.message.includes('output-detail'));
  await output.close();
});

function child(args,onEvent,inputEnd=false) {
  return new Promise((done,reject)=>{
    const p=spawn(process.execPath,[resolve('packages/cli/aqa.mjs'),...args],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const timer=setTimeout(()=>{p.kill();reject(new Error('CLI child did not exit; exitCode='+p.exitCode+' stdout='+stdout+' stderr='+stderr));},20000);
    let stdout='',stderr='',pending='';const events=[];
    p.stdin.on('error',()=>{});
    p.stdout.on('data',chunk=>{
      stdout+=chunk;pending+=chunk;
      while(pending.includes('\n')) {
        const end=pending.indexOf('\n'),line=pending.slice(0,end);pending=pending.slice(end+1);
        if(!line)continue;
        try {const e=JSON.parse(line);events.push(e);onEvent?.(e,p);} catch(error){clearTimeout(timer);p.kill();reject(error);}
      }
    });
    p.stderr.on('data',chunk=>stderr+=chunk);
    p.on('error',e=>{clearTimeout(timer);reject(e);});
    p.on('close',code=>{clearTimeout(timer);done({code,stdout,stderr,events});});
    if(inputEnd)p.stdin.end();
  });
}

test('diagnostics stderr preserves default stdout and routes parse errors',async()=>{
  for(const args of [['validate','absent-file.json'],['--unknown']]) {
    const legacy=await child(args);assert.equal(legacy.code,2);assert(JSON.parse(legacy.stdout).error);assert.equal(legacy.stderr,'');
    const separate=await child([...args,'--diagnostics','stderr']);assert.equal(separate.code,2);assert.equal(separate.stdout,'');assert(JSON.parse(separate.stderr).error);
  }
});

for(const mode of ['cancel','invalid','eof','suite']) test('real child pipe '+mode+' preserves terminal and expected exit',async t=>{
  const server=await startDemoServer();t.after(()=>server.close());
  const dir=await mkdtemp(join(tmpdir(),'aqa-control-'));
  const b=JSON.parse(await readFile('examples/login.qa.json','utf8'));
  b.target.allowedOrigins=[server.origin];b.target.launchTargets.login=server.origin;
  if(mode!=='eof') {b.selectors.selectors.username.web.value='missing';b.flow.nodes.find(n=>n.id==='name').timeoutMs=15000;}
  await writeFile(join(dir,'flow.json'),JSON.stringify(b));
  await writeFile(join(dir,'suite.json'),JSON.stringify({schemaVersion:'qa.suite/v1',id:'control-suite',name:'Control suite',cases:['flow.json','flow.json'],execution:{parallelism:1,stopOnFailure:false}}));
  let sent=false;
  const result=await child([mode==='suite'?'run-suite':'run',join(dir,mode==='suite'?'suite.json':'flow.json'),'--report',dir,'--json','--control-stdin','--diagnostics','stderr'],(e,p)=>{
    if(e.type==='step.started'&&e.nodeId==='name'&&!sent&&mode!=='eof') {
      sent=true;p.stdin.write(mode==='invalid'?'{"type":"private-unknown-control"}\n':'{"type":"cancel"}\n');
    }
  },mode==='eof');
  const outcome=mode==='eof'?'passed':mode==='invalid'?'infra_error':'cancelled';
  assert.equal(result.code,mode==='eof'?0:mode==='invalid'?3:5,result.stdout+result.stderr);
  const events=result.events;events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);});
  assert.equal(events.at(-1).type,'run.finished');assert.equal(events.at(-1).outcome,outcome);
  assert.equal(events.filter(e=>e.type==='run.started').length,1);
  const saved=validateSchema(JSON.parse(await readFile(join(dir,events.at(-1).runId,'result.json'),'utf8')));
  assert.equal(saved.outcome,outcome);
  if(mode==='invalid') {assert.equal(JSON.parse(result.stderr).error.code,'INVALID_CONTROL');assert(!result.stderr.includes('private-unknown'));}
  else assert.equal(result.stderr,'');
});

test('closed stdout exits with delivery failure while retaining durable result',async t=>{
  const server=await startDemoServer();t.after(()=>server.close());
  const dir=await mkdtemp(join(tmpdir(),'aqa-closed-output-'));
  const b=JSON.parse(await readFile('examples/login.qa.json','utf8'));
  b.target.allowedOrigins=[server.origin];b.target.launchTargets.login=server.origin;
  await writeFile(join(dir,'flow.json'),JSON.stringify(b));
  let runId;
  const result=await child(['run',join(dir,'flow.json'),'--report',dir,'--json','--diagnostics','stderr'],(e,p)=>{
    runId=e.runId;if(e.type==='step.started'&&e.nodeId==='name')p.stdout.destroy();
  });
  assert.equal(result.code,3);assert.equal(JSON.parse(result.stderr).error.code,'ENGINE_ERROR');
  const saved=validateSchema(JSON.parse(await readFile(join(dir,runId,'result.json'),'utf8')));
  assert.equal(saved.outcome,'infra_error');
});
