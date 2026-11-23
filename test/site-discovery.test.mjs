import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";
import { components } from "../site/catalog.mjs";

const publicOrigin = "https://mero.example";
const projectPages = ["/about", "/terms", "/license", "/privacy"];

async function serve(t, siteOrigin = publicOrigin) {
  const server = createApp({ siteOrigin });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return "http://127.0.0.1:" + server.address().port;
}

async function getText(base, path, headers) {
  const response = await fetch(base + path, { headers });
  assert.equal(response.status, 200, path);
  return response.text();
}

function links(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map(match => match[1]);
}

function canonical(html) {
  const tag = html.match(/<link\b(?=[^>]*\brel="canonical")[^>]*>/i)?.[0];
  return tag?.match(/\bhref="([^"]+)"/i)?.[1];
}

test("the footer leads visitors to project information and the original bundled license notices", async t => {
  const base = await serve(t);
  const home = await getText(base, "/");
  const footer = home.match(/<footer class="site-footer"[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer, "homepage footer is in the initial HTML");
  const destinations = new Set(links(footer));
  for (const path of [...projectPages, "/components", "/start", "/layouts"]) {
    assert.ok(destinations.has(path), path);
  }
  for (const path of destinations) {
    if (!path.startsWith("/")) continue;
    const page = await getText(base, path);
    if (projectPages.includes(path)) {
      assert.match(page, /<h1\b/);
      assert.equal(canonical(page), publicOrigin + path);
    }
  }
  const license = await getText(base, "/license");
  for (const notice of ["/vendor/HTMX-LICENSE.txt", "/fonts/geist-LICENSE.txt", "/fonts/geist-mono-LICENSE.txt"]) {
    assert.ok(links(license).includes(notice), notice);
    assert.match(await getText(base, notice), /copyright|zero-clause bsd/i);
  }
});

test("Go and Rust quick starts are discoverable in the initial HTML", async t => {
  const base = await serve(t);
  const home = await getText(base, "/");
  const guide = await getText(base, "/start");
  for (const language of ["go", "rust"]) {
    assert.ok(links(home).includes("/start#" + language));
    assert.ok(links(guide).includes("#" + language));
    assert.ok(guide.includes(`id="${language}"`));
  }
  assert.equal(canonical(guide), publicOrigin + "/start");
  assert.match(guide, /<title>[^<]*Go[^<]*Rust/);
});

test("robots advertises a sitemap of canonical documentation URLs using the configured origin", async t => {
  const base = await serve(t);
  const robots = await getText(base, "/robots.txt");
  assert.ok(robots.split(/\r?\n/).some(line => line.trim() === "Sitemap: " + publicOrigin + "/sitemap.xml"));
  const xml = await getText(base, "/sitemap.xml", { "x-forwarded-host": "different.example" });
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  const paths = new Set(urls.map(url => url.pathname));
  assert.equal(paths.size, urls.length, "each canonical path occurs once");
  for (const url of urls) {
    assert.equal(url.origin, publicOrigin);
    assert.equal(url.search + url.hash, "");
    assert.doesNotMatch(url.pathname, /^\/(?:demo|downloads|preview|source)\//);
  }
  for (const path of ["/", "/about", "/docs/design-principles", "/docs/responsive-layouts", ...[...components.keys()].map(id => "/components/" + id)]) {
    assert.ok(paths.has(path), path);
  }
  const local = await serve(t, "");
  assert.ok((await getText(local, "/sitemap.xml")).includes("<loc>" + local + "/</loc>"));
});

test("search metadata describes the document and distinguishes previews and HTML fragments", async t => {
  const base = await serve(t);
  const docs = await getText(base, "/components/button?utm_source=docs");
  assert.equal(canonical(docs), publicOrigin + "/components/button");
  const head = docs.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
  const description = head?.match(/<meta\b(?=[^>]*\bname="description")[^>]*>/i)?.[0];
  assert.match(description || "", /\bcontent="[^"]*(button|action)/i);
  const home = await getText(base, "/");
  const structured = [...home.matchAll(/<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
  assert.match(JSON.stringify(structured), /"WebSite"/);
  for (const path of ["/preview/button", "/layouts/dashboard?embed=1"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const page = await response.text();
    const robots = page.match(/<meta\b(?=[^>]*\bname="robots")[^>]*>/i)?.[0] || "";
    assert.match(robots + " " + (response.headers.get("X-Robots-Tag") || ""), /\bnoindex\b/i, path);
  }
  const fragment = await getText(base, "/components/button", { "HX-Request": "true", "HX-Target": "catalog-content" });
  assert.match(fragment, /<h1\b[^>]*>Button<\/h1>/);
  assert.doesNotMatch(fragment, /<head>|<footer\b/i);
});

test("HEAD answers like GET with the same status and headers and no body", async t => {
  const base = await serve(t);
  for (const path of ["/", "/components/button", "/sitemap.xml", "/mero.css", "/demo/stock-summary", "/no-such-page"]) {
    const get = await fetch(base + path);
    const head = await fetch(base + path, { method: "HEAD" });
    assert.equal(head.status, get.status, path);
    for (const name of ["content-type", "cache-control", "vary", "x-robots-tag", "x-content-type-options"]) {
      assert.equal(head.headers.get(name), get.headers.get(name), path + " " + name);
    }
    assert.equal(await head.text(), "", path);
    assert.notEqual(await get.text(), "", path);
  }
  assert.equal((await fetch(base + "/demo/settings", { method: "PUT" })).status, 404);
});
