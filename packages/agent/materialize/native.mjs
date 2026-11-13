import { join } from 'node:path';
import { readBounded } from '../../core/io/files.mjs';
import { validateConfiguration } from '../../../runners/appium/configuration.mjs';
import { requireAgent, AgentError } from '../errors.mjs';
import { protocolLimits } from '../protocol.mjs';
import { immutableJson } from './immutable.mjs';
export async function materializeNativeConfig(lease, local, jobRoot) {
    if (local.platform === 'web')
        return undefined;
    let config;
    try {
        config = JSON.parse(await readBounded(local.appiumConfig));
        validateConfiguration(config);
    }
    catch {
        throw new AgentError('AGENT_POLICY_DENIED', 'Native execution configuration is unavailable or invalid');
    }
    const caps = config.capabilities, platform = local.platform, appId = caps[platform === 'android' ? 'appium:appPackage' : 'appium:bundleId'];
    const startupKeys = new Set(['platformName', 'appium:automationName', 'appium:udid', 'appium:deviceName', 'appium:appPackage', 'appium:appActivity', 'appium:bundleId', 'appium:newCommandTimeout', 'appium:noReset', 'appium:autoLaunch', 'appium:appWaitPackage', 'appium:appWaitActivity', 'appium:appWaitDuration']);
    requireAgent(Object.keys(caps).every(key => startupKeys.has(key)), 'AGENT_POLICY_DENIED', 'Unsupported native startup capability');
    requireAgent(caps['appium:automationName'] === (platform === 'android' ? 'UiAutomator2' : 'XCUITest') && (caps.platformName === undefined || caps.platformName === (platform === 'android' ? 'Android' : 'iOS')), 'AGENT_POLICY_DENIED', 'Native configuration platform differs');
    for (const key of ['appium:noReset', 'appium:autoLaunch'])
        requireAgent(caps[key] === undefined || typeof caps[key] === 'boolean', 'AGENT_POLICY_DENIED', 'Invalid native startup option');
    requireAgent(caps['appium:appWaitDuration'] === undefined || (Number.isInteger(caps['appium:appWaitDuration']) && caps['appium:appWaitDuration'] >= 1 && caps['appium:appWaitDuration'] <= 300000), 'AGENT_POLICY_DENIED', 'Invalid native wait budget');
    const allowed = [local.nativeApps, lease.executionPolicy.nativeApps].map(apps => apps.find(app => app.platform === platform && app.appId === appId));
    requireAgent(typeof appId === 'string' && allowed.every(Boolean), 'AGENT_POLICY_DENIED', 'Native session must start an explicitly allowed app');
    requireAgent(caps['appium:autoLaunch'] !== false, 'AGENT_POLICY_DENIED', 'Native session must explicitly launch its approved app');
    if (platform === 'android') {
        requireAgent(!Object.hasOwn(caps, 'appium:bundleId'), 'AGENT_POLICY_DENIED', 'Unexpected native startup target');
        const activity = caps['appium:appActivity'];
        requireAgent(typeof activity === 'string' && allowed.every(app => app.activities?.includes(activity)), 'AGENT_POLICY_DENIED', 'Native start activity must be allowed by both policies');
        for (const field of ['appium:appWaitPackage', 'appium:appWaitActivity'])
            if (Object.hasOwn(caps, field))
                requireAgent(caps[field] === (field.endsWith('Package') ? appId : activity), 'AGENT_POLICY_DENIED', 'Native wait target must match its approved start target');
    }
    else
        requireAgent(!['appium:appPackage', 'appium:appActivity', 'appium:appWaitPackage', 'appium:appWaitActivity', 'appium:appWaitDuration'].some(key => Object.hasOwn(caps, key)), 'AGENT_POLICY_DENIED', 'Unexpected native startup target');
    const path = join(jobRoot, 'appium-config.json');
    await immutableJson(path, config, protocolLimits.engineJsonBytes);
    return path;
}
