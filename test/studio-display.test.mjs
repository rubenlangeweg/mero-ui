import assert from 'node:assert/strict';
import test from 'node:test';
import { browserConfig } from '../scripts/browser-config.mjs';
import { createApp } from '../server.mjs';

const playwright = await import(browserConfig.playwrightModule || 'playwright').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && !browserConfig.playwrightModule) return null;
  throw error;
});

test('Studio resolves the host, saved choice and direct link without adding a Back step or losing a draft', {
  skip: !playwright && 'Install Playwright to test Studio display selection',
}, async t => {
  const server = createApp();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const engine = browserConfig.engine || 'chromium';
  const browser = await playwright[engine].launch({ executablePath: engine === 'chromium' ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'http://127.0.0.1:' + server.address().port + '/layouts/dashboard?embed=1';
  const nav = page.getByRole('navigation', { name: 'Workspace', exact: true });
  const current = name => page.getByRole('navigation', { name: 'Task views' }).getByRole('link', { name, current: true });
  await page.goto(base);
  await page.addStyleTag({ content: '#studio-workspace { inline-size: 390px; }' });
  await nav.getByRole('link', { name: 'Task board' }).click();
  await current('List').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('display'), 'list');
  await page.goBack();
  await page.waitForURL(base);

  await page.setViewportSize({ width: 390, height: 844 });
  const task = base + '&view=board&task=ST-103&company=forma';
  const initialLength = await page.evaluate(() => history.length);
  await page.goto(task);
  await current('List').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('task'), 'ST-103');
  // The direct entry replaces the forward entry left by Back.
  assert.equal(await page.evaluate(() => history.length), initialLength);
  await page.getByRole('link', { name: 'Board', exact: true }).click();
  await current('Board').waitFor();
  await page.goto(task);
  await current('Board').waitFor();
  assert.equal(await page.locator('[data-studio-auto-display]').count(), 0);
  await page.goto(task + '&display=list');
  await current('List').waitFor();

  const calendarPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const calendar = calendarPage.getByRole('navigation', { name: 'Calendar view' });
  let initialRequests = 0;
  const countRequest = request => { if (request.resourceType() === 'xhr') initialRequests++; };
  calendarPage.on('request', countRequest);
  await calendarPage.goto(base + '&view=calendar');
  await calendar.getByRole('link', { name: 'Week', current: 'page' }).waitFor();
  calendarPage.off('request', countRequest);
  assert.equal(initialRequests, 0);
  await calendar.getByRole('link', { name: 'Agenda' }).click();
  await calendar.getByRole('link', { name: 'Agenda', current: 'page' }).waitFor();
  await calendarPage.waitForFunction(() => !document.querySelector('#studio-workspace.htmx-settling'));
  await calendarPage.goBack();
  await calendarPage.waitForURL(url => url.searchParams.get('display') === 'week', { timeout: 4000 });
  await calendar.getByRole('link', { name: 'Week', current: 'page' }).waitFor();

  await calendarPage.goto(base + '&view=calendar');
  await calendar.getByRole('link', { name: 'Agenda', current: 'page' }).waitFor();
  const currentLength = await calendarPage.evaluate(() => history.length);
  const repeated = calendarPage.waitForResponse(response => response.request().resourceType() === 'xhr' && new URL(response.url()).searchParams.get('display') === 'agenda');
  await calendar.getByRole('link', { name: 'Agenda', current: 'page' }).click();
  await repeated;
  await calendarPage.waitForFunction(() => !document.querySelector('#studio-workspace.htmx-settling'));
  assert.equal(await calendarPage.evaluate(() => history.length), currentLength);
  const failedGet = '**/layouts/dashboard?**display=week**';
  await calendarPage.route(failedGet, route => route.fulfill({ status: 503, body: '' }));
  const failed = calendarPage.waitForResponse(response => response.status() === 503);
  await calendar.getByRole('link', { name: 'Week' }).click();
  await failed;
  await calendarPage.unroute(failedGet);
  await calendarPage.goto(base + '&view=calendar');
  await calendar.getByRole('link', { name: 'Agenda', current: 'page' }).waitFor();

  await calendarPage.close();

  // Hold the progressive enhancement response until the initial form has a draft.
  await page.evaluate(() => localStorage.clear());
  const held = Promise.withResolvers();
  t.after(() => held.resolve());
  const isAlternate = request => request.resourceType() === 'xhr' &&
    new URL(request.url()).searchParams.get('display') === 'list';
  await page.route('**/layouts/dashboard?**', async route => {
    if (isAlternate(route.request())) await held.promise;
    await route.continue().catch(() => {});
  });
  const pending = page.waitForRequest(isAlternate);
  await page.goto(base + '&view=board&compose=task', { waitUntil: 'domcontentloaded' });
  await pending;
  await page.evaluate(() => document.addEventListener('htmx:sendAbort', () => { window.defaultViewAborted = true; }, { once: true }));
  const title = page.getByLabel('Task title');
  await title.fill('Keep this draft');
  held.resolve();
  await page.waitForFunction(() => window.defaultViewAborted);
  assert.equal(await title.inputValue(), 'Keep this draft');
});
