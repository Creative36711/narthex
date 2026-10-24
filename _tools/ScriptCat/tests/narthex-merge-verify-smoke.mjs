// Проба 1.4.48: «слит» в маркере — заявка, а не факт.
//
// 24.10 на странице Build/Release висела активная «Create PR»: Arena не знает
// о PR, который агент слил через `gh`, и по экрану отличить сделанную работу от
// выдуманной было нечем. Транспорт верил маркеру на слово — и записал бы
// карточку в Submitted с ссылкой на несуществующий PR.
//
// Здесь проверяется:
//   • номер PR берётся и числом, и ссылкой, и с чужим репозиторием;
//   • состояние спрашивается у GitHub и различает merged / open / closed / нет PR;
//   • сеть и лимит не ломают ход: это «проверить не удалось», а не «не слито»;
//   • ложная заявка не принимается и возвращает карточку в Rework;
//   • в журнале сказано, подтвердил GitHub мерж или нет.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// ── 1. Версия и разрешение хоста ───────────────────────────────────────────
assert.match(src, /@version\s+1\.4\.48/, 'версия 1.4.48');
assert.match(src, /\/\/ @connect\s+api\.github\.com/, 'api.github.com разрешён в @connect');

// ── 2. Номер и репозиторий PR ──────────────────────────────────────────────
const refFrom = src.indexOf('  function prRef(result) {');
// До конца githubPr: он нужен проверке и живёт между prRef и verifyMergeClaim.
const refTo = src.indexOf('  /**\n   * Проверка «PR слит» из маркера.');
assert.ok(refFrom > 0 && refTo > refFrom, 'prRef на месте');
const { prRef } = new Function(
  'C',
  `${src.slice(refFrom, refTo)}\nreturn { prRef };`,
)({ repo: 'Creative36711/narthex' });

assert.deepEqual(prRef({ pr: 37 }), { repo: 'Creative36711/narthex', number: 37 }, 'число');
assert.deepEqual(prRef({ pr: '#37' }), { repo: 'Creative36711/narthex', number: 37 }, 'решётка');
assert.deepEqual(
  prRef({ pr: 'https://github.com/Creative36711/narthex/pull/37' }),
  { repo: 'Creative36711/narthex', number: 37 },
  'ссылка',
);
assert.deepEqual(
  prRef({ pr: 'https://github.com/other/repo/pull/5' }),
  { repo: 'other/repo', number: 5 },
  'чужой репозиторий берётся из ссылки',
);
assert.equal(prRef({ pr: null }), null, 'без PR — нечего проверять');
assert.equal(prRef({ pr: 'none' }), null, '«none» — тоже');
assert.equal(prRef(null), null, 'без ответа — тоже');

// ── 3. Состояние PR по GitHub ──────────────────────────────────────────────
const verifyFrom = src.indexOf('  async function verifyMergeClaim(result) {');
const verifyTo = src.indexOf('  /** Последняя проверка заявки');
assert.ok(verifyFrom > 0 && verifyTo > verifyFrom, 'verifyMergeClaim на месте');

function makeVerify(answer) {
  const block = `${src.slice(refFrom, refTo)}\n${src.slice(verifyFrom, verifyTo)}\nreturn { verifyMergeClaim };`;
  const fn = new Function('C', 'request', block);
  return fn({ repo: 'Creative36711/narthex' }, async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const merged = await makeVerify({ merged: true, merged_at: '2026-10-24T16:16:10Z', state: 'closed' })
  .verifyMergeClaim({ pr: 37 });
assert.equal(merged.status, 'merged', 'слитый PR подтверждается');
assert.match(merged.why, /PR #37 слит/, 'в причине номер и факт');

const open = await makeVerify({ merged: false, state: 'open' }).verifyMergeClaim({ pr: 37 });
assert.equal(open.status, 'open', 'открытый PR — не мерж');

const closed = await makeVerify({ merged: false, state: 'closed' }).verifyMergeClaim({ pr: 37 });
assert.equal(closed.status, 'closed', 'закрытый без мержа — тоже не мерж');

const missing = await makeVerify(new Error('HTTP 404: Not Found')).verifyMergeClaim({ pr: 37 });
assert.equal(missing.status, 'missing', 'несуществующий PR отличается от сетевого сбоя');

const offline = await makeVerify(new Error('таймаут запроса')).verifyMergeClaim({ pr: 37 });
assert.equal(offline.status, 'unknown', 'сеть — «проверить не удалось»');

const noPr = await makeVerify({ merged: true }).verifyMergeClaim({ pr: null });
assert.equal(noPr.status, 'unknown', 'без номера проверять нечего');

// ── 4. claimMerge: сначала проверка, потом вера ────────────────────────────
const claimFrom = src.indexOf('  async function claimMerge(task, result, key, note = "") {');
const claimTo = src.indexOf('  /**\n   * PR закрыт.', claimFrom);
assert.ok(claimFrom > 0 && claimTo > claimFrom, 'claimMerge на месте');
const claimBlock = src.slice(claimFrom, claimTo);
assert.ok(
  claimBlock.indexOf('await verifyMergeClaim(result)') < claimBlock.indexOf('GM_setValue(key, true)'),
  'проверка идёт раньше, чем заявка принимается',
);

async function runClaim(check) {
  const store = new Map();
  const logged = [];
  const fn = new Function(
    'C', 'GM_getValue', 'GM_setValue', 'log', 'waitFor', 'mergedFlag', 'continueButton',
    'finishMerge', 'patience', 'prLabelOf', 'verifyMergeClaim', 'sleep',
    `${claimBlock}\nreturn { claimMerge };`,
  );
  const api = fn(
    { mergeGraceMs: 90000 },
    (k, d) => (store.has(k) ? store.get(k) : d),
    (k, v) => store.set(k, v),
    (text, error, options) => logged.push({ text, error, options }),
    async () => null, // бейджа Merged и Continue на странице нет
    () => null,
    () => null,
    async () => 'merged',
    (ms) => Math.min(ms, 0),
    (r) => `PR #${r.pr}`,
    async () => check,
    async () => {},
  );
  const result = await api.claimMerge({ id: 'card-1' }, { pr: 37 }, 'cfn-merged:card-1');
  return { result, store, logged };
}

{
  const { result, store, logged } = await runClaim({ status: 'merged', why: 'PR #37 слит 2026-10-24T16:16:10Z' });
  assert.equal(result, 'claimed', 'подтверждённый мерж принимается без бейджа');
  assert.equal(store.get('cfn-merged:card-1'), true, 'карточка помечена слитой');
  assert.ok(logged.some((l) => /GitHub подтвердил/.test(l.text)), 'в журнале сказано, кто подтвердил');
}
{
  const { result, store, logged } = await runClaim({ status: 'open', why: 'PR #37 ещё открыт' });
  assert.equal(result, 'claim-rejected', 'ложная заявка не принимается');
  assert.equal(store.get('cfn-merged:card-1'), undefined, 'карточка не помечена слитой');
  assert.ok(logged.some((l) => l.error && /не подтвердилась/.test(l.text)), 'ошибка названа в журнале');
}
{
  const { result, logged } = await runClaim({ status: 'unknown', why: 'GitHub не ответил: таймаут запроса' });
  assert.equal(result, 'claimed', 'без проверки остаётся прежнее правило');
  assert.ok(
    logged.some((l) => /проверить по GitHub не удалось/.test(l.text)),
    'и об этом сказано прямо, а не молча',
  );
}

// ── 5. Ложная заявка возвращает карточку в Rework ──────────────────────────
const submitFrom = src.indexOf('  async function submitExecutor(role, expect, manual = false) {');
const submitBlock = src.slice(submitFrom, src.indexOf('  // ───────────────────────────── цикл ─────────────────────────────', submitFrom));
assert.match(submitBlock, /if \(merged === "claim-rejected"\) \{/, 'ветка ложной заявки на месте');
const rejectedAt = submitBlock.indexOf('if (merged === "claim-rejected") {');
const rework = submitBlock.slice(rejectedAt, rejectedAt + 1600);
assert.match(rework, /"Dispatch State": \{ select: \{ name: "Rework" \} \}/, 'карточка уходит в Rework');
assert.match(rework, /claim-rejected -->/, 'причина пишется в журнал попытки отдельным маркером');
assert.match(rework, /нужна повторная выдача/, 'в причине сказано, что делать');
assert.ok(
  rejectedAt < submitBlock.indexOf('if ((merged === "closed" || merged === "unconfirmed")'),
  'проверяется раньше прежней ветки «PR закрыт»',
);

console.log('OK: narthex 1.4.48 — заявка о мерже проверяется по GitHub, ложная возвращает карточку в Rework');
