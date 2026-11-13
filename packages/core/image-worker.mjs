import { parentPort, workerData } from 'node:worker_threads';
import { PNG } from 'pngjs';
try {
    const baseline = PNG.sync.read(Buffer.from(workerData.baseline), { checkCRC: true });
    let actual = PNG.sync.read(Buffer.from(workerData.actual), { checkCRC: true });
    if (workerData.crop) {
        const c = workerData.crop, cropped = new PNG({ width: c.width, height: c.height });
        PNG.bitblt(actual, cropped, c.x, c.y, c.width, c.height, 0, 0);
        actual = cropped;
    }
    if (baseline.width !== actual.width || baseline.height !== actual.height)
        parentPort.postMessage({ mismatch: true });
    else {
        const diff = new PNG({ width: actual.width, height: actual.height });
        let changedPixels = 0;
        for (let i = 0; i < actual.data.length; i += 4) {
            let delta = 0;
            for (let c = 0; c < 3; c++) {
                const a = actual.data[i + c] * actual.data[i + 3] / 255 + 255 - actual.data[i + 3], b = baseline.data[i + c] * baseline.data[i + 3] / 255 + 255 - baseline.data[i + 3];
                delta = Math.max(delta, Math.abs(a - b));
            }
            const changed = delta > workerData.channelTolerance;
            if (changed)
                changedPixels++;
            diff.data[i] = changed ? 255 : 255;
            diff.data[i + 1] = changed ? 0 : 255;
            diff.data[i + 2] = changed ? 0 : 255;
            diff.data[i + 3] = 255;
        }
        parentPort.postMessage({ changedPixels, comparedPixels: actual.width * actual.height, diff: PNG.sync.write(diff), actual: PNG.sync.write(actual) });
    }
}
catch {
    parentPort.postMessage({ error: true });
}
