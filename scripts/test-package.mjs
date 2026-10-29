import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile,writeFile,mkdir,mkdtemp,copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const exec=promisify(execFile),root=resolve('.'),npm=process.env.npm_execpath;
if(!npm) throw new Error('Use npm run test:package');
const artifacts=resolve('artifacts/package');await mkdir(artifacts,{recursive:true});
const run=(file,args,cwd=root)=>exec(process.execPath,[file,...args],{cwd,windowsHide:true,maxBuffer:8*1024*1024,timeout:180000});
const packed=JSON.parse((await run(npm,['pack','--ignore-scripts','--json','--pack-destination',artifacts])).stdout)[0];
for(const file of ['packages/core/index.mjs','packages/core/index.d.ts','packages/core/schema-types.d.ts','runners/playwright/adapter.d.ts','examples/consumer.mjs','docs/package-api.md','docs/xml-format.md'])
  assert(packed.files.some(f=>f.path===file),'Missing packed file: '+file);
const archive=join(artifacts,packed.filename),sha256=createHash('sha256').update(await readFile(archive)).digest('hex');
const consumer=await mkdtemp(join(tmpdir(),'aqa-package-consumer-'));
await writeFile(join(consumer,'package.json'),JSON.stringify({name:'isolated-qa-consumer',private:true,type:'module'}));
await run(npm,['install','--ignore-scripts','--no-audit','--no-fund',archive],consumer);
for(const file of ['package-consumer.mjs','package-consumer-valid.ts','package-consumer-invalid.ts']) await copyFile(join(root,'tests/fixtures',file),join(consumer,file));
const tsc=join(root,'node_modules/typescript/bin/tsc');
const flags=['--noEmit','--strict','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022'];
await run(tsc,[...flags,'package-consumer-valid.ts'],consumer);
let rejected=false;
try {await run(tsc,[...flags,'package-consumer-invalid.ts'],consumer);} catch(e) {assert.match(e.stdout,/TS2322/);assert.match(e.stdout,/TS2740/);rejected=true;}
assert(rejected,'Invalid TypeScript consumer must fail');
const result=await run(join(consumer,'package-consumer.mjs'),[],consumer);
const bundle=JSON.parse(await readFile('contracts/release.json','utf8'));
const xml=JSON.parse(await readFile('contracts/xml-release.json','utf8'));
const report={status:'passed',engineVersion:packed.version,contractVersion:bundle.contractVersion,archive,sha256,integrity:packed.integrity,shasum:packed.shasum,bundle,xml,consumer,typecheck:{valid:'passed',invalid:'rejected',compiler:'6.0.3'},runtime:JSON.parse(result.stdout.trim())};
await writeFile(join(artifacts,'verification.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(artifacts,'pack-manifest.json'),JSON.stringify(packed,null,2)+'\n');
console.log(JSON.stringify(report));
