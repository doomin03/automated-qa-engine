import { parseDocument } from 'yaml';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { QaError, ensure } from '../errors.mjs';
import { MAX_BYTES, isObject, freeze } from './input.mjs';
import { expandAuthoring } from './expand.mjs';
const invalid = message => new QaError('INVALID_DOCUMENT', message);
function parseXml(text) {
    // CDATA is data, not XML syntax; strip it before checking markup depth and
    // entities. DTD/entity declarations outside data are always rejected.
    const markup = text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    ensure(!/<!DOCTYPE|<!ENTITY/i.test(markup) && !/&/.test(markup), 'INVALID_DOCUMENT', 'Authoring XML entities are disabled');
    let depth = 0;
    for (const match of markup.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {
        const tag = match[0];
        if (tag.startsWith('</'))
            depth--;
        else if (!tag.endsWith('/>'))
            depth++;
        ensure(depth >= 0 && depth < 128, 'INVALID_DOCUMENT', 'Authoring XML is excessively deep');
    }
    ensure(XMLValidator.validate(text) === true, 'INVALID_DOCUMENT', 'Malformed authoring XML');
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, parseAttributeValue: false, trimValues: false, cdataPropName: '#cdata', processEntities: false }).parse(text);
    const xmlKnown = (value, keys) => {
        ensure(isObject(value) && Object.keys(value).every(key => keys.includes(key) || (key === '#text' && typeof value[key] === 'string' && !value[key].trim())), 'INVALID_DOCUMENT', 'Unknown or duplicate authoring XML element/attribute');
    };
    xmlKnown(parsed, ['authoring', '?xml']);
    if (parsed['?xml'] !== undefined)
        xmlKnown(parsed['?xml'], ['@version', '@encoding', '@standalone']);
    xmlKnown(parsed.authoring, ['@schemaVersion', 'blueprint']);
    ensure(parsed.authoring['@schemaVersion'] === 'qa.authoring/v1', 'UNSUPPORTED_SCHEMA', 'Expected qa.authoring/v1');
    xmlKnown(parsed.authoring.blueprint, ['#cdata']);
    const payload = parsed.authoring.blueprint['#cdata'];
    ensure(typeof payload === 'string' || (Array.isArray(payload) && payload.every(value => typeof value === 'string')), 'INVALID_DOCUMENT', 'Authoring XML requires CDATA JSON payload');
    return { schemaVersion: 'qa.authoring/v1', blueprint: JSON.parse(Array.isArray(payload) ? payload.join('') : payload) };
}
export function parseAuthoringSource(text, format = 'json') {
    ensure(typeof text === 'string' && Buffer.byteLength(text) <= MAX_BYTES, 'INVALID_DOCUMENT', 'Authoring source exceeds 1 MiB or is not text');
    ensure(['json', 'yaml', 'yml', 'xml'].includes(format), 'INVALID_DOCUMENT', 'Unsupported authoring source format');
    let document;
    try {
        if (format === 'xml')
            document = parseXml(text);
        else if (format === 'yaml' || format === 'yml') {
            const parsed = parseDocument(text, { uniqueKeys: true, customTags: [] });
            ensure(parsed.errors.length === 0 && parsed.warnings.length === 0, 'INVALID_DOCUMENT', 'Invalid authoring YAML');
            document = parsed.toJS({ maxAliasCount: 20 });
        }
        else
            document = JSON.parse(text);
    }
    catch (error) {
        if (error instanceof QaError)
            throw error;
        throw invalid('Invalid authoring source');
    }
    expandAuthoring(document);
    return freeze(document);
}
export function authoringXml(document) {
    expandAuthoring(document);
    const payload = JSON.stringify(document.blueprint).replaceAll(']]>', ']]]]><![CDATA[>');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<authoring schemaVersion="qa.authoring/v1">\n  <blueprint><![CDATA[' + payload + ']]></blueprint>\n</authoring>\n';
    ensure(Buffer.byteLength(xml) <= MAX_BYTES, 'INVALID_DOCUMENT', 'Authoring XML exceeds 1 MiB');
    return xml;
}
