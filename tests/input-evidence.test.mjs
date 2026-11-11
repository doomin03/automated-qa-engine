import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {loadBlueprint,executeBlueprint,compileBlueprint,validateSchema} from '../packages/core/index.mjs';
import {readDocument} from '../packages/core/documents.mjs';
const original=JSON.parse(await readFile('examples/login.qa.json','utf8')),cli=resolve('packages/cli/aqa.mjs');
const call=args=>new Promise((done,reject)=>{const p=spawn(process.execPath,[cli,...args],{windowsHide:true});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>done({code,stdout,stderr}));});
test('documentRoot contains Blueprint/TC/selector/target and preserves unscoped relative behavior',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-docroot-')),outside=await mkdtemp(join(tmpdir(),'aqa-outside-'));
 for(const [name,doc] of [['b.json',original],['flow.json',original.flow],['selectors.json',original.selectors],['target.json',original.target]])await writeFile(join(root,name),JSON.stringify(doc));
 await writeFile(join(outside,'flow.json'),JSON.stringify(original.flow));await symlink(outside,join(root,'linked'),'junction');
 const tc={schemaVersion:'qa.testcase/v1',id:'tc',name:'TC',flowRef:'flow.json',expected:'Expected',prerequisites:[],platforms:['web']};await writeFile(join(root,'tc.json'),JSON.stringify(tc));
 const options={documentRoot:root,selectors:join(root,'selectors.json'),targetManifest:join(root,'target.json')};assert.equal((await loadBlueprint(join(root,'b.json'),options)).id,original.id);assert.equal((await loadBlueprint(join(root,'tc.json'),options)).testCase.id,'tc');
 tc.flowRef=join(outside,'flow.json');await writeFile(join(root,'tc.json'),JSON.stringify(tc));await assert.rejects(loadBlueprint(join(root,'tc.json'),options),e=>e.code==='POLICY_DENIED');assert((await loadBlueprint(join(root,'tc.json'),{...options,documentRoot:undefined})).flow);
 tc.flowRef='linked/flow.json';await writeFile(join(root,'tc.json'),JSON.stringify(tc));await assert.rejects(loadBlueprint(join(root,'tc.json'),options),e=>e.code==='POLICY_DENIED');
 await assert.rejects(readDocument(join(outside,'flow.json'),{documentRoot:root}),e=>e.code==='POLICY_DENIED');
 await writeFile(join(root,'big.json'),Buffer.alloc(1024*1024+1));await assert.rejects(readDocument(join(root,'big.json')));
});
test('suite and CLI references cannot escape explicit root before any run',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-suite-root-')),outside=await mkdtemp(join(tmpdir(),'aqa-suite-outside-'));await writeFile(join(outside,'b.json'),JSON.stringify(original));
 const suite={schemaVersion:'qa.suite/v1',id:'suite',name:'Suite',cases:[join(outside,'b.json')],execution:{parallelism:1,stopOnFailure:true}};await writeFile(join(root,'suite.json'),JSON.stringify(suite));
 const out=await call(['run-suite',join(root,'suite.json'),'--document-root',root,'--report',join(root,'reports'),'--json']);assert.equal(out.code,4);assert.equal(JSON.parse(out.stdout).error.code,'POLICY_DENIED');
 const file=await call(['validate',join(outside,'b.json'),'--document-root',root]);assert.equal(file.code,4);
});
test('secrets file is a bounded regular string map with sanitized diagnostics',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aqa-secret-input-'));await writeFile(join(root,'b.json'),JSON.stringify(original));
 for(const content of ['["private-value"]','{"name":123}','{"private-value":',JSON.stringify({name:'private-value'.repeat(100000)})]){await writeFile(join(root,'secret.json'),content);const out=await call(['run',join(root,'b.json'),'--secrets-file',join(root,'secret.json'),'--diagnostics','stderr']);assert.equal(out.code,2);assert.equal(out.stdout,'');assert(!out.stderr.includes('private-value'));}
 const directory=await call(['run',join(root,'b.json'),'--secrets-file',root]);assert.equal(directory.code,2);
});
test('optional screenshot skip/error is skipped; required policy skip and collector errors are distinct',async()=>{
 const b=structuredClone(original);b.flow.nodes=[{id:'start',type:'start'},{id:'shot',type:'action',action:'screenshot',params:{}},{id:'end',type:'end'}];b.flow.edges=[{from:'start',to:'shot'},{from:'shot',to:'end'}];
 for(const required of [false,true])for(const mode of ['skip','error']){
  b.flow.nodes[1].params.required=required;const events=[],root=await mkdtemp(join(tmpdir(),'aqa-evidence-policy-'));let closed=false;
  const adapter={getCapabilities:()=>({platforms:['web'],supportedActions:['screenshot']}),startSession:async()=>{},captureEvidence:async()=>{if(mode==='error')throw new Error('private raw evidence');return false;},endSession:async()=>{closed=true;}};
  const out=await executeBlueprint(b,{adapter,reportDir:root,onEvent:e=>events.push(e)});assert.equal(out.result.outcome,required?(mode==='skip'?'blocked':'infra_error'):'passed');assert.equal(events.find(e=>e.type==='step.finished'&&e.nodeId==='shot').outcome,required?out.result.outcome:'skipped');assert.equal(out.result.artifacts.length,0);assert(closed);assert(!JSON.stringify(events).includes('private raw evidence'));validateSchema(out.result);
 }
});
test('late custom evidence cannot replace settled bytes or mutate terminal result',async()=>{
 const b=structuredClone(original);b.flow.nodes=[{id:'start',type:'start'},{id:'shot',type:'action',action:'screenshot',params:{required:true},timeoutMs:30},{id:'end',type:'end'}];b.flow.edges=[{from:'start',to:'shot'},{from:'shot',to:'end'}];
 const png=color=>{const image=new PNG({width:1,height:1});image.data.set([color,0,0,255]);return PNG.sync.write(image);},first=png(200),second=png(20),paths=[],signals=[];let calls=0,late;
 const adapter={getCapabilities:()=>({platforms:['web'],supportedActions:['screenshot']}),startSession:async()=>{},endSession:async()=>{},captureEvidence:async(path,options)=>{paths.push(path);signals.push(options.signal);const n=++calls;if(n===1){late=new Promise(r=>setTimeout(r,200));await late;}await writeFile(path,n===1?first:second);return true;}};
 const out=await executeBlueprint(b,{adapter,reportDir:await mkdtemp(join(tmpdir(),'aqa-late-evidence-'))});assert.equal(out.result.outcome,'failed');assert.equal(out.result.failure.code,'TIMEOUT');assert.equal(out.result.artifacts.length,1);assert.equal(new Set(paths).size,2);assert(signals[0].aborted);assert(Object.isFrozen(out.result.artifacts));
 const settled=JSON.stringify(out.result);await late;await new Promise(r=>setTimeout(r,50));assert.equal(JSON.stringify(out.result),settled);assert.equal(JSON.stringify(JSON.parse(await readFile(join(out.reportDir,'result.json'),'utf8'))),settled);
 const artifact=out.result.artifacts[0],bytes=await readFile(join(out.reportDir,artifact.path));assert.deepEqual(bytes,second);assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);
 const events=(await readFile(join(out.reportDir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(events.at(-1).artifacts,out.result.artifacts);
});
