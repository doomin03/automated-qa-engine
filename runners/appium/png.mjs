const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// W3C screenshot decoding retains the adapter's original validation policy.
export function pngBytes(encoded) {
    if (typeof encoded !== 'string' || encoded.length > Math.ceil(10 * 1024 * 1024 / 3) * 4 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        throw new Error('Invalid PNG');
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length < 45 || bytes.length > 10 * 1024 * 1024 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR')
        throw new Error('Invalid PNG');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width * height > 16777216)
        throw new Error('Invalid PNG');
    let offset = 8, hasData = false, ended = false;
    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
        if (offset + 12 + length > bytes.length)
            throw new Error('Invalid PNG');
        if (type === 'IDAT')
            hasData = true;
        offset += 12 + length;
        if (type === 'IEND') {
            ended = length === 0 && offset === bytes.length;
            break;
        }
    }
    if (!hasData || !ended)
        throw new Error('Invalid PNG');
    return bytes;
}
