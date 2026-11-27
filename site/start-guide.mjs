import { example, interactiveExample } from "./examples.mjs";
import { escapeHtml as esc } from "./html.mjs";

function docs(title, description, content) {
  return `<header class="docs-heading"><h1>${esc(title)}</h1><p>${esc(description)}</p></header>${content}`;
}

export function startGuide() {
  const install = `<link rel="stylesheet" href="/mero/mero.css">
<script defer src="/mero/htmx.min.js"></script>
<script defer src="/mero/mero.js"></script>`;
  const markup = `<button type="button" class="mero-button mero-button-primary"
        hx-get="/demo/stock-summary" hx-target="next output"
        hx-disable="this">
  Check inventory
</button>
<output aria-live="polite"></output>`;
  return docs("Use Mero UI with your backend", "Mero UI works with Go, Rust and any backend that renders HTML. Your server renders the page and handles requests. The browser loads Mero’s CSS and JavaScript and uses HTMX 4 to update the page.", `
    <p>Run the inventory example with <a href="#go">Go and html/template</a> or <a href="#rust">Rust and Axum</a>. Both run without Node.js or npm.</p>
    <h2>Use Mero in an existing app</h2>
    <p>Copy a component’s HTML from the <a href="/components">catalog</a> into your template. Vendor the pinned browser files with the zero-dependency CLI (writes a SHA-256 <code>MERO.json</code> manifest and <code>LICENSE.txt</code>), or download them directly below.</p>
    ${example("npm install @rubenlangeweg/mero-ui htmx.org@4.0.2\nnpx mero-ui init public/mero --with themes,layouts --base-url /mero\ncp node_modules/htmx.org/dist/htmx.min.js public/mero/htmx.min.js\nnpx mero-ui verify public/mero", null, "Shell")}
    <div class="start-assets" aria-label="Download individual assets">
      <a href="/mero.css" download>mero.css ↓</a>
      <a href="/mero.js" download>mero.js ↓</a>
      <a href="/mero-forms.js" download>mero-forms.js ↓</a>
      <a href="/mero-live.js" download>mero-live.js ↓</a>
      <a href="/mero-themes.css" download>mero-themes.css ↓</a>
      <a href="/vendor/htmx.min.js" download>HTMX ↓</a>
    </div>
    <p>Serve <code>public/</code> at <code>/</code> (so <code>public/mero</code> maps to <code>/mero</code>, or pass <code>--base-url</code> to match your static mount). For interactive components, load HTMX 4 once before <code>mero.js</code>.</p>
    ${example(install)}
    <h2 id="tailwind">Use alongside Tailwind CSS v4 (optional)</h2>
    <p>Mero requires no Tailwind or CSS build step. When you already use Tailwind CSS v4 for layout utilities, declare <code>mero</code> before <code>utilities</code> so utility classes override Mero defaults cleanly while <code>[hidden]</code> panels stay protected.</p>
    ${example('@layer theme, base, mero, components, utilities;\n@import "tailwindcss";\n@import "@rubenlangeweg/mero-ui/ui/mero.css";', null, "CSS")}
    <h2 id="agent-skills">Agent skills</h2>
    <p>Find a component’s templates and required assets in the <a href="/llms.txt">agent documentation index</a>. For offline use, open <code>agent-docs/llms.txt</code> in your installed Mero package when available.</p>
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
    <h3 id="node">Node.js 22+ full-flow CRUD starter</h3>
    <p>Run the zero-dependency <a href="https://github.com/rubenlangeweg/mero-ui/blob/main/examples/backends/node/server.mjs">Node starter</a> to see the full server contract in action: boosted navigation, per-session CSRF (403), validation (422), optimistic concurrency (409), multi-select channels, draft leave guard, typed confirmation delete and live polling with 401 <code>HX-Redirect</code>.</p>
    ${example("node examples/backends/node/server.mjs", null, "Shell")}
    <h3 id="python">Python (FastAPI / Django)</h3>
    <p>Return an HTML-escaped fragment with HTTP 422 on validation errors, or HTTP 200 with <code>HX-Trigger</code> on save.</p>
    ${example('from fastapi import Form\nfrom fastapi.responses import HTMLResponse\nimport json\n\n@app.post("/products/{id}", response_class=HTMLResponse)\ndef save_product(id: int, name: str = Form("")):\n    if not name.strip():\n        return HTMLResponse(render_form(error="Name is required."), status_code=422)\n    update_product(id, name=name.strip())\n    headers = {"HX-Trigger": json.dumps({"mero:form-saved": {"message": "Saved"}})}\n    return HTMLResponse(render_form(saved=True), headers=headers)', null, "Python · FastAPI")}
    <h3 id="rails">Ruby on Rails</h3>
    <p>Render a partial directly from your controller action; Mero focuses the first <code>aria-invalid="true"</code> field on 422 and announces the toast on save.</p>
    ${example('def update\n  if @product.update(product_params)\n    response.set_header("HX-Trigger", { "mero:form-saved" => { message: "Saved" } }.to_json)\n    render partial: "form", locals: { product: @product }\n  else\n    render partial: "form", locals: { product: @product }, status: :unprocessable_entity\n  end\nend', null, "Ruby · Rails")}
    <h3 id="laravel">PHP (Laravel)</h3>
    <p>Return a Blade partial with HTTP 422 for invalid fields, or attach <code>HX-Trigger</code> after persisting.</p>
    ${example('if ($validator->fails()) {\n    return response()->view("products.form", ["errors" => $validator->errors()], 422);\n}\nreturn response()\n    ->view("products.form", ["product" => $product])\n    ->header("HX-Trigger", json_encode(["mero:form-saved" => ["message" => "Saved"]]));', null, "PHP · Laravel")}
    <h2>Try server-side validation</h2>
    <p>Open the <a href="/playground">inventory playground</a>, choose a validation error under <strong>Next save</strong>, then edit and save a product. The server returns the filled-in form with HTTP 422. The drawer stays open and focuses the invalid field.</p>
    <p>The <strong>HTTP exchange</strong> tab shows the returned form and headers. The <a href="/downloads/studio-inventory.tar.gz" download>standalone inventory</a> includes the same template and routes. Add <a href="/mero-forms.js" download>mero-forms.js</a> after the core to use these behaviors in your app.</p>
    <h2>Run the full catalog locally</h2>
    <p>To run this documentation site and its demos, use Node.js 22 or newer. Run <code>npm start</code> from the root of the source download and open <code>http://127.0.0.1:4173</code>.</p>
    <h2 id="themes">Theme your app</h2>
    <p>Load the optional <a href="/mero-themes.css" download>mero-themes.css</a> after <code>mero.css</code> for drop-in palettes (<code>cobalt</code>, <code>fern</code>, <code>clay</code>, <code>editorial</code>) and composable modifiers (<code>compact</code>, <code>flat</code>, <code>crisp</code>) — for example <code>data-theme="cobalt dark compact"</code> or <code>data-theme="editorial flat"</code>. Tune border weight and elevation globally with <code>--mero-border-width</code> and <code>--mero-depth</code>.</p>
    <p>Or use the <a href="/themes">theme studio</a> to try custom colors, radii and typography, then export the <code>--mero-*</code> tokens into your stylesheet. Set <code>data-theme="light"</code>, <code>data-theme="dark"</code> or <code>data-theme="auto"</code> on the document or any section.</p>
    <p>Read the <a href="/docs/design-principles">design principles</a> for action hierarchy, spacing and focus after a save. Try the <a href="/docs/responsive-layouts">resizable company directory</a> to see how a layout behaves inside a narrow panel.</p>
  `);
}
