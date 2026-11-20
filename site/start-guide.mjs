import { example, interactiveExample } from "./examples.mjs";
import { escapeHtml as esc } from "./html.mjs";

function docs(title, description, content) {
  return `<header class="docs-heading"><h1>${esc(title)}</h1><p>${esc(description)}</p></header>${content}`;
}

export function startGuide() {
  const install = `<link rel="stylesheet" href="/mero.css">
<script defer src="/vendor/htmx.min.js"></script>
<script defer src="/mero.js"></script>`;
  const markup = `<button type="button" class="mero-button mero-button-primary"
        hx-get="/demo/stock-summary" hx-target="next output"
        hx-disabled-elt="this">
  Check inventory
</button>
<output aria-live="polite"></output>`;
  return docs("Get started", "Use Mero UI with any backend that can render HTML fragments.", `
    <div><a class="mero-button mero-button-primary site-cta" href="/downloads/mero-ui.tar.gz" download>Download source ↓</a></div>
    <p>Extract the archive and run <code>npm start</code> with Node 22 or newer. The app runs at <a href="/">127.0.0.1:4173</a>. For just the editable table and its server routes, <a href="/downloads/studio-inventory.tar.gz" download>download Studio Inventory</a>.</p>
    <h2>Load the assets</h2>
    <p>The sample serves these files from its <code>ui/</code> and <code>public/</code> directories. Use the same paths in your app, or point them to your own asset directory.</p>
    <div class="start-assets" aria-label="Download individual assets">
      <a href="/mero.css" download>mero.css ↓</a>
      <a href="/mero.js" download>mero.js ↓</a>
      <a href="/vendor/htmx.min.js" download>HTMX ↓</a>
    </div>
    <p>Projects that already load HTMX only need the Mero UI files.</p>
    ${example(install)}
    <h2>Request a fragment</h2>
    <p>Choose <strong>Check inventory</strong> to fetch the current product count. Open <strong>HTTP exchange</strong> to see exactly what the server returned.</p>
    ${interactiveExample({ id: "first-request", demo: markup, code: markup, hasRequests: true, themeSelector: false })}
    <h2>Try server-side validation</h2>
    <p>Open the <a href="/playground">inventory playground</a>, choose a validation error under <strong>Next save</strong>, then edit and save a product. The server returns the filled-in form with HTTP 422. The drawer stays open and focuses the invalid field.</p>
    <p>The <strong>HTTP exchange</strong> tab shows the returned form and headers. The <a href="/downloads/studio-inventory.tar.gz" download>standalone inventory</a> includes the same template and routes. Add <a href="/mero-forms.js" download>mero-forms.js</a> after the core to use these behaviors in your app.</p>
    <h2>Theme your app</h2>
    <p>Use the <a href="/themes">theme studio</a> to preview your colors, radii and typography, then export the <code>--mero-*</code> tokens into your stylesheet. Set <code>data-theme="light"</code> or <code>data-theme="dark"</code> on the document to choose a theme.</p>
    <p>Read the <a href="/docs/design-principles">design principles</a> for action hierarchy, spacing and focus after a save. Try the <a href="/docs/responsive-layouts">resizable company directory</a> to see how a layout behaves inside a narrow panel.</p>
  `);
}
