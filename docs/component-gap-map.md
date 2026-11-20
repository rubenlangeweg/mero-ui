# Mero UI component gap map

**Implementation update · 20 November 2026.** The following research records the starting position. The [current coverage map](component-coverage.md) links each benchmark family to the shipped Mero example and describes its implementation limits.

**Build a media gallery and an editable collection as Mero’s first two flagship components.** One lets people feel the quality with a mouse, touch or keyboard. The other shows why Mero is worth using with a server. Both should appear on the product page, use the shipped library and open directly into their own documentation.

## What exists today

Reviewed 20 November 2026. I counted 65 named entries in HeroUI Pro’s public **web** index. Mero has 72 catalog examples aimed at the free HeroUI list. daisyUI lists 68 entries. Each catalog counts different things. For example, Mero’s Range Calendar and Date Range Picker both render a pair of date inputs. Pro’s Agenda is an event scheduler with day, week and month views. [HeroUI Pro index](https://heroui.pro/docs/react/components) · [Agenda](https://heroui.pro/docs/react/components/agenda/) · [daisyUI index](https://daisyui.com/components/) · [Mero catalog](../site/core-components.mjs)

### HeroUI Pro coverage

The middle column identifies existing functionality worth keeping. A site-only example still needs packaging and an independently usable API. The last column lists families for which I found no dedicated Mero equivalent. A generic button, picker or card can still be a useful part of their implementation. This is a comparison of public capabilities, not a certification of identical behavior. [Pro catalog and variants](https://heroui.pro/docs/react/components) · [Mero examples](../site/core-components.mjs) · [Shipped asset list](../package.json)

| Pro family | Existing Mero counterpart or partial implementation | Missing as a component |
| --- | --- | --- |
| Data Display · 18 | **Data Grid** has a searchable, editable inventory table. **Empty State** exists inside its results. **KPI** and **KPI Group** have basic packaged stat styles. **Item Card**, **Item Card Group** and **Widget** have site-only compositions in Studio. | Action Bar, Agenda, Carousel, File Tree, Floating TOC, Holo Card, Hover Card, Kanban, List View, Map, Timeline. |
| Forms · 11 | **Native Select** has a direct basic equivalent. **Radio Button Group** has selectable finish cards on the homepage. **Checkbox Button Group**, **Cell Switch** and **Number Stepper** have simpler grouped checkboxes, a labelled settings switch and a bounded number field respectively. | Cell Color Picker, Cell Select, Cell Slider, Drop Zone, Inline Select, Rich Text Editor. Mero ships standalone color, select and range inputs. |
| Navigation · 7 | **AppLayout** and **Sidebar** have a basic packaged responsive shell. **Navbar** is site-only. **Command** has a docs search shortcut. **Segment** has the single-choice behavior of Mero’s radio row. | Context Menu, Stepper. |
| Feedback · 5 | **Pressable Feedback** has a button press state. | Emoji Reaction Button, Number Value, Rating, Trend Chip. |
| Layout · 1 | The app shell has fixed responsive regions. | Resizable. |
| Overlays · 1 | Mero already has a dialog, sheet, drawer and popover in its core. | Emoji Picker. |
| Charts · 8 | Mero can display totals and progress. | Area Chart, Bar Chart, Chart Tooltip, Composed Chart, Line Chart, Pie Chart, Radar Chart, Radial Chart. |
| AI · 14 | **Code Block** has a syntax-highlighted, copyable implementation in the docs site. | Chain Of Thought, Chat Attachment, Chat Conversation, Chat List View, Chat Loader, Chat Message, Chat Message Actions, Chat Source, Chat Tool, Markdown, Prompt Input, Prompt Suggestion, Text Shimmer. |

Three distinctions matter when scoping work. Pro’s grid supports row selection and column operations beyond the current inventory table. A bulk Action Bar responds to a selection, while Mero’s Toolbar always shows its actions. Cmd/Ctrl-K on the Mero docs focuses a navigation filter. A command palette should also discover and execute actions, support arrow keys and restore focus. [Pro Data Grid](https://heroui.pro/docs/react/components/data-grid/) · [Pro catalog](https://heroui.pro/docs/react/components#navigation) · [Mero inventory](../site/lab.mjs) · [Docs shortcut](../public/site.js)

### What daisyUI adds to the decision

daisyUI already explicitly supports HTMX. Put semantic classes on a native element and let HTMX request and swap the HTML. The CSS also applies to inserted fragments. Use this combination as the direct alternative when evaluating the amount of code a Mero consumer must write. HeroUI Pro remains the reference for depth of interaction and product composition. [daisyUI’s HTMX guide](https://daisyui.com/htmx-component-library/?lang=en) · [Pro introduction](https://heroui.pro/docs/react/getting-started)

| daisyUI example | What I would take into Mero |
| --- | --- |
| Button, Join and Filter | Keep one base class and a few predictable modifiers. Show how the same search, select and reset controls join into a toolbar at desktop width and wrap on mobile. [Button API](https://daisyui.com/components/button/) · [Join](https://daisyui.com/components/join/) · [Filter](https://daisyui.com/components/filter/) |
| Carousel, Hover Gallery and Diff | One media gallery should cover swipe, thumbnail selection and desktop pointer preview. Diff is a distinct later use case for comparing two photos. [Carousel](https://daisyui.com/components/carousel/) · [Hover Gallery](https://daisyui.com/components/hover-gallery/) · [Diff](https://daisyui.com/components/diff/) |
| File Input and Validator | The native file picker is the first usable version of an upload component. Add drop support and show what happens when the backend rejects the file. [File Input](https://daisyui.com/components/file-input/) · [Validator](https://daisyui.com/components/validator/) |
| Scoped themes | Put a light component on the graphite docs page and an Origo-styled instance next to it. Mero currently puts light variables on `:root`. A nested light scope inside a dark parent needs explicit values. [daisyUI themes](https://daisyui.com/docs/themes/) · [Mero tokens](../ui/mero.css) |

### What the HTMX thread means for the API

The commenter prefers returning a custom HTML element for a single record and a wrapper containing one element per record for a list. That is an author's convention. Standard HTMX also works with a server template that emits ordinary HTML. The following is a proposed API example. [Original discussion](https://www.reddit.com/r/htmx/comments/193hri5/ui_component_libraries/) · [Official HTMX edit-row example](https://htmx.org/examples/edit-row/)

```html
<button hx-get="/products/42/card" hx-target="#product-42" hx-swap="outerHTML">Refresh</button>
<article id="product-42" class="mero-card">Arc Task Lamp · Ivory</article>
```

After a finish change, that endpoint could return `<article id="product-42" class="mero-card">Arc Task Lamp · Graphite</article>`. The host can write a single `productCard(product)` template and reuse it on the full page and in the endpoint. The browser receives a complete card in both cases. In the commenter’s version, the outer tag might instead be `<product-card id="product-42">`. Browser-defined behavior for that tag comes from registering a custom element. [HTMX swap modes](https://htmx.org/attributes/hx-swap/) · [Custom element registration](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)

**Mero’s default should be native HTML, short CSS classes and server-rendered fragments.** Consider one optional light-DOM custom element for the gallery if encapsulating drag setup and teardown materially simplifies integration. Keep images and links in server-rendered HTML. A Shadow DOM implementation adds an integration cost because HTMX needs to process the shadow root explicitly. [HTMX Web Components guide](https://htmx.org/examples/web-components/)

## What to build, in order

1. **Fix the foundations touched by the first two components.** In Chrome, activating a tab in the second of two copied examples changed the first example’s panel. An unmatched remote autocomplete query returned the correct empty message, then hid it. Make both cases repeatable regression tests. Exercise two mounted copies before and after an HTMX swap. [Tab and combobox runtime](../ui/mero.js) · [Catalog fragments](../site/core-components.mjs)
2. **Ship the media gallery alongside the first editable collection.** Let a visitor switch the lamp finish, inspect its material up close, swipe through photos, then open the same item for editing. The collection gets server sorting and filtering, row selection, an action bar, and useful empty and failure states. Keep it a semantic table with normal focusable controls until a use case requires spreadsheet navigation. Extract the existing inventory implementation. [Current showcase](../site/pro-stage.mjs) · [Current table](../site/lab.mjs) · [Inventory delivery plan](roadmap.md)
3. **Make navigation and settings reusable.** Package the responsive AppLayout and Sidebar with a mobile drawer, add Command for searching and executing actions, and ship settings rows with switch, select, grouped choices and inline validation. Prove them in both Studio and a local tenant-themed example. The host supplies routes, labels, colors and navigation order.
4. **Expand from actual screens.** An analytics screen justifies KPI, Trend Chip and a line or bar chart with accessible data. A media workflow justifies File Input and Drop Zone. Agenda, Kanban, Map, the rich-text editor and the AI family each introduce a separate interaction model. Prioritize one when there is a full screen that will use it.

## Craft across the library

Give each component family one example a visitor can recognise, operate and copy. Mero already has shared light and dark tokens, focus rings, motion timings and reduced-motion rules. Its catalog gives each entry one preview and one code sample. The real settings form disables Save during a request and exposes an error on failure. Show those states on the component page too. [Mero styles](../ui/mero.css) · [Catalog renderer](../server.mjs) · [Settings](../site/layouts.mjs) · [Form behavior](../ui/mero-forms.js)

| Public reference | What to carry into Mero |
| --- | --- |
| Jesper Vos’s Blossom lets people drag a real scroll surface. Its cover-flow example publishes the CSS that ties perspective to scroll position. The accessibility guide distinguishes a simple product rail from a single-slide carousel. [Blossom](https://blossom-carousel.com/) · [Cover flow](https://blossom-carousel.com/docs/examples/advanced/cover-flow) · [Accessibility](https://blossom-carousel.com/docs/a11y/accessibility-guide) | Make the selected state tangible. A tab indicator should track the selected panel, a sheet should enter from its opening edge, and a drag should follow the pointer. Keep text, selection and keyboard focus legible with motion reduced. For the gallery, start with scroll snap and labelled buttons. Test optional mouse drag and teardown when HTMX removes the gallery. [Blossom core](https://blossom-carousel.com/docs/framework-guides/core) |
| HeroUI Pro documents carousel variants for an inline rail, focused viewer and thumbnail strip. Its design-system preview applies a theme to controls and whole screens. Its animation guide names entry and exit states. [Carousel variants](https://heroui.pro/docs/react/components/carousel) · [Design-system preview](https://heroui.pro/docs/react/getting-started/design-systems) · [Animation](https://heroui.pro/docs/react/getting-started/animation) | Document variants by where someone would use them. Show a radio group as a settings choice and a finish picker. Show a combobox as a small local list and a remote people picker. Give the remote example a slow response, no matches and a retry. Preserve control dimensions while status changes. |

**Product pages.** Keep the homepage lamp photography and graphite workspace. Make each finish change the pictured lamp. Link the finish picker to the exact radio-group variant used in the showcase. Apply the same treatment across the catalog with a workspace switcher for navigation, member search for selection and a release checklist for feedback. Each page should open on a working example, expose its keyboard controls and variants, and copy the displayed markup. Include the response fragment wherever the example makes a request. The current homepage already links its finish selector to the basic visibility radio group. [Mero showcase](../site/pro-stage.mjs) · [Radio group](../site/core-components.mjs) · [HeroUI Pro template previews](https://heroui.pro/docs/react/templates)

**Review each addition in the exported library.** Compare phone and desktop views in light, dark and tenant themes. Check mouse, touch, keyboard, reduced motion and interrupted requests wherever they apply. Measure the core CSS and JavaScript against today's individual gzip sizes of 5,879 and 4,215 bytes. Capture a phone performance trace for the gallery and verify pages without it fetch zero gallery JavaScript. Rerun the same interaction after HTMX replaces the component and confirm there is one handler, one action and a predictable focus destination.
