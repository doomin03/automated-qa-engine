import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stringify } from 'yaml';
import { compileBlueprint,resolveVariables } from '../packages/core/compiler.mjs';
import { parseSource } from '../packages/core/documents.mjs';
import { blueprintXml } from '../packages/core/xml.mjs';
const original=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url)));
const fresh=()=>structuredClone(original);
test('JSON, YAML and XML normalize to identical execution plans',()=>{
  const plans=[JSON.stringify(original),stringify(original),blueprintXml(original)].map((s,i)=>compileBlueprint(parseSource(s,['json','yaml','xml'][i])));
  assert.deepEqual(plans[0],plans[1]);assert.deepEqual(plans[0],plans[2]);
  assert(Object.isFrozen(plans[0].blueprint.flow.nodes));
});
for(const [label,mutate,code] of [
  ['duplicate node', b=>b.flow.nodes.push({...b.flow.nodes[0]}),'INVALID_FLOW'],
  ['dangling edge', b=>b.flow.edges[0].to='absent','INVALID_FLOW'],
  ['cycle', b=>b.flow.edges.find(e=>e.from==='home').to='open','INVALID_FLOW'],
  ['unreachable node', b=>b.flow.nodes.push({id:'orphan',type:'end'}),'INVALID_FLOW'],
  ['unknown selector', b=>b.flow.nodes[2].params.selector='missing','INVALID_FLOW'],
  ['unsupported platform', b=>b.target.platform='android','UNSUPPORTED_CAPABILITY'],
  ['unsafe retry', b=>b.flow.nodes[3].retry={maxRetries:1},'POLICY_DENIED'],
  ['wrong origin', b=>b.target.launchTargets.login='https://example.com','POLICY_DENIED'],
  ['shell action', b=>b.flow.nodes[3].action='shell','INVALID_DOCUMENT']
]) test(label+' is rejected',()=>{const b=fresh();mutate(b);assert.throws(()=>compileBlueprint(b),e=>e.code===code);});
test('unknown schema is rejected',()=>assert.throws(()=>parseSource('{"schemaVersion":"qa.unknown/v8"}'),e=>e.code==='UNSUPPORTED_SCHEMA'));
test('XML preserves standard escaped characters and rejects cyclic YAML',()=>{
 const b=fresh();b.name='A & B <QA> "check"';
 assert.deepEqual(parseSource(blueprintXml(b),'xml'),b);
 assert.throws(()=>parseSource('schemaVersion: qa.blueprint/v1\nx: &x\n  child: *x\n','yaml'),e=>e.code==='INVALID_DOCUMENT');
});
test('secret references resolve at runtime only',()=>{
  const b=fresh(); b.flow.variables.username={from:'secret',ref:'login.name'};
  const plan=compileBlueprint(b);
  assert.throws(()=>resolveVariables(plan),e=>e.code==='SECRET_NOT_FOUND');
  assert.equal(resolveVariables(plan,()=> 'secret-value').username,'secret-value');
  assert(!JSON.stringify(plan).includes('secret-value'));
});
test('DTD and malformed/unknown XML are rejected',()=>{
  for(const text of ['<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///etc/passwd">]><blueprint/>','<blueprint><flow></blueprint>',blueprintXml(original).replace('<nodes>','<nodes><script/>')])
    assert.throws(()=>parseSource(text,'xml'),e=>e.code==='INVALID_DOCUMENT');
});
test('prototype keys and oversized payload are rejected',()=>{
  assert.throws(()=>parseSource('{"__proto__":{},"schemaVersion":"qa.blueprint/v1"}'));
  assert.throws(()=>parseSource(' '.repeat(1024*1024+1)));
});
test('branch must contain true and false paths',()=>{
  const b=fresh();b.flow.nodes[3]={id:'submit',type:'branch',condition:{variable:'username',operator:'equals',value:'qa-user'}};
  assert.throws(()=>compileBlueprint(b),e=>e.code==='INVALID_FLOW');
});

