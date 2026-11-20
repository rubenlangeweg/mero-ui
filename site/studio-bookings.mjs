import { randomUUID } from "node:crypto";
import { escapeHtml as esc } from "./html.mjs";
import { studioForm, studioLink, studioUrl } from "./studio-links.mjs";

const resources = [
  { name: "Studio A", color: "blue" },
  { name: "The workshop", color: "amber" },
  { name: "Meeting room", color: "green" },
];

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const monthDay = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function utcDate(day) { return new Date(day + "T12:00:00Z"); }
function iso(date) { return date.toISOString().split("T")[0]; }
function validDay(day) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const stamp = utcDate(day);
  return Number.isFinite(stamp.valueOf()) && iso(stamp) === day;
}
function today() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}
function offset(day, days) {
  const date = utcDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}
function monday(day) { return offset(day, -(utcDate(day).getUTCDay() + 6) % 7); }
function minutes(time) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3)); }
function calendarDisplay(value) { return value === "week" || value === "agenda" ? value : undefined; }
function resourceColor(name) { return resources.find(item => item.name === name)?.color ?? "blue"; }
function weekLabel(week) {
  const first = utcDate(week);
  const last = utcDate(offset(week, 6));
  const start = first.getUTCFullYear() !== last.getUTCFullYear() ? monthDay.format(first) + " " + first.getUTCFullYear()
    : first.getUTCMonth() === last.getUTCMonth() ? first.getUTCDate() : monthDay.format(first);
  return `${start}–${monthDay.format(last)} ${last.getUTCFullYear()}`;
}

export function createStudioBookings() {
  const week = monday(today());
  const rows = [
    ["briefing", "Campaign briefing", "forma", 0, "09:00", "10:30", 0, "Uma Chen", "Review the spring campaign brief and agree on the first round of concepts."],
    ["materials", "Material study", "cinder", 0, "13:30", "15:00", 1, "Leo Stone", "Compare finish samples and select three options for the prototype."],
    ["prototypes", "Prototype review", "arc", 1, "10:00", "11:30", 1, "Ari Park", "Walk through the latest fixtures with the production team."],
    ["planning", "Sprint planning", "tandem", 1, "14:00", "15:00", 2, "Sol Reed", "Set the next delivery milestone and confirm owners."],
    ["lookbook", "Lookbook shoot", "stillwater", 2, "09:00", "11:30", 0, "Uma Chen", "Photograph the selected objects against the new paper backdrops."],
    ["handoff", "Identity handoff", "union", 2, "13:00", "14:30", 2, "Ari Park", "Hand over the final brand assets and review usage guidelines."],
    ["proofs", "Print proofs", "forma", 3, "10:30", "12:00", 1, "Leo Stone", "Check print proofs and sign off the production run."],
    ["editorial", "Editorial session", "arc", 3, "14:00", "16:00", 0, "Sol Reed", "Sequence the collection for the editorial spread."],
    ["review", "Weekly review", "tandem", 4, "09:30", "11:00", 2, "Sol Reed", "Review this week's work and unblock next week's deliverables."],
    ["pickup", "Sample pickup", "cinder", 4, "13:00", "14:00", 1, "Leo Stone", "Collect the approved samples for the client presentation."],
    ["kickoff", "Production kickoff", "forma", 7, "10:00", "11:30", 2, "Uma Chen", "Confirm the production calendar and hand over the approved layouts."],
    ["testing", "Surface testing", "arc", 8, "13:30", "15:00", 1, "Leo Stone", "Test finish durability and photograph the final sample set."],
    ["installation", "Installation check", "union", 5, "11:00", "12:30", 0, "Ari Park", "Check the placement and lighting before the space opens."],
  ];
  return rows.map(([id, title, companyId, day, start, end, room, owner, notes]) => ({
    id, title, companyId, date: offset(week, day), start, end, resource: resources[room].name, owner, notes,
  }));
}

function calendarOptions(studio, params) {
  const selected = studio.bookings.find(b => b.id === params.get("booking"));
  const company = studio.companies.find(c => c.id === params.get("company"));
  const requestedWeek = params.get("week");
  const week = monday(validDay(requestedWeek) ? requestedWeek : selected?.date ?? today());
  const display = calendarDisplay(params.get("display"));
  const base = { week, display, company: company?.id };
  const days = Array.from({ length: 7 }, (_, index) => offset(week, index));
  const bookings = studio.bookings.filter(b => days.includes(b.date) && (!company || b.companyId === company.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  const booking = bookings.find(b => b.id === selected?.id);
  const record = booking ? { booking: booking.id, edit: params.get("edit") === "1" ? "1" : undefined }
    : { new: params.get("new") === "1" ? "1" : undefined };
  const link = (changes = {}) => studioLink("calendar", { ...base, ...changes }, params);
  const agendaUrl = studioUrl("calendar", { ...base, ...record, display: "agenda" }, params);
  return { selected: booking, record, agendaUrl, company, week, link, params, display, mode: display ?? "week", days, bookings };
}

function toolbar(studio, opts) {
  const { company, link, mode, week, record } = opts;
  const menuItem = (id, name) => `<a ${link({ company: id })}${(company?.id ?? "") === id ? ' aria-current="true"' : ""}>${esc(name)}</a>`;
  const weekStep = direction => {
    const target = offset(week, direction * 7);
    const label = direction < 0 ? "Previous week" : "Next week";
    const attrs = `class="rl-button rl-button-sm rl-button-ghost rl-button-icon sbk-arrow${direction > 0 ? " sbk-forward" : ""}" aria-label="${label}"`;
    return validDay(target) ? `<a ${attrs} ${link({ week: target })}><i aria-hidden="true"></i></a>`
      : `<button ${attrs} disabled><i aria-hidden="true"></i></button>`;
  };
  return `<div class="sbk-toolbar">
    <div class="sbk-period">${weekStep(-1)}
    <a class="rl-button rl-button-sm rl-button-ghost" ${link({ week: monday(today()) })}>Today</a>
    ${weekStep(1)}</div>
    <details class="sbk-filter"><summary>${esc(company?.name ?? "All companies")}</summary>
    <div>${menuItem("", "All companies")}${studio.companies.map(c => menuItem(c.id, c.name)).join("")}</div></details>
    <nav class="sbk-modes" aria-label="Calendar view">${["week", "agenda"].map(value => `<a ${link({ ...record, display: value })} data-studio-display-choice="${value}"${value === mode ? ' aria-current="page"' : ""}>${value === "week" ? "Week" : "Agenda"}</a>`).join("")}</nav>
  </div>`;
}

// Overlapping sessions in different rooms share their day's width.
function layoutSessions(bookings) {
  const positioned = [];
  let cluster = [], ends = [], clusterEnd = 0;
  function finishCluster() {
    for (const item of cluster) positioned.push({ ...item, columns: ends.length });
    cluster = []; ends = []; clusterEnd = 0;
  }
  for (const booking of bookings) {
    const start = minutes(booking.start), end = minutes(booking.end);
    if (start >= clusterEnd && cluster.length) finishCluster();
    let column = ends.findIndex(value => value <= start);
    if (column === -1) column = ends.length;
    ends[column] = end;
    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ booking, start, end, column });
  }
  finishCluster();
  return positioned;
}

function sessionLink(booking, link, studio, attrs, inner) {
  const company = studio.companies.find(c => c.id === booking.companyId)?.name ?? "";
  const label = `${booking.title}, ${company}, ${booking.date}, ${booking.start} to ${booking.end}, ${booking.resource}`;
  return `<a ${link({ booking: booking.id })} data-room="${resourceColor(booking.resource)}" title="${esc(label)}" ${attrs}>${inner}</a>`;
}

function timeGrid(studio, { days, bookings, link, selected }) {
  const startHour = Math.min(9, ...bookings.map(b => Number(b.start.slice(0, 2))));
  const endHour = Math.max(17, ...bookings.map(b => Math.ceil(minutes(b.end) / 60)));
  const hours = endHour - startHour;
  const current = today();
  return `<div class="sbk-grid-scroll" role="region" aria-label="Weekly booking calendar" tabindex="0">
    <div class="sbk-week" style="--sbk-hours:${hours}">
      <div class="sbk-grid-key"><span>Time</span></div>
      ${days.map(day => `<div class="sbk-day-label"${day === current ? ' data-today aria-current="date"' : ""}><span>${weekday.format(utcDate(day))}</span><strong>${utcDate(day).getUTCDate()}</strong></div>`).join("")}
      <div class="sbk-time-axis" aria-hidden="true">${Array.from({ length: hours }, (_, i) => `<span>${String(startHour + i).padStart(2, "0")}:00</span>`).join("")}</div>
      ${days.map((day, i) => `<div class="sbk-day" role="group" aria-label="${fullDate.format(utcDate(day))}"${day === current ? " data-today" : ""}${i >= 5 ? " data-weekend" : ""}>
        ${layoutSessions(bookings.filter(b => b.date === day)).map(({ booking, start, end, column, columns }) => {
          const selectedAttr = selected?.id === booking.id ? ' aria-current="true"' : "";
          const styles = `--sbk-start:${(start - startHour * 60) / 60};--sbk-duration:${(end - start) / 60};--sbk-column:${column};--sbk-columns:${columns}`;
          return sessionLink(booking, link, studio, `class="sbk-session" style="${styles}" ${selectedAttr}`,
            `<strong>${esc(booking.title)}</strong><small>${esc(booking.start)}–${esc(booking.end)}</small>`);
        }).join("")}</div>`).join("")}
    </div></div>`;
}

function agenda(studio, { bookings, days, link, selected }) {
  return `<div class="sbk-agenda">${days.map(day => {
    const sessions = bookings.filter(b => b.date === day);
    if (!sessions.length) return "";
    return `<section aria-label="${fullDate.format(utcDate(day))}"><div class="sbk-agenda-day"><strong>${monthDay.format(utcDate(day))}</strong><span>${weekday.format(utcDate(day))}</span></div>
    <div class="sbk-agenda-sessions">${sessions.map(booking => sessionLink(booking, link, studio, `class="sbk-agenda-row"${selected?.id === booking.id ? ' aria-current="true"' : ""}`,
      `<time datetime="${esc(day)}T${esc(booking.start)}">${esc(booking.start)}–${esc(booking.end)}</time><span><strong>${esc(booking.title)}</strong><small>${esc(studio.companies.find(c => c.id === booking.companyId)?.name)}</small></span><span class="sbk-room-label">${esc(booking.resource)}</span>`)).join("")}</div></section>`;
  }).join("")}</div>`;
}

function bookingDetail(studio, { selected: b, link, params, sectionHeading }) {
  const company = studio.companies.find(c => c.id === b.companyId);
  return `<section class="sbk-detail" aria-label="Booking details" data-room="${resourceColor(b.resource)}"><div class="sbk-detail-top"><div><span class="sbk-room-label">${esc(b.resource)}</span><${sectionHeading} tabindex="-1" data-studio-initial-focus>${esc(b.title)}</${sectionHeading}></div><div class="sbk-detail-actions"><a class="rl-button rl-button-secondary rl-button-sm" ${link({ booking: b.id, edit: "1" })}>Edit booking</a><a class="rl-button rl-button-sm rl-button-ghost" ${link({})}>Close details</a></div></div>
    <p>${fullDate.format(utcDate(b.date))} · ${esc(b.start)}–${esc(b.end)}</p>
    <dl><div><dt>Company</dt><dd><a ${studioLink("companies", { company: b.companyId }, params)}>${esc(company?.name ?? b.companyId)}</a></dd></div><div><dt>Host</dt><dd>${esc(b.owner)}</dd></div></dl>
    ${b.notes ? `<p>${esc(b.notes)}</p>` : ""}
  </section>`;
}

function bookingForm(studio, { link, params, company, days, week, display, sectionHeading }, values, error) {
  const v = key => String(values?.get?.(key) ?? values?.[key] ?? "");
  const options = (items, selected) => items.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  const defaultDay = days.includes(today()) ? today() : week;
  const bookingId = v("id");
  const title = bookingId ? "Edit booking" : "New booking";
  return `<form class="sbk-form" ${studioForm("/demo/studio/bookings", params)} aria-labelledby="studio-booking-form">
    <div class="sbk-form-head"><${sectionHeading} id="studio-booking-form">${title}</${sectionHeading}><a class="rl-button rl-button-ghost rl-button-sm" ${link(bookingId ? { booking: bookingId } : {})}>Cancel</a></div>
    ${error ? `<p class="rl-field-error" role="alert">${esc(error)}</p>` : ""}
    ${bookingId ? `<input type="hidden" name="id" value="${esc(bookingId)}">` : ""}
    <input type="hidden" name="calendarWeek" value="${esc(week)}">
    ${display ? `<input type="hidden" name="display" value="${display}">` : ""}
    ${company ? `<input type="hidden" name="companyFilter" value="${esc(company.id)}">` : ""}
    <div class="sbk-fields">
      <label class="rl-field sbk-wide"><span class="rl-label">Booking name</span><input class="rl-input" name="title" data-studio-initial-focus value="${esc(v("title"))}" maxlength="80" required></label>
      <label class="rl-field"><span class="rl-label">Company</span><select class="rl-select" name="companyId" required>${options(studio.companies.map(c => [c.id, c.name]), v("companyId") || company?.id)}</select></label>
      <label class="rl-field"><span class="rl-label">Room</span><select name="resource" class="rl-select" required>${options(resources.map(r => [r.name, r.name]), v("resource"))}</select></label>
      <label class="rl-field"><span class="rl-label">Date</span><input type="date" class="rl-input" name="date" min="0001-01-01" max="9999-12-31" value="${esc(v("date") || defaultDay)}" required></label>
      <label class="rl-field"><span class="rl-label">Host</span><input class="rl-input" name="owner" value="${esc(v("owner") || "Studio team")}" maxlength="60" required></label>
      <label class="rl-field"><span class="rl-label">Starts at</span><input type="time" class="rl-input" name="start" value="${esc(v("start") || "10:00")}" required></label>
      <label class="rl-field"><span class="rl-label">Ends at</span><input type="time" class="rl-input" name="end" value="${esc(v("end") || "11:00")}" required></label>
      <label class="rl-field sbk-wide"><span class="rl-label">Notes <small>(optional)</small></span><textarea class="rl-textarea" name="notes" maxlength="500" rows="2">${esc(v("notes"))}</textarea></label>
    </div><button class="rl-button rl-button-primary rl-button-sm" type="submit">${bookingId ? "Save changes" : "Create booking"}</button>
  </form>`;
}

export function renderStudioBookings(studio, params, { error = "", values = {}, pageHeading = true } = {}) {
  const opts = { ...calendarOptions(studio, params), sectionHeading: pageHeading ? "h2" : "h3" };
  const { week, link, bookings, mode, selected } = opts;
  const editing = selected && params.get("edit") === "1";
  const showForm = editing || params.get("new") === "1" || Boolean(error);
  const heading = pageHeading ? "h1" : "h2";
  const rooms = new Set(bookings.map(b => b.resource)).size;
  return `<section class="sbk-calendar" aria-label="Bookings" data-studio-screen="calendar"${!opts.display && !error ? ` data-studio-default-url="${esc(opts.agendaUrl)}"` : ""}>
    <header class="rl-page-head sbk-head"><div><${heading}>Bookings</${heading}><p>${weekLabel(week)}</p></div>
      <a class="rl-button rl-button-primary rl-button-sm" ${link({ new: "1" })}><span class="sbk-plus" aria-hidden="true">+</span>New booking</a></header>
    ${showForm ? bookingForm(studio, opts, editing && !error ? selected : values, error) : selected ? bookingDetail(studio, opts) : ""}
    ${toolbar(studio, opts)}
    <div class="sbk-schedule"><div class="sbk-caption"><strong>${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}${rooms ? ` <span>· ${rooms} ${rooms === 1 ? "room" : "rooms"}</span>` : ""}</strong><div class="sbk-legend">${resources.map(r => `<span data-room="${r.color}" class="sbk-room-label">${r.name}</span>`).join("")}</div></div>
      ${mode === "week" ? timeGrid(studio, opts) : agenda(studio, opts)}
      ${!bookings.length ? `<div class="sbk-empty"><strong>No bookings this week</strong><a ${link({ new: "1" })}>Book a room</a></div>` : ""}
    </div></section>`;
}

export function mutateStudioBooking(studio, form) {
  const read = key => String(form?.get?.(key) ?? form?.[key] ?? "").trim();
  const title = read("title"), companyId = read("companyId"), date = read("date"), start = read("start"), end = read("end");
  const resource = read("resource"), owner = read("owner"), notes = read("notes");
  const id = read("id");
  const existing = studio.bookings.find(b => b.id === id);
  const display = calendarDisplay(read("display"));
  const companyFilter = studio.companies.find(c => c.id === read("companyFilter"));
  const invalid = error => ({ error, params: { display, week: validDay(read("calendarWeek")) ? read("calendarWeek") : undefined, company: companyFilter?.id, ...(id ? { booking: id, edit: "1" } : { new: "1" }) } });
  if (id && !existing) return invalid("This booking is no longer available.");
  if (!title || title.length > 80) return invalid("Enter a booking name of up to 80 characters.");
  if (!studio.companies.some(c => c.id === companyId)) return invalid("Choose a company from the workspace.");
  if (!resources.some(r => r.name === resource)) return invalid("Choose a room from the list.");
  if (!validDay(date)) return invalid("Choose a valid booking date.");
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(start) || !time.test(end) || end <= start) return invalid("Choose an end time later than the start time on the same day.");
  if (!owner || owner.length > 60) return invalid("Enter a host name of up to 60 characters.");
  if (notes.length > 500) return invalid("Keep booking notes to 500 characters or fewer.");
  if (studio.bookings.some(b => b.id !== id && b.date === date && b.resource === resource && b.start < end && start < b.end)) {
    return invalid(`${resource} is already booked at that time. Choose another room or time.`);
  }
  const booking = { id: existing?.id ?? randomUUID(), title, companyId, date, start, end, resource, owner, notes };
  if (existing) Object.assign(existing, booking);
  else studio.bookings.push(booking);
  return { params: { display, week: monday(date), booking: booking.id, ...(companyFilter && { company: companyId }) } };
}
