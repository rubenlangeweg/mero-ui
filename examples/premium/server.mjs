import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const workflows = {
  queue: ['Review queue', 'Approve three price changes in succession, undo the last one, then continue with the keyboard. On a phone, open a row to inspect the change.'],
  paste: ['Spreadsheet review', 'Load the sample price sheet, review the changes, correct the two invalid cells and commit the batch.'],
  command: ['Command menu', 'Select six records. Press ⌘K or Ctrl+K, choose Assign, go back with Backspace, then choose a teammate and press Enter.'],
  bulk: ['Bulk actions', 'Select the page, extend the selection to all matches, then exclude a record on each of two pages. Preview, apply and retry the three failures.'],
  views: ['Saved views', 'Open Low stock, change the filters, sort or visible columns. Save a copy and open its share link in a second browser. Try resetting a change.'],
  board: ['Planning board', 'Open this page in two windows. Move a card in one and watch the other update. Use the move control to do the same thing with the keyboard.']
};
const mime = {css: 'text/css', js: 'text/javascript', woff2: 'font/woff2', svg: 'image/svg+xml', ico: 'image/x-icon'};
const assets = new Map([
  ['/mero-wordmark.svg', '../../public/mero-wordmark.svg'], ['/favicon.ico', '../../public/favicon.ico'],
  ['/mero.css', '../../ui/mero.css'], ['/mero.js', '../../ui/mero.js'],
  ['/vendor/htmx.min.js', '../../public/vendor/htmx.min.js'],
  ['/fonts/geist.woff2', '../../public/fonts/geist.woff2'],
  ['/premium-assets/shell.css', './shell.css']
]);

function optionalAsset(key, extension) {
  const filename = './' + key + '.' + extension;
  if (!existsSync(new URL(filename, import.meta.url))) return '';
  const path = '/premium-assets/' + key + '.' + extension;
  assets.set(path, filename);
  return extension === 'js' ? '<script defer src="' + path + '"></script>' : '<link rel="stylesheet" href="' + path + '">';
}

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(body);
}

function shell(key, body) {
  const [title, instructions] = workflows[key] || ['Recorded walkthroughs', ''];
  const nav = Object.entries(workflows).map(([id,[name]]) =>
    '<a href="/premium/' + id + '"' + (id === key ? ' aria-current="page"' : '') + '>' + name + '</a>'
  ).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · Mero UI</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/mero.css">
    <link rel="stylesheet" href="/premium-assets/shell.css">${optionalAsset(key, 'css')}
    <script defer src="/vendor/htmx.min.js"></script><script defer src="/mero.js"></script>${optionalAsset(key, 'js')}
    </head><body><a class="pw-skip" href="#workflow">Skip to workflow</a><header class="pw-header"><div class="pw-header-inner">
    <a class="pw-brand" href="/premium"><img src="/mero-wordmark.svg" alt="Mero UI" width="102" height="32"></a>
    <span class="pw-header-title">Workflow demos</span>
    <div class="pw-tools"><a href="/premium/watch" ${key === 'watch' ? 'aria-current="page"' : ''}>Watch demos</a>
    ${instructions ? '<details class="pw-guide"><summary>Try this workflow</summary><p>' + instructions + '</p></details>' : ''}</div></div>
    <nav class="pw-nav" aria-label="Workflow demos">${nav}</nav></header>
    <main id="workflow" class="pw-main">${body}</main></body></html>`;
}

const recordings = {...Object.fromEntries(Object.entries(workflows).map(([key, [name]]) => [key, name])), 'queue-mobile': 'Review queue on mobile'};

function watchPage(url) {
  const requested = url.searchParams.get('demo');
  const key = Object.hasOwn(recordings, requested) ? requested : 'queue';
  const liveKey = key === 'queue-mobile' ? 'queue' : key;
  const choices = Object.entries(recordings).map(([id,name]) =>
    '<a href="/premium/watch?demo=' + id + '"' + (key === id ? ' aria-current="page"' : '') + '>' + name + '</a>').join('');
  return shell('watch', `<header class="pw-watch-head"><h1>Recorded walkthroughs</h1><a class="mero-button" href="/premium/${liveKey}">Try ${workflows[liveKey][0].toLowerCase()} ↗</a></header>
    <section class="pw-watch"><div><h2>${recordings[key]}</h2>
    <video aria-label="${recordings[key]} walkthrough" controls playsinline preload="auto" src="/recordings/${key}.webm#t=0.2">
    <track kind="captions" srclang="en" label="English" src="/recordings/${key}.vtt" default></video></div>
    <nav aria-label="Choose a recording">${choices}</nav></section>`);
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

export async function createDemo() {
  const features = new Map();
  for (const key of Object.keys(workflows)) {
    const { createFeature } = await import('./' + key + '.mjs');
    features.set(key, createFeature());
    optionalAsset(key, 'css');
    optionalAsset(key, 'js');
  }
  return createServer(async (req, res) => {
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
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await createDemo();
  const port = Number(process.env.PORT || 4326);
  server.listen(port, '127.0.0.1', () => console.log('Mero workflows at http://127.0.0.1:' + server.address().port + '/premium'));
}
