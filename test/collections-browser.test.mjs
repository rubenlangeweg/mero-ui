import { browserConfig } from "../scripts/browser-config.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

const playwright = await import(browserConfig.playwrightModule || 'playwright').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && !browserConfig.playwrightModule) return null;
  throw error;
});

test('grid selection excludes disabled controls and row focus accepts opaque IDs',
  {skip: !playwright && 'Install Playwright to run the browser regression'}, async t => {
    const engine = browserConfig.engine || 'chromium';
    const browser = await playwright[engine].launch({executablePath:engine === 'chromium' ? browserConfig.chromeExecutable : undefined});
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent(`<form data-mero-grid>
      <input type="checkbox" data-grid-all aria-label="Select all">
      <input type="checkbox" name="row" value="enabled" aria-label="Enabled">
      <input type="checkbox" name="row" value="other" aria-label="Other">
      <input type="checkbox" name="row" value="disabled" disabled aria-label="Disabled">
      <fieldset disabled><input type="checkbox" name="row" value="fieldset" checked aria-label="Disabled fieldset"></fieldset>
      <div data-grid-bar hidden><span data-grid-count></span><button type="button" data-grid-clear>Clear</button></div>
      <button type="button" data-grid-add>Add</button>
      <button type="button" data-grid-actions>Actions</button>
    </form>`);
    await page.addScriptTag({path: 'ui/mero-collections.js'});
    const all = page.getByRole('checkbox', {name:'Select all', exact:true});
    const count = page.locator('[data-grid-count]');
    assert.equal(await count.textContent(), '0 selected');
    await page.getByRole('checkbox', {name:'Enabled', exact:true}).check();
    assert.equal(await all.evaluate(el => el.indeterminate), true);
    await all.check();
    assert.equal(await count.textContent(), '2 selected');
    assert.deepEqual(await page.locator('form').evaluate(el => new FormData(el).getAll('row')), ['enabled', 'other']);
    assert.equal(await page.getByRole('checkbox', {name:'Disabled', exact:true}).isChecked(), false);
    assert.equal(await all.evaluate(el => el.indeterminate), false);
    await page.getByRole('button', {name:'Clear', exact:true}).click();
    assert.equal(await count.textContent(), '0 selected');
    assert.equal(await page.locator('[data-grid-bar]').isHidden(), true);
    assert.equal(await page.getByRole('checkbox', {name:'Disabled fieldset', exact:true}).isChecked(), true);
    await page.locator('input[name=row]').evaluateAll(boxes => boxes.forEach(box => { box.disabled = true; }));
    await all.click();
    assert.equal(await all.isChecked(), false);
    assert.equal(await count.textContent(), '0 selected');
    for (const id of ['42', 'a10f246e-763f-4c08-9315-fc1282dc0528', 'asset"[west]\\rack', 'asset\nwest', 'asset\rwest', 'asset\u2028west']) {
      for (const action of ['edit', 'delete']) {
        await page.getByRole('button', {name:'Add', exact:true}).focus();
        await page.locator('form').evaluate((grid, {id, action}) => {
          grid.querySelector('[data-grid-actions]').dataset.gridActions = id;
          grid.dataset.meroGridFocus = `${action}-${id}`;
          grid.dispatchEvent(new CustomEvent('htmx:after:settle', {bubbles:true}));
        }, {id, action});
        assert.equal(await page.locator('[data-grid-actions]').evaluate(el => el === document.activeElement), true);
        assert.equal(await page.locator('form').evaluate(grid => grid.hasAttribute('data-mero-grid-focus')), false);
      }
    }
    await page.locator('form').evaluate(grid => {
      const actions = grid.querySelector('[data-grid-actions]');
      actions.dataset.gridActions = '42';
      actions.disabled = true;
      grid.dataset.meroGridFocus = 'edit-42';
      grid.dispatchEvent(new CustomEvent('htmx:after:settle', {bubbles:true}));
    });
    assert.equal(await page.getByRole('button', {name:'Add', exact:true}).evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('form').evaluate(grid => grid.hasAttribute('data-mero-grid-focus')), false);
  });

test('grid focus and stale-response protection support application-defined contracts',
  {skip: !playwright && 'Install Playwright to run the browser regression'}, async t => {
    const engine = browserConfig.engine || 'chromium';
    const browser = await playwright[engine].launch({executablePath:engine === 'chromium' ? browserConfig.chromeExecutable : undefined});
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent(`<section data-mero-grid data-mero-grid-revision="7" data-mero-grid-revision-header=" Assets-Revision " data-inventory-revision="100">
      <input name="q"><input name="asset-search" data-mero-grid-focus-key="search">
      <button type="button" data-mero-grid-focus-key="sort-price">Price</button>
      <fieldset disabled><button type="button" data-mero-grid-focus-key="disabled-key">Locked</button></fieldset>
      <button type="button" data-mero-focus-fallback>Fallback</button>
      <button type="button" data-grid-add>Add</button>
    </section>
    <section data-mero-grid data-mero-grid-revision="" data-inventory-revision="7">
      <button type="button" data-mero-grid-focus-key="sort-price">Other price</button>
      <button type="button" data-grid-add>Other add</button>
    </section>
    <section data-mero-grid data-mero-grid-revision="0" data-inventory-revision="100"></section>
    <section data-mero-grid data-mero-grid-revision="7" data-mero-grid-revision-header="Bad Header"></section>`);
    await page.addScriptTag({path:'ui/mero-collections.js'});
    const first = page.locator('section').nth(0);
    const legacy = page.locator('section').nth(1);
    const zero = page.locator('section').nth(2);
    const invalidHeader = page.locator('section').nth(3);

    for (const key of ['search', 'sort-price']) {
      await first.evaluate((grid, key) => {
        grid.dataset.meroGridFocus = key;
        grid.dispatchEvent(new CustomEvent('htmx:after:settle', {bubbles:true}));
      }, key);
      assert.equal(await first.locator(`[data-mero-grid-focus-key="${key}"]`).evaluate(el => el === document.activeElement), true);
      assert.equal(await first.evaluate(grid => grid.hasAttribute('data-mero-grid-focus')), false);
    }
    // Disabled explicit key skips legacy selector and falls back to data-mero-focus-fallback.
    await first.evaluate(grid => {
      grid.querySelector('[data-mero-grid-focus-key="search"]').disabled = true;
      grid.dataset.meroGridFocus = 'search';
      grid.dispatchEvent(new CustomEvent('htmx:after:settle', {bubbles:true}));
    });
    assert.equal(await first.locator('[data-mero-focus-fallback]').evaluate(el => el === document.activeElement), true);
    assert.equal(await first.evaluate(grid => grid.hasAttribute('data-mero-grid-focus')), false);
    // Disabled control inside disabled fieldset and missing application keys clear attribute and use fallback chain.
    for (const key of ['disabled-key', 'deleted-row-42']) {
      await first.locator('[data-mero-grid-focus-key="sort-price"]').focus();
      await first.evaluate((grid, key) => {
        grid.dataset.meroGridFocus = key;
        grid.dispatchEvent(new CustomEvent('htmx:after:settle', {bubbles:true}));
      }, key);
      assert.equal(await first.locator('[data-mero-focus-fallback]').evaluate(el => el === document.activeElement), true);
      assert.equal(await first.evaluate(grid => grid.hasAttribute('data-mero-grid-focus')), false);
    }
    // Without data-mero-focus-fallback, missing application key falls back to data-grid-add.
    await legacy.evaluate(grid => {
      grid.dataset.meroGridFocus = 'deleted-row-99';
      grid.dispatchEvent(new CustomEvent('htmx:after:settle', {bubbles:true}));
    });
    assert.equal(await legacy.locator('[data-grid-add]').evaluate(el => el === document.activeElement), true);
    assert.equal(await legacy.evaluate(grid => grid.hasAttribute('data-mero-grid-focus')), false);

    const dispatchSwap = (locator, headers, status) => locator.evaluate((grid, {headers, status}) => {
      return grid.dispatchEvent(new CustomEvent('htmx:before:swap', {
        bubbles:true, cancelable:true,
        detail:{ctx:{target:grid, response:{status, headers:new Headers(headers)}}},
      }));
    }, {headers, status});

    for (const [headers, status, allowed] of [
      [{'Assets-Revision':'6'}, 200, false],
      [{'Assets-Revision':'7'}, 200, true],
      [{'Assets-Revision':'8'}, 200, true],
      [{'Assets-Revision':''}, 200, true],
      [{'Assets-Revision':'   '}, 200, true],
      [{'Assets-Revision':'unknown'}, 200, true],
      [{'Inventory-Revision':'1'}, 200, true],
      [{}, 200, true], [{}, 409, true], [{}, 422, true], [{}, 500, false],
    ]) {
      assert.equal(await dispatchSwap(first, headers, status), allowed, JSON.stringify({headers, status}));
    }
    // In-place swap advances data-mero-grid-revision from a higher response header, unless swap is none.
    await first.evaluate(grid => {
      grid.dispatchEvent(new CustomEvent('htmx:after:swap', {
        bubbles:true,
        detail:{ctx:{target:grid, swap:'none', response:{status:200, headers:new Headers({'Assets-Revision':'12'})}}},
      }));
    });
    assert.equal(await first.getAttribute('data-mero-grid-revision'), '7');
    await first.evaluate(grid => {
      grid.dispatchEvent(new CustomEvent('htmx:after:swap', {
        bubbles:true,
        detail:{ctx:{target:grid, swap:'innerHTML', response:{status:200, headers:new Headers({'Assets-Revision':'9'})}}},
      }));
    });
    assert.equal(await first.getAttribute('data-mero-grid-revision'), '9');
    assert.equal(await dispatchSwap(first, {'Assets-Revision':'8'}, 200), false);
    assert.equal(await dispatchSwap(first, {'Assets-Revision':'9'}, 200), true);
    // Blank data-mero-grid-revision falls back to legacy data-inventory-revision and Inventory-Revision.
    assert.equal(await dispatchSwap(legacy, {'Inventory-Revision':'6'}, 200), false);
    assert.equal(await dispatchSwap(legacy, {'Inventory-Revision':'7'}, 200), true);
    // Pure legacy grid advances data-inventory-revision on in-place swap.
    await legacy.evaluate(grid => {
      grid.removeAttribute('data-mero-grid-revision');
      grid.dispatchEvent(new CustomEvent('htmx:after:swap', {
        bubbles:true,
        detail:{ctx:{target:grid, swap:'innerHTML', response:{status:200, headers:new Headers({'Inventory-Revision':'8'})}}},
      }));
    });
    assert.equal(await legacy.getAttribute('data-inventory-revision'), '8');
    assert.equal(await dispatchSwap(legacy, {'Inventory-Revision':'7'}, 200), false);
    // Numeric zero takes precedence over legacy data-inventory-revision.
    assert.equal(await dispatchSwap(zero, {'Inventory-Revision':'1'}, 200), true);
    assert.equal(await dispatchSwap(zero, {'Inventory-Revision':'-1'}, 200), false);
    // Malformed revision header name does not throw or bypass error-swap blocking.
    assert.equal(await dispatchSwap(invalidHeader, {}, 200), true);
    assert.equal(await dispatchSwap(invalidHeader, {}, 500), false);
  });

test('collection interactions preserve drafts, keyboard focus and access to popover actions',
  {skip: !playwright && 'Install Playwright to run the browser regression'}, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:'+server.address().port;
    const engine = browserConfig.engine || 'chromium';
    const browser = await playwright[engine].launch({executablePath:engine === 'chromium' ? browserConfig.chromeExecutable : undefined});
    t.after(() => browser.close());
    const page = await browser.newPage({viewport:{width:320,height:790}});
    page.setDefaultTimeout(5000);

    async function open(slug, endpoint) {
      const loaded = page.waitForResponse(response => new URL(response.url()).pathname === endpoint);
      await page.goto(base+'/preview/'+slug);
      await loaded;
      await page.locator('[hx-trigger="load"] .htmx-settling').waitFor({state:'detached'});
    }
    const focused = selector => page.waitForFunction(selector => document.activeElement?.matches(selector),selector);

    await open('data-grid','/demo/collections/grid');
    const header = name => page.getByRole('columnheader',{name,exact:true});
    assert.equal(await header('Product').getAttribute('aria-sort'),'ascending');
    await page.getByRole('checkbox',{name:'Select Halo Pendant',exact:true}).check();
    const sorted = page.waitForRequest(req => new URL(req.url()).pathname === '/demo/collections/grid');
    await page.getByRole('link',{name:'Product'}).focus();
    await page.keyboard.press('Enter');
    const sortSearch = new URL((await sorted).url()).searchParams;
    assert.equal(sortSearch.get('sort'),'name-desc');
    assert.ok(!sortSearch.has('row'),'sort links leave row selection out');
    await page.locator('th[aria-sort=descending]').waitFor();
    await focused('[data-grid-sort=name]');

    await page.getByRole('button',{name:'Add filter'}).focus();
    await page.keyboard.press('Enter');
    await focused('[role=menuitem]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.getByRole('list',{name:'Applied filters'}).getByText('Status is Active').waitFor();
    await focused('[data-grid-filter]');
    assert.equal(await header('Product').getAttribute('aria-sort'),'descending','the filter keeps the sort');
    assert.equal(await page.getByRole('row',{name:/Halo Pendant/}).count(),0);
    await page.getByRole('link',{name:'Remove filter: Status is Active'}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('row',{name:/Halo Pendant/}).waitFor();
    await focused('[data-grid-filter]');

    await page.getByRole('button',{name:'Actions for Arc Task Lamp'}).click();
    await page.getByRole('menuitem',{name:'Edit'}).click();
    await focused('input[name=name]');
    await page.getByLabel('Product name').fill('Unsubmitted private draft');
    const cancel = page.waitForRequest(req => new URL(req.url()).pathname === '/demo/collections/grid');
    await page.getByRole('button',{name:'Cancel'}).click();
    const search = new URL((await cancel).url()).searchParams;
    assert.equal(search.get('returnFocus'),'edit-6');
    assert.equal(search.get('sort'),'name-desc');
    for (const key of ['id','name','sku','category','status','revision','next']) assert.ok(!search.has(key),key);
    await focused('[data-grid-actions="6"]');
    await page.keyboard.press('Enter');
    await focused('[role=menuitem]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await focused('[data-grid-cancel]');
    await page.keyboard.press('Enter');
    await focused('[data-grid-actions="6"]');
    assert.ok(await page.locator('.mero-collection-scroll').evaluate(el => el.scrollWidth <= el.clientWidth+1));

    await page.locator('[data-mero-grid]').evaluate(first => {
      const copy = first.cloneNode(true);
      first.after(copy);
      window.MeroUI.init(copy);
      window.htmx.process(copy);
    });
    const grids = page.locator('[data-mero-grid]');
    await grids.nth(1).getByRole('checkbox',{name:'Select Arc Task Lamp',exact:true}).check();
    await grids.nth(1).getByRole('button',{name:'Actions for Arc Task Lamp'}).click();
    await grids.nth(1).getByRole('menuitem',{name:'Edit'}).click();
    await focused('input[name=name]');
    assert.equal(await grids.nth(1).locator('[data-grid-count]').textContent(),'1 selected');
    assert.equal(await grids.first().locator('.mero-collection-editor').count(),0);
    assert.ok(await grids.first().locator('[data-grid-bar]').isHidden());

    const plain = await browser.newPage({javaScriptEnabled:false});
    t.after(() => plain.close());
    await plain.goto(base+'/preview/data-grid?filter=Draft');
    await plain.getByRole('link',{name:'Product'}).click();
    await plain.waitForURL(url => url.searchParams.get('sort') === 'name-desc' && url.searchParams.get('filter') === 'Draft');
    assert.equal(await plain.getByRole('columnheader',{name:'Product',exact:true}).getAttribute('aria-sort'),'descending');
    assert.equal(await plain.getByRole('row',{name:/Arc Task Lamp/}).count(),0);

    let finishInitialRefresh;
    const held = new Promise(resolve => { finishInitialRefresh = resolve; });
    await page.route(base+'/demo/collections/agenda',async route => {
      const response = await route.fetch();
      await held;
      await route.fulfill({response});
    },{times:1});
    await page.goto(base+'/preview/agenda');
    await page.getByRole('button',{name:'Next day'}).focus();
    await page.keyboard.press('Enter');
    await page.getByText('Saturday, Nov 21').waitFor();
    const refreshed = page.waitForResponse(base+'/demo/collections/agenda');
    finishInitialRefresh();
    await refreshed;
    await focused('[data-agenda-action=next]');
    await page.locator('summary').click();
    await page.getByLabel('Booking title').fill('   ');
    await page.getByLabel('Location').fill('North studio');
    await page.getByRole('button',{name:'Add booking'}).click();
    await focused('input[aria-invalid=true]');
    assert.equal(await page.getByLabel('Location').inputValue(),'North studio');
    await page.getByLabel(/Booking title/).fill('Finish review');
    await page.getByRole('button',{name:'Add booking'}).click();
    await page.getByText('Finish review',{exact:true}).waitFor();
    await focused('summary');

    await page.goto(base+'/components/hover-card');
    const trigger = page.getByRole('button',{name:'Mara Lind'});
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    // WebKit's default macOS keyboard settings reach links with Option+Tab.
    await page.keyboard.press(engine === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    const link = page.getByRole('link',{name:'View studio agenda'});
    assert.ok(await link.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return el === document.activeElement && el.contains(document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2));
    }));
    await page.keyboard.press('Escape');
    await focused('.mero-hover-trigger');
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  });

test('copied compositions fit a narrow host using only their distributed styles',
  {skip: !playwright && 'Install Playwright to run the browser regression'}, async t => {
    const {groups} = await import('../site/composition-components.mjs');
    const {readFile} = await import('node:fs/promises');
    const engine = browserConfig.engine || 'chromium';
    const browser = await playwright[engine].launch({executablePath:engine === 'chromium' ? browserConfig.chromeExecutable : undefined});
    t.after(() => browser.close());
    const page = await browser.newPage({viewport:{width:320,height:790}});
    const examples = groups.flatMap(group => group.items);
    const markup = examples.map(item => `<section data-example="${item.id}">${item.code}</section>`).join('');
    const origin = 'http://copy.test';
    await page.route(origin+'/**',async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/mero.css"><link rel="stylesheet" href="/mero-composition.css"><main>${markup}</main></html>`});
      const asset = path.slice(1);
      if (!['mero.css','mero-composition.css','studio-lamp.webp'].includes(asset)) return route.abort();
      const folder = asset === 'studio-lamp.webp' ? '../public/' : '../ui/';
      return route.fulfill({contentType:asset.endsWith('.css') ? 'text/css' : 'image/webp',body:await readFile(new URL(folder+asset,import.meta.url))});
    });
    await page.goto(origin+'/');
    const spill = await page.locator('[data-example]').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth+1).map(el => el.dataset.example));
    assert.deepEqual(spill,[]);
  });
