import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { protocolLimits } from '../protocol.mjs';
import { requireAgent } from '../errors.mjs';
import { immutableJson, readImmutable, sha256 } from '../materialize/immutable.mjs';
import { saveRecord } from './records.mjs';
import { historical } from './history.mjs';
import { absent } from './common.mjs';
export async function recover(store, transport, config, recovered = false) {
    const decisions = [];
    let cursor;
    const knownLeases = store.entries('lease:').map(([key, r]) => ({ leaseId: key.slice(6), fence: null, ownerInstanceId: r.ownerInstanceId, lastAcknowledgedSequence: store.acknowledged(key.slice(6)), cleanupState: r.cleanupState, terminalResultHashes: [] }));
    for (const item of knownLeases) {
        const record = store.get('lease:' + item.leaseId), lease = await readImmutable(record.leaseReference, protocolLimits.leaseBytes);
        item.fence = lease.fence;
        if (record.stateReference) {
            const state = await readImmutable(record.stateReference, protocolLimits.httpBodyBytes);
            item.terminalResultHashes = state.caseResults.map(r => ({ caseId: r.caseId, sha256: sha256(r.resultJson) }));
        }
    }
    let instanceState;
    do {
        const response = (await transport.reconcile({ agentId: config.agentId, instanceId: store.instanceId, knownLeases: knownLeases.slice(0, 100) }, cursor)).value;
        requireAgent(response.agentId === config.agentId && response.instanceId === store.instanceId, 'AGENT_PROTOCOL_INVALID', 'Reconcile identity differs');
        instanceState = response.instanceState;
        decisions.push(...response.decisions);
        cursor = response.hasMore ? response.nextCursor : null;
        requireAgent(!response.hasMore || typeof cursor === 'string', 'AGENT_PROTOCOL_INVALID', 'Missing reconcile page cursor');
        requireAgent(decisions.length <= 10000, 'AGENT_PROTOCOL_LIMIT', 'Reconcile decision limit exceeded');
    } while (cursor);
    const returnedIds = new Set(decisions.map(d => d.lease.leaseId));
    requireAgent(returnedIds.size === decisions.length, 'AGENT_PROTOCOL_INVALID', 'Duplicate reconcile decision');
    for (const [key, local] of store.entries('lease:')) {
        const safelyRetired = ((local.phase === 'closed' && local.cleanupState === 'confirmed' && local.receipt) || (local.phase === 'recovered' && local.operatorRecovery)) && store.get('released:' + local.ownerInstanceId);
        requireAgent(returnedIds.has(key.slice(6)) || safelyRetired, 'AGENT_QUARANTINED', 'Server omitted unresolved local execution');
    }
    if (!decisions.length && instanceState === 'observer') {
        for (const [, owner] of store.entries('instance:').toReversed()) {
            if (owner.instanceId === store.instanceId || store.get('released:' + owner.instanceId) || !absent(owner.ownerPid))
                continue;
            try {
                const value = (await transport.release({ agentId: config.agentId, reportingInstanceId: store.instanceId, ownerInstanceId: owner.instanceId, ownerStopped: true, receipts: [] })).value;
                requireAgent(value.agentId === config.agentId && value.reportingInstanceId === store.instanceId && value.ownerInstanceId === owner.instanceId, 'AGENT_PROTOCOL_INVALID', 'Empty owner release identity differs');
                if (value.released) {
                    await store.set('released:' + owner.instanceId, true);
                    return recover(store, transport, config, true);
                }
            }
            catch (error) {
                if (error.status !== 409)
                    throw error;
            }
        }
    }
    // Retry the exact durable historical request, including its original reporter.
    // Replaying evidence never grants execution authority to that old instance.
    for (const [key, pending] of store.entries('historical:')) {
        const record = store.get('lease:' + pending.leaseId);
        if (pending.ack || !record || !absent(record.ownerPid))
            continue;
        const body = await readImmutable(pending.reference, protocolLimits.httpBodyBytes);
        const response = (await transport.historical(pending.leaseId, body)).value;
        requireAgent(response.recorded && response.leaseId === pending.leaseId && response.executionPermission === false && response.resourceReleased === false, 'AGENT_PROTOCOL_INVALID', 'Historical receipt differs');
        await store.set(key, { ...pending, ack: true, receiptId: response.receiptId });
    }
    const owners = new Map();
    let unresolved = false;
    for (const decision of decisions) {
        const lease = decision.lease;
        let record = store.get('lease:' + lease.leaseId);
        requireAgent(lease.agentId === config.agentId, 'AGENT_PROTOCOL_INVALID', 'Reconcile returned another Agent lease');
        if (record) {
            const original = await readImmutable(record.leaseReference, protocolLimits.leaseBytes);
            requireAgent(['agentId', 'instanceId', 'leaseId', 'executionId', 'jobAttempt', 'fence', 'resourceKey', 'projectId', 'engineVersion', 'engineContractVersion', 'engineContractSha256', 'protocolVersion'].every(k => lease[k] === original[k]) && ['cases', 'executionPolicy', 'suitePolicy'].every(k => JSON.stringify(lease[k]) === JSON.stringify(original[k])), 'AGENT_PROTOCOL_INVALID', 'Reconciled immutable lease identity changed');
        }
        if (lease.state === 'recovered') {
            const recovery = decision.operatorRecovery;
            requireAgent(recovery && decision.directive === 'observe' && decision.deliveryClosed === false && recovery.priorFence === lease.fence && recovery.newFence > recovery.priorFence, 'AGENT_PROTOCOL_INVALID', 'Invalid operator recovery evidence');
            if (record?.operatorRecovery)
                requireAgent(JSON.stringify(record.operatorRecovery) === JSON.stringify(recovery), 'AGENT_PROTOCOL_INVALID', 'Operator recovery identity changed');
            if (store.get('released:' + lease.instanceId) && record?.phase === 'recovered')
                continue;
            const ownerPid = record?.ownerPid ?? store.get('instance:' + lease.instanceId)?.ownerPid;
            if (!absent(ownerPid)) {
                unresolved = true;
                continue;
            }
            if (!record) {
                const root = join(store.root, 'jobs', lease.leaseId);
                await mkdir(root, { recursive: true, mode: 0o700 });
                const leaseReference = await immutableJson(join(root, 'recovered-lease.json'), lease, protocolLimits.leaseBytes);
                record = { root, leaseReference, ownerInstanceId: lease.instanceId, ownerPid, cleanupState: decision.cleanupState };
            }
            record = { ...record, phase: 'recovered', operatorRecovery: recovery, operatorServerCleanup: decision.cleanupState };
            await saveRecord(store, lease, record);
            if (!owners.has(lease.instanceId))
                owners.set(lease.instanceId, []);
            continue;
        }
        requireAgent(!decision.operatorRecovery, 'AGENT_PROTOCOL_INVALID', 'Unexpected operator recovery on unrecovered lease');
        if (decision.deliveryClosed && decision.completionReceipt && decision.evidenceStatus === 'verified' && decision.cleanupState === 'confirmed') {
            requireAgent(lease.state === 'closed', 'AGENT_PROTOCOL_INVALID', 'Receipt for unclosed lease');
            if (store.get('released:' + lease.instanceId))
                continue;
            if (!record || !absent(record.ownerPid)) {
                unresolved = true;
                continue;
            }
            requireAgent(lease.acceptedThrough <= (store.get('sent:' + lease.leaseId) || 0), 'AGENT_PROTOCOL_INVALID', 'Reconcile acknowledged unsent events');
            await store.ack(lease.leaseId, lease.acceptedThrough);
            record = { ...record, phase: 'closed', receipt: decision.completionReceipt, acceptedThrough: lease.acceptedThrough, evidenceStatus: 'verified', cleanupState: 'confirmed' };
            await saveRecord(store, lease, record);
            const receipts = owners.get(lease.instanceId) || [];
            receipts.push({ leaseId: lease.leaseId, completionReceipt: record.receipt, acceptedThrough: record.acceptedThrough });
            owners.set(lease.instanceId, receipts);
            continue;
        }
        unresolved = true;
        // Recovery is reporting only. Even an unknown claim that never spawned a child
        // cannot be treated as an execution grant to this new instance.
        if (record?.completeReference && absent(record.ownerPid)) {
            const body = await readImmutable(record.completeReference, protocolLimits.httpBodyBytes), state = record.stateReference ? await readImmutable(record.stateReference, protocolLimits.httpBodyBytes) : { artifacts: [] };
            try {
                await historical(store, transport, lease, record, body, state.artifacts);
            }
            catch { }
        }
    }
    for (const [ownerInstanceId, receipts] of owners) {
        for (let i = 0; i < Math.max(1, receipts.length); i += 100) {
            const response = (await transport.release({ agentId: config.agentId, reportingInstanceId: store.instanceId, ownerInstanceId, ownerStopped: true, receipts: receipts.slice(i, i + 100) })).value;
            requireAgent(response.reportingInstanceId === store.instanceId && response.ownerInstanceId === ownerInstanceId, 'AGENT_PROTOCOL_INVALID', 'Instance release identity differs');
            if (response.released)
                await store.set('released:' + ownerInstanceId, true);
            else if (i + 100 >= receipts.length)
                unresolved = true;
        }
    }
    if (owners.size && !unresolved && !recovered)
        return recover(store, transport, config, true);
    requireAgent(!unresolved && instanceState === 'active', 'AGENT_QUARANTINED', 'Outstanding execution requires reconciliation or operator verification');
}
