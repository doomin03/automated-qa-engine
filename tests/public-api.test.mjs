import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadBlueprint,compileBlueprint,parseSource,validateSchema,QaError,ENGINE_VERSION } from 'automated-qa-engine';

test('package name exports validate and compile without a runner',async()=>{
  const b=await loadBlueprint('examples/login.qa.json');
  assert.deepEqual(parseSource(JSON.stringify(b)),b);
  assert.equal(validateSchema(b),b);
  assert.equal(compileBlueprint(b).engineVersion,ENGINE_VERSION);
  assert.throws(()=>compileBlueprint({}),e=>e instanceof QaError);
});

test('public core does not load Playwright and imports never spawn browser processes',async()=>{
  const probe=`
    import {registerHooks,syncBuiltinESMExports} from 'node:module';
    import cp from 'node:child_process';
    import assert from 'node:assert/strict';
    for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) cp[name]=()=>{throw new Error('Import attempted process: '+name)};
    syncBuiltinESMExports();
    let core=true;
    const hooks=registerHooks({resolve(s,c,next){if(core && /playwright/.test(s)) throw new Error('Core loaded concrete runner');return next(s,c);}});
    await import('automated-qa-engine'); core=false;
    const {PlaywrightAdapter}=await import('automated-qa-engine/playwright');
    const adapter=new PlaywrightAdapter();
    assert.equal(adapter.browser,undefined); assert.equal(adapter.context,undefined);
    hooks.deregister(); console.log('import-only OK');
  `;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',probe],{windowsHide:true,timeout:10000});
  assert.equal(stdout.trim(),'import-only OK');
});
