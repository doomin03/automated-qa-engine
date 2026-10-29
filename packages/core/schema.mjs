import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { QaError } from './errors.mjs';
export const schema = JSON.parse(readFileSync(new URL('../../contracts/schemas/qa.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, ownProperties: true });
ajv.addSchema(schema);
const names = { 'qa.blueprint/v1':'blueprint', 'qa.flow/v1':'flow', 'qa.testcase/v1':'testcase', 'qa.suite/v1':'suite', 'qa.selectors/v1':'selectors', 'qa.target/v1':'target', 'qa.runRequest/v1':'runRequest', 'qa.runEvent/v1':'event', 'qa.result/v1':'result', 'qa.capabilities/v1':'capabilities', 'qa.evidence/v1':'evidence' };
names['qa.plan/v1']='plan';
export const supportedSchemas = Object.keys(names);
export function validateSchema(document) {
  const name = names[document?.schemaVersion];
  if (!name) throw new QaError('UNSUPPORTED_SCHEMA', 'Unknown or missing schemaVersion');
  const check = ajv.getSchema(schema.$id + '#/definitions/' + name);
  if (!check(document)) {
    const details = check.errors.map(e => ({ path:e.instancePath, keyword:e.keyword, message:e.message }));
    throw new QaError('INVALID_DOCUMENT', 'Document does not match ' + document.schemaVersion, 'validation', details);
  }
  return document;
}

