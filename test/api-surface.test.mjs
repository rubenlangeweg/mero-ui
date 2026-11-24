import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const snapshot = async () => JSON.parse(await readFile(new URL("test/api-surface.json", root), "utf8"));

test("the public names in ui/ match the reviewed snapshot", async () => {
  // Fails with the removed and added names. A removal needs a deprecation first, see Stability in the README.
  await promisify(execFile)(process.execPath, ["scripts/api-surface.mjs", "--check"], { cwd: root });
});

test("the snapshot covers every gated surface, sorted", async () => {
  const surface = await snapshot();
  assert.deepEqual(Object.keys(surface), ["attributes", "events", "api", "headers", "tokens", "exports"]);
  for (const [kind, names] of Object.entries(surface)) {
    assert.ok(names.length, kind);
    assert.deepEqual(names, [...new Set(names)].sort(), kind);
  }
});

test("event names are lowercase kebab-case, so any attribute-based listener can name them", async () => {
  for (const name of (await snapshot()).events) assert.match(name, /^mero:[a-z]+(-[a-z]+)*$/);
});
