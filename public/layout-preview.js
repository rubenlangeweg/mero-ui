// Keep a standalone layout in its chosen appearance across fragment and document navigation.
(() => {
  const theme = document.documentElement.hasAttribute("data-tenant-preview")
    ? "brand" : document.documentElement.dataset.theme;

  function previewPath(path) {
    const url = new URL(path, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/layouts/")) return path;
    url.searchParams.set("embed", "1");
    url.searchParams.set("theme", theme);
    return url.pathname + url.search + url.hash;
  }

  document.addEventListener("htmx:before:history:update", event => {
    const entry = event.detail.history;
    entry.path = previewPath(entry.path);
  });
  document.addEventListener("htmx:after:process", event => {
    for (const link of event.target.querySelectorAll('a[href^="/layouts/"]')) {
      link.setAttribute("href", previewPath(link.href));
    }
  });
})();
