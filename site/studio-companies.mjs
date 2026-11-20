import { studioDeals } from './business-layouts.mjs';
import { escapeHtml as esc } from './html.mjs';
import { studioTaskStages } from './studio-board.mjs';
import { studioContextFields, studioForm, studioLink, studioSearch } from './studio-links.mjs';

const profiles = {
  forma: { industry: 'Retail design', city: 'Copenhagen', employees: 84, role: 'Design director', colleague: ['Emil Holm', 'Retail operations'] },
  arc: { industry: 'Architecture', city: 'London', employees: 32, role: 'Founding partner', colleague: ['Ada Cole', 'Studio manager'] },
  stillwater: { industry: 'Furniture', city: 'Stockholm', employees: 116, role: 'Head of product', colleague: ['Elsa Lund', 'Procurement lead'] },
  tandem: { industry: 'Workplace design', city: 'Amsterdam', employees: 48, role: 'Operations director', colleague: ['Ravi Mehta', 'Facilities lead'] },
  cinder: { industry: 'Creative services', city: 'Berlin', employees: 24, role: 'Creative director', colleague: ['Max Weber', 'Producer'] },
  union: { industry: 'Hospitality', city: 'Antwerp', employees: 152, role: 'Development director', colleague: ['Nora Peeters', 'Purchasing manager'] },
};

export function createStudioCompanies() {
  return studioDeals.map(deal => {
    const { industry, city, employees, role, colleague } = profiles[deal.id];
    return {
      id: deal.id, name: deal.company, industry, city, employees, owner: deal.owner,
      people: [{ name: deal.contact, role }, { name: colleague[0], role: colleague[1] }],
      project: deal.project, pipeline: deal.amount, stage: deal.stage, next: deal.next,
    };
  });
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const formattedDate = date => shortDate.format(new Date(date + 'T12:00:00Z'));

function initials(name) {
  return name.split(/\s+/u).filter(word => word !== '&').slice(0, 2).map(word => word[0]).join('');
}

function mark(company, large = false) {
  return `<span class="sc-mark${large ? ' sc-mark-large' : ''}" data-client="${esc(company.id)}" aria-hidden="true">${esc(initials(company.name))}</span>`;
}

function recordBlock(heading, title, contents, link = '') {
  return `<section class="sc-block"><header><${heading}>${title}</${heading}>${link}</header>${contents}</section>`;
}

function matchesCompany(company, query) {
  const term = query.toLowerCase().trim();
  return [company.name, company.industry, company.city, company.owner].some(value => value.toLowerCase().includes(term));
}

function profileErrors(values) {
  const errors = {};
  if (!values.industry || values.industry.length > 80) errors.industry = 'Enter an industry of up to 80 characters.';
  if (!values.city || values.city.length > 80) errors.city = 'Enter a city of up to 80 characters.';
  if (!/^\d+$/.test(values.employees) || !Number.isSafeInteger(Number(values.employees))) errors.employees = 'Enter a whole team size of zero or more.';
  return errors;
}

export function mutateStudioCompany(studio, form) {
  const company = studio.companies.find(item => item.id === form.get('company'));
  if (!company) return { error: 'This company could not be found.', params: {} };
  const values = Object.fromEntries(['industry', 'city', 'employees'].map(field => [field, (form.get(field) || '').trim()]));
  const q = (form.get('q') || '').trim();
  const params = { company: company.id, q };
  const errors = profileErrors(values);
  if (Object.keys(errors).length) return { error: 'Check the highlighted company details.', params: { ...params, edit: 'profile' }, values };
  Object.assign(company, values, { employees: Number(values.employees) });
  if (!matchesCompany(company, q)) delete params.q;
  return { params };
}

function profileEditor(company, params, heading, error, submitted) {
  const values = error ? submitted : company;
  const errors = error ? profileErrors(values) : {};
  const field = (key, label, type) => `<label class="rl-field">
    <span class="rl-label">${label}</span><input class="rl-input" type="${type}" name="${key}" required${key === 'industry' ? ' data-studio-initial-focus' : ''} ${type === 'number' ? 'min="0" step="1"' : 'maxlength="80"'}
    value="${esc(values[key])}"${errors[key] ? ` aria-invalid="true" aria-describedby="sc-error-${key}"` : ''}>
    ${errors[key] ? `<small class="rl-field-error" id="sc-error-${key}">${esc(errors[key])}</small>` : ''}</label>`;
  return `<article class="sc-record" aria-label="Edit company profile">
    <header class="sc-identity">${mark(company, true)}<div><${heading}>Edit company</${heading}><p>${esc(company.name)}</p></div></header>
    <form class="sc-edit-form" ${studioForm('/demo/studio/companies', params)}>
      <input type="hidden" name="company" value="${esc(company.id)}"><input type="hidden" name="q" value="${esc(params.get('q'))}">
      ${error ? `<p class="rl-field-error" role="alert">${esc(error)}</p>` : ''}
      ${field('industry', 'Industry', 'text')}${field('city', 'City', 'text')}${field('employees', 'Team size', 'number')}
      <div class="sc-edit-actions"><button class="rl-button rl-button-primary" type="submit">Save changes</button><a class="rl-button rl-button-ghost" ${studioLink('companies', { company: company.id, q: params.get('q') }, params)}>Cancel</a></div>
    </form>
  </article>`;
}

function recordDetail(company, studio, params, pageHeading, error, values) {
  const tasks = studio.tasks.filter(task => task.companyId === company.id);
  const bookings = studio.bookings.filter(booking => booking.companyId === company.id).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const openTasks = tasks.filter(task => task.status !== 'done').length;
  const companyFilter = { company: company.id };
  const viewLink = (view, label) => `<a class="sc-text-link" ${studioLink(view, companyFilter, params)}>${label}<span aria-hidden="true"> →</span></a>`;
  const tasksContent = tasks.length ? `<ul class="sc-work-items">${tasks.map(task =>
    `<li><a ${studioLink('board', { ...companyFilter, task: task.id }, params)}><span>${esc(task.title)}</span><small class="sc-state" data-state="${esc(task.status)}">${esc(studioTaskStages[task.status] || task.status)}</small></a></li>`).join('')}</ul>` : '<p class="sc-empty-note">No tasks assigned to this company.</p>';
  const bookingsContent = bookings.length ? `<ul class="sc-work-items">${bookings.map(booking =>
    `<li><a ${studioLink('calendar', { ...companyFilter, booking: booking.id }, params)}><span>${esc(booking.title)}</span><small><time datetime="${esc(booking.date)}">${esc(formattedDate(booking.date))}</time> · ${esc(booking.start)}</small></a></li>`).join('')}</ul>` : '<p class="sc-empty-note">No bookings for this company.</p>';
  const detailHeading = pageHeading ? 'h2' : 'h3';
  const sectionHeading = pageHeading ? 'h3' : 'h4';
  if (params.get('edit') === 'profile' && params.get('company') === company.id) return profileEditor(company, params, detailHeading, error, values);
  return `<article class="sc-record" aria-label="${esc(company.name)} company record">
    <a class="sc-back sc-text-link" ${studioLink('companies', { q: params.get('q') }, params)}><span aria-hidden="true">← </span>Company directory</a>
    <header class="sc-identity">${mark(company, true)}<div><${detailHeading}${params.get('company') === company.id ? ' data-studio-initial-focus tabindex="-1"' : ''}>${esc(company.name)}</${detailHeading}><p>${esc(company.industry)}<span aria-hidden="true"> · </span>${esc(company.city)}</p></div>
      <a class="rl-button rl-button-sm sc-edit" ${studioLink('companies', { company: company.id, q: params.get('q'), edit: 'profile' }, params)}>Edit company</a></header>
    <dl class="sc-metrics"><div><dt>Open pipeline</dt><dd>${money.format(company.pipeline)}</dd></div><div><dt>Open tasks</dt><dd>${openTasks}</dd></div><div><dt>Bookings</dt><dd>${bookings.length}</dd></div></dl>
    <div class="sc-facts"><dl><div><dt>Account owner</dt><dd>${esc(company.owner)}</dd></div><div><dt>Team size</dt><dd>${company.employees} employees</dd></div></dl></div>
    <div class="sc-blocks">
    ${recordBlock(sectionHeading, 'Opportunity', `<div class="sc-project"><div><strong>${esc(company.project)}</strong><span class="sc-stage">${esc(company.stage)}</span></div><p>${esc(company.next)}</p></div>`)}
    ${recordBlock(sectionHeading, 'People', `<ul class="sc-people">${company.people.map(person => `<li><span class="sc-avatar" aria-hidden="true">${esc(initials(person.name))}</span><div><strong>${esc(person.name)}</strong><small>${esc(person.role)}</small></div></li>`).join('')}</ul>`)}
    ${recordBlock(sectionHeading, 'Tasks', tasksContent, viewLink('board', 'Open board'))}
    ${recordBlock(sectionHeading, 'Bookings', bookingsContent, viewLink('calendar', 'Open calendar'))}
    </div>
  </article>`;
}

export function renderStudioCompanies(studio, params, { pageHeading = true, error = '', values = {} } = {}) {
  const q = (params.get('q') || '').trim();
  const companies = studio.companies.filter(company => matchesCompany(company, q));
  const requested = companies.find(company => company.id === params.get('company'));
  const selected = requested || companies[0];
  const heading = pageHeading ? 'h1' : 'h2';
  const directoryHeading = pageHeading ? 'h2' : 'h3';
  return `<section class="sc-companies" aria-label="Company workspace">
    <header class="rl-page-head sc-head"><div><${heading}>Companies</${heading}><p>Client accounts, contacts and project work.</p></div></header>
    ${error && !requested ? `<p class="rl-field-error" role="alert">${esc(error)}</p>` : ''}
    <div class="sc-panes"${requested ? ' data-open-record' : ''}>
    <section class="sc-directory" aria-label="Company directory"><div class="sc-directory-head"><${directoryHeading}>Directory</${directoryHeading}><span>${companies.length}${q ? ` / ${studio.companies.length}` : ''}</span></div>
    <form class="sc-search" role="search" aria-label="Search company directory" ${studioSearch()}>
      <input type="hidden" name="view" value="companies">${studioContextFields(params)}
      <input class="rl-input" type="search" id="studio-company-search" aria-label="Search companies" name="q" value="${esc(q)}" placeholder="Search companies">
      <button class="rl-button" type="submit" aria-label="Search companies"><span class="sc-search-icon" aria-hidden="true"></span></button>
    </form>
    ${q && companies.length ? `<a class="sc-clear sc-text-link" ${studioLink('companies', {}, params)}>Clear search</a>` : ''}
    ${companies.length ? `<nav class="sc-accounts" aria-label="Companies">${companies.map(company => `<a class="sc-account" ${studioLink('companies', { q, company: company.id }, params)}${company === selected ? ' aria-current="true"' : ''}>
      ${mark(company)}<span><strong>${esc(company.name)}</strong><small>${esc(company.city)}</small></span></a>`).join('')}</nav>` : `<div class="sc-empty"><strong>No matching companies</strong><p>Try another name, city or industry.</p><a class="sc-text-link" ${studioLink('companies', {}, params)}>Clear search</a></div>`}
    </section>${selected ? recordDetail(selected, studio, params, pageHeading, error, values) : ''}
    </div>
  </section>`;
}
