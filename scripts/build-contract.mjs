import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {schema} from '../packages/core/schema.mjs';
import {ENGINE_VERSION} from '../packages/core/domain/version.mjs';
import {listPresets} from '../packages/core/presets.mjs';
import {renderContract} from './generation/contract.mjs';
import {renderDocumentAuthoring,renderAuthoringExamples} from './generation/document-authoring.mjs';
const manifest=JSON.parse(await readFile(new URL('../contracts/manifest.json',import.meta.url),'utf8'));
const example=JSON.parse(await readFile(new URL('../examples/login.qa.json',import.meta.url),'utf8'));
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
if(pkg.version!==manifest.engineVersion || ENGINE_VERSION!==manifest.engineVersion) throw new Error('Runtime version drift');
const {artifact,bundle,metadata,xml,xmlArtifact,xmlMetadata}=renderContract({manifest,schema,example,presets:listPresets()});
const dir=new URL('../contracts/releases/',import.meta.url);
await mkdir(dir,{recursive:true});
if(process.argv.includes('--check')) {
  if(await readFile(new URL(artifact,dir),'utf8')!==bundle || await readFile(new URL('../contracts/release.json',import.meta.url),'utf8')!==JSON.stringify(metadata,null,2)+'\n') throw new Error('Contract bundle drift');
  if(await readFile(new URL(xmlArtifact,dir),'utf8')!==xml || await readFile(new URL('../contracts/xml-release.json',import.meta.url),'utf8')!==JSON.stringify(xmlMetadata,null,2)+'\n') throw new Error('XML fixture drift');
} else {
  await writeFile(new URL(artifact,dir),bundle);
  await writeFile(new URL('../contracts/release.json',import.meta.url),JSON.stringify(metadata,null,2)+'\n');
  await writeFile(new URL(xmlArtifact,dir),xml);
  await writeFile(new URL('../contracts/xml-release.json',import.meta.url),JSON.stringify(xmlMetadata,null,2)+'\n');
}
console.log(JSON.stringify(metadata));
console.log(JSON.stringify(xmlMetadata));
const authoring=renderDocumentAuthoring({engineVersion:pkg.version,executionSchemaBytes:await readFile(new URL('../contracts/schemas/qa.schema.json',import.meta.url))});
for(const [file,bytes] of [
  ['contracts/schemas/qa-authoring.schema.json',authoring.schema],
  ['contracts/releases/'+authoring.artifact,authoring.bundle],
  ['contracts/authoring-release.json',authoring.metadata],
  ...renderAuthoringExamples(example),
]) {
  const url=new URL('../'+file,import.meta.url);
  if(process.argv.includes('--check')) {
    if(await readFile(url,'utf8')!==bytes)throw new Error('Document authoring contract drift: '+file);
  } else await writeFile(url,bytes);
}
console.log(authoring.metadata.trim());

