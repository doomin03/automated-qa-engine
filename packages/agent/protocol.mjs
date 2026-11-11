import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv';
import { AgentError, requireAgent } from './errors.mjs';
export const protocolPin = JSON.parse(readFileSync(new URL('../../contracts/agent-protocol/pin.json', import.meta.url), 'utf8'));
const bytes = readFileSync(new URL('../../contracts/agent-protocol/' + protocolPin.artifact, import.meta.url));
requireAgent(createHash('sha256').update(bytes).digest('hex') === protocolPin.sha256, 'AGENT_PROTOCOL_INVALID', 'Pinned protocol bytes do not match');
export const protocol = JSON.parse(bytes);
function adapt(value) {
    if (Array.isArray(value))
        return value.map(adapt);
    if (value && typeof value === 'object') {
        const out = Object.fromEntries(Object.entries(value).filter(([key]) => !(key === 'nullable' && value.nullable === true && !value.type)).map(([key, item]) => [key, key === '$ref' ? item.replace('#/components/schemas/', '#/definitions/') : adapt(item)]));
        return value.nullable === true && !value.type ? { anyOf: [{ type: 'null' }, out] } : out;
    }
    return value;
}
function dateTime(value) { const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/.exec(value); if (!match)
    return false; const [, year, month, day, hour, minute, second] = match.map(Number), leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0), days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && hour < 24 && minute < 60 && second < 60 && Number.isFinite(Date.parse(value)); }
const ajv = new Ajv({ strict: false, allErrors: false, formats: { uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'date-time': dateTime, byte: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/ } });
ajv.addSchema({ $id: 'aqa-agent-protocol', definitions: adapt(protocol.components.schemas) });
const validators = new Map();
export function validateProtocol(name, value) {
    if (!validators.has(name)) {
        requireAgent(Object.hasOwn(protocol.components.schemas, name), 'AGENT_PROTOCOL_INVALID', 'Unknown protocol type');
        validators.set(name, ajv.compile({ $ref: 'aqa-agent-protocol#/definitions/' + name }));
    }
    if (!validators.get(name)(value))
        throw new AgentError('AGENT_PROTOCOL_INVALID', 'Agent protocol validation failed: ' + name);
    return value;
}
export const protocolLimits = Object.freeze({ ...protocol['x-limits'] });
export function boundedJson(value, max = protocolLimits.httpBodyBytes) { let text; try {
    text = JSON.stringify(value);
}
catch {
    throw new AgentError('AGENT_PROTOCOL_INVALID', 'Invalid JSON payload');
} requireAgent(typeof text === 'string' && Buffer.byteLength(text) <= max, 'AGENT_PROTOCOL_LIMIT', 'Agent payload exceeds byte limit'); return text; }
