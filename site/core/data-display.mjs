import { escapeHtml } from "../html.mjs"
import { item, rendered, section } from "./helpers.mjs"

const products = [
  { id: 1, name: "Arc Task Lamp", sku: "RL-1001", category: "Lighting", status: "Active" },
  { id: 2, name: "Halo Pendant", sku: "RL-1002", category: "Lighting", status: "Draft" },
  { id: 3, name: "Oak Side Table", sku: "RL-2001", category: "Furniture", status: "Active" },
  { id: 4, name: "Woven Throw", sku: "RL-3001", category: "Textiles", status: "Archived" },
  { id: 5, name: "Stone Vase", sku: "RL-4001", category: "Objects", status: "Active" },
  { id: 6, name: "Linen Cushion", sku: "RL-3002", category: "Textiles", status: "Draft" },
  { id: 7, name: "Ash Lounge Chair", sku: "RL-2002", category: "Furniture", status: "Archived" },
  { id: 8, name: "Brass Candle Holder", sku: "RL-4002", category: "Objects", status: "Active" },
]
const columns = { name: "Product", category: "Category", status: "Status" }
const tones = { Active: " mero-badge-success", Draft: " mero-badge-warning", Archived: "" }
const cellLabel = label => `<span data-mero-cell-label aria-hidden="true">${label}</span>`
const filterFields = { status: ["Status", ["Active", "Draft", "Archived"]], category: ["Category", ["Furniture", "Lighting", "Objects", "Textiles"]] }

// shortcut: hx-select takes the first [data-mero-records] in the response, so one instance per page; give each instance its own selector to host several.
export function records(query, { filters = false, peek = false } = {}) {
  const params = new URLSearchParams(query)
  const applied = {}
  if (filters) for (const [field, [, values]] of Object.entries(filterFields)) {
    const value = params.get(field)
    if (values.includes(value)) applied[field] = value
    else params.delete(field) // unknown values are dropped so links never carry them on
  }
  const requested = params.get("sort") ?? ""
  const key = requested.replace(/^-/, "")
  const sort = Object.hasOwn(columns, key) ? requested : "name"
  const column = sort.replace(/^-/, ""), descending = sort[0] === "-"
  const link = changes => {
    const next = new URLSearchParams(params)
    next.delete("open")
    for (const [name, value] of Object.entries(changes)) value == null ? next.delete(name) : next.set(name, value)
    return escapeHtml("?" + next)
  }
  const rows = products.filter(row => Object.entries(applied).every(([field, value]) => row[field] === value)).toSorted((a, b) =>
    (descending ? -1 : 1) * a[column].localeCompare(b[column]) || a.name.localeCompare(b.name))
  const open = products.find(({ id }) => String(id) === params.get("open"))
  const body = open ? `
<article class="mero-card">
  <h2 class="mero-card-title">${escapeHtml(open.name)}</h2>
  <dl>
    <dt>SKU</dt><dd>${escapeHtml(open.sku)}</dd>
    <dt>Category</dt><dd>${escapeHtml(open.category)}</dd>
    <dt>Status</dt><dd>${escapeHtml(open.status)}</dd>
  </dl>
  <a href="${link({ open: null })}">Back to products</a>
</article>` : `
${filters ? filterBar(applied, link) : ""}${peek ? `<div data-mero-peek>
` : ""}<div class="mero-table-wrap mero-table-cards">
  <table class="mero-table mero-table-compact" role="table" aria-labelledby="records-count">
    <caption id="records-count">Studio products · ${rows.length} of ${products.length}<span class="mero-table-sort-label" aria-hidden="true">Sort by</span></caption>
    <thead role="rowgroup" hx-boost:inherited="true"><tr role="row">
${Object.entries(columns).map(([name, label]) => name === column
  ? `      <th role="columnheader" scope="col" aria-sort="${descending ? "descending" : "ascending"}"><a id="records-sort-${name}" href="${link({ sort: descending ? name : "-" + name })}">${label} <span aria-hidden="true">${descending ? "↓" : "↑"}</span></a></th>`
  : `      <th role="columnheader" scope="col"><a id="records-sort-${name}" href="${link({ sort: name })}">${label}</a></th>`).join("\n")}
      <th role="columnheader" scope="col">Actions</th>
    </tr></thead>
    <tbody role="rowgroup">
${rows.map(row => {
  const name = escapeHtml(row.name), href = link({ sort, open: row.id })
  return `      <tr role="row"${peek ? ` id="records-row-${row.id}"` : ""}>
        <th role="rowheader" scope="row">${cellLabel(columns.name)}<a class="mero-row-link" href="${href}">${name}</a>${peek ? peekBody(row) : ""}</th>
        <td role="cell">${cellLabel(columns.category)}${escapeHtml(row.category)}</td>
        <td role="cell">${cellLabel(columns.status)}<span class="mero-badge${tones[row.status]}">${escapeHtml(row.status)}</span></td>
        <td role="cell">${cellLabel("Actions")}
          <button class="mero-button mero-button-ghost mero-button-sm" id="records-${row.id}-actions" type="button" popovertarget="records-${row.id}-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${name}">Actions</button>
          <div class="mero-popover mero-menu" id="records-${row.id}-menu" popover role="menu" aria-label="${name} actions">
            <a class="mero-menu-item" role="menuitem" href="${href}">Open details</a>
            <a class="mero-menu-item" role="menuitem" href="/components/data-grid">Edit in inventory</a>
          </div>
        </td>
      </tr>`
}).join("\n") || `      <tr role="row"><td role="cell" colspan="4">No products match these filters.</td></tr>`}
    </tbody>
  </table>
</div>${peek ? `
</div>` : ""}`
  return `<section class="mero-records" data-mero-records data-mero-restore-focus hx-target:inherited="this" hx-select:inherited="[data-mero-records]" hx-swap:inherited="outerHTML show:none" hx-sync:inherited="this:replace">${body}
</section>`
}

// Server-rendered preview for row peek. Inert until mero.js copies it into the panel.
const peekBody = row => `<template data-mero-peek-body><dl>
          <dt>SKU</dt><dd>${escapeHtml(row.sku)}</dd>
          <dt>Category</dt><dd>${escapeHtml(row.category)}</dd>
          <dt>Status</dt><dd><span class="mero-badge${tones[row.status]}">${escapeHtml(row.status)}</span></dd>
        </dl></template>`

function filterBar(applied, link) {
  const label = field => filterFields[field][0]
  const chips = Object.entries(applied).map(([field, value]) => `
    <li class="mero-chip mero-chip-accent">${label(field)} is ${value} <a href="${link({ [field]: null })}" aria-label="Remove filter: ${label(field)} is ${value}"><span class="mero-dismiss-mark" aria-hidden="true"></span></a></li>`).join("")
  const items = Object.entries(filterFields).flatMap(([field, [name, values]]) => values.filter(value => applied[field] !== value).map(value => `
    <a class="mero-menu-item" role="menuitem" href="${link({ [field]: value })}">${name} is ${value}</a>`)).join("")
  return `<div class="mero-filter-bar" hx-boost:inherited="true">${chips ? `
  <ul class="mero-filter-chips mero-row" aria-label="Applied filters">${chips}
  </ul>` : ""}
  <button class="mero-button mero-button-outline mero-button-sm" type="button" id="records-filter-add" popovertarget="records-filter-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Add filter" aria-describedby="records-count" data-mero-focus-fallback><span aria-hidden="true">+</span> Filter</button>
  <div class="mero-popover mero-menu" id="records-filter-menu" popover role="menu" aria-label="Add filter">${items}
  </div>${chips ? `
  <a class="mero-link" href="${link(Object.fromEntries(Object.keys(filterFields).map(field => [field, null])))}">Clear all filters</a>` : ""}
</div>
`
}

export const groups = [
  section("Data display", [
    item("badge", "Badge", "Label a status using text and a semantic tone.", `
      <div class="mero-row">
        <span class="mero-badge mero-badge-success">Published</span>
        <span class="mero-badge mero-badge-warning">In review</span>
        <span class="mero-badge mero-badge-accent">Draft</span>
      </div>`),
    item("chip", "Chip", "Display a lightweight label for an attribute or filter value.", `
      <span class="mero-chip">Europe West</span>`),
    item("table", "Table", "Show comparable records in a native table with column headers.", `
      <div class="mero-table-wrap">
        <table class="mero-table">
          <caption>Workspace releases</caption>
          <thead><tr><th scope="col">Version</th><th scope="col">Environment</th><th scope="col">Status</th></tr></thead>
          <tbody>
            <tr><td>v1.3.0</td><td>Production</td><td><span class="mero-badge mero-badge-success">Live</span></td></tr>
            <tr><td>v1.4.0</td><td>Staging</td><td><span class="mero-badge mero-badge-warning">Review</span></td></tr>
          </tbody>
        </table>
      </div>`),
    rendered("sortable-table", "Sortable Table", "Sort server-rendered rows from the column headers and open a row from anywhere in it.", params => records(params),
      "Each header links to ?sort=column. A leading minus sorts descending. The server marks the current column with aria-sort. Below 768 px, mero-table-cards shows each row as a card and keeps the sort links above it. Use mero-table-cards-wide for a 1024 px breakpoint. Render each data-mero-cell-label from its column heading and give it aria-hidden=true. Keep the table roles in the copied markup so screen readers retain row and column navigation. The row link opens the record and Back returns focus to it. Actions opens the row menu. Remove mero-table-compact for regular density.",
      [["Row peek", rendered("sortable-table", "Sortable Table", "Preview a row beside the table without leaving it.", params => records(params, { peek: true }),
        "Add data-mero-peek around the table wrapper and put the row's preview in a template data-mero-peek-body inside the row. Give each row a stable id so the preview stays on it when a sort or filter swap changes the row links. With a row link focused, Space opens the preview and Space again or Escape closes it and returns focus to the row. While it is open, Up and Down Arrow move between rows and the preview follows focus, including when Tab reaches another row. The panel is an aside named Preview with polite live updates, a heading from the row link, a Close button and an Open link to the row's page. Focus is never trapped. Below 768 px the preview is a bottom sheet over the cards. Without scripts Space keeps its native behaviour and the template stays hidden.")]]),
    rendered("filter-chips", "Filter Chips", "Add filters from a menu, see them as chips and remove them one at a time. The URL keeps the state.", params => records(params, { filters: true }),
      "Choose + Filter to add one. Each chip and Clear all are ordinary links to the URL without that filter. The server reads status and category from the query string, so the view survives reload, sharing and Back. The menu uses the Menu Button keyboard pattern. Below 768 px, the same filters apply to the labelled cards."),
  ]),
]
