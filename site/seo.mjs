import { escapeHtml } from "./html.mjs";

const productDescription = "Mero UI is a UI kit for htmx. Copy HTML components into your server templates with loading states, keyboard controls and focus handling built in.";

const descriptions = new Map([
  ["/", productDescription],
  ["/start", "Use Mero UI with Go, Rust or any HTML backend. Run a Go net/http or Rust Axum example and inspect the HTML fragment returned to HTMX 4."],
  ["/docs/design-principles", "See how Mero UI handles keyboard focus, motion, theming and server responses in htmx interfaces."],
  ["/docs/responsive-layouts", "Resize a working company directory and see how Mero UI handles list and detail views, selection and Back in a narrow container."],
  ["/docs/reference", "Look up the events Mero UI sends and acts on, the window.MeroUI functions and every data-mero attribute."],
  ["/components", "Browse Mero UI components, try the working examples and copy their HTML and required assets into your server templates."],
  ["/layouts", "Explore complete htmx application layouts for a team workspace, inbox, chat, CRM, finance and settings."],
  ["/themes", "Try colors, typography and corner radii on Mero UI components and layouts, then export your theme as CSS."],
  ["/playground", "Try an inventory edit, a failed form submission or a chart filter and inspect the HTML returned by the server."],
]);

export function siteOrigin(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new TypeError("Use a site origin such as https://example.com without a path, credentials, query or fragment.");
  }
  return url.origin;
}

function pageSchema(path, origin, title, description) {
  const root = (origin || "") + "/";
  const url = (origin || "") + path;
  const site = { "@id": root + "#website" };
  const kit = { "@id": root + "#kit" };
  const isHome = path === "/";
  const graph = [];
  if (isHome) {
    graph.push(
      { "@type": "WebSite", ...site, name: "Mero UI", url: root, inLanguage: "en" },
      { "@type": "SoftwareSourceCode", ...kit, name: "Mero UI", url: root, description: productDescription, programmingLanguage: ["HTML", "CSS", "JavaScript"] },
    );
  }
  const type = path === "/about" ? "AboutPage" :
    ["/components", "/layouts"].includes(path) ? "CollectionPage" : "WebPage";
  const page = { "@type": type, "@id": url + "#page", url, name: title, description, isPartOf: site, about: kit, inLanguage: "en" };
  graph.push(page);
  if (isHome) {
    page.mainEntity = kit;
  } else {
    const crumbs = [["Mero UI", root]];
    if (path.startsWith("/components/")) crumbs.push(["Components", (origin || "") + "/components"]);
    if (path.startsWith("/layouts/")) crumbs.push(["Application layouts", (origin || "") + "/layouts"]);
    crumbs.push([title, url]);
    page.breadcrumb = { "@id": url + "#breadcrumbs" };
    graph.push({ "@type": "BreadcrumbList", ...page.breadcrumb, itemListElement: crumbs.map(([name, item], i) => ({
      "@type": "ListItem", position: i + 1, name, item,
    })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

// Call with the clean route path. Filters and preview state belong to the UI URL.
export function seoHead({ path = "/", origin, title = "Mero UI", description, indexable = true }) {
  const pageTitle = title === "Mero UI" ? "Mero UI · Components for HTMX" : title + " · Mero UI";
  const summary = description || descriptions.get(path) || productDescription;
  const basic = `<title>${escapeHtml(pageTitle)}</title>
    <meta data-page-meta name="description" content="${escapeHtml(summary)}">`;
  if (!indexable) return basic + '\n    <meta data-page-meta name="robots" content="noindex, follow">';
  const canonical = (origin || "") + path;
  const json = JSON.stringify(pageSchema(path, origin, title, summary)).replace(/</g, "\\u003c");
  return `${basic}
    <link data-page-meta rel="describedby" href="/llms.txt">
    ${path.startsWith("/components/") ? `<link data-page-meta rel="alternate" type="text/markdown" href="${escapeHtml(canonical)}.md">` : ""}
    <link data-page-meta rel="canonical" href="${escapeHtml(canonical)}">
    <meta data-page-meta property="og:type" content="website">
    <meta data-page-meta property="og:site_name" content="Mero UI">
    <meta data-page-meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta data-page-meta property="og:description" content="${escapeHtml(summary)}">
    ${origin ? `<meta data-page-meta property="og:url" content="${escapeHtml(canonical)}">` : ""}
    <script data-page-meta type="application/ld+json">${json}</script>`;
}

export function sitemapXml(paths, origin) {
  const base = siteOrigin(origin);
  if (!base) throw new TypeError("An absolute origin is required to build a sitemap.");
  const urls = Array.from(new Set(paths), path => `  <url><loc>${escapeHtml(base + path)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>\n`;
}

export function robotsTxt(origin) {
  const base = siteOrigin(origin);
  return "User-agent: *\nAllow: /\n" + (base ? "\nSitemap: " + base + "/sitemap.xml\n" : "");
}
