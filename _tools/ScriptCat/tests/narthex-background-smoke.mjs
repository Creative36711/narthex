// Проба фоновой вкладки: что будет, если Мастер уйдёт на другую вкладку.
//
// Вопрос Мастера (49): «всё ли будет корректно работать, если я буду на
// другой вкладке браузера?» Скрипту фокус не нужен — он ищет элементы и
// кликает из кода, — но браузер режет таймеры в скрытой вкладке: сначала до
// секунды, а через пять минут до одного пробуждения в минуту. Короткие
// ожидания (Continue за 20 с, карточка PR за 8 с) успевали бы истечь раньше
// первой проверки.
//
// Здесь проверяется 1.4.19: в фоне ожидания растягиваются, в журнале есть
// объяснение, а возврат во вкладку будит цикл сразу.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// ── 1. Помощники ведут себя по-разному в фоне и на экране ──────────────────
const from = src.indexOf('  const tabHidden = () => {');
const to = src.indexOf('  /** Ждём, пока условие станет истинным.');
assert.ok(from > 0 && to > from, 'помощники фоновой вкладки на месте');

const withState = (state) =>
  new Function(
    'document',
    `${src.slice(from, to)}; return { tabHidden, patience };`,
  )({ visibilityState: state });

const hidden = withState('hidden');
const visible = withState('visible');

assert.equal(hidden.tabHidden(), true, 'скрытая вкладка распознана');
assert.equal(visible.tabHidden(), false, 'видимая вкладка — обычный режим');

assert.equal(visible.patience(8_000), 8_000, 'на экране ожидание не растягивается');
assert.equal(visible.patience(20_000), 20_000, 'на экране Continue ждут как раньше');
assert.equal(hidden.patience(8_000), 60_000, 'в фоне — минимум минута');
assert.equal(hidden.patience(20_000), 60_000, 'в фоне Continue ждут минуту, а не 20 секунд');
assert.equal(hidden.patience(90_000), 270_000, 'долгие ожидания растягиваются втрое');

// ── 2. Короткие ожидания действительно используют помощник ─────────────────
const mergeFrom = src.indexOf('  async function ensureMerged(');
const mergeTo = src.indexOf('  async function finishMerge(');
assert.ok(mergeFrom > 0 && mergeTo > mergeFrom, 'ensureMerged на месте');
assert.match(
  src.slice(mergeFrom, mergeTo),
  /waitFor\(hasPrUi, patience\(C\.prCardWaitMs\)/,
  'карточка PR в фоне ждётся дольше',
);

const finishFrom = src.indexOf('  async function finishMerge(');
const finishTo = src.indexOf('  async function finishClosed(');
const finishClosedTo = src.indexOf('  // ─────────────────────────────', finishTo);
assert.match(
  src.slice(finishFrom, finishTo),
  /waitFor\(continueButton, patience\(C\.continueWaitMs\)/,
  'Continue после Merged в фоне ждётся дольше',
);
assert.match(
  src.slice(finishTo, finishClosedTo),
  /waitFor\(continueButton, patience\(Math\.min\(C\.continueWaitMs, 10000\)\)/,
  'Continue после Closed — тоже через помощник',
);

// ── 3. В журнале сказано, почему стало медленнее, но не чаще раза в час ───
assert.match(
  src,
  /logThrottled\(\s*"bg-tab",\s*"Вкладка в фоне: браузер режет таймеры, шаг может идти медленнее — это нормально\.",\s*false,\s*3_600_000,?\s*\)/,
  'фоновый режим объяснён в журнале и не спамит',
);

// ── 4. Возврат во вкладку будит цикл сразу ─────────────────────────────────
assert.match(
  src,
  /addEventListener\("visibilitychange", \(\) => \{\s*if \(document\.visibilityState === "visible"\) tick\(false\);/,
  'возврат во вкладку — сразу тик, а не ожидание минуты',
);

// ── 5. Ничего не зависит от фокуса окна: клики и ввод — из кода ────────────
assert.doesNotMatch(src, /document\.hasFocus\(\)/, 'фокус окна не проверяется');
assert.doesNotMatch(src, /requestAnimationFrame/, 'кадровый цикл не используется — он в фоне стоит');
assert.doesNotMatch(src, /navigator\.clipboard/, 'буфер обмена не используется — он требует фокуса');

console.log('OK: narthex 1.4.19 — в фоновой вкладке ожидания растянуты, журнал объясняет, возврат будит цикл');
