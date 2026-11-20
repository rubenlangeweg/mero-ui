import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createLabStore } from '../site/lab.mjs';
import { handleCollectionRequest } from '../site/collection-components.mjs';
import { handleInventoryRequest } from '../site/inventory-routes.mjs';

async function request(store, route, fields) {
  const body = fields && new URLSearchParams(fields).toString();
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = fields ? 'POST' : 'GET';
  req.headers = { 'content-type': 'application/x-www-form-urlencoded' };
  const response = {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(html) { this.html = html; },
  };
  const handler = route.startsWith('/demo/products') ? handleInventoryRequest : handleCollectionRequest;
  assert.ok(await handler(req,response,new URL(route,'http://localhost'),store));
  return response;
}
const grid = '/demo/collections/grid';

test('bulk actions apply atomically and render the active server filter',async () => {
  const store = createLabStore();
  const invalid = await request(store,`${grid}/bulk`,[['row',1],['row',9999],['next','Archived']]);
  assert.equal(invalid.status,422);
  assert.equal(store.products[0].status,'Active');
  const updated = await request(store,`${grid}/bulk`,[['row',1],['row',2],['next','Archived'],['filter','Active']]);
  assert.equal(updated.status,200);
  assert.equal(store.products[0].status,'Archived');
  assert.equal(store.products[1].status,'Archived');
  assert.doesNotMatch(updated.html,/Arc Lounge Chair|Halo Pendant/);
  assert.match(updated.html,/2 products updated/);
});

test('grid header sort links, filter chips and row menus carry the view but not row drafts',async () => {
  const {html} = await request(createLabStore(),`${grid}?q=a&filter=Draft&sort=name-desc&row=2`);
  assert.match(html,/<th scope="col" aria-sort="descending"><a href="\?q=a&amp;filter=Draft&amp;sort=name" hx-get="\/demo\/collections\/grid\?q=a&amp;filter=Draft&amp;sort=name&amp;returnFocus=sort-name" hx-params="none" data-grid-sort="name">Product/);
  assert.match(html,/<th scope="col"><a href="\?q=a&amp;filter=Draft&amp;sort=status"/);
  assert.match(html,/aria-label="Remove filter: Status is Draft"/);
  assert.match(html,/role="menuitem">Status is Active</);
  assert.doesNotMatch(html,/role="menuitem">Status is Draft</);
  assert.doesNotMatch(html,/<select[^>]+name="(?:filter|sort)"/);
  assert.doesNotMatch(html,/href="[^"]*row=/);
  assert.match(html,/aria-label="Actions for Halo Pendant" data-grid-actions="2"/);
  assert.match(html,/role="menuitem" hx-params="q,filter,sort,row,returnFocus" hx-get="\/demo\/collections\/grid\/2\/edit">Edit</);
  const unfiltered = (await request(createLabStore(),`${grid}?sort=status`)).html;
  assert.match(unfiltered,/aria-sort="ascending"><a href="\?sort=status"/);
  assert.doesNotMatch(unfiltered,/Applied filters|Clear all filters/);
});

test('inline editor keeps an invalid draft and creates and deletes a valid product',async () => {
  const store=createLabStore();
  const draft = {name:'Graphite <Lamp>',sku:store.products[0].sku,category:'Lighting',status:'Draft'};
  const invalid = await request(store,`${grid}/save`,draft);
  assert.equal(invalid.status,422);
  assert.match(invalid.html,/Graphite &lt;Lamp&gt;/);
  assert.match(invalid.html,/already uses this SKU/);
  const saved = await request(store,`${grid}/save`,{...draft,sku:'ARC-01'});
  const id=store.products.at(-1).id;
  assert.match(saved.html,new RegExp(`data-mero-grid-focus="edit-${id}"`));
  assert.equal(store.products.at(-1).sku,'ARC-01');
  const filtered=await request(store,`${grid}?q=nonexistent`);
  assert.match(filtered.html,/No matching products/);
  const confirm = await request(store,`${grid}/${id}/confirm`);
  assert.match(confirm.html,/Delete Graphite &lt;Lamp&gt;\?/);
  await request(store,`${grid}/delete`,{id});
  assert.equal(store.products.some(item=>item.id===id),false);
});

test('agenda validates calendar dates and isolates bookings by demo store',async () => {
  const store=createLabStore();
  assert.equal((await request(store,'/demo/collections/agenda?date=2026-02-31')).status,400);
  const day='2027-05-14';
  const saved=await request(store,'/demo/collections/agenda',{date:day,time:'10:30',title:'Light testing',location:'Studio C'});
  assert.equal(saved.status,200);
  assert.match(saved.html,/Light testing/);
  assert.match((await request(store,`/demo/collections/agenda?date=${day}`)).html,/Light testing/);
  assert.doesNotMatch((await request(createLabStore(),`/demo/collections/agenda?date=${day}`)).html,/Light testing/);
});

test('inventory and collections share revisions, including stale selection and draft recovery', async () => {
  const store = createLabStore();
  const product = store.products[0];
  const first = await request(store,grid);
  const revision = first.headers['Inventory-Revision'];
  await request(store,'/demo/products/'+product.id,{...product,name:'Changed elsewhere'});
  const conflict = await request(store,grid+'/bulk',[['row',product.id],['next','Archived'],['revision',revision]]);
  assert.equal(conflict.status,409);
  assert.equal(product.status,'Active');
  assert.match(conflict.html,/Changed elsewhere/);
  const oldDraft = await request(store,grid+'/save',{...product,name:'Unsubmitted draft',revision});
  assert.equal(oldDraft.status,409);
  assert.match(oldDraft.html,/value="Unsubmitted draft"/);
  assert.equal(product.name,'Changed elsewhere');
  const fresh = conflict.headers['Inventory-Revision'];
  const bulk = await request(store,grid+'/bulk',[['row',product.id],['next','Archived'],['revision',fresh]]);
  assert.equal(bulk.headers['Inventory-Revision'],String(Number(fresh)+1));
  assert.equal((await request(store,'/demo/products')).headers['Inventory-Revision'],bulk.headers['Inventory-Revision']);
  await request(store,grid+'/delete',{id:product.id,revision:bulk.headers['Inventory-Revision']});
  assert.equal((await request(store,'/demo/products')).headers['Inventory-Revision'],String(Number(fresh)+2));
});

test('agenda returns a correctable booking draft and stops at calendar boundaries', async () => {
  const store = createLabStore();
  const route = '/demo/collections/agenda';
  const invalid = await request(store, route, {date:'2027-05-14',time:'12:30',title:'   ',location:'Studio <A>'});
  assert.equal(invalid.status,422);
  assert.match(invalid.html,/data-agenda-focus="invalid"/);
  assert.match(invalid.html,/<details class="mero-collection-details" open>/);
  assert.match(invalid.html,/name="title"[^>]+aria-invalid="true"/);
  assert.match(invalid.html,/value="Studio &lt;A&gt;"/);
  for (const [date,action] of [['0001-01-01','previous'],['9999-12-31','next']]) {
    const result = await request(store,route+'?date='+date);
    assert.equal(result.status,200);
    assert.match(result.html,new RegExp('data-agenda-action="'+action+'"[^>]+disabled'));
  }
});
