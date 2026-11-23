---
name: mero-ui-contribute
description: Implement or change reusable components in the Mero UI library repository. Use for catalog variants, shipped CSS and browser behavior, component reference updates, and verification of copyable templates.
license: MIT
---

# Implement a Mero UI component

Start in the Mero source checkout. Find the closest existing component by ID or visible name. Decide whether the requested behavior belongs in its default example, a named variant, or a new catalog entry.

## Find the owning files

| Change | Where it belongs |
| --- | --- |
| Core template or variant | Find the family in `site/core/`. Reuse its `item`, `rendered` and `section` helpers. `site/core-components.mjs` collects the groups. |
| Gallery, collection, workspace, insight or composition component | Follow the family module imported by `site/catalog.mjs`. Its registry builds the component index and rejects duplicate IDs. |
| Shipped styles and behavior | Edit the owning files in `ui/`. Reuse the base tokens and existing delegated handlers. Site-only styles and scripts live in `public/`. |
| Assets shown to adopters | Inspect `exampleAssets` in `site/catalog-pages.mjs`. The result depends on the family and the selected variant's markup. Check both **Template** and **Use in your app**. |
| Public hook or event | Document it in `site/reference.mjs`. Mark runtime-managed attributes the same way as neighboring entries. Check `test/reference.test.mjs`. |

## Implement the contract

Keep the copyable template usable in a plain host. Scope repeated IDs, preserve label and ARIA relationships, and use the existing family patterns for keyboard interaction and focus after swaps. For a query-driven component, render from the request parameters so the URL can reproduce its state. Follow the closest component's handler through `server.mjs` when the example needs a fragment.

For HTMX requests, preserve Mero's explicit wrapper inheritance, v4 event names and `event.detail.ctx` contract. Use the release's debugging guide for request or swap failures. Read the extension-authoring guide when implementing an HTMX extension. [Debugging](https://raw.githubusercontent.com/bigskysoftware/htmx/v4.0.0/dist/skills/htmx-debugging.md) · [Extension authoring](https://raw.githubusercontent.com/bigskysoftware/htmx/v4.0.0/dist/skills/htmx-extension-authoring.md)

## Verify what adopters copy

- Run `node --test test/catalog-release.test.mjs test/reference.test.mjs` and the test covering the affected family. Use the repo's browser setup when the interaction changes.
- Open `/components/<id>` and `/preview/<id>` with the requested variant. Put the copied template and its listed assets on a plain host page. If intended for repeated use, render it twice and operate the second copy. Check the first copy, keyboard focus and the next interaction after a swap.
- Audit the affected routes, for example `npm run audit:catalog -- /components/sortable-table '/preview/sortable-table?variant=Row%20peek'`. Use `docs/component-standards.md` for measurements and narrow-layout checks. For changed shipped assets, also run `npm run pack:ui` and check the files in the package listing.
