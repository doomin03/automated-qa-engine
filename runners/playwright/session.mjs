import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { QaError } from '../../packages/core/errors.mjs';
// Owns browser/context/page and the start/cleanup join. Public fields are inherited.
export class BrowserSession {
    browser;
    context;
    page;
    secretMasks = [];
    closing = false;
    started = false;
    starting;
    cleanup;
    fontHashes = new Set();
    fontReads = [];
    async startSession(target, { headless = true, timeoutMs = 30000 } = {}) {
        if (this.started || this.closing)
            throw new QaError('SESSION_ERROR', 'Browser adapter cannot reopen a session', 'session');
        this.started = true;
        this.starting = this.#openSession(target, { headless, timeoutMs });
        return this.starting;
    }
    async #openSession(target, { headless, timeoutMs }) {
        try {
            this.browser = await chromium.launch({ headless, timeout: timeoutMs });
            if (this.closing) {
                await this.browser.close();
                throw new Error('Session cancelled while launching');
            }
            const p = target.profile;
            this.context = await this.browser.newContext({ serviceWorkers: 'block', acceptDownloads: false, ...(p ? { viewport: p.viewport, deviceScaleFactor: p.dpr, locale: p.locale, colorScheme: p.colorScheme } : {}) });
            await this.context.route('**/*', route => {
                const url = new URL(route.request().url());
                return target.allowedOrigins.includes(url.origin) ? route.continue() : route.abort('blockedbyclient');
            });
            await this.context.routeWebSocket(/.*/, ws => ws.close());
            this.page = await this.context.newPage();
            if (p?.fonts.length) {
                let total = 0;
                this.page.on('response', response => {
                    if (response.request().resourceType() !== 'font')
                        return;
                    const size = Number(response.headers()['content-length']);
                    if (!Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024 || this.fontReads.length >= 16 || total + size > 64 * 1024 * 1024) {
                        this.fontIssue = true;
                        return;
                    }
                    total += size;
                    this.fontReads.push(response.body().then(bytes => { if (bytes.length !== size) {
                        this.fontIssue = true;
                        return;
                    } this.fontHashes.add(createHash('sha256').update(bytes).digest('hex')); }).catch(() => { this.fontIssue = true; }));
                });
            }
            this.page.on('dialog', d => d.dismiss().catch(() => { }));
        }
        catch {
            throw new QaError('SESSION_ERROR', 'Unable to start browser session', 'session');
        }
    }
    async endSession() {
        if (this.cleanup)
            return this.cleanup;
        this.closing = true;
        this.cleanup = (async () => { await this.starting?.catch(() => { }); if (this.browser)
            await this.browser.close(); })();
        return this.cleanup;
    }
}
