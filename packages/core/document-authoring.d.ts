import type {Blueprint, Target, SelectorRegistry} from './schema-types.js';
export type TemplateId = 'empty' | 'web-open-click' | 'web-input-check' | 'native-open-check';
export interface TemplateDefinition {
  readonly id: TemplateId;
  readonly version: string;
  readonly sha256: string;
  readonly description: string;
  readonly supportedPlatforms: readonly ('web' | 'android' | 'ios')[];
  readonly requiredActions: readonly string[];
  readonly inputSchema: Readonly<Record<string, unknown>>;
}
export interface TemplateCatalog {
  readonly authoringContractVersion: '0.1.0-draft.1';
  readonly templates: readonly TemplateDefinition[];
}
type CommonBindings = {id: string; target: Target};
type LocatedBindings = CommonBindings & {selectors: SelectorRegistry; launch: string; selector: string};
export type TemplateRequest = {version: string; sha256: string} & (
  {templateId: 'empty'; bindings: CommonBindings} |
  {templateId: 'web-open-click' | 'native-open-check'; bindings: LocatedBindings} |
  {templateId: 'web-input-check'; bindings: LocatedBindings & {value: string | {secretRef: string}}}
);
export interface CompositionInput {
  schemaVersion: 'qa.composition/v1';
  assets: Array<{id: string; format: 'xml' | 'json'; source: string; sha256: string}>;
  instances: Array<{id: string; assetId: string}>;
  links: Array<{from: string; to: string}>;
}
export interface AuthoringDiagnostic {
  code: string; path: string; message: string;
  assetId?: string; instanceId?: string; sourceNodeId?: string;
}
export interface CompositionSourceMap {
  schemaVersion: 'qa.compositionSourceMap/v1';
  blueprintSnapshotHash: string; flowSnapshotHash: string;
  nodes: Record<string, {instanceId: string; assetId: string; sourceNodeId: string; sourceHash: string}>;
  syntheticNodes: ['composition_start', 'composition_end'];
}
export type ImmutableAuthored<T> = T extends object ? {readonly [K in keyof T]: ImmutableAuthored<T[K]>} : T;
export type AuthoredBlueprint = ImmutableAuthored<{
  schemaVersion: 'qa.authoredBlueprint/v1';
  authoringContractVersion: '0.1.0-draft.1';
  blueprint: Blueprint; xml: string;
  blueprintSnapshotHash: string; flowSnapshotHash: string;
  template: {id: TemplateId; version: string; sha256: string} | null;
  sourceMap: CompositionSourceMap | null;
  diagnostics: [];
}>;
export function listTemplates(): TemplateCatalog;
export function createTemplate(request: TemplateRequest): AuthoredBlueprint;
export function composeBlueprint(input: CompositionInput): AuthoredBlueprint;
