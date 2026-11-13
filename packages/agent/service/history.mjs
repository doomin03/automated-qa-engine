import { randomUUID } from 'node:crypto';
import { protocolLimits } from '../protocol.mjs';
import { requireAgent } from '../errors.mjs';
import { readImmutable, sha256 } from '../materialize/immutable.mjs';
import { historicalDelivery } from '../reporting/historical.mjs';
import { persistBody } from './records.mjs';
export async function historical(store, transport, lease, record, body, artifacts) {
    const historicalTransport = { historical: async (id, request, signal) => {
            const key = 'historical:' + request.evidenceRequestId, prior = store.get(key);
            if (prior.ack)
                return;
            const response = await transport.historical(id, request, signal);
            requireAgent(response.value.recorded && response.value.leaseId === id && response.value.executionPermission === false && response.value.resourceReleased === false, 'AGENT_PROTOCOL_INVALID', 'Historical receipt differs');
            await store.set(key, { ...prior, ack: true, receiptId: response.value.receiptId });
            return response;
        } };
    await historicalDelivery({ store, transport: historicalTransport, lease, instanceId: store.instanceId, body, artifacts, saveIntent: async (request) => {
            const { reportingInstanceId, ...immutablePayload } = request;
            const payloadKey = 'history-payload:' + sha256(JSON.stringify(immutablePayload)), existing = store.get(payloadKey);
            if (existing)
                return readImmutable(store.get('historical:' + existing).reference, protocolLimits.httpBodyBytes);
            const withId = { ...request, evidenceRequestId: randomUUID() }, reference = await persistBody(store, record.root, withId, 'historical');
            await store.set('historical:' + withId.evidenceRequestId, { leaseId: lease.leaseId, reference, ack: false });
            await store.set(payloadKey, withId.evidenceRequestId);
            return withId;
        } });
}
