import { QaError } from '../../packages/core/errors.mjs';
import { protocolError } from './errors.mjs';
export { protocolError, configurationError } from './errors.mjs';
export { validateConfiguration } from './configuration.mjs';
const JSON_LIMIT = 1024 * 1024, BODY_LIMIT = 64 * 1024;
export class AppiumTransport {
    #endpoint;
    #timeout;
    #active = new Set();
    constructor(endpoint, timeout) { this.#endpoint = endpoint; this.#timeout = timeout; }
    abort() { for (const controller of this.#active)
        controller.abort(); }
    async request(method, path, body, { timeoutMs = this.#timeout, phase = 'step', limit = JSON_LIMIT } = {}) {
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
            throw new QaError('TIMEOUT', 'Appium operation deadline exceeded', phase);
        const controller = new AbortController();
        let timedOut = false;
        const deadlineLimited = timeoutMs <= this.#timeout;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(timeoutMs, this.#timeout));
        this.#active.add(controller);
        let reader;
        try {
            const encoded = body === undefined ? undefined : JSON.stringify(body);
            if (encoded && Buffer.byteLength(encoded) > BODY_LIMIT)
                throw new QaError('INVALID_DOCUMENT', 'Appium request exceeds size limit', phase);
            const response = await fetch(this.#endpoint + path, { method, headers: { accept: 'application/json', ...(encoded ? { 'content-type': 'application/json' } : {}) }, body: encoded, signal: controller.signal, redirect: 'error' });
            const length = response.headers.get('content-length');
            if (length && Number(length) > limit) {
                await response.body?.cancel();
                throw protocolError(phase);
            }
            reader = response.body?.getReader();
            if (!reader)
                throw protocolError(phase);
            const chunks = [];
            let size = 0;
            for (;;) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                size += value.byteLength;
                if (size > limit) {
                    await reader.cancel();
                    throw protocolError(phase);
                }
                chunks.push(value);
            }
            const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
            if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'value'))
                throw protocolError(phase);
            const value = payload.value;
            if (!response.ok || (value && typeof value === 'object' && typeof value.error === 'string')) {
                const code = value?.error;
                if (['unknown command', 'unsupported operation', 'unknown method'].includes(code))
                    throw new QaError('UNSUPPORTED_CAPABILITY', 'Appium driver does not support this operation', phase);
                if (['no such element', 'stale element reference'].includes(code))
                    throw new QaError('ELEMENT_NOT_FOUND', 'Native element is unavailable', phase);
                if (code === 'invalid session id')
                    throw new QaError('RUNNER_CRASH', 'Appium session is unavailable', phase);
                throw protocolError(phase);
            }
            return value;
        }
        catch (error) {
            if (error instanceof QaError)
                throw error;
            if (timedOut && deadlineLimited)
                throw new QaError('TIMEOUT', 'Appium operation deadline exceeded', phase);
            throw protocolError(phase);
        }
        finally {
            clearTimeout(timer);
            this.#active.delete(controller);
            reader?.releaseLock();
        }
    }
}
