import assert from 'node:assert/strict';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemo } from './server.mjs';

const { chromium } = await import(process.env.MERO_PLAYWRIGHT_MODULE || 'playwright');
const destination = fileURLToPath(new URL('./recordings/', import.meta.url));
await mkdir(destination, {recursive:true});
const temporary = await mkdtemp(join(tmpdir(), 'mero-walkthrough-'));
let base;
const browser = await chromium.launch({executablePath:process.env.MERO_CHROME});
const button = (p, name) => p.getByRole('button',{name,exact:true});
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const timestamp = ms => new Date(ms).toISOString().slice(11,23);

async function record(key, run, mobile = false) {
  const viewport = mobile ? {width:390,height:844} : {width:1152,height:768};
  const ctx = await browser.newContext({viewport, recordVideo:{dir:temporary,size:viewport}});
  const start = Date.now();
  const page = await ctx.newPage();
  const cues = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(6000);
  async function caption(copy) {
    cues.push({at:Date.now()-start, copy});
    await pause(1850);
  }
  try {
    await page.goto(base + '/premium/' + (mobile ? 'queue' : key));
    await run(page,caption);
    await pause(2100);
    assert.deepEqual(errors,[]);
    const end = Date.now()-start;
    await ctx.close();
    await page.video().saveAs(join(destination,key+'.webm'));
    const track = cues.map(({at,copy},i) => timestamp(at)+' --> '+timestamp(cues[i+1]?.at ?? end)+'\n'+copy+'\n').join('\n');
    await writeFile(join(destination,key+'.vtt'),'WEBVTT\n\n'+track);
    console.log(key+' verified and recorded');
  } finally { await ctx.close(); }
}

async function review(page, caption) {
  await caption('Open the first pending price change using the keyboard.');
  await page.locator('.pq-row').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.activeElement.id==='pq-approve');
  const initial = parseInt(await page.locator('#pq-count').innerText());
  await caption('Enter approves this price and moves focus to the next approval.');
  for (let i=1;i<=3;i++) {
    await page.keyboard.press('Enter');
    await page.waitForFunction(n=>document.querySelector('#pq-count').textContent===n+' pending' && document.activeElement.id==='pq-approve',initial-i);
    await pause(400);
  }
  await caption('Undo restores the last product and its place in the queue.');
  await button(page,'Undo').click();
  await page.waitForFunction(n=>document.querySelector('#pq-count').textContent===n+' pending' && document.activeElement.id==='pq-approve',initial-2);
  if (page.viewportSize().width < 500) {
    await caption('Escape closes the sheet and returns focus to the restored row.');
    await page.keyboard.press('Escape');
    assert.match(await page.evaluate(()=>document.activeElement.id),/^pq-row-/);
  }
}

async function paste(page, caption) {
  await caption('Review a 30-row price sheet before saving it.');
  await button(page,'Try 30 sample rows').click();
  await page.getByRole('heading',{name:'2 rows to correct'}).waitFor();
  await caption('Two cells failed validation. Enter advances to the next error.');
  await button(page,'Go to first error').click();
  const first=page.getByLabel('Row 1 price'), fifth=page.getByLabel('Row 5 price');
  await first.fill('18.50'); await first.press('Enter'); await pause(500);
  assert.ok(await fifth.evaluate(el=>el===document.activeElement));
  await fifth.fill('36.50'); await fifth.press('Enter');
  await page.getByRole('heading',{name:'30 price changes ready'}).waitFor();
  await caption('Compare previous and proposed prices. Apply the whole batch.');
  await button(page,'Apply 30 price changes').click();
  await page.getByRole('heading',{name:'30 price changes applied'}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),30);
}

async function command(page, caption) {
  await page.locator('#cmd-all').check();
  await caption('Six records selected. Open Commands with Ctrl+K or ⌘K.');
  await page.keyboard.press('Control+k');
  const query=page.getByRole('combobox');
  await query.fill('Assign');
  await page.getByRole('option',{name:/Assign/}).waitFor();
  await caption('Enter opens the teammate picker. Backspace returns one step.');
  await query.press('Enter');
  await page.getByRole('option',{name:/Amara/}).waitFor();
  await pause(650); await query.press('Backspace');
  await page.getByRole('option',{name:/Assign/}).waitFor();
  await pause(450); await query.press('Enter');
  await page.getByRole('heading',{name:'Assign to teammate'}).waitFor();
  await query.fill('noor');
  await page.getByRole('option',{name:/Noor/}).waitFor();
  await caption('Assign all six to Noor. Selection and keyboard focus survive.');
  await query.press('Enter');
  await page.getByText('Assigned 6 records to Noor Bakker.').waitFor();
  assert.equal(await page.locator('td .cmd-owner').allTextContents().then(v=>v.filter(x=>x==='Noor Bakker').length),6);
}

async function bulk(page, caption) {
  const text = value => page.getByText(value,{exact:true}).first().waitFor();
  const click = async(name, result) => { await button(page,name).click(); await text(result); };
  await caption('Select 25 visible products, then extend to all 1,842 matches.');
  await click('Select page','25 selected'); await pause(450);
  await click('Select all 1,842 matching','1,842 selected');
  await page.getByLabel('Select MR-00001',{exact:true}).uncheck(); await text('1,841 selected');
  await caption('Exclude one product on each of two pages.');
  await click('Next','Page 2 of 74');
  await page.getByLabel('Select MR-00026',{exact:true}).uncheck(); await text('1,840 selected');
  await click('Preview changes','1,840 products will change from Draft to Published.');
  await caption('Preview exactly 1,840 changes, then publish.');
  await click('Publish 1,840 products','1,837 of 1,840 products published.');
  await caption('Three products were locked. Retry just those three.');
  await click('Retry 3 failed','1,840 of 1,840 products published.');
}

async function views(page, caption) {
  await caption('Build a view for out-of-stock products.');
  await page.getByLabel('Stock level').selectOption('empty'); await page.waitForURL('**/*filter=empty*');
  await page.getByLabel('Sort by').selectOption('name'); await page.waitForURL('**/*sort=name*');
  await page.getByLabel('Unit price').uncheck();
  await page.getByRole('columnheader',{name:'Unit price'}).waitFor({state:'detached'});
  await page.getByLabel('New view name').fill('Backorders');
  await button(page,'Save a copy').click();
  await page.getByRole('heading',{name:'Backorders'}).waitFor();
  await caption('Copy the link. A separate browser sees the same two rows and columns.');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await button(page,'Copy link').click();
  await page.getByText('View link copied.').waitFor();
  const other=await browser.newPage();
  try {
    await other.goto(await page.evaluate(()=>navigator.clipboard.readText()));
    assert.equal(await other.locator('tbody tr').count(),2);
    assert.equal(await other.getByRole('columnheader',{name:'Unit price'}).count(),0);
    await page.getByLabel('Stock level').selectOption('all');
    await page.getByRole('link',{name:'Reset changes'}).click();
    assert.equal(await page.getByLabel('Stock level').inputValue(),'empty');
    await caption('Reset an edit or update the saved view at its existing link.');
    await page.getByLabel('Stock level').selectOption('available');
    await button(page,'Update view').click();
    await page.getByText(/Saved changes to Backorders/).waitFor();
    await other.reload(); assert.equal(await other.locator('tbody tr').count(),8);
  } finally {await other.close();}
}

async function board(page, caption) {
  const other=await browser.newPage();
  const card='#board-card-PLN-18', move='#board-move-PLN-18';
  try {
    await other.goto(base+'/premium/board');
    for(const p of [page,other]) await p.waitForSelector('#board-connection[data-live]');
    await caption('Drag the card to In progress. A second browser updates live.');
    await page.locator(card).dragTo(page.locator('[data-drop-lane="progress"]'));
    for(const p of [page,other]) await p.waitForSelector('[data-drop-lane="progress"] '+card);
    await page.locator(move).focus(); await page.keyboard.press('Enter');
    await page.getByRole('radio',{name:'Backlog'}).check();
    await caption('While this dialog is open, another teammate moves the card to Done.');
    await other.locator(card).dragTo(other.locator('[data-drop-lane="done"]'));
    await page.waitForSelector('[data-drop-lane="done"] '+card);
    await button(page,'Move card').click();
    await page.waitForFunction(()=>document.querySelector('#board-feedback').textContent.includes('Another edit') && document.activeElement.id==='board-move-PLN-18');
    await caption('Mero shows the conflict and returns focus. Move it again using the keyboard.');
    await page.keyboard.press('Enter'); await page.getByRole('radio',{name:'In progress'}).focus(); await page.keyboard.press('Space');
    await button(page,'Move card').focus(); await page.keyboard.press('Enter');
    for(const p of [page,other]) await p.waitForSelector('[data-drop-lane="progress"] '+card);
  } finally { await other.close(); }
}

try {
  for (const [key, run] of Object.entries({queue:review,paste,command,bulk,views,board,'queue-mobile':review})) {
    const server = await createDemo();
    await new Promise((resolve,reject) => server.once('error',reject).listen(0,'127.0.0.1',resolve));
    base = 'http://127.0.0.1:' + server.address().port;
    try { await record(key,run,key==='queue-mobile'); }
    finally { server.closeAllConnections(); server.close(); }
  }
} finally {
  await browser.close();
  await rm(temporary,{recursive:true,force:true});
}
