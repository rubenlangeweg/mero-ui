import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("issue #62: show-when collects referenced fields in a single pass, handles nested dependencies and stays fast at scale",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));

    const assets = {
      "/mero.css": ["text/css", "ui/mero.css"],
      "/mero.js": ["text/javascript", "ui/mero.js"],
      "/mero-forms.js": ["text/javascript", "ui/mero-forms.js"],
      "/htmx.js": ["text/javascript", "public/vendor/htmx.min.js"],
    };

    // Build a form with nested dependent pairs, a multiselect-driven branch, a non-fieldset hidden div, and 400 repeated branches.
    const depPairs = Array.from({ length: 100 }, (_, i) => `
      <fieldset id="dep-parent-${i}" data-mero-show-when="depMode=on">
        <input type="hidden" name="dep_${i}" value="on">
      </fieldset>
      <fieldset id="dep-child-${i}" data-mero-show-when="dep_${i}=on">
        <input name="dep_val_${i}" value="ok" aria-label="Dep ${i}">
      </fieldset>
    `).join("");
    const rows = Array.from({ length: 400 }, (_, i) => `
      <fieldset id="row-${i}" data-mero-show-when="entity=${i % 2 === 0 ? "products" : "orders"}">
        <select name="col_${i}" aria-label="Col ${i}">
          <option value="a" selected>A</option>
          <option value="b">B</option>
        </select>
      </fieldset>
    `).join("");

    const html = `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-forms.js"></script>
    </head><body>
      <form id="big-form" data-mero-dirty>
        <select id="entity" name="entity" aria-label="Entity">
          <option value="products" selected>Products</option>
          <option value="orders">Orders</option>
        </select>
        <select id="dep-mode" name="depMode" aria-label="Dep mode">
          <option value="off" selected>Off</option>
          <option value="on">On</option>
        </select>
        <select id="plan" name="plan" aria-label="Plan">
          <option value="pro" selected>Pro</option>
          <option value="free">Free</option>
        </select>
        <fieldset id="plan-branch" data-mero-show-when="plan=pro">
          <select id="tier" name="tier" aria-label="Tier">
            <option value="enterprise" selected>Enterprise</option>
            <option value="team">Team</option>
          </select>
        </fieldset>
        <fieldset id="dependent-branch" data-mero-show-when="tier=enterprise">
          <input id="sso" name="sso" value="saml" aria-label="SSO">
        </fieldset>
        <div id="div-branch" data-mero-show-when="plan=enterprise" hidden>
          <input id="div-req" name="divReq" required aria-label="Div req">
        </div>
        <div id="channels" class="mero-multiselect" data-mero-multiselect data-mero-combo data-mero-multiselect-name="channels">
          <ul class="mero-multiselect-chips" data-mero-multiselect-chips>
            <li class="mero-chip" data-value="web">Web<input type="hidden" name="channels" value="web"><button type="button" data-mero-multiselect-remove>×</button></li>
          </ul>
          <input id="ch-input" name="search_unused" type="text" role="combobox" aria-label="Channels" aria-expanded="false" aria-controls="ch-list">
          <ul id="ch-list" role="listbox" aria-multiselectable="true" hidden>
            <li id="opt-web" role="option" data-value="web" aria-selected="true">Web</li>
            <li id="opt-b2b" role="option" data-value="b2b" aria-selected="false">B2B</li>
          </ul>
        </div>
        <fieldset id="b2b-branch" data-mero-show-when="channels=b2b" hidden>
          <input id="vat" name="vat" value="NL1" aria-label="VAT">
        </fieldset>
        ${depPairs}
        ${rows}
        <button id="save-btn" type="submit">Save</button>
      </form>
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
    await page.waitForFunction(() => Boolean(window.MeroUI && window.htmx));

    // 1. Initial state: products rows visible, orders rows hidden, dependent branch visible.
    assert.equal(await page.locator("#row-0").isVisible(), true);
    assert.equal(await page.locator("#row-1").isHidden(), true);
    assert.equal(await page.locator("#dependent-branch").isVisible(), true);
    assert.equal(await page.locator("#save-btn").isDisabled(), true);

    // 2. Nested/cascading dependency: hiding plan-branch disables #tier, which hides #dependent-branch in the same pass.
    await page.locator("#plan").selectOption("free");
    assert.equal(await page.locator("#plan-branch").isHidden(), true);
    assert.equal(await page.locator("#plan-branch").evaluate(el => el.disabled), true);
    assert.equal(await page.locator("#dependent-branch").isHidden(), true, "dependent branch sees disabled #tier inside hidden parent fieldset");

    // Re-enabling plan-branch restores #dependent-branch in the same pass.
    await page.locator("#plan").selectOption("pro");
    assert.equal(await page.locator("#dependent-branch").isVisible(), true);

    // 2b. Multiselect change (dispatched on search_unused input) resolves data-mero-multiselect-name="channels".
    assert.equal(await page.locator("#b2b-branch").isHidden(), true);
    await page.locator("#ch-input").fill("B2");
    await page.locator("#opt-b2b").click();
    await page.locator("#ch-input").press("Escape");
    assert.equal(await page.locator("#b2b-branch").isVisible(), true, "multiselect selection reveals channels=b2b branch");

    // 2c. Non-fieldset hidden div re-disables an input that external code re-enabled even while branch stays hidden.
    await page.evaluate(() => { document.getElementById("div-req").disabled = false; });
    await page.locator("#plan").selectOption("free");
    assert.equal(await page.locator("#div-req").isDisabled(), true, "hidden non-fieldset branch reconciles re-enabled descendant");

    // 2d. 100 dependent fieldset pairs scan form.elements at most once for show-when (no O(N^2) rescans).
    const depCheck = await page.evaluate(() => {
      const form = document.getElementById("big-form");
      const origDesc = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "elements");
      let elementReads = 0;
      Object.defineProperty(form, "elements", {
        configurable: true,
        get() { elementReads += 1; return origDesc.get.call(this); },
      });
      const sel = document.getElementById("dep-mode");
      sel.value = "on";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      delete form.elements;
      return {
        elementReads,
        child0Hidden: document.getElementById("dep-child-0").hidden,
        child99Hidden: document.getElementById("dep-child-99").hidden,
      };
    });
    assert.equal(depCheck.child0Hidden, false);
    assert.equal(depCheck.child99Hidden, false);
    // 1 read for show-when indexFormControls + 1 read for data-mero-dirty changed(form) = 2 total (not 101!).
    assert.ok(depCheck.elementReads <= 3, `expected <= 3 form.elements reads for 100 dependent pairs, got ${depCheck.elementReads}`);

    // 3. Single-pass scale check: switching entity across 400 branches + 100 dependent pairs stays fast,
    // and editing an unreferenced field skips branch re-evaluation while still marking form dirty.
    const timings = await page.evaluate(() => {
      const entity = document.getElementById("entity");
      const t0 = performance.now();
      entity.value = "orders";
      entity.dispatchEvent(new Event("change", { bubbles: true }));
      const switchMs = performance.now() - t0;

      const col1 = document.querySelector('select[name="col_1"]');
      const t1 = performance.now();
      col1.value = "b";
      col1.dispatchEvent(new Event("change", { bubbles: true }));
      const unrefMs = performance.now() - t1;

      return {
        switchMs,
        unrefMs,
        row0Hidden: document.getElementById("row-0").hidden,
        row1Hidden: document.getElementById("row-1").hidden,
        saveDisabled: document.getElementById("save-btn").disabled,
      };
    });

    assert.equal(timings.row0Hidden, true);
    assert.equal(timings.row1Hidden, false);
    assert.equal(timings.saveDisabled, false, "unreferenced field edit still updates data-mero-dirty");
    assert.ok(timings.switchMs < 500, `600-branch toggle took ${timings.switchMs.toFixed(1)}ms (expected < 500ms)`);
    assert.ok(timings.unrefMs < 250, `unreferenced field edit took ${timings.unrefMs.toFixed(1)}ms (expected < 250ms)`);
    assert.deepEqual(errors, []);
  });
