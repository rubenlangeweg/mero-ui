import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("sortable table sorts through ?sort links with and without scripts",
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
    await page.goto(base + "/preview/sortable-table");

    const productHeader = page.locator("th").filter({ hasText: "Product" });
    const firstRow = () => page.locator("tbody .mero-row-link").first().textContent();
    assert.equal(await productHeader.getAttribute("aria-sort"), "ascending");
    await page.evaluate(() => { window.sameDocument = true; });
    await page.getByRole("link", { name: "Product" }).click();
    await page.waitForURL(/sort=-name/);
    await page.waitForFunction(() => document.querySelector("th[aria-sort]")?.getAttribute("aria-sort") === "descending");
    assert.equal(await firstRow(), "Woven Throw");
    assert.equal(await page.evaluate(() => document.activeElement.id), "records-sort-name");
    assert.equal(await page.evaluate(() => window.sameDocument), true, "hx-boost swaps the table in place");
    assert.equal(await page.locator("[data-mero-records]").count(), 1);

    // The swapped table keeps its menu button and row link behaviour.
    await page.getByRole("button", { name: "Actions for Halo Pendant" }).click();
    await page.waitForFunction(() => document.activeElement?.textContent.trim() === "Open details");
    assert.match(page.url(), /sort=-name$/, "the Actions button does not open the row");
    await page.keyboard.press("Escape");

    await page.locator("tbody tr").filter({ hasText: "Halo Pendant" }).locator("td").first().click({ force: true }); // the stretched link intercepts the cell on purpose
    await page.waitForURL(/sort=-name&open=2/);
    await page.getByRole("heading", { name: "Halo Pendant" }).waitFor();
    await page.getByRole("link", { name: "Back to products" }).click();
    await page.waitForURL(/sort=-name$/);
    assert.equal(await firstRow(), "Woven Throw");
    assert.deepEqual(errors, []);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(() => {
      const wrap = document.querySelector(".mero-table-wrap");
      return { wrap: wrap.scrollWidth > wrap.clientWidth, page: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(overflow, { wrap: true, page: false });

    const context = await browser.newContext({ javaScriptEnabled: false });
    t.after(() => context.close());
    const plain = await context.newPage();
    await plain.goto(base + "/preview/sortable-table");
    await plain.getByRole("link", { name: "Status" }).click();
    await plain.waitForURL(/sort=status/);
    assert.equal(await plain.locator("th[aria-sort]").textContent(), "Status ↑");
    assert.equal(await plain.locator("tbody .mero-row-link").first().textContent(), "Arc Task Lamp");
  });

test("focus returns to the opened row link after Back",
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
    const activeRow = () => page.evaluate(() => document.activeElement.matches("a.mero-row-link") ? document.activeElement.textContent : null);

    await page.goto(base + "/preview/sortable-table");
    assert.equal(await activeRow(), null, "a fresh visit focuses no row");
    await page.getByRole("link", { name: "Halo Pendant" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/open=2/);
    await page.goBack();
    await page.waitForFunction(() => document.activeElement?.matches("a.mero-row-link") && document.activeElement.textContent === "Halo Pendant");

    // The key is consumed, so a reload of the same entry leaves focus alone.
    await page.goto(base + "/preview/sortable-table");
    assert.equal(await activeRow(), null);

    // A fresh visit consumes the key too, so a later Back to that URL does not focus a stale row.
    await page.getByRole("link", { name: "Halo Pendant" }).click();
    await page.waitForURL(/open=2/);
    await page.getByRole("link", { name: "Back to products" }).click();
    await page.waitForURL(url => !url.search.includes("open="));
    await page.goto(base + "/components");
    await page.goBack();
    await page.getByRole("link", { name: "Halo Pendant" }).waitFor();
    await page.waitForTimeout(100);
    assert.equal(await activeRow(), null);

    // HTMX history: the boosted header pushed ?sort=-name, Back restores the snapshot.
    await page.getByRole("link", { name: "Product" }).click();
    await page.waitForURL(/sort=-name/);
    await page.goBack();
    await page.waitForFunction(() => document.querySelector("th[aria-sort]")?.getAttribute("aria-sort") === "ascending");
    await page.waitForFunction(() => document.activeElement?.id === "records-sort-name");
    assert.deepEqual(errors, []);

    const blocked = await browser.newPage();
    const blockedErrors = [];
    blocked.on("pageerror", error => blockedErrors.push(error.message));
    await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("blocked", "QuotaExceededError"); }; });
    await blocked.goto(base + "/preview/sortable-table");
    await blocked.getByRole("link", { name: "Halo Pendant" }).click();
    await blocked.waitForURL(/open=2/);
    await blocked.goBack();
    await blocked.getByRole("link", { name: "Halo Pendant" }).waitFor();
    assert.deepEqual(blockedErrors, []);
  });

test("filter chips add, remove and clear filters through the URL",
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
    const statuses = () => page.locator("tbody .mero-badge").allTextContents();
    const chipNames = () => page.locator(".mero-filter-chips a").evaluateAll(links => links.map(link => link.getAttribute("aria-label")));

    await page.goto(base + "/preview/filter-chips");
    await page.getByRole("button", { name: "Add filter" }).focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.textContent === "Status is Active");
    await page.keyboard.press("s");
    await page.waitForFunction(() => document.activeElement?.textContent === "Status is Draft");
    await page.keyboard.press("Enter");
    await page.waitForURL(/status=Draft/);
    await page.waitForFunction(() => document.querySelector(".mero-filter-chips"));
    assert.deepEqual(await statuses(), ["Draft", "Draft"]);
    assert.deepEqual(await chipNames(), ["Remove filter: Status is Draft"]);
    await page.waitForFunction(() => document.activeElement?.id === "records-filter-add");

    // Sorting after a swap keeps the filter.
    await page.getByRole("link", { name: "Product" }).click();
    await page.waitForURL(/status=Draft&sort=-name/);
    await page.reload();
    assert.deepEqual(await chipNames(), ["Remove filter: Status is Draft"]);

    await page.getByRole("link", { name: "Remove filter: Status is Draft" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(url => !url.search.includes("status"));
    await page.waitForFunction(() => !document.querySelector(".mero-filter-chips"));
    await page.waitForFunction(() => document.activeElement?.id === "records-filter-add");
    assert.equal((await statuses()).length, 8);

    await page.goBack();
    await page.waitForURL(/status=Draft/);
    await page.waitForFunction(() => document.querySelector(".mero-filter-chips"));
    assert.deepEqual(await statuses(), ["Draft", "Draft"]);

    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "Category is Textiles" }).click();
    await page.waitForURL(/category=Textiles/);
    await page.waitForFunction(() => document.querySelectorAll(".mero-filter-chips li").length === 2);
    await page.waitForFunction(() => document.activeElement?.id === "records-filter-add");
    assert.equal(await page.locator("tbody .mero-row-link").textContent(), "Linen Cushion");
    await page.getByRole("link", { name: "Clear all filters" }).click();
    await page.waitForFunction(() => !document.querySelector(".mero-filter-chips"));
    assert.equal(new URL(page.url()).search, "?sort=-name");
    await page.waitForFunction(() => document.activeElement?.id === "records-filter-add", null, { timeout: 2000 }); // the fallback runs at afterSettle, after the swap

    assert.deepEqual(errors, []);

    const context = await browser.newContext({ javaScriptEnabled: false });
    t.after(() => context.close());
    const plain = await context.newPage();
    await plain.goto(base + "/preview/filter-chips?status=Active&category=Objects");
    await plain.getByRole("link", { name: "Remove filter: Category is Objects" }).click();
    await plain.waitForURL(url => url.search === "?status=Active");
    assert.equal(await plain.locator(".mero-filter-chips li").count(), 1);
    assert.equal(await plain.locator("tbody .mero-row-link").count(), 4);
  });
