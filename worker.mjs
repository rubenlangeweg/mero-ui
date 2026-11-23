import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./server.mjs";

import { handlePremium } from "./examples/premium/edge.mjs";
export { PremiumWorkspace } from "./examples/premium/edge.mjs";

const server = createApp({ siteOrigin: "https://mero-ui.rubenlangeweg.com", serveFiles: false });
server.listen(4173);
const catalog = httpServerHandler({ port: 4173 });
export default {
  fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/premium" || path.startsWith("/premium/")) return handlePremium(request, env);
    return catalog.fetch(request, env, ctx);
  }
};
