import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright")
import { spawn } from "node:child_process"
const srv = spawn("node", ["serve.mjs"]); await new Promise(r => setTimeout(r, 400))
const browser = await chromium.launch(); const page = await browser.newPage(); const errors = []
page.on("pageerror", e => errors.push(e.message)); page.on("console", m => ["warning","error"].includes(m.type()) && errors.push(m.text()))
await page.goto("http://localhost:4317/grid-picker.html"); await page.waitForTimeout(300)
const log = (k, v) => console.log(k.padEnd(26), typeof v === "string" ? v : JSON.stringify(v))
// GRID
await page.focus('mero-grid-cell[row="0"][col="0"]')
await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown")
log("grid active", await page.evaluate(() => document.activeElement.textContent))
await page.keyboard.press("Shift+ArrowRight"); await page.keyboard.press("Shift+ArrowDown")
log("grid selected", await page.evaluate(() => [...document.querySelectorAll('mero-grid-cell[aria-selected="true"]')].map(c => c.textContent)))
log("grid bounds (api)", await page.evaluate(() => document.querySelector("mero-grid").api.selectedBounds()))
log("grid mero:range", await page.evaluate(() => ev.filter(e => e[0] === "mero:range").at(-1)))
log("grid edges", await page.evaluate(() => [...document.querySelectorAll('[data-range-edge]')].map(c => c.textContent + "=" + c.dataset.rangeEdge)))
await page.keyboard.press("Control+End"); log("grid ctrl+end", await page.evaluate(() => document.activeElement.textContent))
// PICKER
await page.focus('mero-asset[value="a1"]')
await page.keyboard.press(" "); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Shift+ArrowRight")
log("picker selected", await page.evaluate(() => [...document.querySelectorAll('mero-asset[aria-selected="true"]')].map(a => a.getAttribute("value"))))
await page.click('mero-asset[value="a6"]', { modifiers: ["Control"] })
log("picker +ctrl click a6", await page.evaluate(() => [...document.querySelectorAll('mero-asset[aria-selected="true"]')].map(a => a.getAttribute("value"))))
// keyboard group move: focus a6 (selected), pick up, move to start
await page.focus('mero-asset[value="a6"]'); await page.keyboard.press("Enter"); await page.keyboard.press("Home"); await page.keyboard.press("Enter"); await page.waitForTimeout(50)
log("picker order after group", await page.evaluate(() => [...document.querySelectorAll("mero-asset")].map(a => a.getAttribute("value")).join(" ")))
log("live region", await page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map(n => n.textContent).filter(Boolean).join(" | ")))
// pointer drag a4 to first slot
const b4 = await page.locator('mero-asset[value="a4"]').boundingBox(); const b1 = await page.locator("mero-asset").first().boundingBox()
await page.mouse.move(b4.x + 20, b4.y + 20); await page.mouse.down(); await page.mouse.move(b4.x + 10, b4.y + 10, { steps: 3 }); await page.mouse.move(b1.x + 5, b1.y + 20, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(100)
log("picker order after drag", await page.evaluate(() => [...document.querySelectorAll("mero-asset")].map(a => a.getAttribute("value")).join(" ")))
// AGENT
const snap = await page.evaluate(() => uiAgent.snapshot().map(c => ({ ref: c.ref, component: c.component, label: c.label, actions: c.actions, keys: Object.keys(c) })))
log("agent snapshot", snap)
const r = await page.evaluate(() => uiAgent.act({ steps: [{ ref: "Product images", action: "selectAssets", args: [["a2", "a3"]] }, { ref: "Prices", action: "selectCells", args: [0, 0, 2, 0] }] }).then(r => ({ ok: r.ok, error: r.error })))
log("agent act", r)
log("  picker selected", await page.evaluate(() => [...document.querySelectorAll('mero-asset[aria-selected="true"]')].map(a => a.getAttribute("value"))))
log("  grid selected", await page.evaluate(() => [...document.querySelectorAll('mero-grid-cell[aria-selected="true"]')].map(c => c.textContent)))
// AXE
const axe = await page.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] })).violations.map(v => `${v.id} (${v.nodes.length}): ${v.help}`))
log("axe violations", axe)
log("errors", errors)
await browser.close(); srv.kill()
