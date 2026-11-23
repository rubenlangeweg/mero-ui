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
        hx-disable="this">
  Check inventory
</button>
<output aria-live="polite"></output>`;
  return docs("Use Mero UI with your backend", "Mero UI works with Go, Rust and any backend that renders HTML. Your server renders the page and handles requests. The browser loads Mero’s CSS and JavaScript and uses HTMX 4 to update the page.", `
    <p>Run the inventory example with <a href="#go">Go and html/template</a> or <a href="#rust">Rust and Axum</a>. Both run without Node.js or npm.</p>
    <h2>Use Mero in an existing app</h2>
    <p>Copy a component’s HTML from the <a href="/components">catalog</a> into your template. Download the files below to your static directory and point the tags at the paths your app serves. Each component lists any additional styles or scripts it needs.</p>
    <div class="start-assets" aria-label="Download individual assets">
      <a href="/mero.css" download>mero.css ↓</a>
      <a href="/mero.js" download>mero.js ↓</a>
      <a href="/vendor/htmx.min.js" download>HTMX ↓</a>
    </div>
    <p>For interactive components, load HTMX 4 once, before mero.js.</p>
    ${example(install)}
    <h2 id="agent-skills">Agent skills</h2>
    <p>Install the Mero UI skill from your app’s root. Ask your coding agent to add a catalog component to an existing page and connect it to your backend.</p>
    ${example("npx skills add rubenlangeweg/mero-ui --skill mero-ui", null, "Shell")}
    <p>For work on the library itself, install <code>mero-ui-contribute</code> from the <a href="https://github.com/rubenlangeweg/mero-ui/tree/main/skills">Mero UI skills directory</a>.</p>
    <h2>Request a fragment</h2>
    <p>Choose <strong>Check inventory</strong> to fetch the current product count. Open <strong>HTTP exchange</strong> to see exactly what the server returned.</p>
    ${interactiveExample({ id: "first-request", demo: markup, code: markup, hasRequests: true, themeSelector: false })}
    <h2>Run the inventory example on your backend</h2>
    <p><a href="/downloads/mero-ui.tar.gz" download>Download source ↓</a> and extract it, or clone the <a href="https://github.com/rubenlangeweg/mero-ui">Mero UI repository</a>. From its root, run the commands for one backend. Both serve the same HTML page and bundled assets locally.</p>
    <h3 id="go">Go with net/http and html/template</h3>
    <p>Use Go 1.22 or newer. The <a href="https://github.com/rubenlangeweg/mero-ui/blob/main/examples/backends/go/main.go">Go handler</a> registers <code>GET /demo/stock-summary</code>, sets the content type and renders the two counts with <code>html/template</code>.</p>
    ${example("cd examples/backends\ngo run ./go/main.go", null, "Shell")}
    ${example('w.Header().Set("Content-Type", "text/html; charset=utf-8")\nif err := summary.Execute(w, stock{Total: 6, Active: 4}); err != nil {\n    log.Print(err)\n}', null, "Go · inside stockSummary")}
    <h3 id="rust">Rust with Axum</h3>
    <p>Use stable Rust and Cargo. The <a href="https://github.com/rubenlangeweg/mero-ui/blob/main/examples/backends/rust/src/main.rs">Axum handler</a> registers the same route and returns <code>Html</code>, which sets the HTML content type. This fragment interpolates integer counts. For user-supplied text, render it with an HTML-escaping template engine such as Askama.</p>
    ${example("cd examples/backends\ncargo run --locked --manifest-path rust/Cargo.toml", null, "Shell")}
    ${example('async fn stock_summary() -> Html<String> {\n    let (total, active) = (6_u32, 4_u32);\n    Html(format!("<strong>{total} products</strong> · {active} active"))\n}', null, "Rust")}
    <h3>Check the response</h3>
    <p>Open <code>http://127.0.0.1:4180</code> and choose <strong>Check inventory</strong>. The counts appear beside the button. To inspect the endpoint directly, run <code>curl -i http://127.0.0.1:4180/demo/stock-summary</code>. Both servers return HTTP 200 with <code>Content-Type: text/html; charset=utf-8</code> and this body:</p>
    ${example("<strong>6 products</strong> · 4 active", null, "HTML response")}
    <p>Replace the sample counts with values from your inventory store. Stop the server with Ctrl+C before starting the other example on the same port.</p>
    <h2>Try server-side validation</h2>
    <p>Open the <a href="/playground">inventory playground</a>, choose a validation error under <strong>Next save</strong>, then edit and save a product. The server returns the filled-in form with HTTP 422. The drawer stays open and focuses the invalid field.</p>
    <p>The <strong>HTTP exchange</strong> tab shows the returned form and headers. The <a href="/downloads/studio-inventory.tar.gz" download>standalone inventory</a> includes the same template and routes. Add <a href="/mero-forms.js" download>mero-forms.js</a> after the core to use these behaviors in your app.</p>
    <h2>Run the full catalog locally</h2>
    <p>To run this documentation site and its demos, use Node.js 22 or newer. Run <code>npm start</code> from the root of the source download and open <code>http://127.0.0.1:4173</code>.</p>
    <h2>Theme your app</h2>
    <p>Use the <a href="/themes">theme studio</a> to preview your colors, radii and typography, then export the <code>--mero-*</code> tokens into your stylesheet. Set <code>data-theme="light"</code> or <code>data-theme="dark"</code> on the document to choose a theme.</p>
    <p>Read the <a href="/docs/design-principles">design principles</a> for action hierarchy, spacing and focus after a save. Try the <a href="/docs/responsive-layouts">resizable company directory</a> to see how a layout behaves inside a narrow panel.</p>
  `);
}
