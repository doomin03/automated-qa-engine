import { access } from 'node:fs/promises';
import { chromium } from 'playwright';
import { AppiumAdapter } from '../../../runners/appium/adapter.mjs';
import { supportedSchemas } from '../../core/schema.mjs';
import { ENGINE_VERSION } from '../../core/domain/version.mjs';
import { ACTIONS, NATIVE_ACTIONS } from '../../core/domain/actions.mjs';
import { QaError } from '../../core/errors.mjs';
import { readBounded } from '../../core/io/files.mjs';
export async function command({ command, file, values, positionals }, { json, text: outputText }) {
    if (command === 'doctor' || command === 'devices') {
        if (values.target && !['web', 'android', 'ios'].includes(values.target))
            throw new QaError('UNSUPPORTED_CAPABILITY', 'Unsupported target platform');
        if (['android', 'ios'].includes(values.target)) {
            const configured = !!values['appium-config'];
            if (configured) {
                const config = JSON.parse((await readBounded(values['appium-config'])).toString('utf8'));
                new AppiumAdapter(config);
                if (config.capabilities['appium:automationName'] !== (values.target === 'android' ? 'UiAutomator2' : 'XCUITest') || (config.capabilities.platformName && config.capabilities.platformName !== (values.target === 'android' ? 'Android' : 'iOS')))
                    throw new QaError('INVALID_ARGUMENT', 'Appium configuration does not match target');
            }
            await json({ schemaVersion: 'qa.capabilities/v1', engineVersion: ENGINE_VERSION, supportedSchemas, platforms: [values.target], supportedActions: NATIVE_ACTIONS, driverVersions: { protocol: 'W3C-Appium' }, targets: [], diagnostics: { node: process.versions.node, nativeConfigured: configured, connectionVerified: false } });
            return configured ? 0 : 4;
        }
        let available = true;
        try {
            await access(chromium.executablePath());
        }
        catch {
            available = false;
        }
        await json({ schemaVersion: 'qa.capabilities/v1', engineVersion: ENGINE_VERSION, supportedSchemas, platforms: ['web'], supportedActions: ACTIONS, driverVersions: { playwright: '1.64.1' }, targets: available ? ['chromium-headless'] : [], ...(command === 'doctor' ? { diagnostics: { browserInstalled: available, node: process.versions.node } } : {}) });
        return available ? 0 : 3;
    }
}
