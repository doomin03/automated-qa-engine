import { QaError, ensure } from '../errors.mjs';
import { hash } from '../domain/canonical.mjs';
const own = (o, k) => Object.hasOwn(o || {}, k);
export function validateReferences(b) {
    const { target, selectors } = b;
    const references = new Map();
    if (target.profile) {
        ensure(own(selectors.selectors, target.profile.readiness.selector), 'INVALID_FLOW', 'Missing readiness selector');
        ensure(selectors.selectors[target.profile.readiness.selector].web, 'UNSUPPORTED_CAPABILITY', 'Readiness requires web locator');
        ensure(target.profile.viewport.width * target.profile.viewport.height * target.profile.dpr ** 2 <= 16777216, 'INVALID_DOCUMENT', 'Profile exceeds pixel budget');
    }
    for (const reference of b.references || []) {
        ensure(!references.has(reference.id), 'INVALID_DOCUMENT', 'Duplicate reference');
        references.set(reference.id, reference);
        ensure(target.profile && hash(reference.profile) === hash(target.profile), 'INVALID_DOCUMENT', 'Reference and target profiles must match');
        for (const list of [reference.images, reference.measurementRules])
            ensure(new Set(list.map(i => i.id)).size === list.length, 'INVALID_DOCUMENT', 'Duplicate reference entry');
        for (const rule of reference.measurementRules) {
            ensure(own(selectors.selectors, rule.selectorId), 'INVALID_FLOW', 'Missing measurement selector');
            ensure(selectors.selectors[rule.selectorId].web, 'UNSUPPORTED_CAPABILITY', 'Measurement requires web locator');
            ensure(!rule.otherSelectorId || own(selectors.selectors, rule.otherSelectorId), 'INVALID_FLOW', 'Missing secondary measurement selector');
            ensure(!rule.metric.startsWith('gap.') || rule.otherSelectorId, 'INVALID_DOCUMENT', 'Gap requires a secondary selector');
        }
        for (const image of reference.images)
            if (image.region !== 'viewport')
                ensure(image.region.x + image.region.width <= target.profile.viewport.width && image.region.y + image.region.height <= target.profile.viewport.height, 'INVALID_DOCUMENT', 'Image region is outside viewport');
    }
    return references;
}
