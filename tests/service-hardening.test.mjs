import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,readdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {PNG} from 'pngjs';
import {executeBlueprint,validateSchema,QaError} from '../packages/core/index.mjs';
import {PlaywrightAdapter} from '../runners/playwright/adapter.mjs';
import {parseCliArgs} from '../packages/cli/args.mjs';
import {saveObservation} from '../packages/core/observations.mjs';
const original=JSON.parse(await readFile('examples/login.qa.json','utf8'));
const temporary=()=>mkdtemp(join(tmpdir(),'aqa-service-'));
function flow(count,action){const b=structuredClone(original);b.flow.nodes=Array.from({length:count},(_,i)=>({id:'n'+i,...(i===0?{type:'start'}:i===count-1?{type:'end'}:{type:'action',action:action||'screenshot',params:{}})}));b.flow.entryNode='n0';b.flow.edges=b.flow.nodes.slice(1).map((n,i)=>({from:'n'+i,to:n.id}));return b;}
const adapter=extra=>({getCapabilities:()=>({platforms:['web'],supportedActions:['screenshot']}),startSession:async()=>{},endSession:async()=>{},captureEvidence:async()=>false,...extra});
async function durable(out){validateSchema(out.result);assert.deepEqual(JSON.parse(await readFile(join(out.reportDir,'result.json'),'utf8')),out.result);const events=(await readFile(join(out.reportDir,'events.jsonl'),'utf8')).trim().split('\n').map(s=>validateSchema(JSON.parse(s)));assert.equal(events.at(-1).type,'run.finished');assert.equal(events.at(-1).outcome,out.result.outcome);return events;}

test('CLI rejects unused positionals/options and mode conflicts before loading execution',()=>{
 for(const args of [['validate','f','extra'],['validate','f','--once'],['run','f','--headed','--headless'],['schema','--timeout','5'],['preset','list','extra'],['--version','--out','f']])assert.throws(()=>parseCliArgs(args),e=>e.code==='INVALID_ARGUMENT');
 for(const args of [['run','f','--json','--control-stdin'],['preset','expand','web-input','--bindings','f','--preset-version','1.0.0'],['--help','--json'],['agent','--config','f','--once']])assert(parseCliArgs(args));
});

test('1000-node completed and cancelled graphs always have representable durable results',async()=>{
 const b=flow(1000);
 for(const cancel of [false,true]){const controller=new AbortController();const out=await executeBlueprint(b,{adapter:adapter(),reportDir:await temporary(),signal:controller.signal,onEvent:e=>{if(cancel&&e.type==='step.finished'&&e.nodeId==='n300')controller.abort();}});assert.equal(out.result.outcome,cancel?'cancelled':'passed');assert.equal(out.result.visitedNodes.length+out.result.unvisitedNodes.length,1000);assert.equal(new Set([...out.result.visitedNodes,...out.result.unvisitedNodes]).size,1000);await durable(out);}
});

test('consumer-thrown TIMEOUT is delivery failure while an internal observer deadline is run timeout',async()=>{
 for(const internal of [false,true]){const out=await executeBlueprint(flow(2),{adapter:adapter(),timeoutMs:40,reportDir:await temporary(),onEvent:()=>{if(internal)return new Promise(()=>{});throw new QaError('TIMEOUT','private-consumer-message');}});assert.equal(out.result.failure.code,internal?'TIMEOUT':'ENGINE_ERROR');assert.equal(out.result.failure.phase,'run');assert.equal(out.result.outcome,internal?'failed':'infra_error');assert(!JSON.stringify(out.result).includes('private-consumer'));await durable(out);}
});

test('257th screenshot fails inside execution while keeping 256 immutable artifacts',async()=>{
 const image=new PNG({width:1,height:1}),bytes=PNG.sync.write(image);let captures=0;
 const out=await executeBlueprint(flow(260),{adapter:adapter({captureEvidence:async path=>{captures++;await writeFile(path,bytes);return true;}}),reportDir:await temporary()});
 assert.equal(out.result.outcome,'infra_error');assert.equal(out.result.failure.code,'ENGINE_ERROR');assert.equal(out.result.artifacts.length,256);assert.equal(captures,256);await durable(out);
});

test('deadline provenance preserves run expiry, shorter node budget, adapter errors and cancellation',async()=>{
 const late=await executeBlueprint(flow(2),{adapter:adapter(),reportDir:await temporary(),timeoutMs:25,onEvent:e=>{if(e.type==='step.started'){const until=performance.now()+35;while(performance.now()<until){}}}});
 assert.equal(late.result.failure.code,'TIMEOUT');assert.equal(late.result.failure.phase,'run');await durable(late);
 for(const mode of ['run','node','adapter','cancel']){
  const b=flow(3,'tap');b.flow.nodes[1].params={selector:'username'};b.flow.nodes[1].timeoutMs=mode==='node'?20:1000;const controller=new AbortController();
  const a=adapter({getCapabilities:()=>({platforms:['web'],supportedActions:['tap']}),performAction:async(node,ctx)=>{
   if(mode==='adapter')throw new QaError('TIMEOUT','Adapter-specific timeout','step');
   if(mode==='cancel')setTimeout(()=>controller.abort(),5);
   return new Promise((resolve,reject)=>ctx.signal.addEventListener('abort',()=>reject(new QaError('TIMEOUT','Adapter saw abort','step')),{once:true}));
  }});
  const out=await executeBlueprint(b,{adapter:a,reportDir:await temporary(),timeoutMs:100,signal:controller.signal});
  assert.equal(out.result.failure.code,mode==='cancel'?'CANCELLED':'TIMEOUT');assert.equal(out.result.failure.phase,['run','cancel'].includes(mode)?'run':'step');
  assert.equal(out.result.failure.nodeId,'n1');
  if(mode==='adapter')assert.equal(out.result.failure.message,'Adapter-specific timeout');await durable(out);
 }
});

test('many optional evidence errors retain bounded diagnostics and session cleanup uncertainty',async()=>{
 const out=await executeBlueprint(flow(1000),{adapter:adapter({captureEvidence:async()=>{throw Error('private-value');},endSession:async()=>{throw Error('private-close');}}),reportDir:await temporary()});
 assert.equal(out.result.outcome,'infra_error');assert.equal(out.result.cleanupErrors.length,256);assert(out.result.cleanupErrors.some(e=>e.code==='CLEANUP_ERROR'));assert(out.result.cleanupErrors.at(-1).message.includes('omitted'));assert(!JSON.stringify(out.result).includes('private-'));await durable(out);
});

test('multi-artifact observation reserves its full capacity before writing any bytes',async()=>{
 const root=await temporary(),artifacts=Array.from({length:254},()=>({}));
 await assert.rejects(saveObservation({images:[{},{},{}]},'node',root,artifacts,new AbortController().signal),e=>e.code==='ENGINE_ERROR');assert.equal(artifacts.length,254);assert.deepEqual(await readdir(root),[]);
});

test('real Chromium launch cancellation joins startup before confirming cleanup',async()=>{
 for(let attempt=0;attempt<3;attempt++){
  const b=flow(2),a=new PlaywrightAdapter(),c=new AbortController();
  const out=await executeBlueprint(b,{adapter:a,reportDir:await temporary(),signal:c.signal,onEvent:e=>{if(e.type==='run.started')setTimeout(()=>c.abort(),30);}});
  assert.equal(out.result.outcome,'cancelled');assert(a.started);assert.equal(out.result.cleanupErrors.length,0);assert(a.browser&&!a.browser.isConnected());await Promise.all([a.endSession(),a.endSession()]);await durable(out);
 }
});

test('real web delayed text/value assertions share deadline and preserve duplicate session ownership',async t=>{
 const server=createServer((req,res)=>{res.end('<div data-testid="status">Loading</div><input data-testid="value" value="Loading"><script>setTimeout(()=>{document.querySelector("div").textContent="Ready";document.querySelector("input").value="Ready"},350)</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port,b=structuredClone(original);b.target.allowedOrigins=[origin];b.target.launchTargets={login:origin};b.selectors.selectors.status={web:{strategy:'testId',value:'status'}};b.selectors.selectors.value={web:{strategy:'testId',value:'value'}};
 const a=new PlaywrightAdapter();t.after(()=>a.endSession());await a.startSession(b.target);const first=a.browser;await assert.rejects(a.startSession(b.target),e=>e.code==='SESSION_ERROR');assert.equal(a.browser,first);
 for(const [action,selector]of [['assertText','status'],['assertValue','value']]){await a.page.goto(origin);const start=performance.now();await a.evaluateAssertion({action,params:{selector,expected:'Ready'}},{blueprint:b,timeoutMs:1500,variables:{}});assert(performance.now()-start>=200);}
 const node={action:'assertText',params:{selector:'status',expected:'private-never'}};
 await assert.rejects(a.evaluateAssertion(node,{blueprint:b,timeoutMs:100,variables:{}}),e=>e.code==='ASSERTION_FAILED'&&!e.message.includes('private-never'));
 const c=new AbortController();setTimeout(()=>c.abort(),30);await assert.rejects(a.evaluateAssertion(node,{blueprint:b,timeoutMs:1500,variables:{},signal:c.signal}),e=>e.code==='CANCELLED');
 await a.endSession();assert(!first.isConnected());
});

test('actual CLI unread stdout and cancellation persist terminal and exit without external kill',async()=>{
 const b=flow(1000),root=await temporary(),file=join(root,'b.json');b.flow.variables={go:{from:'literal',value:true}};
 b.flow.nodes.slice(1,-1).forEach(n=>{n.type='branch';delete n.action;delete n.params;n.condition={variable:'go',operator:'equals',value:true};});
 b.flow.edges=[{from:'n0',to:'n1'},...b.flow.nodes.slice(1,-1).flatMap((n,i)=>[{from:n.id,to:'n'+(i+2),label:'true'},{from:n.id,to:'n999',label:'false'}])];await writeFile(file,JSON.stringify(b));
 for(const cancel of [false,true]) {
  const report=join(root,cancel?'cancel':'stalled');
  const child=spawn(process.execPath,[resolve('packages/cli/aqa.mjs'),'run',file,'--json','--control-stdin','--diagnostics','stderr','--timeout',cancel?'5000':'1500','--report',report],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let forced=false,stderr='',cancelled=false,inspecting=false,stopped=false;
  let lastSize=0,lastProgress=performance.now();
  child.stderr.on('data',bytes=>stderr+=bytes);
  child.stdin.on('error',()=>{});
  const pressure=setInterval(async()=>{
   if(!cancel||cancelled||inspecting||stopped)return;
   inspecting=true;
   try {
    const names=await readdir(report);
    if(!names.length)return;
    const dir=join(report,names[0]);
    const size=(await stat(join(dir,'events.jsonl'))).size;
    if(size!==lastSize){lastSize=size;lastProgress=performance.now();return;}
    // A 64KiB file alone does not prove saturation: the parent Readable and
    // Windows pipe can both buffer. Observe stopped durable progress instead.
    const resultExists=await stat(join(dir,'result.json')).then(()=>true,()=>false);
    if(!stopped&&!resultExists&&size>=65536&&performance.now()-lastProgress>=250){
     cancelled=true;
     child.stdin.write('{"type":"cancel"}\n');
    }
   }catch{}finally{inspecting=false;}
  },20);
  const kill=setTimeout(()=>{forced=true;child.kill();},12000);
  let code;
  try {code=await new Promise(r=>child.once('exit',r));}
  finally {stopped=true;clearTimeout(kill);clearInterval(pressure);child.stdout.destroy();}
  assert(!forced);
  if(cancel)assert(cancelled,'cancel follows at least 250ms of observed stalled output before a result exists');
  assert.equal(code,3,stderr);
  const dirs=await readdir(report),path=join(report,dirs[0]);
  const result=JSON.parse(await readFile(join(path,'result.json'),'utf8'));
  assert.equal(result.outcome,cancel?'cancelled':'failed');
  await durable({result,reportDir:path});
 }
});

test('unread diagnostic stderr has a finite delivery budget',async()=>{
 const source=`const {createOutput}=await import(${JSON.stringify(pathToFileURL(resolve('packages/cli/output.mjs')).href)});const output=createOutput();try{await output.stderr.text('x'.repeat(256*1024));}catch{process.exitCode=3;}finally{await output.close();}`;
 const child=spawn(process.execPath,['--input-type=module','-e',source],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.resume();let forced=false;const timer=setTimeout(()=>{forced=true;child.kill();},7000);const code=await new Promise(r=>child.on('close',r));clearTimeout(timer);assert(!forced);assert.equal(code,3);
});
