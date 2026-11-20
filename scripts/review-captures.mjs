import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { components } from "../site/catalog.mjs";
import { escapeHtml as esc } from "../site/html.mjs";

// Keep the component at its rendered pixel size, with enough room for its focus ring.
export async function captureExample(page, route, directory, { width, theme }) {
  const url = new URL(route, "http://localhost");
  const component = components.get(url.pathname.slice("/preview/".length));
  const variant = url.searchParams.get("variant") || "Default";
  const ordinal = variant === "Default" ? 0 : component.variants.findIndex(item => item.name === variant) + 1;
  const file = component.id + "-" + ordinal + "-" + width + "-" + theme + ".png";
  await mkdir(join(directory, "images"), { recursive: true });
  const clip = await page.locator("main").evaluate(main => {
    function boxes(element) {
      if (element.classList.contains("doc-preview-title")) return [];
      if (getComputedStyle(element).display === "contents") return [...element.children].flatMap(boxes);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? [rect] : [];
    }
    const visible = [...main.children].flatMap(boxes);
    if (!visible.length) return undefined;
    const root = document.documentElement;
    const x = Math.max(0, Math.floor(Math.min(...visible.map(r => r.left)) + scrollX - 14));
    const y = Math.max(0, Math.floor(Math.min(...visible.map(r => r.top)) + scrollY - 14));
    const endX = Math.min(root.scrollWidth, Math.ceil(Math.max(...visible.map(r => r.right)) + scrollX + 14));
    const endY = Math.min(root.scrollHeight, Math.ceil(Math.max(...visible.map(r => r.bottom)) + scrollY + 14));
    return { x, y, width: endX - x, height: endY - y };
  });
  await page.screenshot({ path: join(directory, "images", file), clip, animations: "disabled" });
  return { route, category: component.category, name: component.name, variant, width, theme, file };
}

export async function writeReviewIndex(directory, captures, audit) {
  await mkdir(directory, { recursive: true });
  const ordered = captures.sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width);
  await writeFile(join(directory, "results.json"), JSON.stringify({ ...audit, captures: ordered }, null, 2));
  const categories = new Map();
  for (const image of ordered) {
    if (!categories.has(image.category)) categories.set(image.category, new Map());
    const family = categories.get(image.category);
    if (!family.has(image.route)) family.set(image.route, []);
    family.get(image.route).push(image);
  }
  const families = [...categories].sort(([a], [b]) => a.localeCompare(b));
  const jump = families.map(([name], index) => `<a href="#family-${index}">${esc(name)}</a>`).join(" ");
  const body = families.map(([name, family], index) => `<section id="family-${index}"><h2>${esc(name)}</h2>${[...family.values()].map(group => {
    const [first] = group;
    const label = first.name + (first.variant === "Default" ? "" : " · " + first.variant);
    const link = "http://127.0.0.1:4173" + first.route.replace("/preview/", "/components/");
    return `<article><h3><a href="${esc(link)}">${esc(label)}</a></h3><div class="pair">${group.map(img =>
      `<figure><figcaption>${img.width} px · ${img.theme}</figcaption><a href="images/${img.file}"><img loading="lazy" src="images/${img.file}" alt="${esc(label)} in ${img.theme} theme"></a></figure>`).join("")}</div></article>`;
  }).join("")}</section>`).join("");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mero UI visual review</title>
<style>*{box-sizing:border-box}html{color-scheme:dark}body{max-width:1200px;margin:auto;padding:clamp(16px,4vw,48px);background:#131315;color:#eeedef;font:16px/1.5 system-ui}h1,h2,h3{line-height:1.2}a{color:inherit;text-underline-offset:3px}nav{display:flex;flex-wrap:wrap;gap:6px 16px}nav a,figcaption{font-size:13px;color:#c8c8ce}section{margin-top:48px}article{padding:6px 0 24px;border-top:1px solid #424248}.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:14px}figure{min-width:0;margin:0}figure>a{display:grid;min-height:110px;justify-items:center;align-items:center;border:1px solid #35353b;border-radius:8px;background:#1b1b1e}figcaption{margin-bottom:6px}img{max-width:100%;height:auto}@media(max-width:680px){.pair{grid-template-columns:1fr}}</style>
<h1>Mero UI visual review</h1><p>${ordered.length} browser captures. Select an image to inspect its original size or a component name to try the live example.</p><nav aria-label="Component families">${jump}</nav><main>${body}</main></html>`;
  await writeFile(join(directory, "index.html"), html);
}
