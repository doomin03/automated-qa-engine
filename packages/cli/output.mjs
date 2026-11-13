import { fork } from 'node:child_process';
import { QaError } from '../core/errors.mjs';
// Windows inherited pipe writes can synchronously block a thread. Only the
// owned helper writes those handles; execution uses asynchronous IPC with ACKs.
export function createOutput({ timeoutMs = 2000, maxBytes = 8 * 1024 * 1024 } = {}) {
    function channel(stream) {
        let child, pending, failed = false, closed = false, sequence = 0;
        const failure = () => new QaError('ENGINE_ERROR', 'CLI output delivery failed', 'run');
        function fail() { failed = true; const current = pending; pending = undefined; if (current) {
            clearTimeout(current.timer);
            current.reject(failure());
        } child?.kill(); }
        function start() {
            if (child)
                return;
            child = fork(new URL('./output-child.mjs', import.meta.url), [], { windowsHide: true, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], execArgv: [] });
            child.on('error', fail);
            child.on('exit', () => { if (!closed)
                fail(); });
            child.on('message', message => { if (!pending || message?.id !== pending.id || message.ok !== true) {
                fail();
                return;
            } const current = pending; pending = undefined; clearTimeout(current.timer); current.resolve(); });
        }
        async function write(text) {
            if (failed || closed || pending || typeof text !== 'string' || Buffer.byteLength(text) > maxBytes) {
                fail();
                throw failure();
            }
            start();
            await new Promise((resolve, reject) => {
                const id = ++sequence, timer = setTimeout(fail, timeoutMs);
                pending = { id, timer, resolve, reject };
                try {
                    child.send({ id, stream, text }, error => { if (error)
                        fail(); });
                }
                catch {
                    fail();
                }
            });
        }
        return { text: write, json: value => write(JSON.stringify(value) + '\n'), async close() {
                closed = true;
                if (pending)
                    fail();
                if (!child || child.exitCode !== null || child.signalCode !== null)
                    return;
                await new Promise(resolve => { const timer = setTimeout(() => { child.kill(); resolve(); }, 500); child.once('exit', () => { clearTimeout(timer); resolve(); }); if (child.connected)
                    child.disconnect();
                else
                    child.kill(); });
            } };
    }
    const stdout = channel('stdout'), stderr = channel('stderr');
    return { stdout, stderr, close: () => Promise.all([stdout.close(), stderr.close()]) };
}
