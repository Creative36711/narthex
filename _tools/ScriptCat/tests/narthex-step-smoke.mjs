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
assert.match(src, /@version\s+1\.4\.31/, 'версия 1.4.31');

const tickStart = src.indexOf('async function tick(');
const tickBody = src.slice(tickStart, src.indexOf('// ───────────────────────────── старт', tickStart));
assert.match(tickBody, /const pending = GM_getValue\(K\.pending, null\);/, 'тик знает про очередь');
assert.match(tickBody, /if \(!auto && !fromToggle && !pending && !waiting\) return;/, 'незавершённая отправка и остаток ожидания важнее автоцикла');
assert.match(tickBody, /Date\.now\(\) - busyAt < 120000/, 'залипший шаг снимается через две минуты');
assert.match(tickBody, /Шаг уже выполняется/, 'повторное нажатие объясняется, а не молчит');
assert.match(tickBody, /else if \(!expect\)/, 'исполнитель без задания не падает в TypeError');
assert.match(tickBody, /submitExecutor\(me, expect, fromToggle\)/, 'ручной режим передаётся исполнителю');
assert.match(src, /async function markerMissing\(role, expect, markerName, manual = false, why = ""\)/, 'ожидание маркера знает про ручной шаг');
assert.match(src, /Жду ответ \$\{role.name\}: новых сообщений нет/, 'ручной шаг объясняет ожидание');

// 1.1. «Шаг» работает с любой страницы: сам открывает нужную роль.
const rootBlock = tickBody.slice(
  tickBody.indexOf('const meId = roleFromPath();'),
  tickBody.indexOf('const me = list.find(', tickBody.indexOf('const meId')),
);
assert.match(rootBlock, /if \(!fromToggle && !autoOn\(\)\) return;/, 'в ручном фоне без нажатия страницу не открываем');
assert.match(rootBlock, /r\.fn === "Coordinator"/, 'Координатор — запасной адрес, если работы нигде не ждут');
assert.match(rootBlock, /const target = pendingRole \|\| waitingRole \|\| coord;/, 'сначала адресат очереди, потом тот, чей ответ ждём');
assert.match(rootBlock, /if \(!pendingNow && fromToggle\) GM_setValue\(K\.step, true\);/, 'шаг запоминается на один переход');
assert.match(rootBlock, /return navigateTo\(target, why\);/, 'открываем нужную страницу сами');
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
assert.match(sendBlock, /const SEND_LABEL = \/\^\(send\|submit\|отправ/, 'подпись Send ищется и по-русски, и только с начала подписи');
assert.match(sendBlock, /const STOP_LABEL =/, 'кнопка остановки не путается с отправкой');
assert.match(sendBlock, /const box = composerBox\(editor\);/, 'область поиска кнопки — панель ввода, а не документ');
assert.match(sendBlock, /aria-disabled/, 'заблокированная кнопка не считается');
assert.match(sendBlock, /function writePrompt\(editor, text, attempt = 1\)/, 'вставка текста отдельной функцией');
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
assert.match(sendBlock, /if \(closed >= 2\) break;/, 'клик-шторм ограничен: не больше двух закрытий');
assert.match(sendBlock, /if \(editor\) return \{ editor, closed, overlay: false \};/, 'карточку не трогаем, если поле ввода есть');
assert.ok(!/composerCovered/.test(src), 'проверка «накрыт» больше не блокирует ввод');
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
assert.match(cpBody, /const delivery = await deliver\(editor, pending\.text\);/, 'отправка проверяется');
assert.match(cpBody, /if \(!delivery\.ok\)/, 'неудачная отправка — пауза, а не «отправлено»');
assert.match(sendBlock, /async function deliver\(editor, text\)/, 'доставка отдельной функцией');
assert.match(sendBlock, /async function waitForSendReady\(editor, timeoutMs = 4000\)/, 'ждём активную кнопку Send');
assert.match(sendBlock, /активной кнопки Send нет/, 'неактивная кнопка называется причиной');
assert.match(sendBlock, /function sendDiagnostics\(editor\)/, 'при отказе печатаются кандидаты в кнопку Send');
assert.match(sendBlock, /const inPanel = \(b\) => panels\.some/, 'кнопки карточки не считаются Send');
assert.match(sendBlock, /isNearComposer\(b, editor\)/, 'Send обязан быть рядом с редактором');
assert.match(sendBlock, /const nearField = controls\.filter\(\(b\) => \{/, 'без подписи кнопка определяется по месту');
assert.match(sendBlock, /if \(siblings\.length !== 1\) return false;/, 'кнопка должна стоять одна в своей группе');
assert.match(sendBlock, /holder !== holder\.parentElement\?\.lastElementChild/, 'группа должна быть последней в ряду');
assert.match(sendBlock, /return nearField\.at\(-1\) \|\| null;/, 'если ни одна не подошла — пауза, а не догадка');
assert.ok(
  !/parentElement\?\.querySelectorAll/.test(sendBlock),
  'запасного пути «первая попавшаяся кнопка в родителе» больше нет',
);
assert.match(
  sendBlock,
  /if \(!inserted && composerAlive\(live\)\) \{/,
  'textContent — только запасной путь и только в живой узел',
);
assert.match(sendBlock, /composerAlive\(live\) \? composerText\(live\)\.length : 0/, 'отвязанный узел не считается успехом');
assert.match(sendBlock, /via: inserted \? "execCommand" : "textContent"/, 'путь вставки виден в отладке');
assert.match(sendBlock, /waitSent\(key, before, C\.sendVerifyMs\)/, 'доставка подтверждается сообщением в чате');
assert.match(sendBlock, /if \(lastUserSays\(key\)\) return \{ ok: true, via: "message" \};/, 'своё сообщение — первый признак доставки');
assert.match(sendBlock, /своё сообщение в чате не появилось/, 'ложное «отправлено» исключено');
assert.match(cpBody, /setTimeout\(\(\) => tick\(false\), 5000\)/, 'без редактора шаг повторится сам');

// 4.1. Отладка в консоль браузера: включается, переживает переходы, объясняет.
assert.match(src, /debug: "cfn-debug"/, 'флаг отладки хранится в ScriptCat');
assert.match(src, /const debugOn = \(\) => \{/, 'отладка включается по флагу или ?cfn-debug');
assert.match(src, /searchParams\.has\("cfn-debug"\)/, 'параметр ?cfn-debug работает');
assert.match(src, /function dbg\(step, data\)/, 'подробный лог в консоль');
assert.match(src, /console\.log\(line, payload\)/, 'в консоль идут данные, а не только текст');
assert.match(src, /if \(typeof data === "function"\)/, 'снимок считается только при включённой отладке');
assert.match(src, /function debugSnapshot\(\)/, 'снимок состояния для консоли');
assert.match(src, /__narthex = debugApi/, 'в консоли доступен пульт __narthex');
assert.match(src, /state: \(\) => debugSnapshot\(\)/, '__narthex.state()');
assert.match(src, /step: \(\) => tick\(true\)/, '__narthex.step()');
assert.match(src, /resend: \(\) => \{/, '__narthex.resend() — вернуть задание в очередь');
assert.match(src, /id="\$\{ui\.debug\}"/, 'кнопка 🐞 в панели');
assert.match(src, /Отладка включена: подробности идут в консоль браузера/, 'включение объяснено в журнале');
assert.match(src, /function debugSendButton\(editor\)/, 'отладка показывает кнопку Send: найдена, активна, перекрыта');

// 4.2. Неподтверждённая отправка возвращается в очередь, а не ждёт вечно.
assert.match(src, /function reviveUnverifiedHandoff\(\)/, 'есть возврат неподтверждённой отправки');
assert.match(src, /if \(!waiting \|\| !Number\(waiting\.sentAt\) \|\| waiting\.verified === true\) return "";/, 'проверяется отметка verified');
assert.match(src, /return "revived";/, 'отправленное заново возвращается в очередь');
assert.match(src, /return "dropped";/, 'фантом без текста снимается отдельно');
assert.match(src, /messagesAfter\(waiting\.watermark \|\| ""\)\.length/, 'дубль исключён: смотрим сообщения после водяного знака');
assert.match(src, /GM_setValue\(K\.pending, \{\s*roleId: waiting\.roleId,[\s\S]{0,120}?text,\s*at: Date\.now\(\),\s*\}\)/, 'задание возвращается в очередь с адресом роли');
assert.match(src, /не подтверждена \(сообщение в чате не появилось\)/, 'причина видна в журнале');
assert.match(tickBody, /reviveUnverifiedHandoff\(\);/, 'тик вызывает возврат до отправки');

// 5. Ожидание без отправки не считается ходом.
assert.match(tickBody, /if \(expect && !Number\(expect\.sentAt\)\)/, 'ожидание без отправки не считается ходом');
const noSendBlock = tickBody.slice(tickBody.indexOf('!Number(expect.sentAt)'), tickBody.indexOf('const waited'));
assert.match(noSendBlock, /GM_setValue\(K\.expect, null\);/, 'ожидание снимается');
assert.match(noSendBlock, /GM_setValue\("cfn-plan-at", 0\);/, 'троттлинг плана сбрасывается');
assert.match(noSendBlock, /снимаю ожидание и начинаю ход заново/, 'причина видна в журнале');
assert.match(noSendBlock, /expect = null;/, 'шаг продолжается без ожидания');
assert.match(src, /watermark, sentAt: Date\.now\(\), verified: true/, 'отметка ставится только после подтверждённой доставки');
assert.match(src, /pendingTtlMs: 600000/, 'TTL очереди в конфиге');
assert.match(src, /replyWaitMs: 1800000/, 'предел ожидания ответа в конфиге');
assert.match(src, /function dropHandoff\(reason\)/, 'зависшая передача снимается целиком');
assert.match(tickBody, /dropHandoff\(/, 'молчание агента ставит паузу');
assert.match(src, /async function releaseUndelivered\(expect, why\)/, 'недошедший ход возвращает карточку в Ready');
assert.match(cpBody, /await releaseUndelivered\(/, 'отказ отправки и просрочка снимают Running');
assert.match(tickBody, /await releaseUndelivered\(stuck/, 'молчание агента снимает Running, а не ждёт 45 минут');

// 6. Поведение: мини-DOM и заглушки вместо браузера.
const load = ({ pending, editor, send, panels = [], stop = false, now = 1_000_000, expect = null, skip = false, overlay = false, stickyOverlay = false, sendCovered = false, deadSend = false, disabledSend = false, rollback = false, captcha = false, captchaAfterClick = false, sentAlready = false }) => {
  const out = { logs: [], sets: new Map(), pauses: [], clicks: [], timers: [], rollback: { calls: [], result: rollback } };
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
  // Свои сообщения в транскрипте: 1.4.20 подтверждает доставку именно ими.
  const sent = sentAlready ? [{ textContent: pending?.text || "", closest: () => null }] : [];
  // Кнопка Send стоит вплотную к полю ввода — как в жизни. Раньше стаб
  // ставил её в стороне, и это скрывало ошибку «клик ушёл в сайдбар».
  const sendBtn = send ? el("BUTTON", {
    "aria-label": "Send", id: "send", contains: () => false, disabled: disabledSend,
    getBoundingClientRect: () => ({ left: 290, top: 46, width: 24, height: 24 }),
  }) : null;
  if (sendBtn) sendBtn.click = () => {
    out.clicks.push("send");
    if (deadSend) return; // клик по кнопке ничего не делает — как в жизни при «сером» Send
    if (editor) {
      sent.push({ textContent: editor.innerText || editor.textContent || "", closest: () => null });
      editor.innerText = "";
      editor.textContent = "";
    }
  };
  // 1.4.25: кнопка отправки ищется только внутри панели ввода, поэтому у
  // редактора должна быть цепочка предков. Панель — ближайший предок с
  // кнопками, как `div.bg-surface-secondary…rounded-b-none` в живой разметке.
  const box = el("DIV", { id: "composer-box", querySelectorAll: () => (sendBtn ? [sendBtn] : []) });
  if (editor) editor.parentElement = box;
  const messages = [];
  if (skip) {
    const skipBtn = el("BUTTON", { text: "Skip", id: "skip" });
    skipBtn.click = () => { out.clicks.push("skip"); messages.length = 0; };
    messages.push({ querySelectorAll: () => (messages.length ? [skipBtn] : []) });
  }
  // 1.4.31: окно проверки. `captcha` — видна сразу, `captchaAfterClick` —
  // появляется, как в жизни: после клика по Send, вместо отправки.
  const captchaNow = () => captcha || (captchaAfterClick && sent.length > 0);
  const captchaEl = captcha || captchaAfterClick
    ? {
        isConnected: true,
        textContent: "Security Verification",
        getClientRects: () => [{}],
        querySelector: (sel) => (sel.includes("recaptcha") ? { found: true } : null),
        contains: () => false,
        closest: () => null,
      }
    : null;
  const document = {
    querySelector: (sel) => (sel.includes("contenteditable") ? editor : null),
    querySelectorAll: (sel) => {
      if (sel.includes('role="dialog"')) return captchaNow() ? [captchaEl] : [];
      if (sel.includes("data-user-message-layout")) return sent;
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
    "setStatus", "log", "pause", "releaseUndelivered", "sleep", "tick", "location", "document", "window",
    "getComputedStyle", "Date", "setTimeout", "HTMLTextAreaElement", "HTMLInputElement", "InputEvent",
    "generating", "messages", "C", "dbg", "debugSendButton", "describe", "autoOn", "flat", "ui",
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
    async (gone, why) => {
      out.rollback.calls.push({ expect: gone, why });
      return out.rollback.result;
    },
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
    { maxLog: 200, pendingTtlMs: 600000, replyWaitMs: 1800000, sendVerifyMs: 6000 },
    () => {},
    (ed) => ({ found: Boolean(ed), covered: sendCovered }),
    (el) => (el ? String(el.tagName || "?").toLowerCase() : "нет"),
    () => false,
    (x) => String(x || "").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase(),
    { panel: "cfn-panel" },
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
  assert.ok(!out.logs.some((l) => /Убрал плашку/.test(l.text)), 'карточка не трогается, если поле ввода есть: нет мигания');
  assert.deepEqual(out.clicks, ["send"], 'задание ушло');
}

// 6.2b. Карточка с кнопкой Skip тоже освобождает чат.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, skip: true, overlay: true });
  await api.consumePending(true);
  assert.ok(!out.clicks.includes("skip"), 'карточка Skip не трогается, если поле ввода есть');
  assert.equal(out.clicks.at(-1), "send", 'задание отправлено');
}

// 6.2c. Редактор накрыт карточкой, но поле и Send доступны: пишем и отправляем.
//      Программный ввод и click() оверлей не замечают — блокировать нечего.
{
  const editor = freshEditor();
  editor.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 40 });
  editor.contains = () => false;
  const { api, out } = load({ pending, editor, send: true, overlay: true, stickyOverlay: true });
  await api.consumePending(true);
  assert.equal(out.sets.get("cfn-pending"), null, 'задание отправлено, несмотря на карточку');
  assert.deepEqual(out.clicks, ["send"], 'клик по Send сделан');
  assert.equal(out.pauses.length, 0, 'лишней паузы нет');
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
  assert.match(out.pauses[0].text, /Кнопка Send неактивна или не найдена/);
  assert.match(out.pauses[0].text, /в поле \d+ симв/, 'пауза объясняет, что видно на странице');
  assert.match(out.pauses[0].text, /кнопка не найдена/, 'видно, что кнопки Send нет');
}

// 6.5a. В редакторе был текст — заменяем и отправляем, без ложной паузы.
{
  const { api, out } = load({ pending, editor: freshEditor("черновик Мастера"), send: true });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 0, 'паузы из-за текста больше нет');
  assert.deepEqual(out.clicks, ["send"], 'задание отправлено');
  assert.ok(out.logs.some((l) => /заменяю его заданием из очереди/.test(l.text)), 'замена отмечена в журнале');
}

// 6.5a2. Send остаётся серым: редактор не принял ввод — пауза с точной причиной.
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, disabledSend: true });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 1, 'пауза');
  assert.match(out.pauses[0].text, /неактивна или не найдена/, 'сказано, что кнопка неактивна');
  assert.deepEqual(out.clicks, [], 'по серой кнопке не кликали');
  assert.equal(out.sets.get("cfn-pending"), undefined, 'задание осталось в очереди');
}

// 6.5b. Клик по Send не сработал: три попытки, затем пауза без ложного «отправлено».
{
  const { api, out } = load({ pending, editor: freshEditor(), send: true, deadSend: true });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 1, 'пауза вместо ложного успеха');
  assert.match(out.pauses[0].text, /своё сообщение в чате не появилось/, 'причина названа');
  assert.match(out.pauses[0].text, /клик 3 без следа/, 'видно, сколько кликов не дало следа');
  assert.equal(out.clicks.filter((c) => c === "send").length, 3, 'было три попытки, ни одна не помогла');
  assert.ok(!out.logs.some((l) => l.text === "Задание отправлено."), 'ложного «отправлено» нет');
  assert.equal(out.sets.get("cfn-pending"), undefined, 'задание осталось в очереди');
}

// 6.5c. Отправка не удалась, карточка возвращена в Ready: очередь и ожидание
//      снимаются вместе со статусом — иначе ответ пришёл бы в карточку, которая
//      уже не Running, и `submitExecutor` отказался бы его записывать.
{
  const { api, out } = load({
    pending,
    editor: freshEditor(),
    send: true,
    deadSend: true,
    expect: { roleId: "coordinator", kind: "dispatch", ref: "c1" },
    rollback: true,
  });
  await api.consumePending(true);
  assert.equal(out.rollback.calls.length, 1, 'неудачная отправка снимает статус карточки');
  assert.match(out.rollback.calls[0].why, /сообщение не ушло/, 'причина записана в журнал попытки');
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь снята вместе со статусом');
  assert.equal(out.sets.get("cfn-expect"), null, 'ожидание снято тоже');
  assert.equal(out.pauses.length, 1, 'пауза остаётся: без Мастера цикл не идёт');
  assert.match(out.pauses[0].text, /карточка возвращена в Ready/, 'Мастеру сказано, что карточку выдадут заново');
  assert.ok(!out.logs.some((l) => l.text === "Задание отправлено."), 'ложного «отправлено» нет');
}

// 6.5d. Капча поверх чата: ничего не нажимаем, задание остаётся в очереди.
{
  const { api, out } = load({
    pending,
    editor: freshEditor(),
    send: true,
    captcha: true,
    expect: { roleId: "coordinator", kind: "plan" },
  });
  await api.consumePending(true);
  assert.equal(out.pauses.length, 1, 'пауза вместо отправки');
  assert.match(out.pauses[0].text, /капча \(Security Verification\)/, 'причина названа прямо');
  assert.match(out.pauses[0].text, /Решите её и нажмите «Продолжить»/, 'Мастеру сказано, что делать');
  assert.equal(out.pauses[0].ctx.notifyTitle, "Narthex: капча — нужен человек", 'пуш отличается от обычной паузы');
  assert.deepEqual(out.clicks, [], 'по Send не кликали');
  assert.equal(out.sets.get("cfn-pending"), undefined, 'задание осталось в очереди');
  assert.equal(out.sets.get("cfn-expect"), undefined, 'ожидание не тронуто');
}

// 6.5d2. Капча появилась вместо отправки: откат отметки, а не ложное «отправлено».
{
  const { api, out } = load({
    pending,
    editor: freshEditor(),
    send: true,
    captchaAfterClick: true,
    expect: { roleId: "coordinator", kind: "dispatch", ref: "c1", sentAt: 999_000, verified: true },
  });
  await api.consumePending(true);
  const saved = out.sets.get("cfn-expect");
  assert.equal(saved?.sentAt, null, 'отметка «отправлено» снята — это и есть откат');
  assert.equal(saved?.verified, false, 'подтверждение доставки снято');
  assert.equal(saved?.captcha, true, 'видно, почему ход стоит');
  assert.equal(out.rollback.calls.length, 0, 'карточка остаётся Running: ход ждёт человека, а не потерян');
  assert.ok(!out.logs.some((l) => l.text === "Задание отправлено."), 'ложного «отправлено» нет');
}

// 6.5d3. Капчу решили, сообщение всё-таки в чате: не дублируем, ждём ответа.
{
  const carried = { ...pending, captcha: true, at: 999_000 };
  const { api, out } = load({
    pending: carried,
    editor: freshEditor(),
    send: true,
    sentAlready: true,
    expect: { roleId: "coordinator", kind: "plan", captcha: true },
  });
  assert.equal(await api.consumePending(true), true, 'шаг занят ожиданием ответа');
  assert.equal(out.sets.get("cfn-pending"), null, 'очередь снята');
  const saved = out.sets.get("cfn-expect");
  assert.equal(typeof saved?.sentAt, "number", 'теперь доставка подтверждена');
  assert.equal(saved?.captcha, false, 'признак капчи снят');
  assert.deepEqual(out.clicks, [], 'повторной отправки нет');
  assert.ok(out.logs.some((l) => /После капчи сообщение уже в чате/.test(l.text)), 'видно, почему не отправили заново');
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

// 6.5.1a. Просрочка снимает и статус карточки: хода не было ни разу.
{
  const old = { ...pending, at: 1_000_000 - 11 * 60 * 1000 };
  const { api, out } = load({
    pending: old,
    editor: null,
    send: true,
    expect: { roleId: "coordinator", kind: "dispatch", ref: "c1", at: old.at },
    rollback: true,
  });
  await api.consumePending(true);
  assert.equal(out.rollback.calls.length, 1, 'просроченная отправка возвращает карточку в Ready');
  assert.match(out.rollback.calls[0].why, /просрочена/, 'причина названа');
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

console.log("OK: narthex 1.4.31 — «Шаг» с любой страницы, чат освобождается от плашки и Skip, каждый отказ объяснён");
