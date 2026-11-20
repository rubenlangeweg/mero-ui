(() => {
  const nav = document.querySelector(".catalog-index");
  const content = document.querySelector("#catalog-content");
  if (!nav || !content) return;

  const shell = content.closest(".catalog-shell");
  const header = document.querySelector(".site-header");
  function fitHeader() { shell.style.setProperty("--catalog-header-height", header.offsetHeight + "px"); }
  fitHeader();
  new ResizeObserver(fitHeader).observe(header);

  const search = document.querySelector("[data-catalog-search]");
  const menu = document.getElementById("catalog-menu");
  const count = document.querySelector("[data-catalog-count]");
  const clear = document.querySelector("[data-catalog-clear]");
  const notice = document.querySelector("[data-catalog-notice]");
  const general = nav.querySelector(".catalog-general");
  const items = [...nav.querySelectorAll("[data-catalog-link]")];
  const groups = [...nav.querySelectorAll("[data-catalog-group]")];
  const normalize = value => value.toLowerCase().replace(/[-_]/g, " ");
  const isCatalog = path => /^\/components(?:\/[a-z0-9-]+)?$/.test(path);
  const params = new URLSearchParams(location.search);
  const newVisit = () => ({ id: crypto.randomUUID?.() || String(performance.timeOrigin + performance.now()) });
  let visit = history.state?.relayCatalog || newVisit();
  let family = params.get("family") ?? visit.family ?? "";
  search.value = params.get("q") ?? visit.query ?? "";
  let firstResult;
  let picker;
  let cards;
  let categories;
  let currentPath = location.pathname;
  let pending;
  const positions = new Map();

  function bindContent() {
    picker = content.querySelector("[data-catalog-family]");
    if (picker) {
      picker.value = family;
      if (picker.selectedIndex < 0) { picker.value = ""; family = ""; }
    }
    cards = new Map([...content.querySelectorAll(".catalog-card")].map(card => [card.pathname, card]));
    categories = [...content.querySelectorAll(".catalog-category")];
  }

  function filter() {
    const query = search.value.trim();
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const filtered = Boolean(query || family);
    let matches = 0;
    firstResult = null;
    for (const item of items) {
      const matchesFamily = !family || item.parentElement.dataset.catalogGroup === family;
      item.hidden = !matchesFamily || !words.every(word => normalize(item.dataset.searchText).includes(word));
      const card = cards.get(item.pathname);
      if (card) card.hidden = item.hidden;
      if (!item.hidden) {
        firstResult ??= card || item;
        matches++;
      }
    }
    for (const group of [...groups, ...categories]) {
      group.hidden = !group.querySelector("[data-catalog-link]:not([hidden]), .catalog-card:not([hidden])");
    }
    general.hidden = Boolean(query);
    const featured = content.querySelector("[data-catalog-featured]");
    if (featured) featured.hidden = filtered;
    const empty = content.querySelector("[data-catalog-empty]");
    if (empty) empty.hidden = matches !== 0;
    count.textContent = filtered ? `${matches} matching component${matches === 1 ? "" : "s"}` : "";
    clear.hidden = !filtered;
  }

  function storeReadingState() {
    visit.tab = content.querySelector(".doc-tab-list [aria-selected=true]")?.id;
    visit.theme = content.querySelector("[data-preview-theme]")?.value;
    visit.install = content.querySelector(".component-install")?.open;
  }

  function restoreReadingState(saved) {
    if (saved?.tab) document.getElementById(saved.tab)?.click();
    const theme = content.querySelector("[data-preview-theme]");
    if (theme && saved?.theme) {
      theme.value = saved.theme;
      theme.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const installation = content.querySelector(".component-install");
    if (installation && saved?.install) installation.open = true;
  }

  function snapshot() {
    return { ...visit, query: search.value, family, y: scrollY, navTop: nav.scrollTop, open: menu.checked };
  }

  function remember() {
    positions.set(visit.id, snapshot());
  }

  function persist(url = location.href) {
    storeReadingState();
    remember();
    history.replaceState({ ...history.state, relayCatalog: positions.get(visit.id) }, "", url);
  }

  function updateFilters() {
    filter();
    const url = new URL(location.href);
    for (const [key, value] of [["q", search.value.trim()], ["family", family]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    persist(url);
  }

  search.addEventListener("input", () => {
    if (!picker && search.value.trim()) menu.checked = true;
    updateFilters();
  });
  content.addEventListener("change", event => {
    if (picker && event.target === picker) { family = picker.value; updateFilters(); }
  });
  clear.addEventListener("click", () => {
    search.value = "";
    family = "";
    if (picker) picker.value = "";
    updateFilters();
    search.focus();
  });
  search.addEventListener("keydown", event => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      search.value = "";
      menu.checked = false;
      updateFilters();
    } else if (firstResult && (event.key === "ArrowDown" || (event.key === "Enter" && search.value.trim()))) {
      event.preventDefault();
      if (event.key === "Enter") firstResult.click();
      else {
        if (!picker) menu.checked = true;
        firstResult.focus();
      }
    }
  });

  function markCurrent(reveal) {
    const current = [...nav.querySelectorAll('a[href]')].find(link => link.pathname === location.pathname);
    nav.querySelector('[aria-current="page"]')?.removeAttribute("aria-current");
    if (!current) return;
    current.setAttribute("aria-current", "page");
    if (!reveal || !nav.clientHeight || !current.getClientRects().length) return;
    const rect = current.getBoundingClientRect();
    const viewport = nav.getBoundingClientRect();
    if (reveal === "center" && (rect.bottom > viewport.bottom || rect.top < viewport.top)) {
      nav.scrollTop += (rect.top + rect.bottom - viewport.top - viewport.bottom) / 2;
    } else if (rect.bottom > viewport.bottom) nav.scrollTop += rect.bottom - viewport.bottom;
    else if (rect.top < viewport.top) nav.scrollTop += rect.top - viewport.top;
  }

  bindContent();
  restoreReadingState(visit);
  filter();
  menu.checked = visit.open ?? (!picker && Boolean(search.value));
  markCurrent(visit.navTop == null && "center");
  if (visit.navTop != null) nav.scrollTop = visit.navTop;
  if (params.has("search")) { search.focus(); search.select(); }

  if (!isCatalog(currentPath) || !window.htmx) return;
  if (visit.y != null && !location.hash) window.scrollTo(0, visit.y);
  history.scrollRestoration = "manual";
  persist();
  addEventListener("scroll", remember, { passive: true });
  nav.addEventListener("scroll", remember, { passive: true });
  menu.addEventListener("change", () => {
    if (menu.checked) markCurrent(true);
    remember();
  });
  for (const eventName of ["click", "change", "toggle"]) {
    content.addEventListener(eventName, event => {
      if (event.target.closest(".doc-tab-list, [data-preview-theme], .component-install")) {
        queueMicrotask(() => { storeReadingState(); remember(); });
      }
    }, true);
  }
  addEventListener("pagehide", () => { if (currentPath === location.pathname) persist(); });

  // A browsing session loads each optional component asset on its first visit.
  const assets = new Map([...document.querySelectorAll('head link[rel="stylesheet"], head script[src]')]
    .map(el => [new URL(el.href || el.src).pathname.slice(1), Promise.resolve()]));
  function loadAsset(name) {
    if (assets.has(name)) return assets.get(name);
    if (!/^mero-[a-z-]+\.(?:js|css)$/.test(name)) throw new Error("Unknown catalog asset");
    const css = name.endsWith(".css");
    const tag = document.createElement(css ? "link" : "script");
    if (css) { tag.rel = "stylesheet"; tag.href = "/" + name; }
    else tag.src = "/" + name;
    const ready = new Promise((resolve, reject) => {
      tag.onload = resolve;
      tag.onerror = () => { tag.remove(); assets.delete(name); reject(new Error("Could not load " + name)); };
    });
    assets.set(name, ready);
    document.head.insertBefore(tag, css ? document.querySelector('link[href="/site.css"]') : null);
    return ready;
  }

  function focusDestination(saved, variant, anchor) {
    const source = saved?.focus;
    const previous = source && [...document.querySelectorAll(source.inNav ? ".catalog-index a" : "#catalog-content a")]
      .find(link => link.getAttribute("href") === source.href && link.getClientRects().length);
    const destination = previous || (variant && content.querySelector('.doc-variants [aria-current="page"]')) || anchor?.querySelector?.("h2") || content.querySelector("h1");
    if (destination?.matches("h1, h2")) destination.tabIndex = -1;
    destination?.focus({ preventScroll: true });
  }

  function updatePageMetadata() {
    const template = content.querySelector(":scope > template[data-catalog-head]");
    if (!template) return;
    const tags = template.content.querySelectorAll(
      ":is(meta[name], meta[property], link[rel=canonical], script[type='application/ld+json']:not([src]))[data-page-meta]"
    );
    document.head.querySelectorAll("[data-page-meta]:not(title)").forEach(tag => tag.remove());
    document.head.append(...tags);
    template.remove();
  }

  async function navigate(url, saved, variant = false) {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    content.setAttribute("aria-busy", "true");
    notice.textContent = "";
    try {
      const response = await fetch(url, { signal: request.signal, headers: { "HX-Request": "true", "HX-Target": "catalog-content" } });
      if (!response.ok || !response.headers.has("X-Relay-Assets")) throw new Error("Catalog unavailable");
      const [html] = await Promise.all([response.text(), ...response.headers.get("X-Relay-Assets").split(",").filter(Boolean).map(loadAsset)]);
      if (request.signal.aborted) return;
      const previousY = scrollY;
      const previousNavTop = nav.scrollTop;
      let readingState = saved;
      if (!saved) {
        persist();
        if (variant) readingState = visit;
        visit = newVisit();
        history.pushState({ relayCatalog: visit }, "", url);
      } else {
        visit = saved;
        search.value = saved.query || "";
        family = saved.family || "";
      }
      currentPath = url.pathname;
      window.htmx.swap(content, html, { swapStyle: "innerHTML", swapDelay: 0, settleDelay: 0 });
      updatePageMetadata();
      document.dispatchEvent(new Event("relay:site-theme"));
      bindContent();
      restoreReadingState(readingState);
      filter();
      menu.checked = saved?.open ?? false;
      nav.scrollTop = saved?.navTop ?? previousNavTop;
      markCurrent(!saved);
      const anchor = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (saved) window.scrollTo(0, saved.y || 0);
      else if (anchor) anchor.scrollIntoView({ block: "start" });
      else window.scrollTo(0, variant ? previousY : 0);
      focusDestination(saved, variant, saved ? null : anchor);
      persist();
    } catch (error) {
      if (request.signal.aborted) return;
      if (saved) location.reload();
      else notice.textContent = "Couldn’t open that page. Select the link to try again.";
    } finally {
      if (pending === request) { pending = null; content.removeAttribute("aria-busy"); }
    }
  }

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.closest("[data-sample-scope]")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !isCatalog(url.pathname)) return;
    if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    if (url.href === location.href && !pending) return;
    visit.focus = { href: link.getAttribute("href"), inNav: nav.contains(link) };
    navigate(url, null, Boolean(link.closest(".doc-variants")));
  });
  addEventListener("hashchange", () => {
    if (!history.state?.relayCatalog && currentPath === location.pathname) { visit = newVisit(); persist(); }
  });
  addEventListener("popstate", event => {
    const saved = event.state?.relayCatalog;
    if (!saved) return;
    navigate(new URL(location.href), positions.get(saved.id) || saved);
  });
})();
