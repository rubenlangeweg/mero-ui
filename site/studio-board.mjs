import { escapeHtml as esc } from './html.mjs';
import { studioLink, studioForm, studioUrl } from './studio-links.mjs';

export const studioTaskStages = { backlog: 'Backlog', active: 'In progress', review: 'In review', done: 'Done' };

const owners = ['Maya Chen', 'Jon Bell', 'Eli Rivera'];
const priorities = ['Normal', 'High', 'Low'];

export function createStudioTasks() {
  return [
    ['ST-101', 'Map the flagship customer journey', 'cinder', 'backlog', 'Jon Bell', 'Normal', 'Walk the shop floor with Sofia and capture the touchpoints between arrival and checkout.'],
    ['ST-102', 'Specify the acoustic panels', 'tandem', 'backlog', 'Eli Rivera', 'Low', 'Compare the two acoustic samples against the brief for the member lounge.'],
    ['ST-103', 'Price the first retail rollout', 'forma', 'active', 'Maya Chen', 'High', 'Prepare a cost breakdown for the first three stores, including delivery and installation.'],
    ['ST-104', 'Refine the identity lockups', 'arc', 'active', 'Jon Bell', 'Normal', 'Prepare the horizontal and stacked lockups for the next review with Theo.'],
    ['ST-105', 'Check the fixture clearances', 'stillwater', 'active', 'Eli Rivera', 'Normal', 'Check the showroom measurements against the latest joinery drawings.'],
    ['ST-106', 'Sign off the material samples', 'union', 'review', 'Eli Rivera', 'High', 'Review the hospitality sample board with purchasing before releasing the order.'],
    ['ST-107', 'Approve the storefront elevations', 'forma', 'review', 'Maya Chen', 'Normal', 'Collect the retail team’s final approval on the revised street-facing elevations.'],
    ['ST-108', 'Issue the showroom survey', 'stillwater', 'done', 'Maya Chen', 'Normal', 'Send the measured survey and annotated photos to the installation team.'],
    ['ST-109', 'Deliver the concept deck', 'arc', 'done', 'Jon Bell', 'Low', 'Share the agreed creative direction and workshop notes with the client.'],
  ].map(([id, title, companyId, status, owner, priority, description]) => ({ id, title, companyId, status, owner, priority, description }));
}

function getValue(values, key) {
  return values instanceof URLSearchParams ? values.get(key) ?? '' : values[key] ?? '';
}

function options(entries, value) {
  return entries.map(([id, label]) => `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

function avatar(owner) {
  const initials = owner.split(' ').map(word => word.charAt(0)).join('');
  return `<span aria-hidden="true" class="stb-avatar" data-owner="${owners.indexOf(owner)}">${esc(initials)}</span>`;
}

function stage(status) {
  return `<span class="stb-stage-symbol" data-stage="${esc(status)}" aria-hidden="true"></span>`;
}

function priorityLabel(priority) {
  return `<span class="stb-priority" data-priority="${esc(priority)}" aria-label="${esc(priority)} priority"><i aria-hidden="true"><b></b><b></b><b></b></i>${esc(priority)}</span>`;
}

function card(task, companyName, scope, subheading, params) {
  return `<article class="stb-card" draggable="true" data-studio-task="${esc(task.id)}" aria-labelledby="task-${esc(task.id)}">
    <div class="stb-card-meta"><span class="stb-ref">${esc(task.id)}</span>${priorityLabel(task.priority)}</div>
    <${subheading} class="stb-card-title"><a id="task-${esc(task.id)}" ${studioLink('board', { ...scope, task: task.id }, params)}>${esc(task.title)}</a></${subheading}>
    <div class="stb-card-footer"><a class="stb-company" ${studioLink('companies', { company: task.companyId }, params)}>${esc(companyName)}</a><span class="stb-card-owner" title="${esc(task.owner)}">${avatar(task.owner)}<span class="stb-sr">${esc(task.owner)}</span></span></div>
  </article>`;
}

function list(tasks, names, scope, params) {
  if (!tasks.length) return '<p class="stb-empty">No tasks</p>';
  return `<section class="stb-list" aria-label="Task list">
    <div class="stb-list-header" aria-hidden="true"><span>Task</span><span>Status</span><span>Owner</span></div>
    <ul>${tasks.map(task => `<li>
      <div class="stb-list-task"><a ${studioLink('board', { ...scope, task: task.id }, params)}>${esc(task.title)}</a>
        <small>${esc(task.id)} · ${esc(names.get(task.companyId))}</small></div>
      <span class="stb-list-status">${stage(task.status)}${esc(studioTaskStages[task.status])}</span>
      <span class="stb-list-owner">${avatar(task.owner)}${esc(task.owner)}</span>
    </li>`).join('')}</ul>
  </section>`;
}

function scopeFields(scope) {
  return `<input type="hidden" name="company" value="${esc(scope.company)}"><input type="hidden" name="display" value="${esc(scope.display)}">`;
}

function readout(studio, task, scope, params) {
  const company = studio.companies.find(item => item.id === task.companyId);
  return `<article class="stb-inspector" aria-label="Task details">
    <div class="stb-inspector-main">
      <div class="stb-card-meta"><span class="stb-ref">${esc(task.id)}</span>${priorityLabel(task.priority)}</div>
      <p class="stb-inspector-title" tabindex="-1" data-studio-initial-focus>${esc(task.title)}</p>
      ${task.description ? `<p class="stb-description">${esc(task.description)}</p>` : ''}
      <div class="stb-detail-links"><span>${avatar(task.owner)} ${esc(task.owner)}</span>
        <a class="stb-company" ${studioLink('companies', { company: task.companyId }, params)}>${esc(company?.name)} <span aria-hidden="true">↗</span></a></div>
    </div>
    <div class="stb-inspector-controls"><form ${studioForm('/demo/studio/tasks', params)}>
      <input type="hidden" name="operation" value="move"><input type="hidden" name="id" value="${esc(task.id)}">
      ${scopeFields(scope)}<input type="hidden" name="openTask" value="1">
      <label class="mero-field"><span class="mero-label" id="stb-move-status-label">Task status</span><select class="mero-select" aria-labelledby="stb-move-status-label" name="status">${options(Object.entries(studioTaskStages), task.status)}</select></label>
      <p class="stb-error" role="alert" data-mero-form-error hidden></p>
      <button class="mero-button mero-button-primary" type="submit">Save status</button>
    </form><a class="stb-back" ${studioLink('board', scope, params)}>Back to ${scope.display === 'list' ? 'list' : 'board'}</a></div>
  </article>`;
}

function composer(studio, scope, params, values, error) {
  const value = key => getValue(values, key);
  const company = value('companyId') || scope.company || '';
  const pairs = items => items.map(item => [item, item]);
  return `<section class="stb-compose" aria-label="New task">
    <form ${studioForm('/demo/studio/tasks', params)}>
      <input type="hidden" name="operation" value="create">${scopeFields(scope)}
      <label class="mero-field stb-wide"><span class="mero-label">Task title</span><input id="studio-task-title" data-studio-initial-focus class="mero-input" name="title" required maxlength="100" value="${esc(value('title'))}"></label>
      <label class="mero-field"><span class="mero-label" id="stb-company-label">Company</span><select class="mero-select" aria-labelledby="stb-company-label" name="companyId" required>${options([['','Choose a company'], ...studio.companies.map(item => [item.id, item.name])], company)}</select></label>
      <label class="mero-field"><span class="mero-label" id="stb-owner-label">Owner</span><select class="mero-select" aria-labelledby="stb-owner-label" name="owner">${options(pairs(owners), value('owner') || owners[0])}</select></label>
      <label class="mero-field"><span class="mero-label" id="stb-stage-label">Status</span><select class="mero-select" aria-labelledby="stb-stage-label" name="status">${options(Object.entries(studioTaskStages), value('status') || params.get('stage') || 'backlog')}</select></label>
      <label class="mero-field"><span class="mero-label" id="stb-priority-label">Priority</span><select class="mero-select" aria-labelledby="stb-priority-label" name="priority">${options(pairs(priorities), value('priority') || 'Normal')}</select></label>
      <label class="mero-field stb-wide"><span class="mero-label">Description <small>(optional)</small></span><textarea class="mero-input" rows="2" name="description" maxlength="600">${esc(value('description'))}</textarea></label>
      <p class="stb-error stb-wide" role="alert" data-mero-form-error${error ? '' : ' hidden'}>${esc(error)}</p>
      <div class="stb-actions stb-wide"><button class="mero-button mero-button-primary" type="submit">Create task</button><a class="mero-button mero-button-ghost" ${studioLink('board', scope, params)}>Cancel</a></div>
    </form>
  </section>`;
}

function lanes(tasks, names, scope, params, laneHeading, cardHeading, newTask) {
  return `<div class="stb-lanes" data-studio-lanes>
      ${Object.entries(studioTaskStages).map(([id, label]) => {
        const items = tasks.filter(task => task.status === id);
        return `<section class="stb-lane" data-studio-lane="${id}" aria-label="${label}">
          <header class="stb-lane-head"><${laneHeading}>${stage(id)}${label} <span class="stb-count">${items.length}</span></${laneHeading}><a class="stb-add" ${newTask(id)} aria-label="Add task to ${label}">+</a></header>
          <div class="stb-cards">${items.length ? items.map(task => card(task, names.get(task.companyId), scope, cardHeading, params)).join('') : '<p class="stb-empty">No tasks</p>'}</div>
        </section>`;
      }).join('')}</div>
      <form data-stb-move ${studioForm('/demo/studio/tasks', params)}><input type="hidden" name="operation" value="move">${scopeFields(scope)}<input type="hidden" name="id"><input type="hidden" name="status"><p class="stb-error" role="alert" data-mero-form-error hidden></p></form>`;
}

export function renderStudioBoard(studio, params, { error = '', values = {}, pageHeading = true } = {}) {
  const heading = pageHeading ? 'h1' : 'h2';
  const laneHeading = pageHeading ? 'h2' : 'h3';
  const cardHeading = pageHeading ? 'h3' : 'h4';
  const company = studio.companies.find(item => item.id === params.get('company'));
  const listView = params.get('display') === 'list';
  const display = { display: listView ? 'list' : 'board' };
  const scope = company ? { ...display, company: company.id } : display;
  const tasks = company ? studio.tasks.filter(task => task.companyId === company.id) : studio.tasks;
  const selected = tasks.find(task => task.id === params.get('task'));
  const compose = params.get('compose') === 'task';
  const stageId = params.get('stage');
  const stageName = Object.hasOwn(studioTaskStages, stageId) ? studioTaskStages[stageId] : '';
  const names = new Map(studio.companies.map(item => [item.id, item.name]));
  const newTask = (stageId = '') => studioLink('board', { ...scope, compose: 'task', ...(stageId ? { stage: stageId } : {}) }, params);
  const selection = selected ? { task: selected.id } : {};
  const viewLink = choice => studioLink('board', { ...scope, ...selection, display: choice }, params);
  const implicit = !['board', 'list'].includes(params.get('display'));
  const alternate = implicit && !error && studioUrl('board', {
    ...scope, ...selection, ...(compose ? { compose: 'task', stage: stageName && stageId } : {}), display: 'list',
  }, params);
  return `<section class="stb-board" aria-label="Studio task board" data-studio-screen="board"${alternate ? ` data-studio-default-url="${esc(alternate)}"` : ''}>
    <header class="mero-page-head stb-head"><div><${heading}>${compose ? 'New task' : 'Task board'}</${heading}><p>${compose ? (company ? esc(company.name) + ' · ' : '') + esc(stageName || 'Studio projects') : company ? esc(company.name) : 'Studio projects'}${compose ? '' : ' · ' + tasks.length + (tasks.length === 1 ? ' task' : ' tasks')}</p></div>
      ${compose ? '' : `<a class="mero-button mero-button-primary" ${newTask()}><span class="stb-plus" aria-hidden="true">+</span>New task</a>`}
    </header>
    ${compose ? composer(studio, scope, params, values, error) : `
      ${error ? `<p role="alert" class="stb-error">${esc(error)}</p>` : ''}
      ${selected ? readout(studio, selected, scope, params) : ''}
      <div class="stb-toolbar">
        <nav class="stb-view-switch" aria-label="Task views">
          <a class="stb-board-label" data-studio-display-choice="board" ${viewLink('board')}${listView ? '' : ' aria-current="true"'}><i aria-hidden="true"></i>Board</a>
          <a data-studio-display-choice="list" ${viewLink('list')}${listView ? ' aria-current="true"' : ''}><i class="stb-list-icon" aria-hidden="true"></i>List</a>
        </nav>
        <details class="stb-filter"><summary>${esc(company?.name || 'All companies')}<span class="stb-chevron" aria-hidden="true"></span></summary>
          <div class="stb-filter-menu"><a ${studioLink('board', display, params)} ${company ? '' : 'aria-current="true"'}>All companies</a>${studio.companies.map(item => `<a ${studioLink('board', { ...display, company: item.id }, params)}${company?.id === item.id ? ' aria-current="true"' : ''}>${esc(item.name)}</a>`).join('')}</div>
        </details>
      </div>
      ${listView ? list(tasks, names, scope, params) : lanes(tasks, names, scope, params, laneHeading, cardHeading, newTask)}`}
  </section>`;
}

export function mutateStudioTask(studio, form) {
  const get = key => getValue(form, key).trim();
  const company = studio.companies.find(item => item.id === get('company'));
  const choice = get('display');
  const scope = ['board', 'list'].includes(choice) ? { display: choice } : {};
  if (company) scope.company = company.id;
  const status = get('status');
  if (get('operation') === 'move') {
    const task = studio.tasks.find(item => item.id === get('id'));
    if (!task) return { error: 'This task could not be found.', params: scope };
    const params = get('openTask') === '1' ? { ...scope, task: task.id } : scope;
    if (!Object.hasOwn(studioTaskStages, status)) return { error: 'Choose a valid task status.', params };
    task.status = status;
    return { params };
  }
  if (get('operation') !== 'create') return { error: 'Choose a task action.', params: scope };
  const failure = message => ({ error: message, params: { ...scope, compose: 'task' } });
  const title = get('title');
  const description = get('description');
  const companyId = get('companyId');
  const owner = get('owner');
  const priority = get('priority');
  if (!title || title.length > 100) return failure('Enter a task title of 1–100 characters.');
  if (!studio.companies.some(item => item.id === companyId)) return failure('Choose a company for this task.');
  if (!owners.includes(owner) || !priorities.includes(priority) || !Object.hasOwn(studioTaskStages, status)) return failure('Choose a valid owner, priority and status.');
  if (description.length > 600) return failure('Keep the description within 600 characters.');
  const number = studio.tasks.reduce((n, task) => Math.max(n, Number(task.id.slice(3)) || 0), 100) + 1;
  const id = 'ST-' + number;
  studio.tasks.unshift({ id, title, description, companyId, owner, priority, status });
  return { params: { ...scope, ...(company ? { company: companyId } : {}), task: id } };
}
