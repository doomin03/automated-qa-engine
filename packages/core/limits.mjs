import { ensure } from './errors.mjs';
export const MAX_ARTIFACTS = 256;
export function reserveArtifacts(artifacts, count) { ensure(Number.isInteger(count) && count > 0 && artifacts.length + count <= MAX_ARTIFACTS, 'ENGINE_ERROR', 'Run evidence capacity exceeded'); }
export function cleanupRecorder(errors) {
    let omitted = 0;
    return error => {
        if (errors.length < 255) {
            errors.push(error);
            return;
        }
        omitted++;
        if (error.code === 'CLEANUP_ERROR' && !errors.some(item => item.code === 'CLEANUP_ERROR'))
            errors[254] = error;
        errors[255] = { code: 'ENGINE_ERROR', message: 'Additional cleanup diagnostics omitted: ' + omitted, phase: 'cleanup' };
    };
}
