import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("zero-JS progressive enhancement: .mero-validator hints, composable theme presets, structural tokens and Tailwind v4 @layer order",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    // Run with JavaScript disabled to prove zero-JS CSS-first behavior end-to-end.
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);

    const assets = {
      "/mero.css": ["text/css", "ui/mero.css"],
      "/mero-themes.css": ["text/css", "ui/mero-themes.css"],
    };

    const html = `<!doctype html><html lang="en"><head>
      <style>@layer theme, base, mero, components, utilities;</style>
      <link rel="stylesheet" href="/mero.css">
      <link rel="stylesheet" href="/mero-themes.css">
      <style>
        @layer utilities {
          .tw-p-2 { padding: 8px; }
          .tw-grid { display: grid; }
        }
      </style>
    </head><body>
      <section id="theme-default" data-theme="light">
        <button id="btn-default" class="mero-button mero-button-primary" type="button">Default</button>
        <div id="card-default" class="mero-card">Default card</div>
        <dialog id="dlg-default" open class="mero-dialog">Default dialog</dialog>
      </section>

      <section id="theme-composed" data-theme="cobalt dark compact crisp flat">
        <button id="btn-composed" class="mero-button mero-button-primary" type="button">Composed</button>
        <div id="card-composed" class="mero-card">Composed card</div>
        <dialog id="dlg-flat" open class="mero-dialog">Flat dialog</dialog>
      </section>

      <section id="theme-editorial" data-theme="editorial">
        <div id="card-editorial" class="mero-card">Editorial card</div>
        <dialog id="dlg-editorial" open class="mero-dialog">Editorial dialog</dialog>
      </section>

      <section id="tailwind-check">
        <button id="btn-tw" class="mero-button tw-p-2" type="button">TW utility</button>
        <div data-mero-tabs>
          <div id="tw-hidden-panel" role="tabpanel" class="tw-grid" hidden>Hidden panel</div>
        </div>
      </section>

      <form id="val-form" class="mero-stack">
        <div class="mero-field">
          <label for="sku-live">SKU</label>
          <input id="sku-live" class="mero-input mero-validator" name="sku" required pattern="[A-Z]{2}-[0-9]{4}">
          <p id="sku-live-hint" class="mero-validator-hint">Format: RL-2040</p>
        </div>
        <div class="mero-field">
          <label for="sku-server">Server 422 SKU</label>
          <input id="sku-server" class="mero-input mero-validator" name="skuServer" value="bad" aria-invalid="true">
          <p id="sku-server-hint" class="mero-validator-hint">Invalid on server</p>
        </div>
      </form>

      <details id="native-disclosure" class="mero-disclosure">
        <summary>More details</summary>
        <p id="disclosure-body">Works with zero JS</p>
      </details>

      <button id="pop-trigger" type="button" popovertarget="native-pop" class="mero-button">Open popover</button>
      <div id="native-pop" popover class="mero-popover">Native popover content</div>
    </body></html>`;

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (assets[pathname]) {
        const [contentType, file] = assets[pathname];
        return route.fulfill({ contentType, body: await readFile(new URL(file, root)) });
      }
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");

    // 1. Composable theme presets & structural tokens (--mero-border-width, --mero-depth, compact, cobalt dark, editorial).
    const defaultMetrics = await page.locator("#btn-default").evaluate(el => {
      const s = getComputedStyle(el);
      return { height: Math.round(el.getBoundingClientRect().height), borderTop: s.borderTopWidth, bg: s.backgroundColor };
    });
    const composedMetrics = await page.locator("#btn-composed").evaluate(el => {
      const s = getComputedStyle(el);
      const card = getComputedStyle(document.getElementById("card-composed"));
      return {
        height: Math.round(el.getBoundingClientRect().height),
        borderTop: card.borderTopWidth,
        depth: s.getPropertyValue("--mero-depth").trim(),
        bg: s.backgroundColor,
        scheme: getComputedStyle(document.getElementById("theme-composed")).colorScheme,
      };
    });
    assert.ok(composedMetrics.height < defaultMetrics.height, `compact button (${composedMetrics.height}px) is shorter than default (${defaultMetrics.height}px)`);
    assert.equal(composedMetrics.borderTop, "2px", "crisp modifier sets --mero-border-width: 2px");
    assert.equal(composedMetrics.depth, "0", "flat modifier sets --mero-depth: 0");
    assert.equal(composedMetrics.scheme, "dark", "cobalt dark activates dark color-scheme");
    assert.notEqual(composedMetrics.bg, defaultMetrics.bg, "cobalt dark primary differs from default graphite light");

    const editorialMetrics = await page.locator("#card-editorial").evaluate(el => ({
      font: getComputedStyle(el).getPropertyValue("--mero-font"),
      defaultShadow: getComputedStyle(document.getElementById("dlg-default")).boxShadow,
      flatShadow: getComputedStyle(document.getElementById("dlg-flat")).boxShadow,
      editorialShadow: getComputedStyle(document.getElementById("dlg-editorial")).boxShadow,
    }));
    assert.match(editorialMetrics.font, /Georgia|serif/i);
    assert.notEqual(editorialMetrics.defaultShadow, "none", "default depth=1 keeps dialog shadow");
    assert.equal(editorialMetrics.flatShadow, "none", "nested flat scope removes dialog shadow");
    assert.equal(editorialMetrics.editorialShadow, "none", "nested editorial scope removes dialog shadow");

    // 2. Tailwind v4 @layer theme, base, mero, components, utilities; coexistence.
    assert.equal(await page.locator("#btn-tw").evaluate(el => getComputedStyle(el).paddingTop), "8px", "@layer utilities overrides @layer mero");
    assert.equal(await page.locator("#tw-hidden-panel").evaluate(el => getComputedStyle(el).display), "none", "[hidden] beats @layer utilities .tw-grid");

    // 3. Zero-JS .mero-validator + .mero-validator-hint (:user-invalid / :user-valid / aria-invalid="true").
    assert.equal(await page.locator("#sku-live-hint").isHidden(), true, "hint is hidden before user interaction");
    assert.equal(await page.locator("#sku-server-hint").isVisible(), true, "server 422 aria-invalid reveals hint immediately");
    await page.locator("#sku-live").fill("bad");
    await page.locator("#sku-live").blur();
    assert.equal(await page.locator("#sku-live-hint").isVisible(), true, ":user-invalid reveals hint with zero JS");
    const invalidBorder = await page.locator("#sku-live").evaluate(el => getComputedStyle(el).borderTopColor);
    await page.locator("#sku-live").fill("RL-2040");
    await page.locator("#sku-live").blur();
    assert.equal(await page.locator("#sku-live-hint").isHidden(), true, ":user-valid hides hint again with zero JS");
    const validBorder = await page.locator("#sku-live").evaluate(el => getComputedStyle(el).borderTopColor);
    assert.notEqual(validBorder, invalidBorder, ":user-valid switches border color from danger to success");
    // A natively valid control that still carries server aria-invalid="true" must keep its danger border.
    await page.locator("#sku-server").fill("RL-2040");
    await page.locator("#sku-server").blur();
    assert.equal(await page.locator("#sku-server").evaluate(el => getComputedStyle(el).borderTopColor), invalidBorder, "aria-invalid=true beats :user-valid success border");

    // 4. CSS-first native <details> & Popover API work with zero JS.
    assert.equal(await page.locator("#disclosure-body").isHidden(), true);
    await page.locator("#native-disclosure summary").click();
    assert.equal(await page.locator("#disclosure-body").isVisible(), true);
    assert.equal(await page.locator("#native-pop").isHidden(), true);
    await page.locator("#pop-trigger").click();
    assert.equal(await page.locator("#native-pop").isVisible(), true);
  });
