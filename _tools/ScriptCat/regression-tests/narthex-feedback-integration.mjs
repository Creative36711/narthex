// Единая обратная связь: исполняем реальные блоки ScriptCat против модели
// Notion, GitHub, ScriptCat-хранилища и DOM; настоящие сервисы не меняем.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { assertUserscriptVersionContract } from '../version-oracle.mjs';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
assertUserscriptVersionContract(src);
const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + from.length);
  assert(a >= 0 && b > a, `нет блока: ${from}`);
  return src.slice(a, b);
};
const questionBlock = cut('  const Q = {', '  /** Свежие счётчики очереди:');
const answerBlock = cut('  const answerQueue = () => {', '  async function dispatchTask(');
const richText = (s) => String(s || '') ? [{ type: 'text', text: { content: String(s) } }] : [];
const rt = (p) => (p?.rich_text || p?.title || []).map((x) => x.plain_text || x.text?.content || '').join('');
const sel = (p) => p?.select?.name || '';
const norm = (x) => String(x || '').replace(/-/g, '').toLowerCase();
const copy = (value) => structuredClone(value);
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const mission = { id: 'mission-1', properties: { 'Миссия': { title: [{ plain_text: 'TEST-1' }] } } };
const repo = 'Creative36711/narthex';
const ds = '54ac1a79-fef2-4384-ac2c-c0f53379d3ab';
const adrFile = 'TEST-1.7-proposal.md';
const adrPath = `docs/decisions/${adrFile}`;
const adrUrl = `https://github.com/${repo}/blob/main/${adrPath}`;
const config = {
  repo, questions: ds, questionHours: 24, questionLineMax: 3, questionTextMax: 180,
  questionTextFull: 12000, questionDefaultMax: 200, questionCheckMs: 600000, adrCheckMs: 600000,
};
const K = { qQueue: 'q-queue', answers: 'answers', expect: 'expect', ghToken: 'token' };
const store = new Map(), db = [], posts = [], bodyWrites = [], patches = [], logs = [], plans = [];
let messages = [], failQuery = false, failGet = false, failPatch = false, pauseWaitQuery = null, pauseDedupeQuery = null;
let pauseAnswerPatch = null;
const get = (key, fallback) => store.has(key) ? copy(store.get(key)) : fallback;
const set = (key, value) => store.set(key, copy(value));
const statusesOf = (filter) => (filter?.or || []).map((condition) => condition.select.equals);
const query = async (id, filter) => {
  assert.equal(id, ds, 'обе разновидности читают один источник');
  if (failQuery) throw new Error('Notion 503');
  const statuses = statusesOf(filter);
  const snapshot = copy(db.filter((row) => statuses.includes(sel(row.properties['Статус']))));
  const gate = statuses.length === 1 && statuses[0] === 'Ждёт' ? pauseWaitQuery :
    statuses.length === 3 ? pauseDedupeQuery : null;
  if (gate) {
    if (gate === pauseWaitQuery) pauseWaitQuery = null;
    if (gate === pauseDedupeQuery) pauseDedupeQuery = null;
    gate.started();
    await gate.untilReleased;
  }
  await tick(); // ответы в разном порядке и реально перекрывающиеся вызовы
  return snapshot;
};
const notion = async (method, path, body) => {
  if (method === 'POST' && path === 'pages') {
    assert.equal(body.parent.type, 'data_source_id');
    assert.equal(body.parent.data_source_id, ds);
    await tick();
    const row = {
      id: `row-${db.length + 1}`,
      properties: { 'Ответ': { rich_text: [] }, 'Доставлено': { date: null }, ...copy(body.properties) },
    };
    db.push(row);
    posts.push(copy(body));
    return copy(row);
  }
  if (method === 'POST' && /^blocks\/.+\/children$/.test(path)) {
    bodyWrites.push({ path, body: copy(body) });
    return {};
  }
  if (method === 'GET' && path.startsWith('pages/')) {
    if (failGet) throw new Error('Notion GET 503');
    const row = db.find((item) => item.id === path.slice('pages/'.length));
    if (!row) throw new Error('нет строки');
    return copy(row);
  }
  throw new Error(`неожиданный Notion ${method} ${path}`);
};
const patch = async (id, props) => {
  if (failPatch) throw new Error('Notion PATCH 503');
  if (pauseAnswerPatch && props['Статус']?.select?.name === 'Решено') {
    const gate = pauseAnswerPatch;
    pauseAnswerPatch = null;
    gate.started();
    await gate.untilReleased;
  }
  const row = db.find((item) => item.id === id);
  if (!row) throw new Error('нет строки для обновления');
  Object.assign(row.properties, copy(props));
  patches.push({ id, props: copy(props) });
};
const request = async (_method, url) => {
  if (url.includes('/contents/docs/decisions?')) return [{
    type: 'file', name: adrFile, sha: 'sha1', url: 'https://api.github.com/content/adr', html_url: adrUrl,
  }];
  assert.equal(url, 'https://api.github.com/content/adr');
  return { content: Buffer.from('Статус: proposed\n# Предложение', 'utf8').toString('base64') };
};
const api = new Function(
  'C', 'K', 'rt', 'sel', 'norm', 'richText', 'GM_getValue', 'GM_setValue', 'query', 'notion', 'patch',
  'request', 'githubHeaders', 'activeMission', 'missionSame', 'log', 'logThrottled', 'dbg', 'document', 'window',
  'technicalInfo', 'roleContext', 'reviewerRole', 'sendToRole', 'uid', 'messagesAfter', 'parseMarker',
  'markerMissing', 'pause', 'firstLine', 'roles', 'queueOf', 'requestPlan',
  `${questionBlock}\n${answerBlock}\nreturn { parseQuestion, questionInMarker, questionProps, askQuestion,\n` +
  'queueQuestion, flushQuestionQueue, refreshQuestions, refreshDecisions, deliverProposals, closeExpired, questionBriefing,\n' +
  'markDelivered, answerQueue, queueAnswer, answerPrompt, answerStep, openQuestions, notifyNewQuestions, pruneQuestionSeen };',
)(
  config, K, rt, sel, norm, richText, get, set, query, notion, patch, request, () => ({}),
  async () => copy(mission), (a, b) => a === b,
  (text, error, options) => logs.push({ text, error, options }),
  (...args) => logs.push({ throttled: args }), () => {}, undefined, {},
  () => 'ТЕХНИКА', () => 'РОЛЬ', async () => ({ name: 'Warden', fn: 'Reviewer' }), async () => true,
  () => 'turn-1', () => messages,
  (raw, name) => raw.startsWith(name) ? JSON.parse(raw.slice(raw.indexOf('{'))) : null,
  async () => false, (reason) => { throw new Error(`неожиданная пауза: ${reason}`); },
  (text) => String(text || '').split('\n')[0], async () => [{ name: 'Coordinator', fn: 'Coordinator' }],
  async () => ({ summary: 'очередь' }), async (_m, _r, _q, note) => plans.push(note),
);

// Обычный вопрос — в прежний источник и старые поля, ссылка необязательна.
const ordinary = api.parseQuestion({ text: 'Какой формат отчёта выбрать?', options: ['A', 'B'], default: 'A', hours: 24 });
const ordinaryRow = await api.askQuestion(ordinary, { key: 'turn:ordinary', mission: 'TEST-1', roleName: 'Tools' });
assert(ordinaryRow?.id);
assert.equal(posts[0].properties['Вопрос'].title[0].text.content, ordinary.text);
assert.equal(posts[0].properties['Статус'].select.name, 'Ждёт');
assert.equal(posts[0].properties['По умолчанию'].rich_text[0].text.content, 'A');
assert.equal(posts[0].properties['Варианты'].rich_text[0].text.content, 'A · B');
assert.match(posts[0].properties['Срок'].date.start, /^\d{4}-\d\d-\d\dT/);
assert.equal(posts[0].properties['Материал'], undefined);

// Маркер и сторож одновременно обнаруживают один ADR разными фразами.
// Критическая секция не позволяет создать две строки в одной вкладке.
const agentProposal = api.parseQuestion({
  text: `Как решить ADR ${adrPath}? ${'Подробный контекст. '.repeat(12)}`, default: 'оставить как есть',
  options: ['принять', 'отклонить', 'оставить как есть'], hours: 168,
});
const [proposalRow] = await Promise.all([
  api.askQuestion(agentProposal, { key: 'agent:turn-2', mission: 'TEST-1', roleName: 'Architect' }),
  api.refreshDecisions(true),
]);
assert(proposalRow?.id);
assert.equal(db.length, 2, 'вопрос и предложение дают две строки, а не три');
assert.equal(posts.filter((post) => rt(post.properties['Вопрос']).includes(adrFile)).length, 1);
assert.equal(posts[1].properties['Материал'].url, adrUrl, 'ссылка формируется для старого маркера без url');
assert.deepEqual(api.answerQueue().map((row) => row.id).sort(), [ordinaryRow.id, proposalRow.id].sort());
const proposalItem = api.answerQueue().find((row) => row.id === proposalRow.id);
const prompt = api.answerPrompt(mission, { name: 'Warden' }, proposalItem, 'turn-2');
assert(prompt.includes(adrUrl), 'приёмка видит ссылку на материал');
assert.equal(prompt.split(adrUrl).length - 1, 1, 'ссылка не повторяется в промпте');
assert.match(prompt, /CF_ANSWER_RESULT \{"question_id":"row-2"/);
let open = await api.refreshQuestions({ force: true, quiet: true });
assert.equal(open.length, 2, 'счётчик отражает только записи Notion');
assert.equal(new Set(open.map((r) => r.id)).size, 2);
assert.equal(logs.filter((l) => l.options?.title === 'Narthex: новое предложение (ADR)').length, 0);

// Приёмка отвечает по существу; решение попадает в тот же Notion, затем ровно
// один раз доставляется в брифинг, а старая запись вопроса не изменяется.
messages = [{ raw: `CF_ANSWER_RESULT ${JSON.stringify({ question_id: proposalRow.id, turn_id: 'turn-2', verdict: 'answer', answer: 'Принять с указанной поправкой.' })}` }];
await api.answerStep({ name: 'Warden' }, { kind: 'answer', ref: proposalRow.id, watermark: 'watermark' });
assert.equal(sel(db[1].properties['Статус']), 'Решено');
assert.equal(rt(db[1].properties['Ответ']), 'Принять с указанной поправкой.');
assert.equal(sel(db[0].properties['Статус']), 'Ждёт');
assert.equal(plans.length, 1, 'ход возвращён Координатору');
let briefing = await api.questionBriefing(mission);
assert.deepEqual(briefing.fresh.map((r) => r.id), [proposalRow.id]);
assert.match(briefing.answersLine, /Принять с указанной поправкой/);
await api.markDelivered(briefing.fresh);
briefing = await api.questionBriefing(mission);
assert.equal(briefing.fresh.length, 0, 'ответ не доставляется повторно');

// После перезагрузки существующие поля «Вопрос» и «Материал» восстанавливают
// материал приёмке; недопустимая схема URL не попадает в Notion.
const explicit = api.questionInMarker({ text: 'Нужен источник', default: 'A', url: 'https://example.org/source' }).question;
assert.equal(api.questionProps(explicit)['Материал'].url, 'https://example.org/source');
const unsafe = api.questionInMarker({ text: 'Обычный вопрос', default: 'A', url: 'javascript:alert(1)' }).question;
assert.equal(api.questionProps(unsafe)['Материал'], undefined);
assert(bodyWrites.length > 0, 'полный текст ADR записан в тело страницы');

function gate() {
  let start, release;
  return {
    started: () => start(),
    startedPromise: new Promise((resolve) => { start = resolve; }),
    untilReleased: new Promise((resolve) => { release = resolve; }),
    release: () => release(),
  };
}

// Устаревший ответ чтения Notion не затирает строку, созданную во время запроса.
const addGate = gate();
pauseWaitQuery = addGate;
const oldRead = api.refreshQuestions({ force: true, quiet: true });
await addGate.startedPromise;
const concurrent = await api.askQuestion(api.parseQuestion({ text: 'Новая запись во время опроса?', default: 'да' }),
  { key: 'during-read', mission: 'TEST-1' });
addGate.release();
open = await oldRead;
assert(open.some((row) => row.id === concurrent.id), 'новая запись не исчезла из счётчика');
assert.equal(new Set(open.map((r) => r.id)).size, open.length, 'счётчик не дублирует id');

// И обратная гонка: ответ, пришедший во время чтения, не воскресает в счётчике
// и не ставится заново в очередь по устаревшей строке «Ждёт».
const closeGate = gate();
pauseWaitQuery = closeGate;
const staleRead = api.refreshQuestions({ force: true, quiet: true });
await closeGate.startedPromise;
messages = [{ raw: `CF_ANSWER_RESULT ${JSON.stringify({ question_id: concurrent.id, verdict: 'answer', answer: 'Да, записать.' })}` }];
await api.answerStep({ name: 'Warden' }, { kind: 'answer', ref: concurrent.id, watermark: 'w' });
closeGate.release();
open = await staleRead;
assert(!open.some((row) => row.id === concurrent.id), 'закрытая запись не воскресла');
assert(!api.answerQueue().some((row) => row.id === concurrent.id), 'закрытая запись не передана повторно');

// Истёкший снимок не может перезаписать решение, которое параллельно
// записывает приёмка: обе операции сериализованы и перечитывают статус.
const dueRow = await api.askQuestion(api.parseQuestion({ text: 'Просроченный обычный вопрос?', default: 'нет' }),
  { key: 'due-race', mission: 'TEST-1' });
const dueDb = db.find((row) => row.id === dueRow.id);
dueDb.properties['Срок'] = { date: { start: '2000-01-01T00:00:00.000Z' } };
const dueSnapshot = copy(dueDb);
const answerGate = gate();
pauseAnswerPatch = answerGate;
messages = [{ raw: `CF_ANSWER_RESULT ${JSON.stringify({ question_id: dueRow.id, verdict: 'answer', answer: 'Да, принять.' })}` }];
const answerInFlight = api.answerStep({ name: 'Warden' }, { kind: 'answer', ref: dueRow.id, watermark: 'w-due' });
await answerGate.startedPromise;
const expireInFlight = api.closeExpired([dueSnapshot]);
answerGate.release();
await answerInFlight;
assert.equal(await expireInFlight, 0, 'default не перезаписал решение');
assert.equal(sel(dueDb.properties['Статус']), 'Решено');
assert.equal(rt(dueDb.properties['Ответ']), 'Да, принять.');
assert(!patches.some((entry) => entry.id === dueRow.id && entry.props['Статус']?.select?.name === 'Принят дефолт'));

// Срок может быть продлён, или чтение Notion может отказать между списком и
// закрытием: в обоих случаях старый снимок не разрешает запись default.
const extended = await api.askQuestion(api.parseQuestion({ text: 'Вопрос с новым сроком?', default: 'ожидать' }),
  { key: 'extended', mission: 'TEST-1' });
const extendedDb = db.find((row) => row.id === extended.id);
const expiredSnapshot = copy(extendedDb);
expiredSnapshot.properties['Срок'] = { date: { start: '2000-01-01T00:00:00.000Z' } };
assert.equal(await api.closeExpired([expiredSnapshot]), 0, 'новый срок перечитан');
assert.equal(sel(extendedDb.properties['Статус']), 'Ждёт');
failGet = true;
assert.equal(await api.closeExpired([expiredSnapshot]), 0, 'сбой чтения не разрешает PATCH');
failGet = false;
assert.equal(sel(extendedDb.properties['Статус']), 'Ждёт');

// Если ссылка на ADR оказалась за пределами 180-символьного заголовка,
// Маркер всё равно находится по полю «Материал», даже когда сторож был первым.
await api.deliverProposals([{ file: 'LONG-1.md' }]);
const beforeLong = posts.length;
const longQuestion = api.parseQuestion({
  text: `${'Контекст '.repeat(30)} docs/decisions/LONG-1.md: какой выбор?`, default: 'оставить',
});
assert(!longQuestion.text.includes('LONG-1.md'), 'ссылка действительно за пределом заголовка');
assert.match(longQuestion.url, /LONG-1\.md$/);
const foundLong = await api.askQuestion(longQuestion, { key: 'long-after-watcher', mission: 'TEST-1' });
assert(foundLong?.id);
assert.equal(posts.length, beforeLong, 'поле материала участвует в проверке дубля');
const ambiguousMaterial = api.parseQuestion({
  text: 'Сравнить docs/decisions/A.md и docs/decisions/B.md?', default: 'не менять',
});
assert.equal(ambiguousMaterial.url, '', 'при нескольких путях ссылка не угадывается');

// Отказ списка не должен приводить к POST без проверки дубликата; задача
// сохраняется и успешно повторяется после восстановления Notion.
failQuery = true;
const beforeFailure = posts.length;
const deferred = api.parseQuestion({ text: 'Вопрос при временной недоступности?', default: 'ждать' });
assert.equal(await api.askQuestion(deferred, { key: 'offline', mission: 'TEST-1' }), null);
assert.equal(posts.length, beforeFailure);
assert.equal(get(K.qQueue, []).length, 1);
assert.equal(await api.flushQuestionQueue(), 0);
assert.equal(get(K.qQueue, []).length, 1);
failQuery = false;
assert.equal(await api.flushQuestionQueue(), 1);
assert.equal(posts.length, beforeFailure + 1);
assert.equal(get(K.qQueue, []).length, 0);

// Новая отложенная запись, добавленная во время сетевого повтора, не затирается
// старым снимком очереди.
api.queueQuestion(api.parseQuestion({ text: 'Повтор первый?', default: 'A' }), { key: 'retry-1' });
const retryGate = gate();
pauseDedupeQuery = retryGate;
const flushing = api.flushQuestionQueue();
await retryGate.startedPromise;
api.queueQuestion(api.parseQuestion({ text: 'Повтор второй?', default: 'B' }), { key: 'retry-2' });
retryGate.release();
assert.equal(await flushing, 1);
assert.deepEqual(get(K.qQueue, []).map((item) => item.q.text), ['Повтор второй?']);
assert.equal(await api.flushQuestionQueue(), 1);
assert.equal(get(K.qQueue, []).length, 0);

// Старый ADR со статусом «Решено» и пустым ответом не считается решением.
// Историческая строка не редактируется, даже если прежний ключ уже отмечен.
const oldEmpty = {
  id: 'old-empty', properties: {
    'Вопрос': { title: [{ text: { content: 'Предложение docs/decisions/HISTORY-1.md: принять?' } }] },
    'Статус': { select: { name: 'Решено' } }, 'Ответ': { rich_text: [] },
    'По умолчанию': { rich_text: richText('оставить как есть') },
    'Доставлено': { date: null },
  },
};
db.push(copy(oldEmpty));
set('cfn-asked:adr:HISTORY-1.md', 1);
const beforeOld = posts.length;
await api.deliverProposals([{ file: 'HISTORY-1.md' }]);
assert.equal(posts.length, beforeOld + 1, 'пустой ответ приводит к уточнению');
assert.deepEqual(db.find((r) => r.id === oldEmpty.id), oldEmpty, 'история не перезаписана');
const correction = db.at(-1);
assert.match(rt(correction.properties['Вопрос']), /^Уточнение/);
assert.equal(sel(correction.properties['Статус']), 'Ждёт');
assert(api.answerQueue().some((r) => r.id === correction.id));
await api.deliverProposals([{ file: 'HISTORY-1.md' }]);
assert.equal(posts.length, beforeOld + 1, 'повтор проверки не дублирует уточнение');
briefing = await api.questionBriefing(mission);
assert(!briefing.fresh.some((r) => r.id === oldEmpty.id), 'пустой ответ не выдаётся за решение');

// Отметка «уже спрашивали» не должна навсегда скрыть proposed ADR: если
// прежнюю строку отменили, сторож создаст новую, но не переставляет существующую.
await api.deliverProposals([{ file: 'CANCEL-1.md' }]);
const cancelled = db.at(-1);
const afterFirstCancel = posts.length;
const orderBeforeRetry = api.answerQueue().map((item) => item.id);
await api.deliverProposals([{ file: 'CANCEL-1.md' }]);
assert.equal(posts.length, afterFirstCancel, 'открытая запись не дублируется');
assert.deepEqual(api.answerQueue().map((item) => item.id), orderBeforeRetry, 'повтор не переставляет очередь');
cancelled.properties['Статус'] = { select: { name: 'Отменён' } };
await api.deliverProposals([{ file: 'CANCEL-1.md' }]);
assert.equal(posts.length, afterFirstCancel + 1, 'после отмены появился новый вопрос');
assert.equal(sel(cancelled.properties['Статус']), 'Отменён', 'историческая отмена не изменена');
assert.equal(sel(db.at(-1).properties['Статус']), 'Ждёт');
assert(api.answerQueue().some((item) => item.id === db.at(-1).id));

// В старой строке название не содержит имя ADR, но оно есть в поле URL.
// Даже при старом default повторно используем открытую строку, а не создаём
// параллельное уточнение с отличающимся текстом.
const legacyUrl = `https://github.com/${repo}/blob/main/docs/decisions/LINK-1.md`;
const legacyOpen = {
  id: 'legacy-link-open', properties: {
    'Вопрос': { title: [{ text: { content: 'Что делать с этим материалом?' } }] },
    'Статус': { select: { name: 'Ждёт' } }, 'Ответ': { rich_text: [] },
    'По умолчанию': { rich_text: richText('оставить как есть') }, 'Материал': { url: legacyUrl },
  },
};
db.push({ ...copy(legacyOpen), id: 'legacy-link-default',
  properties: { ...copy(legacyOpen.properties), 'Статус': { select: { name: 'Принят дефолт' } } } });
db.push(copy(legacyOpen));
const beforeLink = posts.length;
await api.deliverProposals([{ file: 'LINK-1.md' }]);
assert.equal(posts.length, beforeLink, 'путь только в URL также участвует в дедупликации');
assert(api.answerQueue().some((r) => r.id === legacyOpen.id), 'найденная старая строка передана приёмке');

// Сбой перечитывания или записи ответа не снимает ожидание и очередь; после
// восстановления обрабатывается прежний маркер, не перезаписывая ответ вслепую.
const recoverable = await api.askQuestion(api.parseQuestion({ text: 'Можно ли продолжать после сбоя?', default: 'ждать' }),
  { key: 'answer-retry', mission: 'TEST-1' });
messages = [{ raw: `CF_ANSWER_RESULT ${JSON.stringify({ question_id: recoverable.id, verdict: 'answer', answer: 'Продолжить после проверки.' })}` }];
const expect = { kind: 'answer', ref: recoverable.id, watermark: 'w-retry' };
const patchBeforeFailures = patches.length;
failGet = true;
await api.answerStep({ name: 'Warden' }, expect);
assert.deepEqual(get(K.expect, null), expect, 'ожидание восстановлено при GET 503');
assert.equal(patches.length, patchBeforeFailures, 'без чтения PATCH запрещён');
assert(api.answerQueue().some((r) => r.id === recoverable.id));
failGet = false;
failPatch = true;
await api.answerStep({ name: 'Warden' }, expect);
assert.deepEqual(get(K.expect, null), expect, 'ожидание восстановлено при PATCH 503');
assert.equal(sel(db.find((r) => r.id === recoverable.id).properties['Статус']), 'Ждёт');
failPatch = false;
await api.answerStep({ name: 'Warden' }, expect);
assert.equal(rt(db.find((r) => r.id === recoverable.id).properties['Ответ']), 'Продолжить после проверки.');
assert(!api.answerQueue().some((r) => r.id === recoverable.id));

// Новые строки, внесённые извне старой версией, дают только тихие уведомления
// общего канала, без отдельного ADR-пуша; повторный опрос молчит.
for (const [id, title] of [['external-question', 'Новый обычный вопрос?'],
  ['external-adr', 'Предложение docs/decisions/EXT-1.md: принять?']]) {
  db.push({ id, properties: {
    'Вопрос': { title: [{ text: { content: title } }] }, 'Статус': { select: { name: 'Ждёт' } },
    'Ответ': { rich_text: [] }, 'По умолчанию': { rich_text: richText('оставить') },
  } });
}
const oldSeen = db.filter((r) => !['external-question', 'external-adr'].includes(r.id)).map((r) => r.id);
set('cfn-q-seen', oldSeen);
const logAt = logs.length;
open = await api.refreshQuestions({ force: true, quiet: false });
assert(open.some((r) => r.id === 'external-question') && open.some((r) => r.id === 'external-adr'));
const notifications = logs.slice(logAt).filter((entry) => entry.options?.title === 'Narthex: обратная связь');
assert.equal(notifications.length, 2);
assert(notifications.every((entry) => entry.options.ntfy === 'quiet'));
const afterNotifications = logs.length;
await api.refreshQuestions({ force: true, quiet: false });
assert.equal(logs.slice(afterNotifications).filter((entry) => entry.options?.title === 'Narthex: обратная связь').length, 0);

// Изменилась только ссылка на ADR, а в заголовке слова ADR нет: срок всё равно
// не может выдать default за фактическое решение.
const special = {
  id: 'manual-adr', properties: {
    'Вопрос': { title: [{ text: { content: 'Нужен выбор?' } }] },
    'Статус': { select: { name: 'Ждёт' } },
    'По умолчанию': { rich_text: richText('оставить') },
    'Материал': { url: adrUrl },
  },
};
assert.equal(await api.closeExpired([special]), 0, 'ADR по URL остаётся открытым');
assert(!patches.some((entry) => entry.id === special.id));

// Общая очередь не обрезает одиннадцатый и последующие вопросы/предложения.
const answerCount = api.answerQueue().length;
for (let i = 0; i < 15; i++) {
  const question = api.parseQuestion({ text: `Дополнительная обратная связь ${i}?`, default: 'ждать' });
  api.queueAnswer({ id: `volume-${i}` }, question, {});
  api.queueQuestion(question, { key: `volume-${i}` });
}
assert.equal(api.answerQueue().length, answerCount + 15, 'не теряем элементы очереди приёмки');
assert.equal(get(K.qQueue, []).length, 15, 'не теряем отложенные записи');
set(K.qQueue, []);

// Более 200 открытых записей не превращаются в бесконечные повторы пушей.
set('cfn-q-seen', []);
const many = Array.from({ length: 205 }, (_, i) => ({ id: `seen-${i}`, text: `Запись ${i}`, fallback: 'ждать' }));
const beforeMany = logs.length;
assert.equal(api.notifyNewQuestions(many), 205);
assert.equal(logs.slice(beforeMany).filter((entry) => entry.options?.ntfy === 'quiet').length, 4,
  'массовая пачка ограничена тремя деталями и одной сводкой');
const afterMany = logs.length;
assert.equal(api.notifyNewQuestions(many), 0);
assert.equal(logs.length, afterMany, 'старая пачка не повторяется');
set('cfn-q-seen', [...Array.from({ length: 300 }, (_, i) => `closed-${i}`), ...many.map((r) => r.id)]);
api.pruneQuestionSeen(many);
assert.equal(get('cfn-q-seen', []).length, 405, 'все открытые и только 200 последних закрытых сохранены');
assert(many.every((row) => get('cfn-q-seen', []).includes(row.id)));
assert.equal(api.notifyNewQuestions(many), 0, 'сокращение истории не вызывает повторного пуша');

// Проверка реальной разметки и обработчика кнопки в поддельном DOM.
const chrome = cut('  /**\n   * Свёрнутая панель.', '  function mount() {');
const mount = cut('  function mount() {', '  async function toggleAuto() {');
const paint = cut('  function paintQuestions(rows) {', '  /**\n   * Отметить только что созданный вопрос:');
const elements = new Map(), opened = [], seen = { questions: 0, decisions: 0 };
const makeElement = (id = '') => ({
  id, textContent: '', title: '', style: {}, classList: { toggle() {} },
});
const document = {
  getElementById: (id) => elements.get(id) || null,
  body: { appendChild: (el) => elements.set(el.id, el) },
  createElement: () => {
    const element = makeElement();
    Object.defineProperty(element, 'innerHTML', {
      set(html) {
        this.html = html;
        for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], makeElement(match[1]));
      },
    });
    return element;
  },
};
const ui = {
  panel: 'cfn-panel', log: 'cfn-log', status: 'cfn-status', toggle: 'cfn-toggle', step: 'cfn-step',
  setup: 'cfn-setup', stop: 'cfn-stop', clear: 'cfn-clear', reset: 'cfn-reset', ntfy: 'cfn-ntfy',
  gh: 'cfn-gh', questions: 'cfn-questions', qBadge: 'cfn-q-badge', collapse: 'cfn-collapse',
  count: 'cfn-log-count', debug: 'cfn-debug-toggle',
};
const panelStore = new Map();
const panel = new Function(
  'ui', 'C', 'K', 'document', 'window', 'GM_getValue', 'GM_setValue', 'btnStyle', 'SCRIPT_VERSION',
  'renderLog', 'setStatus', 'paintDebugButton', 'openQuestions', 'watchQuestions', 'watchDecisions', 'maybeGhDialog',
  'qText', 'qFallback',
  `${chrome}\n${mount}\n${paint}\nreturn { mount, paintPanelChrome, paintQuestions, togglePanel };`,
)(
  ui, { maxLog: 200, questionsUrl: 'https://app.notion.com/p/e00d99c8b526461ea7e900b9e988e149' },
  { collapsed: 'collapsed' }, document, { open: (...args) => opened.push(args) },
  (key, fallback) => panelStore.has(key) ? panelStore.get(key) : fallback,
  (key, value) => panelStore.set(key, value), () => '', 'test', () => {}, () => {}, () => {},
  () => ({ rows: [{ id: 'q', text: 'Вопрос' }, { id: 'adr', text: `Предложение ${adrPath}` }] }),
  () => seen.questions++, () => seen.decisions++, () => {}, (row) => row.text, (row) => row.fallback || '',
);
panel.mount();
assert.equal(seen.questions, 1);
assert.equal(seen.decisions, 1, 'сторож ADR сохраняется');
assert.match(elements.get('cfn-panel').html, /💬 Обратная связь/);
assert(!elements.has('cfn-adr') && !elements.has('cfn-adr-badge'), 'вторая кнопка отсутствует');
assert.equal(elements.get('cfn-q-badge').textContent, '2');
assert.match(elements.get('cfn-questions').title, /Открытых записей обратной связи: 2/);
elements.get('cfn-questions').onclick();
assert.equal(opened[0][0], 'https://app.notion.com/p/e00d99c8b526461ea7e900b9e988e149');
panel.togglePanel();
assert.match(elements.get('cfn-collapse').textContent, /💬2/);
assert.doesNotMatch(elements.get('cfn-collapse').textContent, /⚖/);
console.log('OK: единая Notion-очередь, дедупликация, приёмка, повторы и счётчик без гонок');
