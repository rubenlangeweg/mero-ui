import { browserConfig } from "../scripts/browser-config.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../server.mjs';

const playwright = await import(browserConfig.playwrightModule || 'playwright').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && !browserConfig.playwrightModule) return null;
  throw error;
});

const browserOptions = {skip: !playwright && 'Install Playwright for browser checks'};

async function openPreview(t) {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const engine = browserConfig.engine || 'chromium';
  const browser = await playwright[engine].launch({executablePath: engine === 'chromium' ? browserConfig.chromeExecutable : undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport:{width:360,height:800}, reducedMotion:'reduce'});
  page.setDefaultTimeout(5000);
  const visit = id => page.goto('http://127.0.0.1:' + server.address().port + '/preview/' + id);
  return {page,visit};
}

test('chart keyboard navigation and independent chat and report updates', browserOptions, async t => {
  const {page, visit} = await openPreview(t);
  await visit('line-chart?variant=Period%20picker');
  const current = page.locator('[data-mero-plot-value]:focus');
  await page.locator('[data-mero-plot-value][tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await current.getAttribute('aria-label'), /Tue · Shipped/);
  await page.keyboard.press('ArrowDown');
  assert.match(await current.getAttribute('aria-label'), /Tue · Planned/);
  await page.keyboard.press('End');
  assert.match(await current.getAttribute('aria-label'), /Sun · Planned/);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
  await page.locator('[name=period]').selectOption('recent');
  await page.getByRole('button',{name:'Apply'}).click();
  await page.getByText('Friday to Sunday').waitFor();
  assert.equal(await page.locator('[data-mero-plot-value][tabindex="0"]').count(), 1);

  await visit('chat-list-view');
  await page.locator('.mero-chat-inbox').evaluate(first => {
    const second = first.cloneNode(true);
    first.after(second);
    window.htmx.process(second);
  });
  const inbox = page.locator('.mero-chat-inbox').last();
  const peak = inbox.getByRole('link',{name:'Peak capacity'});
  await peak.click();
  await page.getByRole('heading',{name:'Peak capacity'}).waitFor();
  assert.equal(await peak.getAttribute('aria-current'), 'true');
  assert.equal(await inbox.locator('nav [aria-current]').count(), 1);
  assert.equal(await page.locator('.mero-chat-inbox').first().locator('nav [aria-current]').innerText(), 'Weekly dispatches');
  await page.route('**/demo/insights/thread?topic=mix', route => route.fulfill({status:503,body:'Unavailable'}));
  await inbox.getByRole('link',{name:'Collection mix'}).click();
  await page.getByText('Could not load the update. Try again.').waitFor();
  assert.equal(await peak.getAttribute('aria-current'), 'true');

  await visit('chat-conversation');
  const input = page.getByRole('textbox',{name:'Your question'});
  const send = page.getByRole('button',{name:'Send'});
  await input.fill('    ');
  await send.click();
  await page.getByText('Enter a question between 1 and 1,000 characters.').waitFor();
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  await input.fill('Which day shipped most?');
  await send.click();
  await page.locator('.mero-chat-message').nth(3).waitFor();
  assert.equal(await input.getAttribute('aria-invalid'), null);
  assert.match(await page.locator('.mero-chat-message').last().innerText(), /56 units/);
  for (let i=4; i<12; i+=2) {
    await input.fill('Show the collection mix');
    await send.click();
    await page.locator('.mero-chat-message').nth(i+1).waitFor();
  }
  const log = page.locator('.mero-chat-history');
  assert(await log.evaluate(el => el.scrollHeight > el.clientHeight + 25));
  assert(await log.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop < 4));
  await log.evaluate(el => {el.scrollTop = 0;});
  await input.fill('Summarize this week');
  await send.click();
  await page.locator('.mero-chat-message').nth(13).waitFor();
  assert.equal(await log.evaluate(el => el.scrollTop), 0);

  await visit('markdown');
  await page.getByRole('textbox',{name:'Markdown source'}).fill('# Fresh report\n\nTwo **units**');
  await page.getByRole('button',{name:'Render preview'}).click();
  await page.getByRole('heading',{name:'Fresh report'}).waitFor();
  await page.getByText('Preview updated.').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test('metric text stays inside its card and neighboring controls share their alignment', browserOptions, async t => {
  const {page,visit} = await openPreview(t);
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({width,height:800});
    await visit('number-value');
    await page.evaluate(()=>document.fonts.ready);
    const insets = await page.locator('.mero-insight-metric').evaluateAll(cards=>cards.map(card=>{
      const range=document.createRange();
      range.selectNodeContents(card.querySelector('data'));
      const rect=range.getBoundingClientRect(), outer=card.getBoundingClientRect();
      return Math.min(rect.left-outer.left, outer.right-rect.right);
    }));
    assert(insets.every(inset=>inset>=15), 'Metric glyphs retain the card padding at '+width+'px');
  }
  await visit('line-chart?variant=Period%20picker');
  const trigger = await page.locator('[name=period]').boundingBox();
  const submit = await page.getByRole('button',{name:'Apply'}).boundingBox();
  assert(Math.abs(trigger.y-submit.y)<=1 && Math.abs(trigger.height-submit.height)<=1,
    'Apply and its select share both edges');
  await visit('composed-chart');
  const order=await page.locator('svg').evaluate(svg=>{
    const line=svg.querySelector('.mero-plot-line');
    return Array.from(svg.querySelectorAll('g:has(rect)')).every(bar=>
      Boolean(bar.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(order,true,'The planned line is painted above the columns');
  await visit('chat-tool');
  const disclosure=page.locator('summary');
  assert((await disclosure.boundingBox()).height>=44);
  await disclosure.press('Enter');
  assert(await page.getByText('Input',{exact:true}).isVisible());
  await visit('chat-attachment');
  const tile=await page.locator('.mero-chat-file > span').first().boundingBox();
  assert.equal(tile.width,tile.height);
});
