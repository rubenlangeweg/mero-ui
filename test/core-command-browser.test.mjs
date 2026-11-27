import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("command menu searches the server with keyboard support and focus return",
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
    // The list already accepts input during entry. Audit a frame of that animation.
    const entryFrame = await page.addStyleTag({ content: `
      .mero-command .mero-combo-list { animation-delay: calc(var(--mero-fast) / -5); animation-play-state: paused; }
    ` });
    await openMenu();
    const list = dialog.getByRole("listbox");
    const pages = list.getByRole("group", { name: "Pages" });
    const actions = list.getByRole("group", { name: "Actions" });
    assert.equal(await pages.getByRole("option").count(), 4);
    assert.equal(await actions.getByRole("option", { name: "Export catalog" }).count(), 1);
    assert.equal(await dialog.getByRole("status").innerText(), "5 results");
    assert.match(await list.ariaSnapshot(), /group "Pages":[\s\S]*group "Actions":/);
    await page.addScriptTag({ path: createRequire(import.meta.url).resolve("axe-core/axe.min.js") });
    const violations = await dialog.evaluate(async el => (await window.axe.run(el)).violations.map(({ id, nodes }) => ({
      id, elements: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })));
    assert.deepEqual(violations, []);
    await entryFrame.evaluate(style => style.remove());

    await input.press("End");
    assert.equal(await active(), "cmd-export");
    await input.press("ArrowUp");
    assert.equal(await active(), await pages.getByRole("option").last().getAttribute("id"));
    await input.press("ArrowDown");
    assert.equal(await active(), "cmd-export");
    await input.press("Home");
    assert.equal(await active(), "cmd-button");
    await input.press("End");
    await input.press("Enter");
    await page.locator(".mero-toast", { hasText: "Export requested" }).waitFor();
    await page.waitForFunction(() => document.activeElement?.matches("[data-mero-open]"));
    await openMenu();

    await input.fill("no such command");
    const empty = list.getByRole("option", { name: "No results", disabled: true });
    await empty.waitFor();
    assert.equal(await list.getByRole("group").count(), 0);
    assert.equal(await list.getByRole("option").count(), 1);
    assert.equal(await dialog.getByRole("status").innerText(), "No results");
    // An edit that returns to the last server query before the debounce expires
    // can be suppressed by hx-trigger's changed modifier.
    await input.evaluate(input => {
      for (const query of ["temporary edit", "no such command"]) {
        input.value = query;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await empty.waitFor();
    await input.press("ArrowDown");
    assert.equal(await active(), null);
    await input.fill("");

    await page.waitForFunction(() => document.querySelector("[role=combobox]").getAttribute("aria-activedescendant") === "cmd-button");
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
    const toastCount = await page.locator(".mero-toast").count();
    await page.keyboard.press("Enter");
    assert.ok(await dialog.evaluate(node => node.open));
    assert.equal(await page.locator(".mero-toast").count(), toastCount);
    release();
    await page.waitForFunction(() => document.querySelector("dialog[open] [role=combobox]")?.hasAttribute("aria-activedescendant"));
    await page.unroute("**/demo/catalog/command-menu*");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.route("**/demo/catalog/command-menu*", route => route.abort());
    await trigger.focus();
    await page.keyboard.press("Control+K");
    await input.pressSequentially("lin");
    await dialog.getByText("Could not load suggestions").waitFor();
    assert.equal(await input.getAttribute("data-mero-combo-error"), "");
    await page.unroute("**/demo/catalog/command-menu*");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.route("**/demo/catalog/command-menu*", route => route.fulfill({ contentType: "text/html",
      body: '<div role="group" aria-labelledby="job-heading"><h3 id="job-heading" aria-hidden="true">Jobs</h3><button id="job-refresh" role="option" tabindex="-1" hx-get="/refresh-index" hx-swap="none">Refresh index</button></div>' }));
    await page.route("**/refresh-index", route => route.fulfill({ status: 204 }));
    await openMenu();
    const refresh = page.waitForResponse(response => response.url() === base + "/refresh-index");
    await input.press("Enter");
    assert.equal((await refresh).status(), 204);
    await page.waitForFunction(() => document.activeElement?.matches("[data-mero-open]"));
    await page.unroute("**/demo/catalog/command-menu*");

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
    assert.equal(await page.locator("dialog[data-mero-command]").count(), 1);
    assert.equal(await page.locator("[data-mero-ws-command]").count(), 0);
    const localInput = page.locator("dialog[data-mero-command] [role=combobox]");
    await localInput.fill("workspace id");
    assert.equal(await page.locator("dialog[data-mero-command] [role=option]:not([hidden])").count(), 1);
    assert.equal(await localInput.getAttribute("aria-activedescendant"), "ws-cmd-copy", "filtering local command activates first matching option");
    await localInput.press("Enter");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.locator(".mero-toast").waitFor();

    // A command dialog inside a collapsed <details> must not be opened by Ctrl+K.
    await page.evaluate(() => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Collapsed";
      details.append(summary, document.querySelector(".mero-ws-command"));
      document.body.append(details);
    });
    await page.locator("body").press("Control+K");
    await page.waitForTimeout(100);
    assert.equal(await page.locator("dialog[open]").count(), 0, "collapsed <details> skips Ctrl+K command dialog");
    assert.deepEqual(errors, []);
  });
