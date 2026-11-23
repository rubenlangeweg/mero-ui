(() => {
  const page = document.querySelector("[data-playground]");
  if (!page || !window.htmx) return;
  // Measure the natural height between switches, including changes made by HTMX.
  const lab = page.querySelector(".pg-canvas > .doc-lab");
  const panels = [...lab.querySelectorAll(':scope > [role="tabpanel"]')];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = panels.find(panel => !panel.hidden);
  let height = lab.getBoundingClientRect().height;
  let resize;
  new ResizeObserver(() => { height = lab.getBoundingClientRect().height; }).observe(lab);
  const selection = new MutationObserver(() => {
    const next = panels.find(panel => !panel.hidden);
    if (next === selected) return;
    selected = next;
    const from = resize?.playState === "running" ? lab.getBoundingClientRect().height : height;
    resize?.cancel();
    height = lab.getBoundingClientRect().height;
    if (reducedMotion.matches || Math.abs(height - from) < 1) return;
    resize = lab.animate([
      { height: from + "px", overflow: "clip" },
      { height: height + "px", overflow: "clip" },
    ], { duration: 190, easing: "cubic-bezier(.2,.7,.2,1)" });
  });
  for (const panel of panels) selection.observe(panel, { attributeFilter: ["hidden"] });

  const actions = {
    inventory: { selector: '[data-lab] [name="q"]', value: "lamp" },
    settings: { selector: '#layout-settings [name="name"]', value: " " },
    report: { selector: '.mero-report-period [name="period"]', value: "recent" },
  };
  const action = actions[page.dataset.playground];
  if (!action) return;
  const run = page.querySelector("[data-pg-run]");
  run.hidden = false;
  page.querySelector("[data-pg-scenarios]")?.addEventListener("click", event => {
    const details = page.querySelector(".lab-scenarios");
    if (!details) return;
    event.preventDefault();
    page.querySelector('[role="tab"][aria-controls$="-preview"]').click();
    details.open = true;
    details.querySelector("select").focus();
    details.scrollIntoView({ block: "center" });
  });
  run.addEventListener("click", () => {
    page.querySelector('[role="tab"][aria-controls$="-preview"]').click();
    const field = page.querySelector(action.selector);
    if (!field) return;
    field.value = action.value;
    field.form.requestSubmit();
  });
})();
