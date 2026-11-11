import { validateSchema } from './schema.mjs';
import { ensure } from './errors.mjs';
import { ENGINE_VERSION } from './domain/version.mjs';
import { hash } from './domain/canonical.mjs';
import { freezeOwned } from './domain/immutable.mjs';
import { validateTarget } from './validation/target.mjs';
import { validateReferences } from './validation/references.mjs';
import { validateNodes } from './validation/nodes.mjs';
import { validateGraph } from './validation/graph.mjs';
import { validateAssignments } from './validation/variables.mjs';
// Compatibility exports: internal consumers use the leaf modules directly.
export { ENGINE_VERSION } from './domain/version.mjs';
export { ACTIONS, NATIVE_ACTIONS } from './domain/actions.mjs';
export { canonicalJson, hash } from './domain/canonical.mjs';
export { resolveVariables } from './validation/variables.mjs';
export function compileBlueprint(document) {
    // Preserve the public first-error order, including nested validation.
    for (const part of [document, document?.flow, document?.selectors, document?.target, document?.testCase].filter(Boolean))
        validateSchema(part);
    ensure(document.schemaVersion === 'qa.blueprint/v1', 'INVALID_DOCUMENT', 'A blueprint is required');
    const b = structuredClone(document), { flow, selectors, target } = b;
    validateTarget(b);
    const hasCaptures = flow.nodes.some(n => ['captureText', 'captureValue'].includes(n.action));
    ensure(!hasCaptures || !Object.values(flow.variables || {}).some(v => v.from === 'secret'), 'POLICY_DENIED', 'Captures cannot be combined with secret variables');
    const references = validateReferences(b);
    const nodes = validateNodes(flow, selectors, target, references);
    const order = validateGraph(flow, nodes);
    validateAssignments(flow, nodes, order);
    const secretRefs = [...new Set(Object.values(flow.variables || {}).filter(v => v.from === 'secret').map(v => v.ref))];
    return freezeOwned({ schemaVersion: 'qa.plan/v1', engineVersion: ENGINE_VERSION, blueprint: b, entryNode: flow.entryNode, nodeOrder: order, requiredActions: [...new Set(flow.nodes.flatMap(n => n.action ? [n.action] : []))], secretRefs, flowSnapshotHash: hash(flow), blueprintSnapshotHash: hash(b) });
}
