import { codePanel } from "./examples.mjs";

// test/reference.test.mjs fails when ui/*.js gains a mero:* event or MeroUI method missing here.
const emitted = [
  ["mero:selection", "/components/list-box", "List Box",
    "Fires on the <code>data-mero-listbox</code> element when a person chooses an option.",
    "{ value, option }", "<code>value</code> is the option’s <code>data-value</code>, or its text when that is absent. <code>option</code> is the chosen element."],
  ["mero:query", "/components/autocomplete", "Autocomplete",
    "Fires on a remote combobox input when it needs fresh options, for example an arrow key after a failed request. Add it to <code>hx-trigger</code> next to <code>input</code>.",
    "", ""],
  ["mero:action", "/components/action-button", "Action Button",
    "Fires on a <code>data-mero-action</code> button when its request starts and when it ends, or on the document when a swap removed the button. Requires <code>mero-forms.js</code>.",
    "{ state, status, message }", "<code>state</code> is <code>pending</code>, <code>succeeded</code>, <code>rejected</code> or <code>unknown</code>. <code>status</code> and <code>message</code> are set once the request ends."],
  ["mero:kanban-move", "/components/kanban", "Kanban",
    "Fires on a card after it moves to another lane. Requires <code>mero-collections.js</code>.",
    "{ card, from, to }", "<code>from</code> and <code>to</code> are the lanes’ <code>data-lane</code> values."],
  ["mero:reaction", "/components/emoji-reaction-button", "Emoji Reaction Button",
    "Fires on a reaction button after its count and pressed state change. Requires <code>mero-insights.js</code>.",
    "{ label, pressed }", "<code>label</code> is the button’s <code>data-label</code>. <code>pressed</code> is the new state."],
];

const received = [
  ["mero:toast", "Shows a notification. <code>message</code> is required. <code>tone</code> and <code>duration</code> match <code>MeroUI.toast</code>.",
    `HX-Trigger: {"mero:toast":{"message":"Export ready","tone":"success"}}`],
  ["mero:form-saved", "Requires <code>mero-forms.js</code>. Closes the dialog around the <code>data-mero-form</code> that received the event, returns focus and shows <code>message</code> as a success toast. Set <code>target</code> to a selector when the form is not the element that made the request.",
    `HX-Reswap: none\nHX-Trigger: {"mero:form-saved":{"message":"Saved"}}`],
];

const methods = [
  ["MeroUI.open(dialog, { trigger })", "Opens a <code>&lt;dialog&gt;</code> as a modal. Pass the element or its ID. Focus returns to <code>trigger</code> on close, by default the element focused when you call it."],
  ["MeroUI.close(dialog, { focus, value })", "Closes an open dialog. <code>focus</code> overrides where focus returns. <code>value</code> becomes the dialog’s <code>returnValue</code>."],
  ["MeroUI.toast(message, { tone, duration })", "Shows a notification. <code>tone</code> is <code>accent</code>, <code>success</code>, <code>warning</code> or <code>danger</code>. <code>duration</code> is in milliseconds, 4800 by default. Use 0 to keep it until dismissed."],
  ["MeroUI.init(root)", "Sets up tabs, listboxes, comboboxes and auto-opening dialogs inside <code>root</code>. Mero calls it for every htmx swap. Call it yourself for markup you insert another way."],
];

// [attribute, description]. A leading "*" marks an attribute Mero sets itself.
// test/reference.test.mjs fails when ui/ gains a data-mero-* attribute missing here.
const attributes = [
  ["Core", "mero.js", [
    ["data-mero-open", "On a button. The value is the ID of the <code>&lt;dialog&gt;</code> to open as a modal."],
    ["data-mero-close", "On a control inside a dialog. Closes it. The value becomes the dialog’s <code>returnValue</code>."],
    ["data-mero-autoopen", "On a dialog. Opens it as soon as it is on the page or swapped in."],
    ["data-mero-static", "On a dialog. A click on the backdrop does not close it."],
    ["data-mero-toast", "On a button. Shows the value as a notification on click."],
    ["data-mero-tone", "With <code>data-mero-toast</code>. One of <code>accent</code>, <code>success</code>, <code>warning</code> or <code>danger</code>."],
    ["data-mero-toggle", "On a button. Flips <code>aria-pressed</code> on click."],
    ["data-mero-remove", "On a button inside <code>.mero-chip</code>. Removes the chip and moves focus to a neighbour."],
    ["data-mero-tabs", "Root of a tab set. Selects tabs in the <code>role=\"tablist\"</code> inside and shows the matching panel. Also scopes IDs like <code>data-mero-scope</code>."],
    ["*data-mero-tabs-ready", "On the tab root once a tab is selected."],
    ["data-mero-accordion", "On the parent of <code>&lt;details&gt;</code> elements. Only one stays open at a time."],
    ["data-mero-radio-group", "Around radios that sit outside a form. Repeated copies with the same <code>name</code> stay independent."],
    ["*data-mero-radio-owner", "On the hidden form Mero adds to own those radios."],
    ["data-mero-scope", "On a repeated snippet or fragment. Mero renames duplicate IDs inside it and updates <code>for</code>, ARIA, <code>popovertarget</code>, <code>data-mero-open</code> and <code>hx-target</code> references to match."],
    ["data-mero-listbox", "On a <code>role=\"listbox\"</code>. Adds arrow-key navigation and selection, and fires <code>mero:selection</code>."],
    ["data-mero-combo", "Root of a combobox. Wraps the <code>role=\"combobox\"</code> input and its options."],
    ["data-mero-combo-remote", "On the combobox root when the options come from your server. Mero then leaves filtering to the response."],
    ["data-mero-combo-status", "Inside a combobox. The element that receives loading and error text."],
    ["data-mero-empty-option", "On the option to show when nothing matches. It cannot be selected."],
    ["*data-mero-active", "On the option highlighted with the keyboard."],
    ["*data-mero-combo-pending", "On the combobox input while a request for options is in flight."],
    ["*data-mero-combo-error", "On the combobox input after a request for options failed."],
    ["*data-mero-combo-dismissed", "On the combobox input after Escape. Dismissal clears the active option and blocks late responses. Arrow Down requests fresh options when the server has yet to confirm the current query."],
    ["*data-mero-error", "On the combobox status element while it shows an error."],
    ["*data-mero-tooltip-below", "On a tooltip placed below its anchor because there is no room above."],
    ["*data-mero-tooltip-dismissed", "On a tooltip closed with Escape, until the pointer and focus leave it."],
    ["data-mero-command", "On a <code>&lt;dialog&gt;</code> holding a remote combobox. Cmd or Ctrl K opens it with an empty query, and choosing an option runs that option’s link, <code>hx-*</code> request or toast. Use one per page, and not alongside the workspace Command."],
    ["data-mero-restore-focus", "On a list container. After Back to this page, focuses the link in it that was opened. Links are matched by <code>href</code>."],
    ["data-mero-focus-fallback", "On one control inside a <code>data-mero-restore-focus</code> container. Gets focus after an htmx swap when the initiating control has no focusable replacement with the same ID."],
    ["data-mero-pending", "On any element. Shows a <code>.mero-indicator</code> inside it, as <code>.htmx-request</code> does."],
    ["data-mero-request", "With a pending state. Sets a progress cursor on the element."],
  ]],
  ["Forms", "mero-forms.js", [
    ["data-mero-form", "On a form that htmx submits. Disables its submit buttons while the request runs, swaps in the replacement form on HTTP 422 and focuses the first invalid field."],
    ["data-mero-action", "On a button outside a form that makes an htmx request. Shows its outcome and ignores clicks while the request runs. <code>Mero-Action-Outcome</code> and <code>Mero-Action-Message</code> response headers override the state and the text."],
    ["*data-mero-action-state", "On a <code>data-mero-action</code> button: <code>pending</code>, then <code>succeeded</code> (2xx), <code>rejected</code> (4xx other than 408) or <code>unknown</code> (anything else, including network errors)."],
    ["data-mero-action-status", "A live region next to the button. Receives the outcome message and a <code>data-tone</code>. Without one, the message shows as a toast."],
    ["data-mero-form-error", "Inside the form. Receives the message when a request fails with a status other than 422. Send your own text in a <code>Mero-Form-Error</code> response header."],
    ["data-mero-return-focus", "On the form. Selector for the element to focus after <code>mero:form-saved</code>."],
    ["data-mero-fallback-focus", "On the form. Selector to focus when the return-focus element is gone."],
    ["data-mero-close-all", "On a form in a nested dialog. A save closes the parent dialogs too."],
  ]],
  ["Gallery", "mero-gallery.js", [
    ["data-mero-slide", "On each slide. Its value links the slide to a choice control."],
    ["data-mero-gallery-choice", "On a radio or select whose value names a slide. Changing it shows that slide."],
    ["data-mero-prev", "On a button. Goes to the previous slide."],
    ["data-mero-next", "On a button. Goes to the next slide."],
    ["data-mero-gallery-label", "Receives the current slide’s <code>data-label</code> text."],
    ["data-mero-gallery-link", "On a link. Its <code>href</code> follows the current slide’s <code>data-href</code>."],
    ["data-mero-hover-preview", "On the gallery element. Hovering a choice with a mouse previews its slide."],
    ["data-mero-before", "On the first image of an image diff. The slider clips this one."],
  ]],
  ["Collections", "mero-collections.js", [
    ["data-mero-grid", "Root of a data grid. Keeps the select-all checkbox, the selection count and the bulk action bar in step with the row checkboxes."],
    ["data-mero-grid-focus", "On the grid in a server response. Names what to focus after the swap: <code>field</code>, <code>cancel</code>, <code>invalid</code>, <code>add</code>, <code>search</code>, <code>filter</code>, <code>sort-name</code>, <code>sort-status</code>, or <code>edit-ID</code> and <code>delete-ID</code> for that row’s Actions button. Mero removes it once used."],
    ["data-mero-agenda", "Root of an agenda. Restores focus after a swap from its <code>data-agenda-focus</code> value, and swaps an error response only on HTTP 422."],
    ["*data-mero-load-superseded", "On a grid or agenda mount when the person acted before its first refresh returned. That refresh is then discarded."],
    ["data-mero-kanban", "Root of a board. Cards move between its <code>data-lane</code> columns by drag or by the Move to menu, and fire <code>mero:kanban-move</code>."],
    ["data-mero-hover-card", "Around a trigger and its preview panel. Opens the panel on hover or focus."],
    ["data-mero-toc", "Root of a floating table of contents. Its links scroll the content and mark the current section."],
    ["data-mero-place-map", "Root of a map. Choosing a <code>data-place</code> pin shows the matching <code>data-place-detail</code>."],
    ["data-mero-widget", "Around a checklist. Updates its <code>&lt;progress&gt;</code> and <code>&lt;output&gt;</code> as boxes are checked."],
  ]],
  ["Insights", "mero-insights.js", [
    ["data-mero-chart", "On a chart figure. The chart type, used to style the legend. <code>renderChart</code> writes it."],
    ["data-mero-plot-value", "On each chart mark. The text announced and shown when the mark has focus or hover."],
    ["data-mero-series", "On each chart mark. Arrow up and down move between series at the same category."],
    ["data-mero-plot-readout", "Receives the text of the active mark for assistive technology."],
    ["data-mero-plot-tooltip", "The tooltip positioned at the active mark."],
    ["data-mero-copy", "On a button in a code block or chat message. Copies the code or the message text."],
    ["*data-mero-copy-label", "On a copy button. Its original label, restored after “Copied”."],
    ["data-mero-message-text", "Inside a chat message. The text a copy button copies."],
    ["data-mero-reaction", "On a reaction button. Toggles <code>aria-pressed</code>, updates the count and fires <code>mero:reaction</code>."],
    ["data-mero-count", "Inside a reaction button. The element holding the count."],
    ["data-mero-pressable", "On a button. Flips <code>aria-pressed</code> and swaps its star icon."],
    ["data-mero-press-icon", "Inside a pressable button. The element holding the icon."],
    ["data-mero-suggest", "On a button in a prompt form. Puts its text into the form’s textarea."],
    ["data-mero-compose", "On a chat form. Shows progress in its status element, keeps the draft when sending fails and blocks error swaps."],
    ["data-mero-chat-status", "Inside a chat form. Receives “Preparing reply…” and send errors."],
    ["data-mero-topic", "On each conversation link in a chat inbox. Its value is the conversation’s ID."],
    ["data-mero-current-topic", "In a thread response. Marks the link with the same value as current."],
    ["data-mero-report-status", "In a chat inbox, Markdown editor or report filter. Receives the result of the last update."],
  ]],
  ["Workspace", "mero-workspace.js", [
    ["data-mero-ws-shell", "Root of an app shell. A <code>data-mero-ws-open</code> button inside opens its dialog."],
    ["data-mero-ws-open", "On a button inside a shell, command menu or emoji picker. Opens that component’s dialog."],
    ["data-mero-ws-command", "Root of a command menu. Cmd or Ctrl and K opens it, and typing filters its actions."],
    ["data-mero-ws-emoji", "Root of an emoji picker. Choosing an emoji fills its hidden input and closes the dialog."],
    ["data-mero-ws-context", "Root of a context menu. A right click, the menu key or Shift and F10 on a row opens its <code>role=\"menu\"</code>."],
    ["data-mero-ws-context-open", "On the button that opens the same context menu."],
    ["data-mero-ws-action", "On a context menu item. Only <code>pin</code> has built-in behavior: it toggles the pinned state."],
    ["data-mero-ws-editor", "On a rich text form. Copies the formatted text into its <code>runs</code> and <code>body</code> fields. Buttons with <code>data-format</code> apply formatting."],
    ["data-mero-ws-number", "Around a number input. Buttons with <code>data-step</code> step the value and disable at the limits."],
    ["data-mero-ws-upload", "On an upload form. Shows the chosen file name and ignores the response for a file that has since been replaced."],
    ["data-mero-ws-wizard", "On a multi-step form. Shows one panel at a time."],
    ["data-mero-ws-next", "On the wizard’s button to the next step."],
    ["data-mero-ws-back", "On the wizard’s button to the previous step."],
    ["data-mero-ws-finish", "On the wizard’s submit button. Shown on the last step only."],
    ["data-mero-ws-review", "In the wizard. Receives a summary of the <code>project</code> and <code>access</code> fields."],
    ["data-mero-ws-split", "Root of a resizable split. The separator inside resizes it by drag or arrow keys."],
    ["data-mero-ws-snap", "With <code>data-mero-ws-split</code>. Adds a snap point learned from the widths the person has chosen."],
    ["data-mero-ws-snap-key", "With a snapping split. A name under which the width is remembered for the browser session."],
    ["*data-mero-ws-split-ready", "On a snapping split once it is set up."],
    ["*data-mero-ws-dragging", "On the split handle during a drag."],
    ["*data-mero-ws-snapped", "On the split handle while it rests on the snap point."],
    ["*data-mero-ws-width", "On the split handle. The current width in pixels, shown by the stylesheet."],
  ]],
  ["Composition", "mero-composition.js", [
    ["data-mero-text-cycle", "Around rotating text. Buttons with <code>data-cycle-next</code> and <code>data-cycle-play</code> step or auto-advance its <code>data-cycle-item</code> elements."],
    ["data-mero-theme-scope", "On a section. Receives the theme chosen in the picker inside it."],
    ["data-mero-theme-picker", "On a select or radio. Its value becomes the scope’s <code>data-theme</code>."],
    ["data-mero-cutoff-hour", "Around a <code>&lt;time&gt;</code>. Counts down to that hour, 0 to 23 in UTC."],
    ["data-mero-check-form", "On the catalog’s validation demo form. It reports a fixed message and is not meant for your app."],
  ]],
];

export function referencePage() {
  return `<article class="design-guide" aria-labelledby="reference-title">
    <header class="docs-heading"><h1 id="reference-title">Reference</h1>
      <p>The events Mero UI sends and acts on, the functions on <code>window.MeroUI</code>, and every <code>data-mero-*</code> attribute.</p>
    </header>

    <section aria-labelledby="reference-emitted">
      <h2 id="reference-emitted">Events Mero sends</h2>
      <p>Each event bubbles, so you can listen on the component or on <code>document</code>.</p>
      ${emitted.map(([name, href, label, when, detail, detailNote]) => `<h3 id="${name.replace(":", "-")}"><code>${name}</code></h3>
      <p>${when} See <a class="mero-link" href="${href}">${label}</a>.</p>
      ${detail ? `<p><code>event.detail</code> is <code>${detail}</code>. ${detailNote}</p>` : "<p>The event has no detail.</p>"}`).join("")}
      ${codePanel(`document.addEventListener("mero:kanban-move", (event) => {
  const { card, from, to } = event.detail;
  // Persist the move in your own service.
});`, "JavaScript")}
    </section>

    <section aria-labelledby="reference-received">
      <h2 id="reference-received">Events Mero acts on</h2>
      <p>Send these from your server in an htmx trigger header, or dispatch them from a script. The object after the event name becomes <code>event.detail</code>.</p>
      ${received.map(([name, what, header]) => `<h3 id="${name.replace(":", "-")}"><code>${name}</code></h3>
      <p>${what}</p>
      ${codePanel(header, "Response headers")}`).join("")}
    </section>

    <section aria-labelledby="reference-api">
      <h2 id="reference-api">window.MeroUI</h2>
      <p><code>mero.js</code> defines these once it has loaded.</p>
      ${methods.map(([signature, what]) => `<h3><code>${signature}</code></h3><p>${what}</p>`).join("")}
    </section>
    <section aria-labelledby="reference-attributes">
      <h2 id="reference-attributes">Attributes</h2>
      <p>Every <code>data-mero-*</code> attribute, grouped by the file that reads it. You write most of them in your templates. Mero sets the ones marked <em>set by Mero</em>, which you can use in selectors.</p>
      ${attributes.map(([group, file, items]) => `<h3>${group} · <code>${file}</code></h3>
      <dl class="reference-list">${items.map(([name, what]) => `<div><dt><code>${name.replace("*", "")}</code>${name[0] === "*" ? " <em>set by Mero</em>" : ""}</dt><dd>${what}</dd></div>`).join("")}</dl>`).join("")}
    </section>
  </article>`;
}
