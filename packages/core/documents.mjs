import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { parseDocument } from 'yaml';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { QaError, ensure } from './errors.mjs';
import { validateSchema } from './schema.mjs';

const MAX_BYTES = 1024 * 1024;
function safeKeys(value, seen=new WeakSet(), depth=0) {
  if (!value || typeof value !== 'object') return;
  ensure(depth<128 && !seen.has(value), 'INVALID_DOCUMENT', 'Cyclic or excessively deep document');
  seen.add(value);
  for (const key of Object.keys(value)) {
    ensure(!['__proto__','constructor','prototype'].includes(key), 'INVALID_DOCUMENT', 'Reserved object key');
    safeKeys(value[key],seen,depth+1);
  }
  seen.delete(value);
}
export function parseSource(text, format = 'json') {
  ensure(Buffer.byteLength(text) <= MAX_BYTES, 'INVALID_DOCUMENT', 'Document exceeds 1 MiB');
  let result;
  try {
    if (format === 'xml') result = parseXml(text);
    else if (format === 'yaml' || format === 'yml') {
      const doc = parseDocument(text, { uniqueKeys:true, customTags:[] });
      ensure(doc.errors.length === 0, 'INVALID_DOCUMENT', 'Invalid YAML');
      result = doc.toJS({ maxAliasCount: 20 });
    } else result = JSON.parse(text);
  } catch (error) {
    if (error instanceof QaError) throw error;
    throw new QaError('INVALID_DOCUMENT', 'Invalid ' + format + ' document');
  }
  safeKeys(result);
  return validateSchema(result);
}
// XML keeps complex parameter values as JSON text, with explicit nodes and edges.
function parseXml(text) {
  ensure(!/<!DOCTYPE|<!ENTITY/i.test(text), 'INVALID_DOCUMENT', 'XML DTD and entities are disabled');
  ensure(XMLValidator.validate(text) === true, 'INVALID_DOCUMENT', 'Malformed XML');
  const xml = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@', trimValues:false, parseTagValue:false, parseAttributeValue:false, processEntities:true, htmlEntities:{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}, isArray: tag => ['node','edge'].includes(tag) }).parse(text);
  const rootKeys = Object.keys(xml).filter(k=>k !== '?xml');
  ensure(rootKeys.length === 1 && rootKeys[0] === 'blueprint', 'INVALID_DOCUMENT', 'Expected blueprint root');
  const b = xml.blueprint;
  const known = (o, keys) => ensure(o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k=>keys.includes(k) || (k === '#text' && !String(o[k]).trim())), 'INVALID_DOCUMENT', 'Unknown or duplicate XML element/attribute');
  known(b, ['@schemaVersion','@id','@name','flow','selectors','target','testCase']);
  const f = b.flow;
  ensure(f && typeof f === 'object', 'INVALID_DOCUMENT', 'Missing XML flow');
  known(f, ['@id','@entryNode','@name','variables','metadata','nodes','edges']);
  known(f.nodes || {}, ['node']); known(f.edges || {}, ['edge']);
  const json = content => {
    ensure(typeof content === 'string', 'INVALID_DOCUMENT', 'XML JSON payload must contain text only');
    return JSON.parse(content);
  };
  const flow = { schemaVersion:'qa.flow/v1',id:f['@id'],entryNode:f['@entryNode'],nodes:(f.nodes?.node || []).map(n=>{
    known(n, ['@id','@type','@action','@timeoutMs','params','condition','retry']);
    const node = {id:n['@id'],type:n['@type']};
    if(n['@action']) node.action=n['@action'];
    if(n['@timeoutMs']) node.timeoutMs=Number(n['@timeoutMs']);
    for(const key of ['params','condition','retry']) if(n[key] !== undefined) node[key]=json(n[key]);
    return node;
  }),edges:(f.edges?.edge || []).map(e=>{
    known(e, ['@from','@to','@label']);
    return {from:e['@from'],to:e['@to'],...(e['@label']?{label:e['@label']}:{})};
  })};
  if(f['@name']) flow.name=f['@name'];
  for(const key of ['variables','metadata']) if(f[key] !== undefined) flow[key]=json(f[key]);
  return {schemaVersion:b['@schemaVersion'],id:b['@id'],...(b['@name']?{name:b['@name']}:{ }),flow,selectors:json(b.selectors),target:json(b.target),...(b.testCase?{testCase:json(b.testCase)}:{})};
}
export async function readDocument(file) {
  const text = await readFile(file, 'utf8');
  return parseSource(text, extname(file).slice(1).toLowerCase());
}
export async function loadBlueprint(file, options={}) {
  let document = await readDocument(file);
  if(document.schemaVersion === 'qa.blueprint/v1') return document;
  let testCase;
  if(document.schemaVersion === 'qa.testcase/v1') {
    testCase=document;
    document=await readDocument(resolve(dirname(file),testCase.flowRef));
  }
  ensure(document.schemaVersion === 'qa.flow/v1', 'INVALID_DOCUMENT', 'Expected Blueprint, Flow or TestCase');
  ensure(options.selectors && options.targetManifest, 'INVALID_DOCUMENT', 'Standalone Flow/TC requires --selectors and --target-manifest');
  return validateSchema({schemaVersion:'qa.blueprint/v1',id:document.id,flow:document,selectors:await readDocument(options.selectors),target:await readDocument(options.targetManifest),...(testCase?{testCase}:{})});
}

