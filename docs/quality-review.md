# Mero UI quality review

**The biggest defects showed up when a second request, a second component or a second browser tab entered the picture.** They could make a successful save look invalid, apply an old response to a new selection, or overwrite another person’s edit. The fixes below have repeatable checks. [Browser tests](../test/) · [Full component coverage](component-coverage.md)

## What changed

| Surface | What we reproduced | What to try now |
| --- | --- | --- |
| Inventory and settings | A second tab could overwrite a newer edit. A failed connection gave no recovery message. A successful settings save could leave red errors visible. | Open the same product twice, save the first edit, then submit the original draft. The stale edit is refused and the draft survives. Correct an invalid workspace name and Save clears the old error. [Inventory](http://127.0.0.1:4173/playground) · [Settings](http://127.0.0.1:4173/layouts/settings) |
| Repeated controls and overlays | Two copied radio groups and accordions affected each other. Calendar and pagination swaps lost keyboard focus. A tooltip could run off the screen and a toast inside an open dialog could be unreachable. | Mount two copies, operate the second by keyboard and dismiss a notification with a dialog open. [Core regression](../test/core-browser.test.mjs) |
| Collections | Canceling an edit put the unsaved draft in the URL. A delayed initial response could undo a newer action. Agenda lost focus on a day change and rejected a booking without a usable correction path. | Edit then cancel a row, change days by keyboard and correct an invalid booking in place. [Data Grid](http://127.0.0.1:4173/components/data-grid) · [Agenda](http://127.0.0.1:4173/components/agenda) |
| Workspace and media | A delayed upload check could mark the next file as accepted. A command dialog could open invisibly from the Template tab. A previously hidden gallery could show an ivory photo with a sand label. | Change files while validation is pending. Open a hidden gallery with a preselected finish. Keyboard, image and selected state now agree. [Workspace and gallery regression](../test/workspace-browser.test.mjs) |
| Charts and conversations | Phone chart labels rendered at about 6 px. A two-series chart took 14 Tab presses to cross. Switching conversations lacked an accessible current state. | Tab into the chart once and explore its points with arrow keys. The two series have different line patterns and the underlying table remains available. [Dispatch report](http://127.0.0.1:4173/components/line-chart?variant=Period+picker) |
| Catalog and integration | The mobile navigation hid search results. Template copies could open in a different theme. Two snippets overflowed a plain 320 px host. A copied settings layout lacked the behavior that displays validation errors. | Filter a family, open a tenant-themed sample and try the Settings template using only its listed assets. [Catalog](http://127.0.0.1:4173/components) · [Quick start](http://127.0.0.1:4173/start) |

## Visual decisions

The homepage keeps its graphite palette and lamp photography. The featured card reads the actual SKU, category, status and saved finish. The edit action sits beside the swatches and carries the chosen finish into the inventory editor. Editing or deleting the featured record updates the card.

The two large frames below the hero now contain a filterable report and a working conversation about the same shipment data. Their headings align on desktop. On mobile the examples stack, and opening the chart table expands the frame to fit. [Desktop capture](review/home-desktop.png) · [Mobile capture](review/home-mobile.png)

## Evidence and remaining work

- The Chromium audit checked all 162 components and 10 named variants in the docs and as standalone previews, plus 20 site and embedded app routes. All 728 page states passed axe, label and ARIA reference, page-width, failed-response and browser-exception checks at 360 px dark and 1280 px light. [Audit runner](../scripts/audit-catalog.mjs) · [Visual review and spacing standards](component-standards.md)
- The browser checks cover component geometry, navigation history, theme export, responsive app workflows and the downloadable inventory app. The playground checks compare the displayed exchange with the actual response, including recovery from a 422 and reopening an earlier failed request. [Regression suite](../test/) · [Playground journeys](../test/playground-journey.test.mjs)
- All 162 default snippets were rendered with only their listed assets on a plain 320 px host. Hero and Theme Controller initially overflowed. Both fixes were retested with all 18 composition snippets across three engines. [Clean-host regression](../test/collections-browser.test.mjs)

The next acceptance checks require people. Run inventory create, validation, save and delete with **VoiceOver in Safari** and try gallery and drawer gestures on **physical iOS and Android devices**. Then give a developer new to Mero the published quick start and a backend fixture. Time their first successful edit and handled validation error against the proposed 15-minute target.

For the next component-depth decision, test the two date range examples against a real scheduling task. Both currently use paired native date fields. Agenda covers daily bookings. A single-calendar range selection or week view would change what a scheduler can actually do. [Date Range Picker](http://127.0.0.1:4173/components/date-range-picker) · [Range Calendar](http://127.0.0.1:4173/components/range-calendar)
