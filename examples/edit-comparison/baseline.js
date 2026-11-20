// Host behavior for the daisyUI and HeroUI styles-only variants.
const editor = document.querySelector('#editor');
editor.addEventListener('htmx:before:request', event => {
  const form = event.detail.ctx.sourceElement;
  if (!form.matches('form')) return;
  form.setAttribute('aria-busy', 'true');
  form.querySelector('[data-mero-form-error]').hidden = true;
});
editor.addEventListener('htmx:before:swap', event => {
  const status = event.detail.ctx.response.status;
  if (status >= 400 && status !== 422) event.preventDefault();
});
document.addEventListener('htmx:after:swap', event => {
  if (event.detail.ctx.response?.status === 422) editor.querySelector('[aria-invalid="true"]')?.focus();
});
editor.addEventListener('htmx:finally:request', event => {
  const {ctx} = event.detail;
  const form = event.target;
  if (!form.matches('form')) return;
  form.removeAttribute('aria-busy');
  // A cancelled request has no response and a status still 'issuing'.
  if (ctx.response ? ctx.response.status < 400 || ctx.response.status === 422 : !ctx.status.startsWith('error')) return;
  const error = form.querySelector('[data-mero-form-error]');
  error.textContent = 'The request failed. Check the record and try again.';
  error.hidden = false;
});
editor.addEventListener('mero:form-saved', () => {
  editor.closest('dialog').close();
  document.querySelector('#edit-record').focus();
});
