import assert from "node:assert/strict";
import test from "node:test";
import { browserConfig } from "../scripts/browser-config.mjs";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

// Count live-region writes, including identical repeats. Actual speech is checked in the manual review.
async function recordAnnouncements(region) {
  await region.evaluate(element => {
    window.announcements = [];
    new MutationObserver(records => {
      for (const record of records) {
        const text = record.type === "characterData" ? record.target.textContent
          : [...record.addedNodes].map(node => node.textContent).join("");
        if (text.trim()) window.announcements.push(text.trim());
      }
    }).observe(element, { subtree: true, childList: true, characterData: true });
  });
}

async function assertFocused(page, locator) {
  await locator.waitFor();
  const handle = await locator.elementHandle();
  await page.waitForFunction(element => element === document.activeElement, handle);
  await handle.dispose();
}

test("admin workflows expose named controls, state changes and single live updates",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.setDefaultTimeout(8000);
    const cdp = engine === "chromium" ? await page.context().newCDPSession(page) : null;
    // Firefox and WebKit run the same Playwright ARIA snapshots. Chromium also exposes native AX nodes through CDP.
    async function checkNative(role, name, properties = {}) {
      if (!cdp) return;
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const match = nodes.find(node => !node.ignored && node.role.value === role &&
        (name instanceof RegExp ? name.test(node.name?.value) : node.name?.value === name));
      assert.ok(match, `missing native ${role} "${name}"`);
      for (const [key, expected] of Object.entries(properties)) {
        const actual = match.properties.find(prop => prop.name === key)?.value.value;
        assert.equal(actual, expected, `${role} "${name}" ${key}`);
      }
    }
    const preview = id => page.goto(base + "/preview/" + id);
    const messages = () => page.evaluate(() => window.announcements);

    await t.test("a menu names the row, disabled command and focus destination", async () => {
      await preview("menu-button");
      const button = page.getByRole("button", { name: "Actions for Arc Task Lamp" });
      await button.focus();
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      await button.press("ArrowDown");
      const menu = page.getByRole("menu", { name: "Arc Task Lamp actions" });
      await assertFocused(page, menu.getByRole("menuitem", { name: "Open details" }));
      assert.match(await button.ariaSnapshot(), /button "Actions for Arc Task Lamp"[^\n]*\[expanded\]/);
      assert.match(await menu.ariaSnapshot(), /menuitem "Delete" \[disabled\]/);
      await checkNative("menu", "Arc Task Lamp actions");
      await checkNative("button", "Actions for Arc Task Lamp", { expanded: true });
      await page.keyboard.press("End");
      await assertFocused(page, menu.getByRole("menuitem", { name: "Delete" }));
      await checkNative("menuitem", "Delete", { disabled: true, focused: true });
      await page.keyboard.press("Escape");
      await assertFocused(page, button);
      assert.equal(await page.getByRole("menu").count(), 0);
    });

    await t.test("a combobox announces one count and exposes the active option", async () => {
      await preview("autocomplete");
      const combo = page.getByRole("combobox", { name: "Workspace" });
      const status = page.getByRole("status");
      await recordAnnouncements(status);
      await combo.fill("cob");
      const option = page.getByRole("option", { name: "Cobalt" });
      await option.waitFor();
      await combo.press("ArrowDown");
      assert.match(await page.getByRole("listbox", { name: "Workspaces" }).ariaSnapshot(), /option "Cobalt" \[selected\]/);
      assert.equal(await combo.getAttribute("aria-activedescendant"), await option.getAttribute("id"));
      assert.match(await combo.ariaSnapshot(), /combobox "Workspace"[^\n]*\[expanded\]/);
      await checkNative("combobox", "Workspace", { expanded: true, focused: true });
      await checkNative("option", "Cobalt", { selected: true });
      assert.deepEqual(await messages(), ["Loading…", "1 suggestion"]);
      await combo.press("Escape");
      assert.equal(await combo.getAttribute("aria-expanded"), "false");
      assert.equal(await combo.getAttribute("aria-activedescendant"), null);
      assert.equal(await page.getByRole("option").count(), 0);
    });

    await t.test("grouped commands expose section names and a single result count", async () => {
      await preview("command-menu");
      const trigger = page.getByRole("button", { name: /Search commands/ });
      const status = page.locator("dialog [role=status]");
      await recordAnnouncements(status);
      await trigger.focus();
      await trigger.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Commands", exact: true });
      const combo = dialog.getByRole("combobox", { name: "Search commands" });
      await dialog.getByText("5 results", { exact: true }).waitFor();
      const list = dialog.getByRole("listbox", { name: "Commands" });
      const tree = await list.ariaSnapshot();
      assert.match(tree, /group "Pages"/);
      assert.match(tree, /group "Actions"/);
      const last = list.getByRole("group", { name: "Actions" }).getByRole("option", { name: /Export catalog/ });
      await checkNative("dialog", "Commands", { modal: true });
      await checkNative("group", "Pages");
      await checkNative("group", "Actions");
      await combo.press("End");
      assert.equal(await combo.getAttribute("aria-activedescendant"), await last.getAttribute("id"));
      assert.match(await last.ariaSnapshot(), /option "Export catalog[^"]*" \[selected\]/);
      await checkNative("option", /Export catalog/, { selected: true });
      assert.deepEqual(await messages(), ["Loading…", "5 results"]);
      await combo.press("Escape");
      await assertFocused(page, combo);
      assert.equal(await dialog.getByRole("listbox").count(), 0);
      await combo.press("Escape");
      await assertFocused(page, trigger);
      await dialog.waitFor({ state: "hidden" });
    });

    await t.test("an action keeps its accessible name while busy and reports each outcome once", async () => {
      await preview("action-button");
      const retry = page.getByRole("button", { name: "Retry export" });
      const status = page.getByRole("status").first();
      await recordAnnouncements(status);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route("**/demo/catalog/action-button?outcome=succeeded", async route => {
        await gate;
        await route.continue();
      });
      await retry.focus();
      await retry.press("Enter");
      try {
        await page.locator("[data-mero-action][aria-busy=true]").waitFor();
        assert.equal(await retry.getAttribute("aria-busy"), "true");
        assert.match(await retry.ariaSnapshot(), /button "Retry export"[^\n]*\[disabled\]/);
        await assertFocused(page, retry);
        await checkNative("button", "Retry export", { disabled: true, focused: true, busy: 1 });
        await checkNative("status", "", { live: "polite" });
      } finally { release(); }
      await status.getByText("Export restarted.").waitFor();
      assert.deepEqual(await messages(), ["Export restarted."]);
      assert.equal(await retry.getAttribute("aria-busy"), null);
      assert.equal(await retry.isEnabled(), true);
      await page.unroute("**/demo/catalog/action-button?outcome=succeeded");
      for (const [caption, index, outcome] of [
        ["Revoke key", 1, "This key was already revoked. Nothing changed."],
        ["Halt run", 2, "The result is unknown. Check the current state before you try again."],
      ]) {
        const output = page.getByRole("status").nth(index);
        await recordAnnouncements(output);
        await page.getByRole("button", { name: caption }).press("Enter");
        await output.getByText(outcome, { exact: true }).waitFor();
        assert.deepEqual(await messages(), [outcome]);
      }
    });

    await t.test("returning to a filtered table restores the named row link and sort direction", async () => {
      await preview("filter-chips?status=Draft");
      const header = page.getByRole("columnheader", { name: "Product", exact: true });
      assert.equal(await header.getAttribute("aria-sort"), "ascending");
      await checkNative("columnheader", "Product");
      await header.getByRole("link").press("Enter");
      await page.waitForURL(/sort=-name/);
      assert.equal(await header.getAttribute("aria-sort"), "descending");
      const link = page.getByRole("link", { name: "Halo Pendant", exact: true });
      await link.press("Enter");
      await page.getByRole("heading", { name: "Halo Pendant" }).waitFor();
      await page.goBack();
      await assertFocused(page, link);
      assert.match(await link.ariaSnapshot(), /link "Halo Pendant"/);
      await checkNative("link", "Halo Pendant", { focused: true });
      assert.equal(await header.getAttribute("aria-sort"), "descending");
      assert.match(page.url(), /status=Draft/);
    });

    await t.test("copied confirmations describe the exact phrase and restore the right opener", async () => {
      await preview("typed-confirmation");
      await page.locator("[data-mero-scope]").first().evaluate(scope => {
        const copy = scope.cloneNode(true);
        scope.after(copy);
        window.MeroUI.init(copy);
        window.htmx.process(copy);
      });
      const opener = page.getByRole("button", { name: "Delete environment", exact: true }).last();
      await opener.press("Enter");
      const dialog = page.getByRole("alertdialog", { name: "Delete environment?" });
      const phrase = dialog.getByRole("textbox", { name: "Confirmation phrase" });
      const confirm = dialog.getByRole("button", { name: "Delete environment", exact: true });
      const description = await phrase.evaluate(input => input.getAttribute("aria-describedby")
        .split(/\s+/).map(id => document.getElementById(id).textContent).join(" "));
      assert.match(description, /acme\/production\/delete/);
      assert.match(await confirm.ariaSnapshot(), /button "Delete environment"[^\n]*\[disabled\]/);
      await checkNative("alertdialog", "Delete environment?", { modal: true });
      await checkNative("button", "Delete environment", { disabled: true });
      await checkNative("textbox", "Confirmation phrase", { required: true });
      const hint = dialog.locator("[data-mero-confirm-hint]");
      await recordAnnouncements(hint);
      await phrase.fill("acme/production/delete");
      const reason = dialog.getByRole("textbox", { name: "Reason" });
      await reason.fill("test");
      assert.deepEqual(await messages(), ["Phrase matches. Enter a reason to enable confirmation.", "Ready to confirm."]);
      await confirm.press("Enter");
      await dialog.getByText("Give a reason of at least 8 characters.", { exact: true }).waitFor();
      await assertFocused(page, reason);
      assert.equal(await reason.getAttribute("aria-invalid"), "true");
      await checkNative("textbox", "Reason", { invalid: "true", focused: true });
      await reason.fill("Retire unused environment");
      await confirm.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      await assertFocused(page, opener);
      await page.getByRole("status").filter({ hasText: "Demo deletion confirmed." }).waitFor();
    });

    await t.test("live progress exposes a named region and announces each distinct status once", async () => {
      let polls = 0;
      await page.route("**/demo/catalog/live-progress*", route => {
        const terminal = ++polls >= 3;
        return route.fulfill({ contentType: "text/html", headers: terminal ? { "Mero-Live": "done" } : {},
          body: '<span class="mero-chip">' + (terminal ? "Succeeded" : "Running") + "</span>" });
      });
      await preview("live-progress");
      const region = page.getByRole("region", { name: "Production deployment" });
      const status = region.locator("[data-mero-live-status]");
      assert.match(await region.ariaSnapshot(), /status[^\n]*[\s\S]*Queued/);
      await checkNative("region", "Production deployment");
      await checkNative("status", "", { live: "polite" });
      await recordAnnouncements(status);
      // The repeated server observation must leave the live-region subtree untouched.
      for (let index = 0; index < 3; index++) {
        const completed = page.waitForEvent("requestfinished", req => req.url().includes("/demo/catalog/live-progress"));
        await region.evaluate(element => element.dispatchEvent(new CustomEvent("mero:refresh", { bubbles: true })));
        await completed;
        await page.waitForFunction(() => !document.querySelector("[data-mero-live][aria-busy=true]"));
      }
      assert.match(await status.ariaSnapshot(), /status[^\n]*[\s\S]*Succeeded/);
      assert.deepEqual(await messages(), ["Running", "Succeeded"]);
    });
  });
