import http from "node:http"; import fs from "node:fs"; import path from "node:path"
const root = path.dirname(new URL(import.meta.url).pathname)
http.createServer((req, res) => {
  const p = path.join(root, new URL(req.url, "http://x").pathname === "/" ? "tree.html" : new URL(req.url, "http://x").pathname)
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : "text/html" }); fs.createReadStream(p).pipe(res)
}).listen(4317)
