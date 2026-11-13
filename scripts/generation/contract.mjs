import { createHash } from 'node:crypto';
import { blueprintXml } from '../../packages/core/xml.mjs';
import { parseSource } from '../../packages/core/documents.mjs';
import { compileBlueprint } from '../../packages/core/compiler.mjs';
// Render the release bytes without filesystem mutation; callers own check/write.
export function renderContract({ manifest, schema, example, presets }) {
    const artifact = 'qa-contract-' + manifest.engineVersion + '.json';
    const bundle = JSON.stringify({ owner: manifest.owner, contractVersion: manifest.contractVersion, engineVersion: manifest.engineVersion, schemas: manifest.schemas, schema, example, presets }, null, 2) + '\n';
    const metadata = { status: 'local-preview', artifact, engineVersion: manifest.engineVersion, contractVersion: manifest.contractVersion, sha256: createHash('sha256').update(bundle).digest('hex') };
    const xml = blueprintXml(example), xmlArtifact = 'qa-blueprint-' + manifest.engineVersion + '.xml';
    if (compileBlueprint(parseSource(xml, 'xml')).blueprintSnapshotHash !== compileBlueprint(example).blueprintSnapshotHash)
        throw new Error('XML fixture semantic drift');
    const xmlMetadata = { status: 'local-preview', artifact: xmlArtifact, engineVersion: manifest.engineVersion, contractVersion: manifest.contractVersion, schemaVersion: 'qa.blueprint/v1', sha256: createHash('sha256').update(xml).digest('hex'), blueprintSnapshotHash: compileBlueprint(example).blueprintSnapshotHash };
    return { artifact, bundle, metadata, xml, xmlArtifact, xmlMetadata };
}
