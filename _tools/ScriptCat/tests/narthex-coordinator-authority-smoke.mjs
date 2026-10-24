// Проба 1.4.31: Координатор сам распоряжается очередью — включая черновики.
//
// Случай Мастера (2026-10-24). На приёмке NAR-1.8 Координатор написал:
// «старый Draft 1.9 архивирован — перевести Draft в Ready я не вправе», и
// создал такую же карточку заново. Причина была не в правах, а в двух вещах:
//   • в промпте стояло «Ready, Running и Submitted ставит движок» — читается
//     как запрет выдавать существующий черновик;
//   • в строке «Очередь: …» черновиков не было вовсе, то есть Координатор не
//     видел собственный задел (NAR-1.10 лежал Draft и в очереди не появлялся).
//
// Здесь проверяется: права выданы, черновики видны списком, счётчик Draft есть,
// а подсказки на промах говорят «выдай черновик», а не «создайте карточку».

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const V = '1.4.31';

assert.match(src, new RegExp(`@version\\s+${V.replace(/\./g, '\\.')}`), `версия ${V}`);

// ── 1. Промпт: очередь — зона Координатора ─────────────────────────────────
const promptFrom = src.indexOf('  function coordinatorPrompt(');
const promptTo = src.indexOf('  // ───────────────────────────── ход исполнителя', promptFrom);
const prompt = new Function(
  'technicalInfo', 'rt', 'roleContext',
  `${src.slice(promptFrom, promptTo)}; return coordinatorPrompt;`,
)(
  () => 'ТЕХНИКА',
  () => 'NAR-1',
  () => 'Ты — Coordinator.',
)(
  { id: 'mission-1', properties: { 'Миссия': { title: [{ plain_text: 'NAR-1' }] }, 'ТЗ URL': { url: 'https://x' } } },
  { name: 'Coordinator', fn: 'Coordinator' },
  '1 Submitted, 0 Running, 1 Ready, 0 Rework, 2 Draft',
  'turn-1',
  '',
  '',
  'Черновики (предложения — выдаёшь их ты): NAR-1.10 · Регрессия и отчёт (Build/Release, Sequence 100).',
);

assert.match(prompt, /1 Submitted, 0 Running, 1 Ready, 0 Rework, 2 Draft/, 'черновики есть в счётчике очереди');
assert.match(prompt, /Черновики \(предложения — выдаёшь их ты\)/, 'черновики перечислены списком');
assert.match(prompt, /черновик \(Draft\) → Ready, правка полей черновика и архив лишнего — такие же твои действия/, 'выдача черновика — право Координатора');
assert.match(prompt, /Мастер и Архитектор пишут только черновики/, 'кто пишет черновики');
assert.match(prompt, /Работу исполнителю выдаёшь ты, не дожидаясь Мастера/, 'ждать Мастера не нужно');
assert.match(prompt, /Движок ставит Running и Submitted/, 'граница движка названа точно');
assert.match(prompt, /Ready ставишь тоже ты/, 'Ready — не движок, а Координатор');
assert.match(prompt, /или переведи в Ready подходящий Draft/, 'черновик можно выдать в том же ходе');
assert.match(prompt, /Черновики — твой задел/, 'сказано, зачем черновики');
assert.doesNotMatch(prompt, /ставит движок\./, 'прежней фразы «Ready … ставит движок» больше нет');
assert.doesNotMatch(prompt, /не вправе|нельзя переводить Draft/i, 'запрета на выдачу черновика нет');

// ── 2. draftLine: список, а не число ────────────────────────────────────────
const lineFrom = src.indexOf('  function draftLine(cards) {');
const lineTo = src.indexOf('  async function coordinatorStep(');
assert.ok(lineFrom > 0 && lineTo > lineFrom, 'draftLine на месте');
const draftLine = new Function(
  'C', 'taskTitle', 'taskRole',
  `${src.slice(lineFrom, lineTo)}; return draftLine;`,
)(
  { draftLineMax: 2 },
  (card) => card.properties['Запрос'].title[0].text.content,
  (card) => card.properties['Кому']?.select?.name || '',
);

const card = (title, who, seq) => ({
  id: title,
  properties: {
    'Запрос': { title: [{ text: { content: title } }] },
    'Кому': { select: who ? { name: who } : null },
    'Sequence': { number: seq },
  },
});

assert.match(draftLine([]), /Черновиков нет/, 'пустой задел назван словами');
assert.match(draftLine([]), /предложи сам/, 'и это не приглашение ждать Мастера');

const two = draftLine([card('NAR-1.10 · Регрессия и отчёт', 'Build/Release', 100), card('NAR-1.9 · Реестр caps', 'Kernel', 90)]);
assert.match(two, /NAR-1\.9 · Реестр caps \(Kernel, Sequence 90\)/, 'порядок по Sequence, роль и номер видны');
assert.match(two, /NAR-1\.10 · Регрессия и отчёт \(Build\/Release, Sequence 100\)/, 'второй черновик тоже в списке');
assert.ok(two.indexOf('Sequence 90') < two.indexOf('Sequence 100'), 'сначала меньший Sequence');

const three = draftLine([
  card('A · один', 'Kernel', 10),
  card('B · два', 'Kernel', 20),
  card('C · три', 'Kernel', 30),
]);
assert.match(three, /и ещё 1/, 'лишнее сверх лимита свёрнуто');
assert.ok(!/C · три/.test(three), 'свёрнутые не перечисляются');

// Роль не задана — так и пишем, а не пустые скобки.
assert.match(draftLine([card('D · четыре', '', 40)]), /роль не задана/, 'пустая роль названа');

// ── 3. queueOf считает Draft ───────────────────────────────────────────────
const qFrom = src.indexOf('  async function queueOf(mission) {');
const qTo = src.indexOf('  function draftLine(cards) {');
const queueOf = new Function(
  'tasks',
  `${src.slice(qFrom, qTo)}; return queueOf;`,
)(async (state) => Array.from({ length: { Submitted: 1, Running: 0, Ready: 1, Rework: 0, Draft: 2 }[state] || 0 }));

queueOf({ id: 'm1' }).then((queue) => {
  assert.equal(queue.draft.length, 2, 'черновики читаются отдельным запросом');
  assert.equal(queue.summary, '1 Submitted, 0 Running, 1 Ready, 0 Rework, 2 Draft', 'счётчик Draft в строке очереди');

  // ── 4. Ход Координатора передаёт черновики в промпт ──────────────────────
  const planFrom = src.indexOf('  async function requestPlan(');
  const planTo = src.indexOf('  async function dispatchTask(', planFrom);
  const plan = src.slice(planFrom, planTo);
  assert.match(plan, /const drafts = draftLine\(queue\.draft \|\| \[\]\);/, 'список черновиков собирается');
  assert.match(
    plan,
    /coordinatorPrompt\(mission, role, summary, turnId, note, answerLine, drafts\)/,
    'и уходит в промпт',
  );
  assert.match(plan, /\$\{\(queue\.draft \|\| \[\]\)\.length\} Draft/, 'запасной счётчик тоже знает про Draft');

  // ── 5. Подсказки на промах говорят про черновик, а не «создайте карточку» ─
  const routeFrom = src.indexOf('  function decisionRoute(next,');
  const routeTo = src.indexOf('  /** Свежие счётчики очереди');
  const decisionRoute = new Function(
    'norm',
    `${src.slice(routeFrom, routeTo)}; return decisionRoute;`,
  )((x) => String(x || '').replace(/-/g, '').toLowerCase());

  const roles = [{ name: 'Coordinator', fn: 'Coordinator' }, { name: 'Kernel', fn: 'Executor' }];

  const ask = decisionRoute('Kernel', { roles, readyRoles: [] });
  assert.equal(ask.kind, 'ask', 'нет карточки — просим, а не падаем');
  assert.match(ask.note, /переведи в Ready подходящий Draft/, 'подсказка предлагает выдать черновик');

  const again = decisionRoute('Kernel', { roles, readyRoles: [], misses: 1 });
  assert.equal(again.kind, 'pause', 'второй промах — пауза');
  assert.match(again.reason, /Нажмите «Продолжить»/, 'выход — продолжить, а не «создайте карточку»');
  assert.match(again.reason, /создать карточку или выдать черновик/, 'сказано, что он умеет');

  const self = decisionRoute('Coordinator', { roles, readyRoles: [] });
  assert.match(self.note, /выдай работу сам/, 'ход вернулся — выдай сам');

  console.log(
    `OK: narthex ${V} — Координатор сам создаёт и выдаёт карточки: Draft → Ready, ` +
      'черновики видны списком и считаются в очереди',
  );
});
