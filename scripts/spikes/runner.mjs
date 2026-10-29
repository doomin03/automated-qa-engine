import { chromium } from 'playwright';
import { createInterface } from 'node:readline';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const input = createInterface({ input: process.stdin });
console.log(JSON.stringify({ type: 'ready' }));
try {
  for await (const line of input) {
    const command = JSON.parse(line);
    if (command.type === 'shutdown') break;
    await page.setContent('<input id="name"><button onclick="document.querySelector(\'output\').textContent=document.querySelector(\'input\').value">Go</button><output></output>');
    await page.locator('#name').fill('QA');
    await page.locator('button').click();
    const passed = await page.locator('output').textContent() === command.expected;
    console.log(JSON.stringify({ type: 'result', outcome: passed ? 'passed' : 'failed' }));
  }
} finally {
  await browser.close();
  input.close();
}

