// Deliberately no engine/adapter imports and no QA side effects.
let busy = false;
for (const stream of [process.stdout, process.stderr])
    stream.on('error', () => process.exit(3));
process.on('disconnect', () => process.exit(0));
process.on('message', message => {
    if (busy || !message || !Number.isSafeInteger(message.id) || !['stdout', 'stderr'].includes(message.stream) || typeof message.text !== 'string' || Buffer.byteLength(message.text) > 8 * 1024 * 1024) {
        process.exit(3);
        return;
    }
    busy = true;
    process[message.stream].write(message.text, error => {
        if (error) {
            process.exit(3);
            return;
        }
        busy = false;
        if (process.connected)
            process.send({ id: message.id, ok: true });
    });
});
