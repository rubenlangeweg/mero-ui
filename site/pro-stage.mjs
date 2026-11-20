import { finishes, galleryArrows, galleryTrack, lampPhoto } from "./gallery-components.mjs";

import { escapeHtml as esc } from "./html.mjs";

export function proStage({ product, outOfBand = false } = {}) {
  const title = esc(product?.name ?? "Arc Task Lamp");
  const selected = finishes.find(item => item.value === product?.finish) ?? finishes[0];
  return `<section id="studio-feature" class="pro-stage site-wrap" aria-label="Studio workspace preview"${outOfBand ? ' hx-swap-oob="outerHTML"' : " data-stage-intro"}>
    <mero-gallery class="ps-window" role="region" aria-label="${title} gallery">
      <header class="ps-toolbar">
        <span class="ps-window-controls" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="ps-workspace"><span class="ps-workspace-mark" aria-hidden="true"></span> Studio workspace</span>
        <a class="ps-toolbar-link" href="/components/carousel">Gallery docs <span aria-hidden="true">↗</span></a>
      </header>

      <div class="ps-stage-grid${product ? "" : " ps-gallery-only"}">
        <article class="ps-card ps-overview" aria-labelledby="ps-product-title">
          <div class="ps-product-image">
            <div class="ps-static">${lampPhoto(selected.value, "profile", `${product?.name ?? "Arc Task Lamp"}, ${selected.label}`, true)}</div>
            ${galleryTrack(finishes, { links: Boolean(product), eager: true, productName: product?.name ?? "Arc Task Lamp" })}
            ${product ? `<span class="ps-image-status" data-status="${esc(product.status)}"><i aria-hidden="true"></i> ${esc(product.status)}</span>` : ""}
          </div>
          <div class="ps-product-summary">
            <div>
              <h2 id="ps-product-title">${title}</h2>
              <p><span class="ps-live-swatch" aria-hidden="true"></span>Finish · <span data-mero-gallery-label aria-live="polite">${selected.label}</span></p>
            </div>
            ${galleryArrows()}
          </div>
        </article>

        ${product ? `<article class="ps-card ps-journal" aria-labelledby="ps-journal-title">
          <div class="ps-card-heading"><div><p>Studio inventory</p><h2 id="ps-journal-title">Product details</h2></div></div>
          <dl class="ps-record">
            <div><dt>SKU</dt><dd><code>${esc(product.sku)}</code></dd></div>
            <div><dt>Category</dt><dd>${esc(product.category)}</dd></div>
            <div><dt>Saved finish</dt><dd><span class="ps-record-swatch ps-finish-${selected.value}" aria-hidden="true"></span>${selected.label}</dd></div>
          </dl>
        </article>` : ""}

        <article class="ps-card ps-finishes" aria-labelledby="ps-finishes-title">
          <div class="ps-card-heading">
            <h2 id="ps-finishes-title"><span class="ps-choice-heading">Select a finish</span><span class="ps-static">${product ? "Saved finish" : "Finish"}</span></h2>
          </div>
          <p class="ps-static ps-saved-finish"><span class="ps-finish-swatch ps-finish-${selected.value}" aria-hidden="true"></span><span>${selected.label}<small>${selected.material}</small></span></p>
          <form class="ps-finish-form">
            <fieldset class="ps-finish-list">
              <legend class="ps-visually-hidden">Finish</legend>
              ${finishes.map(item => `<label class="ps-finish ps-finish-${item.value}">
                <input type="radio" name="studio-finish" data-mero-gallery-choice value="${item.value}"${item === selected ? " checked" : ""}>
                <span class="ps-finish-swatch" aria-hidden="true"></span>
                <span><strong>${item.label}</strong><small>${item.material}</small></span>
              </label>`).join("")}
            </fieldset>
          </form>
        ${product
          ? `<a class="ps-edit-link" data-mero-gallery-link href="/layouts/dashboard?view=inventory&amp;edit=6&amp;finish=${selected.value}">Edit in inventory <span aria-hidden="true">↗</span></a>
             <a class="ps-static ps-edit-link" href="/layouts/dashboard?view=inventory#product-6">View in inventory <span aria-hidden="true">↗</span></a>`
          : '<a class="ps-edit-link" href="/layouts/dashboard?view=inventory">Open inventory <span aria-hidden="true">↗</span></a>'}
        </article>
      </div>
    </mero-gallery>
  </section>`;
}
