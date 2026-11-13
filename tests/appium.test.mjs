import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { AppiumAdapter } from '../runners/appium/adapter.mjs';
import { AppiumTransport } from '../runners/appium/transport.mjs';

const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOsAAAAASUVORK5CYII=';
function caps(platform='android') { return {'appium:automationName':platform==='android'?'UiAutomator2':'XCUITest','appium:udid':'explicit-device-id','appium:deviceName':'explicit-device-name'}; }
function blueprint(platform='android') {
  return {target:{platform,launchTargets:{app:'org.example.qa'}},selectors:{selectors:{input:{android:{strategy:'id',value:'org.example.qa:id/input'},ios:{strategy:'accessibilityId',value:'qa-input'},web:{strategy:'testId',value:'qa-input'}}}}};
}
function ctx(platform='android',extra={}) { return {blueprint:blueprint(platform),timeoutMs:200,variables:{},secretInputs:new Set(),...extra}; }
function action(name,params={}) { return {type:'action',action:name,params}; }
function assertion(name,params={selector:'input',expected:'hello'}) { return {type:'assertion',action:name,params}; }
async function fixture(t,override=()=>undefined) {
  const requests=[];
  const server=createServer(async(req,res)=>{
    try {
      const chunks=[];
      for await(const chunk of req) chunks.push(chunk);
      const raw=Buffer.concat(chunks).toString();
      const record={method:req.method,path:req.url,body:raw?JSON.parse(raw):undefined};
      requests.push(record);
      const custom=await override(record,res,requests);
      if(custom===false || res.writableEnded) return;
      let value=null;
      if(req.url==='/session') value={sessionId:'qa-session',capabilities:{}};
      else if(req.url.endsWith('/elements')) value=[{[ELEMENT]:'qa-element'}];
      else if(req.url.endsWith('/displayed')) value=true;
      else if(req.url.endsWith('/text') || req.url.endsWith('/attribute/value')) value='hello';
      else if(req.url.endsWith('/screenshot')) value=PNG;
      else if(req.url.endsWith('/hide_keyboard')) value=true;
      res.writeHead(custom?.status??200,{'content-type':'application/json'});
      res.end(JSON.stringify({value:custom && Object.hasOwn(custom,'value')?custom.value:value}));
    } catch { if(!res.destroyed) { res.writeHead(500); res.end('{"value":{"error":"unknown error"}}'); } }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {endpoint:`http://127.0.0.1:${server.address().port}`,requests};
}
async function session(t,platform='android',override,config={}) {
  const f=await fixture(t,override);
  const adapter=new AppiumAdapter({endpoint:f.endpoint,capabilities:caps(platform),...config});
  t.after(()=>adapter.endSession().catch(()=>{}));
  await adapter.startSession(blueprint(platform).target,{timeoutMs:1000});
  return {...f,adapter};
}
const code=expected=>error=>error.code===expected;

test('Appium config is explicit, platform-specific and does not connect on construction',async()=>{
  for(const endpoint of ['https://example.test','http://example.test','http://user:secret@localhost:4723','http://localhost:4723?secret=value','http://localhost:4723#secret','file:///tmp/appium']) {
    assert.throws(()=>new AppiumAdapter({endpoint,capabilities:caps()}),code('INVALID_DOCUMENT'));
  }
  for(const capabilities of [{}, {...caps(),'appium:udid':''},{...caps(),'appium:deviceName':''},{...caps(),'appium:app':'http://unsafe/app.apk'},{...caps(),'appium:newCommandTimeout':0},{...caps(),'appium:options':{}},{...caps(),browserName:'Chrome'}]) {
    assert.throws(()=>new AppiumAdapter({endpoint:'http://localhost:4723',capabilities}),code('INVALID_DOCUMENT'));
  }
  const remote=new AppiumAdapter({endpoint:'https://example.test/appium',allowRemoteEndpoint:true,capabilities:caps('ios')});
  assert.ok(remote.getCapabilities().platforms.includes('ios'));
  assert.throws(()=>new AppiumAdapter({endpoint:'http://example.test',allowRemoteEndpoint:true,capabilities:caps()}),code('INVALID_DOCUMENT'));
  assert.throws(()=>new AppiumAdapter({endpoint:'http://localhost:4723',capabilities:caps(),requestTimeoutMs:0}),code('INVALID_DOCUMENT'));
  const wrong=new AppiumAdapter({endpoint:'http://localhost:1',capabilities:caps()});
  await assert.rejects(wrong.startSession({platform:'ios'}),code('INVALID_DOCUMENT'));
  await assert.rejects(wrong.startSession({platform:'tizen'}),code('UNSUPPORTED_CAPABILITY'));
});

for(const platform of ['android','ios']) test(`Appium ${platform} session, app actions and exact native assertions`,async t=>{
  const {adapter,requests}=await session(t,platform);
  const context=ctx(platform);
  await adapter.performAction(action('launch',{target:'app'}),context);
  await adapter.performAction(action('tap',{selector:'input'}),context);
  await adapter.performAction(action('input',{selector:'input',value:'hello'}),context);
  await adapter.performAction(action('clear',{selector:'input'}),context);
  await adapter.performAction(action('waitFor',{selector:'input'}),context);
  await adapter.evaluateAssertion(assertion('assertVisible'),context);
  await adapter.evaluateAssertion(assertion('assertText'),context);
  await adapter.evaluateAssertion(assertion('assertValue'),context);
  await adapter.performAction(action('mobileBack'),context);
  await adapter.performAction(action('hideKeyboard'),context);
  await adapter.endSession();
  assert.equal(requests[0].body.capabilities.alwaysMatch.platformName,platform==='android'?'Android':'iOS');
  assert.equal(requests[0].body.capabilities.alwaysMatch['appium:udid'],'explicit-device-id');
  assert.equal(requests[0].body.capabilities.alwaysMatch['appium:newCommandTimeout'],60);
  assert.deepEqual(requests[1].body,{implicit:0});
  assert.deepEqual(requests.find(r=>r.path.endsWith('/activate_app')).body,{appId:'org.example.qa'});
  const lookup=requests.find(r=>r.path.endsWith('/elements'));
  assert.equal(lookup.body.using,platform==='android'?'id':'accessibility id');
  const inputIndex=requests.findIndex(r=>r.path.endsWith('/value')&&r.method==='POST');
  assert.equal(requests[inputIndex-1].path,'/session/qa-session/element/qa-element/clear');
  assert.deepEqual(requests[inputIndex].body,{text:'hello'});
  assert.ok(requests.some(r=>r.path.endsWith(platform==='android'?'/attribute/text':'/attribute/value')));
  assert.ok(requests.some(r=>r.path.endsWith('/back')));
  assert.equal(requests.at(-1).method,'DELETE');
  await adapter.endSession();
  assert.equal(requests.filter(r=>r.method==='DELETE').length,1);
});

test('Appium exact assertion mismatch is failed; server message is not exposed',async t=>{
  const {adapter}=await session(t,'android',r=>r.path.endsWith('/text')?{value:'sensitive-server-value'}:undefined);
  await assert.rejects(adapter.evaluateAssertion(assertion('assertText'),ctx()),e=>e.code==='ASSERTION_FAILED'&&!JSON.stringify(e).includes('sensitive-server-value'));
});

test('Appium wait states distinguish existence and visibility',async t=>{
  let exists=true,visible=false;
  const {adapter}=await session(t,'android',r=>r.path.endsWith('/elements')?{value:exists?[{[ELEMENT]:'item'}]:[]}:r.path.endsWith('/displayed')?{value:visible}:undefined);
  for(const state of ['attached','hidden']) await adapter.performAction(action('waitFor',{selector:'input',state}),ctx());
  for(const state of ['visible','detached']) await assert.rejects(adapter.performAction(action('waitFor',{selector:'input',state}),ctx('android',{timeoutMs:80})),e=>['ELEMENT_NOT_FOUND','TIMEOUT'].includes(e.code)&&e.phase==='step');
  exists=false;
  for(const state of ['hidden','detached']) await adapter.performAction(action('waitFor',{selector:'input',state}),ctx());
  await assert.rejects(adapter.evaluateAssertion(assertion('assertVisible'),ctx('android',{timeoutMs:80})),e=>['ASSERTION_FAILED','TIMEOUT'].includes(e.code)&&e.phase==='step');
  exists=true; visible=true;
  await adapter.performAction(action('waitFor',{selector:'input',state:'visible'}),ctx());
});

test('Appium detects ambiguous, unsupported and missing native selectors',async t=>{
  const {adapter}=await session(t,'android',r=>r.path.endsWith('/elements')?{value:[{[ELEMENT]:'one'},{[ELEMENT]:'two'}]}:undefined);
  await assert.rejects(adapter.performAction(action('tap',{selector:'input'}),ctx()),code('UNSUPPORTED_CAPABILITY'));
  await assert.rejects(adapter.performAction(action('tap',{selector:'absent'}),ctx()),code('UNSUPPORTED_CAPABILITY'));
  await assert.rejects(adapter.performAction(action('execute',{script:'secret'}),ctx()),code('UNSUPPORTED_CAPABILITY'));
  await assert.rejects(adapter.performAction(action('launch',{target:'missing'}),ctx()),code('INVALID_DOCUMENT'));
});

test('Appium xpath selector and encoded session/element IDs stay in URL segments',async t=>{
  const {adapter,requests}=await session(t,'ios',r=>r.path==='/session'?{value:{sessionId:'session/unsafe'}}:r.path.endsWith('/elements')?{value:[{[ELEMENT]:'element/unsafe'}]}:undefined);
  const context=ctx('ios');
  context.blueprint.selectors.selectors.input.ios={strategy:'xpath',value:'//XCUIElementTypeTextField'};
  await adapter.performAction(action('tap',{selector:'input'}),context);
  assert.ok(requests.some(r=>r.path==='/session/session%2Funsafe/element/element%2Funsafe/click'));
  assert.equal(requests.find(r=>r.path.endsWith('/elements')).body.using,'xpath');
});

test('Appium evidence stores PNG bytes and skips secret runs before HTTP',async t=>{
  const {adapter,requests}=await session(t);
  const dir=await mkdtemp(join(tmpdir(),'aqa-appium-evidence-'));
  const path=join(dir,'native.png');
  assert.equal(await adapter.captureEvidence(path),true);
  assert.deepEqual(await readFile(path),Buffer.from(PNG,'base64'));
  assert.equal(await adapter.captureEvidence(join(dir,'secret.png'),{containsSecrets:true}),false);
  await assert.rejects(stat(join(dir,'secret.png')),{code:'ENOENT'});
  await adapter.performAction(action('input',{selector:'input',valueRef:'password'}),ctx('android',{variables:{password:'very-secret'},secretInputs:new Set(['password'])}));
  assert.equal(await adapter.captureEvidence(join(dir,'secret-again.png')),false);
  assert.equal(requests.filter(r=>r.path.endsWith('/screenshot')).length,1);
  assert.deepEqual(requests.find(r=>r.path.endsWith('/value')&&r.method==='POST').body,{text:'very-secret'});
});

test('Appium rejects invalid, truncated and oversized-dimension PNG evidence',async t=>{
  let data='not-base64';
  const {adapter}=await session(t,'android',r=>r.path.endsWith('/screenshot')?{value:data}:undefined);
  const dir=await mkdtemp(join(tmpdir(),'aqa-appium-invalid-'));
  const huge=Buffer.from(PNG,'base64');huge.writeUInt32BE(16777217,16);
  for(const invalid of ['not-base64',Buffer.from('plain text').toString('base64'),Buffer.from(PNG,'base64').subarray(0,33).toString('base64'),huge.toString('base64')]) {
    data=invalid;
    await assert.rejects(adapter.captureEvidence(join(dir,'bad.png')),code('EVIDENCE_ERROR'));
    await assert.rejects(stat(join(dir,'bad.png')),{code:'ENOENT'});
  }
});

test('Appium protocol unsupported back and keyboard are blocked, false keyboard is failed',async t=>{
  let keyboard=false;
  const {adapter}=await session(t,'ios',r=>r.path.endsWith('/back')?{status:404,value:{error:'unknown command',message:'raw-secret',stacktrace:'raw-stack'}}:r.path.endsWith('/hide_keyboard')?{value:keyboard}:undefined);
  await assert.rejects(adapter.performAction(action('mobileBack'),ctx('ios')),e=>e.code==='UNSUPPORTED_CAPABILITY'&&!JSON.stringify(e).includes('raw-secret'));
  await assert.rejects(adapter.performAction(action('hideKeyboard'),ctx('ios')),code('ASSERTION_FAILED'));
  keyboard={error:'unsupported operation',message:'raw-secret'};
  await assert.rejects(adapter.performAction(action('hideKeyboard'),ctx('ios')),code('UNSUPPORTED_CAPABILITY'));
});

test('Appium rejects malformed protocol response without disclosing body',async t=>{
  let mode='json';
  const {adapter}=await session(t,'android',(r,res)=>{
    if(!r.path.endsWith('/back')) return;
    if(mode==='json') {res.end('sensitive-invalid-json');return false;}
    if(mode==='missing') {res.end('{"secret":"sensitive-body"}');return false;}
    if(mode==='error') return {status:500,value:{error:'unknown error',message:'sensitive-message',stacktrace:'sensitive-stack'}};
    if(mode==='invalid-session') return {status:404,value:{error:'invalid session id',message:'sensitive-message'}};
  });
  for(mode of ['json','missing','error','invalid-session']) await assert.rejects(adapter.performAction(action('mobileBack'),ctx()),e=>e.code===(mode==='invalid-session'?'RUNNER_CRASH':'SESSION_ERROR')&&!JSON.stringify(e).includes('sensitive'));
});

test('Appium transport caps streamed responses and refuses redirects',async t=>{
  let mode='size';
  const {adapter}=await session(t,'android',(r,res)=>{
    if(!r.path.endsWith('/back')) return;
    if(mode==='size') {res.writeHead(200,{'content-type':'application/json'});res.write('{"value":"');res.end('x'.repeat(1024*1024+1)+'"}');return false;}
    res.writeHead(302,{location:'http://127.0.0.1:1/secret'});res.end();return false;
  });
  for(mode of ['size','redirect']) await assert.rejects(adapter.performAction(action('mobileBack'),ctx()),code('SESSION_ERROR'));
});

test('Appium request timeout is bounded and known session remains deletable',async t=>{
  const {adapter,requests}=await session(t,'android',r=>r.path.endsWith('/back')?false:undefined,{requestTimeoutMs:50});
  const started=performance.now();
  await assert.rejects(adapter.performAction(action('mobileBack'),ctx()),code('SESSION_ERROR'));
  assert.ok(performance.now()-started<1000);
  await adapter.endSession();
  assert.equal(requests.at(-1).method,'DELETE');
});

test('Appium endSession aborts pending action and attempts DELETE exactly once',async t=>{
  let entered;
  const active=new Promise(resolve=>entered=resolve);
  const {adapter,requests}=await session(t,'android',r=>{if(r.path.endsWith('/back')){entered();return false;}});
  const pending=assert.rejects(adapter.performAction(action('mobileBack'),ctx('android',{timeoutMs:5000})),code('SESSION_ERROR'));
  await active;
  await Promise.all([adapter.endSession(),adapter.endSession()]);
  await pending;
  assert.equal(requests.filter(r=>r.method==='DELETE').length,1);
  await assert.rejects(adapter.performAction(action('mobileBack'),ctx()),code('RUNNER_CRASH'));
});

test('Appium failed session initialization cleans up known session',async t=>{
  const {endpoint,requests}=await fixture(t,r=>r.path.endsWith('/timeouts')?{status:500,value:{error:'unknown error',message:'hidden'}}:undefined);
  const adapter=new AppiumAdapter({endpoint,capabilities:caps()});
  await assert.rejects(adapter.startSession(blueprint().target),code('SESSION_ERROR'));
  await adapter.endSession();
  assert.equal(requests.at(-1).method,'DELETE');
});

test('Appium cancelling session creation remains bounded without inventing an ID',async t=>{
  let entered;
  const active=new Promise(resolve=>entered=resolve);
  const {endpoint,requests}=await fixture(t,r=>{if(r.path==='/session'){entered();return false;}});
  const adapter=new AppiumAdapter({endpoint,capabilities:caps()});
  const pending=assert.rejects(adapter.startSession(blueprint().target),code('SESSION_ERROR'));
  await active;
  await assert.rejects(adapter.endSession(),code('CLEANUP_ERROR'));
  await pending;
  assert.equal(requests.filter(r=>r.method==='DELETE').length,0);
  assert.equal(requests[0].body.capabilities.alwaysMatch['appium:newCommandTimeout'],60);
});

test('Appium cleanup failure is explicit and bounded',async t=>{
  const {adapter}=await session(t,'android',r=>r.method==='DELETE'?false:undefined,{requestTimeoutMs:50});
  const started=performance.now();
  await assert.rejects(adapter.endSession(),code('CLEANUP_ERROR'));
  assert.ok(performance.now()-started<1000);
});

test('Appium missing input variable is rejected before clear mutates the element',async t=>{
  const {adapter,requests}=await session(t);
  await assert.rejects(adapter.performAction(action('input',{selector:'input',valueRef:'missing'}),ctx()),code('INVALID_DOCUMENT'));
  assert.equal(requests.filter(r=>r.path.endsWith('/clear')).length,0);
});

test('Appium exhausted transport budget never starts a request',async t=>{
  const {endpoint,requests}=await fixture(t);
  const transport=new AppiumTransport(endpoint,1000);
  for(const timeoutMs of [0,-1,NaN]) await assert.rejects(transport.request('POST','/session',{}, {timeoutMs,phase:'step'}),e=>e.code==='TIMEOUT'&&e.phase==='step');
  assert.equal(requests.length,0);
});

test('Appium input cannot send value after clear consumes the step budget',async t=>{
  const {adapter,requests}=await session(t,'android',async r=>{
    if(r.path.endsWith('/clear')) {await delay(120);return {value:null};}
  });
  await assert.rejects(adapter.performAction(action('input',{selector:'input',value:'never-send'}),ctx('android',{timeoutMs:70})),e=>e.code==='TIMEOUT'&&e.phase==='step');
  await delay(140);
  assert.ok(requests.some(r=>r.path.endsWith('/clear')));
  assert.equal(requests.filter(r=>r.path.endsWith('/value')&&r.method==='POST').length,0);
});

test('Appium session deadline has session phase and stays distinct from network failure',async t=>{
  const {endpoint}=await fixture(t,r=>r.path==='/session'?false:undefined);
  const adapter=new AppiumAdapter({endpoint,capabilities:caps(),requestTimeoutMs:1000});
  await assert.rejects(adapter.startSession(blueprint().target,{timeoutMs:25}),e=>e.code==='TIMEOUT'&&e.phase==='session');
  await assert.rejects(adapter.endSession(),code('CLEANUP_ERROR'));
});

test('Appium assertValue expectedRef resolves variables and protects secret evidence',async t=>{
  const {adapter,requests}=await session(t);
  await adapter.evaluateAssertion(assertion('assertValue',{selector:'input',expectedRef:'typed'}),ctx('android',{variables:{typed:'hello'}}));
  await assert.rejects(adapter.evaluateAssertion(assertion('assertValue',{selector:'input',expectedRef:'missing'}),ctx()),code('INVALID_DOCUMENT'));
  const context=ctx('android',{variables:{password:'not-the-value'},secretInputs:new Set(['password'])});
  await assert.rejects(adapter.evaluateAssertion(assertion('assertValue',{selector:'input',expectedRef:'password'}),context),e=>e.code==='ASSERTION_FAILED'&&!JSON.stringify(e).includes('not-the-value'));
  assert.equal(await adapter.captureEvidence('unused-secret.png'),false);
  assert.equal(requests.filter(r=>r.path.endsWith('/screenshot')).length,0);
});

test('Appium text/value polling observes delayed rendering and cancellation within one budget',async t=>{
 let readyAt=Infinity;
 const {adapter,requests}=await session(t,'android',r=>r.path.endsWith('/text')?{value:performance.now()>=readyAt?'Ready':'Loading'}:undefined);
 for(const name of ['assertText','assertValue']){readyAt=performance.now()+140;const start=performance.now();await adapter.evaluateAssertion(assertion(name,{selector:'input',expected:'Ready'}),ctx('android',{timeoutMs:700}));assert(performance.now()-start>=100);}
 const c=new AbortController();readyAt=Infinity;setTimeout(()=>c.abort(),25);const start=performance.now();await assert.rejects(adapter.evaluateAssertion(assertion('assertText',{selector:'input',expected:'Ready'}),ctx('android',{timeoutMs:700,signal:c.signal})),code('CANCELLED'));assert(performance.now()-start<300);
 assert(requests.filter(r=>r.path.endsWith('/text')).length>3);
});
