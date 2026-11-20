import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.mjs";

async function studioServer(t) {
  const server = createApp();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const appearance = "embed=1&theme=light";
  const headers = { "HX-Request": "true", "HX-Target": "studio-workspace" };
  return {
    base,
    get: async view => (await fetch(base + "/layouts/dashboard?" + appearance + "&" + view, { headers })).text(),
    post: (action, fields, native = false) => fetch(base + "/demo/studio/" + action + "?" + appearance, {
      method: "POST", headers: native ? {} : headers, body: new URLSearchParams(fields), redirect: "manual",
    }),
  };
}

test("a task belongs to the same company before and after a native move", async t => {
  const studio = await studioServer(t);
  const created = await studio.post("tasks", {
    operation: "create", title: "Review the workstation", description: "", companyId: "forma",
    owner: "Maya Chen", priority: "Normal", status: "active",
  });
  assert.equal(created.status, 200);
  const detail = new URL(created.headers.get("HX-Replace-Url"), studio.base);
  const id = detail.searchParams.get("task");
  assert.ok(id);
  assert.match(await studio.get("view=companies&company=forma"), /Review the workstation/);
  const move = await studio.post("tasks", { operation: "move", id, status: "done", openTask: "1" }, true);
  assert.equal(move.status, 303);
  const destination = new URL(move.headers.get("Location"), studio.base);
  assert.equal(destination.searchParams.get("embed"), "1");
  assert.equal(destination.searchParams.get("theme"), "light");
  const body = await (await fetch(destination)).text();
  assert.match(body, /<option value="done" selected>/);
  const profile = await studio.get("view=companies&company=forma");
  assert.match(profile, /Review the workstation<\/span><small[^>]*data-state="done"/);
});

test("editing a booking excludes itself from room conflicts and keeps company and agenda in sync", async t => {
  const studio = await studioServer(t);
  const fields = {
    title: "Workstation review", date: "2029-03-29", start: "13:00", end: "14:30",
    companyId: "forma", resource: "Studio A", owner: "Maya Chen", display: "agenda", companyFilter: "forma",
  };
  const created = await studio.post("bookings", fields);
  assert.equal(created.status, 200);
  const location = new URL(created.headers.get("HX-Replace-Url"), studio.base);
  const id = location.searchParams.get("booking");
  assert.ok(id);
  assert.equal(location.searchParams.get("display"), "agenda");
  const conflict = await studio.post("bookings", { ...fields, title: "Conflicting booking" });
  assert.equal(conflict.status, 422);
  assert.match(await conflict.text(), /already booked/);
  const updated = await studio.post("bookings", { ...fields, id, title: "Final workstation review" });
  assert.equal(updated.status, 200);
  assert.equal(new URL(updated.headers.get("HX-Replace-Url"), studio.base).searchParams.get("booking"), id);
  const profile = await studio.get("view=companies&company=forma");
  assert.match(profile, /Final workstation review/);
  assert.doesNotMatch(profile, /Conflicting booking/);
  const agenda = await studio.get(location.searchParams.toString());
  assert.match(agenda, /Final workstation review/);
});

test("both explicit calendar views survive period and company filters, booking edits, validation and native saves", async t => {
  const studio = await studioServer(t);
  for (const display of ["week", "agenda"]) {
    const fields = {
      title: "Review the schedule", date: "2029-03-29", start: "13:00", end: "14:30",
      companyId: "forma", companyFilter: "forma", owner: "Maya Chen", calendarWeek: "2029-03-26",
      resource: display === "week" ? "Studio A" : "The workshop", display,
    };
    const created = await studio.post("bookings", fields, true);
    assert.equal(created.status, 303);
    const location = new URL(created.headers.get("Location"), studio.base);
    assert.equal(location.searchParams.get("display"), display);
    assert.equal(location.searchParams.get("company"), "forma");
    const id = location.searchParams.get("booking");
    assert.ok(id);
    const detail = await studio.get(location.searchParams.toString());
    const calendarHrefs = [...detail.matchAll(/<a [^>]*?href="([^"]+)"/g)]
      .map(match => new URL(match[1].replaceAll("&amp;", "&"), studio.base).searchParams)
      .filter(query => query.get("view") === "calendar" && query.has("week"));
    assert.ok(calendarHrefs.some(query => query.get("week") !== fields.calendarWeek));
    assert.ok(calendarHrefs.some(query => query.get("company") === "arc"));
    assert.ok(calendarHrefs.some(query => query.get("edit") === "1"));
    const otherViews = calendarHrefs.filter(query => query.get("display") !== display);
    assert.equal(otherViews.length, 1);
    assert.equal(otherViews[0].get("booking"), id);
    assert.equal(otherViews[0].get("display"), display === "week" ? "agenda" : "week");
    const form = await studio.get(location.searchParams + "&edit=1");
    assert.match(form, new RegExp(`name="display" value="${display}"`));
    const invalid = await studio.post("bookings", { ...fields, id, end: "12:00" });
    assert.equal(invalid.status, 422);
    assert.match(await invalid.text(), new RegExp(`name="display" value="${display}"`));
    const saved = await studio.post("bookings", { ...fields, id, title: "Updated schedule" });
    assert.equal(saved.status, 200);
    const replaced = new URL(saved.headers.get("HX-Replace-Url"), studio.base);
    assert.equal(replaced.searchParams.get("booking"), id);
    assert.equal(replaced.searchParams.get("display"), display);
  }
});

test("company edits validate before changing shared data and keep a usable directory selection", async t => {
  const studio = await studioServer(t);
  const fields = { company: "tandem", industry: "Design", city: "Haarlem", employees: "92", q: "amsterdam" };
  assert.equal((await studio.post("companies", { ...fields, employees: "-2" })).status, 422);
  assert.doesNotMatch(await studio.get("view=companies&company=tandem"), /Haarlem/);
  const save = await studio.post("companies", fields);
  assert.equal(save.status, 200);
  const location = new URL(save.headers.get("HX-Replace-Url"), studio.base);
  assert.equal(location.searchParams.get("company"), "tandem");
  assert.equal(location.searchParams.has("q"), false);
  const found = await studio.get("view=companies&q=haarlem&company=tandem");
  assert.match(found, /92 employees/);
  assert.match(found, /Haarlem/);
});
