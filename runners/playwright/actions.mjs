import { QaError } from '../../packages/core/errors.mjs';
import { randomUUID } from 'node:crypto';
export async function performAction(node, ctx, { page, locate, mask, readiness, mapError }) {
    const { blueprint, variables, timeoutMs, secretInputs, resources } = ctx;
    const p = node.params;
    try {
        if (node.action === 'launch') {
            await page.goto(blueprint.target.launchTargets[p.target], { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
            await readiness(blueprint, resources, timeoutMs);
            return;
        }
        if (node.action === 'browserBack') {
            const key = 'aqa_' + randomUUID().replaceAll('-', '');
            await page.evaluate(key => { globalThis[key] = { moved: false }; const onPop = () => { globalThis[key].moved = true; }; globalThis[key].stop = () => removeEventListener('popstate', onPop); addEventListener('popstate', onPop); }, key);
            const response = await page.goBack({ timeout: timeoutMs, waitUntil: 'domcontentloaded' });
            const moved = await page.evaluate(key => { const entry = globalThis[key]; entry?.stop(); delete globalThis[key]; return !!entry?.moved; }, key);
            if (!response && !moved)
                throw new QaError('UNSUPPORTED_CAPABILITY', 'No observable navigation history', 'step');
            if (!blueprint.target.allowedOrigins.includes(new URL(page.url()).origin))
                throw new QaError('POLICY_DENIED', 'History target outside allowed origins', 'step');
            await readiness(blueprint, resources, timeoutMs);
            return;
        }
        if (node.action === 'screenshot')
            return;
        const loc = locate(p.selector, blueprint.selectors);
        if (node.action === 'tap')
            await loc.click({ timeout: timeoutMs });
        else if (node.action === 'input') {
            if (secretInputs.has(p.valueRef))
                mask(loc);
            await loc.fill(p.valueRef ? String(variables[p.valueRef]) : p.value, { timeout: timeoutMs });
        }
        else if (node.action === 'clear')
            await loc.fill('', { timeout: timeoutMs });
        else if (node.action === 'waitFor')
            await loc.waitFor({ state: p.state || 'visible', timeout: timeoutMs });
        else
            throw new QaError('UNSUPPORTED_CAPABILITY', 'Unsupported action', 'step');
    }
    catch (error) {
        throw mapError(error, 'action');
    }
}
