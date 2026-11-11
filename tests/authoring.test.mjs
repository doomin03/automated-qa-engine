import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { expandAuthoring,parseAuthoringSource,authoringXml } from '../packages/core/authoring.mjs';
import { compileBlueprint } from '../packages/core/compiler.mjs';
import { parseSource } from '../packages/core/documents.mjs';
import { blueprintXml } from '../packages/core/xml.mjs';
import { executeBlueprint } from '../packages/core/runner.mjs';
import { QaError } from '../packages/core/errors.mjs';
import { validateSchema } from '../packages/core/schema.mjs';
import { PlaywrightAdapter } from '../runners/playwright/adapter.mjs';

const original=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url),'utf8'));
const step=(id='tap')=>({id,type:'action',action:'tap',params:{selector:'submit'}});
function document(count=3,steps=[step(),{id:'check',type:'assertion',action:'assertVisible',params:{selector:'submit'}}]) {
  const blueprint=structuredClone(original);
  blueprint.flow.nodes=[{id:'start',type:'start'},{id:'repeat',type:'repeat',count,steps},{id:'end',type:'end'}];
  blueprint.flow.edges=[{from:'start',to:'repeat'},{from:'repeat',to:'end'}];
  return {schemaVersion:'qa.authoring/v1',blueprint};
}
const code=expected=>error=>error.code===expected;
test('alpha5 permits exactly 1000 expanded nodes and rejects 1001 before execution',()=>{
  const d=document(100,Array.from({length:9},(_,i)=>step('s'+i)));
  const extra=Array.from({length:98},(_,i)=>step('extra'+i));d.blueprint.flow.nodes.splice(2,0,...extra);d.blueprint.flow.edges=[{from:'start',to:'repeat'},{from:'repeat',to:extra[0].id},...extra.slice(1).map((n,i)=>({from:extra[i].id,to:n.id})),{from:extra.at(-1).id,to:'end'}];
  const out=expandAuthoring(d);assert.equal(out.blueprint.flow.nodes.length,1000);validateSchema(out.sourceMap);validateSchema(d);
  d.blueprint.flow.nodes.splice(2,0,step('excess'));d.blueprint.flow.edges.find(e=>e.from==='repeat').to='excess';d.blueprint.flow.edges.push({from:'excess',to:extra[0].id});assert.throws(()=>expandAuthoring(d),e=>e.code==='INVALID_DOCUMENT');
});
function repeatOf(d) { return d.blueprint.flow.nodes.find(n=>n.type==='repeat'); }

test('authoring JSON/YAML/XML expand identically without mutating input',()=>{
  const input=document(),before=structuredClone(input);
  const sources=[JSON.stringify(input),stringify(input),authoringXml(input)];
  const expansions=sources.map((text,i)=>expandAuthoring(parseAuthoringSource(text,['json','yaml','xml'][i])));
  assert.deepEqual(expansions[0],expansions[1]);assert.deepEqual(expansions[0],expansions[2]);
  assert.deepEqual(input,before);
  const {blueprint,sourceMap}=expansions[0];
  assert.equal(blueprint.flow.nodes.length,8);
  assert.equal(new Set(blueprint.flow.nodes.map(n=>n.id)).size,8);
  assert.equal(blueprint.flow.edges.length,7);
  assert.ok(Object.isFrozen(blueprint.flow.nodes[1].params));
  assert.ok(Object.isFrozen(sourceMap.nodes[1]));
  assert.deepEqual(sourceMap.nodes.filter(n=>n.iteration).map(n=>n.iteration),[1,1,2,2,3,3]);
  assert.equal(sourceMap.blueprintSnapshotHash,compileBlueprint(blueprint).blueprintSnapshotHash);
  assert.equal(blueprint.sourceMap,undefined);
});

test('authoring zero repeats is an unchanged ordinary Blueprint with sidecar',()=>{
  const input={schemaVersion:'qa.authoring/v1',blueprint:structuredClone(original)};
  const result=expandAuthoring(input);
  assert.deepEqual(result.blueprint,original);
  assert.deepEqual(result.sourceMap.nodes,original.flow.nodes.map(n=>({nodeId:n.id,sourceNodeId:n.id})));
});

test('authoring supports count 1 and 100 without runtime loops',()=>{
  for(const count of [1,100]) {
    const {blueprint,sourceMap}=expandAuthoring(document(count,[step()]));
    assert.equal(blueprint.flow.nodes.length,count+2);
    assert.equal(sourceMap.nodes.filter(n=>n.iteration).length,count);
    assert.ok(!blueprint.flow.nodes.some(n=>n.type==='repeat'));
  }
});

test('authoring deterministic IDs survive surrounding array reorder and long source IDs',()=>{
  const d=document(2,[step('s'.repeat(128))]);
  repeatOf(d).id='r'.repeat(128);d.blueprint.flow.edges[0].to=repeatOf(d).id;d.blueprint.flow.edges[1].from=repeatOf(d).id;
  const before=expandAuthoring(d).sourceMap.nodes.filter(n=>n.iteration).map(n=>n.nodeId);
  d.blueprint.flow.nodes.reverse();
  const after=expandAuthoring(d).sourceMap.nodes.filter(n=>n.iteration).map(n=>n.nodeId);
  assert.deepEqual(before,after);
  assert.ok(before.every(id=>/^repeat_[a-f0-9]{64}$/.test(id)));
});

test('authoring rewires outer branch labels and multiple incoming edges',()=>{
  const d=document(2,[step()]),f=d.blueprint.flow;
  f.nodes.splice(1,0,{id:'choose',type:'branch',condition:{variable:'username',operator:'equals',value:'qa-user'}},{...step('left')},{...step('right')});
  f.edges=[{from:'start',to:'choose'},{from:'choose',to:'left',label:'true'},{from:'choose',to:'right',label:'false'},{from:'left',to:'repeat'},{from:'right',to:'repeat'},{from:'repeat',to:'end'}];
  const {blueprint,sourceMap}=expandAuthoring(d),first=sourceMap.nodes.find(n=>n.iteration===1).nodeId;
  assert.deepEqual(blueprint.flow.edges.filter(e=>e.from==='choose'),f.edges.filter(e=>e.from==='choose'));
  assert.equal(blueprint.flow.edges.find(e=>e.from==='left').to,first);
  assert.equal(blueprint.flow.edges.find(e=>e.from==='right').to,first);
  compileBlueprint(blueprint);
});

test('authoring rewires adjacent repeats without cross-linking scoped step IDs',()=>{
  const d=document(2,[step()]),f=d.blueprint.flow;
  f.nodes.splice(2,0,{id:'second',type:'repeat',count:2,steps:[step()]});
  f.edges=[{from:'start',to:'repeat'},{from:'repeat',to:'second'},{from:'second',to:'end'}];
  const {blueprint,sourceMap}=expandAuthoring(d);
  const one=sourceMap.nodes.filter(n=>n.sourceNodeId==='repeat'),two=sourceMap.nodes.filter(n=>n.sourceNodeId==='second');
  assert.ok(blueprint.flow.edges.some(e=>e.from===one.at(-1).nodeId&&e.to===two[0].nodeId));
  assert.equal(new Set(blueprint.flow.nodes.map(n=>n.id)).size,6);
});

test('authoring generated ID collisions and external references into a body are rejected',()=>{
  const d=document(1,[step()]);
  const generated='repeat_'+createHash('sha256').update(JSON.stringify(['repeat',1,'tap'])).digest('hex');
  d.blueprint.flow.nodes.push({id:generated,type:'end'});
  assert.throws(()=>expandAuthoring(d),code('INVALID_FLOW'));
  const dangling=document();dangling.blueprint.flow.edges[0].to='tap';
  assert.throws(()=>expandAuthoring(dangling),code('INVALID_FLOW'));
});

test('authoring rejects non-integer counts before allocating repeated nodes',()=>{
  for(const count of [0,-1,101,1.5,'3',null,Number.MAX_SAFE_INTEGER]) assert.throws(()=>expandAuthoring(document(count)),code('INVALID_DOCUMENT'));
  for(const count of [Infinity,NaN]) assert.throws(()=>expandAuthoring(document(count)),code('INVALID_DOCUMENT'));
});

test('authoring rejects nested repeat, body branch/start/end and empty or duplicate steps',()=>{
  for(const type of ['repeat','branch','start','end']) assert.throws(()=>expandAuthoring(document(1,[{id:'inner',type}])),code('UNSUPPORTED_CAPABILITY'));
  assert.throws(()=>expandAuthoring(document(2,[])),code('INVALID_DOCUMENT'));
  assert.throws(()=>expandAuthoring(document(2,[step(),step()])),code('INVALID_FLOW'));
  const extra=document();repeatOf(extra).timeoutMs=50;
  assert.throws(()=>expandAuthoring(extra),code('INVALID_DOCUMENT'));
});

test('authoring preserves compiler graph, selector and side-effect retry checks',()=>{
  for(const mutate of [
    d=>d.blueprint.flow.edges.push({from:'repeat',to:'end'}),
    d=>d.blueprint.flow.edges[1].to='repeat',
    d=>d.blueprint.flow.nodes.push({id:'unreachable',type:'end'}),
    d=>d.blueprint.flow.entryNode='repeat',
    d=>d.blueprint.flow.edges[1].label='true',
    d=>repeatOf(d).steps[0].params.selector='missing',
    d=>repeatOf(d).steps[0].retry={maxRetries:1},
  ]) {const d=document();mutate(d);assert.throws(()=>expandAuthoring(d),e=>['INVALID_FLOW','POLICY_DENIED'].includes(e.code));}
});

test('authoring bounds expanded node count and bytes independently of compact input',()=>{
  assert.throws(()=>expandAuthoring(document(100,Array.from({length:10},(_,i)=>step('tap'+i)))),code('INVALID_DOCUMENT'));
  const d=document(100,[{id:'input',type:'action',action:'input',params:{selector:'username',value:'x'.repeat(16000)}}]);
  assert.ok(Buffer.byteLength(JSON.stringify(d))<20000);
  assert.throws(()=>expandAuthoring(d),e=>e.code==='INVALID_DOCUMENT'&&e.message.includes('1 MiB'));
});

test('authoring input enforces bytes, depth, reserved keys, cycles and plain JSON values',()=>{
  assert.throws(()=>parseAuthoringSource(' '.repeat(1024*1024+1)),code('INVALID_DOCUMENT'));
  const cycle=document();cycle.blueprint.flow.metadata={presentation:cycle};
  assert.throws(()=>expandAuthoring(cycle),code('INVALID_DOCUMENT'));
  for(const key of ['__proto__','constructor','prototype']) assert.throws(()=>parseAuthoringSource(JSON.stringify(document()).replace('"blueprint":','"'+key+'":{},"blueprint":')),code('INVALID_DOCUMENT'));
  const deep=document();let cursor=deep.blueprint.flow.metadata={presentation:{}};
  for(let i=0;i<130;i++)cursor=cursor.next={};
  assert.throws(()=>expandAuthoring(deep),code('INVALID_DOCUMENT'));
  for(const value of [undefined,()=>{},new Date(),Symbol('x'),BigInt(1)]) {
    const d=document();d.blueprint.flow.metadata={presentation:{value}};
    assert.throws(()=>expandAuthoring(d),code('INVALID_DOCUMENT'));
  }
  const accessor=document();Object.defineProperty(accessor,'bad',{enumerable:true,get(){throw new Error('must not execute');}});
  assert.throws(()=>expandAuthoring(accessor),code('INVALID_DOCUMENT'));
});

test('authoring rejects duplicate YAML keys, recursive aliases and unknown source/schema',()=>{
  assert.throws(()=>parseAuthoringSource('schemaVersion: qa.authoring/v1\nschemaVersion: qa.authoring/v1\n','yaml'),code('INVALID_DOCUMENT'));
  assert.throws(()=>parseAuthoringSource('schemaVersion: qa.authoring/v1\nblueprint: &root\n  child: *root\n','yaml'),code('INVALID_DOCUMENT'));
  assert.throws(()=>parseAuthoringSource('{}','javascript'),code('INVALID_DOCUMENT'));
  assert.throws(()=>parseAuthoringSource('{"schemaVersion":"qa.authoring/v99","blueprint":{}}'),code('UNSUPPORTED_SCHEMA'));
  assert.throws(()=>parseAuthoringSource('malformed-json'),code('INVALID_DOCUMENT'));
});

test('authoring XML preserves CDATA terminators and entity-looking strings as inert values',()=>{
  const d=document(1,[{id:'input',type:'action',action:'input',params:{selector:'username',value:']]> &unknown; <script> inert <!DOCTYPE text'}}]);
  const xml=authoringXml(d);
  assert.ok(xml.includes(']]]]><![CDATA[>'));
  assert.deepEqual(parseAuthoringSource(xml,'xml'),d);
});

test('authoring XML rejects duplicate/unknown payloads, attributes, DTD, entities and malformed markup',()=>{
  const xml=authoringXml(document());
  const payload=xml.match(/<blueprint>[\s\S]*<\/blueprint>/)[0];
  const invalid=[
    xml.replace('</authoring>',payload+'</authoring>'),
    xml.replace('schemaVersion="qa.authoring/v1"','schemaVersion="qa.authoring/v1" schemaVersion="qa.authoring/v1"'),
    xml.replace('<blueprint>','<blueprint unknown="yes">'),
    xml.replace('</authoring>','<script/></authoring>'),
    xml.replace('</authoring>','<__proto__/></authoring>'),
    xml.replace('</authoring>','<constructor/></authoring>'),
    xml.replace('</authoring>','</wrong>'),
    '<!DOCTYPE authoring [<!ENTITY secret SYSTEM "file:///secret">]>'+xml,
    xml.replace('<blueprint>','<blueprint>&secret;'),
    '<authoring schemaVersion="qa.authoring/v1"><blueprint>{}</blueprint></authoring>',
    '<authoring schemaVersion="qa.authoring/v1">'+'<nested>'.repeat(130)+'</nested>'.repeat(130)+'</authoring>',
  ];
  for(const value of invalid) assert.throws(()=>parseAuthoringSource(value,'xml'),code('INVALID_DOCUMENT'));
});

test('authoring documentation XML is a complete valid authoring document',async()=>{
  const docs=await readFile(new URL('../docs/authoring.md',import.meta.url),'utf8');
  const xml=docs.match(/```xml\n([\s\S]*?)\n```/)[1];
  const expanded=expandAuthoring(parseAuthoringSource(xml,'xml'));
  assert.equal(expanded.blueprint.flow.nodes.length,6);
});

test('authoring failure stops inside an iteration and retains unique event identities',async()=>{
  const {blueprint,sourceMap}=expandAuthoring(document(3));
  const stop=sourceMap.nodes.find(n=>n.iteration===2 && n.sourceStepId==='check').nodeId;
  const events=[],reportDir=await mkdtemp(join(tmpdir(),'aqa-authoring-fail-'));
  const adapter={getCapabilities:()=>({platforms:['web'],supportedActions:['tap','assertVisible']}),startSession:async()=>{},performAction:async()=>{},evaluateAssertion:async node=>{if(node.id===stop)throw new QaError('ASSERTION_FAILED','Expected failure','step');},captureEvidence:async()=>false,endSession:async()=>{}};
  const output=await executeBlueprint(blueprint,{adapter,reportDir,onEvent:event=>events.push(event)});
  assert.equal(output.result.outcome,'failed');assert.equal(output.result.failure.nodeId,stop);
  const later=sourceMap.nodes.filter(n=>n.iteration===3).map(n=>n.nodeId);
  assert.ok(later.every(id=>output.result.unvisitedNodes.includes(id)));
  const finished=events.filter(e=>e.type==='step.finished').map(e=>e.nodeId);
  assert.equal(new Set(finished).size,finished.length);
  events.forEach((e,i)=>assert.equal(e.sequence,i+1));
});

test('authoring XML expands through Blueprint XML to actual Chromium repeated actions and evidence',async t=>{
  const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<button data-testid="submit" onclick="document.querySelector(\'[data-testid=count]\').textContent=String(++window.count)">increment</button><span data-testid="count">0</span><script>window.count=0</script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const origin=`http://127.0.0.1:${server.address().port}`,input=document(3),f=input.blueprint.flow;
  input.blueprint.target.allowedOrigins=[origin];input.blueprint.target.launchTargets.login=origin;
  input.blueprint.selectors.selectors.count={web:{strategy:'testId',value:'count'}};
  f.nodes.splice(1,0,{id:'launch',type:'action',action:'launch',params:{target:'login'}});
  f.nodes.splice(-1,0,{id:'count',type:'assertion',action:'assertText',params:{selector:'count',expected:'3'}},{id:'evidence',type:'action',action:'screenshot',params:{}});
  f.edges=[{from:'start',to:'launch'},{from:'launch',to:'repeat'},{from:'repeat',to:'count'},{from:'count',to:'evidence'},{from:'evidence',to:'end'}];
  const sourceXml=authoringXml(input),expanded=expandAuthoring(parseAuthoringSource(sourceXml,'xml'));
  const executableXml=blueprintXml(expanded.blueprint),executable=parseSource(executableXml,'xml');
  assert.equal(compileBlueprint(executable).blueprintSnapshotHash,expanded.sourceMap.blueprintSnapshotHash);
  const reportDir=await mkdtemp(join(tmpdir(),'aqa-authoring-browser-'));
  await writeFile(join(reportDir,'source.authoring.xml'),sourceXml);
  await writeFile(join(reportDir,'expanded.blueprint.xml'),executableXml);
  await writeFile(join(reportDir,'source-map.json'),JSON.stringify(expanded.sourceMap,null,2));
  const adapter=new PlaywrightAdapter(),output=await executeBlueprint(executable,{adapter,reportDir});
  assert.equal(output.result.outcome,'passed');assert.equal(adapter.browser.isConnected(),false);
  const events=(await readFile(join(output.reportDir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  const started=events.filter(e=>e.type==='step.started');
  assert.equal(new Set(started.map(e=>e.nodeId)).size,11);
  assert.equal(started.filter(e=>e.nodeId.startsWith('repeat_')).length,6);
  events.forEach((event,i)=>{validateSchema(event);assert.equal(event.sequence,i+1);assert.equal(event.runId,output.result.runId);assert.equal(event.attempt,1);});
  assert.equal(events.at(-1).type,'run.finished');
  assert.equal(output.result.artifacts.length,1);
  const artifact=output.result.artifacts[0],bytes=await readFile(join(output.reportDir,artifact.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);
  assert.equal(output.result.executed.blueprintSnapshotHash,expanded.sourceMap.blueprintSnapshotHash);
  t.diagnostic(JSON.stringify({authoringEvidenceRoot:reportDir,runId:output.result.runId,result:join(output.reportDir,'result.json'),pngSha256:artifact.sha256}));
});
