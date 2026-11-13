import { QaError } from '../../packages/core/errors.mjs';
import { ACTIONS } from '../../packages/core/domain/actions.mjs';
import { BrowserSession } from './session.mjs';
import { resolveLocator } from './locator.mjs';
import { performAction } from './actions.mjs';
import { evaluateAssertion } from './assertions.mjs';
import { observe, applyReadiness } from './observations.mjs';
import { capturePublicValue } from './capture.mjs';
export class PlaywrightAdapter extends BrowserSession {
    getCapabilities() { return { platforms: ['web'], supportedActions: ACTIONS }; }
    locator(alias, selectors) { return resolveLocator(this.page, alias, selectors); }
    async performAction(node, ctx) { return performAction(node, ctx, { page: this.page, locate: this.locator.bind(this), mask: loc => this.secretMasks.push(loc), readiness: (...args) => applyReadiness(this, ...args), mapError: this.mapError.bind(this) }); }
    async evaluateAssertion(node, ctx) { return evaluateAssertion(node, ctx, { locate: this.locator.bind(this), mapError: this.mapError.bind(this), observe: (...args) => observe(this, ...args) }); }
    mapError(error, kind) {
        if (error instanceof QaError)
            return error;
        if (!this.browser?.isConnected())
            return new QaError('RUNNER_CRASH', 'Browser disconnected', 'step');
        if (error.name === 'TimeoutError')
            return new QaError(kind === 'assertion' ? 'ASSERTION_FAILED' : 'ELEMENT_NOT_FOUND', 'Element condition was not met before timeout', 'step');
        return new QaError('SESSION_ERROR', 'Browser operation failed', 'step');
    }
    async capture(node, context) {
        try {
            return await capturePublicValue(this, node, context);
        }
        catch (error) {
            throw this.mapError(error, 'action');
        }
    }
    async captureEvidence(path, { containsSecrets = false, signal, timeoutMs = 3000 } = {}) {
        if (!this.page || this.page.isClosed())
            throw new QaError('EVIDENCE_ERROR', 'Page is unavailable', 'cleanup');
        // An app may echo secrets outside inputs; disable screenshots for secret runs.
        if (containsSecrets)
            return false;
        if (signal?.aborted)
            throw new QaError('EVIDENCE_ERROR', 'Evidence collection interrupted', 'cleanup');
        await this.page.screenshot({ path, fullPage: true, timeout: Math.max(1, Math.min(3000, timeoutMs)), mask: [this.page.locator('input[type=password]'), ...this.secretMasks] });
        if (signal?.aborted)
            throw new QaError('EVIDENCE_ERROR', 'Evidence collection interrupted', 'cleanup');
        return true;
    }
}
