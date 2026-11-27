import { randomUUID } from "node:crypto";
import { escapeHtml as esc } from "./html.mjs";
import { communicationAssets, layoutWorkbench } from "./layout-workbench.mjs";
import { embeddedLayout, previewTheme } from "./shell.mjs";

const people = {
  mara: ["Mara Lind", "ML", "clay"],
  julian: ["Julian Park", "JP", "moss"],
  iris: ["Iris Chen", "IC", "sky"],
  sofia: ["Sofia Bell", "SB", "rose"],
  theo: ["Theo Sato", "TS", "sand"],
  you: ["You", "YO", "neutral"],
};

const mail = [
  { id:"proofs", person:"mara", subject:"The Field Notes proofs are in", time:"09:41", date:"Today", preview:"We’ve got the first set back from the printer.", body:["Hi team,", "We’ve got the first set back from the printer. The warm grey stock gives the cover photograph a softer edge. I’d keep it uncoated.", "Can we lock the paper choice before Thursday’s press check?", "Mara"], tag:"Field Notes" },
  { id:"materials", person:"julian", subject:"Material library update", time:"08:26", date:"Today", preview:"Two new finishes for the Arc collection.", body:["Morning,", "Two new finishes for the Arc collection arrived today. I’ve set aside a sample of each on the studio table.", "Drop by when you have a moment. I’d love a second pair of eyes on the brushed finish."], tag:"Materials" },
  { id:"bookings", person:"iris", subject:"November studio bookings", time:"Tue", date:"Tuesday", preview:"Here’s the revised plan for shoot week.", body:["Hi everyone,", "Here’s the revised plan for shoot week. Tuesday is reserved for product stills and Wednesday for the oak series.", "The studio is free again on Thursday afternoon."], tag:"Operations" },
  { id:"packing", person:"sofia", subject:"A note on the new packaging", time:"Mon", date:"Monday", preview:"The test cartons held up on their first trip.", body:["A quick update from dispatch. The test cartons held up on their first trip. All twelve pieces arrived in good order.", "I’ll bring the packing samples to our next review."], tag:"Dispatch" },
  { id:"samples", person:"theo", subject:"Archive shelf inventory", time:"Fri", date:"Friday", preview:"The sample shelf is ready for the handover.", body:["The sample shelf is ready for the handover. I’ve counted each finish and put a reference card in every tray.", "Thanks for helping with the labels."], tag:"Archive" },
];

const channels = [
  { id:"studio-floor", name:"studio-floor", description:"Daily work from the studio", members:["mara","julian","iris"], messages:[
    ["mara","09:32","The Field Notes proofs are on the big table. Here’s the cover photograph for reference."],
    ["julian","09:35","I put the oak and graphite samples beside them, so we can check all three together."],
    ["iris","09:41","I’ll take a look before the press check. Thanks for laying those out!"],
  ] },
  { id:"design-review", name:"design-review", description:"Materials, finishes and open design questions", members:["iris","theo","mara"], messages:[
    ["iris","10:12","The brushed finish is catching the light better than yesterday’s sample."],
    ["theo","10:18","Agreed. I’ll add it to the review tray with the original so we have a direct comparison."],
  ] },
  { id:"dispatch", name:"dispatch", description:"Shipping, packing and delivery updates", members:["sofia","julian"], messages:[
    ["sofia","08:15","All twelve pieces arrived safely. The new inserts did their job."],
    ["julian","08:22","That’s good to hear. Let’s use the same packing for the next run."],
  ] },
];
const directs = [
  { id:"mara", name:"Mara Lind", description:"Direct conversation", members:["mara"], messages:[["mara","09:14","Could you bring the paper swatches to Thursday’s press check?"]] },
  { id:"theo", name:"Theo Sato", description:"Direct conversation", members:["theo"], messages:[["theo","08:52","The reference cards are ready. I left them on your desk."]] },
];
const rooms = [...channels,...directs];
const paths = {
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  chat:'<path d="M3 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-1-2z"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8m-10 4h6"/>',
  inbox:'<path d="m3 13 3-8h12l3 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l2 3h4l2-3h5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  back:'<path d="m14 6-6 6 6 6"/>', send:'<path d="m4 5 16 7-16 7 3-7zm3 7h13"/>',
  reply:'<path d="m10 5-6 6 6 5m-6-5h9c5 0 7 3 7 7"/>', hash:'<path d="M9 3 6 21M17 3l-3 18M4 9h16M3 15h16"/>',
};
function icon(key) {
  return `<svg class="comm-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
}
function avatar(person, small = false) {
  const [,initials,color] = people[person];
  return `<span aria-hidden="true" class="mero-avatar comm-avatar comm-${color}${small?" comm-small":""}">${initials}</span>`;
}
function appUrl(screen, params = {}, fragment = false) {
  const query = new URLSearchParams(Object.entries(params).filter(([,v])=>v));
  return (fragment ? "/demo/layouts/" : "/layouts/") + screen + (query.size ? "?" + query : "");
}
function navigate(screen, params) {
  const url=esc(appUrl(screen,params));
  return `href="${url}" hx-get="${esc(appUrl(screen,params,true))}" hx-push-url="${url}"`;
}
function formAction(screen, action) {
  const url = `/demo/layouts/${screen}/${action}`;
  return `method="post" action="${url}" hx-post="${url}"`;
}
function hidden(name,value) { return `<input type="hidden" name="${name}" value="${esc(value)}">`; }
function feedback(error) { return `<p class="comm-error" data-mero-form-error role="alert"${error?"":" hidden"}>${esc(error)}</p>`; }
function coverAttachment() {
  return `<a class="comm-attachment" href="/studio-lamp.webp" download="field-notes-cover.webp" aria-label="Cover photograph WebP · 13 KB, download Field Notes cover">
    <img src="/studio-lamp.webp" alt="" width="72" height="52"><span><strong>Cover photograph</strong> <small>WebP · 13 KB</small></span>${icon("download")}</a>`;
}
function formState(options) {
  return { notice:"", focus:"", error:"", draft:"", ...options };
}
function draftMarker(id) {
  return ` <span class="comm-draft" data-comm-draft-for="${id}" hidden>Draft</span> `;
}
function frame(screen, title, address, detail, content, options, draftScope) {
  return `<section class="comm-frame" data-communication="${screen}" data-draft-scope="${draftScope}" data-mobile-view="${detail ? "detail" : "list"}" data-comm-focus="${esc(options.focus)}" hx-target:inherited="closest [data-communication]" hx-swap:inherited="outerHTML settle:0ms" hx-sync:inherited="closest [data-communication]:drop">
    <header class="comm-mast"><div class="comm-title">${icon(screen)}<h1>${title}</h1></div><span class="comm-identity">${address}</span></header>
    ${content}${options.notice ? `<p role="status" class="comm-notice">${esc(options.notice)}</p>` : ""}
  </section>`;
}

function mailScreen(state, params, options = {}) {
  const result=formState(options);
  const folder=params.get("folder")==="archive"?"archive":"inbox";
  const available=mail.filter(item => state.archived.has(item.id)===(folder==="archive"));
  const selected=available.find(item=>item.id===params.get("thread")) || available[0];
  if(selected && params.get("thread")===selected.id) state.read.add(selected.id);
  const rows=available.map(item=>`<a class="comm-mail-item" ${navigate("mail",{folder, thread:item.id})}${item===selected?' aria-current="true"':""}>
    ${avatar(item.person,true)}<span class="comm-mail-copy"><span class="comm-mail-line"><strong>${people[item.person][0]}</strong><span>${item.time}</span></span>
    <span class="comm-subject">${draftMarker(item.id)}${state.read.has(item.id)?"":'<i class="comm-unread" aria-hidden="true"></i><span class="comm-sr">Unread: </span>'}${item.subject}</span><span class="comm-snippet">${esc(state.replies.get(item.id)?.at(-1)?.text || item.preview)}</span></span></a>`).join("");
  const folders=[["inbox","Inbox",mail.length-state.archived.size],["archive","Archive",state.archived.size]];
  const sidebar=`<aside id="mail-message-list" class="comm-list" aria-label="Mail folders and messages"><nav class="comm-folders" aria-label="Mail folders">${folders.map(([id,name,count])=>`<a ${navigate("mail",{folder:id})}${folder===id?' aria-current="page"':""}>${icon(id)}${name}<span>${count}</span></a>`).join("")}</nav>
    <div class="comm-listing">${rows || '<p class="comm-list-empty">No messages in this folder.</p>'}</div></aside>`;
  const divider = `<div class="mero-ws-split-handle" role="separator" tabindex="0"
    aria-label="Resize message list" aria-controls="mail-message-list" aria-orientation="vertical"
    aria-valuemin="30" aria-valuemax="52" aria-valuenow="33"></div>`;
  let reader='<section class="comm-reader comm-empty"><p>Select a message to read it.</p></section>';
  if(selected) {
    const { id,person,tag,subject,date,time,body }=selected;
    const [name]=people[person];
    const label=folder==="archive"?"Move to inbox":"Archive";
    const replies=(state.replies.get(id)||[]).map(reply=>`<article class="comm-reply"><div>${avatar("you",true)}<strong>You</strong><time>${esc(reply.time)}</time></div><p>${esc(reply.text)}</p></article>`).join("");
    reader=`<section class="comm-reader" aria-label="Open message"><div class="comm-reader-bar">
      <a class="comm-back" ${navigate("mail",{folder})}>${icon("back")} Messages</a><span class="comm-tag"><i></i>${tag}</span>
      <form ${formAction("mail","move")} data-mero-form>${hidden("thread",id)}${hidden("folder",folder)}${hidden("destination",folder==="archive"?"inbox":"archive")}
        <button class="comm-text-action" type="submit">${icon(folder==="archive"?"inbox":"archive")}${label}</button>${feedback("")}</form></div>
      <div class="comm-letter"><h2 tabindex="-1" data-comm-heading>${subject}</h2>
      <div class="comm-byline">${avatar(person)}<span><strong>${name}</strong><small>To you</small></span><time>${date}${date==="Today"?" · "+time:""}</time></div>
      <div class="comm-letter-body">${body.map(line=>`<p>${line}</p>`).join("")}</div>${id==="proofs" ? coverAttachment() : ""}${replies}</div>
      <form class="comm-reply-form" ${formAction("mail","reply")} data-mero-form data-comm-compose="${id}">
        ${hidden("thread",id)}${hidden("folder",folder)}${hidden("nonce", randomUUID())}
        <label for="mail-reply">${icon("reply")}Reply to ${name.split(" ")[0]}</label>
        <textarea id="mail-reply" class="mero-textarea" name="message" rows="2" maxlength="1600" required placeholder="Write your reply…"${result.error?' aria-invalid="true" aria-describedby="mail-error"':""}>${esc(result.draft)}</textarea>
        <div id="mail-error">${feedback(result.error)}</div><button class="mero-button mero-button-primary mero-button-sm" type="submit">Send reply ${icon("send")}</button>
      </form></section>`;
  }
  return frame("mail","Studio mail","studio@north.example",Boolean(selected && params.has("thread")),
    `<div class="comm-split comm-mail-split" data-mero-ws-split data-mero-ws-snap data-mero-ws-snap-key="mail-reader">${sidebar}${divider}${reader}</div>`,result,state.draftScope);
}

function chatScreen(state, params, options={}) {
  const result=formState(options);
  const room=rooms.find(item=>item.id===params.get("room"))||rooms[0];
  const direct=directs.includes(room);
  function roomLink(entry, dm=false) {
    return `<a class="comm-room-link" ${navigate("chat",{room:entry.id})}${entry===room?' aria-current="true"':""}>${dm?avatar(entry.id,true):icon("hash")}<span>${entry.name}</span>${draftMarker(entry.id)}</a>`;
  }
  const sidebar=`<aside class="comm-chat-list" aria-label="Conversations"><h2>Channels</h2><nav aria-label="Channels">${channels.map(r=>roomLink(r)).join("")}</nav>
    <h2>Direct messages</h2><nav aria-label="Direct messages">${directs.map(r=>roomLink(r,true)).join("")}</nav></aside>`;
  const messages=[...room.messages,...(state.chat.get(room.id)||[]).map(reply=>["you",reply.time,reply.text])];
  const feed=messages.map(([person,time,text],index)=>`<li class="comm-message">${avatar(person,true)}<div><p class="comm-sender"><strong>${people[person][0]}</strong><time>${esc(time)}</time></p><p class="comm-text">${esc(text)}</p>${room.id==="studio-floor" && index===0 ? coverAttachment() : ""}</div></li>`).join("");
  const label=direct ? room.name : "#"+room.name;
  const main=`<section class="comm-chat" aria-label="Conversation"><div class="comm-chat-head"><a class="comm-back" ${navigate("chat",{view:"channels"})}>${icon("back")} Conversations</a>
      <div><h2 tabindex="-1" data-comm-heading>${direct?"":icon("hash")}${room.name}</h2><p>${room.description}</p></div>
      <span class="comm-members" role="img" aria-label="Participants: ${room.members.map(p=>people[p][0]).join(", ")}">${room.members.map(p=>avatar(p,true)).join("")}</span></div>
      <div class="comm-feed" tabindex="0" aria-label="Message history"><div class="comm-date"><span>Today</span></div>
      <ol>${feed}</ol></div><form ${formAction("chat","send")} class="comm-chat-compose" data-mero-form="keep-editable" data-comm-compose="${room.id}">
      ${hidden("room",room.id)}${hidden("nonce",randomUUID())}<label class="comm-sr" for="chat-message">Message ${label}</label>
      <textarea class="mero-textarea" id="chat-message" name="message" maxlength="1600" rows="2" placeholder="Message ${label}…" required${result.error?' aria-invalid="true" aria-describedby="chat-error"':""}>${esc(result.draft)}</textarea>
      <button type="submit" class="mero-button mero-button-primary mero-button-sm">Send ${icon("send")}</button><div id="chat-error">${feedback(result.error)}</div></form></section>`;
  return frame("chat","Team chat","North Studio",params.get("view")!=="channels",`<div class="comm-split comm-chat-split">${sidebar}${main}</div>`,result,state.draftScope);
}

function newSession() {
  return { draftScope:randomUUID(), archived:new Set(["samples"]), read:new Set(["proofs","packing","samples"]), replies:new Map(), chat:new Map() };
}
async function readBody(request) {
  let size=0; const chunks=[];
  for await (const chunk of request) {
    size+=chunk.length; if(size>24000) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export function createCommunicationLayouts() {
  const sessions=new Map();
  function getSession(request,response) {
    let key=request.headers.cookie?.match(/(?:^|;\s*)mero_comm=([a-f\d-]{36})(?:;|$)/)?.[1];
    let state=sessions.get(key);
    if(!state) {
      key=randomUUID(); state=newSession();
      response.appendHeader("Set-Cookie",`mero_comm=${key}; Path=/; HttpOnly; SameSite=Lax`);
    }
    sessions.delete(key);
    sessions.set(key,state);
    if(sessions.size>256) sessions.delete(sessions.keys().next().value);
    return state;
  }
  function draw(screen,state,params,options) { return screen==="mail" ? mailScreen(state,params,options) : chatScreen(state,params,options); }
  return {
    render(screen,request,response,params) { return draw(screen,getSession(request,response),params); },
    async handle(request,response,url) {
      const match=url.pathname.match(/^\/demo\/layouts\/(mail|chat)(?:\/(move|reply|send))?$/);
      if(!match) return false;
      const [,screen,action]=match;
      const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
      function send(html,status=200,extra={}) { response.writeHead(status,{...headers,...extra});response.end(html);return true; }
      if(!action && request.method==="GET") {
        const state=getSession(request,response);
        return send(draw(screen,state,url.searchParams,{focus:url.searchParams.has("thread")||url.searchParams.has("room")?"heading":"list"}));
      }
      if(request.method!=="POST" || !action) return send("Method not allowed.",405,{Allow:action?"POST":"GET"});
      const params=await readBody(request);
      if(!params) return send("Message is too large.",413);
      const standalone = !request.headers["hx-request"] && url.searchParams.get("embed") === "1";
      const theme = previewTheme(url.searchParams.get("theme"));
      const state=getSession(request,response);
      const room=screen==="mail"?mail.find(m=>m.id===params.get("thread")):rooms.find(r=>r.id===params.get("room"));
      if(!room || (screen==="mail" ? action==="send":action!=="send")) return send("Conversation not found.",404);
      let next=screen==="mail"?{folder:state.archived.has(room.id)?"archive":"inbox",thread:room.id}:{room:room.id};
      let notice, focus="composer";
      if(action==="move") {
        const archive=params.get("destination")==="archive";
        if(!archive && params.get("destination")!=="inbox") return send("Unknown destination.",400);
        if(archive) state.archived.add(room.id); else state.archived.delete(room.id);
        next={folder:archive?"inbox":"archive"}; notice=archive?"Message archived.":"Message moved to inbox."; focus="list";
      } else {
        const text=params.get("message")||"";
        const notes=screen==="chat"?state.chat:state.replies;
        const entries=notes.get(room.id)||[];
        const nonce=params.get("nonce")?.slice(0,64);
        const previous=nonce && entries.find(item=>item.nonce===nonce);
        let error;
        if(!text.trim() || text.length>1600) error="Enter a message between 1 and 1,600 characters.";
        else if(previous && previous.text!==text.trim()) error="The earlier message was sent. Review your changes before sending again.";
        if(error) {
          const content=draw(screen,state,new URLSearchParams(next),{error,draft:text,focus});
          if(request.headers["hx-request"]) return send(content,422);
          const assets = communicationAssets(screen);
          if(standalone) return send(embeddedLayout({ title: "Check your message", content, assets, mode: theme }), 422);
          return send(layoutWorkbench({ screen, title: "Check your message", content, assets, params: next, indexable: false }), 422);
        }
        if(!previous) {
          entries.push({text:text.trim(),time:new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(new Date()),nonce});
          notes.set(room.id,entries.slice(-50));
        }
        notice=screen==="chat"?"Message sent.":"Reply sent.";
      }
      const location=appUrl(screen,standalone ? { ...next, embed: "1", theme } : next);
      if(!request.headers["hx-request"]) return send("",303,{Location:location});
      return send(draw(screen,state,new URLSearchParams(next),{notice,focus}),200,{"HX-Replace-Url":location});
    },
  };
}
