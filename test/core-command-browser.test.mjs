import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("command menu searches the server with keyboard support and focus return",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const queries = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/demo/catalog/command-menu") queries.push(url.searchParams.get("q"));
    });

    const dialog = page.locator("dialog[data-mero-command]");
    const input = dialog.getByRole("combobox");
    const trigger = page.getByRole("button", { name: /Search commands/ });
    const active = () => input.getAttribute("aria-activedescendant");
    const openMenu = async () => {
      await trigger.focus();
      await page.keyboard.press("Control+K");
      await page.waitForFunction(() => document.activeElement?.matches("dialog[open] [role=combobox]"));
      await page.waitForFunction(() => document.querySelector("dialog[open] [role=combobox]")?.hasAttribute("aria-activedescendant"));
    };

    await page.goto(base + "/preview/command-menu");
    await openMenu();
    assert.ok((await dialog.getByRole("option").count()) <= 6);

    queries.length = 0;
    await input.pressSequentially("butt");
    await page.waitForFunction(() => document.querySelector("[role=combobox]").getAttribute("aria-activedescendant") === "cmd-button");
    await page.waitForTimeout(250);
    assert.deepEqual(queries, ["butt"]);
    await page.keyboard.press("ArrowDown");
    assert.equal(await active(), "cmd-action-button");
    await page.keyboard.press("ArrowUp");
    assert.equal(await active(), "cmd-button");
    await page.keyboard.press("Enter");
    await page.waitForURL(base + "/components/button");

    await page.goBack();
    await page.waitForURL(/\/preview\/command-menu$/);
    await openMenu();
    assert.equal(await input.inputValue(), "");
    await page.keyboard.press("Escape");
    assert.ok(await dialog.evaluate(node => node.open));
    assert.equal(await input.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.matches("[data-mero-open]"));
    assert.ok(!(await dialog.evaluate(node => node.open)));

    await openMenu();
    await input.pressSequentially("export");
    await page.waitForFunction(() => document.querySelector("[role=combobox]").getAttribute("aria-activedescendant") === "cmd-export");
    await page.keyboard.press("Enter");
    await page.locator(".mero-toast", { hasText: "Export requested" }).waitFor();
    assert.ok(!(await dialog.evaluate(node => node.open)));
    await page.waitForFunction(() => document.activeElement?.matches("[data-mero-open]"));

    // Reopening while the server is slow shows a loading status and no stale, runnable results.
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/demo/catalog/command-menu*", async route => { await held; await route.continue(); });
    await trigger.focus();
    await page.keyboard.press("Control+K");
    await page.waitForFunction(() => document.activeElement?.matches("dialog[open] [role=combobox]"));
    await dialog.locator("[data-mero-combo-status]", { hasText: "Loading…" }).waitFor({ state: "attached" });
    assert.equal(await active(), null);
    assert.equal(await input.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    assert.ok(await dialog.evaluate(node => node.open));
    assert.equal(await page.locator(".mero-toast", { hasText: "Export requested" }).count() <= 1, true);
    release();
    await page.waitForFunction(() => document.querySelector("dialog[open] [role=combobox]")?.hasAttribute("aria-activedescendant"));
    await page.unroute("**/demo/catalog/command-menu*");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.route("**/demo/catalog/command-menu*", route => route.abort());
    await openMenu().catch(() => {});
    await input.pressSequentially("lin");
    await dialog.getByText("Could not load suggestions").waitFor();
    assert.equal(await input.getAttribute("data-mero-combo-error"), "");
    await page.unroute("**/demo/catalog/command-menu*");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const editor = Object.assign(document.createElement("div"), { contentEditable: "true", textContent: "Notes" });
      document.body.append(editor);
      editor.focus();
    });
    await page.keyboard.press("Control+K");
    await page.waitForTimeout(100);
    assert.equal(await page.locator("dialog[open]").count(), 0);

    await page.goto(base + "/components/command-menu");
    await page.locator("body").press("Control+K");
    await page.waitForFunction(() => document.activeElement?.matches("dialog[data-mero-command] [role=combobox]"));

    await page.goto(base + "/preview/command");
    await page.locator("body").press("Control+K");
    await page.getByRole("dialog", { name: "Workspace commands" }).waitFor();
    assert.equal(await page.locator("dialog[data-mero-command]").count(), 0);
    assert.deepEqual(errors, []);
  });
