import { readFileSync } from 'node:fs';
// The package manifest is the single runtime version source.
export const ENGINE_VERSION = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version;
