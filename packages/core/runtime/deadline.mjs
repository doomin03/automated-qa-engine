import { QaError } from '../errors.mjs';
export const INTERNAL_DEADLINE = Symbol('internalDeadline');
export function interrupted(signal) {
    return signal.reason instanceof QaError ? signal.reason : new QaError('CANCELLED', 'Execution cancelled', 'run');
}
export function bounded(operation, signal, timeoutMs, phase) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(interrupted(signal));
            return;
        }
        const timer = setTimeout(() => { const error = new QaError('TIMEOUT', 'Execution deadline exceeded', phase); error[INTERNAL_DEADLINE] = true; finish(error); }, timeoutMs);
        const onAbort = () => finish(interrupted(signal));
        function finish(error, value) { clearTimeout(timer); signal.removeEventListener('abort', onAbort); error ? reject(error) : resolve(value); }
        signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve().then(operation).then(v => finish(null, v), finish);
    });
}
