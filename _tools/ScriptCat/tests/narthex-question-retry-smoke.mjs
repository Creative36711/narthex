// Проба 1.4.70: вопрос, который не записался в Notion, не теряется.
//
// 25.10 в 21:28 Координатор спросил про предел руководства — и в базе «Вопросы»
// не появилось ни строки: «Ждёт» = 0. Вопрос остался только в маркере, ❓ и пуш
// молчали, Мастер увидел его случайно. Причина — неудачная запись: `askQuestion`
// писал ошибку в журнал и возвращал null, второго шанса не было.
//
// Здесь проверяется, что такая строка попадает в очередь, переживает неудачу и
// записывается при следующей проверке вопросов — то есть вопрос опаздывает, но
// не исчезает.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const has = (needle, why) => assert.ok(src.includes(needle), `в скрипте нет: ${why}`);

const from = src.indexOf('  function queueQuestion(q, ctx = {}) {');
const to = src.indexOf('  async function askQuestion(q, ctx = {}) {');
assert.ok(from > 0 && to > from, 'блок очереди вопросов на месте');
const block = src.slice(from, to);

function make({ failPost = false } = {}) {
  const store = new Map();
  const logs = [];
  const posted = [];
  let posts = 0;
  const fn = new Function(
    'GM_getValue', 'GM_setValue', 'K', 'C', 'notion', 'questionProps', 'noteQuestionAsked', 'log', 'dbg',
    `${block}\nreturn { queueQuestion, flushQuestionQueue };`,
  );
  const api = fn(
    (key, def) => (store.has(key) ? store.get(key) : def),
    (key, value) => store.set(key, value),
    { qQueue: 'k-queue' },
    { questions: 'ds-questions' },
    async (method, path, body) => {
      posts += 1;
      if (failPost) throw new Error('Notion 502');
      posted.push({ method, path, body });
      return { id: `row-${posts}`, properties: { 'Вопрос': { title: [{ plain_text: body.properties['Вопрос'].title[0].text.content }] } } };
    },
    (q) => ({ 'Вопрос': { title: [{ type: 'text', text: { content: q.text } }] } }),
    (row, q) => logs.push({ note: q.text, rowId: row.id }),
    (text, error, opts) => logs.push({ text, error: Boolean(error), ntfy: opts?.ntfy }),
    () => {},
  );
  return { ...api, store, logs, posted, posts: () => posts };
}

const question = {
  text: 'Какой предел руководства действует?',
  fallback: 'Оставить 71 680',
  options: ['A', 'B', 'C'],
  blocks: '',
  hours: 24,
};

// ── 1. Неудача: строка остаётся в очереди ─────────────────────────────────
{
  const { queueQuestion, flushQuestionQueue, store } = make({ failPost: true });
  queueQuestion(question, { roleName: 'Coordinator', key: 'm:1' });
  const saved = await flushQuestionQueue();
  assert.equal(saved, 0, 'при отказе Notion ничего не записано');
  assert.equal(store.get('k-queue').length, 1, 'вопрос остался в очереди, а не пропал');
}

// ── 2. Успех: очередь пустеет, вопрос записывается ────────────────────────
{
  const { queueQuestion, flushQuestionQueue, store, posted, logs } = make();
  queueQuestion(question, { roleName: 'Coordinator', key: 'm:1' });
  const saved = await flushQuestionQueue();
  assert.equal(saved, 1, 'отложенный вопрос записан');
  assert.equal(store.get('k-queue').length, 0, 'очередь пуста');
  assert.equal(posted.length, 1, 'сделан ровно один POST');
  assert.equal(posted[0].body.parent.data_source_id, 'ds-questions', 'строка идёт в базу «Вопросы»');
  assert.equal(posted[0].body.properties['Вопрос'].title[0].text.content, question.text);
  assert.ok(logs.some((l) => l.ntfy === 'loud'), 'о записанном вопросе приходит громкий пуш');
  assert.ok(logs.some((l) => l.text && l.text.includes('Отложенный вопрос')), 'в журнал ушло объяснение');
}

// ── 3. Очередь ограничена и переживает несколько вопросов ─────────────────
{
  const { queueQuestion, flushQuestionQueue, store } = make();
  for (let i = 0; i < 12; i += 1) queueQuestion({ ...question, text: `Вопрос ${i}` }, { key: `k${i}` });
  assert.ok(store.get('k-queue').length <= 10, 'очередь не растёт бесконечно');
  await flushQuestionQueue();
  assert.equal(store.get('k-queue').length, 0, 'все отложенные вопросы записаны');
}

// ── 4. Проводка: неудача пишется в очередь, повтор идёт с проверкой ────────
has('queueQuestion(q, ctx);', 'неудачная запись попадает в очередь');
has('Строка отложена и повторится сама', 'Мастер видит, что вопрос не потерян');
has('await flushQuestionQueue();', 'повтор запускается при обновлении вопросов');
has('qQueue: "cfn-q-queue",', 'ключ хранилища очереди');
has('@version      1.4.70', 'версия 1.4.70');

console.log('question-retry: ok');
