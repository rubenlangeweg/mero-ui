(() => {
  let previousStep;
  document.addEventListener('htmx:before:swap', () => {
    previousStep = document.querySelector('#bulk-workspace h1')?.textContent;
  });
  document.addEventListener('htmx:after:settle', () => {
    const heading = document.querySelector('#bulk-workspace h1');
    if (heading && previousStep && previousStep !== heading.textContent) heading.focus({ preventScroll: true });
    previousStep = undefined;
  });
})();
