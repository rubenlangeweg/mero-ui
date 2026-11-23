import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";
import { browserConfig } from "../scripts/browser-config.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("live progress follows an auth redirect when asked, and names the time of the last good read",
  { skip: !playwright && "Install Playwright for the browser regression" }, async t => {
    const server = createApp();
    await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());

    async function open(variant, responses) {
      const page = await browser.newPage({ locale: "en-GB", timezoneId: "UTC" });
      page.setDefaultTimeout(7000);
      await page.clock.install({ time: new Date("2026-11-23T09:41:00Z") });
      const reads = { count: 0 };
      await page.route("**/demo/catalog/live-progress*", route => {
        reads.count++;
        const response = responses.shift() ?? { status: 500, body: "Unexpected poll" };
        return route.fulfill({ contentType: "text/html", ...response });
      });
      await page.goto(base + "/preview/live-progress" + (variant ? "?variant=" + encodeURIComponent(variant) : ""));
      return { page, reads, error: page.locator("[data-mero-live-error]") };
    }
    const expired = { status: 401, headers: { "HX-Redirect": "/components" }, body: "<p>Sign in again</p>" };

    // Without data-mero-live-follow the existing behaviour stays: the redirect is ignored and polling retries.
    {
      const { page, reads, error } = await open("", [expired, expired]);
      await page.clock.fastForward(3100);
      await page.waitForFunction(() => document.querySelector("[data-mero-live-error]").textContent);
      assert.equal(await error.textContent(), "Couldn't refresh. Retrying…");
      await page.clock.fastForward(3100);
      await page.waitForFunction(() => !document.querySelector("[aria-busy]"));
      assert.equal(reads.count, 2, "polling continues");
      assert.ok(new URL(page.url()).pathname.startsWith("/preview/"), page.url());
      assert.doesNotMatch(await page.locator("[data-mero-live-status]").textContent(), /Sign in/);
      await page.close();
    }

    // With it, an expired session goes where the server says and polling stops.
    {
      const { page, reads } = await open("Stale status", [expired]);
      await page.unroute("**/components");
      await page.clock.fastForward(3100);
      await page.waitForURL(url => url.pathname === "/components");
      assert.equal(reads.count, 1, "no retry after the redirect");
      await page.close();
    }

    // The failure text names the last confirmed read, not the time of the failure.
    {
      const running = { status: 200, body: '<span class="mero-badge mero-badge-dot">Running</span><input type="hidden" name="started" value="1">' };
      const down = { status: 503, body: "<p>Status store unavailable</p>" };
      const { page, error } = await open("Stale status", [running, down, down]);
      await page.clock.fastForward(3100);
      await page.locator("[data-mero-live-status]", { hasText: "Running" }).waitFor();
      await page.clock.setSystemTime(new Date("2026-11-23T09:45:30Z"));
      await page.clock.fastForward(3100);
      await page.waitForFunction(() => document.querySelector("[data-mero-live-error]").textContent);
      assert.equal(await error.textContent(), "Couldn't refresh. This is the status from 09:41. Retrying…");
      assert.match(await page.locator("[data-mero-live-status]").textContent(), /Running/, "the last good status stays");
      await page.clock.fastForward(3100);
      await page.waitForFunction(() => !document.querySelector("[aria-busy]"));
      assert.equal(await error.textContent(), "Couldn't refresh. This is the status from 09:41. Retrying…");
      await page.close();
    }
  });
