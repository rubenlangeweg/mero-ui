import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../server.mjs';
import { factories } from '../examples/premium/workflows.mjs';

test('the catalog exposes all workflows, their assets and the captioned walkthroughs', async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.match(await (await fetch(base+'/playground')).text(), /href="\/premium"/);
  for (const name of Object.keys(factories)) {
    const response = await fetch(base+'/premium/'+name);
    assert.equal(response.status,200,name);
    const html = await response.text();
    assert.match(html,/<h1\b/);
    for (const [,url] of html.matchAll(/(?:src|href)="(\/premium-assets\/[^"]+)"/g)) {
      assert.equal((await fetch(base+url)).status,200,url);
    }
  }
  for (const name of [...Object.keys(factories),'queue-mobile']) {
    const html = await (await fetch(base+'/premium/watch?demo='+name)).text();
    assert.ok(html.includes('/recordings/'+name+'.webm'));
    const track = await fetch(base+'/recordings/'+name+'.vtt');
    assert.match(await track.text(),/^WEBVTT/);
    const video = await fetch(base+'/recordings/'+name+'.webm',{headers:{Range:'bytes=0-3'}});
    assert.equal(video.status,206);
    assert.deepEqual([...new Uint8Array(await video.arrayBuffer())],[26,69,223,163]);
  }
});
