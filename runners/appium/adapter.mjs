import { QaError } from '../../packages/core/errors.mjs';
import { writeFile } from 'node:fs/promises';
import { NATIVE_ACTIONS } from '../../packages/core/domain/actions.mjs';
import { NativeSession } from './session.mjs';
import { NativeElements } from './elements.mjs';
import { performAction } from './actions.mjs';
import { evaluateAssertion } from './assertions.mjs';
import { pngBytes } from './png.mjs';
export class AppiumAdapter {
    #session;
    #containsSecrets = false;
    constructor(config) { this.#session = new NativeSession(config); }
    getCapabilities() { return { platforms: ['android', 'ios'], supportedActions: [...NATIVE_ACTIONS] }; }
    startSession(target, options) { return this.#session.startSession(target, options); }
    endSession() { return this.#session.endSession(); }
    #operations() {
        const request = this.#session.request.bind(this.#session);
        const elements = new NativeElements(request, this.#session.platform, () => this.#session.closing);
        return { request, wait: elements.wait.bind(elements), markSecret: () => { this.#containsSecrets = true; }, abort: () => this.#session.abort(), platform: this.#session.platform };
    }
    performAction(node, context) { return performAction(this.#operations(), node, context); }
    evaluateAssertion(node, context) { return evaluateAssertion(this.#operations(), node, context); }
    async captureEvidence(path, { containsSecrets = false, signal, timeoutMs = 2800 } = {}) {
        if (containsSecrets || this.#containsSecrets)
            return false;
        try {
            if (signal?.aborted || timeoutMs <= 0)
                throw new QaError('EVIDENCE_ERROR', 'Evidence collection interrupted', 'cleanup');
            const encoded = await this.#session.request('GET', '/screenshot', undefined, Math.min(2800, timeoutMs), 'cleanup', 14 * 1024 * 1024);
            if (signal?.aborted)
                throw new QaError('EVIDENCE_ERROR', 'Evidence collection interrupted', 'cleanup');
            await writeFile(path, pngBytes(encoded), { flag: 'wx' });
            return true;
        }
        catch {
            throw new QaError('EVIDENCE_ERROR', 'Unable to capture native evidence', 'cleanup');
        }
    }
}
