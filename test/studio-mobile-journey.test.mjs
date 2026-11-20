import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("a phone can finish a company task and return to the same record and task link", {
  skip: !playwright && "Install Playwright to test the mobile company journey",
}, async t => {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({
    executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined,
  });
  t.after(() => browser.close());
  const device = playwright.devices[engine === "webkit" ? "iPhone 13" : "Pixel 7"];
  const page = await browser.newPage({
    ...device, isMobile: engine !== "firefox", reducedMotion: "reduce",
  });
  const start = `http://127.0.0.1:${app.address().port}/layouts/dashboard?embed=1&view=companies&q=forma`;
  await page.goto(start);
  await page.getByRole("navigation", { name: "Companies" }).getByRole("link", { name: /Forma Works/ }).tap();
  const record = page.getByRole("article", { name: "Forma Works company record" });
  const count = record.locator("dl div").filter({ has: page.getByText("Open tasks", { exact: true }) }).locator("dd");
  await record.waitFor();
  await page.waitForFunction(() => document.activeElement?.matches("[data-studio-initial-focus]"));
  const recordUrl = page.url();
  assert.equal(await count.textContent(), "2");
  for (const [title, remaining, reloadTask] of [
    ["Price the first retail rollout", "1", false],
    ["Approve the storefront elevations", "0", true],
  ]) {
    const task = record.getByRole("link", { name: new RegExp(title) });
    await task.evaluate(link => {
      link.scrollIntoView({ block: "center", behavior: "instant" });
      link.addEventListener("click", () => { window.taskDepartureTop = link.getBoundingClientRect().top; }, { once: true, capture: true });
    });
    await task.tap();
    const taskTop = await page.evaluate(() => window.taskDepartureTop);
    const form = page.getByRole("article", { name: "Task details" });
    await page.getByRole("navigation", { name: "Task views" }).getByRole("link", { name: "List", current: true }).waitFor();
    await form.getByRole("combobox", { name: "Task status" }).selectOption("done");
    const saved = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/demo/studio/tasks" && response.request().method() === "POST"
    );
    await form.getByRole("button", { name: "Save status" }).tap();
    assert.equal((await saved).status(), 200);
    await form.locator('option[value="done"][selected]').waitFor({ state: "attached" });

    if (reloadTask) {
      await page.reload();
      assert.equal(await form.getByRole("combobox", { name: "Task status" }).inputValue(), "done");
    }
    await page.goBack();
    await page.waitForURL(recordUrl);
    await task.getByText("Done", { exact: true }).waitFor();
    assert.equal(await count.textContent(), remaining);
    await page.waitForFunction(({ top, title }) => {
      const active = document.activeElement;
      if (!active.matches("a") || !active.textContent.includes(title)) return false;
      const bounds = active.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= innerHeight && Math.abs(bounds.top - top) <= 3;
    }, { top: taskTop, title }, { timeout: 6000 });
  }
  await page.reload();
  assert.equal(await count.textContent(), "0");
});
