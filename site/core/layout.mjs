import { item, section } from "./helpers.mjs"

export const groups = [
  section("Layout", [
    item("card", "Card", "Group related content and an action into one compact surface.", `
      <article class="mero-card mero-stack">
        <strong>Starter workspace</strong>
        <p class="mero-description">A place to plan and ship the next release.</p>
        <a class="mero-button mero-button-secondary" href="/playground">Open playground</a>
      </article>`,
      "Put a title and optional description in mero-card-header. Use a section with aria-labelledby on the title when the card is a page region.", [
      ["Header actions and table", `
      <section class="mero-card" aria-labelledby="card-releases-title">
        <header class="mero-card-header">
          <h2 class="mero-card-title" id="card-releases-title">Recent releases</h2>
          <div class="mero-card-actions">
            <a class="mero-button mero-button-ghost mero-button-sm" href="/components/sortable-table">View all</a>
            <button class="mero-button mero-button-outline mero-button-sm" type="button" data-mero-toast="Release draft created">New release</button>
          </div>
        </header>
        <div class="mero-card-flush">
          <div class="mero-table-wrap mero-table-cards">
            <table class="mero-table" role="table" aria-labelledby="card-releases-title">
              <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Version</th><th role="columnheader" scope="col">Environment</th><th role="columnheader" scope="col">Status</th></tr></thead>
              <tbody role="rowgroup">
              <tr role="row">
                <th role="rowheader" scope="row"><span data-mero-cell-label aria-hidden="true">Version</span><a class="mero-link" href="/components/sortable-table">v1.4.0</a></th>
                <td role="cell"><span data-mero-cell-label aria-hidden="true">Environment</span>Staging</td>
                <td role="cell"><span data-mero-cell-label aria-hidden="true">Status</span><span class="mero-badge mero-badge-warning">Review</span></td>
              </tr>
              <tr role="row">
                <th role="rowheader" scope="row"><span data-mero-cell-label aria-hidden="true">Version</span><a class="mero-link" href="/components/sortable-table">v1.3.0</a></th>
                <td role="cell"><span data-mero-cell-label aria-hidden="true">Environment</span>Production</td>
                <td role="cell"><span data-mero-cell-label aria-hidden="true">Status</span><span class="mero-badge mero-badge-success">Live</span></td>
              </tr>
              <tr role="row">
                <th role="rowheader" scope="row"><span data-mero-cell-label aria-hidden="true">Version</span><a class="mero-link" href="/components/sortable-table">v1.2.2</a></th>
                <td role="cell"><span data-mero-cell-label aria-hidden="true">Environment</span>Production</td>
                <td role="cell"><span data-mero-cell-label aria-hidden="true">Status</span><span class="mero-badge">Retired</span></td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>`, {
        description: "Give a card actions at the end of its header and let a table reach its edges.",
        notes: "Put actions in mero-card-actions as the header's last child; they stay at the inline end and wrap under the title on narrow cards. Wrap a table in mero-card-flush so its rows and borders run to the card's edges while the first and last cells keep the card's padding. Below 768 px, a mero-table-cards table inside the flush body returns to the card padding and shows labelled cards. If you change the card padding, set --mero-panel-padding instead so the flush body follows.",
      }],
    ]),
    item("page-header", "Page Header", "Open a page with its title, a short description and the page’s main actions.", `
      <header class="mero-page-head">
        <div>
          <h1>Environments</h1>
          <p>Every customer environment and the release it runs.</p>
        </div>
        <div class="mero-page-head-actions">
          <a class="mero-button mero-button-primary" href="/components/form">New environment</a>
        </div>
      </header>`,
      "Use one per page, with the page’s h1. The description is a p inside the heading block. Actions sit at the end of the first row and wrap under the heading below 768 px. The layouts module uses the same class for its app pages.",
      [["Record", `
      <header class="mero-page-head">
        <nav class="mero-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a href="/components">Environments</a></li>
            <li aria-current="page">acme-production</li>
          </ol>
        </nav>
        <div>
          <div class="mero-page-head-title">
            <h1>acme-production</h1>
            <span class="mero-badge mero-badge-success">Live</span>
          </div>
          <p>Acme Corporation · Europe West · Updated 4 minutes ago</p>
        </div>
        <div class="mero-page-head-actions">
          <button class="mero-button mero-button-outline" type="button" data-mero-toast="Suspend requested">Suspend</button>
          <a class="mero-button mero-button-primary" href="/components/typed-confirmation">Deploy release</a>
        </div>
      </header>`, {
        description: "Show where a record sits, its current status and what you can do with it.",
        notes: "Put Breadcrumbs first; they take the whole first row. Wrap the h1 and its status badge in mero-page-head-title so the badge follows the title and wraps with it. Keep the badge outside the h1 so the heading’s name stays the record’s name. The meta line is the p after the title row.",
      }]]),
    item("separator", "Separator", "Separate related content sections using a semantic rule.", `
      <div class="mero-stack">
        <strong>Account</strong>
        <hr class="mero-separator">
        <span class="mero-description">Managed by Studio North.</span>
      </div>`),
    item("surface", "Surface", "Give related content a tonal background with shared theme tokens.", `
      <div class="mero-surface mero-stack">
        <strong>Preview environment</strong>
        <span class="mero-description">Deployments here use staging credentials.</span>
      </div>`),
    item("toolbar", "Toolbar", "Keep nearby actions aligned and grouped by purpose.", `
      <div class="mero-toolbar" role="group" aria-label="Project actions">
        <strong>Projects</strong>
        <div class="mero-row">
          <button class="mero-button mero-button-sm mero-button-outline" type="button" data-mero-toast="Export requested">Export</button>
          <a class="mero-button mero-button-sm mero-button-primary" href="/playground">Open playground</a>
        </div>
      </div>`),
  ]),
]
