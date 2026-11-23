import { randomUUID } from 'node:crypto';

const pageSize = 25;
const number = value => value.toLocaleString('en-US');
const families = [
  ['Lighting', 'Lumen pendant', 'Opal table lamp', 'Loop wall light', 'Orbit floor lamp'],
  ['Furniture', 'Arc dining chair', 'Studio desk', 'Line sideboard', 'Fold stool'],
  ['Objects', 'Contour vase', 'Stone tray', 'Ridge planter', 'Glass carafe'],
];
const categories = families.map(([category]) => category);
const finishes = ['Chalk', 'Carbon', 'Sand', 'Clay', 'Walnut', 'Moss'];
const catalog = Array.from({ length: 1842 }, (_, index) => {
  const family = families[index % families.length];
  const model = Math.floor(index / families.length);
  return {
    id: index + 1, category: family[0], sku: 'MR-' + String(index + 1).padStart(5, '0'),
    name: family[1 + model % 4], finish: finishes[Math.floor(model / 4) % finishes.length],
  };
});

function pageRows(rows, page) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

function matches(run) {
  return catalog.filter(row => run.category === 'All' || run.category === row.category);
}

// For an all-matching selection only its exceptions have to be kept or sent by the browser.
function isSelected(run, row) {
  if (run.published.has(row.id)) return false;
  return run.all ? !run.ids.has(row.id) : run.ids.has(row.id);
}

function setSelected(run, row, selected) {
  if (run.published.has(row.id)) return;
  if (selected === run.all) run.ids.delete(row.id);
  else run.ids.add(row.id);
}

function actionURL(run, action, fields = {}) {
  const params = new URLSearchParams({ v: String(run.revision), ...fields });
  if (action === 'row') {
    params.set('category', run.category);
    params.set('page', String(run.page));
  }
  return '/premium/bulk/' + run.key + '/' + action + '?' + params.toString().replaceAll('&', '&amp;');
}

function button(run, action, label, fields = {}, { primary = false, disabled = false, id = action } = {}) {
  return '<button type="button" class="mero-button mero-button-sm ' + (primary ? 'mero-button-primary' : 'mero-button-secondary')
    + '" id="bulk-' + id + '" hx-post="' + actionURL(run, action, fields) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
}

function pagination(run, total, page) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  return '<nav class="bulk-paging" aria-label="Product pages"><span>' + number(start) + '–' + number(Math.min(page * pageSize, total))
    + ' of ' + number(total) + '</span><div>'
    + button(run, 'page', 'Previous', { page: String(page - 1) }, { id: 'previous', disabled: page <= 1 })
    + '<span>Page ' + page + ' of ' + pages + '</span>'
    + button(run, 'page', 'Next', { page: String(page + 1) }, { id: 'next', disabled: page >= pages }) + '</div></nav>';
}

function productTable(run, rows, selectable) {
  const head = selectable ? '<th scope="col"><span class="bulk-sr">Select</span></th>' : '';
  return '<div class="bulk-scroll" tabindex="0" role="region" aria-label="Product list"><table class="mero-table bulk-table"><thead><tr>' + head
    + '<th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Category</th><th scope="col">Status</th></tr></thead><tbody>'
    + rows.map(row => {
      const published = run.published.has(row.id);
      const retry = run.failed.has(row.id);
      const status = published ? 'Published' : retry ? 'Retry needed' : 'Draft';
      const choice = selectable ? '<td><input id="bulk-pick-' + row.id + '" type="checkbox" aria-label="Select ' + row.sku
        + '" hx-post="' + actionURL(run, 'row', { id: String(row.id), value: isSelected(run, row) ? '0' : '1' })
        + '"' + (published ? ' disabled' : '') + (isSelected(run, row) ? ' checked' : '') + '></td>' : '';
      return '<tr>' + choice + '<th scope="row">' + row.name + '<small>' + row.finish + '</small></th><td>' + row.sku
        + '</td><td>' + row.category + '</td><td><span class="bulk-status" data-state="' + (published ? 'done' : retry ? 'retry' : 'draft') + '">' + status + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function selectionPanel(run, rows, selected) {
  const selectable = rows.filter(row => !run.published.has(row.id));
  const visible = pageRows(rows, run.page);
  const eligible = visible.filter(row => !run.published.has(row.id));
  const isPageSelected = eligible.length > 0 && eligible.every(row => isSelected(run, row));
  return '<div class="bulk-top"><div><h1 tabindex="-1">Catalog publishing</h1><p>Choose draft products to publish across the catalog.</p></div>'
    + '<label>Category <select class="mero-select" id="bulk-category" name="category" hx-post="' + actionURL(run, 'filter') + '">'
    + ['All', ...categories].map(category => '<option' + (category === run.category ? ' selected' : '') + '>' + category + '</option>').join('') + '</select></label></div>'
    + '<div class="bulk-toolbar"><div><strong>' + number(selected.length) + ' selected</strong>'
    + button(run, 'visible', isPageSelected ? 'Deselect page' : 'Select page', { value: isPageSelected ? '0' : '1' }, { disabled: eligible.length === 0 })
    + (!run.all && selectable.length ? button(run, 'all', 'Select all ' + number(selectable.length) + ' matching') : '')
    + (selected.length ? button(run, 'clear', 'Clear') : '') + '</div>'
    + button(run, 'preview', 'Preview changes', {}, { primary: true, disabled: selected.length === 0 }) + '</div>'
    + productTable(run, visible, true) + pagination(run, rows.length, run.page);
}

function previewPanel(run) {
  return '<div class="bulk-top"><div><h1 tabindex="-1">Review publication</h1><p>' + number(run.snapshot.length)
    + ' products will change from Draft to Published.</p></div></div>'
    + '<div class="bulk-toolbar"><span>Exact selection · ' + (run.category === 'All' ? 'All categories' : run.category) + '</span><div>'
    + button(run, 'back', 'Edit selection') + button(run, 'apply', 'Publish ' + number(run.snapshot.length) + ' products', {}, { primary: true })
    + '</div></div>' + productTable(run, pageRows(run.snapshot, run.previewPage), false) + pagination(run, run.snapshot.length, run.previewPage);
}

function resultsPanel(run) {
  const failures = [...run.failed].map(id => catalog[id - 1]);
  return '<div class="bulk-top"><div><h1 tabindex="-1">Publication results</h1><p>' + number(run.snapshot.length - failures.length)
    + ' of ' + number(run.snapshot.length) + ' products published.</p></div></div>'
    + (failures.length ? '<div class="bulk-toolbar"><span><strong>' + failures.length + ' still selected</strong> · Temporarily locked during indexing.</span>'
      + button(run, 'retry', 'Retry ' + failures.length + ' failed', {}, { primary: true }) + '</div>' + productTable(run, failures, false) : '')
    + '<div class="bulk-result-actions">' + button(run, 'return', 'Return to catalog') + '</div>';
}

function markup(run) {
  const rows = matches(run);
  const selected = rows.filter(row => isSelected(run, row));
  const content = run.stage === 'preview' ? previewPanel(run) : run.stage === 'result' ? resultsPanel(run) : selectionPanel(run, rows, selected);
  return '<section id="bulk-workspace" aria-label="Bulk publication" hx-target:inherited="#bulk-workspace" hx-swap:inherited="outerMorph" hx-sync:inherited="#bulk-workspace:queue all">'
    + content + '<p class="bulk-note" role="status">' + run.message + '</p></section>';
}

function finishBatch(run, rows) {
  // Three fixtures simulate transient locks on their first publication. A retry releases each lock.
  const transient = new Set([311, 901, 1601]);
  run.failed.clear();
  for (const row of rows) {
    if (transient.has(row.id) && !run.unlocked.has(row.id)) {
      run.failed.add(row.id);
      run.unlocked.add(row.id);
    } else {
      run.published.add(row.id);
    }
  }
  run.all = false;
  run.ids = new Set(run.failed);
  run.stage = 'result';
  run.message = run.failed.size ? number(run.failed.size) + ' products need another attempt.' : 'Publication complete.';
}

function update(run, action, params) {
  const rows = matches(run);
  if (action === 'page' && ['select', 'preview'].includes(run.stage)) {
    const preview = run.stage === 'preview';
    const max = Math.max(1, Math.ceil((preview ? run.snapshot.length : rows.length) / pageSize));
    const page = Number(params.get('page'));
    if (Number.isInteger(page) && page >= 1 && page <= max) run[preview ? 'previewPage' : 'page'] = page;
    return;
  }
  if (run.stage === 'preview') {
    if (action === 'apply') finishBatch(run, run.snapshot);
    if (action === 'back') { run.stage = 'select'; run.message = 'Selection ready to edit.'; }
    return;
  }
  if (run.stage === 'result') {
    if (action === 'retry' && run.failed.size) finishBatch(run, [...run.failed].map(id => catalog[id - 1]));
    if (action === 'return') { run.stage = 'select'; run.message = ''; }
    return;
  }
  const selected = params.get('value') === '1';
  switch (action) {
    case 'filter': {
      const category = params.get('category');
      if (!['All', ...categories].includes(category) || category === run.category) return;
      run.category = category;
      run.all = false;
      run.ids.clear();
      run.page = 1;
      run.message = 'Selection cleared for the new category.';
      return;
    }
    case 'all': case 'clear':
      run.all = action === 'all';
      run.ids.clear();
      break;
    case 'visible':
      for (const row of pageRows(rows, run.page)) setSelected(run, row, selected);
      break;
    case 'row': {
      const row = pageRows(rows, run.page).find(row => row.id === Number(params.get('id')));
      if (row) setSelected(run, row, selected);
      break;
    }
    case 'preview': {
      const snapshot = rows.filter(row => isSelected(run, row));
      if (snapshot.length === 0) return;
      run.snapshot = snapshot;
      run.previewPage = 1;
      run.stage = 'preview';
      run.message = 'Review the exact products before publishing.';
      return;
    }
    default: return;
  }
  run.message = number(rows.filter(row => isSelected(run, row)).length) + ' products selected.';
}

const savedRunLimit = 5;

function packRun(run) {
  return {
    ...run, ids: [...run.ids], failed: [...run.failed], published: [...run.published],
    unlocked: [...run.unlocked], snapshot: run.snapshot.map(row => row.id),
  };
}

function unpackRun(run) {
  return {
    ...run, ids: new Set(run.ids), failed: new Set(run.failed), published: new Set(run.published),
    unlocked: new Set(run.unlocked), snapshot: run.snapshot.map(id => catalog[id - 1]),
  };
}

export function createFeature(saved) {
  const runs = new Map((saved?.runs ?? []).slice(-savedRunLimit).map(run => [run.key, unpackRun(run)]));
  return {
    snapshot() {
      return { runs: [...runs.values()].slice(-savedRunLimit).map(packRun) };
    },
    render() {
      const run = {
        key: randomUUID(), revision: 0, stage: 'select', category: 'All', page: 1, previewPage: 1,
        all: false, ids: new Set(), failed: new Set(), published: new Set(), unlocked: new Set(), snapshot: [], message: '',
      };
      if (runs.size >= 100) runs.delete(runs.keys().next().value);
      runs.set(run.key, run);
      return markup(run);
    },
    async handle(req, res, url) {
      const [, , , key, action] = url.pathname.split('/');
      const run = runs.get(key);
      if (!run || req.method !== 'POST') {
        res.writeHead(run ? 405 : 404);
        return res.end(run ? 'Use POST.' : 'Demo expired; reload to start a new catalog.');
      }
      const params = new URLSearchParams(url.searchParams);
      if (action === 'filter') {
        const body = [];
        for await (const part of req) body.push(part);
        params.set('category', new URLSearchParams(Buffer.concat(body).toString()).get('category') ?? '');
      }
      const sameRowView = action === 'row' && run.stage === 'select' && params.get('category') === run.category && params.get('page') === String(run.page);
      if (params.get('v') === String(run.revision) || sameRowView) {
        update(run, action, params);
        run.revision++;
        // Map iteration order keeps recently used tabs in the persisted working set.
        runs.delete(key);
        runs.set(key, run);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(markup(run));
    },
  };
}
