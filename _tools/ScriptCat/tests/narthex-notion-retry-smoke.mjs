// Проба 1.4.76: короткий сбой Notion не останавливает цикл.
//
// 27.10 в 19:23 цикл встал на паузе: POST `data_sources/ed076bfe-…/query`
// получил HTTP 502. Это ответ на стороне Notion, а не отказ по существу:
// карточка и ход были целы. Скрипт же считал 5xx отказом, не повторял запрос и
// останавливался — Мастер у экрана из-за чужой пятиминутной аварии.
//
// Теперь 429 и 5xx считаются сбоем связи: запрос повторяется (до трёх попыток,
// с выдержкой), а если Notion не восстановился — пауза говорит прямо, что это
// его сторона и ход не потерян.
//
// Проверяется:
//   • 502 → повтор → успех: паузы нет, цикл продолжается;
//   • чтение, правка свойств и запрос очереди повторяются;
//   • создание страницы (POST pages) не повторяется никогда: на 502 запрос мог
//     уже пройти, и повтор сделал бы вторую карточку;
//   • 4xx не повторяется: это не сбой связи, а отказ по существу;
//   • три 5xx подряд → ошибка с источником «Notion» и понятным текстом;
//   • networkish знает про 429 и 5xx.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
assert.match(src, /@version\s+1\.4\.76/, 'версия 1.4.76');

const sliceBetween = (startMarker, endMarker) => {
  const from = src.indexOf(startMarker);
  const to = src.indexOf(endMarker, from);
  assert.ok(from > 0 && to > from, `блок ${startMarker.slice(0, 40)} на месте`);
  return src.slice(from, to);
};

// ── 1. Сбой связи ──────────────────────────────────────────────────────────
const netBlock = sliceBetween('  const networkish = (text) =>', '  function requestOnce(');
const networkish = new Function(`${netBlock}; return networkish;`)();
for (const text of [
  'HTTP 502: Bad Gateway',
  'HTTP 503',
  'HTTP 504: Gateway Timeout',
  'HTTP 500: Internal Server Error',
  'HTTP 429: rate limited',
  'таймаут запроса',
  'Failed to fetch',
]) {
  assert.equal(networkish(text), true, `«${text}» — сбой, который имеет смысл повторить`);
}
for (const text of ['HTTP 400: bad request', 'HTTP 404', 'HTTP 401: Unauthorized', 'validation_error']) {
  assert.equal(networkish(text), false, `«${text}» — отказ по существу, повтор не поможет`);
}

// ── 2. notion(): повтор 5xx, но не создание страниц ────────────────────────
const notionSrc = sliceBetween('  async function notion(method, path, body) {', '  /**\n   * Вызов шлюза Drive.');

const makeHarness = (replies) => {
  const calls = [];
  const waits = [];
  const notion = new Function(
    'GM_getValue', 'K', 'C', 'isUuid', 'request', 'sleep',
    `${notionSrc}; return notion;`,
  )(
    (key) => (key === 'cfn-notion-token' ? 'secret' : ''),
    { notion: 'cfn-notion-token' },
    { notionV: '2025-09-03' },
    (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '')),
    async (method) => {
      calls.push(method);
      const reply = replies(calls.length, method);
      if (reply instanceof Error) throw reply;
      return reply;
    },
    async (ms) => {
      waits.push(ms);
    },
  );
  return { notion, calls, waits };
};

// 2.1. Один 502 — повтор, и всё идёт дальше.
{
  const h = makeHarness((n) => (n === 1 ? new Error('HTTP 502: Bad Gateway') : { results: [] }));
  const out = await h.notion('POST', 'data_sources/ed076bfe-99dd-447d-9cac-55ca14661e99/query', {});
  assert.deepEqual(out, { results: [] }, 'ответ второго запроса принят');
  assert.equal(h.calls.length, 2, 'запрос повторён один раз');
  assert.deepEqual(h.waits, [800], 'перед повтором подождали');
}

// 2.2. Два 502 — ещё повтор.
{
  const h = makeHarness((n) => (n < 3 ? new Error('HTTP 503') : { ok: true }));
  assert.deepEqual(await h.notion('GET', 'pages/4016f0cf-5705-81f7-8bf6-e7c605f152eb'), { ok: true });
  assert.equal(h.calls.length, 3, 'три попытки');
  assert.deepEqual(h.waits, [800, 2500], 'выдержка растёт');
}

// 2.3. Создание страницы не повторяется: на 502 запрос мог уже пройти.
{
  const h = makeHarness(() => new Error('HTTP 502: Bad Gateway'));
  await assert.rejects(
    () => h.notion('POST', 'pages', { parent: {} }),
    /Notion не ответил на POST pages: HTTP 502/,
    'ошибка называет Notion и запрос',
  );
  assert.equal(h.calls.length, 1, 'POST pages не повторялся');
  assert.deepEqual(h.waits, [], 'и выдержки не было');
}

// 2.4. 4xx не повторяется.
{
  const h = makeHarness(() => new Error('HTTP 400: path failed validation'));
  await assert.rejects(() => h.notion('PATCH', 'pages/4016f0cf-5705-81f7-8bf6-e7c605f152eb', {}), /HTTP 400/);
  assert.equal(h.calls.length, 1, 'отказ по существу не повторяем');
}

// 2.5. Notion не поднялся: три попытки и честная причина.
{
  const h = makeHarness(() => new Error('HTTP 502: Bad Gateway'));
  await assert.rejects(
    () => h.notion('POST', 'data_sources/ed076bfe-99dd-447d-9cac-55ca14661e99/query', {}),
    (e) => {
      assert.equal(e.narthex, 'notion', 'источник назван: Notion');
      assert.match(e.message, /Notion не ответил на POST data_sources\/.*\/query: HTTP 502/, 'текст называет запрос');
      return true;
    },
  );
  assert.equal(h.calls.length, 3, 'использованы все три попытки');
}

// ── 3. Пауза объясняет, чья это ошибка ────────────────────────────────────
const pauseBlock = sliceBetween('      const raw = String((e && e.message) || e);', '        { kind: "error" },');
assert.match(pauseBlock, /HTTP \(\?:429\|5/, 'в тексте паузы разбирается код 429/5xx');
assert.match(pauseBlock, /Notion ответил сбоем на своей стороне/, 'сказано, что сбой не наш');
assert.match(pauseBlock, /это не ошибка карточки и не потерянный ход/, 'и что ход не потерян');
assert.ok(
  pauseBlock.indexOf('HTTP (?:429|5') < pauseBlock.indexOf('e && e.narthex === "notion"'),
  'сбой сервера отличается от сети до общей формулировки',
);

console.log('OK: narthex 1.4.76 — 5xx/429 от Notion повторяются, POST pages — нет, пауза называет виновника');
