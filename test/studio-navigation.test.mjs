import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("Studio inventory stays inside the layout preview and standalone app, including Back and refresh", {
  skip: !playwright && "Install Playwright to exercise Studio navigation",
}, async t => {
  const server = createApp();
  let browser;
  t.after(async () => {
    try { await browser?.close(); }
    finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const engine = browserConfig.engine || "chromium";
  browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });

  for (const embedded of [false, true]) {
    const path = "/layouts/dashboard" + (embedded ? "?embed=1&theme=light" : "");
    const page = await browser.newPage({ viewport: { width: embedded ? 390 : 1280, height: 820 }, reducedMotion: "reduce" });
    await page.goto(origin + path);
    const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
    const link = name => nav.getByRole("link", { name, exact: true });
    const active = name => nav.locator('a[aria-current="page"]').and(link(name)).waitFor();
    const inventory = url => url.pathname === "/layouts/dashboard" && url.searchParams.get("view") === "inventory";
    const overview = url => url.pathname === "/layouts/dashboard" && (url.searchParams.get("view") || "overview") === "overview";
    await active("Overview");
    const documents = [];
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
    });
    await link("Inventory").click();
    await page.waitForURL(inventory);
    await active("Inventory");
    await page.getByRole("button", { name: "Edit Arc Task Lamp" }).waitFor();
    assert.deepEqual(documents, [], "the sidebar click should update just the workspace");
    const location = new URL(page.url());
    assert.equal(location.searchParams.get("embed"), embedded ? "1" : null);
    if (embedded) assert.equal(location.searchParams.get("theme"), "light");
    await page.goBack();
    await page.waitForURL(overview);
    await active("Overview");
    await page.goForward();
    await page.waitForURL(inventory);
    await active("Inventory");
    await page.reload();
    await active("Inventory");
    assert.equal(await page.getByRole("link", { name: "All layouts", exact: true }).count(), embedded ? 0 : 1);
    await page.close();
  }

  const plain = await browser.newPage({ javaScriptEnabled: false });
  await plain.goto(origin + "/layouts/dashboard?embed=1&theme=light");
  await plain.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("link", { name: "Inventory" }).click();
  const destination = new URL(plain.url());
  assert.equal(destination.pathname, "/layouts/dashboard");
  assert.equal(destination.searchParams.get("view"), "inventory");
  assert.equal(destination.searchParams.get("embed"), "1");
  assert.equal(destination.searchParams.get("theme"), "light");
  assert.equal(await plain.getByRole("link", { name: "All layouts", exact: true }).count(), 0);
});
