import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {analyzeModule,checkGraph} from './architecture/graph.mjs';
const root=resolve(import.meta.dirname,'..');
async function list(directory) {
  const entries=await readdir(resolve(root,directory),{withFileTypes:true});
  const nested=await Promise.all(entries.map(e=>e.isDirectory()?list(directory+'/'+e.name):[directory+'/'+e.name]));
  return nested.flat();
}
const files=[...(await list('packages')),...(await list('runners')),...(await list('contracts')),...(await list('examples')),'package.json'];
const modules=await Promise.all(files.filter(f=>/\.(?:mjs|js|cjs)$/.test(f)).map(async file=>analyzeModule(await readFile(resolve(root,file),'utf8'),file)));
const exceptions=JSON.parse(await readFile(resolve(root,'scripts/architecture/exceptions.json'),'utf8'));
const result=checkGraph(modules,{files,exceptions});
for(const file of files.filter(f=>/\.(?:js|cjs|ts|mts|cts)$/.test(f)&&!f.endsWith('.d.ts'))) {
  result.errors.push({file,reason:'unsupported-runtime-extension'});
  result.ok=false;
}
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exitCode=1;
