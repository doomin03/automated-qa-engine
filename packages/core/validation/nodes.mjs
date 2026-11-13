import { QaError, ensure } from '../errors.mjs';
import { ACTIONS, NATIVE_ACTIONS } from '../domain/actions.mjs';
const own = (o, k) => Object.hasOwn(o || {}, k);
export function validateNodes(flow, selectors, target, references) {
    const nodes = new Map();
    for (const node of flow.nodes) {
        ensure(!nodes.has(node.id), 'INVALID_FLOW', 'Duplicate node: ' + node.id);
        nodes.set(node.id, node);
        if (node.action)
            ensure((target.platform === 'web' ? ACTIONS : NATIVE_ACTIONS).includes(node.action), 'UNSUPPORTED_CAPABILITY', 'Unsupported action for target');
        if (node.params?.selector) {
            ensure(own(selectors.selectors, node.params.selector), 'INVALID_FLOW', 'Missing selector: ' + node.params.selector);
            ensure(selectors.selectors[node.params.selector][target.platform], 'UNSUPPORTED_CAPABILITY', 'Selector lacks target locator');
        }
        if (node.action === 'launch')
            ensure(own(target.launchTargets, node.params.target), 'INVALID_FLOW', 'Missing launch target');
        if (['assertImage', 'assertLayout'].includes(node.action)) {
            const reference = references.get(node.params.reference);
            ensure(reference, 'INVALID_FLOW', 'Missing design reference');
            ensure((node.action === 'assertImage' ? reference.images : reference.measurementRules).some(v => v.id === (node.params.image || node.params.rule)), 'INVALID_FLOW', 'Missing reference entry');
        }
        if (node.params?.valueRef)
            ensure(own(flow.variables, node.params.valueRef), 'INVALID_FLOW', 'Missing variable reference');
        if (node.params?.expectedRef)
            ensure(own(flow.variables, node.params.expectedRef), 'INVALID_FLOW', 'Missing expected variable reference');
        if (['captureText', 'captureValue'].includes(node.action))
            ensure(flow.variables?.[node.params.variable]?.from === 'capture', 'INVALID_FLOW', 'Capture requires declared public captured variable');
        if (node.type === 'branch') {
            ensure(own(flow.variables, node.condition.variable), 'INVALID_FLOW', 'Missing branch variable');
            ensure(flow.variables[node.condition.variable].from !== 'secret', 'INVALID_FLOW', 'Branch conditions cannot reveal secrets');
        }
        if ((node.retry?.maxRetries || 0) > 0 && ['launch', 'tap', 'input', 'clear', 'browserBack', 'mobileBack', 'hideKeyboard'].includes(node.action)) {
            ensure(node.retry.allowSideEffects === true, 'POLICY_DENIED', 'Side-effect retry requires allowSideEffects');
        }
    }
    return nodes;
}
