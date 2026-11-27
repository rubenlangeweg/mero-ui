import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

// A small boosted app served through route(): every page shares the shell and differs in <main>.
const shell = title => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
  <link rel="stylesheet" href="/mero.css"><script src="/vendor/htmx.min.js"></script><script src="/mero.js"></script></head>
  <body hx-boost:inherited="true" hx-select:inherited="#main" hx-target:inherited="#main" hx-swap:inherited="outerHTML" data-mero-boost="#main">
    <nav aria-label="App">
      <a href="/boost/b" id="to-b">Page B</a> <a href="/boost/slow" id="to-slow">Slow page</a>
      <a href="/boost/login" id="to-login">Login</a> <a href="/boost/down" id="to-down">Down</a>
      <input id="search" aria-label="Search">
      <button type="button" class="mero-button" id="open-drawer" data-mero-open="drawer">Menu</button>
      <form method="post" action="/boost/save" id="save"><button id="save-button">Save</button></form>
    </nav>
    <dialog class="mero-dialog mero-drawer" id="drawer" aria-label="Menu"><div class="mero-dialog-body"><a href="/boost/b" id="drawer-b">Page B</a><form method="post" action="/boost/publish" id="publish-form"><button id="publish-button">Publish</button></form></div></dialog>
    <main id="main"><h1>${title}</h1></main>
  </body></html>`;

test("boosted navigation: newest GET wins, foreign responses load fully, drawers close and focus follows",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const seen = [];
    page.on("request", request => { if (request.url().includes("/boost/")) seen.push([new URL(request.url()).pathname, request.method(), request.resourceType()]); });

    const holds = {};
    const hold = name => new Promise(resolve => { holds[name] = resolve; });
    let slowGate = null, saveGate = null;
    await page.route("**/boost/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const html = body => route.fulfill({ status: 200, contentType: "text/html", body }).catch(() => {});
      if (path === "/boost/slow") { await slowGate; return html(shell("Slow page")); }
      if (path === "/boost/save") { await saveGate; return html(shell("Saved")); }
      if (path === "/boost/publish") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: '{"error":"Destination is disabled"}',
        }).catch(() => {});
      }
      if (path === "/boost/login") return html('<!doctype html><title>Sign in</title><form><h1>Sign in</h1></form>');
      if (path === "/boost/down") return route.abort();
      return html(shell(path === "/boost/b" ? "Page B" : "Page A"));
    });
    const heading = page.locator("#main h1");
    const start = async () => { await page.goto(base + "/boost/a"); await page.waitForFunction(() => window.htmx && window.MeroUI); };

    // The newest navigation wins: the slower, older one is aborted and never swapped in.
    await start();
    slowGate = hold("slow");
    await page.locator("#to-slow").click();
    await page.locator("#to-b").click();
    await page.waitForURL("**/boost/b");
    assert.equal(await heading.textContent(), "Page B");
    holds.slow();
    await page.waitForTimeout(300);
    assert.equal(await heading.textContent(), "Page B", "the older answer never replaces the newer page");
    assert.ok(page.url().endsWith("/boost/b"));

    // Keyboard navigation moves focus to the new region.
    await page.locator("#to-slow").focus();
    slowGate = null;
    await page.keyboard.press("Enter");
    await page.waitForURL("**/boost/slow");
    await heading.filter({ hasText: "Slow page" }).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "main");

    // Focus the person moved during the load stays put.
    await start();
    slowGate = hold("slow");
    await page.locator("#to-slow").click();
    await page.locator("#search").focus();
    holds.slow();
    await heading.filter({ hasText: "Slow page" }).waitFor();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "search", "focus is never stolen");

    // An open drawer closes when its link navigates.
    slowGate = null;
    await page.locator("#open-drawer").click();
    assert.equal(await page.locator("#drawer").evaluate(dialog => dialog.open), true);
    await page.locator("#drawer-b").click();
    await heading.filter({ hasText: "Page B" }).waitFor();
    assert.equal(await page.locator("#drawer").evaluate(dialog => dialog.open), false);

    // A boosted form that changes data is never aborted by a later navigation.
    saveGate = hold("save");
    const saveFailed = [];
    page.on("requestfailed", request => { if (request.url().endsWith("/boost/save")) saveFailed.push(request.failure()?.errorText); });
    await page.locator("#save-button").click();
    await page.waitForTimeout(100);
    await page.locator("#to-slow").click();
    await heading.filter({ hasText: "Slow page" }).waitFor();
    holds.save();
    await page.waitForTimeout(300);
    assert.deepEqual(saveFailed, [], "the POST completed");

    // Issue #67: a boosted non-GET answer without the region keeps the page, never issues GET on the action URL, and emits mero:boost-unmatched.
    await start();
    seen.length = 0;
    await page.evaluate(() => {
      window.unmatched = [];
      document.addEventListener("mero:boost-unmatched", e => window.unmatched.push({
        status: e.detail.status,
        method: e.detail.method,
        text: e.detail.text,
        sourceId: e.detail.source?.id ?? null,
        hasResponse: Boolean(e.detail.response),
      }));
    });
    await page.locator("#open-drawer").click();
    await page.locator("#publish-button").click();
    await page.waitForFunction(() => window.unmatched.length === 1);
    await page.waitForTimeout(100);
    assert.deepEqual(seen.filter(([path]) => path === "/boost/publish"), [["/boost/publish", "POST", "fetch"]], "must never follow a non-GET error with GET /boost/publish");
    assert.equal(await heading.textContent(), "Page A", "page content stays intact");
    assert.equal(await page.locator("#drawer").evaluate(dialog => dialog.open), true, "open dialog stays open on unmatched non-GET");
    assert.deepEqual(await page.evaluate(() => window.unmatched[0]), {
      status: 409,
      method: "POST",
      text: '{"error":"Destination is disabled"}',
      sourceId: "publish-form",
      hasResponse: true,
    });

    // A response without the region (a login page) becomes a full page load.
    await page.evaluate(() => window.MeroUI.close("drawer"));
    await page.locator("#to-login").click();
    await page.waitForURL("**/boost/login");
    await page.waitForFunction(() => document.title === "Sign in" && !document.querySelector("#main"));

    // A failed boosted GET becomes a full load, so the browser shows its own error.
    await start();
    seen.length = 0;
    await page.locator("#to-down").click();
    await page.waitForEvent("requestfailed", request => request.url().endsWith("/boost/down") && request.resourceType() === "document").catch(() => {});
    assert.ok(seen.some(([path, , type]) => path === "/boost/down" && type === "document"), JSON.stringify(seen));
    assert.deepEqual(errors, []);
  });

test("the Drawer's Boosted navigation variant swaps the region, closes the drawer and focuses the new page",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const url = base + "/preview/drawer?variant=Boosted%20navigation";
    await page.goto(url);
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await drawer.getByRole("link", { name: "Reports" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Reports" }).waitFor();
    assert.equal(await page.locator("#boost-demo-drawer").evaluate(dialog => dialog.open), false);
    await drawer.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.id === "boost-demo-main");
    assert.equal(page.url(), url, "the demo keeps the preview URL");
  });
