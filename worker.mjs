import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./server.mjs";

const server = createApp({ siteOrigin: "https://mero-ui.rubenlangeweg.com", serveFiles: false });
server.listen(4173);
export default httpServerHandler({ port: 4173 });
