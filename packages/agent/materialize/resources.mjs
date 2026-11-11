import { mkdir, writeFile, lstat, realpath } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { parseSource } from '../../core/codecs/source.mjs';
import { prepareReferences } from '../../core/media/references.mjs';
import { protocolLimits } from '../protocol.mjs';
import { requireAgent } from '../errors.mjs';
import { immutableJson, sha256 } from './immutable.mjs';
import { safeName } from './paths.mjs';
export async function materializeCases(lease, jobRoot, transport, holder, signal) {
    const cases = [];
    for (const [index, item] of lease.cases.entries()) {
        signal?.throwIfAborted();
        const root = join(jobRoot, 'case-' + index);
        await mkdir(root, { recursive: false, mode: 0o700 });
        const realRoot = await realpath(root);
        await immutableJson(join(root, 'blueprint.json'), parseSource(item.blueprintJson, 'json'), protocolLimits.engineJsonBytes);
        for (const descriptor of item.resources) {
            requireAgent(safeName(descriptor.name), 'AGENT_POLICY_DENIED', 'Unsafe resource path');
            const response = (await transport.resource(lease.leaseId, descriptor.resourceId, holder, signal)).value;
            for (const field of ['resourceId', 'name', 'sha256', 'size', 'mimeType'])
                requireAgent(response[field] === descriptor[field], 'AGENT_PROTOCOL_INVALID', 'Resource descriptor changed');
            const bytes = Buffer.from(response.base64, 'base64');
            requireAgent(bytes.length === descriptor.size && sha256(bytes) === descriptor.sha256, 'AGENT_PROTOCOL_INVALID', 'Resource bytes do not match manifest');
            const path = join(root, ...descriptor.name.split('/'));
            await mkdir(dirname(path), { recursive: true });
            const parent = await realpath(dirname(path)), rel = relative(realRoot, parent);
            requireAgent(!rel.startsWith('..') && !isAbsolute(rel), 'AGENT_POLICY_DENIED', 'Resource escaped materialized root');
            await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
            const stat = await lstat(path);
            requireAgent(stat.isFile() && !stat.isSymbolicLink(), 'AGENT_POLICY_DENIED', 'Resource must be a regular file');
        }
        await prepareReferences(parseSource(item.blueprintJson, 'json'), root);
        cases.push({ caseId: item.caseId, root, file: join(root, 'blueprint.json') });
    }
    return cases;
}
