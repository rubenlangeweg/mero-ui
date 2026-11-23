document.addEventListener("click", async event => {
  const button = event.target.closest("[data-sv-copy]");
  if (!button) return;
  const link = new URL(button.dataset.svCopy, location.origin);
  const message = document.querySelector("#sv-message");
  try {
    await navigator.clipboard.writeText(link.href);
    message.textContent = "View link copied.";
  } catch {
    const input = document.createElement("input");
    input.className = "mero-input";
    input.setAttribute("aria-label", "Shareable view link");
    input.readOnly = true;
    input.value = link.href;
    message.replaceChildren("Copy this link ", input);
    input.focus();
    input.select();
  }
});
