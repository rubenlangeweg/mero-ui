/*! @rubenlangeweg/mero-ui 1.0.0 | MIT */
// Optional server-side helper. Render the result in a full page or an HTMX response.
// Each row is {label, values: [number, ...]}. Values are finite and nonnegative.
const chartTypes = new Set(['line', 'area', 'bar', 'composed', 'pie', 'radar', 'radial']);
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const round = (n) => Number(n.toFixed(2));
const tone = (index) => `mero-plot-tone-${index % 6}`;
const xy = (x, y) => `${round(x)},${round(y)}`;

function mark(shape, label, index, series, first) {
  const text = escape(label);
  return `<g class="mero-plot-point ${tone(index)}" tabindex="${first ? 0 : -1}" role="img" aria-label="${text}" data-mero-series="${series}" data-mero-plot-value="${text}">${shape}</g>`;
}

function cartesian(type, rows, series, format, formatAxis) {
  const left = 42, right = 480, bottom = 155, top = 16;
  const max = Math.max(1, ...rows.flatMap(row => row.values));
  const slot = (right - left) / rows.length;
  const x = (i) => left + (i + .5) * slot;
  const y = (value) => bottom - (value / max) * (bottom - top);
  const objects = [];
  const pointMarks = [];
  for (const fraction of [0, .5, 1]) {
    const at = round(y(max * fraction));
    objects.push(`<line class="mero-plot-grid" x1="${left}" x2="${right}" y1="${at}" y2="${at}"/><text class="mero-plot-axis" x="${left - 7}" y="${at + 4}" text-anchor="end">${escape(formatAxis(max * fraction))}</text>`);
  }
  const stride = Math.max(1, Math.ceil(rows.length / 7));
  rows.forEach(({label}, i) => {
    if (i % stride === 0) objects.push(`<text class="mero-plot-axis" x="${round(x(i))}" y="179" text-anchor="middle">${escape(label)}</text>`);
  });
  const bars = type === 'bar' ? series.length : Number(type === 'composed');
  series.forEach((name, j) => {
    const points = rows.map(({values}, i) => xy(x(i), y(values[j])));
    if (j >= bars) {
      if (type === 'area') objects.push(`<path class="mero-plot-area ${tone(j)}" d="M${points.join(' L')} L${xy(x(rows.length-1), bottom)} L${xy(x(0), bottom)} Z"/>`);
      objects.push(`<polyline class="mero-plot-line ${tone(j)}" points="${points.join(' ')}"/>`);
    }
    rows.forEach(({label, values}, i) => {
      const value = values[j], cx = x(i), cy = y(value);
      const width = slot * .62 / Math.max(1, bars);
      const shape = j < bars
        ? `<rect x="${round(cx - slot * .31 + (j + .065) * width)}" y="${round(cy)}" width="${round(width * .87)}" height="${round(bottom - cy)}" rx="2"/>`
        : `<circle cx="${round(cx)}" cy="${round(cy)}" r="9" fill="transparent"/><circle class="mero-plot-dot" cx="${round(cx)}" cy="${round(cy)}" r="3.8"/>`;
      const layer = j < bars ? objects : pointMarks;
      layer.push(mark(shape, `${label} · ${name}: ${format(value)}`, j, j, i === 0 && j === 0));
    });
  });
  return { view: '0 0 495 188', graphics: objects.join('') + pointMarks.join('') };
}

function pie(rows, name, format) {
  const firstPositive = rows.findIndex(row => row.values[0] > 0);
  const largest = rows.reduce((max, row) => Math.max(max, row.values[0]), 0);
  const sum = rows.reduce((total, row) => total + row.values[0] / largest, 0);
  let angle = -Math.PI / 2;
  const graphics = rows.map(({label, values}, i) => {
    const share = values[0] / largest / sum;
    const next = angle + share * 2 * Math.PI;
    const point = (radians) => xy(165 + 73 * Math.cos(radians), 85 + 73 * Math.sin(radians));
    const shape = share === 1 ? '<circle cx="165" cy="85" r="73"/>' : `<path d="M165,85 L${point(angle)} A73,73 0 ${share > .5 ? '1' : '0'} 1 ${point(next)} Z"/>`;
    angle = next;
    return share ? mark(shape, `${label} · ${name}: ${format(values[0])}`, i, 0, i === firstPositive) : '';
  }).join('');
  return {view: '0 0 330 170', graphics};
}

function radial(rows, name, format) {
  const max = Math.max(1, ...rows.map(row => row.values[0]));
  const step = 70 / rows.length;
  const graphics = rows.map(({label,values}, i) => {
    const radius = 79 - (i + .5) * step;
    const base = `cx="165" cy="85" r="${round(radius)}" pathLength="100" fill="none" stroke-width="${round(step * .68)}"`;
    return `<circle class="mero-plot-track" ${base}/>` + mark(`<circle ${base} stroke="currentColor" stroke-linecap="butt" transform="rotate(-90 165 85)" stroke-dasharray="${round(values[0] / max * 100)} 100"/>`, `${label} · ${name}: ${format(values[0])}`, i, 0, i === 0);
  }).join('');
  return {view:'0 0 330 170',graphics};
}

function radar(rows, series, format) {
  const max = Math.max(1, ...rows.flatMap(row => row.values));
  const vertex = (i, radius) => {
    const a = -Math.PI / 2 + i / rows.length * 2 * Math.PI;
    return [195 + Math.cos(a) * radius, 100 + Math.sin(a) * radius];
  };
  const graphics = [0.33,0.66,1].map(f => `<polygon class="mero-plot-grid" fill="none" points="${rows.map((_,i) => xy(...vertex(i, 65 * f))).join(' ')}"/>`);
  rows.forEach(({label}, i) => {
    const [x,y] = vertex(i,81);
    const anchor = Math.abs(x - 195) < 1 ? 'middle' : x > 195 ? 'start' : 'end';
    graphics.push(`<text class="mero-plot-axis" x="${round(x)}" y="${round(y+4)}" text-anchor="${anchor}">${escape(label)}</text>`);
  });
  series.forEach((name,j) => {
    const points = rows.map(({values},i) => vertex(i,65 * values[j] / max));
    graphics.push(`<polygon class="mero-plot-radar ${tone(j)}" points="${points.map(([x,y])=>xy(x,y)).join(' ')}"/>`);
    points.forEach(([x,y],i) => graphics.push(mark(`<circle cx="${round(x)}" cy="${round(y)}" r="4"/>`, `${rows[i].label} · ${name}: ${format(rows[i].values[j])}`, j, j, i === 0 && j === 0)));
  });
  return {view:'0 0 390 200',graphics:graphics.join('')};
}

export function renderChart({type = 'line', title, caption = '', series, rows, locale = 'en', numberFormat = {maximumFractionDigits: 1}, axisNumberFormat}) {
  if (!chartTypes.has(type)) throw new TypeError('Unknown chart type');
  if (!Array.isArray(series) || !series.length || !Array.isArray(rows)) throw new TypeError('Charts require named series and rows');
  if (rows.some(row => !Array.isArray(row.values) || row.values.length !== series.length || !row.values.every(value => Number.isFinite(value) && value >= 0))) throw new TypeError('Each row needs a finite nonnegative value per series');
  const roundChart = type === 'pie' || type === 'radial';
  if (roundChart && series.length !== 1) throw new TypeError('Pie and radial charts accept one series');
  const format = new Intl.NumberFormat(locale, numberFormat).format;
  const formatAxis = axisNumberFormat ? new Intl.NumberFormat(locale, axisNumberFormat).format : format;
  const header = `<figcaption><strong>${escape(title)}</strong>${caption ? `<span>${escape(caption)}</span>` : ''}</figcaption>`;
  if (!rows.length) return `<figure class="mero-plot">${header}<p>No data for this period.</p></figure>`;
  const legend = roundChart ? rows.map(row=>row.label) : series;
  const zeroShare = roundChart && rows.every(row => row.values[0] === 0);
  let plot = '<p class="mero-plot-empty">All categories are zero for this period.</p>';
  if (!zeroShare) {
    const view = type === 'pie' ? pie(rows, series[0], format) : type === 'radial' ? radial(rows, series[0], format) : type === 'radar' ? radar(rows, series, format) : cartesian(type, rows, series, format, formatAxis);
    plot = `<svg viewBox="${view.view}" role="group" aria-label="${escape(title)}"><desc>Use the arrow keys to explore values. Open the data table for all values.</desc>${view.graphics}</svg>
    <span class="mero-plot-tooltip" data-mero-plot-tooltip aria-hidden="true" hidden></span>
    <div class="mero-plot-readout" data-mero-plot-readout>Inspect a point or use the arrow keys</div>`;
  }
  return `<figure class="mero-plot" data-mero-chart="${type}">
  ${header}
  <ul class="mero-plot-legend" aria-label="${roundChart ? 'Categories' : 'Series'}">${legend.map((name,i)=>`<li><i class="${tone(i)}" aria-hidden="true"></i>${escape(name)}</li>`).join('')}</ul>
  ${plot}
  <details class="mero-plot-data"><summary>View chart data</summary><div><table class="mero-table"><caption>${escape(title)}</caption><thead><tr><th scope="col">Category</th>${series.map(name=>`<th scope="col">${escape(name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row=>`<tr><th scope="row">${escape(row.label)}</th>${row.values.map(v=>`<td>${escape(format(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
</figure>`;
}
