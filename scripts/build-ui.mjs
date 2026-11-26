// Builds minified UI assets (dist/ui/*.min.{js,css}) and an SRI/size manifest (dist/manifest.json).
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { transform as transformCss } from "lightningcss";
import { minifySync } from "rolldown/experimental";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const uiDir = new URL("ui/", root);
const distDir = new URL("dist/", root);
const distUiDir = new URL("dist/ui/", root);

const sri = buffer => "sha384-" + createHash("sha384").update(buffer).digest("base64");
const sha256 = buffer => createHash("sha256").update(buffer).digest("hex");
const measure = buffer => ({
  bytes: buffer.byteLength,
  gzip: gzipSync(buffer).byteLength,
  sha256: sha256(buffer),
  integrity: sri(buffer),
});

await rm(distDir, { recursive: true, force: true });
await mkdir(distUiDir, { recursive: true });

const files = (await readdir(uiDir)).sort();
const manifest = {
  name: pkg.name,
  version: pkg.version,
  files: {},
  minified: {},
};

for (const file of files) {
  if (!/\.(?:css|js|mjs|d\.ts)$/.test(file)) continue;
  const source = await readFile(new URL(file, uiDir));
  manifest.files["ui/" + file] = measure(source);
  if (file.endsWith(".css")) {
    const banner = source.toString("utf8").match(/^\/\*![^\n]*\*\//)?.[0] ?? "";
    const { code } = transformCss({
      filename: file,
      code: source,
      minify: true,
      errorRecovery: true,
    });
    const out = Buffer.from((banner ? banner + "\n" : "") + Buffer.from(code).toString("utf8"));
    const minName = file.replace(/\.css$/, ".min.css");
    await writeFile(new URL(minName, distUiDir), out);
    manifest.minified["dist/ui/" + minName] = measure(out);
  } else if (file.endsWith(".js")) {
    const text = source.toString("utf8");
    const banner = text.match(/^\/\*![^\n]*\*\//)?.[0] ?? "";
    const { code, errors } = minifySync(file, text, { compress: true, mangle: true });
    if (errors?.length) throw new Error(`Minify failed for ${file}: ${errors.map(e => e.message).join("; ")}`);
    const out = Buffer.from((banner ? banner + "\n" : "") + code);
    const minName = file.replace(/\.js$/, ".min.js");
    await writeFile(new URL(minName, distUiDir), out);
    manifest.minified["dist/ui/" + minName] = measure(out);
  }
}

await writeFile(new URL("manifest.json", distDir), JSON.stringify(manifest, null, 2) + "\n");
