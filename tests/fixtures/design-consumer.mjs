import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {executeBlueprint,compileBlueprint,parseSource,blueprintXml,expandPreset,listPresets,validateSchema,ENGINE_VERSION} from 'automated-qa-engine';
import {PlaywrightAdapter} from 'automated-qa-engine/playwright';
import {AppiumAdapter} from 'automated-qa-engine/appium';
const sha=b=>createHash('sha256').update(b).digest('hex'),root=resolve('design-resources');await mkdir(root,{recursive:true});
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<style>body{margin:0}input{position:absolute;left:20px;top:20px;box-sizing:border-box;width:120px;height:30px}#box{position:absolute;left:160px;top:20px;width:40px;height:30px;background:${req.url.includes('changed')?'red':'blue'}}</style><input id="input" ${req.url.includes('blur')?'onfocus="this.blur()"':''}><div id="box"></div>${req.url.includes('overlay')?'<div style="position:absolute;inset:0;background:white"></div>':''}`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:400,height:200},locale:'en-US'});await page.goto(origin);const baseline=await page.screenshot({caret:'hide'}),browserVersion=browser.version();await browser.close();await writeFile(join(root,'baseline.png'),baseline);
const profile={viewport:{width:400,height:200},dpr:1,browserVersion,os:process.platform,locale:'en-US',colorScheme:'light',fonts:[],readiness:{selector:'input',timeoutMs:1000}};
const target={schemaVersion:'qa.target/v1',id:'web',platform:'web',environment:'local',allowedOrigins:[origin],launchTargets:{first:origin,second:origin+'/second'},profile};
const selectors={schemaVersion:'qa.selectors/v1',id:'selectors',selectors:{input:{web:{strategy:'css',value:'#input'}}}};
const reference={schemaVersion:'qa.designReference/v1',id:'design',profile,images:[{id:'screen',path:'baseline.png',sha256:sha(baseline),region:'viewport',threshold:{channelTolerance:0,maxDiffRatio:0}}],measurementRules:[{id:'width',selectorId:'input',metric:'bbox.width',expected:120,tolerance:0,source:{document:'explicit-layout.json',sha256:'a'.repeat(64)}}]};
const blueprint=action=>{const nodes=[{id:'start',type:'start'},{id:'open',type:'action',action:'launch',params:{target:'first'}},{id:'check',type:'assertion',action,params:action==='assertImage'?{reference:'design',image:'screen'}:{reference:'design',rule:'width'}},{id:'end',type:'end'}];return {schemaVersion:'qa.blueprint/v1',id:'installed-design',target:structuredClone(target),selectors:structuredClone(selectors),references:[structuredClone(reference)],flow:{schemaVersion:'qa.flow/v1',id:'flow',entryNode:'start',nodes,edges:nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}))}};};
const cli=resolve('node_modules/automated-qa-engine/packages/cli/aqa.mjs');
const call=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,...args],{windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));});
const runs=[];
async function verify(dir,outcome,transport,kind) {
  const result=validateSchema(JSON.parse(await readFile(join(dir,'result.json'),'utf8')));assert.equal(result.outcome,outcome);
  const events=(await readFile(join(dir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);events.forEach((e,i)=>{validateSchema(e);assert.equal(e.sequence,i+1);assert.equal(e.runId,result.runId);});assert.equal(events.at(-1).outcome,outcome);
  const reports=[];for(const a of result.artifacts){const bytes=await readFile(join(dir,a.path));assert.equal(sha(bytes),a.sha256);assert.equal(bytes.length,a.size);if(a.type==='check-report')reports.push(validateSchema(JSON.parse(bytes)));}
  if(kind)assert(reports.some(r=>r.kind===kind));runs.push({transport,outcome,kind,reportDir:dir,runId:result.runId,checkReports:reports});
}
try {
  assert.match((await call(['--help'])).stdout,/Usage: aqa/);assert.equal(JSON.parse((await call(['--help','--json'])).stdout).name,'aqa');
  assert.deepEqual(JSON.parse((await call(['preset','list'])).stdout),listPresets());
  for(const [kind,outcome] of [['image','passed'],['image','failed'],['image','blocked'],['layout','passed'],['layout','failed']]) {
    const b=blueprint(kind==='image'?'assertImage':'assertLayout');
    if(outcome==='failed'&&kind==='image')b.target.launchTargets.first=origin+'/changed';
    if(outcome==='failed'&&kind==='layout')b.references[0].measurementRules[0].expected=900;
    if(outcome==='blocked'){b.target.profile.browserVersion='other-build';b.references[0].profile.browserVersion='other-build';}
    assert.equal(compileBlueprint(b).blueprintSnapshotHash,compileBlueprint(parseSource(blueprintXml(b),'xml')).blueprintSnapshotHash);
    const out=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),referenceRoot:root,reportDir:'reports'});await verify(out.reportDir,outcome,'installed-api',kind);
  }
  for(const [suffix,outcome] of [['','passed'],['/overlay','failed'],['/blur','failed']]) {
    const b=expandPreset('web-input','1.0.0',{id:'preset',target:{...target,launchTargets:{first:origin+suffix}},selectors,launch:'first',selector:'input',value:'external user input'});
    const out=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),reportDir:'reports'});await verify(out.reportDir,outcome,'installed-preset','ux');
  }
  const b=blueprint('assertImage');await writeFile('design.xml',blueprintXml(b));const cliRun=await call(['run','design.xml','--reference-root',root,'--json','--diagnostics','stderr','--report','reports']);assert.equal(cliRun.code,0,cliRun.stdout);assert.equal(cliRun.stderr,'');const terminal=JSON.parse(cliRun.stdout.trim().split('\n').at(-1));await verify(resolve('reports',terminal.runId),'passed','installed-cli-xml','image');
  const controller=new AbortController();const cancelled=await executeBlueprint(b,{adapter:new PlaywrightAdapter(),referenceRoot:root,reportDir:'reports',signal:controller.signal,onEvent:e=>{if(e.type==='step.finished'&&e.nodeId==='check')controller.abort();}});await verify(cancelled.reportDir,'cancelled','installed-api-cancel','image');
  // A protocol fixture validates the installed adapter and CLI, not a physical device.
  let deletes=0;const nativeServer=createServer((req,res)=>{res.setHeader('content-type','application/json');let value=null;if(req.url==='/session')value={sessionId:'protocol',capabilities:{}};else if(req.url.endsWith('/elements'))value=[{'element-6066-11e4-a52e-4f735466cecf':'input'}];else if(req.url.endsWith('/displayed'))value=true;else if(req.url.endsWith('/attribute/text'))value='native user';else if(req.url.endsWith('/screenshot'))value=baseline.toString('base64');if(req.method==='DELETE')deletes++;res.end(JSON.stringify({value}));});
  await new Promise(r=>nativeServer.listen(0,'127.0.0.1',r));
  try {
    const config={endpoint:'http://127.0.0.1:'+nativeServer.address().port,capabilities:{'appium:automationName':'UiAutomator2','appium:udid':'protocol-only','appium:deviceName':'fake-protocol'}};
    await writeFile('appium-config.json',JSON.stringify(config));const diagnostics=await call(['devices','--target','android','--appium-config','appium-config.json']);assert.equal(diagnostics.code,0);const capabilities=validateSchema(JSON.parse(diagnostics.stdout));assert.equal(capabilities.diagnostics.nativeConfigured,true);assert.equal(capabilities.diagnostics.connectionVerified,false);assert.deepEqual(capabilities.targets,[]);
    const nodes=[{id:'start',type:'start'},{id:'open',type:'action',action:'launch',params:{target:'app'}},{id:'input',type:'action',action:'input',params:{selector:'name',value:'native user'}},{id:'check',type:'assertion',action:'assertValue',params:{selector:'name',expected:'native user'}},{id:'end',type:'end'}];
    const native={schemaVersion:'qa.blueprint/v1',id:'native',target:{schemaVersion:'qa.target/v1',id:'phone',platform:'android',environment:'test',launchTargets:{app:'org.example.demo'}},selectors:{schemaVersion:'qa.selectors/v1',id:'native-selectors',selectors:{name:{android:{strategy:'accessibilityId',value:'name'}}}},flow:{schemaVersion:'qa.flow/v1',id:'native-flow',entryNode:'start',nodes,edges:nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}))}};
    for(const outcome of ['passed','failed']){native.flow.nodes[3].params.expected=outcome==='passed'?'native user':'wrong';const out=await executeBlueprint(native,{adapter:new AppiumAdapter(config),reportDir:'reports'});await verify(out.reportDir,outcome,'installed-appium-protocol');}
    native.flow.nodes[3].params.expected='native user';await writeFile('native.xml',blueprintXml(native));await writeFile('appium-config.json',JSON.stringify(config));const out=await call(['run','native.xml','--appium-config','appium-config.json','--json','--report','reports']);assert.equal(out.code,0,out.stdout);const t=JSON.parse(out.stdout.trim().split('\n').at(-1));await verify(resolve('reports',t.runId),'passed','installed-native-cli-protocol');assert.equal(deletes,3);
  } finally {await new Promise(r=>nativeServer.close(r));}
  const report={engineVersion:ENGINE_VERSION,packageImport:import.meta.resolve('automated-qa-engine'),mobileDeviceVerified:false,runs,presets:listPresets().map(p=>({id:p.id,version:p.version,sha256:p.sha256}))};await writeFile('design-consumer-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await new Promise(r=>server.close(r));}
