import { randomUUID } from 'node:crypto';
import { protocolPin } from '../protocol.mjs';
import { transient, idle } from './common.mjs';
export async function claimOnce(store, transport, config, expected, signal) {
    const claimRequestId = randomUUID(), body = { agentId: config.agentId, instanceId: store.instanceId, claimRequestId, protocolVersion: protocolPin.protocolVersion, engineVersion: expected.engineVersion, engineContractVersion: expected.contractVersion, engineContractSha256: expected.contractSha256, capabilities: { platforms: [...new Set(Object.values(config.resources).map(r => r.platform))], actions: [...new Set(Object.values(config.resources).flatMap(r => r.actions))] }, resourceKeys: Object.keys(config.resources), projectIds: config.projectIds };
    await store.set('claim:' + claimRequestId, { body, phase: 'requested' });
    let response;
    while (!signal?.aborted) {
        try {
            response = await transport.claim(body, signal);
            break;
        }
        catch (e) {
            if (!transient(e))
                throw e;
            await idle(500, signal);
        }
    }
    if (!response)
        return undefined;
    await store.set('claim:' + claimRequestId, { body, phase: response.value ? 'received' : 'empty', leaseId: response.value?.lease.leaseId ?? null });
    if (!response.value)
        await store.compactEmptyClaims();
    return { response, claimRequestId };
}
