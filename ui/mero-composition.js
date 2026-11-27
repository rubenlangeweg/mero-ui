/*! @rubenlangeweg/mero-ui 0.10.0 | MIT */
(() => {
  const rotations = new Map();
  function advance(cycle) {
    const items = [...cycle.querySelectorAll("[data-cycle-item]")];
    if (!items.length) return;
    const next = (items.findIndex((item) => !item.hidden) + 1) % items.length;
    items.forEach((item, i) => {
      item.hidden = i !== next;
    });
  }
  function stop(cycle) {
    clearInterval(rotations.get(cycle));
    rotations.delete(cycle);
    cycle.querySelector("[data-cycle-play]")?.setAttribute("aria-pressed", "false");
  }
  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-cycle-next],[data-cycle-play]");
    const cycle = control?.closest("[data-mero-text-cycle]");
    if (!cycle) return;
    if (control.hasAttribute("data-cycle-next")) {
      stop(cycle);
      advance(cycle);
      return;
    }
    if (rotations.has(cycle)) {
      stop(cycle);
      return;
    }
    control.setAttribute("aria-pressed", "true");
    rotations.set(
      cycle,
      setInterval(() => (cycle.isConnected ? advance(cycle) : stop(cycle)), 3200),
    );
  });
  document.addEventListener("change", (event) => {
    const picker = event.target.closest("[data-mero-theme-picker]");
    const scope = picker?.closest("[data-mero-theme-scope]");
    if (scope) scope.dataset.theme = picker.value;
  });
  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-mero-check-form]");
    if (!form) return;
    event.preventDefault();
    form.querySelector("output").textContent = form.getAttribute("data-mero-check-form") || "SKU format accepted.";
  });
  document.addEventListener("input", (event) => {
    const form = event.target.closest("[data-mero-check-form]");
    if (form) form.querySelector("output").textContent = "";
  });
  let tick;
  function update() {
    const clocks = document.querySelectorAll("[data-mero-cutoff-hour]");
    clearTimeout(tick);
    if (!clocks.length) return;
    const now = new Date();
    for (const clock of clocks) {
      const hour = clock.dataset.meroCutoffHour;
      if (!/^([01]?\d|2[0-3])$/.test(hour)) continue;
      const target = new Date(now);
      target.setUTCHours(Number(hour), 0, 0, 0);
      if (+target <= +now) target.setUTCDate(target.getUTCDate() + 1);
      const seconds = Math.ceil((target - now) / 1000);
      const time = clock.querySelector("time");
      if (!time) continue;
      time.dateTime = target.toISOString();
      time.textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
    }
    tick = setTimeout(update, 1000);
  }
  update();
  document.addEventListener("htmx:after:swap", update);
  document.addEventListener("htmx:before:cleanup", (event) => {
    const removed = event.target;
    for (const cycle of rotations.keys()) if (removed.contains(cycle)) stop(cycle);
  });
})();
