import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("Studio's highlighted template copies the last workspace response through navigation, edits and history", {
  skip: !playwright && "Install Playwright to exercise the Studio template",
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
  const origin = "http://127.0.0.1:" + server.address().port;
  await page.goto(origin + "/layouts/dashboard");
  const tab = name => page.getByRole("tab", { name, exact: true });
  const panel = page.getByRole("tabpanel", { name: "Template", exact: true });
  const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
  const headers = { "HX-Request": "true", "HX-Target": "studio-workspace" };

  async function swap(action, path) {
    const [response] = await Promise.all([
      page.waitForResponse(r => /xhr|fetch/.test(r.request().resourceType()) && new URL(r.url()).pathname === path),
      action(),
    ]);
    return response.text();
  }
  async function checkCode(source) {
    await tab("Template").click();
    await panel.locator("code .syntax-tag").first().waitFor();
    assert.equal(await panel.locator("pre code").textContent(), source);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async text => { window.copiedTemplate = text; },
      } });
    });
    await panel.locator("[data-copy-code]").click();
    assert.equal(await page.evaluate(() => window.copiedTemplate), source);
    await tab("Preview").click();
  }

  const board = await swap(() => nav.getByRole("link", { name: "Task board" }).click(), "/layouts/dashboard");
  await checkCode(board);
  const task = await swap(() => page.locator(".stb-card-title a").first().click(), "/layouts/dashboard");
  await checkCode(task);
  await page.getByLabel("Task status").selectOption("done");
  const moved = await swap(() => page.getByRole("button", { name: "Save status" }).click(), "/demo/studio/tasks");
  await checkCode(moved);
  await page.goBack();
  await page.waitForURL(url => url.searchParams.get("view") === "board" && !url.searchParams.has("task"));
  await page.locator(".stb-inspector").waitFor({ state: "detached" });
  const restored = await page.request.get(page.url(), { headers });
  await checkCode(await restored.text());

  await page.getByRole("link", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill("   ");
  await page.getByLabel("Company", { exact: true }).selectOption("forma");
  const invalid = await swap(() => page.getByRole("button", { name: "Create task" }).click(), "/demo/studio/tasks");
  await page.getByRole("alert").filter({ hasText: "Enter a task title" }).waitFor();
  await checkCode(invalid);

  const inventory = await swap(() => nav.getByRole("link", { name: "Inventory" }).click(), "/layouts/dashboard");
  await swap(() => page.getByRole("searchbox", { name: "Search products" }).fill("lamp"), "/demo/products");
  await checkCode(inventory);
});
