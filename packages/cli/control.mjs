// Local opt-in control protocol. Do not echo untrusted input in diagnostics.
export function attachControl(input, { onCancel, onInvalid }) {
    const MAX_LINE = 4096, MAX_TOTAL = 65536;
    let pending = Buffer.alloc(0), total = 0, closed = false;
    function close() {
        if (closed)
            return;
        closed = true;
        pending = Buffer.alloc(0);
        input.removeListener('data', data);
        input.removeListener('end', end);
        input.removeListener('error', invalid);
        input.pause();
    }
    function invalid() { if (closed)
        return; close(); onInvalid(); }
    function data(chunk) {
        if (closed)
            return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.length;
        if (total > MAX_TOTAL)
            return invalid();
        const newline = bytes.indexOf(10), part = newline < 0 ? bytes : bytes.subarray(0, newline);
        if (pending.length + part.length > MAX_LINE)
            return invalid();
        pending = Buffer.concat([pending, part]);
        if (newline < 0)
            return;
        try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(pending);
            const message = JSON.parse(text);
            if (!message || Array.isArray(message) || Object.keys(message).length !== 1 || message.type !== 'cancel')
                return invalid();
        }
        catch {
            return invalid();
        }
        close();
        onCancel();
    }
    function end() { if (pending.length)
        invalid();
    else
        close(); }
    input.on('data', data);
    input.on('end', end);
    input.on('error', invalid);
    input.resume();
    return close;
}
// A parseArgs failure still honors an explicitly selected diagnostic channel.
export function requestedDiagnostic(args) {
    let stream = 'stdout';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--')
            break;
        if (args[i] === '--diagnostics')
            stream = args[++i];
        else if (args[i].startsWith('--diagnostics='))
            stream = args[i].slice('--diagnostics='.length);
    }
    return stream === 'stderr' ? 'stderr' : 'stdout';
}
