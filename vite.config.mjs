import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  publicDir: ".cloudflare/site-assets",
  plugins: [cloudflare()],
});
