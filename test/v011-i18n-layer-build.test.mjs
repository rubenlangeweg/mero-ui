import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("every shipped stylesheet wraps its rules in @layer mero and Core 4 stay within gzip budgets", async () => {
  const files = (await readdir(new URL("ui/", root))).filter(file => file.endsWith(".css")).sort();
  assert.ok(files.length > 0);
  for (const file of files) {
    const css = await readFile(new URL("ui/" + file, root), "utf8");
    assert.match(css, /^\/\*![^\n]*\*\/\n@layer mero \{/, `${file} declares @layer mero after its version banner`);
    assert.ok(css.trimEnd().endsWith("}"), `${file} closes @layer mero`);
  }
  const budgets = {
    "ui/mero.css": 13_500,
    "ui/mero.js": 18_000,
    "ui/mero-forms.js": 12_000,
    "ui/mero-live.js": 3_000,
  };
  for (const [path, maxGzip] of Object.entries(budgets)) {
    const gz = gzipSync(await readFile(new URL(path, root))).byteLength;
    assert.ok(gz <= maxGzip, `${path} gzip size ${gz} exceeds budget ${maxGzip}`);
  }
});

test("TypeScript declarations cover window.MeroUI methods and core mero:* events", async () => {
  const surface = JSON.parse(await readFile(new URL("test/api-surface.json", root), "utf8"));
  const dts = await readFile(new URL("ui/mero.d.ts", root), "utf8");
  for (const method of surface.api) {
    assert.match(dts, new RegExp(`\\b${method}\\(`), `mero.d.ts declares MeroAPI.${method}`);
  }
  for (const eventName of ["mero:action", "mero:tab", "mero:toggle", "mero:selection", "mero:select", "mero:dialog", "mero:peek", "mero:dirty", "mero:boost-unmatched", "mero:form-saved", "mero:toast"]) {
    assert.ok(dts.includes(`"${eventName}"`), `mero.d.ts declares ${eventName}`);
  }
});

test("build:ui emits minified assets with version banners and SHA-384 integrity manifest", async () => {
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL("scripts/build-ui.mjs", root))]);
  const manifest = JSON.parse(await readFile(new URL("dist/manifest.json", root), "utf8"));
  assert.equal(manifest.name, "@rubenlangeweg/mero-ui");
  for (const name of ["mero.css", "mero.js", "mero-forms.js", "mero-live.js"]) {
    const raw = manifest.files["ui/" + name];
    const minPath = "dist/ui/" + name.replace(/\.(js|css)$/, ".min.$1");
    const min = manifest.minified[minPath];
    assert.ok(raw && min, `${name} appears in manifest`);
    assert.match(min.integrity, /^sha384-[A-Za-z0-9+/=]+$/);
    assert.ok(min.bytes < raw.bytes, `${minPath} (${min.bytes}B) is smaller than ui/${name} (${raw.bytes}B)`);
    const content = await readFile(new URL(minPath, root), "utf8");
    assert.match(content, /^\/\*! @rubenlangeweg\/mero-ui /);
  }
});

test("MeroUI.configure translates messages, resolves [lang]/data-mero-locale, scopes dialogBackdrop and respects @layer mero",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const context = await browser.newContext({ locale: "en-US", timezoneId: "Europe/Amsterdam", reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.clock.install({ time: new Date("2026-11-23T09:46:00Z") });
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    const assets = {
      "/mero.css": ["text/css", "ui/mero.css"],
      "/mero.js": ["text/javascript", "ui/mero.js"],
      "/mero-forms.js": ["text/javascript", "ui/mero-forms.js"],
      "/mero-live.js": ["text/javascript", "ui/mero-live.js"],
      "/htmx.js": ["text/javascript", "public/vendor/htmx.min.js"],
    };

    const html = `<!doctype html><html lang="nl"><head>
      <style>@layer mero, utilities;</style>
      <link rel="stylesheet" href="/mero.css">
      <style>
        @layer utilities { .u-pad { padding: 2px; } }
        .host-override { background: rgb(1, 2, 3); }
        .host-grid { display: grid; }
      </style>
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-forms.js"></script>
      <script defer src="/mero-live.js"></script>
    </head><body>
      <time id="t-nl" data-mero-time="relative" datetime="2026-11-23T09:41:00Z">UTC</time>
      <time id="t-de" data-mero-time="relative" data-mero-locale="de-DE" datetime="2026-11-23T09:41:00Z">UTC</time>
      <time id="t-browser" data-mero-time="relative" data-mero-locale="browser" datetime="2026-11-23T09:41:00Z">UTC</time>
      <button id="btn-layered" class="mero-button u-pad host-override" type="button">Layered</button>
      <div data-mero-tabs>
        <div role="tablist">
          <button id="tab-a" role="tab" aria-selected="true" aria-controls="panel-a">A</button>
          <button id="tab-b" role="tab" aria-selected="false" aria-controls="panel-b">B</button>
        </div>
        <div id="panel-a" role="tabpanel" class="host-grid">Panel A</div>
        <div id="panel-b" role="tabpanel" class="host-grid" hidden>Panel B</div>
      </div>
      <button id="copy-btn" class="mero-button" type="button" data-mero-copy="secret-token">Copy</button>
      <div data-mero-peek>
        <table class="mero-table"><tbody>
          <tr id="r1"><td>
            <a id="row-link" class="mero-row-link" href="/item/1">Lamp</a>
            <template data-mero-peek-body><p>Details</p></template>
          </td></tr>
        </tbody></table>
      </div>
      <form id="confirm-form" data-mero-form data-mero-confirm>
        <code data-mero-confirm-phrase>delete/prod</code>
        <input id="confirm-input" data-mero-confirm-input>
        <p id="confirm-hint" data-mero-confirm-hint></p>
        <button type="submit" data-mero-confirm-submit disabled>Delete</button>
      </form>
      <dialog id="bare-dialog" style="width:120px;height:80px;margin:auto"><p>Bare</p></dialog>
      <dialog id="mero-dlg" class="mero-dialog" style="width:120px;height:80px;margin:auto"><p>Mero</p></dialog>
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

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
    });

    await page.goto("http://mero.test/");
    await page.waitForFunction(() => window.MeroUI);

    // 0. configure() exposes merged defaults from loaded core, forms and live modules.
    const defaults = await page.evaluate(() => window.MeroUI.configure().messages);
    assert.equal(typeof defaults.removeItem, "string");
    assert.equal(typeof defaults.confirmReady, "string");
    assert.equal(typeof defaults.liveError, "string");

    // 1. [lang="nl"] beats en-US browser locale automatically; data-mero-locale overrides both.
    assert.equal(await page.locator("#t-nl").textContent(), "5 minuten geleden");
    assert.equal(await page.locator("#t-de").textContent(), "vor 5 Minuten");
    assert.equal(await page.locator("#t-browser").textContent(), "5 minutes ago");

    // 2. MeroUI.configure({ locale }) overrides [lang] while element data-mero-locale still wins.
    await page.evaluate(() => window.MeroUI.configure({ locale: "fr-FR" }));
    assert.equal(await page.locator("#t-nl").textContent(), "il y a 5 minutes");
    assert.equal(await page.locator("#t-de").textContent(), "vor 5 Minuten", "element data-mero-locale still wins");

    // 3. MeroUI.configure({ messages }) translates core and form messages.
    await page.evaluate(() => window.MeroUI.configure({
      messages: {
        copied: "Gekopieerd",
        dismissNotification: "Sluiten",
        previewLabel: "Voorbeeld",
        openPreview: "Openen",
        confirmTypePhrase: "Typ de zin exact.",
        confirmReady: "Klaar om te bevestigen.",
      },
    }));
    await page.locator("#copy-btn").click();
    await page.locator(".mero-toast", { hasText: "Gekopieerd" }).waitFor();
    assert.equal(await page.locator(".mero-toast button").getAttribute("aria-label"), "Sluiten");

    await page.locator("#row-link").focus();
    await page.keyboard.press("Space");
    const panel = page.locator(".mero-peek");
    await panel.waitFor();
    assert.equal(await panel.getAttribute("aria-label"), "Voorbeeld");
    assert.equal(await panel.locator(".mero-peek-footer a").textContent(), "Openen");
    await page.keyboard.press("Escape");

    await page.locator("#confirm-input").fill("wrong");
    assert.equal(await page.locator("#confirm-hint").textContent(), "Typ de zin exact.");
    await page.locator("#confirm-input").fill("delete/prod");
    assert.equal(await page.locator("#confirm-hint").textContent(), "Klaar om te bevestigen.");

    // 4. dialogBackdrop defaults to "mero-only" (protecting bare non-Mero dialogs while dismissing .mero-dialog) and can opt into "all".
    assert.equal(await page.evaluate(() => window.MeroUI.configure().dialogBackdrop), "mero-only");
    await page.evaluate(() => {
      document.getElementById("bare-dialog").showModal();
    });
    await page.mouse.click(5, 5);
    assert.equal(await page.locator("#bare-dialog").evaluate(d => d.open), true, "bare dialog stays open under default mero-only");
    await page.evaluate(() => {
      document.getElementById("bare-dialog").close();
      document.getElementById("mero-dlg").showModal();
    });
    await page.mouse.click(5, 5);
    assert.equal(await page.locator("#mero-dlg").evaluate(d => d.open), false, ".mero-dialog still light-dismisses");
    await page.evaluate(() => {
      window.MeroUI.configure({ dialogBackdrop: "all" });
      document.getElementById("bare-dialog").showModal();
    });
    await page.mouse.click(5, 5);
    assert.equal(await page.locator("#bare-dialog").evaluate(d => d.open), false, "bare dialog light-dismisses when opted into all");

    // 5. @layer mero yields to @layer utilities and unlayered host CSS, while [hidden] still beats unlayered .host-grid.
    const styles = await page.locator("#btn-layered").evaluate(el => {
      const s = getComputedStyle(el);
      return { paddingTop: s.paddingTop, backgroundColor: s.backgroundColor };
    });
    assert.deepEqual(styles, { paddingTop: "2px", backgroundColor: "rgb(1, 2, 3)" });
    assert.equal(await page.locator("#panel-b").evaluate(el => getComputedStyle(el).display), "none", "hidden tab panel stays hidden despite unlayered .host-grid");
    assert.equal(await page.locator("#panel-a").evaluate(el => getComputedStyle(el).display), "grid");
    assert.deepEqual(errors, []);
  });

test("malformed lang attributes (en_US, x-private) never break MeroUI initialization or live polling",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const context = await browser.newContext({ locale: "en-US", reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.clock.install({ time: new Date("2026-11-23T09:45:55Z") });
    await page.clock.pauseAt(new Date("2026-11-23T09:46:00Z"));
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    const assets = {
      "/mero.css": ["text/css", "ui/mero.css"],
      "/mero.js": ["text/javascript", "ui/mero.js"],
      "/mero-live.js": ["text/javascript", "ui/mero-live.js"],
      "/htmx.js": ["text/javascript", "public/vendor/htmx.min.js"],
    };

    const html = `<!doctype html><html lang="en_US"><head>
      <link rel="stylesheet" href="/mero.css">
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-live.js"></script>
    </head><body>
      <time id="t-bad" data-mero-time="relative" datetime="2026-11-23T09:41:00Z">UTC</time>
      <dialog id="auto-dlg" data-mero-autoopen><p>Auto opened</p></dialog>
      <div id="bad-live" lang="x-private" data-mero-live="500" hx-get="/bad-live" hx-trigger="mero:refresh" hx-target="find [data-mero-live-status]">
        <span data-mero-live-status>Queued</span>
        <span id="bad-live-err" data-mero-live-error="Stale since {time}"></span>
      </div>
    </body></html>`;

    let hits = 0;
    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (assets[pathname]) {
        const [contentType, file] = assets[pathname];
        return route.fulfill({ contentType, body: await readFile(new URL(file, root)) });
      }
      if (pathname === "/bad-live") {
        hits += 1;
        if (hits === 1) return route.fulfill({ status: 503, body: "Down" });
        return route.fulfill({ status: 200, headers: { "Content-Type": "text/html", "Mero-Live": "done" }, body: "Recovered" });
      }
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");
    await page.waitForFunction(() => Boolean(window.MeroUI));
    assert.equal(await page.locator("#auto-dlg").evaluate(d => d.open), true, "auto-open dialog still runs after malformed lang");
    assert.equal(await page.locator("#t-bad").textContent(), "5 minutes ago", "falls back to browser locale without throwing");

    await page.clock.fastForward(600);
    await page.waitForFunction(() => document.getElementById("bad-live-err")?.textContent.includes("Stale since"));
    assert.equal(hits, 1);

    await page.clock.fastForward(600);
    await page.waitForSelector("#bad-live[data-mero-live-done]");
    assert.equal(hits, 2, "live region kept polling after error under malformed lang");
    assert.deepEqual(errors, []);
  });
