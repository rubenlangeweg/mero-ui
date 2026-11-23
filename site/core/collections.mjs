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
      "These destinations are ordinary links. Tab moves through the popup and Escape closes it. For actions with arrow-key navigation, use Menu Button."),
    item("menu-button", "Menu Button", "Open row actions and move through them with the arrow keys.", `
      <ul class="mero-stack">
        <li class="mero-row">
          <span>Arc Task Lamp</span>
          <button class="mero-button mero-button-ghost mero-button-sm" type="button" popovertarget="row-1-actions" aria-haspopup="menu" aria-controls="row-1-actions" aria-expanded="false" aria-label="Actions for Arc Task Lamp">Actions</button>
          <div class="mero-popover mero-menu" id="row-1-actions" popover role="menu" aria-label="Arc Task Lamp actions">
            <a class="mero-menu-item" role="menuitem" href="/components/sortable-table">Open details</a>
            <button class="mero-menu-item" role="menuitem" type="button" data-mero-toast="Arc Task Lamp duplicated">Duplicate</button>
            <button class="mero-menu-item" role="menuitem" type="button" data-mero-toast="Arc Task Lamp archived">Archive</button>
            <button class="mero-menu-item" role="menuitem" type="button" aria-disabled="true">Delete</button>
          </div>
        </li>
        <li class="mero-row">
          <span>Halo Pendant</span>
          <button class="mero-button mero-button-ghost mero-button-sm" type="button" popovertarget="row-2-actions" aria-haspopup="menu" aria-controls="row-2-actions" aria-expanded="false" aria-label="Actions for Halo Pendant">Actions</button>
          <div class="mero-popover mero-menu" id="row-2-actions" popover role="menu" aria-label="Halo Pendant actions">
            <a class="mero-menu-item" role="menuitem" href="/components/sortable-table">Open details</a>
            <button class="mero-menu-item" role="menuitem" type="button" data-mero-toast="Halo Pendant duplicated">Duplicate</button>
            <button class="mero-menu-item" role="menuitem" type="button" data-mero-toast="Halo Pendant archived">Archive</button>
            <button class="mero-menu-item" role="menuitem" type="button" aria-disabled="true">Delete</button>
          </div>
        </li>
      </ul>`,
      "Each Actions button names its record and identifies its menu with aria-controls. Enter, Space or Down Arrow opens the menu on its first item, and Up Arrow on its last. Arrow keys, Home, End and a typed letter move between items. Escape closes the menu and returns focus to the button. Tab and Shift+Tab close it and continue in the browser’s tab order.",
      [["Choice items", `
      <button class="mero-button mero-button-outline mero-button-sm" type="button" popovertarget="view-menu" aria-haspopup="menu" aria-controls="view-menu" aria-expanded="false">Sort: Category</button>
      <div class="mero-popover mero-menu" id="view-menu" popover role="menu" aria-label="View options">
        <div role="group" aria-label="Sort by">
          <a class="mero-menu-item" role="menuitemradio" aria-checked="false" href="/components/sortable-table?sort=name">Product</a>
          <a class="mero-menu-item" role="menuitemradio" aria-checked="true" href="/components/sortable-table?sort=category">Category</a>
          <a class="mero-menu-item" role="menuitemradio" aria-checked="false" href="/components/sortable-table?sort=status">Status</a>
        </div>
        <div role="group" aria-label="Show">
          <a class="mero-menu-item" role="menuitemcheckbox" aria-checked="false" href="/components/filter-chips?status=Active">Active only</a>
        </div>
      </div>`, {
        description: "Choose one sort order or switch an option from a menu that shows the current state.",
        notes: "Use role=menuitemradio for one choice in a group and role=menuitemcheckbox for an option that is on or off. Render aria-checked on the server; Mero shows a check mark but never changes it, so each item links to the URL with the new state. The menu opens on the checked radio item, or on the first item when none is checked. Up Arrow still opens it on the last item. The keys work as in the default Menu Button.",
      }]]),
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
