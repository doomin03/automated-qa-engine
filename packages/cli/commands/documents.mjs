import { readFile, writeFile } from 'node:fs/promises';
import { stringify } from 'yaml';
import { schema } from '../../core/schema.mjs';
import { loadBlueprint, parseSource } from '../../core/documents.mjs';
import { compileBlueprint } from '../../core/compiler.mjs';
import { QaError } from '../../core/errors.mjs';
import { blueprintXml } from '../../core/xml.mjs';
import { prepareReferences } from '../../core/media/references.mjs';
export async function command({ command, file, values, positionals }, { json, text: outputText }) {
    if (command === 'schema') {
        await json(schema);
        return 0;
    }
    if (command === 'template') {
        const b = JSON.parse(await readFile(new URL('../../../examples/login.qa.json', import.meta.url), 'utf8'));
        if (values.format && !['xml', 'yaml', 'json'].includes(values.format))
            throw new QaError('INVALID_ARGUMENT', 'Unsupported output format');
        const text = values.format === 'xml' ? blueprintXml(b) : values.format === 'yaml' ? stringify(b) : JSON.stringify(b, null, 2) + '\n';
        if (values.out)
            await writeFile(values.out, text, { flag: 'wx' });
        else
            await outputText(text);
        return 0;
    }
    if (!['import', 'export', 'validate', 'plan'].includes(command))
        return undefined;
    if (!file)
        throw new QaError('INVALID_ARGUMENT', 'Input file required');
    const b = await loadBlueprint(file, { selectors: values.selectors, targetManifest: values['target-manifest'], documentRoot: values['document-root'] }), plan = compileBlueprint(b);
    if (values['reference-root'])
        await prepareReferences(b, values['reference-root']);
    if (command === 'export') {
        if (values.format !== 'xml')
            throw new QaError('INVALID_ARGUMENT', 'Export requires --format xml');
        const text = blueprintXml(b), roundTrip = compileBlueprint(parseSource(text, 'xml'));
        if (roundTrip.blueprintSnapshotHash !== plan.blueprintSnapshotHash)
            throw new QaError('INVALID_DOCUMENT', 'XML export would change the Blueprint');
        if (values.out)
            await writeFile(values.out, text, { flag: 'wx' });
        else
            await outputText(text);
    }
    else if (command === 'import') {
        const text = JSON.stringify(b, null, 2) + '\n';
        if (values.out)
            await writeFile(values.out, text, { flag: 'wx' });
        else
            await outputText(text);
    }
    else if (command === 'validate')
        await json({ valid: true, blueprintId: b.id, nodeCount: b.flow.nodes.length, requiredActions: plan.requiredActions, secretRefs: plan.secretRefs });
    else
        await json(plan);
    return 0;
}
