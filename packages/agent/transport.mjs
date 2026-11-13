import { performance } from 'node:perf_hooks';
import { AgentError, requireAgent } from './errors.mjs';
import { validateProtocol, boundedJson, protocolLimits } from './protocol.mjs';
export class AgentTransport {
    constructor({ serverUrl, token, allowInsecureLocal = false, timeoutMs = 5000 }) {
        let url;
        try {
            url = new URL(serverUrl);
        }
        catch {
            throw new AgentError('AGENT_CONFIG_INVALID', 'Invalid Agent server URL');
        }
        const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
        requireAgent(url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback && allowInsecureLocal)), 'AGENT_CONFIG_INVALID', 'Agent requires HTTPS or explicit loopback test server');
        requireAgent(typeof token === 'string' && token.length > 0 && token.length <= 4096 && !/[\s]/.test(token), 'AGENT_CONFIG_INVALID', 'Agent bearer credential is required');
        requireAgent(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 5000, 'AGENT_CONFIG_INVALID', 'Invalid Agent HTTP deadline');
        this.base = url.origin;
        this.token = token;
        this.timeoutMs = timeoutMs;
    }
    async request(path, { method = 'POST', body, requestType, responseType, limit = protocolLimits.httpBodyBytes, signal } = {}) {
        requireAgent(path.startsWith('/api/v1/agent/') && !path.includes('://') && !path.includes('#'), 'AGENT_PROTOCOL_INVALID', 'Invalid Agent operation path');
        if (requestType)
            validateProtocol(requestType, body);
        const text = body === undefined ? undefined : boundedJson(body, path.endsWith('/events') ? protocolLimits.eventBatchBytes : protocolLimits.httpBodyBytes), startedAt = performance.now();
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeoutMs), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
        try {
            const response = await fetch(this.base + path, { method, redirect: 'manual', headers: { authorization: 'Bearer ' + this.token, ...(text === undefined ? {} : { 'content-type': 'application/json' }) }, body: text, signal: combined });
            if (response.status === 204) {
                requireAgent(path === '/api/v1/agent/claims', 'AGENT_PROTOCOL_INVALID', 'Unexpected empty Agent response');
                return { status: 204, value: null, startedAt };
            }
            requireAgent(response.status < 300 || response.status >= 400, 'AGENT_PROTOCOL_INVALID', 'Agent server redirect refused');
            const contentLength = response.headers.get('content-length');
            if (contentLength !== null)
                requireAgent(/^\d+$/.test(contentLength) && Number(contentLength) <= limit, 'AGENT_PROTOCOL_LIMIT', 'Agent response exceeds byte limit');
            requireAgent(response.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'AGENT_PROTOCOL_INVALID', 'Agent server returned non-JSON response');
            const chunks = [];
            let total = 0;
            if (response.body)
                for await (const chunk of response.body) {
                    total += chunk.length;
                    if (total > limit) {
                        controller.abort();
                        throw new AgentError('AGENT_PROTOCOL_LIMIT', 'Agent response exceeds byte limit');
                    }
                    chunks.push(chunk);
                }
            let value;
            try {
                value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total)));
            }
            catch {
                throw new AgentError('AGENT_PROTOCOL_INVALID', 'Agent server returned invalid JSON');
            }
            if (!response.ok) {
                validateProtocol('ApiErrorResponse', value);
                const error = new AgentError('AGENT_HTTP_' + response.status, 'Agent server rejected request');
                error.status = response.status;
                error.serverCode = value.code;
                throw error;
            }
            if (responseType)
                validateProtocol(responseType, value);
            return { status: response.status, value, startedAt };
        }
        catch (error) {
            if (error instanceof AgentError)
                throw error;
            throw new AgentError(combined.aborted ? 'AGENT_HTTP_TIMEOUT' : 'AGENT_HTTP_FAILURE', combined.aborted ? 'Agent HTTP deadline or cancellation reached' : 'Agent HTTP request failed');
        }
        finally {
            clearTimeout(timer);
            controller.abort();
        }
    }
    claim(body, signal) { return this.request('/api/v1/agent/claims', { body, requestType: 'ClaimRequest', responseType: 'ClaimResponse', limit: protocolLimits.claimResponseBytes, signal }); }
    heartbeat(leaseId, body, signal) { return this.request(`/api/v1/agent/leases/${encodeURIComponent(leaseId)}/heartbeat`, { body, requestType: 'HeartbeatRequest', responseType: 'HeartbeatResponse', signal }); }
    events(leaseId, body, signal) { return this.request(`/api/v1/agent/leases/${encodeURIComponent(leaseId)}/events`, { body, requestType: 'EventsRequest', responseType: 'EventsResponse', signal }); }
    complete(leaseId, body, signal) { return this.request(`/api/v1/agent/leases/${encodeURIComponent(leaseId)}/complete`, { method: 'PUT', body, requestType: 'CompleteRequest', responseType: 'CompleteResponse', signal }); }
    reconcile(body, cursor, signal) { return this.request('/api/v1/agent/reconcile' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), { body, requestType: 'ReconcileRequest', responseType: 'ReconcileResponse', limit: protocolLimits.reconcileResponseBytes, signal }); }
    resource(leaseId, resourceId, holder, signal) { const query = new URLSearchParams(Object.entries(holder).map(([k, v]) => [k, String(v)])); return this.request(`/api/v1/agent/leases/${encodeURIComponent(leaseId)}/resources/${encodeURIComponent(resourceId)}?${query}`, { method: 'GET', responseType: 'ResourceBytes', signal }); }
    artifact(leaseId, body, signal) { return this.request(`/api/v1/agent/leases/${encodeURIComponent(leaseId)}/artifacts`, { method: 'PUT', body, requestType: 'ArtifactUploadRequest', responseType: 'ArtifactReceipt', signal }); }
    historical(leaseId, body, signal) { return this.request(`/api/v1/agent/leases/${encodeURIComponent(leaseId)}/historical-evidence`, { body, requestType: 'HistoricalEvidenceRequest', responseType: 'HistoricalEvidenceResponse', signal }); }
    release(body, signal) { return this.request('/api/v1/agent/instances/release', { body, requestType: 'InstanceReleaseRequest', responseType: 'InstanceReleaseResponse', signal }); }
}
