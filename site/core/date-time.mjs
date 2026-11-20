import { field, item, section } from "./helpers.mjs"

function rangeFields(id, label) {
  return `
    <fieldset class="mero-fieldset mero-date-range">
      <legend class="mero-label">${label}</legend>
      <div class="mero-date-range-fields">
        ${field(`${id}-start`, "Start date", 'name="start"', { type: "date" }).trim()}
        ${field(`${id}-end`, "End date", 'name="end"', { type: "date" }).trim()}
      </div>
    </fieldset>`
}

const longDate = new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" })
const longMonth = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function calendarMonth(value) {
  const [year, month] = value.split("-").map(Number)
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && year >= 1900 && year <= 2199
    ? new Date(Date.UTC(year, month - 1, 1))
    : new Date()
}

export function calendarMarkup(params = new URLSearchParams()) {
  const today = new Date().toISOString().slice(0, 10)
  const month = calendarMonth(params.get("month") ?? "")
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const leading = (first.getUTCDay() + 6) % 7
  const rows = Math.ceil((leading + count) / 7)
  const current = first.toISOString().slice(0, 7)
  const selected = params.get("selected") ?? ""
  const validSelection = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(selected)
    && Number.isFinite(Date.parse(selected))
    && new Date(selected).toISOString().startsWith(selected)
  const selection = validSelection ? selected : ""
  const monthLabel = longMonth.format(first)
  const action = (target, date = selection) =>
    `hx-get="/demo/catalog/calendar?month=${target}${date ? `&amp;selected=${date}` : ""}" hx-target="closest .mero-calendar" hx-swap="outerHTML"`

  function changeMonth(label, delta) {
    const target = new Date(Date.UTC(year, monthIndex + delta, 1)).toISOString().slice(0, 7)
    const disabled = target < "1900-01" || target > "2199-12"
    return `<button class="mero-button mero-button-sm mero-button-ghost mero-button-icon" type="button" id="calendar-${delta < 0 ? "prev" : "next"}"
      aria-label="${label} month" ${disabled ? "disabled" : action(target)}>${delta < 0 ? "‹" : "›"}</button>`
  }

  const weeks = Array.from({length: rows}, (_, row) => {
    const days = weekdays.map((_, column) => {
      const day = row * 7 + column - leading + 1
      if (day < 1 || day > count) return "<td></td>"
      const date = `${current}-${String(day).padStart(2, "0")}`
      const pressed = date === selection
      return `<td><button class="mero-button mero-button-sm mero-calendar-day mero-button-${pressed ? "primary" : "ghost"}" type="button"
        id="calendar-day-${day}" aria-label="${longDate.format(new Date(date))}" aria-pressed="${pressed}"${date === today ? ' aria-current="date"' : ""}
        ${action(current, date)}>${day}</button></td>`
    })
    return `<tr>${days.join("")}</tr>`
  })
  return `
    <div id="demo-calendar" class="mero-calendar">
      <div class="mero-toolbar">
        ${changeMonth("Previous", -1)}
        <strong id="demo-calendar-month">${monthLabel}</strong>
        ${changeMonth("Next", 1)}
      </div>
      <table class="mero-calendar-table" aria-labelledby="demo-calendar-month">
        <thead><tr>${weekdays.map(day => `<th scope="col">${day}</th>`).join("")}</tr></thead>
        <tbody>${weeks.join("\n          ")}</tbody>
      </table>
      <p class="mero-description" role="status">${selection ? `Selected ${longDate.format(new Date(selection))}` : "Choose a day."}</p>
    </div>`
}

export const groups = [
  section("Date and time", [
    item("calendar", "Calendar", "Navigate months and choose a day on an inline calendar rendered by the server.", calendarMarkup(),
      "HTMX sends the displayed month and selected date. The server returns the same calendar markup with the updated state."),
    item("date-field", "Date Field", "Enter a calendar date in the system’s preferred format.",
      field("demo-date-field", "Due date", 'name="due"', { type: "date" })),
    item("date-picker", "Date Picker", "Choose a date with the browser’s calendar picker and native constraints.",
      field("demo-date-picker", "Start date", 'name="start" min="2026-01-01" max="2027-12-31"', { type: "date", hint: "Select a date in 2026 or 2027." }),
      "Use min and max for native bounds. Apply the same rules on the server."),
    item("date-range-picker", "Date Range Picker", "Collect the start and end dates of a range.",
      rangeFields("demo-date-range", "Reporting period"),
      "This composition submits two native dates. Validate that the end date is on or after the start date."),
    item("range-calendar", "Range Calendar", "Build a range with two native calendar controls.",
      rangeFields("demo-range-calendar", "Release window"),
      "This example uses two independent picker surfaces."),
    item("time-field", "Time Field", "Choose a wall-clock time without a timezone conversion.",
      field("demo-time", "Publish time", 'name="time" step="60" value="09:30"', { type: "time" }),
      "Store the intended timezone separately when scheduling an event."),
  ]),
]
