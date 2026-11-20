import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioTasks, mutateStudioTask, renderStudioBoard } from '../site/studio-board.mjs';

test('the company-filtered task list retains its view across creation and status changes', () => {
  const studio = { tasks: createStudioTasks(), companies: [{ id: 'forma', name: 'Forma Works' }, { id: 'arc', name: 'Arc & Field' }] };
  const scope = { company: 'forma', display: 'list' };
  const created = mutateStudioTask(studio, new URLSearchParams({
    ...scope, operation: 'create', title: 'Inspect shop fittings', companyId: 'forma',
    status: 'backlog', owner: 'Maya Chen', priority: 'Normal',
  }));
  const id = created.params.task;
  assert.deepEqual(created.params, { ...scope, task: id });

  const moved = mutateStudioTask(studio, new URLSearchParams({ ...scope, operation: 'move', id, status: 'done', openTask: '1' }));
  assert.deepEqual(moved.params, created.params);

  const html = renderStudioBoard(studio, new URLSearchParams(moved.params));
  assert.match(html, /aria-label="Task list"/);
  assert.match(html, /Back to list/);
  assert.match(html, /Inspect shop fittings/);
  assert.doesNotMatch(html, /Refine the identity lockups/);
  assert.doesNotMatch(html, /data-studio-lanes/);
  assert.equal(studio.tasks.find(task => task.id === id).status, 'done');
});

test('task display links and forms retain the selected record and record validation context', () => {
  const studio = { tasks: createStudioTasks(), companies: [{ id: 'forma', name: 'Forma Works' }] };
  const context = { company: 'forma', task: 'ST-103', embed: '1', theme: 'light' };
  for (const display of ['board', 'list']) {
    const scope = { company: 'forma', display };
    const html = renderStudioBoard(studio, new URLSearchParams({ ...context, display }));
    assert.doesNotMatch(html, /data-studio-default-url=/);
    for (const choice of ['board', 'list']) {
      const href = html.match(new RegExp('data-studio-display-choice="' + choice + '" href="([^"]+)"'))[1];
      const query = new URL(href.replaceAll('&amp;', '&'), 'http://localhost').searchParams;
      assert.deepEqual(Object.fromEntries(query), { ...context, display: choice, view: 'board' });
    }
    assert.match(html, new RegExp('name="display" value="' + display + '"'));
    const invalid = mutateStudioTask(studio, new URLSearchParams({ ...scope, operation: 'create' }));
    assert.deepEqual(invalid.params, { ...scope, compose: 'task' });
    const failedView = renderStudioBoard(studio, new URLSearchParams(invalid.params), invalid);
    assert.match(failedView, new RegExp('name="display" value="' + display + '"'));
    assert.doesNotMatch(failedView, /data-studio-default-url=/);
    const moved = mutateStudioTask(studio, new URLSearchParams({ ...scope, operation: 'move', id: 'ST-103', status: 'review' }));
    assert.deepEqual(moved.params, scope);
  }
  const fallback = renderStudioBoard(studio, new URLSearchParams(context));
  assert.match(fallback, /data-studio-lanes/);
  const alternate = fallback.match(/data-studio-default-url="([^"]+)"/)[1];
  const query = new URL(alternate.replaceAll('&amp;', '&'), 'http://localhost').searchParams;
  assert.deepEqual(Object.fromEntries(query), { ...context, display: 'list', view: 'board' });
});
