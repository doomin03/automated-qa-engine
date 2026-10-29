import type { Blueprint, ExecutionPlan, SchemaDocument, RunEvent, RunResult, Target, Flow } from './schema-types.js';
export type * from './schema-types.js';

export const ENGINE_VERSION: string;
export type Node = Flow['nodes'][number];
export type ActionNode = Extract<Node, {type:'action'}>;
export type AssertionNode = Extract<Node, {type:'assertion'}>;
export type Literal = string | number | boolean | null;
export type SecretResolver = (reference:string) => string | undefined;
export interface ActionContext {
  blueprint: Blueprint;
  variables: Record<string, Literal>;
  timeoutMs: number;
  secretInputs: Set<string>;
}
export interface RunnerAdapter {
  getCapabilities(): {platforms: string[]; supportedActions: string[]};
  startSession(target:Target, options:{headless:boolean; timeoutMs:number}): Promise<void>;
  performAction(node:ActionNode, context:ActionContext): Promise<void>;
  evaluateAssertion(node:AssertionNode, context:ActionContext): Promise<void>;
  captureEvidence(path:string, options:{containsSecrets:boolean}): Promise<boolean>;
  endSession(): Promise<void>;
}
export interface ExecuteOptions {
  adapter: RunnerAdapter;
  reportDir?: string;
  timeoutMs?: number;
  headless?: boolean;
  signal?: AbortSignal;
  secretResolver?: SecretResolver;
  allowProduction?: boolean;
  onEvent?: (event:RunEvent) => void | Promise<void>;
}
export interface ExecutionOutput {result:RunResult; reportDir:string; plan:ExecutionPlan}
export class QaError extends Error {
  code: string;
  phase: string;
  details: unknown[];
  constructor(code:string, message:string, phase?:string, details?:unknown[]);
}
export function parseSource(text:string, format?:'json'|'yaml'|'yml'|'xml'): SchemaDocument;
export function loadBlueprint(file:string, options?:{selectors?:string; targetManifest?:string}): Promise<Blueprint>;
export function validateSchema<T extends SchemaDocument>(document:T): T;
export function validateSchema(document:unknown): SchemaDocument;
export function compileBlueprint(document:unknown): ExecutionPlan;
export function executeBlueprint(document:unknown, options:ExecuteOptions): Promise<ExecutionOutput>;
