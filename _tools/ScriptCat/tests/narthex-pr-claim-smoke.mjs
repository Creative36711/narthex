// Проба подтверждения мержа: где скрипт ищет бейдж PR.
//
// 18:36 Мастер нажал «Шаг» на странице Architect, чтобы прочитать ответ с
// маркером (PR #25 уже слит). Старый ensureMerged искал бейдж «Pull request
// merged» на текущей странице, а на странице агента его нет — шаг повис бы на
// пять минут и закончился паузой «PR не слит». Здесь проверяется:
//   • без PR-интерфейса на экране решение принимает маркер (`pr`, `merged`);
//   • заявки о мерже нет → «unconfirmed» и карточка уходит в Rework с честной
//     причиной;
//   • если бейдж виден (Мастер открыл PR), работает прежняя проверка.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

const from = src.indexOf('  async function ensureMerged(task, result) {');
const to = src.indexOf('  async function finishMerge(', from);
assert.ok(from > 0 && to > from, 'ensureMerged на месте');
const block = src.slice(from, to);

function make({ ui = false, store = new Map() } = {}) {
  const logs = [];
  const calls = { finishMerge: 0, finishClosed: 0 };
  const fn = new Function(
    'K', 'GM_getValue', 'GM_setValue', 'C', 'log', 'hasMergedClaim',
    'mergedFlag', 'closedFlag', 'continueButton', 'createPr', 'mergePr', 'finishMerge', 'finishClosed',
    `${block}; return ensureMerged;`,
  );
  const ensureMerged = fn(
    { merged: 'cfn-merged:' },
    (k, d) => (store.has(k) ? store.get(k) : d),
    (k, v) => store.set(k, v),
    { prWaitMs: 5000, mergeGraceMs: 1000 },
    (t, e) => logs.push({ t, e }),
    (r) => !!r && (r.merged === true || String(r.status || '').toLowerCase() === 'merged'),
    () => ui && false,
    () => ui && false,
    () => (ui ? { click() {} } : null),
    () => (ui ? { click() {} } : null),
    () => (ui ? { click() {} } : null),
    async () => { calls.finishMerge += 1; return 'merged'; },
    async () => { calls.finishClosed += 1; return 'closed'; },
  );
  return { ensureMerged, logs, calls, store };
}

// ── 1. Страница агента: бейджа нет, маркер заявляет мерж ────────────────────
{
  const { ensureMerged, logs, store } = make();
  const state = await ensureMerged({ id: 'card-1' }, { dispatch_id: 'card-1', pr: 25, merged: true, status: 'submitted', check: 0 });
  assert.equal(state, 'claimed', 'мерж принят по маркеру, а не повисает на бейдже');
  assert.equal(store.get('cfn-merged:card-1'), true, 'мерж запомнен: повторно не спрашиваем');
  assert.equal(logs.length, 1, 'ровно одна запись в журнале');
  assert.match(logs[0].t, /PR #25 слит: принято по маркеру агента/, 'видно, на чём основано решение');
  assert.match(logs[0].t, /PR-интерфейс живёт на странице PR/, 'объяснено, почему бейджа нет');
  assert.doesNotMatch(logs[0].t, /Пауза|не слит/, 'это не ошибка и не пауза');

  // Повторный шаг не переспрашивает.
  const again = await ensureMerged({ id: 'card-1' }, { merged: true });
  assert.equal(again, 'already', 'повторная проверка не нужна');
}

// 2. Тот же маркер, но с готовым URL вместо номера.
{
  const { ensureMerged, logs } = make();
  const state = await ensureMerged({ id: 'card-2' }, { pr: 'https://github.com/Creative36711/narthex/pull/25', merged: true });
  assert.equal(state, 'claimed', 'URL PR тоже принимается');
  assert.match(logs[0].t, /^https:\/\/github\.com\/Creative36711\/narthex\/pull\/25 слит/, 'в журнале ссылка, а не «PR #https»');
}

// ── 3. Мержа нет и он не заявлен — честный отказ ────────────────────────────
{
  const { ensureMerged, logs, store } = make();
  const state = await ensureMerged({ id: 'card-3' }, { dispatch_id: 'card-3', status: 'submitted', check: 0 });
  assert.equal(state, 'unconfirmed', 'без заявки о мерже результат не принимается');
  assert.equal(logs[0].e, true, 'в журнале это ошибка');
  assert.match(logs[0].t, /работа в main не попала/, 'сказано, чем это плохо');
  assert.equal(store.get('cfn-merged:card-3'), undefined, 'мерж не запомнен');
}

// 4. Если Мастер открыл страницу PR, работает прежняя проверка бейджа ───────
{
  const { ensureMerged, calls } = make({ ui: true });
  const state = await ensureMerged({ id: 'card-4' }, { merged: true, pr: 25 });
  assert.equal(state, 'merged', 'бейдж важнее маркера, когда он виден');
  assert.equal(calls.finishMerge, 1, 'сработал путь finishMerge');
}

// ── 5. submitExecutor использует новую ветку ────────────────────────────────
assert.match(src, /await ensureMerged\(page, result\)/, 'маркер передаётся в проверку мержа');
assert.match(src, /merged === "closed" \|\| merged === "unconfirmed"/, 'unconfirmed обрабатывается как Rework');
assert.match(
  src,
  /Исполнитель не заявил о мерже \(нет merged: true\) и PR не открыт/,
  'причина Rework объясняет, чего не хватает',
);
assert.match(src, /merged === "claimed" \? "слит \(по маркеру\)"/, 'в журнале видно, что мерж принят по маркеру');

console.log('OK: narthex 1.4.11 — мерж принимается по маркеру там, где бейджа нет, и не подвешивает шаг на пять минут');
