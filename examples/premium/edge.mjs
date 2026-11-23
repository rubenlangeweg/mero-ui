import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { factories, shell, watchPage } from './workflows.mjs';

const workspaceRoute = /^\/premium\/w\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/([a-z]+)(\/.*)?$/;
const entryRoute = /^\/premium(?:\/([a-z]+))?\/?$/;
const publicHeaders = {'Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'};

function page(body) {
  return new Response(body,{headers:{...publicHeaders,'Content-Type':'text/html; charset=utf-8'}});
}

function roomLinks(html, prefix) {
  return html.replace(/\b(href|hx-get|hx-post|action|data-sv-copy|data-board-events)="\/premium(?=[/?"])/g, '$1="'+prefix);
}

export function handlePremium(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (request.method === 'POST' && origin && origin !== url.origin) return new Response('Origin mismatch.',{status:403});
  const match = url.pathname.match(workspaceRoute);
  if (match && Object.hasOwn(factories,match[2])) return env.PREMIUM_WORKSPACE.getByName(match[1]).fetch(request);
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Invalid demo action.',{status:405});
  if (url.pathname === '/premium/watch') return page(watchPage(url));
  if (match && match[2] === 'watch' && !match[3]) return page(roomLinks(watchPage(url),'/premium/w/'+match[1]));
  const entry = url.pathname.match(entryRoute);
  if (!entry || entry[1] && !Object.hasOwn(factories,entry[1])) return new Response('Workflow not found.',{status:404});
  url.pathname = '/premium/w/'+crypto.randomUUID()+'/'+(entry[1] || 'queue');
  return new Response(null,{status:302,headers:{...publicHeaders,Location:url.href}});
}

async function readBody(request) {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {value,done} = await reader.read();
      if (done) return Buffer.concat(chunks,length);
      length += value.byteLength;
      if (length > 65536) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
}

// Feature modules use the same response methods as the standalone Node example.
function reply(prefix) {
  const headers = new Headers(publicHeaders);
  let status = 200, body = null, controller, onClose;
  const encoder = new TextEncoder();
  return {
    writeHead(code, fields = {}) {
      status = code;
      for (const [name,value] of Object.entries(fields)) {
        const link = ['location','hx-replace-url','hx-push-url'].includes(name.toLowerCase());
        headers.set(name,link ? value.replace(/^\/premium(?=[/?]|$)/,prefix) : value);
      }
      return this;
    },
    end(html) { body = html == null ? null : roomLinks(html,prefix); },
    write(text) {
      if (!controller) body = new ReadableStream({
        start(c) { controller = c; },
        cancel() { onClose?.(); }
      });
      controller.enqueue(encoder.encode(text));
    },
    on(event, listener) { if (event === 'close') onClose = listener; },
    response() { return new Response(body,{status,headers}); }
  };
}

export class PremiumWorkspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx,env);
    this.features = new Map();
    this.pending = Promise.resolve();
    this.sql = ctx.storage.sql;
    this.schemaReady = false;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const [,room,name,action] = url.pathname.match(workspaceRoute);
    const bytes = await readBody(request);
    if (!bytes) return new Response('Form too large.',{status:413});
    const prefix = '/premium/w/'+room;
    url.pathname = '/premium/'+name+(action || '');
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    const req = {
      method, url:url.pathname+url.search, headers:Object.fromEntries(request.headers),
      async *[Symbol.asyncIterator]() { if (bytes.length) yield bytes; }
    };
    // Drain the body before entering the queue. Only local rendering and storage are serialized.
    const result = this.pending.then(async () => {
      if (!this.features.has(name)) {
        if (!this.schemaReady) this.schemaReady = this.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'features'").toArray().length > 0;
        const row = this.schemaReady ? this.sql.exec('SELECT state FROM features WHERE name = ?',name).toArray()[0] : null;
        this.features.set(name,factories[name](row ? JSON.parse(row.state) : undefined));
      }
      const feature = this.features.get(name);
      const res = reply(prefix);
      const isPage = !action || action === '/';
      if (isPage && method !== 'GET') return new Response('Use GET.',{status:405});
      if (isPage) {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
        res.end(shell(name,feature.render(url)));
      } else {
        await feature.handle(req,res,url);
      }
      if (method === 'POST' || name === 'bulk' && isPage) {
        try {
          if (!this.schemaReady) {
            this.sql.exec('CREATE TABLE IF NOT EXISTS features (name TEXT PRIMARY KEY, state TEXT NOT NULL)');
            this.schemaReady = true;
          }
          this.sql.exec('INSERT OR REPLACE INTO features VALUES (?,?)',name,JSON.stringify(feature.snapshot()));
          const expires = Date.now()+7*86400000;
          const scheduled = await this.ctx.storage.getAlarm();
          if (!scheduled || scheduled < expires-86400000) await this.ctx.storage.setAlarm(expires);
        } catch (error) {
          this.features.delete(name);
          throw error;
        }
      }
      return res.response();
    });
    this.pending = result.then(()=>{},()=>{});
    return result;
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this.features.clear();
    this.schemaReady = false;
  }
}
