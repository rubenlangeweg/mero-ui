(() => {
  function updatePreview(select) {
    const lab = select.closest("[data-doc-lab]");
    const preview = lab.querySelector("[data-sample-scope]");
    const theme = select.value;
    if (theme === "auto") preview.removeAttribute("data-theme");
    else preview.dataset.theme = theme === "brand" ? "light" : theme;
    preview.toggleAttribute("data-tenant-preview", theme === "brand");
    const link = lab.querySelector("[data-open-preview]");
    if (link) {
      const target = new URL(link.href);
      if (target.pathname === location.pathname && target.searchParams.has("embed")) {
        target.search = location.search;
        target.searchParams.set("embed", "1");
      }
      target.searchParams.set("theme", theme === "auto" ? document.documentElement.dataset.theme : theme);
      link.href = target.pathname + target.search;
    }
  }
  function syncPreviews() {
    document.querySelectorAll("[data-preview-theme]").forEach(updatePreview);
  }
  syncPreviews();
  for (const event of ["htmx:pushedIntoHistory", "htmx:replacedInHistory", "htmx:historyRestore"]) {
    document.addEventListener(event, syncPreviews);
  }

  document.addEventListener("htmx:afterSwap", async event => {
    const { target, xhr } = event.detail;
    if (!target?.id || !xhr) return;
    const code = document.querySelector('[data-template-for="' + CSS.escape(target.id) + '"] pre code');
    if (!code) return;
    // Use the actual response, before the browser or HTMX adds attributes to the preview.
    const source = document.createTextNode(xhr.responseText);
    code.replaceChildren(source);
    const { markupTokens } = await import("./markup-tokens.mjs");
    if (!code.isConnected || code.firstChild !== source) return;
    const formatted = document.createDocumentFragment();
    for (const [text, type] of markupTokens(source.data)) {
      if (type) {
        const token = document.createElement("span");
        token.className = "syntax-" + type;
        token.textContent = text;
        formatted.append(token);
      } else formatted.append(text);
    }
    code.replaceChildren(formatted);
  });
  const layoutRail = matchMedia("(min-width: 47rem)");
  function fitLayoutChooser() {
    const chooser = document.querySelector(".app-example-chooser");
    if (!chooser) return;
    chooser.toggleAttribute("data-inline", layoutRail.matches);
    chooser.open = layoutRail.matches;
  }
  fitLayoutChooser();
  layoutRail.addEventListener("change", fitLayoutChooser);
  document.addEventListener("htmx:historyRestore", fitLayoutChooser);
  document.addEventListener("click", event => {
    const chooser = document.querySelector(".app-example-chooser[open]:not([data-inline])");
    if (chooser && !chooser.contains(event.target)) chooser.open = false;
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const chooser = event.target.closest(".app-example-chooser[open]:not([data-inline])");
    if (chooser) {
      chooser.open = false;
      chooser.querySelector("summary").focus();
    }
  });
  document.addEventListener("mero:site-theme", syncPreviews);
  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-preview-theme]");
    if (select) updatePreview(select);
  });

  const exchanges = new WeakMap();
  const selected = new WeakMap();
  const traces = new Map([...document.querySelectorAll("[data-playground-trace]")]
    .map(trace => [trace.dataset.playgroundTrace, trace]));

  function showExchange(exchange) {
    const { lab, status, text } = exchange;
    selected.get(lab)?.button?.removeAttribute("aria-current");
    selected.set(lab, exchange);
    exchange.button?.setAttribute("aria-current", "true");
    lab.querySelector("[data-exchange-status]").textContent = status;
    lab.querySelector("[data-exchange-body]").textContent = text;
  }

  function addToTrace(trace, exchange) {
    const lab = exchange.lab;
    const list = trace.querySelector("[data-trace-list]");
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const method = document.createElement("b");
    method.textContent = exchange.method;
    const path = document.createElement("span");
    path.className = "pg-trace-path";
    path.textContent = exchange.path;
    button.title = exchange.method + " " + exchange.path;
    const result = document.createElement("span");
    result.className = "pg-trace-result";
    result.textContent = "Pending";
    button.append(method, path, result);
    exchange.result = result;
    exchange.button = button;
    button.addEventListener("click", () => {
      showExchange(exchange);
      const panel = lab.querySelector("[data-exchange-body]").closest('[role="tabpanel"]');
      const tab = document.getElementById(panel.getAttribute("aria-labelledby"));
      tab.click();
      tab.focus({ preventScroll: true });
      tab.scrollIntoView({ block: "nearest" });
    });
    row.append(button);
    list.prepend(row);
    list.children[8]?.remove();
    trace.querySelector("[data-trace-clear]").disabled = false;
    trace.querySelector("[data-trace-empty]").hidden = true;
    trace.querySelector("[data-trace-hint]").hidden = false;
  }

  for (const [id, trace] of traces) {
    trace.querySelector("[data-trace-clear]").addEventListener("click", event => {
      const lab = document.querySelector('[data-trace-id="' + CSS.escape(id) + '"]');
      selected.delete(lab);
      lab.querySelector("[data-exchange-status]").textContent = "Waiting for a request";
      lab.querySelector("[data-exchange-body]").textContent = "Use the preview to see the request and the HTML your server returns.";
      trace.querySelector("[data-trace-list]").replaceChildren();
      trace.querySelector("[data-trace-empty]").hidden = false;
      trace.querySelector("[data-trace-hint]").hidden = true;
      event.currentTarget.disabled = true;
    });
  }

  document.addEventListener("htmx:beforeRequest", (event) => {
    const { elt, xhr, requestConfig, pathInfo } = event.detail;
    const lab = elt?.closest("[data-doc-lab]");
    if (!lab?.querySelector("[data-exchange-body]")) return;
    const method = requestConfig.verb.toUpperCase();
    const url = new URL(pathInfo.finalRequestPath, location.href);
    const path = url.pathname + url.search;
    const request = [`${method} ${path}`];
    if (!requestConfig.useUrlParams) {
      for (const [name, value] of requestConfig.formData || []) {
        if (request.length === 1) request.push("", "Submitted fields");
        const field = typeof value === "string" ? value : `${value.name} (${value.size} bytes)`;
        request.push(`${name} = ${field}`);
      }
    }
    const exchange = { lab, method, path, text: request.join("\n"), status: "Request pending", started: performance.now() };
    exchanges.set(xhr, exchange);
    const trace = traces.get(lab.dataset.traceId);
    if (trace) addToTrace(trace, exchange);
    showExchange(exchange);
  });
  document.addEventListener("htmx:afterRequest", (event) => {
    const { xhr } = event.detail;
    const exchange = exchanges.get(xhr);
    if (!exchange) return;
    exchanges.delete(xhr);
    const { lab, result } = exchange;
    if (!result && selected.get(lab) !== exchange) return;
    const status = xhr.status ? `HTTP ${xhr.status}` : "No response";
    const headers = [...xhr.getAllResponseHeaders().trim().split(/\r?\n/)].filter((line) =>
      /^(hx-|content-type:)/i.test(line),
    );
    const elapsed = Math.round(performance.now() - exchange.started);
    exchange.status = `${status} · ${elapsed} ms`;
    exchange.text += ["", "", status, ...headers, "", xhr.responseText || "(empty response)"].join("\n");
    if (result) {
      result.textContent = xhr.status ? String(xhr.status) : "No response";
      result.dataset.outcome = xhr.status >= 200 && xhr.status < 400 ? "success" : "error";
    }
    if (selected.get(lab) === exchange) showExchange(exchange);
  });
})();
