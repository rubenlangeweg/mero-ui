import { escapeHtml } from "../html.mjs"
import { item, section } from "./helpers.mjs"
import { typedConfirmation } from "./typed-confirmation.mjs"

export function commandResults(query, pages) {
  const matches = name => name.toLowerCase().includes(query)
  const actions = matches("Export catalog")
    ? ['<div class="mero-option" role="option" aria-selected="false" id="cmd-export" data-mero-toast="Export requested">Export catalog</div>']
    : []
  const links = pages.filter(({ name }) => matches(name)).slice(0, query ? 6 - actions.length : 4).map(({ id, name }) =>
    `<a class="mero-option" role="option" aria-selected="false" tabindex="-1" id="cmd-${id}" href="/components/${id}">${escapeHtml(name)}</a>`)
  return [["Pages", links], ["Actions", actions]].filter(([, options]) => options.length).map(([name, options]) => {
    // aria-labelledby exposes the visible heading as the group name. Only options belong in its accessible children.
    const heading = `cmd-group-${name.toLowerCase()}`
    return `<div role="group" aria-labelledby="${heading}">
  <h3 class="mero-command-heading" aria-hidden="true" id="${heading}">${name}</h3>
  ${options.join("\n  ")}
</div>`
  }).join("\n") || '<div class="mero-option" role="option" aria-disabled="true" id="cmd-empty">No results</div>'
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

export const groups = [
  section("Overlays", [
    item("alert-dialog", "Alert Dialog", "Ask for confirmation on a decision that calls for attention.",
      overlay("demo-alert-dialog", "Archive project?", "This removes the project from active views.", { trigger: "Archive project", action: "Archive", role: "alertdialog" }),
      "Focus starts on Cancel. Connect the confirmation to a form action in your application."),
    typedConfirmation,
    item("drawer", "Drawer", "Open a full-height edge panel for work that benefits from more room.",
      overlay("demo-drawer", "Review deployment", "The staging build is ready to review.", { variant: "drawer", trigger: "Open drawer" })),
    item("modal", "Modal", "Open a centered, named dialog with native focus containment.",
      overlay("demo-modal", "Workspace details", "Only workspace managers can change access.")),
    item("command-menu", "Command Menu", "Press Cmd or Ctrl K to search pages and actions returned by your server.", `
      <button class="mero-button mero-button-outline" type="button" data-mero-open="demo-command" aria-keyshortcuts="Meta+K Control+K">Search commands <kbd class="mero-kbd">Ctrl K</kbd></button>
      <dialog class="mero-dialog mero-command" id="demo-command" data-mero-command aria-label="Commands">
        <div class="mero-combo" data-mero-combo data-mero-combo-remote>
          <input class="mero-input" name="q" type="text" role="combobox" aria-label="Search commands" aria-expanded="false"
            aria-controls="demo-command-options" aria-autocomplete="list" autocomplete="off" placeholder="Search pages and actions…" autofocus
            hx-get="/demo/catalog/command-menu" hx-trigger="input changed delay:150ms, mero:query"
            hx-target="next [role=listbox]" hx-swap="innerHTML" hx-sync="this:replace">
          <div class="mero-listbox mero-combo-list" id="demo-command-options" role="listbox" aria-label="Commands" hidden>
            ${commandResults("", [{ id: "button", name: "Button" }]).replaceAll("\n", "\n            ")}
          </div>
          <span class="mero-description" data-mero-combo-status role="status"></span>
        </div>
      </dialog>`,
      "Return each group with a visible heading and a unique ID for every option. Omit empty groups. For an empty search result, return one disabled option with the text “No results”. Arrow keys move across groups. Home and End reach the first and last result. Enter follows the link or runs the action. Escape closes the results, then the dialog, and returns focus to the opener. Give the shortcut to one command menu per page."),
    item("popover", "Popover", "Display contextual information using the browser’s top layer.", `
      <button class="mero-button mero-button-outline" type="button" popovertarget="demo-popover">Deployment info</button>
      <div class="mero-popover" id="demo-popover" popover>
        <strong>Staging</strong>
        <p class="mero-description">Last published 12 minutes ago.</p>
      </div>`,
      "This example uses native popover dismissal. The browser owns its default positioning."),
    item("sheet", "Sheet", "Present concise secondary content from the bottom edge.",
      overlay("demo-sheet", "Choose a workspace", "Your current workspace is Studio North.", { variant: "sheet", trigger: "Open sheet" })),
    item("toast", "Toast", "Announce a completed action without interrupting the current task.", `
      <button class="mero-button mero-button-secondary" type="button" data-mero-toast="Changes saved" data-mero-tone="success">Show confirmation</button>`),
    item("tooltip", "Tooltip", "Show a brief hint on pointer hover or keyboard focus.", `
      <span class="mero-tooltip">
        <button class="mero-button mero-button-outline mero-button-icon" type="button" aria-label="Publish information" aria-describedby="demo-tooltip">?</button>
        <span class="mero-tooltip-content" id="demo-tooltip" role="tooltip">Publishing updates the current workspace.</span>
      </span>`),
  ]),
]
