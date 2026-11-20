import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";
import { browserConfig } from "../scripts/browser-config.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("live progress pauses, preserves the last good read, retries and stops at a terminal response",
  { skip: !playwright && "Install Playwright for the browser regression" }, async t => {
    const server = createApp();
    await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(7000);
    await page.clock.install();

    const responses = [];
    let hits = 0;
    await page.route("**/demo/catalog/live-progress*", async route => {
      hits++;
      const response = responses.shift();
      if (response === "stall") return; // htmx aborts the outstanding fetch at its configured timeout.
      if (response === "abort") return route.abort();
      return route.fulfill({ contentType: "text/html", ...(response ?? { status: 500, body: "Unexpected poll" }) });
    });
    await page.goto(base + "/preview/live-progress");
    const region = page.getByRole("region", { name: "Production deployment" });
    const status = region.locator("[data-mero-live-status]");
    const error = region.locator("[data-mero-live-error]");
    const retry = region.getByRole("button", { name: "Retry now", includeHidden: true });
    assert.equal((await status.textContent()).trim(), "Queued");
    assert.equal(await retry.isHidden(), true);
    await page.evaluate(() => {
      window.reads = 0;
      window.statusChanges = [];
      window.errors = [];
      for (const [selector, changes] of [["[data-mero-live-status]", window.statusChanges], ["[data-mero-live-error]", window.errors]]) {
        const element = document.querySelector(selector);
        new MutationObserver(() => changes.push(element.textContent.trim())).observe(element, { childList: true, subtree: true });
      }
      document.addEventListener("htmx:finally:request", event => {
        if (event.detail.ctx.sourceElement?.hasAttribute("data-mero-live")) window.reads++;
      });
    });

    async function visibility(value) {
      await page.evaluate(value => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, value);
    }

    async function read(response, trigger = () => page.clock.fastForward(3100)) {
      const next = await page.evaluate(() => window.reads + 1);
      responses.push(response);
      await trigger();
      await page.waitForFunction(next => window.reads >= next, next);
      assert.equal(hits, next);
    }
    // Let several intervals pass in a hidden document. Becoming visible reads immediately.
    await visibility("hidden");
    await page.clock.fastForward(9500);
    assert.equal(hits, 0);
    await read({ body: "<span>Running</span>" }, () => visibility("visible"));
    await read({ body: "<span>Running</span>" });
    assert.deepEqual(await page.evaluate(() => window.statusChanges), ["Running"]);

    await read({ status: 503, body: "<span>Failed</span>", headers: { "Mero-Live": "done" } });
    assert.equal(await status.textContent(), "Running");
    assert.equal(await error.textContent(), "Couldn't refresh. Retrying…");
    assert.equal(await retry.isVisible(), true);
    await read("abort", () => retry.click());
    assert.equal(await status.textContent(), "Running");
    assert.deepEqual(await page.evaluate(() => window.errors), ["Couldn't refresh. Retrying…"]);

    await read("stall", async () => {
      const requested = page.waitForRequest("**/demo/catalog/live-progress*");
      await retry.click();
      await requested;
      assert.equal(await region.getAttribute("aria-busy"), "true");
      await page.clock.fastForward(61000);
    });
    assert.equal(await status.textContent(), "Running");
    assert.equal(await error.textContent(), "Couldn't refresh. Retrying…");

    await retry.focus();
    await read({ body: "<span>Succeeded</span>", headers: { "Mero-Live": "done" } }, () => retry.press("Enter"));
    assert.equal(await region.evaluate(node => node === document.activeElement), true);
    assert.deepEqual(await page.evaluate(() => window.statusChanges), ["Running", "Succeeded"]);
    assert.equal(await error.textContent(), "");
    assert.equal(await retry.isHidden(), true);
    await page.clock.fastForward(9500);
    await visibility("hidden");
    await visibility("visible");
    assert.equal(hits, 6);

    // A fresh region starts again; remove its containing element using a real htmx swap.
    await page.reload();
    await page.route("**/replace-operation", route => route.fulfill({ contentType: "text/html", body: "<p>Operation closed.</p>" }));
    await region.evaluate(region => {
      const button = document.createElement("button");
      button.setAttribute("hx-get", "/replace-operation");
      button.setAttribute("hx-target", "closest main");
      button.textContent = "Close operation";
      region.after(button);
      window.htmx.process(button);
    });
    await page.getByRole("button", { name: "Close operation" }).click();
    await page.getByText("Operation closed.").waitFor();
    await page.clock.fastForward(9500);
    await visibility("hidden");
    await visibility("visible");
    assert.equal(hits, 6);

    // The catalog endpoint returns the time the simulated deployment started.
    await page.unroute("**/demo/catalog/live-progress*");
    await page.reload();
    await page.clock.fastForward(3100);
    await status.getByText("Running").waitFor();
    assert.ok(Number(await status.locator("input").inputValue()) > 0);
    await status.locator("input").evaluate((input, started) => { input.value = String(started); }, Date.now() - 6000);
    await page.clock.fastForward(3100);
    await status.getByText("Succeeded").waitFor();
    await page.waitForFunction(() => document.querySelector("[data-mero-live-done]"));
  });
