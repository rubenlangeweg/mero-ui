import assert from 'node:assert/strict';
import {mkdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {comparisonApp} from './server.mjs';

// An installed Playwright module may be supplied by absolute path.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = comparisonApp();
await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
  console.log('Chromium',browser.version());
  for (const style of ['mero','daisyui','heroui']) {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    page.setDefaultTimeout(5500);
    const failures = [];
    page.on('pageerror',error=>failures.push(error.message));
    page.on('request',request=>{ if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) failures.push('External request: '+request.url()); });
    const statuses = [];
    page.on('response',response=>{ if (response.request().method()==='POST') statuses.push(response.status()); });
    await page.goto(`${origin}/${style}`);
    assert.equal(await page.locator('link[href="/assets/'+style+'.css"]').count(),1,'Install optional styles.mjs first');
    const cssStatus = await page.request.get(`${origin}/assets/${style}.css`);
    assert.equal(cssStatus.status(),200);
    await page.getByRole('button',{name:'Edit record'}).click();
    const name = page.getByRole('textbox',{name:'Name',exact:true});
    const sku = page.getByRole('textbox',{name:'SKU',exact:true});
    const save = page.getByRole('button',{name:'Save',exact:true});
    if (process.env.COMPARISON_SCREENSHOTS) {
      await mkdir(process.env.COMPARISON_SCREENSHOTS,{recursive:true});
      await sku.waitFor();
      await page.screenshot({path:join(process.env.COMPARISON_SCREENSHOTS,style+'.png')});
    }
    await name.fill('Graphite lamp');
    await sku.fill('TAKEN');
    await save.click();
    await page.locator('form[aria-busy="true"] button[type=submit]:disabled').waitFor();
    await page.locator('#sku-error').waitFor();
    await page.waitForFunction(()=>document.activeElement?.id==='item-sku');
    assert.equal(await name.inputValue(),'Graphite lamp');
    await sku.fill('SL-205');
    await page.getByRole('combobox').selectOption('503');
    await save.click();
    await page.locator('form [role=alert]:visible').waitFor();
    assert.equal(await name.inputValue(),'Graphite lamp');
    assert.equal(await save.isEnabled(),true);
    await page.getByRole('combobox').selectOption('normal');
    await save.click();
    await page.getByRole('heading',{name:'Graphite lamp'}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('dialog').open && document.activeElement?.id==='edit-record');
    await page.reload();
    await page.getByRole('heading',{name:'Graphite lamp'}).waitFor();
    await page.getByRole('button',{name:'Edit record'}).click();
    await name.waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('dialog').open && document.activeElement?.id==='edit-record');
    assert.deepEqual(statuses,[422,503,200]);
    assert.deepEqual(failures,[]);
    console.log(`${style}: busy, duplicate SKU/focus, preserved draft on error, retry, update, reload, Escape and restored focus passed`);
    await page.close();
  }
  const baseline = await readFile(new URL('./baseline.js',import.meta.url),'utf8');
  const activeLines = baseline.split('\n').filter(line=>line.trim() && !line.trimStart().startsWith('//')).length;
  console.log(`Extra host JavaScript: Mero UI 0, styles-only adapter ${activeLines} nonblank/noncomment lines including braces, ${Buffer.byteLength(baseline)} source bytes including comment.`);
} finally {
  await browser?.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
}
