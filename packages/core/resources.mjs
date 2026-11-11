// Compatibility facade; consumers may depend on only the responsibility they need.
export { readBounded, containedPath, documentPath } from './io/files.mjs';
export { PNG_MAX_BYTES, PNG_MAX_PIXELS, inspectPng } from './media/png.mjs';
export { prepareReferences } from './media/references.mjs';
