// Host behavior for the daisyUI and HeroUI styles-only variants.
const editor = document.querySelector('#editor');
editor.addEventListener('htmx:beforeRequest', event => {
  const form = event.detail.elt;
  if (!form.matches('form')) return;
  form.setAttribute('aria-busy', 'true');
  form.querySelector('[data-rl-form-error]').hidden = true;
});
editor.addEventListener('htmx:beforeSwap', event => {
  if (event.detail.xhr.status !== 422) return;
  event.detail.shouldSwap = true;
  event.detail.isError = false;
});
editor.addEventListener('htmx:afterSettle', event => {
  if (event.detail.xhr.status === 422) editor.querySelector('[aria-invalid="true"]')?.focus();
});
editor.addEventListener('htmx:afterRequest', event => {
  const form = event.detail.elt;
  if (!form.matches('form')) return;
  form.removeAttribute('aria-busy');
  if (!event.detail.failed || event.detail.xhr.status === 422) return;
  const error = form.querySelector('[data-rl-form-error]');
  error.textContent = 'The request failed. Check the record and try again.';
  error.hidden = false;
});
editor.addEventListener('relay:form-saved', () => {
  editor.closest('dialog').close();
  document.querySelector('#edit-record').focus();
});
