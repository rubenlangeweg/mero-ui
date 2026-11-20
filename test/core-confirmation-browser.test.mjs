import { browserConfig } from "../scripts/browser-config.mjs";
import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("typed confirmation validates the phrase, preserves failed outcomes and returns focus on success",
  { skip: !playwright && "Install Playwright to run the browser regression" }, async t => {
    const server = createApp();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const engine = browserConfig.engine || "chromium";
    const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
    t.after(() => browser.close());
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const trigger = page.locator("button[data-mero-open]");
    const dialog = page.getByRole("alertdialog", { name: "Delete environment?" });
    const input = dialog.getByRole("textbox", { name: "Confirmation phrase" });
    const reason = dialog.getByRole("textbox", { name: "Reason" });
    const submit = dialog.getByRole("button", { name: "Delete environment" });
    const status = dialog.getByRole("status");
    const phrase = "acme/production/delete";
    const endpoint = "**/demo/catalog/typed-confirmation";

    for (const theme of ["light", "dark"]) {
      // Run axe in a fresh page. On macOS Firefox its DOM traversal and
      // Playwright's role locators together can crash the renderer.
      const auditPage = await browser.newPage({ reducedMotion: "reduce" });
      await auditPage.goto(base + "/preview/typed-confirmation?theme=" + theme);
      await auditPage.locator("button[data-mero-open]").click();
      assert.equal(await auditPage.locator("dialog").evaluate(node => node.open), true);
      await auditPage.addScriptTag({ path: process.env.MERO_AXE_PATH || createRequire(import.meta.url).resolve("axe-core/axe.min.js") });
      assert.deepEqual(await auditPage.evaluate(async () => (await axe.run()).violations.map(({ id }) => id)), [], theme);
      await auditPage.close();
    }
    await page.goto(base + "/preview/typed-confirmation");
    await trigger.click();
    await page.mouse.click(1, 1);
    assert.equal(await dialog.isVisible(), true, "backdrop clicks leave the dialog open");
    await reason.fill("Retire unused environment");
    for (const value of ["wrong phrase", phrase.toUpperCase(), phrase.slice(1)]) {
      await input.fill(value);
      assert.equal(await submit.isDisabled(), true);
    }
    const form = dialog.locator("form");
    const sent = [];
    page.on("request", req => { if (req.method() === "POST") sent.push(req.url()); });
    const blocked = await page.evaluate(() => new Promise(resolve => {
      document.addEventListener("htmx:config:request", e => resolve(e.defaultPrevented), { once: true });
      document.querySelector("form").requestSubmit();
    }));
    assert.equal(blocked, true, "a wrong phrase also blocks a scripted submission");
    assert.deepEqual(sent, []);
    const invalid = await page.request.post(base + "/demo/catalog/typed-confirmation", {
      form: { phrase: phrase.toUpperCase(), reason: "Retire unused environment" },
    });
    assert.equal(invalid.status(), 422, "the server re-checks the phrase independently of the button");
    assert.match(await invalid.text(), /aria-invalid="true"/);
    await reason.fill(" ");
    await input.fill(" " + phrase + " ");
    assert.equal(await submit.isDisabled(), true);
    assert.equal(await status.textContent(), "Phrase matches. Enter a reason to enable confirmation.");
    await reason.fill("test");
    assert.equal(await submit.isEnabled(), true);
    assert.equal(await status.textContent(), "Ready to confirm.");

    await submit.click();
    await dialog.getByText("Give a reason of at least 8 characters.").waitFor();
    await page.waitForFunction(() => document.activeElement?.matches('[data-mero-confirm-reason][aria-invalid="true"]'));
    assert.equal(await input.inputValue(), " " + phrase + " ", "HTTP 422 preserves user input");
    assert.equal(await reason.inputValue(), "test");
    await reason.fill("Retire unused environment");

    const unknown = "Outcome unknown. Check the current state before retrying.";
    const failures = [[403, "The server rejected this action."], [503, unknown], ["network", unknown]];
    for (const [outcome, message] of failures) {
      await page.route(endpoint, route => outcome === "network" ? route.abort() : route.fulfill({
        status: outcome, body: "Server error body",
        headers: { "HX-Trigger": '{"mero:form-saved":{"message":"Incorrect success"}}' },
      }));
      const finished = page.evaluate(() => new Promise(resolve => {
        document.addEventListener("htmx:finally:request", () => resolve(true), { once: true });
      }));
      await submit.click();
      await finished;
      await dialog.getByRole("alert").waitFor();
      assert.equal(await dialog.getByRole("alert").textContent(), message);
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await page.getByText("Server error body").count(), 0);
      assert.equal(await page.getByText("Incorrect success").count(), 0);
      await page.unroute(endpoint);
    }
    await submit.click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Demo deletion confirmed.").waitFor();
    await page.waitForFunction(() => document.activeElement?.matches("[data-mero-open]"));
    await trigger.click();
    assert.equal(await input.inputValue(), "");
    assert.equal(await submit.isDisabled(), true, "a new attempt needs a fresh confirmation");
    await reason.evaluate(node => node.removeAttribute("required"));
    await reason.fill("");
    await input.fill(phrase);
    assert.equal(await submit.isEnabled(), true, "the reason can be optional");
    assert.equal(await form.getAttribute("aria-busy"), null);
    assert.deepEqual(errors, []);
  });
