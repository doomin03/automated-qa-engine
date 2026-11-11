import { readFile } from 'node:fs/promises';
import { startDemoServer } from '../../../examples/server.mjs';
export async function executeDemo(run, json) {
    const server = await startDemoServer();
    try {
        const b = JSON.parse(await readFile(new URL('../../../examples/login.qa.json', import.meta.url), 'utf8'));
        b.target.launchTargets.login = server.origin;
        b.target.allowedOrigins = [server.origin];
        const pass = await run(b);
        b.flow.nodes.find(n => n.id === 'home').params.expected = 'deliberate mismatch';
        const fail = await run(b);
        await json({ pass: { outcome: pass.result.outcome, reportDir: pass.reportDir }, fail: { outcome: fail.result.outcome, reportDir: fail.reportDir } });
        return pass.result.outcome === 'passed' && fail.result.outcome === 'failed' ? 0 : 3;
    }
    finally {
        await server.close();
    }
}
