import { codePanel } from "./examples.mjs";

// test/reference.test.mjs fails when ui/*.js gains a mero:* event or MeroUI method missing here.
const emitted = [
  ["mero:selection", "/components/list-box", "List Box",
    "Fires on the <code>data-mero-listbox</code> element when a person chooses an option.",
    "{ value, option }", "<code>value</code> is the option’s <code>data-value</code>, or its text when that is absent. <code>option</code> is the chosen element."],
  ["mero:query", "/components/autocomplete", "Autocomplete",
    "Fires on a remote combobox input when it needs fresh options, for example an arrow key after a failed request. Add it to <code>hx-trigger</code> next to <code>input</code>.",
    "", ""],
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
    `HX-Reswap: none\nHX-Trigger-After-Settle: {"mero:form-saved":{"message":"Saved"}}`],
];

const methods = [
  ["MeroUI.open(dialog, { trigger })", "Opens a <code>&lt;dialog&gt;</code> as a modal. Pass the element or its ID. Focus returns to <code>trigger</code> on close, by default the element focused when you call it."],
  ["MeroUI.close(dialog, { focus, value })", "Closes an open dialog. <code>focus</code> overrides where focus returns. <code>value</code> becomes the dialog’s <code>returnValue</code>."],
  ["MeroUI.toast(message, { tone, duration })", "Shows a notification. <code>tone</code> is <code>accent</code>, <code>success</code>, <code>warning</code> or <code>danger</code>. <code>duration</code> is in milliseconds, 4800 by default. Use 0 to keep it until dismissed."],
  ["MeroUI.init(root)", "Sets up tabs, listboxes, comboboxes and auto-opening dialogs inside <code>root</code>. Mero calls it for every htmx swap. Call it yourself for markup you insert another way."],
];

export function referencePage() {
  return `<article class="design-guide" aria-labelledby="reference-title">
    <header class="docs-heading"><h1 id="reference-title">Events and JavaScript</h1>
      <p>The events Mero UI sends, the events it acts on, and the four functions on <code>window.MeroUI</code>.</p>
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
  </article>`;
}
