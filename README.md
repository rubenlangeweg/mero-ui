# Mero UI

A component library for server-rendered HTML and HTMX. Browse working examples, copy the displayed template, and inspect the response from examples that make HTTP requests.

[Website](https://mero-ui.invrse.studio) · [Component catalog](https://mero-ui.invrse.studio/components) · [Playground](https://mero-ui.invrse.studio/playground)

## Run locally

Use Node 22 or newer.

```sh
npm start
```

Open the [product page](http://127.0.0.1:4173/), [component catalog](http://127.0.0.1:4173/components) or [application layouts](http://127.0.0.1:4173/layouts). The docs cover [design principles](http://127.0.0.1:4173/docs/design-principles) and include a [resizable company directory](http://127.0.0.1:4173/docs/responsive-layouts). In the [playground](http://127.0.0.1:4173/playground), try an inventory edit, a failed form submission or a chart filter and inspect the returned HTML. The sample server listens on loopback and stores demo records in memory.

When serving the site on a public domain, set `MERO_SITE_ORIGIN` to its full origin, including `https://`. Mero uses it for canonical links, structured data and [the sitemap](http://127.0.0.1:4173/sitemap.xml). The local preview uses its loopback address.

## Use a component

Install the UI assets and HTMX with `npm install @rubenlangeweg/mero-ui htmx.org@2`. Copy the Mero files you use from `node_modules/@rubenlangeweg/mero-ui/public/` into your app’s static directory. Serve `htmx.org/dist/htmx.min.js` at the path used in your HTML.

Serve `public/mero.css` and `public/mero.js` from your app. Include HTMX 2.x for examples with `hx-*` attributes. Each component page lists the optional CSS and JavaScript its family uses. The copyable markup works in any server template. The local catalog includes HTMX 2.0.11 and Geist with their license notices.

```html
<link rel="stylesheet" href="/mero.css">
<script defer src="/vendor/htmx.min.js"></script>
<script defer src="/mero.js"></script>
```

Use the [theme studio](http://127.0.0.1:4173/themes) to try colors, fonts and radii on real components or an app layout. Export the CSS, load it after `mero.css` and set `data-theme="light"` or `data-theme="dark"` on a document or section.

Media uses `mero-gallery` assets. Collections use `mero-collections`. Workspace controls use `mero-workspace`. Charts and conversation examples use `mero-insights`. Presentation utilities use `mero-composition`. Each pair comprises a stylesheet and a deferred script. The two optional server helpers in `public/insight-*.mjs` render charts and a small Markdown subset.

## Take an example into another app

Download the [complete preview and source](http://127.0.0.1:4173/downloads/mero-ui.tar.gz), extract into an empty directory, then run `npm start`. For the smaller [standalone inventory example](http://127.0.0.1:4173/downloads/studio-inventory.tar.gz), see the [example instructions](examples/studio-inventory/README.md). The local server creates downloads with `tar`. The hosted site serves archives prepared during the build.

The [coverage map](docs/component-coverage.md) links the catalog to the original reference families. The [edit comparison](examples/edit-comparison/README.md) uses the same edit flow across three implementations. The [responsive layout and documentation research](docs/review/responsive-layouts-and-documentation.md) compares established systems and sets out the proposed mobile and documentation pilots.

The inventory form uses `mero-forms.js` for pending state, a replacement form on HTTP 422, and a successful `mero:form-saved` event. The host supplies validation, persistence and authorization in its own application. A chart table, campus map and chat assistant in the catalog use local sample data. The chat demo gives deterministic replies.

## Verify

```sh
npm test
npm run pack:ui
```

The npm package contains the UI assets. The downloadable preview includes the reference server and example routes. Browser checks and their environment options are documented next to the tests.

For a catalog-wide check, use a contributor environment with Playwright, Chromium and axe-core installed, then run `npm run audit:catalog -- --all`. The command starts an isolated server and emits a JSON result. To use existing installations, set `MERO_PLAYWRIGHT_MODULE`, `MERO_CHROME` and `MERO_AXE_PATH` to their local paths. The [quality review](docs/quality-review.md) records the issues fixed and the checks that still need a person.

To inspect spacing and alignment, run `MERO_REVIEW_DIR=visual-review npm run audit:catalog -- --all` and open `visual-review/index.html`. It includes actual-size screenshots of every default and named variant at both review sizes. The audit also checks each example at 320 px with enlarged text in both writing directions. Select a component name to open its live example. Generated captures stay local. [Component spacing and alignment standards](docs/component-standards.md)

## Deploy the website

Run `npm ci` and `npm run deploy` with Cloudflare credentials for the account that owns `invrse.studio`. The build includes the downloadable examples and the Worker serves the interactive routes.
