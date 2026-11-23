import assert from "node:assert/strict";
import test from "node:test";
import { createDemo } from "../examples/premium/server.mjs";
import { browserConfig } from "../scripts/browser-config.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("mobile review actions regain keyboard focus only after the replacement is ready", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = await createDemo();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  page.setDefaultTimeout(5000);
  await page.goto("http://127.0.0.1:" + server.address().port + "/premium/queue");
  await page.evaluate(() => {
    let settling = false;
    window.prematureFocus = [];
    document.addEventListener("htmx:before:swap", () => { settling = true; }, true);
    document.addEventListener("premium:queue-ready", () => { settling = false; }, true);
    document.addEventListener("focusin", event => {
      if (settling && event.target.matches("#pq-approve, #pq-undo")) window.prematureFocus.push(event.target.id);
    });
  });

  await page.locator(".pq-row").first().press("Enter");
  await page.waitForFunction(() => document.activeElement.id === "pq-approve");
  for (const count of [9, 8, 7]) {
    await page.keyboard.press("Enter");
    await page.waitForFunction(n => document.querySelector("#pq-count").textContent === n + " pending"
      && document.activeElement.id === "pq-approve", count);
  }
  await page.getByRole("button", {name: "Undo", exact: true}).click();
  await page.waitForFunction(() => document.querySelector("#pq-count").textContent === "8 pending"
    && document.activeElement.id === "pq-approve");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "pq-row-1003");
  assert.deepEqual(await page.evaluate(() => window.prematureFocus), []);
});
