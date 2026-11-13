import { readBounded } from '../../core/io/files.mjs';
import { QaError } from '../../core/errors.mjs';
export async function loadSecretResolver(values) {
    const secrets = values['secrets-file'] ? JSON.parse((await readBounded(values['secrets-file'])).toString('utf8')) : {};
    if (!secrets || typeof secrets !== 'object' || Array.isArray(secrets) || Object.keys(secrets).length > 256 || Object.values(secrets).some(value => typeof value !== 'string'))
        throw new QaError('INVALID_DOCUMENT', 'Secrets file must be a bounded string map');
    return ref => Object.hasOwn(secrets, ref) ? secrets[ref] : process.env['AQA_SECRET_' + ref.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()];
}
