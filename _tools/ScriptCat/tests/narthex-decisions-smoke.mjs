// Проба 1.4.74: предложения агентов видны Мастеру, а не лежат файлом в репозитории.
//
// Случай Мастера (25.10, вечер). Вопрос: «предложено — это кто предложил?»
// Разбор показал: механизм предложения (ADR со статусом `proposed`) описан в
// трёх документах и им законно пользуются, но работает он наполовину:
//   • никто не обязан ответить, списка «что висит на Мастере» не существует —
//     из 21 журнала `docs/decisions/` поле `Статус:` было ровно у двух;
//   • панель вопросов тут не спасает: вопрос — отдельная запись в Notion, а ADR
//     мог появиться и без вопроса;
//   • оракул умудрился заморозить саму нерешённость: `scripts/check-guide.mts`
//     требовал `Статус: proposed`, то есть тест охранял открытый вопрос от ответа.
//
// Здесь проверяется транспортная половина: счётчик решений на панели, громкий
// пуш о новом предложении и правила в промптах, которые заставляют агента
// задать вопрос вместе с ADR и снять статус после ответа.

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const V = '1.4.80';

assert.match(src, /@version\s+1\.4\.80/, `версия ${V}`);

// ── 1. Панель: отдельная кнопка решений ────────────────────────────────────
const has = (needle) => assert.ok(src.includes(needle), `в скрипте нет: ${needle}`);

has('adr: "cfn-adr"');
has('adrBadge: "cfn-adr-badge"');
has('⚖<span id="${ui.adrBadge}"');
has('/tree/main/docs/decisions');
has('adrCheckMs: 600000');
has('paintDecisions(openDecisions().rows)');
has('watchDecisions();');
has('setInterval(() => refreshDecisions()');

// ── 2. Песочница: разбор статуса и объявление нового ───────────────────────
const from = src.indexOf('  const ADR_FOLDER = "docs/decisions";');
const to = src.indexOf('  async function refreshDecisions(');
assert.ok(from > 0 && to > from, 'блок решений на месте');

const store = new Map();
const logs = [];
const api = new Function(
  'C', 'GM_getValue', 'GM_setValue', 'log',
  `${src.slice(from, to)}
   return { adrStatusOf, openDecisions, b64Text, announceDecisions, paintDecisions, ADR_FOLDER };`,
)(
  { adrCheckMs: 600000 },
  (key, fallback) => (store.has(key) ? store.get(key) : fallback),
  (key, value) => store.set(key, value),
  (text, error, options) => logs.push({ text, error, options }),
);

// 2.1. Статус из шапки ADR читается в любом оформлении, которого мы уже видели.
assert.equal(api.adrStatusOf('Статус: proposed\n# NAR-2.15'), 'proposed', 'простой статус');
assert.equal(api.adrStatusOf('Статус: accepted'), 'accepted', 'принятое решение');
assert.equal(api.adrStatusOf('Статус: `proposed`'), 'proposed', 'статус в бэктиках');
assert.equal(api.adrStatusOf('**Статус:** proposed'), '', 'жирный статус полем не считается');
assert.equal(api.adrStatusOf('# NAR-2.13 — без статуса\nТекст'), '', 'журнал без статуса — пусто');
assert.equal(api.adrStatusOf(''), '', 'пустой файл — пусто');

// 2.2. base64 → UTF-8: кириллица в шапке не должна ломаться.
const utf8 = Buffer.from('Статус: proposed\n# NAR-2.16', 'utf8').toString('base64');
assert.match(api.b64Text(utf8), /Статус: proposed/, 'кириллица декодируется');
assert.equal(api.b64Text(''), '', 'пустое содержимое — пустая строка');
assert.equal(api.b64Text('не base64!'), '', 'мусор не роняет разбор');

// 2.3. Первый запуск молчит: пачка старых решений не будит Мастера.
const first = [{ file: 'NAR-2.14.md', sha: 'a' }, { file: 'NAR-2.15.md', sha: 'b' }];
assert.equal(api.announceDecisions(first), 0, 'первый запуск молчит');
assert.equal(
  logs.filter((entry) => entry.options?.ntfy === 'loud').length,
  0,
  'громких пушей на старте нет',
);
assert.match(logs.at(-1).text, /Решений на Мастере: 2/, 'число всё равно названо в журнале');

// 2.4. Новое предложение — строчка в журнале, без громкого пуша.
logs.length = 0;
const second = [...first, { file: 'NAR-2.18.md', sha: 'c' }];
assert.equal(api.announceDecisions(second), 1, 'новое предложение найдено');
const loud = logs.filter((entry) => entry.options?.ntfy === 'loud');
assert.equal(loud.length, 0, 'громкого пуша нет: предложения закрывает приёмка');
const quiet = logs.filter((entry) => entry.options?.ntfy === 'quiet');
assert.equal(quiet.length, 1, 'строчка ровно одна');
assert.match(quiet[0].text, /Новое предложение ждёт решения/, 'в журнале сказано, что это предложение');
assert.match(quiet[0].text, /NAR-2\.18\.md/, 'в журнале имя файла');
assert.match(quiet[0].options.title, /предложение/, 'заголовок говорит про предложение');

// 2.5. Повтор и снятие статуса молчат: приняли решение — уведомлять не о чем.
logs.length = 0;
assert.equal(api.announceDecisions(second), 0, 'повтор не будит');
assert.equal(api.announceDecisions(first), 0, 'снятие статуса не будит');
assert.equal(logs.length, 0, 'лишних строк нет');

// 2.6. Панель без DOM не падает (пробы гоняют этот код в Node).
assert.doesNotThrow(() => api.paintDecisions(second), 'без DOM рисование молчит');

// ── 3. Промпты: второй шаг и запрет замораживать решение ───────────────────
has('ADR `proposed` в docs/decisions) — это тоже вопрос, и оно не работает без второго шага');
has('тремя вариантами и default = «оставить как есть»');
has('Оставлять `proposed` после ответа нельзя');
has('ADR proposed — это очередь решений Мастера');
has('Нерешённое предложение — долг, а не состояние');
has('оракул, который требует `Статус: proposed`, защищает открытый вопрос от ответа');

console.log('narthex-decisions-smoke: ok');
