import assert from 'node:assert/strict';
import test from 'node:test';
import {Readable} from 'node:stream';
import {groups,handleInsightRequest} from '../site/insight-components.mjs';
import {renderChart} from '../ui/insight-charts.mjs';
import {renderMarkdown} from '../ui/insight-markdown.mjs';

async function request(method, path, fields = {}) {
  const body = Buffer.from(new URLSearchParams(fields).toString());
  const req = Object.assign(Readable.from([body]),{method});
  const result = {headers:{},status:null,body:''};
  const response = {
    setHeader(key,value) { result.headers[key] = value; },
    writeHead(status, headers) { result.status = status; Object.assign(result.headers,headers); },
    end(html) { result.body = html; },
  };
  result.handled = await handleInsightRequest(req,response,new URL(path,'http://localhost'));
  return result;
}

test('insight catalog ships labelled chart marks and data tables for each figure',()=>{
  const charts = groups.find(group=>group.name==='Charts').items;
  assert.equal(charts.length,8);
  for (const entry of charts) {
    assert.match(entry.demo,/<figcaption>/);
    assert.match(entry.demo,/<th scope="row">/);
    assert.match(entry.demo,/data-mero-plot-value=/);
    assert.equal(entry.demo,entry.code);
    assert.doesNotMatch(entry.demo,/NaN|Infinity/);
  }
  assert.equal(new Set(groups.flatMap(g=>g.items.map(i=>i.id))).size,29);
});
test('chart helper handles empty and all-zero data and escapes supplied text',()=>{
  const config = {type:'pie',title:'<test>',series:['Units & runs'],rows:[{label:'<&',values:[0]}]};
  const markup = renderChart(config);
  assert.doesNotMatch(markup,/NaN|Infinity|<test>/);
  assert.match(markup,/&lt;&amp;/);
  assert.match(renderChart({...config,rows:[]}),/No data for this period/);
  assert.throws(()=>renderChart({...config,rows:[{label:'A',values:[-1]}]}),/nonnegative/);
});
test('chat responses escape the prompt, use local records, and reject invalid input',async()=>{
  const result = await request('POST','/demo/insights/reply',{message:'Which day shipped most? <script>'});
  assert.equal(result.status,200);
  assert.match(result.body,/&lt;script&gt;/);
  assert.equal(result.body.match(/class="mero-chat-message"/g).length,2);
  assert.match(result.body,/56 units/);
  assert.equal((await request('POST','/demo/insights/reply',{message:' '.repeat(4)})).status,422);
  assert.equal((await request('POST','/demo/insights/reply',{message:'a'.repeat(1001)})).status,422);
  assert.equal((await request('GET','/other')).handled,false);
});
test('download, selected conversation and period use the same local ledger',async()=>{
  const report = await request('GET','/demo/insights/dispatch.csv');
  assert.match(report.headers['Content-Type'],/text\/csv/);
  assert.match(report.body,/Fri,52,56/);
  assert.match((await request('GET','/demo/insights/thread?topic=weekly')).body,/284 units/);
  assert.equal((await request('GET','/demo/insights/thread?topic=other')).status,404);
  const recent = await request('GET','/demo/insights/chart?period=recent');
  assert.match(recent.body,/Friday to Sunday/);
  assert.doesNotMatch(recent.body,/<th scope="row">Mon/);
});
test('Markdown preserves code, escapes raw HTML and renders its documented subset',async()=>{
  const md = '# Brief\n\n**Total** is `23`.\n\n- <script>\n\n```xml\n**text** <a>\n```';
  const safe = renderMarkdown(md);
  assert.match(safe,/<h3>Brief<\/h3>/);
  assert.match(safe,/<strong>Total<\/strong>/);
  assert.match(safe,/<li>&lt;script&gt;<\/li>/);
  assert.match(safe,/<pre><code>\*\*text\*\* &lt;a&gt;<\/code><\/pre>/);
  assert.equal((await request('POST','/demo/insights/markdown',{source:md})).body,safe);
});

test('each plot has one keyboard entry, including a pie with leading zero rows', () => {
  const charts = groups.find(group => group.name === 'Charts').items;
  for (const chart of charts) {
    assert.equal(chart.demo.match(/tabindex="0"/g)?.length, 1, chart.name);
    assert.match(chart.demo, /Use the arrow keys/);
  }
  const config = {type:'pie',title:'Volume',series:['Units'],rows:[{label:'None',values:[0]},{label:'Large',values:[1e308]},{label:'More',values:[1e308]}]};
  const pie = renderChart(config);
  assert.equal(pie.match(/data-mero-plot-value=/g)?.length, 2);
  assert.match(pie,/tabindex="0" role="img" aria-label="Large/);
  const empty = renderChart({...config,rows:config.rows.slice(0,1)});
  assert.match(empty,/All categories are zero/);
  assert.match(empty,/<th scope="row">None<\/th>/);
  assert.doesNotMatch(empty,/data-mero-plot-readout/);
});

test('the package exports the server helpers by name', async () => {
  assert.equal((await import('@rubenlangeweg/mero-ui/charts')).renderChart, renderChart);
  assert.equal((await import('@rubenlangeweg/mero-ui/markdown')).renderMarkdown, renderMarkdown);
});
