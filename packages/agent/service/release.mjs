export async function releaseSelf(store, transport, config) {
    const records = store.entries('lease:').map(([, r]) => r).filter(r => r.ownerInstanceId === store.instanceId);
    if (records.some(r => r.phase !== 'closed' || r.cleanupState !== 'confirmed' || !r.receipt))
        return false;
    const receipts = store.entries('lease:').filter(([, r]) => r.ownerInstanceId === store.instanceId).map(([key, r]) => ({ leaseId: key.slice(6), completionReceipt: r.receipt, acceptedThrough: r.acceptedThrough }));
    let released = false;
    for (let i = 0; i < Math.max(1, receipts.length); i += 100) {
        const value = (await transport.release({ agentId: config.agentId, reportingInstanceId: store.instanceId, ownerInstanceId: store.instanceId, ownerStopped: true, receipts: receipts.slice(i, i + 100) })).value;
        released = value.released;
    }
    if (released)
        await store.set('released:' + store.instanceId, true);
    return released;
}
