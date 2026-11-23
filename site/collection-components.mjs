import { escapeHtml as escape } from './html.mjs';
import { createLabStore, saveProduct } from './lab.mjs';

const gridQueryParams = 'q,filter,sort,row,returnFocus';
const gridPath = '/demo/collections/grid';
const agendaPath = '/demo/collections/agenda';
const statuses = ['Active', 'Draft', 'Archived'];
const categories = ['Furniture', 'Lighting', 'Objects', 'Textiles'];
const fallbackStore = createLabStore();
const agendaStores = new WeakMap();

function options(values, current) {
  return values.map(value => `<option value="${escape(value)}"${value === current ? ' selected' : ''}>${escape(value)}</option>`).join('');
}

function component(id, name, description, demo, notes, variants = []) {
  const markup = demo.trim();
  return { id, name, description, demo: markup, code: markup, notes, variants };
}

function emptyState(title, description) {
  return `<div class="mero-empty-state"><span class="mero-empty-glyph" aria-hidden="true"></span><strong>${escape(title)}</strong><p>${escape(description)}</p></div>`;
}

function productStatus(status) {
  return `<span class="mero-collection-status" data-status="${escape(status)}">${escape(status)}</span>`;
}

function formField(label, name, value, error, extra = '') {
  return `<label class="mero-collection-field"><span>${label}</span><input class="mero-input" name="${name}" value="${escape(value)}" ${extra}${error ? ' aria-invalid="true"' : ''}>${error ? `<small class="mero-collection-error">${escape(error)}</small>` : ''}</label>`;
}

function editForm(product, errors) {
  return `<form class="mero-collection-editor" hx-post="${gridPath}/save" hx-params="revision,q,filter,sort,row,id,name,sku,category,status">
    <h3>${product.id ? 'Edit product' : 'Add product'}</h3>
    ${product.id ? `<input type="hidden" name="id" value="${product.id}">` : ''}
    <div class="mero-collection-fields">${formField('Product name', 'name', product.name, errors.name, 'required maxlength="80"')}
    ${formField('SKU', 'sku', product.sku, errors.sku, 'required maxlength="24"')}
    <label class="mero-collection-field"><span>Category</span><select class="mero-select" name="category">${options(categories, product.category)}</select></label>
    <label class="mero-collection-field"><span>Status</span><select class="mero-select" name="status">${options(statuses, product.status)}</select></label></div>
    <div class="mero-collection-actions"><button type="submit" class="mero-button mero-button-primary mero-button-sm">Save product</button><button type="button" class="mero-button mero-button-ghost mero-button-sm" hx-get="${gridPath}" hx-params="${gridQueryParams}" hx-vals='{"returnFocus":"${product.id ? `edit-${product.id}` : 'add'}"}'>Cancel</button></div>
  </form>`;
}

/** The host owns storage. All targets are relative to the closest collection instance. */
export function renderCollectionGrid(store, params = new URLSearchParams(), state = {}) {
  const query = (params.get('q') ?? '').trim().slice(0, 120);
  const filter = statuses.includes(params.get('filter')) ? params.get('filter') : '';
  const sort = ['name', 'name-desc', 'status'].includes(params.get('sort')) ? params.get('sort') : 'name';
  const searchText = query.toLowerCase();
  const rows = store.products.filter(product => (!filter || product.status === filter) && `${product.name} ${product.sku}`.toLowerCase().includes(searchText));
  rows.sort((a,b) => sort === 'status' ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name) : sort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
  const selected = new Set(params.getAll('row'));
  // No-JS href stays on the host page; hx-get carries the same view to the fragment, never row drafts.
  const viewLink = (changes, focus, attributes, label) => {
    const next = new URLSearchParams(Object.entries({q:query, filter, sort, ...changes}).filter(([, value]) => value));
    const href = escape('?'+next);
    next.set('returnFocus', focus);
    return `<a href="${href}" hx-get="${escape(`${gridPath}?${next}`)}" hx-params="none"${attributes}>${label}</a>`;
  };
  const sortHeader = (key, label, ascending, descending) => {
    const order = sort === ascending ? 'ascending' : sort === descending ? 'descending' : '';
    const arrow = order ? ` <span aria-hidden="true">${order === 'ascending' ? '↑' : '↓'}</span>` : '';
    return `<th scope="col"${order ? ` aria-sort="${order}"` : ''}>${viewLink({sort: order === 'ascending' && descending ? descending : ascending}, `sort-${key}`, ` data-grid-sort="${key}"`, label+arrow)}</th>`;
  };
  const filterChip = filter ? `<ul class="mero-filter-chips mero-row" aria-label="Applied filters"><li class="mero-chip mero-chip-accent">Status is ${filter} ${viewLink({filter:''}, 'filter', ` aria-label="Remove filter: Status is ${filter}"`, '<span class="mero-dismiss-mark" aria-hidden="true"></span>')}</li></ul>` : '';
  return `<section class="mero-collection" data-mero-grid data-mero-scope data-inventory-revision="${store.revision}" hx-target:inherited="closest [data-mero-grid]" hx-swap:inherited="outerHTML" hx-sync:inherited="closest [data-mero-grid]:drop" hx-include:inherited="closest [data-mero-grid]" hx-params="${gridQueryParams}"${state.focus ? ` data-mero-grid-focus="${escape(state.focus)}"` : ''}>
    <input type="hidden" name="revision" value="${store.revision}">
    <div class="mero-collection-head"><div><h2>Studio inventory</h2><p>Product catalog</p></div><button type="button" class="mero-button mero-button-primary mero-button-sm" data-grid-add hx-get="${gridPath}/new">Add product</button></div>
    <form class="mero-collection-filters" role="search" hx-get="${gridPath}" hx-vals='{"returnFocus":"search"}'>
      <input class="mero-input" type="search" name="q" value="${escape(query)}" maxlength="120" placeholder="Search products…" aria-label="Search products">
      <input type="hidden" name="filter" value="${filter}"><input type="hidden" name="sort" value="${sort}">
      <button type="submit" class="mero-button mero-button-outline mero-button-sm">Apply</button>
    </form>
    <div class="mero-filter-bar">${filterChip}<button class="mero-button mero-button-outline mero-button-sm" type="button" popovertarget="grid-filter-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Add filter" data-grid-filter><span aria-hidden="true">+</span> Filter</button><div class="mero-popover mero-menu" id="grid-filter-menu" popover role="menu" aria-label="Add filter">${statuses.filter(status => status !== filter).map(status => viewLink({filter:status}, 'filter', ' class="mero-menu-item" role="menuitem"', `Status is ${status}`)).join('')}</div>${filter ? viewLink({filter:''}, 'filter', ' class="mero-link"', 'Clear all filters') : ''}</div>
    <p class="mero-collection-message" role="status" data-grid-message>${escape(state.message ?? '')}</p>
    <p class="mero-collection-error" role="alert" data-grid-error${state.error ? '' : ' hidden'}>${escape(state.error ?? '')}</p>
    ${state.edit ? editForm(state.edit, state.errors ?? {}) : ''}
    ${state.remove ? `<form class="mero-collection-editor" hx-post="${gridPath}/delete" hx-params="revision,q,filter,sort,row,id"><h3>Delete ${escape(state.remove.name)}?</h3><p>This removes the product from your inventory.</p><input type="hidden" name="id" value="${state.remove.id}"><div class="mero-collection-actions"><button type="button" data-grid-cancel class="mero-button mero-button-outline mero-button-sm" hx-get="${gridPath}" hx-params="${gridQueryParams}" hx-vals='{"returnFocus":"delete-${state.remove.id}"}'>Cancel</button><button class="mero-button mero-button-danger mero-button-sm" type="submit">Delete product</button></div></form>` : ''}
    <form class="mero-collection-body" hx-post="${gridPath}/bulk" hx-params="revision,q,filter,sort,row,next">
      <div class="mero-collection-scroll"><table class="mero-table mero-collection-table"><caption class="mero-collection-sr">Studio products</caption><thead><tr><th scope="col"><label class="mero-collection-pick"><input type="checkbox" class="mero-checkbox" data-grid-all aria-label="Select all visible products"${rows.length ? '' : ' disabled'}></label></th>${sortHeader('name','Product','name','name-desc')}${sortHeader('status','Status','status')}<th scope="col"><span class="mero-collection-sr">Actions</span></th></tr></thead>
      <tbody>${rows.map(product => `<tr><td><label class="mero-collection-pick"><input class="mero-checkbox" type="checkbox" name="row" value="${product.id}" aria-label="Select ${escape(product.name)}"${selected.has(String(product.id)) ? ' checked' : ''}></label></td><th scope="row"><strong>${escape(product.name)}</strong><small>${escape(product.sku)} · ${escape(product.category)}</small><span class="mero-small-status">${productStatus(product.status)}</span></th><td>${productStatus(product.status)}</td><td><button type="button" class="mero-button mero-button-ghost mero-button-sm" popovertarget="grid-row-${product.id}-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${escape(product.name)}" data-grid-actions="${product.id}">Actions</button><div class="mero-popover mero-menu" id="grid-row-${product.id}-menu" popover role="menu" aria-label="${escape(product.name)} actions"><button type="button" class="mero-menu-item" role="menuitem" hx-params="${gridQueryParams}" hx-get="${gridPath}/${product.id}/edit">Edit</button><button type="button" class="mero-menu-item" role="menuitem" hx-params="${gridQueryParams}" hx-get="${gridPath}/${product.id}/confirm">Delete</button></div></td></tr>`).join('') || `<tr><td colspan="4">${emptyState('No matching products','Change the search or status filter.')}</td></tr>`}</tbody></table></div>
      <div class="mero-action-bar" data-grid-bar hidden><output data-grid-count></output><select class="mero-select" name="next" aria-label="Set selected products to">${options(statuses,'Archived')}</select><button class="mero-button mero-button-primary mero-button-sm" type="submit">Update selected</button><button class="mero-button mero-button-ghost mero-button-sm" data-grid-clear type="button">Clear</button></div>
    </form><footer class="mero-collection-foot">${rows.length} of ${store.products.length} products</footer>
  </section>`;
}

const defaultDate = '2026-11-20';
const initialAgenda = [
  {date:defaultDate, time:'09:30', title:'Material review', location:'Atelier 01'},
  {date:defaultDate, time:'13:00', title:'Lighting test', location:'Photo studio'},
  {date:'2026-11-21', time:'11:00', title:'Collection handover', location:'Showroom'},
];
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function shift(date, days) {
  const result = new Date(date + 'T12:00:00Z');
  result.setUTCDate(result.getUTCDate()+days);
  return result.toISOString().slice(0,10);
}
function agendaNavigation(date, offset) {
  const action = offset < 0 ? 'previous' : 'next';
  const atEnd = offset < 0 ? date === '0001-01-01' : date === '9999-12-31';
  const label = offset < 0 ? 'Previous day' : 'Next day';
  const request = atEnd ? 'disabled' : `hx-get="${agendaPath}?date=${shift(date,offset)}&amp;returnFocus=${action}"`;
  return `<button type="button" class="mero-button mero-button-outline mero-button-sm" data-agenda-action="${action}" aria-label="${label}" ${request}><span aria-hidden="true"></span></button>`;
}
function agendaMarkup(events, date = defaultDate, {focus, booking = {}, errors = {}, message = ''} = {}) {
  const day = new Intl.DateTimeFormat('en', { timeZone:'UTC', weekday:'long', month:'short', day:'numeric' }).format(new Date(date));
  const entries = events.filter(event => event.date === date).sort((a,b) => a.time.localeCompare(b.time));
  return `<section class="mero-agenda" data-mero-agenda${focus ? ` data-agenda-focus="${escape(focus)}"` : ''} hx-target:inherited="closest [data-mero-agenda]" hx-swap:inherited="outerHTML" hx-sync:inherited="closest [data-mero-agenda]:drop">
    <header class="mero-collection-head"><div><h2>Studio agenda</h2><p><time datetime="${date}">${day}</time></p></div><div class="mero-collection-actions">${agendaNavigation(date,-1)}${agendaNavigation(date,1)}</div></header>
    <ol class="mero-agenda-list">${entries.map(event => `<li><time datetime="${date}T${escape(event.time)}">${escape(event.time)}</time><div><strong>${escape(event.title)}</strong><small>${escape(event.location)}</small></div></li>`).join('')}</ol>
    ${entries.length ? '' : emptyState('No bookings','This day is open.')}<p role="status" class="mero-collection-message">${escape(message)}</p>
    <details class="mero-collection-details"${Object.keys(errors).length ? ' open' : ''}><summary data-agenda-action="booking">Add booking</summary>
      <form class="mero-collection-fields" hx-post="${agendaPath}"><input type="hidden" name="date" value="${date}">
        ${formField('Booking title','title',booking.title ?? '',errors.title,'required maxlength="80"')}
        ${formField('Location','location',booking.location ?? '',errors.location,'required maxlength="80"')}
        ${formField('Start time','time',booking.time ?? '10:00',errors.time,'required type="time"')}
        <button class="mero-button mero-button-primary mero-button-sm" type="submit">Add booking</button>
      </form></details><p class="mero-collection-error" role="alert" data-agenda-error hidden></p>
  </section>`;
}

const profiles = [
  ['AR','Arc collection','Lighting and furniture','/components/data-grid'],
  ['FM','Forma studio','Objects and materials','/components/agenda'],
  ['DN','Dune textiles','Finishes and inventory','/components/list-view'],
];
function itemCard([initials, name, detail, href]) {
  return `<a class="mero-item-card" href="${escape(href)}"><span class="mero-collection-monogram" aria-hidden="true">${escape(initials)}</span><span><strong>${escape(name)}</strong><small>${escape(detail)}</small></span><span class="mero-item-arrow" aria-hidden="true">↗</span></a>`;
}

function listView() {
  return `<section class="mero-list-view" aria-label="Catalog resources">${[['Release checklist','Publish a collection','widget'],['Asset files','Browse packaging artwork','file-tree'],['Studio map','Find a location','map']].map(([name, label, slug]) => `<a href="/components/${slug}"><span><strong>${name}</strong><small>${label}</small></span><span aria-hidden="true">→</span></a>`).join('')}</section>`;
}

const locations = [
  ['showroom','Showroom','Building A · Ground floor','39%','27%'],
  ['atelier','Atelier','Building B · First floor','68%','50%'],
  ['dispatch','Dispatch','West entrance · Loading bay','27%','73%'],
];
function studioMap() {
  return `<figure class="mero-place-map" data-mero-place-map><figcaption><strong>Studio campus</strong><small>Rotterdam</small></figcaption><div class="mero-map-drawing" aria-label="Studio locations"><div class="mero-map-block mero-map-block-a"></div><div class="mero-map-block mero-map-block-b"></div><div class="mero-map-block mero-map-block-c"></div>${locations.map(([id,name,,x,y],i) => `<button class="mero-map-pin" type="button" style="--pin-x:${x};--pin-y:${y}" aria-label="${i+1}. ${name}" aria-pressed="${i===0}" data-place="${id}">${i+1}</button>`).join('')}</div><div class="mero-map-caption">${locations.map(([id,name,detail],i)=>`<div data-place-detail="${id}"${i?' hidden':''}><strong>${name}</strong><small>${detail}</small></div>`).join('')}<output class="mero-collection-sr" aria-live="polite"></output></div></figure>`;
}

const lanes = ['Queued','In progress','Ready'];
function kanbanCard(title, category, lane) {
  return `<article class="mero-kanban-card" draggable="true"><small>${category}</small><strong>${title}</strong><label>Move to<select class="mero-select" data-kanban-move aria-label="Move ${title}">${options(lanes,lane)}</select></label></article>`;
}
function kanban() {
  const cards = [['Validate finishes','Production',lanes[0]],['Approve label proof','Packaging',lanes[1]],['Send sample kit','Outreach',lanes[2]]];
  return `<section class="mero-kanban" data-mero-kanban aria-label="Release board"><div class="mero-kanban-lanes">${lanes.map(lane=>`<section class="mero-kanban-lane" data-lane="${lane}"><h2>${lane}<span data-lane-count>1</span></h2><div data-lane-cards>${cards.filter(([, , stage])=>stage===lane).map(card=>kanbanCard(...card)).join('')}</div></section>`).join('')}</div><output role="status" class="mero-collection-sr"></output></section>`;
}

function treeFile(name, explanation) {
  return `<li><button type="button" class="mero-file" data-file-preview="${escape(explanation)}">${escape(name)}</button></li>`;
}
function fileTree() {
  return `<section class="mero-file-tree"><details open><summary>Studio collection</summary><ul><li><details open><summary>Product sheets</summary><ul>${treeFile('arc-task-lamp.txt','Arc Task Lamp · Powder-coated steel. Finish options include ivory, sand and graphite.')}${treeFile('forma-vase.txt','Forma Vase · Hand-finished glazed stoneware. Packaging dimensions: 20 × 20 × 28 cm.')}</ul></details></li><li><details><summary>Photography</summary><ul>${treeFile('shot-list.md','Shoot the front, profile and detail angles against the graphite background.')}</ul></details></li></ul></details><output aria-live="polite">Select a file to preview its contents.</output></section>`;
}

function floatingToc() {
  const entries=[['Materials','Powder-coated steel, brushed brass and low-gloss enamel. Check a sample under daylight before ordering.'],['Assembly','Place the base on a flat surface. Align the threaded stem and turn until the joint is hand-tight.'],['Care','Wipe the shade with a soft, dry cloth. Let the fixture cool before replacing the bulb.']];
  return `<div class="mero-toc" data-mero-toc><nav aria-label="Product guide contents">${entries.map(([name],i)=>`<button type="button" data-toc-link="${i}"${i===0?' aria-current="location"':''}>${name}</button>`).join('')}</nav><div class="mero-toc-scroll" tabindex="0" aria-label="Product guide">${entries.map(([name,detail],i)=>`<section data-toc-section="${i}"><h2 tabindex="-1">${name}</h2><p>${detail}</p></section>`).join('')}</div></div>`;
}

function widget() {
  return `<section class="mero-widget" data-mero-widget><header><div><h2>Release checklist</h2><small>Arc collection</small></div><output aria-live="polite">1 of 3</output></header><progress max="3" value="1" aria-label="Release progress"></progress>${['Photography approved','Finish samples signed off','Packaging received'].map((name,i)=>`<label><input class="mero-checkbox" type="checkbox"${i===0?' checked':''}>${name}</label>`).join('')}</section>`;
}
function hoverCard() {
  return `<div class="mero-hover-card" data-mero-hover-card><button class="mero-hover-trigger" type="button" aria-expanded="false"><span class="mero-collection-monogram" aria-hidden="true">ML</span>Mara Lind</button><aside class="mero-hover-content" popover="manual" hidden><strong>Mara Lind</strong><small>Materials designer · Studio North</small><p>Owns finish sampling and supplier sign-off for the Arc collection.</p><a class="mero-link" href="/components/agenda">View studio agenda</a></aside></div>`;
}
function timeline() {
  return `<ol class="mero-collection-timeline" aria-label="Production timeline">${[['09:10','Final sample approved','Mara signed off the graphite finish.'],['11:25','Production started','Atelier 01 received the first work order.'],['14:00','Dispatch planned','Shipment is waiting on packaging.']].map(([time,title,description],i)=>`<li${i===2?' aria-current="step"':''}><time>${time}</time><div><strong>${title}</strong><p>${description}</p></div></li>`).join('')}</ol>`;
}

function gridExample(query = '') {
  const url = query ? `${gridPath}?${query}` : gridPath;
  return `<div class="mero-grid-mount" hx-get="${escape(url)}" hx-trigger="load" hx-swap="innerHTML">${renderCollectionGrid(createLabStore(), new URLSearchParams(query))}</div>`;
}
const liveGrid = gridExample();
const actionBarGrid = gridExample('row=1&row=2');
// Previews pass the page query, so the no-JS sort and filter links render server-side.
const gridFromPage = (params, base = []) => gridExample(new URLSearchParams([...base, ...[...params].filter(([name]) => ['q','filter','sort'].includes(name))]).toString());
export const groups = [{name:'Studio collections',items:[
  {
    ...component('data-grid','Data Grid','Search, sort, select and edit products in a server-rendered collection.',liveGrid,'Use GET to return a filtered grid. The Product and Status headers sort with links that set aria-sort, + Filter adds a status chip, and each row’s Actions menu opens Edit or Delete. Sort and filter links carry the search and filter in their URL, so they also work without JavaScript. Save, delete and bulk actions POST to the host and return the same section. Validation returns 422 with the draft. Selection applies to visible rows. Supply the displayed revision to handle changes in another workspace.',[
      {name:'Bulk selection',demo:actionBarGrid},
      {name:'Drafts only',demo:gridExample('filter=Draft')},
      {name:'No matches',demo:gridExample('q=No+such+SKU')},
    ]),
    render: params => gridFromPage(params),
  },
  {
    ...component('action-bar','Action Bar','Select records and apply one status change to the selection.',actionBarGrid,'The action bar appears for a nonempty selection. Bulk actions include the selected row IDs and the current query.'),
    render: params => gridFromPage(params, [['row','1'],['row','2']]),
  },
  component('agenda','Agenda','Browse daily bookings and add a timed event.',`<div class="mero-agenda-mount" hx-get="${agendaPath}" hx-trigger="load" hx-swap="innerHTML">${agendaMarkup(initialAgenda)}</div>`,'Return a dated agenda fragment on navigation and after saving a booking. Demo bookings live in memory.'),
  component('file-tree','File Tree','Expand folders and preview a selected file with native disclosure controls.',fileTree()),
  component('floating-toc','Floating TOC','Navigate to sections with an index that follows the reading position.',floatingToc()),
  component('hover-card','Hover Card','Preview a contributor on hover, focus or tap.',hoverCard(),'Tab into the card for its action. Escape dismisses it.'),
  component('item-card','Item Card','Give a related destination an identity, title and supporting detail.',itemCard(profiles[0])),
  component('item-card-group','Item Card Group','Arrange related destinations into a responsive group.',`<div class="mero-item-card-group">${profiles.map(itemCard).join('')}</div>`),
  {
    ...component('kanban', 'Kanban', 'Move a card between stages with a drag or its Move to menu.', kanban(),
      'Tap a card’s Move to menu and choose a stage. On a keyboard, Tab to the same menu and type R for Ready. The card moves, both lane counts update and focus stays on the menu. The bubbling mero:kanban-move event carries the card element and the from and to lane names in event.detail. Reloading resets this board.'),
    relatedExample: { href: '/layouts/dashboard?view=companies&company=forma', label: 'Try a server-saved task move in Studio' },
  },
  component('list-view','List View','Browse structured destinations in a compact keyboard-accessible list.',listView()),
  component('map','Map','Choose a location on a self-contained campus map and read its address.',studioMap(),'The illustrated plan uses local CSS and labelled pins, so it can work offline.'),
  component('timeline','Timeline','Present milestones in order and identify the current step.',timeline()),
  component('widget','Widget','Use a dashboard panel to track a checklist and its progress.',widget()),
]}];

function respond(response, html, status=200, headers={}) {
  response.writeHead(status, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff', ...headers});
  response.end(html);
  return true;
}
async function readForm(request) {
  if (!(request.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) return null;
  const chunks=[];
  let size=0;
  for await (const chunk of request) {
    size+=chunk.length;
    if (size>16384) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

export async function handleCollectionRequest(request, response, url, store = fallbackStore) {
  const {pathname,searchParams} = url;
  if (!(pathname === agendaPath || pathname === gridPath || pathname.startsWith(`${gridPath}/`))) return false;
  if (request.method !== 'GET' && request.method !== 'POST') return respond(response,'Method not allowed.',405);
  const isPost = request.method === 'POST';
  const params = isPost ? await readForm(request) : searchParams;
  if (!params) return respond(response,'Expected a small URL-encoded form.',400);
  if (pathname === agendaPath) {
    if (!agendaStores.has(store)) agendaStores.set(store,initialAgenda.map(event=>({...event})));
    const events=agendaStores.get(store);
    const date=params.get('date') || defaultDate;
    if (!validDate(date) || date < '0001-01-01') return respond(response,'Choose a valid date.',400);
    if (!isPost) {
      const action = params.get('returnFocus');
      return respond(response,agendaMarkup(events,date,{focus:['previous','next'].includes(action) ? action : null}));
    }
    const title=(params.get('title') ?? '').trim(), location=(params.get('location') ?? '').trim(), time=params.get('time') ?? '';
    const errors = {};
    if (!title || title.length > 80) errors.title = 'Enter a booking title of up to 80 characters.';
    if (!location || location.length > 80) errors.location = 'Enter a location of up to 80 characters.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.time = 'Choose a valid time.';
    if (Object.keys(errors).length) return respond(response,agendaMarkup(events,date,{booking:{title,location,time},errors,focus:'invalid'}),422);
    events.push({date,time,title,location});
    return respond(response,agendaMarkup(events,date,{message:'Booking added.',focus:'booking'}));
  }
  const render=(state,status=200)=>respond(response,renderCollectionGrid(store,params,state),status,{'Inventory-Revision':String(store.revision)});
  const id=Number(params.get('id'));
  const record=store.products.find(product=>product.id===id);
  if (!isPost) {
    if (pathname===gridPath) return render({focus:params.get('returnFocus')});
    if (pathname===`${gridPath}/new`) return render({edit:{name:'',sku:'',category:'Furniture',status:'Draft'},focus:'field'});
    const route=pathname.match(/^\/demo\/collections\/grid\/(\d+)\/(edit|confirm)$/);
    if (!route) return respond(response,'Collection route not found.',404);
    const product=store.products.find(item=>item.id===Number(route[1]));
    if (!product) return render({error:'This product no longer exists.',focus:'add'});
    return render(route[2]==='edit'?{edit:product,focus:'field'}:{remove:product,focus:'cancel'});
  }
  if (params.has('revision') && params.get('revision') !== String(store.revision)) {
    params.delete('row');
    const error = 'Inventory changed. Review the current products before submitting again.';
    if (pathname===`${gridPath}/save` && (!params.has('id') || record)) {
      const draft = {id:record?.id, name:params.get('name'), sku:params.get('sku'), category:params.get('category'), status:params.get('status')};
      return render({error, edit:draft, focus:'field'},409);
    }
    return render({error,focus:'add'},409);
  }
  if (pathname===`${gridPath}/save`) {
    if (params.has('id') && !record) return render({error:'This product no longer exists.',focus:'add'});
    const result=saveProduct(store,record,params);
    if (result.errors) return render({edit:result.product,errors:result.errors,error:'Check the highlighted fields.',focus:'invalid'},422);
    return render({message:record?'Product updated.':'Product created.',focus:`edit-${result.product.id}`});
  }
  if (pathname===`${gridPath}/delete`) {
    if (!record) return render({error:'This product no longer exists.',focus:'add'});
    store.products=store.products.filter(product=>product.id!==id);
    store.revision++;
    return render({message:'Product deleted.',focus:'add'});
  }
  if (pathname===`${gridPath}/bulk`) {
    const status=params.get('next');
    const ids=new Set(params.getAll('row'));
    if (!statuses.includes(status) || !ids.size) return render({error:'Select products and choose a status.',focus:'add'},422);
    const selected=store.products.filter(product=>ids.has(String(product.id)));
    if (selected.length !== ids.size) return render({error:'The selection changed. Review the available products.',focus:'add'},422);
    const changed=selected.filter(product=>product.status!==status);
    changed.forEach(product=>{product.status=status;});
    if (changed.length) store.revision++;
    params.delete('row');
    const message = changed.length
      ? `${changed.length} ${changed.length===1?'product':'products'} updated.`
      : 'Those products already have this status.';
    return render({message,focus:'add'});
  }
  return respond(response,'Collection route not found.',404);
}
