import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("v0.13 primitives: multiselect, dirty-guard, show-when negation, 409 conflict swap and live backoff/interval",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    await page.clock.install();
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    const assets = {
      "/mero.css": ["text/css", "ui/mero.css"],
      "/mero.js": ["text/javascript", "ui/mero.js"],
      "/mero-forms.js": ["text/javascript", "ui/mero-forms.js"],
      "/mero-live.js": ["text/javascript", "ui/mero-live.js"],
      "/htmx.js": ["text/javascript", "public/vendor/htmx.min.js"],
    };

    const html = `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-forms.js"></script>
      <script defer src="/mero-live.js"></script>
    </head><body hx-boost:inherited="true">
      <a id="leave-link" href="/away">Leave page</a>
      <main id="main">
        <form id="edit-form" data-mero-form data-mero-dirty data-mero-dirty-guard="Unsaved draft!" data-mero-conflict-swap
              hx-post="/save" hx-target="this" hx-swap="outerHTML">
          <input id="title" name="title" value="Lamp" aria-label="Title">
          <select id="mode" name="mode" aria-label="Mode">
            <option value="none" selected>None</option>
            <option value="scheduled">Scheduled</option>
            <option value="manual">Manual</option>
          </select>
          <fieldset id="not-none" data-mero-show-when="mode!=none" hidden disabled>
            <input id="note" name="note" value="x" aria-label="Note">
          </fieldset>
          <div id="keep-enabled" data-mero-show-when="mode=manual" data-mero-show-when-keep-enabled hidden>
            <input id="kept-input" name="kept" value="preserved" aria-label="Kept">
          </div>
          <div id="channels" class="mero-multiselect" data-mero-multiselect data-mero-combo data-mero-multiselect-name="channels">
            <div class="mero-multiselect-control">
              <ul class="mero-tag-group mero-multiselect-chips" data-mero-multiselect-chips>
                <li class="mero-chip" data-value="web">Web<input type="hidden" name="channels" value="web"><button type="button" aria-label="Remove Web" data-mero-multiselect-remove>×</button></li>
              </ul>
              <input id="ch-input" class="mero-multiselect-input" type="text" role="combobox" aria-label="Channels"
                     aria-expanded="false" aria-controls="ch-list" aria-autocomplete="list" autocomplete="off">
            </div>
            <ul id="ch-list" class="mero-listbox mero-combo-list" role="listbox" aria-multiselectable="true" hidden>
              <li id="opt-web" role="option" data-value="web" aria-selected="true">Web</li>
              <li id="opt-b2b" role="option" data-value="b2b" aria-selected="false">B2B</li>
              <li id="opt-pos" role="option" data-value="pos" aria-selected="false">POS</li>
            </ul>
            <span data-mero-combo-status role="status"></span>
          </div>
          <p data-mero-form-error hidden></p>
          <button id="save-btn" type="submit">Save</button>
        </form>
        <div id="live-box" data-mero-live="1000" hx-get="/live" hx-trigger="mero:refresh" hx-target="find [data-mero-live-status]">
          <div data-mero-live-status>Queued</div>
          <span data-mero-live-error></span>
          <button id="live-retry" type="button" data-mero-live-retry hidden>Retry</button>
        </div>
      </main>
    </body></html>`;

    let saveMode = "conflict";
    let awayHits = 0;
    const liveResponses = [
      { status: 503, body: "err1" },
      { status: 503, body: "err2" },
      { status: 200, headers: { "Mero-Live-Interval": "5000" }, body: "<span>Running</span>" },
      { status: 200, headers: { "Mero-Live": "done" }, body: "<span>Done</span>" },
    ];
    let liveHits = 0;

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (assets[pathname]) {
        const [contentType, file] = assets[pathname];
        return route.fulfill({ contentType, body: await readFile(new URL(file, root)) });
      }
      if (pathname === "/away") {
        awayHits += 1;
        return route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body><main id=\"main\"><p id=\"away-page\">Away</p></main></body></html>" });
      }
      if (pathname === "/save") {
        if (saveMode === "conflict") {
          return route.fulfill({
            status: 409,
            contentType: "text/html",
            body: `<form id="edit-form" data-mero-form data-mero-dirty data-mero-conflict-swap hx-post="/save" hx-target="this" hx-swap="outerHTML">
              <div id="conflict-banner">Someone else updated this record.</div>
              <button id="conflict-merge" type="button" data-mero-conflict-focus>Review conflict</button>
              <p data-mero-form-error hidden></p>
              <button id="save-btn" type="submit">Overwrite</button>
            </form>`,
          });
        }
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/html", "HX-Reswap": "none", "HX-Trigger": JSON.stringify({ "mero:form-saved": { message: "Saved!" } }) },
          body: "",
        });
      }
      if (pathname === "/live") {
        liveHits += 1;
        const next = liveResponses.shift() ?? { status: 200, headers: { "Mero-Live": "done" }, body: "<span>Done</span>" };
        return route.fulfill({ contentType: "text/html", ...next });
      }
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");
    await page.waitForFunction(() => window.MeroUI);
    await page.evaluate(() => {
      window.selections = [];
      window.actions = [];
      document.addEventListener("mero:selection", e => window.selections.push({ values: e.detail.values, added: e.detail.added, removed: e.detail.removed }));
      document.addEventListener("mero:action", e => window.actions.push({ state: e.detail.state, status: e.detail.status }));
      window.confirmCalls = [];
      window.confirmAnswer = false;
      window.confirm = text => { window.confirmCalls.push(text); return window.confirmAnswer; };
    });

    // 1. show-when negation (!=) and keep-enabled.
    assert.equal(await page.locator("#not-none").isHidden(), true);
    assert.equal(await page.locator("#keep-enabled").isHidden(), true);
    assert.equal(await page.locator("#kept-input").isDisabled(), false, "keep-enabled keeps hidden input enabled");
    await page.locator("#mode").selectOption("scheduled");
    assert.equal(await page.locator("#not-none").isVisible(), true, "mode!=none shows for scheduled");
    assert.equal(await page.locator("#not-none").isDisabled(), false);
    assert.equal(await page.locator("#save-btn").isDisabled(), false);
    await page.locator("#mode").selectOption("none");
    assert.equal(await page.locator("#not-none").isHidden(), true);
    assert.equal(await page.locator("#save-btn").isDisabled(), true, "back to clean");

    // 2. Multi-select combobox: add chip, Backspace remove, click remove, dirty tracking & FormData.
    const chInput = page.locator("#ch-input");
    await chInput.fill("B2");
    await page.locator("#opt-b2b").click();
    assert.equal(await page.locator("#save-btn").isDisabled(), false, "adding a multiselect chip marks form dirty");
    assert.deepEqual(await page.evaluate(() => new FormData(document.getElementById("edit-form")).getAll("channels")), ["web", "b2b"]);
    assert.equal(await page.locator("#opt-b2b").getAttribute("aria-selected"), "true");

    // Backspace on empty input removes last chip (b2b), returning form to clean.
    await chInput.press("Backspace");
    assert.deepEqual(await page.evaluate(() => new FormData(document.getElementById("edit-form")).getAll("channels")), ["web"]);
    assert.equal(await page.locator("#save-btn").isDisabled(), true, "removing added chip restores clean baseline");

    // Add POS, then test remove button click.
    await chInput.fill("PO");
    await page.locator("#opt-pos").click();
    await page.locator('[aria-label="Remove POS"]').click();
    assert.deepEqual(await page.evaluate(() => window.selections), [
      { values: ["web", "b2b"], added: "b2b", removed: null },
      { values: ["web"], added: null, removed: "b2b" },
      { values: ["web", "pos"], added: "pos", removed: null },
      { values: ["web"], added: null, removed: "pos" },
    ]);

    // 3. Draft leave guard blocks boosted navigation when confirm=false, resets after mero:form-saved.
    await page.locator("#title").fill("Lamp v2");
    assert.equal(await page.locator("#save-btn").isDisabled(), false);
    await page.locator("#leave-link").click();
    assert.deepEqual(await page.evaluate(() => window.confirmCalls), ["Unsaved draft!"]);
    assert.equal(awayHits, 0, "boosted navigation cancelled while dirty");

    saveMode = "saved";
    await page.locator("#save-btn").click();
    await page.locator(".mero-toast", { hasText: "Saved!" }).waitFor();
    assert.equal(await page.locator("#save-btn").isDisabled(), true, "mero:form-saved resets dirty baseline");

    // 4. HTTP 409 conflict swap swaps replacement markup and focuses [data-mero-conflict-focus].
    saveMode = "conflict";
    await page.locator("#title").fill("Lamp v3");
    await page.locator("#save-btn").click();
    await page.locator("#conflict-banner").waitFor();
    assert.equal(await page.locator("#conflict-merge").evaluate(el => el === document.activeElement), true, "409 swap focuses data-mero-conflict-focus");
    assert.equal(await page.locator("[data-mero-form-error]").isHidden(), true, "409 conflict swap does not clobber form error banner");
    assert.deepEqual((await page.evaluate(() => window.actions)).at(-1), { state: "rejected", status: 409 });

    // 5. mero-live exponential backoff and Mero-Live-Interval dynamic cadence.
    await page.evaluate(() => {
      window.liveReads = 0;
      document.addEventListener("htmx:finally:request", e => {
        if (e.detail.ctx.sourceElement?.id === "live-box") window.liveReads += 1;
      });
    });
    assert.equal(liveHits, 0);
    await page.clock.fastForward(1100);
    await page.waitForFunction(() => window.liveReads === 1);
    assert.equal(liveHits, 1, "1st poll failed");
    // 1st failure retries at base (1000ms).
    await page.clock.fastForward(1100);
    await page.waitForFunction(() => window.liveReads === 2);
    assert.equal(liveHits, 2, "2nd poll ran at base interval and also failed");
    // 2nd consecutive failure backs off to 2 * base (2000ms): at 1100ms it has NOT polled yet!
    await page.clock.fastForward(1100);
    await page.waitForTimeout(50);
    assert.equal(liveHits, 2, "backoff delayed 3rd poll beyond 1000ms");
    await page.clock.fastForward(1100);
    await page.waitForFunction(() => window.liveReads === 3);
    await page.locator("[data-mero-live-status]", { hasText: "Running" }).waitFor();
    assert.equal(liveHits, 3, "3rd poll succeeded with Mero-Live-Interval: 5000");
    // Server requested 5000ms cadence: at 2500ms no poll yet, at 5100ms it polls and finishes.
    await page.clock.fastForward(2500);
    await page.waitForTimeout(50);
    assert.equal(liveHits, 3, "honors Mero-Live-Interval: 5000");
    await page.clock.fastForward(2700);
    await page.waitForFunction(() => window.liveReads === 4);
    await page.locator("[data-mero-live-status]", { hasText: "Done" }).waitFor();
    assert.equal(liveHits, 4);
    assert.deepEqual(errors, []);
  });
