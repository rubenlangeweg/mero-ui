# Changelog

## Unreleased

- The Data Grid sorts from its column headers, filters by status with chips and a "+ Filter" menu, and moves Edit and Delete into a row Actions menu.

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
