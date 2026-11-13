import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { startDemoServer } from '../examples/server.mjs';
import {validateSchema} from '../packages/core/schema.mjs';
const cli=resolve('packages/cli/aqa.mjs');
const call=args=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,[cli,...args],{windowsHide:true});
 let out='',err='';p.stdout.on('data',c=>out+=c);p.stderr.on('data',c=>err+=c);
 p.on('error',reject);p.on('close',code=>resolve({code,out,err}));
});
test('native doctor/devices separate static configuration from device discovery',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aqa-native-cli-')),path=join(dir,'appium.json');
 const config={endpoint:'http://127.0.0.1:1',capabilities:{'appium:automationName':'UiAutomator2','appium:udid':'not-connected','appium:deviceName':'not-connected'}};await writeFile(path,JSON.stringify(config));
 const missing=await call(['devices','--target','android']);assert.equal(missing.code,4);assert.equal(validateSchema(JSON.parse(missing.out)).diagnostics.nativeConfigured,false);
 const configured=await call(['doctor','--target','android','--appium-config',path]);assert.equal(configured.code,0,configured.out);const doc=validateSchema(JSON.parse(configured.out));assert.deepEqual(doc.platforms,['android']);assert.deepEqual(doc.targets,[]);assert.equal(doc.diagnostics.connectionVerified,false);assert.equal(doc.diagnostics.nativeConfigured,true);assert(doc.supportedActions.includes('mobileBack'));assert(!doc.supportedActions.includes('assertImage'));assert(!configured.out.includes('not-connected'));
 assert.equal((await call(['devices','--target','ios','--appium-config',path])).code,2);
 const web=JSON.parse((await call(['devices'])).out);assert.deepEqual(web.platforms,['web']);assert(!web.supportedActions.includes('mobileBack'));
});
test('CLI exports schema/template and validates XML without executing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aqa-cli-'));
 const xml=await call(['template','--format','xml']);
 assert.equal(xml.code,0);const path=join(dir,'flow.xml');await writeFile(path,xml.out);
 const imported=await call(['import',path]);assert.equal(imported.code,0);assert.equal(JSON.parse(imported.out).schemaVersion,'qa.blueprint/v1');
 const valid=await call(['validate',path]);assert.equal(valid.code,0);assert.equal(JSON.parse(valid.out).valid,true);
 const schema=await call(['schema']);assert(JSON.parse(schema.out).definitions.blueprint);
 const invalid=await call(['validate',join(dir,'absent.json')]);assert.equal(invalid.code,2);assert.equal(JSON.parse(invalid.out).error.code,'INVALID_ARGUMENT');
});
test('CLI actual failed run returns nonzero and parseable events',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'aqa-cli-run-'));const server=await startDemoServer();t.after(()=>server.close());
 const b=JSON.parse(await readFile('examples/login.qa.json'));b.target.launchTargets.login=server.origin;b.target.allowedOrigins=[server.origin];
 b.flow.nodes.find(n=>n.id==='home').params.expected='WRONG';
 const path=join(dir,'fail.json');await writeFile(path,JSON.stringify(b));
 const result=await call(['run',path,'--json','--report',dir]);
 assert.equal(result.code,1);assert.equal(result.err,'');
 const events=result.out.trim().split('\n').map(JSON.parse);
 assert.equal(events.at(-1).type,'run.finished');assert.equal(events.at(-1).outcome,'failed');
});

