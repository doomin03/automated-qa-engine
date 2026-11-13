import { QaError } from '../../packages/core/errors.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { protocolError, unsupported, assertionFailure } from './errors.mjs';
const ELEMENT = 'element-6066-11e4-a52e-4f735466cecf';
const encode = encodeURIComponent;
export class NativeElements {
    constructor(request, platform, isClosing) { this.request = request; this.platform = platform; this.isClosing = isClosing; }
    async find(alias, selectors, timeoutMs) {
        const locator = selectors?.selectors?.[alias]?.[this.platform];
        const using = { accessibilityId: 'accessibility id', id: 'id', xpath: 'xpath' }[locator?.strategy];
        if (!using || typeof locator.value !== 'string' || !locator.value)
            throw unsupported();
        const elements = await this.request('POST', '/elements', { using, value: locator.value }, timeoutMs);
        if (!Array.isArray(elements))
            throw protocolError();
        if (elements.length > 1)
            throw new QaError('UNSUPPORTED_CAPABILITY', 'Native selector is ambiguous', 'step');
        if (!elements.length)
            return undefined;
        const id = elements[0]?.[ELEMENT];
        if (typeof id !== 'string' || !id || id.length > 1024)
            throw protocolError();
        return id;
    }
    async wait(alias, selectors, state, remaining, assertion = false) {
        if (!['visible', 'hidden', 'attached', 'detached'].includes(state))
            throw unsupported();
        while (remaining() > 0) {
            let element, visible = false;
            try {
                element = await this.find(alias, selectors, remaining());
                if (element && ['visible', 'hidden'].includes(state)) {
                    visible = await this.request('GET', `/element/${encode(element)}/displayed`, undefined, remaining());
                    if (typeof visible !== 'boolean')
                        throw protocolError();
                }
            }
            catch (error) {
                if (error.code !== 'ELEMENT_NOT_FOUND')
                    throw error;
                element = undefined;
            }
            const ready = state === 'attached' ? !!element : state === 'detached' ? !element : state === 'visible' ? !!element && visible : !element || !visible;
            if (ready)
                return element;
            if (this.isClosing())
                throw new QaError('RUNNER_CRASH', 'Appium session is unavailable', 'step');
            if (remaining() > 0)
                await delay(Math.min(50, remaining()));
        }
        throw assertion ? assertionFailure() : new QaError('ELEMENT_NOT_FOUND', 'Native element condition was not met before timeout', 'step');
    }
}
