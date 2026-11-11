import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { QaError } from '../../core/errors.mjs';
import { blueprintXml } from '../../core/xml.mjs';
import { listPresets, expandPreset } from '../../core/presets.mjs';
import { readBounded, documentPath } from '../../core/io/files.mjs';
import { parseAuthoringSource, expandAuthoring } from '../../core/authoring.mjs';
export async function command({ command, file, values, positionals }, { json, text: outputText }) {
    if (command === 'preset') {
        if (file === 'list') {
            await json(listPresets());
            return 0;
        }
        if (file !== 'expand' || !values.bindings || !values['preset-version'])
            throw new QaError('INVALID_ARGUMENT', 'Preset expand requires id, --preset-version and --bindings');
        const b = expandPreset(positionals[2], values['preset-version'], JSON.parse((await readBounded(values.bindings)).toString('utf8'))), text = blueprintXml(b);
        if (values.out)
            await writeFile(values.out, text, { flag: 'wx' });
        else
            await outputText(text);
        return 0;
    }
    if (command === 'expand') {
        if (!file || !values.out)
            throw new QaError('INVALID_ARGUMENT', 'Expand requires input and --out FILE');
        if (values.format && !['xml', 'json'].includes(values.format))
            throw new QaError('INVALID_ARGUMENT', 'Expand supports XML or JSON output');
        const source = await readBounded(await documentPath(file, values['document-root'])), format = extname(file).slice(1).toLowerCase();
        const authoring = parseAuthoringSource(source.toString('utf8'), format), expanded = expandAuthoring(authoring);
        const paths = { blueprint: values.out, sourceMap: values['source-map'] || values.out + '.source-map.json', source: values['source-out'] || values.out + '.authoring.' + format };
        await writeFile(paths.blueprint, values.format === 'json' ? JSON.stringify(expanded.blueprint, null, 2) + '\n' : blueprintXml(expanded.blueprint), { flag: 'wx' });
        await writeFile(paths.sourceMap, JSON.stringify(expanded.sourceMap, null, 2) + '\n', { flag: 'wx' });
        await writeFile(paths.source, source, { flag: 'wx' });
        await json({ expanded: true, ...paths, blueprintSnapshotHash: expanded.sourceMap.blueprintSnapshotHash, nodeCount: expanded.blueprint.flow.nodes.length });
        return 0;
    }
}
