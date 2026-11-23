import { item, section } from "./helpers.mjs"

export const groups = [
  section("Layout", [
    item("card", "Card", "Group related content and an action into one compact surface.", `
      <article class="mero-card mero-stack">
        <strong>Starter workspace</strong>
        <p class="mero-description">A place to plan and ship the next release.</p>
        <a class="mero-button mero-button-secondary" href="/playground">Open playground</a>
      </article>`),
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
