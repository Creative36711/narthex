// Проба narthex.user.js: кнопка «Шаг» и досылка задания.
//
// Жалоба Мастера: «нажимаю Шаг — переходит к Координатору и молчание, в логах
// ничего». Найдено четыре молчаливых места:
//   1. после перехода на страницу адресата `tick` выходил по гейту «автоцикл
//      выключен», поэтому сохранённое задание никто не досылал;
//   2. `consumePending` возвращал false без записи в журнал (нет редактора,
//      агент ещё отвечает, чужая роль);
//   3. `generating()` смотрел только на существование скрытого `stop-button`
//      и мог ждать призрака вечно;
//   4. поле ввода искалось первым `[contenteditable]`, а не `.editor-content`.
// Плюс плашка «задание выполнено» перекрывала чат — в dispatch.user.js она
// закрывается до вставки текста.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// 1. Версия и гейт тика.
assert.match(src, /@version\s+1\.4\.2/, 'версия 1.4.2');

const tickStart = src.indexOf('async function tick(');
const tickBody = src.slice(tickStart, src.indexOf('// ───────────────────────────── старт', tickStart));
assert.match(tickBody, /const pending = GM_getValue\(K\.pending, null\);/, 'тик знает про очередь');
assert.match(tickBody, /if \(!auto && !fromToggle && !pending\) return;/, 'незавершённая отправка важнее автоцикла');
assert.match(tickBody, /Date\.now\(\) - busyAt < 120000/, 'залипший шаг снимается через две минуты');
assert.match(tickBody, /Шаг уже выполняется/, 'повторное нажатие объясняется, а не молчит');
assert.match(tickBody, /в адресе нет \/agent\/<id>/, 'чужая страница объясняется');
assert.match(tickBody, /else if \(!expect\)/, 'исполнитель без задания не падает в TypeError');
assert.match(tickBody, /submitExecutor\(me, expect, fromToggle\)/, 'ручной режим передаётся исполнителю');
assert.match(src, /async function markerMissing\(role, expect, markerName, manual = false\)/, 'ожидание маркера знает про ручной шаг');
assert.match(src, /Жду ответ \$\{role.name\}: новых сообщений нет/, 'ручной шаг объясняет ожидание');

// 2. Поле ввода и кнопка отправки — как в рабочем dispatch.user.js.
const sendStart = src.indexOf('// ───────────────────────────── отправка');
const sendEnd = src.indexOf('// ───────────────────────────── PR', sendStart);
const sendBlock = src.slice(sendStart, sendEnd);
assert.match(sendBlock, /\.editor-content\[contenteditable='true'\]/, 'ищем редактор Arena, а не первый contenteditable');
assert.match(sendBlock, /\[contenteditable='true'\]\.tiptap/, 'tiptap-редактор');
assert.match(sendBlock, /\[contenteditable='true'\]\[role='textbox'\]/, 'редактор с role=textbox');
assert.match(sendBlock, /querySelectorAll\("textarea"\)/, 'запасной textarea');
assert.match(sendBlock, /SEND_LABEL = \/\(\^\|\[\\s:\]\)\(send\|submit\|отправ/, 'подпись Send ищется и по-русски');
assert.match(sendBlock, /aria-disabled/, 'заблокированная кнопка не считается');
assert.match(sendBlock, /function writePrompt\(editor, text\)/, 'вставка текста отдельной функцией');
assert.match(sendBlock, /HTMLTextAreaElement\.prototype/, 'textarea заполняется нативным сеттером');

// 3. Плашка завершённой задачи.
assert.match(sendBlock, /function closeCompletionPlaque\(\)/, 'плашка закрывается');
assert.match(sendBlock, /border-border-medium/, 'тот же селектор панели, что в dispatch.user.js');
assert.match(sendBlock, /close\|dismiss\|закрыть\|скрыть/, 'кнопка закрытия ищется по подписи');
const plaqueCall = sendBlock.indexOf('const plaque = closeCompletionPlaque();');
const writeCall = sendBlock.indexOf('writePrompt(editor, pending.text)');
assert.ok(plaqueCall > 0 && plaqueCall < writeCall, 'плашку закрываем до вставки задания');

// 4. Молчаливых выходов в consumePending не осталось.
const cpStart = sendBlock.indexOf('async function consumePending()');
const cpBody = sendBlock.slice(cpStart);
const bareReturns = [...cpBody.matchAll(/return (true|false);/g)].map((m) => m[0]);
assert.equal(
  bareReturns.filter((r) => r === 'return false;').length,
  2,
  'return false только там, где задания нет или оно чужое',
);
for (const text of [
  'Задание из очереди устарело',
  'Агент ещё отвечает: задание из очереди подождёт',
  'Не нашёл поле ввода на странице адресата',
  'Не удалось вставить задание в редактор',
  'Задание отправлено.',
]) {
  assert.ok(cpBody.includes(text), `журнал объясняет: ${text}`);
}
assert.match(cpBody, /setTimeout\(\(\) => tick\(false\), 5000\)/, 'без редактора шаг повторится сам');

// 5. generating смотрит на видимую кнопку остановки.
const genStart = src.indexOf('const generating =');
const genBody = src.slice(genStart, src.indexOf('//', src.indexOf(');', genStart)) + 2);
assert.match(genBody, /visible\(b\)/, 'скрытый stop-button не считается');
assert.match(genBody, /stop generating\|остановить генерац/, 'подписи остановки');

// 6. Поведение: мини-DOM и заглушки вместо браузера.
const load = ({ pending, editor, send, panels = [], stop = false, now = 1_000_000 }) => {
  const out = { logs: [], sets: new Map(), pauses: [], clicks: [], timers: [] };
  const state = { now };
  const advance = (ms) => { state.now += ms; };
  const el = (tag, props = {}) => ({
    tagName: tag,
    isConnected: true,
    disabled: false,
    innerText: "",
    textContent: props.text || "",
    focus() {},
    getAttribute: (k) => props[k] ?? null,
    getClientRects: () => [{}],
    closest: () => null,
    querySelectorAll: () => [],
    dispatchEvent() {},
    click() { out.clicks.push(props.id || tag); },
    ...props,
  });
  const sendBtn = send ? el("BUTTON", { "aria-label": "Send", id: "send" }) : null;
  const closeBtn = el("BUTTON", { "aria-label": "Close", id: "close-plaque" });
  const panel = {
    querySelectorAll: () => [closeBtn],
    querySelector: () => null,
  };
  const document = {
    querySelector: (sel) => (sel.includes("contenteditable") ? editor : null),
    querySelectorAll: (sel) => {
      if (sel.includes("border-border-medium")) return panels.length ? panels : [];
      if (sel.includes("contenteditable")) return editor ? [editor] : [];
      if (sel.includes("button")) return stop ? [el("BUTTON", { "aria-label": "Stop generating" })] : sendBtn ? [sendBtn] : [];
      return [];
    },
    createRange: () => ({ selectNodeContents() {} }),
    execCommand: (_cmd, _ui, text) => {
      if (editor) editor.innerText = text;
      return true;
    },
  };
  const window = { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) };
  const FakeDate = { now: () => state.now };

  const fn = new Function(
    "GM_getValue", "GM_setValue", "K", "norm", "roleFromPath", "visible", "lastMessageId",
    "setStatus", "log", "pause", "sleep", "tick", "location", "document", "window",
    "getComputedStyle", "Date", "setTimeout", "HTMLTextAreaElement", "HTMLInputElement", "InputEvent",
    "generating",
    `${sendBlock}\nreturn { consumePending, closeCompletionPlaque };`,
  );
  const api = fn(
    (k, d) => (k === "cfn-pending" ? pending : d),
    (k, v) => out.sets.set(k, v),
    { pending: "cfn-pending" },
    (x) => String(x || "").replace(/-/g, "").toLowerCase(),
    () => "coordinator",
    (e) => Boolean(e && e.isConnected && e.getClientRects().length),
    () => "m1",
    () => {},
    (text, error) => out.logs.push({ text, error: Boolean(error) }),
    (text, ctx) => out.pauses.push({ text, ctx }),
    async (ms) => advance(ms),
    () => {},
    { assign() {} },
    document,
    window,
    () => ({ visibility: "visible", display: "block" }),
    FakeDate,
    (cbFn, ms) => out.timers.push(ms),
    function () {},
    function () {},
    function (type, init) { return { type, ...init }; },
    () => stop,
  );
  return { api, out };
};

const pending = { roleId: "coordinator", text: "план, пожалуйста", at: 999_000 };

// 6.1. Обычный случай: задание вставлено и отправлено.
{
  const editor = {
    tagName: "DIV", isConnected: true, innerText: "", textContent: "",
    focus() {}, getClientRects: () => [{}], closest: () => null,
    querySelectorAll: () => [], dispatchEvent() {},
  };
  const { api, out } = load({ pending, editor, send: true });
  assert.equal(await api.consumePending(), true, 'pending обработан');
  assert.deepEqual(out.clicks, ["send"], 'нажата именно Send');
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь очищена');
  assert.ok(out.logs.some((l) => l.text === "Задание отправлено."), 'в журнале есть отправка');
}

// 6.2. Плашка завершённой задачи закрывается до вставки.
{
  const editor = {
    tagName: "DIV", isConnected: true, innerText: "", textContent: "",
    focus() {}, getClientRects: () => [{}], closest: () => null,
    querySelectorAll: () => [], dispatchEvent() {},
  };
  const closePlaque = {
    isConnected: true, tagName: "BUTTON",
    getClientRects: () => [{}],
    getAttribute: (k) => (k === "aria-label" ? "Close" : null),
    click: () => {},
  };
  const panel = {
    isConnected: true, tagName: "DIV",
    getClientRects: () => [{}],
    querySelectorAll: () => [closePlaque],
    querySelector: () => null,
  };
  const { api, out } = load({ pending, editor, send: true, panels: [panel] });
  await api.consumePending();
  assert.ok(out.logs.some((l) => /Закрыл плашку/.test(l.text)), 'закрытие плашки видно в журнале');
  assert.deepEqual(out.clicks, ["send"], 'после закрытия плашки задание ушло');
}

// 6.3. Нет редактора: объяснение в журнале и повтор, без зависания.
{
  const { api, out } = load({ pending, editor: null, send: true });
  assert.equal(await api.consumePending(), true, 'ожидание редактора тоже держит ход');
  assert.ok(out.logs.some((l) => /Не нашёл поле ввода/.test(l.text)), 'сказано, что редактора нет');
  assert.deepEqual(out.timers, [5000], 'назначен повтор');
}

// 6.4. Агент ещё отвечает: ждём, ничего не нажимаем.
{
  const editor = {
    tagName: "DIV", isConnected: true, innerText: "", textContent: "",
    focus() {}, getClientRects: () => [{}], closest: () => null,
    querySelectorAll: () => [], dispatchEvent() {},
  };
  const { api, out } = load({ pending, editor, send: true, stop: true });
  await api.consumePending();
  assert.ok(out.logs.some((l) => /Агент ещё отвечает/.test(l.text)), 'ожидание объяснено');
  assert.deepEqual(out.clicks, [], 'ничего не нажато');
}

// 6.5. Редактор есть, Send нет: пауза, а не тишина.
{
  const editor = {
    tagName: "DIV", isConnected: true, innerText: "", textContent: "",
    focus() {}, getClientRects: () => [{}], closest: () => null,
    querySelectorAll: () => [], dispatchEvent() {},
  };
  const { api, out } = load({ pending, editor, send: false });
  await api.consumePending();
  assert.equal(out.pauses.length, 1, 'пауза поставлена');
  assert.match(out.pauses[0].text, /Кнопка Send не найдена/);
}

// 6.6. Чужое задание не трогаем.
{
  const { api, out } = load({ pending: { ...pending, roleId: "kernel" }, editor: null, send: true });
  assert.equal(await api.consumePending(), false, 'чужой ход не наш');
  assert.equal(out.logs.length, 0, 'и журнал не засоряется');
}

console.log("OK: narthex 1.4.2 — «Шаг» доносит задание после перехода, плашка закрывается, каждый отказ объяснён");
