import { QaError, ensure } from '../errors.mjs';
export function validateGraph(flow, nodes) {
    ensure(nodes.get(flow.entryNode)?.type === 'start', 'INVALID_FLOW', 'entryNode must be a start');
    ensure(flow.nodes.filter(n => n.type === 'start').length === 1, 'INVALID_FLOW', 'Exactly one start is required');
    const outgoing = new Map(flow.nodes.map(n => [n.id, []]));
    const edgeKeys = new Set();
    for (const edge of flow.edges) {
        ensure(nodes.has(edge.from) && nodes.has(edge.to), 'INVALID_FLOW', 'Dangling edge');
        ensure(edge.to !== flow.entryNode, 'INVALID_FLOW', 'An edge cannot enter start');
        const key = edge.from + '|' + edge.to + '|' + (edge.label || '');
        ensure(!edgeKeys.has(key), 'INVALID_FLOW', 'Duplicate edge');
        edgeKeys.add(key);
        outgoing.get(edge.from).push(edge);
    }
    for (const node of flow.nodes) {
        const edges = outgoing.get(node.id);
        if (node.type === 'end')
            ensure(edges.length === 0, 'INVALID_FLOW', 'End cannot have outgoing edges');
        else if (node.type === 'branch')
            ensure(edges.length === 2 && new Set(edges.map(e => e.label)).size === 2 && edges.every(e => ['true', 'false'].includes(e.label)), 'INVALID_FLOW', 'Branch requires true and false edges');
        else
            ensure(edges.length === 1 && !edges[0].label, 'INVALID_FLOW', 'Node requires one unlabeled edge');
    }
    const active = new Set(), visited = new Set(), order = [];
    const visit = id => {
        ensure(!active.has(id), 'INVALID_FLOW', 'Cycle detected');
        if (visited.has(id))
            return;
        active.add(id);
        for (const edge of outgoing.get(id))
            visit(edge.to);
        active.delete(id);
        visited.add(id);
        order.unshift(id);
    };
    visit(flow.entryNode);
    ensure(visited.size === nodes.size, 'INVALID_FLOW', 'Unreachable nodes');
    return order;
}
