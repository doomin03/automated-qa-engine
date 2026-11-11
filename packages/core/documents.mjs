import { readBounded, documentPath } from './io/files.mjs';
import { resolve, dirname, extname } from 'node:path';
import { ensure } from './errors.mjs';
import { validateSchema } from './schema.mjs';
import { parseSource } from './codecs/source.mjs';
export { parseSource } from './codecs/source.mjs';
export async function readDocument(file, { documentRoot } = {}) {
    const text = (await readBounded(await documentPath(file, documentRoot))).toString('utf8');
    return parseSource(text, extname(file).slice(1).toLowerCase());
}
export async function loadBlueprint(file, options = {}) {
    let document = await readDocument(file, options);
    if (document.schemaVersion === 'qa.blueprint/v1')
        return document;
    let testCase;
    if (document.schemaVersion === 'qa.testcase/v1') {
        testCase = document;
        document = await readDocument(resolve(dirname(file), testCase.flowRef), options);
    }
    ensure(document.schemaVersion === 'qa.flow/v1', 'INVALID_DOCUMENT', 'Expected Blueprint, Flow or TestCase');
    ensure(options.selectors && options.targetManifest, 'INVALID_DOCUMENT', 'Standalone Flow/TC requires --selectors and --target-manifest');
    return validateSchema({ schemaVersion: 'qa.blueprint/v1', id: document.id, flow: document, selectors: await readDocument(options.selectors, options), target: await readDocument(options.targetManifest, options), ...(testCase ? { testCase } : {}) });
}
