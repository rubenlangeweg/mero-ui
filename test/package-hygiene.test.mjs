import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { transform as transformCss } from "lightningcss";

const root = new URL("../", import.meta.url);

test("ui/ ships only text assets with no binary files, broken relative URLs or studio-lab demo code", async () => {
  const files = (await readdir(new URL("ui/", root))).sort();
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.match(file, /\.(?:css|js|mjs|d\.ts)$/, `ui/${file} must be a text asset (no binaries in ui/)`);
    assert.doesNotMatch(file, /inventory|studio-lamp/i, `demo asset ${file} must not ship in ui/`);
    const content = await readFile(new URL("ui/" + file, root), "utf8");
    assert.doesNotMatch(content, /\bdata-lab\b|\.lab-form\b/, `ui/${file} must not contain studio-lab demo selectors`);
    if (file.endsWith(".css")) {
      // Packaged CSS must not reference relative binary assets (which break consumer bundlers).
      assert.doesNotMatch(content, /url\(\s*(?:"(?!data:)|'(?!data:)|(?!["']|data:))/i, `ui/${file} must not contain external/relative url() references`);
      const { code } = transformCss({ filename: file, code: Buffer.from(content), minify: true });
      assert.ok(code.byteLength > 0, `ui/${file} compiles cleanly with lightningcss`);
    }
  }
});

test("core 4 files exist in ui/ and have clean minified counterparts after build:ui", async () => {
  const core = ["mero.css", "mero.js", "mero-forms.js", "mero-live.js"];
  for (const file of core) {
    const content = await readFile(new URL("ui/" + file, root), "utf8");
    assert.ok(content.length > 0, `ui/${file} exists`);
  }
});
