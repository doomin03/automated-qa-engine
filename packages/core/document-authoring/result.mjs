import { canonicalJson } from '../domain/canonical.mjs';
import { freezeOwned } from '../domain/immutable.mjs';
import { compileBlueprint } from '../compiler.mjs';
import { parseSource } from '../codecs/source.mjs';
import { blueprintXml } from '../xml.mjs';
import { AUTHORING_VERSION } from './contract.mjs';
import { reject, protect, validateAuthoring } from './validation.mjs';

export function authoredResult(document, { template = null, nodes = null } = {}) {
    // Canonical key ordering also stabilizes JSON embedded inside XML CDATA.
    const bytes = canonicalJson(document);
    if (Buffer.byteLength(bytes) > 1048576) reject('OUTPUT_LIMIT', '', 'Generated Blueprint exceeds 1 MiB');
    const blueprint = JSON.parse(bytes);
    const plan = protect(() => compileBlueprint(blueprint));
    const xml = blueprintXml(blueprint);
    if (Buffer.byteLength(xml) > 1048576) reject('OUTPUT_LIMIT', '', 'Generated XML exceeds 1 MiB');
    const roundTrip = protect(() => compileBlueprint(parseSource(xml, 'xml')));
    if (roundTrip.blueprintSnapshotHash !== plan.blueprintSnapshotHash) reject('XML_ROUNDTRIP', '', 'XML roundtrip changed the Blueprint');
    const hashes = { blueprintSnapshotHash: plan.blueprintSnapshotHash, flowSnapshotHash: plan.flowSnapshotHash };
    const sourceMap = nodes ? { schemaVersion: 'qa.compositionSourceMap/v1', ...hashes, nodes, syntheticNodes: ['composition_start', 'composition_end'] } : null;
    const result = { schemaVersion: 'qa.authoredBlueprint/v1', authoringContractVersion: AUTHORING_VERSION, blueprint, xml, ...hashes, template, sourceMap, diagnostics: [] };
    if (Buffer.byteLength(JSON.stringify(result)) > 4 * 1048576) reject('OUTPUT_LIMIT', '', 'Authoring response exceeds 4 MiB');
    validateAuthoring('result', result);
    return freezeOwned(result);
}
