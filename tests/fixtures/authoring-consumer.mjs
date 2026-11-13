import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {authoringXml,parseAuthoringSource,expandAuthoring,executeBlueprint,validateSchema,compileBlueprint} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';
const root=resolve('authoring-resources');await mkdir(root,{recursive:true});
const value='PUBLIC_CAPTURE_725091';
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<input id="source" value="${value}"><input id="destination"><div id="label">${value}</div>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const nodes=[{id:'start',type:'start'},{id:'open',type:'action',action:'launch',params:{target:'first'}},{id:'repeat',type:'repeat',count:3,steps:[{id:'capture',type:'action',action:'captureValue',params:{selector:'source',variable:'captured'}},{id:'input',type:'action',action:'input',params:{selector:'destination',valueRef:'captured'}},{id:'check',type:'assertion',action:'assertValue',params:{selector:'destination',expectedRef:'captured'}}]},{id:'text',type:'action',action:'captureText',params:{selector:'label',variable:'captured'}},{id:'end',type:'end'}];
const authoring={schemaVersion:'qa.authoring/v1',blueprint:{schemaVersion:'qa.blueprint/v1',id:'installed-authoring',target:{schemaVersion:'qa.target/v1',id:'web',platform:'web',environment:'local',allowedOrigins:[origin],launchTargets:{first:origin}},selectors:{schemaVersion:'qa.selectors/v1',id:'selectors',selectors:Object.fromEntries(['source','destination','label'].map(id=>[id,{web:{strategy:'css',value:'#'+id}}]))},flow:{schemaVersion:'qa.flow/v1',id:'flow',entryNode:'start',variables:{captured:{from:'capture',public:true}},nodes,edges:nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}))}}};
const cli=resolve('node_modules/automated-qa-engine/packages/cli/aqa.mjs'),runs=[];
const call=args=>new Promise((done,reject)=>{const child=spawn(process.execPath,[cli,...args],{windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',code=>done({code,stdout,stderr}));});
async function verify(dir,outcome,transport){
 const result=validateSchema(JSON.parse(await readFile(join(dir,'result.json'),'utf8')));assert.equal(result.outcome,outcome);
 const text=await readFile(join(dir,'events.jsonl'),'utf8'),events=text.trim().split('\n').map(JSON.parse);events.forEach((e,i)=>{validateSchema(e);assert.equal(e.runId,result.runId);assert.equal(e.sequence,i+1);});assert.equal(events.at(-1).outcome,outcome);
 for(const name of ['blueprint.json','plan.json','result.json','events.jsonl'])assert(!(await readFile(join(dir,name),'utf8')).includes(value));
 for(const a of result.artifacts){const bytes=await readFile(join(dir,a.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);}
 runs.push({transport,outcome,reportDir:dir,runId:result.runId,visited:result.visitedNodes.length});
}
try{
 validateSchema(authoring);const xml=authoringXml(authoring),expanded=expandAuthoring(parseAuthoringSource(xml,'xml'));validateSchema(expanded.sourceMap);assert(Object.isFrozen(expanded.sourceMap));assert.equal(new Set(expanded.blueprint.flow.nodes.map(n=>n.id)).size,13);assert.equal(expanded.sourceMap.nodes.filter(n=>n.iteration).length,9);
 let out=await executeBlueprint(expanded.blueprint,{adapter:new PlaywrightAdapter(),reportDir:root});await verify(out.reportDir,'passed','api');
 const failing=structuredClone(authoring);failing.blueprint.flow.nodes[2].steps[2].params={selector:'destination',expected:'intentionally-wrong'};
 out=await executeBlueprint(expandAuthoring(failing).blueprint,{adapter:new PlaywrightAdapter(),reportDir:root});await verify(out.reportDir,'failed','api');
 for(const [name,document,outcome,exit] of [['pass',authoring,'passed',0],['fail',failing,'failed',1]]){
  const source=join(root,name+'.authoring.xml'),dest=join(root,name+'.xml');await writeFile(source,authoringXml(document));
  const expansion=await call(['expand',source,'--out',dest,'--document-root',root]);assert.equal(expansion.code,0,expansion.stdout+expansion.stderr);const paths=JSON.parse(expansion.stdout);assert.deepEqual(await readFile(paths.source),await readFile(source));const map=validateSchema(JSON.parse(await readFile(paths.sourceMap,'utf8')));assert.equal(map.blueprintSnapshotHash,compileBlueprint(expandAuthoring(document).blueprint).blueprintSnapshotHash);
  const run=await call(['run',dest,'--document-root',root,'--report',root,'--json','--diagnostics','stderr']);assert.equal(run.code,exit,run.stderr);const terminal=run.stdout.trim().split('\n').map(JSON.parse).at(-1);await verify(join(root,terminal.runId),outcome,'cli');
 }
 const screenshot=structuredClone(expanded.blueprint);screenshot.flow.variables={secret:{from:'secret',ref:'private'}};screenshot.flow.nodes=[{id:'start',type:'start'},nodes[1],{id:'shot',type:'action',action:'screenshot',params:{}},{id:'end',type:'end'}];screenshot.flow.edges=screenshot.flow.nodes.slice(1).map((n,i)=>({from:screenshot.flow.nodes[i].id,to:n.id}));
 for(const required of [false,true]){screenshot.flow.nodes[2].params.required=required;const events=[];out=await executeBlueprint(screenshot,{adapter:new PlaywrightAdapter(),reportDir:root,secretResolver:()=> 'SECRET_NOT_RECORDED',onEvent:e=>events.push(e)});await verify(out.reportDir,required?'blocked':'passed','api-secret-screenshot');assert.equal(events.find(e=>e.type==='step.finished'&&e.nodeId==='shot').outcome,required?'blocked':'skipped');assert.equal(out.result.artifacts.length,0);}
 console.log(JSON.stringify({status:'passed',sourceMapNodes:expanded.sourceMap.nodes.length,runs}));
}finally{await new Promise(r=>server.close(r));}
