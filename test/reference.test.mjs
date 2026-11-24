import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { components } from "../site/catalog.mjs";
import { referenceMarkdown, referencePage } from "../site/reference.mjs";

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

test("the reference documents every data-mero attribute in the shipped scripts and styles", () => {
  const sources = scripts + readdirSync("ui").filter(name => name.endsWith(".css")).map(name => readFileSync("ui/" + name, "utf8")).join("\n");
  const names = new Set(sources.match(/data-mero-[a-z-]*[a-z]/g));
  // dataset.meroReturnFocus is data-mero-return-focus.
  for (const [, key] of scripts.matchAll(/dataset\.(mero[A-Za-z]+)/g)) names.add("data-" + key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase()));
  assert.ok(names.size >= 80);
  for (const name of names) assert.ok(page.includes(`<code>${name}</code>`), name);
});

test("the reference documents every Mero header in the shipped scripts", () => {
  const names = new Set(scripts.match(/Mero-[A-Z][A-Za-z-]+/g));
  assert.ok(names.size >= 5);
  const markdown = referenceMarkdown();
  for (const name of names) {
    assert.ok(page.includes(`<code>${name}</code>`), name);
    assert.ok(markdown.includes("`" + name + "`"), name + " in Markdown");
  }
});

test("the owned-state list names every ARIA attribute the covered scripts write", () => {
  // The page says the list covers these three scripts.
  const covered = ["mero.js", "mero-forms.js", "mero-live.js"].map(name => readFileSync("ui/" + name, "utf8")).join("\n");
  const names = new Set([...covered.matchAll(/(?:set|remove|toggle)Attribute\(\s*"(aria-[a-z]+)"/g)].map(match => match[1]));
  assert.ok(names.size >= 9);
  const section = page.match(/<section aria-labelledby="reference-owned">[^]*?<\/section>/)?.[0] ?? "";
  const markdown = referenceMarkdown().match(/## State Mero owns[^]*?(?=\n## |$)/)?.[0] ?? "";
  for (const name of names) {
    assert.ok(section.includes(`<code>${name}</code>`), name);
    assert.ok(markdown.includes("`" + name + "`"), name + " in Markdown");
  }
});
