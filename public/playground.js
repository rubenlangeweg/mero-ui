(() => {
  const page = document.querySelector("[data-playground]");
  if (!page || !window.htmx) return;
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
