import { readFile } from 'node:fs/promises';
import { ENGINE_VERSION } from '../../core/domain/version.mjs';
import { requireAgent } from '../errors.mjs';
import { sha256 } from '../materialize/immutable.mjs';
export async function installedRelease() {
    const release = JSON.parse(await readFile(new URL('../../../contracts/release.json', import.meta.url), 'utf8'));
    const bytes = await readFile(new URL('../../../contracts/releases/' + release.artifact, import.meta.url));
    requireAgent(release.engineVersion === ENGINE_VERSION && sha256(bytes) === release.sha256, 'AGENT_RELEASE_INVALID', 'Installed execution release pin differs');
    return { engineVersion: ENGINE_VERSION, contractVersion: release.contractVersion, contractSha256: release.sha256 };
}
