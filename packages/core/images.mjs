import { Worker } from 'node:worker_threads';
import { inspectPng } from './resources.mjs';
import { QaError } from './errors.mjs';
export async function comparePng(baseline, actual, { channelTolerance, crop, timeoutMs = 10000, signal = new AbortController().signal } = {}) {
    const b = inspectPng(baseline), a = inspectPng(actual);
    if (!b.colorSupported || !a.colorSupported)
        return { blocked: 'UNSUPPORTED_COLOR_PROFILE' };
    if (crop && (crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1 || crop.x + crop.width > a.width || crop.y + crop.height > a.height))
        return { blocked: 'IMAGE_SIZE_MISMATCH' };
    if (b.width !== (crop?.width || a.width) || b.height !== (crop?.height || a.height))
        return { blocked: 'IMAGE_SIZE_MISMATCH' };
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new QaError('CANCELLED', 'Image comparison cancelled', 'run'));
            return;
        }
        const worker = new Worker(new URL('./image-worker.mjs', import.meta.url), { workerData: { baseline, actual, channelTolerance, crop }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
        let done = false;
        const timer = setTimeout(() => finish(new QaError('TIMEOUT', 'Image comparison deadline exceeded', 'step')), timeoutMs);
        const abort = () => finish(new QaError('CANCELLED', 'Image comparison cancelled', 'run'));
        signal.addEventListener('abort', abort, { once: true });
        function finish(error, value) { if (done)
            return; done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate().finally(() => error ? reject(error) : resolve(value)); }
        worker.once('message', m => m.error ? finish(new QaError('EVIDENCE_ERROR', 'PNG decoding failed', 'step')) : finish(null, { ...m, ...(m.diff ? { diff: Buffer.from(m.diff), actual: Buffer.from(m.actual) } : {}) }));
        worker.once('error', () => finish(new QaError('EVIDENCE_ERROR', 'Image worker failed', 'step')));
        worker.once('exit', () => { if (!done)
            finish(new QaError('EVIDENCE_ERROR', 'Image worker exited', 'step')); });
    });
}
