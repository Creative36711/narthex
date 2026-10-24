// Проба 1.4.37: скрипт обязан видеть ответ, который лежит в чате.
//
// Случай Мастера (2026-10-24, 14:27): Build/Release ответил полным отчётом с
// маркером (`pr:34, merged:true`), а журнал написал «Жду ответ Build/Release:
// новых сообщений нет». Причина — граница «после отправки» считалась по id в
// списке одних ответов:
//   • водяной знак — это id нашей же отправки, а её в отфильтрованном списке
//     нет, поэтому граница либо съедала весь список, либо не оставляла ничего;
//   • id сообщений Arena не упорядочены по времени: ответ
//     `01a16da4-10b2…` пришёл позже запроса `01a16da4-1dc9…`, но меньше его.
//
// Здесь же проверяется второй сбой того же вечера: «Агент ещё отвечает» на
// спокойном агенте — кнопка Stop вне сообщений больше не вечная.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// ── 1. Код чтения сообщений берём из самого скрипта ─────────────────────────
const from = src.indexOf('  function messages() {');
const to = src.indexOf('  /**\n   * Ответ закончен — по разметке Arena, а не по таймеру.');
assert.ok(from > 0 && to > from, 'блок чтения сообщений на месте');
const block = src.slice(from, to);
assert.match(block, /function messagesAfter\(watermark, seen\)/, 'граница знает про снимок id');
assert.match(block, /function rescueReplies\(\)/, 'есть страховка по маркеру');
assert.match(block, /const isUserNode = /, 'свои реплики опознаются по layout');

const markerBlock = src.slice(
  src.indexOf('  function braceJson(rest) {'),
  src.indexOf('  /** Короткая подпись элемента для журнала'),
);
const { parseMarker } = new Function(`${markerBlock}; return { parseMarker };`)();
const norm = (x) => String(x || '').replace(/-/g, '').toLowerCase();

const CARD = '4016f0cf-5705-8197-be3a-c06bf51885ac';
const PROMPT_ID = '01a16da4-1dc9-7597-b01a-aea6543789bd'; // наш prompt
const ANSWER_ID = '01a16da4-10b2-7c56-9c68-15adbcea39ef'; // ответ агента: id МЕНЬШЕ
const ANSWER_AT = 1792840831154; // время из id ответа (11:20:31Z)

const node = (id, text, user = false) => ({
  id: `chat-message-${id}`,
  querySelector: (sel) => (user && sel === '[data-user-message-layout="true"]' ? { user: true } : null),
  querySelectorAll: () => [],
  cloneNode: () => ({ querySelectorAll: () => [], textContent: text }),
});

const answerText =
  'Сделал. Отчёт docs/reports/NAR-1.md, PR #34 слит, смоуки 49/50.\n' +
  `CF_AGENT_RESULT {"dispatch_id":"${CARD}","run_id":"19b52574-2c45-42b6-a29a-f4453c12d790",` +
  '"status":"submitted","check":1,"report":"docs/reports/NAR-1.md","pr":34,"merged":true}';

const load = ({ nodes, waiting = null }) => {
  const logs = [];
  const document = {
    querySelectorAll: (sel) =>
      sel === '[data-agent-transcript-message="true"][id^="chat-message-"]' ? nodes : [],
  };
  const api = new Function(
    'document', 'replyEnded', 'parseMarker', 'norm', 'GM_getValue', 'K', 'logThrottled', 'C',
    `${block}\nreturn { messages, messagesAfter, rescueReplies, idTime, looksLikeOwnTask };`,
  )(
    document,
    () => false,
    parseMarker,
    norm,
    () => waiting,
    { expect: 'cfn-expect' },
    (_key, text) => logs.push(text),
    { longWaitNoticeMs: 600000 },
  );
  return { api, logs };
};

// ── 2. Инцидент: ответ в чате есть, а «после отправки» — пусто ──────────────
// Водяной знак стоит на самом ответе (так бывает, когда отметку поставили уже
// после прихода ответа). Раньше это давало «новых сообщений нет».
{
  const nodes = [node(PROMPT_ID, 'Задача … CF_TECH', true), node(ANSWER_ID, answerText)];
  const waiting = { ref: CARD, roleName: 'Build/Release', sentAt: ANSWER_AT + 4000 };
  const { api, logs } = load({ nodes, waiting });
  const got = api.messagesAfter(ANSWER_ID, [PROMPT_ID, ANSWER_ID]);
  assert.equal(got.length, 1, 'ответ найден, а не потерян');
  assert.equal(got[0].id, ANSWER_ID, 'это именно ответ агента');
  assert.match(got[0].raw, /CF_AGENT_RESULT/, 'маркер читается');
  assert.ok(logs.some((t) => /найден по маркеру выдачи/.test(t)), 'в журнале видно, что ответ нашёлся не по границе');
}

// 2.1. Обычный случай: граница на нашей реплике — ответ ниже неё.
{
  const nodes = [node(PROMPT_ID, 'Задача … CF_TECH', true), node(ANSWER_ID, answerText)];
  const { api, logs } = load({ nodes, waiting: { ref: CARD, sentAt: ANSWER_AT + 4000 } });
  const got = api.messagesAfter(PROMPT_ID, [PROMPT_ID]);
  assert.equal(got.length, 1, 'ответ после нашей реплики возвращается');
  assert.equal(got[0].id, ANSWER_ID, 'и это ответ, а не эхо задания');
  assert.equal(logs.length, 0, 'страховка не понадобилась — журнал не шумит');
}

// 2.2. Наша реплика отфильтрована, но граница всё равно верная (по месту).
{
  const nodes = [node(PROMPT_ID, 'Задача … CF_TECH', true), node(ANSWER_ID, answerText)];
  const { api } = load({ nodes, waiting: null });
  const got = api.messagesAfter(PROMPT_ID, []);
  assert.deepEqual(got.map((m) => m.id), [ANSWER_ID], 'своя реплика выкинута, ответ остался');
}

// 2.3. Водяного знака нет (транскрипт перерисовали) — держит снимок id.
{
  const nodes = [node(PROMPT_ID, 'Задача … CF_TECH', true), node(ANSWER_ID, answerText)];
  const { api } = load({ nodes, waiting: null });
  const got = api.messagesAfter('', [PROMPT_ID]);
  assert.deepEqual(got.map((m) => m.id), [ANSWER_ID], 'новое считается по снимку');
  assert.deepEqual(api.messagesAfter('', [PROMPT_ID, ANSWER_ID]), [], 'всё известное — новых нет');
}

// 2.4. Ответ прошлого круга (Rework) за новый не сходит: он выше нашей реплики.
{
  const oldId = '01a16d00-1111-7000-8000-000000000001';
  const nodes = [
    node('01a16cf0-0000-7000-8000-000000000001', 'Задача … CF_TECH', true),
    node(oldId, answerText),
    node(PROMPT_ID, 'Задача … CF_TECH', true),
  ];
  const { api } = load({ nodes, waiting: { ref: CARD, sentAt: ANSWER_AT + 4000 } });
  assert.deepEqual(api.messagesAfter(PROMPT_ID, []), [], 'старый ответ не принимается за новый');
}

// 2.5. Ответ из прошлого круга ниже по тексту, но давний по id — тоже не новый.
{
  const oldMs = ANSWER_AT - 3 * 24 * 3600 * 1000;
  const hex = oldMs.toString(16).padStart(12, '0');
  const oldId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-8000-000000000000`;
  assert.ok(api_idTime(oldId) > 0, 'время из старого id читается');
  const nodes = [node(oldId, answerText)];
  const { api } = load({ nodes, waiting: { ref: CARD, sentAt: ANSWER_AT + 4000 } });
  assert.deepEqual(api.messagesAfter(oldId, []), [], 'сообщение трёхдневной давности ответом этого хода не считается');
}

function api_idTime(id) {
  const { api } = load({ nodes: [], waiting: null });
  return api.idTime(id);
}

// ── 3. Цитата задания с маркером — это ответ, а не наша реплика ─────────────
{
  const { api } = load({ nodes: [], waiting: null });
  assert.equal(api.looksLikeOwnTask('Задача NAR-1.10 … CF_TECH'), true, 'служебный текст без маркера — наш');
  assert.equal(api.looksLikeOwnTask(`Повторил задание: … CF_TECH …\n${answerText}`), false, 'цитата с маркером остаётся ответом');
  assert.equal(api.idTime('не-uuid'), 0, 'мусорный id времени не даёт');
}

// ── 4. Stop вне сообщений больше не держит шаг вечно ───────────────────────
const staleFrom = src.indexOf('  const stopIsStale = (el) => {');
const staleTo = src.indexOf('  function busyReason() {');
assert.ok(staleFrom > 0 && staleTo > staleFrom, 'stopIsStale на месте');
const stopIsStaleFor = (nodes, endedFn) =>
  new Function(
    'document', 'replyEnded',
    `${src.slice(staleFrom, staleTo)}; return stopIsStale;`,
  )({ querySelectorAll: (sel) => (sel === '[data-agent-transcript-message]' ? nodes : []) }, endedFn);

const m1 = { id: 'm1' };
const outside = { closest: () => null };
assert.equal(stopIsStaleFor([m1], () => true)(outside), true, 'последний ответ закончен — Stop не признак работы (сбой 14:20)');
assert.equal(stopIsStaleFor([m1], () => false)(outside), false, 'ответ печатается — Stop настоящий');
assert.equal(stopIsStaleFor([], () => false)(outside), false, 'чата ещё нет — верим кнопке');
assert.equal(stopIsStaleFor([m1], () => true)({ closest: () => m1 }), true, 'Stop в законченном сообщении — призрак');
assert.equal(stopIsStaleFor([m1], () => false)({ closest: () => m1 }), false, 'Stop в печатающемся сообщении — настоящий');

// ── 5. Один кадр не решает: очередь ждёт подтверждённого признака ──────────
const cpFrom = src.indexOf('  async function consumePending(manual = false) {');
const cpTo = src.indexOf('  // ───────────────────── следы прошлых попыток (очистка)');
assert.ok(cpFrom > 0 && cpTo > cpFrom, 'consumePending на месте');
const cpBody = src.slice(cpFrom, cpTo);
assert.match(cpBody, /const busy = await busySettled\(\);/, 'признак подтверждается вторым чтением');
assert.match(cpBody, /busyLabel\(busy\)/, 'в журнале видно, что именно нашлось');
assert.doesNotMatch(cpBody, /if \(generating\(\)\) \{/, 'мгновенный кадр больше не блокирует отправку');

// ── 6. Ожидание объясняется разбором чата, а не голым «нет сообщений» ──────
assert.match(src, /сообщений агента после нашего задания нет/, 'формулировка не врёт про «нет сообщений»');
assert.match(src, /наших \$\{mine\}, ответов агента \$\{answers\.length\}/, 'в журнале виден разбор чата');
assert.match(src, /Маркера этой выдачи в чате нет\./, 'сказано, чего именно не хватает');

console.log('OK: narthex 1.4.37 — ответ в чате находится и по месту, и по маркеру; Stop вне сообщений не вечен');
