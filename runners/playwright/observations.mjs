import { hash } from '../../packages/core/domain/canonical.mjs';
import { comparePng } from '../../packages/core/images.mjs';
import { QaError } from '../../packages/core/errors.mjs';
export const CHECK_ACTIONS = ['assertImage', 'assertLayout', 'assertInViewport', 'assertHitTarget', 'assertFocused', 'assertUrl'];
const observation = (kind, verdict, reason, extra = {}) => ({ kind, verdict, reason, ...extra });
async function unique(adapter, selector, blueprint) {
    const loc = adapter.locator(selector, blueprint.selectors), count = await loc.count();
    if (count !== 1)
        return { report: observation('ux', count ? 'blocked' : 'failed', count ? 'AMBIGUOUS_SELECTOR' : 'ELEMENT_MISSING') };
    const unsupported = await loc.evaluate(el => ['CANVAS', 'IFRAME'].includes(el.tagName) || el.getRootNode() !== document);
    if (unsupported)
        return { report: observation('ux', 'blocked', 'UNSUPPORTED_ELEMENT') };
    return { loc };
}
export async function applyReadiness(adapter, blueprint, resources, timeoutMs) {
    const p = blueprint.target.profile;
    if (!p)
        return;
    await adapter.locator(p.readiness.selector, blueprint.selectors).waitFor({ state: 'visible', timeout: Math.min(timeoutMs, p.readiness.timeoutMs) });
    for (const font of p.injectFonts ? p.fonts : []) {
        const bytes = resources.get(font.path);
        if (!bytes)
            throw new QaError('INVALID_DOCUMENT', 'Required font asset missing', 'step');
        try {
            await adapter.page.evaluate(async ({ family, base64 }) => { const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); const font = new FontFace(family, bytes); await font.load(); document.fonts.add(font); }, { family: font.family, base64: bytes.toString('base64') });
        }
        catch {
            adapter.fontIssue = true;
        }
    }
    await adapter.page.evaluate(async () => { await document.fonts.ready; });
    await Promise.all(adapter.fontReads);
}
export async function observe(adapter, node, ctx) {
    const { blueprint, resources, timeoutMs, signal, secretInputs } = ctx, p = node.params, profile = blueprint.target.profile;
    const kind = node.action === 'assertImage' ? 'image' : node.action === 'assertLayout' ? 'layout' : 'ux';
    const reference = blueprint.references?.find(r => r.id === p.reference);
    const common = { ...(reference ? { referenceHash: hash(reference) } : {}), ...(profile ? { profileHash: hash(profile), fontsInjected: !!profile.injectFonts } : {}) };
    const result = (verdict, reason, extra = {}) => observation(kind, verdict, reason, { ...common, ...extra });
    if (profile) {
        if (adapter.fontIssue)
            return result('blocked', 'FONT_UNAVAILABLE');
        const observed = await adapter.page.evaluate(() => ({ dpr: devicePixelRatio, width: innerWidth, height: innerHeight, locale: navigator.language }));
        if (adapter.browser.version() !== profile.browserVersion || process.platform !== profile.os || observed.dpr !== profile.dpr || observed.width !== profile.viewport.width || observed.height !== profile.viewport.height || observed.locale !== profile.locale)
            return result('blocked', 'PROFILE_MISMATCH');
        const fontsReady = await adapter.page.evaluate(fonts => fonts.every(f => [...document.fonts].some(font => font.family === f.family && font.status === 'loaded')), profile.fonts);
        if (!fontsReady || (!profile.injectFonts && profile.fonts.some(f => !adapter.fontHashes.has(f.sha256))))
            return result('blocked', 'FONT_UNAVAILABLE');
    }
    if (node.action === 'assertImage') {
        if (secretInputs.size || await adapter.page.locator('input[type=password]').count())
            return result('blocked', 'SENSITIVE_CAPTURE');
        const image = reference.images.find(i => i.id === p.image), baseline = resources.get(image.path);
        const actual = await adapter.page.screenshot({ fullPage: false, timeout: timeoutMs, animations: 'allow', caret: 'hide' });
        const r = image.region, crop = r === 'viewport' ? undefined : { x: Math.round(r.x * profile.dpr), y: Math.round(r.y * profile.dpr), width: Math.round((r.x + r.width) * profile.dpr) - Math.round(r.x * profile.dpr), height: Math.round((r.y + r.height) * profile.dpr) - Math.round(r.y * profile.dpr) };
        const compared = await comparePng(baseline, actual, { channelTolerance: image.threshold.channelTolerance, crop, timeoutMs, signal });
        if (compared.blocked)
            return result('blocked', compared.blocked);
        const ratio = compared.changedPixels / compared.comparedPixels;
        return result(ratio <= image.threshold.maxDiffRatio ? 'passed' : 'failed', ratio <= image.threshold.maxDiffRatio ? 'MATCH' : 'IMAGE_DIFFERENCE', { expected: { maxDiffRatio: image.threshold.maxDiffRatio }, actual: { diffRatio: ratio, changedPixels: compared.changedPixels, comparedPixels: compared.comparedPixels }, tolerance: image.threshold, images: [{ role: 'baseline', bytes: baseline }, { role: 'actual', bytes: compared.actual }, { role: 'diff', bytes: compared.diff }] });
    }
    if (node.action === 'assertUrl')
        return result(adapter.page.url() === p.expected ? 'passed' : 'failed', adapter.page.url() === p.expected ? 'MATCH' : 'URL_DIFFERENCE', { expected: p.expected, actual: secretInputs.size ? '[redacted]' : adapter.page.url() });
    const rule = reference?.measurementRules.find(r => r.id === p.rule), selected = await unique(adapter, rule?.selectorId || p.selector, blueprint);
    if (selected.report)
        return { ...selected.report, ...common, kind };
    const { loc } = selected;
    if (profile?.fonts.length) {
        const family = await loc.evaluate(el => getComputedStyle(el).fontFamily);
        if (!profile.fonts.some(f => family.split(',').map(x => x.trim().replaceAll('"', '').replaceAll("'", '')).includes(f.family)))
            return result('blocked', 'FONT_NOT_APPLIED');
    }
    if (node.action === 'assertLayout') {
        let actual;
        if (rule.metric === 'font-size')
            actual = await loc.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize));
        else {
            const box = await loc.boundingBox();
            if (!box)
                return result('failed', 'ELEMENT_MISSING');
            if (rule.metric.startsWith('bbox.'))
                actual = box[rule.metric.slice(5)];
            else {
                const other = await unique(adapter, rule.otherSelectorId, blueprint);
                if (other.report)
                    return { ...other.report, kind, ...common };
                const b = await other.loc.boundingBox();
                if (!b)
                    return result('failed', 'ELEMENT_MISSING');
                actual = rule.metric === 'gap.horizontal' ? b.x - box.x - box.width : b.y - box.y - box.height;
            }
        }
        if (!Number.isFinite(actual))
            return result('blocked', 'UNSUPPORTED_MEASUREMENT');
        const pass = Math.abs(actual - rule.expected) <= rule.tolerance;
        return result(pass ? 'passed' : 'failed', pass ? 'MATCH' : 'LAYOUT_DIFFERENCE', { expected: { value: rule.expected, unit: 'CSSpx', source: rule.source, metric: rule.metric }, actual, tolerance: rule.tolerance });
    }
    const actual = await loc.evaluate((el, action) => {
        const r = el.getBoundingClientRect();
        if (action === 'assertFocused')
            return document.activeElement === el;
        if (action === 'assertInViewport')
            return r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        const dx = Math.min(1, r.width / 4), dy = Math.min(1, r.height / 4), points = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + dx, r.top + dy], [r.right - dx, r.top + dy], [r.left + dx, r.bottom - dy], [r.right - dx, r.bottom - dy]];
        return r.width > 0 && r.height > 0 && points.every(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === el || el.contains(hit); });
    }, node.action);
    return result(actual ? 'passed' : 'failed', actual ? 'MATCH' : node.action === 'assertFocused' ? 'NOT_FOCUSED' : node.action === 'assertInViewport' ? 'OUTSIDE_VIEWPORT' : 'HIT_TARGET_BLOCKED', { expected: true, actual });
}
