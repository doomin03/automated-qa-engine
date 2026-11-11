import { QaError } from '../../core/errors.mjs';
import { readBounded } from '../../core/io/files.mjs';
export async function createAdapter(b, values) {
    if (b.target.platform !== 'web' && !values['appium-config'])
        throw new QaError('INVALID_ARGUMENT', 'Native execution requires --appium-config FILE');
    if (b.target.platform === 'web') {
        const { PlaywrightAdapter } = await import('../../../runners/playwright/adapter.mjs');
        return new PlaywrightAdapter();
    }
    const { AppiumAdapter } = await import('../../../runners/appium/adapter.mjs');
    return new AppiumAdapter(JSON.parse((await readBounded(values['appium-config'])).toString('utf8')));
}
