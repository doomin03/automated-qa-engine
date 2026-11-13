import { ensure } from '../errors.mjs';
export const PNG_MAX_BYTES = 10 * 1024 * 1024, PNG_MAX_PIXELS = 16777216;
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++)
        c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
} return (c ^ 0xffffffff) >>> 0; }
export function inspectPng(bytes) {
    ensure(bytes.length <= PNG_MAX_BYTES && bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'INVALID_DOCUMENT', 'Invalid PNG signature or size');
    let offset = 8, width, height, ended = false, hasData = false, colorSupported = true;
    while (offset < bytes.length) {
        ensure(offset + 12 <= bytes.length, 'INVALID_DOCUMENT', 'Truncated PNG');
        const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
        ensure(end <= bytes.length, 'INVALID_DOCUMENT', 'Truncated PNG chunk');
        const kind = bytes.toString('ascii', offset + 4, offset + 8);
        ensure(crc32(bytes.subarray(offset + 4, end - 4)) === bytes.readUInt32BE(end - 4), 'INVALID_DOCUMENT', 'PNG CRC mismatch');
        if (offset === 8) {
            ensure(kind === 'IHDR' && length === 13, 'INVALID_DOCUMENT', 'Missing PNG header');
            width = bytes.readUInt32BE(offset + 8);
            height = bytes.readUInt32BE(offset + 12);
            ensure(width > 0 && height > 0 && width * height <= PNG_MAX_PIXELS, 'INVALID_DOCUMENT', 'PNG exceeds pixel limit');
            ensure(bytes[offset + 16] <= 8 && bytes[offset + 18] === 0 && bytes[offset + 19] === 0 && bytes[offset + 20] === 0, 'INVALID_DOCUMENT', 'Only non-interlaced PNG up to 8-bit is supported');
        }
        else
            ensure(kind !== 'IHDR', 'INVALID_DOCUMENT', 'Duplicate PNG header');
        if (['iCCP', 'cHRM', 'cICP', 'acTL'].includes(kind))
            colorSupported = false;
        if (kind === 'IDAT')
            hasData = true;
        if (kind === 'gAMA' && (length !== 4 || bytes.readUInt32BE(offset + 8) !== 45455))
            colorSupported = false;
        offset = end;
        if (kind === 'IEND') {
            ensure(length === 0 && offset === bytes.length, 'INVALID_DOCUMENT', 'Invalid PNG end');
            ended = true;
            break;
        }
    }
    ensure(ended && hasData, 'INVALID_DOCUMENT', 'Missing PNG image data or end');
    return { width, height, colorSupported };
}
