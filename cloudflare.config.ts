import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig({
  worker: {
    name: "mero-ui",
    entrypoint: "./worker.mjs",
    compatibilityDate: "2026-10-06",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["mero-ui.rubenlangeweg.com", "mero-ui.invrse.studio"],
    workersDev: false,
    exports: {
      PremiumWorkspace: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      PREMIUM_WORKSPACE: bindings.durableObject({ worker: "mero-ui", exportName: "PremiumWorkspace" }),
    },
    assets: { htmlHandling: "none" },
  },
});
