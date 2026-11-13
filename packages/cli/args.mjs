import { parseArgs } from 'node:util';
import { QaError } from '../core/errors.mjs';
import { commandRules as commands } from './catalog.mjs';
export { help, helpText } from './help.mjs';
export function parseCliArgs(args) {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
            json: { type: 'boolean' }, version: { type: 'boolean' }, help: { type: 'boolean' }, headed: { type: 'boolean' }, headless: { type: 'boolean' }, config: { type: 'string' }, once: { type: 'boolean' },
            'allow-production': { type: 'boolean' }, report: { type: 'string' }, out: { type: 'string' }, format: { type: 'string' },
            timeout: { type: 'string' }, selectors: { type: 'string' }, 'target-manifest': { type: 'string' }, 'secrets-file': { type: 'string' }, target: { type: 'string' },
            'control-stdin': { type: 'boolean' }, diagnostics: { type: 'string' }, 'reference-root': { type: 'string' }, bindings: { type: 'string' }, 'preset-version': { type: 'string' }, 'appium-config': { type: 'string' }, 'document-root': { type: 'string' }, 'source-map': { type: 'string' }, 'source-out': { type: 'string' },
            'template-version': { type: 'string' }, 'template-sha256': { type: 'string' }
        } });
    const [command, file] = positionals;
    if (values.diagnostics && !['stdout', 'stderr'].includes(values.diagnostics))
        throw new QaError('INVALID_ARGUMENT', 'Diagnostics must be stdout or stderr');
    if (values['control-stdin'] && !['run', 'run-suite'].includes(command))
        throw new QaError('INVALID_ARGUMENT', 'Stdin control requires run or run-suite');
    if (values.headed && values.headless)
        throw new QaError('INVALID_ARGUMENT', 'Headed and headless conflict');
    if (values.version && values.help)
        throw new QaError('INVALID_ARGUMENT', 'Version and help conflict');
    let rule = commands[command];
    if (command === 'preset')
        rule = file === 'list' ? [2, []] : file === 'expand' ? [3, ['preset-version', 'bindings', 'out']] : undefined;
    if (command === 'templates')
        rule = file === 'list' ? [2, []] : file === 'show' ? [3, ['template-version']] : file === 'create' ? [3, ['template-version', 'template-sha256', 'bindings', 'out', 'document-root']] : undefined;
    if (values.version || values.help || !command) {
        if (positionals.length || Object.keys(values).some(k => !['json', 'version', 'help', 'diagnostics'].includes(k)))
            throw new QaError('INVALID_ARGUMENT', 'Help and version accept only global options');
    }
    else {
        if (!rule || positionals.length !== rule[0])
            throw new QaError('INVALID_ARGUMENT', 'Invalid command arguments');
        const allowed = new Set(['json', 'diagnostics', ...rule[1]]);
        if (Object.keys(values).some(k => !allowed.has(k)))
            throw new QaError('INVALID_ARGUMENT', 'Option is not supported by this command');
    }
    return { values, command, file, positionals };
}
