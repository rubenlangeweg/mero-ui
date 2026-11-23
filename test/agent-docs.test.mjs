import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";
import { agentDocument } from "../site/agent-docs.mjs";
import { components } from "../site/catalog.mjs";
import { selectVariant } from "../site/examples.mjs";

test("the agent index resolves every variant to the same template as the HTML catalog", () => {
  const index = agentDocument("llms.txt");
  const all = agentDocument("llms-components.txt");
  for (const item of components.values()) {
    const file = `components/${item.id}.md`;
    assert.ok(index.includes(`[${item.name}](${file})`), file);
    const markdown = agentDocument(file);
    for (const variant of ["Default", ...(item.variants ?? []).map(option => option.name)]) {
      const { code } = selectVariant(item, new URLSearchParams({ variant }));
      assert.ok(markdown.includes("\n" + code + "\n"), item.id + " " + variant);
      assert.ok(all.includes("\n" + code + "\n"), item.id + " " + variant);
    }
  }
});

test("an HTTP client can discover the confirmation template, assets and response contract", async t => {
  const server = createApp({ serveFiles: false });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = "http://127.0.0.1:" + server.address().port;
  const html = await (await fetch(origin + "/start")).text();
  const indexURL = new URL(html.match(/rel="describedby" href="([^"]+)"/)[1], origin);
  const index = await fetch(indexURL);
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type"), /^text\/plain/);
  const componentURL = new URL((await index.text()).match(/\[Typed Confirmation\]\(([^)]+)\)/)[1], indexURL);
  const response = await fetch(componentURL);
  assert.match(response.headers.get("content-type"), /^text\/markdown/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  const doc = await response.text();
  assert.match(doc, /<script defer src="\/mero-forms.js"><\/script>/);
  assert.match(doc, /data-mero-confirm-submit/);
  const patternsURL = new URL(doc.match(/\[Integration patterns and API reference\]\(([^)]+)\)/)[1], componentURL);
  const patterns = await (await fetch(patternsURL)).text();
  assert.match(patterns, /HTTP 422/);
  assert.match(patterns, /HX-Reswap: none\nHX-Trigger: \{"mero:form-saved"/);
  const full = await (await fetch(origin + "/llms-full.txt")).text();
  assert.ok(full.includes(patterns) && full.includes("data-mero-confirm-submit"));
  const head = await fetch(componentURL, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal((await fetch(origin + "/components/absent.md")).status, 404);
});
