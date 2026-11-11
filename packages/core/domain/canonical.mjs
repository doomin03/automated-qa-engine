import { createHash } from 'node:crypto';
export function canonicalJson(value) {
    if (Array.isArray(value))
        return '[' + value.map(canonicalJson).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
export const hash = value => 'sha256:' + createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
