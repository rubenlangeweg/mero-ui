(() => {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const motion = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const headline = hero.querySelector("h1");
  const metal = headline.querySelector(".hero-metal");
  const clearReflection = () => metal.style.removeProperty("--hero-light-position");

  headline.addEventListener("pointermove", event => {
    if (!motion.matches || event.pointerType === "touch") return;
    const bounds = metal.getBoundingClientRect();
    if (!bounds.width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    // The reflection is half the text width. Centre its brightest point under the pointer.
    metal.style.setProperty("--hero-light-position", (fraction * 200 - 50).toFixed(1) + "%");
  }, { passive: true });
  headline.addEventListener("pointerleave", clearReflection);
  headline.addEventListener("pointercancel", clearReflection);
  motion.addEventListener("change", clearReflection);
  window.addEventListener("blur", clearReflection);

  const light = [
    { property: "--stage-light-x", rest: 50, unit: "%" },
    { property: "--stage-light-y", rest: 35, unit: "%" },
    { property: "--stage-response", rest: 0, unit: "" },
  ].map(axis => ({ ...axis, value: axis.rest, target: axis.rest, velocity: 0 }));
  let stage;
  let frame = 0;
  let lastTime = 0;

  function reset() {
    cancelAnimationFrame(frame);
    frame = lastTime = 0;
    for (const axis of light) {
      stage?.style.removeProperty(axis.property);
      axis.value = axis.target = axis.rest;
      axis.velocity = 0;
    }
    stage = null;
  }

  // Exact step for a unit-mass spring with stiffness 300 and damping 30.
  // Keeping the velocity lets the light change direction smoothly mid-flight.
  function paint(time) {
    if (!stage?.isConnected || document.hidden || !motion.matches) return reset();
    const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
    const frequency = Math.sqrt(75);
    const decay = Math.exp(-15 * dt);
    const cosine = Math.cos(frequency * dt);
    const sine = Math.sin(frequency * dt) / frequency;
    let moving = false;
    for (const axis of light) {
      const offset = axis.value - axis.target;
      const velocity = axis.velocity;
      axis.value = axis.target + decay * (offset * cosine + (velocity + 15 * offset) * sine);
      axis.velocity = decay * (velocity * cosine - (15 * velocity + 300 * offset) * sine);
      if (Math.abs(axis.value - axis.target) < .002 && Math.abs(axis.velocity) < .02) {
        axis.value = axis.target;
        axis.velocity = 0;
      } else {
        moving = true;
      }
      const value = Math.max(0, Math.min(axis.unit ? 100 : 1, axis.value));
      stage.style.setProperty(axis.property, value.toFixed(3) + axis.unit);
    }
    lastTime = moving ? time : 0;
    frame = moving ? requestAnimationFrame(paint) : 0;
    if (!moving && light[2].target === 0) reset();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  hero.addEventListener("pointermove", event => {
    if (!motion.matches || document.hidden || event.pointerType === "touch") return;
    const surface = event.target.closest("#studio-feature");
    if (!surface) return;
    if (surface !== stage) {
      reset();
      stage = surface;
    }
    const bounds = stage.getBoundingClientRect();
    light[0].target = (event.clientX - bounds.left) / bounds.width * 100;
    light[1].target = (event.clientY - bounds.top) / bounds.height * 100;
    light[2].target = 1;
    schedule();
  }, { passive: true });

  hero.addEventListener("pointerout", event => {
    if (!stage || stage.contains(event.relatedTarget)) return;
    for (const axis of light) axis.target = axis.rest;
    schedule();
  });
  hero.addEventListener("pointercancel", reset);
  // htmx 4 fires this only on htmx-powered elements, so check the subtree.
  document.addEventListener("htmx:before:cleanup", event => {
    if (stage && event.target.contains(stage)) reset();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });
  motion.addEventListener("change", reset);
  window.addEventListener("pagehide", reset);
  window.addEventListener("blur", reset);
})();
