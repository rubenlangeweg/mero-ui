# Edit comparison

Mero handled a complete edit with zero application-specific JavaScript. The daisyUI and free HeroUI styles versions passed the same checks with one shared 28-line host adapter. This result supports packaging the form behavior for teams that use it across screens. Developer setup time and the quality of the visual design need separate assessment.

## Run locally

From the repository root with Node 22 or later, run the optional stylesheet setup once, then start the comparison server.

```sh
node examples/edit-comparison/styles.mjs
node examples/edit-comparison/server.mjs
```

Open [the comparison](http://127.0.0.1:4184/). The navigation switches among Mero, daisyUI and free HeroUI CSS. All three use the same record, endpoint and form template in a browser session. The demo server stores changes in memory and listens on loopback. Enter `TAKEN` in the SKU field for a validation failure. Choose **Service unavailable** to exercise recovery.

The optional setup fetches pinned npm archives, verifies each extracted stylesheet’s SHA-256 and caches the CSS and license texts in the system temporary directory. The browser uses local assets. Mero also runs independently of the optional styles. [daisyUI 5.8.1, MIT](https://www.npmjs.com/package/daisyui/v/5.8.1) · [HeroUI styles 3.2.7, Apache 2.0](https://www.npmjs.com/package/@heroui/styles/v/3.2.7) · [Pinned files and digests](styles.mjs)

## Measured on 20 November 2026

| Check | Mero | daisyUI | Free HeroUI CSS |
| --- | --- | --- | --- |
| Native dialog opens and loads the form over HTMX | Pass | Pass | Pass |
| Save disables and form reports busy during the delayed request | Pass | Pass | Pass |
| Duplicate SKU returns HTTP 422, preserves the draft and focuses SKU | Pass | Pass | Pass |
| HTTP 503 displays an error and enables retry with the draft intact | Pass | Pass | Pass |
| Successful retry updates the row, closes the dialog and focuses Edit | Pass | Pass | Pass |
| Change survives reload and Escape returns focus after reopening | Pass | Pass | Pass |
| Application-specific browser behavior for this edit | 0 lines | 28 lines | Same 28 lines |

Verified using Chromium 158.0.8127.36 at a 390 × 844 viewport, HTMX 2.0.11 and the local Mero source. The comparison counts nonblank, noncomment source lines including braces. The styles-only adapter is 1,215 unminified source bytes including its comment. This measures one working implementation. Different applications can express the behavior in different ways. [Host adapter](baseline.js) · [Browser checks](verify.mjs)

All versions use the native dialog commands and HTMX’s declarative request synchronization and submit disabling. The shared HTML includes all three sets of style classes and the Mero form attributes. The styling libraries use one host adapter for busy state, field focus, field-error swaps, failure feedback and restoring focus to the updated record. Mero ships these behaviors in its core and optional forms script. All versions use the same HTTP 422 form fragment and successful out-of-band row with a settled event. [Shared template and routes](server.mjs) · [Mero forms](../../public/mero-forms.js) · [HTMX submit disabling](https://htmx.org/attributes/hx-disabled-elt/)

## Repeat the check

Use a local Playwright installation with Chromium. The verification script starts an isolated loopback server and fresh browser contexts. Set `PLAYWRIGHT_MODULE` to an existing Playwright ESM module path and `CHROME_PATH` to an installed Chrome executable when needed. Optional `COMPARISON_SCREENSHOTS` writes the three open-dialog images to the directory you specify.

```sh
node examples/edit-comparison/verify.mjs
```
