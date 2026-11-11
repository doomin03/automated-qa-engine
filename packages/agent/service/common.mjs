import { setTimeout as delay } from 'node:timers/promises';
export const transient = e => ['AGENT_HTTP_TIMEOUT', 'AGENT_HTTP_FAILURE'].includes(e.code) || e.status >= 500;
export const absent = pid => { if (!Number.isInteger(pid) || pid <= 0)
    return false; try {
    process.kill(pid, 0);
    return false;
}
catch (e) {
    return e.code === 'ESRCH';
} };
export const idle = async (ms, signal) => { try {
    await delay(ms, undefined, { signal });
}
catch { } };
