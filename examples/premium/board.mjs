const root = "/premium/board";
const lanes = { backlog: "Backlog", progress: "In progress", done: "Done" };
const seed = [
  ["PLN-18", "Confirm launch quantities", "Buying", "AL", "backlog"],
  ["PLN-22", "Approve packaging proof", "Design", "ML", "backlog"],
  ["PLN-24", "Reconcile supplier prices", "Finance", "JS", "backlog"],
  ["PLN-13", "Photograph the spring range", "Studio", "ML", "progress"],
  ["PLN-16", "Review replenishment orders", "Buying", "AL", "progress"],
  ["PLN-09", "Publish the launch brief", "Planning", "JS", "done"],
];

function cardMarkup(card) {
  return `<li id="board-card-${card.id}" draggable="true" data-board-card="${card.id}" data-version="${card.version}" data-lane="${card.lane}">
    <span class="board-ref">${card.id}</span>
    <button type="button" id="board-move-${card.id}" data-board-move="${card.id}" aria-haspopup="dialog" aria-label="Move ${card.title}">${card.title}</button>
    <div class="board-meta"><span>${card.team}</span><span class="board-owner" aria-label="Owner ${{AL:"Alex Lin", ML:"Mina Lee", JS:"Jordan Singh"}[card.owner]}">${card.owner}</span></div>
  </li>`;
}

export function createFeature(saved) {
  const savedCards = new Map(saved?.cards?.map(card => [card.id,card]));
  const cards = seed.map(([id,title,team,owner,lane]) => {
    const previous = savedCards.get(id);
    return {id,title,team,owner,lane:previous?.lane ?? lane,version:previous?.version ?? 1};
  });
  const subscribers = new Set();
  let revision = saved?.revision ?? 1;

  function snapshot() {
    return {cards:cards.map(({id,lane,version}) => ({id,lane,version})), revision};
  }

  function columns() {
    return Object.entries(lanes).map(([key,label]) => {
      const members = cards.filter(card => card.lane === key);
      return `<section class="board-lane" data-drop-lane="${key}" aria-labelledby="board-label-${key}">
        <h3 id="board-label-${key}"><span class="board-dot"></span>${label}<span class="board-count">${members.length}</span></h3>
        <ul>${members.map(cardMarkup).join("")}</ul>
      </section>`;
    }).join("");
  }

  function render() {
    return `<section id="planning-board" data-revision="${revision}" data-board-events="${root}/events" aria-label="Shared planning board">
      <h1 class="board-title">Planning board</h1><div class="board-toolbar"><p>Drag a card or choose its title to move it.</p><div><span id="board-connection" role="status">Connecting…</span> <a href="${root}" target="_blank" rel="noopener">Open second board ↗</a></div></div>
      <div id="board-reader" hx-get="${root}/columns" hx-trigger="board-refresh" hx-target="#board-columns" hx-swap="innerMorph"></div>
      <div class="board-columns" id="board-columns">${columns()}</div>
      <p id="board-feedback" role="status" aria-live="polite" aria-atomic="true"></p>
      <dialog id="board-dialog" aria-labelledby="board-dialog-title">
        <form id="board-form" hx-post="${root}/move" hx-target="#board-columns" hx-swap="innerMorph" hx-status:409="swap:innerMorph target:#board-columns">
          <h3 id="board-dialog-title">Move card</h3>
          <p id="board-dialog-card"></p>
          <input type="hidden" name="id"><input type="hidden" name="version">
          <fieldset><legend>Destination</legend>${Object.entries(lanes).map(([key,label]) => `<label><input type="radio" name="lane" value="${key}" required> ${label}</label>`).join("")}</fieldset>
          <div class="board-actions"><button type="button" class="mero-button" id="board-cancel">Cancel</button><button type="submit" class="mero-button" data-variant="primary">Move card</button></div>
        </form>
      </dialog>
    </section>`;
  }

  function respond(res, status, msg = "") {
    res.writeHead(status, { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store", "X-Board-Revision":String(revision), "X-Board-Message":msg });
    res.end(columns());
  }

  async function handle(req,res,url) {
    if (req.method === "GET" && url.pathname === root + "/columns") return respond(res,200);
    if (req.method === "GET" && url.pathname === root + "/events") {
      res.writeHead(200, {"Content-Type":"text/event-stream", "Cache-Control":"no-store", "X-Accel-Buffering":"no"});
      res.write(`data: ${JSON.stringify({revision})}\n\n`);
      subscribers.add(res);
      const pulse = setInterval(() => res.write(": keepalive\n\n"), 20000);
      res.on("close", () => { clearInterval(pulse); subscribers.delete(res); });
      return;
    }
    if (req.method !== "POST" || url.pathname !== root + "/move") {
      res.writeHead(404); res.end(); return;
    }
    let data = "";
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 4096) { res.writeHead(413); res.end(); return; }
    }
    const values = new URLSearchParams(data);
    const card = cards.find(item => item.id === values.get("id"));
    const destination = values.get("lane");
    if (!card || !Object.hasOwn(lanes,destination)) return respond(res,400,"Unknown card or destination.");
    if (String(card.version) !== values.get("version")) {
      return respond(res,409, `Another edit moved ${card.title} to ${lanes[card.lane]}. Your move was not applied.`);
    }
    if (card.lane === destination) return respond(res,200,`${card.title} is already in ${lanes[destination]}.`);
    card.lane = destination;
    card.version++;
    revision++;
    const message = `${card.title} moved to ${lanes[destination]}.`;
    respond(res,200,message);
    for (const client of subscribers) client.write(`data: ${JSON.stringify({revision,message})}\n\n`);
  }
  return {render,handle,snapshot};
}
