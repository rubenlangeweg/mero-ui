import {createServer} from 'node:http';
import {readFile, access} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {styleCache} from './styles.mjs';
import {escapeHtml as esc} from '../../site/html.mjs';

const labels = {mero:'Mero UI', daisyui:'daisyUI', heroui:'HeroUI CSS'};
const publicFiles = {
  '/assets/htmx.js':new URL('../../public/vendor/htmx.min.js',import.meta.url),
  '/assets/mero.css':new URL('../../ui/mero.css',import.meta.url),
  '/assets/mero.js':new URL('../../ui/mero.js',import.meta.url),
  '/assets/mero-forms.js':new URL('../../ui/mero-forms.js',import.meta.url),
  '/assets/baseline.js':new URL('./baseline.js',import.meta.url),
  '/assets/comparison.css':new URL('./comparison.css',import.meta.url),
  '/assets/daisyui.css':join(styleCache,'daisyui.css'),
  '/assets/heroui.css':join(styleCache,'heroui.css'),
};
const button = 'mero-button btn button';
const primary = button+' mero-button-primary btn-primary button--primary';
const input = 'mero-input input';
function record(item,oob=false) {
  return `<article id="record"${oob?' hx-swap-oob="outerHTML"':''}><div><h2>${esc(item.name)}</h2><p>${esc(item.sku)}</p></div><button id="edit-record" class="${primary}" type="button" commandfor="edit-dialog" command="show-modal" hx-get="/record/edit" hx-target="#editor" hx-sync="this:replace">Edit record</button></article>`;
}
function form(item, error = '') {
  return `<form data-mero-form data-mero-return-focus="#edit-record" hx-post="/record" hx-target="this" hx-swap="outerHTML" hx-sync="this:drop" hx-disable="find button[type=submit]">
    <label>Name<input id="item-name" class="${input}" name="name" value="${esc(item.name)}" required maxlength="60" autofocus></label>
    <label>SKU<input id="item-sku" class="${input}" name="sku" value="${esc(item.sku)}" required maxlength="24"${error?' aria-invalid="true" aria-describedby="sku-error"':''}></label>
    ${error?`<p id="sku-error" class="compare-field-error">${esc(error)}</p>`:''}
    <label>Simulated response<select name="fault" class="mero-select select"><option value="normal">Normal</option><option value="503">Service unavailable</option></select></label>
    <p role="alert" data-mero-form-error hidden></p><footer><button type="button" class="${button}" commandfor="edit-dialog" command="close">Cancel</button><button type="submit" class="${primary}">Save</button></footer>
  </form>`;
}
async function page(item, style) {
  const available = await access(publicFiles['/assets/'+style+'.css']).then(()=>true,()=>false);
  const script = asset => `<script defer src="/assets/${asset}.js"></script>`;
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${labels[style]} · Edit comparison</title>
    ${available?`<link rel="stylesheet" href="/assets/${style}.css">`:''}<link rel="stylesheet" href="/assets/comparison.css">${script('htmx')}${style==='mero'?script('mero')+script('mero-forms'):script('baseline')}</head>
    <body><main><nav aria-label="Compared libraries">${Object.entries(labels).map(([id,name])=>`<a href="/${id}"${style===id?' aria-current="page"':''}>${name}</a>`).join('')}</nav><h1>Record editor</h1>
    ${available?'':`<p role="status">Optional ${labels[style]} stylesheet unavailable. Run <code>node examples/edit-comparison/styles.mjs</code> to enable the visual comparison.</p>`}
    ${record(item)}<p>Use <code>TAKEN</code> as the SKU to trigger duplicate validation.</p>
    <dialog id="edit-dialog" aria-labelledby="edit-title"><h2 id="edit-title">Edit product</h2><div id="editor"></div></dialog></main></body></html>`;
}
function send(res,status,body,type='text/html; charset=utf-8',headers={}) {
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
export function comparisonApp() {
  const items = new Map();
  return createServer(async(req,res)=>{
    try {
      const {pathname} = new URL(req.url,'http://localhost');
      if (Object.hasOwn(publicFiles,pathname) && req.method === 'GET') {
        const data = await readFile(publicFiles[pathname]).catch(()=>null);
        return send(res,data?200:404,data??'Asset unavailable.',pathname.endsWith('.css')?'text/css':'text/javascript');
      }
      const cookie = req.headers.cookie?.split('; ').find(value=>value.startsWith('mero_compare='))?.slice('mero_compare='.length);
      let id = items.has(cookie) ? cookie : null;
      if (!id) {
        id = randomUUID();
        items.set(id,{name:'Arc Task Lamp',sku:'SL-204'});
        res.setHeader('Set-Cookie',`mero_compare=${id}; HttpOnly; SameSite=Strict; Path=/`);
      }
      const item = items.get(id);
      const style = pathname.slice(1) || 'mero';
      if (req.method==='GET' && Object.hasOwn(labels,style)) return send(res,200,await page(item,style));
      if (req.method==='GET' && pathname==='/record/edit') return send(res,200,form(item));
      if (req.method==='POST' && pathname==='/record') {
        let body='';
        for await (const chunk of req) {
          body+=chunk.toString();
          if (Buffer.byteLength(body)>8192) return send(res,413,'Submission too large.','text/plain');
        }
        const fields = new URLSearchParams(body);
        const draft = {name:(fields.get('name')??'').trim(),sku:(fields.get('sku')??'').trim()};
        await delay(250);
        if (fields.get('fault')==='503') return send(res,503,'Service unavailable.','text/plain');
        if (!draft.name || !draft.sku || draft.name.length>60 || draft.sku.length>24) return send(res,400,'Invalid submission.','text/plain');
        if (draft.sku.toUpperCase()==='TAKEN') return send(res,422,form(draft,'Another product already uses this SKU.'));
        items.set(id,draft);
        return send(res,200,record(draft,true),'text/html; charset=utf-8',{'HX-Reswap':'none','HX-Trigger':JSON.stringify({'mero:form-saved':{message:'Record saved'}})});
      }
      send(res,404,'Not found.','text/plain');
    } catch { if (!res.headersSent) send(res,500,'Comparison server error.','text/plain'); else res.end(); }
  });
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT??4184);
  comparisonApp().listen(port,'127.0.0.1',()=>console.log(`Edit comparison: http://127.0.0.1:${port}/`));
}
