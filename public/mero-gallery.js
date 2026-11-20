(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  // All listeners belong to an element instance and disappear with an HTMX swap.
  class Gallery extends HTMLElement {
    connectedCallback() {
      this.listeners?.abort();
      this.listeners = new AbortController();
      const options = { signal: this.listeners.signal };
      this.addEventListener("change", event => {
        if (event.target.matches("[data-rl-gallery-choice]")) this.choose(event.target.value);
      }, options);
      this.addEventListener("pointerover", event => {
        if (!this.hasAttribute("data-rl-hover-preview") || event.pointerType !== "mouse") return;
        const control = event.target.closest("label")?.querySelector("[data-rl-gallery-choice]");
        if (control) this.choose(control.value);
      }, options);
      this.addEventListener("click", event => {
        const button = event.target.closest("[data-rl-prev], [data-rl-next]");
        if (button && button.getAttribute("aria-disabled") !== "true") {
          this.go(this.index + (button.hasAttribute("data-rl-next") ? 1 : -1), true);
        }
      }, options);
      this.addEventListener("keydown", event => {
        if (event.target !== this.track) return;
        const direction = getComputedStyle(this.track).direction === "rtl" ? -1 : 1;
        const index = { ArrowLeft: this.index - direction, ArrowRight: this.index + direction, Home: 0, End: this.slides.length - 1 }[event.key];
        if (index !== undefined) {
          event.preventDefault();
          this.go(index, true);
        }
      }, options);
      this.addEventListener("scroll", event => {
        if (event.target !== this.track || this.drag) return;
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(() => this.reflect(this.closestSlide()), 100);
      }, { ...options, capture: true, passive: true });
      this.addEventListener("pointerdown", event => {
        if (event.pointerType !== "mouse" || event.button !== 0 || !this.track?.contains(event.target)) return;
        if (event.target.closest("button, a, input, select, textarea")) return;
        this.drag = {
          id: event.pointerId, x: event.clientX, lastX: event.clientX,
          lastTime: event.timeStamp, velocity: 0, origin: this.track.scrollLeft,
        };
      }, options);
      this.addEventListener("pointermove", event => {
        if (this.drag?.id !== event.pointerId) return;
        const delta = event.clientX - this.drag.x;
        if (!this.track.hasAttribute("data-dragging")) {
          if (Math.abs(delta) < 5 || !event.buttons) return;
          this.track.setPointerCapture(event.pointerId);
          this.track.setAttribute("data-dragging", "");
        }
        const elapsed = Math.max(1, event.timeStamp - this.drag.lastTime);
        this.drag.velocity = (this.drag.lastX - event.clientX) / elapsed;
        this.drag.lastX = event.clientX;
        this.drag.lastTime = event.timeStamp;
        this.track.scrollLeft = this.drag.origin - delta;
      }, options);
      const end = event => {
        if (this.drag?.id !== event.pointerId) return;
        const drag = this.drag;
        this.drag = null;
        if (!this.track.hasAttribute("data-dragging")) return;
        const limit = this.track.clientWidth * .45;
        const coast = event.type === "pointerup" && event.timeStamp - drag.lastTime < 90
          ? Math.max(-limit, Math.min(limit, drag.velocity * 140)) : 0;
        const index = this.closestSlide(coast);
        this.track.removeAttribute("data-dragging");
        if (this.track.hasPointerCapture(event.pointerId)) this.track.releasePointerCapture(event.pointerId);
        this.go(index, true);
      };
      this.addEventListener("pointerup", end, options);
      this.addEventListener("pointercancel", end, options);
      this.addEventListener("lostpointercapture", end, options);
      this.addEventListener("pointerleave", event => {
        if (this.drag && !this.track.hasPointerCapture(event.pointerId)) end(event);
      }, options);
      // The server may mount a selected slide inside an initially hidden tab.
      this.resize = new ResizeObserver(entries => {
        if (entries.some(entry => entry.target === this.track && entry.contentRect.width > 0)) {
          this.go(this.index ?? 0, false);
        }
      });
      this.addEventListener("htmx:afterSettle", () => this.syncTrack(), options);
      this.syncTrack();
    }
    syncTrack() {
      const track = this.track;
      if (track !== this.observedTrack) {
        this.resize.disconnect();
        this.observedTrack = track;
        if (track) this.resize.observe(track);
      }
      const selected = this.querySelector("[data-rl-gallery-choice]:checked");
      if (selected && this.slides.some(slide => slide.dataset.rlSlide === selected.value)) this.choose(selected.value);
      else this.refresh();
    }
    disconnectedCallback() {
      this.listeners?.abort();
      this.resize?.disconnect();
      this.observedTrack = null;
      clearTimeout(this.scrollTimer);
      this.track?.removeAttribute("data-dragging");
      this.drag = null;
    }
    get track() { return this.querySelector(".rl-gallery-track"); }
    get slides() { return this.track ? [...this.track.children] : []; }
    refresh() {
      if (!this.track || !this.slides.length) return;
      this.reflect(this.closestSlide());
    }
    closestSlide(projectedDistance = 0) {
      const frame = this.track.getBoundingClientRect();
      let best = 0;
      let nearest = Infinity;
      this.slides.forEach((slide, index) => {
        const box = slide.getBoundingClientRect();
        const distance = Math.abs(box.left + box.width / 2 - frame.left - frame.width / 2 - projectedDistance);
        if (distance < nearest) { nearest = distance; best = index; }
      });
      return best;
    }
    choose(value) {
      const index = this.slides.findIndex(slide => slide.dataset.rlSlide === value);
      if (index !== -1) this.go(index, false);
    }
    go(index, smooth) {
      const slides = this.slides;
      if (!slides.length) return;
      const target = Math.min(slides.length - 1, Math.max(0, index));
      const box = slides[target].getBoundingClientRect();
      const frame = this.track.getBoundingClientRect();
      const delta = box.left + box.width / 2 - frame.left - frame.width / 2;
      this.reflect(target);
      this.track.scrollBy({ left: delta, behavior: smooth && !reducedMotion.matches ? "smooth" : "instant" });
    }
    reflect(index) {
      const slides = this.slides;
      const slide = slides[index];
      if (!slide) return;
      this.index = index;
      this.querySelectorAll("[data-rl-gallery-choice]").forEach(control => { control.checked = control.value === slide.dataset.rlSlide; });
      this.querySelectorAll("[data-rl-prev]").forEach(button => button.setAttribute("aria-disabled", String(index === 0)));
      this.querySelectorAll("[data-rl-next]").forEach(button => button.setAttribute("aria-disabled", String(index === slides.length - 1)));
      const label = this.querySelector("[data-rl-gallery-label]");
      const text = slide.dataset.label;
      if (label && text && text !== label.textContent) label.textContent = text;
      if (slide.dataset.href) this.querySelectorAll("[data-rl-gallery-link]").forEach(link => link.setAttribute("href", slide.dataset.href));
    }
  }

  class ImageDiff extends HTMLElement {
    connectedCallback() {
      this.update = event => {
        const slider = event?.target ?? this.querySelector("input[type=range]");
        const stage = slider?.closest(".rl-diff-stage");
        if (!stage || slider.type !== "range") return;
        stage.style.setProperty("--rl-diff-split", slider.value + "%");
        slider.setAttribute("aria-valuetext", slider.value + "% " + (slider.dataset.label ?? "before"));
      };
      this.addEventListener("input", this.update);
      this.update();
    }
    disconnectedCallback() { this.removeEventListener("input", this.update); }
  }

  class HoloCard extends HTMLElement {
    connectedCallback() {
      this.listeners = new AbortController();
      const options = { signal: this.listeners.signal };
      this.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse" || reducedMotion.matches) return;
        const box = this.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        this.style.setProperty("--rl-tilt-x", ((x - .5) * 9) + "deg");
        this.style.setProperty("--rl-tilt-y", ((.5 - y) * 9) + "deg");
        this.style.setProperty("--rl-shine-x", (x * 100) + "%");
        this.style.setProperty("--rl-shine-y", (y * 100) + "%");
      }, options);
      this.addEventListener("pointerleave", () => {
        for (const property of ["--rl-tilt-x", "--rl-tilt-y", "--rl-shine-x", "--rl-shine-y"]) this.style.removeProperty(property);
      }, options);
    }
    disconnectedCallback() { this.listeners.abort(); }
  }

  for (const [name, component] of [["rl-gallery", Gallery], ["rl-image-diff", ImageDiff], ["rl-holo-card", HoloCard]]) {
    if (!customElements.get(name)) customElements.define(name, component);
  }
})();
