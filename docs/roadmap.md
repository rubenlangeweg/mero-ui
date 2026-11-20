# Mero UI · Release 0.2 plan and results

**Local release 0.2 ships 162 catalog examples and the portable Studio Inventory.** In the edit comparison all three implementations passed validation, retry and focus checks. Mero needed zero lines of application-specific browser code for that flow. The two styling alternatives shared a 28-line adapter. The first-time developer trial and manual VoiceOver review remain open. [Coverage map](component-coverage.md) · [Measured comparison](../examples/edit-comparison/README.md)

**Build Studio Inventory as the first complete Mero block.** Someone should be able to try the product on the homepage, open that exact record, change it, and take the working screen back to their own HTMX app. The next release is a local preview. Origo is a possible consumer once the block earns its place.

## Starting position before release 0.2

The catalog has 72 examples across 15 groups. Four individual examples issue HTMX requests directly. The richest example already sits outside that catalog. Inventory handles search, filters, create, edit, confirmed delete, and server validation. The dashboard also updates its counters after a save. Today its copy button gives you a shell with two hardcoded counters. The inventory stylesheet is absent from the packaged assets. Closing that gap delivers more value than adding another component. [Catalog](../site/core-components.mjs) · [Inventory](../site/lab.mjs) · [Dashboard preview and copy](../server.mjs) · [Package contents](../package.json)

The graphite workspace, lamp photography and overlapping panels give Mero a recognizable look. The three finishes select a radio, but the lamp image stays ivory and the lamp itself is missing from the inventory. That is the clearest opportunity to make the homepage feel like a product. [Studio showcase](../site/pro-stage.mjs) · [Inventory records](../site/lab.mjs)

## What the benchmarks change

| Benchmark | What it does well | Decision for Mero |
| --- | --- | --- |
| HeroUI | Its free styles package already works in plain HTML. Outside React, complex keyboard behavior, focus and ARIA are the implementer's responsibility. [Framework guide](https://heroui.com/en/docs/react/getting-started/frameworks#other-frameworks) | Use free HeroUI CSS plus stock HTMX as the build-versus-buy baseline. Mero should earn its place at the point a server response changes the screen. |
| HeroUI Pro | The dashboard preview connects orders, tracking and settings. The mail preview connects folders, threads and compose. You can judge how the screens fit together. [Live templates](https://heroui.pro/docs/react/templates) | Give Studio one product record across the showcase, workspace and drawer. Use original Mero templates and artwork. |
| Blossom Carousel | Native scrolling and CSS snap provide the foundation. The vanilla drag engine can load only for a fine pointer and has an explicit teardown. The cover-flow example exposes the CSS behind the effect. [Core](https://blossom-carousel.com/docs/framework-guides/core) · [Cover flow](https://blossom-carousel.com/docs/examples/advanced/cover-flow) | Try one tactile media gallery. Keep the gesture local, use HTMX when opening a record, and make the effect inspectable. |
| HTMX UI and Basecoat | HTMX UI already offers 61 components, including remote search and dialogs. Basecoat offers standalone CSS, optional scripts and server-template examples. [HTMX UI catalog](https://susonwaiba.github.io/htmx-ui/docs/components/) · [Basecoat installation](https://basecoatui.com/installation/) · [Server templates](https://basecoatui.com/templates/) | A developer should be able to take the whole workflow, including failures and server responses, into their existing stack. |
| shadcn/ui | Blocks put a live preview, source tree, code and an install action together. [Dashboard block](https://ui.shadcn.com/blocks) | Put the exact template and fragments beside the preview. Generate the preview and downloadable example from the same files. |
| React Aria | Its published quality criteria cover input methods, browser and assistive technology combinations. [Quality guide](https://react-aria.adobe.com/quality) | Verify the screen after its DOM changes. A visually correct drawer can still leave keyboard focus on a deleted row. |

## Delivery order

### 1. Set the baseline with the edit drawer

Give Mero and daisyUI plus stock HTMX the same edit endpoint, visual brief and duplicate-SKU error. daisyUI explicitly supports this stack. Use free HeroUI CSS on the same markup as a visual reference. Record setup time, the browser code each host has to write, and which focus or error cases still fail. Timebox the comparison to one day. If both implementations require comparable integration work and pass the same checks, narrow Mero to the reusable workflows and revisit the cost of maintaining its own primitives. [daisyUI HTMX guide](https://daisyui.com/htmx-component-library/?lang=en) · [Component gap map](component-gap-map.md)

### 2. Ship the full Studio Inventory block

Use the existing inventory as the source. Expose the responsive table, search, category filter, sort, edit drawer and delete confirmation as a copyable block with scoped CSS, its HTML fragments and a runnable local reference server. Scope DOM IDs and targets so two blocks can coexist. Give consumers control over URLs, colors and navigation. Check the graphite theme, light theme and an Origo-style token override in a local fixture.

Keep the API small. Create and edit open a form. Delete opens a confirmation. All three use ordinary HTMX requests and the existing `data-mero-form` behavior. The host owns validation and persistence. Mero owns pending feedback, error presentation and focus after a swap. [Form behavior](../ui/mero-forms.js) · [Existing routes](../server.mjs)

| Exchange | What the host returns | What the user sees |
| --- | --- | --- |
| Open create, edit or delete | A dialog fragment with the form or confirmation | Focus enters the dialog. Cancel returns to the opener. |
| Invalid save | HTTP 422 with the filled-in form and field errors | The drawer stays open. The draft survives and the invalid field receives focus. |
| Successful mutation | HTTP 200, out-of-band results and affected counters, `HX-Reswap: none`, and `HX-Trigger-After-Settle` carrying `mero:form-saved` | Filtered results and counts agree. Focus returns to the edited item or a surviving control after deletion. |
| Failed request | An error status, or no response on connection loss | Preserve the draft. If a save response was lost, help the user check whether the change landed before submitting again. |

### 3. Make the site demonstrate the difference

Connect the homepage lamp to the same inventory record. Choosing Graphite should show the graphite lamp from the same camera angle. Opening the product carries that selection into the drawer. Saving it visibly updates the record. Carry the care in the hero through to mobile density, focus rings, field errors and the row that just changed.

Give the block page a **Preview**, its **Template** and the **HTTP exchange**. The last view shows the actual local demo request, status, relevant response headers and returned fragment. Let the visitor slow a save, submit a duplicate SKU, trigger a failed request and reset the example. Keep this inspector in the docs site so applications only load the library assets they use.

Use motion at moments where it answers a question. The drawer enters from the edge, the updated row briefly catches the eye, and the layout stays steady while a save is pending. With reduced motion, the saved state remains legible through text and focus. [Spectrum motion](https://spectrum.adobe.com/page/motion/)

Give the lamp gallery its own release decision after the inventory block works. Compare native scroll snap against optional Blossom desktop drag. Ship drag only if it improves mouse browsing, touch and keyboard controls work independently, and removing the gallery during an HTMX swap cleans up the instance. [Blossom accessibility](https://www.blossom-carousel.com/docs/a11y/accessibility-guide) · [HTMX lifecycle](https://htmx.org/events/)

## Release check

After the edit comparison, one agent can own the portable block and routes, another the showcase and inspector, and a third the clean-app fixture and browser checks. Agree on the response examples above first. The final integration review uses the exported block.

| Owner | Evidence to bring back |
| --- | --- |
| Block engineer | Run the exported example in a fresh server app using only documented assets and routes. Match the preview on desktop and mobile. Mount two copies and edit one independently. |
| Interaction engineer | Exercise create, edit, cancel and confirmed delete in Chromium, Firefox and WebKit. Verify a delayed search cannot overwrite a later save, double submit sends one mutation, and a 422 or failed request preserves the draft. Record the exact focus destination on cancel, invalid save, success and delete. [HTMX request coordination](https://htmx.org/attributes/hx-sync/) · [Dialog keyboard guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) |
| Design and accessibility reviewer | Review the actual export in both themes, at phone width and with reduced motion. Complete the flow by keyboard and with VoiceOver in Safari. Check that the save is announced once and the edited field or row is easy to find. |
| Developer trying Mero for the first time | Starting from the block page and a supplied backend fixture, get a first successful edit and a handled validation error. Proposed target is 15 minutes with no application-specific browser JavaScript. Record time and workarounds. Use the same task and server responses for the baseline comparison. |

The three checked-in Node tests pass and cover catalog metadata, validation and rendered results. The private package dry run contains four runtime assets. Current gzip sizes are 5,879 bytes for core CSS, 4,215 for core JavaScript and 998 for the optional forms script, excluding HTMX. Compare those sizes on the release and keep gallery code off pages that do not use it. Browser, assistive technology and adoption checks above are proposed release criteria. [Tests](../test/lab.test.mjs) · [Package manifest](../package.json)

## Next priorities

The playground now runs inventory edits, settings validation and a dispatch report against local endpoints. Each workflow has a copyable template and a log of the eight most recent requests. The first handbook page covers action hierarchy, focus after a save and control spacing. [Playground](http://127.0.0.1:4173/playground) · [Design principles](http://127.0.0.1:4173/docs/design-principles)

1. **Try one Origo control-plane edit.** Give a developer a clean local fixture and the quick start. Can they save a change and recover from an HTTP 422 within 15 minutes? Record any extra JavaScript or undocumented server behavior. Check that same flow with VoiceOver and on a physical phone. Keep Origo’s colors and navigation.
2. **Write the handbook around what that trial exposes.** Start with a worked server route and its HTML response. Cover theme tokens, motion and focus after a swap using links to working examples. Then generate a small `llms.txt` index from the component registry so agents can find those same examples. [HeroUI handbook and agent resources](https://heroui.com/en/docs/react/getting-started/design-principles)
3. **Deepen one component.** Both date-range examples currently use two native date fields. Try a scheduling task that needs a visible month, keyboard range selection and unavailable days. Use it to decide the API and check the result with a keyboard and screen reader. [Current range calendar](http://127.0.0.1:4173/components/range-calendar)

The playground’s Template tab is read-only. If developers need to change the swap target or response shape during the trial, the next playground feature should be an editable example with its own data and a reset button.
