---
name: mero-ui
description: Use Mero UI in a server-rendered application. Use when adopting Mero, choosing a catalog component or layout, theming it, or wiring its HTML forms and fragments to the application's backend.
license: MIT
---

# Build with Mero UI

Start with the host app's template, static asset path and route handler. Mero ships HTML patterns, CSS and browser scripts. Keep the app's existing backend and template engine. The request examples below target Mero releases using HTMX 4 (0.5 onward).

## Find the matching example

- Identify the Mero release from the package lock, installed package metadata, or the banner on copied assets (0.6.2 onward). For older copies, check the original download URL or the commit that added the files. If the release is still unknown, ask which release was used or whether to upgrade the asset set together before choosing a template. Use the matching repository tag for existing apps. [Releases](https://github.com/rubenlangeweg/mero-ui/releases) · [Quick start](https://mero-ui.rubenlangeweg.com/start)
- Choose a component **and variant**. Copy **Template** and the tags under **Use in your app**. For a full screen, start with the closest layout, then look up the controls it uses. The hosted catalog tracks the deployed version. [Components](https://mero-ui.rubenlangeweg.com/components) · [Layouts](https://mero-ui.rubenlangeweg.com/layouts)
- Run the bundled helper with Node 22+ from the root of a trusted checkout of the matching Mero release. Use the script path in this installed skill. The helper executes the checkout's catalog modules. The app itself can run without Node.

```sh
node /path/to/mero-ui/scripts/catalog.mjs list
node /path/to/mero-ui/scripts/catalog.mjs show sortable-table 'Row peek'
```

## Adapt the template

1. Serve the listed files at your app's static URLs. The npm release tarball keeps Mero assets under `ui/`. For templates that issue requests, load HTMX 4 before `mero.js`, then the component's deferred scripts. A form or live region can need an extra script even in the core family.
2. Replace sample records and demo URLs with the app's data and routes. Preserve labels, ID references, focus targets and native links or form actions present in the example. Give repeated instances distinct IDs or retain the example's `data-mero-scope` wrapper.
3. Keep validation, persistence and permissions in the host handler. On HTTP 422, return the filled replacement form with the invalid field marked. After a successful save, send `HX-Trigger: {"mero:form-saved":{"message":"Saved"}}`. For Typed Confirmation (`data-mero-confirm`), also send `HX-Reswap: none` on success. The original form holds the request state Mero checks before closing the dialog and returning focus. For other forms that the success response replaces, set the event detail's `target` to the surviving form's selector. [Mero reference](https://mero-ui.rubenlangeweg.com/docs/reference)
4. For a theme change, export or override `--mero-*` tokens in CSS loaded after the base stylesheet. Set `data-theme="light"` or `data-theme="dark"` on the document or section. [Theme studio](https://mero-ui.rubenlangeweg.com/themes)

## Check the interaction

Exercise the result through the host page. For a request, inspect the method, URL, status, response HTML and actual swap target. Try a second interaction after the swap. For a dialog form, submit an invalid value, correct it, save and check where keyboard focus lands.

Use explicit wrapper inheritance such as `hx-target:inherited` with the default HTMX 4 configuration. Mero implements `hx-params` itself. When a request misbehaves, check the network exchange and the component's required assets before changing the template. Use the upstream guide for the task at hand. [HTMX 4 guidance](https://raw.githubusercontent.com/bigskysoftware/htmx/v4.0.0/dist/skills/htmx-guidance.md) · [Debugging](https://raw.githubusercontent.com/bigskysoftware/htmx/v4.0.0/dist/skills/htmx-debugging.md) · [Upgrading from HTMX 2](https://raw.githubusercontent.com/bigskysoftware/htmx/v4.0.0/dist/skills/htmx-upgrade-from-htmx2.md)
