(() => {
  document.addEventListener("click", event => {
    if (event.target.closest("[data-paste-jump]")) document.querySelector("#paste-workspace [data-paste-error]")?.focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !event.target.matches("[data-paste-error]") || event.isComposing) return;
    event.preventDefault();
    const form = event.target.form;
    const fields = [...form.querySelectorAll("[data-paste-error]")];
    const next = fields[fields.indexOf(event.target) + 1];
    if (next) { next.focus(); next.select(); }
    else form.requestSubmit();
  });
  document.addEventListener("htmx:after:swap", event => {
    const target = event.detail?.ctx?.target;
    if (target?.id !== "paste-workspace") return;
    document.querySelector("#paste-workspace [data-paste-focus], #paste-data")?.focus();
  });
})();
