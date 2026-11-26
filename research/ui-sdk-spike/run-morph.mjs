import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright")
import { spawn } from "node:child_process"
const srv = spawn("node", ["serve.mjs"]); await new Promise(r => setTimeout(r, 400))
const browser = await chromium.launch()
const dom = p => p.evaluate(() => [...document.querySelectorAll("mero-tree-row")].map(r => r.getAttribute("value")).join(" "))
const morph = p => p.evaluate(async () => { const t = document.querySelector("#host"); await htmx.swap({ target: t, text: await (await fetch("/tree-fragment.html")).text(), swap: "innerMorph" }) })
for (const [name, withModule, reorder] of [["control: plain elements, DOM reordered by hand", false, "manual"], ["ui-sdk, no client reorder", true, null], ["ui-sdk, keyboard reorder then morph", true, "kbd"], ["ui-sdk, morph twice after reorder", true, "kbd2"]]) {
  const page = await browser.newPage()
  if (!withModule) await page.route("**/all.js", r => r.fulfill({ body: "", contentType: "text/javascript" }))
  await page.goto("http://localhost:4317/tree.html"); await page.waitForTimeout(300)
  if (reorder === "manual") await page.evaluate(() => { const t = document.querySelector("mero-tree"); const g = t.querySelector('[value=garden]'), tl = t.querySelector('[value=tools]'); t.prepend(g, tl) })
  if (reorder?.startsWith("kbd")) { await page.focus('mero-tree-row[value=garden]'); await page.keyboard.press("Space"); for (let i=0;i<3;i++) await page.keyboard.press("ArrowUp"); await page.keyboard.press("Space"); await page.waitForTimeout(50) }
  const before = await dom(page); await morph(page); await page.waitForTimeout(100)
  if (reorder === "kbd2") { await morph(page); await page.waitForTimeout(100) }
  const state = withModule ? await page.evaluate(() => document.querySelector("mero-tree").api ? uiAgent.snapshot()[0]?.rows.map(r=>r.key).join(" ") : "n/a") : "n/a"
  console.log(`${name}\n   before: ${before}\n   after:  ${await dom(page)}\n   state:  ${state}`)
  await page.close()
}
await browser.close(); srv.kill()
