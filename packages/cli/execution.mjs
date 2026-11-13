import { loadBlueprint } from '../core/documents.mjs';
import { executeBlueprint } from '../core/runner.mjs';
import { QaError, exitCode } from '../core/errors.mjs';
import { loadSecretResolver } from './execution/config.mjs';
import { createAdapter } from './execution/adapter.mjs';
import { replayEvents } from './execution/replay.mjs';
import { executeSuite } from './execution/suite.mjs';
export async function executionCommand({ command, file, values }, signal, json) {
    if (!['run', 'run-suite', 'demo'].includes(command))
        throw new QaError('INVALID_ARGUMENT', 'Unknown command');
    if (command !== 'demo' && !file)
        throw new QaError('INVALID_ARGUMENT', 'Input file required');
    const secretResolver = await loadSecretResolver(values);
    const run = async (b) => {
        if (values.target && values.target !== b.target.platform)
            throw new QaError('UNSUPPORTED_CAPABILITY', 'Requested target does not match blueprint');
        let delivered = 0;
        const stream = values.json && command !== 'demo';
        const adapter = await createAdapter(b, values);
        const output = await executeBlueprint(b, { adapter, headless: !values.headed, reportDir: values.report || 'artifacts', timeoutMs: values.timeout ? Number(values.timeout) : 60000, signal, secretResolver, referenceRoot: values['reference-root'], allowProduction: !!values['allow-production'], onEvent: stream ? async (event) => { await json(event); delivered = event.sequence; } : () => { } });
        if (stream)
            await replayEvents(output, delivered, json);
        return output;
    };
    if (command === 'demo')
        return (await import('./execution/demo.mjs')).executeDemo(run, json);
    if (command === 'run-suite')
        return executeSuite(file, values, signal, run, json);
    const output = await run(await loadBlueprint(file, { selectors: values.selectors, targetManifest: values['target-manifest'], documentRoot: values['document-root'] }));
    if (!values.json)
        await json({ outcome: output.result.outcome, runId: output.result.runId, reportDir: output.reportDir });
    return exitCode(output.result.outcome);
}
