import assert from 'node:assert/strict';
import test from 'node:test';
import { createFeature } from '../examples/premium/bulk.mjs';

async function post(feature, key, action, revision) {
  let status, markup;
  const res = {
    writeHead(code) { status = code; },
    end(body) { markup = body; },
  };
  await feature.handle({ method: 'POST' }, res, new URL('/premium/bulk/' + key + '/' + action + '?v=' + revision, 'http://localhost'));
  assert.equal(status, 200);
  return markup;
}

test('bulk publication survives eviction before apply and retry, within the five-run size budget', async () => {
  let feature = createFeature();
  const keys = Array.from({ length: 6 }, () => feature.render().match(/hx-post="\/premium\/bulk\/([^/]+)/)[1]);
  // Keep the oldest opened tab active, ahead of the next-oldest idle tab.
  for (const key of [keys[0], ...keys.slice(2)]) {
    await post(feature, key, 'all', 0);
    assert.match(await post(feature, key, 'preview', 1), /1,842 products will change/);
  }
  const load = () => {
    const json = JSON.stringify(feature.snapshot());
    assert.ok(Buffer.byteLength(json) < 128 * 1024);
    feature = createFeature(JSON.parse(json));
  };
  load();
  assert.deepEqual(feature.snapshot().runs.map(run => run.key), [keys[0], ...keys.slice(2)]);
  for (const key of [keys[0], ...keys.slice(2)]) {
    assert.match(await post(feature, key, 'apply', 2), /1,839 of 1,842 products published/);
  }
  load();
  for (const key of [keys[0], ...keys.slice(2)]) {
    assert.match(await post(feature, key, 'retry', 3), /1,842 of 1,842 products published/);
  }
  load();
  const html = await post(feature, keys[0], 'return', 4);
  assert.match(html, /0 selected/);
  assert.doesNotMatch(html, /Select all [\d,]+ matching/);
  assert.equal(feature.snapshot().runs.at(-1).published.length, 1842);
});
