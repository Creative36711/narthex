// Проба 1.4.22: «45 минут» — не лимит на работу агента.
//
// Вопрос Мастера (52): «То есть ограничение на работу агента 45 минут??? Агент
// может выполнять задачу 2-3 часа и более». Вопрос по делу: `releaseStalled`
// возвращает карточку из Running в Ready, и раньше это был плоский таймер —
// сработал бы и под работающим агентом, если скрипт потерял ожидание.
//
// Здесь проверяется поведением: пока у скрипта есть живой ход (неотправленное
// задание или ожидание ответа по этой карточке), карточка не трогается вообще,
// сколько бы она ни висела. Таймер остаётся только для брошенных карточек.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

const from = src.indexOf('  async function releaseStalled(mission) {');
const to = src.indexOf('  /**\n   * Что делать по решению Координатора');
assert.ok(from > 0 && to > from, 'releaseStalled на месте');

const MIN = 60_000;

function make({ pending = null, expect = null, cards = [] } = {}) {
  const patched = [];
  const logs = [];
  const store = { 'cfn-pending': pending, 'cfn-expect': expect };
  const releaseStalled = new Function(
    'GM_getValue', 'K', 'norm', 'tasks', 'patch', 'log', 'taskTitle', 'C',
    `${src.slice(from, to)}; return releaseStalled;`,
  )(
    (key, fallback) => store[key] ?? fallback,
    { pending: 'cfn-pending', expect: 'cfn-expect' },
    (x) => String(x || '').replace(/-/g, '').toLowerCase(),
    async () => cards,
    async (id, props) => patched.push({ id, name: props['Dispatch State'].select.name }),
    (text, error) => logs.push({ text, error: Boolean(error) }),
    (card) => card.properties['Запрос'].title[0].plain_text,
    { stalledMs: 45 * MIN },
  );
  return { releaseStalled, patched, logs };
}

const card = (id, minutesAgo, title = `NAR-${id}`) => ({
  id,
  properties: {
    'Запрос': { title: [{ plain_text: title }] },
    'Started At': { date: { start: new Date(Date.now() - minutesAgo * MIN).toISOString() } },
    'Dispatch State': { select: { name: 'Running' } },
  },
});

// ── 1. Идёт отправка: не трогаем ничего, даже десятичасовую карточку ──────
{
  const h = make({ pending: { roleId: 'k', at: Date.now() }, cards: [card('c1', 600)] });
  await h.releaseStalled({ id: 'm' });
  assert.deepEqual(h.patched, [], 'пока задание не ушло, карточки не перевыдаются');
}

// ── 2. Ждём ответа по этой карточке: агент может работать хоть три часа ───
{
  const expect = { ref: 'c1', sentAt: Date.now(), roleName: 'Kernel', watermark: 'm1' };
  const h = make({ expect, cards: [card('c1', 180)] });
  await h.releaseStalled({ id: 'm' });
  assert.deepEqual(h.patched, [], 'карточка с живым ожиданием не возвращается в Ready через 3 часа');
}

// ── 3. Ожидание по другой карточке не защищает брошенную ─────────────────
{
  const expect = { ref: 'c2', sentAt: Date.now(), roleName: 'Kernel' };
  const h = make({ expect, cards: [card('c1', 180), card('c2', 180)] });
  await h.releaseStalled({ id: 'm' });
  assert.deepEqual(h.patched, [{ id: 'c1', name: 'Ready' }], 'брошенная карточка возвращается, живая — нет');
  assert.match(h.logs[0].text, /180 мин без хода скрипта/, 'в журнале видно, сколько висела');
}

// ── 4. Ожидание без отметки отправки не считается живым ходом ────────────
{
  const expect = { ref: 'c1', roleName: 'Kernel' }; // sentAt нет: сообщение не ушло
  const h = make({ expect, cards: [card('c1', 60)] });
  await h.releaseStalled({ id: 'm' });
  assert.deepEqual(h.patched, [{ id: 'c1', name: 'Ready' }], 'неотправленный ход не держит карточку вечно');
}

// ── 5. Порог: 44 минуты — рано, 46 — пора ────────────────────────────────
{
  const early = make({ cards: [card('c1', 44)] });
  await early.releaseStalled({ id: 'm' });
  assert.deepEqual(early.patched, [], 'до порога не трогаем');

  const late = make({ cards: [card('c1', 46)] });
  await late.releaseStalled({ id: 'm' });
  assert.deepEqual(late.patched, [{ id: 'c1', name: 'Ready' }], 'после порога возвращаем');
}

// ── 6. В коде сказано, что это не лимит работы ───────────────────────────
assert.match(src, /stalledMs: 2700000, \/\/ 45 минут — и только для карточки/, 'порог назван честно');
assert.match(src, /Это не лимит на работу агента/, 'в коде объяснено, что это не лимит');
assert.match(src, /агент может\s*\n?\s*\/\/ работать и два, и три часа|агент может[\s\S]{0,80}три часа/, 'и что долгая работа — норма');

// ── 7. Молчание ≠ работа: снимаем передачу только у бездействующего ──────
assert.match(
  src,
  /if \(waited > C\.replyWaitMs && !fresh && !working\) \{/,
  'долгое молчание считается потерей, только если агент ничего не делает',
);
assert.match(src, /const working = stillWorking\(\);/, 'признак работы берётся из DOM, а не из таймера');
assert.match(
  src,
  /Длинная задача может идти часами: ждём, передачу не снимаю\./,
  'в журнале объяснено, что долгое ожидание — норма',
);
assert.match(src, /longWaitNoticeMs: 600000/, 'напоминание о долгом ожидании — раз в 10 минут');

console.log('OK: narthex 1.4.23 — 45 минут не ограничивают работу агента: живой ход не перевыдаётся');
