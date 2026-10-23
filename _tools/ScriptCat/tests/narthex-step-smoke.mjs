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
assert.match(src, /@version\s+1\.4\.3/, 'версия 1.4.3');

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
const cpStart = sendBlock.indexOf('async function consumePending(');
const cpBody = sendBlock.slice(cpStart);
const bareReturns = [...cpBody.matchAll(/return (true|false);/g)].map((m) => m[0]);
assert.equal(
  bareReturns.filter((r) => r === 'return false;').length,
  2,
  'return false только там, где задания нет или оно чужое',
);
assert.match(cpBody, /return !act;/, 'просрочка продолжает шаг только по нажатию или в автоцикле');
for (const text of [
  'Снял просроченную отправку из очереди',
  'Агент ещё отвечает: задание из очереди подождёт',
  'Не нашёл поле ввода на странице адресата',
  'Не удалось вставить задание в редактор',
  'Задание отправлено.',
]) {
  assert.ok(cpBody.includes(text), `журнал объясняет: ${text}`);
}
assert.match(cpBody, /setTimeout\(\(\) => tick\(false\), 5000\)/, 'без редактора шаг повторится сам');
assert.match(cpBody, /async function consumePending\(manual = false\)/, 'ручной режим различается');
assert.match(tickBody, /consumePending\(fromToggle\)/, 'тик передаёт признак нажатия');
assert.match(cpBody, /const age = Date\.now\(\) - Number\(pending\.at \|\| 0\);/, 'возраст очереди считается до сверки роли');
assert.match(cpBody, /Снял просроченную отправку из очереди/, 'просрочка объясняется');
assert.match(cpBody, /Продолжаю шаг с чистого листа/, 'просрочка не глотает нажатие');
assert.match(cpBody, /Нажмите «Шаг», чтобы начать заново/, 'на загрузке страницы шаг сам не начинается');
assert.match(cpBody, /if \(mine && waiting && norm\(waiting\.roleId\) === norm\(me\)\) GM_setValue\(K\.expect, null\);/, 'вместе с очередью снимается ожидание');
const staleReturn = cpBody.slice(cpBody.indexOf('Снял просроченную отправку'), cpBody.indexOf('if (!me ||'));
assert.match(staleReturn, /return !act;/, 'после снятия просрочки тик идёт дальше по нажатию');
assert.match(src, /pendingTtlMs: 600000/, 'TTL очереди в конфиге');
assert.match(src, /replyWaitMs: 1800000/, 'предел ожидания ответа в конфиге');
assert.match(src, /function dropHandoff\(reason\)/, 'зависшая передача снимается целиком');
assert.match(src, /не ответил ни одним сообщением за/, 'молчание агента объясняется');
assert.match(tickBody, /dropHandoff\(/, 'молчание агента ставит паузу');

// 5. generating смотрит на видимую кнопку остановки.
const genStart = src.indexOf('const generating =');
const genBody = src.slice(genStart, src.indexOf('//', src.indexOf(');', genStart)) + 2);
assert.match(genBody, /visible\(b\)/, 'скрытый stop-button не считается');
assert.match(genBody, /stop generating\|остановить генерац/, 'подписи остановки');

// 6. Поведение: мини-DOM и заглушки вместо браузера.
const load = ({ pending, editor, send, panels = [], stop = false, now = 1_000_000, expect = null }) => {
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
    "generating", "C",
    `${sendBlock}\nreturn { consumePending, closeCompletionPlaque };`,
  );
  const api = fn(
    (k, d) => (k === "cfn-pending" ? pending : k === "cfn-expect" ? expect : d),
    (k, v) => out.sets.set(k, v),
    { pending: "cfn-pending", expect: "cfn-expect" },
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
    { maxLog: 200, pendingTtlMs: 600000, replyWaitMs: 1800000 },
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

// 6.5.1. Просроченная очередь: снимаем, объясняем и продолжаем шаг.
{
  const old = { ...pending, at: 1_000_000 - 11 * 60 * 1000 };
  const { api, out } = load({ pending: old, editor: null, send: true, expect: { roleId: "coordinator", at: old.at } });
  assert.equal(await api.consumePending(true), false, 'просрочка не держит ход по нажатию');
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь очищена');
  assert.equal(out.sets.get("cfn-expect"), null, 'ожидание той же роли снято');
  assert.ok(out.logs.some((l) => /Снял просроченную отправку/.test(l.text) && l.error), 'причина видна и помечена как проблема');
  assert.ok(!out.logs.some((l) => /Задание отправлено/.test(l.text)), 'просроченное не отправляется');
  assert.deepEqual(out.clicks, [], 'ничего не нажато');
  assert.deepEqual(out.timers, [], 'повтор не назначается');
}

// 6.5.1b. Та же просрочка, но без нажатия: убираем и останавливаемся.
{
  const old = { ...pending, at: 1_000_000 - 11 * 60 * 1000 };
  const { api, out } = load({ pending: old, editor: null, send: true });
  assert.equal(await api.consumePending(false), true, 'без нажатия шаг не начинается');
  assert.equal(out.sets.get("cfn-pending"), null, 'но очередь очищена');
  assert.ok(out.logs.some((l) => /Нажмите «Шаг»/.test(l.text)), 'Мастеру сказано, что делать');
}

// 6.5.2. Просроченная очередь чужой роли: снимаем, но ожидание не трогаем.
{
  const old = { ...pending, roleId: "kernel", at: 1_000_000 - 11 * 60 * 1000 };
  const { api, out } = load({ pending: old, editor: null, send: true, expect: { roleId: "kernel", at: old.at } });
  await api.consumePending();
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь очищена в любом случае');
  assert.equal(out.sets.get("cfn-expect"), undefined, 'чужое ожидание не снимается с этой страницы');
}

// 6.6. Чужое задание не трогаем.
{
  const { api, out } = load({ pending: { ...pending, roleId: "kernel" }, editor: null, send: true });
  assert.equal(await api.consumePending(), false, 'чужой ход не наш');
  assert.equal(out.logs.length, 0, 'и журнал не засоряется');
}

console.log("OK: narthex 1.4.3 — «Шаг» доносит задание после перехода, плашка закрывается, каждый отказ объяснён");
