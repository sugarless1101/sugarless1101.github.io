// This command launches a browser. Run only in an environment that permits it.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4175/';
const problems = [];
let responses = 0;
let browser;
try {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error(`Chromium unavailable; trying Edge: ${error.message}`);
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }
  for (const mode of ['day', 'night']) {
    for (const [width, height, density] of [[1920, 1080, 1], [390, 844, 3]]) {
      const label = `${mode} ${width}x${height} DPR ${density}`;
      const context = await browser.newContext({
        viewport: { width, height }, deviceScaleFactor: density,
        isMobile: width < 768, hasTouch: width < 768,
      });
      try {
        await context.addInitScript(initialMode => {
          sessionStorage.setItem('portfolio-mode', initialMode);
        }, mode);
        const page = await context.newPage();
        page.on('response', response => {
          responses++;
          if (response.status() < 200 || response.status() >= 400) {
            problems.push(`${label}: HTTP ${response.status()} ${response.url()}`);
          }
        });
        page.on('requestfailed', request => {
          problems.push(`${label}: FAILED ${request.url()} (${request.failure()?.errorText})`);
        });
        page.on('pageerror', error => problems.push(`${label}: ERROR ${error.message}`));
        page.on('console', message => {
          if (message.type() === 'error') problems.push(`${label}: CONSOLE ${message.text()}`);
        });
        await page.goto(BASE, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('data-mode'), mode);
        await page.waitForTimeout(2500);
        const controls = page.locator('button:not(.focus-ghost, .focus-ghost *)');
        const menuPanel = page.locator('.menu-panel:not(.focus-ghost, .focus-ghost *)');
        const press = async locator => width < 768 ? locator.tap() : locator.click();
        await press(controls.and(page.getByRole('button', { name: '電灯を消す', exact: true })));
        await page.waitForTimeout(1200);
        await press(controls.and(page.getByRole('button', { name: '電灯を点ける', exact: true })));
        await page.waitForTimeout(1200);
        const scrollPage = async () => {
          await page.evaluate(async () => {
            for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
              scrollTo(0, y);
              await new Promise(resolve => setTimeout(resolve, 150));
            }
            scrollTo(0, document.documentElement.scrollHeight);
          });
          await page.waitForTimeout(2500);
        };
        await scrollPage();
        await controls.and(page.locator('.menu-btn')).click();
        await menuPanel.locator('.nightmode-toggle:not(.focus-ghost, .focus-ghost *)').click();
        await page.waitForTimeout(2800);
        assert.equal(await page.locator('html').getAttribute('data-mode'), mode === 'day' ? 'night' : 'day');
        await menuPanel.locator('.menu-close:not(.focus-ghost, .focus-ghost *)').click();
        await page.evaluate(() => scrollTo(0, 0));
        await scrollPage();
        await page.waitForLoadState('networkidle');
      } catch (error) {
        problems.push(`${label}: CHECK ${error.message}`);
      } finally {
        await context.close();
      }
    }
  }
} catch (error) {
  problems.push(`LAUNCH ${error.message}`);
} finally {
  await browser?.close();
}
console.log(JSON.stringify({ base: BASE, responses, problems }, null, 2));
process.exitCode = problems.length ? 1 : 0;
