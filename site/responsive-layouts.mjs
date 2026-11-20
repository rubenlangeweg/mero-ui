import { codePanel } from "./examples.mjs";
import { escapeHtml as esc } from "./html.mjs";
import { createStudioCompanies } from "./studio-companies.mjs";

export const responsiveLayoutsAssets = [
  "vendor/htmx.min.js", "studio-companies.css", "design-principles.css", "responsive-layouts.css", "responsive-layouts.js",
];

const path = "/docs/responsive-layouts";
const companies = createStudioCompanies().slice(0, 3);

function previewLink(company, width, anchor) {
  const params = new URLSearchParams();
  if (company) params.set("company", company);
  if (width) params.set("width", width);
  return esc(path + (params.size ? "?" + params : "") + "#" + anchor);
}

function companyMark(company, large = false) {
  const initials = company.name.split(" ").filter(word => word !== "&").map(word => word[0]).join("");
  return `<span aria-hidden="true" class="sc-mark${large ? " sc-mark-large" : ""}" data-client="${company.id}">${esc(initials)}</span>`;
}

function companyPanes(requested, width) {
  const record = requested || companies[0];
  return `<div class="sc-panes" id="guide-panes"${requested ? " data-open-record" : ""} hx-boost:inherited="true" hx-select:inherited="#guide-panes" hx-target:inherited="#guide-panes" hx-swap:inherited="outerHTML show:none" hx-sync:inherited="this:replace">
    <nav class="sc-directory" aria-labelledby="guide-directory">
      <div class="sc-directory-head"><h3 id="guide-directory">Company directory</h3></div>
      <div class="sc-accounts">${companies.map(company => `<a class="sc-account" id="guide-row-${company.id}" data-guide-record href="${previewLink(company.id, width, "guide-record-title")}"${record === company ? ' aria-current="true"' : ""}>${companyMark(company)}<span><strong>${esc(company.name)}</strong><small>${esc(company.city)}</small></span></a>`).join("")}</div>
    </nav>
    <article class="sc-record" aria-labelledby="guide-record-title">
      <a class="sc-back sc-text-link" id="guide-back" data-guide-record href="${previewLink("", width, "guide-row-" + record.id)}"><span aria-hidden="true">←</span> Company directory</a>
      <header class="sc-identity">${companyMark(record, true)}<div><h3 id="guide-record-title" tabindex="-1">${esc(record.name)}</h3><p>${esc(record.industry)} · ${esc(record.city)}</p></div></header>
      <dl class="guide-facts"><div><dt>Project</dt><dd>${esc(record.project)}</dd></div><div><dt>Account owner</dt><dd>${esc(record.owner)}</dd></div><div><dt>Team size</dt><dd>${record.employees} employees</dd></div></dl>
    </article>
  </div>`;
}

const paneTemplate = `<link rel="stylesheet" href="/mero.css">
<link rel="stylesheet" href="/studio-companies.css">

<section class="sc-companies" aria-label="Companies">
  <div class="sc-panes" id="companies">
    <nav class="sc-directory" aria-label="Company directory">
      <a class="sc-account" href="/companies/forma"
         hx-get="/companies/forma" hx-target="#companies"
         hx-swap="outerHTML" hx-push-url="true">Forma Works</a>
    </nav>
    <article class="sc-record" aria-label="Company record">
      <a class="sc-back sc-text-link" href="/companies">Company directory</a>
      <h2 tabindex="-1">Forma Works</h2>
      <p>Retail design · Copenhagen</p>
    </article>
  </div>
</section>`;

export function responsiveLayoutsPage(params = new URLSearchParams(), { panesOnly = false } = {}) {
  const selected = companies.find(company => company.id === params.get("company"));
  const requestedWidth = Number(params.get("width"));
  const width = Number.isInteger(requestedWidth) && requestedWidth >= 240 && requestedWidth <= 1024 ? requestedWidth : null;
  const panes = companyPanes(selected, width);
  if (panesOnly) return panes;
  return `<article class="design-guide responsive-guide" aria-labelledby="responsive-title">
    <header class="docs-heading"><h1 id="responsive-title">Responsive layouts</h1>
      <p>A company directory can fill a desktop page or sit inside a narrow panel. Give the layout the space it has and keep the selected record in the URL.</p>
    </header>
    <section aria-labelledby="list-detail">
      <h2 id="list-detail">One directory, two views</h2>
      <p>Open a company, then change the preview width. Below 33rem, the selected record gets the whole panel. At 33rem and up, the directory sits alongside it.</p>
      <div class="guide-bench" id="guide-preview" data-guide-width="${width ?? ""}">
        <div class="guide-controls" aria-label="Preview size" role="group">
          <div class="guide-measure"><label for="guide-width">Preview width</label>
            <output id="guide-measured" aria-live="off" for="guide-width" hidden></output>
            <input type="range" id="guide-width" min="240" max="1024" step="1" value="${width ?? 1024}" hidden></div>
          <div class="guide-presets">${[[360, "Narrow"], [null, "Full width"]].map(([size, label]) => `<a data-guide-preset="${size ?? ""}" href="${previewLink(selected?.id, size, "guide-preview")}"${size === width ? ' aria-current="true"' : ""}>${label}</a>`).join("")}</div>
        </div>
        <div class="guide-stage"><div class="sc-companies guide-host"${width ? ` style="--guide-width:${width}px"` : ""}>${panes}</div></div>
      </div>
      <p>Choosing a company puts focus on its name. In the narrow view, <strong>Company directory</strong> returns to its row. Browser Back opens the previous selection.</p>
      <details class="principle-code"><summary>Use this pane layout</summary>
        <p>Load the two stylesheets below. Give each company its own GET route. Render <code>data-open-record</code> on <code>.sc-panes</code> when the URL selects a company. For HTMX requests, return the updated <code>#companies</code> element and focus the record heading after the swap.</p>
        ${codePanel(paneTemplate, "Company directory HTML")}
      </details>
      <p><a class="mero-link" href="/layouts/dashboard?view=companies">Open the Studio company directory</a></p>
    </section>
    <section aria-labelledby="layout-patterns"><h2 id="layout-patterns">Choose a layout by its contents</h2>
      <dl class="principle-states">
        <div><dt>Fields</dt><dd>Use <code>mero-stack</code> for vertical spacing. Keep each field’s label, input and error together.</dd></div>
        <div><dt>Actions</dt><dd>Use <code>mero-row</code> for a wrapping row. Choose <a class="mero-link" href="/components/toolbar">Toolbar</a> when the first and last groups need to sit on opposite edges.</dd></div>
        <div><dt>Cards</dt><dd>Use <a class="mero-link" href="/components/item-card-group">Item Card Group</a> for equal columns. Each card gets at least 13rem where space allows. At smaller widths it fills the row.</dd></div>
      </dl>
    </section>
  </article>`;
}
