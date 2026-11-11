import { requireAgent } from '../errors.mjs';
export const holderFor = lease => ({ agentId: lease.agentId, instanceId: lease.instanceId, fence: lease.fence });
export function identity(response, lease) { requireAgent(response.leaseId === lease.leaseId && response.fence === lease.fence, 'AGENT_PROTOCOL_INVALID', 'Reporting response changed lease identity'); }
