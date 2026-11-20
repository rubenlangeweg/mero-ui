// Server-rendered catalog examples. Each demo is its own copyable example.
import { escapeHtml } from "./html.mjs"

const workspaceNames = ["Atlas", "Beacon", "Cobalt", "Drift", "Iris", "Lumen", "Studio North"]

function exampleMarkup(markup) {
  const lines = markup.trimEnd().replace(/^\n/, "").split("\n")
  const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^ */)[0].length))
  const demo = lines.map(line => line.slice(indent)).join("\n")
  if (/\bid="/.test(demo) && !demo.includes("data-mero-tabs")) {
    return '<div class="mero-scope" data-mero-scope>\n' + demo.replace(/^/gm, "  ") + '\n</div>'
  }
  return demo
}

function item(id, name, description, markup, notes, variants = []) {
  const demo = exampleMarkup(markup)
  return { id, name, description, demo, code: demo, notes,
    variants: variants.map(([name, markup, guidance]) => {
      const demo = exampleMarkup(markup)
      return { name, demo, code: demo, ...guidance }
    }) }
}

function section(name, items) {
  return { name, items }
}

function field(id, label, attributes, { type = "text", hint, className = "" } = {}) {
  return `
    <div class="mero-field">
      <label class="mero-label" for="${id}">${label}</label>
      <input class="mero-input${className ? ` ${className}` : ""}" id="${id}" type="${type}"${hint ? ` aria-describedby="${id}-hint"` : ""}${attributes ? ` ${attributes}` : ""}>
      ${hint ? `<p class="mero-description" id="${id}-hint">${hint}</p>` : ""}
    </div>`
}

function rangeFields(id, label) {
  return `
    <fieldset class="mero-fieldset mero-date-range">
      <legend class="mero-label">${label}</legend>
      <div class="mero-date-range-fields">
        ${field(`${id}-start`, "Start date", 'name="start"', { type: "date" }).trim()}
        ${field(`${id}-end`, "End date", 'name="end"', { type: "date" }).trim()}
      </div>
    </fieldset>`
}

function extractOptions(values, prefix) {
  return values.map((value) =>
    `<li class="mero-option" id="${prefix}-${value.toLowerCase().replaceAll(" ", "-")}" role="option" aria-selected="false">${value}</li>`
  ).join("\n        ")
}

function combo(id, { remote = false, label = "Workspace", names = workspaceNames } = {}) {
  return `
    <div class="mero-field">
      <label class="mero-label" for="${id}">${label}</label>
      <div class="mero-combo" data-mero-combo${remote ? " data-mero-combo-remote" : ""}>
        <input class="mero-input" id="${id}" name="q" type="text" role="combobox"
          aria-expanded="false" aria-controls="${id}-options" aria-autocomplete="list"
          autocomplete="off" placeholder="Find a workspace…"${remote ? `
          hx-get="/demo/catalog/autocomplete" hx-trigger="input changed delay:180ms, mero:query"
          hx-target="next [role=listbox]" hx-swap="innerHTML" hx-sync="this:replace"` : ""}>
        <ul class="mero-listbox mero-combo-list" id="${id}-options" role="listbox" aria-label="Workspaces" hidden>
          ${extractOptions(remote ? names : names.slice(0, 4), id)}${remote ? "" : '\n          <li class="mero-option" role="option" aria-disabled="true" data-mero-empty-option hidden>No matches</li>'}
        </ul>
        <span class="mero-description" data-mero-combo-status role="status"></span>
      </div>
    </div>`
}

function overlay(id, name, intro, options = {}) {
  const { variant = "", trigger = name, action, role = "" } = options
  const isDanger = role === "alertdialog"
  return `
    <button class="mero-button ${isDanger ? "mero-button-danger" : "mero-button-primary"}" type="button" data-mero-open="${id}">${trigger}</button>
    <dialog class="mero-dialog${variant ? ` mero-${variant}` : ""}" id="${id}"${role ? ` role="${role}"` : ""} aria-labelledby="${id}-title" aria-describedby="${id}-description">
      <div class="mero-dialog-body">
        <h2 class="mero-dialog-title" id="${id}-title">${name}</h2>
        <p class="mero-description" id="${id}-description">${intro}</p>
        <div class="mero-dialog-footer">
          <button class="mero-button mero-button-secondary" type="button" data-mero-close autofocus>${action ? "Cancel" : "Done"}</button>
          ${action ? `<button class="mero-button ${isDanger ? "mero-button-danger" : "mero-button-primary"}" type="button" data-mero-close>${action}</button>` : ""}
        </div>
      </div>
    </dialog>`
}

function disclosure(title, body, { open = false } = {}) {
  return `
    <details class="mero-disclosure"${open ? " open" : ""}>
      <summary>${title}</summary>
      <div class="mero-disclosure-body">${body}</div>
    </details>`
}

function avatar(initials, label, color) {
  return `<span class="mero-avatar" role="img" aria-label="${label}"${color ? ` style="background:${color};color:#201630"` : ""}>${initials}</span>`
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

function pageLinks(page = 1) {
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

const longDate = new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" })
const longMonth = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function calendarMonth(value) {
  const [year, month] = value.split("-").map(Number)
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && year >= 1900 && year <= 2199
    ? new Date(Date.UTC(year, month - 1, 1))
    : new Date()
}

function calendarMarkup(params = new URLSearchParams()) {
  const today = new Date().toISOString().slice(0, 10)
  const month = calendarMonth(params.get("month") ?? "")
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const leading = (first.getUTCDay() + 6) % 7
  const rows = Math.ceil((leading + count) / 7)
  const current = first.toISOString().slice(0, 7)
  const selected = params.get("selected") ?? ""
  const validSelection = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(selected)
    && Number.isFinite(Date.parse(selected))
    && new Date(selected).toISOString().startsWith(selected)
  const selection = validSelection ? selected : ""
  const monthLabel = longMonth.format(first)
  const action = (target, date = selection) =>
    `hx-get="/demo/catalog/calendar?month=${target}${date ? `&amp;selected=${date}` : ""}" hx-target="closest .mero-calendar" hx-swap="outerHTML"`

  function changeMonth(label, delta) {
    const target = new Date(Date.UTC(year, monthIndex + delta, 1)).toISOString().slice(0, 7)
    const disabled = target < "1900-01" || target > "2199-12"
    return `<button class="mero-button mero-button-sm mero-button-ghost mero-button-icon" type="button" id="calendar-${delta < 0 ? "prev" : "next"}"
      aria-label="${label} month" ${disabled ? "disabled" : action(target)}>${delta < 0 ? "‹" : "›"}</button>`
  }

  const weeks = Array.from({length: rows}, (_, row) => {
    const days = weekdays.map((_, column) => {
      const day = row * 7 + column - leading + 1
      if (day < 1 || day > count) return "<td></td>"
      const date = `${current}-${String(day).padStart(2, "0")}`
      const pressed = date === selection
      return `<td><button class="mero-button mero-button-sm mero-calendar-day mero-button-${pressed ? "primary" : "ghost"}" type="button"
        id="calendar-day-${day}" aria-label="${longDate.format(new Date(date))}" aria-pressed="${pressed}"${date === today ? ' aria-current="date"' : ""}
        ${action(current, date)}>${day}</button></td>`
    })
    return `<tr>${days.join("")}</tr>`
  })
  return `
    <div id="demo-calendar" class="mero-calendar">
      <div class="mero-toolbar">
        ${changeMonth("Previous", -1)}
        <strong id="demo-calendar-month">${monthLabel}</strong>
        ${changeMonth("Next", 1)}
      </div>
      <table class="mero-calendar-table" aria-labelledby="demo-calendar-month">
        <thead><tr>${weekdays.map(day => `<th scope="col">${day}</th>`).join("")}</tr></thead>
        <tbody>${weeks.join("\n          ")}</tbody>
      </table>
      <p class="mero-description" role="status">${selection ? `Selected ${longDate.format(new Date(selection))}` : "Choose a day."}</p>
    </div>`
}

export function catalogFragment(id, params) {
  if (id === "autocomplete") {
    const query = (params.get("q") ?? "").trim().toLowerCase()
    return extractOptions(workspaceNames.filter((name) => name.toLowerCase().includes(query)), "demo-autocomplete")
      || '<li class="mero-option" role="option" aria-disabled="true" id="demo-autocomplete-empty">No workspaces found</li>'
  }
  if (id === "form") {
    const name = (params.get("name") ?? "").trim().slice(0, 80)
    return name
      ? `<p class="mero-alert mero-alert-success">Welcome, ${escapeHtml(name)}. Your form reached the server.</p>`
      : '<p class="mero-alert mero-alert-danger">Enter your name and try again.</p>'
  }
  if (id === "calendar") return calendarMarkup(params)
  if (id === "pagination") {
    const value = Number(params.get("page"))
    const page = Number.isInteger(value) && value >= 1 && value <= 3 ? value : 1
    return pageLinks(page)
  }
  return null
}

export const groups = [
  section("Buttons", [
    item("button", "Button", "Trigger an action with a consistent hierarchy of visual emphasis.", `
      <div class="mero-row">
        <button class="mero-button mero-button-primary" type="button" data-mero-toast="Draft saved" data-mero-tone="success">Save draft</button>
        <button class="mero-button mero-button-secondary" type="button" data-mero-toast="Draft kept">Cancel</button>
        <button class="mero-button mero-button-ghost" type="button" disabled>Unavailable</button>
      </div>`, undefined, [
        ["Compact actions", `<div class="mero-button-group" role="group" aria-label="Draft actions">
          <button class="mero-button mero-button-sm mero-button-secondary" type="button" data-mero-toast="Draft saved">Save draft</button>
          <button class="mero-button mero-button-sm mero-button-outline" type="button" data-mero-toast="Draft copied">Copy</button>
        </div>`],
        ["Pending request", `
          <form class="mero-stack" method="get" action="/demo/stock-summary" data-mero-form
                hx-get="/demo/stock-summary" hx-target="find output">
            <div class="mero-row">
              <button class="mero-button mero-button-primary" type="submit">
                <span class="mero-button-label">Check inventory</span>
                <span class="mero-indicator mero-spinner" aria-hidden="true"></span>
              </button>
              <output class="mero-description mero-form-status" aria-live="polite"></output>
            </div>
            <p class="mero-field-error" data-mero-form-error role="alert" hidden></p>
          </form>`, {
          description: "Check current stock. While the request runs, the button shows a spinner and blocks a second submission.",
          notes: "The server returns an HTML fragment for the live output. After a failed request the form shows an inline error and enables the button for a retry.",
        }],
      ]),
    item("button-group", "Button Group", "Keep related actions together while preserving each button’s own label and focus.", `
      <div class="mero-button-group" role="group" aria-label="Document actions">
        <button class="mero-button mero-button-outline" type="button" data-mero-toast="Document copied">Copy</button>
        <button class="mero-button mero-button-outline" type="button" data-mero-toast="Export requested">Export</button>
        <button class="mero-button mero-button-outline" type="button" data-mero-toast="Link ready">Share</button>
      </div>`),
    item("close-button", "Close Button", "Give a dialog an icon-only close action with an accessible name.", `
      <button class="mero-button mero-button-primary" type="button" data-mero-open="demo-close">Open dialog</button>
      <dialog class="mero-dialog" id="demo-close" aria-labelledby="demo-close-title">
        <div class="mero-dialog-body">
          <div class="mero-dialog-header">
            <h2 class="mero-dialog-title" id="demo-close-title">Release details</h2>
            <button class="mero-button mero-close-button" type="button" aria-label="Close release details" data-mero-close><span class="mero-dismiss-mark" aria-hidden="true"></span></button>
          </div>
          <p class="mero-description">The preview has been updated to the latest build.</p>
        </div>
      </dialog>`),
    item("toggle-button", "Toggle Button", "Represent a persistent on or off state with a pressed button.", `
      <button class="mero-button mero-button-outline" type="button" aria-pressed="false" data-mero-toggle>Pin item</button>`,
      "Keep the visible label stable so assistive technology can announce the pressed state."),
    item("toggle-button-group", "Toggle Button Group", "Select one presentation mode from a connected set of controls.", `
      <fieldset class="mero-toggle-fieldset" data-mero-radio-group>
        <legend class="mero-label">View as</legend>
        <div class="mero-toggle-button-group">
          <label><input type="radio" name="demo-view" value="list" checked>List</label>
          <label><input type="radio" name="demo-view" value="grid">Grid</label>
          <label><input type="radio" name="demo-view" value="compact">Compact</label>
        </div>
      </fieldset>`,
      "Native radio controls provide one selection per group and arrow-key navigation."),
  ]),
  section("Forms", [
    item("checkbox", "Checkbox", "Include an independent binary choice in a form.", `
      <label class="mero-row">
        <input class="mero-checkbox" type="checkbox" name="newsletter" value="yes" checked>
        Send release notes
      </label>`),
    item("checkbox-group", "Checkbox Group", "Group related independent choices with a fieldset and legend.", `
      <fieldset class="mero-fieldset">
        <legend class="mero-label">Notifications</legend>
        <div class="mero-checkbox-group">
          <label><input class="mero-checkbox" type="checkbox" name="notify" value="build" checked> Build status</label>
          <label><input class="mero-checkbox" type="checkbox" name="notify" value="review"> Review requests</label>
          <label><input class="mero-checkbox" type="checkbox" name="notify" value="access"> Access changes</label>
        </div>
      </fieldset>`),
    item("description", "Description", "Connect persistent help text to a control.", field("demo-description", "Workspace slug", 'value="studio-north"', { hint: "Use lowercase letters and hyphens." })),
    item("error-message", "Error Message", "Present a form-level failure where the user can act on it.", `
      <div class="mero-alert mero-alert-danger" role="alert">
        <strong>Changes could not be saved</strong>
        <p>Reconnect to the workspace and try again.</p>
      </div>`),
    item("field-error", "Field Error", "Associate a validation error with the field that needs attention.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-field-error">Workspace slug</label>
        <input class="mero-input" id="demo-field-error" name="slug" value="studio" aria-invalid="true" aria-describedby="demo-field-error-message">
        <p class="mero-field-error" id="demo-field-error-message">This slug is already in use.</p>
      </div>`,
      "Render the invalid state only when the value has failed validation."),
    item("fieldset", "Fieldset", "Add a shared label to a related set of form controls.", `
      <fieldset class="mero-fieldset">
        <legend class="mero-label">Contact details</legend>
        <div class="mero-stack">
          ${field("demo-fieldset-name", "Name", 'autocomplete="name"').trim()}
          ${field("demo-fieldset-email", "Email address", 'autocomplete="email"', { type: "email" }).trim()}
        </div>
      </fieldset>`),
    item("form", "Form", "Submit native fields to the server and render an HTML response in place.", `
      <form class="mero-stack" action="/demo/catalog/form" method="get"
        hx-get="/demo/catalog/form" hx-target="#catalog-form-result" hx-swap="innerHTML">
        <div class="mero-field">
          <label class="mero-label" for="demo-form-name">Name</label>
          <input class="mero-input" id="demo-form-name" name="name" autocomplete="given-name" required maxlength="80" placeholder="Taylor">
        </div>
        <button class="mero-button mero-button-primary" type="submit">Send to server</button>
        <div class="mero-form-status" id="catalog-form-result" role="status"></div>
      </form>`,
      "This demo uses a read-only GET. Use POST for changes and keep validation on the server."),
    item("input", "Input", "A styled native input with browser validation and autocomplete.", field("demo-input", "Email address", 'name="email" autocomplete="email" placeholder="you@example.com"', { type: "email" })),
    item("input-group", "Input Group", "Combine a control and contextual prefix with a single outline.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-input-group">Project URL</label>
        <div class="mero-input-group">
          <span class="mero-input-prefix" id="demo-project-prefix">mero.example/</span>
          <input class="mero-input" id="demo-input-group" aria-describedby="demo-project-prefix" name="project" placeholder="my-project">
        </div>
      </div>`),
    item("input-otp", "Input OTP", "Collect a six-digit code in one input with mobile autofill.", field("demo-otp", "Verification code", 'name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000"', { hint: "Enter the six digits from your authenticator.", className: "mero-input-otp" }),
      "A single field supports paste and full-code autofill."),
    item("label", "Label", "Name an input and expand its activation area.", field("demo-label", "Display name", 'name="displayName" placeholder="Your name"')),
    item("number-field", "Number Field", "Set numeric bounds and increments for a native field.", field("demo-number", "Seats", 'name="seats" min="1" max="50" step="1" value="5"', { type: "number" })),
    item("radio-group", "Radio Group", "Choose exactly one option from a labeled set.", `
      <fieldset class="mero-fieldset" data-mero-radio-group>
        <legend class="mero-label">Visibility</legend>
        <div class="mero-radio-group">
          <label><input class="mero-radio" type="radio" name="demo-visibility" value="private" checked> Private</label>
          <label><input class="mero-radio" type="radio" name="demo-visibility" value="team"> Team</label>
          <label><input class="mero-radio" type="radio" name="demo-visibility" value="public"> Public</label>
        </div>
      </fieldset>`),
    item("search-field", "Search Field", "Use a native search field with the platform’s clear affordance.", field("demo-search", "Find a component", 'name="q" placeholder="Buttons, drawers, tabs…"', { type: "search" })),
    item("text-area", "Text Area", "Let users edit multiple lines of text with an optional autosizing surface.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-textarea">Release summary</label>
        <textarea class="mero-textarea mero-textarea-autosize" id="demo-textarea" name="summary" rows="3" placeholder="What changed?"></textarea>
      </div>`),
    item("text-field", "Text Field", "Compose a label, input, and hint into a reusable form field.", field("demo-text-field", "Repository name", 'name="repository" required maxlength="64" placeholder="mero-ui"', { hint: "This name is visible in the workspace." })),
  ]),
  section("Date and time", [
    item("calendar", "Calendar", "Navigate months and choose a day on an inline calendar rendered by the server.", calendarMarkup(),
      "HTMX sends the displayed month and selected date. The server returns the same calendar markup with the updated state."),
    item("date-field", "Date Field", "Enter a calendar date in the system’s preferred format.", field("demo-date-field", "Due date", 'name="due"', { type: "date" })),
    item("date-picker", "Date Picker", "Choose a date with the browser’s calendar picker and native constraints.", field("demo-date-picker", "Start date", 'name="start" min="2026-01-01" max="2027-12-31"', { type: "date", hint: "Select a date in 2026 or 2027." }),
      "Use min and max for native bounds. Apply the same rules on the server."),
    item("date-range-picker", "Date Range Picker", "Collect the start and end dates of a range.", rangeFields("demo-date-range", "Reporting period"),
      "This composition submits two native dates. Validate that the end date is on or after the start date."),
    item("range-calendar", "Range Calendar", "Build a range with two native calendar controls.", rangeFields("demo-range-calendar", "Release window"),
      "This example uses two independent picker surfaces."),
    item("time-field", "Time Field", "Choose a wall-clock time without a timezone conversion.", field("demo-time", "Publish time", 'name="time" step="60" value="09:30"', { type: "time" }),
      "Store the intended timezone separately when scheduling an event."),
  ]),
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
    item("disclosure", "Disclosure", "Reveal a single block of supplementary information.", disclosure("Deployment metadata", "Region: eu-west. Build: 4721.")),
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
  section("Overlays", [
    item("alert-dialog", "Alert Dialog", "Ask for confirmation on a decision that calls for attention.", overlay("demo-alert-dialog", "Archive project?", "This removes the project from active views.", { trigger: "Archive project", action: "Archive", role: "alertdialog" }),
      "Focus starts on Cancel. Connect the confirmation to a form action in your application."),
    item("drawer", "Drawer", "Open a full-height edge panel for work that benefits from more room.", overlay("demo-drawer", "Review deployment", "The staging build is ready to review.", { variant: "drawer", trigger: "Open drawer" })),
    item("modal", "Modal", "Open a centered, named dialog with native focus containment.", overlay("demo-modal", "Workspace details", "Only workspace managers can change access.")),
    item("popover", "Popover", "Display contextual information using the browser’s top layer.", `
      <button class="mero-button mero-button-outline" type="button" popovertarget="demo-popover">Deployment info</button>
      <div class="mero-popover" id="demo-popover" popover>
        <strong>Staging</strong>
        <p class="mero-description">Last published 12 minutes ago.</p>
      </div>`,
      "This example uses native popover dismissal. The browser owns its default positioning."),
    item("sheet", "Sheet", "Present concise secondary content from the bottom edge.", overlay("demo-sheet", "Choose a workspace", "Your current workspace is Studio North.", { variant: "sheet", trigger: "Open sheet" })),
    item("toast", "Toast", "Announce a completed action without interrupting the current task.", `
      <button class="mero-button mero-button-secondary" type="button" data-mero-toast="Changes saved" data-mero-tone="success">Show confirmation</button>`),
    item("tooltip", "Tooltip", "Show a brief hint on pointer hover or keyboard focus.", `
      <span class="mero-tooltip">
        <button class="mero-button mero-button-outline mero-button-icon" type="button" aria-label="Publish information" aria-describedby="demo-tooltip">?</button>
        <span class="mero-tooltip-content" id="demo-tooltip" role="tooltip">Publishing updates the current workspace.</span>
      </span>`),
  ]),
  section("Collections", [
    item("dropdown", "Dropdown", "Open a compact list of actions or destinations.", `
      <button class="mero-button mero-button-secondary" type="button" popovertarget="demo-dropdown">Open menu</button>
      <div class="mero-popover mero-menu" id="demo-dropdown" popover>
        <a class="mero-menu-item" href="/components">Browse components</a>
        <a class="mero-menu-item" href="/playground">Run the playground</a>
        <a class="mero-menu-item" href="/start">Read the quickstart</a>
      </div>`,
      "These destinations are ordinary links. Tab moves through the popup and Escape closes it."),
    item("list-box", "List Box", "Present a selectable collection with arrow-key navigation.", `
      <ul class="mero-listbox" role="listbox" aria-label="Workspace" data-mero-listbox>
        <li class="mero-option" id="listbox-atlas" role="option" aria-selected="true" tabindex="0">Atlas</li>
        <li class="mero-option" id="listbox-beacon" role="option" aria-selected="false" tabindex="-1">Beacon</li>
        <li class="mero-option" id="listbox-cobalt" role="option" aria-selected="false" tabindex="-1">Cobalt</li>
      </ul>`,
      "Selection state is written to aria-selected. Use a native select if the form needs a submitted value."),
    item("tag-group", "Tag Group", "Display a small, labeled collection of metadata tags.", `
      <ul class="mero-tag-group mero-row" aria-label="Topics">
        <li class="mero-chip">Accessibility</li>
        <li class="mero-chip">Forms</li>
        <li class="mero-chip">Motion</li>
      </ul>`),
  ]),
  section("Controls", [
    item("slider", "Slider", "Choose a value from a bounded range.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-slider">Animation speed</label>
        <input class="mero-slider" id="demo-slider" name="speed" type="range" min="50" max="150" step="10" value="100">
      </div>`),
    item("switch", "Switch", "Toggle one setting with a checkbox-backed switch.", `
      <label class="mero-row">
        <input class="mero-switch" type="checkbox" role="switch" name="preview" value="on" checked>
        Enable preview
      </label>`, "Native form submission includes this setting when selected.", [
        ["Notification preference", `<label class="mero-setting-switch">
          <span><strong id="stock-alerts-label">Stock alerts</strong><small id="stock-alerts-hint">Notify me when an item falls below five units.</small></span>
          <input class="mero-switch" type="checkbox" role="switch" name="stock-alerts"
                 aria-labelledby="stock-alerts-label" aria-describedby="stock-alerts-hint" checked>
        </label>`],
        ["Managed preference", `<label class="mero-setting-switch">
          <span><strong id="sign-in-alerts-label">Sign-in alerts</strong><small id="sign-in-alerts-hint">Required by your workspace administrator.</small></span>
          <input class="mero-switch" type="checkbox" role="switch" name="sign-in-alerts"
                 aria-labelledby="sign-in-alerts-label" aria-describedby="sign-in-alerts-hint" checked disabled>
        </label>`, {
          description: "Show a workspace policy with its saved value and the reason it is locked.",
          notes: "Disabled inputs are omitted from form submissions. Apply the workspace policy on the server.",
        }],
      ]),
  ]),
  section("Feedback", [
    item("alert", "Alert", "Place status or guidance alongside the content it describes.", `
      <div class="mero-alert mero-alert-warning">
        <strong>Preview expires soon</strong>
        <p>Publish the draft before Friday to retain this URL.</p>
      </div>`),
    item("meter", "Meter", "Show a measurement between known bounds.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-meter">Storage used</label>
        <meter class="mero-meter" id="demo-meter" min="0" max="100" value="64" high="80">64%</meter>
        <p class="mero-description">64 GB of 100 GB</p>
      </div>`),
    item("progress-bar", "Progress Bar", "Report measurable progress toward completion.", `
      <div class="mero-field">
        <div class="mero-measure-label"><label class="mero-label" for="demo-progress">Uploading assets</label><span class="mero-description" aria-hidden="true">68%</span></div>
        <progress class="mero-progress" id="demo-progress" max="100" value="68">68%</progress>
      </div>`),
    item("progress-circle", "Progress Circle", "Show a completion value in a compact circular display.", `
      <span class="mero-progress-circle" style="--mero-value:70" role="progressbar"
        aria-label="Import progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="70">70%</span>`),
    item("skeleton", "Skeleton", "Reserve space for content while its HTML is loading.", `
      <div class="mero-stack" role="group" aria-busy="true" aria-label="Loading release information" style="inline-size:min(100%,16rem)">
        <div class="mero-skeleton" aria-hidden="true" style="inline-size:62.5%;block-size:1.2rem"></div>
        <div class="mero-skeleton" aria-hidden="true"></div>
        <div class="mero-skeleton" aria-hidden="true" style="inline-size:81.25%"></div>
      </div>`),
    item("spinner", "Spinner", "Indicate that work is underway when the completion time is unknown.", `
      <span class="mero-row" role="status">
        <span class="mero-spinner" aria-hidden="true"></span>
        Syncing workspace
      </span>`),
  ]),
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
  section("Media", [
    item("avatar", "Avatar", "Represent a person with initials and an accessible name.", `
      <div class="mero-row">
        ${avatar("SR", "Sam Rivera")}
        <span>Workspace owner</span>
      </div>`),
    item("avatar-group", "Avatar Group", "Show a compact cluster of people associated with a workspace.", `
      <div class="mero-avatar-group" role="group" aria-label="Collaborators">
        ${avatar("SR", "Sam Rivera", "#b9a5ff")}
        ${avatar("MK", "Mila Khan", "#95e2c0")}
        ${avatar("AL", "Alex Lee", "#f5ca9d")}
      </div>`),
  ]),
  section("Pickers", [
    item("autocomplete", "Autocomplete", "Request matching options from the server as a user types.", combo("demo-autocomplete", { remote: true }),
      "HTMX replaces the options with a server-rendered fragment. Use the arrow keys and Enter to select a result. A search without matches leaves the empty message visible.", [
        ["Local shortlist", combo("shortlist", { label: "Pinned workspace", names: ["Studio North", "Atlas", "Beacon"] }), {
          description: "Filter a short list of pinned workspaces already on the page.",
          notes: "Type to narrow the three choices. Use the arrow keys to move through matches and Enter to choose a workspace.",
        }],
      ]),
    item("combo-box", "Combo Box", "Filter and select from suggestions already on the page.", combo("demo-combo-box"),
      "Type to filter. Use the arrow keys and Enter to select an option. A named input submits the chosen text."),
    item("select", "Select", "Choose one of a fixed set of values using the platform’s picker.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-select">Role</label>
        <select class="mero-select" id="demo-select" name="role">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>`),
  ]),
  section("Typography", [
    item("kbd", "Kbd", "Format a keyboard shortcut with native semantics.", `
      <p class="mero-text">Use <kbd class="mero-kbd">Tab</kbd> to move to the next control.</p>`),
    item("typography", "Typography", "Apply the type scale to semantic content.", `
      <article class="mero-stack">
        <h2 class="mero-heading">Release notes</h2>
        <p class="mero-text">The staging deployment is ready for review.</p>
        <p class="mero-description">Published by the platform team.</p>
      </article>`),
  ]),
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
  ]),
  section("Colors", [
    item("color-area", "Color Area", "Open a browser-managed color surface and submit the selected color.", field("demo-color-area", "Accent color", 'name="accent" value="#b9a5ff"', { type: "color" }),
      "The platform owns the color area and keyboard behavior. Its available controls depend on the browser."),
    item("color-field", "Color Field", "Enter a six-digit hex value directly in a text field.", field("demo-color-field", "Hex color", 'name="color" pattern="#[0-9a-fA-F]{6}" maxlength="7" value="#b9a5ff"', { hint: "Use # followed by six hexadecimal digits." }),
      "Validate the format again when the form reaches the server."),
    item("color-picker", "Color Picker", "Choose a color using the native picker UI.", field("demo-color-picker", "Theme accent", 'name="color" value="#85b8ff"', { type: "color" })),
    item("color-slider", "Color Slider", "Adjust a hue along the color spectrum.", `
      <div class="mero-field">
        <label class="mero-label" for="demo-hue">Hue</label>
        <input class="mero-slider mero-color-slider" id="demo-hue" name="hue"
          type="range" min="0" max="359" step="1" value="255" aria-describedby="demo-hue-help">
        <p class="mero-description" id="demo-hue-help">0° to 359°</p>
      </div>`,
      "The submitted value is the hue. Combine it with saturation and lightness in your app."),
    item("color-swatch", "Color Swatch", "Show a color with its human-readable label.", `
      <div class="mero-row">
        <span class="mero-swatch" aria-hidden="true"
          style="display:inline-block;width:2rem;height:2rem;border-radius:0.45rem;background:#b9a5ff"></span>
        <span>Mero violet <code>#B9A5FF</code></span>
      </div>`),
  ]),
  section("Utilities", [
    item("scroll-shadow", "Scroll Shadow", "Expose a scrollable region with a visual cue that more content is available.", `
      <div class="mero-scroll-shadow" role="region" aria-label="Recent releases" tabindex="0" style="height:8rem">
        <ul class="mero-stack">
          <li>v1.5.0 • New components</li>
          <li>v1.4.3 • Performance improvements</li>
          <li>v1.4.2 • Navigation polish</li>
          <li>v1.4.1 • Field states</li>
          <li>v1.4.0 • Release tooling</li>
          <li>v1.3.0 • Initial catalog</li>
        </ul>
      </div>`),
  ]),
]
