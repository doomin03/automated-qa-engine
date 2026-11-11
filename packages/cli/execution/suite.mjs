import { resolve, dirname } from 'node:path';
import { loadBlueprint, readDocument } from '../../core/documents.mjs';
import { QaError, exitCode } from '../../core/errors.mjs';
export async function executeSuite(file, values, signal, run, json) {
    const suite = await readDocument(file, { documentRoot: values['document-root'] });
    if (suite.schemaVersion !== 'qa.suite/v1')
        throw new QaError('INVALID_DOCUMENT', 'Expected suite');
    const runs = [];
    for (const tc of suite.cases) {
        const output = await run(await loadBlueprint(resolve(dirname(file), tc), { selectors: values.selectors, targetManifest: values['target-manifest'], documentRoot: values['document-root'] }));
        runs.push({ runId: output.result.runId, outcome: output.result.outcome, reportDir: output.reportDir });
        if (signal.aborted || (suite.execution.stopOnFailure && output.result.outcome !== 'passed'))
            break;
    }
    if (!values.json)
        await json({ suiteId: suite.id, runs });
    return runs.every(r => r.outcome === 'passed') ? 0 : Math.max(...runs.map(r => exitCode(r.outcome)));
}
