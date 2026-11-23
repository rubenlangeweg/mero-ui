import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("a failed search never replaces the list and puts its filters back",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    // Playwright cannot fulfil a redirect in every engine, so the server sends a real one when asked.
    const app = createApp().listeners("request")[0];
    let redirect = false;
    const server = createServer((request, response) => {
      if (redirect && request.url.startsWith("/demo/catalog/search-results")) {
        response.writeHead(302, { Location: "/components" }).end();
        return;
      }
      app(request, response);
    });
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
    await page.goto(base + "/preview/search-field?variant=Filtered%20list");
    const query = page.getByRole("searchbox", { name: "Search projects" });
    const status = page.getByLabel("Status");
    const list = page.getByRole("list", { name: "Projects" });
    const error = page.locator("[data-mero-search-error]");
    const names = async () => (await list.locator("li").allTextContents()).map(text => text.split(" ")[0]);
    const idle = () => page.waitForFunction(() => !document.querySelector(".htmx-request")).then(() => page.waitForTimeout(350));

    await status.selectOption("active");
    await page.waitForFunction(() => document.querySelectorAll("#search-demo-results li").length === 3);
    assert.deepEqual(await names(), ["Atlas", "Cobalt", "Ember"]);

    // A 503 keeps the list and the filter it shows.
    await status.selectOption("archived");
    await error.waitFor();
    await idle();
    assert.deepEqual(await names(), ["Atlas", "Cobalt", "Ember"], "the error page is not swapped into the list");
    assert.equal(await error.textContent(), "Couldn't update the results. The list still shows the previous results.");
    assert.equal(await status.inputValue(), "active", "the select returns to the filter the list shows");

    // Typed text stays, and the next good read hides the error.
    await query.fill("co");
    await page.waitForFunction(() => document.querySelectorAll("#search-demo-results li").length === 1);
    assert.deepEqual(await names(), ["Cobalt"]);
    assert.equal(await error.isHidden(), true);

    // A 200 without the region (a login page) is not swapped; after a redirect it loads as a full page.
    await page.route("**/demo/catalog/search-results*", route => route.fulfill({ status: 200, contentType: "text/html", body: "<main><h1>Sign in</h1></main>" }));
    await status.selectOption("paused");
    await error.waitFor();
    await idle();
    assert.deepEqual(await names(), ["Cobalt"]);
    assert.equal(await status.inputValue(), "active");
    await page.unroute("**/demo/catalog/search-results*");
    redirect = true;
    await status.selectOption("paused");
    await page.waitForURL(url => url.pathname === "/components");
    assert.deepEqual(errors, []);
  });

test("an aborted older search does not reset the filters of a newer one",
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
    await page.goto(base + "/preview/search-field?variant=Filtered%20list");
    let first = true;
    await page.route("**/demo/catalog/search-results*", async route => {
      if (first) { first = false; await new Promise(resolve => setTimeout(resolve, 800)); }
      await route.continue().catch(() => {});
    });
    const status = page.getByLabel("Status");
    await status.selectOption("active");
    await page.waitForTimeout(400);
    await status.selectOption("paused");
    await page.waitForFunction(() => document.querySelectorAll("#search-demo-results li").length === 1);
    await page.waitForTimeout(900);
    assert.equal(await status.inputValue(), "paused");
    assert.deepEqual(await page.locator("#search-demo-results li").allTextContents(), ["Beacon paused"]);
    assert.equal(await page.locator("[data-mero-search-error]").isHidden(), true, "a superseded search is not an error");
  });
