import ts from 'typescript';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
async function files(dir){return(await Promise.all((await readdir(resolve(root,dir),{withFileTypes:true})).map(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]))).flat();}
// The separately delegated state implementation has its own owner and formatter.
const excluded=path=>path==='packages/agent/store.mjs'||path.startsWith('packages/agent/state/');
const paths=[...await files('packages'),...await files('runners'),...await files('scripts/generation'),...await files('scripts/package')].filter(p=>p.endsWith('.mjs')&&!excluded(p));
for(const path of paths){
  const text=await readFile(resolve(root,path),'utf8');
  const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(source.parseDiagnostics.length)throw new Error('Cannot format invalid source: '+path);
  await writeFile(resolve(root,path),printer.printFile(source));
}
console.log(JSON.stringify({formatted:paths.length,excluded:['packages/agent/store.mjs','packages/agent/state/**']}));
