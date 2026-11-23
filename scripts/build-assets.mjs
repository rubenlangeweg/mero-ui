import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { factories } from "../examples/premium/workflows.mjs";
import { sourceArchiveEntries } from "../server.mjs";
import { layoutSourceFiles } from "../site/layout-workbench.mjs";
import { createSourceArchive, inventoryArchiveEntries } from "../site/inventory-routes.mjs";

await mkdir(".cloudflare", { recursive: true });
const stage = await mkdtemp(".cloudflare/site-assets-");
await cp("public", stage, { recursive: true });
await cp("ui", stage, { recursive: true });
const workflowSource = "examples/premium";
const workflowAssets = join(stage, "premium-assets");
await mkdir(workflowAssets);
await cp(join(workflowSource, "shell.css"), join(workflowAssets, "shell.css"));
for (const feature of Object.keys(factories)) {
  for (const extension of ["css", "js"]) {
    const filename = feature + "." + extension;
    await cp(join(workflowSource, filename), join(workflowAssets, filename));
  }
}
await cp(join(workflowSource, "recordings"), join(stage, "recordings"), { recursive: true });
for (const file of layoutSourceFiles) {
  const destination = join(stage, "source", file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(file, destination);
}
const downloads = join(stage, "downloads");
await mkdir(downloads);
await writeFile(join(downloads, "mero-ui.tar.gz"), await createSourceArchive(sourceArchiveEntries));
await writeFile(join(downloads, "studio-inventory.tar.gz"), await createSourceArchive(inventoryArchiveEntries));
await writeFile(join(stage, "_headers"), [
  "/fonts/*", "  Cache-Control: public, max-age=604800",
  "/source/*", "  Content-Type: text/plain; charset=utf-8", "  X-Robots-Tag: noindex",
  "/downloads/*", "  Content-Type: application/gzip", "  Content-Disposition: attachment",
  "  X-Robots-Tag: noindex", "/*", "  X-Content-Type-Options: nosniff", "",
].join("\n"));
await rm(".cloudflare/site-assets", { recursive: true, force: true });
await rename(stage, ".cloudflare/site-assets");
