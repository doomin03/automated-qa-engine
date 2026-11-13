import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {executeBlueprint,compileBlueprint,parseSource,blueprintXml,listPresets,expandPreset,validateSchema} from '../packages/core/index.mjs';
import {PlaywrightAdapter} from '../runners/playwright/adapter.mjs';
import {comparePng} from '../packages/core/images.mjs';
import {prepareReferences,inspectPng,readBounded} from '../packages/core/resources.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
async function setup(t) {
  const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(`<style>body{margin:0;background:white} input{position:absolute;box-sizing:border-box;left:20px;top:${req.url.includes('offscreen')?'900':'20'}px;width:120px;height:30px;font-size:16px} #box{position:absolute;left:160px;top:20px;width:40px;height:30px;background:${req.url.includes('changed')?'red':'blue'}} #screen{position:absolute;top:90px}</style><input id="input" ${req.url.includes('blur')?'onfocus="this.blur()"':''}><div id="box"></div><div id="screen">${req.url.includes('second')?'Second':'First'}</div>${req.url.includes('overlay')?'<div style="position:absolute;inset:0;background:#ddd"></div>':''}`);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const origin='http://127.0.0.1:'+server.address().port,root=await mkdtemp(join(tmpdir(),'aqa-design-'));
  const browser=await chromium.launch();const version=browser.version();const page=await browser.newPage({viewport:{width:400,height:200},deviceScaleFactor:1,locale:'en-US',colorScheme:'light'});
  await page.goto(origin);await page.screenshot({path:join(root,'baseline.png'),animations:'disabled',caret:'hide'});await browser.close();
  const profile={viewport:{width:400,height:200},dpr:1,browserVersion:version,os:process.platform,locale:'en-US',colorScheme:'light',fonts:[],readiness:{selector:'input',timeoutMs:1000}};
  const target={schemaVersion:'qa.target/v1',id:'target',platform:'web',environment:'local',allowedOrigins:[origin],launchTargets:{first:origin,second:origin+'/second'},profile};
  const selectors={schemaVersion:'qa.selectors/v1',id:'selectors',selectors:Object.fromEntries(['input','box','screen'].map(k=>[k,{web:{strategy:'css',value:'#'+k}}]))};
  const reference={schemaVersion:'qa.designReference/v1',id:'design',profile,images:[{id:'screen',path:'baseline.png',sha256:digest(await readFile(join(root,'baseline.png'))),region:'viewport',threshold:{channelTolerance:0,maxDiffRatio:0}}],measurementRules:[{id:'width',selectorId:'input',metric:'bbox.width',expected:120,tolerance:0,source:{document:'manual-layout.json',sha256:'a'.repeat(64)}}]};
  const blueprint=actions=>{const nodes=[{id:'start',type:'start'},{id:'open',type:'action',action:'launch',params:{target:'first'}},...actions.map(([action,params],i)=>({id:'check'+i,type:action.startsWith('assert')?'assertion':'action',action,params})),{id:'end',type:'end'}];return {schemaVersion:'qa.blueprint/v1',id:'design-test',target:structuredClone(target),selectors:structuredClone(selectors),references:[structuredClone(reference)],flow:{schemaVersion:'qa.flow/v1',id:'flow',entryNode:'start',nodes,edges:nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}))}};};
  const run=async(b,options={})=>executeBlueprint(b,{adapter:new PlaywrightAdapter(),referenceRoot:root,reportDir:root,...options});
  const reports=async out=>Promise.all(out.result.artifacts.filter(a=>a.type==='check-report').map(async a=>validateSchema(JSON.parse(await readFile(join(out.reportDir,a.path),'utf8')))));
  return {root,origin,profile,target,selectors,reference,blueprint,run,reports};
}
test('design contract XML roundtrip and strict selector/profile/reference rejection',async t=>{
  const e=await setup(t),b=e.blueprint([['assertImage',{reference:'design',image:'screen'}],['assertLayout',{reference:'design',rule:'width'}]]);
  assert.equal(compileBlueprint(b).blueprintSnapshotHash,compileBlueprint(parseSource(blueprintXml(b),'xml')).blueprintSnapshotHash);
  for(const mutate of [x=>x.target.profile.unknown=true,x=>x.references[0].measurementRules[0].metric='color',x=>x.references[0].measurementRules[0].selectorId='missing',x=>x.target.profile.dpr=2,x=>x.flow.nodes[2].params.image='missing']){const bad=structuredClone(b);mutate(bad);assert.throws(()=>compileBlueprint(bad));}
});
test('real PNG PASS and deliberate FAIL preserve report hashes and three roles',async t=>{
  const e=await setup(t),b=e.blueprint([['assertImage',{reference:'design',image:'screen'}]]);
  for(const [url,expected] of [[e.origin,'passed'],[e.origin+'/changed','failed']]) {
    b.target.launchTargets.first=url;const out=await e.run(b);assert.equal(out.result.outcome,expected);
    const [report]=await e.reports(out);assert.equal(report.verdict,expected);assert.equal(report.artifactRefs.length,3);
    for(const a of out.result.artifacts)assert.equal(digest(await readFile(join(out.reportDir,a.path))),a.sha256);
    const events=(await readFile(join(out.reportDir,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(events.at(-1).outcome,expected);
  }
});
test('layout bbox/gap/font CSS pixels PASS/FAIL and negative gap',async t=>{
  const e=await setup(t),b=e.blueprint([['assertLayout',{reference:'design',rule:'width'}]]);
  for(const [metric,expected,otherSelectorId] of [['bbox.x',20],['bbox.y',20],['bbox.height',30],['font-size',16],['gap.horizontal',20,'box'],['gap.vertical',-30,'box']]) {
    Object.assign(b.references[0].measurementRules[0],{metric,expected,...(otherSelectorId?{otherSelectorId}:{})});const out=await e.run(b);assert.equal(out.result.outcome,'passed',metric);assert.equal((await e.reports(out))[0].actual,expected);
  }
  b.references[0].measurementRules[0].expected=123;assert.equal((await e.run(b)).result.outcome,'failed');
});
test('UX preset observes overlay/offscreen and focus before fill; normal input passes',async t=>{
  const e=await setup(t);assert.equal(listPresets().length,2);
  for(const [suffix,outcome,reason] of [['','passed','MATCH'],['/overlay','failed','HIT_TARGET_BLOCKED'],['/offscreen','failed','OUTSIDE_VIEWPORT'],['/blur','failed','NOT_FOCUSED']]) {
    const b=expandPreset('web-input','1.0.0',{id:'user-input',target:{...e.target,launchTargets:{first:e.origin+suffix}},selectors:e.selectors,launch:'first',selector:'input',value:'my arbitrary input'});
    const out=await e.run(b);assert.equal(out.result.outcome,outcome,suffix);assert.equal((await e.reports(out)).at(-1).reason,reason);
    if(outcome==='failed')assert(out.result.unvisitedNodes.includes('check6'));
  }
  assert.throws(()=>expandPreset('web-input','1.0.0',{}));
});
test('web history preset verifies actual previous URL and expected screen',async t=>{
  const e=await setup(t);const b=expandPreset('web-history-back','1.0.0',{id:'history',target:e.target,selectors:e.selectors,from:'first',to:'second',expectedUrl:e.origin+'/',expectedSelector:'screen'});
  assert.equal((await e.run(b)).result.outcome,'passed');b.flow.nodes.find(n=>n.action==='assertUrl').params.expected=e.origin+'/wrong';assert.equal((await e.run(b)).result.outcome,'failed');
  const none=e.blueprint([['browserBack',{}]]);assert.equal((await e.run(none)).result.outcome,'blocked');
});
test('SPA history back observes popstate with changed or identical URL and state',async t=>{
  const e=await setup(t);
  for(const changedUrl of [true,false]) {
    const b=e.blueprint([['browserBack',{}],['assertUrl',{expected:e.origin+'/'}]]),adapter=new PlaywrightAdapter();
    const out=await e.run(b,{adapter,onEvent:async event=>{if(event.type==='step.started'&&event.nodeId==='check0')await adapter.page.evaluate(changed=>{history.replaceState({screen:1},'');history.pushState({screen:2},'',changed?'/spa':location.href);},changedUrl);}});
    assert.equal(out.result.outcome,'passed');
  }
});
test('profile mismatch and image dimensions are blocked rather than passed',async t=>{
  const e=await setup(t),b=e.blueprint([['assertImage',{reference:'design',image:'screen'}]]);
  b.target.profile.browserVersion='unavailable';b.references[0].profile.browserVersion='unavailable';let out=await e.run(b);assert.equal(out.result.outcome,'blocked');assert.equal((await e.reports(out))[0].reason,'PROFILE_MISMATCH');
  b.target.profile.browserVersion=e.profile.browserVersion;b.references[0].profile.browserVersion=e.profile.browserVersion;
  const bytes=PNG.sync.write(new PNG({width:1,height:1}));await writeFile(join(e.root,'baseline.png'),bytes);b.references[0].images[0].sha256=digest(bytes);
  out=await e.run(b);assert.equal(out.result.outcome,'blocked');assert.equal((await e.reports(out))[0].reason,'IMAGE_SIZE_MISMATCH');
});
test('bounded resources reject hashes, traversal, symlink and oversized documents',async t=>{
  const e=await setup(t),b=e.blueprint([]);b.references[0].images[0].sha256='0'.repeat(64);await assert.rejects(prepareReferences(b,e.root));
  b.references[0].images[0].path='../outside.png';await assert.rejects(prepareReferences(b,e.root));
  const outside=await mkdtemp(join(tmpdir(),'aqa-outside-'));await writeFile(join(outside,'image.png'),await readFile(join(e.root,'baseline.png')));
  await symlink(outside,join(e.root,'linked'),'junction');b.references[0].images[0].path='linked/image.png';await assert.rejects(prepareReferences(b,e.root),x=>x.code==='POLICY_DENIED');
  await writeFile(join(e.root,'large.json'),Buffer.alloc(1024*1024+1));await assert.rejects(readBounded(join(e.root,'large.json')));
  const corrupt=await readFile(join(e.root,'baseline.png'));corrupt[20]^=1;assert.throws(()=>inspectPng(corrupt));
});
test('image worker threshold boundaries, size mismatch and cancellation are bounded',async()=>{
  const p=new PNG({width:2,height:2});p.data.fill(255);const base=PNG.sync.write(p);p.data[0]=245;const changed=PNG.sync.write(p);
  assert.equal((await comparePng(base,changed,{channelTolerance:10})).changedPixels,0);
  assert.equal((await comparePng(base,changed,{channelTolerance:9})).changedPixels,1);
  assert.equal((await comparePng(base,PNG.sync.write(new PNG({width:1,height:1})),{channelTolerance:0})).blocked,'IMAGE_SIZE_MISMATCH');
  await assert.rejects(comparePng(base,changed,{channelTolerance:0,signal:AbortSignal.abort()}),e=>e.code==='CANCELLED');
  await assert.rejects(comparePng(base,changed,{channelTolerance:0,timeoutMs:1}),e=>e.code==='TIMEOUT');
});
test('secret preset roundtrip and execution never serialize resolved input',async t=>{
  const e=await setup(t),secret='resolved-private-input';
  const b=expandPreset('web-input','1.0.0',{id:'secret',target:e.target,selectors:e.selectors,launch:'first',selector:'input',value:{secretRef:'private.name'}});
  assert.deepEqual(parseSource(blueprintXml(b),'xml'),b);const out=await e.run(b,{secretResolver:()=>secret});assert.equal(out.result.outcome,'passed');
  assert(out.result.artifacts.every(a=>a.type==='check-report'));
  for(const name of ['blueprint.json','plan.json','result.json','events.jsonl',...out.result.artifacts.map(a=>a.path)])assert(!(await readFile(join(out.reportDir,name),'utf8')).includes(secret));
});
test('missing fonts block without automatic injection; explicit invalid injection blocks',async t=>{
  const e=await setup(t),bytes=Buffer.from('invalid font bytes');await writeFile(join(e.root,'font.woff'),bytes);
  for(const injectFonts of [false,true]){
    const b=e.blueprint([['assertImage',{reference:'design',image:'screen'}]]);
    b.target.profile.fonts=[{family:'MissingFont',path:'font.woff',sha256:digest(bytes)}];b.target.profile.injectFonts=injectFonts;b.references[0].profile=structuredClone(b.target.profile);
    const out=await e.run(b);assert.equal(out.result.outcome,'blocked');const [report]=await e.reports(out);assert.equal(report.reason,'FONT_UNAVAILABLE');assert.equal(report.fontsInjected,injectFonts);
  }
});
test('DPR crop uses independently rounded CSS boundaries and exact raster dimensions',async t=>{
  const e=await setup(t),b=e.blueprint([['assertImage',{reference:'design',image:'screen'}]]);
  b.target.profile.dpr=2;b.references[0].profile.dpr=2;
  const browser=await chromium.launch(),page=await browser.newPage({viewport:e.profile.viewport,deviceScaleFactor:2,locale:'en-US'});await page.goto(e.origin);
  const source=PNG.sync.read(await page.screenshot({animations:'disabled',caret:'hide'}));await browser.close();
  const crop=new PNG({width:79,height:59});PNG.bitblt(source,crop,321,41,79,59,0,0);const bytes=PNG.sync.write(crop);await writeFile(join(e.root,'baseline.png'),bytes);
  Object.assign(b.references[0].images[0],{sha256:digest(bytes),region:{x:160.5,y:20.5,width:39.5,height:29.5}});
  const out=await e.run(b);assert.equal(out.result.outcome,'passed');assert.equal((await e.reports(out))[0].actual.comparedPixels,79*59);
});
test('visual observer failure and cancellation retain terminal results and close browser',async t=>{
  const e=await setup(t),b=e.blueprint([['assertImage',{reference:'design',image:'screen'}]]);
  for(const mode of ['observer','cancel']){
    const adapter=new PlaywrightAdapter(),controller=new AbortController();
    const out=await e.run(b,{adapter,signal:controller.signal,onEvent:event=>{if(event.type==='step.finished'&&event.nodeId==='check0'){if(mode==='observer')throw new Error('private observer');controller.abort();}}});
    assert.equal(out.result.outcome,mode==='observer'?'infra_error':'cancelled');assert.equal(adapter.browser.isConnected(),false);
    assert.equal((await e.reports(out))[0].verdict,'passed');const events=await readFile(join(out.reportDir,'events.jsonl'),'utf8');assert(!events.includes('private observer'));assert.equal(JSON.parse(events.trim().split('\n').at(-1)).type,'run.finished');
  }
  const controller=new AbortController(),p=new PNG({width:200,height:200});p.data.fill(255);const bytes=PNG.sync.write(p),pending=comparePng(bytes,bytes,{channelTolerance:0,signal:controller.signal});controller.abort();await assert.rejects(pending,e=>e.code==='CANCELLED');
});
test('visual terminal observer failure keeps completed reports and unresolved observer is bounded',async t=>{
  const e=await setup(t),b=e.blueprint([['assertImage',{reference:'design',image:'screen'}]]);
  let runId;const adapter=new PlaywrightAdapter();
  await assert.rejects(e.run(b,{adapter,onEvent:event=>{runId=event.runId;if(event.type==='run.finished')throw new Error('private-terminal');}}),error=>error.code==='ENGINE_ERROR');
  const dir=join(e.root,runId),result=JSON.parse(await readFile(join(dir,'result.json'),'utf8'));assert.equal(result.outcome,'passed');assert(result.artifacts.some(a=>a.type==='check-report'));assert.equal(adapter.browser.isConnected(),false);
  const hanging=new PlaywrightAdapter();const out=await e.run(b,{adapter:hanging,timeoutMs:3000,onEvent:event=>event.type==='step.finished'&&event.nodeId==='check0'?new Promise(()=>{}):undefined});assert.equal(out.result.outcome,'failed');assert.equal(out.result.failure.code,'TIMEOUT');assert.equal(out.result.failure.phase,'run');assert.equal(hanging.browser.isConnected(),false);assert.equal((await e.reports(out))[0].verdict,'passed');
});
test('new check failure bounds hanging evidence and readiness timeout closes browser',async t=>{
  const e=await setup(t),b=e.blueprint([['assertLayout',{reference:'design',rule:'width'}]]);b.references[0].measurementRules[0].expected=999;
  const adapter=new PlaywrightAdapter();adapter.captureEvidence=()=>new Promise(()=>{});const out=await e.run(b,{adapter});assert.equal(out.result.outcome,'failed');assert.equal(out.result.cleanupErrors[0].code,'EVIDENCE_ERROR');assert.equal(adapter.browser.isConnected(),false);
  b.selectors.selectors.input.web.value='#absent';b.target.profile.readiness.timeoutMs=100;b.references[0].profile.readiness.timeoutMs=100;
  const timed=new PlaywrightAdapter();const bad=await e.run(b,{adapter:timed});assert.equal(bad.result.outcome,'failed');assert.equal(timed.browser.isConnected(),false);
});
test('PNG inflated dimensions are rejected before decoding and iframe/canvas are blocked',async t=>{
  const e=await setup(t),bytes=await readFile(join(e.root,'baseline.png'));bytes.writeUInt32BE(100000,16);bytes.writeUInt32BE(100000,20);
  let crc=0xffffffff;for(const byte of bytes.subarray(12,29)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
  assert.throws(()=>inspectPng(bytes),error=>error.message.includes('pixel limit'));
  const b=e.blueprint([['assertHitTarget',{selector:'box'}]]),adapter=new PlaywrightAdapter();
  const out=await e.run(b,{adapter,onEvent:async event=>{if(event.type==='step.started'&&event.nodeId==='check0')await adapter.page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.id='box';document.querySelector('#box').replaceWith(canvas);});}});assert.equal(out.result.outcome,'blocked');assert.equal((await e.reports(out))[0].reason,'UNSUPPORTED_ELEMENT');
});
