import { compileBlueprint } from '../../core/compiler.mjs';
import { parseSource } from '../../core/codecs/source.mjs';
import { requireAgent } from '../errors.mjs';
import { validateProtocol, boundedJson, protocolLimits } from '../protocol.mjs';
import { safeName } from './paths.mjs';
export function checkLeasePolicy(lease, config, expected) {
    validateProtocol('Lease', lease);
    boundedJson(lease, protocolLimits.leaseBytes);
    requireAgent(lease.agentId === config.agentId && lease.instanceId === expected.instanceId, 'AGENT_POLICY_DENIED', 'Lease belongs to a different Agent instance');
    requireAgent(lease.engineVersion === expected.engineVersion && lease.engineContractVersion === expected.contractVersion && lease.engineContractSha256 === expected.contractSha256, 'AGENT_POLICY_DENIED', 'Engine release pin differs from lease');
    requireAgent(config.projectIds.includes(lease.projectId) && Object.hasOwn(config.resources, lease.resourceKey), 'AGENT_POLICY_DENIED', 'Project or resource is not locally allowed');
    const local = config.resources[lease.resourceKey], policy = lease.executionPolicy;
    requireAgent(policy.resourceKey === lease.resourceKey && policy.platform === local.platform, 'AGENT_POLICY_DENIED', 'Resource policy identity mismatch');
    const ids = new Set(), plans = [];
    let total = 0;
    for (const item of lease.cases) {
        requireAgent(!ids.has(item.caseId), 'AGENT_POLICY_DENIED', 'Duplicate case identity');
        ids.add(item.caseId);
        const blueprint = parseSource(item.blueprintJson, 'json'), plan = compileBlueprint(blueprint);
        plans.push(plan);
        requireAgent(plan.blueprintSnapshotHash === item.blueprintSnapshotHash && blueprint.target.platform === local.platform, 'AGENT_POLICY_DENIED', 'Case snapshot or platform mismatch');
        requireAgent(plan.requiredActions.every(action => local.actions.includes(action)), 'AGENT_POLICY_DENIED', 'Action is not locally allowed');
        requireAgent(blueprint.target.environment !== 'production' || (local.allowProduction && policy.allowProduction === true), 'AGENT_POLICY_DENIED', 'Production requires both operator and server opt-in');
        requireAgent(plan.secretRefs.every(ref => local.secretRefs.includes(ref) && policy.secretRefs.includes(ref) && Object.hasOwn(config.credentials, ref)), 'AGENT_POLICY_DENIED', 'Credential reference is not allowed');
        if (local.platform === 'web')
            requireAgent(blueprint.target.allowedOrigins.every(origin => local.allowedOrigins.includes(origin) && policy.allowedOrigins.includes(origin)), 'AGENT_POLICY_DENIED', 'Origin is not allowed by both policies');
        else
            for (const appId of Object.values(blueprint.target.launchTargets))
                requireAgent(local.nativeApps.some(app => app.platform === local.platform && app.appId === appId) && policy.nativeApps.some(app => app.platform === local.platform && app.appId === appId), 'AGENT_POLICY_DENIED', 'Native app is not allowed by both policies');
        const names = new Set(['blueprint.json']);
        for (const resource of item.resources) {
            requireAgent(safeName(resource.name) && !names.has(resource.name.toLowerCase()), 'AGENT_POLICY_DENIED', 'Unsafe or duplicate resource path');
            names.add(resource.name.toLowerCase());
            total += resource.size;
        }
    }
    requireAgent(total <= protocolLimits.executionArtifactBytes, 'AGENT_POLICY_DENIED', 'Execution resources exceed total byte budget');
    return { local, plans };
}
