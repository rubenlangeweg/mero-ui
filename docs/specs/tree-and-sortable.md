# Spec: Tree and sortable lists

- **Status:** Proposed, 2026-11-26. Not implemented.
- **Why:** reordering in Origo uses native HTML5 drag and drop: categories (`views/categories/list.tsx`), category products (`views/categories/product-order-state.ts`) and asset order (`views/files/asset-drag-state.ts`). Drag and drop gives no keyboard path, no screen reader announcements and no touch support. Product order adds a position input as its keyboard path. See the [UI SDK evaluation](../research/ui-sdk-behaviour-engine.md) for why Mero builds this itself.
- **Reference model:** the interaction model, keyboard map and announcement wording follow UI SDK's `createReorder` and `createTreeReorder`, as checked in `research/ui-sdk-spike/`. The code is Mero's own.

## Scope

Two behaviours that can be used separately or together:

1. **`data-mero-tree`:** an accessible tree view whose children can load lazily. It follows the ARIA APG tree pattern.
2. **`data-mero-sortable`:** reordering among siblings of one container by keyboard, pointer or touch. It works on a flat list, a grid of cards or one level of a tree.

Not in v1:

- Moving an item to another parent. Origo's API reorders siblings (`PATCH /api/categories/reorder {parentId, orderedIds}`) and reparents through the edit form.
- Moving several selected items together.
- Moving between lists, as in Kanban. `mero-collections.js` keeps its own board.
- Multi-select.

Each of these can follow in v2 when an Origo slice needs it.

## Design principles

- **The DOM is the state.** Mero keeps no order in memory. A move rewrites sibling order in the DOM, and `mero:reorder` reports the new order. Only the move in progress lives in a variable, for the time of one gesture. This is what keeps it safe with morph: the spike's corruption came from a state copy that the morph never saw.
- **The server stays the truth.** The host saves on `mero:reorder`. If the save fails, the host renders the list again from the server, with an htmx swap or a re-read. Mero has no undo API.
- **One writer per attribute (ADR 0016).** Mero writes `tabindex`, `aria-expanded`, `aria-selected`, `aria-describedby` on handles, and `data-mero-moving`. The author writes `data-mero-tree`, `data-mero-sortable` and `data-value`. A host script only listens.

## Markup

### Tree

```html
<ul role="tree" data-mero-tree aria-label="Categories">
  <li role="treeitem" aria-expanded="false" data-value="electronics">
    <span class="mero-tree-label">Electronics</span>
    <ul role="group" hidden
        hx-get="/categories/electronics/children-partial"
        hx-trigger="mero:expand once" hx-swap="innerHTML"></ul>
  </li>
  <li role="treeitem" data-value="garden">
    <span class="mero-tree-label">Garden</span>
  </li>
</ul>
```

- **Children load with htmx, not Mero.** Expanding a node fires `mero:expand` on its group. `hx-trigger="mero:expand once"` loads the children; a server-rendered group simply omits `hx-get`.
- **The server renders the starting ARIA:** `aria-expanded` on parents and `hidden` on closed groups. Mero sets one `tabindex="0"` when it initialises, and keeps it on swaps through `init(root)`.

### Sortable

```html
<ol data-mero-sortable data-value="electronics" aria-label="Phones and laptops, sortable">
  <li data-value="phones">
    <button type="button" class="mero-sort-handle" data-mero-sort-handle aria-label="Move Phones">⠿</button>
    Phones
  </li>
  <li data-value="laptops">…</li>
</ol>
```

- **The handle is a real button.** That gives a keyboard path that doesn't clash with links or tree navigation inside the item, and a touch target. A list without handles makes the whole item the drag target for pointers only, and is not keyboard sortable. The catalog shows that variant as not accessible.
- **Order mode is server markup.** To enter and leave order mode, swap the list with or without handles. Origo's `orderMode` flag then stops being Alpine state.
- **Pinned items:** `aria-disabled="true"` on a handle stops that item from being picked up. Other items still move past it.
- **In a tree,** put `data-mero-sortable` on the `role="tree"` root and on each `role="group"`. Each container sorts only its own children; `data-value` on the container is the parent key.

## Keyboard

Tree (APG):

| Key | Action |
| --- | --- |
| Up, Down | Previous or next visible item |
| Right | Open a closed parent; on an open parent, go to its first child |
| Left | Close an open parent; otherwise go to the parent |
| Home, End | First or last visible item |
| Printable characters | Typeahead on item labels |
| Enter | Activate the item's link or primary action |

Sort handle:

| Key | Action |
| --- | --- |
| Space or Enter | Pick up the item, or drop it where it is |
| Up, Down (Left, Right in a horizontal or grid list) | Move one place while picked up |
| Home, End | Move to the first or last place |
| Escape | Put it back where it started |
| Tab | Put it back, then move focus on |

Focus stays on the handle throughout. While an item is picked up, arrows don't scroll the page.

## Pointer and touch

- **Pointer events, not HTML5 drag and drop.** HTML5 drag and drop has no touch support and its drag image can't be styled.
- **Threshold:** a drag starts after 3 px, so a click on the handle stays a click.
- **During a drag:** the item follows the pointer through `--mero-drag-x` and `--mero-drag-y`, and its siblings move aside live. Near the edge of a scrolling container it scrolls automatically.
- **Ending a drag:** Escape or `pointercancel` puts the item back.
- **Touch:** `touch-action: none` applies to the handle only, so the list still scrolls.

## Announcements

Announcements go to one polite live region that Mero creates, with UI SDK's wording:

- "Picked up Phones. Position 1 of 4."
- "Phones, position 2 of 4."
- "Dropped Phones at position 2 of 4."
- "Phones returned to position 1 of 4."

Each handle gets `aria-describedby` pointing at one hidden instructions element: "Press Space to pick up. Use the arrow keys to move, Space to drop, Escape to cancel." A host can override the text with `data-mero-sort-instructions` on the container.

## Events

| Event | Fires on | When | `detail` | Cancelable |
| --- | --- | --- | --- | --- |
| `mero:expand` | the item's `role="group"` | after a parent opens or closes | `{ item, expanded }` | no |
| `mero:reorder` | the sortable container | after a drop that changed the order | `{ item, value, parent, from, to, order, reason }` | yes |

`mero:reorder` details:

- `value` is the moved item's `data-value`.
- `parent` is the container's `data-value`, or `null`.
- `order` is every item's `data-value`.
- `reason` is `"pointer"` or `"key"`.
- `preventDefault()` puts the item back.

Both events bubble and fire after the DOM is written, like `mero:tab`. No event fires during a move, so the host only ever sees committed orders.

Host example, the Origo category save:

```html
<ol data-mero-sortable data-value="…"
    x-on:mero:reorder="fetch('/api/categories/reorder', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({parentId: $event.detail.parent, orderedIds: $event.detail.order})})">
```

## Swaps and morphs

- **Initialisation:** `init(root)` sets up trees and sortables in new content, as for tabs.
- **A swap during a move** that removes the item or its container cancels the move silently. No `mero:reorder` fires.
- **After a morph,** the DOM order the server sent is the order. Because Mero keeps no copy, there is nothing to reconcile.
- **Unsaved order** must be protected by the host, for example with `hx-preserve` or `data-mero-hold` while it is dirty, as Origo's product order already does.

## Files and API surface

- **Code:** `ui/mero.js`, about 300 lines, so Origo's vendored core picks it up without a new family. CSS goes in `ui/mero.css`: tree indentation, handle, `[data-mero-moving]` and the drag transform.
- **New public names in `test/api-surface.json`:**
  - attributes: `data-mero-tree`, `data-mero-sortable`, `data-mero-sort-handle`, `data-mero-sort-instructions`, `data-mero-moving`
  - events: `mero:expand`, `mero:reorder`
  - custom properties: `--mero-drag-x`, `--mero-drag-y`
- **Reference:** add both behaviours to the reference, and add `data-mero-moving`, `aria-expanded` and the handles' `aria-describedby` to "State Mero owns".
- **Catalog:**
  - Tree View: static, lazy, sortable.
  - Sortable List: list, card grid, pinned item, order mode with Save and Cancel.

## Tests

Browser tests in Chromium, Firefox and WebKit:

1. **Tree keyboard:** every row of the keyboard table, typeahead, and `mero:expand` triggering an htmx lazy load once.
2. **Keyboard reorder:** pick up, move, drop. The DOM order, the `mero:reorder` detail and the announcement text are all checked. Escape and Tab cancel with no event.
3. **Pointer reorder:** a drag with mouse events, the 3 px threshold (a click is not a drag), and `pointercancel`.
4. **Cancel:** `preventDefault()` on `mero:reorder` puts the item back.
5. **Swaps:** `innerHTML` swap during a move; `innerMorph` and `outerMorph` after a reorder, with server order replacing client order and no duplicate or lost rows. These two cases are the spike's regression cases.
6. **Alpine:** `x-on:mero:reorder` on an `x-data` ancestor receives the event. This extends `alpine-coexistence-browser`.
7. **Accessibility:** axe clean in every catalog variant.
8. **Geometry:** handle hit area and focus ring, as in `control-geometry`.

## Origo adoption, after the Mero release and re-vendor

1. **Categories:** `categories/list.tsx` drops `categoryReorderData` and the `draggable` bindings. It adds `data-mero-tree` and `data-mero-sortable` with handles, and saves from `x-on:mero:reorder`. Lazy children move to `hx-trigger="mero:expand once"`.
2. **Category products:** `product-order-state.ts` drops `startDrag`, `dropOn` and the DOM moves. It keeps paging, the dirty flag, Save, Cancel and 409 handling, and reads the order from `mero:reorder`. The position input can stay as a second keyboard path.
3. **Asset order:** `asset-drag-state.ts` follows the same pattern.

Each step is its own Origo slice, with the matching `*-browser` suite (ADR 0015).

## Effort

| Work | Estimate |
| --- | --- |
| Mero: tree and sortable, CSS, catalog and reference | 2–3 days |
| Mero: browser tests in three browsers | 1 day |
| Origo: categories slice | 1 day |
| Origo: product and asset order | 1–2 days |

## Open questions

1. Do category saves happen on every drop (today's behaviour) or in an order mode with Save and Cancel, like products? The spec supports both; the catalog shows both.
2. Does reparenting categories by drag matter to users, or is the edit form enough? This decides whether v2 is needed.
3. Should the product position input stay once the handle has a keyboard path?
