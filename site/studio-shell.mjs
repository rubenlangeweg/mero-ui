import { escapeHtml as esc } from "./html.mjs";
import { studioLink } from "./studio-links.mjs";

const navigation = [
  ["Workspace", [["overview", "Overview"], ["companies", "Companies"], ["inventory", "Inventory"], ["settings", "Settings"]]],
  ["Planning", [["board", "Task board"], ["calendar", "Bookings"]]],
];

const paths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  companies: '<path d="M3 21h18M5 21V5l9-2v18m0-13h5v13M8 8h2M8 12h2M8 16h2"/>',
  inventory: '<path d="m12 2.8 8.5 4.8v8.8L12 21l-8.5-4.6V7.6L12 2.8Zm0 9 8.5-4.2M12 11.8 3.5 7.6M12 12v9M8 5l8.2 4.8"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2.4"/><path d="M8 8v7m4-7v4m4-4v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M7.5 3v4m9-4v4M3 10h18m-13 4h2m3 0h2"/>',
  settings: '<path d="M3 7h9m4 0h5M3 17h3m4 0h11"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  add: '<path d="M12 5v14m-7-7h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  studio: '<path d="m3 15.5 8.7-10L21 8l-8.8 10.3L3 15.5Zm5.1-5.9 9.3 2.6m-8.4 4.9 8.8-10.2"/>',
};

function icon(id) {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" height="18" width="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[id]}</svg>`;
}

export function renderStudioShell(view, content, studio, { params = new URLSearchParams(), brand = "Studio" } = {}) {
  const counts = { companies: studio.companies.length, board: studio.tasks.length };
  return `<div id="studio-workspace" class="mero-app studio-workspace" hx-history="false" data-studio-view="${esc(view)}">
    <aside class="mero-app-nav studio-nav">
      <a class="studio-identity" ${studioLink("overview", {}, params)} aria-label="${esc(brand)} workspace overview">
        <span class="studio-identity-mark">${icon("studio")}</span><span>${esc(brand)}<small>Team workspace</small></span>
      </a>
      <nav aria-label="Workspace">${navigation.map(([group, links]) => `<div class="studio-nav-group"><span class="studio-group-name">${group}</span>
        ${links.map(([id, name]) => `<a ${studioLink(id, {}, params)} ${id === view ? 'aria-current="page"' : ""}>
          ${icon(id)}<span>${name}</span>${counts[id] == null ? "" : `<small aria-hidden="true">${counts[id]}</small>`}
        </a>`).join("")}</div>`).join("")}
      </nav>
    </aside>
    <section class="mero-app-main studio-main" aria-label="Workspace content">${content}</section>
  </div>`;
}

const dayLabel = new Intl.DateTimeFormat("en", { weekday: "short" });
const monthLabel = new Intl.DateTimeFormat("en", { month: "short" });
const fullDate = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" });

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function weekDates(now) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7, 12);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12));
}

function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function duration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return [hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(" ") || "0h";
}

function metrics(studio, store, params) {
  const metrics = [
    ["board", "Open tasks", studio.tasks.filter(t => t.status !== "done").length, "Task board"],
    ["companies", "Client companies", studio.companies.length, "Company directory"],
    ["inventory", "Catalog items", store.products.length, "Inventory"],
  ];
  return `<dl class="studio-metrics">${metrics.map(([view, name, value, target]) =>
    `<div class="mero-stat studio-metric"><dt>${icon(view)}${name}</dt><dd><a ${studioLink(view, {}, params)} aria-label="${name}, ${value}. Open ${target}">${value}<span>${icon("arrow")}</span></a></dd></div>`).join("")}</dl>`;
}

function panelLink(view, label, params) {
  return `<a class="studio-panel-link" ${studioLink(view, {}, params)}>${label}${icon("arrow")}</a>`;
}

function schedule(studio, days, now, params, subheading) {
  const today = dateKey(now);
  const values = days.map(day => studio.bookings.filter(b => b.date === dateKey(day))
    .reduce((sum, b) => sum + minutes(b.end) - minutes(b.start), 0));
  const maximum = Math.max(60, ...values);
  const upcoming = studio.bookings.filter(b => b.date > today || (b.date === today && minutes(b.end) > now.getHours() * 60 + now.getMinutes()))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).slice(0, 3);
  return `<div class="studio-schedule-pair">
    <section class="studio-panel studio-schedule" aria-label="Weekly schedule">
      <header><${subheading}>Scheduled time</${subheading}><span>This week</span></header>
      <p class="studio-total-time">${duration(values.reduce((sum, n) => sum + n, 0))}<span>booked</span></p>
      <dl class="studio-week-chart" aria-label="Hours booked per day">
        ${days.map((day, i) => `<div${dateKey(day) === today ? ' data-today' : ""}>
          <dt><abbr title="${fullDate.format(day)}">${dayLabel.format(day)}</abbr></dt>
          <dd><span>${duration(values[i])}</span><i aria-hidden="true" style="--studio-column:${Math.round(100 * values[i] / maximum)}%"></i></dd>
        </div>`).join("")}
      </dl>
    </section>
    <section class="studio-panel studio-upcoming" aria-label="Upcoming bookings">
      <header><${subheading}>Upcoming bookings</${subheading}>${panelLink("calendar", "Calendar", params)}</header>
      ${upcoming.length ? `<ul>${upcoming.map(b => {
        const date = new Date(b.date + "T12:00:00");
        const company = studio.companies.find(c => c.id === b.companyId);
        return `<li><a class="studio-booking-entry" ${studioLink("calendar", { booking: b.id, week: b.date }, params)}>
          <time class="studio-date-stamp" datetime="${esc(b.date)}"><span>${monthLabel.format(date)}</span><b>${date.getDate()}</b></time>
          <span class="studio-entry-copy"><strong>${esc(b.title)}</strong><small>${esc(b.start)}–${esc(b.end)}${company ? ` · ${esc(company.name)}` : ""}</small></span>
        </a></li>`;
      }).join("")}</ul>` : `<p class="studio-empty">No upcoming bookings.</p>`}
    </section>
  </div>`;
}

export function renderStudioOverview(studio, store, params = new URLSearchParams(), { pageHeading = true } = {}) {
  const h = pageHeading ? "h1" : "h2";
  const subheading = pageHeading ? "h2" : "h3";
  const now = new Date();
  const active = studio.tasks.filter(t => t.status !== "done");
  return `<div class="studio-overview">
    <header class="studio-overview-head"><div><${h}>Workspace overview</${h}><p>${fullDate.format(now)}</p></div>
      <a class="mero-button mero-button-primary" ${studioLink("board", { compose: "task" }, params)}>${icon("add")} New task</a>
    </header>
    ${metrics(studio, store, params)}
    ${schedule(studio, weekDates(now), now, params, subheading)}
    <section class="studio-panel studio-assignment-panel" aria-label="Assigned work">
      <header><${subheading}>Assigned work</${subheading}>${panelLink("board", "All tasks", params)}</header>
      ${active.length ? `<ul>${active.slice(0, 4).map(task => {
        const company = studio.companies.find(c => c.id === task.companyId);
        const initials = task.owner.split(/\s+/).map(part => part[0]).slice(0, 2).join("");
        return `<li><a ${studioLink("board", { task: task.id }, params)}><span class="studio-task-id">${esc(task.id)}</span>
          <span class="studio-task-name">${esc(task.title)}</span><span class="studio-task-company">${esc(company?.name)}</span>
          <span class="studio-task-assignee"><span aria-hidden="true">${esc(initials)}</span><small>${esc(task.owner)}</small></span></a></li>`;
      }).join("")}</ul>` : `<p class="studio-empty">All tasks are complete.</p>`}
    </section>
  </div>`;
}
