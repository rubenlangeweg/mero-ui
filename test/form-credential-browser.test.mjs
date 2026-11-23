import { browserConfig } from "../scripts/browser-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("a held credential is never lost to navigation, Back or unload, and is cleared once dismissed",
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
    const left = [];
    page.on("request", request => { if (new URL(request.url()).pathname === "/components") left.push(request.url()); });

    await page.goto(base + "/preview/form?variant=One-time%20credential");
    // A boosted link elsewhere on the page and an htmx history entry to go Back from.
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/components";
      link.id = "leave";
      link.textContent = "All components";
      link.setAttribute("hx-boost", "true");
      document.querySelector("main").append(link);
      window.htmx.process(link);
      history.pushState({ htmx: true }, "", location.pathname + location.search + "&step=2");
    });
    const held = location => location.endsWith("&step=2");
    const secret = page.locator("#api-token-secret");
    const token = page.locator("[data-api-token]");
    const unloadBlocked = () => page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    const tryToLeave = async () => {
      await page.locator("#leave").click();
      await page.waitForTimeout(300);
      assert.equal(left.length, 0, "a boosted navigation is cancelled before it is sent");
      assert.ok(held(page.url()), page.url());
    };

    assert.equal(await unloadBlocked(), false, "nothing is held before the request");

    // While the request that creates the token is pending, the page is held.
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route("**/demo/catalog/form-credential", async route => { await pending; await route.continue(); });
    await page.getByRole("button", { name: "Create token" }).click();
    await page.waitForFunction(() => document.querySelector("form[aria-busy]"));
    assert.equal(await unloadBlocked(), true, "unload asks first while the request is pending");
    await tryToLeave();
    release();
    await token.waitFor();
    await page.unroute("**/demo/catalog/form-credential");
    const value = await token.textContent();
    assert.match(value, /^mtk_[0-9a-f]{24}$/);
    assert.equal(await page.evaluate(() => document.activeElement?.matches(".mero-alert")), true, "focus moves to the new token");

    // While the token is shown, the page stays held.
    assert.equal(await unloadBlocked(), true, "unload asks first while the token is shown");
    await tryToLeave();
    assert.equal(await page.locator(".mero-toast", { hasText: "Copy the token before you leave" }).count() > 0, true);

    // Back to the previous htmx entry is undone and the token survives.
    const urls = [];
    await page.exposeFunction("recordUrl", url => urls.push(url));
    await page.evaluate(() => addEventListener("popstate", () => window.recordUrl(location.href)));
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => location.search.endsWith("&step=2") && window.htmx);
    await page.waitForTimeout(400);
    assert.ok(urls.some(url => !held(url)), "Back really left the entry: " + urls.join(", "));
    assert.ok(held(page.url()), "Back is undone: " + page.url());
    assert.equal(await token.textContent(), value, "the token survives Back");
    assert.equal(left.length, 0);

    // A real unload attempt raises the browser's leave-page prompt.
    const prompt = page.waitForEvent("dialog");
    page.evaluate(() => { location.href = "/components"; }).catch(() => {});
    const dialog = await prompt;
    assert.equal(dialog.type(), "beforeunload");
    await dialog.dismiss();
    await page.waitForTimeout(200);
    assert.ok(held(page.url()));
    assert.equal(await token.textContent(), value, "staying keeps the token");

    // Dismissing clears the secret, releases the hold and puts focus on the named control.
    await page.getByRole("button", { name: "I copied it" }).click();
    assert.equal(await secret.evaluate(node => node.innerHTML), "");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "api-token-create");
    assert.equal(await unloadBlocked(), false, "the hold ends once the token is dismissed");
    await page.locator("#leave").click();
    await page.waitForURL("**/components");
    assert.ok(left.length >= 1, "navigation works again");
    assert.deepEqual(errors, []);
  });

test("ephemeral content is cleared when its dialog closes and when the page is hidden",
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
    await page.goto(base + "/preview/form?variant=One-time%20credential");
    const result = await page.evaluate(async () => {
      const dialog = document.createElement("dialog");
      dialog.innerHTML = '<div data-mero-ephemeral data-mero-hold><code>secret-in-dialog</code></div>';
      document.body.append(dialog);
      dialog.showModal();
      const loose = document.querySelector("#api-token-secret");
      loose.innerHTML = "<code>secret-on-page</code>";
      dialog.close();
      // The close event fires in a later task.
      await new Promise(resolve => setTimeout(resolve, 50));
      const afterClose = dialog.querySelector("[data-mero-ephemeral]").innerHTML;
      const pageKept = loose.innerHTML;
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      return { afterClose, pageKept, afterHide: loose.innerHTML };
    });
    assert.deepEqual(result, { afterClose: "", pageKept: "<code>secret-on-page</code>", afterHide: "" });
  });
