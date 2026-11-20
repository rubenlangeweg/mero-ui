import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createApp } from "../server.mjs";
import { browserConfig } from "../scripts/browser-config.mjs";

async function serve(t) {
  const app = createApp();
  await new Promise((resolve, reject) => app.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  return "http://127.0.0.1:" + app.address().port;
}

test("each layout pairs its runnable template with its actual server implementation", async t => {
  const base = await serve(t);
  for (const [layout, file] of Object.entries({
    dashboard: "site/studio.mjs", settings: "server.mjs", crm: "site/business-layouts.mjs",
    finance: "site/business-layouts.mjs", mail: "site/communication-layouts.mjs", chat: "site/communication-layouts.mjs",
  })) {
    const html = await (await fetch(base + "/layouts/" + layout)).text();
    assert.ok(html.includes(layout === "dashboard" ? "Server-rendered workspace HTML" : "Initial server-rendered HTML"), layout);
    assert.ok(html.includes("data-exchange-body"), layout);
    assert.ok(html.includes(`href="/source/${file}"`), layout);
    const source = await fetch(base + "/source/" + file);
    assert.match(source.headers.get("content-type"), /text\/plain/);
    assert.equal(await source.text(), await readFile(new URL("../" + file, import.meta.url), "utf8"));
  }
  assert.equal((await fetch(base + "/source/package.json")).status, 404);
});

test("business layout requests return the selected workspace and history restores a full page", async t => {
  const base = await serve(t);
  for (const path of ["/layouts/crm?stage=negotiation", "/layouts/finance?period=2026-09"]) {
    const headers = { "HX-Request": "true", "HX-Target": "business-layout" };
    const res = await fetch(base + path, { headers });
    assert.match(res.headers.get("vary"), /HX-Target/);
    const fragment = await res.text();
    assert.ok(fragment.startsWith('<div id="business-layout"'));
    assert.doesNotMatch(fragment, /data-doc-lab|<!doctype/i);
    const restored = await (await fetch(base + path, { headers: { ...headers, "HX-History-Restore-Request": "true" } })).text();
    assert.match(restored, /<!doctype html>/i);
    assert.match(restored, /id="business-layout"/);
  }
});

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("the Kanban example and Studio walkthrough demonstrate their published move contracts", {
  skip: !playwright && "Install Playwright to run the walkthrough regression",
}, async t => {
  const base = await serve(t);
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(base + "/components/kanban");
  const board = page.locator("[data-mero-kanban]");
  await board.evaluate(el => el.addEventListener("mero:kanban-move", event => {
    const { card, from, to } = event.detail;
    el.dataset.lastMove = JSON.stringify([card.querySelector("strong").textContent, from, to]);
  }, { once: true }));
  const menu = board.getByRole("combobox", { name: "Move Validate finishes" });
  await menu.focus();
  await menu.press("r");
  assert.equal(await board.getAttribute("data-last-move"), JSON.stringify(["Validate finishes", "Queued", "Ready"]));
  assert.ok(await menu.evaluate(el => el === document.activeElement));
  assert.equal(await board.locator('[data-lane="Queued"] [data-lane-count]').textContent(), "0");
  assert.equal(await board.locator('[data-lane="Ready"] [data-lane-count]').textContent(), "2");
  await page.reload();
  assert.equal(await menu.inputValue(), "Queued");

  await page.getByRole("link", { name: "Try a server-saved task move in Studio" }).click();
  const guide = page.locator("#studio-task-guide");
  await guide.locator("summary").click();
  const company = await guide.getByRole("link", { name: "Open Forma Works" }).getAttribute("href");
  assert.equal(new URL(company, base).searchParams.get("company"), "forma");
  const [head, fields] = (await guide.locator("pre code").textContent()).split("\n\n");
  const [methodAndPath, ...headerLines] = head.split("\n");
  const [method, path] = methodAndPath.split(" ");
  const headers = Object.fromEntries(headerLines.map(line => line.split(": ")));
  const before = Number(await page.locator('.sc-metrics dt:text-is("Open tasks") + dd').textContent());
  const saved = await page.request.fetch(base + path, { method, headers, data: fields });
  assert.equal(saved.status(), 200);
  assert.match(await saved.text(), /id="studio-workspace"/);
  assert.equal(new URL(saved.headers()["hx-replace-url"], base).searchParams.get("task"), "ST-103");
  await page.reload();
  assert.equal(Number(await page.locator('.sc-metrics dt:text-is("Open tasks") + dd').textContent()), before - 1);
  const handler = await guide.getByRole("link", { name: "Read the task move handler", includeHidden: true }).getAttribute("href");
  assert.match(await (await page.request.get(base + handler)).text(), /export function mutateStudioTask/);
});

test("a layout's HTTP inspector shows the exact fragment returned after a swap", {
  skip: !playwright && "Install Playwright to run the inspector regression",
}, async t => {
  const base = await serve(t);
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  for (const [screen, name, fragmentPath] of [
    ["finance", "September 2026", "/layouts/finance"],
    ["mail", /Julian Park/, "/demo/layouts/mail"],
  ]) {
    await page.goto(base + "/layouts/" + screen);
    const response = page.waitForResponse(r => new URL(r.url()).pathname === fragmentPath && /xhr|fetch/.test(r.request().resourceType()));
    await page.getByRole("link", { name }).first().click();
    const reply = await response;
    await page.getByRole("tab", { name: "HTTP exchange" }).click();
    await page.waitForFunction(() => document.querySelector("[data-exchange-status]").textContent.startsWith("HTTP 200"));
    const text = await page.locator("[data-exchange-body]").textContent();
    const url = new URL(reply.url());
    assert.ok(text.startsWith("GET " + url.pathname + url.search));
    assert.ok(text.endsWith(await reply.text()));
    await page.getByRole("tab", { name: "Template" }).click();
    assert.ok(await page.getByText("Initial server-rendered HTML", { exact: true }).isVisible());
  }
});
