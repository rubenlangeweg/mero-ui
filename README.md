# Mero UI

Mero UI works with Go, Rust and any backend that renders HTML. Copy a component into your server template, serve its CSS and JavaScript, and return HTML fragments for HTMX 4 requests. Your application can run without Node.js or npm.

[Website](https://mero-ui.rubenlangeweg.com) · [Component catalog](https://mero-ui.rubenlangeweg.com/components) · [Playground](https://mero-ui.rubenlangeweg.com/playground)

## Agent skills

Start at the [agent documentation index](https://mero-ui.rubenlangeweg.com/llms.txt) for the hosted catalog. Each component has a Markdown page with its variants, page assets and templates. The index also links to the integration patterns, public API reference and complete catalog. For offline use, open `node_modules/@rubenlangeweg/mero-ui/agent-docs/llms.txt` in releases that include it.

From your app's root, install the skill for building pages with Mero UI:

```sh
npx skills add rubenlangeweg/mero-ui --skill mero-ui
```

Try “Use Mero UI to add a sortable table with row previews to my inventory page.” The skill helps the agent find the matching template and assets, connect your routes and check the result after a swap.

When changing the library itself, run `npx skills add . --skill mero-ui-contribute` from the Mero source checkout. Try “Add a variant to the sortable table and verify the copied template on a plain page.”

## Use a component

[Download the browser assets](https://mero-ui.rubenlangeweg.com/start) into your static directory. Load the stylesheet and scripts in your page head.

```html
<link rel="stylesheet" href="/mero.css">
<script defer src="/vendor/htmx.min.js"></script>
<script defer src="/mero.js"></script>
```

### Try Go or Rust

Both [runnable examples](https://github.com/rubenlangeweg/mero-ui/tree/main/examples/backends) serve the same inventory button. From the repository root, choose one backend.

| Backend | Run | Guide |
| --- | --- | --- |
| Go 1.22+ with `net/http` and `html/template` | `cd examples/backends && go run ./go/main.go` | [Go quick start](https://mero-ui.rubenlangeweg.com/start#go) |
| Rust stable with Cargo and Axum | `cd examples/backends && cargo run --locked --manifest-path rust/Cargo.toml` | [Rust quick start](https://mero-ui.rubenlangeweg.com/start#rust) |

Open <http://127.0.0.1:4180> and choose **Check inventory**. Your handler returns an HTML fragment showing **6 products · 4 active**.

### Install with npm

Install Mero UI and HTMX from npm.

```sh
npm install @rubenlangeweg/mero-ui htmx.org@4.0.2
```

To skip the install, load a file straight from the tag, for example `https://cdn.jsdelivr.net/gh/rubenlangeweg/mero-ui@v0.8.0/ui/mero.css`.

Mero targets htmx 4 and is tested against htmx 4.0.2; later 4.x releases are expected to work but are not tested until the pin moves. Copy the Mero files you use from `node_modules/@rubenlangeweg/mero-ui/ui/` into your app’s static directory. The first line of each file names its release, for example `/*! @rubenlangeweg/mero-ui 0.8.0 | MIT */`, so a copied file shows which version it is. Serve `htmx.org/dist/htmx.min.js` at the path used in your HTML.

The Mero scripts listen to htmx 4 events and read `event.detail.ctx`. Load `mero.js` on every page that uses a Mero script.

- **Inheritance.** Wrapper attributes in the copyable markup are written as `hx-target:inherited`, `hx-swap:inherited`, `hx-sync:inherited` and so on, so they work on a plain htmx 4 page. Do not set `implicitInheritance`: with it set, htmx 4 ignores `:inherited` on ancestors. `hx-params` is a Mero attribute: `mero.js` filters the request fields, and the nearest `hx-params` wins.
- **Server responses.** Send `HX-Trigger: {"mero:form-saved":{"message":"Saved"}}` after a successful save. htmx 4 fires it after the swap settles. Add a `target` selector to the event detail when the swap replaces the submitting form. Read the `HX-Target` request header as `tag#id`. An error response other than the documented 422, 409 or 413 is never swapped into a Mero component, although htmx 4 swaps error responses by default.
- **The compatibility extension.** Do not load `htmx-2-compat` on a page with Mero scripts. It dispatches the old event names, which the Mero scripts do not read.

Serve `ui/mero.css` and `ui/mero.js` from your app. Include htmx 4 for examples with `hx-*` attributes. Each component page lists the optional CSS and JavaScript its family uses. The copyable markup works in any server template. A sortable table sorts on the server through plain `?sort=` header links, so it works without JavaScript. Filter chips work the same way: each chip, the "+ Filter" menu items and "Clear all filters" are links to the URL with that query parameter changed. A `role="menu"` popover gets arrow-key, Home, End, typeahead, Escape and Tab handling from `mero.js` for its `menuitem`, `menuitemradio` and `menuitemcheckbox` items. A menu opens on its checked `menuitemradio`; render `aria-checked` on the server. A `dialog[data-mero-command]` holding a remote combobox opens on Cmd or Ctrl K and runs the chosen server option; use one per page, and not alongside the workspace Command. The local catalog includes htmx 4.0.2 and Geist with their license notices.

### Preview a row

Add `data-mero-peek` around a table wrapper whose rows have a `.mero-row-link`, and put each row's preview in a `<template data-mero-peek-body>` inside that row. With a row link focused, Space opens an `aside` named "Preview" with the row's heading, the template's content, a Close button and an Open link to the row's `href`. While it is open, Up and Down Arrow, or Tab to another row, show that row instead. Space or Escape closes it and returns focus to the row. Focus is never trapped, and the panel announces updates politely. Give each row a stable `id` so the preview stays on it when a sort, filter or morph swap changes the row links. Below 768 px the preview is a bottom sheet over the cards. Without `mero.js` the templates stay inert and Space keeps its native behaviour.

```html
<div data-mero-peek>
  <div class="mero-table-wrap mero-table-cards">
    <table class="mero-table">
      <tbody>
        <tr id="product-2">
          <th scope="row"><a class="mero-row-link" href="/products/2">Halo Pendant</a><template data-mero-peek-body><dl><dt>SKU</dt><dd>RL-1002</dd></dl></template></th>
          <td>Lighting</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### Return focus after Back

Add `data-mero-restore-focus` to a list container. When someone opens a link in it and then presses Back, `mero.js` focuses that link again. This works after a full page load and after an HTMX history restore. Links are matched by their `href`, so keep row hrefs unique on the page. Mark one control in the container with `data-mero-focus-fallback`. It gets focus when an HTMX swap removes the focused element.

Use the [theme studio](http://127.0.0.1:4173/themes) to try colors, fonts and radii on real components or an app layout. Export the CSS, load it after `mero.css` and set `data-theme="light"` or `data-theme="dark"` on a document or section.

Media uses `mero-gallery` assets. Collections use `mero-collections`. Workspace controls use `mero-workspace`. Charts and conversation examples use `mero-insights`. Presentation utilities use `mero-composition`. Each pair comprises a stylesheet and a deferred script. Two optional server helpers render charts and a small Markdown subset. Import them as `@rubenlangeweg/mero-ui/charts` and `@rubenlangeweg/mero-ui/markdown`.

## Stability

Mero follows [semantic versioning](https://semver.org). Mero is 0.x and still young, so a minor release may break the public API. From 0.9.0 it never does so silently: the [changelog](CHANGELOG.md) marks every removal, rename or change in meaning as **Breaking:** in the release that makes it. Where it is cheap, a name is marked **Deprecated:** and keeps working for a release first. Patch releases do not break. Read those two bullets before each upgrade.

A test fails when one of these names disappears from `ui/`. The reviewed list is `test/api-surface.json`:

- `data-mero-*` attribute names
- `mero:*` event names
- `window.MeroUI` method names
- `Mero-*` request and response header names
- `--mero-*` custom property names
- the `renderChart` and `renderMarkdown` exports of `@rubenlangeweg/mero-ui/charts` and `@rubenlangeweg/mero-ui/markdown`

The same rule covers what the [reference](https://mero-ui.rubenlangeweg.com/docs/reference) and the catalog document, checked by review instead of a test: the element an event fires on, its `detail` keys and whether it bubbles, the values an attribute accepts, and the `.mero-*` classes in the catalog templates.

Mero's scripts set `--mero-shine-x`, `--mero-shine-y`, `--mero-tilt-x`, `--mero-tilt-y`, `--mero-diff-split`, `--mero-tooltip-shift` and `--mero-ws-first` while they run. The names are stable, so your CSS can read them, but do not set them yourself.

Everything else is internal and can change in any release: custom properties without the `mero-` prefix such as `--_height`, classes that no catalog template uses, and the `localStorage` and `sessionStorage` keys Mero writes (`mero-shortcuts`, `mero-focus:*` and `mero.split.*`). Do not read or write those keys.

## Upgrade from 0.4

Release 0.5 drops htmx 2. Load htmx 4, send `HX-Trigger` instead of `HX-Trigger-After-Settle`, and recopy templates that set `hx-*` attributes on a wrapper. The [changelog](CHANGELOG.md) lists every step.

## Upgrade from 0.2

The [changelog](CHANGELOG.md) lists every release.

Release 0.3 renames the `rl-` prefix to `mero-` in classes, `--mero-*` tokens and `data-mero-*` attributes. Workspace controls change from `rlw-` to `mero-ws-`, and `relay:*` events become `mero:*`. The package files moved from `public/` to `ui/`. Replace the prefixes in your templates and stylesheets and update the copy path.

## Take an example into another app

Download the [complete preview and source](http://127.0.0.1:4173/downloads/mero-ui.tar.gz), extract into an empty directory, then run `npm start`. For the smaller [standalone inventory example](http://127.0.0.1:4173/downloads/studio-inventory.tar.gz), see the [example instructions](examples/studio-inventory/README.md). The local server creates downloads with `tar`. The hosted site serves archives prepared during the build.

The [coverage map](docs/component-coverage.md) links the catalog to the original reference families. The [edit comparison](examples/edit-comparison/README.md) uses the same edit flow across three implementations.

The inventory form uses `mero-forms.js` for pending state, a replacement form on HTTP 422, and a successful `mero:form-saved` event. `mero-forms.js` also reports the outcome of standalone action buttons marked `data-mero-action`. The `Mero-Action-Outcome` (`succeeded`, `rejected` or `unknown`) and `Mero-Action-Message` response headers override the status-based state and its text. The host supplies validation, persistence and authorization in its own application. A chart table, campus map and chat assistant in the catalog use local sample data. The chat demo gives deterministic replies.

## Run the catalog locally

Use Node 22 or newer.

```sh
npm start
```

Open the [product page](http://127.0.0.1:4173/), [component catalog](http://127.0.0.1:4173/components) or [application layouts](http://127.0.0.1:4173/layouts). The docs cover [design principles](http://127.0.0.1:4173/docs/design-principles) and include a [resizable company directory](http://127.0.0.1:4173/docs/responsive-layouts). In the [playground](http://127.0.0.1:4173/playground), try an inventory edit, a failed form submission or a chart filter and inspect the returned HTML. The sample server listens on loopback and stores demo records in memory.

When serving the site on a public domain, set `MERO_SITE_ORIGIN` to its full origin, including `https://`. Mero uses it for canonical links, structured data and [the sitemap](http://127.0.0.1:4173/sitemap.xml). The local preview uses its loopback address.

## Verify

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
MERO_BROWSER=chromium npm test
MERO_BROWSER=firefox npm test
MERO_BROWSER=webkit npm test
npm run pack:ui
```

`npm version` stamps the new version into the first line of every script and stylesheet in `ui/`. After editing the version by hand, run `npm run banner`; a test fails while any file carries another version.

After adding a public name, run `node scripts/api-surface.mjs --write` and commit `test/api-surface.json`. `test/api-surface.test.mjs` fails while the snapshot and `ui/` differ, and names what was removed or added.

Each run uses two test files in parallel to keep browser sessions responsive on local machines. The npm package contains the UI assets. The downloadable preview includes the reference server and example routes. Browser checks and their environment options are documented next to the tests.

For a catalog-wide check, run `npm run audit:catalog -- --all`. The command starts an isolated server and emits a JSON result. To use existing installations, set `MERO_PLAYWRIGHT_MODULE`, `MERO_CHROME` and `MERO_AXE_PATH` to their local paths. The [quality review](docs/quality-review.md) records the issues fixed and the checks that still need a person.

To inspect spacing and alignment, run `MERO_REVIEW_DIR=visual-review npm run audit:catalog -- --all` and open `visual-review/index.html`. It includes actual-size screenshots of every default and named variant at both review sizes. The audit also checks each example at 320 px with enlarged text in both writing directions. Select a component name to open its live example. Generated captures stay local. [Component spacing and alignment standards](docs/component-standards.md)

## Deploy the website

Run `npm ci` and `npm run deploy` with Cloudflare credentials for the account that owns `rubenlangeweg.com` and `invrse.studio`. The build includes the downloadable examples and the Worker serves the interactive routes.

A Cloudflare Single Redirect on the `invrse.studio` zone sends requests for `mero-ui.invrse.studio` to `mero-ui.rubenlangeweg.com` with HTTP 308, preserving the path and query string.
