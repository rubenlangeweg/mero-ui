import { item, section } from "./helpers.mjs"

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
          <div class="mero-listbox mero-combo-list" id="demo-command-options" role="listbox" aria-label="Commands" hidden></div>
          <span class="mero-description" data-mero-combo-status role="status"></span>
        </div>
      </dialog>`,
      "The input requests matching options from your server as you type. Arrow keys move through results, Enter opens a link or runs an action, and Escape closes the list and then the dialog, returning focus to where you were. Link the trigger to a search page for visitors without JavaScript. Use either this or the workspace Command on a page, not both."),
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
