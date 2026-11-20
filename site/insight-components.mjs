import {escapeHtml as esc} from './html.mjs';
import {renderChart} from '../ui/insight-charts.mjs';
import {renderMarkdown} from '../ui/insight-markdown.mjs';

function item(id, name, description, markup, notes, serverHelper) {
  const demo = markup.trim();
  return {id, name, description, demo, code: demo, notes, serverHelper};
}

// The same example shipment ledger drives the charts, metrics and local conversation.
const week = [
  ['Mon', 35, 32], ['Tue', 41, 39], ['Wed', 32, 33], ['Thu', 48, 46],
  ['Fri', 52, 56], ['Sat', 36, 38], ['Sun', 42, 40],
];
const collections = [['Lighting', 106], ['Furniture', 83], ['Objects', 58], ['Textiles', 37]];
const total = week.reduce((count, day) => count + day[2], 0);
const target = week.reduce((count, day) => count + day[1], 0);
const peak = week.reduce((a,b) => a[2] > b[2] ? a : b);
const volumes = week.map(([label,planned,actual])=>({label, values:[actual,planned]}));
const split = collections.map(([label,value])=>({label,values:[value]}));
const chartNotes = 'The SVG and data table share one dataset. Tab into the chart once. Arrow left and right inspect categories. Arrow up and down change series. The next Tab reaches the data table. The optional insight-charts.mjs helper renders this HTML on your server.';
function chart(id, name, description, type, title, rows, series) {
  return item(id, name, description, renderChart({type, title, rows, series, caption:'Studio dispatch · sample week'}), chartNotes, 'insight-charts.mjs');
}
const charts = [
  chart('area-chart','Area Chart','Show the volume and shape of a series over time.','area','Daily dispatches',volumes.map(({label,values})=>({label,values:values.slice(0,1)})),['Shipped']),
  chart('bar-chart','Bar Chart','Compare adjacent categories on a shared linear scale.','bar','Weekly dispatch plan',volumes,['Shipped','Planned']),
  chart('chart-tooltip','Chart Tooltip','Inspect the active data point using a pointer or keyboard.','line','Dispatch detail',volumes,['Shipped','Planned']),
  chart('composed-chart','Composed Chart','Compare actual volume with its target using columns and a line.','composed','Actual against plan',volumes,['Shipped','Planned']),
  chart('line-chart','Line Chart','Trace changes across a reporting period.','line','Dispatch pace',volumes,['Shipped','Planned']),
  chart('pie-chart','Pie Chart','See how each collection contributes to total volume.','pie','Share of dispatches',split,['Shipped']),
  chart('radar-chart','Radar Chart','Compare profiles across axes that use the same units.','radar','Collection shipping targets',split.map((row,i)=>({label:row.label,values:[row.values[0],[103,82,65,36][i]]})),['Shipped','Planned']),
  chart('radial-chart','Radial Chart','Compare categories as concentric rings against the largest category.','radial','Collection volume',split,['Shipped']),
];
function periodChart(period) {
  const daily = period === 'week' ? volumes : volumes.slice(-3);
  return renderChart({type:'line', title:'Dispatch pace', caption:period === 'week' ? 'Monday to Sunday' : 'Friday to Sunday', series:['Shipped','Planned'], rows:daily});
}
charts.find(chart => chart.id === 'line-chart').variants = [{
  name: 'Period picker',
  demo: `<div class="mero-report-period"><form hx-get="/demo/insights/chart" hx-target="next .mero-plot" hx-swap="outerHTML" hx-sync="this:replace"><label>Reporting period <select name="period" class="mero-select"><option value="week">Full week</option><option value="recent">Last three days</option></select></label><button class="mero-button" type="submit">Apply</button></form><div class="mero-insight-status" data-mero-report-status role="status"></div>${periodChart('week')}</div>`,
}];
function trend(change, label) {
  const direction = change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
  const prefix = change > 0 ? '+' : '';
  return `<span class="mero-trend" data-direction="${direction}"><span aria-hidden="true">${{up:'↗',down:'↘',flat:'→'}[direction]}</span> ${prefix}${esc(change)}%<span class="mero-insight-sr"> ${esc(label)}</span></span>`;
}
function metric(name, value, context) {
  return `<div class="mero-insight-metric"><dt>${esc(name)}</dt><dd><strong>${esc(value)}</strong><span>${esc(context)}</span></dd></div>`;
}
const metrics = [
  item('kpi','KPI','Pair an exact figure with the reporting period it describes.', `<dl class="mero-insight-metrics">${metric('Dispatched',total,'units this week')}</dl>`),
  item('kpi-group','KPI Group','Keep related measures on a common reporting period.',`<dl class="mero-insight-metrics">${metric('Dispatched',total,'units this week')}${metric('Planned',target,'units this week')}${metric('Peak day',peak[2],`units on ${peak[0]}`)}</dl>`),
];
function reactions() {
  return `<div class="mero-chat-actions" role="group" aria-label="Reactions">${[['👍','Helpful',7],['🎉','Celebrate',3],['👀','Seen',5]].map(([emoji,name,count])=>`<button class="mero-reaction" type="button" data-mero-reaction aria-pressed="false" aria-label="${name}, ${count} reactions" data-label="${name}"><span aria-hidden="true">${emoji}</span><span data-mero-count>${count}</span></button>`).join('')}</div>`;
}
const formatter = new Intl.NumberFormat('en-US');
const feedback = [
  item('emoji-reaction-button','Emoji Reaction Button','Add or remove a reaction while keeping its count visible.', reactions(),'The local toggle emits mero:reaction with {label, pressed}. Persist the change in your own service when needed.'),
  item('number-value','Number Value','Display a localized number with its machine-readable value.',`<dl class="mero-insight-metrics"><div class="mero-insight-metric"><dt>Gross sales</dt><dd><strong><data value="17860.5">${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(17860.5)}</data></strong><span>USD · sample week</span></dd></div><div class="mero-insight-metric"><dt>Units packed</dt><dd><strong><data value="1284">${formatter.format(1284)}</data></strong><span>this month</span></dd></div></dl>`, 'Format values on the server using the locale and currency of the report.'),
  item('pressable-feedback','Pressable Feedback','Give a press a tactile response and keep its selected state visible.',`<button class="mero-pressable" type="button" aria-pressed="false" data-mero-pressable><span data-mero-press-icon aria-hidden="true">☆</span> Star report</button>`),
  item('rating','Rating','Choose a labelled score using native radio controls.',`<form><fieldset class="mero-rating"><legend>Rate the delivery</legend><span class="mero-rating-options">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="delivery-rating" value="${n}" aria-label="${n} ${n===1?'star':'stars'}"${n===4?' checked':''}><span aria-hidden="true">★</span></label>`).join('')}</span></fieldset></form>`, 'When adding this fieldset to an existing form, give each independent rating its own field name.'),
  item('trend-chip','Trend Chip','Label the direction and magnitude of a change.', `<div class="mero-insight-trends"><span>Orders ${trend(8.4,'change in orders')}</span><span>Returns ${trend(-1.2,'change in returns')}</span><span>Leads ${trend(0,'change in leads')}</span></div>`),
];
const prompts = ['Summarize this week', 'Which day shipped most?', 'Show the collection mix'];
const sources = `<details class="mero-chat-disclosure"><summary>Shipment ledger <span>7 entries</span></summary><table class="mero-table"><thead><tr><th scope="col">Day</th><th scope="col">Shipped</th><th scope="col">Planned</th></tr></thead><tbody>${week.map(([label,planned,actual])=>`<tr><th scope="row">${label}</th><td>${actual}</td><td>${planned}</td></tr>`).join('')}</tbody></table></details>`;
const reportCode = `<figure class="mero-code-block"><figcaption><span>dispatch.html</span><button type="button" class="mero-insight-link" data-mero-copy>Copy code</button></figcaption><pre tabindex="0"><code>${esc('<output aria-live="polite">284 units shipped</output>')}</code></pre></figure>`;
const chatLoader = `<div class="mero-chat-loader" role="status"><span aria-hidden="true"><i></i><i></i><i></i></span> Preparing report</div>`;
const activity = `<details class="mero-chat-disclosure" open><summary>Report activity <span>Complete</span></summary><ol class="mero-chat-steps"><li>Read the weekly ledger <small>7 daily entries</small></li><li>Group shipments by collection <small>4 collections</small></li><li>Calculate weekly total <small>${total} units</small></li></ol></details>`;
function chatActions() {
  return `<div class="mero-chat-actions" role="group" aria-label="Message actions"><button class="mero-insight-link" type="button" data-mero-copy>Copy message</button><button class="mero-insight-link" type="button" data-mero-pressable aria-pressed="false">Helpful</button></div>`;
}
function message(author, body, actions = false) {
  return `<article class="mero-chat-message" data-role="${author === 'You'?'user':'assistant'}"><header>${esc(author)}</header><div data-mero-message-text>${body}</div>${actions ? chatActions() : ''}</article>`;
}
function responseTo(prompt) {
  if (/peak|which day|busiest|most/i.test(prompt)) return `The busiest day was **${peak[0]}**, with **${peak[2]} units** dispatched against a plan of ${peak[1]}.`;
  if (/collection|mix|category|lighting/i.test(prompt)) return 'Weekly dispatches by collection:\n\n' + collections.map(([label,value])=>`- **${label}** · ${value} units`).join('\n');
  if (/summar|week|ship|plan|report/i.test(prompt)) return `Studio shipped **${total} units** this week against a plan of ${target}. ${peak[0]} was the busiest day with ${peak[2]} units.`;
  return 'This demo can answer questions about the **sample dispatch ledger**. Ask for the weekly total, the busiest day or the collection mix.';
}
const attachment = `<a class="mero-chat-file" href="/demo/insights/dispatch.csv" download="dispatch.csv"><span aria-hidden="true">↧</span><span><strong>dispatch.csv</strong><small>Weekly shipment ledger · CSV</small></span></a>`;
const toolRun = `<details class="mero-chat-disclosure"><summary>Calculate dispatch totals <span>Completed</span></summary><dl class="mero-tool-result"><dt>Input</dt><dd>7 daily shipment totals</dd><dt>Result</dt><dd>${total} units shipped</dd></dl></details>`;
const suggestionButtons = `<div class="mero-chat-actions" role="group" aria-label="Suggested questions">${prompts.map(text=>`<button class="mero-suggestion" type="button" data-mero-suggest>${esc(text)}</button>`).join('')}</div>`;
function conversation({suggestions = false, initial = false} = {}) {
  return `<section class="mero-chat" aria-label="Dispatch assistant demo">
  <header class="mero-chat-head"><strong>Dispatch assistant</strong><span>Local demo</span></header>
  <div class="mero-chat-history" role="log" aria-label="Conversation" aria-relevant="additions">${initial ? message('You','<p>Summarize this week.</p>') + message('Studio',renderMarkdown(responseTo('summarize')),true) : ''}</div>
  <form class="mero-chat-compose" data-mero-compose method="post" action="/demo/insights/reply" hx-post="/demo/insights/reply" hx-target="previous .mero-chat-history" hx-swap="beforeend" hx-sync="this:drop">
    ${suggestions?suggestionButtons:''}<label><span class="mero-insight-sr">Your question</span><textarea class="mero-input" name="message" placeholder="Ask about this week’s dispatches…" rows="2" required maxlength="1000"></textarea></label>
    <div class="mero-chat-compose-foot"><span data-mero-chat-status role="status"></span><button type="submit" class="mero-button mero-button-primary mero-button-sm">Send <span aria-hidden="true">↑</span></button></div>
  </form>
</section>`;
}
const threads = [['weekly','Weekly dispatches',prompts[0]],['peak','Peak capacity',prompts[1]],['mix','Collection mix',prompts[2]]];
function threadContent(thread) {
  return `<div data-mero-current-topic="${esc(thread[0])}"><h2>${esc(thread[1])}</h2>${message('Studio',renderMarkdown(responseTo(thread[2])))}</div>`;
}
const sampleMarkdown = '# Dispatch brief\n\n**Lighting** led shipments. Prepare the next batch for Wednesday.\n\n- Check `SL-204` stock.\n- Reserve two packing stations.';
const ai = [
  item('chain-of-thought','Chain Of Thought','Display a disclosure of observable execution steps for a report.',activity,'Populate this component with public tool activity from your application.'),
  item('chat-attachment','Chat Attachment','Display a named file and provide a working download.', attachment, 'The example serves an actual CSV from the local demo endpoint.'),
  item('chat-conversation','Chat Conversation','Keep messages, controls and a composer in one scoped conversation.',conversation({initial:true,suggestions:true}),'Replies come from a deterministic local shipment fixture. The endpoint returns two message articles.'),
  item('chat-list-view','Chat List View','Open a conversation returned by the server.',`<div class="mero-chat-inbox"><nav aria-label="Dispatch conversations">${threads.map(([id,title],index)=>`<a href="/demo/insights/thread?topic=${id}" data-mero-topic="${id}"${index === 0 ? ' aria-current="true"' : ''} hx-get="/demo/insights/thread?topic=${id}" hx-target="next .mero-chat-thread" hx-swap="innerHTML" hx-sync="closest nav:replace">${esc(title)}</a>`).join('')}</nav><section class="mero-chat-thread" aria-label="Selected conversation" aria-live="polite">${threadContent(threads[0])}</section><div class="mero-insight-status" data-mero-report-status role="status"></div></div>`),
  item('chat-loader','Chat Loader','Show a concise status while a response is being prepared.',chatLoader),
  item('chat-message','Chat Message','Distinguish the sender and keep the message readable after a swap.',`<div class="mero-chat-history">${message('You','<p>Which day shipped most?</p>')}${message('Studio',renderMarkdown(responseTo('which day')))}</div>`),
  item('chat-message-actions','Chat Message Actions','Copy a reply or mark it as helpful.',message('Studio',renderMarkdown(responseTo('mix')),true)),
  item('chat-source','Chat Source','Open the exact data behind a generated summary.',sources),
  item('chat-tool','Chat Tool','Disclose the inputs and output of an application action.',toolRun),
  item('code-block','Code Block','Show a file caption, selectable code and a copy control.',reportCode),
  item('markdown','Markdown','Render a small safe subset of Markdown into semantic HTML.',`<div class="mero-markdown-editor"><form class="mero-md-edit" action="/demo/insights/markdown" method="post" hx-post="/demo/insights/markdown" hx-target="next .mero-md-output" hx-swap="innerHTML" hx-sync="this:replace"><label>Markdown source<textarea class="mero-input" name="source" rows="6" maxlength="4000" spellcheck="false">${esc(sampleMarkdown)}</textarea></label><div class="mero-md-actions"><button class="mero-button mero-button-secondary mero-button-sm">Render preview</button><span class="mero-insight-status" data-mero-report-status role="status"></span></div></form><section class="mero-md-preview" aria-label="Rendered preview"><h2>Preview</h2><div class="mero-md-output">${renderMarkdown(sampleMarkdown)}</div></section></div>`, 'The optional insight-markdown.mjs server helper supports paragraphs, headings, unordered lists, strong, emphasis, inline code and fenced code. Raw markup is escaped.', 'insight-markdown.mjs'),
  item('prompt-input','Prompt Input','Collect a question and submit it to a server-rendered response endpoint.',conversation()),
  item('prompt-suggestion','Prompt Suggestion','Choose a suggested prompt, edit it, then send it.',conversation({suggestions:true})),
  item('text-shimmer','Text Shimmer','Indicate work in progress with a moving highlight across readable text.',`<p class="mero-text-shimmer" role="status">Preparing shipment summary…</p>`),
];
ai.find(entry => entry.id === 'chat-conversation').variants = [{name:'Empty conversation',demo:conversation({suggestions:true})}];
ai.find(entry => entry.id === 'chat-tool').variants = [{name:'Failed run',demo:'<details class="mero-chat-disclosure" open><summary>Calculate dispatch totals <span>Failed</span></summary><p role="status">The ledger could not be read. Check that the selected report still exists.</p></details>'}];
export const groups = [{name:'Charts',items:charts},{name:'Metrics',items:metrics},{name:'Interaction feedback',items:feedback},{name:'Conversation',items:ai}];

function send(response,status,body,type='text/html; charset=utf-8') {
  response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(body);
}
export async function handleInsightRequest(request, response, url) {
  if (!url.pathname.startsWith('/demo/insights/')) return false;
  const route = url.pathname.slice('/demo/insights/'.length);
  if (request.method === 'GET' && route === 'dispatch.csv') {
    response.setHeader('Content-Disposition','attachment; filename="dispatch.csv"');
    send(response,200,'Day,Planned,Shipped\r\n'+week.map(row=>row.join(',')).join('\r\n')+'\r\n','text/csv; charset=utf-8');
  } else if (request.method === 'GET' && route === 'chart') {
    send(response,200,periodChart(url.searchParams.get('period') === 'recent' ? 'recent' : 'week'));
  } else if (request.method === 'GET' && route === 'thread') {
    const topic = threads.find(([id]) => id === url.searchParams.get('topic'));
    if (topic) send(response,200,threadContent(topic));
    else send(response,404,'Conversation not found.','text/plain; charset=utf-8');
  } else if (request.method === 'POST' && ['reply','markdown'].includes(route)) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > 65536) { send(response,413,'The submission is too long.','text/plain; charset=utf-8'); return true; }
      chunks.push(chunk);
    }
    const fields = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const text = fields.get(route === 'reply' ? 'message':'source') ?? '';
    if ((route === 'reply' && (!text.trim() || text.length > 1000)) || (route === 'markdown' && text.length > 4000)) send(response,422,'Check the length of your submission.','text/plain; charset=utf-8');
    else if (route === 'reply') send(response,200,message('You',`<p>${esc(text.trim())}</p>`)+message('Studio',renderMarkdown(responseTo(text)),true));
    else send(response,200,renderMarkdown(text));
  } else send(response,404,'Example endpoint not found.','text/plain; charset=utf-8');
  return true;
}
