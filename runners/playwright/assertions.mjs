import { QaError } from '../../packages/core/errors.mjs';
import { CHECK_ACTIONS } from './observations.mjs';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
export async function evaluateAssertion(node, ctx, { locate, mapError, observe }) {
    const { blueprint, timeoutMs, variables, signal } = ctx;
    const deadline = performance.now() + timeoutMs;
    const active = () => { if (signal?.aborted)
        throw signal.reason instanceof QaError ? signal.reason : new QaError(signal.reason?.name === 'TimeoutError' ? 'TIMEOUT' : 'CANCELLED', 'Assertion interrupted', 'step'); };
    const remaining = () => { active(); const value = Math.ceil(deadline - performance.now()); if (value <= 0)
        throw new QaError('ASSERTION_FAILED', 'Assertion did not match expected value', 'step'); return value; };
    try {
        if (CHECK_ACTIONS.includes(node.action))
            return await observe(node, ctx);
        const loc = locate(node.params.selector, blueprint.selectors);
        const expected = node.params.expectedRef ? String(variables[node.params.expectedRef]) : node.params.expected;
        for (;;) {
            await loc.waitFor({ state: 'visible', timeout: remaining() });
            active();
            if (node.action === 'assertVisible')
                return;
            const actual = node.action === 'assertValue' ? await loc.inputValue({ timeout: remaining() }) : await loc.innerText({ timeout: remaining() });
            active();
            if (actual === expected)
                return;
            await delay(Math.min(50, remaining()), undefined, { signal });
        }
    }
    catch (error) {
        active();
        throw mapError(error, 'assertion');
    }
}
