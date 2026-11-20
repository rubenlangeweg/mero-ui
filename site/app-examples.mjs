export const showcaseApps = [
  { id: "dashboard", name: "Studio workspace", description: "Open a client, move their work on the board and book time with the team." },
  { id: "mail", name: "Mail", description: "Read, reply to and archive conversations in a shared inbox." },
  { id: "chat", name: "Chat", description: "Move between conversations and send a message to the team." },
  { id: "crm", name: "CRM", description: "Explore the sales pipeline and inspect individual opportunities." },
  { id: "finance", name: "Finance", description: "Review cash flow and the transactions behind each period." },
];

export const layouts = [...showcaseApps, {
  id: "settings", name: "Settings", description: "Manage workspace preferences and notification settings.",
}];

const paths = {
  dashboard: '<rect x="3" y="3" width="8" height="8" rx="1.4"/><rect x="15" y="3" width="6" height="5" rx="1.4"/><rect x="15" y="12" width="6" height="9" rx="1.4"/><rect x="3" y="15" width="8" height="6" rx="1.4"/>',
  mail: '<rect x="2.6" y="5" width="18.8" height="14" rx="2.6"/><path d="m3.3 6.4 7.5 6a2 2 0 0 0 2.4 0l7.5-6"/>',
  chat: '<path d="M20.7 11.3a8.7 8.7 0 0 1-8.8 8.7 10 10 0 0 1-3.3-.6L3 21l1.4-5.2a9 9 0 1 1 16.3-4.5Z"/><path d="M8 10h8m-8 4h5"/>',
  crm: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20m.8-15a3 3 0 0 1 0 6m1.2 3.2a4.5 4.5 0 0 1 3.5 4.4V20"/>',
  finance: '<path d="M3.5 3v16A1.5 1.5 0 0 0 5 20.5h16M7.5 14l4-4 3 2.5 6-7"/>',
  settings: '<path d="M3 7h9m4 0h5M3 17h3m4 0h11"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  back: '<path d="m10 6-6 6 6 6m-6-6h16"/>',
  open: '<path d="M6 18 18 6M7 6h11v11"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
};

function icon(id) {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;
}

function artwork(id) {
  return `<div class="app-gallery-art" aria-hidden="true"><div class="app-gallery-shot" style="--app-shot-light:url('/example-${id}-light.webp');--app-shot-dark:url('/example-${id}-dark.webp');--app-phone-light:url('/example-${id}-light-phone.webp');--app-phone-dark:url('/example-${id}-dark-phone.webp')"></div></div>`;
}

export function layoutGallery() {
  const [studio, ...examples] = layouts;
  return `<div class="app-gallery site-wrap">
    <header class="app-gallery-head"><h1>Application layouts</h1>
      <p>Explore complete, working interfaces built with Mero and HTMX.</p></header>
    <article id="example-dashboard" class="app-studio-feature app-color-dashboard">
      <div class="app-studio-intro"><h2>${studio.name}</h2><p>${studio.description}</p>
        <a class="mero-button mero-button-primary site-cta" href="/layouts/dashboard">Open workspace ${icon("open")}</a>
        <nav aria-label="Studio screens"><a href="/layouts/dashboard?view=companies">Companies</a><a href="/layouts/dashboard?view=board">Kanban board</a><a href="/layouts/dashboard?view=calendar">Bookings</a></nav>
      </div><a href="/layouts/dashboard" aria-label="Preview the Studio workspace">${artwork(studio.id)}</a>
    </article>
    <div class="app-gallery-grid">${examples.map(({ id, name, description }) => `
      <a id="example-${id}" href="/layouts/${id}" class="app-gallery-card app-color-${id}">
        ${artwork(id)}
        <div class="app-gallery-caption"><div><h2>${name}</h2><p>${description}</p></div>
          <span class="app-gallery-open">${icon("open")}</span></div>
      </a>`).join("")}</div>
    <a class="app-gallery-playground" href="/playground">Open the inventory playground ${icon("open")}</a>
  </div>`;
}

export function examplePage(screen, content, { after = "" } = {}) {
  const current = layouts.find(layout => layout.id === screen);
  return `<div class="app-example-page">
    <div class="app-example-bar"><a class="app-example-back" href="/layouts#example-${current.id}">${icon("back")} All layouts</a>
      <details class="app-example-chooser">
        <summary aria-label="Switch layout, current layout ${current.name}">${icon(current.id)}${current.name}${icon("down")}</summary>
        <nav class="app-example-tabs" aria-label="Application examples">${layouts.map(({ id, name }) => `
          <a href="/layouts/${id}"${screen === id ? ' aria-current="page"' : ""}>${icon(id)}${name}</a>`).join("")}</nav>
      </details>
    </div>
    <div class="app-example-stage" data-app-capture>${content}</div>
    ${after || `<a class="app-example-download" href="/downloads/mero-ui.tar.gz" download>Download Mero source <span aria-hidden="true">↓</span></a>`}
  </div>`;
}
