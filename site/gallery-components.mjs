import { escapeHtml } from "./html.mjs";

export const finishes = [
  { value: "ivory", label: "Soft ivory", material: "Matte enamel" },
  { value: "sand", label: "Warm sand", material: "Satin enamel" },
  { value: "graphite", label: "Graphite", material: "Textured powder coat" },
];

const details = [
  { value: "profile", label: "Profile", finish: "ivory" },
  { value: "shade", label: "Enamel detail", finish: "sand" },
  { value: "base", label: "Brushed base", finish: "graphite" },
];

export function lampPhoto(finish, view, alt, eager = false) {
  const loading = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<span class="rl-lamp-photo" data-finish="${escapeHtml(finish)}" data-view="${escapeHtml(view)}">
    <img src="/studio-lamp.webp" alt="${escapeHtml(alt)}" width="1120" height="747" ${loading} decoding="async" draggable="false">
  </span>`;
}

export function galleryTrack(items = finishes, { links = false, eager = false, productName = "Arc Task Lamp" } = {}) {
  return `<ol class="rl-gallery-track" tabindex="0" aria-label="Product photographs">
    ${items.map((item, index) => `<li data-rl-slide="${escapeHtml(item.value)}" data-label="${escapeHtml(item.label)}"${links ? ` data-href="/layouts/dashboard?view=inventory&amp;edit=6&amp;finish=${encodeURIComponent(item.value)}"` : ""}>
      ${lampPhoto(item.finish ?? item.value, item.finish ? item.value : "profile", `${productName}, ${item.label}`, eager && index === 0)}
    </li>`).join("\n    ")}
  </ol>`;
}

export function galleryArrows() {
  return `<div class="rl-gallery-arrows">
    <button type="button" data-rl-prev aria-label="Previous image" aria-disabled="true"><span aria-hidden="true">←</span></button>
    <button type="button" data-rl-next aria-label="Next image"><span aria-hidden="true">→</span></button>
  </div>`;
}

function productGallery(hover = false) {
  const items = hover ? details : finishes;
  const name = hover ? "Product details" : "Product finishes";
  return `<rl-gallery class="rl-media-card" role="region" aria-label="${name}" aria-roledescription="carousel"${hover ? " data-rl-hover-preview" : ""}>
  ${galleryTrack(items)}
  <div class="rl-media-caption">
    <div><strong>Arc Task Lamp</strong><output data-rl-gallery-label aria-live="polite">${items[0].label}</output></div>
    ${galleryArrows()}
  </div>
  <form class="rl-gallery-choices">
    <fieldset><legend>${hover ? "View" : "Finish"}</legend>
      ${items.map((item, i) => `<label>
        <input type="radio" name="view" data-rl-gallery-choice value="${item.value}"${i ? "" : " checked"}>
        <span class="rl-gallery-thumb">${lampPhoto(item.finish ?? item.value, item.finish ? item.value : "profile", "")}</span>
        <span>${item.label}</span>
      </label>`).join("\n      ")}
    </fieldset>
  </form>
</rl-gallery>`;
}

const diff = `<rl-image-diff class="rl-media-card" role="group" aria-label="Compare Arc Task Lamp finishes">
  <div class="rl-diff-stage">
    <div class="rl-diff-image">${lampPhoto("graphite", "profile", "Arc lamp with a graphite shade")}</div>
    <div class="rl-diff-image" data-rl-before>${lampPhoto("ivory", "profile", "Arc lamp with an ivory shade")}</div>
    <label class="rl-diff-control">
      <span>Reveal ivory finish</span>
      <input type="range" min="0" max="100" value="50" data-label="ivory" aria-valuetext="50% ivory">
    </label>
    <span class="rl-diff-line" aria-hidden="true"><i>↔</i></span>
  </div>
  <div class="rl-diff-caption"><span>Soft ivory</span><span>Graphite</span></div>
</rl-image-diff>`;

const holo = `<rl-holo-card>
  <a href="/components/carousel" class="rl-foil">
    <span class="rl-foil-ink" aria-hidden="true"></span>
    <span class="rl-foil-top"><span>Studio materials</span><span aria-hidden="true">↗</span></span>
    <span class="rl-foil-title">Brushed nickel</span>
    <span class="rl-foil-meta">Arc collection · Finish gallery</span>
  </a>
</rl-holo-card>`;

function example(id, name, description, demo, notes) {
  return { id, name, description, demo, code: demo, notes };
}

export const groups = [{ name: "Media galleries", items: [
  example("carousel", "Carousel", "Browse product photography with native scroll snap, thumbnails and keyboard controls.", productGallery(), "Use the arrow keys, Home or End on the strip. Touch and trackpad use native scrolling. For your own photographs, place an img in each slide and give it a descriptive alt."),
  example("hover-gallery", "Hover Gallery", "Explore the shade, base and profile of a product with a pointer, touch or keyboard.", productGallery(true), "On a mouse, hover a thumbnail to preview it. Tap or select a thumbnail with the keyboard for the same view."),
  example("diff", "Image Diff", "Reveal two finishes at the same position using an accessible comparison slider.", diff, "Drag the divider or focus the slider and press the arrow keys. The original photographs remain available as labelled images."),
  example("holo-card", "Holo Card", "Catch a material sample in a shifting foil reflection.", holo, "Tilt follows a fine pointer. Reduced motion keeps the swatch still. The link works with keyboard and touch."),
] }];
