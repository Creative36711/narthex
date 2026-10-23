// Проба 1.4.23: клики не уходят в сайдбар, а вставка не «удаётся» в мёртвый узел.
//
// Что случилось 23.10 в 22:02 (лог Мастера + консоль браузера):
//   1) после перехода на страницу Kernel Arena заменила узел поля ввода новым;
//   2) `writePrompt` ставил выделение в отвязанный узел — консоль:
//      «addRange(): The given range isn't in document», а запасной путь
//      «присвоить textContent» писал текст в копию и возвращал успех;
//   3) в настоящем поле было пусто, значит кнопка Send осталась серой;
//   4) `sendButton` не нашла Send и брала «первую доступную кнопку в родителе
//      редактора» — ею оказалась кнопка аккаунта в сайдбаре;
//   5) три клика ушли в аккаунт (пауза: кнопка «kreative36711@gmail.com»).
//
// Здесь проверяется поведением: кнопка аккаунта не выбирается никогда,
// а вставка в отвязанный узел не считается успехом.

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const src = readFileSync(new URL('../narthex.user.js', import.meta.url), 'utf8');

const cut = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a > 0 && b > a, `фрагмент на месте: ${from.trim().slice(0, 40)}`);
  return src.slice(a, b);
};

// ── Утилиты, без которых фрагмент не исполнить ────────────────────────────
const visible = () => true;
const completionPanels = () => [];
const ui = { panel: 'cfn-panel' };

const sendSrc = cut('  /** Свой пульт ScriptCat', '  function writePrompt(');

/** Мини-элемент: важны только те методы, которые трогает sendButton. */
const el = ({ label = '', text = '', rect, inPanel = false, disabled = false, tag = 'BUTTON' } = {}) => ({
  tagName: tag,
  isConnected: true,
  disabled,
  getAttribute: (name) => ({ 'aria-label': label || null, type: 'button' })[name] ?? null,
  getBoundingClientRect: () => rect,
  closest: (sel) => (inPanel && sel.includes('cfn-panel') ? { id: 'cfn-panel' } : null),
  contains: () => false,
  textContent: text,
});

const makePage = (buttons, editor) => {
  const api = new Function(
    'document', 'visible', 'completionPanels', 'ui',
    `${sendSrc}; return { sendButton, composerAlive, isNearComposer };`,
  )({ querySelectorAll: () => buttons, contains: (node) => node?.alive !== false }, visible, completionPanels, ui);
  return { ...api, editor };
};

// Поле ввода: x 340..1060, y 700..760 — как в чате Arena на широком экране.
const editorRect = { left: 340, top: 700, width: 720, height: 60 };
const editor = el({ rect: editorRect, text: '', tag: 'DIV' });

// Кнопка Send — в правом нижнем углу поля.
const sendRect = { left: 1020, top: 720, width: 28, height: 28 };

// ── 1. Настоящая Send рядом с полем — выбирается она ─────────────────────
{
  const send = el({ label: 'Send', rect: sendRect });
  const account = el({ label: 'kreative36711@gmail.com', rect: { left: 10, top: 640, width: 220, height: 40 } });
  const page = makePage([account, send], editor);
  assert.equal(page.sendButton(editor), send, 'выбрана кнопка отправки, а не аккаунт');
}

// ── 2. Send нет вовсе: кнопка аккаунта не выбирается даже как запасной путь ──
{
  // Ровно тот случай 23.10: поле есть, Send серый (его нет в списке доступных),
  // а в сайдбаре висит аккаунт Мастера.
  const account = el({ label: 'kreative36711@gmail.com', rect: { left: 10, top: 640, width: 220, height: 40 } });
  const collapse = el({ label: 'Collapse sidebar', rect: { left: 10, top: 60, width: 32, height: 32 } });
  const page = makePage([account, collapse], editor);
  assert.equal(page.sendButton(editor), null, 'без Send скрипт не нажимает ничего');
}

// ── 3. Подпись аккаунта не проходит даже как «точная» ────────────────────
{
  const account = el({ label: 'kreative36711@gmail.com', rect: sendRect });
  const page = makePage([account], editor);
  assert.equal(page.sendButton(editor), null, 'даже рядом с полем аккаунт не считается Send');
}

// ── 4. «Send feedback» внизу далеко от поля — не Send ────────────────────
{
  const feedback = el({ label: 'Send feedback', rect: { left: 340, top: 1100, width: 140, height: 32 } });
  const page = makePage([feedback], editor);
  assert.equal(page.sendButton(editor), null, 'далёкая кнопка с похожей подписью не нажимается');
}

// ── 5. Нестандартная раскладка: единственная точная Send в документе ─────
{
  const far = el({ label: 'Send', rect: { left: 2000, top: 40, width: 40, height: 24 } });
  const page = makePage([far], editor);
  assert.equal(page.sendButton(editor), far, 'если Send одна и подпись точная — она и берётся');
}

// ── 6. Кнопки своего пульта ScriptCat не нажимаются ─────────────────────
{
  const own = el({ label: 'Send', rect: sendRect, inPanel: true });
  const page = makePage([own], editor);
  assert.equal(page.sendButton(editor), null, 'кнопки панели ScriptCat не участвуют');
}

// ── 7. Выключенная Send (пустое поле) не выбирается ─────────────────────
{
  const disabled = el({ label: 'Send', rect: sendRect, disabled: true });
  const page = makePage([disabled], editor);
  assert.equal(page.sendButton(editor), null, 'серая кнопка — не кнопка');
}

// ── 8. Отвязанный редактор: Send не ищется вовсе ────────────────────────
{
  const send = el({ label: 'Send', rect: sendRect });
  const page = makePage([send], editor);
  const detached = { ...el({ rect: editorRect, tag: 'DIV' }), isConnected: false };
  assert.equal(page.sendButton(detached), null, 'для мёртвого поля кнопку не ищем');
}

// ── 9. writePrompt: отвязанный узел не даёт успеха ──────────────────────
// composer() в пробе не нужен: его роль играет подставленная функция.
const writeSrc =
  cut('  function composerAlive(', '  function composer() {') +
  cut('  function writePrompt(', '  const composerText =');
const composerTextCode = src.slice(src.indexOf('  const composerText ='), src.indexOf('\n', src.indexOf('  const composerText =')) + 1);

function makeWriter({ detached = false, noComposer = false, execWorks = false } = {}) {
  const calls = { exec: 0, focus: [] };
  const node = (name) => ({
    name,
    tagName: "DIV",
    isConnected: true,
    innerText: "",
    textContent: "",
    focus() {
      calls.focus.push(name);
    },
    dispatchEvent() {},
  });
  const live = node("live");
  const dead = detached ? { ...node("dead"), isConnected: false } : null;
  const document = {
    contains: (n) => Boolean(n) && n.isConnected !== false,
    createRange: () => ({ selectNodeContents() {} }),
    execCommand: (_cmd, _ui, text) => {
      calls.exec += 1;
      if (!execWorks) return false;
      // Как настоящий insertText: текст попадает в сфокусированное поле.
      live.innerText = text;
      live.textContent = text;
      return true;
    },
  };
  const window = { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) };
  const api = new Function(
    "document", "window", "composer", "visible", "ui", "dbg", "log",
    "InputEvent", "HTMLTextAreaElement", "HTMLInputElement",
    `${writeSrc}\n${composerTextCode}; return { writePrompt, composerAlive };`,
  )(
    document, window, () => (noComposer ? null : live), visible, ui, () => {}, () => {},
    function (t, i) { return { type: t, ...i }; }, function () {}, function () {},
  );
  return { api, live, dead, calls };
}

// 9.1. Поле подменили: текст уходит в живое, а не в отвязанную копию.
{
  const { api, live, dead, calls } = makeWriter({ detached: true, execWorks: true });
  assert.equal(api.writePrompt(dead, "ЗАДАНИЕ"), true, "вставка удалась в перечитанное поле");
  assert.equal(calls.focus.at(-1), "live", "фокус достался живому полю");
  assert.equal(dead.textContent, "", "в отвязанный узел текст не пишем");
  assert.equal(live.innerText, "ЗАДАНИЕ", "текст в живом поле");
}

// 9.2. Живого поля нет: честный отказ вместо «успеха» в мёртвом узле.
{
  const { api, dead } = makeWriter({ detached: true, noComposer: true, execWorks: true });
  assert.equal(api.writePrompt(dead, "ЗАДАНИЕ"), false, "без живого поля вставка не удалась");
  assert.equal(dead.textContent, "", "и в мёртвый узел ничего не записано");
}

// 9.3. execCommand недоступен — запасной textContent, но только в живой узел.
{
  const { api, live } = makeWriter({ detached: false, execWorks: false });
  assert.equal(api.writePrompt(live, "ЗАДАНИЕ"), true, "вставка через textContent");
  assert.equal(live.textContent, "ЗАДАНИЕ", "текст записан в живое поле");
}

// 9.4. Мёртвый узел так и остаётся мёртвым — composerAlive это видит.
{
  const { api, dead } = makeWriter({ detached: true, execWorks: true });
  assert.equal(api.composerAlive(dead), false, "отвязанный узел распознан");
  assert.equal(api.composerAlive({ isConnected: true }), true, "узел без document.contains считается живым");
}

// ── 10. В исходнике не осталось опасного запасного пути ─────────────────
assert.ok(
  !/parentElement\?\.querySelectorAll\?\.\('button/.test(src),
  '«первая попавшаяся кнопка в родителе редактора» удалена',
);
assert.match(src, /isNearComposer\(b, editor\)/, 'своя кнопка — та, что рядом с полем');
assert.match(src, /plain\.length === 1 \? plain\[0\] : null/, 'последняя попытка — только единственная точная Send');

console.log('OK: narthex 1.4.23 — клики не уходят в сайдбар, вставка не «удаётся» в отвязанный узел');
