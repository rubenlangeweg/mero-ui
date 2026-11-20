import assert from "node:assert/strict";
import test from "node:test";
import { finishes, galleryTrack, groups } from "../site/gallery-components.mjs";
import { createLabStore } from "../site/lab.mjs";
import { proStage } from "../site/pro-stage.mjs";

test("Studio renders each finish as a gallery view, radio option and inventory destination", () => {
  const lamp = createLabStore().products.find(product => product.id === 6);
  for (const finish of finishes) {
    const page = proStage({ product: { ...lamp, finish: finish.value } });
    assert.match(page, new RegExp(`data-mero-gallery-link href="/layouts/dashboard\\?view=inventory&amp;edit=6&amp;finish=${finish.value}"`));
    assert.match(page, new RegExp(`data-mero-gallery-choice value="${finish.value}" checked`));
    assert.match(page, new RegExp(`data-mero-slide="${finish.value}"`));
    assert.match(page, new RegExp(`data-mero-gallery-label aria-live="polite">${finish.label}<`));
    assert.equal((page.match(/ checked/g) ?? []).length, 1);
  }
  assert.match(proStage({ product: { ...lamp, finish: 'unknown' } }), /data-mero-gallery-choice value="ivory" checked/);
});

test("media examples expose the exact working markup, keyboard controls and unobstructed local images", () => {
  const items = groups.flatMap(group => group.items);
  assert.deepEqual(items.map(item => item.id), ["carousel", "hover-gallery", "diff", "holo-card"]);
  for (const item of items) assert.equal(item.code, item.demo);
  for (const item of items.slice(0, 2)) {
    assert.equal((item.code.match(/data-mero-slide=/g) ?? []).length, 3);
    assert.equal((item.code.match(/data-mero-gallery-choice/g) ?? []).length, 3);
    assert.match(item.code, /<ol class="mero-gallery-track" tabindex="0"/);
    assert.doesNotMatch(item.code, /\bid=|https?:\/\//);
  }
});

test("custom names and finish keys keep their text and URL meaning in gallery markup", () => {
  const html = galleryTrack([{ value:"silver+gold", label:'7" nickel & brass' }], {
    links:true, productName:"Arc & Co.",
  });
  assert.match(html,/data-label="7&quot; nickel &amp; brass"/);
  assert.match(html,/finish=silver%2Bgold"/);
  assert.match(html,/alt="Arc &amp; Co\., 7&quot; nickel &amp; brass"/);
});
