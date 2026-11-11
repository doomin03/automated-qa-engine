import { QaError } from '../../packages/core/errors.mjs';
export function resolveLocator(page, alias, selectors) {
    const s = selectors.selectors[alias].web;
    switch (s.strategy) {
        case 'testId': return page.getByTestId(s.value);
        case 'text': return page.getByText(s.value, { exact: true });
        case 'role': return page.getByRole(s.value, { ...(s.name ? { name: s.name } : {}) });
        case 'css': return page.locator(s.value);
        default: throw new QaError('UNSUPPORTED_CAPABILITY', 'Unsupported selector strategy', 'step');
    }
}
