import { chromium } from 'playwright';
import { QaError } from '../../packages/core/errors.mjs';
import { ACTIONS } from '../../packages/core/compiler.mjs';
export class PlaywrightAdapter {
  browser; context; page; secretMasks=[]; closing=false;
  getCapabilities() { return {platforms:['web'],supportedActions:ACTIONS}; }
  async startSession(target, {headless=true,timeoutMs=30000}={}) {
    try {
      this.browser=await chromium.launch({headless,timeout:timeoutMs});
      if(this.closing) { await this.browser.close(); throw new Error('Session cancelled while launching'); }
      this.context=await this.browser.newContext({serviceWorkers:'block',acceptDownloads:false});
      await this.context.route('**/*',route=>{
        const url=new URL(route.request().url());
        return target.allowedOrigins.includes(url.origin) ? route.continue() : route.abort('blockedbyclient');
      });
      await this.context.routeWebSocket(/.*/, ws=>ws.close());
      this.page=await this.context.newPage();
      this.page.on('dialog',d=>d.dismiss().catch(()=>{}));
    } catch { throw new QaError('SESSION_ERROR','Unable to start browser session','session'); }
  }
  locator(alias, selectors) {
    const s=selectors.selectors[alias].web;
    switch(s.strategy) {
      case 'testId': return this.page.getByTestId(s.value);
      case 'text': return this.page.getByText(s.value,{exact:true});
      case 'role': return this.page.getByRole(s.value,{...(s.name?{name:s.name}:{})});
      case 'css': return this.page.locator(s.value);
      default: throw new QaError('UNSUPPORTED_CAPABILITY','Unsupported selector strategy','step');
    }
  }
  async performAction(node, {blueprint,variables,timeoutMs,secretInputs}) {
    const p=node.params;
    try {
      if(node.action==='launch') { await this.page.goto(blueprint.target.launchTargets[p.target],{timeout:timeoutMs,waitUntil:'domcontentloaded'}); return; }
      if(node.action==='screenshot') return;
      const loc=this.locator(p.selector,blueprint.selectors);
      if(node.action==='tap') await loc.click({timeout:timeoutMs});
      else if(node.action==='input') {
        if(secretInputs.has(p.valueRef)) this.secretMasks.push(loc);
        await loc.fill(p.valueRef ? String(variables[p.valueRef]) : p.value,{timeout:timeoutMs});
      } else if(node.action==='clear') await loc.fill('',{timeout:timeoutMs});
      else if(node.action==='waitFor') await loc.waitFor({state:p.state || 'visible',timeout:timeoutMs});
      else throw new QaError('UNSUPPORTED_CAPABILITY','Unsupported action','step');
    } catch(error) { throw this.mapError(error,'action'); }
  }
  async evaluateAssertion(node, {blueprint,timeoutMs}) {
    try {
      const loc=this.locator(node.params.selector,blueprint.selectors);
      await loc.waitFor({state:'visible',timeout:timeoutMs});
      if(node.action==='assertVisible') return;
      const actual = node.action==='assertValue' ? await loc.inputValue({timeout:timeoutMs}) : await loc.innerText({timeout:timeoutMs});
      if(actual!==node.params.expected) throw new QaError('ASSERTION_FAILED','Assertion did not match expected value','step');
    } catch(error) { throw this.mapError(error,'assertion'); }
  }
  mapError(error,kind) {
    if(error instanceof QaError) return error;
    if(!this.browser?.isConnected()) return new QaError('RUNNER_CRASH','Browser disconnected','step');
    if(error.name==='TimeoutError') return new QaError(kind==='assertion'?'ASSERTION_FAILED':'ELEMENT_NOT_FOUND','Element condition was not met before timeout','step');
    return new QaError('SESSION_ERROR','Browser operation failed','step');
  }
  async captureEvidence(path,{containsSecrets=false}={}) {
    if(!this.page || this.page.isClosed()) throw new QaError('EVIDENCE_ERROR','Page is unavailable','cleanup');
    // An app may echo secrets outside inputs; disable screenshots for secret runs.
    if(containsSecrets) return false;
    await this.page.screenshot({path,fullPage:true,timeout:3000,mask:[this.page.locator('input[type=password]'),...this.secretMasks]});
    return true;
  }
  async endSession() { this.closing=true; if(this.browser) await this.browser.close(); }
}

