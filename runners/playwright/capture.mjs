import { QaError } from '../../packages/core/errors.mjs';
export async function capturePublicValue(adapter, node, { blueprint, timeoutMs }) {
    const locator = adapter.locator(node.params.selector, blueprint.selectors), count = await locator.count();
    if (!count)
        throw new QaError('ELEMENT_NOT_FOUND', 'Capture element is missing', 'step');
    if (count !== 1)
        throw new QaError('UNSUPPORTED_CAPABILITY', 'Capture selector is ambiguous', 'step');
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    const result = await locator.evaluate((element, action) => {
        const sensitive = 'input[type="password" i],[autocomplete~="current-password" i],[autocomplete~="new-password" i],[autocomplete~="one-time-code" i],[data-qa-sensitive]';
        if (element.getRootNode() !== document || ['CANVAS', 'IFRAME'].includes(element.tagName))
            return { blocked: 'UNSUPPORTED_CAPTURE_ELEMENT' };
        let ancestor = element, ancestorCount = 0;
        while (ancestor) {
            if (++ancestorCount > 128)
                return { blocked: 'CAPTURE_LIMIT' };
            if (ancestor.matches(sensitive))
                return { blocked: 'SENSITIVE_CAPTURE_SOURCE' };
            ancestor = ancestor.parentElement;
        }
        if (action === 'captureValue' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
            return { blocked: 'UNSUPPORTED_CAPTURE_VALUE' };
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
        let current = element, visited = 0, value = '';
        while (current) {
            if (++visited > 10000)
                return { blocked: 'CAPTURE_LIMIT' };
            if (current.nodeType === Node.ELEMENT_NODE && current.matches(sensitive))
                return { blocked: 'SENSITIVE_CAPTURE_SOURCE' };
            if (action === 'captureText' && current.nodeType === Node.TEXT_NODE) {
                let visible = true, parent = current.parentElement, depth = 0;
                while (parent) {
                    if (++depth > 128)
                        return { blocked: 'CAPTURE_LIMIT' };
                    const style = getComputedStyle(parent);
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
                        visible = false;
                        break;
                    }
                    if (parent === element)
                        break;
                    parent = parent.parentElement;
                }
                if (visible) {
                    if (value.length + current.data.length > 16384)
                        return { blocked: 'CAPTURE_LIMIT' };
                    value += current.data;
                }
            }
            current = walker.nextNode();
        }
        if (action === 'captureValue') {
            value = element.value;
            if (typeof value !== 'string' || value.length > 16384)
                return { blocked: 'CAPTURE_LIMIT' };
        }
        return { value };
    }, node.action);
    if (result.blocked)
        throw new QaError('UNSUPPORTED_CAPABILITY', result.blocked, 'step');
    return result.value;
}
