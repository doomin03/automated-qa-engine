import { QaError } from '../../packages/core/errors.mjs';
import { performance } from 'node:perf_hooks';
export function budget(timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000)
        throw new QaError('INVALID_DOCUMENT', 'Invalid native operation timeout', 'step');
    const deadline = performance.now() + timeoutMs;
    return () => Math.max(0, Math.ceil(deadline - performance.now()));
}
