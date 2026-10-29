import { readFile,writeFile } from 'node:fs/promises';
const schema=JSON.parse(await readFile(new URL('../contracts/schemas/qa.schema.json',import.meta.url),'utf8'));
const names={variable:'Variable',flow:'Flow',locator:'Locator',selectors:'SelectorRegistry',target:'Target',testcase:'TestCase',suite:'Suite',artifact:'Artifact',failure:'Failure',event:'RunEventFields',evidence:'EvidenceManifest',result:'RunResult',capabilities:'Capabilities',runRequest:'RunRequest',blueprint:'Blueprint',plan:'ExecutionPlan'};
function type(s) {
  if(s===false) return 'never';
  if(s===true) return 'unknown';
  if(s.$ref) return names[s.$ref.split('/').at(-1)];
  if('const' in s) return JSON.stringify(s.const);
  if(s.enum) return s.enum.map(v=>JSON.stringify(v)).join(' | ');
  if(s.oneOf) {
    const {oneOf,...base}=s;
    return oneOf.map(v=>{
      const merged={...base,...v};
      if(base.properties || v.properties) merged.properties={...base.properties,...v.properties};
      if(base.required || v.required) merged.required=[...new Set([...(base.required||[]),...(v.required||[])])];
      if(v.not?.required?.length===1) merged.properties[v.not.required[0]]=false;
      return '('+type(merged)+')';
    }).join(' | ');
  }
  if(Array.isArray(s.type)) return s.type.map(t=>type({...s,type:t})).join(' | ');
  if(s.type==='array') return 'Array<'+type(s.items)+'>';
  if(s.type==='object') {
    const props=Object.entries(s.properties || {}).map(([k,v])=>JSON.stringify(k)+(s.required?.includes(k)?'':'?')+': '+type(v)+';');
    if(s.additionalProperties && typeof s.additionalProperties==='object') props.push('[key: string]: '+type(s.additionalProperties)+';');
    else if(s.additionalProperties!==false) props.push('[key: string]: unknown;');
    return '{ '+props.join(' ')+' }';
  }
  if(s.type==='integer' || s.type==='number') return 'number';
  if(['string','boolean','null'].includes(s.type)) return s.type;
  throw new Error('Unsupported type schema: '+JSON.stringify(s));
}
const text='// Generated from contracts/schemas/qa.schema.json. Runtime schema validation remains authoritative.\n'+
  Object.entries(schema.definitions).map(([key,value])=>'export type '+names[key]+' = '+type(value)+';').join('\n')+'\n'+
  `export type RunEvent = RunEventFields & (
  {type:'run.started'; blueprintSnapshotHash:string} |
  {type:'step.started' | 'step.retrying'; nodeId:string} |
  {type:'step.finished'; nodeId:string; outcome:NonNullable<RunEventFields['outcome']>} |
  {type:'run.finished'; outcome:NonNullable<RunEventFields['outcome']>}
);\n`+
  'export type SchemaDocument = '+Object.entries(schema.definitions).filter(([,d])=>d.properties?.schemaVersion).map(([n])=>n==='event'?'RunEvent':names[n]).join(' | ')+';\n';
const path=new URL('../packages/core/schema-types.d.ts',import.meta.url);
if(process.argv.includes('--check')) {
  if(await readFile(path,'utf8')!==text) throw new Error('Public schema types drift');
} else await writeFile(path,text);
console.log('Public schema types OK');
