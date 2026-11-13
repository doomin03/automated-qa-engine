import Ajv from 'ajv';
import { schema } from '../schema.mjs';
import { QaError } from '../errors.mjs';
import { safeJsonBytes } from '../authoring/input.mjs';
import { authoringSchema, AUTHORING_SCHEMA_ID, templateDefinitions } from './contract.mjs';

const ajv = new Ajv({ strict: false, allErrors: false, ownProperties: true });
ajv.addSchema(schema);
ajv.addSchema(authoringSchema);
const bindings = new Map(templateDefinitions.map(t => [t.id, ajv.compile(t.inputSchema)]));
export function reject(code, path, message, identity = {}, errorCode = 'INVALID_DOCUMENT') {
    if (path.length > 4096) path = '';
    throw new QaError(errorCode, 'Document authoring rejected', 'validation', { diagnostics: [{ code, path, message, ...identity }] });
}
export function protect(fn, path = '', identity = {}) {
    try { return fn(); }
    catch (error) {
        if (error instanceof QaError && error.details?.diagnostics) throw error;
        const code = error instanceof QaError ? error.code : 'INVALID_DOCUMENT';
        reject(code, path, 'Document failed authoring or execution validation', identity, code);
    }
}
export function validateAuthoring(name, value) {
    const check = ajv.getSchema(AUTHORING_SCHEMA_ID + '#/definitions/' + name);
    if (!check(value)) reject('AUTHORING_SCHEMA', check.errors[0].instancePath, 'Value does not match the authoring schema');
    return value;
}
export function authoringInput(name, value) {
    return protect(() => { safeJsonBytes(value); return validateAuthoring(name, value); });
}
export function validateBindings(id, value) {
    const check = bindings.get(id);
    if (!check(value)) reject('TEMPLATE_BINDING', '/bindings' + check.errors[0].instancePath, 'Missing, unknown or invalid template binding');
}
