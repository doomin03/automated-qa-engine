import { createHash } from 'node:crypto';
import { compileBlueprint } from '../compiler.mjs';
import { hash } from '../domain/canonical.mjs';
import { ensure } from '../errors.mjs';
import { MAX_BYTES, isObject, byteLength, safeJsonBytes, known, freeze } from './input.mjs';
const MAX_NODES = 1000, MAX_EDGES = 2000;
const ID = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;
const generatedId = (repeatId, iteration, stepId) => 'repeat_' + createHash('sha256').update(JSON.stringify([repeatId, iteration, stepId])).digest('hex');
export function expandAuthoring(document) {
    safeJsonBytes(document);
    known(document, ['schemaVersion', 'blueprint']);
    ensure(document.schemaVersion === 'qa.authoring/v1', 'UNSUPPORTED_SCHEMA', 'Expected qa.authoring/v1');
    const source = document.blueprint, flow = source?.flow;
    ensure(isObject(source) && source.schemaVersion === 'qa.blueprint/v1' && isObject(flow), 'INVALID_DOCUMENT', 'Authoring requires a Blueprint');
    ensure(Array.isArray(flow.nodes) && flow.nodes.length >= 2 && flow.nodes.length <= MAX_NODES && Array.isArray(flow.edges) && flow.edges.length <= MAX_EDGES, 'INVALID_DOCUMENT', 'Invalid authoring graph size');
    const originals = new Map(), repeats = new Map();
    let totalNodes = 0, internalEdges = 0;
    for (const node of flow.nodes) {
        ensure(isObject(node) && typeof node.id === 'string' && ID.test(node.id), 'INVALID_DOCUMENT', 'Invalid authoring node ID');
        ensure(!originals.has(node.id), 'INVALID_FLOW', 'Duplicate authoring node ID');
        originals.set(node.id, node);
        if (node.type !== 'repeat') {
            totalNodes++;
            continue;
        }
        known(node, ['id', 'type', 'count', 'steps']);
        ensure(Number.isInteger(node.count) && node.count >= 1 && node.count <= 100, 'INVALID_DOCUMENT', 'Repeat count must be 1..100');
        ensure(Array.isArray(node.steps) && node.steps.length >= 1 && node.steps.length <= MAX_NODES, 'INVALID_DOCUMENT', 'Repeat steps must be a non-empty bounded array');
        const stepIds = new Set();
        for (const step of node.steps) {
            ensure(isObject(step) && typeof step.id === 'string' && ID.test(step.id), 'INVALID_DOCUMENT', 'Invalid repeat step ID');
            ensure(['action', 'assertion'].includes(step.type), 'UNSUPPORTED_CAPABILITY', 'Repeat body supports sequential actions and assertions only');
            ensure(!stepIds.has(step.id), 'INVALID_FLOW', 'Duplicate repeat step ID');
            stepIds.add(step.id);
        }
        const count = node.count * node.steps.length;
        totalNodes += count;
        internalEdges += count - 1;
        repeats.set(node.id, node);
        ensure(totalNodes <= MAX_NODES, 'INVALID_DOCUMENT', 'Expanded authoring exceeds 1000 nodes');
    }
    ensure(totalNodes <= MAX_NODES && flow.edges.length + internalEdges <= MAX_EDGES, 'INVALID_DOCUMENT', 'Expanded authoring exceeds graph limits');
    const outgoing = new Map();
    for (const edge of flow.edges) {
        ensure(isObject(edge) && originals.has(edge.from) && originals.has(edge.to), 'INVALID_FLOW', 'Authoring edge must reference a top-level node');
        if (!outgoing.has(edge.from))
            outgoing.set(edge.from, []);
        outgoing.get(edge.from).push(edge);
    }
    for (const id of repeats.keys())
        ensure(outgoing.get(id)?.length === 1 && !Object.hasOwn(outgoing.get(id)[0], 'label'), 'INVALID_FLOW', 'Repeat requires one unlabeled outgoing edge');
    const endpoints = new Map([...repeats].map(([id, node]) => [id, { first: generatedId(id, 1, node.steps[0].id), last: generatedId(id, node.count, node.steps.at(-1).id) }]));
    const edges = flow.edges.map(edge => ({ ...edge, from: endpoints.get(edge.from)?.last ?? edge.from, to: endpoints.get(edge.to)?.first ?? edge.to }));
    const base = { ...source, flow: { ...flow, nodes: [], edges: [] } };
    let outputBytes = byteLength(base) + Math.max(0, totalNodes - 1);
    const generated = new Set(), descriptors = [], mapping = [];
    for (const node of flow.nodes) {
        if (node.type !== 'repeat') {
            outputBytes += byteLength(node);
            descriptors.push({ node, id: node.id });
            mapping.push({ nodeId: node.id, sourceNodeId: node.id });
            continue;
        }
        let previous;
        for (let iteration = 1; iteration <= node.count; iteration++)
            for (const step of node.steps) {
                const id = generatedId(node.id, iteration, step.id);
                ensure(!originals.has(id) && !generated.has(id), 'INVALID_FLOW', 'Generated authoring node ID collision');
                generated.add(id);
                // Only shallow descriptors and edges are allocated before byte limits.
                outputBytes += byteLength({ ...step, id });
                ensure(outputBytes <= MAX_BYTES, 'INVALID_DOCUMENT', 'Expanded Blueprint exceeds 1 MiB');
                descriptors.push({ node: step, id });
                mapping.push({ nodeId: id, sourceNodeId: node.id, sourceStepId: step.id, iteration });
                if (previous)
                    edges.push({ from: previous, to: id });
                previous = id;
            }
    }
    outputBytes += edges.reduce((bytes, edge) => bytes + byteLength(edge), Math.max(0, edges.length - 1));
    ensure(outputBytes <= MAX_BYTES, 'INVALID_DOCUMENT', 'Expanded Blueprint exceeds 1 MiB');
    const expanded = { ...base, flow: { ...base.flow, nodes: descriptors.map(({ node, id }) => structuredClone({ ...node, id })), edges } };
    const plan = compileBlueprint(expanded);
    const sourceMap = freeze({ schemaVersion: 'qa.authoringSourceMap/v1', authoringHash: hash(document), blueprintSnapshotHash: plan.blueprintSnapshotHash, nodes: mapping });
    return Object.freeze({ blueprint: plan.blueprint, sourceMap });
}
