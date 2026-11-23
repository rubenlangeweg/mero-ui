import { catalogGroupId } from "./catalog.mjs";
import { proStage } from "./pro-stage.mjs";
import { seoHead } from "./seo.mjs";

const escape = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const siteLinks = [
  ['start', '/start', 'Docs'],
  ['components', '/components', 'Components'],
  ['layouts', '/layouts', 'Layouts'],
  ['themes', '/themes', 'Themes'],
  ['playground', '/playground', 'Playground'],
];

export const faviconLinks = `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/mero-mark.svg" type="image/svg+xml" sizes="any">`;

const brand = `<a class="site-brand" href="/" aria-label="Mero UI home">
  <img src="/mero-wordmark.svg" alt="" width="102" height="32">
</a>`;

const footerGroups = [
  ['Documentation', [
    ['/start', 'Quick start'], ['/docs/design-principles', 'Design principles'], ['/docs/responsive-layouts', 'Responsive layouts'], ['/docs/reference', 'Reference'],
    ['/themes', 'Theme studio'], ['/playground', 'Playground'],
  ]],
  ['Components', [
    ['/components', 'All components'], ['/components/form', 'Form'],
    ['/components/modal', 'Modal'], ['/components/data-grid', 'Data grid'],
  ]],
  ['Layouts', [
    ['/layouts', 'Layout gallery'], ['/layouts/dashboard', 'Studio workspace'],
    ['/layouts/mail', 'Mail layout'], ['/layouts/finance', 'Finance layout'],
  ]],
  ['Project', [
    ['/about', 'About Mero UI'], ['/terms', 'Terms of use'],
    ['/license', 'License'], ['/privacy', 'Privacy'],
  ]],
];

export function assetStyles(assets) {
  return assets.filter(name => name.endsWith('.css')).map(name => `<link rel="stylesheet" href="/${escape(name)}">`).join('\n');
}

export function assetScripts(assets) {
  return assets.filter(name => name.endsWith('.js')).map(name => `<script defer src="/${escape(name)}"></script>`).join('\n');
}

export const previewTheme = mode => mode === "brand" || mode === "light" ? mode : "dark";

export function embeddedLayout({title, content, assets, mode, tokens}) {
  const style = tokens ? ' style="' + escape(Object.entries(tokens).map(([name, value]) => name + ':' + value).join(';')) + '"' : '';
  const theme = previewTheme(mode);
  // Regular links and native message forms keep the app-only view with JavaScript disabled.
  const markup = tokens ? content : content.replace(/ (href="\/layouts\/[^"#]+|action="\/demo\/layouts\/(?:mail|chat)\/(?:reply|move|send))"/g, path => {
    if (/[?;]embed=1(?:&|")/.test(path)) return path;
    return path.slice(0, -1) + (path.includes("?") ? "&amp;" : "?") + 'embed=1&amp;theme=' + theme + '"';
  });
  return `<!doctype html><html lang="en" data-theme="${theme === 'dark' ? 'dark' : 'light'}"${theme === 'brand' ? ' data-tenant-preview' : ''}${style}><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="htmx-config" content='{"includeIndicatorCSS":false}'>
    ${faviconLinks}
    <title>${escape(title)} · Mero UI preview</title>
    <meta name="robots" content="noindex">
    ${assetStyles([...new Set(['site-fonts.css','mero.css', ...assets, 'site.css','lab.css', ...(theme === 'brand' ? ['preview.css'] : [])])])}
    ${assetScripts([...new Set(['vendor/htmx.min.js','mero.js', ...assets, ...(!tokens ? ['layout-preview.js'] : [])])])}
  </head><body class="site-body layout-embed" hx-headers:inherited='{"X-Mero-Embed":"1"}'><main id="main" aria-label="${escape(title)} preview">${markup}</main></body></html>`;
}

export function shell({ title = 'Mero UI', description, path = '/', origin, indexable = true, body, nav = 'home', assets = [] }) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${faviconLinks}
  <meta name="theme-color" content="#09090a">
  <script>try { if (localStorage.getItem("mero-theme") === "light") document.documentElement.dataset.theme = "light" } catch {}</script>
  <meta name="htmx-config" content='{"includeIndicatorCSS":false}'>
  ${seoHead({ title, description, path, origin, indexable })}
  <link rel="stylesheet" href="/site-fonts.css">
  ${assetStyles([...new Set(['mero.css', ...assets])])}
  <link rel="stylesheet" href="/site.css">
  ${['components', 'layouts', 'playground'].includes(nav) ? '<link rel="stylesheet" href="/preview.css">' : ''}
  ${['home', 'layouts', 'playground'].includes(nav) ? '<link rel="stylesheet" href="/lab.css">' : ''}
  ${nav === 'home' ? '<link rel="stylesheet" href="/pro-stage.css">' : ''}
  ${assetScripts([...new Set([...(assets.includes('vendor/htmx.min.js') ? ['vendor/htmx.min.js'] : []), 'mero.js', ...assets])])}
  <script src="/site.js" defer></script>
  ${nav === 'home' ? '<script src="/home-motion.js" defer></script>' : '<script src="/site-examples.js" defer></script>'}
</head>
<body class="site-body">
  <a class="site-skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="site-wrap site-nav-frame">
      ${brand}
      <nav class="site-nav" aria-label="Main navigation">
        ${siteLinks.map(([key, href, label]) => `<a href="${href}"${key === nav ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <div class="site-nav-actions">
        <a class="site-icon-action" href="https://github.com/rubenlangeweg/mero-ui" aria-label="Mero UI on GitHub" title="Mero UI on GitHub">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false" viewBox="0 0 16 16"><path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/></svg>
        </a>
        <button class="site-theme site-icon-action" type="button" data-theme-toggle aria-label="Switch to light theme" title="Switch to light theme">
          <span class="theme-glyph" aria-hidden="true">☼</span>
        </button>
        <a class="mero-button mero-button-primary site-cta nav-start" href="/start">Get started</a>
      </div>
    </div>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer">
    <div class="site-wrap site-footer-inner">
      <div class="footer-brand">${brand}<p>The UI kit for HTMX.</p></div>
      <nav aria-label="Footer">
        ${footerGroups.map(([heading, links]) => `<div class="footer-group">
          <h2>${heading}</h2>
          <ul>${links.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
        </div>`).join('')}
      </nav>
    </div>
  </footer>
</body>
</html>`;
}

const featuredComponents = [
  { id: 'line-chart', variant: 'Period picker', title: 'Dispatch report', description: 'Change the reporting period to redraw the chart from a server response.' },
  { id: 'chat-conversation', title: 'Dispatch assistant', description: 'Ask about the same shipment data and inspect the reply in the component docs.' },
];

function homeLayouts(apps) {
  if (!apps.length) return '';
  return `<section class="site-wrap home-apps" id="pro" aria-labelledby="home-layouts-title">
    <header class="showcase-heading"><h2 id="home-layouts-title">Application layouts</h2>
      <a class="site-inline-link" href="/layouts">All layouts <span aria-hidden="true">→</span></a></header>
    <fieldset class="home-app-picker"><legend class="home-app-sr">Choose an application preview</legend>
      <div class="home-app-choices" style="--home-app-count:${apps.length}">${apps.map(({id,name,description}, index) => `
        <input class="home-app-sr" type="radio" name="home-layout" id="home-layout-${id}" aria-controls="home-preview-${id}" ${index === 0 ? 'checked' : ''}>
        <label for="home-layout-${id}">${escape(name)}</label>
        <figure class="home-app-preview" id="home-preview-${id}">
          <a href="/layouts/${id}">
            <span class="home-app-mat"><span class="home-app-shot">${['dark','light'].map(mode => `<picture class="home-app-${mode}">
              <source media="(max-width: 38rem)" srcset="/example-${id}-${mode}-phone.webp" width="780" height="640">
              <img src="/example-${id}-${mode}.webp" width="1620" height="900" loading="lazy" decoding="async" alt="">
            </picture>`).join('')}</span></span>
            <span class="home-app-caption"><span>${escape(description)}</span><strong>Open ${escape(name)} <span aria-hidden="true">↗</span></strong></span>
          </a>
        </figure>`).join('')}</div>
    </fieldset>
  </section>`;
}

export function home({ workbench, componentCount, product, apps = [] }) {
  return `<section class="hero">
    <div class="site-wrap hero-frame">
      <h1><span class="hero-line">The UI kit</span> <span class="hero-line hero-metal">for HTMX.</span></h1>
      <div class="hero-intro">
        <p class="hero-description">Use Mero components with <a class="mero-link" href="/start#go">Go</a>, <a class="mero-link" href="/start#rust">Rust</a>, or any backend that renders HTML. Keyboard controls, loading states and focus handling come built in.</p>
        <div class="hero-actions">
          <a class="mero-button mero-button-primary site-cta" href="/components">Browse components</a>
          <a class="mero-button mero-button-ghost site-cta" href="/playground">Try the playground <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>
    ${proStage({ product })}
  </section>
  ${homeLayouts(apps)}
  <section class="site-wrap showcase home-app-library" aria-labelledby="showcase-title">
    <header class="showcase-heading">
      <h2 id="showcase-title">Explore the library</h2>
      <a class="site-inline-link" href="/components">All ${Number(componentCount) || ''} components <span aria-hidden="true">→</span></a>
    </header>
    <div class="feature-specimens">
      ${featuredComponents.map(({ id, variant, title, description }) => {
        const params = new URLSearchParams();
        if (variant) params.set('variant', variant);
        const docs = '/components/' + id + (variant ? '?' + params : '');
        params.set('embed', '1');
        return `<article>
          <h3><a href="${escape(docs)}">${title} <span aria-hidden="true">↗</span></a></h3>
          <p>${description}</p>
          <iframe loading="lazy" data-live-specimen src="/preview/${id}?${escape(params)}" title="${title} live example"></iframe>
        </article>`;
      }).join('')}
    </div>
  </section>
  <section class="site-wrap home-workbench home-app-workbench" hx-vals:inherited='{"studioShowcase":"1"}' aria-labelledby="workbench-title">
    <div class="home-app-copy">
      <h2 id="workbench-title">Try a real HTMX workflow</h2>
      <p>Search the inventory, open an edit drawer, or add a product.</p>
      <a class="site-inline-link" href="/playground">Open playground <span aria-hidden="true">→</span></a>
    </div>
    ${workbench}
  </section>
  <section class="site-wrap home-start home-app-start" aria-labelledby="home-start-title">
    <div class="home-app-copy">
      <h2 id="home-start-title">Using Mero in your app</h2>
      <a class="site-inline-link" href="/start">Read the quick start <span aria-hidden="true">→</span></a>
    </div>
    <div class="home-questions">
      <details class="mero-disclosure" open>
        <summary>Do I need Node.js or npm?</summary>
        <div class="mero-disclosure-body">No. Serve Mero’s CSS and JavaScript from your app’s static directory. Load HTMX 4 for components that make requests. Node.js runs the downloadable catalog.</div>
      </details>
      <details class="mero-disclosure">
        <summary>What does my server return?</summary>
        <div class="mero-disclosure-body">Return the part of the page that changed as <code>text/html</code>. In the inventory example, Go and Rust both return the product count. HTMX places it beside the button.</div>
      </details>
    </div>
  </section>`;
}

export function catalogLayout({ groups, active, content }) {
  return `<div class="site-wrap catalog-shell">
    <aside class="catalog-sidebar">
      <div class="catalog-tools">
        <label class="catalog-search"><span aria-hidden="true"></span>
          <input type="search" aria-label="Filter components" placeholder="Find a component…" data-catalog-search autocomplete="off">
        </label>
        <label class="catalog-menu-toggle"><input type="checkbox" id="catalog-menu" aria-label="Browse components" aria-controls="catalog-index"><span>Browse</span></label>
      </div>
      <div class="catalog-filter-status"><output class="catalog-result-count" data-catalog-count></output><button type="button" data-catalog-clear hidden>Clear filters</button></div>
      <div class="catalog-result-count" role="status" data-catalog-notice></div>
      <nav id="catalog-index" class="catalog-index" aria-label="Component catalog">
        <div class="catalog-general">
          <div class="catalog-guide-links"><span>Getting started</span>
            <a href="/start"${active === "" ? ' aria-current="page"' : ""}>Quick start</a>
            <a href="/docs/design-principles"${active === "design-principles" ? ' aria-current="page"' : ""}>Design principles</a>
            <a href="/docs/responsive-layouts"${active === "responsive-layouts" ? ' aria-current="page"' : ""}>Responsive layouts</a>
            <a href="/docs/reference"${active === "reference" ? ' aria-current="page"' : ""}>Reference</a>
          </div>
          <div class="catalog-guide-links"><span>Explore</span>
            <a href="/components"${active === undefined ? ' aria-current="page"' : ""}>All components</a>
            <a href="/themes">Theme studio</a><a href="/layouts">Layouts</a><a href="/playground">Playground</a>
          </div>
        </div>
        ${groups.map(({ name, items }) => `<section class="catalog-nav-group" data-catalog-group="${catalogGroupId(name)}">
          <h2>${escape(name)}</h2>
          ${items.map(({ id, name: itemName, description }) => `<a href="/components/${escape(id)}" data-catalog-link data-search-text="${escape([itemName, id, name, description].join(' '))}"${id === active ? ' aria-current="page"' : ''}>${escape(itemName)}</a>`).join('')}
        </section>`).join('')}
      </nav>
    </aside>
    <div id="catalog-content" class="catalog-content">${content}</div>
  </div>`;
}
