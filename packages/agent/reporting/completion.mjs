import { readBounded } from '../../core/io/files.mjs';
import { protocolLimits, boundedJson } from '../protocol.mjs';
import { requireAgent } from '../errors.mjs';
import { sha256 } from '../materialize/immutable.mjs';
import { holderFor, identity } from './identity.mjs';
import { flushEvents } from './events.mjs';
export async function completeDelivery({ store, transport, lease, body, artifacts, signal }) {
    await flushEvents({ store, transport, lease, signal });
    let value = (await transport.complete(lease.leaseId, body, signal)).value;
    identity(value, lease);
    const verify = value => {
        identity(value, lease);
        requireAgent(value.accepted && value.acceptedThrough === store.acknowledged(lease.leaseId), 'AGENT_PROTOCOL_INVALID', 'Completion cursor or acceptance differs');
        requireAgent(value.artifacts.length === artifacts.length, 'AGENT_PROTOCOL_INVALID', 'Incomplete artifact receipt set');
        const keys = new Set(), ids = new Set();
        for (const receipt of value.artifacts) {
            const key = receipt.caseId + '\0' + receipt.path, source = artifacts.find(a => a.caseId === receipt.caseId && a.path === receipt.path);
            requireAgent(!keys.has(key) && !ids.has(receipt.artifactId) && source && ['sha256', 'size', 'mimeType'].every(k => source[k] === receipt[k]), 'AGENT_PROTOCOL_INVALID', 'Artifact receipt set differs');
            keys.add(key);
            ids.add(receipt.artifactId);
        }
        if (value.deliveryClosed)
            requireAgent(value.completionReceipt && value.cleanupState === 'confirmed' && value.evidenceStatus === 'verified' && !value.quarantined && value.artifacts.every(a => a.uploaded), 'AGENT_PROTOCOL_INVALID', 'Closed delivery lacks verified cleanup and evidence');
    };
    verify(value);
    for (const receipt of value.artifacts) {
        const source = artifacts.find(a => a.caseId === receipt.caseId && a.path === receipt.path);
        requireAgent(source && ['sha256', 'size', 'mimeType'].every(key => source[key] === receipt[key]), 'AGENT_PROTOCOL_INVALID', 'Artifact upload receipt differs from manifest');
        if (receipt.uploaded)
            continue;
        const bytes = await readBounded(source.localPath, protocolLimits.artifactBytes);
        requireAgent(bytes.length === source.size && sha256(bytes) === source.sha256, 'AGENT_STATE_INVALID', 'Persisted artifact bytes changed');
        const uploaded = (await transport.artifact(lease.leaseId, { ...holderFor(lease), caseId: source.caseId, artifactId: receipt.artifactId, sha256: source.sha256, mimeType: source.mimeType, base64: bytes.toString('base64') }, signal)).value;
        requireAgent(uploaded.uploaded && uploaded.artifactId === receipt.artifactId && ['caseId', 'path', 'sha256', 'size', 'mimeType'].every(k => uploaded[k] === source[k]), 'AGENT_PROTOCOL_INVALID', 'Artifact upload acknowledgement differs');
    }
    if (!value.deliveryClosed) {
        value = (await transport.complete(lease.leaseId, body, signal)).value;
        verify(value);
    }
    return value;
}
