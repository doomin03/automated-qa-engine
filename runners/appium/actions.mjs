import { QaError } from '../../packages/core/errors.mjs';
import { budget } from './budget.mjs';
import { unsupported, assertionFailure, protocolError } from './errors.mjs';
const encode = encodeURIComponent;
export async function performAction({ request, wait, markSecret }, node, { blueprint, variables = {}, timeoutMs = 10000, secretInputs = new Set() } = {}) {
    const p = node.params ?? {}, remaining = budget(timeoutMs);
    if (node.action === 'launch') {
        const appId = blueprint?.target?.launchTargets?.[p.target];
        if (typeof appId !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$/.test(appId))
            throw new QaError('INVALID_DOCUMENT', 'Invalid native launch target', 'step');
        await request('POST', '/appium/device/activate_app', { appId }, remaining());
        return;
    }
    if (node.action === 'mobileBack') {
        await request('POST', '/back', {}, remaining());
        return;
    }
    if (node.action === 'hideKeyboard') {
        const hidden = await request('POST', '/appium/device/hide_keyboard', {}, remaining());
        if (hidden === false)
            throw assertionFailure();
        if (hidden !== true && hidden !== null)
            throw protocolError();
        return;
    }
    if (node.action === 'screenshot')
        return; // Core owns evidence persistence and policy.
    if (!['tap', 'input', 'clear', 'waitFor'].includes(node.action))
        throw unsupported();
    if (node.action === 'waitFor') {
        await wait(p.selector, blueprint.selectors, p.state ?? 'visible', remaining);
        return;
    }
    const element = await wait(p.selector, blueprint.selectors, 'visible', remaining);
    const path = `/element/${encode(element)}`;
    if (node.action === 'tap') {
        await request('POST', path + '/click', {}, remaining());
        return;
    }
    let text;
    if (node.action === 'input') {
        if (p.valueRef !== undefined) {
            if (!Object.hasOwn(variables, p.valueRef))
                throw new QaError('INVALID_DOCUMENT', 'Native input variable is unavailable', 'step');
            text = String(variables[p.valueRef]);
            if (secretInputs.has(p.valueRef))
                markSecret();
        }
        else
            text = p.value;
        if (typeof text !== 'string' || Buffer.byteLength(JSON.stringify({ text })) > 64 * 1024)
            throw new QaError('INVALID_DOCUMENT', 'Invalid native input value', 'step');
    }
    await request('POST', path + '/clear', {}, remaining());
    if (node.action === 'input')
        await request('POST', path + '/value', { text }, remaining());
}
