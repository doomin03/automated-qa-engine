import { createHash } from 'node:crypto';
import { canonicalJson } from '../domain/canonical.mjs';
import { compileBlueprint } from '../compiler.mjs';
import { parseSource } from '../codecs/source.mjs';
import { authoringInput, protect, reject } from './validation.mjs';
import { authoredResult } from './result.mjs';

const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
function indexed(values, path) {
    const map = new Map();
    for (const [i, value] of values.entries()) {
        if (map.has(value.id)) reject('DUPLICATE_ID', `${path}/${i}/id`, 'Duplicate authoring ID');
        map.set(value.id, value);
    }
    return map;
}
function orderedChain(instances, links) {
    const incoming = new Map(), outgoing = new Map();
    for (const [i, link] of links.entries()) {
        if (!instances.has(link.from) || !instances.has(link.to) || link.from === link.to) reject('LINK_TARGET', `/links/${i}`, 'Invalid outer link');
        if (outgoing.has(link.from) || incoming.has(link.to)) reject('OUTER_BRANCH', `/links/${i}`, 'Outer composition requires a sequential chain');
        outgoing.set(link.from, link.to);
        incoming.set(link.to, link.from);
    }
    const heads = [...instances.values()].filter(n => !incoming.has(n.id));
    if (heads.length !== 1) reject('OUTER_CHAIN', '/links', 'All instances must form one connected chain');
    const ordered = [], seen = new Set();
    let current = heads[0];
    while (current) {
        if (seen.has(current.id)) reject('OUTER_CYCLE', '/links', 'Outer cycles are unsupported');
        seen.add(current.id);
        ordered.push(current);
        current = instances.get(outgoing.get(current.id));
    }
    if (seen.size !== instances.size || links.length !== instances.size - 1) reject('OUTER_CHAIN', '/links', 'Disconnected or cyclic instances');
    return ordered;
}
function composable(b, identity) {
    const flow = b.flow;
    if (b.references != null || b.testCase != null || b.metadata?.preset != null || flow.metadata?.preset != null || b.target.profile != null)
        reject('COMPOSITION_SCOPE', '/assets', 'References, test cases, presets and capture profiles cannot be composed', identity);
    const starts = flow.nodes.filter(n => n.type === 'start'), ends = flow.nodes.filter(n => n.type === 'end');
    if (starts.length !== 1 || ends.length !== 1 || flow.nodes.length < 3)
        reject('BLOCK_BOUNDARY', '/assets', 'A block needs one start, one end and an internal action or branch', identity);
    for (const node of flow.nodes) {
        if (!['start', 'end', 'action', 'assertion', 'branch'].includes(node.type) || Object.hasOwn(node.params || {}, 'reference'))
            reject('COMPOSITION_SCOPE', '/assets', 'Unsupported node or resource reference', { ...identity, sourceNodeId: node.id });
    }
    const entry = flow.edges.filter(e => e.from === starts[0].id);
    if (entry.length !== 1 || entry[0].to === ends[0].id) reject('BLOCK_ENTRY', '/assets', 'Block start requires a single internal entry', identity);
    return { start: starts[0].id, end: ends[0].id, entry: entry[0].to };
}

export function composeBlueprint(input) {
    authoringInput('composition', input);
    const assets = indexed(input.assets, '/assets'), instances = indexed(input.instances, '/instances');
    for (const [i, instance] of input.instances.entries()) {
        if (!assets.has(instance.assetId)) reject('MISSING_ASSET', `/instances/${i}/assetId`, 'Instance references an unknown asset', { instanceId: instance.id });
    }
    // Verify all source hashes before interpreting any source, including unused assets.
    const sources = [...assets.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    for (const asset of sources) {
        if (sha(asset.source) !== asset.sha256) reject('SOURCE_HASH', '/assets', 'Source SHA-256 mismatch', { assetId: asset.id });
    }
    const parsed = new Map();
    for (const asset of sources) {
        parsed.set(asset.id, protect(() => {
            const b = parseSource(asset.source, asset.format);
            compileBlueprint(b);
            return b;
        }, '/assets', { assetId: asset.id }));
    }
    const ordered = orderedChain(instances, input.links);
    const nodes = [{ id: 'composition_start', type: 'start' }], edges = [], selectors = {}, variables = {}, map = {};
    const generated = new Set();
    let target, pending = [];
    for (const [index, instance] of ordered.entries()) {
        const asset = assets.get(instance.assetId), b = parsed.get(asset.id), f = b.flow;
        const identity = { assetId: asset.id, instanceId: instance.id };
        if (target && canonicalJson(target) !== canonicalJson(b.target)) reject('TARGET_MISMATCH', '/assets', 'Composed targets must be identical', identity);
        target ??= b.target;
        const { start, end, entry } = composable(b, identity);
        const nameMap = (kind, originals) => new Map(originals.map(original => {
            const id = 'b_' + sha(`${instance.id}/${kind}/${original}`).slice(0, 24);
            if (generated.has(id)) reject('NAMESPACE_COLLISION', '/instances', 'Generated namespace collision', identity);
            generated.add(id);
            return [original, id];
        }));
        const nodeIds = nameMap('node', f.nodes.map(n => n.id));
        const variableIds = nameMap('variable', Object.keys(f.variables || {}));
        const selectorIds = nameMap('selector', Object.keys(b.selectors.selectors));
        const remap = (ids, key) => {
            if (!ids.has(key)) reject('MISSING_REFERENCE', '/assets', 'Unknown local reference', identity);
            return ids.get(key);
        };
        for (const [key, value] of Object.entries(f.variables || {})) variables[variableIds.get(key)] = structuredClone(value);
        for (const [key, value] of Object.entries(b.selectors.selectors)) selectors[selectorIds.get(key)] = structuredClone(value);
        for (const original of f.nodes) {
            if (original.type === 'start' || original.type === 'end') continue;
            const node = structuredClone(original), params = node.params;
            node.id = nodeIds.get(original.id);
            if (params) {
                if (Object.hasOwn(params, 'selector')) params.selector = remap(selectorIds, params.selector);
                for (const key of ['valueRef', 'expectedRef']) if (Object.hasOwn(params, key)) params[key] = remap(variableIds, params[key]);
                if (['captureText', 'captureValue'].includes(node.action)) params.variable = remap(variableIds, params.variable);
            }
            if (node.condition && Object.hasOwn(node.condition, 'variable')) node.condition.variable = remap(variableIds, node.condition.variable);
            nodes.push(node);
            map[node.id] = { ...identity, sourceNodeId: original.id, sourceHash: asset.sha256 };
        }
        const entryId = nodeIds.get(entry);
        if (index === 0) edges.push({ from: 'composition_start', to: entryId });
        for (const edge of pending) edge.to = entryId;
        pending = [];
        for (const original of f.edges) {
            if (original.from === start) continue;
            const edge = { from: nodeIds.get(original.from), to: original.to === end ? 'composition_end' : nodeIds.get(original.to), ...(original.label != null ? { label: original.label } : {}) };
            edges.push(edge);
            if (original.to === end) pending.push(edge);
        }
        if (!pending.length) reject('BLOCK_EXIT', '/assets', 'Block has no exit edge', identity);
        if (nodes.length + 1 > 1000 || edges.length > 2000) reject('OUTPUT_LIMIT', '/instances', 'Composed graph exceeds the execution graph limit');
    }
    nodes.push({ id: 'composition_end', type: 'end' });
    return authoredResult({
        schemaVersion: 'qa.blueprint/v1', id: 'xml-composition', name: 'XML 블록 조합',
        flow: { schemaVersion: 'qa.flow/v1', id: 'xml-composition-flow', name: 'XML 블록 조합', entryNode: 'composition_start', variables, nodes, edges },
        selectors: { schemaVersion: 'qa.selectors/v1', id: 'xml-composition-selectors', selectors }, target,
    }, { nodes: map });
}
