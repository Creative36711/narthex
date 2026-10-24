// Проба 1.4.30: капча («Security Verification») останавливает отправку.
//
// Случай Мастера (53), журнал 11:56:47:
//
//   11:56:44 План Координатора запрошен (1 Submitted, 0 Running, 0 Ready, 0 Rework).
//   11:56:44 «Coordinator» уже открыт — отправляю задание здесь.
//   11:56:47 Задание отправлено.
//
// Сообщение до Координатора не дошло: поверх чата висела reCAPTCHA. Скрипт
// считал отправку состоявшейся по косвенным признакам — поле опустело, в
// транскрипте на миг появилась реплика, — и дальше ждал ответа на вопрос,
// которого никто не получал.
//
// Здесь проверяется: капча распознаётся, любые признаки доставки при ней не
// считаются отправкой, пауза громкая и ждёт человека, а очередь остаётся —
// после решения капчи «Продолжить» отправит то же задание, а не начнёт ход
// заново.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

const cut = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a > 0 && b > a, `фрагмент на месте: ${from.trim()}`);
  return src.slice(a, b);
};

// ── 1. Капча распознаётся по разметке и по заголовку ───────────────────────
const captchaSrc = cut('  const CAPTCHA_SELECTORS = [', '  /**\n   * Кнопка рядом с полем ввода.');

const visible = (el) => Boolean(el && el.isConnected !== false && el.rect !== false);

function findCaptcha({ dialogs = [], containers = [] } = {}) {
  const document = {
    querySelectorAll: (sel) => {
      if (sel.includes('role="dialog"')) return dialogs;
      if (sel === '.recaptcha-v2-container') return containers;
      return [];
    },
  };
  const fn = new Function('document', 'visible', `${captchaSrc}\nreturn { captchaDialog };`);
  return fn(document, visible).captchaDialog();
}

const dialogWith = (hit) => ({
  isConnected: true,
  rect: true,
  textContent: 'Security Verification',
  querySelector: (sel) => (hit(sel) ? { found: true } : null),
  contains: () => false,
});

// reCAPTCHA внутри диалога: узнаётся по контейнеру, по iframe и по textarea.
for (const sel of ['.recaptcha-v2-container', 'iframe[title="reCAPTCHA"]', 'iframe[src*="recaptcha"]', '#g-recaptcha-response']) {
  const dialog = dialogWith((s) => s === sel);
  assert.equal(findCaptcha({ dialogs: [dialog] }), dialog, `капча узнана по ${sel}`);
}

// Обычный диалог Arena капчей не считается.
{
  const plain = dialogWith(() => null);
  plain.textContent = 'Review changes?';
  assert.equal(findCaptcha({ dialogs: [plain] }), null, 'обычный диалог — не капча');
}

// Скрытый диалог не мешает: капча должна быть на экране.
{
  const hidden = { ...dialogWith((s) => s === '.recaptcha-v2-container'), rect: false };
  assert.equal(findCaptcha({ dialogs: [hidden] }), null, 'скрытое окно проверки не считается');
}

// Переверстка: заголовок Security Verification без известных селекторов.
{
  const textOnly = { ...dialogWith(() => null), textContent: 'Security Verification Please complete this quick security check' };
  assert.equal(findCaptcha({ dialogs: [textOnly] }), textOnly, 'капча узнаётся по заголовку');
}

// Контейнер без role=dialog тоже виден.
{
  const box = { isConnected: true, rect: true, closest: () => null };
  assert.equal(findCaptcha({ containers: [box] }), box, 'контейнер капчи без диалога');
}

// ── 2. При капче доставка не подтверждается ────────────────────────────────
const waitSrc = cut('  async function waitSent(', '  /** Enter в поле ввода');
function waitSentWith({ captcha, lastUser = false, count = 1 }) {
  const fn = new Function(
    'lastUserSays', 'messages', 'messagesBefore', 'composer', 'composerText', 'generating',
    'sleep', 'captchaDialog', 'C', 'Date',
    `${waitSrc}\nreturn waitSent;`,
  );
  const run = fn(
    () => lastUser,
    () => new Array(count).fill({}),
    0,
    () => null,
    () => '',
    () => true,
    async () => {},
    () => (captcha ? {} : null),
    { sendVerifyMs: 10 },
    Date,
  );
  return run('ключ', 0, 10);
}

// Поле опустело, агент «печатает», сообщений стало больше — но висит капча.
assert.equal(await waitSentWith({ captcha: true }), '', 'капча отменяет признаки доставки');
assert.equal(await waitSentWith({ captcha: true, lastUser: true }), '', 'и свою реплику в транскрипте тоже');
// Без капчи те же признаки работают как раньше.
assert.equal(await waitSentWith({ captcha: false, lastUser: true }), 'message', 'своё сообщение — доставка');
assert.equal(await waitSentWith({ captcha: false, count: 1 }), 'count', 'счётчик тоже считается');

// ── 3. Проверки в самой отправке ───────────────────────────────────────────
const deliverSrc = cut('  async function deliver(editor, text) {', '  /** Короткий хеш текста');
assert.match(deliverSrc, /if \(captchaDialog\(\)\) return blocked\(\);/, 'капча проверяется до клика');
assert.match(deliverSrc, /const blocked = \(\) => \(\{/, 'отказ по капче отдельный');
assert.match(deliverSrc, /captcha: true,/, 'признак капчи есть в результате');
assert.match(deliverSrc, /клик \$\{clicked\}: вместо отправки окно проверки/, 'причина называет клик');
assert.match(deliverSrc, /if \(captchaDialog\(\)\) return blocked\(\);\n        dbg\("Send: сообщение в чате"/, 'капча проверяется и после доставки');

// ── 4. Очередь и карточка: откат отправки, но не хода ──────────────────────
const consumeSrc = cut('  async function consumePending(', '  // ───────────────────── следы прошлых попыток');
assert.match(consumeSrc, /if \(delivery\.captcha\) \{/, 'у капчи отдельная ветка');
const captchaBranch = consumeSrc.slice(consumeSrc.indexOf('if (delivery.captcha) {'), consumeSrc.indexOf('if (!delivery.ok) {'));
assert.doesNotMatch(captchaBranch, /releaseUndelivered/, 'карточка не откатывается: ход ждёт человека');
assert.doesNotMatch(captchaBranch, /GM_setValue\(K\.pending, null\);\n\s+captchaPause/, 'очередь не снимается молча');
assert.match(captchaBranch, /sentAt: null, verified: false/, 'отметка отправки снята — это и есть откат');
assert.match(captchaBranch, /captchaPause\(\)/, 'пауза ждёт человека');
assert.match(consumeSrc, /if \(captchaDialog\(\)\) \{\n\s+captchaPause\(\);\n\s+return true;/, 'капча до вставки тоже останавливает шаг');

// ── 5. Пауза громкая, свой заголовок пуша ──────────────────────────────────
const pauseSrc = cut('  function pause(reason, context = {}) {', '  /**\n   * Передача потерялась');
assert.match(pauseSrc, /title: context\.notifyTitle \|\| "Narthex: пауза"/, 'заголовок пуша можно уточнить');
assert.match(pauseSrc, /priority: "5"/, 'пуш громкий');
assert.match(src, /notifyTitle: "Narthex: капча — нужен человек"/, 'у капчи свой заголовок');
assert.match(src, /function captchaPause\(extra = ""\)/, 'одна точка паузы по капче');
assert.match(src, /задание осталось в очереди/, 'Мастеру сказано, что задание не потеряно');

// ── 6. Капча ловится и вне отправки, и не закрывается как плашка ───────────
const tickFrom = src.indexOf('  async function tick(fromToggle = false) {');
const tickBody = src.slice(tickFrom, src.indexOf('  // ───────────────────────────── старт', tickFrom));
assert.match(tickBody, /if \(captchaDialog\(\)\) \{\n\s+captchaPause\(\);/, 'тик останавливается на капче');
const closeSrc = cut('  function closeCompletionPanel() {', '  /** Плашка любым способом');
assert.match(closeSrc, /if \(captcha && \(panel === captcha \|\| panel\.contains\(captcha\)\)\) continue;/, 'окно проверки не закрывается как плашка');
assert.match(src, /captcha: \(\) => Boolean\(captchaDialog\(\)\)/, '__narthex.captcha()');

console.log(
  'OK: narthex 1.4.30 — капча останавливает отправку, откатывает отметку «отправлено» и ждёт человека с громким пушем',
);
