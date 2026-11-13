import { createHash } from 'node:crypto';
import { authoringSchema, AUTHORING_VERSION } from '../../packages/core/document-authoring/contract.mjs';
import { listTemplates } from '../../packages/core/document-authoring.mjs';
import { blueprintXml } from '../../packages/core/xml.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
export function renderDocumentAuthoring({ engineVersion, executionSchemaBytes }) {
    const schema = JSON.stringify(authoringSchema, null, 2) + '\n';
    const artifact = `qa-authoring-${AUTHORING_VERSION}-engine-${engineVersion}.json`;
    const bundle = JSON.stringify({ owner: 'automated-qa-engine', authoringContractVersion: AUTHORING_VERSION, engineVersion,
        executionContractVersion: '0.3.0-draft.2', executionSchemaSha256: sha(executionSchemaBytes), schemaSha256: sha(schema),
        schema: authoringSchema, catalog: listTemplates() }, null, 2) + '\n';
    const metadata = JSON.stringify({ status: 'local-preview', artifact, engineVersion, authoringContractVersion: AUTHORING_VERSION,
        executionContractVersion: '0.3.0-draft.2', executionSchemaSha256: sha(executionSchemaBytes), schemaSha256: sha(schema), sha256: sha(bundle) }, null, 2) + '\n';
    return { schema, artifact, bundle, metadata };
}
export function renderAuthoringExamples(example) {
    const source = blueprintXml(example);
    const composition = { schemaVersion: 'qa.composition/v1', assets: [{ id: 'login', format: 'xml', source, sha256: sha(source) }],
        instances: [{ id: 'login-first', assetId: 'login' }, { id: 'login-second', assetId: 'login' }], links: [{ from: 'login-first', to: 'login-second' }] };
    const bindings = { id: 'input-example', target: example.target, selectors: example.selectors, launch: 'login', selector: 'username', value: 'qa-user' };
    return [['examples/composition.qa.json', composition], ['examples/template-bindings.json', bindings]].map(([file, data]) => [file, JSON.stringify(data, null, 2) + '\n']);
}
