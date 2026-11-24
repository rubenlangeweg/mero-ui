import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("an unknown outcome re-reads the region without repeating the action, and drops stale answers",
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
    const requests = [];
    page.on("request", request => {
      if (request.resourceType() === "fetch" || request.resourceType() === "xhr") {
        requests.push({ method: request.method(), url: request.url(), reread: request.headers()["mero-reread"] });
      }
    });
    const preview = base + "/preview/action-button?variant=Re-read%20after%20unknown";
    await page.goto(preview);
    const restart = page.getByRole("button", { name: "Restart export" });
    const restarts = page.locator("[data-export-restarts]");
    const status = page.locator("[data-mero-action-status]");
    const unknown = "The result is unknown. Check the current state before you try again.";
    const before = Number((await restarts.textContent()).match(/\d+/)?.[0] ?? 0);
    const quiet = () => page.waitForFunction(() => !document.querySelector("[aria-busy]") &&
      document.querySelector("[data-mero-action-state]")?.dataset.meroActionState === "unknown");

    // The action happened but its answer was lost. The re-read shows the real state.
    await restart.focus();
    await restart.press("Enter");
    await page.locator("[data-export-restarts]", { hasText: `Restarted ${before + 1}` }).waitFor();
    await quiet();
    assert.equal(await restart.getAttribute("data-mero-action-state"), "unknown", "the outcome stays unknown, never success");
    assert.equal(await status.textContent(), unknown, "the message survives the morph");
    assert.equal(await status.getAttribute("data-tone"), "danger");
    assert.equal(await restart.evaluate(node => node === document.activeElement), true, "focus stays on the button");
    assert.deepEqual(requests.map(({ method, reread }) => [method, Boolean(reread)]), [["POST", false], ["GET", true]],
      "one POST and one read: the action is never repeated");
    assert.equal(new URL(requests[1].url).href, preview, "the read is the current page");
    await page.waitForTimeout(300);
    assert.equal(requests.length, 2);

    const original = async () => (await restarts.textContent()).trim();
    const tryRead = async (fulfil, during) => {
      const shown = await original();
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route(url => url.href.startsWith(preview), async route => {
        if (route.request().method() !== "GET" || !route.request().headers()["mero-reread"]) return route.continue();
        await held;
        await route.fulfill(fulfil);
      });
      await restart.click();
      await page.waitForFunction(() => document.querySelector("#export-run[aria-busy]"));
      await during?.();
      release();
      await quiet();
      await page.unroute(url => url.href.startsWith(preview));
      return shown;
    };

    // An error response, a page without the region and an answer for a page the person left are all dropped.
    const page200 = body => ({ status: 200, contentType: "text/html", body });
    const changed = '<section id="export-run"><p data-export-restarts>Restarted 99 times</p></section>';
    for (const [label, fulfil, during] of [
      ["error", { status: 500, contentType: "text/html", body: changed }],
      ["no region", page200("<main><p>Sign in</p></main>")],
      ["moved on", page200(changed), () => page.evaluate(() => history.pushState(null, "", "?elsewhere"))],
    ]) {
      const shown = await tryRead(fulfil, during);
      assert.equal(await page.locator("#export-run").count(), 1, label + ": the region stays");
      assert.equal(await original(), shown, label + ": the answer is dropped");
      assert.equal(await status.textContent(), unknown, label);
      if (during) await page.evaluate(url => history.replaceState(null, "", url), preview);
    }
    assert.deepEqual(errors, []);
  });

test("a scripted htmx.swap() without a request raises no error from the re-read guard",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/action-button?variant=Re-read%20after%20unknown");
    await page.evaluate(() => htmx.swap({ text: "<p data-scripted>Swapped by the host</p>", target: "#export-run", swap: "innerHTML" }));
    await page.locator("#export-run [data-scripted]").waitFor();
    assert.deepEqual(errors, []);
  });
