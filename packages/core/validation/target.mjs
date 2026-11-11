import { QaError, ensure } from '../errors.mjs';
export function validateTarget(blueprint) {
    const { target } = blueprint;
    const b = blueprint;
    ensure(['web', 'android', 'ios'].includes(target.platform), 'UNSUPPORTED_CAPABILITY', 'Unsupported target platform');
    if (b.testCase)
        ensure(b.testCase.platforms.includes(target.platform), 'UNSUPPORTED_CAPABILITY', 'TC does not support target');
    ensure(target.platform !== 'web' || Array.isArray(target.allowedOrigins), 'INVALID_TARGET', 'Web target requires allowedOrigins');
    ensure(target.platform === 'web' || (!target.profile && !b.references?.length), 'UNSUPPORTED_CAPABILITY', 'Design comparisons currently require web');
    const origins = (target.platform === 'web' ? target.allowedOrigins : []).map(origin => {
        let url;
        try {
            url = new URL(origin);
        }
        catch {
            throw new QaError('INVALID_TARGET', 'Invalid allowed origin');
        }
        ensure(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.origin === origin, 'INVALID_TARGET', 'allowedOrigins must contain exact HTTP(S) origins');
        return url.origin;
    });
    for (const urlText of Object.values(target.launchTargets)) {
        if (target.platform !== 'web') {
            ensure(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$/.test(urlText), 'INVALID_TARGET', 'Invalid native app identifier');
            continue;
        }
        let url;
        try {
            url = new URL(urlText);
        }
        catch {
            throw new QaError('INVALID_TARGET', 'Invalid launch URL');
        }
        ensure(origins.includes(url.origin) && !url.username && !url.password, 'POLICY_DENIED', 'Launch target is outside allowed origins');
    }
}
