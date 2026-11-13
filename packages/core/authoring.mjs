// Public authoring facade: direct input protection is intentionally separate
// from the Blueprint source codec policy.
export { expandAuthoring } from './authoring/expand.mjs';
export { parseAuthoringSource, authoringXml } from './authoring/codec.mjs';
