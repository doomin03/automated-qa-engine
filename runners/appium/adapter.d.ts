import type { RunnerAdapter, Target, ActionNode, AssertionNode, ActionContext } from '../../packages/core/index.js';

export interface AppiumCapabilities {
  'appium:automationName': 'UiAutomator2' | 'XCUITest';
  'appium:udid': string;
  'appium:deviceName': string;
  'appium:newCommandTimeout'?: number;
  platformName?: 'Android' | 'iOS';
  [key:string]: unknown;
}
export interface AppiumConfig {
  endpoint: string;
  capabilities: AppiumCapabilities;
  requestTimeoutMs?: number;
  allowRemoteEndpoint?: boolean;
}
export class AppiumAdapter implements RunnerAdapter {
  constructor(config: AppiumConfig);
  getCapabilities(): {platforms:string[]; supportedActions:string[]};
  startSession(target:Target, options?:{headless?:boolean; timeoutMs?:number}):Promise<void>;
  performAction(node:ActionNode, context:ActionContext):Promise<void>;
  evaluateAssertion(node:AssertionNode, context:ActionContext):Promise<void>;
  captureEvidence(path:string, options?:{containsSecrets?:boolean;signal?:AbortSignal;timeoutMs?:number}):Promise<boolean>;
  endSession():Promise<void>;
}
