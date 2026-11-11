import { mkdir, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { AgentError, requireAgent } from '../errors.mjs';
import { protocolLimits } from '../protocol.mjs';
import { immutableJson } from '../materialize/immutable.mjs';
import { checkLeasePolicy } from '../materialize/policy.mjs';
import { materializeCases } from '../materialize/resources.mjs';
import { materializeNativeConfig } from '../materialize/native.mjs';
import { LeaseGuard } from '../lease.mjs';
import { executeChild } from '../child.mjs';
import { holderFor } from '../reporting/identity.mjs';
import { flushEvents } from '../reporting/events.mjs';
import { completeDelivery } from '../reporting/completion.mjs';
import { idle, transient } from './common.mjs';
import { persistBody, saveRecord } from './records.mjs';
import { historical } from './history.mjs';
export async function executeLease({ store, transport, config, expected, signal, onStatus }, lease, startedAt) {
    requireAgent(!store.get('lease:' + lease.leaseId), 'AGENT_REEXECUTION_DENIED', 'Recorded lease cannot execute again');
    const root = join(store.root, 'jobs', lease.leaseId);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const leaseReference = await immutableJson(join(root, 'lease.json'), lease, protocolLimits.leaseBytes);
    let record = { root, leaseReference, ownerInstanceId: store.instanceId, ownerPid: process.pid, phase: 'received', cleanupState: 'confirmed', caseResults: [], artifacts: [] };
    await saveRecord(store, lease, record);
    const guard = new LeaseGuard(lease, startedAt), executionSignal = signal ? AbortSignal.any([signal, guard.signal]) : guard.signal;
    const loopStop = new AbortController();
    let reportingError, heartbeatInFlight = false, sending = false;
    const heartbeat = async () => {
        if (heartbeatInFlight)
            return;
        heartbeatInFlight = true;
        try {
            const response = await transport.heartbeat(lease.leaseId, { ...holderFor(lease), lastAcknowledgedSequence: store.acknowledged(lease.leaseId), cleanupState: record.cleanupState });
            guard.update(response.value, response.startedAt);
        }
        catch (e) {
            if (!transient(e)) {
                reportingError = e;
                guard.stop('HEARTBEAT_REJECTED');
            }
        }
        finally {
            heartbeatInFlight = false;
        }
    };
    const heartbeats = (async () => { while (!loopStop.signal.aborted) {
        await idle(lease.heartbeatIntervalMs, loopStop.signal);
        if (!loopStop.signal.aborted)
            await heartbeat();
    } })();
    const sender = (async () => { while (!loopStop.signal.aborted) {
        await idle(250, loopStop.signal);
        if (loopStop.signal.aborted)
            break;
        sending = true;
        try {
            await flushEvents({ store, transport, lease });
        }
        catch (e) {
            if (!transient(e)) {
                reportingError = e;
                guard.stop('DELIVERY_REJECTED');
            }
        }
        finally {
            sending = false;
        }
    } })();
    let executionStatus = 'finished', reason = null;
    try {
        const { local } = checkLeasePolicy(lease, config, { ...expected, instanceId: store.instanceId });
        const disk = await statfs(root);
        requireAgent(disk.bavail * disk.bsize >= 256 * 1024 * 1024, 'AGENT_STATE_FULL', 'Insufficient free space for execution evidence');
        guard.check();
        executionSignal.throwIfAborted();
        const appiumConfig = await materializeNativeConfig(lease, local, root), cases = await materializeCases(lease, root, transport, holderFor(lease), executionSignal);
        for (const [index, item] of cases.entries()) {
            guard.check();
            executionSignal.throwIfAborted();
            const pinned = lease.cases[index], blueprint = JSON.parse(pinned.blueprintJson);
            record = { ...record, phase: 'executing', cleanupState: 'unknown', currentCase: item.caseId, childPid: null };
            await saveRecord(store, lease, record);
            await onStatus({ type: 'agent.case.started', leaseId: lease.leaseId, caseId: item.caseId });
            const result = await executeChild({ item: { ...item, blueprintSnapshotHash: pinned.blueprintSnapshotHash }, blueprint, expectedVersion: expected.engineVersion, config, resource: local, appiumConfig, signal: executionSignal,
                onSpawn: async ({ pid }) => { record = { ...record, childPid: pid ?? null }; await saveRecord(store, lease, record); },
                onEvent: async (event) => { await store.enqueue(lease.leaseId, { caseId: item.caseId, engineEventJson: JSON.stringify(event) }); } });
            const caseResults = [...record.caseResults, ...(result.result ? [{ caseId: item.caseId, resultJson: JSON.stringify(result.result) }] : [])], artifacts = [...record.artifacts, ...(result.artifacts || [])];
            // Large case results live outside the small append-only journal.
            const stateReference = await persistBody(store, root, { caseResults, artifacts }, 'results');
            record = { ...record, phase: 'reporting', cleanupState: result.cleanupState, childPid: null, stateReference, caseResults, artifacts };
            await saveRecord(store, lease, { ...record, caseResults: [], artifacts: [] });
            requireAgent(artifacts.length <= 256 && artifacts.reduce((sum, a) => sum + a.size, 0) <= protocolLimits.executionArtifactBytes, 'AGENT_STATE_FULL', 'Suite evidence exceeds upload budget');
            if (!result.result) {
                executionStatus = 'infra_error';
                reason = result.reason;
                break;
            }
            if (result.cleanupState !== 'confirmed') {
                executionStatus = 'infra_error';
                reason = 'RESOURCE_CLEANUP_UNCONFIRMED';
                break;
            }
            if (result.result.outcome === 'cancelled' || executionSignal.aborted) {
                executionStatus = 'cancelled';
                reason = 'EXECUTION_CANCELLED';
                break;
            }
            if (lease.suitePolicy.stopOnFailure && result.result.outcome !== 'passed')
                break;
        }
    }
    catch (error) {
        executionStatus = executionSignal.aborted ? 'cancelled' : error.code === 'AGENT_POLICY_DENIED' ? 'blocked' : 'infra_error';
        reason = executionSignal.aborted ? 'EXECUTION_CANCELLED' : error instanceof AgentError ? error.code : 'AGENT_EXECUTION_FAILURE';
    }
    const body = { ...holderFor(lease), caseResults: record.caseResults, executionStatus, reason, cleanupState: record.cleanupState, artifactManifest: record.artifacts.map(({ localPath, ...item }) => item) };
    try {
        const completeReference = await persistBody(store, root, body, 'complete');
        record = { ...record, completeReference, phase: 'reporting' };
        await saveRecord(store, lease, { ...record, caseResults: [], artifacts: [] });
        // Stop event sender before final flushing; heartbeat remains live throughout uploads.
        loopStop.abort();
        await sender;
        await heartbeats;
        const reportStop = new AbortController();
        const reportingHeartbeat = (async () => { while (!reportStop.signal.aborted) {
            await idle(5000, reportStop.signal);
            if (!reportStop.signal.aborted)
                await heartbeat();
        } })();
        try {
            const deadline = performance.now() + 30000;
            let delivered;
            while (performance.now() < deadline) {
                try {
                    delivered = await completeDelivery({ store, transport, lease, body, artifacts: record.artifacts });
                    break;
                }
                catch (e) {
                    if (!transient(e) || reportingError || ['LEASE_EXPIRED', 'LEASE_UNAVAILABLE', 'HEARTBEAT_REJECTED', 'DELIVERY_REJECTED'].includes(guard.reason))
                        throw e;
                    await idle(500);
                }
            }
            requireAgent(delivered, 'AGENT_DELIVERY_PENDING', 'Completion remains pending');
            record = { ...record, phase: delivered.deliveryClosed ? 'closed' : 'quarantined', receipt: delivered.completionReceipt, acceptedThrough: delivered.acceptedThrough, evidenceStatus: delivered.evidenceStatus };
            await saveRecord(store, lease, { ...record, caseResults: [], artifacts: [] });
        }
        finally {
            reportStop.abort();
            await reportingHeartbeat;
        }
    }
    catch (error) {
        record = { ...record, phase: 'quarantined' };
        await saveRecord(store, lease, { ...record, caseResults: [], artifacts: [] });
        if (error.status === 409 || ['LEASE_EXPIRED', 'LEASE_UNAVAILABLE', 'HEARTBEAT_REJECTED', 'DELIVERY_REJECTED'].includes(guard.reason))
            try {
                await historical(store, transport, lease, record, body, record.artifacts);
            }
            catch { }
        await onStatus({ type: 'agent.delivery.pending', leaseId: lease.leaseId, cleanupState: record.cleanupState, code: error instanceof AgentError ? error.code : 'AGENT_REPORT_FAILURE' });
    }
    finally {
        loopStop.abort();
        await Promise.all([sender, heartbeats]);
        guard.dispose();
    }
    await onStatus({ type: 'agent.lease.finished', leaseId: lease.leaseId, executionStatus, cleanupState: record.cleanupState, deliveryClosed: record.phase === 'closed' });
    return record;
}
