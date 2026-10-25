// Проба 1.4.73: ошибка Arena поверх задания не считается доставкой, а задание
// повторяется короткой версией.
//
// 25.10 дважды — 21:24 и 22:55 — задание Architect (NAR-2.16) не принималось:
// «Something went wrong. Please try again.» Сообщение в транскрипте оставалось,
// ход у агента не начинался, и оба раза цикл вставал до ручного вмешательства.
// Полный промпт тут около пяти тысяч символов, и повторять его целиком — значит
// получить ту же ошибку.
//
// Здесь проверяется:
//   1) после ошибки в очередь кладётся короткий текст (без техблока), а не
//      полный промпт; повтор идёт той же карточке и с тем же Run ID;
//   2) id «мёртвого» сообщения запоминается, и `lastUserSays` не принимает
//      старую копию за доставку;
//   3) повторов не больше `arenaResendMax`, ошибка старше окна не считается, а
//      когда повторы исчерпаны — честная пауза.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const has = (needle, why) => assert.ok(src.includes(needle), `в скрипте нет: ${why}`);

// ── 1. Короткий повтор: текст, счётчик, метка мёртвого сообщения ───────────
const fromRequeue = src.indexOf('  /**\n   * Короткая версия задания');
const toRequeue = src.indexOf('  /**\n   * Ждём ответ без маркера.');
assert.ok(fromRequeue > 0 && toRequeue > fromRequeue, 'блок повтора на месте');
const requeueBlock = src.slice(fromRequeue, toRequeue);

function makeRequeue() {
  const store = new Map();
  const logs = [];
  const fn = new Function(
    'GM_getValue', 'GM_setValue', 'K', 'C', 'log',
    `${requeueBlock}\nreturn { retryRejectedHandoff, compactPrompt };`,
  );
  const api = fn(
    (key, def) => (store.has(key) ? store.get(key) : def),
    (key, value) => store.set(key, value),
    { deadSend: 'k-dead', pending: 'k-pending', expect: 'k-expect' },
    { arenaResendMax: 2, arenaRetryMs: 180000 },
    (text, error, opts) => logs.push({ text, error: Boolean(error), ntfy: opts?.ntfy }),
  );
  return { ...api, store, logs };
}

const fullPrompt =
  '=== CF_TECH v1 ===\n━━━ ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ · Architect ━━━\n' +
  'Задача NAR-2.16 · ADR 2.14 принят (dispatch card-2-16, run run-7896582d).\n' +
  'ЦЕЛЬ И ГРАНИЦЫ\n'.padEnd(4200, 'правила хода и техблок ');

const expect = {
  roleId: 'agent-architect',
  roleName: 'Architect',
  roleUrl: 'https://arena.example/agent/architect',
  kind: 'dispatch',
  ref: 'card-2-16',
  runId: 'run-7896582d',
  title: 'NAR-2.16 · ADR 2.14 принят',
  watermark: 'chat-message-41',
  text: fullPrompt,
  sentAt: Date.now(),
  verified: true,
};

{
  const { retryRejectedHandoff, store, logs } = makeRequeue();
  const ok = retryRejectedHandoff(expect, { messageId: 'chat-message-42' }, 'Arena ответила «Something went wrong»');
  assert.equal(ok, true, 'повтор поставлен');

  const pending = store.get('k-pending');
  assert.equal(pending.roleId, expect.roleId, 'задание адресовано тому же агенту');
  assert.ok(pending.text.length < fullPrompt.length / 2, 'повтор короче полного промпта');
  assert.ok(!pending.text.includes('ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ'), 'техблок в повтор не дублируется');
  assert.ok(pending.text.includes('CF_AGENT_RESULT'), 'маркер назван');
  assert.ok(pending.text.includes('"dispatch_id":"card-2-16"'), 'dispatch в маркере тот же');
  assert.ok(pending.text.includes('"run_id":"run-7896582d"'), 'run в маркере тот же');
  assert.ok(pending.text.includes('gh pr merge --squash'), 'мерж PR остаётся за исполнителем');
  assert.equal(pending.undelivered, undefined, 'это не «недошедшее», а новый текст');

  const next = store.get('k-expect');
  assert.equal(next.sentAt, null, 'отметка отправки снята: доставки не было');
  assert.equal(next.verified, false, 'подтверждение доставки снято');
  assert.equal(next.arenaResend, 1, 'первый повтор посчитан');
  assert.equal(next.text, pending.text, 'ожидание знает, какой текст уйдёт');
  assert.equal(store.get('k-dead'), 'chat-message-42', 'мёртвое сообщение запомнено по id');
  assert.ok(logs.some((l) => l.error && l.text.includes('короткой версией')), 'в журнале видна причина повтора');
  assert.ok(logs.some((l) => l.text.includes('символов вместо')), 'в журнале видно длины: полная и короткая');
}

// ── 2. Второй повтор короче первого, третий — уже пауза ─────────────────────
{
  const { retryRejectedHandoff, store } = makeRequeue();
  retryRejectedHandoff(expect, { messageId: 'm1' }, 'первая');
  const first = store.get('k-pending').text;
  // Второй текст тоже ушёл и тоже не принялся: отправка состоялась, ошибка новая.
  const sentAgain = { ...store.get('k-expect'), sentAt: Date.now() };
  retryRejectedHandoff(sentAgain, { messageId: 'm2' }, 'вторая');
  const second = store.get('k-pending').text;
  assert.equal(store.get('k-expect').arenaResend, 2, 'второй повтор посчитан');
  assert.ok(second.length < first.length, 'второй повтор ещё короче: «выполни задание выше»');
  assert.equal(store.get('k-dead'), 'm2', 'метка указывает на последнее мёртвое сообщение');
  const sentThird = { ...store.get('k-expect'), sentAt: Date.now() };
  assert.equal(retryRejectedHandoff(sentThird, { messageId: 'm3' }, 'третья'), false, 'третий повтор не ставится');
}

// ── 3. Чужая и старая ошибка повтором не считается ─────────────────────────
{
  const { retryRejectedHandoff, store } = makeRequeue();
  assert.equal(retryRejectedHandoff({ ...expect, roleId: '' }, { messageId: 'm1' }, 'x'), false, 'без получателя повторять некуда');
  assert.equal(retryRejectedHandoff({ ...expect, sentAt: null }, { messageId: 'm1' }, 'x'), false, 'не отправляли — повторять нечего');
  assert.equal(retryRejectedHandoff({ ...expect, sentAt: Date.now() - 600000 }, { messageId: 'm1' }, 'x'), false, 'старая ошибка — не про эту отправку');
  assert.equal(store.has('k-pending'), false, 'очередь не создаётся зря');
}

// ── 4. lastUserSays: мёртвая копия — не доставка ───────────────────────────
const fromSays = src.indexOf('  function lastUserSays(key) {');
const toSays = src.indexOf('  /** Ждём подтверждение доставки');
assert.ok(fromSays > 0 && toSays > fromSays, 'блок lastUserSays на месте');
const saysBlock = src.slice(fromSays, toSays);

function says({ dead = '', lastId = 'chat-message-42', text = 'Задание 2.16 · NAR-2.16' } = {}) {
  const fn = new Function(
    'GM_getValue', 'K', 'userMessages', 'nodeId', 'flat',
    `${saysBlock}\nreturn { lastUserSays };`,
  );
  const { lastUserSays } = fn(
    (key, def) => (key === 'k-dead' ? dead : def),
    { deadSend: 'k-dead' },
    () => [{ id: lastId, textContent: text }],
    (node) => node.id,
    (value) => String(value || '').replace(/\s+/g, ' ').trim(),
  );
  return lastUserSays;
}

assert.equal(says({ dead: '' })('Задание 2.16'), true, 'обычная доставка видна');
assert.equal(says({ dead: 'chat-message-42' })('Задание 2.16'), false, 'мёртвая копия доставкой не считается');
assert.equal(says({ dead: 'chat-message-41' })('Задание 2.16'), true, 'другая метка доставку не ломает');
assert.equal(says({ dead: 'chat-message-42' })(''), false, 'пустой ключ ничего не подтверждает');

// ── 5. Проводка: ошибка ловится и в тике, и в ожидании ответа ──────────────
has('arenaResendMax: 2,', 'есть предел коротких повторов');
has('arenaRetryMs: 180000,', 'есть окно, в котором ошибка считается нашей');
has('if (retryRejectedHandoff(expect, alert, `Arena ответила «${alert.text || "ошибка без текста"}»`)) {', 'в тике ошибка сначала лечится повтором');
has('if (retryRejectedHandoff(expect, eaten, `Arena ответила «${eaten.text}»`)) {', 'в ожидании ответа — то же лечение');
has('const again = await consumePending(true);', 'повтор идёт в этом же шаге, без ручного сброса');
has('Переотправка на этой странице не началась', 'если отправка не пошла, это видно в журнале');
has('коротких повторов подряд', 'честная пауза после исчерпания повторов');
has('{ kind: "arena-error", ref: eaten.messageId }', 'пауза сохраняет id сообщения с ошибкой');
has('deadSend: "cfn-dead-send",', 'ключ хранилища для мёртвого сообщения');
has('GM_setValue(K.deadSend, "");', 'метка снимается после настоящей доставки');
has('arenaResend: 0,', '«Продолжить» возвращает право на автоматический повтор');
has('символов).`);', 'длина отправленного видна в журнале');
has('const TECH_OPEN = "=== CF_TECH v1 ===";', 'блок помечен обычным текстом, а не HTML-комментарием');
has('const TECH_CLOSE = "=== /CF_TECH ===";', 'закрывающая метка тоже текстовая');

console.log('arena-swallow: ok');
