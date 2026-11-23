import { createFeature as queue } from './queue.mjs';
import { createFeature as paste } from './paste.mjs';
import { createFeature as command } from './command.mjs';
import { createFeature as bulk } from './bulk.mjs';
import { createFeature as views } from './views.mjs';
import { createFeature as board } from './board.mjs';

export const factories = {queue, paste, command, bulk, views, board};
const workflows = {
  queue: ['Review queue', 'Approve three price changes in succession, undo the last one, then continue with the keyboard. On a phone, open a row to inspect the change.'],
  paste: ['Spreadsheet review', 'Load the sample price sheet, review the changes, correct the two invalid cells and commit the batch.'],
  command: ['Command menu', 'Select six records. Press ⌘K or Ctrl+K, choose Assign, go back with Backspace, then choose a teammate and press Enter.'],
  bulk: ['Bulk actions', 'Select the page, extend the selection to all matches, then exclude a record on each of two pages. Preview, apply and retry the three failures.'],
  views: ['Saved views', 'Open Low stock, change the filters, sort or visible columns. Save a copy and open its share link in a second browser. Try resetting a change.'],
  board: ['Planning board', 'Open this page in two windows. Move a card in one and watch the other update. Use the move control to do the same thing with the keyboard.']
};
export function shell(key, body) {
  const [title, instructions] = workflows[key] || ['Recorded walkthroughs', ''];
  const nav = Object.entries(workflows).map(([id,[name]]) =>
    '<a href="/premium/' + id + '"' + (id === key ? ' aria-current="page"' : '') + '>' + name + '</a>'
  ).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · Mero UI</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/mero.css">
    <link rel="stylesheet" href="/premium-assets/shell.css">${Object.hasOwn(factories,key) ? '<link rel="stylesheet" href="/premium-assets/' + key + '.css">' : ''}
    <script defer src="/vendor/htmx.min.js"></script><script defer src="/mero.js"></script>${Object.hasOwn(factories,key) ? '<script defer src="/premium-assets/' + key + '.js"></script>' : ''}
    </head><body><a class="pw-skip" href="#workflow">Skip to workflow</a><header class="pw-header"><div class="pw-header-inner">
    <a class="pw-brand" href="/"><img src="/mero-wordmark.svg" alt="Mero UI" width="102" height="32"></a>
    <span class="pw-header-title">Workflow demos</span>
    <div class="pw-tools"><a href="/premium/watch" ${key === 'watch' ? 'aria-current="page"' : ''}>Watch demos</a>
    ${instructions ? '<details class="pw-guide"><summary>Try this workflow</summary><p>' + instructions + '</p></details>' : ''}</div></div>
    <nav class="pw-nav" aria-label="Workflow demos">${nav}</nav></header>
    <main id="workflow" class="pw-main">${body}</main></body></html>`;
}

export const recordings = {...Object.fromEntries(Object.entries(workflows).map(([key, [name]]) => [key, name])), 'queue-mobile': 'Review queue on mobile'};

export function watchPage(url) {
  const requested = url.searchParams.get('demo');
  const key = Object.hasOwn(recordings, requested) ? requested : 'queue';
  const liveKey = key === 'queue-mobile' ? 'queue' : key;
  const choices = Object.entries(recordings).map(([id,name]) =>
    '<a href="/premium/watch?demo=' + id + '"' + (key === id ? ' aria-current="page"' : '') + '>' + name + '</a>').join('');
  return shell('watch', `<header class="pw-watch-head"><h1>Recorded walkthroughs</h1><a class="mero-button" href="/premium/${liveKey}">Try ${workflows[liveKey][0].toLowerCase()} ↗</a></header>
    <section class="pw-watch"><div><h2>${recordings[key]}</h2>
    <video aria-label="${recordings[key]} walkthrough" controls playsinline preload="auto" src="/recordings/${key}.webm#t=0.2">
    <track kind="captions" srclang="en" label="English" src="/recordings/${key}.vtt" default></video></div>
    <nav aria-label="Choose a recording">${choices}</nav></section>`);
}
