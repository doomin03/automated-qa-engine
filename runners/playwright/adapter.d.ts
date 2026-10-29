import type { RunnerAdapter, Target, ActionNode, AssertionNode, ActionContext } from '../../packages/core/index.js';
export class PlaywrightAdapter implements RunnerAdapter {
  getCapabilities(): {platforms: string[]; supportedActions: string[]};
  startSession(target:Target, options?:{headless?:boolean; timeoutMs?:number}): Promise<void>;
  performAction(node:ActionNode, context:ActionContext): Promise<void>;
  evaluateAssertion(node:AssertionNode, context:ActionContext): Promise<void>;
  captureEvidence(path:string, options?:{containsSecrets?:boolean}): Promise<boolean>;
  endSession(): Promise<void>;
}
