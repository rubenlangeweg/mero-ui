(() => {
  function close(queue) {
    queue.removeAttribute("data-inspecting");
    const target = queue.querySelector('[aria-current="true"]') || queue.querySelector(".pq-header h2");
    if (target?.tagName === "H2") target.tabIndex = -1;
    target?.focus();
  }
  document.addEventListener("premium:queue-ready", event => {
    const queue = event.target.closest("#pq-queue");
    if (!queue) return;
    // The replacement actions become focusable once htmx has attached their handlers.
    queue.querySelector("#pq-inspector footer")?.removeAttribute("inert");
    queue.setAttribute("data-inspecting", "");
    (queue.querySelector("#pq-approve") || queue.querySelector("#pq-undo"))?.focus({preventScroll: true});
  });
  document.addEventListener("click", event => {
    const btn = event.target.closest("[data-pq-close]");
    if (btn) close(btn.closest("#pq-queue"));
  });
  document.addEventListener("keydown", event => {
    const queue = event.target.closest("#pq-queue");
    if (!queue) return;
    if (event.key === "Escape" && matchMedia("(width < 48rem)").matches && queue.hasAttribute("data-inspecting")) {
      event.preventDefault();
      close(queue);
      return;
    }
    const row = event.target.closest(".pq-row");
    if (!row || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = [...queue.querySelectorAll(".pq-row")];
    const index = rows.indexOf(row);
    const next = {ArrowDown: Math.min(index + 1, rows.length - 1), ArrowUp: Math.max(index - 1, 0), Home: 0, End: rows.length - 1}[event.key];
    event.preventDefault();
    rows[next].focus();
  });
})();
