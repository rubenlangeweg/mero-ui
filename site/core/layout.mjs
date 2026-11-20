import { item, section } from "./helpers.mjs"

export const groups = [
  section("Layout", [
    item("card", "Card", "Group related content and an action into one compact surface.", `
      <article class="mero-card mero-stack">
        <strong>Starter workspace</strong>
        <p class="mero-description">A place to plan and ship the next release.</p>
        <a class="mero-button mero-button-secondary" href="/playground">Open playground</a>
      </article>`),
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
