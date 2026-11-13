import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSchema } from '../../core/schema.mjs';
import { QaError } from '../../core/errors.mjs';
export async function replayEvents(output, delivered, json) {
    const lines = (await readFile(join(output.reportDir, 'events.jsonl'), 'utf8')).trim().split('\n');
    for (const [index, line] of lines.entries()) {
        const event = validateSchema(JSON.parse(line));
        if (event.schemaVersion !== 'qa.runEvent/v1' || event.runId !== output.result.runId || event.attempt !== output.result.attempt || event.sequence !== index + 1)
            throw new QaError('ENGINE_ERROR', 'Invalid persisted event identity', 'run');
        if (event.sequence > delivered) {
            await json(event);
            delivered = event.sequence;
        }
    }
}
