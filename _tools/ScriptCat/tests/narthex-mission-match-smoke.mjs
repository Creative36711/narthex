// Проба 1.4.74: чужая миссия — не своя, а своя — не теряется.
//
// 25.10 (фаза 2) Координатор создал NAR-2.14 и NAR-2.15 с полем «Миссия»
// «NAR-2 · Шов движок и пак», а миссия называется «NAR-2 · Шов «движок /
// пак»». Очередь фильтровалась сравнением строк в лоб (`includes`), поэтому
// обе карточки выпали: план дважды показывал «0 Ready, 0 Draft», а потом
// транспорт встал на паузу «в Ready нет карточки для этой роли» — при том что
// карточка лежала в базе.
//
// Проверяется:
//   • слова названия сравниваются без кавычек, «·», «/» и связки «и»;
//   • перестановка слов и лишнее слово не отнимают карточку у миссии;
//   • короткое название (< 3 слов) не цепляет карточки соседних миссий;
//   • пустое «Миссия» в карточке считается «нашей» (это делает tasks);
//   • очередь (tasks) сравнивает через missionSame, а не через includes;
//   • в промпте Координатора «Миссия» карточки — копия строки из промпта.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

assert.match(src, /@version\s+1\.4\.85/, 'версия 1.4.85');

const sliceBetween = (startMarker, endMarker) => {
  const from = src.indexOf(startMarker);
  const to = src.indexOf(endMarker, from);
  assert.ok(from > 0 && to > from, `блок ${startMarker.slice(0, 40)} на месте`);
  return src.slice(from, to);
};

// ── 1. Сравнение названий ──────────────────────────────────────────────────
const block = sliceBetween('  const MISSION_STOPWORDS', '  /** Сказать про «потерянные»');
const { missionWords, missionSame } = new Function(
  `${block}\n return { missionWords, missionSame };`,
)();

const MISSION = 'NAR-2 · Шов «движок / пак»';

assert.deepEqual(missionWords(MISSION), ['nar', '2', 'шов', 'движок', 'пак'], 'слова миссии');

// Тот самый случай: Координатор написал название по-своему.
assert.equal(
  missionSame(MISSION, 'NAR-2 · Шов движок и пак'),
  true,
  'карточка 2.14/2.15 видна, хотя «и» вместо «/» и нет кавычек',
);
assert.equal(missionSame(MISSION, MISSION), true, 'точное совпадение');
assert.equal(missionSame(MISSION, 'Шов движок / пак · NAR-2'), true, 'перестановка слов');
assert.equal(missionSame(MISSION, 'NAR-2 · Шов «движок / пак» — фаза 2'), true, 'лишнее слово');

// ── 2. Чужие миссии не прилипают ───────────────────────────────────────────
assert.equal(missionSame(MISSION, 'NAR-1 · Ядро и шов'), false, 'другая миссия');
assert.equal(missionSame(MISSION, 'NAR-2 · Шов «движок / пак» (старая)'), true, 'то же имя с хвостом');
assert.equal(missionSame('NAR-2', 'NAR-2 · Шов движок и пак'), false, 'короткое имя не цепляет всё подряд');
assert.equal(missionSame('NAR-2', 'nar 2'), true, 'короткое имя совпало точно');
assert.equal(missionSame('', MISSION), false, 'пустое имя — не совпадение (пустое поле карточки решает tasks)');

// ── 3. Очередь сравнивает через missionSame ────────────────────────────────
const tasksBlock = sliceBetween('  async function tasks(', '\n  // ───────────────────────────── сообщения чата');
assert.match(tasksBlock, /missionSame\(value, wanted\)/, 'tasks сравнивает по словам');
assert.doesNotMatch(tasksBlock, /value\.includes\(wanted\)/, 'лобового includes больше нет');
assert.match(tasksBlock, /if \(!value\) return true;/, 'пустое «Миссия» считается нашим');
assert.match(tasksBlock, /missionSkipSeen/, 'потерянные карточки попадают в журнал');
assert.match(tasksBlock, /карточки другой миссии/, 'в журнале видно причину');

// ── 4. Промпт Координатора требует копию названия ──────────────────────────
assert.match(
  src,
  /В «Миссию» карточки копируй строку «Миссия: …»/,
  'промпт просит копировать название миссии',
);

// ── 5. Дублей по номеру больше нет ──────────────────────────────────────────
// 27.10: Мастер завёл задел NAR-4.1–4.8 в Draft с полем «Миссия» = «NAR-4»,
// Координатор этих карточек не увидел (короткое имя миссии) и завёл свои
// NAR-4.1–4.8 в Ready. В базе стало по две карточки на номер. Теперь промпт
// требует сначала посмотреть «Запросы» по номеру, а короткое имя миссии —
// не писать.
assert.match(
  src,
  /второй такой же номер не создавай/,
  'промпт запрещает вторую карточку с тем же номером',
);
assert.match(
  src,
  /пиши полное название миссии, а не «NAR-4»/,
  'промпт требует полное название миссии в карточке',
);

console.log('narthex-mission-match-smoke: OK');
