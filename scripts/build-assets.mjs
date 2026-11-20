import { cp, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sourceArchiveEntries } from "../server.mjs";
import { layoutSourceFiles } from "../site/layout-workbench.mjs";
import { createSourceArchive, inventoryArchiveEntries } from "../site/inventory-routes.mjs";

await mkdir(".cloudflare", { recursive: true });
const stage = await mkdtemp(".cloudflare/site-assets-");
await cp("public", stage, { recursive: true });
for (const name of await readdir("public")) {
  if (/^mero[.-]/.test(name)) await cp(join("public", name), join(stage, name.replace(/^mero/, "relay")));
}
for (const file of layoutSourceFiles) {
  const destination = join(stage, "source", file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(file, destination);
}
const downloads = join(stage, "downloads");
await mkdir(downloads);
await writeFile(join(downloads, "mero-ui.tar.gz"), await createSourceArchive(sourceArchiveEntries));
await cp(join(downloads, "mero-ui.tar.gz"), join(downloads, "relay-ui.tar.gz"));
await writeFile(join(downloads, "studio-inventory.tar.gz"), await createSourceArchive(inventoryArchiveEntries));
await writeFile(join(stage, "_headers"), [
  "/source/*", "  Content-Type: text/plain; charset=utf-8", "  X-Robots-Tag: noindex",
  "/downloads/*", "  Content-Type: application/gzip", "  Content-Disposition: attachment",
  "  X-Robots-Tag: noindex", "/*", "  X-Content-Type-Options: nosniff", "",
].join("\n"));
await rm(".cloudflare/site-assets", { recursive: true, force: true });
await rename(stage, ".cloudflare/site-assets");
