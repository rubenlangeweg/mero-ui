(() => {
  const root = document.documentElement;
  let saved;
  try { saved = localStorage.getItem("relay-theme"); } catch {}

  function setTheme(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    for (const frame of document.querySelectorAll('[data-live-specimen]')) {
      frame.contentDocument?.documentElement.setAttribute('data-theme', theme);
    }
    document.querySelector('meta[name="theme-color"]').content = theme === "light" ? "#f5f5f5" : "#09090a";
    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    });
    document.dispatchEvent(new Event("relay:site-theme"));
  }

  for (const frame of document.querySelectorAll('[data-live-specimen]')) {
    let observer;
    function fitSpecimen() {
      observer?.disconnect();
      const doc = frame.contentDocument;
      const specimen = doc?.querySelector('main');
      if (!specimen) return;
      doc.documentElement.setAttribute('data-theme', root.dataset.theme);
      observer = new ResizeObserver(() => {
        const style = doc.defaultView.getComputedStyle(doc.body);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const border = frame.offsetHeight - frame.clientHeight;
        frame.style.setProperty('--specimen-content-height', Math.ceil(specimen.getBoundingClientRect().height + padding + border) + 'px');
      });
      observer.observe(specimen);
    }
    frame.addEventListener('load', fitSpecimen);
    fitSpecimen();
  }

  setTheme(saved === "light" ? "light" : "dark");
  document.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-theme-toggle]");
    if (toggle) {
      setTheme(root.dataset.theme === "light" ? "dark" : "light");
      try { localStorage.setItem("relay-theme", root.dataset.theme); } catch {}
    }

    const copy = event.target.closest("[data-copy-code]");
    if (copy) {
      const code = copy.closest(".docs-code").querySelector("code");
      try {
        await navigator.clipboard.writeText(code.textContent);
        copy.textContent = "Copied";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(code);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        copy.textContent = "Press Ctrl+C or ⌘C";
      }
      clearTimeout(copyTimers.get(copy));
      copyTimers.set(copy, setTimeout(() => { copy.textContent = "Copy code"; }, 2000));
    }
  });

  const copyTimers = new WeakMap();
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      const search = document.querySelector("[data-catalog-search]");
      if (!search) window.location.assign("/components?search");
      else { search.focus(); search.select(); }
    }
  });

  const config = window.htmx?.config;
  if (config) {
    config.selfRequestsOnly = true;
    config.allowEval = false;
    config.allowScriptTags = false;
  }

})();
