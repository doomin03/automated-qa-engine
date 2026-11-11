import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { MAX_ARTIFACTS } from '../limits.mjs';
import { readBounded } from '../io/files.mjs';
import { PNG_MAX_BYTES, inspectPng } from '../media/png.mjs';
import { bounded } from './deadline.mjs';
// One owner reserves unique staging names and controls late manifest appends.
export function createEvidenceCollector({ adapter, dir, artifacts, containsSecrets, recordCleanup }) {
    let evidenceSequence = 0, suppressEvidence = false;
    async function evidence(nodeId, evidenceSignal = new AbortController().signal, timeoutMs = 3000) {
        if (artifacts.length >= MAX_ARTIFACTS)
            return 'capacity';
        const number = evidenceSequence++, path = 'evidence-' + number + '.png', full = join(dir, path), staging = join(dir, '.capture-' + number + '.png');
        const controller = new AbortController(), captureSignal = AbortSignal.any([evidenceSignal, controller.signal]), budget = Math.min(3000, timeoutMs), captureDeadline = performance.now() + budget;
        const active = () => !captureSignal.aborted && performance.now() < captureDeadline;
        try {
            const captured = await bounded(() => adapter.captureEvidence(staging, { containsSecrets: containsSecrets || suppressEvidence, signal: captureSignal, timeoutMs: budget }), captureSignal, budget, 'cleanup');
            if (!active())
                return 'error';
            if (!captured)
                return 'skipped';
            const bytes = await readBounded(staging, PNG_MAX_BYTES);
            inspectPng(bytes);
            if (!active())
                return 'error';
            // The adapter only receives staging. A late or repeated adapter write can
            // never replace bytes already named in the public artifact manifest.
            await writeFile(full, bytes, { flag: 'wx' });
            if (!active())
                return 'error';
            const item = { type: 'screenshot', path, contentType: 'image/png', sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
            artifacts.push(item);
            return 'captured';
        }
        catch {
            if (!captureSignal.aborted)
                recordCleanup({ code: 'EVIDENCE_ERROR', message: 'Unable to capture evidence', phase: 'cleanup', ...(nodeId ? { nodeId } : {}) });
            return 'error';
        }
        finally {
            controller.abort();
            await unlink(staging).catch(() => { });
        }
    }
    return { capture: evidence, suppress() { suppressEvidence = true; } };
}
