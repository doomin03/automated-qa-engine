import { QaError } from '../../packages/core/errors.mjs';
import { AppiumTransport } from './transport.mjs';
import { validateConfiguration } from './configuration.mjs';
import { configurationError, protocolError, unsupported } from './errors.mjs';
import { budget } from './budget.mjs';
const encode = encodeURIComponent;
export class NativeSession {
    #config;
    #transport;
    #sessionId;
    #platform;
    #closing = false;
    #started = false;
    #cleanup;
    #creationAttempted = false;
    constructor(config) {
        this.#config = validateConfiguration(config);
        this.#transport = new AppiumTransport(this.#config.endpoint, this.#config.requestTimeoutMs);
    }
    get platform() { return this.#platform; }
    get closing() { return this.#closing; }
    abort() { this.#transport.abort(); }
    async startSession(target, { timeoutMs = 30000 } = {}) {
        if (this.#started || this.#closing)
            throw new QaError('SESSION_ERROR', 'Appium adapter cannot reopen a session', 'session');
        if (!['android', 'ios'].includes(target?.platform))
            throw unsupported();
        const expected = target.platform === 'android' ? 'UiAutomator2' : 'XCUITest';
        const platformName = target.platform === 'android' ? 'Android' : 'iOS';
        const caps = this.#config.capabilities;
        if (caps['appium:automationName'] !== expected || (caps.platformName !== undefined && caps.platformName !== platformName))
            throw configurationError();
        this.#started = true;
        this.#platform = target.platform;
        const remaining = budget(timeoutMs);
        this.#creationAttempted = true;
        const value = await this.#transport.request('POST', '/session', { capabilities: { alwaysMatch: { ...caps, platformName }, firstMatch: [{}] } }, { timeoutMs: remaining(), phase: 'session' });
        if (!value || typeof value.sessionId !== 'string' || !value.sessionId || value.sessionId.length > 1024)
            throw protocolError('session');
        this.#sessionId = value.sessionId;
        if (this.#closing) {
            await this.#deleteSession();
            throw protocolError('session');
        }
        // Native driver implicit waits must not multiply the node's polling budget.
        await this.request('POST', '/timeouts', { implicit: 0 }, remaining(), 'session');
    }
    request(method, path, body, timeoutMs = 30000, phase = 'step', limit) {
        if (this.#closing || !this.#sessionId)
            return Promise.reject(new QaError('RUNNER_CRASH', 'Appium session is unavailable', phase));
        if (timeoutMs <= 0)
            return Promise.reject(new QaError('TIMEOUT', 'Appium operation deadline exceeded', phase));
        return this.#transport.request(method, `/session/${encode(this.#sessionId)}${path}`, body, { timeoutMs, phase, ...(limit ? { limit } : {}) });
    }
    async #deleteSession() {
        const id = this.#sessionId;
        if (!id) {
            if (this.#creationAttempted)
                throw new QaError('CLEANUP_ERROR', 'Appium session creation or deletion is unconfirmed', 'cleanup');
            return;
        }
        this.#sessionId = undefined;
        try {
            await this.#transport.request('DELETE', `/session/${encode(id)}`, undefined, { timeoutMs: 4000, phase: 'cleanup' });
            this.#creationAttempted = false;
        }
        catch {
            throw new QaError('CLEANUP_ERROR', 'Unable to close Appium session', 'cleanup');
        }
    }
    async endSession() {
        if (this.#cleanup)
            return this.#cleanup;
        this.#closing = true;
        this.#transport.abort();
        this.#cleanup = this.#deleteSession();
        return this.#cleanup;
    }
}
