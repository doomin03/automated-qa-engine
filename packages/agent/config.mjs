import { resolve, dirname } from 'node:path';
import { readBounded } from '../core/resources.mjs';
import { ACTIONS, NATIVE_ACTIONS } from '../core/domain/actions.mjs';
import { requireAgent, AgentError } from './errors.mjs';
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const list = v => Array.isArray(v) && v.length <= 100 && v.every(s => typeof s === 'string' && s.length > 0 && s.length <= 2048) && new Set(v).size === v.length;
const keys = (value, names) => requireAgent(object(value) && Object.keys(value).every(k => names.includes(k)), 'AGENT_CONFIG_INVALID', 'Unknown or invalid Agent configuration field');
export function normalizeConfig(input, base = process.cwd()) {
    keys(input, ['schemaVersion', 'agentId', 'serverUrl', 'tokenEnv', 'stateDir', 'allowInsecureLocal', 'projectIds', 'resources', 'credentials', 'maxRunMs']);
    requireAgent(input.schemaVersion === 'qa.agentConfig/v1' && typeof input.agentId === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(input.agentId), 'AGENT_CONFIG_INVALID', 'Invalid Agent identity');
    requireAgent(typeof input.serverUrl === 'string' && typeof input.stateDir === 'string' && input.stateDir.length > 0 && typeof input.tokenEnv === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(input.tokenEnv), 'AGENT_CONFIG_INVALID', 'Agent server, state root and token environment reference are required');
    requireAgent(input.allowInsecureLocal === undefined || typeof input.allowInsecureLocal === 'boolean', 'AGENT_CONFIG_INVALID', 'Invalid local transport option');
    const projectIds = input.projectIds ?? [], resources = input.resources ?? {}, credentials = input.credentials ?? {}, maxRunMs = input.maxRunMs ?? 60000;
    requireAgent(list(projectIds) && object(resources) && Object.keys(resources).length <= 100 && object(credentials) && Object.keys(credentials).length <= 100, 'AGENT_CONFIG_INVALID', 'Invalid Agent policy collections');
    requireAgent(Number.isInteger(maxRunMs) && maxRunMs > 0 && maxRunMs <= 300000, 'AGENT_CONFIG_INVALID', 'Agent run budget must be 1..300000ms');
    for (const [ref, name] of Object.entries(credentials))
        requireAgent(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(ref) && typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name), 'AGENT_CONFIG_INVALID', 'Invalid credential environment reference');
    const normalized = {};
    for (const [key, resource] of Object.entries(resources)) {
        requireAgent(/^[A-Za-z][A-Za-z0-9_.:-]{0,255}$/.test(key), 'AGENT_CONFIG_INVALID', 'Invalid resource key');
        keys(resource, ['platform', 'allowedOrigins', 'nativeApps', 'secretRefs', 'actions', 'allowProduction', 'appiumConfig']);
        requireAgent(['web', 'android', 'ios'].includes(resource.platform), 'AGENT_CONFIG_INVALID', 'Invalid resource platform');
        const allowedOrigins = resource.allowedOrigins ?? [], nativeApps = resource.nativeApps ?? [], secretRefs = resource.secretRefs ?? [], actions = resource.actions ?? [];
        requireAgent(list(allowedOrigins) && list(secretRefs) && list(actions) && Array.isArray(nativeApps) && nativeApps.length <= 100, 'AGENT_CONFIG_INVALID', 'Invalid resource allowlist');
        for (const origin of allowedOrigins) {
            let url;
            try {
                url = new URL(origin);
            }
            catch {
                throw new AgentError('AGENT_CONFIG_INVALID', 'Invalid origin allowlist');
            }
            requireAgent(['http:', 'https:'].includes(url.protocol) && url.origin === origin && !url.username && !url.password, 'AGENT_CONFIG_INVALID', 'Origins must be exact HTTP(S) origins');
        }
        for (const app of nativeApps) {
            keys(app, ['platform', 'appId', 'activities']);
            requireAgent(['android', 'ios'].includes(app.platform) && typeof app.appId === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$/.test(app.appId) && list(app.activities ?? []), 'AGENT_CONFIG_INVALID', 'Invalid native app allowlist');
        }
        requireAgent(actions.every(a => (resource.platform === 'web' ? ACTIONS : NATIVE_ACTIONS).includes(a)) && secretRefs.every(ref => Object.hasOwn(credentials, ref)), 'AGENT_CONFIG_INVALID', 'Unknown action or credential reference');
        requireAgent(resource.allowProduction === undefined || typeof resource.allowProduction === 'boolean', 'AGENT_CONFIG_INVALID', 'Invalid production policy');
        requireAgent(resource.platform === 'web' || typeof resource.appiumConfig === 'string', 'AGENT_CONFIG_INVALID', 'Native resource requires local Appium configuration');
        normalized[key] = { platform: resource.platform, allowedOrigins: [...allowedOrigins], nativeApps: structuredClone(nativeApps), secretRefs: [...secretRefs], actions: [...actions], allowProduction: resource.allowProduction === true, ...(resource.appiumConfig ? { appiumConfig: resolve(base, resource.appiumConfig) } : {}) };
    }
    return { schemaVersion: 'qa.agentConfig/v1', agentId: input.agentId, serverUrl: input.serverUrl, tokenEnv: input.tokenEnv, stateDir: resolve(base, input.stateDir), allowInsecureLocal: input.allowInsecureLocal === true, projectIds: [...projectIds], resources: normalized, credentials: { ...credentials }, maxRunMs };
}
export async function loadAgentConfig(file) { try {
    return normalizeConfig(JSON.parse((await readBounded(file)).toString('utf8')), dirname(resolve(file)));
}
catch (error) {
    if (error instanceof AgentError)
        throw error;
    throw new AgentError('AGENT_CONFIG_INVALID', 'Unable to read bounded Agent configuration');
} }
