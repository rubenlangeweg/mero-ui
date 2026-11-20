import assert from "node:assert/strict";
import test from "node:test";
import { records } from "../site/core/data-display.mjs";
import { components } from "../site/catalog.mjs";
import { selectVariant } from "../site/examples.mjs";

const render = query => records(new URLSearchParams(query));
const names = html => [...html.matchAll(/class="mero-row-link" href="[^"]*">([^<]+)</g)].map(match => match[1]);

test("sort=-name orders Z to A and marks only that header", () => {
  const html = render("sort=-name");
  const list = names(html);
  assert.deepEqual(list, [...list].sort().reverse());
  assert.equal(html.match(/aria-sort=/g).length, 1);
  assert.match(html, /<th role="columnheader" scope="col" aria-sort="descending"><a id="records-sort-name"/);
});

test("an invalid sort falls back to name ascending and is escaped", () => {
  const html = render("sort=<script>");
  assert.deepEqual(names(html), names(render("")));
  assert.match(html, /aria-sort="ascending"><a id="records-sort-name"/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(render("x=<script>"), /<script>/);
});

test("header links toggle direction and drop open; row links keep sort and add open", () => {
  const html = render("sort=category&theme=light&open=999");
  assert.match(html, /id="records-sort-category" href="\?sort=-category&amp;theme=light"/);
  assert.match(html, /id="records-sort-name" href="\?sort=name&amp;theme=light"/);
  assert.match(render(""), /id="records-sort-name" href="\?sort=-name"/);
  assert.match(html, /class="mero-row-link" href="\?sort=category&amp;theme=light&amp;open=\d"/);
  assert.match(render(""), /href="\?sort=name&amp;open=2">Halo Pendant</);
  assert.equal(html.match(/<a class="mero-row-link"/g).length, 8, "an unknown open id renders the table");
});

test("open renders the detail view with a Back link", () => {
  const html = render("sort=-status&open=2");
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /<h2 class="mero-card-title">Halo Pendant<\/h2>/);
  assert.match(html, /<a href="\?sort=-status">Back to products<\/a>/);
});

test("the catalog entry renders from the query but copies the default template", () => {
  const item = components.get("sortable-table");
  const sorted = selectVariant(item, new URLSearchParams("sort=-status"));
  const plain = selectVariant(item, new URLSearchParams());
  assert.notEqual(sorted.demo, plain.demo);
  assert.equal(sorted.code, plain.code);
  assert.equal(plain.demo, item.code);
});

const filtered = query => records(new URLSearchParams(query), { filters: true });
const chips = html => [...html.matchAll(/aria-label="(Remove filter: [^"]+)"/g)].map(match => match[1]);
const menu = html => [...html.matchAll(/role="menuitem" href="([^"]*)">((?:Status|Category) is \w+)</g)].map(([, href, text]) => [text, href]);

test("applied filters render as chips whose remove links drop only their own field", () => {
  const html = filtered("sort=-name&status=Draft&category=Lighting");
  assert.deepEqual(chips(html), ["Remove filter: Status is Draft", "Remove filter: Category is Lighting"]);
  assert.match(html, /href="\?sort=-name&amp;category=Lighting" aria-label="Remove filter: Status is Draft"/);
  assert.match(html, /href="\?sort=-name&amp;status=Draft" aria-label="Remove filter: Category is Lighting"/);
  assert.deepEqual(names(html), ["Halo Pendant"]);
  assert.match(html, /<a class="mero-link" href="\?sort=-name">Clear all filters<\/a>/);
});

test("the menu lists only unapplied values and replaces a field's value", () => {
  const items = Object.fromEntries(menu(filtered("sort=name&status=Draft")));
  assert.equal(items["Status is Draft"], undefined);
  assert.equal(items["Status is Active"], "?sort=name&amp;status=Active");
  assert.equal(items["Category is Objects"], "?sort=name&amp;status=Draft&amp;category=Objects");
  assert.equal(Object.keys(items).length, 6);
});

test("unknown filter values are ignored and Clear all appears only with filters", () => {
  const html = filtered("status=Bogus&category=toString");
  assert.deepEqual(chips(html), []);
  assert.deepEqual(names(html), names(filtered("")));
  assert.doesNotMatch(html, /Bogus|toString|Clear all|Applied filters/);
  assert.doesNotMatch(filtered(""), /Clear all/);
  assert.match(filtered("status=Archived&category=Lighting"), /No products match these filters\./);
  assert.doesNotMatch(render("status=Draft"), /mero-filter-bar/, "the sortable table stays filter-free");
});

test("command-menu fragment returns escaped server options", async () => {
  const { catalogFragment } = await import("../site/core-components.mjs");
  const fragment = query => catalogFragment("command-menu", new URLSearchParams(query));
  assert.match(fragment("q=butt"), /role="option"[^>]*href="\/components\/button"/);
  assert.match(fragment("q=zzzz"), /aria-disabled="true" id="cmd-empty"/);
  assert.doesNotMatch(fragment("q=%3Cimg%3E"), /<img/);
  assert.ok(fragment("").match(/role="option"/g).length <= 6);
  assert.match(fragment("q=export"), /id="cmd-export" data-mero-toast="Export requested"/);
});
