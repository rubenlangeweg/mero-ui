import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("issue #61: [data-mero-form-error] clears and hides on dialog close and form reset",
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

    const html = `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-forms.js"></script>
    </head><body>
      <button id="open-edit" type="button" class="mero-button" data-mero-open="edit-dialog">Edit</button>
      <dialog id="edit-dialog" class="mero-dialog" aria-labelledby="edit-title">
        <form id="dlg-form" class="mero-dialog-body" hx-post="/save" hx-swap="none" data-mero-form>
          <h2 id="edit-title">Edit</h2>
          <p id="dlg-error" class="mero-field-error" data-mero-form-error role="alert" hidden></p>
          <div class="mero-dialog-footer">
            <button id="cancel-btn" type="button" class="mero-button" data-mero-close>Cancel</button>
            <button id="dlg-save" type="submit" class="mero-button mero-button-primary">Save</button>
          </div>
        </form>
      </dialog>

      <form id="page-form" hx-post="/save" hx-swap="none" data-mero-form>
        <input id="page-name" name="name" value="Initial" aria-label="Name">
        <p id="page-error" class="mero-field-error" data-mero-form-error role="alert" hidden></p>
        <button id="page-save" type="submit" class="mero-button">Save inline</button>
        <button id="page-reset" type="reset" class="mero-button">Reset</button>
      </form>
    </body></html>`;

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (assets[pathname]) {
        const [contentType, file] = assets[pathname];
        return route.fulfill({ contentType, body: await readFile(new URL(file, root)) });
      }
      if (pathname === "/save") {
        return route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/html",
            "HX-Reswap": "none",
            "Mero-Action-Outcome": "rejected",
            "Mero-Action-Message": "Value is too high",
          },
          body: "",
        });
      }
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");
    await page.waitForFunction(() => Boolean(window.MeroUI && window.htmx));

    // 1. Closing via Cancel button clears and hides the dialog form error.
    await page.locator("#open-edit").click();
    await page.locator("#dlg-save").click();
    await page.locator("#dlg-error").waitFor({ state: "visible" });
    assert.equal(await page.locator("#dlg-error").textContent(), "Value is too high");

    await page.locator("#cancel-btn").click();
    await page.waitForFunction(() => !document.getElementById("edit-dialog").open);
    await page.locator("#open-edit").click();
    assert.equal(await page.locator("#dlg-error").isHidden(), true, "error is hidden after reopening dialog");
    assert.equal(await page.locator("#dlg-error").textContent(), "", "error text is emptied on dialog close");

    // 2. Closing via Escape also clears and hides the error.
    await page.locator("#dlg-save").click();
    await page.locator("#dlg-error").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("edit-dialog").open);
    await page.locator("#open-edit").click();
    assert.equal(await page.locator("#dlg-error").isHidden(), true, "Escape close hides error");
    assert.equal(await page.locator("#dlg-error").textContent(), "");

    // 3. Synchronous MeroUI.close(dialog); MeroUI.open(dialog) in one turn clears the previous error before reopening.
    await page.locator("#dlg-save").click();
    await page.locator("#dlg-error").waitFor({ state: "visible" });
    await page.evaluate(() => {
      const dialog = document.getElementById("edit-dialog");
      window.MeroUI.close(dialog);
      window.MeroUI.open(dialog);
    });
    assert.equal(await page.locator("#edit-dialog").evaluate(d => d.open), true);
    assert.equal(await page.locator("#dlg-error").isHidden(), true, "immediate close+open clears prior error");
    assert.equal(await page.locator("#dlg-error").textContent(), "");
    await page.evaluate(() => window.MeroUI.close("edit-dialog"));

    // 4. Inline form outside dialog: trusted reset click canceled on window keeps error; normal reset clears it.
    await page.locator("#page-name").fill("Edited");
    await page.locator("#page-save").click();
    await page.locator("#page-error").waitFor({ state: "visible" });
    assert.equal(await page.locator("#page-error").textContent(), "Value is too high");

    await page.evaluate(() => {
      window.addEventListener("reset", e => e.preventDefault(), { once: true });
    });
    await page.locator("#page-reset").click();
    await page.waitForTimeout(30);
    assert.equal(await page.locator("#page-name").inputValue(), "Edited", "window listener canceled reset");
    assert.equal(await page.locator("#page-error").isVisible(), true, "trusted reset click canceled on window keeps form error visible");
    assert.equal(await page.locator("#page-error").textContent(), "Value is too high");

    await page.locator("#page-reset").click();
    await page.waitForFunction(() => document.getElementById("page-error").hidden === true);
    assert.equal(await page.locator("#page-error").textContent(), "", "reset empties form error text");
    assert.deepEqual(errors, []);
  });
