import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ensure } from '../errors.mjs';
// XML keeps complex parameter values as JSON text, with explicit nodes and edges.
export function parseXml(text) {
    ensure(!/<!DOCTYPE|<!ENTITY/i.test(text), 'INVALID_DOCUMENT', 'XML DTD and entities are disabled');
    ensure(XMLValidator.validate(text) === true, 'INVALID_DOCUMENT', 'Malformed XML');
    const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', trimValues: false, parseTagValue: false, parseAttributeValue: false, processEntities: true, htmlEntities: { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }, isArray: tag => ['node', 'edge'].includes(tag) }).parse(text);
    const rootKeys = Object.keys(xml).filter(k => k !== '?xml');
    ensure(rootKeys.length === 1 && rootKeys[0] === 'blueprint', 'INVALID_DOCUMENT', 'Expected blueprint root');
    const b = xml.blueprint;
    const known = (o, keys) => ensure(o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k => keys.includes(k) || (k === '#text' && !String(o[k]).trim())), 'INVALID_DOCUMENT', 'Unknown or duplicate XML element/attribute');
    known(b, ['@schemaVersion', '@id', '@name', 'flow', 'selectors', 'target', 'testCase', 'references']);
    const f = b.flow;
    ensure(f && typeof f === 'object', 'INVALID_DOCUMENT', 'Missing XML flow');
    known(f, ['@id', '@entryNode', '@name', 'variables', 'metadata', 'nodes', 'edges']);
    known(f.nodes || {}, ['node']);
    known(f.edges || {}, ['edge']);
    const json = content => {
        ensure(typeof content === 'string', 'INVALID_DOCUMENT', 'XML JSON payload must contain text only');
        return JSON.parse(content);
    };
    const flow = { schemaVersion: 'qa.flow/v1', id: f['@id'], entryNode: f['@entryNode'], nodes: (f.nodes?.node || []).map(n => {
            known(n, ['@id', '@type', '@action', '@timeoutMs', 'params', 'condition', 'retry']);
            const node = { id: n['@id'], type: n['@type'] };
            if (n['@action'])
                node.action = n['@action'];
            if (n['@timeoutMs'])
                node.timeoutMs = Number(n['@timeoutMs']);
            for (const key of ['params', 'condition', 'retry'])
                if (n[key] !== undefined)
                    node[key] = json(n[key]);
            return node;
        }), edges: (f.edges?.edge || []).map(e => {
            known(e, ['@from', '@to', '@label']);
            return { from: e['@from'], to: e['@to'], ...(e['@label'] ? { label: e['@label'] } : {}) };
        }) };
    if (f['@name'])
        flow.name = f['@name'];
    for (const key of ['variables', 'metadata'])
        if (f[key] !== undefined)
            flow[key] = json(f[key]);
    return { schemaVersion: b['@schemaVersion'], id: b['@id'], ...(b['@name'] ? { name: b['@name'] } : {}), flow, selectors: json(b.selectors), target: json(b.target), ...(b.testCase ? { testCase: json(b.testCase) } : {}), ...(b.references ? { references: json(b.references) } : {}) };
}
