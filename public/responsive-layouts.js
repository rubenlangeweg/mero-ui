(() => {
  let observer;
  const returnFocus = new Map();
  function prepare() {
    observer?.disconnect();
    const bench = document.getElementById("guide-preview");
    if (!bench) return;
    const host = bench.querySelector(".guide-host");
    const stage = bench.querySelector(".guide-stage");
    const range = bench.querySelector("#guide-width");
    const output = bench.querySelector("#guide-measured");

    function annotateLinks() {
      const company = new URL(location.href).searchParams.get("company");
      for (const link of bench.querySelectorAll("[data-guide-preset]")) {
        const url = new URL(link.href);
        if (company) url.searchParams.set("company", company);
        else url.searchParams.delete("company");
        link.href = url.href;
        if (link.dataset.guidePreset === bench.dataset.guideWidth) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
      for (const link of host.querySelectorAll("[data-guide-record]")) {
        const url = new URL(link.href);
        if (bench.dataset.guideWidth) url.searchParams.set("width", bench.dataset.guideWidth);
        else url.searchParams.delete("width");
        link.href = url.href;
      }
    }

    function measure() {
      const available = Math.floor(stage.clientWidth - parseFloat(getComputedStyle(stage).paddingInlineStart) - parseFloat(getComputedStyle(stage).paddingInlineEnd));
      range.min = Math.min(240, available);
      range.max = available;
      const actual = Math.round(host.getBoundingClientRect().width);
      range.value = actual;
      range.setAttribute("aria-valuetext", actual + " pixels");
      output.value = actual + " px";
      output.hidden = false;
      range.hidden = available <= Number(range.min);
    }

    function size(width) {
      bench.dataset.guideWidth = width;
      if (width) host.style.setProperty("--guide-width", width + "px");
      else host.style.removeProperty("--guide-width");
      measure();
    }
    function rememberWidth() {
      const url = new URL(location.href);
      if (bench.dataset.guideWidth) url.searchParams.set("width", bench.dataset.guideWidth);
      else url.searchParams.delete("width");
      history.replaceState(history.state, "", url);
      annotateLinks();
    }

    range.oninput = () => size(range.value);
    range.onchange = rememberWidth;
    bench.onclick = event => {
      const preset = event.target.closest("[data-guide-preset]");
      if (!preset || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      size(preset.dataset.guidePreset);
      rememberWidth();
    };
    measure();
    annotateLinks();
    observer = new ResizeObserver(measure);
    observer.observe(stage);
  }

  document.addEventListener("htmx:config:request", event => {
    const link = event.target;
    if (!link.matches?.("[data-guide-record]")) return;
    // Boosted links cache their href when processed. Preview widths can change before a visit.
    event.detail.ctx.request.action = link.pathname + link.search;
    event.detail.ctx.request.anchor = link.hash.slice(1) || undefined;
    returnFocus.set(location.href, link.id);
    if (returnFocus.size > 32) returnFocus.delete(returnFocus.keys().next().value);
  });
  function restored() {
    prepare();
    const target = document.getElementById(returnFocus.get(location.href) || location.hash.slice(1));
    if (target?.getClientRects().length) target.focus({ preventScroll: true });
  }
  // htmx 4 restores history inside a Navigation API transition; the browser resets focus when it ends.
  document.addEventListener("htmx:after:swap", event => {
    if (event.detail.ctx.request?.headers?.["HX-History-Restore-Request"]) (window.navigation?.transition?.finished ?? Promise.resolve()).then(restored, restored);
  });
  document.addEventListener("htmx:after:settle", event => {
    if (event.detail.task.target?.id !== "guide-panes") return;
    prepare();
    const target = document.getElementById(location.hash.slice(1));
    if (target?.closest("#guide-panes")) target.focus({ preventScroll: true });
  });
  prepare();
})();
