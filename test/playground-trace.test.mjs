import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("the playground keeps eight exchanges and a late response leaves the selected exchange visible", {
  skip: !playwright && "Install Playwright for the request log check",
}, async t => {
  const server = createApp();
  let browser;
  t.after(async () => {
    try { await browser?.close(); }
    finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const engine = browserConfig.engine || "chromium";
  browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + server.address().port + "/playground");
  const log = page.getByRole("region", { name: "Request log" });
  const rows = log.getByRole("listitem");
  // Use independent sources so HTMX can legitimately have two requests in flight.
  function issue(id) {
    const button = document.createElement("button");
    button.setAttribute("hx-get", "/demo/stock-summary?sample=" + id);
    button.setAttribute("hx-swap", "none");
    document.querySelector("[data-sample-scope]").append(button);
    window.htmx.process(button);
    button.click();
  }
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  await page.route("**/demo/stock-summary?sample=1", async route => { await gate; await route.continue(); });
  await page.evaluate(issue, 1);
  try {
    for (let id = 2; id <= 9; id++) {
      await page.evaluate(issue, id);
      await rows.getByRole("button", { name: new RegExp("sample=" + id + ".*200") }).waitFor();
    }
    assert.equal(await rows.count(), 8);
    await rows.getByRole("button", { name: /sample=2.*200/ }).click();
  } finally {
    resume();
  }
  await page.waitForLoadState("networkidle");
  const inspector = await page.locator("[data-exchange-body]").innerText();
  assert.match(inspector, /^GET \/demo\/stock-summary\?sample=2\n/);
  assert.match(inspector, /HTTP 200/);
  assert.equal(await rows.count(), 8);
  assert.equal(await log.getByRole("button", { name: /sample=1\b/ }).count(), 0);
});
