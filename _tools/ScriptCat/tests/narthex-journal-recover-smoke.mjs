// Проба 1.4.63: ответ пишется в журнал выдачи, даже если поле в карточке
// переписано на чужой файл.
//
// История (NAR-2.13, 25.10.2026, 15:59Z). Runtime Auditor создал папку
// Arena/reports, положил туда отчёт и вписал его id в поле карточки
// «Output Drive File ID» — туда, где лежит ссылка на журнал попытки. Шлюз
// отказал по делу: «Запись разрешена только в текстовые файлы Arena/logs».
// Скрипт назвал это «Шлюз Drive не ответил» и встал на паузу: Мастер пошёл
// проверять развёртывание Apps Script, хотя шлюз был жив и прав.
//
// Что проверяется здесь:
//   1) обычная запись не трогает карточку;
//   2) отказ «не та папка» → журнал этой выдачи (createLog идемпотентен) →
//      запись в него → ссылка возвращается в карточку;
//   3) отказ по другой причине (ключ) не лечится журналом;
//   4) если журнал не открылся, наружу идёт исходный отказ, а не ошибка createLog;
//   5) submitExecutor пишет ответ только через appendToJournal;
//   6) агенту прямо сказано: поля карточки ставит скрипт.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
const V = '1.4.72';
assert.match(src, new RegExp(`@version\\s+${V.replace(/\./g, '\\.')}`), `версия ${V}`);

const from = src.indexOf('  async function appendToJournal(');
const to = src.indexOf('  async function submitExecutor(');
assert.ok(from > 0 && to > from, 'appendToJournal на месте');

const load = ({ append, createLog }) => {
  const calls = { append: [], createLog: 0, patch: [], log: [] };
  const api = new Function(
    'gateway', 'patch', 'log',
    `${src.slice(from, to)}\nreturn appendToJournal;`,
  )(
    async (action, fileId, extra) => {
      if (action === 'createLog') {
        calls.createLog += 1;
        return createLog();
      }
      calls.append.push(fileId);
      return append(fileId, extra);
    },
    async (id, props) => { calls.patch.push({ id, props }); },
    (text) => { calls.log.push(String(text)); },
  );
  return { api, calls };
};

const refusal = (reason) => {
  const e = new Error(`шлюз Drive отказал: ${reason}`);
  e.narthex = 'gateway';
  e.refused = true;
  e.reason = reason;
  return e;
};
const FOLDER = 'Запись разрешена только в текстовые файлы Arena/logs.';

// 1. Обычный путь: поле в карточке верное, лишних движений нет.
{
  const { api, calls } = load({
    append: async () => ({ ok: true, result: 'appended' }),
    createLog: () => { throw new Error('createLog не должен вызываться'); },
  });
  const out = await api('d-1', 'r-1', 'log-1', '<!-- CF_DISPATCH d-1:r-1 -->', '\n\n…\n');
  assert.equal(out.logId, 'log-1', 'журнал тот же');
  assert.equal(out.wrote.result, 'appended', 'запись сделана');
  assert.equal(calls.createLog, 0, 'журнал не переоткрывали');
  assert.equal(calls.patch.length, 0, 'карточку не трогали');
}

// 2. Поле переписано на отчёт: журнал берётся из выдачи, ссылка возвращается.
{
  const { api, calls } = load({
    append: async (fileId) => {
      if (fileId === 'report-1') throw refusal(FOLDER);
      return { ok: true, result: 'appended' };
    },
    createLog: () => ({ ok: true, fileId: 'log-1', name: 'd-1_r-1.md', result: { fileId: 'log-1' } }),
  });
  const out = await api('d-1', 'r-1', 'report-1', '<!-- CF_DISPATCH d-1:r-1 -->', '\n\n…\n');
  assert.equal(out.logId, 'log-1', 'пишем в журнал выдачи');
  assert.deepEqual(calls.append, ['report-1', 'log-1'], 'сначала попытка в поле, потом журнал');
  assert.equal(calls.createLog, 1, 'журнал запрошен один раз');
  const patched = calls.patch[0];
  assert.equal(patched.id, 'd-1', 'правится своя карточка');
  assert.equal(
    patched.props['Output Drive File ID'].rich_text[0].text.content,
    'log-1',
    'ссылка на журнал вернулась в карточку',
  );
  assert.ok(calls.log.some((t) => /указывает не на журнал/.test(t)), 'в журнале скрипта сказано словами');
}

// 3. Отказ по другой причине — не повод искать журнал.
{
  const { api, calls } = load({
    append: async () => { throw refusal('Неверный ключ шлюза.'); },
    createLog: () => { throw new Error('createLog не должен вызываться'); },
  });
  await assert.rejects(
    () => api('d-1', 'r-1', 'log-1', 'm', 'e'),
    /Неверный ключ шлюза/,
    'чужой отказ уходит наверх как есть',
  );
  assert.equal(calls.createLog, 0, 'журнал не запрашивался');
  assert.equal(calls.patch.length, 0, 'карточка не тронута');
}

// 4. Журнал не открылся: наружу — исходный отказ, а не ошибка шлюза на createLog.
{
  const { api } = load({
    append: async () => { throw refusal(FOLDER); },
    createLog: () => { throw new Error('Apps Script недоступен'); },
  });
  await assert.rejects(
    () => api('d-1', 'r-1', 'report-1', 'm', 'e'),
    (e) => {
      assert.equal(e.refused, true, 'остался отказ шлюза');
      assert.match(e.reason, /Arena\/logs/, 'с причиной про папку');
      return true;
    },
  );
}

// 5. submitExecutor: ответ идёт через appendToJournal, а не в id из карточки.
{
  const submit = src.slice(src.indexOf('async function submitExecutor'), src.indexOf('async function releaseStalled'));
  assert.match(submit, /const declaredLog = rt\(page\.properties\["Output Drive File ID"\]\)/, 'поле читается');
  assert.match(submit, /await appendToJournal\(/, 'пишем через журнал выдачи');
  assert.doesNotMatch(submit, /gateway\("append",\s*declaredLog/, 'в поле напрямую не пишем');
}

// 6. Правило для агентов: поля карточки ставит скрипт.
{
  const rule = src.slice(src.indexOf('const CARD_FIELDS_RULE'), src.indexOf('const EXECUTOR_TECH'));
  assert.match(rule, /Output Drive File ID/, 'поле названо');
  assert.match(rule, /report/, 'сказано, куда девать отчёт');
  const executor = src.slice(src.indexOf('const EXECUTOR_TECH'), src.indexOf('const AUDITOR_TECH'));
  const auditor = src.slice(src.indexOf('const AUDITOR_TECH'), src.indexOf('const COORDINATOR_TECH'));
  assert.match(executor, /CARD_FIELDS_RULE/, 'исполнителю сказано');
  assert.match(auditor, /CARD_FIELDS_RULE/, 'аудитору сказано');
}

console.log(`OK: narthex ${V} — ответ пишется в журнал выдачи, даже если поле карточки увели в отчёт`);
