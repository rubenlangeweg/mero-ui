import { item, section } from "./helpers.mjs"

export const groups = [
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
]
