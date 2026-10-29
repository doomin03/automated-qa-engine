import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parseSource } from '../packages/core/documents.mjs';
import { compileBlueprint } from '../packages/core/compiler.mjs';
import { blueprintXml } from '../packages/core/xml.mjs';
import { validateSchema } from '../packages/core/schema.mjs';
import { startDemoServer } from '../examples/server.mjs';

const original=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url)));
function userBlueprint() {
  const b=structuredClone(original);
  b.id='user-check'; b.name='My & <test> "name"\nnext\tline\rend';
  b.flow.id='user-flow'; b.flow.name=b.name;
  b.flow.variables.note={from:'literal',value:'CDATA ]]> &amp; <not-a-tag> "value"'};
  b.flow.variables.choice={from:'literal',value:false};
  b.flow.metadata={presentation:{x:1,y:2,label:']]>'}};
  b.flow.nodes=[
    {id:'begin',type:'start',timeoutMs:100,retry:{maxRetries:0}},
    {id:'choice',type:'branch',condition:{variable:'choice',operator:'equals',value:false}},
    {id:'yes',type:'end'}, {id:'no',type:'end'}
  ];
  b.flow.entryNode='begin';
  b.flow.edges=[{from:'begin',to:'choice'},{from:'choice',to:'yes',label:'true'},{from:'choice',to:'no',label:'false'}];
  b.target.id='user-target'; b.target.allowedOrigins=['http://127.0.0.1:49123']; b.target.launchTargets={custom:'http://127.0.0.1:49123/page'};
  return b;
}
const call=(args,cwd)=>new Promise((done,reject)=>{
  const child=spawn(process.execPath,[resolve('packages/cli/aqa.mjs'),...args],{cwd,windowsHide:true});
  let stdout='',stderr=''; child.stdout.on('data',b=>stdout+=b); child.stderr.on('data',b=>stderr+=b);
  child.on('error',reject); child.on('close',code=>done({code,stdout,stderr}));
});

test('user Blueprint XML preserves branch, metadata, escapes and CDATA boundary',()=>{
  const b=userBlueprint(), parsed=parseSource(blueprintXml(b),'xml');
  assert.deepEqual(parsed,b);
  assert.deepEqual(compileBlueprint(parsed),compileBlueprint(b));
});

test('XML rejects duplicate structures and mixed or attributed JSON payloads',()=>{
  const xml=blueprintXml(original);
  const malformed=[
    xml.replace('<target>','<target unexpected="yes">'),
    xml.replace('</target>','<script/></target>'),
    xml.replace('</params>','<script/></params>'),
    xml.replace('</target>','</target><target><![CDATA[{}]]></target>'),
    xml.replace('</flow>','</flow><flow id="other" entryNode="start"/>'),
    xml.replace('<nodes>','<nodes unexpected="yes">'),
    xml.replace('type="start"','type="start" extra="yes"'),
    xml.replace('</blueprint>','<script/></blueprint>'),
    '<!DOCTYPE blueprint [<!ENTITY x SYSTEM "file:///secret">]>'+xml,
    xml.replace('<target>','<target><nested>'),
  ];
  for(const input of malformed) assert.throws(()=>parseSource(input,'xml'),e=>e.code==='INVALID_DOCUMENT');
});

test('CLI exports arbitrary user file without running and refuses overwrite or invalid input',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'aqa-xml-export-'));
  const input=join(dir,'user.json'), output=join(dir,'user.xml');
  const b=userBlueprint(); await writeFile(input,JSON.stringify(b));
  const exported=await call(['export',input,'--format','xml','--out',output],dir);
  assert.equal(exported.code,0,exported.stdout); assert.equal(exported.stderr,'');
  assert.deepEqual(parseSource(await readFile(output,'utf8'),'xml'),b);
  const imported=await call(['import',output],dir); assert.equal(imported.code,0); assert.deepEqual(JSON.parse(imported.stdout),b);
  const originalBytes=await readFile(output,'utf8');
  assert.equal((await call(['export',input,'--format','xml','--out',output],dir)).code,2);
  assert.equal(await readFile(output,'utf8'),originalBytes);
  assert.equal((await call(['export',input,'--format','unsupported'],dir)).code,2);
  b.flow.edges[0].to='absent'; await writeFile(input,JSON.stringify(b));
  assert.equal((await call(['export',input,'--format','xml','--out',join(dir,'invalid.xml')],dir)).code,2);
  assert.deepEqual((await readdir(dir)).sort(),['user.json','user.xml']);
});

test('user XML executes actual CLI PASS and FAIL with ordered events and evidence',async t=>{
  const server=await startDemoServer();t.after(()=>server.close());
  const dir=await mkdtemp(join(tmpdir(),'aqa-xml-run-')),b=structuredClone(original);
  b.id='team-custom-login';b.target.allowedOrigins=[server.origin];b.target.launchTargets.login=server.origin;
  b.flow.variables.username.value='alice & bob';b.flow.nodes.find(n=>n.id==='home').params.expected='Welcome alice & bob';
  const runs=[];
  for(const failed of [false,true]) {
    if(failed)b.flow.nodes.find(n=>n.id==='home').params.expected='WRONG';
    const json=join(dir,failed?'fail.json':'pass.json'),xml=join(dir,failed?'fail.xml':'pass.xml');
    await writeFile(json,JSON.stringify(b));
    assert.equal((await call(['export',json,'--format','xml','--out',xml],dir)).code,0);
    const output=await call(['run',xml,'--json','--report',dir],dir);
    assert.equal(output.code,failed?1:0,output.stdout);assert.equal(output.stderr,'');
    const events=output.stdout.trim().split('\n').map(JSON.parse);
    events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);});
    const terminal=events.at(-1);assert.equal(terminal.type,'run.finished');assert.equal(terminal.outcome,failed?'failed':'passed');
    const result=validateSchema(JSON.parse(await readFile(join(dir,terminal.runId,'result.json'),'utf8')));
    assert.equal(result.artifacts.length,1);
    if(failed)assert.equal(result.failure.code,'ASSERTION_FAILED');
    runs.push(result.runId);
  }
  assert.notEqual(runs[0],runs[1]);
});
