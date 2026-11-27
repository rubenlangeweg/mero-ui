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
    let slowGate = null, saveGate = null, publishGate = null, publishArrived = null;
    await page.route("**/boost/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const html = body => route.fulfill({ status: 200, contentType: "text/html", body }).catch(() => {});
      if (path === "/boost/slow") { await slowGate; return html(shell("Slow page")); }
      if (path === "/boost/save") { await saveGate; return html(shell("Saved")); }
      if (path === "/boost/publish") {
        publishArrived?.();
        if (publishGate) await publishGate;
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

    // Detached-source case: removing the pending form while #main stays mounted still cancels swap and emits mero:boost-unmatched on document.
    publishGate = hold("publish");
    const pubSeen = new Promise(resolve => { publishArrived = resolve; });
    await page.locator("#publish-button").click();
    await pubSeen;
    await page.evaluate(() => document.getElementById("publish-form").remove());
    holds.publish();
    publishGate = null;
    publishArrived = null;
    await page.waitForFunction(() => window.unmatched.length === 2);
    await page.waitForTimeout(100);
    assert.equal(await heading.textContent(), "Page A", "detached form 409 JSON never overwrites #main");
    assert.deepEqual(seen.filter(([path]) => path === "/boost/publish"), [
      ["/boost/publish", "POST", "fetch"],
      ["/boost/publish", "POST", "fetch"],
    ], "detached form never triggers GET /boost/publish");
    assert.deepEqual(await page.evaluate(() => window.unmatched[1]), {
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

test("issue #64: data-mero-boost guards explicit hx-get targeting the boosted region and respects data-mero-boost-ignore",
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
    page.on("request", request => { if (request.url().includes("/hxboost/")) seen.push([new URL(request.url()).pathname, request.method(), request.resourceType()]); });

    // Real-world setup: hx-boost:inherited config without separate hx-select:inherited / hx-swap:inherited.
    const doc = (title, body = `<a id="in-main-c" href="/hxboost/c" hx-get="/hxboost/c" hx-target="#main">Open C</a>`) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
      <link rel="stylesheet" href="/mero.css"><script src="/vendor/htmx.min.js"></script><script src="/mero.js"></script></head>
      <body hx-boost:inherited='target:#main, select:#main, swap:"outerHTML"' data-mero-boost="#main">
        <nav aria-label="App">
          <button type="button" id="hx-slow" hx-get="/hxboost/slow" hx-target="#main">Slow filter</button>
          <button type="button" id="hx-b" hx-get="/hxboost/b" hx-target="#main">Page B</button>
          <button type="button" id="hx-inner" hx-get="/hxboost/b" hx-target="#main" hx-swap="innerHTML">Inner B</button>
          <button type="button" id="hx-retarget" hx-get="/hxboost/sidebar" hx-target="#main">Retargeted sidebar</button>
          <button type="button" id="hx-login" hx-get="/hxboost/login" hx-target="#main">Login</button>
          <button type="button" id="hx-down" hx-get="/hxboost/down" hx-target="#main">Down</button>
          <button type="button" id="hx-frag" hx-get="/hxboost/fragment" hx-target="#main" data-mero-boost-ignore>Raw fragment</button>
          <button type="button" id="open-drawer" data-mero-open="drawer">Menu</button>
        </nav>
        <aside id="sidebar"></aside>
        <dialog class="mero-dialog mero-drawer" id="drawer" aria-label="Menu">
          <div class="mero-dialog-body">
            <button type="button" id="drawer-hx-b" hx-get="/hxboost/b" hx-target="#main">Drawer B</button>
            <button type="button" id="drawer-frag" hx-get="/hxboost/fragment" hx-target="#main" data-mero-boost-ignore>Drawer fragment</button>
          </div>
        </dialog>
        <main id="main">
          <h1>${title}</h1>
          ${body}
        </main>
      </body></html>`;

    const holds = {};
    const hold = name => new Promise(resolve => { holds[name] = resolve; });
    let slowGate = null;
    await page.route("**/hxboost/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const html = body => route.fulfill({ status: 200, contentType: "text/html", body }).catch(() => {});
      if (path === "/hxboost/slow") { await slowGate; return html(doc("Slow page")); }
      if (path === "/hxboost/b") return html(doc("Page B"));
      if (path === "/hxboost/c") return html(doc("Page C", "<p>Detail view</p>"));
      if (path === "/hxboost/login") return html('<!doctype html><title>Sign in</title><form><h1>Sign in</h1></form>');
      if (path === "/hxboost/fragment") return html('<section id="raw-frag"><h2>Fragment content</h2></section>');
      if (path === "/hxboost/sidebar") return html('<div id="side-item">Sidebar fragment</div>');
      if (path === "/hxboost/down") return route.abort();
      return html(doc("Page A"));
    });

    const start = async () => { await page.goto(base + "/hxboost/a"); await page.waitForFunction(() => window.htmx && window.MeroUI); };

    // 1. Explicit hx-get targeting #main: newest wins, full-page answer selects #main without nesting, and focus moves to #main.
    await start();
    slowGate = hold("slow");
    await page.locator("#hx-slow").click();
    await page.locator("#hx-b").click();
    await page.locator("#main h1", { hasText: "Page B" }).waitFor();
    holds.slow();
    await page.waitForTimeout(200);
    assert.equal(await page.locator("#main h1").textContent(), "Page B", "older explicit hx-get never overwrites newer one");
    assert.equal(await page.locator("main#main").count(), 1, "full-page answer extracts #main via outerHTML with no nested main");
    await page.waitForFunction(() => document.activeElement?.id === "main");

    // 2. Explicit hx-get inside #main (detached by outerHTML swap) still moves focus to the new #main.
    await page.locator("#in-main-c").click();
    await page.locator("#main h1", { hasText: "Page C" }).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "main");

    // 3. Open drawer closes on guarded explicit hx-get.
    await page.locator("#open-drawer").click();
    assert.equal(await page.locator("#drawer").evaluate(d => d.open), true);
    await page.locator("#drawer-hx-b").click();
    await page.locator("#main h1", { hasText: "Page B" }).waitFor();
    assert.equal(await page.locator("#drawer").evaluate(d => d.open), false, "drawer closes on guarded explicit hx-get");

    // 4. Opt-out via data-mero-boost-ignore: swaps a raw fragment without #main and keeps drawer open.
    await page.locator("#open-drawer").click();
    await page.locator("#drawer-frag").click();
    await page.locator("#raw-frag h2", { hasText: "Fragment content" }).waitFor();
    assert.equal(await page.locator("#drawer").evaluate(d => d.open), true, "opt-out fragment keeps drawer open");
    assert.equal(await page.locator("#main").count(), 1, "innerHTML swap preserved #main wrapper");

    // 4b. Explicit hx-swap="innerHTML" extracts #main's inner content without duplicating <nav> or nesting <main id="main">.
    await page.evaluate(() => window.MeroUI.close("drawer"));
    await page.locator("#hx-inner").click();
    await page.locator("#main h1", { hasText: "Page B" }).waitFor();
    assert.equal(await page.locator("main#main").count(), 1, "explicit innerHTML never nests a second #main");
    assert.equal(await page.locator("nav").count(), 1, "explicit innerHTML never duplicates outer nav shell");

    // 4c. Programmatic htmx.ajax('GET', ..., { target: '#main' }) is NOT hijacked into a full-page load.
    await page.evaluate(() => window.htmx.ajax("GET", "/hxboost/fragment", { target: "#main" }));
    await page.locator("#raw-frag h2", { hasText: "Fragment content" }).waitFor();
    assert.ok(page.url().endsWith("/hxboost/a"), "htmx.ajax swaps fragment in place without top-level navigation");

    // 4d. A later htmx:config:request listener retargeting away from #main undoes Mero's auto select/swap and sends HX-Request-Type: partial.
    let sidebarReqType = null;
    await page.evaluate(() => {
      document.addEventListener("htmx:config:request", event => {
        if (event.detail.ctx.sourceElement?.id === "hx-retarget") {
          event.detail.ctx.target = document.getElementById("sidebar");
        }
      });
      document.addEventListener("htmx:before:request", event => {
        if (event.detail.ctx.sourceElement?.id === "hx-retarget") {
          window.retargetType = event.detail.ctx.request.headers["HX-Request-Type"];
        }
      });
    });
    await page.locator("#hx-retarget").click();
    await page.locator("#sidebar #side-item", { hasText: "Sidebar fragment" }).waitFor();
    sidebarReqType = await page.evaluate(() => window.retargetType);
    assert.equal(sidebarReqType, "partial", "retargeted request sends HX-Request-Type: partial and swaps into #sidebar");
    assert.ok(page.url().endsWith("/hxboost/a"), "retargeted sidebar fragment stays in-page");

    // 5. Foreign response without #main triggers full-page fallback.
    await page.locator("#hx-login").click();
    await page.waitForURL("**/hxboost/login");
    await page.waitForFunction(() => document.title === "Sign in" && !document.querySelector("#main"));

    // 6. Failed explicit hx-get triggers full-load fallback.
    await start();
    seen.length = 0;
    await page.locator("#hx-down").click();
    await page.waitForEvent("requestfailed", request => request.url().endsWith("/hxboost/down") && request.resourceType() === "document").catch(() => {});
    assert.ok(seen.some(([path, , type]) => path === "/hxboost/down" && type === "document"), JSON.stringify(seen));
    assert.deepEqual(errors, []);
  });
