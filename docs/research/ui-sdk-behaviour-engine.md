# UI SDK as a behaviour engine for Mero: evaluation

- **Status:** Investigation, 2026-11-26. Not an approved migration. Nothing in `ui/` changes.
- **Evaluated:** `@ui-sdk/core` and `@ui-sdk/web` 0.1.0-beta.17 (Vercel Labs, Apache-2.0), against Mero 0.9.0, htmx 4.0.2 and Origo ADR 0015 and ADR 0016.
- **Spike:** [`research/ui-sdk-spike/`](../../research/ui-sdk-spike/README.md). Three components, Playwright runners, size script. Every number below comes from it.
- **Sources:** the npm packages and the Markdown docs they ship (`docs/core.md`, `docs/agents.md`, `@ui-sdk/web/docs/*`). `ui-sdk.dev` was unreachable from the build environment. Secondary coverage was used only for context.

## Outcome (2026-11-26)

**Not adopted, for Mero or for Origo. Origo stays on Mero, htmx and Alpine.**

- Origo will not revive its in-app assistant. Agents integrate through the API and MCP. That removes the use case for UI SDK's agent bridge, which is its main distinguishing feature. Without the bridge, UI SDK is a good behaviour library, and that does not justify a React rewrite or a beta dependency.
- Two alternatives were considered and rejected:
  - Moving Origo from htmx to React with UI SDK: about 180 tenant views to rewrite, with no copilot to justify it.
  - Using UI SDK as an engine inside Mero: the costs in this document.
- The real gap is keyboard and screen-reader support for reordering. Mero builds it natively, with UI SDK's interaction model as the reference: [Tree and sortable lists spec](../specs/tree-and-sortable.md).
- Revisit UI SDK if an in-app copilot comes back on the roadmap, or if one Alpine screen, such as the variant matrix, becomes clearly too costly to maintain. In that case, pilot that one screen.

The rest of this document is the original investigation.

## Recommendation

**Do not adopt UI SDK as Mero's behaviour engine now. Re-evaluate when its tree, grid and transfer behaviours lose `@experimental`, or at 1.0.**

The behaviours are good. In the spike, keyboard tree reordering, grid ranges and group reordering worked within 40 to 90 lines of glue each, with screen reader announcements included. Writing those to the same standard would take Mero weeks.

Three things block adoption today:

1. **Maturity.** UI SDK is two weeks old and 0.1.0-beta. It published 16 versions between 12 and 24 November. The behaviours we need most are marked `@experimental`. Mero promised API stability from 0.9.0, and Origo vendors one pinned release byte for byte (ADR 0016 §6). An engine that changes weekly underneath breaks that promise, or forces Mero to sit on old betas.
2. **Morph.** A morph swap over a tree the user has reordered corrupts the DOM: 5 rows become 9. HTMX morph is a supported Origo path (ADR 0016 §3). Mero can fix this in its own glue, but it is exactly the lifecycle code we hoped to stop writing.
3. **Payload and packaging.** The UI SDK kernel alone weighs as much as all of `mero.js`. The three components with the agent bridge add 47 KB gzip, more than all of Mero's scripts today (38 KB). UI SDK also needs a bundler, and Mero today ships plain scripts that Go and Rust apps copy without npm.

### Do now

- **Keep building complex behaviours in Mero, but use UI SDK's interaction model as the reference.** Copy its keyboard maps, announcement wording and change reasons (`drag`, `move-key`, `imperative`) into Mero's `mero:*` event details. A later swap then changes internals, not contracts.
- **Use the pure helpers where they help.** `announce`, `textToCells`, `cellsToText` and `subtreeEnd` tree-shake to 1.6 KB gzip and have no lifecycle. This needs a vendored build step, so do it only when a component needs one.
- **Start Mero's agent contract on Mero's terms.** See [Agent bridge](#agent-bridge).
- **Re-run the spike** at each UI SDK minor release, or when Origo starts the category-tree slice. That is the best first candidate.

## Answers to the investigation questions

| Question | Answer | Evidence |
| --- | --- | --- |
| Do UI SDK's primitives work in Mero's vanilla JavaScript? | **Yes, through custom elements only.** `@ui-sdk/web`'s `createParts` registers one custom element per slot. The layer that binds a primitive to arbitrary DOM (`@ui-sdk/core/renderer`) is documented as "not public API, may change with any release". | All three spike components run as `<mero-tree>`, `<mero-grid>` and `<mero-asset-picker>` with no framework. |
| Can Mero keep its declarative `data-mero-*` API? | **Partly.** Root options can come from attributes, and Mero can re-emit events as `mero:*`. But every behaviour part, like each row, cell or asset, must be a custom element. `<li data-mero-…>` markup becomes `<mero-tree-row>`. That is a breaking change for any component moved over, and it touches the catalog templates. | `createParts` maps slots to tags. A part that needs native behaviour must wrap the native element. |
| Do initialisation and cleanup work with HTMX swaps and morphs? | **Swaps: yes. Morphs: no, unless Mero adds glue.** `connectedCallback` brings up new content without `MeroUI.init`. Fifty `innerHTML` swaps left one component in the agent registry and no extra document listeners. A morph after a client-side reorder corrupted the tree. The primitive takes its state from the DOM once and does not see the morph. | `run-tree.mjs`, `run-morph.mjs`. Plain elements morph cleanly, and so does UI SDK when the client order equals the server order. |
| Does the single-owner rule (ADR 0016) still hold next to Alpine? | **Yes, if Mero sets the boundary.** The primitive should own transient interaction state: focus, draft and pickup. Committed order and selection go out through `mero:*` for Alpine or htmx to own. UI SDK's own events (`rowschange`, `valuechange`) do not bubble, so Alpine's `x-on` on an ancestor never hears them. Mero must re-emit them, as the spike does. UI SDK writes `aria-selected`, `tabindex` and `data-*` on its parts, so ADR 0016 §2 must list those as Mero-owned. | `mero:reorder` and `mero:range` reached `document` listeners. Controlled mode (`controlled: ["rows"]`) exists for host-owned state. |
| Bundle size? | **Large compared with Mero.** See [Size](#size). | `npm run size`. |
| Accessibility? | **Strong, and the main benefit.** Correct tree, grid and listbox roles. `aria-level` follows the depth. Keyboard alternatives for every drag. Range edges for styling. Live-region announcements such as "Dropped Garden at level 1, position 1 of 2." and "2 rows by 2 columns selected". Axe found nothing on the components; its only findings were about the bare fixture page. As with Mero today, the server must render the initial ARIA itself, because UI SDK computes it only after upgrade. | `run-tree.mjs`, `run-grid-picker.mjs`. No screen reader pass yet. |
| Performance? | No problems at spike scale. `byCell` and `byCellRange` update only the cells that change, and the grid supports virtualised rows (`reveal`). Not measured at Origo scale. | Docs; spike grids are 3×4. |
| Dependencies and maintenance? | No runtime dependencies beyond its own packages. The cost is upgrade churn: experimental APIs plus a non-public renderer. Mero would need its first build step for `ui/` and its first `type="module"` asset. Glue would replace hand-written behaviour, but it is not free. Each component needs DOM-order sync, event re-emission and morph handling. | 90, 43 and 67 lines of glue. |
| Can the agent bridge be exposed without coupling apps to UI SDK? | **Only behind a Mero facade.** See [Agent bridge](#agent-bridge). | |
| Is UI SDK mature enough for production? | **No, not yet.** | First release 2026-11-12; beta.17 on 2026-11-24. `@experimental` covers `createTreeReorder`, `createGridFocus`, `createCellRange`, `createLasso` and `createTransfer`. `createReorder`, `createSelection`, `createRovingFocus` and `createTypeahead` are not marked. The docs say all of it can change before 1.0. |

## What the spike showed

### Tree: category management

`src/mero-tree.js` uses `createTreeReorder` and `createRovingFocus`.

- Works: Space picks a category up with its subtree. Arrows move it and change its level, and Space drops it. Focus stays on the moved row. `aria-level` updates. One `mero:reorder` event carries `{order, reason, key, parent, index}`; `parent` and `index` are what a nested-tree save endpoint needs.
- Glue Mero has to own: UI SDK expects a framework to re-render rows from state. With custom elements nobody re-renders, so the root's `bind` moves DOM nodes itself, using `moveBefore` where the browser supports it. The same glue reads the starting rows from server markup.
- Fails: `innerMorph` after a reorder. The cause is the interaction between morph moving nodes, parts reconnecting and the glue re-applying order. A fix would mean re-reading state from the DOM after a swap, or excluding the tree from morph while it has unsaved changes. Both are Mero code.

### Grid: spreadsheet-like editing

`src/mero-grid.js` uses `createGridFocus` and `createCellRange`.

- Tested: arrows, Ctrl+End, Shift+arrow ranges, `aria-selected` and `data-range-edge="top left"` on the cells. Documented but not tested: Home and End, Shift+Space and Ctrl+Space for rows and columns, Ctrl+A, Escape. The range reaches the host as `mero:range` with `{top, left, bottom, right}`. Copy and paste helpers exist (`cellsToText`, `textToCells`).
- Simplest of the three, at 43 lines. No DOM reordering, so no morph exposure beyond selection state.
- Not covered: cell editing. UI SDK has `createInlineEdit`; the translation workbench's draft, save and conflict model stays application state either way.

### Asset picker: digital asset management

`src/mero-asset-picker.js` uses `createSelection`, `createReorder` with `group` and `createRovingFocus`.

- Tested: Ctrl-click, Space, Shift+arrows, a pointer drag. Shift-click is wired but not tested. Dragging a selected asset by pointer or keyboard moves the whole selection.
- A key decision UI SDK leaves to Mero: reorder takes both Space and Enter for pickup, and selection wants Space. The first version conflicted. The spike now uses Space to select and Enter to pick up. Every composed component has decisions like this, and they belong in Mero's interaction standards.
- Not exercised: `createLasso` and moving assets between lists (`createTransfer`). Both are experimental.

### Compared with Origo's current code

UI SDK replaces behaviour, not application state. In the two Origo files named in the brief, behaviour is a small share:

| Origo file | Lines | Behaviour that UI SDK could replace | Stays in Alpine or htmx |
| --- | ---: | --- | --- |
| `categories/product-order-state.ts` | 265 | Drag and drop plus move-to-position, about 40 lines (15%) | Paging, cursors, dirty tracking, save, 409 handling, thumbnails |
| `products/translation-workbench-island.ts` | 197 | Alt+arrow field navigation, about 7 lines (4%) | Drafts, intents, save protocol, readback, navigation guards, queue scanning |

The case for UI SDK is not shrinking these islands. It is giving `categories/list.tsx`, `files/asset-drag-state.ts` and product ordering a proper keyboard path and announcements. They use native HTML5 drag and drop today, which provides neither. Product ordering adds a position input as its keyboard path.

## Size

Minified, gzip level 9, production conditions, ESM, from `research/ui-sdk-spike/size`.

| Bundle | gzip |
| --- | ---: |
| Kernel only (`definePrimitive` + `createParts`) | 13.1 KB |
| Tree behaviours + kernel | 22.5 KB |
| Grid behaviours + kernel | 19.6 KB |
| Picker behaviours + kernel | 24.2 KB |
| All three, shared kernel | 29.9 KB |
| Agent bridge alone | 18.4 KB |
| All three + agent bridge | 47.2 KB |
| Pure helpers (`announce`, `subtreeEnd`, `textToCells`, `cellsToText`) | 1.6 KB |
| *For comparison:* `mero.js` (unminified) | 13.8 KB |
| *For comparison:* all of `ui/*.js` | 37.9 KB |

Load it only on pages that use these components, as Mero already does with its families. The bundle must stay single: one copy of `@ui-sdk/core` serves every UI SDK-backed component and the agent bridge.

## Agent bridge

What works: `createAgent()` from `@ui-sdk/web/agent` listed the spike components by accessible name. It showed their declared actions and the state named in `controlled`. `act` ran `moveCategory`, `selectAssets` and `selectCells` through the same change pipeline as a person, and the host saw `reason: "imperative"`. The docs say the app can refuse an action through an `allow` callback and cancel a change; the spike did not test either.

The coupling problems:

- **It sees only UI SDK primitives.** Mero's existing 167 components (tabs, dialogs, comboboxes, forms) are invisible to it. Partial adoption gives the agent a partial page.
- **Its API is UI SDK's.** If apps import `@ui-sdk/web/agent` directly, every Origo integration depends on a beta API.
- **State needs design for each component.** The snapshot shows only `controlled` keys. The spike grid exposed no state until we designed for it.

If Mero adopts it later, the shape that keeps apps decoupled is:

- **A Mero facade.** For example, `MeroUI.agent()` would return `snapshot`, `act` and `query`. UI SDK-backed components plug in directly. Native Mero components plug in through a small adapter: name from the accessible label, state from Mero-owned attributes, actions mapped to `MeroUI.open`, `MeroUI.close` and existing commands. The facade is Mero API under the stability policy. UI SDK stays an implementation detail.
- **Separate roles.** Domain MCP keeps all persistent writes. The UI bridge works only on transient browser state, like selection, order drafts and unsaved edits, and a save still goes through the normal htmx or form path a person would use. This keeps audit, permissions and conflict handling (such as Origo's 409 path) in one place.

Mero can design that facade now and back it with its own components first. Nothing in it needs UI SDK.

## Adoption gates

Revisit adoption when all of these hold:

1. UI SDK has reached 1.0, or the behaviours Mero would use are no longer `@experimental`, and releases publish a changelog with breaking changes marked.
2. A public way to bind a primitive to existing DOM, or a Mero decision to accept custom elements for these parts and their markup changes.
3. A morph strategy proven in the spike: tree and picker survive `innerMorph` and `outerMorph` with unsaved client order, with and without `hx-alpine-compat`.
4. A size budget: what each page loads, with UI SDK only on pages that use it.
5. A first Origo slice that needs it, most likely the category tree, with a tenant browser suite as ADR 0015 requires.

## Options considered

| Option | Verdict |
| --- | --- |
| **A. Keep native behaviour in Mero** | Default for now. Highest build effort for the hard components. No dependency risk. |
| **B. Adopt UI SDK now for the three components** | Rejected. Maturity, morph and packaging, as above. |
| **C. Gated adoption: keep the spike, adopt per component when the gates hold** | **Recommended**, together with A in the meantime. |
| **D. Use only the pure helpers** | Fine when it helps, but small value. Most of the value is in the stateful behaviours, which need the kernel. |
| **E. Let apps use UI SDK directly, beside Mero** | Rejected. It creates a fourth layer that owns behaviour on the same DOM, against ADR 0016. |

## Not tested

- Firefox and WebKit. The spike ran in Chromium only.
- A screen reader pass. Announcements were read from the live region text, not heard.
- `outerMorph` and `hx-alpine-compat` with Alpine on the page.
- Lasso, transfer between lists, virtualised grids and 10,000-row performance.
- Content Security Policy effects of UI SDK writing `style` attributes.
- WebMCP registration and a server-side model loop for the agent bridge.
