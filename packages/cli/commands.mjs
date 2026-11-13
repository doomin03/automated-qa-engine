import { ENGINE_VERSION } from './metadata.mjs';
import { help, helpText } from './args.mjs';
// Keep document dispatch lightweight. Each literal import is verified by the
// architecture gate and included in the published package.
export async function documentCommand(args, output) {
    if (args.values.version) {
        await output.json({ engineVersion: ENGINE_VERSION });
        return 0;
    }
    if (args.values.help || !args.command) {
        if (args.values.json)
            await output.json(help());
        else
            await output.text(helpText());
        return 0;
    }
    if (['preset', 'expand'].includes(args.command))
        return (await import('./commands/authoring.mjs')).command(args, output);
    if (['templates', 'compose'].includes(args.command))
        return (await import('./commands/document-authoring.mjs')).command(args, output);
    if (['doctor', 'devices'].includes(args.command))
        return (await import('./commands/diagnostics.mjs')).command(args, output);
    return (await import('./commands/documents.mjs')).command(args, output);
}
