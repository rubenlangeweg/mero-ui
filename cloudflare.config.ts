import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "mero-ui",
    entrypoint: "./worker.mjs",
    compatibilityDate: "2026-10-06",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["mero-ui.invrse.studio"],
    workersDev: false,
    assets: { htmlHandling: "none" },
  },
});
