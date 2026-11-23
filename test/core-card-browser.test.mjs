import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("card header actions end the row and a flush table reaches the card edges", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1.5, `${label}: ${a} vs ${b}`);

  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("http://127.0.0.1:" + server.address().port + "/preview/card?variant=Header+actions+and+table&theme=" + theme);
    const card = page.getByRole("region", { name: "Recent releases" });
    await page.getByRole("table", { name: "Recent releases" }).waitFor();
    const geometry = () => card.evaluate(el => {
      const rect = node => node.getBoundingClientRect();
      const box = rect(el), border = parseFloat(getComputedStyle(el).borderTopWidth);
      return {
        card: { left: box.left + border, right: box.right - border, bottom: box.bottom - border },
        padding: parseFloat(getComputedStyle(el).paddingInlineStart),
        header: rect(el.querySelector(".mero-card-header")), actions: rect(el.querySelector(".mero-card-actions")),
        table: rect(el.querySelector("table")), firstCellText: rect(el.querySelector("tbody th a")),
        lastCell: el.querySelector("tbody tr:last-child td:last-child"), lastRow: rect(el.querySelector("tbody tr:last-child")),
        lastPadding: parseFloat(getComputedStyle(el.querySelector("tbody tr td:last-child")).paddingInlineEnd),
      };
    });

    let g = await geometry();
    near(g.actions.right, g.header.right, "actions end the header row");
    near(g.table.left, g.card.left, "table starts at the card edge");
    near(g.table.right, g.card.right, "table ends at the card edge");
    near(g.lastRow.bottom, g.card.bottom, "last row reaches the card bottom");
    near(g.firstCellText.left - g.card.left, g.padding, "first cell keeps the card padding");
    near(g.lastPadding, g.padding, "last cell keeps the card padding");

    // A host that changes the padding through the token keeps the body flush.
    await card.evaluate(el => el.style.setProperty("--mero-panel-padding", "2rem"));
    g = await geometry();
    near(g.padding, 32, "the token sets the card padding");
    near(g.table.left, g.card.left, "flush body follows the token");
    near(g.firstCellText.left - g.card.left, 32, "first cell follows the token");
    await card.evaluate(el => el.style.removeProperty("--mero-panel-padding"));

    await page.evaluate(() => { document.documentElement.dir = "rtl"; });
    g = await geometry();
    near(g.actions.left, g.header.left, "actions end the header row in RTL");
    await page.evaluate(() => { document.documentElement.dir = "ltr"; });

    // Below 768 px the table becomes labelled cards inside the card padding.
    await page.setViewportSize({ width: 390, height: 800 });
    g = await geometry();
    near(g.table.left - g.card.left, g.padding, "cards sit inside the card padding");
    assert.equal(await card.locator("tbody tr").first().evaluate(el => getComputedStyle(el).display), "grid");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});
