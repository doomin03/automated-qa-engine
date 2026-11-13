import { frozenSnapshot } from '../domain/immutable.mjs';
import { saveObservation } from '../observations.mjs';
import { createEvidenceCollector } from './evidence.mjs';
// This subsystem alone owns the mutable manifest. Execution receives operations
// and detached views, never the array or filesystem destination.
export function createRunArtifacts({ adapter, dir, containsSecrets, recordCleanup }) {
    const manifest = [];
    const evidence = createEvidenceCollector({ adapter, dir, artifacts: manifest, containsSecrets, recordCleanup });
    return Object.freeze({
        count: () => manifest.length,
        snapshot: (from = 0) => frozenSnapshot(manifest.slice(from)),
        capture: evidence.capture,
        suppress: evidence.suppress,
        collectObservation: (observation, nodeId, signal) => saveObservation(observation, nodeId, dir, manifest, signal),
    });
}
