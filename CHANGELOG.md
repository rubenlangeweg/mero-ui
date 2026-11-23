# Changelog

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
