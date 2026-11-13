import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSchema } from '../schema.mjs';
export async function initializeReport(dir, plan) {
    await mkdir(dir, { recursive: true });
    const blueprint = plan.blueprint;
    await writeFile(join(dir, 'blueprint.json'), JSON.stringify(blueprint, null, 2), { flag: 'wx' });
    await writeFile(join(dir, 'plan.json'), JSON.stringify(plan, null, 2), { flag: 'wx' });
}
export async function persistResult(dir, result) {
    const { runId, attempt, artifacts } = result;
    await writeFile(join(dir, 'evidence.json'), JSON.stringify(validateSchema({ schemaVersion: 'qa.evidence/v1', runId, attempt, artifacts }), null, 2), { flag: 'wx' });
    await writeFile(join(dir, 'result.tmp'), JSON.stringify(result, null, 2), { flag: 'wx' });
    await rename(join(dir, 'result.tmp'), join(dir, 'result.json'));
}
