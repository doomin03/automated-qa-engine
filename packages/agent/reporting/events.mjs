import { protocolLimits } from '../protocol.mjs';
import { requireAgent } from '../errors.mjs';
import { holderFor, identity } from './identity.mjs';
export async function flushEvents({ store, transport, lease, signal }) {
    const holder = holderFor(lease);
    for (;;) {
        const pending = store.pending(lease.leaseId);
        if (!pending.length)
            return;
        const events = [];
        for (const entry of pending.slice(0, 100)) {
            const next = { deliverySequence: entry.sequence, ...entry.payload };
            if (Buffer.byteLength(JSON.stringify({ ...holder, events: [...events, next] })) > protocolLimits.eventBatchBytes)
                break;
            events.push(next);
        }
        requireAgent(events.length > 0, 'AGENT_PROTOCOL_LIMIT', 'Single event exceeds delivery byte budget');
        const highWater = Math.max(store.get('sent:' + lease.leaseId) || 0, events.at(-1).deliverySequence);
        await store.set('sent:' + lease.leaseId, highWater);
        const value = (await transport.events(lease.leaseId, { ...holder, events }, signal)).value;
        identity(value, lease);
        requireAgent(value.acceptedThrough >= events.at(-1).deliverySequence && value.acceptedThrough <= highWater, 'AGENT_PROTOCOL_INVALID', 'Invalid event acknowledgement');
        await store.ack(lease.leaseId, value.acceptedThrough);
    }
}
