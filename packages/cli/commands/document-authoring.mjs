import { open, realpath, unlink } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { listTemplates, createTemplate, composeBlueprint } from '../../core/document-authoring.mjs';
import { readBounded, documentPath } from '../../core/io/files.mjs';
import { QaError, ensure } from '../../core/errors.mjs';

function inside(base, full) {
    const rel = relative(base, full);
    return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
}
function lexicalContainment(path, root) {
    if (root) ensure(inside(resolve(root), resolve(path)), 'POLICY_DENIED', 'Path escapes document root');
}
async function inputJson(path, root) {
    try {
        lexicalContainment(path, root);
        const bytes = await readBounded(await documentPath(path, root));
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
        if (error instanceof QaError) throw error;
        throw new QaError('INVALID_DOCUMENT', 'Unable to read authoring JSON input');
    }
}
async function writeExclusive(path, value, root) {
    lexicalContainment(path, root);
    const full = resolve(path), parent = await realpath(dirname(full));
    if (root) {
        const base = await realpath(root);
        ensure(inside(base, parent), 'POLICY_DENIED', 'Output escapes document root');
    }
    // Open on the resolved parent, avoiding a second traversal through the supplied alias.
    const target = resolve(parent, relative(dirname(full), full));
    const handle = await open(target, 'wx');
    let success = false;
    try {
        await handle.writeFile(JSON.stringify(value) + '\n', 'utf8');
        await handle.sync();
        success = true;
    } finally {
        await handle.close();
        if (!success) await unlink(target).catch(() => {});
    }
}
export async function command({ command, file, values, positionals }, output) {
    let result;
    if (command === 'compose') result = composeBlueprint(await inputJson(file, values['document-root']));
    else if (file === 'list') result = listTemplates();
    else if (file === 'show') {
        if (!values['template-version']) throw new QaError('INVALID_ARGUMENT', 'Templates show requires --template-version');
        result = listTemplates().templates.find(t => t.id === positionals[2] && t.version === values['template-version']);
        ensure(result, 'INVALID_DOCUMENT', 'Unknown template id/version');
    } else {
        if (!values['template-version'] || !values['template-sha256'] || !values.bindings)
            throw new QaError('INVALID_ARGUMENT', 'Templates create requires version, SHA-256 and bindings');
        result = createTemplate({ templateId: positionals[2], version: values['template-version'], sha256: values['template-sha256'], bindings: await inputJson(values.bindings, values['document-root']) });
    }
    if (values.out) await writeExclusive(values.out, result, values['document-root']);
    else await output.json(result);
    return 0;
}
