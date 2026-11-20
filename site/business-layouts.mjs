import { renderChart } from '../ui/insight-charts.mjs';
import { escapeHtml as esc } from './html.mjs';

export const businessAssets = ['mero-insights.css', 'business-layouts.css', 'mero-insights.js'];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format;
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format;
const stages = [
  { id: 'discovery', name: 'Discovery', probability: .25 },
  { id: 'proposal', name: 'Proposal', probability: .55 },
  { id: 'negotiation', name: 'Negotiation', probability: .8 },
];
const deals = [
  { id: 'forma', company: 'Forma Works', mark: 'F', project: 'Retail rollout', stage: 'proposal', amount: 68400, contact: 'Lena Park', owner: 'Maya Chen', close: '2026-12-11', next: 'Walk Lena through the revised rollout estimate on November 24.' },
  { id: 'arc', company: 'Arc & Field', mark: 'A', project: 'Identity system', stage: 'discovery', amount: 32500, contact: 'Theo Jones', owner: 'Jon Bell', close: '2026-12-18', next: 'Review the brand audit with Theo and agree the scope for phase one.' },
  { id: 'stillwater', company: 'Stillwater', mark: 'S', project: 'Showroom fixtures', stage: 'negotiation', amount: 54200, contact: 'Nina Shah', owner: 'Maya Chen', close: '2026-11-27', next: 'Confirm the installation dates before procurement signs the agreement.' },
  { id: 'tandem', company: 'Tandem Labs', mark: 'T', project: 'Member workspace', stage: 'proposal', amount: 41600, contact: 'Alex Reed', owner: 'Eli Rivera', close: '2026-12-14', next: 'Share the phased fit-out schedule with Alex ahead of the budget review.' },
  { id: 'cinder', company: 'Cinder Studio', mark: 'C', project: 'Flagship concept', stage: 'discovery', amount: 28000, contact: 'Sofia Wolf', owner: 'Jon Bell', close: '2026-12-21', next: 'Run a materials workshop with Sofia and the retail team.' },
  { id: 'union', company: 'Union House', mark: 'U', project: 'Hospitality collection', stage: 'negotiation', amount: 76300, contact: 'Leo Meyer', owner: 'Eli Rivera', close: '2026-11-30', next: 'Send the final sample board for purchasing approval.' },
];

export { deals as studioDeals };

// Each posting has one signed USD amount. Balances, inflow and outflow derive from the same ledger.
const ledger = [
  ['2026-08-05', 'Forma Works', 'Client payment', 'FW-081', 18600],
  ['2026-08-12', 'Linehaul Freight', 'Shipping', 'LF-912', -2860],
  ['2026-08-18', 'Arc & Field', 'Client payment', 'AF-043', 14300],
  ['2026-08-24', 'Studio payroll', 'Payroll', 'PR-008', -19300],
  ['2026-08-28', 'Union House', 'Project deposit', 'UH-121', 22400],
  ['2026-09-02', 'Tandem Labs', 'Project deposit', 'TL-091', 14250],
  ['2026-09-08', 'Morrow Supply', 'Materials', 'MS-620', -8120],
  ['2026-09-17', 'Forma Works', 'Client payment', 'FW-094', 36100],
  ['2026-09-24', 'Studio payroll', 'Payroll', 'PR-009', -19800],
  ['2026-09-30', 'Cinder Studio', 'Client payment', 'CS-707', 9600],
  ['2026-10-02', 'Union House', 'Project deposit', 'UH-135', 24800],
  ['2026-10-09', 'Morrow Supply', 'Materials', 'MS-641', -12400],
  ['2026-10-16', 'Stillwater', 'Client payment', 'SW-182', 18500],
  ['2026-10-23', 'Studio payroll', 'Payroll', 'PR-010', -21600],
  ['2026-10-29', 'Forma Works', 'Client payment', 'FW-106', 32400],
].map(([day, name, category, reference, amount]) => ({ day, name, category, reference, amount }));
const periods = [
  { key: '2026-08', name: 'August', short: 'Aug', end: 31 },
  { key: '2026-09', name: 'September', short: 'Sep', end: 30 },
  { key: '2026-10', name: 'October', short: 'Oct', end: 31 },
];
const initialBalance = 86400;

function destination(screen, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
  return '/layouts/' + screen + (query ? '?' + query : '');
}
function link(href, label, { className = '', current = false, id = '', expanded, name = '' } = {}) {
  const safe = esc(href);
  return `<a class="${className}" href="${safe}" hx-get="${safe}"${current ? ' aria-current="true"' : ''}${id ? ` id="${esc(id)}"` : ''}${expanded === undefined ? '' : ` aria-expanded="${expanded}"`}${name ? ` aria-label="${esc(name)}"` : ''}>${label}</a>`;
}
function dateLabel(iso) {
  return date(new Date(iso + 'T12:00:00Z'));
}
function stat(label, value, className = '') {
  return `<div class="${className}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}
function stageText(id) {
  const stage = stages.find(item => item.id === id);
  return `<span class="bu-stage" data-stage="${stage.id}"><i aria-hidden="true"></i>${stage.name}</span>`;
}
function mark(deal, large = false) {
  return `<span class="bu-mark${large ? ' bu-mark-lg' : ''}" data-company="${deal.id}" aria-hidden="true">${deal.mark}</span>`;
}
function crmDetail(deal, count, initial) {
  return `<aside class="bu-deal-detail" aria-label="Deal details"${initial ? ' data-initial' : ''} style="--bu-rows:${count + 1}">
    ${mark(deal, true)}<h2>${esc(deal.company)}</h2><p>${esc(deal.project)}</p>
    <dl class="bu-details">${stat('Deal value', money(deal.amount))}<div><dt>Stage</dt><dd>${stageText(deal.stage)}</dd></div>
    ${stat('Contact', deal.contact)}${stat('Deal owner', deal.owner)}${stat('Expected close', dateLabel(deal.close))}</dl>
    <section class="bu-next"><h3>Next step</h3><p>${esc(deal.next)}</p></section></aside>`;
}
function crm(params) {
  const filter = stages.find(stage => stage.id === params.get('stage'))?.id || '';
  const list = deals.filter(deal => !filter || deal.stage === filter);
  const selected = list.find(deal => deal.id === params.get('deal')) || list[0];
  const totals = stages.map(stage => deals.filter(d => d.stage === stage.id).reduce((sum, d) => sum + d.amount, 0));
  const total = totals.reduce((sum, n) => sum + n, 0);
  const weighted = totals.reduce((sum, n, i) => sum + n * stages[i].probability, 0);
  return `<header class="bu-head"><div><h1>Sales pipeline</h1><p>Open opportunities · October–December 2026</p></div></header>
    <section class="bu-pipeline" aria-label="Pipeline summary"><div class="bu-pipeline-value"><p>Total pipeline</p><strong>${money(total)}</strong></div>
      <div class="bu-stage-graph"><div class="bu-stacked" aria-hidden="true">${stages.map((s, i) => `<i data-stage="${s.id}" style="flex-grow:${totals[i]}"></i>`).join('')}</div>
      <dl class="bu-stage-totals">${stages.map((stage, i) => `<div><dt>${stageText(stage.id)}</dt><dd>${money(totals[i])}</dd></div>`).join('')}</dl></div>
      <dl class="bu-forecast">${stat('Weighted forecast', money(weighted))}</dl></section>
    <div class="bu-filter-row"><h2>Opportunities</h2><nav class="bu-pills" aria-label="Filter deals by stage">${[{ id: '', name: 'All deals' }, ...stages].map(stage => link(destination('crm', { stage: stage.id }), esc(stage.name), { current: filter === stage.id, id: 'filter-' + (stage.id || 'all') })).join('')}</nav></div>
    <section class="bu-pipeline-list" aria-label="Opportunities and deal details"><div class="bu-list-count">${list.length} ${list.length === 1 ? 'opportunity' : 'opportunities'}<span>Value</span></div>
    ${list.map(deal => link(destination('crm', { stage: filter, deal: deal.id }), `${mark(deal)}<span class="bu-company"><strong>${esc(deal.company)}</strong><small>${esc(deal.project)}</small></span><span class="bu-deal-cell">${stageText(deal.stage)}</span><b>${money(deal.amount)}</b>`, { className: 'bu-deal', current: selected === deal, id: 'deal-' + deal.id }) + (selected === deal ? crmDetail(deal, list.length, params.get('deal') !== deal.id) : '')).join('')}</section>`;
}
function finance(params) {
  const period = periods.find(item => item.key === params.get('period')) || periods.at(-1);
  const entries = ledger.filter(item => item.day.startsWith(period.key));
  const selected = entries.find(item => item.reference === params.get('transaction'));
  const opening = ledger.filter(item => item.day < period.key).reduce((sum, item) => sum + item.amount, initialBalance);
  const net = entries.reduce((sum, item) => sum + item.amount, 0);
  const closing = opening + net;
  const incoming = entries.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
  const data = [1, 8, 15, 22, period.end].map(day => ({ label: `${period.short} ${day}`, values: [entries.filter(item => Number(item.day.slice(-2)) <= day).reduce((sum, item) => sum + item.amount, opening)] }));
  const chart = renderChart({ type: 'area', title: 'Operating balance', series: ['Closing balance'], rows: data, numberFormat: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }, axisNumberFormat: { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 } });
  return `<header class="bu-head"><div><h1>Cash overview</h1><p>Operating account · USD</p></div><nav class="bu-pills" aria-label="Statement month">${periods.map(item => link(destination('finance', { period: item.key }), item.short, { current: item === period, id: 'period-' + item.key, name: `${item.short}, ${item.name} 2026` })).join('')}</nav></header>
    <div class="bu-finance-summary"><section class="bu-balance" aria-label="Monthly balance"><p>Closing balance</p><strong>${money(closing)}</strong><span>${esc(period.name)} ${period.end}, 2026</span>
      <dl class="bu-cash-movements">${stat('Opening balance', money(opening))}${stat('Money in', '+' + money(incoming), 'bu-income')}${stat('Money out', '−' + money(incoming - net))}</dl></section><div class="bu-chart">${chart}</div></div>
    <header class="bu-filter-row"><h2>Transactions</h2><span class="bu-meta">${period.name} 2026 · ${entries.length} entries</span></header>
    <div class="bu-transactions">${entries.toReversed().map(item => {
      const isSelected = selected === item;
      const href = destination('finance', { period: period.key, transaction: isSelected ? '' : item.reference });
      const income = item.amount > 0;
      return `<div class="bu-transaction${isSelected ? ' bu-expanded' : ''}">${link(href, `<span class="bu-transfer ${income ? 'bu-income' : ''}" aria-hidden="true">${income ? '↙' : '↗'}</span><span class="bu-company"><strong>${esc(item.name)}</strong><small>${esc(item.category)}</small></span><time datetime="${item.day}">${dateLabel(item.day)}</time><b class="${income ? 'bu-income' : ''}">${income ? '+' : '−'}${money(Math.abs(item.amount))}</b><span class="bu-chevron" aria-hidden="true"></span>`, { className: 'bu-posting', id: 'posting-' + item.reference, expanded: isSelected })}
      ${isSelected ? `<dl aria-label="Transaction details" class="bu-posting-details">${stat('Reference', item.reference)}${stat('Posted', dateLabel(item.day))}${stat('Direction', income ? 'Incoming transfer' : 'Outgoing transfer')}${stat('Status', 'Settled')}</dl>` : ''}</div>`;
    }).join('')}</div>`;
}
export function renderBusinessLayout(screen, searchParams = new URLSearchParams()) {
  if (!['crm', 'finance'].includes(screen)) throw new RangeError('Unknown business layout');
  return `<div id="business-layout" class="bu-layout bu-${screen}" hx-target:inherited="#business-layout" hx-select:inherited="#business-layout" hx-swap:inherited="outerHTML show:none" hx-push-url:inherited="true" hx-sync:inherited="#business-layout:replace">${screen === 'crm' ? crm(searchParams) : finance(searchParams)}</div>`;
}
