# Changelog

## 0.9.0 · Unreleased

- **Stability:** the README now states the versioning and deprecation policy. The public names in `ui/` (`data-mero-*` attributes, `mero:*` events, `window.MeroUI` methods, `Mero-*` headers, `--mero-*` properties and the chart and Markdown exports) are recorded in `test/api-surface.json`, and a test fails when one is removed or renamed. From this release, changelog bullets that start with **Deprecated:** or **Breaking:** are the ones to read before an upgrade.

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
