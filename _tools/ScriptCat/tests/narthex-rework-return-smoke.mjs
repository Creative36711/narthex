// Проба 1.4.63: следы прошлого ответа при возврате из Rework снимает транспорт.
//
// 25.10 Координатор не смог вернуть NAR-2.3 в Ready. По его словам, коннектор
// Notion отвечал `validation_error` на очистку «Submitted At», «PR» и «Run ID»,
// а без очистки выдача отказывает: карточка запиралась, и работа уезжала в
// карточку-продолжение NAR-2.3-Б. Поля эти ставит транспорт (`dispatchTask`,
// проверка мержа), поэтому снимать их должен он: Координатор только переводит
// карточку в Ready.
//
// Проверяется:
//   • Ready со следами + память о Rework → одна запись снимает все три поля;
//   • без памяти о Rework — null: защита от дубля (NAR-1.7) остаётся;
//   • карточка не в Ready и карточка без следов — null;
//   • «снимать» умеет и `PR` (url) и `Run ID` (rich_text), а не только дату;
//   • dispatchTask снимает следы до проверки и обнуляет память после;
//   • очередь запоминает Rework, а промпт больше не просит чистить коннектором.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
assert.match(src, /@version\s+1\.4\.66/, 'версия 1.4.66');

const sliceBetween = (startMarker, endMarker) => {
  const from = src.indexOf(startMarker);
  const to = src.indexOf(endMarker, from);
  assert.ok(from > 0 && to > from, `блок ${startMarker.slice(0, 40)} на месте`);
  return src.slice(from, to);
};

const block = sliceBetween('  const reworkKey = (id) =>', '  /**\n   * Вернуть карточку в Ready');

// Память ScriptCat — обычный объект: так видно и запись, и чтение.
const store = new Map();
const api = new Function(
  'GM_getValue',
  'GM_setValue',
  'rt',
  `${block}
   return { reworkKey, reworkSeen, rememberRework, reworkClearProps };`,
)(
  (key, fallback) => (store.has(key) ? store.get(key) : fallback),
  (key, value) => store.set(key, value),
  (p) => (p?.rich_text || p?.title || []).map((x) => x.plain_text || '').join(''),
);

const card = (over = {}) => ({
  id: over.id || 'card-1',
  properties: {
    'Dispatch State': { select: { name: over.state || 'Ready' } },
    'Submitted At': { date: over.submitted === undefined ? { start: '2026-10-24T21:02:00.000+00:00' } : over.submitted },
    'PR': { url: over.pr === undefined ? 'https://github.com/Creative36711/narthex/pull/46' : over.pr },
    'Run ID': { rich_text: over.runId === undefined ? [{ plain_text: 'run-1' }] : over.runId },
  },
});

// ── 1. Без памяти о Rework не снимаем ничего ───────────────────────────────
assert.equal(api.reworkClearProps(card()), null, 'отвеченная карточка в Ready без Rework не перевыдаётся');

// ── 2. Память о Rework даёт право на одну чистку ───────────────────────────
api.rememberRework([{ id: 'card-1' }]);
assert.equal(api.reworkSeen('card-1'), true, 'Rework запомнен');
assert.deepEqual(
  api.reworkClearProps(card()),
  {
    'Submitted At': { date: null },
    'PR': { url: null },
    'Run ID': { rich_text: [] },
  },
  'снимаются все три поля: дата, ссылка и текст',
);

// ── 3. Не Ready — не наше дело ─────────────────────────────────────────────
assert.equal(api.reworkClearProps(card({ state: 'Rework' })), null, 'Rework сам не чистится: карточка не выдаётся');
assert.equal(api.reworkClearProps(card({ state: 'Submitted' })), null, 'Submitted не трогаем');

// ── 4. Следов нет — чистить нечего ─────────────────────────────────────────
assert.equal(
  api.reworkClearProps(card({ submitted: null, pr: null, runId: [] })),
  null,
  'чистая карточка идёт обычным путём',
);

// ── 5. Одного следа достаточно ─────────────────────────────────────────────
const onlyPr = api.reworkClearProps(card({ submitted: null, runId: [] }));
assert.ok(onlyPr && onlyPr['PR'], 'ссылка на PR — тоже след прошлого ответа');
const onlyRun = api.reworkClearProps(card({ submitted: null, pr: null }));
assert.ok(onlyRun && onlyRun['Run ID'], 'Run ID — тоже след прошлого ответа');

// ── 6. Пустая память не даёт права ─────────────────────────────────────────
api.rememberRework([{ id: 'card-2' }, null, {}]);
assert.equal(api.reworkSeen('card-1'), true, 'чужая память не стирает свою');
assert.equal(api.reworkSeen('card-2'), true, 'id без полей тоже запоминается');
assert.equal(api.reworkSeen(''), false, 'пустой id — не право');
assert.equal(api.reworkSeen(null), false, 'null — не право');

// ── 7. Выдача снимает следы до проверки и забывает Rework ──────────────────
const dispatch = sliceBetween('  async function dispatchTask(', '\n  async function ');
assert.match(dispatch, /const clearing = reworkClearProps\(fresh\);/, 'dispatchTask спрашивает разрешение на чистку');
assert.match(dispatch, /await patch\(fresh\.id, clearing\);/, 'и снимает следы одной записью');
assert.match(dispatch, /GM_setValue\(reworkKey\(fresh\.id\), 0\);/, 'после чистки память обнуляется');
assert.match(dispatch, /следы прошлого ответа не снялись/, 'ошибка Notion отменяет выдачу, а не глотается');
assert.ok(
  dispatch.indexOf('reworkClearProps(fresh)') < dispatch.indexOf('if (state !== "Ready" || submittedAt || prLink)'),
  'чистка идёт до проверки «уже отвечена»',
);

// ── 8. Очередь запоминает Rework ───────────────────────────────────────────
assert.match(src, /rememberRework\(rework\);/, 'queueOf запоминает карточки из Rework');

// ── 9. Промпт не просит Координатора чистить поля ──────────────────────────
assert.doesNotMatch(
  src,
  /верни её в Ready и очисти «Submitted At», «PR», «Run ID»/,
  'просьба очищать коннектором убрана',
);
assert.match(
  src,
  /следы прошлого ответа \(«Submitted At», «PR», «Run ID»\) снимет транспорт на выдаче/,
  'в промпте сказано, кто снимает следы',
);

console.log('OK: narthex 1.4.63 — вернувшаяся из Rework карточка чистится транспортом, а не коннектором');
