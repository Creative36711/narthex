// Проба narthex.user.js: кнопка «Шаг», поле ввода и плашка завершённой задачи.
//
// История жалоб Мастера, все проверяются здесь:
//   • после перехода на страницу адресата задание не досылалось (гейт «автоцикл
//     выключен» срабатывал раньше очереди);
//   • `consumePending` молчал на каждом раннем выходе;
//   • `generating()` ждал скрытый `stop-button` из прошлой генерации;
//   • поле ввода искалось первым `[contenteditable]`, а не редактором Arena;
//   • «Шаг» на корне (`/`) требовал вручную открыть страницу агента;
//   • плашка «задание выполнено» и карточка с кнопкой Skip перекрывают чат,
//     поэтому в `dispatch.user.js` они закрываются ДО вставки текста.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

// 1. Версия и гейт тика.
assert.match(src, /@version\s+1\.4\.6/, 'версия 1.4.6');

const tickStart = src.indexOf('async function tick(');
const tickBody = src.slice(tickStart, src.indexOf('// ───────────────────────────── старт', tickStart));
assert.match(tickBody, /const pending = GM_getValue\(K\.pending, null\);/, 'тик знает про очередь');
assert.match(tickBody, /if \(!auto && !fromToggle && !pending\) return;/, 'незавершённая отправка важнее автоцикла');
assert.match(tickBody, /Date\.now\(\) - busyAt < 120000/, 'залипший шаг снимается через две минуты');
assert.match(tickBody, /Шаг уже выполняется/, 'повторное нажатие объясняется, а не молчит');
assert.match(tickBody, /else if \(!expect\)/, 'исполнитель без задания не падает в TypeError');
assert.match(tickBody, /submitExecutor\(me, expect, fromToggle\)/, 'ручной режим передаётся исполнителю');
assert.match(src, /async function markerMissing\(role, expect, markerName, manual = false\)/, 'ожидание маркера знает про ручной шаг');
assert.match(src, /Жду ответ \$\{role.name\}: новых сообщений нет/, 'ручной шаг объясняет ожидание');

// 1.1. «Шаг» работает с любой страницы: сам открывает Координатора.
const rootBlock = tickBody.slice(
  tickBody.indexOf('const meId = roleFromPath();'),
  tickBody.indexOf('const me = list.find(', tickBody.indexOf('const meId')),
);
assert.match(rootBlock, /if \(!fromToggle\) return;/, 'в автоцикле навигацию не затеваем');
assert.match(rootBlock, /r\.fn === "Coordinator"/, 'ищем Координатора среди активных ролей');
assert.match(rootBlock, /GM_setValue\(K\.step, true\)/, 'шаг запоминается на один переход');
assert.match(rootBlock, /location\.assign\(coord\.url\)/, 'открываем страницу Координатора сами');
assert.ok(!/в адресе нет \/agent\/<id>/.test(src), 'требования открыть страницу вручную больше нет');
assert.match(src, /if \(GM_getValue\(K\.step, false\)\) \{/, 'загрузка страницы выполняет отложенный шаг');
assert.match(src, /GM_setValue\(K\.step, false\);/, 'шаг одноразовый, петли нет');

// 2. Поле ввода и кнопка отправки — шире, чем в dispatch.user.js.
const sendStart = src.indexOf('// ───────────────────────────── отправка');
const sendEnd = src.indexOf('// ───────────────────────────── PR', sendStart);
const sendBlock = src.slice(sendStart, sendEnd);
assert.match(sendBlock, /\.editor-content\[contenteditable\]/, 'редактор Arena первым');
assert.match(sendBlock, /\[contenteditable\]:not\(\[contenteditable='false'\]\)/, 'plaintext-only тоже contenteditable');
assert.match(sendBlock, /\.ProseMirror/, 'ProseMirror');
assert.match(sendBlock, /\[role='textbox'\]/, 'role=textbox');
assert.match(sendBlock, /textarea:not\(\[readonly\]\)/, 'запасной textarea');
assert.match(sendBlock, /function elementCovered\(editor\)/, 'проверяем, не накрыт ли элемент');
assert.match(sendBlock, /document\.elementFromPoint\(/, 'оверлей ловится по верхнему элементу');
assert.match(sendBlock, /SEND_LABEL = \/\(\^\|\[\\s:\]\)\(send\|submit\|отправ/, 'подпись Send ищется и по-русски');
assert.match(sendBlock, /aria-disabled/, 'заблокированная кнопка не считается');
assert.match(sendBlock, /function writePrompt\(editor, text\)/, 'вставка текста отдельной функцией');
assert.match(sendBlock, /HTMLTextAreaElement\.prototype/, 'textarea заполняется нативным сеттером');

// 3. Плашка и карточка Skip — оба вида перекрывают чат.
assert.match(sendBlock, /function closeCompletionPanel\(\)/, 'панель завершения закрывается');
assert.match(sendBlock, /function closeCompletionPlaque\(\)/, 'плашка любым способом закрывается');
assert.match(sendBlock, /const PANEL_SELECTORS = \[/, 'панель ищется по стабильной части классов');
assert.match(sendBlock, /border-border-medium\.bg-surface-secondary/, 'стабильная часть классов');
const panelSelectors = sendBlock.slice(sendBlock.indexOf('const PANEL_SELECTORS'), sendBlock.indexOf('];', sendBlock.indexOf('const PANEL_SELECTORS')));
assert.ok(!/shadow/.test(panelSelectors), 'жёсткая привязка к тени убрана: у панели то shadow-sm, то shadow-none');
assert.match(sendBlock, /function completionPanels\(\)/, 'кандидаты в панель собираются и дедуплицируются');
assert.match(sendBlock, /close\|dismiss\|закрыть\|скрыть/, 'кнопка закрытия ищется по подписи');
assert.match(sendBlock, /function skipCardButton\(\)/, 'карточка с кнопкой Skip тоже закрывается');
assert.match(sendBlock, /data-agent-transcript-message/, 'ищем её в транскрипте, как dispatch.user.js');
assert.match(sendBlock, /async function ensureComposer\(/, 'редактор ждём, освобождая чат');
assert.equal([...sendBlock.matchAll(/if \(closed > 6\) break;/g)].length, 2, 'клик-шторм ограничен и для панели, и для Skip');
const ensureCall = sendBlock.indexOf('await ensureComposer()');
const writeCall = sendBlock.indexOf('writePrompt(editor, pending.text)');
assert.ok(ensureCall > 0 && ensureCall < writeCall, 'чат освобождается до вставки задания');

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
assert.match(cpBody, /const age = Date\.now\(\) - Number\(pending\.at \|\| 0\);/, 'возраст очереди считается до сверки роли');
assert.match(cpBody, /Снял просроченную отправку из очереди/, 'просрочка объясняется');
assert.match(cpBody, /Продолжаю шаг с чистого листа/, 'просрочка не глотает нажатие');
assert.match(cpBody, /Нажмите «Шаг», чтобы начать заново/, 'на загрузке страницы шаг сам не начинается');
assert.match(cpBody, /if \(mine && waiting && norm\(waiting\.roleId\) === norm\(me\)\) GM_setValue\(K\.expect, null\);/, 'вместе с очередью снимается ожидание');
for (const text of [
  'Агент ещё отвечает: задание из очереди подождёт',
  'Не нашёл поле ввода на странице адресата',
  'Не удалось вставить задание в редактор',
  'Задание отправлено.',
]) {
  assert.ok(cpBody.includes(text), `журнал объясняет: ${text}`);
}
assert.match(cpBody, /composerDiagnostics\(\)/, 'при отказе печатается диагностика разметки');
assert.ok(!/В поле ввода уже есть другой текст/.test(src), 'запрета на чужой текст больше нет');
assert.match(cpBody, /заменяю его заданием из очереди/, 'замена текста видна в журнале');
assert.match(cpBody, /const delivery = await deliver\(editor\);/, 'отправка проверяется');
assert.match(cpBody, /if \(!delivery\.ok\)/, 'неудачная отправка — пауза, а не «отправлено»');
assert.match(sendBlock, /async function deliver\(editor\)/, 'доставка отдельной функцией');
assert.match(sendBlock, /if \(elementCovered\(btn\)\)/, 'по перекрытой кнопке Send не кликаем');
assert.match(sendBlock, /Кнопка Send перекрыта плашкой/, 'перекрытие называется причиной');
assert.match(sendBlock, /messages\(\)\.length > before \|\| !composerText\(editor\) \|\| generating\(\)/, 'три признака доставки');
assert.match(sendBlock, /сообщение не появилось — текст остался в поле/, 'ложное «отправлено» исключено');
assert.match(cpBody, /setTimeout\(\(\) => tick\(false\), 5000\)/, 'без редактора шаг повторится сам');

// 5. Ожидание без отправки не считается ходом.
assert.match(tickBody, /if \(expect && !Number\(expect\.sentAt\)\)/, 'ожидание без отправки не считается ходом');
const noSendBlock = tickBody.slice(tickBody.indexOf('!Number(expect.sentAt)'), tickBody.indexOf('const waited'));
assert.match(noSendBlock, /GM_setValue\(K\.expect, null\);/, 'ожидание снимается');
assert.match(noSendBlock, /GM_setValue\("cfn-plan-at", 0\);/, 'троттлинг плана сбрасывается');
assert.match(noSendBlock, /ожидание снято, начинаю ход заново/, 'причина видна в журнале');
assert.match(noSendBlock, /expect = null;/, 'шаг продолжается без ожидания');
assert.match(src, /watermark, sentAt: Date\.now\(\)/, 'отметка отправки ставится только после успешной доставки');
assert.match(src, /pendingTtlMs: 600000/, 'TTL очереди в конфиге');
assert.match(src, /replyWaitMs: 1800000/, 'предел ожидания ответа в конфиге');
assert.match(src, /function dropHandoff\(reason\)/, 'зависшая передача снимается целиком');
assert.match(tickBody, /dropHandoff\(/, 'молчание агента ставит паузу');

// 6. Поведение: мини-DOM и заглушки вместо браузера.
const load = ({ pending, editor, send, panels = [], stop = false, now = 1_000_000, expect = null, skip = false, overlay = false, stickyOverlay = false, sendCovered = false }) => {
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
  const sendBtn = send ? el("BUTTON", {
    "aria-label": "Send", id: "send", contains: () => false,
    getBoundingClientRect: () => ({ left: 500, top: 550, width: 40, height: 10 }),
  }) : null;
  if (sendBtn) sendBtn.click = () => { out.clicks.push("send"); if (editor) { editor.innerText = ""; editor.textContent = ""; } };
  const messages = [];
  if (skip) {
    const skipBtn = el("BUTTON", { text: "Skip", id: "skip" });
    skipBtn.click = () => { out.clicks.push("skip"); messages.length = 0; };
    messages.push({ querySelectorAll: () => (messages.length ? [skipBtn] : []) });
  }
  const document = {
    querySelector: (sel) => (sel.includes("contenteditable") ? editor : null),
    querySelectorAll: (sel) => {
      if (sel.includes("data-agent-transcript-message")) return messages.length ? [messages[0]] : [];
      if (sel.includes("border-border-medium")) return panels.length ? panels : [];
      if (sel.includes("contenteditable") || sel.includes("ProseMirror") || sel.includes("textbox")) return editor ? [editor] : [];
      if (sel.includes("button")) return stop ? [el("BUTTON", { "aria-label": "Stop generating" })] : sendBtn ? [sendBtn] : [];
      return [];
    },
    elementFromPoint: (_x, y) => {
      const blocker = { isConnected: true, contains: () => false };
      if (y === 555) return sendCovered ? blocker : sendBtn || editor;  // центр кнопки Send
      if (overlay && (stickyOverlay || panels.length || messages.length)) return blocker;
      return editor;
    },
    createRange: () => ({ selectNodeContents() {} }),
    execCommand: (_cmd, _ui, text) => {
      if (editor) editor.innerText = text;
      return true;
    },
  };
  const window = { getSelection: () => ({ removeAllRanges() {}, addRange() {} }), innerWidth: 1200, innerHeight: 800 };
  const FakeDate = { now: () => state.now };

  const fn = new Function(
    "GM_getValue", "GM_setValue", "K", "norm", "roleFromPath", "visible", "lastMessageId",
    "setStatus", "log", "pause", "sleep", "tick", "location", "document", "window",
    "getComputedStyle", "Date", "setTimeout", "HTMLTextAreaElement", "HTMLInputElement", "InputEvent",
    "generating", "messages", "C",
    `${sendBlock}\nreturn { consumePending, closeCompletionPlaque, ensureComposer };`,
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
    () => [],
    { maxLog: 200, pendingTtlMs: 600000, replyWaitMs: 1800000 },
  );
  return { api, out };
};

// innerText и textContent у настоящего редактора — одно и то же поле.
const freshEditor = (text = "") => {
  let value = text;
  return {
    tagName: "DIV", isConnected: true,
    get innerText() { return value; },
    set innerText(v) { value = v; },
    get textContent() { return value; },
    set textContent(v) { value = v; },
    focus() {}, getClientRects: () => [{}], closest: () => null,
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 300, height: 60 }),
    contains: () => false, querySelectorAll: () => [], dispatchEvent() {},
  };
};

const pending = { roleId: "coordinator", text: "план, пожалуйста", at: 999_000 };

// 6.1. Обычный случай: задание вставлено и отправлено.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true });
  assert.equal(await api.consumePending(true), true, 'pending обработан');
  assert.deepEqual(out.clicks, ["send"], 'нажата именно Send');
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь очищена');
  assert.ok(out.logs.some((l) => l.text === "Задание отправлено."), 'в журнале есть отправка');
}

// 6.1b. Отправка ставит отметку sentAt — по ней отличают доставленное от фантома.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, expect: { roleId: "coordinator", kind: "plan" } });
  await api.consumePending(true);
  const saved = out.sets.get("cfn-expect");
  assert.equal(typeof saved?.sentAt, "number", 'sentAt записан в момент Send');
  assert.equal(saved?.kind, "plan", 'остальные поля ожидания сохранены');
}

// 6.2. Плашка завершённой задачи закрывается до вставки.
{
  const panels = [{
    isConnected: true, tagName: "DIV", getClientRects: () => [{}],
    querySelectorAll: () => [{
      isConnected: true, tagName: "BUTTON", getClientRects: () => [{}],
      getAttribute: () => "Close",
      click: () => panels.splice(0),
    }],
    querySelector: () => null,
  }];
  const { api, out } = load({ pending, editor: freshEditor(), send: true, panels, overlay: true });
  await api.consumePending(true);
  assert.ok(out.logs.some((l) => /Убрал плашку/.test(l.text)), 'закрытие плашки видно в журнале');
  assert.deepEqual(out.clicks, ["send"], 'после закрытия плашки задание ушло');
}

// 6.2b. Карточка с кнопкой Skip тоже освобождает чат.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, skip: true, overlay: true });
  await api.consumePending(true);
  assert.ok(out.clicks.includes("skip"), 'Skip нажат');
  assert.equal(out.clicks.at(-1), "send", 'после Skip задание отправлено');
  assert.ok(out.logs.some((l) => /Убрал плашку/.test(l.text)), 'действие видно в журнале');
}

// 6.2c. Редактор есть, но накрыт оверлеем без кнопки закрытия: не пишем вслепую.
{
  const editor = freshEditor();
  editor.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 40 });
  editor.contains = () => false;
  const { api, out } = load({ pending, editor, send: true, overlay: true, stickyOverlay: true });
  await api.consumePending(true);
  const line = out.logs.find((l) => /Не нашёл поле ввода/.test(l.text));
  assert.ok(line, 'о накрытом редакторе сказано');
  assert.match(line.text, /Поле перекрыто/, 'Мастеру подсказано закрыть плашку вручную');
  assert.deepEqual(out.clicks, [], 'в накрытый редактор ничего не отправлено');
}

// 6.3. Нет редактора: объяснение с диагностикой и повтор, без зависания.
{
  const { api, out } = load({ pending, editor: null, send: true });
  assert.equal(await api.consumePending(true), true, 'ожидание редактора держит ход');
  const line = out.logs.find((l) => /Не нашёл поле ввода/.test(l.text));
  assert.ok(line, 'сказано, что редактора нет');
  assert.match(line.text, /contenteditable \d+/, 'в строке есть диагностика разметки');
  assert.deepEqual(out.timers, [5000], 'назначен повтор');
}

// 6.4. Агент ещё отвечает: ждём, ничего не нажимаем.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, stop: true });
  await api.consumePending(true);
  assert.ok(out.logs.some((l) => /Агент ещё отвечает/.test(l.text)), 'ожидание объяснено');
  assert.deepEqual(out.clicks, [], 'ничего не нажато');
}

// 6.5. Редактор есть, Send нет: пауза, а не тишина.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: false });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 1, 'пауза поставлена');
  assert.match(out.pauses[0].text, /Кнопка Send не найдена/);
}

// 6.5a. В редакторе был текст — заменяем и отправляем, без ложной паузы.
{
  const { api, out } = load({ pending, editor: freshEditor("черновик Мастера"), send: true });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 0, 'паузы из-за текста больше нет');
  assert.deepEqual(out.clicks, ["send"], 'задание отправлено');
  assert.ok(out.logs.some((l) => /заменяю его заданием из очереди/.test(l.text)), 'замена отмечена в журнале');
}

// 6.5b. Кнопка Send перекрыта: не кликаем и не пишем «отправлено».
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, sendCovered: true });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 1, 'пауза вместо ложного успеха');
  assert.match(out.pauses[0].text, /перекрыта плашкой/, 'причина названа');
  assert.ok(!out.clicks.includes("send"), 'по перекрытой кнопке не кликали');
  assert.equal(out.sets.get("cfn-pending"), undefined, 'задание осталось в очереди');
  assert.ok(!out.logs.some((l) => l.text === "Задание отправлено."), 'ложного «отправлено» нет');
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
  await api.consumePending(true);
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь очищена в любом случае');
  assert.equal(out.sets.get("cfn-expect"), undefined, 'чужое ожидание не снимается с этой страницы');
}

// 6.6. Чужое задание не трогаем.
{
  const { api, out } = load({ pending: { ...pending, roleId: "kernel" }, editor: null, send: true });
  assert.equal(await api.consumePending(true), false, 'чужой ход не наш');
  assert.equal(out.logs.length, 0, 'и журнал не засоряется');
}

console.log("OK: narthex 1.4.6 — «Шаг» с любой страницы, чат освобождается от плашки и Skip, каждый отказ объяснён");
