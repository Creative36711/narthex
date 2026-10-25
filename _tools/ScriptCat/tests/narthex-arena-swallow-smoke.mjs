// Проба 1.4.69: ошибка Arena поверх задания не считается доставкой.
//
// 25.10, 21:23–21:26. Скрипт отправил задание Architect (NAR-2.16) в 21:24:09 и
// через секунду получил «Something went wrong. Please try again.». Сообщение в
// транскрипте осталось, ход у агента не начался. Мастер нажал «Продолжить» —
// скрипт не переотправил, а стал ждать ответа, которого не будет: карточка
// висела в Running, спасти её можно было только ручным сбросом цикла.
//
// Здесь проверяется то, что чинит это поведение:
//   1) `requeueUndelivered` возвращает текст задания в очередь и запоминает id
//      «мёртвого» сообщения — новый ход Координатора для переотправки не нужен;
//   2) `lastUserSays` не принимает мёртвую копию за доставку (иначе повторная
//      отправка мгновенно «подтвердилась» бы старым сообщением);
//   3) в ожидании ответа ошибка Arena лечится автоматически один раз, а вторая
//      подряд — честная пауза, а не молчаливое «агента нет».

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const has = (needle, why) => assert.ok(src.includes(needle), `в скрипте нет: ${why}`);

// ── 1. requeueUndelivered: задание снова в очереди ─────────────────────────
const fromRequeue = src.indexOf('  /**\n   * Задание, которое Arena съела ошибкой');
const toRequeue = src.indexOf('  /**\n   * Ждём ответ без маркера.');
assert.ok(fromRequeue > 0 && toRequeue > fromRequeue, 'блок переотправки на месте');
const requeueBlock = src.slice(fromRequeue, toRequeue);

function makeRequeue() {
  const store = new Map();
  const logs = [];
  const fn = new Function(
    'GM_getValue', 'GM_setValue', 'K', 'log',
    `${requeueBlock}\nreturn { requeueUndelivered };`,
  );
  const api = fn(
    (key, def) => (store.has(key) ? store.get(key) : def),
    (key, value) => store.set(key, value),
    { deadSend: 'k-dead', pending: 'k-pending', expect: 'k-expect' },
    (text, error, opts) => logs.push({ text, error: Boolean(error), ntfy: opts?.ntfy }),
  );
  return { ...api, store, logs };
}

const expect = {
  roleId: 'agent-architect',
  roleName: 'Architect',
  roleUrl: 'https://arena.example/agent/architect',
  kind: 'dispatch',
  ref: 'card-2-16',
  runId: 'run-7896582d',
  watermark: 'chat-message-41',
  text: 'Задание 2.16. Задача NAR-2.16 · ADR 2.14 (dispatch 4046f0cf-5705-81bd-92ca-ed93c5a98eab)',
  sentAt: 1761420249000,
  verified: true,
};

{
  const { requeueUndelivered, store, logs } = makeRequeue();
  const ok = requeueUndelivered(expect, { messageId: 'chat-message-42' }, 'Arena ответила «Something went wrong»');
  assert.equal(ok, true, 'переотправка состоялась');

  const pending = store.get('k-pending');
  assert.equal(pending.text, expect.text, 'текст задания сохранён — новый ход не нужен');
  assert.equal(pending.roleId, expect.roleId, 'задание адресовано тому же агенту');
  assert.equal(pending.undelivered, true, 'очередь помечена как недошедшая');

  const next = store.get('k-expect');
  assert.equal(next.sentAt, null, 'отметка отправки снята: доставки не было');
  assert.equal(next.verified, false, 'подтверждение доставки снято');
  assert.equal(next.undelivered, true, 'ожидание знает, что ход не начался');
  assert.equal(next.autoResend, 1, 'первая переотправка автоматическая');
  assert.equal(next.watermark, expect.watermark, 'водяной знак не сдвинут: ответа не было');

  assert.equal(store.get('k-dead'), 'chat-message-42', 'мёртвое сообщение запомнено по id');
  assert.ok(logs.some((l) => l.error && l.text.includes('ещё раз')), 'в журнал ушло объяснение');
}

// ── 2. Вторая подряд неудача считается: autoResend растёт ──────────────────
{
  const { requeueUndelivered, store } = makeRequeue();
  requeueUndelivered(expect, { messageId: 'm1' }, 'первая');
  requeueUndelivered(store.get('k-expect'), { messageId: 'm2' }, 'вторая');
  assert.equal(store.get('k-expect').autoResend, 2, 'счётчик автоматических переотправок растёт');
  assert.equal(store.get('k-dead'), 'm2', 'метка указывает на последнее мёртвое сообщение');
}

// ── 3. Без текста переотправлять нечего ────────────────────────────────────
{
  const { requeueUndelivered, store } = makeRequeue();
  assert.equal(requeueUndelivered({ ...expect, text: '' }, { messageId: 'm1' }, 'x'), false);
  assert.equal(store.has('k-pending'), false, 'пустая очередь не создаётся');
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

// ── 5. Проводка: лечение в ожидании ответа и пауза после второй неудачи ────
has('const eaten = latestUserMessageAlert();', 'проверка ошибки Arena в ожидании ответа');
has('if (eaten && expect.sentAt) {', 'ошибка учитывается только для отправленного задания');
has('requeueUndelivered(expect, eaten, `Arena ответила «${eaten.text}»`);', 'автоматическая переотправка');
has('const again = await consumePending(true);', 'переотправка идёт в этом же шаге, без ручного сброса');
has('Переотправка на этой странице не началась', 'если отправка не пошла, это видно в журнале');
has('Arena снова не доставила задание', 'честная пауза после второй неудачи');
has('{ kind: "arena-error", ref: eaten.messageId }', 'пауза сохраняет id сообщения с ошибкой');
has('deadSend: "cfn-dead-send",', 'ключ хранилища для мёртвого сообщения');
has('GM_setValue(K.deadSend, "");', 'метка снимается после настоящей доставки');
has('autoResend: 0, lastReplySig: "", lastReplyAt: 0', '«Продолжить» возвращает право на переотправку');

console.log('arena-swallow: ok');
