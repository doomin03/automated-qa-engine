import { performance } from 'node:perf_hooks';
import { requireAgent } from './errors.mjs';
/** A lease is measured from request start, never response receipt or wall time. */
export class LeaseGuard {
    constructor(lease, startedAt, { now = () => performance.now(), onExpire = () => { } } = {}) { this.leaseId = lease.leaseId; this.fence = lease.fence; this.now = now; this.onExpire = onExpire; this.stopped = false; this.reason = null; this.controller = new AbortController(); this.margin = lease.safetyMarginMs; this.update(lease, startedAt); }
    get signal() { return this.controller.signal; }
    update(value, startedAt) {
        requireAgent(value.leaseId === this.leaseId && value.fence === this.fence, 'AGENT_PROTOCOL_INVALID', 'Heartbeat lease identity changed');
        if (this.stopped)
            return;
        if (value.cancelRequested || !['active', 'reporting'].includes(value.state)) {
            this.stop(value.cancelRequested ? 'SERVER_CANCELLED' : 'LEASE_UNAVAILABLE');
            return;
        }
        this.cutoff = startedAt + value.validForMs - this.margin;
        clearTimeout(this.timer);
        if (this.now() >= this.cutoff) {
            this.stop('LEASE_EXPIRED');
            return;
        }
        this.timer = setTimeout(() => this.stop('LEASE_EXPIRED'), Math.max(1, this.cutoff - this.now()));
    }
    check() { if (!this.stopped && this.now() >= this.cutoff)
        this.stop('LEASE_EXPIRED'); requireAgent(!this.stopped, 'AGENT_LEASE_EXPIRED', 'Execution lease is not valid'); }
    stop(reason) { if (this.stopped)
        return; this.stopped = true; this.reason = reason; clearTimeout(this.timer); this.controller.abort(); this.onExpire(reason); }
    dispose() { clearTimeout(this.timer); this.stopped = true; }
}
