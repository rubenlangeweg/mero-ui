// Minified + gzip -9 size of each entry, production conditions, ESM, browser.
import { build } from "esbuild"; import { gzipSync } from "node:zlib"; import { fileURLToPath } from "node:url"
const dir = fileURLToPath(new URL(".", import.meta.url))
for (const name of ["kernel", "tree-builtin", "tree-custom", "grid", "picker", "all3", "agent", "all3-agent", "helpers"]) {
  const { outputFiles: [out] } = await build({ entryPoints: [dir + name + ".js"], bundle: true, minify: true, format: "esm", platform: "browser", write: false, logLevel: "error" })
  console.log(name.padEnd(14), "min", String(out.contents.length).padStart(7), " gz", String(gzipSync(out.contents, { level: 9 }).length).padStart(6))
}
