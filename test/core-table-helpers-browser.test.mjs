import { browserConfig } from "../scripts/browser-config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

const playwright = await import(browserConfig.playwrightModule || "playwright").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && !browserConfig.playwrightModule) return null;
  throw error;
});

test("table cards hide marked columns, numbers end-align and the scroller contains hidden text", {
  skip: !playwright && "Install Playwright to run the browser regression",
}, async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const engine = browserConfig.engine || "chromium";
  const browser = await playwright[engine].launch({ executablePath: engine === "chromium" ? browserConfig.chromeExecutable : undefined });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const base = "http://127.0.0.1:" + server.address().port;
  // Right edge of a cell's own text, so the check measures the painted number rather than the cell box.
  const textEdges = selector => page.locator(selector).evaluateAll(cells => cells.map(cell => {
    const range = document.createRange();
    range.selectNodeContents(cell.lastChild);
    const text = range.getBoundingClientRect();
    return { left: text.left, right: text.right, cellRight: cell.getBoundingClientRect().right - parseFloat(getComputedStyle(cell).paddingRight) };
  }));

  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(base + "/preview/table?variant=Cards+on+phones&theme=" + theme);
    const table = page.getByRole("table", { name: "Environments" });
    await table.waitFor();
    assert.ok(await page.getByRole("columnheader", { name: "Region" }).isVisible());
    const deploys = await textEdges("tbody td.mero-table-num:nth-child(4)");
    assert.ok(deploys.every(edge => Math.abs(edge.right - edge.cellRight) < 1), "numbers end at the cell's inline end");
    assert.ok(Math.abs(deploys[0].left - deploys[1].left) > 5, "1,284 and 96 share their end edge, not their start edge");
    assert.match(await page.locator("td.mero-table-num").first().evaluate(el => getComputedStyle(el).fontVariantNumeric), /tabular-nums/);

    await page.setViewportSize({ width: 390, height: 800 });
    assert.equal(await page.locator("tbody tr").first().evaluate(el => getComputedStyle(el).display), "grid");
    assert.equal(await page.locator("td[data-mero-card-hidden]").first().isVisible(), false);
    // Cards keep row and cell semantics; the hidden column leaves the accessibility tree with its cells.
    const tree = await table.ariaSnapshot();
    assert.match(tree, /- row "acme-production Live 1,284 0\.02%"/);
    assert.doesNotMatch(tree, /Europe West/);
    const cardNumber = await textEdges("tbody tr:first-child td.mero-table-num:nth-child(4)");
    const label = await page.locator("tbody tr:first-child td:nth-child(4) [data-mero-cell-label]").boundingBox();
    assert.ok(cardNumber[0].left > label.x + label.width, "in a card the number follows its label");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }

  // Visually hidden text in the last column of a scrolling table stays inside the scroller.
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto(base + "/preview/table");
  await page.locator(".mero-table tbody tr").evaluateAll(rows => rows.forEach(row => {
    row.insertAdjacentHTML("beforeend", "<td>Additional column value</td>".repeat(6) +
      '<td>Last<span style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)"> hidden text</span></td>');
  }));
  const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, table: document.querySelector(".mero-table-wrap").scrollWidth }));
  assert.ok(sizes.table > sizes.viewport, "the table scrolls sideways");
  assert.equal(sizes.page, sizes.viewport);
});
