import { QaError, ensure } from '../errors.mjs';
export function validateAssignments(flow, nodes, order) {
    const assigned = new Map(), initial = new Set(Object.entries(flow.variables || {}).filter(([, v]) => v.from !== 'capture').map(([name]) => name));
    for (const id of order) {
        const predecessors = flow.edges.filter(e => e.to === id).map(e => assigned.get(e.from));
        const before = predecessors.length ? new Set([...predecessors[0]].filter(name => predecessors.every(set => set.has(name)))) : new Set(initial);
        const node = nodes.get(id), reads = [node.params?.valueRef, node.params?.expectedRef, node.condition?.variable].filter(Boolean);
        ensure(reads.every(name => before.has(name)), 'INVALID_FLOW', 'Variable is not initialized on every incoming path');
        if (['captureText', 'captureValue'].includes(node.action))
            before.add(node.params.variable);
        assigned.set(id, before);
    }
}
export function resolveVariables(plan, secretResolver = () => undefined) {
    const values = Object.create(null);
    for (const [name, variable] of Object.entries(plan.blueprint.flow.variables || {})) {
        if (variable.from === 'capture')
            continue;
        const value = variable.from === 'literal' ? variable.value : secretResolver(variable.ref);
        ensure(variable.from === 'literal' || (value !== undefined && value !== null), 'SECRET_NOT_FOUND', 'Required secret is unavailable');
        values[name] = value;
    }
    return values;
}
