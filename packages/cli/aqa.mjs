#!/usr/bin/env node
import { QaError, exitCode } from '../core/errors.mjs';
import { attachControl, requestedDiagnostic } from './control.mjs';
import { parseCliArgs, help, helpText } from './args.mjs';
import { ENGINE_VERSION } from './metadata.mjs';
import { createOutput } from './output.mjs';
const output = createOutput(), { stdout, stderr } = output, json = stdout.json;
let diagnosticStream = requestedDiagnostic(process.argv.slice(2));
const diagnostic = value => (diagnosticStream === 'stderr' ? stderr : stdout).json(value);
try {
    const args = parseCliArgs(process.argv.slice(2));
    diagnosticStream = args.values.diagnostics || 'stdout';
    let queryExit;
    if (args.values.version) {
        await json({ engineVersion: ENGINE_VERSION });
        queryExit = 0;
    }
    else if (args.values.help || !args.command) {
        if (args.values.json)
            await json(help());
        else
            await stdout.text(helpText());
        queryExit = 0;
    }
    else if (!['run', 'run-suite', 'demo', 'agent'].includes(args.command))
        queryExit = await (await import('./commands.mjs')).documentCommand(args, stdout);
    if (queryExit !== undefined)
        process.exitCode = queryExit;
    else {
        const controller = new AbortController();
        const cancel = () => controller.abort(new QaError('CANCELLED', 'Execution cancelled', 'run'));
        process.on('SIGINT', cancel);
        process.on('SIGTERM', cancel);
        const stopControl = args.values['control-stdin'] ? attachControl(process.stdin, { onCancel: cancel, onInvalid: () => {
                void diagnostic({ error: { code: 'INVALID_CONTROL', message: 'Invalid or oversized UTF-8 JSONL control message', details: [] } }).catch(() => { });
                controller.abort(new QaError('ENGINE_ERROR', 'CLI control input rejected', 'run'));
            } }) : () => { };
        try {
            if (args.command === 'agent') {
                if (!args.values.config)
                    throw new QaError('INVALID_ARGUMENT', 'Agent requires --config FILE');
                const { runAgent } = await import('../agent/supervisor.mjs');
                await runAgent({ configFile: args.values.config, once: args.values.once === true, signal: controller.signal, onStatus: json });
                process.exitCode = 0;
            }
            else
                process.exitCode = await (await import('./execution.mjs')).executionCommand(args, controller.signal, json);
        }
        finally {
            stopControl();
            // pause() alone leaves Windows pipe handles alive after command completion.
            if (args.values['control-stdin'])
                process.stdin.destroy();
            process.removeListener('SIGINT', cancel);
            process.removeListener('SIGTERM', cancel);
        }
    }
}
catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('AGENT_')) {
        await stderr.json({ error: { code: error.code, message: error.message, details: [] } }).catch(() => { });
        process.exitCode = 3;
    }
    else {
        const e = error instanceof QaError ? error : new QaError('INVALID_ARGUMENT', 'Unable to read input or arguments');
        const delivered = await diagnostic({ error: { code: e.code, message: e.message, details: e.details } }).then(() => true, () => false);
        process.exitCode = delivered ? exitCode(e.code) : 3;
    }
}
finally {
    await output.close();
}
