import { createHash } from 'node:crypto';
import { compileBlueprint } from './compiler.mjs';
import { canonicalJson } from './domain/canonical.mjs';
import { validateSchema } from './schema.mjs';
import { ensure } from './errors.mjs';
const specs = [{ id: 'web-input', inputBindings: ['id', 'target', 'selectors', 'launch', 'selector', 'value'], template: ['launch', 'assertInViewport', 'assertHitTarget', 'tap', 'assertFocused', 'input', 'assertValue'] }, { id: 'web-history-back', inputBindings: ['id', 'target', 'selectors', 'from', 'to', 'expectedUrl', 'expectedSelector'], template: ['launch', 'launch', 'browserBack', 'assertUrl', 'assertVisible'] }];
export function listPresets() { return specs.map(s => { const p = { schemaVersion: 'qa.checkPreset/v1', ...s, version: '1.0.0', requiredCapabilities: [...new Set(s.template)] }; return validateSchema({ ...p, sha256: createHash('sha256').update(canonicalJson(p)).digest('hex') }); }); }
export function expandPreset(id, version, bindings) {
    const preset = listPresets().find(p => p.id === id && p.version === version);
    ensure(preset, 'INVALID_DOCUMENT', 'Unknown preset id/version');
    ensure(bindings && typeof bindings === 'object' && !Array.isArray(bindings), 'INVALID_DOCUMENT', 'Preset bindings required');
    ensure(preset.inputBindings.every(k => Object.hasOwn(bindings, k)) && Object.keys(bindings).every(k => preset.inputBindings.includes(k)), 'INVALID_DOCUMENT', 'Missing or unknown preset binding');
    const b = structuredClone(bindings), actions = id === 'web-input' ? [['launch', { target: b.launch }], ['assertInViewport', { selector: b.selector }], ['assertHitTarget', { selector: b.selector }], ['tap', { selector: b.selector }], ['assertFocused', { selector: b.selector }], ['input', { selector: b.selector, value: b.value }], ['assertValue', { selector: b.selector, expected: b.value }]] : [['launch', { target: b.from }], ['launch', { target: b.to }], ['browserBack', {}], ['assertUrl', { expected: b.expectedUrl }], ['assertVisible', { selector: b.expectedSelector }]];
    const nodes = [{ id: 'start', type: 'start' }, ...actions.map(([action, params], i) => ({ id: 'check' + (i + 1), type: action.startsWith('assert') ? 'assertion' : 'action', action, params })), { id: 'end', type: 'end' }];
    const blueprint = { schemaVersion: 'qa.blueprint/v1', id: b.id, target: b.target, selectors: b.selectors, flow: { schemaVersion: 'qa.flow/v1', id: b.id + '.flow', entryNode: 'start', nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })), metadata: { preset: { id, version, sha256: preset.sha256 }, coverage: 'Only explicitly bound targets and selectors' } } };
    if (id === 'web-input' && typeof b.value === 'object' && b.value !== null) {
        ensure(Object.keys(b.value).length === 1 && typeof b.value.secretRef === 'string', 'INVALID_DOCUMENT', 'Secret binding requires only secretRef');
        blueprint.flow.variables = { presetInput: { from: 'secret', ref: b.value.secretRef } };
        blueprint.flow.nodes.find(n => n.action === 'input').params = { selector: b.selector, valueRef: 'presetInput' };
        blueprint.flow.nodes.find(n => n.action === 'assertValue').params = { selector: b.selector, expectedRef: 'presetInput' };
    }
    compileBlueprint(blueprint);
    return blueprint;
}
