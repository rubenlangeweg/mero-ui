import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("v0.10 core CSS: danger hover contrast, density tokens, pending cursor and data-theme=auto",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    await page.route(base + "/css-check", route => route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en" data-theme="light"><head>
        <link rel="stylesheet" href="/mero.css">
        <style>
          .dense { --mero-control-height-sm: 1.75rem; --mero-control-height-lg: 3.5rem; }
        </style>
      </head><body>
        <button id="danger" class="mero-button mero-button-danger" type="button">Delete</button>
        <div class="dense">
          <button id="sm" class="mero-button mero-button-sm" type="button">Small</button>
          <button id="lg" class="mero-button mero-button-lg" type="button">Large</button>
        </div>
        <button id="pending" class="mero-button" type="button" aria-disabled="true" data-mero-pending data-mero-request>Working</button>
        <button id="htmx-pending" class="mero-button htmx-request" type="button" aria-disabled="true" data-mero-request>Syncing</button>
        <div id="auto-scope" data-theme="auto"><p id="auto-text" class="mero-text">Auto</p></div>
      </body></html>`,
    }));
    await page.goto(base + "/css-check");

    const contrastRatio = button => button.evaluate(el => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const rgba = color => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      const composite = (fg, bg) => {
        const a = fg[3] / 255;
        return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
      };
      const luminance = rgb => {
        const c = rgb.map(v => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const surface = rgba(getComputedStyle(document.documentElement).getPropertyValue("--mero-surface").trim());
      const style = getComputedStyle(el);
      const bg = composite(rgba(style.backgroundColor), surface);
      const fg = composite(rgba(style.color), bg);
      const l1 = luminance(fg), l2 = luminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    });

    const danger = page.locator("#danger");
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const rest = await contrastRatio(danger);
      assert.ok(rest >= 4.5, `${theme} danger rest contrast ${rest.toFixed(2)} >= 4.5`);
      await danger.hover();
      const hovered = await contrastRatio(danger);
      assert.ok(hovered >= 4.5, `${theme} danger hover contrast ${hovered.toFixed(2)} >= 4.5`);
      await page.mouse.move(0, 0);
    }

    assert.equal(await page.locator("#sm").evaluate(el => Math.round(el.getBoundingClientRect().height)), 28, "--mero-control-height-sm sets .mero-button-sm height");
    assert.equal(await page.locator("#lg").evaluate(el => Math.round(el.getBoundingClientRect().height)), 56, "--mero-control-height-lg sets .mero-button-lg height");

    assert.equal(await page.locator("#pending").evaluate(el => getComputedStyle(el).cursor), "progress");
    assert.equal(await page.locator("#htmx-pending").evaluate(el => getComputedStyle(el).cursor), "progress");

    await page.emulateMedia({ colorScheme: "light" });
    const lightBg = await page.locator("#auto-scope").evaluate(el => getComputedStyle(el).getPropertyValue("--mero-surface").trim());
    assert.equal(lightBg, "#fff");
    await page.emulateMedia({ colorScheme: "dark" });
    const darkBg = await page.locator("#auto-scope").evaluate(el => getComputedStyle(el).getPropertyValue("--mero-surface").trim());
    assert.equal(darkBg, "#1c1c1e");
  });

test("mero:peek fires on open, row change and close, never repeating when a swap keeps the same row open",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(5000);
    await page.addInitScript(() => {
      window.peekEvents = [];
      document.addEventListener("mero:peek", event => window.peekEvents.push({
        open: event.detail.open,
        key: event.detail.key,
        hasLink: Boolean(event.detail.link),
        hasPanel: Boolean(event.detail.panel),
      }));
    });
    const events = () => page.evaluate(() => window.peekEvents.splice(0));

    await page.goto(base + "/preview/sortable-table?variant=Row%20peek");
    const firstRowId = await page.locator("tr", { has: page.getByRole("link", { name: "Arc Task Lamp", exact: true }) }).getAttribute("id");
    const secondRowId = await page.locator("tr", { has: page.getByRole("link", { name: "Ash Lounge Chair", exact: true }) }).getAttribute("id");
    await page.getByRole("link", { name: "Arc Task Lamp", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("complementary", { name: "Preview" }).waitFor();
    assert.deepEqual(await events(), [{ open: true, key: firstRowId, hasLink: true, hasPanel: true }]);

    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector(".mero-peek-title")?.textContent === "Ash Lounge Chair");
    assert.deepEqual(await events(), [{ open: true, key: secondRowId, hasLink: true, hasPanel: true }]);

    await page.evaluate(() => htmx.ajax("GET", location.href, { target: "[data-mero-records]", select: "[data-mero-records]", swap: "outerMorph" }));
    await page.waitForTimeout(150);
    assert.deepEqual(await events(), [], "morphing while keeping the same row open does not repeat mero:peek");

    await page.keyboard.press("Escape");
    await page.getByRole("complementary", { name: "Preview" }).waitFor({ state: "detached" });
    assert.deepEqual(await events(), [{ open: false, key: secondRowId, hasLink: false, hasPanel: false }]);
  });

test("MeroUI.close removes dialog toasts by default and reparents them with preserveToasts",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    await page.goto(base + "/preview/modal");

    const dialog = page.locator("dialog.mero-dialog").first();
    await page.locator("[data-mero-open]").first().click();
    await dialog.waitFor();
    await page.evaluate(() => window.MeroUI.toast("Ephemeral in dialog", { duration: 0 }));
    await dialog.locator(".mero-toast", { hasText: "Ephemeral in dialog" }).waitFor();
    await page.evaluate(() => window.MeroUI.close(document.querySelector("dialog.mero-dialog")));
    assert.equal(await page.locator(".mero-toast", { hasText: "Ephemeral in dialog" }).count(), 0);

    await page.locator("[data-mero-open]").first().click();
    await dialog.waitFor();
    await page.evaluate(() => window.MeroUI.toast("Survives close", { duration: 0 }));
    await dialog.locator(".mero-toast", { hasText: "Survives close" }).waitFor();
    await page.evaluate(() => window.MeroUI.close(document.querySelector("dialog.mero-dialog"), { preserveToasts: true }));
    await page.locator("body > .mero-toast-region .mero-toast", { hasText: "Survives close" }).waitFor();
    assert.equal(await dialog.locator(".mero-toast-region").count(), 0);

    // Native Escape dismissal emits mero:dialog once too.
    await page.evaluate(() => {
      window.dialogEvents = [];
      document.addEventListener("mero:dialog", event => window.dialogEvents.push(event.detail.open));
    });
    await page.locator("[data-mero-open]").first().click();
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.dialogEvents.length === 2);
    assert.deepEqual(await page.evaluate(() => window.dialogEvents), [true, false]);
  });
