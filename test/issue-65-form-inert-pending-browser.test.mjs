import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("issue #65: data-mero-form marks editable fields inert while pending without dropping FormData and restores on settle",
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

    const formMarkup = (name = "Alpha", invalid = false) => `
      <form id="channel-form" data-mero-form hx-post="/save" hx-target="this" hx-swap="outerHTML">
        <input id="name" name="name" value="${name}" ${invalid ? 'aria-invalid="true"' : ""} aria-label="Name">
        <select id="tier" name="tier" aria-label="Tier">
          <option value="std" selected>Standard</option>
          <option value="pro">Pro</option>
        </select>
        <fieldset id="host-inert" inert>
          <input id="locked" name="locked" value="stay-inert" aria-label="Locked">
        </fieldset>
        <p id="err" data-mero-form-error role="alert" hidden></p>
        <button id="cancel" type="button" data-mero-close>Cancel</button>
        <button id="reset" type="reset">Reset</button>
        <button id="save" type="submit">Save</button>
      </form>`;

    const html = `<!doctype html><html lang="en"><head>
      <link rel="stylesheet" href="/mero.css">
      <script src="/htmx.js"></script>
      <script defer src="/mero.js"></script>
      <script defer src="/mero-forms.js"></script>
    </head><body>
      <dialog id="dlg" open class="mero-dialog">${formMarkup()}</dialog>
    </body></html>`;

    let mode = "422";
    let arrived = null;
    let release = null;
    const receivedBodies = [];

    await page.route("http://mero.test/**", async route => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (assets[pathname]) {
        const [contentType, file] = assets[pathname];
        return route.fulfill({ contentType, body: await readFile(new URL(file, root)) });
      }
      if (pathname === "/save") {
        receivedBodies.push(route.request().postData() || "");
        arrived?.();
        await new Promise(resolve => { release = resolve; });
        if (mode === "422") {
          return route.fulfill({ status: 422, contentType: "text/html", body: formMarkup("Beta", true) });
        }
        return route.fulfill({
          status: 500,
          headers: { "Content-Type": "text/html", "Mero-Form-Error": "Try again" },
          body: "",
        });
      }
      return route.fulfill({ status: 404, body: "" });
    });

    await page.goto("http://mero.test/");
    await page.waitForFunction(() => Boolean(window.MeroUI && window.htmx));

    // 1. Submit and verify editable fields become inert while pending, Cancel remains active, and FormData includes fields.
    await page.locator("#name").fill("Beta");
    let waitArrived = new Promise(resolve => { arrived = resolve; });
    await page.locator("#save").click();
    await waitArrived;

    const pendingState = await page.evaluate(() => ({
      busy: document.getElementById("channel-form").getAttribute("aria-busy"),
      nameInert: document.getElementById("name").inert,
      tierInert: document.getElementById("tier").inert,
      resetInert: document.getElementById("reset").inert,
      cancelInert: document.getElementById("cancel").inert,
      saveDisabled: document.getElementById("save").disabled,
    }));
    assert.deepEqual(pendingState, {
      busy: "true",
      nameInert: true,
      tierInert: true,
      resetInert: true,
      cancelInert: false,
      saveDisabled: true,
    });
    assert.match(receivedBodies[0], /name=Beta/, "inert fields are still submitted in FormData");
    assert.match(receivedBodies[0], /tier=std/);

    // Release 422 replacement swap -> replacement form is immediately editable and focuses invalid field.
    release();
    await page.waitForFunction(() => document.getElementById("name")?.getAttribute("aria-invalid") === "true");
    assert.equal(await page.locator("#name").evaluate(el => el.inert), false);
    assert.equal(await page.locator("#name").evaluate(el => el === document.activeElement), true);

    // 2. Surviving form after 500 error restores Mero's inert controls while keeping host's pre-existing inert fieldset intact.
    mode = "500";
    waitArrived = new Promise(resolve => { arrived = resolve; });
    await page.locator("#save").click();
    await waitArrived;
    assert.equal(await page.locator("#name").evaluate(el => el.inert), true);
    release();
    await page.locator("#err").waitFor({ state: "visible" });

    const settledState = await page.evaluate(() => ({
      nameInert: document.getElementById("name").inert,
      tierInert: document.getElementById("tier").inert,
      resetInert: document.getElementById("reset").inert,
      hostFieldsetInert: document.getElementById("host-inert").inert,
    }));
    assert.deepEqual(settledState, {
      nameInert: false,
      tierInert: false,
      resetInert: false,
      hostFieldsetInert: true,
    }, "Mero restores only its own inert nodes and preserves host-owned inert subtrees");

    // Verify user can type again immediately after settle.
    await page.locator("#name").fill("Gamma");
    assert.equal(await page.locator("#name").inputValue(), "Gamma");
    assert.deepEqual(errors, []);
  });
