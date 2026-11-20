import { item, section } from "./helpers.mjs"

export const workspaceNames = ["Atlas", "Beacon", "Cobalt", "Drift", "Iris", "Lumen", "Studio North"]

export function extractOptions(values, prefix) {
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

export const groups = [
  section("Pickers", [
    item("autocomplete", "Autocomplete", "Request matching options from the server as a user types.",
      combo("demo-autocomplete", { remote: true }),
      "HTMX replaces the options with a server-rendered fragment. Use the arrow keys and Enter to select a result. Escape clears the active option. Arrow Down requests current results again if you dismissed a pending search. An empty search result leaves the message visible.", [
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
]
