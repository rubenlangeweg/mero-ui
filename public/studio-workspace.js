// A fragment navigation should give keyboard users a useful place to continue.
(() => {
  // HTMX reloads Studio records from the server on Back. Remember the reading
  // position separately so a fresh count and the original task can appear together.
  const storageKey = "mero-studio-return-links";
  let returnLinks = new Map();
  try { returnLinks = new Map(JSON.parse(sessionStorage.getItem(storageKey))); } catch {}
  // Standalone previews can add their default theme to the URL after rendering.
  function destination(path) {
    const url = new URL(path, location.href);
    url.searchParams.delete("theme");
    url.searchParams.sort();
    return url.pathname + url.search;
  }
  document.addEventListener("htmx:before:request", event => {
    const link = event.detail.ctx.sourceElement;
    if (link?.matches("a[hx-get]") && link.closest("#studio-workspace")) {
      const page = destination(location.href);
      returnLinks.delete(page);
      returnLinks.set(page, { url: destination(link.href), top: link.getBoundingClientRect().top });
      if (returnLinks.size > 64) returnLinks.delete(returnLinks.keys().next().value);
      try { sessionStorage.setItem(storageKey, JSON.stringify([...returnLinks])); } catch {}
    }
  });
  function restored() {
    const saved = returnLinks.get(destination(location.href));
    if (!saved?.url) return;
    const link = Array.from(document.querySelectorAll("#studio-workspace a[hx-get]"))
      .find(link => destination(link.href) === saved.url && link.getClientRects().length);
    if (!link) return;
    link.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (document.activeElement !== link) return;
      const rect = link.getBoundingClientRect();
      const top = (document.querySelector(".site-header")?.getBoundingClientRect().bottom || 0) + 12;
      const offset = Math.max(top, Math.min(saved.top, innerHeight - rect.height - 12));
      window.scrollBy({ top: rect.top - offset, behavior: "instant" });
    });
  }
  // htmx 4 restores history inside a Navigation API transition; the browser resets focus when it ends.
  document.addEventListener("htmx:after:swap", event => {
    if (event.detail.ctx.request?.headers?.["HX-History-Restore-Request"]) (window.navigation?.transition?.finished ?? Promise.resolve()).then(restored, restored);
  });
  document.addEventListener("htmx:after:settle", event => {
    if (event.detail.task.target?.id !== "studio-workspace") return;
    const workspace = document.getElementById("studio-workspace");
    const heading = workspace?.querySelector(".mero-app-main h1");
    if (!heading) return;
    const suffix = document.body.classList.contains("layout-embed") ? "Mero UI preview" : "Mero UI";
    document.title = heading.textContent.trim() + " · Studio · " + suffix;
    // task.sourceElement stays the original source; ctx.sourceElement moves to the new workspace.
    if (event.detail.task.sourceElement?.hasAttribute?.("data-studio-auto-display")) return;
    const focus = workspace.querySelector('[aria-invalid="true"]') || workspace.querySelector('[role="alert"]:not([hidden])') || workspace.querySelector("[data-studio-initial-focus]") || heading;
    if (!focus.hasAttribute("tabindex") && !focus.matches("input,textarea,select,button,a[href]")) focus.tabIndex = -1;
    focus.focus({ preventScroll: true });
    const bounds = focus.getBoundingClientRect();
    const top = (document.querySelector(".site-header")?.getBoundingClientRect().bottom || 0) + 12;
    if (bounds.top < top || bounds.bottom > window.innerHeight) {
      window.scrollBy({ top: bounds.top - top, behavior: "instant" });
    }
  });
  document.addEventListener("studio:saved", event => {
    if (event.detail?.message) window.MeroUI?.toast(event.detail.message, { tone: "success" });
  });
})();
