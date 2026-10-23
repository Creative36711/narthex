// Проба разбора ответа: маркер, «думаю…» и собственные служебные тексты.
//
// История жалобы Мастера (2026-10-23, 16:58): Координатор ответил с маркером,
// а журнал написал «ответил без маркера» и отправил напоминание, потом ещё
// одно задание. Причины, которые проверяются здесь:
//   • маркер искался по строкам `innerText` у detached-клона — абзацы
//     склеивались, JSON рвался, хвост приклеивался к строке;
//   • в наших же текстах есть пример маркера (`<роль|done>`), и он мог
//     засчитаться как ответ;
//   • ответ, который ещё печатается, нельзя считать готовым;
//   • фон в ручном режиме не должен читать ответы и слать новое задание.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// ── 1. Разбор маркера: код берём из самого скрипта, не копию ─────────────────
const from = src.indexOf('  function braceJson(rest) {');
const to = src.indexOf('  /**\n   * Агент отвечает, только если кнопка остановки видна.');
assert.ok(from > 0 && to > from, 'блок разбора маркера на месте');
const block = src.slice(from, to);
assert.match(block, /function braceJson\(rest\)/, 'скобочный разбор');
assert.match(block, /function markerJson\(raw\)/, 'разбор JSON с вариантами');
assert.match(block, /function isPlaceholderMarker\(obj\)/, 'шаблонные значения отсеиваются');
assert.match(block, /function parseMarker\(text, name\)/, 'parseMarker');

const { parseMarker } = new Function(`${block}; return { parseMarker };`)();
const NAME = 'CF_COORDINATOR_RESULT';

// 1.1. Маркер отдельной строкой — базовый случай.
assert.deepEqual(
  parseMarker('Готово.\nCF_COORDINATOR_RESULT {"mission_id":"m1","turn_id":"t1","status":"completed","next":"Architect"}', NAME),
  { mission_id: 'm1', turn_id: 't1', status: 'completed', next: 'Architect' },
  'маркер отдельной строкой разбирается',
);

// 1.2. Абзацы склеены (innerText у клона не ставит переносов) — раньше это ломало разбор.
assert.deepEqual(
  parseMarker('Следующий ход — Architect.CF_COORDINATOR_RESULT {"mission_id":"m1","turn_id":"t1","status":"completed","next":"Architect"}', NAME),
  { mission_id: 'm1', turn_id: 't1', status: 'completed', next: 'Architect' },
  'маркер без переноса перед ним разбирается',
);

// 1.3. JSON разложен переносами — скобочный разбор не зависит от раскладки.
assert.deepEqual(
  parseMarker('CF_COORDINATOR_RESULT {\n  "mission_id": "m1",\n  "next": "Architect"\n}', NAME),
  { mission_id: 'm1', next: 'Architect' },
  'переносы внутри JSON не мешают',
);

// 1.4. Маркер в блоке кода и с текстом после него.
assert.deepEqual(
  parseMarker('```\nCF_COORDINATOR_RESULT {"mission_id":"m1","next":"Kernel"}\n```\nВсё.', NAME),
  { mission_id: 'm1', next: 'Kernel' },
  'блок кода и текст после маркера не мешают',
);

// 1.5. Пример из нашего задания (`<роль|done>`) — не ответ.
assert.equal(
  parseMarker('Последней строкой ответа:\nCF_COORDINATOR_RESULT {"mission_id":"m1","turn_id":"t1","status":"completed","next":"<роль|done>"}', NAME),
  null,
  'шаблонный маркер из задания не засчитывается',
);

// 1.6. Пример из напоминания — тоже не ответ.
assert.equal(
  parseMarker('ответь ровно одной последней строкой: CF_COORDINATOR_RESULT {"mission_id":"m1","status":"completed","next":"<роль|done>"}', NAME),
  null,
  'шаблонный маркер из напоминания не засчитывается',
);

// 1.7. Маркера нет вовсе.
assert.equal(parseMarker('Думаю над задачей…', NAME), null, 'обычный текст — не маркер');
assert.equal(parseMarker('', NAME), null, 'пустой текст — не маркер');

// 1.8. Два маркера: берём последний, шаблонные пропускаем.
assert.deepEqual(
  parseMarker(
    'CF_COORDINATOR_RESULT {"mission_id":"old","next":"Kernel"}\nCF_COORDINATOR_RESULT {"mission_id":"m1","next":"Architect"}',
    NAME,
  ),
  { mission_id: 'm1', next: 'Architect' },
  'последний настоящий маркер важнее прошлого',
);

// ── 2. Сырой текст: разбор не зависит от innerText ──────────────────────────
assert.match(src, /function messageRaw\(node\)/, 'есть чтение сырого текста');
assert.match(src, /String\(clone\.textContent \|\| ""\)/, 'сырой текст берётся из textContent');
assert.match(src, /parseMarker\(m\.raw, "CF_AGENT_RESULT"\)/, 'исполнитель разбирает сырой текст');
assert.match(src, /parseMarker\(m\.raw, "CF_COORDINATOR_RESULT"\)/, 'Координатор разбирает сырой текст');

// 2.1. Свои служебные сообщения не читаются как ответ.
assert.match(src, /const isOwnPrompt = \(raw\) => \/CF_TECH\/\.test/, 'свой промпт опознаётся по CF_TECH');
assert.match(src, /!isOwnPrompt\(n\.textContent\)/, 'свои тексты выкидываются из списка ответов');

// ── 3. Ответ, который ещё печатается, — не ответ ────────────────────────────
assert.match(src, /function stillWorking\(\)/, 'есть проверка «ещё работает»');
assert.match(src, /if \(generating\(\)\) return true;/, 'кнопка Stop — признак работы');
assert.match(src, /thinking\|reasoning\|typing\|дума\|размышл\|анализ/i, 'плашка «думаю» — тоже признак');
assert.match(src, /if \(stillWorking\(\)\) \{/, 'ожидание маркера не срабатывает во время работы');
assert.match(src, /const signature = `\$\{last\.id\}:\$\{last\.raw\.length\}`;/, 'подпись ответа по сырому тексту');
assert.match(src, /Ответ \$\{role\.name\} ещё может дописаться/, 'ручной шаг объясняет, почему ждёт');

// 3.1. Когда маркера действительно нет — видно, что прочитано.
assert.match(src, /Прочитан хвост: «\$\{tail\(last\.text, 110\)\}»/, 'в журнале есть хвост прочитанного');
assert.match(src, /replies: \(\) => \{/, 'в консоли есть __narthex.replies()');

// ── 4. Шаг — это один шаг ───────────────────────────────────────────────────
const tickStart = src.indexOf('async function tick(');
const tickBody = src.slice(tickStart, src.indexOf('// ───────────────────────────── старт', tickStart));
assert.match(
  tickBody,
  /if \(!auto && !fromToggle\) return;/,
  'фон в ручном режиме не читает ответы и не выдаёт задания',
);
const gateAt = tickBody.indexOf('if (!auto && !fromToggle) return;');
const consumeAt = tickBody.indexOf('await consumePending(fromToggle)');
assert.ok(consumeAt > 0 && gateAt > consumeAt, 'досылка очереди остаётся, ответы — только по нажатию');

// 4.1. Напоминание больше не создаёт «другой вид» ожидания.
assert.match(
  src,
  /await sendToRole\(role, markerReminder\(role, expect, sent \+ 1, markerName\), expect\.kind, expect\.ref,/,
  'напоминание сохраняет вид ожидания',
);
assert.match(
  src,
  /if \(expect && expect\.kind === "reminder"\) \{/,
  'ожидание старой версии приводится к исходному виду',
);
assert.match(
  src,
  /if \(expect && \(expect\.kind === "plan" \|\| expect\.kind === "reminder"\)\) \{/,
  'Координатор принимает напоминание как свой ход',
);

// 4.2. Одно и то же сообщение не уходит дважды.
assert.match(src, /function textHash\(text\)/, 'есть хеш текста');
assert.match(src, /Такое же сообщение уже уходило/, 'дубль объясняется в журнале');
assert.match(src, /lastSend: "cfn-last-send"/, 'память о последней отправке');
assert.match(src, /last\.roleId\) === norm\(role\.id\) && last\.hash === textHash\(text\)/, 'сверяются роль и текст');

// ── 5. В чате нет слова ScriptCat ───────────────────────────────────────────
const chatFrom = src.indexOf('function techHeader(role) {');
const chatTo = src.indexOf('function roleContext(role) {');
const chatText = src.slice(chatFrom, chatTo);
assert.ok(chatText.length > 0, 'блок исходящих текстов найден');
assert.ok(!/ScriptCat/.test(chatText), 'в блоке, который уходит агентам, нет «ScriptCat»');

const reminderFrom = src.indexOf('function markerReminder(role, expect, attempt, markerName) {');
const reminderTo = src.indexOf('function stillWorking() {');
const reminderText = src.slice(reminderFrom, reminderTo);
assert.ok(!/ScriptCat/.test(reminderText), 'в напоминании нет «ScriptCat»');
assert.match(reminderText, /ТЕХНИЧЕСКОЕ НАПОМИНАНИЕ/, 'первая форма напоминания на месте');
assert.match(reminderText, /НАПОМИНАНИЕ О ФОРМАТЕ/, 'вторая форма напоминания — формулировки не совпадают слово в слово');

// ── 6. Человеческий ритм вместо мгновенной отправки ────────────────────────
assert.match(src, /await sleep\(450 \+ Math\.floor\(Math\.random\(\) \* 900\)\);/, 'пауза перед вставкой текста');
assert.match(src, /await sleep\(500 \+ Math\.floor\(Math\.random\(\) \* 1200\)\);/, 'пауза перед нажатием Send');
assert.match(src, /«\$\{role\.name\}» уже открыт — отправляю задание здесь\./, 'свою же страницу не перезагружаем');

console.log('OK: narthex 1.4.8 — ответ разбирается по сырому тексту, «думаю» не считается ответом, один шаг = одна отправка');
