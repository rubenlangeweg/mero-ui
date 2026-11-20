import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { components } from "../site/catalog.mjs";
import { referencePage } from "../site/reference.mjs";

const scripts = readdirSync("ui").filter(name => name.endsWith(".js")).map(name => readFileSync("ui/" + name, "utf8")).join("\n");
const page = referencePage();

test("the reference documents every Mero event and MeroUI function in the shipped scripts", () => {
  const events = new Set(scripts.match(/mero:[a-z-]+/g));
  assert.ok(events.size >= 6);
  for (const name of events) assert.ok(page.includes(`<code>${name}</code>`), name);
  const api = scripts.match(/window\.MeroUI = Object\.freeze\(\{([^}]+)\}\)/)[1].split(",").map(name => name.trim());
  for (const name of api) assert.ok(page.includes(`MeroUI.${name}(`), name);
});

test("the reference links to components that exist", () => {
  for (const [, id] of page.matchAll(/href="\/components\/([a-z-]+)"/g)) assert.ok(components.has(id), id);
});
