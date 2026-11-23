import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { factories, recordings, shell, watchPage } from './workflows.mjs';

const mime = {css: 'text/css', js: 'text/javascript', woff2: 'font/woff2', svg: 'image/svg+xml', ico: 'image/x-icon'};
const assets = new Map([
  ['/mero-wordmark.svg', '../../public/mero-wordmark.svg'], ['/favicon.ico', '../../public/favicon.ico'],
  ['/mero.css', '../../ui/mero.css'], ['/mero.js', '../../ui/mero.js'],
  ['/vendor/htmx.min.js', '../../public/vendor/htmx.min.js'],
  ['/fonts/geist.woff2', '../../public/fonts/geist.woff2'],
  ['/premium-assets/shell.css', './shell.css']
]);

for (const key of Object.keys(factories)) {
  for (const ext of ['css','js']) assets.set('/premium-assets/'+key+'.'+ext, './'+key+'.'+ext);
}

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(body);
}

async function media(req,res,path) {
  const match = path.match(/^\/recordings\/([a-z-]+)\.(webm|vtt)$/);
  if (!match || !Object.hasOwn(recordings,match[1])) return send(res,404,'Recording not found.');
  const file = await readFile(new URL('.' + path, import.meta.url));
  const type = match[2] === 'webm' ? 'video/webm' : 'text/vtt; charset=utf-8';
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (!range) return send(res,200,file,type);
  const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]),file.length-1) : file.length-1;
  if (start > end) return res.writeHead(416,{'Content-Range':'bytes */'+file.length}).end();
  res.writeHead(206, {'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${file.length}`,'Content-Length':end-start+1});
  res.end(file.subarray(start,end+1));
}

export function createPremiumHandler() {
  const features = new Map(Object.entries(factories).map(([key, create]) => [key, create()]));
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) {
        return send(res, 403, 'Request origin must match the demo.');
      }
      if (req.method === 'GET' && ['/', '/premium', '/premium/'].includes(url.pathname)) {
        res.writeHead(302, {Location: '/premium/queue'}).end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/premium/watch') return send(res,200,watchPage(url));
      if (req.method === 'GET' && url.pathname.startsWith('/recordings/')) return await media(req,res,url.pathname);
      const file = assets.get(url.pathname);
      if (file && req.method === 'GET') return send(res, 200, await readFile(new URL(file, import.meta.url)), mime[file.split('.').pop()]);
      const route = url.pathname.match(/^\/premium\/([a-z]+)(\/.*)?$/);
      const feature = route && features.get(route[1]);
      if (!feature) return send(res, 404, 'Workflow not found.');
      if (route[2] && route[2] !== '/') {
        await feature.handle(req, res, url);
        return;
      }
      if (req.method !== 'GET') return send(res, 405, 'Method not supported.');
      send(res, 200, shell(route[1], await feature.render(url)));
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(res, 500, 'Unable to load this workflow.');
      else res.end();
    }
  };
}

export function createDemo() { return createServer(createPremiumHandler()); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await createDemo();
  const port = Number(process.env.PORT || 4326);
  server.listen(port, '127.0.0.1', () => console.log('Mero workflows at http://127.0.0.1:' + server.address().port + '/premium'));
}
