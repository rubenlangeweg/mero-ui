import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("form grid places fields in two columns, spans wide fields and stacks on small screens", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const box = label => page.getByLabel(label, { exact: true }).boundingBox();
  const grid = page.locator(".mero-form-grid");

  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/form?variant=Two+columns&theme=" + theme);
    await page.getByRole("group", { name: "Profile" }).waitFor();

    const [name, email, team, notes, area] = [await box("Name"), await box("Email"), await box("Team"), await box("Notes"), await grid.boundingBox()];
    assert.ok(Math.abs(name.y - email.y) < 1 && email.x > name.x + name.width, "Name and Email share a row");
    assert.ok(team.y > email.y + email.height, "Team starts the next row");
    assert.ok(Math.abs(notes.width - area.width) < 1, "the wide field spans the row");

    // Tab order follows the source order, row by row.
    await page.getByLabel("Name", { exact: true }).focus();
    for (const next of ["demo-grid-email", "demo-grid-team", "demo-grid-region", "demo-grid-notes"]) {
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), next);
    }

    // A narrow container gets one column even on a wide screen.
    await page.locator("form").evaluate(form => { form.style.inlineSize = "20rem"; });
    const [narrowName, narrowEmail] = [await box("Name"), await box("Email")];
    assert.ok(narrowEmail.y > narrowName.y + narrowName.height, "fields stack in a narrow container");
    await page.locator("form").evaluate(form => { form.style.inlineSize = "min(100%, 40rem)"; });

    await page.setViewportSize({ width: 767, height: 900 });
    const [phoneName, phoneEmail] = [await box("Name"), await box("Email")];
    assert.ok(phoneEmail.y > phoneName.y + phoneName.height && Math.abs(phoneEmail.x - phoneName.x) < 1, "fields stack below 768 px");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }

  await page.getByLabel("Name", { exact: true }).fill("Taylor");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByRole("status").getByText("Welcome, Taylor.").waitFor();
});
