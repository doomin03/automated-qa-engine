import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { protocolLimits } from '../protocol.mjs';
import { immutableJson } from '../materialize/immutable.mjs';
export async function persistBody(store, root, body, prefix) {
    return immutableJson(join(root, prefix + '-' + randomUUID() + '.json'), body, protocolLimits.httpBodyBytes);
}
export async function saveRecord(store, lease, record) { await store.set('lease:' + lease.leaseId, { ...record, caseResults: [], artifacts: [] }); }
