import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { groups, handleWorkspaceRequest } from "../site/workspace-components.mjs";

async function endpoint(path, { method = "GET", body, type = "application/x-www-form-urlencoded" } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  Object.assign(request, { method, headers: { "content-type": type } });
  const response = {
    writeHead(status) { this.status = status; },
    end(html) { this.html = html; },
  };
  const handled = await handleWorkspaceRequest(request, response, new URL(path, "http://localhost"));
  return { handled, html: response.html, status: response.status };
}

test("each workspace example exposes its exact demonstrated markup", () => {
  const items = groups.flatMap(group => group.items);
  assert.equal(items.length,25);
  assert.equal(new Set(items.map(item => item.id)).size,items.length);
  for (const item of items) assert.equal(item.code,item.demo);
});

test("workspace routes validate preferred values and preserve unrelated routes", async () => {
  assert.equal((await endpoint("/demo/other")).handled,false);
  assert.equal((await endpoint("/demo/workspace/cell/slider",{method:"POST",body:"value=610"})).status,422);
  const saved = await endpoint("/demo/workspace/cell/switch",{method:"POST"});
  assert.match(saved.html,/off/);
  assert.equal(saved.status,200);
  assert.equal((await endpoint("/demo/workspace/filter?q=xxx")).html,"No matching products.");
  assert.match((await endpoint("/demo/workspace/filter?status=Draft")).html,/Studio stool/);
});

test("rich text previews contain only escaped text and supported formatting", async () => {
  const runs = [{text:'<b onclick="x">Tea</b>',bold:true},{text:" cup",italic:true}];
  const result = await endpoint("/demo/workspace/preview",{method:"POST",body:new URLSearchParams({runs:JSON.stringify(runs)}).toString()});
  assert.equal(result.status,200);
  assert.equal(result.html,'<strong>&lt;b onclick=&quot;x&quot;&gt;Tea&lt;/b&gt;</strong><em> cup</em>');
  assert.equal((await endpoint("/demo/workspace/preview",{method:"POST",body:"runs=oops"})).status,422);
});

test("the rich text limit counts the edited text after form encoding", async () => {
  const text = "燈".repeat(4000);
  const body = new URLSearchParams({ body:text, runs:JSON.stringify([{ text, bold:true }]) });
  const valid = await endpoint("/demo/workspace/preview",{method:"POST",body:body.toString()});
  assert.equal(valid.status,200);
  assert.equal(valid.html,`<strong>${text}</strong>`);
  body.delete("runs");
  body.set("body",text + "x");
  assert.equal((await endpoint("/demo/workspace/preview",{method:"POST",body:body.toString()})).status,422);
});

test("file validation checks a bounded multipart file and escapes its name", async () => {
  async function upload(content) {
    const form = new FormData();
    form.append("photo",new Blob([content],{type:"image/png"}),"<local>.png");
    const wire = new Response(form);
    return endpoint("/demo/workspace/upload",{method:"POST",body:Buffer.from(await wire.arrayBuffer()),type:wire.headers.get("content-type")});
  }
  assert.equal((await upload("fake")).status,422);
  const valid = await upload(Uint8Array.from([137,80,78,71,13,10,26,10]));
  assert.equal(valid.status,200);
  assert.match(valid.html,/&lt;local&gt;.png passed the PNG signature/);
});

test("wizard requires both project and supported access values", async () => {
  const invalid = await endpoint("/demo/workspace/project",{method:"POST",body:"project=Test&access=World"});
  const valid = await endpoint("/demo/workspace/project",{method:"POST",body:"project=%3CNorth%3E&access=Private"});
  assert.equal(invalid.status,422);
  assert.match(valid.html,/Setup confirmed for &lt;North&gt; · Private/);
});
