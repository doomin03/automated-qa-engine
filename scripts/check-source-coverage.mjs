import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline=JSON.parse(await readFile(resolve(root,'artifacts/modular-refactor-20261107/baseline/manifest.json'),'utf8'));
async function list(dir){return(await Promise.all((await readdir(resolve(root,dir),{withFileTypes:true})).map(e=>e.isDirectory()?list(dir+'/'+e.name):[dir+'/'+e.name]))).flat();}
function category(path){
  if(path.startsWith('packages/core/'))return {responsibility:'Core public contracts, input/planning/execution and evidence',verification:'core, authoring, capture, input-evidence, lifecycle, design, public-api, service-hardening and independent differential'};
  if(path.startsWith('packages/cli/'))return {responsibility:'CLI composition, catalog and bounded transport',verification:'cli, control, service-hardening, external installed bin and Checker'};
  if(path.startsWith('packages/agent/'))return {responsibility:'Optional Agent policy, recovery, reporting and durable state',verification:'agent-* tests, state byte differential, external Agent fixture'};
  if(path.startsWith('runners/'))return {responsibility:path.startsWith('runners/appium')?'Native Appium session/protocol boundary':'Browser session/action/observation boundary',verification:path.startsWith('runners/appium')?'appium protocol and public types; physical devices unverified':'browser/design/capture/service lifecycle; external Chromium'};
  if(path.startsWith('contracts/'))return {responsibility:'Versioned execution and HTTP contract artifacts',verification:'schema/HTTP byte baseline, generator deterministic check, installed file SHA'};
  if(path.startsWith('scripts/spikes/'))return {responsibility:'Historical runtime-choice experiment, not production API',verification:'retained baseline bytes and ADR; no runtime imports'};
  if(path.startsWith('scripts/'))return {responsibility:'Build, architecture, foundation and external acceptance tooling',verification:'generator byte check, negative architecture fixtures, installed package acceptance'};
  if(path.startsWith('tests/'))return {responsibility:'Existing characterization plus structural and state regressions',verification:'full node test; fixtures execute in isolated installed consumer'};
  if(path.startsWith('examples/'))return {responsibility:'Standalone public usage and deterministic local target',verification:'actual browser and installed package fixture execution'};
  if(path.startsWith('docs/')||path.endsWith('.md'))return {responsibility:'Public guidance or historical/architecture evidence',verification:'foundation UTF-8/link checks and source review'};
  if(path.startsWith('openspec/'))return {responsibility:'Requirements, design, tasks and preserved prior changes',verification:'strict OpenSpec validation'};
  if(['package.json','package-lock.json'].includes(path))return {responsibility:'Package metadata, export/bin/files and exact dependencies',verification:'alpha8 version, unchanged dependency set, installed manifest/types/bin'};
  return {responsibility:'Repository configuration preserved',verification:'foundation and baseline existence'};
}
const rows=[];
for(const original of baseline.files){
  let current;try{current=await readFile(resolve(root,original.path));}catch{}
  const currentSha=current?hash(current):null;
  rows.push({path:original.path,baselineSha256:original.sha256,currentSha256:currentSha,status:!current?'missing':currentSha===original.sha256?'retained':'changed',...category(original.path)});
}
const existing=new Set(rows.map(r=>r.path));
const currentPaths=(await Promise.all(['packages','runners','scripts','tests','contracts'].map(list))).flat();
const additions=currentPaths.filter(p=>!existing.has(p)).map(path=>({path,status:'new',...category(path)}));
const runtime=rows.filter(r=>/^(packages|runners)\/.+\.mjs$/.test(r.path));
const types=rows.filter(r=>/^(packages|runners)\/.+\.d\.ts$/.test(r.path));
const missing=rows.filter(r=>r.status==='missing');
const report={generatedAt:new Date().toISOString(),baselineCount:baseline.files.length,coveredBaselineCount:rows.filter(r=>r.currentSha256).length,missingCount:missing.length,baselineRuntimeCount:runtime.length,baselineTypeCount:types.length,coveredRuntimeCount:runtime.filter(r=>r.currentSha256).length,coveredTypeCount:types.filter(r=>r.currentSha256).length,currentRuntimeCount:currentPaths.filter(p=>/^(packages|runners)\/.+\.mjs$/.test(p)).length,coverage:missing.length?'failed':'complete',rows,additions};
await writeFile(resolve(root,'artifacts/modular-refactor-20261107/source-coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined,additions:undefined}));
if(missing.length||runtime.length!==37||types.length!==4||rows.length!==223)process.exitCode=1;
