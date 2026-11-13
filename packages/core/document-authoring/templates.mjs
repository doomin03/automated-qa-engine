import { createHash } from 'node:crypto';
import { canonicalJson } from '../domain/canonical.mjs';
import { frozenSnapshot } from '../domain/immutable.mjs';
import { AUTHORING_VERSION, templateDefinitions } from './contract.mjs';
import { authoringInput, validateAuthoring, validateBindings, reject } from './validation.mjs';
import { authoredResult } from './result.mjs';

const catalog = {
    authoringContractVersion: AUTHORING_VERSION,
    templates: templateDefinitions.map(t => ({ ...t, sha256: createHash('sha256').update(canonicalJson(t)).digest('hex') })),
};
export function listTemplates() {
    return frozenSnapshot(validateAuthoring('catalog', catalog));
}
export function createTemplate(request) {
    authoringInput('templateRequest', request);
    const t = catalog.templates.find(t => t.id === request.templateId && t.version === request.version && t.sha256 === request.sha256);
    if (!t) reject('TEMPLATE_PIN', '/templateId', 'Unknown template id, version or SHA-256');
    validateBindings(t.id, request.bindings);
    const b = structuredClone(request.bindings);
    if (!t.supportedPlatforms.includes(b.target.platform)) reject('TEMPLATE_PLATFORM', '/bindings/target/platform', 'Template does not support this platform', {}, 'UNSUPPORTED_CAPABILITY');
    const actions = t.id === 'empty' ? [] : t.id === 'native-open-check'
        ? [['launch', { target: b.launch }], ['assertVisible', { selector: b.selector }]]
        : [['launch', { target: b.launch }], ['waitFor', { selector: b.selector }], ...(t.id === 'web-open-click'
            ? [['tap', { selector: b.selector }]]
            : [['input', { selector: b.selector, value: b.value }], ['assertValue', { selector: b.selector, expected: b.value }]])];
    const nodes = [{ id: 'start', type: 'start' }, ...actions.map(([action, params], i) => ({ id: 'step' + (i + 1), type: action.startsWith('assert') ? 'assertion' : 'action', action, params })), { id: 'end', type: 'end' }];
    const blueprint = {
        schemaVersion: 'qa.blueprint/v1', id: b.id, target: b.target,
        selectors: b.selectors || { schemaVersion: 'qa.selectors/v1', id: b.id, selectors: {} },
        flow: { schemaVersion: 'qa.flow/v1', id: b.id, entryNode: 'start', nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })) },
    };
    if (t.id === 'web-input-check' && typeof b.value === 'object') {
        blueprint.flow.variables = { templateInput: { from: 'secret', ref: b.value.secretRef } };
        nodes.find(n => n.action === 'input').params = { selector: b.selector, valueRef: 'templateInput' };
        nodes.find(n => n.action === 'assertValue').params = { selector: b.selector, expectedRef: 'templateInput' };
    }
    return authoredResult(blueprint, { template: { id: t.id, version: t.version, sha256: t.sha256 } });
}
