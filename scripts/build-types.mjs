import {readFile,writeFile} from 'node:fs/promises';
import {renderTypes} from './generation/types.mjs';
const schema=JSON.parse(await readFile(new URL('../contracts/schemas/qa.schema.json',import.meta.url),'utf8'));
const text=renderTypes(schema);
const path=new URL('../packages/core/schema-types.d.ts',import.meta.url);
if(process.argv.includes('--check')) {
  if(await readFile(path,'utf8')!==text) throw new Error('Public schema types drift');
} else await writeFile(path,text);
console.log('Public schema types OK');
