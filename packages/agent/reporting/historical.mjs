import { readBounded } from '../../core/io/files.mjs';
import { protocolLimits, boundedJson } from '../protocol.mjs';
import { requireAgent } from '../errors.mjs';
import { sha256 } from '../materialize/immutable.mjs';
export async function historicalDelivery({ store, transport, lease, instanceId, body, artifacts, saveIntent, signal }) {
    const pending = store.pending(lease.leaseId), groups = [];
    let group = [];
    for (const entry of pending) {
        const event = { deliverySequence: entry.sequence, ...entry.payload };
        requireAgent(Buffer.byteLength(JSON.stringify([event])) <= protocolLimits.eventBatchBytes, 'AGENT_PROTOCOL_LIMIT', 'Historical event exceeds byte budget');
        if (group.length >= 50 || Buffer.byteLength(JSON.stringify([...group, event])) > protocolLimits.eventBatchBytes) {
            groups.push(group);
            group = [];
        }
        group.push(event);
    }
    if (group.length)
        groups.push(group);
    if (!groups.length)
        groups.push([]);
    for (const events of groups) {
        const request = { agentId: lease.agentId, reportingInstanceId: instanceId, ownerInstanceId: lease.instanceId, fence: lease.fence, events, caseResults: body.caseResults, cleanupState: body.cleanupState };
        const intent = await saveIntent(request);
        boundedJson(intent, protocolLimits.httpBodyBytes);
        await transport.historical(lease.leaseId, intent, signal);
    }
    for (const source of artifacts) {
        const bytes = await readBounded(source.localPath, protocolLimits.artifactBytes);
        requireAgent(bytes.length === source.size && sha256(bytes) === source.sha256, 'AGENT_STATE_INVALID', 'Historical artifact bytes changed');
        const { localPath, ...descriptor } = source;
        const request = { agentId: lease.agentId, reportingInstanceId: instanceId, ownerInstanceId: lease.instanceId, fence: lease.fence, events: [], caseResults: [], cleanupState: body.cleanupState, artifact: { ...descriptor, base64: bytes.toString('base64') } };
        await transport.historical(lease.leaseId, await saveIntent(request), signal);
    }
}
