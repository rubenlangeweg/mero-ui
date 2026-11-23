/*! @rubenlangeweg/mero-ui 0.8.0 | MIT */
// Render a small Markdown subset for messages with no raw HTML or embeds.
function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}

function inline(line) {
  const tokens = line.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return tokens.map(token => {
    if (/^`[^`]+`$/.test(token)) return `<code>${escape(token.slice(1,-1))}</code>`;
    if (/^\*\*[^*]+\*\*$/.test(token)) return `<strong>${escape(token.slice(2,-2))}</strong>`;
    if (/^\*[^*]+\*$/.test(token)) return `<em>${escape(token.slice(1,-1))}</em>`;
    return escape(token);
  }).join('');
}

export function renderMarkdown(source) {
  const html = [], paragraph = [], list = [];
  let code = null;
  function flushBlock() {
    if (paragraph.length) html.push(`<p>${inline(paragraph.splice(0).join(' '))}</p>`);
    if (list.length) html.push(`<ul>${list.splice(0).map(text => `<li>${inline(text)}</li>`).join('')}</ul>`);
  }
  for (const line of String(source).replace(/\r\n?/g,'\n').split('\n')) {
    if (/^```/.test(line)) {
      if (code) { html.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); code = null; }
      else { flushBlock(); code = []; }
    } else if (code) code.push(line);
    else if (!line.trim()) flushBlock();
    else if (/^#{1,3} /.test(line)) {
      flushBlock();
      const [, marks, title] = line.match(/^(#{1,3}) (.*)$/);
      const level = marks.length + 2;
      html.push(`<h${level}>${inline(title)}</h${level}>`);
    } else if (/^[-*] /.test(line)) {
      if (paragraph.length) flushBlock();
      list.push(line.slice(2));
    } else {
      if (list.length) flushBlock();
      paragraph.push(line);
    }
  }
  if (code) html.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
  flushBlock();
  return `<div class="mero-markdown">${html.join('\n')}</div>`;
}
