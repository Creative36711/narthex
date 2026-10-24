// Проба 1.4.49: карточку, которую проверка ошибочно отправила в Rework, можно
// вернуть в Submitted — без второй выдачи и без повторной работы агента.
//
// 24.10 NAR-1.13 ушла в Rework при слитом PR #37: анонимный запрос к GitHub
// получил 404 от приватного репозитория и был прочитан как «PR нет». Работа
// лежала в main, а Координатор уже готовил повторную выдачу.
//
// Здесь проверяется:
//   • мерж подтверждён — карточка возвращается в Submitted, с PR и «Submitted At»;
//   • в «Ответ» записано, что это восстановление после ложного отказа;
//   • отметка «эта выдача обработана» ставится, чтобы карточка не поехала дальше;
//   • уже Submitted/Accepted не трогаются, Ready не трогается (решает Мастер);
//   • если GitHub мерж не подтверждает — ни одной записи в Notion.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// ── 1. Функция на месте ────────────────────────────────────────────────────
const from = src.indexOf('  async function recoverLastClaim() {');
const to = src.indexOf('  async function adoptPageAnswer() {');
assert.ok(from > 0 && to > from, 'recoverLastClaim на месте');
const block = src.slice(from, to);

// ── 2. Прогон с подставными Notion и GitHub ────────────────────────────────
async function run({ last, check, state = 'Rework' } = {}) {
  const store = new Map();
  if (last) store.set('cfn-last-result', last);
  const patched = [];
  const logged = [];
  const fn = new Function(
    'K', 'GM_getValue', 'GM_setValue', 'verifyMergeClaim', 'ghToken', 'notion',
    'taskState', 'prUrl', 'nowIso', 'patch', 'log',
    `${block}; return recoverLastClaim;`,
  );
  const recover = fn(
    { lastResult: 'cfn-last-result' },
    (k, d) => (store.has(k) ? store.get(k) : d),
    (k, v) => store.set(k, v),
    async () => check,
    () => 'ghp_secret',
    async () => ({ properties: {} }),
    () => state,
    (pr) => (String(pr || '').startsWith('http') ? String(pr) : String(pr || '') ? `https://github.com/Creative36711/narthex/pull/${String(pr).replace(/^#/, '')}` : ''),
    () => '2026-10-24T19:50:00.000Z',
    async (id, props) => patched.push({ id, props }),
    (text, error, options) => logged.push({ text, error, options }),
  );
  const result = await recover();
  return { result, patched, store, logged };
}

const last = {
  dispatch_id: '4016f0cf-5705-810e-83c2-ca18d8e9b66b',
  run_id: 'run-13',
  pr: 37,
  merged: true,
  task: 'NAR-1.13',
  logId: 'log-1',
  verdict: 'claim-rejected',
  result: { pr: 37, merged: true },
};

const mergedCheck = {
  status: 'merged',
  why: 'PR #37 слит 2026-10-24T16:16:10Z',
  pr: { html_url: 'https://github.com/Creative36711/narthex/pull/37' },
};

// ── 3. Ложный отказ исправляется ───────────────────────────────────────────
{
  const { result, patched, store, logged } = await run({ last, check: mergedCheck });
  assert.equal(result.ok, true, 'восстановление удалось');
  assert.equal(patched.length, 1, 'запись в карточку ровно одна');
  assert.equal(patched[0].id, last.dispatch_id, 'правится та самая карточка');
  assert.equal(patched[0].props['Dispatch State'].select.name, 'Submitted', 'состояние снова Submitted');
  assert.match(patched[0].props['Ответ'].rich_text[0].text.content, /ложного отказа/i, 'причина названа');
  assert.equal(patched[0].props['PR'].url, 'https://github.com/Creative36711/narthex/pull/37', 'PR в карточке');
  assert.ok(patched[0].props['Submitted At'].date.start, 'Submitted At выставлен');
  assert.equal(store.get('cfn-done:4016f0cf-5705-810e-83c2-ca18d8e9b66b:run-13'), true, 'выдача помечена обработанной');
  assert.equal(store.get('cfn-last-result').verdict, 'Submitted', 'память обновлена');
  assert.ok(logged.some((l) => l.options && l.options.tone === 'ok'), 'в журнале зелёная строка');
}

// ── 4. Уже Submitted — нечего исправлять ───────────────────────────────────
{
  const { result, patched } = await run({ last, check: mergedCheck, state: 'Submitted' });
  assert.equal(result.ok, true, 'это не ошибка');
  assert.equal(patched.length, 0, 'лишней записи нет');
  assert.match(result.text, /уже Submitted/, 'сказано, что всё на месте');
}

// ── 5. Ready не трогаем: карточку могли выдать заново ──────────────────────
{
  const { result, patched } = await run({ last, check: mergedCheck, state: 'Ready' });
  assert.equal(result.ok, false, 'решение оставлено Мастеру');
  assert.equal(patched.length, 0, 'Ready не перезаписана');
  assert.match(result.text, /Мастер/, 'сказано, к кому идти');
}

// ── 6. GitHub мерж не подтверждает — ничего не пишем ───────────────────────
{
  const { result, patched } = await run({ last, check: { status: 'open', why: 'PR #37 ещё открыт' } });
  assert.equal(result.ok, false, 'без подтверждения не восстанавливаем');
  assert.equal(patched.length, 0, 'Notion не тронут');
  assert.match(result.text, /не подтверждает/, 'причина названа');
}

// ── 7. Нет запомненной выдачи ──────────────────────────────────────────────
{
  const { result, patched } = await run({ last: null, check: mergedCheck });
  assert.equal(result.ok, false, 'возвращать нечего');
  assert.equal(patched.length, 0, 'Notion не тронут');
}

// ── 8. Ответ, который скрипт не прочитал, можно взять со страницы ──────────
// Исполнять adoptPageAnswer без DOM нельзя (jsdom в пробах не используется),
// поэтому проверяются границы: маркер, состояние карточки, адресат и отметка.
const adoptFrom = src.indexOf('  async function adoptPageAnswer() {');
const adoptTo = src.indexOf('  /** Последняя проверка заявки');
assert.ok(adoptFrom > 0 && adoptTo > adoptFrom, 'adoptPageAnswer на месте');
const adopt = src.slice(adoptFrom, adoptTo);
assert.match(adopt, /CF_AGENT_RESULT/, 'берётся только сообщение с маркером выдачи');
assert.match(adopt, /state !== "Running"/, 'читается только карточка в Running');
assert.match(adopt, /cfn-done:\$\{ref\}:\$\{run\}/, 'обработанная выдача не читается второй раз');
assert.match(adopt, /Recipient Agent ID/, 'чужой ответ не берётся');
assert.match(adopt, /role\.fn === "Coordinator"/, 'ход Координатора этой кнопкой не читается');
assert.match(adopt, /GM_setValue\(K\.expect, expect\)/, 'ожидание восстанавливается');
assert.match(adopt, /await submitExecutor\(role, expect, true\)/, 'дальше — обычный путь, а не своя запись');
assert.match(adopt, /adopted: true/, 'видно, что выдача восстановлена, а не отправлена заново');

console.log('OK: narthex 1.4.49 — ложный отказ исправляется возвратом карточки в Submitted');
