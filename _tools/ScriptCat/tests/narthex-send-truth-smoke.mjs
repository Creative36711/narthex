// Проба 1.4.82: «Задание отправлено» пишется только тогда, когда сообщение
// действительно в чате.
//
// Случай Мастера (28.10, 19:08). Журнал:
//
//   Ход Pack Author: задание передано…
//   Задание отправлено (7829 символов).
//
// а текст остался в поле ввода и никуда не ушёл. Подтверждением доставки
// служили три признака, из которых два не доказывают ничего:
//   • вырос счётчик сообщений — страница в этот момент догружала транскрипт
//     (0 → 15 сообщений), и «новые» были чужими, старыми;
//   • поле опустело при работающей кнопке Stop — Stop висел от прошлой
//     генерации, а поле могло быть просто перерисовано;
//   • своё сообщение в чате — единственный настоящий признак, и он не сработал.
//
// Здесь проверяется: счётчик и Stop доставку не подтверждают, текст в поле
// ввода отменяет успех, а журнал о доставке стоит после проверки, а не вместо
// неё.

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');
assert.match(src, /@version\s+1\.4\.82/, 'версия 1.4.82');

const cut = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a > 0 && b > a, `фрагмент на месте: ${String(from).trim()}`);
  return src.slice(a, b);
};

const flat = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// ── 1. Текст в поле ввода — это отсутствие отправки ───────────────────────
const verifySrc = cut('  /** Ждём подтверждение доставки', '  /** Enter в поле ввода');
const makeHolds = new Function(
  'composer',
  'composerText',
  'flat',
  `${verifySrc}\nreturn composerHolds;`,
);

const holds = (text, key = 'Задание 5.4 · NAR-5.4 (dispatch 1fc527ed)') =>
  makeHolds(() => ({}), () => text, flat)(key);

assert.equal(holds('Задание 5.4 · NAR-5.4 (dispatch 1fc527ed)'), true, 'текст в поле — отправки не было');
assert.equal(holds(''), false, 'пустое поле — не признак отправки, но и не запрет');
assert.equal(
  makeHolds(() => null, () => 'что-то', flat)('ключ'),
  false,
  'без живого поля проверка не выдумывает текст',
);
assert.equal(
  makeHolds(() => ({}), () => 'полное задание без отличительной строки', flat)(
    '',
    'полное задание без отличительной строки',
  ),
  true,
  'без ключа проверка идёт по началу текста',
);

// ── 2. Ожидание доставки: только своё сообщение ───────────────────────────
function waitSentWith({ lastUser = false, count = 1, holdsText = '', captcha = false } = {}) {
  const fn = new Function(
    'lastUserSays',
    'composer',
    'composerText',
    'flat',
    'captchaDialog',
    'sleep',
    'Date',
    `${verifySrc}\nreturn waitSent;`,
  );
  const run = fn(
    () => lastUser,
    () => (holdsText ? {} : null),
    () => holdsText,
    flat,
    () => (captcha ? {} : null),
    async () => {},
    Date,
  );
  return run('Задание 5.4 · (dispatch 1fc527ed)', 0, 10);
}

assert.equal(await waitSentWith({ lastUser: true }), 'message', 'своё сообщение — доставка');
assert.equal(await waitSentWith({ count: 15 }), '', 'счётчик сообщений доставкой не считается');
assert.equal(await waitSentWith({ lastUser: true, holdsText: 'Задание 5.4 · (dispatch 1fc527ed)' }), '', 'текст остался в поле — не доставка');
assert.equal(await waitSentWith({ lastUser: true, captcha: true }), '', 'капча отменяет и настоящий признак');

// Ни одного «слабого» признака в ожидании не осталось.
assert.ok(!/"count"\.test|return "count"/.test(verifySrc), 'ветки «счётчик» больше нет');
assert.ok(!/"generating"/.test(verifySrc), 'ветки «поле опустело + Stop» больше нет');

// ── 3. Проверка стоит после клика, до рапорта ─────────────────────────────
const deliverSrc = cut('  async function deliver(editor, text) {', '  /** Короткий хеш текста');
const clickAt = deliverSrc.indexOf('btn.click();');
const holdAt = deliverSrc.indexOf('if (composerHolds(key))');
const okAt = deliverSrc.indexOf('return { ok: true, via };');
assert.ok(clickAt > 0, 'клик по Send на месте');
assert.ok(holdAt > clickAt, 'после клика проверяется поле ввода');
assert.ok(okAt > holdAt, 'успех объявляется только после проверки');
assert.match(deliverSrc, /текст остался в поле ввода/, 'причина названа словами, а не кодом');
assert.match(deliverSrc, /const key = sendKey\(text\) \|\| flat\(text\)\.slice\(0, 60\);/, 'без отличительной строки ключ берётся из начала текста');

// ── 4. Журнал о доставке — в ветке успеха ────────────────────────────────
const pendingSrc = cut('  async function consumePending(manual = false) {', '  // ───────────────────── следы прошлых попыток (очистка)');
const okBranch = pendingSrc.indexOf('if (!delivery.ok) {');
const reportAt = pendingSrc.indexOf('log(`Задание отправлено (');
assert.ok(okBranch > 0 && reportAt > okBranch, 'рапорт стоит после ветки отказа');
assert.match(pendingSrc, /if \(delivery\.retry\) \{/, 'недорисованная страница не считается отказом доставки');
assert.match(pendingSrc, /«Продолжить» — оно уйдёт этой же карточке/, 'Мастеру сказано, что делать с неотправленным');

console.log('send-truth: 15 проверок — ok');
