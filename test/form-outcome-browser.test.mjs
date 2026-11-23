import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("form outcomes: unknown never shows success, retries keep their identity and aborts stay unknown",
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
    const posts = [];
    page.on("request", request => {
      if (request.method() === "POST") posts.push({ key: request.headers()["idempotency-key"], body: request.postData() });
    });
    await page.goto(base + "/preview/form?variant=Action%20outcome");
    await page.evaluate(() => {
      window.actionEvents = [];
      document.addEventListener("mero:action", event => window.actionEvents.push(event.detail.state));
    });

    const form = page.locator("form[data-mero-form]");
    const submit = page.getByRole("button", { name: "Rotate signing key" });
    const password = page.getByLabel("Your password");
    const outcome = page.getByLabel("Simulated server response");
    const panel = page.locator("#rotate-key-unknown");
    const error = page.locator("[data-mero-form-error]");
    const result = page.locator("#rotate-key-result");
    const state = () => submit.getAttribute("data-mero-action-state");
    const settled = () => page.waitForFunction(() => !document.querySelector("form[aria-busy]") &&
      document.querySelector("[data-mero-action-state]")?.dataset.meroActionState !== "pending");
    const send = async value => {
      await outcome.selectOption(value);
      await password.fill("correct horse");
      await submit.click();
      await settled();
    };

    // A confirmed success swaps the new key in and clears the password.
    await send("succeeded");
    assert.equal(await state(), "succeeded");
    assert.match(await result.textContent(), /New key/);
    assert.equal(await password.inputValue(), "", "the password is cleared after success");
    assert.equal(await panel.isHidden(), true);

    // A 2xx without the expected content is unknown: no swap, no success text, the recovery panel appears.
    await send("incomplete");
    assert.equal(await state(), "unknown");
    assert.match(await result.textContent(), /New key/, "the unexpected body is not swapped in");
    assert.equal(await panel.isVisible(), true);
    assert.equal(await error.isVisible(), true);
    assert.doesNotMatch(await error.textContent(), /rotated|saved|success/i);
    assert.equal(await password.inputValue(), "");

    // A refusal shows the server's text and hides the recovery panel again.
    await send("rejected");
    assert.equal(await state(), "rejected");
    assert.equal(await error.textContent(), "Your password did not match. Nothing changed.");
    assert.equal(await panel.isHidden(), true);
    assert.equal(await password.inputValue(), "", "the password is cleared after a refusal");

    // A gateway timeout is unknown. Mero never sends it again by itself.
    posts.length = 0;
    await send("unknown");
    assert.equal(await state(), "unknown");
    assert.equal(await panel.isVisible(), true);
    await page.waitForTimeout(400);
    assert.equal(posts.length, 1, "an unknown outcome is never re-sent automatically");
    // The person's retry is the same request: same idempotency key and the same fields.
    await password.fill("correct horse");
    await submit.click();
    await settled();
    assert.equal(posts.length, 2);
    assert.equal(posts[1].key, "rotate-demo-7f3a");
    assert.equal(posts[1].key, posts[0].key, "a retry keeps the request identity");
    assert.equal(posts[1].body, posts[0].body);

    // An abort after the request was sent is unknown, never silently cleared.
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/demo/catalog/form-outcome", async route => { await held; await route.abort().catch(() => {}); });
    await outcome.selectOption("succeeded");
    await password.fill("correct horse");
    await submit.click();
    await page.waitForFunction(() => document.querySelector("[data-mero-action-state=pending]"));
    await form.evaluate(node => node.dispatchEvent(new CustomEvent("htmx:abort")));
    await settled();
    assert.equal(await state(), "unknown", "an abort after sending is unknown");
    assert.equal(await panel.isVisible(), true);
    assert.equal(await error.isVisible(), true);
    release();
    await page.unroute("**/demo/catalog/form-outcome");

    // A request cancelled before it was sent never went out: no state, no message.
    posts.length = 0;
    await page.evaluate(() => document.addEventListener("htmx:before:request", event => event.preventDefault(), { once: true }));
    await password.fill("correct horse");
    await submit.click();
    await page.waitForTimeout(200);
    assert.equal(posts.length, 0);
    assert.equal(await state(), null);

    // An unknown outcome must not let a success trigger close dialogs or announce a save.
    await page.route("**/demo/catalog/form-outcome", route => route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/html", "Mero-Action-Outcome": "unknown", "Mero-Action-Message": "The rotation may have happened.",
        "HX-Trigger": JSON.stringify({ "mero:form-saved": { message: "Key rotated" } }) },
      body: "<p data-rotated-key>mk_live_ffff</p>",
    }));
    await password.fill("correct horse");
    await submit.click();
    await settled();
    assert.equal(await state(), "unknown");
    assert.equal(await error.textContent(), "The rotation may have happened.");
    await page.waitForTimeout(200);
    assert.equal(await page.locator(".mero-toast").count(), 0, "no success toast for an unknown outcome");
    await page.unroute("**/demo/catalog/form-outcome");

    // The same trigger on a confirmed success still works.
    await page.route("**/demo/catalog/form-outcome", route => route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/html", "HX-Trigger": JSON.stringify({ "mero:form-saved": { message: "Key rotated" } }) },
      body: "<p data-rotated-key>mk_live_ffff</p>",
    }));
    await password.fill("correct horse");
    await submit.click();
    await page.locator(".mero-toast", { hasText: "Key rotated" }).waitFor();
    assert.equal(await state(), "succeeded");
    await page.unroute("**/demo/catalog/form-outcome");

    // Without data-mero-clear-passwords the field keeps its value, as before.
    await form.evaluate(node => node.removeAttribute("data-mero-clear-passwords"));
    await send("rejected");
    assert.equal(await password.inputValue(), "correct horse");

    // The cancelled request reports pending only; its state is cleared rather than concluded.
    assert.deepEqual(await page.evaluate(() => window.actionEvents), [
      "pending", "succeeded", "pending", "unknown", "pending", "rejected", "pending", "unknown", "pending", "unknown",
      "pending", "unknown", "pending", "pending", "unknown", "pending", "succeeded", "pending", "rejected",
    ]);
    assert.deepEqual(errors, []);
  });

test("an action button with an expect selector reports a bare 2xx as unknown",
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
    await page.goto(base + "/preview/action-button");
    const retry = page.getByRole("button", { name: "Retry export" });
    await retry.evaluate(button => {
      button.setAttribute("data-mero-action-expect", "[data-export-id]");
      button.setAttribute("data-mero-action-unknown", "The export may have restarted. Check the export list.");
    });
    await retry.click();
    await page.waitForFunction(() => document.querySelector("[data-mero-action-state=unknown]"));
    const status = retry.locator("xpath=following-sibling::*[@data-mero-action-status]");
    assert.equal(await status.textContent(), "The export may have restarted. Check the export list.",
      "the server's success message is not shown for an unconfirmed success");
    assert.equal(await status.getAttribute("data-tone"), "danger");
  });
