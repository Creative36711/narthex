// Проба очистки состояния: почему после обновления всплывало «прошлое задание».
//
// Хранилище ScriptCat общее для всех версий. Ожидание, записанное прошлой
// версией без отметки отправки, доживало до нового запуска, и шаг ссылался
// на отправку, которой не было. Здесь проверяется:
//   • после обновления снимается только ожидание без отправки;
//   • настоящая отправка и очередь с текстом остаются;
//   • кнопка ↺ очищает очередь, ожидание и защиту от повторов по воле Мастера;
//   • пустое состояние не порождает записей в журнале.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

const from = src.indexOf('  // ───────────────────── следы прошлых попыток (очистка) ─────────────────────');
const to = src.indexOf('  // ───────────────────────────── PR ─────────────────────────────');
assert.ok(from > 0 && to > from, 'блок очистки состояния на месте');
const block = src.slice(from, to);

function make(seed = {}) {
  const store = new Map(Object.entries(seed));
  const logs = [];
  const fn = new Function(
    'GM_getValue', 'GM_setValue', 'K', 'SCRIPT_VERSION', 'log', 'confirm', 'setStatus',
    `${block}
     return { transientState, describeTransient, resetState, migrateState, resetStateDialog };`,
  );
  const api = fn(
    (k, d) => (store.has(k) ? store.get(k) : d),
    (k, v) => store.set(k, v),
    { pending: 'cfn-pending', expect: 'cfn-expect', lastSend: 'cfn-last-send', step: 'cfn-step-request', stateV: 'cfn-state-v' },
    '1.4.57',
    (t, e, o) => logs.push({ t, e, o }),
    () => true,
    () => {},
  );
  return { api, store, logs };
}

const ghost = { roleId: 'coord', roleName: 'Coordinator', kind: 'plan', text: 'ЗАДАНИЕ', watermark: 'm1', at: 1 };
const real = { ...ghost, sentAt: 2, verified: true };

// ── 1. Обновление снимает ожидание без отметки отправки ─────────────────────
{
  const { api, store, logs } = make({
    'cfn-state-v': '1.4.8',
    'cfn-expect': ghost,
    'cfn-pending': { roleId: 'coord', text: 'ЗАДАНИЕ', at: Date.now() },
    'cfn-last-send': { roleId: 'coord', hash: '1', at: Date.now() },
  });
  const dropped = api.migrateState();
  assert.equal(dropped, '«Coordinator», plan', 'вернулось описание снятого ожидания');
  assert.equal(store.get('cfn-expect'), null, 'ожидание без отправки снято');
  assert.ok(store.get('cfn-pending'), 'очередь с текстом сохранена');
  assert.ok(store.get('cfn-last-send'), 'защита от повторов сохранена');
  assert.equal(store.get('cfn-state-v'), '1.4.57', 'метка версии обновлена');
  assert.equal(logs.length, 1, 'ровно одна запись в журнале');
  assert.match(logs[0].t, /Обновился до 1\.4\.57 с 1\.4\.8/, 'видно, с какой версии обновились');
  assert.match(logs[0].t, /без отметки отправки/, 'сказано, что именно снято');
  assert.equal(logs[0].o?.skip, true, 'обновление не шлёт пуш');
}

// ── 2. Настоящая отправка и очередь не трогаются ────────────────────────────
{
  const { api, store, logs } = make({ 'cfn-state-v': '1.4.8', 'cfn-expect': real });
  assert.equal(api.migrateState(), '', 'подтверждённая отправка не снимается');
  assert.deepEqual(store.get('cfn-expect'), real, 'ожидание осталось');
  assert.equal(logs.length, 0, 'лишних записей нет');
  assert.equal(store.get('cfn-state-v'), '1.4.57', 'метка всё равно поставлена');
}

// ── 3. Пустое состояние и повторный запуск ──────────────────────────────────
{
  const { api, logs } = make({ 'cfn-state-v': '1.4.8' });
  assert.equal(api.migrateState(), '', 'нечего снимать');
  assert.equal(logs.length, 0, 'журнал не засоряется');
}
{
  const { api, store } = make({ 'cfn-state-v': '1.4.57', 'cfn-expect': ghost });
  assert.equal(api.migrateState(), '', 'в рамках одной версии миграция не работает');
  assert.deepEqual(store.get('cfn-expect'), ghost, 'такое ожидание снимает шаг, а не миграция');
}

// ── 4. Кнопка ↺: полная очистка по воле Мастера ─────────────────────────────
{
  const { api, store } = make({
    'cfn-expect': real,
    'cfn-pending': { roleId: 'coord', text: 'ЗАДАНИЕ', at: Date.now() },
    'cfn-last-send': { roleId: 'coord', hash: '1', at: Date.now() },
    'cfn-plan-at': 123,
    'cfn-step-request': true,
  });
  const cleared = api.resetState();
  assert.match(cleared.text, /очередь: «coord»/, 'описана снятая очередь');
  assert.match(cleared.text, /ожидание: «Coordinator»/, 'описано снятое ожидание');
  assert.match(cleared.text, /защита от повторов/, 'описана снятая защита');
  for (const key of ['cfn-expect', 'cfn-pending', 'cfn-last-send']) {
    assert.equal(store.get(key), null, `${key} очищен`);
  }
  assert.equal(store.get('cfn-plan-at'), 0, 'троттлинг плана сброшен');
  assert.equal(store.get('cfn-step-request'), false, 'отложенный шаг снят');
  assert.equal(store.get('cfn-state-v'), '1.4.57', 'метка версии на месте');
}

// ── 5. Диалог: отказ ничего не чистит ───────────────────────────────────────
{
  const { api, store } = make({ 'cfn-pending': { roleId: 'coord', text: 'ЗАДАНИЕ', at: 1 } });
  const fn = new Function(
    'GM_getValue', 'GM_setValue', 'K', 'SCRIPT_VERSION', 'log', 'confirm', 'setStatus',
    `${block}; return { resetStateDialog };`,
  );
  const logs = [];
  const withNo = fn(
    (k, d) => (store.has(k) ? store.get(k) : d),
    (k, v) => store.set(k, v),
    { pending: 'cfn-pending', expect: 'cfn-expect', lastSend: 'cfn-last-send', step: 'cfn-step-request', stateV: 'cfn-state-v' },
    '1.4.57', (t) => logs.push(t), () => false, () => {},
  );
  withNo.resetStateDialog();
  assert.ok(store.get('cfn-pending'), 'при отказе очередь осталась');
  assert.equal(logs.length, 0, 'при отказе журнал молчит');
  void api;
}

// ── 6. Кнопка есть в панели, у 🧹 подсказка про ↺ ───────────────────────────
assert.match(src, /reset: "cfn-reset"/, 'id кнопки объявлен');
assert.match(src, /id="\$\{ui\.reset\}" title="Сбросить очередь и ожидание прошлых попыток/, 'кнопка ↺ в панели');
assert.match(src, /getElementById\(ui\.reset\)\.onclick = \(\) => resetStateDialog\(\)/, 'кнопка вызывает очистку');
assert.match(src, /Очистить журнал; очередь снимается кнопкой ↺/, 'у 🧹 понятная подсказка');
assert.match(src, /reset: \(\) => resetStateDialog\(\)/, 'в консоли есть __narthex.reset()');
assert.match(src, /const boot = \(\) => \{\s*migrateState\(\);/, 'миграция выполняется до первого шага');
assert.match(src, /title="версия скрипта">v\$\{SCRIPT_VERSION\}/, 'в панели видно, какая версия загружена');

console.log('OK: narthex 1.4.57 — обновление снимает ожидание без отправки, ↺ чистит очередь и ожидание, журнал не засоряется');
