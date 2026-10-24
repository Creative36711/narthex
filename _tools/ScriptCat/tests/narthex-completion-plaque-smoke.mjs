// Проба плашки «Эта задача была выполнена успешно?».
//
// 24.10 в 14:48 шаг принял давно законченный ход за живой: PR #34 был слит ещё
// в 11:26, а скрипт нажал «Create pull request» (запасной путь) и отправил в
// чат Build/Release реплику «Please open a pull request…». Через 23 секунды
// сторож снял блокировку с живого шага. Здесь проверяется:
//   • плашка находится по тексту и не путается с контейнером целого чата;
//   • пока плашка видна, агент считается свободным (`busyReason`), а её кнопки
//     не считаются PR-интерфейсом;
//   • при `merged: true` мерж принимается по маркеру до любого клика;
//   • плашку, которая закрывает поле ввода, скрипт убирает сам, до вставки.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// ── 1. Поиск плашки ────────────────────────────────────────────────────────
const plaqueFrom = src.indexOf('const COMPLETION_TEXT =');
const plaqueTo = src.indexOf('/** Кандидаты в панель завершения', plaqueFrom);
assert.ok(plaqueFrom > 0 && plaqueTo > plaqueFrom, 'completionPlaque на месте');
const plaqueBlock = src.slice(plaqueFrom, plaqueTo);
assert.match(plaqueBlock, /эта задача была выполнена успешно/, 'русский текст плашки');
assert.match(plaqueBlock, /was this task completed successfully/i, 'английский текст плашки');

const panel = (text, { transcript = false } = {}) => ({
  textContent: text,
  querySelector: (selector) => (transcript && /data-agent-transcript-message/.test(selector) ? {} : null),
});

function makePlaque(panels) {
  const fn = new Function('completionPanels', `${plaqueBlock}; return completionPlaque;`);
  return fn(() => panels);
}

{
  const found = panel('Эта задача была выполнена успешно?', {});
  assert.equal(makePlaque([found])(), found, 'плашка находится по тексту');
}
{
  const container = panel('Эта задача была выполнена успешно? переписка целиком', { transcript: true });
  assert.equal(makePlaque([container])(), null, 'контейнер с целым чатом плашкой не считается');
}
{
  const other = panel('Панель с другим текстом');
  assert.equal(makePlaque([other])(), null, 'посторонние панели не трогаем');
  assert.equal(makePlaque([])(), null, 'пустая страница — плашки нет');
}
{
  // Плашка ниже в списке, а сверху — посторонняя панель.
  const top = panel('Что-то ещё');
  const found = panel('Was this task completed successfully?', {});
  assert.equal(makePlaque([top, found])(), found, 'ищем среди всех кандидатов, а не только в первом');
}

// ── 2. Плашка — не PR-интерфейс ────────────────────────────────────────────
const prFrom = src.indexOf('const hasPrUi = () => {');
const prTo = src.indexOf('\n  };', prFrom) + '\n  };'.length;
assert.ok(prFrom > 0 && prTo > prFrom, 'hasPrUi на месте');
const prBlock = src.slice(prFrom, prTo);

function makeHasPrUi({ plaque = false, ui = { create: true } } = {}) {
  const fn = new Function(
    'completionPlaque', 'prSurface',
    `${prBlock}; return hasPrUi;`,
  );
  return fn(() => (plaque ? {} : null), () => ({ merged: false, closed: false, cont: null, create: null, merge: null, ...ui }));
}

assert.equal(makeHasPrUi({ plaque: true })(), false, 'кнопка из плашки — не PR-интерфейс');
assert.equal(makeHasPrUi({ plaque: false })(), true, 'без плашки та же кнопка считается PR-интерфейсом');
assert.equal(makeHasPrUi({ plaque: true, ui: { create: false } })(), false, 'пустая страница остаётся пустой');

// ── 3. Плашка = агент свободен ─────────────────────────────────────────────
const busyFrom = src.indexOf('function busyReason() {');
const busyHead = src.slice(busyFrom, busyFrom + 900);
assert.match(
  busyHead,
  /if \(completionPlaque\(\)\) return null;/,
  'пока плашка видна, агент не считается работающим',
);
assert.match(
  src,
  /Мастер: пока она на экране, задача не выполняется/,
  'причина записана рядом с кодом',
);

// ── 4. При merged: true кнопки PR не нажимаются ────────────────────────────
const mergedFrom = src.indexOf('async function ensureMerged(task, result) {');
const mergedTo = src.indexOf('async function finishMerge(', mergedFrom);
const mergedBlock = src.slice(mergedFrom, mergedTo);
const claimAt = mergedBlock.indexOf('if (hasMergedClaim(result)) {');
const createAt = mergedBlock.indexOf('const create = createPr();');
const graceAt = mergedBlock.indexOf('if (Date.now() > grace) {');
assert.ok(claimAt > 0 && createAt > claimAt, 'заявка о мерже проверяется раньше кнопки Create');
assert.ok(graceAt > claimAt, 'заявка решает и до истечения grace, а не после');
// 1.4.43: клика по Create/Merge нет, но Continue ждётся и нажимается —
// сам выход живёт в claimMerge.
assert.match(
  mergedBlock.slice(claimAt, graceAt),
  /return claimMerge\(/,
  'мерж по маркеру принимается без клика по Create/Merge',
);
const claimBlock = src.slice(src.indexOf('  async function claimMerge('), src.indexOf('  /**\n   * PR закрыт.'));
assert.match(claimBlock, /GM_setValue\(key, true\);\s*\n\s*log\(/, 'без бейджа мерж всё равно запоминается');
assert.match(mergedBlock, /кнопки Create\/Merge не нажимаю/, 'сказано, почему клика не было');
assert.doesNotMatch(
  mergedBlock.slice(0, claimAt),
  /createPr\(\)|mergePr\(\)/,
  'до проверки заявки кнопки не трогаются',
);

// ── 5. Плашку убирает скрипт, до вставки ───────────────────────────────────
const sendFrom = src.indexOf('async function consumePending(manual = false) {');
const sendBlock = src.slice(sendFrom, src.indexOf('async function submitExecutor(', sendFrom));
const closeAt = sendBlock.indexOf('closeCompletionPlaque()');
const composerAt = sendBlock.indexOf('await ensureComposer()');
assert.ok(closeAt > 0 && composerAt > closeAt, 'плашка закрывается до поиска поля ввода');
assert.match(
  sendBlock.slice(closeAt - 400, closeAt + 400),
  /Убрал плашку «задача выполнена»/,
  'в журнале видно, что плашку убрал скрипт',
);
assert.match(src, /function ensureComposer\(timeoutMs = 20000\)/, 'ensureComposer на месте');
assert.match(
  src,
  /editor: null, closed, overlay: completionPanels\(\)\.length > 0/,
  'если плашка осталась и поле не нашлось — это видно в причине',
);

console.log('OK: narthex 1.4.43 — плашка = агент свободен, её кнопки не PR-интерфейс, при merged: true кликов нет');
