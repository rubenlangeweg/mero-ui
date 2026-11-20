import { browserConfig } from "../scripts/browser-config.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderBusinessLayout } from '../site/business-layouts.mjs';
import { createApp } from '../server.mjs';

const playwright = await import(browserConfig.playwrightModule || 'playwright').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && !browserConfig.playwrightModule) return null;
  throw error;
});

test('business examples resolve only known filters and reconcile cash balances against the ledger', () => {
  const negotiation = renderBusinessLayout('crm', new URLSearchParams('stage=negotiation&deal=cinder'));
  assert.match(negotiation, /2 opportunities/);
  assert.match(negotiation, /<h2>Stillwater<\/h2>/);
  assert.doesNotMatch(negotiation, /View Cinder Studio deal/);
  const october = renderBusinessLayout('finance');
  assert.match(october, /<strong>\$193,270<\/strong>/);
  assert.match(october, /<dt>Opening balance<\/dt><dd>\$151,570/);
  assert.match(october, /<dt>Money in<\/dt><dd>\+\$75,700/);
  assert.match(october, /<dt>Money out<\/dt><dd>−\$34,000/);
  assert.equal(renderBusinessLayout('finance', new URLSearchParams('period=invalid&transaction=invalid')), october);
});

test('CRM and Finance links update records, chart data and browser history with and without HTMX', {
  skip: !playwright && 'Install Playwright to run the browser regression',
}, async t => {
  const app = createApp();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = 'http://127.0.0.1:' + app.address().port;
  const engine = browserConfig.engine || 'chromium';
  const browser = await playwright[engine].launch({ executablePath: engine === 'chromium' ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  for (const javaScriptEnabled of [true, false]) {
    const page = await browser.newPage({ viewport: { width: javaScriptEnabled ? 1280 : 360, height: 850 }, javaScriptEnabled });
    await page.goto(base + '/layouts/crm');
    const documents = [];
    page.on('request', req => { if (req.resourceType() === 'document') documents.push(req.url()); });
    await page.getByRole('link', { name:'Negotiation', exact:true }).click();
    await page.waitForURL('**/layouts/crm?stage=negotiation');
    assert.equal(await page.locator('.bu-deal').count(), 2);
    await page.getByRole('link', { name:'View Union House deal' }).click();
    await page.waitForSelector('.bu-deal-detail h2:text-is("Union House")');
    assert.match(await page.locator('.bu-deal-detail').textContent(), /Leo Meyer/);
    if (javaScriptEnabled) assert.equal(documents.length, 0);
    await page.goBack();
    await page.waitForSelector('.bu-deal-detail h2:text-is("Stillwater")', { state:'attached' });
    await page.goto(base + '/layouts/finance');
    const october = await page.locator('.bu-balance > strong').textContent();
    await page.getByRole('link', { name:'September 2026' }).click();
    await page.waitForURL('**/layouts/finance?period=2026-09');
    assert.notEqual(await page.locator('.bu-balance > strong').textContent(), october);
    await page.getByRole('link', { name:'View Morrow Supply transaction' }).click();
    await page.getByLabel('Transaction details').waitFor();
    assert.match(await page.getByLabel('Transaction details').textContent(), /MS-620/);
    await page.getByRole('link', { name:'Close Morrow Supply transaction' }).click();
    await page.getByLabel('Transaction details').waitFor({ state:'detached' });
    if (javaScriptEnabled) {
      await page.setViewportSize({ width:320, height:850 });
      const tickInset = await page.locator('.bu-chart').evaluate(panel => Math.min(...[...panel.querySelectorAll('text[text-anchor="end"]')].map(tick => tick.getBoundingClientRect().left - panel.getBoundingClientRect().left)));
      assert.ok(tickInset >= 4, `Chart labels need a visible inset, got ${tickInset}px`);
      const point = page.locator('.bu-chart [data-mero-plot-value]').first();
      await point.focus();
      await point.press('ArrowRight');
      assert.match(await page.locator('[data-mero-plot-readout]').textContent(), /Sep 8/);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.close();
  }
});
