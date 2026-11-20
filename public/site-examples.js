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
  for (const event of ["htmx:after:history:push", "htmx:after:history:replace"]) {
    document.addEventListener(event, syncPreviews);
  }
  // htmx 4 restores history inside a Navigation API transition; the browser resets focus when it ends.
  document.addEventListener("htmx:after:swap", event => {
    if (event.detail.ctx.request?.headers?.["HX-History-Restore-Request"]) (window.navigation?.transition?.finished ?? Promise.resolve()).then(() => { syncPreviews(); fitLayoutChooser(); }, () => { syncPreviews(); fitLayoutChooser(); });
  });

  document.addEventListener("htmx:after:swap", async event => {
    const { ctx } = event.detail;
    const target = typeof ctx.target === "string" ? document.querySelector(ctx.target) : ctx.target;
    if (!target?.id) return;
    const code = document.querySelector('[data-template-for="' + CSS.escape(target.id) + '"] pre code');
    if (!code) return;
    // Use the actual response, before the browser or HTMX adds attributes to the preview.
    const source = document.createTextNode(ctx.text ?? "");
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

  document.addEventListener("htmx:before:request", (event) => {
    const { ctx } = event.detail;
    const lab = ctx.sourceElement?.closest?.("[data-doc-lab]");
    if (!lab?.querySelector("[data-exchange-body]")) return;
    const method = ctx.request.method;
    // htmx 4 has already moved GET and DELETE fields into the URL and cleared the body.
    const url = new URL(ctx.request.action, location.href);
    const path = url.pathname + url.search;
    const request = [`${method} ${path}`];
    for (const [name, value] of ctx.request.body || []) {
      if (request.length === 1) request.push("", "Submitted fields");
      const field = typeof value === "string" ? value : `${value.name} (${value.size} bytes)`;
      request.push(`${name} = ${field}`);
    }
    const exchange = { lab, method, path, text: request.join("\n"), status: "Request pending", started: performance.now() };
    exchanges.set(ctx, exchange);
    const trace = traces.get(lab.dataset.traceId);
    if (trace) addToTrace(trace, exchange);
    showExchange(exchange);
  });
  document.addEventListener("htmx:finally:request", (event) => {
    const { ctx } = event.detail;
    const exchange = exchanges.get(ctx);
    if (!exchange) return;
    exchanges.delete(ctx);
    const { lab, result } = exchange;
    if (!result && selected.get(lab) !== exchange) return;
    const code = ctx.response?.status ?? 0;
    const status = code ? `HTTP ${code}` : "No response";
    const headers = [...ctx.response?.headers ?? []].map(([name, value]) => `${name}: ${value}`).filter((line) =>
      /^(hx-|content-type:)/i.test(line),
    );
    const elapsed = Math.round(performance.now() - exchange.started);
    exchange.status = `${status} · ${elapsed} ms`;
    exchange.text += ["", "", status, ...headers, "", ctx.text || "(empty response)"].join("\n");
    if (result) {
      result.textContent = code ? String(code) : "No response";
      result.dataset.outcome = code >= 200 && code < 400 ? "success" : "error";
    }
    if (selected.get(lab) === exchange) showExchange(exchange);
  });
})();
