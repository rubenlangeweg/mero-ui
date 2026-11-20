import { item, section } from "./helpers.mjs"

function disclosure(title, body, { open = false } = {}) {
  return `
    <details class="mero-disclosure"${open ? " open" : ""}>
      <summary>${title}</summary>
      <div class="mero-disclosure-body">${body}</div>
    </details>`
}

function tabPanels(id, label, items, vertical = false) {
  const tab = ([key, title], index) => `<button class="mero-tab" type="button" role="tab" id="${id}-tab-${key}"
          aria-selected="${index === 0}" aria-controls="${id}-panel-${key}"${index ? ' tabindex="-1"' : ""}>${title}</button>`
  const panel = ([key, , text], index) => `<div role="tabpanel" id="${id}-panel-${key}" aria-labelledby="${id}-tab-${key}" tabindex="0"${index ? " hidden" : ""}>${text}</div>`
  return `
    <div class="mero-tabs${vertical ? " mero-tabs-vertical" : ""}" data-mero-tabs>
      <div class="mero-tabs-list" role="tablist" aria-label="${label}"${vertical ? ' aria-orientation="vertical"' : ""}>
        ${items.map(tab).join("\n        ")}
      </div>
      ${items.map(panel).join("\n      ")}
    </div>`
}

export function pageLinks(page = 1) {
  const entries = ["Design references", "Engineering notes", "Release checklists"]
  return `
    <p class="mero-description" role="status">${entries[page - 1]}</p>
    <nav class="mero-pagination" aria-label="Results pages">
      ${entries.map((_, index) => {
        const number = index + 1
        return `<button class="mero-button mero-button-sm ${number === page ? "mero-button-primary" : "mero-button-outline"}" id="demo-pagination-page-${number}" type="button"
          hx-get="/demo/catalog/pagination?page=${number}" hx-target="closest [data-mero-pagination]" hx-swap="innerHTML"
          ${number === page ? 'aria-current="page"' : ""}>${number}</button>`
      }).join("\n      ")}
    </nav>`
}

export const groups = [
  section("Navigation", [
    item("accordion", "Accordion", "Disclose one section at a time using grouped native details.", `
      <div class="mero-stack" data-mero-accordion>
        ${disclosure("Can I use Mero with Django?", "Yes. Serve the stylesheet and runtime and render the examples in your templates.", { open: true }).trim()}
        ${disclosure("Can it run without a build step?", "Yes. Load the static files directly or bundle them as part of your application.").trim()}
      </div>`),
    item("breadcrumbs", "Breadcrumbs", "Show the user’s current location and its parent pages.", `
      <nav class="mero-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Mero UI</a></li>
          <li><a href="/components">Components</a></li>
          <li aria-current="page">Breadcrumbs</li>
        </ol>
      </nav>`),
    item("disclosure", "Disclosure", "Reveal a single block of supplementary information.",
      disclosure("Deployment metadata", "Region: eu-west. Build: 4721.")),
    item("disclosure-group", "Disclosure Group", "Present a collection of independently expandable sections.", `
      <div class="mero-stack">
        ${disclosure("Build details", "Completed in 32 seconds.", { open: true }).trim()}
        ${disclosure("Review details", "Review requested from the design team.").trim()}
      </div>`),
    item("link", "Link", "Navigate to a real URL with native link semantics.", '<a class="mero-link" href="/start">Read the quickstart</a>'),
    item("pagination", "Pagination", "Navigate between result pages with server-rendered fragments.", `
      <div id="catalog-pagination" data-mero-pagination class="mero-stack">
        ${pageLinks().trim()}
      </div>`,
      "The server returns the next result and its updated paginator together."),
    item("tabs", "Tabs", "Switch between labeled panels with mouse or arrow keys.", tabPanels("demo", "Workspace settings", [
      ["overview", "Overview", "The workspace is ready for changes."],
      ["access", "Access", "Only invited collaborators have access."],
      ["history", "History", "Last deployment completed successfully."],
    ]), "Use arrow keys to change tabs. Home and End select the first and last tabs.", [
      ["Vertical settings", tabPanels("settings", "Account settings", [
        ["profile", "Profile", "Update your display name and contact details."],
        ["security", "Security", "Manage sign-in methods and active sessions."],
        ["mail", "Notifications", "Choose which updates reach your inbox."],
      ], true)],
    ]),
  ]),
]
