import { example } from "./examples.mjs";

const actions = [
  { emphasis: "Primary", variant: "primary", label: "Open inventory", href: "/playground" },
  { emphasis: "Secondary", variant: "secondary", label: "Download example", href: "/downloads/studio-inventory.tar.gz", download: true },
  { emphasis: "Quiet", variant: "ghost", label: "Read quick start", href: "/start" },
];

function actionLink({ variant, label, href, download }) {
  return `<a class="rl-button rl-button-${variant}" href="${href}"${download ? " download" : ""}>${label}</a>`;
}

export function designPrinciplesPage() {
  return `<article class="design-guide" aria-labelledby="principles-title">
    <header class="docs-heading"><h1 id="principles-title">Design principles</h1>
      <p>Give the next action a clear place on the page. Keep the user’s work and keyboard focus intact when the server replies.</p>
    </header>

    <section aria-labelledby="action-hierarchy">
      <h2 id="action-hierarchy">Give one action the most weight</h2>
      <p>Here the main task is to try the inventory. Downloading the example is an alternative. Setup instructions can sit quietly alongside both.</p>
      <dl class="principle-actions">${actions.map(action => `<div><dt>${action.emphasis}</dt><dd>${actionLink(action)}</dd></div>`).join("")}</dl>
      <details class="principle-code"><summary>View the HTML</summary>
        ${example(actions.map(actionLink).join("\n"), undefined, "Action links")}
      </details>
      <p>Use a link for a destination and a submit button for a save. Both can use the same <a class="rl-link" href="/components/button">button styles</a>.</p>
    </section>

    <section aria-labelledby="server-response">
      <h2 id="server-response">Keep the draft through a failed save</h2>
      <p>In the inventory editor, the user can correct a field without opening the drawer again. The server returns the entered values together with the error.</p>
      <dl class="principle-states">
        <div><dt>While saving</dt><dd>Mark the form busy and disable its submit button until the request finishes.</dd></div>
        <div><dt>Invalid field</dt><dd>Return the populated form with HTTP 422. Show the error beside the field and move focus there.</dd></div>
        <div><dt>Saved</dt><dd>Update the row, confirm the change and return focus to its edit button.</dd></div>
      </dl>
      <p><a class="rl-link" href="/playground">Try a failed save in the playground</a> and open <strong>HTTP exchange</strong> to inspect the response.</p>
    </section>

    <section aria-labelledby="control-geometry">
      <h2 id="control-geometry">Keep controls aligned across themes</h2>
      <p>Default fields and buttons start at 40 px. The select reserves space for its arrow on the trailing edge. The switch thumb keeps the same inset at either end of its track. Test each position in light and dark mode.</p>
      <ul class="principle-links">
        <li><a class="rl-link" href="/components/native-select">Native select</a></li>
        <li><a class="rl-link" href="/components/cell-switch">Cell switch</a></li>
        <li><a class="rl-link" href="/themes">Theme studio</a></li>
      </ul>
    </section>
  </article>`;
}
