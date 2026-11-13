import { ensure } from '../errors.mjs';
export const MAX_BYTES = 1024 * 1024;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const byteLength = value => Buffer.byteLength(JSON.stringify(value));
// Validate direct API inputs too, without invoking getters/toJSON or cloning a
// repeat body before its limits are known. Count the exact compact JSON bytes.
export function safeJsonBytes(value) {
    let bytes = 0;
    const active = new WeakSet();
    function add(count) { bytes += count; ensure(bytes <= MAX_BYTES, 'INVALID_DOCUMENT', 'Authoring document exceeds 1 MiB'); }
    function visit(current, depth) {
        ensure(depth < 128, 'INVALID_DOCUMENT', 'Authoring document is excessively deep');
        if (current === null || typeof current === 'boolean') {
            add(current === null ? 4 : current ? 4 : 5);
            return;
        }
        if (typeof current === 'string') {
            ensure(Buffer.byteLength(current) <= MAX_BYTES, 'INVALID_DOCUMENT', 'Authoring string exceeds 1 MiB');
            add(byteLength(current));
            return;
        }
        if (typeof current === 'number') {
            ensure(Number.isFinite(current), 'INVALID_DOCUMENT', 'Authoring requires finite JSON values');
            add(byteLength(current));
            return;
        }
        ensure(current && typeof current === 'object', 'INVALID_DOCUMENT', 'Authoring requires JSON values');
        ensure(!active.has(current), 'INVALID_DOCUMENT', 'Cyclic authoring document');
        const array = Array.isArray(current), prototype = Object.getPrototypeOf(current);
        ensure(array || prototype === Object.prototype || prototype === null, 'INVALID_DOCUMENT', 'Authoring requires plain JSON objects');
        active.add(current);
        const keys = Reflect.ownKeys(current);
        ensure(keys.every(key => typeof key === 'string'), 'INVALID_DOCUMENT', 'Authoring does not accept symbol keys');
        if (array) {
            ensure(current.length <= MAX_BYTES && keys.length === current.length + 1, 'INVALID_DOCUMENT', 'Authoring requires dense JSON arrays');
            add(2 + Math.max(0, current.length - 1));
            for (let i = 0; i < current.length; i++) {
                const descriptor = Object.getOwnPropertyDescriptor(current, String(i));
                ensure(descriptor && Object.hasOwn(descriptor, 'value'), 'INVALID_DOCUMENT', 'Authoring does not accept accessors');
                visit(descriptor.value, depth + 1);
            }
        }
        else {
            add(2 + Math.max(0, keys.length - 1));
            for (const key of keys) {
                ensure(!RESERVED.has(key), 'INVALID_DOCUMENT', 'Reserved authoring object key');
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                ensure(descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'INVALID_DOCUMENT', 'Authoring does not accept accessors or hidden properties');
                add(byteLength(key) + 1);
                visit(descriptor.value, depth + 1);
            }
        }
        active.delete(current);
    }
    visit(value, 0);
    return bytes;
}
export function known(object, keys) {
    ensure(isObject(object) && Object.keys(object).every(key => keys.includes(key)), 'INVALID_DOCUMENT', 'Unknown or duplicate authoring field');
}
export function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}
