import { parseDocument } from 'yaml';
import { QaError, ensure } from '../errors.mjs';
import { validateSchema } from '../schema.mjs';
import { parseXml } from './blueprint-xml.mjs';
const MAX_BYTES = 1024 * 1024;
function safeKeys(value, seen = new WeakSet(), depth = 0) {
    if (!value || typeof value !== 'object')
        return;
    ensure(depth < 128 && !seen.has(value), 'INVALID_DOCUMENT', 'Cyclic or excessively deep document');
    seen.add(value);
    for (const key of Object.keys(value)) {
        ensure(!['__proto__', 'constructor', 'prototype'].includes(key), 'INVALID_DOCUMENT', 'Reserved object key');
        safeKeys(value[key], seen, depth + 1);
    }
    seen.delete(value);
}
export function parseSource(text, format = 'json') {
    ensure(Buffer.byteLength(text) <= MAX_BYTES, 'INVALID_DOCUMENT', 'Document exceeds 1 MiB');
    let result;
    try {
        if (format === 'xml')
            result = parseXml(text);
        else if (format === 'yaml' || format === 'yml') {
            const doc = parseDocument(text, { uniqueKeys: true, customTags: [] });
            ensure(doc.errors.length === 0, 'INVALID_DOCUMENT', 'Invalid YAML');
            result = doc.toJS({ maxAliasCount: 20 });
        }
        else
            result = JSON.parse(text);
    }
    catch (error) {
        if (error instanceof QaError)
            throw error;
        throw new QaError('INVALID_DOCUMENT', 'Invalid ' + format + ' document');
    }
    safeKeys(result);
    return validateSchema(result);
}
