import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecentProjects, RECENT_PROJECTS_KEY } from './src/project/recent-projects.js';
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const storage = () => { const values = new Map(); return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}; };

test('recent history persists, deduplicates revisits, and updates names in newest-first order', () => {
  const saved = storage(), history = createRecentProjects(saved);
  history.remember(first, 'First'); history.remember(second, 'Second'); history.remember(first, 'Renamed');
  assert.deepEqual(createRecentProjects(saved).read(), [{id:first,name:'Renamed'}, {id:second,name:'Second'}]);
  history.remember(null, 'Demo');
  assert.equal(history.read().length, 2);
  const otherTab = createRecentProjects(saved);
  otherTab.remember(second, 'Other tab');
  assert.equal(history.read()[0].name, 'Other tab');
});

test('unavailable storage keeps this tab history and corrupt saved entries are ignored', () => {
  for (const saved of [undefined, {getItem(){throw Error();},setItem(){throw Error();}}, {getItem(){return '[]';},setItem(){throw Error();}}]) {
    const history = createRecentProjects(saved);
    history.remember(first, 'First'); history.remember(second, 'Second');
    assert.equal(history.read().length, 2);
  }
  const saved = storage(); saved.setItem(RECENT_PROJECTS_KEY, JSON.stringify([null,{id:'javascript:alert(1)',name:'Bad'},{id:first,name:'Good'}]));
  assert.deepEqual(createRecentProjects(saved).read(), [{id:first,name:'Good'}]);
  saved.setItem(RECENT_PROJECTS_KEY, '{broken');
  assert.deepEqual(createRecentProjects(saved).read(), []);
});

test('recent links reuse existing private invites and never navigate to a stored external URL', () => {
  const saved = storage(), history = createRecentProjects(saved), origin = 'https://diggy.example';
  assert.equal(history.href(first, origin), `/?project=${first}`);
  saved.setItem(`diggy-invite:${first}`, `${origin}/?project=${first}#invite=test-invite`);
  assert.equal(history.href(first, origin), `/?project=${first}#invite=test-invite`);
  saved.setItem(`diggy-invite:${first}`, `https://untrusted.example/?project=${first}#invite=secret`);
  assert.equal(history.href(first, origin), `/?project=${first}`);
  saved.setItem(`diggy-invite:${first}`, `${origin}/?project=${second}#invite=wrong`);
  assert.equal(history.href(first, origin), `/?project=${first}`);
});
