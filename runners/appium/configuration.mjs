import { configurationError } from './errors.mjs';
const BODY_LIMIT = 64 * 1024;
export function validateConfiguration(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config))
        throw configurationError();
    const { endpoint, capabilities, requestTimeoutMs = 30000, allowRemoteEndpoint = false } = config;
    if (Object.keys(config).some(key => !['endpoint', 'capabilities', 'requestTimeoutMs', 'allowRemoteEndpoint'].includes(key)) || typeof endpoint !== 'string' || typeof allowRemoteEndpoint !== 'boolean')
        throw configurationError();
    let url;
    try {
        url = new URL(endpoint);
    }
    catch {
        throw configurationError();
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (!loopback && (!allowRemoteEndpoint || url.protocol !== 'https:')))
        throw configurationError();
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 300000)
        throw configurationError();
    if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities) || ![Object.prototype, null].includes(Object.getPrototypeOf(capabilities)))
        throw configurationError();
    let encoded;
    try {
        encoded = JSON.stringify(capabilities);
    }
    catch {
        throw configurationError();
    }
    if (Buffer.byteLength(encoded) > BODY_LIMIT)
        throw configurationError();
    const copy = JSON.parse(encoded);
    for (const key of ['appium:automationName', 'appium:udid', 'appium:deviceName']) {
        if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 1024)
            throw configurationError();
    }
    // Source scenarios cannot install packages, select browsers, or execute code.
    for (const key of ['app', 'appium:app', 'browserName', 'appium:options', 'appium:autoWebview', 'appium:otherApps', 'appium:chromedriverExecutable', 'appium:chromedriverArgs']) {
        if (Object.hasOwn(copy, key))
            throw configurationError();
    }
    const idle = copy['appium:newCommandTimeout'] ?? 60;
    if (!Number.isInteger(idle) || idle < 1 || idle > 300)
        throw configurationError();
    copy['appium:newCommandTimeout'] = idle;
    return { endpoint: url.href.replace(/\/+$/, ''), capabilities: copy, requestTimeoutMs };
}
