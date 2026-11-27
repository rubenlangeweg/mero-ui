# Changelog

## Unreleased

- **Breaking:** moved the demo image (`studio-lamp.webp`) and Studio demo files (`mero-inventory.css`, `mero-inventory.js`) out of `ui/` into `public/` and moved demo `.mero-lamp-photo` rules out of `ui/mero-gallery.css` so `@rubenlangeweg/mero-ui/ui` ships self-contained text-only reusable assets.
- **Breaking:** wrapped all shipped stylesheets in `ui/*.css` in `@layer mero { ... }` (keeping `:where()` selectors and `[hidden]` `!important` protection against unlayered utility display rules); scoped `:where(.mero-table .mero-row-link)::after` to `.mero-table` containers so standalone `.mero-row-link` links outside tables no longer stretch across the viewport.
- **Breaking:** `time[data-mero-time]` and `mero-live.js` now resolve locale from `data-mero-locale`, then `MeroUI.configure({ locale })`, then nearest `[lang]`, then browser default (with safe fallback on malformed language tags). Use `data-mero-locale="browser"` or `MeroUI.configure({ locale: "browser" })` to force the reader's browser locale.
- **Boosted non-GET fallback fix:** `data-mero-boost` now restricts its full-page `location.assign()` fallback on responses missing the boosted region to `GET` requests only; non-GET responses without the region cancel the swap, keep the page intact and emit bubbling `mero:boost-unmatched` (`{ source, status, method, url, text, response }`) instead of replaying the action URL as a `GET`.
- **Action source identity:** `mero:action` events now include `source` (the originating `data-mero-form` or `data-mero-action` element, even when replaced or detached by a swap) and `id` (`source.id || null`) on both `pending` and final events, so `document` and Alpine `@mero:action.window` listeners can tell which action settled after removal.
- **Dialog toast survival:** `MeroUI.close(dialog, { preserveToasts: true })` moves live notifications inside the closing dialog to `document.body` instead of removing them, and `MeroUI.open(nextDialog)` carries live page-level toasts into the newly opened top-layer dialog so they remain clickable.
- **Form error reset:** closing a `<dialog>` or resetting a `data-mero-form` now hides and empties its `[data-mero-form-error]` alert (while respecting canceled `reset` events), so reopened dialogs never show a stale error from a prior attempt.
- **Unified `MeroUI.init()` and `MeroUI.cleanup()`:** `MeroUI.init(root)` now also initializes `mero-forms.js` state helpers (`data-mero-dirty`, `data-mero-show-when`, `data-mero-confirm`, including ancestor forms of inserted subtrees) and `mero-live.js` polling (calling `htmx.process()` on unprocessed live regions). New `MeroUI.cleanup(root)` stops and aborts `data-mero-live` polls, clears tracked tooltips and closes any open row preview inside `root` before programmatic or Alpine removal.
- **State events:** added bubbling `mero:select` (`{ value, label, option }` on combobox selection, keeping `change`-only so remote comboboxes never trigger a redundant search), `mero:dialog` (`{ open, dialog, returnValue }`), `mero:peek` (`{ open, key, href, link, panel }`, silent on swaps that keep the same row open) and `mero:dirty` (`{ dirty, form }`, never firing on load or `init`).
- **Core CSS polish:** fixed `.mero-button-danger:hover` contrast to stay ≥ 4.5:1 WCAG AA in light and dark themes; added a 2px `--mero-text` inset bottom indicator on selected `.mero-tab[aria-selected="true"]` and `.mero-tab[aria-current="page"]` (painted above the 1px `--mero-line` ring) for ≥ 3:1 WCAG 1.4.11 contrast in light and dark themes; added `--mero-control-height-sm` and `--mero-control-height-lg` public density tokens; fixed `cursor: progress` precedence on `.mero-button[data-mero-pending][data-mero-request]` and `.mero-button.htmx-request[data-mero-request]`; added `[data-theme="auto"]` following `prefers-color-scheme: dark`.
- **Alpine coexistence suite:** expanded `test/alpine-coexistence-browser.test.mjs` to cover `data-mero-action` buttons, rejected/unknown outcomes, `mero:select`, `mero:dialog`, `mero:dirty`, `MeroUI.init`/`cleanup` on forms and live polling, `innerMorph`, and `x-teleport`.
- **i18n & dialog backdrop scoping:** added `MeroUI.configure({ messages, locale, dialogBackdrop })` covering all runtime strings across `mero.js`, `mero-forms.js` and `mero-live.js`, plus `MeroUI.configure({ dialogBackdrop: "mero-only" })` and `data-mero-dialog` to scope backdrop light-dismiss away from non-Mero dialogs.
- **TypeScript & minified builds:** added `ui/mero.d.ts`, `ui/insight-charts.d.ts`, `ui/insight-markdown.d.ts`, `npm run build:ui` (`dist/ui/*.min.{js,css}` and `dist/manifest.json` with SHA-384 SRI hashes), and automated gzip size-budget checks.
- **Copy helper fix:** fixed `mero-insights.js` so `data-mero-copy="…"` and `data-mero-copy-target` never collide with empty `data-mero-copy` code-block buttons.
- **Deprecated:** `data-mero-check-form` (`mero-composition.js`) and `data-mero-ws-command` (`mero-workspace.js`, prefer core `dialog[data-mero-command]`) are deprecated and scheduled for removal in 1.0.
- **Multi-select combobox:** added `data-mero-multiselect` (with `data-mero-multiselect-chips`, `data-mero-multiselect-name`, `data-mero-multiselect-remove`) supporting local and remote option lists, keyboard focus distinct from `aria-selected`, native form reset, chip removal via click or Backspace, hidden input form submission, `data-mero-dirty` integration and `mero:selection` events.
- **Draft leave guard & conditional fields:** added `data-mero-dirty-guard` to prompt before boosted navigation, Back/Forward traversal or page unload when a `data-mero-dirty` form has unsaved edits (capturing the submitted draft at request start so in-flight edits are never discarded on save, excluding `data-mero-clear-passwords` defaults, and supporting `data-mero-dirty="dirty"` on server-returned drafts); `data-mero-form` now marks editable fields, reset buttons and multi-select containers `inert` while a request is pending (restored on settle without dropping submitted `FormData`) so edits cannot be lost on a 422 replacement swap; added `field!=value` negation (including empty `field=` / `field!=`) and `data-mero-show-when-keep-enabled` to `data-mero-show-when`, and optimized `updateForm` to collect referenced field values in a single pass per event (skipping branch evaluation when an unreferenced field changes).
- **Optimistic concurrency (HTTP 409):** added `data-mero-conflict-swap` and `data-mero-conflict-focus` on `data-mero-form` so 409 conflict/merge fragments swap and prioritize `[data-mero-conflict-focus]` before `[aria-invalid="true"]`.
- **Live progress backoff & dynamic cadence:** `mero-live.js` now applies bounded exponential backoff (up to `max(base * 8, 30s)`) after consecutive poll failures (resetting on success or manual retry) and honors the `Mero-Live-Interval` response header.
- **Zero-dependency vendoring CLI (`mero-ui`):** added `bin/mero-ui.mjs` (`init`, `verify`, `upgrade`) to vendor Core 4 and optional families (readable or `--minified`) alongside `LICENSE.txt` and a `MERO.json` SHA-256/SRI manifest, verify against drift in CI, and surface **Breaking:** / **Deprecated:** changelog notes on upgrade.
- **Full-flow backend starter:** added `examples/backends/node/server.mjs` demonstrating the full production server contract (boosted navigation, per-session CSRF 403, 422 validation, 409 conflict swap, multi-select, conditional fields, draft leave guard, typed confirmation delete, and live progress with dynamic interval, terminal stop and 401 `HX-Redirect`), and expanded `/start` with Node, Python (FastAPI/Django), Rails, Laravel and Tailwind CSS v4 coexistence recipes.
- **Optional theme presets & structural tokens:** added `ui/mero-themes.css` (`npx mero-ui init <dir> --with themes`) with composable `data-theme` palettes (`cobalt`, `fern`, `clay`, `editorial`) and structural modifiers (`compact`, `flat`, `crisp`), plus `--mero-border-width` and `--mero-depth` tokens and `[data-theme~="..."]` matching in `ui/mero.css`.
- **Zero-JS validation hints:** added `.mero-validator` and `.mero-validator-hint` in `ui/mero.css` using pure CSS `:user-invalid` / `:user-valid` (and server `aria-invalid="true"`) so validation hints stay hidden until interaction with zero JavaScript.

## 0.9.0 · 24 November 2026

- **Stability:** the README now states the versioning policy for 0.x. The public names in `ui/` (`data-mero-*` attributes, `mero:*` events, `window.MeroUI` methods, `Mero-*` headers, `--mero-*` properties and the chart and Markdown exports) are recorded in `test/api-surface.json`, and a test fails when one is removed or renamed. From this release, changelog bullets that start with **Deprecated:** or **Breaking:** are the ones to read before an upgrade.
- **htmx pin:** Mero is tested against exactly htmx 4.0.2. `htmx.org` is an exact devDependency, and a test fails unless the htmx build the catalog and the browser tests load is byte for byte that release. The README install line names `htmx.org@4.0.2`; later 4.x releases are expected to work but are not tested until the pin moves.
- **Scripted swaps:** `htmx.swap({ text, target, swap })` without a `request` no longer raises an uncaught error from the re-read guard. The swap itself always happened; only the error is gone.
- **State events:** `mero:tab` fires on the newly selected tab, with `{ tab, panel }`, when a person changes the tab by click, arrow key, Home or End. `mero:toggle` fires on a `data-mero-toggle` button, with `{ pressed }`, after a click flips it. Both bubble and fire after the attributes are written, so a host script can follow these components without reading Mero-managed attributes. Neither fires at load or from `MeroUI.init()`. To follow a combobox choice, listen for the native `change` event on its input.
- **Alpine:** a browser test runs Mero next to Alpine 3.14.8 (the floor) and 3.17.5 (the current release, bumped by hand), with htmx's `hx-alpine-compat` extension, in both script orders. It covers Alpine listeners for `mero:selection`, `mero:tab`, `mero:toggle` and `mero:action`, `x-model.lazy` on a combobox, Alpine state and Mero re-initialising tabs across an `innerHTML` swap and a morph, and `MeroUI.init(el)` for tabs that `x-if` inserts. Nothing in `ui/` changed.
- **Reference:** two new sections, on the page and in the packed `agent-docs`. "State Mero owns" lists the native and ARIA state `mero.js`, `mero-forms.js` and `mero-live.js` write, per component, including the form-control values they set. "Headers" lists the five `Mero-*` headers with their direction and values. `data-mero-live-done` is now marked as set by Mero, and `MeroUI.toast` documents its `trigger` option. Documentation only; nothing in `ui/` changed.
- **Alpine reference:** a new "With Alpine or your own scripts" section in the reference, on the page and in the packed `agent-docs`, states only what the browser test asserts with Alpine 3.14.8 and 3.17.5: script order, listening for `mero:*` events, `mero:action` and its missing source identity, `x-model.lazy` on a combobox, htmx swaps and `MeroUI.init(el)` for markup Alpine inserts. The test gains one case: a value a script writes reaches `data-mero-dirty` and `data-mero-show-when` only after a bubbling `change`. The `mero-ui` skill points to the section. Nothing in `ui/` changed.

## 0.8.0 · 23 November 2026

- **Copy:** any button can copy a value with `data-mero-copy="…"` or another element's value or text with `data-mero-copy-target`, and confirms it with a notification. When the clipboard is blocked, Mero selects the text instead. The Button has a Copy to clipboard variant.
- **Local time:** `time[data-mero-time]` shows its `datetime` in the reader's locale and time zone, as an absolute date and time, a date, a time or a relative time that refreshes every minute. Typography has a Local time variant.
- **Keyboard shortcuts:** `data-mero-shortcut` binds a single key or a two-key sequence to a control, and `data-mero-shortcuts-toggle` turns single-key shortcuts off, as WCAG 2.1.4 requires. The Kbd has a Keyboard shortcuts variant.
- **Form state:** `data-mero-show-when="field=value"` shows and enables a branch only for the chosen values, and `form[data-mero-dirty]` enables submitting only after a change. The Fieldset has a Conditional fields variant.
- **Search and filter guard:** `form[data-mero-search]` never lets a failed read replace its list. Mero skips the swap of an error response or one without the `hx-select` region, explains it in `data-mero-search-error` and returns selects, checkboxes and radios to the filters the list shows. A redirected response without the region loads as a full page. The Search Field has a Filtered list variant.
- **Boosted navigation guard:** `data-mero-boost="#main"` on a boosted container makes the newest boosted GET win, turns a response without that region (a login or proxy error page) or a failed GET into a full page load, closes open drawers and moves focus to the new region unless the person moved it. Boosted forms that change data are never aborted. The Drawer has a Boosted navigation variant.
- **Focus continuity:** when any htmx swap or morph removes the focused element, focus returns to the same element, else the element with its ID, else the target's `data-mero-focus-fallback`, instead of falling to the page body. Mero acts only when focus was inside the swap target and is on the body afterwards, so it never takes focus from where the person moved it, and a server `autofocus` still wins. Add `data-mero-focus-manual` to keep handling focus yourself.
- **Live Progress:** `data-mero-live-follow` lets htmx act on `HX-Redirect`, `HX-Location` or `HX-Refresh` from an error response and stops polling, so a 401 for an expired session goes to the login page instead of retrying forever. A `data-mero-live-error` value replaces the default failure text, and `{time}` in it shows when the status was last confirmed. Live Progress has a Stale status variant.
- **Re-read after unknown:** `data-mero-action-reread="#region"` reads the current page again after an unknown outcome and morphs that region, so the person sees whether the action happened. Mero never repeats the action, and drops the answer when the page has moved on. The Action Button has a Re-read after unknown variant.
- **One-time credentials:** `data-mero-ephemeral` marks where a secret such as a new API token is shown. Mero empties it when its dialog closes, on a `data-mero-ephemeral-dismiss` button and when the page is hidden. `data-mero-hold` keeps the page while a request is pending or while held content is shown: Mero cancels boosted navigation and requests that would replace it, undoes Back and asks before unload. The Form has a One-time credential variant.
- **Form outcomes:** `data-mero-form` reports `succeeded`, `rejected` or `unknown` like the Action Button. The submit button gets `data-mero-action-state`, the form fires `mero:action`, and `Mero-Action-Outcome` and `Mero-Action-Message` override the state and the text. A `mero:form-saved` trigger now acts only on a succeeded outcome, so an error or unknown response can never close the dialog or announce a save. The Form has an Action outcome variant.
- **Outcome safety:** `data-mero-action-expect="selector"` turns a 2xx response without the expected content into `unknown` and skips its swap. `data-mero-action-unknown` sets the text for an unknown outcome or reveals a recovery panel. A request aborted after it was sent always reports `unknown`; only a request cancelled before it was sent clears the state. `data-mero-clear-passwords` empties a form's password fields after every response.

## 0.7.0 · 23 November 2026

- Try six HTMX 4 workflows in the playground. Review price changes with keyboard approval and undo, correct a spreadsheet before import, assign records from the command menu, publish across pages, share saved views and move cards together on a live board. [Open the workflows](https://mero-ui.rubenlangeweg.com/premium) · [Watch the seven captioned walkthroughs](https://mero-ui.rubenlangeweg.com/premium/watch)
- Run the workflows locally with `npm run demo:premium` from the source checkout. The Go and Rust quick starts each serve an inventory component and return an HTML fragment from a working handler. [Go example](https://mero-ui.rubenlangeweg.com/start#go) · [Rust example](https://mero-ui.rubenlangeweg.com/start#rust)
- The UI package now includes an offline component reference in `agent-docs/`. The repository also includes skills for building with Mero and contributing to the library. [Browse the component reference](https://mero-ui.rubenlangeweg.com/llms.txt)
- The catalog has a new wordmark and favicon. The header fits zoomed layouts, and the playground respects reduced motion when switching between workflows.

## 0.6.2 · 23 November 2026

- **Menu Button:** `menuitemradio` and `menuitemcheckbox` items get the same arrow-key, Home, End, typeahead, Escape and Tab handling as `menuitem`. The menu opens on its checked radio item, and checked items show a check mark. Mero does not change `aria-checked`; render it on the server.
- **Row peek:** add `data-mero-peek` around a table and a `<template data-mero-peek-body>` to each row. Space on a row link shows that row in a Preview panel beside the table, or in a bottom sheet below 768 px. The panel follows focus between rows, and Space or Escape closes it back to the row. It keeps its row through htmx swaps and morphs. The Sortable Table has a Row peek variant.
- Every script and stylesheet in `ui/` starts with `/*! @rubenlangeweg/mero-ui <version> | MIT */`, so a copied file shows which release it came from. `npm version` updates the line.

## 0.6.1 · 20 November 2026

- The test runner executes two files at a time. This keeps the full Firefox suite responsive on hosts where Node would otherwise start nine browser-test files at once. All three engines run the same tests.

## 0.6.0 · 20 November 2026

- Sortable Table and Filter Chips show labelled cards below 768 px. Sorting, row actions and focus on Back work in both layouts.
- Remote comboboxes activate only options returned for the current query, including when Firefox restores a saved draft. Escape and empty results clear the active option.
- Pull requests and releases run the complete test suite in Chromium, Firefox and WebKit. Publishing waits for all three.
- The command menu accepts named result groups. Arrow keys cross groups, Home and End reach the first and last result, and the live status counts selectable options.
- Live Progress polls a status fragment while the tab is visible, keeps the last good status when a read fails and stops at the server’s terminal response.
- Typed Confirmation gates destructive forms on an exact phrase and an optional required reason. It keeps the dialog open on validation errors, rejection and unknown outcomes.
- Copied form dialogs now return focus to their own controls. The quality review includes screen-reader checks for seven admin interactions.

## 0.5.1 · 20 November 2026

- A failed Studio view switch no longer replaces the workspace with the error response. htmx 4 swaps error responses by default.

## 0.5.0 · 20 November 2026

- **Breaking:** Mero targets htmx 4 only. htmx 2 is no longer supported, and `mero.js` no longer relays htmx 4 events under htmx 2 names.
- The Data Grid sorts from its column headers, filters by status with chips and a "+ Filter" menu, and moves Edit and Delete into a row Actions menu.

To upgrade:

1. Load htmx 4 (`htmx.org@4`) instead of htmx 2.
2. Send `HX-Trigger` instead of `HX-Trigger-After-Settle` for `mero:form-saved`. htmx 4 fires it after the swap settles. Add a `target` selector when the swap replaces the submitting form. A server that still sends `HX-Trigger-After-Settle` no longer closes the dialog.
3. Recopy templates that set `hx-*` attributes on a wrapper. They now use `hx-target:inherited` and similar names, which need htmx 4's default inheritance: remove `implicitInheritance` from your htmx config, because with it set htmx 4 ignores `:inherited` on ancestors. Only if you keep your 0.4 templates, set `implicitInheritance` instead. Do not mix the two.
4. Rename `hx-disabled-elt` to `hx-disable`.
5. Move your own listeners for htmx 2 events, such as `htmx:afterRequest` with `detail.xhr`, to htmx 4 events and `event.detail.ctx`.
6. Read the `HX-Target` request header as `tag#id`.

`hx-params` keeps working: `mero.js` applies it to the request fields.

## 0.4.0 · 20 November 2026

- **Menu Button:** a `role="menu"` popover now supports arrow keys, Home, End, typeahead, Escape and Tab, and focus returns to its button.
- **Action Button:** `data-mero-action` buttons outside a form show pending, succeeded, rejected or outcome-unknown states and fire `mero:action`. Requires `mero-forms.js`.
- **Sortable Table:** headers sort through plain `?sort=` links, rows open as links, and there is a compact layout.
- **Filter Chips:** applied filters show as removable chips with a "+ Filter" menu, all stored in the URL.
- **Command Menu:** `dialog[data-mero-command]` opens on Cmd or Ctrl K and searches results from your server.
- `data-mero-restore-focus` returns focus to the opened row after Back.
- Import the server helpers as `@rubenlangeweg/mero-ui/charts` and `@rubenlangeweg/mero-ui/markdown`. Paths under `ui/` still work.
- The docs list the `mero:*` events and the `window.MeroUI` functions and every `data-mero-*` attribute under [Reference](https://mero-ui.rubenlangeweg.com/docs/reference).

## 0.3.0 · 20 November 2026

- **Breaking:** the `rl-` prefix is now `mero-` in classes, `--mero-*` tokens and `data-mero-*` attributes. Workspace controls change from `rlw-` to `mero-ws-`, and `relay:*` events become `mero:*`.
- **Breaking:** the package files moved from `public/` to `ui/`.
- Mero runs on htmx 4 as well as htmx 2.

To upgrade, replace the prefixes in your templates and stylesheets and update the copy path.

## 0.2.0 · 20 November 2026

- First release: HTML components and HTMX examples for server-rendered apps.
