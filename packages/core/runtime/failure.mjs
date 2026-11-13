import { QaError } from '../errors.mjs';
export function publicFailure(error, nodeId) {
    const e = error instanceof QaError ? error : new QaError('ENGINE_ERROR', 'Unexpected execution error', 'run');
    return { code: e.code, message: e.message, phase: e.phase, ...(nodeId ? { nodeId } : {}) };
}
export function outcomeFor(failure) {
    if (failure.code === 'CANCELLED')
        return 'cancelled';
    if (['UNSUPPORTED_CAPABILITY', 'POLICY_DENIED', 'SECRET_NOT_FOUND'].includes(failure.code))
        return 'blocked';
    if (['ASSERTION_FAILED', 'ELEMENT_NOT_FOUND'].includes(failure.code) || (failure.code === 'TIMEOUT' && ['step', 'run'].includes(failure.phase)))
        return 'failed';
    return 'infra_error';
}
