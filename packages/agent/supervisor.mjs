import { openAgentStore } from './store.mjs';
import { loadAgentConfig } from './config.mjs';
import { AgentTransport } from './transport.mjs';
import { AgentError, requireAgent } from './errors.mjs';
import { protocolPin } from './protocol.mjs';
import { installedRelease } from './service/release-pin.mjs';
import { claimOnce } from './service/claim.mjs';
import { executeLease } from './service/execution.mjs';
import { recover } from './service/recovery.mjs';
import { releaseSelf } from './service/release.mjs';
import { idle } from './service/common.mjs';
export { installedRelease } from './service/release-pin.mjs';
export async function runAgent({ configFile, config: givenConfig, once = false, signal, onStatus = async () => { }, transport: givenTransport, expected: givenExpected, instanceId } = {}) {
    const config = givenConfig || await loadAgentConfig(configFile), expected = givenExpected || await installedRelease();
    const transport = givenTransport || new AgentTransport({ serverUrl: config.serverUrl, token: process.env[config.tokenEnv], allowInsecureLocal: config.allowInsecureLocal });
    const store = await openAgentStore(config.stateDir, { agentId: config.agentId, ...(instanceId ? { instanceId } : {}) });
    let canRelease = false;
    try {
        await store.set('instance:' + store.instanceId, { instanceId: store.instanceId, ownerPid: process.pid });
        await recover(store, transport, config);
        await onStatus({ type: 'agent.ready', agentId: config.agentId, instanceId: store.instanceId, engineVersion: expected.engineVersion, agentProtocolVersion: protocolPin.protocolVersion });
        canRelease = true;
        while (!signal?.aborted) {
            const claimed = await claimOnce(store, transport, config, expected, signal);
            if (!claimed)
                break;
            const { response, claimRequestId } = claimed;
            if (response.value) {
                requireAgent(response.value.claimRequestId === claimRequestId, 'AGENT_PROTOCOL_INVALID', 'Claim identity differs');
                canRelease = false;
                const record = await executeLease({ store, transport, config, expected, signal, onStatus }, response.value.lease, response.startedAt);
                canRelease = record.phase === 'closed';
                if (!canRelease)
                    throw new AgentError('AGENT_QUARANTINED', 'Execution evidence remains pending or resource cleanup is uncertain');
            }
            if (once)
                break;
            await idle(1000, signal);
        }
        if (canRelease)
            requireAgent(await releaseSelf(store, transport, config), 'AGENT_DELIVERY_PENDING', 'Instance release remains pending');
        return { status: signal?.aborted ? 'stopped' : 'idle', agentId: config.agentId, instanceId: store.instanceId };
    }
    finally {
        await store.close();
    }
}
