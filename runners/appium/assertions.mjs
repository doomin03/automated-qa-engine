import { QaError } from '../../packages/core/errors.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { budget } from './budget.mjs';
import { unsupported, assertionFailure, protocolError } from './errors.mjs';
const encode = encodeURIComponent;
export async function evaluateAssertion({ request, wait, markSecret, abort, platform }, node, { blueprint, timeoutMs = 10000, variables = {}, secretInputs = new Set(), signal } = {}) {
    if (!['assertVisible', 'assertText', 'assertValue'].includes(node.action))
        throw unsupported();
    const remaining = budget(timeoutMs), p = node.params ?? {};
    let expected = p.expected;
    if (p.expectedRef !== undefined) {
        if (node.action !== 'assertValue' || p.expected !== undefined || !Object.hasOwn(variables, p.expectedRef))
            throw new QaError('INVALID_DOCUMENT', 'Native assertion variable is unavailable', 'step');
        expected = String(variables[p.expectedRef]);
        if (secretInputs.has(p.expectedRef))
            markSecret();
    }
    if (node.action !== 'assertVisible' && typeof expected !== 'string')
        throw new QaError('INVALID_DOCUMENT', 'Invalid native assertion expected value', 'step');
    const active = () => { if (signal?.aborted)
        throw signal.reason instanceof QaError ? signal.reason : new QaError(signal.reason?.name === 'TimeoutError' ? 'TIMEOUT' : 'CANCELLED', 'Native assertion interrupted', 'step'); };
    let mismatch = false;
    signal?.addEventListener('abort', abort, { once: true });
    try {
        while (remaining() > 0) {
            active();
            const element = await wait(p.selector, blueprint.selectors, 'visible', remaining, true);
            active();
            if (node.action === 'assertVisible')
                return;
            const suffix = node.action === 'assertText' ? '/text' : `/attribute/${platform === 'android' ? 'text' : 'value'}`;
            const actual = await request('GET', `/element/${encode(element)}${suffix}`, undefined, remaining());
            active();
            if (typeof actual !== 'string' && actual !== null)
                throw protocolError();
            if (actual === expected)
                return;
            mismatch = true;
            if (remaining() > 0)
                await delay(Math.min(50, remaining()), undefined, { signal });
        }
        throw assertionFailure();
    }
    catch (error) {
        active();
        if (error.code === 'ELEMENT_NOT_FOUND')
            throw assertionFailure();
        if (mismatch && error.code === 'TIMEOUT' && remaining() === 0)
            throw assertionFailure();
        throw error;
    }
    finally {
        signal?.removeEventListener('abort', abort);
    }
}
