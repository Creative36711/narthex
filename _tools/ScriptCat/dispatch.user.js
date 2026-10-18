// ==UserScript==
// @name         Chronicle Forge — открыть следующего агента
// @namespace    https://arena.ai/
// @version      0.13.26
// @description  Role-aware Arena handoff with a marker-gated Coordinator cycle, FIFO queue, and master alerts.
// @match        https://arena.ai/*
// @match        https://www.arena.ai/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.notion.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      ntfy.sh
// ==/UserScript==

(() => {
  "use strict";
  const C = {
    notionV: "2025-09-03",
    req: "066d95b6-133c-4aa8-b844-68c8954f08f5",
    roles: "acfb8573-10fc-48f7-b57a-d3a41dd697e7",
    campaigns: "6a7900f1-4ba9-432e-9992-efa548b48b1a",
    milestonePolicyUrl: "https://app.notion.com/p/3fa6f0cf570581539319ea07a41e3dd5",
    runLogFolder: "19ljf2TgeDg6j-jIamGira8K8_2NjC1BT",
    button: "cf-open-next-agent",
    modeButton: "cf-automation-mode",
    coordinatorResetButton: "cf-coordinator-reset-limit",
    manualModeButton: "cf-manual-mode-exit",
    ntfyButton: "cf-ntfy-settings",
    ntfyTopic: "cf-ntfy-topic",
    ntfyToken: "cf-ntfy-token",
    console: "cf-dispatch-console",
    consoleActions: "cf-dispatch-console-actions",
    consoleLogs: "cf-dispatch-console-logs",
    consoleStatus: "cf-dispatch-console-status",
    consoleFold: "cf-dispatch-console-fold",
    logHistory: "cf-dispatch-console-history",
    collapsed: "cf-dispatch-console-collapsed",
    lock: "cf-dispatch-in-progress",
    lockOwner: "cf-dispatch-in-progress-owner",
    autoMode: "cf-automation-enabled",
    autoPaused: "cf-automation-paused",
    pendingPrompt: "cf-pending-agent-prompt",
    manualPrepared: "cf-manual-prepared-run",
    pendingCoordinatorNote: "cf-pending-coordinator-note",
    pendingCoordinatorTurn: "cf-pending-coordinator-turn",
    coordinatorNeedsAdoption: "cf-coordinator-needs-turn-adoption",
    pendingDispatch: "cf-pending-dispatch-intent",
    sendCountPrefix: "cf-auto-send-count:",
    reloadCountPrefix: "cf-auto-error-reload-count:",
    autoPauseContext: "cf-automation-pause-context",
  };
  const AUTO = { maxSends: 2, noStartMs: 90000, idleMs: 18000, coordinatorMarkerRetries: 2 };
  const rt = (p) =>
    (p?.rich_text || p?.title || [])
      .map((x) => x.plain_text || x.text?.content || "")
      .join("");
  const sel = (p) => p?.select?.name || "",
    norm = (x) =>
      String(x || "")
        .replace(/-/g, "")
        .toLowerCase();
  const title = (p) => rt(p?.properties?.["Запрос"]),
    state = (p) => sel(p?.properties?.["Dispatch State"]),
    runId = (p) => rt(p?.properties?.["Run ID"]),
    recipient = (p) => rt(p?.properties?.["Recipient Agent ID"]),
    recipientRole = (p) => sel(p?.properties?.["Кому"]),
    payloadId = (p) => rt(p?.properties?.["Payload Drive File ID"]),
    payloadUrl = (p) => p?.properties?.["Payload Drive URL"]?.url || "",
    outputId = (p) => rt(p?.properties?.["Output Drive File ID"]);
  let consoleEntries = [];
  const consoleDiagnostics = new Map();
  let consoleCollapsed = false;
  let historyWrite = Promise.resolve();
  function renderConsoleLogs() {
    const list = document.getElementById(C.consoleLogs);
    if (!list) return;
    list.replaceChildren();
    if (!consoleEntries.length) {
      const empty = document.createElement("div");
      empty.textContent = "Здесь будут этапы передачи и ошибки.";
      empty.style.cssText = "color:#aeb9b3;padding:8px;font:12px/1.4 system-ui";
      list.appendChild(empty);
      return;
    }
    for (const entry of consoleEntries.slice(-60)) {
      const row = document.createElement("div");
      row.style.cssText = entry.error
        ? "padding:7px 9px;border-bottom:1px solid #ff7b6b40;border-left:3px solid #ff7b6b;background:#4a1f1b88;color:#ffe2dc;font:600 12px/1.4 system-ui;white-space:pre-wrap;overflow-wrap:anywhere"
        : "padding:6px 8px;border-bottom:1px solid #ffffff12;color:#e0e8e3;font:12px/1.4 system-ui;white-space:pre-wrap;overflow-wrap:anywhere";
      const time = new Date(entry.at).toLocaleTimeString();
      row.textContent = `${time}  ${entry.text}`;
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }
  function ensureConsole() {
    if (!document.body) return null;
    let root = document.getElementById(C.console);
    if (root) return root;
    root = document.createElement("section");
    root.id = C.console;
    root.setAttribute("aria-label", "Chronicle Forge — управление и журнал");
    root.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(420px,calc(100vw - 28px));max-height:52vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid #ffffff30;border-radius:14px;background:#17211df5;color:#fff;box-shadow:0 10px 36px #0008;font-family:system-ui,sans-serif;backdrop-filter:blur(12px)";
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid #ffffff1c";
    const brand = document.createElement("strong");
    brand.textContent = "Chronicle Forge";
    brand.style.cssText = "font-size:13px;white-space:nowrap";
    const status = document.createElement("span");
    status.id = C.consoleStatus;
    status.textContent = "Готов";
    status.style.cssText = "min-width:0;flex:1;color:#b7c4bd;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Очистить";
    clear.title = "Очистить журнал";
    clear.style.cssText = "border:0;background:transparent;color:#b7c4bd;padding:4px;cursor:pointer;font:11px system-ui";
    clear.onclick = async () => {
      consoleEntries = [];
      renderConsoleLogs();
      historyWrite = historyWrite.then(() => GM_setValue(C.logHistory, []));
      await historyWrite;
    };
    const fold = document.createElement("button");
    fold.type = "button";
    fold.id = C.consoleFold;
    fold.textContent = "Свернуть";
    fold.style.cssText = "border:0;background:transparent;color:#fff;padding:4px;cursor:pointer;font:11px system-ui";
    fold.onclick = async () => {
      consoleCollapsed = !consoleCollapsed;
      await GM_setValue(C.collapsed, consoleCollapsed);
      applyConsoleCollapsed();
    };
    const ntfy = document.createElement("button");
    ntfy.type = "button";
    ntfy.id = C.ntfyButton;
    ntfy.textContent = "ntfy";
    ntfy.title = "Настроить и проверить бесшумные push-уведомления ntfy.sh";
    ntfy.style.cssText = "border:1px solid #ffffff28;border-radius:6px;background:#263b31;color:#dce8df;padding:4px 6px;cursor:pointer;font:600 11px system-ui";
    ntfy.onclick = () => openNtfySettings();
    header.append(brand, status, ntfy, clear, fold);
    const logs = document.createElement("div");
    logs.id = C.consoleLogs;
    logs.style.cssText = "min-height:38px;max-height:min(34vh,310px);overflow:auto";
    const actions = document.createElement("div");
    actions.id = C.consoleActions;
    actions.style.cssText = "display:flex;gap:8px;padding:8px;border-top:1px solid #ffffff1c";
    root.append(header, logs, actions);
    document.body.appendChild(root);
    renderConsoleLogs();
    applyConsoleCollapsed();
    Promise.resolve(GM_getValue(C.logHistory, [])).then((saved) => {
      if (Array.isArray(saved)) {
        consoleEntries = [...saved, ...consoleEntries].slice(-60);
        renderConsoleLogs();
      }
    }).catch(() => {});
    Promise.resolve(GM_getValue(C.collapsed, false)).then((value) => {
      consoleCollapsed = Boolean(value);
      applyConsoleCollapsed();
    }).catch(() => {});
    return root;
  }
  function applyConsoleCollapsed() {
    const root = document.getElementById(C.console);
    const logs = document.getElementById(C.consoleLogs);
    if (!root || !logs) return;
    logs.style.display = consoleCollapsed ? "none" : "block";
    root.style.maxHeight = consoleCollapsed ? "none" : "52vh";
    const fold = document.getElementById(C.consoleFold);
    if (fold) { fold.textContent = consoleCollapsed ? "Развернуть" : "Свернуть"; fold.title = consoleCollapsed ? "Развернуть журнал" : "Свернуть журнал"; }
  }
  function debugConsole(key, event, details = {}, { level = "info", intervalMs = 30000 } = {}) {
    const now = Date.now();
    const fingerprint = JSON.stringify(details);
    const prior = consoleDiagnostics.get(key);
    if (prior && prior.fingerprint === fingerprint && now - prior.at < intervalMs) return;
    consoleDiagnostics.set(key, { fingerprint, at: now });
    const logger = console[level] || console.info;
    logger.call(console, "[ChronicleForge:diagnostic]", { at: new Date(now).toISOString(), event, ...details });
  }
  const IMPORTANT_QUIET_NTFY_PATTERNS = [
    /^Полная автоматизация включена\./,
    /^Автоматизация (продолжена человеком|возобновлена)/,
    /^Задача «.+» (подготовлена для отправки агенту|отмечена Running)/,
    /^Новая попытка задачи «.+» запущена для /,
    /^Задание (отправлено кнопкой Send|для .+ отправлено нажатием Send)/,
    /^Подготовлена новая попытка:/,
    /^Ответ .+ записан в Dispatch-Run; Notion → Submitted\./,
    /^Ход (Координатора|review) завершён; /,
    /^Координатор исправил preflight-задачу /,
    /^Ответ Координатора по ходу .+ завершился без маркера; автоматически отправляю /,
  ];
  function classifyNtfyPush(text, isError = false, options = {}) {
    if (options?.skipNtfy || options?.ntfy === false) return null;
    const clean = String(text || "").trim();
    if (!clean) return null;
    if (options?.ntfy === "loud" || options?.urgent === true) {
      return {
        level: "loud",
        urgent: true,
        priority: "5",
        tags: "warning,rotating_light",
        title: options?.title || "Chronicle Forge: требуется Мастер",
      };
    }
    if (options?.ntfy === "quiet") {
      return {
        level: "quiet",
        urgent: false,
        priority: "2",
        tags: "memo",
        title: options?.title || "Chronicle Forge",
      };
    }
    if (isError) {
      if (/^Автопередача ждёт:/.test(clean)) return null;
      return {
        level: "loud",
        urgent: true,
        priority: "5",
        tags: "warning,rotating_light",
        title: options?.title || "Chronicle Forge: alert",
      };
    }
    if (IMPORTANT_QUIET_NTFY_PATTERNS.some((pattern) => pattern.test(clean))) {
      return {
        level: "quiet",
        urgent: false,
        priority: "2",
        tags: "memo",
        title: options?.title || "Chronicle Forge",
      };
    }
    return null;
  }
  function logEvent(msg, error = false, options = {}) {
    const isError = Boolean(error);
    const entry = { at: Date.now(), text: String(msg), error: isError };
    consoleEntries.push(entry);
    consoleEntries = consoleEntries.slice(-60);
    const root = ensureConsole();
    renderConsoleLogs();
    const status = document.getElementById(C.consoleStatus);
    if (status) { status.textContent = entry.text; status.title = entry.text; status.style.color = isError ? "#ff9e8d" : "#b7c4bd"; }
    historyWrite = historyWrite.then(async () => {
      const saved = await GM_getValue(C.logHistory, []);
      const history = Array.isArray(saved) ? saved : [];
      await GM_setValue(C.logHistory, [...history, entry].slice(-60));
    }).catch(() => {});
    if (!root) console.info("[Chronicle Forge]", entry.text);
    const ntfyPlan = classifyNtfyPush(entry.text, isError, options);
    if (ntfyPlan) {
      notifyNtfy(entry.text, ntfyPlan);
    }
  }
  function ntfyRequest(topic, token, message, { urgent = false, priority, tags, title = "Chronicle Forge" } = {}) {
    return new Promise((resolve, reject) => {
      const headers = {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Title": title,
        "X-Priority": priority || (urgent ? "5" : "2"),
      };
      if (tags || urgent) headers["X-Tags"] = tags || "warning,rotating_light";
      if (token) headers.Authorization = `Bearer ${token}`;
      GM_xmlhttpRequest({
        method: "POST",
        url: `https://ntfy.sh/${encodeURIComponent(topic)}`,
        headers,
        data: String(message).slice(0, 3500),
        timeout: 10000,
        onload: (response) => response.status >= 200 && response.status < 300
          ? resolve(response)
          : reject(Error(`ntfy вернул HTTP ${response.status}`)),
        onerror: () => reject(Error("Не удалось подключиться к ntfy.sh")),
        ontimeout: () => reject(Error("Время ожидания ntfy.sh истекло")),
      });
    });
  }
  let lastNtfyWarningAt = 0;
  async function notifyNtfy(message, { urgent = false, priority, tags, title } = {}) {
    try {
      const topic = String(await GM_getValue(C.ntfyTopic, "")).trim();
      if (!topic) return;
      const token = String(await GM_getValue(C.ntfyToken, "")).trim();
      await ntfyRequest(topic, token, message, { urgent, priority, tags, title: title || "Chronicle Forge" });
    } catch (error) {
      // Do not call logEvent here: delivery errors must not recurse into ntfy.
      if (Date.now() - lastNtfyWarningAt > 60000) {
        lastNtfyWarningAt = Date.now();
        console.warn("[Chronicle Forge ntfy]", error?.message || error);
      }
    }
  }
  let alertAudioContext = null;
  function prepareMasterAlertAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      alertAudioContext ||= new AudioCtx();
      if (alertAudioContext.state === "suspended") void alertAudioContext.resume().catch(() => {});
    } catch (error) {
      console.warn("[Chronicle Forge audio setup]", error);
    }
  }
  function playMasterAlert() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const context = alertAudioContext || (alertAudioContext = new AudioCtx());
      const play = () => {
        const start = context.currentTime + 0.03;
        [880, 660, 880].forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const at = start + index * 0.22;
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.18, at + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(at);
          oscillator.stop(at + 0.18);
        });
      };
      if (context.state === "suspended") context.resume().then(play).catch(() => {});
      else play();
    } catch (error) {
      console.warn("[Chronicle Forge audio alert]", error);
    }
  }
  async function openNtfySettings() {
    const existing = document.getElementById(`${C.ntfyButton}-dialog`);
    existing?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = `${C.ntfyButton}-dialog`;
    dialog.style.cssText = "width:min(440px,calc(100vw - 32px));border:1px solid #ffffff35;border-radius:14px;padding:18px;background:#17211d;color:#fff;font:13px/1.45 system-ui;box-shadow:0 12px 48px #000a";
    const topic = document.createElement("input");
    topic.type = "text";
    topic.autocomplete = "off";
    topic.placeholder = "случайное-имя-топика";
    topic.value = String(await GM_getValue(C.ntfyTopic, ""));
    const token = document.createElement("input");
    token.type = "password";
    token.autocomplete = "new-password";
    token.placeholder = "Необязательно: Bearer token";
    token.value = String(await GM_getValue(C.ntfyToken, ""));
    for (const input of [topic, token]) input.style.cssText = "box-sizing:border-box;width:100%;margin:5px 0 12px;padding:9px;border:1px solid #ffffff35;border-radius:8px;background:#0c1511;color:#fff;font:13px system-ui";
    const status = document.createElement("div");
    status.style.cssText = "min-height:20px;color:#b7c4bd;margin:4px 0 10px";
    const heading = document.createElement("strong");
    heading.textContent = "Важные уведомления ntfy (тихие вехи и громкие тревоги)";
    const help = document.createElement("p");
    help.textContent = "Создайте случайный topic в ntfy.sh и подпишитесь на него в приложении ntfy. Промежуточные шаги остаются только в консоли; в ntfy уходят только важные события: тихие пуши (отправка задачи, сохранение ответа в Submitted, итог хода Координатора) и громкие пуши со звуком (любая остановка, пауза, ошибка или завершение кампании).";
    help.style.cssText = "color:#c0cbc4;margin:8px 0 10px";
    const topicLabel = document.createElement("label"); topicLabel.textContent = "Topic";
    const tokenLabel = document.createElement("label"); tokenLabel.textContent = "Токен доступа (необязательно)";
    const buttons = document.createElement("div"); buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap";
    const button = (text, color) => { const b=document.createElement("button"); b.type="button"; b.textContent=text; b.style.cssText=`padding:8px 11px;border:0;border-radius:8px;background:${color};color:#fff;cursor:pointer;font:600 12px system-ui`; return b; };
    const cancel = button("Закрыть", "#454545");
    const disable = button("Отключить", "#5a2a2a");
    const testQuiet = button("Тест тихого пуша", "#245c46");
    const testLoud = button("Тест громкого пуша", "#8c3b2b");
    const save = button("Сохранить", "#454545");
    cancel.onclick = () => dialog.close();
    disable.onclick = async () => {
      await GM_setValue(C.ntfyTopic, "");
      await GM_setValue(C.ntfyToken, "");
      topic.value = ""; token.value = "";
      status.textContent = "ntfy отключён; новые уведомления больше не отправляются.";
    };
    const persist = async () => {
      const name = topic.value.trim();
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw Error("Topic должен содержать 1–64 латинских букв, цифр, дефисов или подчёркиваний.");
      await GM_setValue(C.ntfyTopic, name);
      await GM_setValue(C.ntfyToken, token.value.trim());
      return { name, accessToken: token.value.trim() };
    };
    save.onclick = async () => {
      try { await persist(); status.textContent = "Настройки сохранены. В ntfy будут приходить только важные тихие и громкие пуши."; }
      catch (error) { status.textContent = error.message || String(error); }
    };
    testQuiet.onclick = async () => {
      testQuiet.disabled = true; status.textContent = "Отправляю тихий тестовый пуш…";
      try {
        const saved = await persist();
        await ntfyRequest(saved.name, saved.accessToken, "Тест Chronicle Forge: тихое уведомление о важной вехе цикла (Priority 2).", { title: "Chronicle Forge (тихий тест)", urgent: false, priority: "2", tags: "memo" });
        status.textContent = "Тихий тест отправлен (Priority 2). Проверьте подписку в приложении ntfy.";
      } catch (error) { status.textContent = error.message || String(error); }
      finally { testQuiet.disabled = false; }
    };
    testLoud.onclick = async () => {
      testLoud.disabled = true; status.textContent = "Отправляю громкий тестовый пуш…";
      try {
        const saved = await persist();
        await ntfyRequest(saved.name, saved.accessToken, "Тест Chronicle Forge: громкое уведомление об остановке/ошибке, требующей Мастера (Priority 5).", { title: "Chronicle Forge: alert (громкий тест)", urgent: true, priority: "5", tags: "warning,rotating_light" });
        status.textContent = "Громкий тест отправлен (Priority 5). Проверьте звуковой сигнал в приложении ntfy.";
      } catch (error) { status.textContent = error.message || String(error); }
      finally { testLoud.disabled = false; }
    };
    buttons.append(cancel, disable, testQuiet, testLoud, save);
    dialog.append(heading, help, topicLabel, topic, tokenLabel, token, status, buttons);
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }
  function toast(msg, error = false, options = {}) { logEvent(msg, error, options); }
  function buttonText(text) {
    const button = document.getElementById(C.button);
    if (button) button.textContent = text;
    const status = document.getElementById(C.consoleStatus);
    if (status) { status.textContent = text; status.title = text; }
    logEvent(text, false, { skipNtfy: true });
  }
  function idleButtonText(text) {
    const button = document.getElementById(C.button);
    if (button) button.dataset.idleText = text;
  }
  const ACTION_LOCK_TTL_MS = 90000;
  async function isActionLockHeld() {
    if (!(await GM_getValue(C.lock, false))) return false;
    const owner = await GM_getValue(C.lockOwner, null);
    const startedMs = owner?.startedAt ? Date.parse(owner.startedAt) : NaN;
    if (!Number.isFinite(startedMs) || Date.now() - startedMs > ACTION_LOCK_TTL_MS) {
      await GM_setValue(C.lock, false);
      await GM_setValue(C.lockOwner, null);
      return false;
    }
    return true;
  }
  async function acquireActionLock(action) {
    const owner = {
      action,
      pathname: location.pathname,
      startedAt: new Date().toISOString(),
      token: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    await GM_setValue(C.lockOwner, owner);
    await GM_setValue(C.lock, true);
    return owner;
  }
  async function releaseActionLock(owner = null) {
    const current = await GM_getValue(C.lockOwner, null);
    if (owner?.token && current?.token && current.token !== owner.token) return;
    await GM_setValue(C.lock, false);
    await GM_setValue(C.lockOwner, null);
  }
  async function actionLockError() {
    const owner = await GM_getValue(C.lockOwner, null);
    const detail = owner
      ? `${owner.action || "действие без названия"}; начато ${owner.startedAt || "время неизвестно"}; страница ${owner.pathname || "неизвестна"}`
      : "владелец не записан (возможно, блокировка от старой версии userscript)";
    return new Error(`Другое действие уже выполняется: ${detail}.`);
  }
  const autoEnabled = () => GM_getValue(C.autoMode, false);
  const autoIsPaused = () => GM_getValue(C.autoPaused, false);
  const autoCountKey = (id) => `${C.sendCountPrefix}${id}`;
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
  }
  function generatingNow() {
    return Array.from(document.querySelectorAll("button")).some((button) =>
      isVisible(button) && /stop generating|остановить генерац/i.test(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`),
    );
  }
  function findComposer() {
    const explicit = document.querySelector(".editor-content[contenteditable='true'], .editor-content [contenteditable='true'], [contenteditable='true'].tiptap, [contenteditable='true'][role='textbox'], [contenteditable='true']");
    if (explicit) return explicit;
    const prompt = document.querySelector(".editor-content p, [data-placeholder] p");
    return prompt?.closest("[contenteditable='true']") || prompt?.parentElement?.closest("[contenteditable='true']") || null;
  }
  function fillComposer(editor, text) {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    let inserted = false;
    try { inserted = document.execCommand("insertText", false, text); } catch {}
    if (!inserted) editor.textContent = text;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function composerKey(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/\s+/gu, " ")
      .trim();
  }
  const sameComposerText = (a, b) => composerKey(a) === composerKey(b);
  function normalizedButtonLabel(value) {
    return String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  function sendButtonLabels(button) {
    return [
      button?.getAttribute?.("aria-label"),
      button?.getAttribute?.("title"),
      button?.getAttribute?.("data-testid"),
      button?.getAttribute?.("data-test-id"),
      button?.textContent,
    ].map(normalizedButtonLabel).filter(Boolean);
  }
  function isSendButtonCandidate(button) {
    const labels = sendButtonLabels(button);
    return labels.some((label) => /^(?:send|send message|send a message|send prompt|submit|submit message|отправить|отправить сообщение)$/i.test(label))
      || labels.some((label) => /(^|[-_ ])(?:send|submit)([-_ ]|$)/i.test(label));
  }
  function isSendButtonDisabled(button) {
    return Boolean(button?.disabled
      || String(button?.getAttribute?.("aria-disabled") || "").toLowerCase() === "true"
      || String(button?.getAttribute?.("data-disabled") || "").toLowerCase() === "true");
  }
  function chooseSendButton(buttons, visible = isVisible) {
    const candidates = Array.from(buttons || []).filter(isSendButtonCandidate);
    return candidates.find((button) => visible(button) && !isSendButtonDisabled(button))
      || candidates.find(visible)
      || candidates.find((button) => button?.isConnected !== false)
      || null;
  }
  function sendButton() {
    return chooseSendButton(document.querySelectorAll('button, [role="button"]'));
  }
  function isSendButtonReady(button) {
    return Boolean(button && isVisible(button) && !isSendButtonDisabled(button));
  }
  async function waitForSendButton(timeoutMs = 1800, pollMs = 100) {
    const deadline = Date.now() + timeoutMs;
    do {
      const button = sendButton();
      if (isSendButtonReady(button)) return button;
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    } while (true);
    return null;
  }
  function sendButtonDiagnostics() {
    return Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(isSendButtonCandidate)
      .slice(0, 5)
      .map((button) => ({
        labels: sendButtonLabels(button).slice(0, 4),
        visible: isVisible(button),
        disabled: isSendButtonDisabled(button),
        ariaDisabled: button.getAttribute("aria-disabled") || "",
      }));
  }
  function closeCompletionPanel() {
    const panels = Array.from(document.querySelectorAll("div.border-border-medium.bg-surface-secondary.w-full.rounded-md.border.shadow-sm.outline-none")).filter(isVisible);
    if (!panels.length) return null;
    for (const panel of panels) {
      const buttons = Array.from(panel.querySelectorAll("button"));
      const labelledClose = buttons.find((b) => /close|закрыть/i.test(`${b.getAttribute("aria-label") || ""} ${b.getAttribute("title") || ""} ${b.textContent || ""}`));
      const header = panel.querySelector(".flex.items-center.justify-between");
      const headerButtons = Array.from(header?.querySelectorAll("button") || []);
      const close = labelledClose || headerButtons.at(-1) || (buttons.length === 1 ? buttons[0] : null);
      if (close && isVisible(close)) { close.click(); return true; }
    }
    return false;
  }
  function visibleOptionalSkipButton() {
    for (const message of document.querySelectorAll('[data-agent-transcript-message="true"]')) {
      for (const button of message.querySelectorAll("button")) {
        const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.trim();
        if (/^skip$/i.test(label) && isVisible(button) &&
          button.closest(".border-border-faint, .border-border-medium, [class*='border-border']")) return button;
      }
    }
    return null;
  }
  const hasVisibleOptionalCard = () => Boolean(visibleOptionalSkipButton());
  async function clickVisibleOptionalSkip() {
    const button = visibleOptionalSkipButton();
    if (!button) return true;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    return !hasVisibleOptionalCard();
  }
  function detectVisibleErrorCard() {
    const selectors = [
      'div[class*="border-red"][class*="bg-red"][class*="rounded"]',
      'div[class*="border-red-500"][class*="bg-red-500"]',
      'div[class*="border-destructive"][class*="bg-destructive"]',
    ];
    const candidates = new Set();
    for (const selector of selectors) {
      for (const card of document.querySelectorAll(selector)) candidates.add(card);
    }
    const keywords = /something went wrong|please try again|failed|error occurred|an error|rate limit|timed out|timeout|unauthorized|ошибка|попробуйте снова|что-то пошло не так|не удалось|сбой|превышен лимит/i;
    for (const card of candidates) {
      if (!isVisible(card) || card.dataset.failPlayed === "true") continue;
      if (card.closest("pre, code, textarea, .shiki, .hljs, .prism, .monaco-editor, [data-language], [data-diff], [class*='diff'], [class*='code-block']")) continue;
      const text = (card.innerText || card.textContent || "").trim();
      if (!text) continue;
      if (text.length < 400 || keywords.test(text)) {
        card.dataset.failPlayed = "true";
        return card;
      }
    }
    return null;
  }
  function lastUserTranscriptMessage() {
    const messages = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]'));
    return messages.reverse().find((message) => message.querySelector('[data-user-message-layout="true"]')) || null;
  }
  function transcriptUserText(message) {
    const layout = message?.querySelector('[data-user-message-layout="true"]');
    return String(layout?.innerText || layout?.textContent || "").trim();
  }
  function latestUserMessageAlert() {
    const message = lastUserTranscriptMessage();
    if (!message) return null;
    const alert = Array.from(message.querySelectorAll('[role="alert"]')).find(isVisible);
    return alert ? { message, alert, messageText: transcriptUserText(message), errorText: String(alert.innerText || alert.textContent || "").trim() } : null;
  }
  function updateManualButtonVisibility(enabled) {
    const button = document.getElementById(C.button);
    if (button) button.style.display = enabled ? "none" : "inline-flex";
    const exit = document.getElementById(C.manualModeButton);
    if (exit) exit.style.display = enabled ? "inline-flex" : "none";
  }
  function mountModeToggle() {
    if (!document.body || document.getElementById(C.modeButton)) return;
    const root = ensureConsole();
    const b = document.createElement("button");
    b.id = C.modeButton;
    b.type = "button";
    b.style.cssText = "flex:1;min-width:0;padding:8px 10px;border:0;border-radius:9px;background:#454545;color:#fff;cursor:pointer;font:600 12px system-ui";
    const refresh = async () => {
      const enabled = await autoEnabled(), paused = await autoIsPaused();
      b.textContent = enabled ? (paused ? "Возобновить автоочередь" : "Остановить автоочередь") : "Запустить автоочередь";
      b.title = enabled
        ? (paused
          ? "Автоочередь на паузе. Нажмите, чтобы продолжить; для лимита маркера будет отдельное подтверждение сброса только счётчика напоминаний. Перезагрузка не сбрасывает счётчики."
          : "Автоочередь работает. Нажмите, чтобы остановить её и перейти в ручной режим. Текущая задача и её лог сохранятся.")
        : "Автоочередь выключена. Нажмите, затем подтвердите запуск, чтобы последовательно выполнять Ready-задачи. В ручном режиме нижняя кнопка используется только для явной передачи/сохранения ответа.";
      b.style.background = enabled && !paused ? "#245c46" : "#454545";
      b.setAttribute("aria-pressed", String(enabled && !paused));
      updateManualButtonVisibility(enabled);
      await refreshCoordinatorResetButton();
    };
    b.onclick = async () => {
      const enabled = await autoEnabled();
      if (enabled && !(await autoIsPaused())) {
        await stopAutomation("Автоматизация выключена. Ручная кнопка и автоматическая передача готового результата сохранены.", { clearHandoff: false, sound: false, title: "Chronicle Forge: automation stopped" });
      } else if (enabled) {
        const pauseContext = await GM_getValue(C.autoPauseContext, null);
        const coordinatorTurn = await GM_getValue(C.pendingCoordinatorTurn, null);
        const currentAgentId = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        const resetCoordinatorLimit = coordinatorMarkerResetEligible(coordinatorTurn, currentAgentId, pauseContext);
        if (pauseContext?.kind === "coordinator-marker-limit" && !resetCoordinatorLimit) {
          toast("Сброс лимита отменён: текущая страница или сохранённый ход не совпадают с паузой. Откройте именно страницу указанного Координатора; пауза сохранена.", true);
          return;
        }
        if (resetCoordinatorLimit) {
          const confirmed = confirm(
            `Координатор не выдал CF_COORDINATOR_RESULT после ${AUTO.coordinatorMarkerRetries} напоминаний.\n\n` +
            `Ход: ${coordinatorTurn.turnId}\n` +
            `Кампания: ${coordinatorTurn.campaignId}\n` +
            (coordinatorTurn.dispatchId ? `Dispatch/Run: ${coordinatorTurn.dispatchId} / ${coordinatorTurn.runId || "—"}\n` : "") +
            "\nСбросить только лимит напоминаний этого хода и продолжить автоматическую проверку? При необходимости Координатор получит до двух новых коррелированных напоминаний. Dispatch/Run и записи Notion/Drive не будут сброшены или отправлены повторно.\n\nДа — сбросить лимит и продолжить. Нет — оставить паузу."
          );
          if (!confirmed) {
            toast("Пауза сохранена; лимит попыток не сброшен.");
            return;
          }
          coordinatorTurn.markerRetryCount = 0;
          coordinatorTurn.lastResponseSignature = null;
          coordinatorTurn.lastResponseChangedAt = Date.now();
          await GM_setValue(C.pendingCoordinatorTurn, coordinatorTurn);
          await GM_setValue(C.autoPauseContext, null);
          await GM_setValue(C.autoPaused, false);
          toast(`Лимит напоминаний сброшен только для хода ${coordinatorTurn.turnId}; очередь не отправляет повторно Dispatch/Run и проверит текущий ответ.`);
        } else {
          if (!confirm("Возобновить автоматизацию? Счётчики отправок текущей Dispatch-задачи будут сброшены; лимит напоминаний Координатора не изменится.")) return;
          await GM_setValue(C.autoPaused, false);
          const pending = await GM_getValue(C.pendingPrompt, null);
          if (pending?.dispatchId) {
            await GM_setValue(autoCountKey(pending.dispatchId), 0);
            await GM_setValue(`${C.reloadCountPrefix}${pending.dispatchId}`, 0);
          }
          await GM_setValue(C.autoPauseContext, null);
          toast("Автоматизация возобновлена; счётчики отправок сброшены для текущей Dispatch-задачи.");
        }
      } else {
        if (!confirm("Запустить автоматическую очередь? Ready-задачи запускаются по Sequence, строго по одной; следующая ждёт вердикта Координатора. При любой видимой ошибке автоматизация останавливается и вызывает Мастера; исходное сообщение не перезагружается и не отправляется повторно автоматически. Видимые карточки опроса/аудио с кнопкой Skip будут пропущены автоматически.")) return;
        prepareMasterAlertAudio();
        await GM_setValue(C.autoMode, true);
        await GM_setValue(C.autoPaused, false);
        toast("Полная автоматизация включена.");
      }
      await refresh();
      debugConsole(`mode:${location.pathname}`, "automation mode changed", { pathname: location.pathname, autoEnabled: Boolean(await autoEnabled()), paused: Boolean(await autoIsPaused()), generating: generatingNow() });
      if (await autoEnabled() && /\/agent\/[\w-]+/.test(location.pathname) && generatingNow()) {
        const pageId = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        const pageRole = (await roleList()).find((role) => norm(role.id) === norm(pageId));
        if (pageRole?.dispatchFunction === "Coordinator") {
          const pendingTurn = await GM_getValue(C.pendingCoordinatorTurn, null);
          if (!pendingTurn) await GM_setValue(C.coordinatorNeedsAdoption, { coordinatorId: pageRole.id, startedAt: Date.now() });
          logEvent(pendingTurn
            ? "Автоматизация включена во время генерации Координатора; жду CF_COORDINATOR_RESULT для сохранённого хода."
            : "Автоматизация включена во время старого/ручного хода Координатора; после генерации отправлю одноразовую сверку с маркером, не запуская задачу повторно.");
        } else if (pageRole?.dispatchFunction === "Executor")
          logEvent("Автоматизация включена во время генерации Executor; отслеживаю текущий ответ и жду конечный CF_AGENT_RESULT.");
      }
      scheduleAutoSubmit();
      scheduleAutoSend();
      scheduleCoordinatorHandoff();
      scheduleCoordinatorAuto();
      scheduleCoordinatorQueueNotice();
    };
    const actions = root?.querySelector(`#${C.consoleActions}`) || document.body;
    actions.appendChild(b);
    const resetButton = document.createElement("button");
    resetButton.id = C.coordinatorResetButton;
    resetButton.type = "button";
    resetButton.textContent = "Сбросить лимит напоминаний";
    resetButton.title = "Только для сохранённого хода Координатора; Dispatch/Run и записи не повторяются и не очищаются.";
    resetButton.style.cssText = "display:none;flex:1;min-width:0;padding:8px 10px;border:1px solid #ffcf70;border-radius:9px;background:#684816;color:#fff3d1;cursor:pointer;font:700 12px system-ui;text-align:center;align-items:center;justify-content:center";
    resetButton.onclick = () => b.click();
    actions.appendChild(resetButton);
    const exit = document.createElement("button");
    exit.id = C.manualModeButton;
    exit.type = "button";
    exit.textContent = "Остановить автоматику";
    exit.title = "Немедленно остановить автоочередь и перейти в ручной режим. Текущая задача и её лог сохраняются; повторной отправки не будет.";
    exit.style.cssText = "display:none;flex:1;min-width:0;padding:8px 10px;border:1px solid #d29b62;border-radius:9px;background:#5c3c24;color:#fff;cursor:pointer;font:600 12px system-ui;text-align:center;align-items:center;justify-content:center;white-space:nowrap";
    exit.onclick = async () => {
      if (!(await autoEnabled())) return;
      await stopAutomation("Автоматизация выключена. Включён ручной режим; текущая задача и её лог сохранены.", { clearHandoff: false, sound: false, title: "Chronicle Forge: manual mode" });
      await refresh();
      scheduleAutoSend();
      scheduleCoordinatorHandoff();
      scheduleCoordinatorAuto();
    };
    actions.appendChild(exit);
    refresh();
  }
  function req(
    method,
    url,
    { headers = {}, body, responseType = "text" } = {},
  ) {
    return new Promise((resolve, reject) =>
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: body,
        responseType,
        timeout: 30000,
        onload: (r) => {
          if (r.status < 200 || r.status >= 300) {
            let parsed = {};
            try {
              parsed = JSON.parse(r.responseText || "{}");
            } catch {}
            const detail =
              parsed?.error?.message || r.statusText || "API request failed";
            reject(new Error(`${method} ${url}: HTTP ${r.status} — ${detail}`));
            return;
          }
          if (responseType === "json") {
            try {
              resolve(r.response || JSON.parse(r.responseText));
            } catch (e) {
              reject(new Error(`Invalid JSON: ${e.message}`));
            }
          } else resolve(r.responseText ?? r.response ?? "");
        },
        onerror: () => reject(new Error(`Network/CORS error: ${url}`)),
        ontimeout: () => reject(new Error(`Request timed out: ${url}`)),
      }),
    );
  }
  async function notionCredential() {
    let n = await GM_getValue("cf_notion_token", "");
    if (!n) {
      n = prompt(
        "Вставьте Internal Integration Secret Notion (не отправляйте его в чат):",
      );
      if (!n) throw Error("Без токена Notion остановлено.");
      n = n.trim();
      await GM_setValue("cf_notion_token", n);
    }
    return n;
  }
  async function gatewayCredentials() {
    if (await GM_getValue("cf_google_access_token", ""))
      await GM_setValue("cf_google_access_token", "");
    let u = await GM_getValue("cf_gateway_url", "");
    let k = await GM_getValue("cf_gateway_key", "");
    if (!u) {
      u = prompt(
        "Вставьте URL развернутого Google Apps Script шлюза (оканчивается на /exec):",
      );
      if (!u) throw Error("Без URL шлюза остановлено.");
      u = u.trim();
      await GM_setValue("cf_gateway_url", u);
    }
    if (!k) {
      k = prompt(
        "Вставьте ключ доступа шлюза из Script Properties (не отправляйте его в чат):",
      );
      if (!k) throw Error("Без ключа шлюза остановлено.");
      k = k.trim();
      await GM_setValue("cf_gateway_key", k);
    }
    return { u, k };
  }
  async function notion(method, path, data) {
    const n = await notionCredential();
    return req(method, `https://api.notion.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${n}`,
        "Notion-Version": C.notionV,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      responseType: "json",
    });
  }
  async function gateway(action, fileId, extra = {}) {
    const { u, k } = await gatewayCredentials();
    return new Promise((resolve, reject) =>
      GM_xmlhttpRequest({
        method: "POST",
        url: u,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        data: JSON.stringify({ key: k, action, fileId, ...extra }),
        timeout: 30000,
        onload: (r) => {
          let x;
          try {
            x = JSON.parse(r.responseText || "{}");
          } catch {
            reject(
              new Error(
                `Шлюз вернул некорректный ответ (HTTP ${r.status}). Проверьте URL развертывания.`,
              ),
            );
            return;
          }
          if (r.status < 200 || r.status >= 300 || !x.ok) {
            reject(
              new Error(
                x.error || `Ошибка Google Apps Script шлюза: HTTP ${r.status}`,
              ),
            );
            return;
          }
          // createLog responses have existed in both result-wrapped and top-level
          // shapes across Apps Script deployments. Preserve the envelope so the
          // caller can normalize either shape instead of silently dropping fileId.
          resolve(action === "createLog" ? x : x.content ?? x.result ?? "");
        },
        onerror: () =>
          reject(
            new Error("Не удалось связаться с Google Apps Script шлюзом."),
          ),
        ontimeout: () =>
          reject(new Error("Истекло время ожидания Google Apps Script шлюза.")),
      }),
    );
  }
  async function query(source, filter, sorts = []) {
    let out = [],
      cursor;
    do {
      const b = {
        page_size: 100,
        ...(filter ? { filter } : {}),
        ...(sorts.length ? { sorts } : {}),
        ...(cursor ? { start_cursor: cursor } : {}),
      };
      const r = await notion("POST", `data_sources/${source}/query`, b);
      out.push(...(r.results || []));
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor && out.length < 400);
    if (cursor)
      throw Error(
        "Notion вернул более 400 записей; остановлено для безопасности.",
      );
    return out;
  }
  function extractAgentIdFromUrl(rawUrl) {
    const match = String(rawUrl || "").trim().match(/\/agent\/([A-Za-z0-9-]+)/);
    return match ? match[1] : "";
  }
  function resolveRoleAgentIdentity(rawId, rawUrl) {
    const idFromUrl = extractAgentIdFromUrl(rawUrl);
    const trimmedId = String(rawId || "").trim();
    const id = idFromUrl || trimmedId;
    const url = String(rawUrl || "").trim() || (id ? `https://arena.ai/agent/${id}` : "");
    return { id, url };
  }
  async function roleList() {
    const rows = (await query(C.roles)).map((p) => {
      const { id, url } = resolveRoleAgentIdentity(
        rt(p.properties?.["Arena Agent ID"]),
        p.properties?.["Arena Agent URL"]?.url || "",
      );
      return {
        id,
        name: rt(p.properties?.["Роль"]),
        url,
        notionUrl: p.url || (p.id ? `https://app.notion.com/p/${p.id.replaceAll("-", "")}` : ""),
        target: sel(p.properties?.["Execution Target"]),
        dispatchFunction: sel(p.properties?.["Dispatch Function"]),
      };
    }).filter((r) => r.id && r.url && r.target === "Arena agent" && r.dispatchFunction);
    const ids = rows.map((r) => norm(r.id));
    if (new Set(ids).size !== ids.length) throw Error("В реестре Notion повторяется Arena Agent ID.");
    if (rows.filter((r) => r.dispatchFunction === "Coordinator").length !== 1)
      throw Error("В Notion должен быть ровно один активный Coordinator.");
    return rows;
  }
  function findExecutorRoleForTask(task, roles) {
    const rname = recipientRole(task);
    const rid = recipient(task);
    if (!rname && !rid) return null;
    if (rname) {
      const byRole = roles.find((x) => x.name === rname && x.dispatchFunction === "Executor");
      if (byRole) return byRole;
    }
    if (rid) {
      return roles.find((x) => norm(x.id) === norm(rid) && x.dispatchFunction === "Executor" && (!rname || x.name === rname)) || null;
    }
    return null;
  }
  function taskMatchesExecutorRole(task, role, pageAgentId = role?.id) {
    if (!task || !role || role.dispatchFunction !== "Executor") return false;
    if (pageAgentId && norm(role.id) !== norm(pageAgentId)) return false;
    const rname = recipientRole(task);
    const rid = recipient(task);
    if (rname && rname === role.name) return true;
    return Boolean(!rname && rid && norm(rid) === norm(role.id));
  }
  function roleContextText(role) {
    if (!role?.name || !role.notionUrl)
      throw Error(`В реестре Notion нет ссылки на устав роли ${role?.name || "(неизвестно)"}.`);
    const isCoordinator = role.dispatchFunction === "Coordinator";
    const reminder = isCoordinator
      ? "Ты — Координатор: организуй автономную работу только над текущей кампанией; на завершении остановись и жди явного решения Мастера. Не запускай следующую кампанию самостоятельно."
      : `Ты сейчас действуешь в роли ${role.name}: выполняй только назначенный Dispatch в пределах текущей кампании; не трактуй принятие своей задачи как разрешение на следующую кампанию.`;
    return `КОНТЕКСТ РОЛИ И ГЛОБАЛЬНОГО МАНДАТА\n${reminder}\nУстав текущей роли (ответственность, полномочия и границы): ${role.notionUrl}\nОбщий регламент пяти кампаний и контрольной точки Мастера (прочитай перед действием): ${C.milestonePolicyUrl}\nИндивидуальное принятие задачи/PR не завершает кампанию; переход к следующей возможен только после явного решения Мастера.`;
  }
  function technicalHandoffFooter(role, dispatchId, runId, campaign) {
    const campaignReminder = campaign ? `\nТекущая кампания: ${rt(campaign.properties?.["Кампания"])}.\nСтатус команды из Notion: ${campaignTeamState(campaign) || "не задан"}.\nКритерии завершения этой кампании из Notion (источник истины, не подменять предположениями): ${campaignCompletionCriteria(campaign) || "НЕ ЗАПОЛНЕНЫ — запроси у Координатора/Мастера уточнение; не объявляй кампанию завершённой."}\nВсе индивидуальные задачи Accepted означают только, что Координатору пора проверить очередь/запросить следующие задачи; это само по себе НЕ закрывает кампанию.` : "";
    return `\n\n---\nТЕХНИЧЕСКОЕ ЗАВЕРШЕНИЕ ЭСТАФЕТЫ\nВ конце завершённого ответа добавьте последней строкой, отдельно, без блока кода и без текста после неё, точный JSON-маркер. После отправки видимое последнее сообщение будет проверено и передано Координатору. Не пропускайте маркер и не ставьте его, пока работа не завершена.\nВАЖНО: не перезаписывайте системный файл лога из поля «Output Drive File ID» (${dispatchId}_${runId}.md) через инструменты Google Drive (и не меняйте его MIME-тип на text/markdown), не меняйте поле «Output Drive File ID» и НЕ меняйте поля «Dispatch State», «Статус» или «Run ID» карточки запроса в Notion вручную через инструменты Notion — запись ответа в системный лог и перевод статуса Running → Submitted автоматически выполнит ScriptCat после вашего маркера CF_AGENT_RESULT. Дополнительные отчёты при необходимости загружайте отдельными файлами в Drive.\n${roleContextText(role)}${campaignReminder}\nCF_AGENT_RESULT {"dispatch_id":"${dispatchId}","run_id":"${runId}","status":"submitted"}\n---`;
  }
  function coordinatorTurnFooter(turn) {
    const payload = {
      campaign_id: turn.campaignId,
      turn_id: turn.turnId,
      status: "completed",
    };
    if (turn.dispatchId) payload.dispatch_id = turn.dispatchId;
    if (turn.runId) payload.run_id = turn.runId;
    return `\n\n---\nЗАВЕРШЕНИЕ ХОДА КООРДИНАТОРА\nПосле того как вердикт/следующая задача или флаг завершения кампании записаны в Notion и вердикт добавлен к соответствующему Drive-логу, завершите ответ точной последней отдельной строкой (без code fence и без текста после неё). Маркер используется только для фиксации конца хода; сам по себе он не закрывает задачу или кампанию.\nCF_COORDINATOR_RESULT ${JSON.stringify(payload)}`;
  }
  function coordinatorResult(text) {
    const normalized = String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trimEnd();
    const lastLine = normalized.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) || "";
    const match = lastLine.match(/^CF_COORDINATOR_RESULT[ \t]+(\{[^\r\n]*\})$/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
  }
  function coordinatorTurnMatches(turn, result) {
    return Boolean(result
      && result.campaign_id === turn.campaignId
      && result.turn_id === turn.turnId
      && result.status === "completed"
      && (!turn.dispatchId || result.dispatch_id === turn.dispatchId)
      && (!turn.runId || result.run_id === turn.runId));
  }
  function coordinatorMarkerResetEligible(turn, pageAgentId, pauseContext) {
    const recognizedPause = pauseContext?.kind === "coordinator-marker-limit" || !pauseContext;
    const samePausedTurn = (!pauseContext?.turnId || pauseContext.turnId === turn?.turnId)
      && (!pauseContext?.dispatchId || pauseContext.dispatchId === turn?.dispatchId)
      && (!pauseContext?.runId || pauseContext.runId === turn?.runId);
    return Boolean(recognizedPause && samePausedTurn && turn?.turnId
      && Number(turn.markerRetryCount) >= AUTO.coordinatorMarkerRetries
      && norm(turn.coordinatorId) === norm(pageAgentId));
  }
  async function refreshCoordinatorResetButton() {
    const button = document.getElementById(C.coordinatorResetButton);
    if (!button) return;
    const [enabled, paused, pauseContext, turn] = await Promise.all([
      autoEnabled(), autoIsPaused(), GM_getValue(C.autoPauseContext, null), GM_getValue(C.pendingCoordinatorTurn, null),
    ]);
    const pageAgentId = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
    const eligible = enabled && paused && coordinatorMarkerResetEligible(turn, pageAgentId, pauseContext);
    button.style.display = eligible ? "inline-flex" : "none";
    if (eligible) {
      button.title = `Сбросить только лимит напоминаний для хода ${turn.turnId} Координатора ${turn.coordinatorId}. Нажатие откроет подтверждение Да/Нет; другие состояния не меняются.`;
    }
  }
  function coordinatorMarkerRecoveryPrompt(previousTurn, nextTurn, attempt, previousMessageId) {
    return `Автоматическое продолжение хода Координатора (попытка ${attempt}; новый ход ${nextTurn.turnId}). Твой предыдущий ответ по ходу ${previousTurn.turnId} завершился без обязательного CF_COORDINATOR_RESULT; он не был подтверждён автоматикой. Последнее сообщение: ${previousMessageId || "не определено"}.\n\nНе жди Мастера и не повторяй уже выполненные изменения. Сверь текущее состояние Notion/Drive для той же кампании${previousTurn.dispatchId ? `, Dispatch ${previousTurn.dispatchId}${previousTurn.runId ? `, Run ${previousTurn.runId}` : ""}` : ""}. Если нужное решение и все записи уже внесены — не дублируй их, просто заверши текущий ход точным маркером ниже. Если задача осталась незавершённой — закончи её в рамках прежних ограничений, затем добавь маркер. Если обнаружена реальная блокировка — запиши её и причину, затем добавь маркер; обычное отсутствие маркера не является причиной просить участия Мастера.\n\nМаркер должен быть последней отдельной строкой ответа, без code fence и без последующего текста. Он относится к новому коррелированному ходу; прежний маркер/транскрипт не засчитывается.`;
  }
  function createCoordinatorTurn({ coordinatorId, campaignId, dispatchId = "", runId: run = "", kind }) {
    return {
      coordinatorId,
      campaignId,
      dispatchId,
      runId: run,
      kind,
      turnId: crypto.randomUUID(),
      createdAt: Date.now(),
      baselineMessageIds: [],
      sentAt: 0,
    };
  }
  function taskSequence(task) {
    const value = task?.properties?.Sequence?.number;
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }
  function compareTaskQueue(a, b) {
    const aSequence = taskSequence(a),
      bSequence = taskSequence(b);
    if (aSequence !== bSequence) return aSequence - bSequence;
    const created = String(a.created_time || "").localeCompare(String(b.created_time || ""));
    return created || String(a.id || "").localeCompare(String(b.id || ""));
  }
  async function tasks(s) {
    const rows = await query(
      C.req,
      { property: "Dispatch State", select: { equals: s } },
      [{ property: "Sequence", direction: "ascending" }],
    );
    return rows.filter((p) => !p.archived && !p.in_trash).sort(compareTaskQueue);
  }
  const campaignKeyFromTask = (task) => rt(task?.properties?.["Кампания"]).trim().split(/[·|]/)[0].trim();
  const campaignFolderKey = (campaign) => {
    const folder = rt(campaign?.properties?.["Папка"]).trim().replace(/\/+$/, "");
    return folder.split("/").pop() || "";
  };
  async function campaignForTask(task) {
    const campaignKey = campaignKeyFromTask(task);
    if (!campaignKey) throw Error("В Dispatch не указана кампания.");
    const campaigns = await query(C.campaigns);
    const matches = campaigns.filter((item) =>
      campaignFolderKey(item) === campaignKey || rt(item.properties?.["Кампания"]).trim() === campaignKey);
    if (matches.length !== 1)
      throw Error(matches.length ? `Кампания «${campaignKey}» неоднозначно сопоставлена с реестром Notion.` : `Кампания «${campaignKey}» не сопоставлена с реестром Notion «Кампании».`);
    return matches[0];
  }
  const ACTIVE_CAMPAIGN_STATUSES = ["В работе", "На ревью", "Доработка", "Приёмка QA/TD"];
  const isCampaignStatusActive = (campaign) => ACTIVE_CAMPAIGN_STATUSES.includes(sel(campaign?.properties?.["Статус"]));
  const campaignTeamState = (campaign) => sel(campaign?.properties?.["Состояние команды"]);
  const campaignCompletionCriteria = (campaign) => rt(campaign?.properties?.["Критерии завершения"]).trim();
  async function assertCampaignDispatchAllowed(task) {
    const campaign = await campaignForTask(task);
    const campaignStatus = sel(campaign.properties?.["Статус"]);
    const teamState = campaignTeamState(campaign);
    if (teamState === "Завершена — ждёт Мастера" || teamState === "Ожидает решения Мастера")
      throw Error(`Кампания «${rt(campaign.properties?.["Кампания"])}» явно остановлена в Notion: «${teamState}». Следующую кампанию разрешает только Мастер.`);
    if (!isCampaignStatusActive(campaign))
      throw Error(`Шлюз кампаний остановил передачу: «${rt(campaign.properties?.["Кампания"])}» имеет статус «${campaignStatus || "не задан"}». Для следующей кампании требуется явное решение Мастера и статус «В работе».`);
  }
  const fresh = (id) => notion("GET", `pages/${id}`),
    patch = (id, properties) => notion("PATCH", `pages/${id}`, { properties });
  function props(s, v = {}) {
    const p = { "Dispatch State": { select: { name: s } } };
    if (Object.hasOwn(v, "run"))
      p["Run ID"] = {
        rich_text: v.run ? [{ type: "text", text: { content: v.run } }] : [],
      };
    if (Object.hasOwn(v, "recipient"))
      p["Recipient Agent ID"] = {
        rich_text: v.recipient ? [{ type: "text", text: { content: v.recipient } }] : [],
      };
    if (Object.hasOwn(v, "out"))
      p["Output Drive File ID"] = {
        rich_text: v.out ? [{ type: "text", text: { content: v.out } }] : [],
      };
    if (Object.hasOwn(v, "start"))
      p["Started At"] = { date: { start: v.start } };
    if (Object.hasOwn(v, "submit"))
      p["Submitted At"] = { date: { start: v.submit } };
    if (Object.hasOwn(v, "answer"))
      p["Ответ"] = {
        rich_text: [
          { type: "text", text: { content: v.answer.slice(0, 1900) } },
        ],
      };
    return p;
  }
  const getFile = (id) => gateway("read", id);
  function normalizeRunLogResponse(response) {
    const queue = [response];
    const seen = new Set();
    for (let i = 0; i < queue.length && i < 24; i++) {
      const value = queue[i];
      if (typeof value === "string") {
        const text = value.trim();
        if (/^[A-Za-z0-9_-]{10,}$/.test(text)) return { fileId: text };
        const urlId = text.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/)?.[1];
        if (urlId) return { fileId: urlId };
        if (text.startsWith("{") || text.startsWith("[")) {
          try { queue.push(JSON.parse(text)); } catch { /* not JSON */ }
        }
        continue;
      }
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      const id = value.fileId ?? value.file_id ?? value.driveFileId ?? value.outputFileId;
      if (typeof id === "string" && /^[A-Za-z0-9_-]{10,}$/.test(id)) {
        return { fileId: id, name: value.name ?? value.file?.name ?? "" };
      }
      if (value.file && typeof value.file === "object" &&
          typeof value.file.id === "string" && /^[A-Za-z0-9_-]{10,}$/.test(value.file.id)) {
        return { fileId: value.file.id, name: value.file.name ?? value.name ?? "" };
      }
      if (typeof value.id === "string" && /^[A-Za-z0-9_-]{10,}$/.test(value.id) &&
          (String(value.name || "").endsWith(".md") || /drive\.google\.com\/file\/d\//.test(String(value.webViewLink || value.url || "")))) {
        return { fileId: value.id, name: value.name ?? "" };
      }
      for (const key of ["result", "content", "data", "file", "log", "output"]) {
        if (value[key] !== undefined && value[key] !== value) queue.push(value[key]);
      }
    }
    return null;
  }
  function runLogResponseShape(response) {
    if (response === null) return "null";
    if (Array.isArray(response)) return `array(${response.length})`;
    if (typeof response === "object") return `object{${Object.keys(response).slice(0, 12).join(",")}}`;
    return typeof response;
  }
  function retryableRunLogError(error) {
    return /Истекло время ожидания|Не удалось связаться|некорректный ответ \(HTTP 5\d\d\)|шлюза: HTTP 5\d\d/i.test(String(error?.message || error));
  }
  async function createRunLog(dispatchId, run) {
    const request = {
      folderId: C.runLogFolder,
      dispatchId,
      runId: run,
    };
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response;
      try {
        response = await gateway("createLog", "", request);
      } catch (error) {
        lastError = error;
        if (attempt === 1 && retryableRunLogError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        throw error;
      }
      const log = normalizeRunLogResponse(response);
      if (log?.fileId) return log;
      lastError = new Error(
        `Шлюз подтвердил createLog, но ID файла не найден в ответе (форма: ${runLogResponseShape(response)}).`,
      );
      // Same Dispatch/Run pair is an idempotency key: a retry returns the
      // already-created log if the first response was wrapped or truncated.
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 350));
    }
    throw new Error(
      `Не удалось получить ID отдельного лога Dispatch-Run после 2 безопасных попыток: ${lastError?.message || "неизвестный ответ шлюза"}`,
    );
  }
  async function recordRunLog(pageId, dispatchId, run, log) {
    const url = `https://drive.google.com/file/d/${log.fileId}/view`;
    await notion("PATCH", `blocks/${pageId}/children`, {
      children: [{
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [
          { type: "text", text: { content: `Dispatch ${dispatchId} · Run ${run} — ` } },
          { type: "text", text: { content: "отдельный лог", link: { url } } },
        ] },
      }],
    });
  }
  async function append(log, id, run, role, agentId, text, messageId) {
    if (!/^[A-Za-z0-9_-]{10,128}$/.test(messageId || ""))
      throw Error("У последнего сообщения нет корректного chat-message-id.");
    const mark = `<!-- CF_DISPATCH ${norm(id)} ${run} ${norm(agentId)} ${messageId} -->`;
    const at = new Date().toLocaleString("sv-SE", {
      timeZone: "Europe/Moscow",
    });
    if (!String(text || "").trim()) throw Error("Перехвачен пустой текст ответа; файл лога не изменён.");
    const payload = {
      marker: mark,
      entry: `\n\n${mark}\n## ${at} · ${role}\nDispatch ID: ${id}\nRun ID: ${run}\nAgent ID: ${agentId}\nSource chat message ID: ${messageId}\n\n${text}\n\n---\n`,
    };
    try {
      return await gateway("append", log, payload);
    } catch (error) {
      // Apps Script may commit the append but lose or misreport its response.
      // Read back the exact idempotency marker before surfacing an error; never
      // issue a second append automatically.
      try {
        const saved = await gateway("read", log);
        if (String(saved || "").includes(mark)) {
          logEvent("Drive подтвердил запись по маркеру после ошибки ответа шлюза; повторная запись не выполнялась.");
          return "duplicate";
        }
      } catch (verifyError) {
        console.warn("[CF] Could not verify ambiguous Drive append", verifyError);
      }
      throw new Error(
        `Не удалось подтвердить запись ответа в Drive: ${error?.message || error}. Запись могла сохраниться; повторное нажатие с тем же сообщением безопасно.`,
      );
    }
  }
  function deriveFallbackRunLogKey(run) {
    const clean = String(run || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(clean)) return crypto.randomUUID();
    const last = clean.slice(-1).toLowerCase();
    const replacement = last === "f" ? "e" : "f";
    return `${clean.slice(0, -1)}${replacement}`;
  }
  async function appendWithRunLogFallback(log, dispatchId, run, roleName, agentId, text, messageId) {
    try {
      const appendResult = await append(log, dispatchId, run, roleName, agentId, text, messageId);
      return { appendResult, logId: log, recovered: false };
    } catch (error) {
      const msg = String(error?.message || error);
      if (!/Запись разрешена только в текстовые файлы папки логов Dispatch-Run/.test(msg)) {
        throw error;
      }
      logEvent("Основной файл Output Drive File ID отклонён шлюзом (перезаписан или сменён MIME-тип на text/markdown); восстанавливаю текстовый лог Dispatch-Run.");
      let preservedNote = "";
      try {
        const previousContent = String(await gateway("read", log) || "").trim();
        if (previousContent) {
          preservedNote = `\n\n[Предыдущее содержимое файла ${log} (https://drive.google.com/file/d/${log}/view), перезаписанного агентом]:\n${previousContent}`;
        }
      } catch (readErr) {
        console.warn("[CF] Could not read previous log content during fallback", readErr);
      }
      const combinedText = preservedNote ? `${text}${preservedNote}` : text;
      const canonical = await createRunLog(dispatchId, run);
      if (canonical?.fileId && canonical.fileId !== log) {
        try {
          const appendResult = await append(canonical.fileId, dispatchId, run, roleName, agentId, combinedText, messageId);
          return { appendResult, logId: canonical.fileId, recovered: true };
        } catch (canonicalErr) {
          if (!/Запись разрешена только в текстовые файлы папки логов Dispatch-Run/.test(String(canonicalErr?.message || canonicalErr))) {
            throw canonicalErr;
          }
        }
      }
      const fallbackKey = deriveFallbackRunLogKey(run);
      const fallbackLog = await createRunLog(dispatchId, fallbackKey);
      if (!fallbackLog?.fileId) throw error;
      const appendResult = await append(fallbackLog.fileId, dispatchId, run, roleName, agentId, combinedText, messageId);
      return { appendResult, logId: fallbackLog.fileId, recovered: true };
    }
  }
  function extractRenderedMessageProse(source) {
    if (!source) return "";
    const bodies = Array.from(source.querySelectorAll(".prose.body-base"))
      .filter(isVisible);
    const proseNodes = bodies.length ? bodies : Array.from(source.querySelectorAll(".prose")).filter(isVisible);
    if (!proseNodes.length) return "";
    return proseNodes
      .map((body) => String(body.innerText || body.textContent || "").trim())
      .filter(Boolean)
      .join("\n")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trim();
  }
  function isUserTranscriptMessage(message) {
    if (!message) return false;
    return Boolean(
      message.matches?.('[data-user-message-layout="true"]') ||
      message.querySelector?.('[data-user-message-layout="true"]'),
    );
  }
  function isDispatchedPromptEcho(text) {
    const clean = String(text || "");
    return (
      clean.includes("ТЕХНИЧЕСКОЕ ЗАВЕРШЕНИЕ ЭСТАФЕТЫ") ||
      clean.includes("ЗАВЕРШЕНИЕ ХОДА КООРДИНАТОРА")
    );
  }
  function captureAssistantMessage() {
    // Manual and automatic submission must inspect the exact same rendered text.
    return captureLatestRenderedAssistantMessage();
  }
  function captureLatestRenderedAssistantMessage() {
    if (generatingNow()) throw Error("Ответ ещё генерируется. Дождитесь завершения и нажмите снова.");
    const messages = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]'));
    const source = messages.at(-1);
    if (!source) throw Error("Не найдено ни одного сообщения агента в текущем transcript DOM.");
    if (isUserTranscriptMessage(source)) {
      throw Error("Последнее сообщение в чате — пользовательский запрос; ответ агента ещё не появился.");
    }
    const idFromElement = source.id.slice("chat-message-".length);
    const declaredId = source.getAttribute("data-chat-message-id") || "";
    if (declaredId && declaredId !== idFromElement) throw Error("ID последнего сообщения не совпадают между DOM-атрибутами.");
    const messageId = declaredId || idFromElement;
    if (!/^[A-Za-z0-9_-]{10,128}$/.test(messageId)) throw Error("У последнего сообщения некорректный chat-message-id.");
    // A single Arena assistant response may be split into many visible prose
    // blocks around tool-call cards. Reading querySelector()'s first match only
    // captures an interim status paragraph and misses the final marker block.
    const bodies = Array.from(source.querySelectorAll(".prose.body-base"))
      .filter(isVisible);
    const proseNodes = bodies.length ? bodies : Array.from(source.querySelectorAll(".prose")).filter(isVisible);
    if (!proseNodes.length) throw Error("В последнем сообщении не найден видимый блок ответа агента.");
    const text = extractRenderedMessageProse(source);
    if (!text) throw Error("Rendered prose последнего сообщения пуст.");
    if (isDispatchedPromptEcho(text)) {
      throw Error("Последнее сообщение в чате содержит текст отправленного задания, а не ответ агента.");
    }
    return { text, messageId };
  }
  function isFreshExecutorMessage(messageId, pending) {
    if (!pending || !pending.sentAt || !Array.isArray(pending.baselineMessageIds)) return false;
    const domId = `chat-message-${messageId}`;
    return !pending.baselineMessageIds.includes(messageId)
      && !pending.baselineMessageIds.includes(domId);
  }
  function uuidV7Timestamp(messageId) {
    const match = String(messageId || "").match(/^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-/i);
    if (!match) return null;
    const timestamp = Number.parseInt(`${match[1]}${match[2]}`, 16);
    return Number.isSafeInteger(timestamp) && timestamp <= Date.now() + 5 * 60 * 1000
      ? timestamp
      : null;
  }
  function isFreshManualExecutorMessage(messageId, manualPrepared) {
    if (!manualPrepared?.sent || !manualPrepared.key || !Number.isFinite(manualPrepared.preparedAt)) return false;
    const timestamp = uuidV7Timestamp(messageId);
    return timestamp !== null && timestamp >= manualPrepared.preparedAt;
  }
  function manualPreparedMatchesRun(manualPrepared, dispatchId, runId) {
    return Boolean(manualPrepared?.sent && manualPrepared.key === `${dispatchId}:${runId}`);
  }
  function agentResult(text) {
    // Arena may add invisible separators or non-breaking spaces around rendered
    // text. Normalize those, but still require the marker to be the final
    // non-empty line of the actual answer body.
    const normalized = String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trimEnd();
    const lastLine = normalized.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) || "";
    const match = lastLine.match(/^CF_AGENT_RESULT[ \t]+(\{[^\r\n]*\})$/);
    if (!match)
      throw Error(
        `Ответ агента не заканчивается отдельной строкой CF_AGENT_RESULT. Последняя строка: ${lastLine ? `«${lastLine.slice(0, 100)}»` : "(пустая)"}. Статус оставлен Running, лог не отправлен.`,
      );
    try {
      return JSON.parse(match[1]);
    } catch {
      throw Error("Маркер CF_AGENT_RESULT повреждён. Статус оставлен Running.");
    }
  }
  function tryParseAgentResult(text) {
    try {
      return agentResult(text);
    } catch {
      return null;
    }
  }
  function taskHasScriptCatSubmittedAnswer(task, messageId = "") {
    const answerText = rt(task?.properties?.["Ответ"]);
    if (!answerText.includes("записан в Dispatch-Run; ожидается Координатор")) return false;
    if (messageId && !answerText.includes(`chat-message-${messageId}`)) return false;
    return true;
  }
  function isAdoptedExecutorRunCompletion(captured, result, pendingPrompt) {
    if (!captured?.messageId || !result?.dispatch_id || result.status !== "submitted") return false;
    if (pendingPrompt && !pendingPrompt.sentAt && pendingPrompt.dispatchId === result.dispatch_id) return true;
    return false;
  }
  async function dispatch(task, roles, { retryRunning = false } = {}) {
    const p = await fresh(task.id);
    const priorState = state(p);
    if (priorState !== "Ready" && !(retryRunning && priorState === "Running"))
      throw Error("Задача больше не Ready/Running; действие остановлено.");
    const previousRun = runId(p),
      previousLog = outputId(p);
    if (retryRunning && (!previousRun || !previousLog))
      throw Error("Running-задача не содержит старых Run ID и Output Drive File ID; повтор остановлен.");
    const pid = payloadId(p);
    const role = findExecutorRoleForTask(p, roles);
    const rid = role?.id || "",
      rname = role?.name || recipientRole(p);
    if (!rname || !pid)
      throw Error("В Notion не заполнены адресат/payload.");
    if (
      !role ||
      role.dispatchFunction !== "Executor" ||
      !role.id ||
      !role.url.includes(role.id)
    )
      throw Error("Адресат не совпадает с активной ролью Executor в Notion «Роли».");
    const coordinator = roles.find((item) => item.dispatchFunction === "Coordinator");
    const currentAgentId = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
    const onActiveCoordinatorPage = Boolean(coordinator && norm(currentAgentId) === norm(coordinator.id));
    const onTargetExecutorPage = Boolean(retryRunning && rid && norm(currentAgentId) === norm(rid));
    if (!onActiveCoordinatorPage && !onTargetExecutorPage)
      throw Error("Создание передачи разрешено только со страницы активного Координатора.");
    await assertCampaignDispatchAllowed(p);
    buttonText("Читаю текст задания из Drive…");
    const body = await getFile(pid);
    if (!body.trim()) throw Error("Payload пуст.");
    const pending = await GM_getValue(C.pendingDispatch, null);
    const reusablePending =
      !retryRunning &&
      pending?.dispatchId === p.id &&
      pending?.payloadId === pid &&
      /^[0-9a-f-]{36}$/i.test(String(pending?.runId || ""));
    const run = reusablePending ? pending.runId : crypto.randomUUID();
    if (!retryRunning) {
      // Persist the idempotency key before the non-transactional Drive call. If the
      // gateway creates the file but its response times out, the next manual click
      // reuses this Run ID and createLog returns the same file instead of making a ghost.
      await GM_setValue(C.pendingDispatch, {
        dispatchId: p.id,
        payloadId: pid,
        runId: run,
        createdAt: reusablePending ? pending.createdAt : Date.now(),
      });
      // A fresh Ready dispatch starts a new logical attempt budget; only retryRunning
      // carries the current Run's existing count forward.
      await GM_setValue(autoCountKey(p.id), 0);
      await GM_setValue(`${C.reloadCountPrefix}${p.id}`, 0);
    }
    buttonText(reusablePending ? "Возобновляю создание того же лога…" : "Создаю отдельный лог…");
    const log = await createRunLog(p.id, run);
    if (!log?.fileId) throw Error("Шлюз не вернул ID отдельного лога Dispatch-Run.");
    // Dispatch-Run logs are for the Executor's submitted answer. Do not capture
    // the Coordinator page's latest assistant message as if it were agent output.
    const campaign = await campaignForTask(p);
    const prompt = `${body.trimEnd()}${technicalHandoffFooter(role, p.id, run, campaign)}`;
    const answer = retryRunning
      ? `Повторный запуск после незавершённой попытки. Предыдущий Run ${previousRun} сохранён в журнале https://drive.google.com/file/d/${previousLog}/view; текущая попытка — ${run}.`
      : undefined;
    buttonText(retryRunning ? "Готовлю повторный запуск…" : "Отмечаю задачу Running…");
    await patch(
      p.id,
      props("Running", {
        run,
        recipient: rid,
        start: new Date().toISOString(),
        out: log.fileId,
        ...(answer ? { answer } : {}),
      }),
    );
    if (!retryRunning) await GM_setValue(C.pendingDispatch, null);
    const automatic = await autoEnabled();
    try {
      buttonText("Сохраняю ссылку на лог…");
      await recordRunLog(p.id, p.id, run, log);
      buttonText("Подготавливаю задание для агента…");
      if (automatic) {
        await GM_setValue(C.pendingPrompt, { dispatchId: p.id, runId: run, agentId: rid, roleName: rname, prompt, preparedAt: Date.now() });
      } else {
        await GM_setValue(C.manualPrepared, null);
        await GM_setValue(C.pendingPrompt, { dispatchId: p.id, runId: run, agentId: rid, roleName: rname, prompt, preparedAt: Date.now(), manual: true });
      }
    } catch (e) {
      const q = await fresh(p.id);
      if (!retryRunning && state(q) === "Running" && runId(q) === run)
        await patch(p.id, props("Ready", { run: "", out: "" }));
      throw e;
    }
    toast(
      automatic
        ? `Задача «${title(p)}» подготовлена для отправки агенту ${rname}.`
        : retryRunning
          ? `Новая попытка задачи «${title(p)}» запущена для ${rname}: старый Run сохранён, создан новый Run ID и отдельный лог. После перехода задание будет вставлено и один раз отправлено; автоповторов не будет.`
          : `Задача «${title(p)}» отмечена Running. На странице ${rname} задание будет вставлено и один раз отправлено автоматически; повторов в ручном режиме не будет.`,
    );
    location.assign(role.url);
  }
  async function submitAgent(id, role, task, captured) {
    buttonText("Сверяю запуск с Notion…");
    const p = await fresh(task.id),
      run = runId(p);
    const pending = await GM_getValue(C.pendingPrompt, null);
    const currentState = state(p);
    const allowSelfSubmitted = currentState === "Submitted" && !taskHasScriptCatSubmittedAnswer(p, captured?.messageId);
    if (
      (currentState !== "Running" && !allowSelfSubmitted) ||
      !taskMatchesExecutorRole(p, role, id) ||
      !run
    )
      throw Error(
        "Notion не подтверждает активную Running-задачу для этого агента. Ничего не отправлено.",
      );
    buttonText("Проверяю конечный маркер…");
    const result = agentResult(captured.text);
    const adoptedSameDispatch = result.dispatch_id === p.id &&
      result.status === "submitted" &&
      ((pending && !pending.sentAt && pending.dispatchId === p.id) || allowSelfSubmitted);
    if (
      result.dispatch_id !== p.id ||
      (result.run_id !== run && !adoptedSameDispatch) ||
      result.status !== "submitted"
    )
      throw Error(
        "Маркер не совпадает с текущими Dispatch/Run ID. Задача осталась Running; лог не отправлен.",
      );
    const initialLog = outputId(p);
    if (!initialLog) throw Error("В Notion не указан отдельный лог Dispatch-Run.");
    const co = (await roleList()).find((x) => x.dispatchFunction === "Coordinator");
    if (!co?.url)
      throw Error("URL Координатора отсутствует в Notion; ответ не отправлен.");

    logEvent(`Проверен ответ ${role.name}: ${captured.text.length} символов, chat-message-${captured.messageId}.`);
    buttonText("Сохраняю ответ в Google Drive…");
    const { appendResult, logId: log, recovered } = await appendWithRunLogFallback(
      initialLog,
      p.id,
      run,
      role.name,
      id,
      captured.text,
      captured.messageId,
    );
    if (!["appended", "duplicate"].includes(appendResult)) throw Error(`Неожиданный ответ Drive append: ${String(appendResult)}`);
    if (recovered && log !== initialLog) {
      logEvent(`Создан/восстановлен текстовый лог Dispatch-Run (${log}) взамен перезаписанного файла ${initialLog}.`);
      try {
        await recordRunLog(p.id, p.id, run, { fileId: log });
      } catch (recordErr) {
        console.warn("[CF] Could not append recovered run log link to Notion blocks", recordErr);
      }
    }
    logEvent(appendResult === "duplicate" ? "Запись уже была в Drive; повторная копия не создана." : "Текст ответа записан в Drive.");
    buttonText("Отмечаю Submitted в Notion…");
    await patch(
      p.id,
      props("Submitted", {
        recipient: id,
        out: log,
        submit: new Date().toISOString(),
        answer: `Ответ взят из chat-message-${captured.messageId} агента ${id} и записан в Dispatch-Run; ожидается Координатор.`,
      }),
    );
    if (pending?.dispatchId === p.id) await GM_setValue(C.pendingPrompt, null);
    await GM_setValue(autoCountKey(p.id), 0);
    await GM_setValue(`${C.reloadCountPrefix}${p.id}`, 0);
    closeCompletionPanel();
    buttonText("Готово — открываю Координатора…");
    const campaign = await campaignForTask(p);
    const turn = createCoordinatorTurn({ coordinatorId: co.id, campaignId: campaign.id, dispatchId: p.id, runId: run, kind: "dispatch-review" });
    const coordinatorNote = `Координатор, завершена задача «${title(p)}» от ${role.name}.\nЛог Dispatch-Run: https://drive.google.com/file/d/${log}/view\nDispatch ID: ${p.id}\nRun ID: ${run}\nОтвет записан в Drive и отмечен Submitted. Проверьте этот лог. Свой вердикт допишите напрямую в тот же Drive-файл и обновите Dispatch State и «Ответ» в Notion. Userscript вердикт Координатора не переносит. Затем проверь текущую очередь этой кампании: если Ready уже есть, оставь её для автоматического запуска; если Ready и Submitted/Running нет — создай следующую задачу только в этой кампании либо, только при выполнении критериев, установи «Состояние команды» = «Завершена — ждёт Мастера». Критерии и страница кампании: ${campaignCompletionCriteria(campaign) || "НЕ ЗАПОЛНЕНЫ — кампанию завершать нельзя."} — ${campaign.url || `https://app.notion.com/p/${String(campaign.id).replaceAll("-", "")}`}. Не запускай следующую кампанию.\n\n---\n${roleContextText(co)}\n---${coordinatorTurnFooter(turn)}`;
    await GM_setValue(C.pendingCoordinatorNote, {
      kind: "dispatch-review",
      coordinatorId: co.id,
      dispatchId: p.id,
      runId: run,
      logId: log,
      campaignId: campaign.id,
      turn,
      note: coordinatorNote,
      preparedAt: Date.now(),
    });
    toast(
      `Ответ ${role.name} записан в Dispatch-Run; Notion → Submitted. Открываю Координатора.`,
    );
    location.assign(co.url);
  }
  async function run(capturedOverride = null) {
    if (await isActionLockHeld()) throw await actionLockError();
    const lockOwner = await acquireActionLock("ручная/автоматическая передача ответа или выдача задачи");
    buttonText("Проверяю роль и очередь в Notion…");
    try {
      if (new URL(location.href).searchParams.has("cf-auth-setup")) {
        await gateway("ping", "");
        toast(
          "Google Drive-шлюз доступен. Буфер обмена и состояние задачи не затронуты.",
        );
        return;
      }
      const m = location.pathname.match(/\/agent\/([\w-]+)/);
      if (!m) throw Error("Откройте страницу Arena /agent/<id>.");
      const id = m[1],
        roles = await roleList(),
        role = roles.find((x) => norm(x.id) === norm(id));
      if (!role) throw Error("Agent ID не зарегистрирован в Notion «Роли».");
      idleButtonText(
        role.dispatchFunction === "Coordinator"
          ? "Выдать задание / продолжить передачу"
          : "Сохранить ответ / передать Координатору",
      );
      if (role.dispatchFunction === "Coordinator") {
        buttonText("Проверяю Submitted-передачи…");
        const s = await tasks("Submitted");
        if (s.length) {
          const p = s[0];
          if (!runId(p) || !(recipient(p) || recipientRole(p)) || !outputId(p))
            throw Error(`Первая Submitted-задача в очереди «${title(p)}» неполная; исправьте её в Notion перед продолжением.`);
          const remaining = s.length - 1;
          toast(
            `Следующая задача к проверке: «${title(p)}». Откройте лог https://drive.google.com/file/d/${outputId(p)}/view (Dispatch ${p.id}, Run ${runId(p)}), внесите вердикт в этот же файл и обновите Dispatch State и «Ответ» в Notion.${remaining ? ` После неё ожидают ещё ${remaining} Submitted-задач.` : ""} Затем нажмите кнопку для следующего шага очереди.`,
          );
          return;
        }
        buttonText("Проверяю незавершённые попытки…");
        const running = (await tasks("Running")).filter(
          (p) => (recipientRole(p) || recipient(p)) && payloadId(p),
        );
        if (running.length > 1)
          throw Error(
            "Есть несколько Running-задач. Выберите нужную в Notion или завершите лишние; автоматический повтор неоднозначен.",
          );
        if (running.length === 1) {
          await dispatch(running[0], roles, { retryRunning: true });
          return;
        }
        const r = await tasks("Ready");
        if (!r.length) {
          toast("Нет подходящей Ready-задачи.");
          return;
        }
        if (r.length > 1) {
          const sequence = taskSequence(r[0]);
          logEvent(`В очереди ${r.length} Ready-задач; запускаю первую по Sequence ${Number.isFinite(sequence) ? sequence : "(без номера — после пронумерованных)"}.`);
        }
        await dispatch(r[0], roles);
        return;
      }
      if (role.dispatchFunction !== "Executor")
        throw Error("Эта роль не имеет функции Executor в реестре Notion.");
      buttonText("Ищу Running-задачу для этого агента…");
      const runningForRole = (await tasks("Running")).filter(
        (p) =>
          taskMatchesExecutorRole(p, role, id) &&
          runId(p) &&
          outputId(p),
      );
      const selfSubmittedForRole = runningForRole.length
        ? []
        : (await tasks("Submitted")).filter(
          (p) =>
            taskMatchesExecutorRole(p, role, id) &&
            runId(p) &&
            outputId(p) &&
            !taskHasScriptCatSubmittedAnswer(p),
        );
      const q = runningForRole.length ? runningForRole : selfSubmittedForRole;
      if (q.length !== 1)
        throw Error(
          q.length
            ? "Для этого агента найдено несколько Running-задач; ничего не записано."
            : "Для этого агента нет Running-задачи. Откройте страницу Координатора, чтобы выдать или повторить задание.",
        );
      buttonText("Считываю последнее сообщение агента…");
      const captured = capturedOverride || captureAssistantMessage();
      const parsedResult = tryParseAgentResult(captured.text);
      const pendingPrompt = await currentPendingForPage();
      const manualPrepared = pendingPrompt ? null : await GM_getValue(C.manualPrepared, null);
      const adoptedCompletion = isAdoptedExecutorRunCompletion(captured, parsedResult, pendingPrompt)
        || (state(q[0]) === "Submitted" && !taskHasScriptCatSubmittedAnswer(q[0], captured.messageId) && parsedResult?.dispatch_id === q[0].id && parsedResult?.status === "submitted");
      const freshAfterSend = isFreshExecutorMessage(captured.messageId, pendingPrompt)
        || isFreshManualExecutorMessage(captured.messageId, manualPrepared)
        || adoptedCompletion;
      if (!freshAfterSend)
        throw Error("Последнее сообщение не подтверждено как ответ после отправки текущего Dispatch/Run; ничего не записано, состояние оставлено без изменений.");
      if (pendingPrompt && (pendingPrompt.dispatchId !== q[0].id || (pendingPrompt.runId !== runId(q[0]) && !adoptedCompletion)))
        throw Error("Сохранённая отправка относится к другому Dispatch/Run; ничего не записано.");
      if (!pendingPrompt && !adoptedCompletion && !manualPreparedMatchesRun(manualPrepared, q[0].id, runId(q[0])))
        throw Error("Сохранённая ручная отправка относится к другому Dispatch/Run; ничего не записано.");
      await submitAgent(id, role, q[0], captured);
    } finally {
      await releaseActionLock(lockOwner);
    }
  }
  let autoSendTimer = null;
  let autoSendInFlight = false;
  let autoDispatchTimer = null;
  let autoCoordinatorBusy = false;
  let autoReviewNoticeKey = "";
  let pauseAutomationBusy = false;
  async function stopAutomation(reason, { clearHandoff = true, sound = true, title = "Chronicle Forge: automation stopped" } = {}) {
    await GM_setValue(C.autoMode, false);
    await GM_setValue(C.autoPaused, false);
    if (clearHandoff) {
      await GM_setValue(C.pendingCoordinatorNote, null);
      await GM_setValue(C.pendingCoordinatorTurn, null);
      await GM_setValue(C.coordinatorNeedsAdoption, null);
    }
    logEvent(reason, true, { urgent: true, title });
    if (sound) playMasterAlert();
    const b = document.getElementById(C.modeButton);
    if (b) {
      b.textContent = "Запустить автоочередь";
      b.style.background = "#454545";
      b.setAttribute("aria-pressed", "false");
    }
    updateManualButtonVisibility(false);
    void refreshCoordinatorResetButton();
  }
  async function pauseAutomation(reason, context = null) {
    if (pauseAutomationBusy) return;
    pauseAutomationBusy = true;
    try {
      if (await autoIsPaused()) return;
      await GM_setValue(C.autoPauseContext, { ...(context || {}), kind: context?.kind || "generic", reason: String(reason), at: Date.now() });
      await GM_setValue(C.autoPaused, true);
      toast(`Автоматизация остановлена и ждёт человека: ${reason}`, true, { skipNtfy: true });
      playMasterAlert();
      void notifyNtfy(`Требуется внимание Мастера: ${reason}`, { urgent: true, title: "Chronicle Forge: automation paused" });
      const b = document.getElementById(C.modeButton);
      if (b) b.textContent = "Возобновить автоочередь";
      void refreshCoordinatorResetButton();
    } finally {
      pauseAutomationBusy = false;
    }
  }
  async function currentPendingForPage() {
    const pending = await GM_getValue(C.pendingPrompt, null);
    if (!pending) return null;
    const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
    if (!id) return null;
    if (norm(pending.agentId) === norm(id)) return pending;
    if (!pending.roleName) return null;
    const roles = await roleList();
    const role = roles.find((item) => norm(item.id) === norm(id));
    if (role && role.dispatchFunction === "Executor" && role.name === pending.roleName) {
      pending.agentId = id;
      await GM_setValue(C.pendingPrompt, pending);
      return pending;
    }
    return null;
  }
  let manualPrepareInFlight = false;
  let manualPrepareNoticeKey = "";
  let manualPrepareBlocked = null;
  function manualSendReady() {
    return isSendButtonReady(sendButton());
  }
  async function sendPreparedManualPrompt(editor, pending, key, roleName) {
    const button = await waitForSendButton(1000);
    if (!button) {
      const current = composerKey(editor.innerText || editor.textContent);
      if (manualPrepareBlocked?.key !== key || manualPrepareBlocked.current !== current)
        logEvent("Задание подготовлено, но кнопка Send пока недоступна; ожидаю её появления. Повторная отправка не выполняется.", true);
      manualPrepareBlocked = { key, agentId: pending.agentId, current, waitingSend: true };
      return false;
    }
    // Persist one-shot send intent plus a pre-send transcript baseline. Keep the
    // sent correlation until the response is submitted so manual-mode replies
    // remain verifiably fresh after the send itself.
    const sentAt = Date.now();
    const baselineMessageIds = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]'))
      .map((message) => message.id);
    const sentPrompt = { ...pending, sentAt, baselineMessageIds, manual: true };
    await GM_setValue(C.manualPrepared, { key, preparedAt: sentAt, sentAt, baselineMessageIds, sent: true });
    await GM_setValue(C.pendingPrompt, sentPrompt);
    button.click();
    manualPrepareBlocked = null;
    manualPrepareNoticeKey = key;
    logEvent(`Задание для ${roleName} отправлено нажатием Send в ручном режиме; автоповторов не будет.`);
    return true;
  }
  async function prepareManualPrompt() {
    if (manualPrepareInFlight || (await autoEnabled()) || (await autoIsPaused())) return;
    const agentId = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
    if (!agentId) return;
    const quickPending = await currentPendingForPage();
    if (manualPrepareBlocked) {
      const sameRun = quickPending &&
        `${quickPending.dispatchId}:${quickPending.runId}` === manualPrepareBlocked.key;
      const current = findComposer();
      const unchanged = current &&
        composerKey(current.innerText || current.textContent) === manualPrepareBlocked.current;
      const sendBecameReady = manualPrepareBlocked.waitingSend && manualSendReady();
      if (sameRun && unchanged && !sendBecameReady) return;
      manualPrepareBlocked = null;
    }
    manualPrepareInFlight = true;
    try {
      const roles = await roleList();
      const role = roles.find((item) => norm(item.id) === norm(agentId));
      if (!role || role.dispatchFunction !== "Executor") return;
      let pending = quickPending;
      if (!pending) {
        // Recovery path for a manual Running task created by an earlier userscript version.
        const candidates = (await tasks("Running")).filter((task) =>
          taskMatchesExecutorRole(task, role, agentId) &&
          runId(task) && outputId(task) && payloadId(task),
        );
        if (candidates.length !== 1) return;
        const task = candidates[0];
        const key = `${task.id}:${runId(task)}`;
        const alreadyPrepared = await GM_getValue(C.manualPrepared, null);
        if (alreadyPrepared?.key === key) return;
        const body = await getFile(payloadId(task));
        if (!body.trim()) throw Error("Payload пуст; ручная подготовка остановлена.");
        const campaign = await campaignForTask(task);
        const prompt = `${body.trimEnd()}${technicalHandoffFooter(role, task.id, runId(task), campaign)}`;
        pending = { dispatchId: task.id, runId: runId(task), agentId, roleName: role.name, prompt, preparedAt: Date.now(), manual: true };
        await GM_setValue(C.pendingPrompt, pending);
      }
      if (typeof pending.prompt !== "string")
        throw Error("В сохранённой ручной передаче нет текста задания; подготовка остановлена.");
      if (!pending.prompt.includes("КОНТЕКСТ РОЛИ И ГЛОБАЛЬНОГО МАНДАТА")) {
        pending = {
          ...pending,
          prompt: `${pending.prompt.trimEnd()}\n\n---\n${roleContextText(role)}\n---`,
        };
        await GM_setValue(C.pendingPrompt, pending);
      }
      const task = await fresh(pending.dispatchId);
      if (
        state(task) !== "Running" || runId(task) !== pending.runId ||
        !taskMatchesExecutorRole(task, role, agentId)
      ) {
        await GM_setValue(C.pendingPrompt, null);
        logEvent("Ручная подготовка остановлена: Notion не подтверждает активный Dispatch/Run для этой роли.", true);
        return;
      }
      const key = `${task.id}:${runId(task)}`;
      if ((await GM_getValue(C.manualPrepared, null))?.key === key) return;
      const panelClosed = closeCompletionPanel();
      if (panelClosed === false) {
        if (manualPrepareNoticeKey !== key) {
          logEvent("Плашка завершённой задачи перекрывает редактор; закройте её вручную, задание сохранено и не отправлено.", true);
          manualPrepareNoticeKey = key;
        }
        setTimeout(scheduleAutoSend, 1500);
        return;
      }
      if (panelClosed) await new Promise((resolve) => setTimeout(resolve, 350));
      const editor = findComposer();
      if (!editor) {
        if (manualPrepareNoticeKey !== key) {
          logEvent("Ожидаю редактор агента для вставки задания; оно не отправлено.");
          manualPrepareNoticeKey = key;
        }
        setTimeout(scheduleAutoSend, 1500);
        return;
      }
      const current = (editor.innerText || editor.textContent || "").trim();
      if (current && !sameComposerText(current, pending.prompt)) {
        const currentKey = composerKey(current);
        if (manualPrepareBlocked?.key !== key || manualPrepareBlocked.current !== currentKey)
          logEvent("В редакторе уже есть другой текст; он не перезаписан. Очистите или замените его, затем повторите действие вручную.", true);
        manualPrepareBlocked = { key, agentId, current: currentKey };
        manualPrepareNoticeKey = key;
        return;
      }
      if (current && sameComposerText(current, pending.prompt)) {
        await sendPreparedManualPrompt(editor, pending, key, role.name);
        return;
      }
      fillComposer(editor, pending.prompt);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const filled = (editor.innerText || editor.textContent || "").trim();
      if (!sameComposerText(filled, pending.prompt)) {
        const currentKey = composerKey(filled);
        if (manualPrepareBlocked?.key !== key || manualPrepareBlocked.current !== currentKey)
          logEvent("Вставка не подтвердилась: содержимое редактора изменилось. Текст не отправлен; проверьте редактор, очистите его и повторите.", true);
        manualPrepareBlocked = { key, agentId, current: currentKey };
        manualPrepareNoticeKey = key;
        return;
      }
      await sendPreparedManualPrompt(editor, pending, key, role.name);
    } finally {
      manualPrepareInFlight = false;
    }
  }
  async function scheduleAutoSend() {
    if (autoSendTimer || autoSendInFlight || !/\/agent\/[\w-]+/.test(location.pathname)) return;
    autoSendTimer = setTimeout(async () => {
      autoSendTimer = null;
      if (autoSendInFlight) return;
      autoSendInFlight = true;
      let automatic = false;
      try {
        if (await autoIsPaused()) return;
        automatic = await autoEnabled();
        if (!automatic || !(await autoEnabled())) {
          await prepareManualPrompt();
          return;
        }
        const pending = await currentPendingForPage();
        if (!pending || pending.sentAt) return;
        if (generatingNow()) return;
        const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        const roles = await roleList();
        const role = roles.find((item) => norm(item.id) === norm(id));
        const task = await fresh(pending.dispatchId);
        let completedForSameDispatch = false;
        try {
          const latest = captureLatestRenderedAssistantMessage();
          const parsed = tryParseAgentResult(latest.text);
          if (parsed && parsed.dispatch_id === pending.dispatchId && parsed.status === "submitted") {
            completedForSameDispatch = true;
          }
        } catch {
          // No completed assistant message with CF_AGENT_RESULT yet.
        }
        if (completedForSameDispatch || (taskMatchesExecutorRole(task, role, id) && ["Submitted", "Accepted"].includes(state(task)))) {
          logEvent("Задача уже имеет готовый ответ или переведена в Submitted; повторная отправка промпта не требуется, запускаю сохранение ответа.", false, { skipNtfy: true });
          scheduleAutoSubmit();
          return;
        }
        if (state(task) !== "Running" || runId(task) !== pending.runId || !taskMatchesExecutorRole(task, role, id)) {
          await GM_setValue(C.pendingPrompt, null);
          await pauseAutomation("Notion не подтверждает текущий Run; автоматическое действие остановлено.");
          return;
        }
        if (hasVisibleOptionalCard() && !(await clickVisibleOptionalSkip())) {
          await pauseAutomation("Не удалось автоматически закрыть карточку опроса/аудио кнопкой Skip; автоматизация остановлена для проверки.");
          return;
        }
        const panelClosed = closeCompletionPanel();
        if (panelClosed === false) {
          await pauseAutomation("Плашка завершения перекрывает ввод; закройте её вручную. Задание и промпт сохранены.");
          return;
        }
        if (panelClosed) await new Promise((resolve) => setTimeout(resolve, 350));
        const editor = findComposer();
        if (!editor) { await pauseAutomation("Редактор не найден; задание и промпт сохранены для проверки человеком."); return; }
        const currentText = (editor.innerText || editor.textContent || "").trim();
        if (currentText && !sameComposerText(currentText, pending.prompt)) {
          await pauseAutomation("В редакторе уже есть другой текст. Он не перезаписан; проверьте задание вручную.");
          return;
        }
        if (!currentText) fillComposer(editor, pending.prompt);
        await new Promise((resolve) => setTimeout(resolve, 350));
        const filled = (editor.innerText || editor.textContent || "").trim();
        if (!sameComposerText(filled, pending.prompt)) {
          await pauseAutomation("Текст задания не подтвердился в редакторе; он не отправлен.");
          return;
        }
        const button = await waitForSendButton();
        if (!button) {
          const candidates = sendButtonDiagnostics();
          debugConsole(`send-button-not-ready:${pending.dispatchId}:${pending.runId}`, "send button not actionable after prompt fill", {
            dispatchId: pending.dispatchId,
            runId: pending.runId,
            candidateCount: candidates.length,
            candidates,
          });
          throw Error("Не удалось подтвердить доступную кнопку Send за 1,8 с ожидания; текст оставлен в редакторе, отправка не выполнена.");
        }
        if (!(await autoEnabled()) || (await autoIsPaused())) return;
        const messages = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]')).map((m) => m.id);
        const count = Number(await GM_getValue(autoCountKey(pending.dispatchId), 0)) || 0;
        if (count >= AUTO.maxSends) {
          await pauseAutomation("Достигнут предел в две отправки (исходная и один повтор) без маркера завершения.");
          return;
        }
        const unsentPending = { ...pending };
        pending.sentAt = Date.now();
        pending.baselineMessageIds = messages;
        pending.sendOrdinal = count + 1;
        await GM_setValue(autoCountKey(pending.dispatchId), count + 1);
        await GM_setValue(C.pendingPrompt, pending);
        const restoreUnsentIntent = async () => {
          await GM_setValue(autoCountKey(pending.dispatchId), count);
          await GM_setValue(C.pendingPrompt, unsentPending);
        };
        if (!(await autoEnabled()) || (await autoIsPaused())) {
          await restoreUnsentIntent();
          return;
        }
        const latestButton = sendButton();
        if (!isSendButtonReady(latestButton)) {
          await restoreUnsentIntent();
          const candidates = sendButtonDiagnostics();
          debugConsole(`send-button-lost:${pending.dispatchId}:${pending.runId}`, "send button changed before click", {
            dispatchId: pending.dispatchId,
            runId: pending.runId,
            candidateCount: candidates.length,
            candidates,
          });
          throw Error("Кнопка Send изменилась до клика; текст оставлен в редакторе, отправка не выполнена.");
        }
        if (autoSubmitTimer) {
          clearTimeout(autoSubmitTimer);
          autoSubmitTimer = null;
        }
        latestButton.click();
        toast(`Задание отправлено кнопкой Send (попытка ${count + 1} из ${AUTO.maxSends}); ожидаю ответ.`);
      } catch (error) {
        console.error(automatic ? "[CF auto-send]" : "[CF manual-prompt]", error);
        if (automatic) await pauseAutomation(`Задание не отправлено: ${error.message || error}`);
        else toast(`Не удалось вставить задание в редактор; оно не отправлено: ${error.message || error}`, true);
      } finally {
        autoSendInFlight = false;
      }
    }, 1300);
  }
  async function retryPending(pending, reason) {
    const currentTask = await fresh(pending.dispatchId);
    const currentState = state(currentTask);
    const sameRun = runId(currentTask) === pending.runId;
    if (currentState === "Submitted" && sameRun) return;
    if (currentState !== "Running" || !sameRun) {
      const storedPending = await GM_getValue(C.pendingPrompt, null);
      if (storedPending?.dispatchId === pending.dispatchId && storedPending?.runId === pending.runId) {
        await GM_setValue(C.pendingPrompt, null);
        logEvent("Сохранённая автоматическая попытка устарела: Dispatch больше не Running или уже имеет другой Run. Повтор не отправлен.", false, { skipNtfy: true });
      }
      return;
    }
    const count = Number(await GM_getValue(autoCountKey(pending.dispatchId), 0)) || 0;
    if (count >= AUTO.maxSends) {
      await pauseAutomation(`${reason}; выполнены обе разрешённые отправки без маркера завершения.`);
      return;
    }
    if (await isActionLockHeld()) return;
    const lockOwner = await acquireActionLock("автоподготовка повтора отправки задачи");
    try {
      const task = await fresh(pending.dispatchId);
      if (state(task) !== "Running" || runId(task) !== pending.runId) {
        await pauseAutomation("Состояние Dispatch/Run изменилось; повтор остановлен для проверки Координатором.");
        return;
      }
      const roles = await roleList();
      await dispatch(task, roles, { retryRunning: true });
      toast(`Подготовлена новая попытка: ${reason}.`);
    } catch (error) {
      await pauseAutomation(`Не удалось безопасно подготовить повтор: ${error.message || error}`);
    } finally {
      await releaseActionLock(lockOwner);
    }
  }
  async function monitorVisibleChatError() {
    if (await autoIsPaused()) return false;
    const detected = latestUserMessageAlert();
    if (detected) {
      const text = detected.errorText.replace(/\s+/g, " ").slice(0, 300) || "текст ошибки пуст";
      await pauseAutomation(`Видимая ошибка Arena в последнем сообщении: ${text}. Автоматический режим остановлен; требуется Мастер.`);
      return true;
    }
    const genericError = detectVisibleErrorCard();
    if (genericError) {
      const text = String(genericError.innerText || genericError.textContent || "").trim().replace(/\s+/g, " ").slice(0, 300);
      await pauseAutomation(`Необработанная ошибка интерфейса: ${text || "текст ошибки пуст"}. Автоматический режим остановлен; требуется Мастер.`);
      return true;
    }
    return false;
  }
  let monitorPendingInFlight = false;
  async function monitorPending() {
    if (monitorPendingInFlight) return;
    monitorPendingInFlight = true;
    try {
      if (await monitorVisibleChatError()) return;
      if (!(await autoEnabled()) || (await autoIsPaused())) return;
      const pending = await currentPendingForPage();
      if (!pending?.sentAt) return;
      if (hasVisibleOptionalCard()) {
        if (!(await clickVisibleOptionalSkip())) {
          await pauseAutomation("Не удалось автоматически закрыть карточку опроса/аудио кнопкой Skip; автоматизация остановлена для проверки.");
        }
        return;
      }
      const all = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]'));
      const freshMessages = all.filter(
        (m) => !pending.baselineMessageIds?.includes(m.id) && !isUserTranscriptMessage(m),
      );
      if (generatingNow()) return;
      const now = Date.now();
      const last = freshMessages.at(-1);
      if (last) {
        const text = extractRenderedMessageProse(last) || (last.innerText || "").trim();
        if (isDispatchedPromptEcho(text)) return;
        let marker = null;
        try { marker = agentResult(text); } catch {}
        if (
          marker?.dispatch_id === pending.dispatchId &&
          marker?.run_id === pending.runId &&
          marker?.status === "submitted"
        ) {
          return;
        }
        const signature = `${last.id}:${text.length}:${text.slice(-160)}`;
        if (pending.lastSignature !== signature) {
          pending.lastSignature = signature;
          pending.lastChangeAt = now;
          await GM_setValue(C.pendingPrompt, pending);
          return;
        }
        if (now - (pending.lastChangeAt || pending.sentAt) >= AUTO.idleMs) await retryPending(pending, "ответ остановился без правильного маркера завершения");
      } else if (now - pending.sentAt >= AUTO.noStartMs) {
        await retryPending(pending, "ответ не появился после отправки");
      }
    } finally {
      monitorPendingInFlight = false;
    }
  }
  let coordinatorHandoffTimer = null;
  let coordinatorHandoffBusy = false;
  let coordinatorHandoffNotice = "";
  async function scheduleCoordinatorHandoff() {
    if (coordinatorHandoffTimer || coordinatorHandoffBusy) return;
    let pending = await GM_getValue(C.pendingCoordinatorNote, null);
    if (!pending) return;
    const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
    if (!id) return;
    coordinatorHandoffTimer = setTimeout(async () => {
      coordinatorHandoffTimer = null;
      if (coordinatorHandoffBusy) return;
      coordinatorHandoffBusy = true;
      try {
        const roles = await roleList();
        const role = roles.find((item) => norm(item.id) === norm(id));
        if (!role || role.dispatchFunction !== "Coordinator") return;
        pending = await GM_getValue(C.pendingCoordinatorNote, null);
        if (!pending) return;
        if (!pending.coordinatorId || norm(pending.coordinatorId) !== norm(role.id)) {
          await clearForeignCoordinatorHandoffState(role.id);
          setTimeout(scheduleCoordinatorAuto, 250);
          return;
        }
        if (pending.blocked) return;
        if (pending.kind === "campaign-queue" || pending.kind === "cycle-check") {
          const campaign = await fresh(pending.campaignId);
          if (!campaign?.id) throw Error("Не удалось перечитать кампанию перед ходом Координатора.");
          const teamState = campaignTeamState(campaign);
          const campaignStatus = sel(campaign.properties?.["Статус"]);
          if (!isCampaignStatusActive(campaign)) {
            await stopAutomation(`Кампания больше не активна (статус «${campaignStatus || "не задан"}»); handoff отменён, следующая кампания не выбирается.`);
            return;
          }
          if (["Завершена — ждёт Мастера", "Ожидает решения Мастера"].includes(teamState)) {
            await stopAutomation(`Кампания уже отмечена в Notion как «${teamState}»; уведомление очереди отменено, цикл ждёт Мастера.`);
            return;
          }
          if (!pending.turn) pending.turn = createCoordinatorTurn({ coordinatorId: role.id, campaignId: campaign.id, kind: pending.kind });
          if (pending.kind === "campaign-queue") {
            const currentTasks = (await query(C.req)).filter((task) => !task.archived && !task.in_trash && campaignKeyFromTask(task) === campaignFolderKey(campaign));
            const hasPendingWork = currentTasks.some((task) => ["Ready", "Submitted", "Running"].includes(state(task)));
            if (hasPendingWork) {
              await GM_setValue(C.pendingCoordinatorNote, null);
              logEvent("Перед отправкой уведомления очередь повторно сверена: появилась Ready/Submitted/Running-задача, устаревший idle-prompt отменён.");
              setTimeout(scheduleCoordinatorAuto, 500);
              return;
            }
          }
          const criteria = campaignCompletionCriteria(campaign) || "НЕ ЗАПОЛНЕНЫ — завершать кампанию нельзя; запроси уточнение у Мастера.";
          const campaignUrl = campaign.url || `https://app.notion.com/p/${String(campaign.id).replaceAll("-", "")}`;
          const campaignTasks = (await query(C.req)).filter((task) => !task.archived && !task.in_trash && campaignKeyFromTask(task) === campaignFolderKey(campaign));
          const summary = campaignTasks.length ? campaignTasks.map((task) => `• ${title(task)} — ${state(task) || "без Dispatch State"}${outputId(task) ? ` — лог: https://drive.google.com/file/d/${outputId(task)}/view` : ""}`).join("\n") : "В Notion пока нет ни одного Dispatch для этой кампании.";
          const decision = pending.kind === "cycle-check"
            ? `Автоматика была включена во время уже идущего твоего ответа, а для него не было сохранено состояние хода. Ничего не отправляй повторно и не дублируй уже записанный вердикт. Проверь текущий Notion/Drive state; если Ready-задача уже есть, оставь её Ready; если Ready нет — создай следующую подходящую задачу только для этой кампании либо, только при выполнении критериев, установи «Состояние команды» = «Завершена — ждёт Мастера».`
            : `Сейчас нет Ready-задач и нет Running/Submitted-задач. Выбери и выполни ровно один путь: (1) создай/подготовь следующую подходящую задачу со статусом Ready; или (2) только если все динамические критерии действительно выполнены — установи «Состояние команды» = «Завершена — ждёт Мастера». Отсутствие Ready-задач само по себе не означает завершение.`;
          pending.note = `Координатор, активная кампания «${rt(campaign.properties?.["Кампания"])}».\n${decision}\nНе меняй статус самой кампании и не запускай следующую кампанию.\n\nТекущая очередь:\n${summary}\n\nКритерии завершения (актуальный источник истины из Notion):\n${criteria}\n\nСтраница кампании: ${campaignUrl}\n\nПосле сверки и внесения решения заверши ответ точным CF_COORDINATOR_RESULT из технического блока в конце сообщения. Если не можешь выбрать путь, напиши причину; автоматика остановится и попросит внимания Мастера.\n\n---\n${roleContextText(role)}\n---${coordinatorTurnFooter(pending.turn)}`;
          pending.campaignId = campaign.id;
          await GM_setValue(C.pendingCoordinatorNote, pending);
        } else if (pending.kind === "coordinator-marker-recovery") {
          if (!pending.turn || typeof pending.note !== "string" || !pending.originalKind)
            throw Error("Автоматическое продолжение хода Координатора неполно.");
          if (pending.turn.kind !== pending.originalKind)
            throw Error("Тип исходного хода Координатора не совпадает с ходом восстановления.");
          if (!pending.note.includes("КОНТЕКСТ РОЛИ И ГЛОБАЛЬНОГО МАНДАТА")) pending.note = `${pending.note.trimEnd()}\n\n---\n${roleContextText(role)}\n---`;
        } else if (pending.kind === "dispatch-preflight") {
          const task = await fresh(pending.dispatchId);
          if (!task?.id) throw Error("Preflight-задача удалена до уведомления Координатора.");
          if (!pending.turn) {
            const campaign = await campaignForTask(task);
            pending.campaignId = campaign.id;
            pending.turn = createCoordinatorTurn({ coordinatorId: role.id, campaignId: campaign.id, dispatchId: pending.dispatchId, kind: "dispatch-preflight" });
          }
          if (typeof pending.note !== "string") throw Error("В уведомлении о preflight-ошибке отсутствует текст.");
        } else {
          const task = await fresh(pending.dispatchId);
          if (state(task) !== "Submitted" || runId(task) !== pending.runId || outputId(task) !== pending.logId) {
            await GM_setValue(C.pendingCoordinatorNote, null);
            logEvent("Уведомление не отправлено: в Notion больше нет соответствующей Submitted-задачи.", true);
            return;
          }
          if (!pending.turn) {
            const campaign = await campaignForTask(task);
            pending.campaignId = campaign.id;
            pending.turn = createCoordinatorTurn({ coordinatorId: role.id, campaignId: campaign.id, dispatchId: pending.dispatchId, runId: pending.runId, kind: "dispatch-review" });
          }
          if (typeof pending.note !== "string") throw Error("В сохранённом уведомлении отсутствует текст.");
          if (!pending.note.includes("КОНТЕКСТ РОЛИ И ГЛОБАЛЬНОГО МАНДАТА")) pending.note = `${pending.note.trimEnd()}\n\n---\n${roleContextText(role)}\n---`;
        }
        const expectedCoordinatorMarker = `CF_COORDINATOR_RESULT ${JSON.stringify({ campaign_id: pending.turn.campaignId, turn_id: pending.turn.turnId, status: "completed", ...(pending.turn.dispatchId ? { dispatch_id: pending.turn.dispatchId } : {}), ...(pending.turn.runId ? { run_id: pending.turn.runId } : {}) })}`;
        if (!String(pending.note || "").includes(expectedCoordinatorMarker)) pending.note = `${String(pending.note || "").trimEnd()}${coordinatorTurnFooter(pending.turn)}`;
        await GM_setValue(C.pendingCoordinatorNote, pending);
        if (generatingNow()) {
          if (coordinatorHandoffNotice !== "generating") logEvent("Жду завершения текущей генерации Координатора перед передачей уведомления.");
          coordinatorHandoffNotice = "generating";
          setTimeout(scheduleCoordinatorHandoff, 1200);
          return;
        }
        const closeResult = closeCompletionPanel();
        if (closeResult === false) {
          if (coordinatorHandoffNotice !== "panel") logEvent("Закройте плашку завершения вручную; после этого подготовка уведомления продолжится.", true);
          coordinatorHandoffNotice = "panel";
          return;
        }
        if (closeResult) await new Promise((resolve) => setTimeout(resolve, 300));
        const editor = findComposer();
        if (!editor) {
          if (coordinatorHandoffNotice !== "editor") logEvent("Ожидаю появления редактора на странице Координатора; уведомление сохранено.");
          coordinatorHandoffNotice = "editor";
          setTimeout(scheduleCoordinatorHandoff, 1200);
          return;
        }
        const current = (editor.innerText || editor.textContent || "").trim();
        if (current && !sameComposerText(current, pending.note)) {
          pending.blocked = true;
          await GM_setValue(C.pendingCoordinatorNote, pending);
          if (coordinatorHandoffNotice !== "nonempty") logEvent("Редактор Координатора содержит другой текст; он не перезаписан. Уведомление оставлено в буфере для ручной отправки.", true);
          coordinatorHandoffNotice = "nonempty";
          return;
        }
        if (!current) fillComposer(editor, pending.note);
        await new Promise((resolve) => setTimeout(resolve, 350));
        const filled = (editor.innerText || editor.textContent || "").trim();
        if (!sameComposerText(filled, pending.note)) throw Error("Текст уведомления не подтвердился в редакторе.");
        let button = await waitForSendButton();
        if (pending.kind === "campaign-queue" && pending.notificationKey)
          await GM_setValue(pending.notificationKey, true);
        // Save the baseline and correlation before either a scripted or manual send.
        pending.turn.baselineMessageIds = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]')).map((message) => message.id);
        pending.turn.sentAt = Date.now();
        pending.turn.sentText = pending.note;
        if (!isSendButtonReady(button)) {
          pending.blocked = true;
          pending.manualFallback = true;
          await GM_setValue(C.pendingCoordinatorTurn, pending.turn);
          await GM_setValue(C.pendingCoordinatorNote, pending);
          logEvent("Текст уведомления сохранён, но Send недоступна. Отправьте его вручную один раз; дальнейший цикл ждёт CF_COORDINATOR_RESULT.", true);
          coordinatorHandoffNotice = "manual-send";
          return;
        }
        await GM_setValue(C.pendingCoordinatorTurn, pending.turn);
        await GM_setValue(C.pendingCoordinatorNote, pending);
        button = sendButton();
        if (!isSendButtonReady(button)) {
          pending.blocked = true;
          pending.manualFallback = true;
          await GM_setValue(C.pendingCoordinatorNote, pending);
          logEvent("Кнопка Send изменилась до клика; текст и ход сохранены. Отправьте уведомление вручную один раз; дальнейший цикл ждёт CF_COORDINATOR_RESULT.", true);
          coordinatorHandoffNotice = "manual-send";
          return;
        }
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const stillInComposer = sameComposerText((editor.innerText || editor.textContent || "").trim(), pending.note);
        if (generatingNow() || !stillInComposer) {
          await GM_setValue(C.pendingCoordinatorNote, null);
          coordinatorHandoffNotice = "";
          logEvent("Уведомление Координатору отправлено кнопкой Send; ожидаю CF_COORDINATOR_RESULT.");
        } else {
          pending.blocked = true;
          pending.manualFallback = true;
          await GM_setValue(C.pendingCoordinatorNote, pending);
          logEvent("Нажатие Send не подтвердилось; текст и ход сохранены. Отправьте текст вручную один раз; дальнейший цикл ждёт CF_COORDINATOR_RESULT.", true);
          coordinatorHandoffNotice = "manual-send";
        }
      } catch (error) {
        logEvent(`Не удалось подготовить текст Координатору: ${error.message || error}`, true);
      } finally {
        coordinatorHandoffBusy = false;
      }
    }, 500);
  }
  async function activeCampaignForQueue() {
    const rows = await query(C.campaigns);
    const active = rows.filter((campaign) => isCampaignStatusActive(campaign));
    if (active.length > 1) throw Error(`В Notion отмечено несколько активных кампаний (${active.length}); автоматическое определение очереди остановлено.`);
    return active[0] || null;
  }
  async function queueCampaignCompletionNotice(coordinator, campaign, campaignTasks) {
    const currentState = campaignTeamState(campaign);
    const criteria = campaignCompletionCriteria(campaign);
    if (["Завершена — ждёт Мастера", "Ожидает решения Мастера"].includes(currentState)) return;
    const taskSignature = campaignTasks
      .map((task) => `${task.id}:${state(task)}:${runId(task)}`)
      .sort()
      .join("|") || "no-dispatches";
    const key = `cf-campaign-coordinator-turn:${campaign.id}:${taskSignature}`;
    if (await GM_getValue(key, false)) return;
    const existing = await GM_getValue(C.pendingCoordinatorNote, null);
    if (existing?.kind === "campaign-queue" && existing.notificationKey === key) return;
    if (existing) {
      debugConsole(`queue-notice-pending:${campaign.id}`, "campaign coordinator turn deferred behind existing handoff", { campaignId: campaign.id, pendingKind: existing.kind || "dispatch-result" });
      return;
    }
    const turn = createCoordinatorTurn({ coordinatorId: coordinator.id, campaignId: campaign.id, kind: "campaign-queue" });
    const taskSummary = campaignTasks.length
      ? campaignTasks.map((task) => `• ${title(task)} — ${state(task) || "без Dispatch State"}`).join("\n")
      : "В Notion пока нет ни одного Dispatch для этой кампании.";
    const campaignUrl = campaign.url || `https://app.notion.com/p/${String(campaign.id).replaceAll("-", "")}`;
    const note = `Координатор, в активной кампании «${rt(campaign.properties?.["Кампания"])}» сейчас нет Ready-задач и нет Running/Submitted-задач. Текущий обзор очереди:\n${taskSummary}\n\nВыбери и выполни ровно один путь в Notion для ЭТОЙ кампании: (1) создай/подготовь следующую подходящую задачу со статусом Ready; или (2) только если все динамические критерии действительно выполнены — установи «Состояние команды» = «Завершена — ждёт Мастера». Отсутствие Ready-задач само по себе не означает завершение. Не меняй статус самой кампании и не запускай следующую кампанию.\n\nКритерии завершения (источник истины из Notion): ${criteria || "НЕ ЗАПОЛНЕНЫ — завершать кампанию нельзя; запроси уточнение у Мастера."}\nСтраница текущей кампании в Notion: ${campaignUrl}\n\nПосле внесения решения/изменений в Notion заверши этот ход точным CF_COORDINATOR_RESULT из технического блока в конце сообщения. Если не можешь ни создать Ready-задачу, ни подтвердить критерии — напиши причину; автоматика остановится и попросит внимания Мастера.\n\n---\n${roleContextText(coordinator)}\n---${coordinatorTurnFooter(turn)}`;
    await GM_setValue(C.pendingCoordinatorNote, {
      kind: "campaign-queue",
      coordinatorId: coordinator.id,
      campaignId: campaign.id,
      campaignKey: campaignFolderKey(campaign),
      notificationKey: key,
      turn,
      note,
      preparedAt: Date.now(),
    });
    logEvent("Нет Ready-задач: одноразовый ход Координатору подготовлен с критериями и ссылкой на текущую кампанию.");
    scheduleCoordinatorHandoff();
  }
  async function queueDispatchPreflightRepair(coordinator, task, reason) {
    if (await GM_getValue(C.pendingCoordinatorTurn, null) || await GM_getValue(C.pendingCoordinatorNote, null)) return;
    const current = await fresh(task.id);
    const campaign = await campaignForTask(current);
    const turn = createCoordinatorTurn({ coordinatorId: coordinator.id, campaignId: campaign.id, dispatchId: current.id, kind: "dispatch-preflight" });
    const pageUrl = current.url || `https://app.notion.com/p/${String(current.id).replaceAll("-", "")}`;
    const note = `Координатор, автоматическая подготовка задачи «${title(current)}» не прошла preflight-проверку, поэтому исполнитель не запускался.
Ошибка userscript: ${reason}
Dispatch: ${pageUrl} (ID ${current.id})

Проверь запись «Запросы» и исправь только её: адресат «Кому» должен соответствовать действующей роли Executor и её Arena Agent ID; payload должен быть реальным текстовым файлом Google Drive, а в Notion должны быть заполнены Payload Drive File ID и Payload Drive URL. Сформируй payload по содержимому задания/утверждённому ТЗ, сохрани ограничения кампании. Оставь Dispatch State = Ready только после проверки обоих обязательных полей. Не создавай дубликат задачи/пакета, не запускай кампанию заново, не помечай задачу Accepted и не меняй движок/main.

После правки заверши этот ход точным CF_COORDINATOR_RESULT из технического блока ниже. Скрипт повторно проверит запись и продолжит очередь только если адресат и payload валидны; если проблема осталась, он остановится и сообщит человеку.

---
${roleContextText(coordinator)}
---${coordinatorTurnFooter(turn)}`;
    await GM_setValue(C.pendingCoordinatorNote, { kind: "dispatch-preflight", coordinatorId: coordinator.id, dispatchId: current.id, campaignId: campaign.id, turn, note, preparedAt: Date.now() });
    logEvent(`Preflight-задача «${title(current)}» не отправлена; запрашиваю у Координатора адресное исправление.`);
    scheduleCoordinatorHandoff();
  }
  async function queueSubmittedReviewTurn(coordinator, task) {
    if (await GM_getValue(C.pendingCoordinatorTurn, null)) return;
    const existing = await GM_getValue(C.pendingCoordinatorNote, null);
    if (existing) return;
    const campaign = await campaignForTask(task);
    const turn = createCoordinatorTurn({ coordinatorId: coordinator.id, campaignId: campaign.id, dispatchId: task.id, runId: runId(task), kind: "dispatch-review" });
    const url = `https://drive.google.com/file/d/${outputId(task)}/view`;
    const campaignUrl = campaign.url || `https://app.notion.com/p/${String(campaign.id).replaceAll("-", "")}`;
    const note = `Координатор, для Submitted-задачи «${title(task)}» не найден ожидающий маркеризованный ход userscript. Проверь тот же лог: ${url} (Dispatch ${task.id}, Run ${runId(task)}). Если вердикт уже внесён в лог и Notion, не дублируй запись — только сверь итог; иначе заверши проверку, добавь вердикт в тот же лог и обнови Dispatch State/«Ответ». Затем проверь очередь: если Ready уже есть, оставь её для запуска; если Ready и Submitted/Running нет, создай следующую задачу только в текущей кампании либо, только при выполнении критериев, установи «Состояние команды» = «Завершена — ждёт Мастера». Критерии и страница кампании: ${campaignCompletionCriteria(campaign) || "НЕ ЗАПОЛНЕНЫ — кампанию завершать нельзя."} — ${campaignUrl}. Заверши этот ход маркером из технического блока ниже.\n\n---\n${roleContextText(coordinator)}\n---${coordinatorTurnFooter(turn)}`;
    await GM_setValue(C.pendingCoordinatorNote, { kind: "dispatch-review", coordinatorId: coordinator.id, dispatchId: task.id, runId: runId(task), logId: outputId(task), campaignId: campaign.id, turn, note, preparedAt: Date.now() });
    logEvent(`Для Submitted-задачи «${title(task)}» восстановлен одноразовый ход Координатора с маркером завершения.`);
    scheduleCoordinatorHandoff();
  }
  async function queueCoordinatorStateCheck(coordinator, campaign, campaignTasks) {
    if (await GM_getValue(C.pendingCoordinatorTurn, null)) return;
    const existing = await GM_getValue(C.pendingCoordinatorNote, null);
    if (existing) return;
    const turn = createCoordinatorTurn({ coordinatorId: coordinator.id, campaignId: campaign.id, kind: "cycle-check" });
    const criteria = campaignCompletionCriteria(campaign) || "НЕ ЗАПОЛНЕНЫ — завершать кампанию нельзя; запроси уточнение у Мастера.";
    const summary = campaignTasks.length ? campaignTasks.map((task) => `• ${title(task)} — ${state(task) || "без Dispatch State"}`).join("\n") : "В Notion пока нет ни одного Dispatch для этой кампании.";
    const campaignUrl = campaign.url || `https://app.notion.com/p/${String(campaign.id).replaceAll("-", "")}`;
    const note = `Координатор, автоматика была включена во время уже идущего твоего ответа, а для него не было сохранено состояние хода. Безопасная сверка текущей кампании «${rt(campaign.properties?.["Кампания"])}» (ничего не отправляй повторно и не дублируй уже записанный вердикт):\n${summary}\n\nПроверь существующие результаты и критерии завершения в Notion: ${campaignUrl}\nКритерии завершения (динамический источник истины):\n${criteria}\n\nЕсли есть валидная Ready-задача — оставь её Ready; если Ready-задач нет, создай следующую задачу только для этой кампании либо, только при выполнении всех критериев, установи «Состояние команды» = «Завершена — ждёт Мастера». Не меняй статус самой кампании и не запускай следующую кампанию. После сверки заверши ход точным маркером из технического блока ниже.\n\n---\n${roleContextText(coordinator)}\n---${coordinatorTurnFooter(turn)}`;
    await GM_setValue(C.pendingCoordinatorNote, { kind: "cycle-check", coordinatorId: coordinator.id, campaignId: campaign.id, turn, note, preparedAt: Date.now() });
    await GM_setValue(C.coordinatorNeedsAdoption, null);
    logEvent("Обнаружен Coordinator-turn без корреляции с новой версией; перед циклом сверяю текущий Notion state и ожидаю CF_COORDINATOR_RESULT.");
    scheduleCoordinatorHandoff();
  }
  let coordinatorQueueNoticeTimer = null;
  let coordinatorQueueNoticeBusy = false;
  let coordinatorQueueNoticeLastAt = 0;
  async function clearForeignCoordinatorHandoffState(activeCoordinatorId) {
    const turn = await GM_getValue(C.pendingCoordinatorTurn, null);
    if (turn && (!turn.coordinatorId || norm(turn.coordinatorId) !== norm(activeCoordinatorId)))
      await GM_setValue(C.pendingCoordinatorTurn, null);
    const note = await GM_getValue(C.pendingCoordinatorNote, null);
    if (note && (!note.coordinatorId || norm(note.coordinatorId) !== norm(activeCoordinatorId)))
      await GM_setValue(C.pendingCoordinatorNote, null);
    const adoption = await GM_getValue(C.coordinatorNeedsAdoption, null);
    if (adoption && (!adoption.coordinatorId || norm(adoption.coordinatorId) !== norm(activeCoordinatorId)))
      await GM_setValue(C.coordinatorNeedsAdoption, null);
  }
  async function scheduleCoordinatorQueueNotice() {
    if (coordinatorQueueNoticeTimer || coordinatorQueueNoticeBusy || Date.now() - coordinatorQueueNoticeLastAt < 12000 || !/\/agent\/[\w-]+/.test(location.pathname)) return;
    coordinatorQueueNoticeLastAt = Date.now();
    coordinatorQueueNoticeTimer = setTimeout(async () => {
      coordinatorQueueNoticeTimer = null;
      if (coordinatorQueueNoticeBusy || await isActionLockHeld()) return;
      coordinatorQueueNoticeBusy = true;
      let ownsActionLock = null;
      try {
        const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        const coordinator = (await roleList()).find((role) => norm(role.id) === norm(id));
        if (!coordinator || coordinator.dispatchFunction !== "Coordinator") return;
        await clearForeignCoordinatorHandoffState(coordinator.id);
        if (!(await autoEnabled()) || (await autoIsPaused())) return;
        if (await GM_getValue(C.pendingCoordinatorTurn, null) || await GM_getValue(C.pendingCoordinatorNote, null)) return;
        if (generatingNow()) return;
        if (await isActionLockHeld()) return;
        ownsActionLock = await acquireActionLock("проверка очереди и состояния кампании координатора");
        const campaign = await activeCampaignForQueue();
        if (!campaign) return;
        if (["Завершена — ждёт Мастера", "Ожидает решения Мастера"].includes(campaignTeamState(campaign))) {
          await stopAutomation(`Кампания «${rt(campaign.properties?.["Кампания"])}» ожидает Мастера; автоматический цикл остановлен.`);
          return;
        }
        if (await GM_getValue(C.pendingCoordinatorTurn, null)) return;
        const ready = (await tasks("Ready")).filter((task) => campaignKeyFromTask(task) === campaignFolderKey(campaign));
        if (ready.length) return;
        const submitted = (await tasks("Submitted")).filter((task) => campaignKeyFromTask(task) === campaignFolderKey(campaign));
        const running = (await tasks("Running")).filter((task) => campaignKeyFromTask(task) === campaignFolderKey(campaign));
        if (submitted.length || running.length) return;
        const campaignTasks = (await query(C.req)).filter((task) => !task.archived && !task.in_trash && campaignKeyFromTask(task) === campaignFolderKey(campaign));
        await queueCampaignCompletionNotice(coordinator, campaign, campaignTasks);
      } catch (error) {
        debugConsole(`coordinator-queue:${location.pathname}:${error?.message || error}`, "coordinator queue-state check failed", { pathname: location.pathname, message: String(error?.message || error) }, { level: "warn" });
      } finally {
        coordinatorQueueNoticeBusy = false;
        if (ownsActionLock) {
          try { await releaseActionLock(ownsActionLock); }
          catch (error) { console.error("[ChronicleForge:diagnostic] could not release Coordinator queue lock", error); }
        }
      }
    }, 800);
  }
  async function scheduleCoordinatorAuto() {
    if (autoDispatchTimer || !document.body || !(await autoEnabled()) || (await autoIsPaused()) || !/\/agent\/[\w-]+/.test(location.pathname)) return;
    autoDispatchTimer = setTimeout(async () => {
      autoDispatchTimer = null;
      if (autoCoordinatorBusy || await isActionLockHeld()) {
        setTimeout(scheduleCoordinatorAuto, 1500);
        return;
      }
      autoCoordinatorBusy = true;
      let isCoordinatorPage = false;
      let lockOwner = null;
      let dispatchingTask = null;
      let roles = [];
      try {
        const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        roles = await roleList();
        const coordinator = roles.find((role) => norm(role.id) === norm(id));
        if (!coordinator || coordinator.dispatchFunction !== "Coordinator") return;
        isCoordinatorPage = true;
        await clearForeignCoordinatorHandoffState(coordinator.id);
        if (await GM_getValue(C.pendingCoordinatorTurn, null) || await GM_getValue(C.pendingCoordinatorNote, null)) return;
        let adoption = await GM_getValue(C.coordinatorNeedsAdoption, null);
        if (generatingNow()) {
          if (!adoption) await GM_setValue(C.coordinatorNeedsAdoption, { coordinatorId: coordinator.id, startedAt: Date.now() });
          return;
        }
        // Do not take the global action lock on Executor pages. Previously this
        // scheduler locked first and only then discovered that it was not on
        // the Coordinator, intermittently blocking valid auto-submission.
        if (await isActionLockHeld()) return;
        lockOwner = await acquireActionLock("автопроверка очереди координатора");
        const campaign = await activeCampaignForQueue();
        if (!campaign) {
          await stopAutomation("В Notion нет активной кампании; автоматизация остановлена без выбора следующей кампании. Возобновление — после явного решения Мастера.");
          return;
        }
        if (["Завершена — ждёт Мастера", "Ожидает решения Мастера"].includes(campaignTeamState(campaign))) {
          await stopAutomation(`Кампания «${rt(campaign.properties?.["Кампания"])}» отмечена в Notion как «${campaignTeamState(campaign)}»; автоматический цикл остановлен до явного решения Мастера.`);
          return;
        }
        if (adoption && norm(adoption.coordinatorId) === norm(coordinator.id)) {
          if (!campaign) return;
          const campaignTasks = (await query(C.req)).filter((task) => !task.archived && !task.in_trash && campaignKeyFromTask(task) === campaignFolderKey(campaign));
          await queueCoordinatorStateCheck(coordinator, campaign, campaignTasks);
          return;
        }
        const queued = (await tasks("Submitted")).filter((task) => !campaign || campaignKeyFromTask(task) === campaignFolderKey(campaign));
        if (queued.length) {
          const next = queued[0];
          const key = `${next.id}:${runId(next)}`;
          if (!runId(next) || !outputId(next)) {
            await pauseAutomation(`Первая Submitted-задача «${title(next)}» неполная; исправьте её в Notion.`);
            return;
          }
          if (autoReviewNoticeKey !== key) {
            autoReviewNoticeKey = key;
            logEvent(`Координатору нужна проверка «${title(next)}»: https://drive.google.com/file/d/${outputId(next)}/view (Dispatch ${next.id}, Run ${runId(next)}). Внесите вердикт в тот же лог и обновите Dispatch State и «Ответ» в Notion; остальные задачи пока ждут.`);
          }
          if (!(await GM_getValue(C.pendingCoordinatorTurn, null))) await queueSubmittedReviewTurn(coordinator, next);
          return;
        }
        autoReviewNoticeKey = "";
        const running = (await tasks("Running")).filter((task) => !campaign || campaignKeyFromTask(task) === campaignFolderKey(campaign));
        if (running.length) return;
        const ready = (await tasks("Ready")).filter((task) => !campaign || campaignKeyFromTask(task) === campaignFolderKey(campaign));
        if (!ready.length) {
          if (campaign) {
            const campaignTasks = (await query(C.req)).filter((task) => !task.archived && !task.in_trash && campaignKeyFromTask(task) === campaignFolderKey(campaign));
            await queueCampaignCompletionNotice(coordinator, campaign, campaignTasks);
          }
          return;
        }
        await campaignForTask(ready[0]);
        if (ready.length > 1) {
          const sequence = taskSequence(ready[0]);
          logEvent(`В очереди ${ready.length} Ready-задач; беру первую по Sequence ${Number.isFinite(sequence) ? sequence : "(без номера — после пронумерованных)"}.`);
        }
        dispatchingTask = ready[0];
        await dispatch(dispatchingTask, roles);
      } catch (error) {
        console.error("[CF auto-dispatch]", error);
        const reason = String(error?.message || error);
        const malformedDispatch = /В Notion не заполнены адресат\/payload|Адресат не совпадает с активной ролью Executor/.test(reason);
        if (malformedDispatch && dispatchingTask) {
          try {
            const coordinator = roles.find((role) => role.dispatchFunction === "Coordinator");
            if (coordinator) {
              await queueDispatchPreflightRepair(coordinator, dispatchingTask, reason);
              return;
            }
          } catch (repairError) {
            console.error("[CF coordinator repair notice]", repairError);
          }
        }
        await pauseAutomation(`автоматический запуск не выполнен: ${reason}`);
      } finally {
        autoCoordinatorBusy = false;
        if (lockOwner) await releaseActionLock(lockOwner);
        if (isCoordinatorPage && await autoEnabled() && !(await autoIsPaused())) setTimeout(scheduleCoordinatorAuto, 15000);
      }
    }, 1200);
  }
  let coordinatorResultTimer = null;
  let coordinatorResultInFlight = false;
  async function scheduleCoordinatorResult() {
    if (coordinatorResultTimer || coordinatorResultInFlight || !document.body || !(await autoEnabled()) || (await autoIsPaused()) || !/\/agent\/[\w-]+/.test(location.pathname)) return;
    coordinatorResultTimer = setTimeout(async () => {
      coordinatorResultTimer = null;
      if (coordinatorResultInFlight) return;
      coordinatorResultInFlight = true;
      let owner = null;
      let reschedule = false;
      try {
        const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        const turn = await GM_getValue(C.pendingCoordinatorTurn, null);
        if (!turn) return;
        const roles = await roleList();
        const coordinator = roles.find((role) => norm(role.id) === norm(id));
        if (!coordinator || coordinator.dispatchFunction !== "Coordinator") return;
        if (norm(turn.coordinatorId) !== norm(coordinator.id)) {
          await clearForeignCoordinatorHandoffState(coordinator.id);
          reschedule = true;
          return;
        }
        if (generatingNow()) {
          debugConsole(`coordinator-generating:${turn.turnId}`, "waiting for the Coordinator's current response to finish", { coordinatorId: id, campaignId: turn.campaignId, turnId: turn.turnId });
          return;
        }
        let captured;
        try {
          captured = captureLatestRenderedAssistantMessage();
        } catch (error) {
          debugConsole(`coordinator-capture:${turn.turnId}`, "unable to capture Coordinator assistant message yet", { coordinatorId: id, campaignId: turn.campaignId, turnId: turn.turnId, error: String(error?.message || error) });
          return;
        }
        if ((turn.baselineMessageIds || []).includes(`chat-message-${captured.messageId}`) || (turn.baselineMessageIds || []).includes(captured.messageId)) return;
        const result = coordinatorResult(captured.text);
        if (!result) {
          const signature = `${captured.messageId}:${captured.text.length}:${captured.text.slice(-320)}`;
          const now = Date.now();
          if (turn.lastResponseSignature !== signature) {
            turn.lastResponseSignature = signature;
            turn.lastResponseChangedAt = now;
            await GM_setValue(C.pendingCoordinatorTurn, turn);
          } else if (now - (turn.lastResponseChangedAt || now) >= AUTO.idleMs) {
            const retries = Number(turn.markerRetryCount) || 0;
            if (retries < AUTO.coordinatorMarkerRetries) {
              const priorHandoff = await GM_getValue(C.pendingCoordinatorNote, null);
              const nextTurn = createCoordinatorTurn({
                coordinatorId: turn.coordinatorId,
                campaignId: turn.campaignId,
                dispatchId: turn.dispatchId,
                runId: turn.runId,
                kind: turn.kind,
              });
              nextTurn.markerRetryCount = retries + 1;
              nextTurn.baselineMessageIds = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]')).map((message) => message.id);
              const recovery = {
                kind: "coordinator-marker-recovery",
                originalKind: turn.kind,
                coordinatorId: turn.coordinatorId,
                campaignId: turn.campaignId,
                dispatchId: turn.dispatchId,
                runId: turn.runId,
                logId: priorHandoff?.logId || "",
                turn: nextTurn,
                note: `${coordinatorMarkerRecoveryPrompt(turn, nextTurn, nextTurn.markerRetryCount, captured.messageId)}${coordinatorTurnFooter(nextTurn)}`,
                preparedAt: Date.now(),
              };
              await GM_setValue(C.pendingCoordinatorTurn, nextTurn);
              await GM_setValue(C.pendingCoordinatorNote, recovery);
              coordinatorHandoffNotice = "";
              logEvent(`Ответ Координатора по ходу ${turn.turnId} завершился без маркера; автоматически отправляю Координатору проверку/продолжение (${nextTurn.markerRetryCount}/${AUTO.coordinatorMarkerRetries}). Запуск очереди остаётся заблокирован до корректного маркера.`);
              setTimeout(scheduleCoordinatorHandoff, 250);
            } else {
              await pauseAutomation(
                `Координатор не выдал CF_COORDINATOR_RESULT после ${AUTO.coordinatorMarkerRetries} автоматических напоминаний. Очередь остаётся заблокированной; требуется проверка: ход ${turn.turnId}.`,
                {
                  kind: "coordinator-marker-limit",
                  coordinatorId: turn.coordinatorId,
                  campaignId: turn.campaignId,
                  dispatchId: turn.dispatchId || "",
                  runId: turn.runId || "",
                  turnId: turn.turnId,
                },
              );
            }
          }
          debugConsole(`coordinator-marker-absent:${turn.turnId}:${captured.messageId}`, "latest Coordinator message has no CF_COORDINATOR_RESULT; automation is sending a correlated recovery prompt", { coordinatorId: id, campaignId: turn.campaignId, turnId: turn.turnId, messageId: captured.messageId, finalLine: captured.text.trimEnd().split("\n").at(-1)?.slice(0, 160) || "" });
          return;
        }
        if (!coordinatorTurnMatches(turn, result)) {
          debugConsole(`coordinator-marker-mismatch:${turn.turnId}:${captured.messageId}`, "Coordinator completion marker does not match the pending turn; automation remains gated", { expected: turn, received: result, messageId: captured.messageId }, { level: "error" });
          await pauseAutomation(`Маркер Координатора не совпадает с ожидающим ходом ${turn.turnId}. Ничего не запускаю; проверьте соответствие кампании, Dispatch и Run ID.`);
          return;
        }
        if (await isActionLockHeld()) return;
        owner = await acquireActionLock("проверка завершения хода Координатора");
        const campaign = await fresh(turn.campaignId);
        if (!campaign?.id) throw Error("Кампания из маркера Координатора не найдена в Notion.");
        const teamState = campaignTeamState(campaign);
        logEvent(`Принят CF_COORDINATOR_RESULT для кампании «${rt(campaign.properties?.["Кампания"])}»; сверяю очередь и флаг завершения в Notion.`);
        if (["Завершена — ждёт Мастера", "Ожидает решения Мастера"].includes(teamState)) {
          await stopAutomation(`Координатор установил в Notion «${teamState}». Цикл завершён и остановлен; возобновление — только после явного решения Мастера.`);
          return;
        }
        if (turn.dispatchId) {
          const reviewed = await fresh(turn.dispatchId);
          if (runId(reviewed) !== turn.runId || state(reviewed) === "Submitted") {
            await pauseAutomation(`Ход Координатора ${turn.turnId} завершился, но задача ${turn.dispatchId} всё ещё Submitted или Run ID изменился. Проверьте вердикт в Notion/Drive: https://app.notion.com/p/${String(turn.dispatchId).replaceAll("-", "")}`);
            return;
          }
        }
        const campaignTasks = (await query(C.req)).filter((task) => !task.archived && !task.in_trash && campaignKeyFromTask(task) === campaignFolderKey(campaign));
        const submitted = campaignTasks.filter((task) => state(task) === "Submitted");
        const running = campaignTasks.filter((task) => state(task) === "Running");
        const ready = campaignTasks.filter((task) => state(task) === "Ready").sort(compareTaskQueue);
        if (turn.kind === "dispatch-preflight" && turn.dispatchId) {
          const repaired = await fresh(turn.dispatchId);
          const repairedRole = findExecutorRoleForTask(repaired, roles);
          const recipientIsValid = Boolean(
            repairedRole &&
            repairedRole.dispatchFunction === "Executor" &&
            repairedRole.id &&
            repairedRole.url.includes(repairedRole.id),
          );
          const repairedPayloadId = payloadId(repaired);
          const repairedPayloadUrl = payloadUrl(repaired);
          if (state(repaired) !== "Ready" || !recipientIsValid || !repairedPayloadId || !repairedPayloadUrl || !repairedPayloadUrl.includes(repairedPayloadId)) {
            await GM_setValue(C.pendingCoordinatorTurn, null);
            await GM_setValue(C.pendingCoordinatorNote, null);
            await pauseAutomation(`Координатор не устранил ошибку подготовки задачи «${title(repaired)}». Она не отправлена; проверьте адресата, Payload Drive File ID/URL и Dispatch State.`);
            return;
          }
          logEvent(`Координатор исправил preflight-задачу «${title(repaired)}»; проверка прошла, возвращаю её в очередь.`);
        }
        await GM_setValue(C.pendingCoordinatorTurn, null);
        await GM_setValue(C.pendingCoordinatorNote, null);
        if (submitted.length || running.length) {
          logEvent(`Ход Координатора завершён; в текущей кампании ещё есть ${submitted.length} Submitted и ${running.length} Running. Очередь останется заблокирована до их обработки.`);
          return;
        }
        if (ready.length) {
          logEvent(`Ход Координатора завершён; обнаружено ${ready.length} Ready-задач. Продолжаю цикл с первой по Sequence.`);
          reschedule = true;
          return;
        }
        if (turn.kind === "dispatch-review" && turn.dispatchId) {
          const reviewed = await fresh(turn.dispatchId);
          logEvent(`Ход review завершён; Dispatch State сейчас «${state(reviewed) || "не задан"}», Ready-задач нет. Запрашиваю у Координатора следующий шаг по критериям текущей кампании.`);
          reschedule = true;
          return;
        }
        if (turn.kind === "cycle-check") {
          logEvent("Сверка старого хода завершена; Ready-задач пока нет. Запрашиваю у Координатора следующий шаг по критериям кампании.");
          reschedule = true;
          return;
        }
        const campaignUrl = campaign.url || `https://app.notion.com/p/${String(campaign.id).replaceAll("-", "")}`;
        await pauseAutomation(`Координатор завершил ход маркером, но не создал Ready-задачу и не установил флаг завершения кампании. Проверьте текущие критерии: ${campaignUrl}`);
      } catch (error) {
        debugConsole(`coordinator-result-error:${location.pathname}:${error?.message || error}`, "Coordinator completion processing failed; automation remains gated", { pathname: location.pathname, message: String(error?.message || error) }, { level: "error" });
        if (!await autoIsPaused()) await pauseAutomation(`не удалось безопасно обработать результат хода Координатора: ${error?.message || error}`);
      } finally {
        if (owner) await releaseActionLock(owner);
        coordinatorResultInFlight = false;
        if (reschedule && await autoEnabled() && !(await autoIsPaused())) setTimeout(scheduleCoordinatorAuto, 250);
      }
    }, 1000);
  }
  let autoSubmitTimer = null;
  let autoSubmitInFlight = false;
  const autoSubmitStates = new Map();
  function autoSubmitState(key, status, message, { error = false, retryMs = 0 } = {}) {
    const previous = autoSubmitStates.get(key);
    autoSubmitStates.set(key, {
      ...previous,
      status,
      retryAt: retryMs ? Date.now() + retryMs : 0,
    });
    if (previous?.status !== status && message) logEvent(message, error);
  }
  function redirectSubmittedRun(key, coordinator) {
    const current = autoSubmitStates.get(key) || {};
    if (!coordinator?.url || current.retryAt > Date.now()) return;
    autoSubmitStates.set(key, { ...current, status: "submitted", retryAt: Date.now() + 15000, redirectAttempted: true });
    if (!current.redirectAttempted) logEvent("Ответ уже записан и задача Submitted; повторную запись не выполняю, открываю Координатора.");
    autoSubmitStates.set(key, { ...autoSubmitStates.get(key), redirectAttempted: true });
    location.assign(coordinator.url);
  }
  function scheduleAutoSubmit() {
    if (autoSubmitTimer || !/\/agent\/[\w-]+/.test(location.pathname)) return;
    autoSubmitTimer = setTimeout(async () => {
      autoSubmitTimer = null;
      if (autoSubmitInFlight) return;
      autoSubmitInFlight = true;
      let markerCandidate = false;
      let key = "";
      try {
        // Manual mode must never submit a response just because its marker appeared.
        const enabled = await autoEnabled();
        const paused = enabled ? await autoIsPaused() : false;
        const id = location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "";
        const messageNodes = Array.from(document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]'));
        const latestNode = messageNodes.at(-1);
        const baseDetails = {
          pathname: location.pathname,
          agentId: id,
          autoEnabled: Boolean(enabled),
          paused: Boolean(paused),
          generating: generatingNow(),
          transcriptMessages: messageNodes.length,
          latestMessageId: latestNode?.id || null,
          pageLock: Boolean(await GM_getValue(C.lock, false)),
        };
        if (enabled && !paused) {
          const pageRole = (await roleList()).find((role) => norm(role.id) === norm(id));
          if (!pageRole || pageRole.dispatchFunction !== "Executor") {
            debugConsole(`monitor-role-gate:${id}`, "Executor result monitor skipped for non-Executor page", { ...baseDetails, dispatchFunction: pageRole?.dispatchFunction || "unknown" });
            if (pageRole?.dispatchFunction === "Coordinator" && baseDetails.generating
              && !(await GM_getValue(C.pendingCoordinatorTurn, null))
              && !(await GM_getValue(C.pendingCoordinatorNote, null))) {
              await GM_setValue(C.coordinatorNeedsAdoption, { coordinatorId: pageRole.id, startedAt: Date.now() });
            }
            scheduleCoordinatorResult();
            return;
          }
        }
        if (!enabled || paused) {
          debugConsole(`monitor-gate:${id}`, "monitor gated", baseDetails);
          return;
        }
        if (baseDetails.generating) {
          debugConsole(`generation:${id}`, "waiting for visible generation control to disappear", baseDetails);
          return;
        }
        let captured;
        try {
          captured = captureLatestRenderedAssistantMessage();
        } catch (error) {
          debugConsole(`capture:${id}`, "unable to capture latest assistant message", { ...baseDetails, error: String(error?.message || error) }, { level: "warn" });
          return;
        }
        const pendingPrompt = await currentPendingForPage();
        const manualPrepared = pendingPrompt ? null : await GM_getValue(C.manualPrepared, null);
        const finalLine = (captured.text.trimEnd().split("\n").at(-1) || "")
          .replace(/[\u200B-\u200D\uFEFF]/g, "")
          .replace(/\u00a0/g, " ")
          .trim();
        if (!/^CF_AGENT_RESULT[ \t]+/.test(finalLine)) {
          debugConsole(`marker-absent:${id}:${captured.messageId}`, "latest assistant message has no terminal marker", { ...baseDetails, capturedMessageId: captured.messageId, textLength: captured.text.length, finalLineLength: finalLine.length });
          return;
        }
        debugConsole(`marker-seen:${id}:${captured.messageId}`, "terminal marker detected", { ...baseDetails, capturedMessageId: captured.messageId, textLength: captured.text.length, markerLine: finalLine.slice(0, 240) });
        markerCandidate = true;
        const result = agentResult(captured.text);
        const adoptedFromPending = isAdoptedExecutorRunCompletion(captured, result, pendingPrompt);
        const freshAfterSend = isFreshExecutorMessage(captured.messageId, pendingPrompt)
          || isFreshManualExecutorMessage(captured.messageId, manualPrepared)
          || adoptedFromPending;
        if (!freshAfterSend) {
          debugConsole(`stale-marker:${id}:${captured.messageId}`, "terminal marker is not from a post-send message; ignoring", {
            ...baseDetails,
            capturedMessageId: captured.messageId,
            pendingDispatchId: pendingPrompt?.dispatchId || null,
            pendingRunId: pendingPrompt?.runId || null,
            sentAt: pendingPrompt?.sentAt || manualPrepared?.sentAt || null,
            manualPreparedKey: manualPrepared?.key || null,
          });
          return;
        }
        if (!pendingPrompt && !manualPreparedMatchesRun(manualPrepared, result.dispatch_id, result.run_id)) {
          debugConsole(`manual-marker-run-mismatch:${id}:${captured.messageId}`, "manual send record does not match terminal marker; ignoring transcript message", {
            ...baseDetails,
            capturedMessageId: captured.messageId,
            markerDispatchId: result.dispatch_id,
            markerRunId: result.run_id,
            manualPreparedKey: manualPrepared?.key || null,
          }, { level: "warn" });
          return;
        }
        key = `${norm(id)}:${captured.messageId}:${result.dispatch_id}:${result.run_id}`;
        debugConsole(`marker-parsed:${key}`, "terminal marker parsed", { agentId: id, dispatchId: result.dispatch_id, runId: result.run_id, status: result.status, capturedMessageId: captured.messageId });
        const saved = autoSubmitStates.get(key);
        if (saved?.status === "terminal") return;
        if (saved?.retryAt > Date.now()) return;
        if (!saved) logEvent(`Обнаружен маркер завершения в chat-message-${captured.messageId}; проверяю Dispatch/Run в Notion.`);
        const roles = await roleList();
        const role = roles.find((x) => norm(x.id) === norm(id));
        if (!role || role.dispatchFunction !== "Executor") {
          autoSubmitState(key, "terminal", "Автопередача остановлена: текущая страница не зарегистрирована как Executor.", { error: true });
          return;
        }
        if (result.status !== "submitted") {
          autoSubmitState(key, "terminal", "Маркер не содержит статус submitted; автоматическая запись не выполнена.", { error: true });
          return;
        }
        const running = (await tasks("Running")).filter((p) =>
          taskMatchesExecutorRole(p, role, id) && runId(p) && outputId(p));
        const submittedList = (await tasks("Submitted")).filter((p) =>
          taskMatchesExecutorRole(p, role, id) && runId(p) && outputId(p));
        let currentRun = running.find((p) => p.id === result.dispatch_id && (runId(p) === result.run_id || adoptedFromPending));
        const coordinator = roles.find((x) => x.dispatchFunction === "Coordinator");
        if (!currentRun) {
          const submitted = submittedList.find((p) =>
            p.id === result.dispatch_id && (runId(p) === result.run_id || adoptedFromPending));
          if (submitted) {
            if (taskHasScriptCatSubmittedAnswer(submitted, captured.messageId)) {
              if (pendingPrompt?.dispatchId === submitted.id) await GM_setValue(C.pendingPrompt, null);
              autoSubmitState(key, "submitted", "Ответ уже записан в Drive и отмечен Submitted; восстанавливаю переход к Координатору.");
              redirectSubmittedRun(key, coordinator);
              return;
            }
            // Agent set Dispatch State = Submitted via Notion MCP before ScriptCat wrote the chat response to Drive.
            currentRun = submitted;
          } else {
            const sameDispatchDifferentRun = running.find((p) => p.id === result.dispatch_id);
            if (sameDispatchDifferentRun) {
              autoSubmitState(key, "terminal", "Маркер относится к старому Run ID; текущая Running-попытка не изменена.", { error: true });
              return;
            }
            autoSubmitState(key, "waiting", "Маркер найден, но соответствующая задача пока не подтверждена как Running или Submitted; повторно сверю состояние позже.", { error: true, retryMs: 15000 });
            return;
          }
        }
        autoSubmitStates.set(key, { status: "submitting", retryAt: 0 });
        buttonText("Маркер готовности найден — сохраняю ответ…");
        await run(captured);
        autoSubmitState(key, "submitted", "Ответ сохранён; переход к Координатору запрошен.", { retryMs: 15000 });
      } catch (error) {
        const message = String(error?.message || error);
        const lockConflict = message.includes("Другое действие уже выполняется");
        const lockOwner = lockConflict ? await GM_getValue(C.lockOwner, null) : null;
        debugConsole(`monitor-error:${key || location.pathname}:${message}`, "auto-submit monitor exception", { pathname: location.pathname, agentId: location.pathname.match(/\/agent\/([\w-]+)/)?.[1] || "", markerCandidate, message, lockOwner }, { level: "error" });
        if (markerCandidate) {
          if (!lockConflict) console.error("[CF auto-submit]", error);
          const retryMessage = lockConflict
            ? `Автопередача ждёт: ${lockOwner?.action || "неизвестный владелец блокировки"}${lockOwner?.startedAt ? ` (с ${lockOwner.startedAt})` : ""}; повторю проверку позже.`
            : `Автопередача не завершена: ${message}. Повторная проверка будет позже.`;
          if (key) autoSubmitState(key, "error", retryMessage, { error: !message.includes("Другое действие уже выполняется"), retryMs: 15000 });
          const button = document.getElementById(C.button);
          if (button && !button.disabled)
            button.textContent = button.dataset.idleText || "Сохранить ответ / передать Координатору";
        }
      } finally {
        autoSubmitInFlight = false;
        const retry = key && autoSubmitStates.get(key);
        if (retry && ["waiting", "error", "submitted"].includes(retry.status) && retry.retryAt > Date.now())
          setTimeout(scheduleAutoSubmit, Math.max(250, retry.retryAt - Date.now()));
      }
    }, 1400);
  }
  function mount() {
    const root = ensureConsole();
    const on = /\/agent\/[\w-]+/.test(location.pathname),
      old = document.getElementById(C.button);
    if (!on) {
      old?.remove();
      return;
    }
    if (old || !document.body) return;
    const b = document.createElement("button");
    b.id = C.button;
    b.textContent = "Передать ход вручную";
    b.dataset.idleText = b.textContent;
    b.title = "Ручной режим: Координатор запускает следующую Ready-задачу по Sequence; на странице исполнителя задание вставляется и один раз отправляется кнопкой Send. После ответа нужно нажать основную кнопку для проверки и передачи Координатору. Вердикт Координатор вносит напрямую в Drive/Notion.";
    b.setAttribute("aria-live", "polite");
    b.style.cssText = "flex:1;min-width:0;padding:9px 10px;border:0;border-radius:9px;background:#245c46;color:#fff;cursor:pointer;font:600 12px system-ui;text-align:center;display:flex;align-items:center;justify-content:center";
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.setAttribute("aria-busy", "true");
      b.style.opacity = "0.78";
      b.style.cursor = "progress";
      buttonText("Проверяю передачу…");
      try {
        await run();
      } catch (e) {
        console.error("[Chronicle Forge]", e);
        const message = String(e?.message || e).trim();
        if (message.startsWith("Другое действие уже выполняется:") && !(await autoEnabled())) {
          toast(message, true);
          const ownerDetails = message.slice("Другое действие уже выполняется: ".length);
          const confirmed = confirm(`Обнаружена блокировка: ${ownerDetails}\n\nСнять её? Делайте это только если указанное действие действительно зависло: если оно ещё выполняется, снятие блокировки может разрешить параллельную передачу. После подтверждения текущая операция не повторяется автоматически — нажмите кнопку ещё раз.`);
          if (!confirmed) {
            toast("Блокировка оставлена; передача не запускалась.", true);
          } else if (await autoEnabled()) {
            toast("Автоматический режим уже включён; блокировка не снята.", true);
          } else if (!(await GM_getValue(C.lock, false))) {
            toast("Блокировка уже снята другим действием; передача не запускалась.");
          } else {
            await releaseActionLock();
            toast("Ручная блокировка снята. Передача не повторялась; нажмите кнопку ещё раз, когда будете готовы.");
          }
        } else {
          toast(message, true);
        }
      } finally {
        if (b.isConnected) {
          b.disabled = false;
          b.removeAttribute("aria-busy");
          b.style.opacity = "1";
          b.style.cursor = "pointer";
          b.textContent = b.dataset.idleText || "Передать ход вручную";
        }
      }
    };
    (root?.querySelector(`#${C.consoleActions}`) || document.body).append(b);
    Promise.resolve(autoEnabled()).then(updateManualButtonVisibility).catch(() => {});
  }
  mount();
  mountModeToggle();
  Promise.all([autoEnabled(), autoIsPaused()]).then(([enabled, paused]) => debugConsole(`startup:${location.pathname}`, "userscript initialized", {
    version: "0.13.26",
    pathname: location.pathname,
    autoEnabled: Boolean(enabled),
    paused: Boolean(paused),
    transcriptMessages: document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]').length,
    agentPage: /\/agent\/[\w-]+/.test(location.pathname),
  })).catch((error) => console.warn("[ChronicleForge:diagnostic] startup state unavailable", error));
  scheduleAutoSubmit();
  scheduleAutoSend();
  scheduleCoordinatorHandoff();
  scheduleCoordinatorAuto();
  scheduleCoordinatorQueueNotice();
  setInterval(() => {
    scheduleAutoSubmit();
    scheduleCoordinatorQueueNotice();
    monitorPending().catch((error) => console.error("[CF auto-monitor]", error));
  }, 5000);
  function resumeWhenVisible() {
    if (document.visibilityState === "hidden") return;
    mount();
    mountModeToggle();
    scheduleAutoSubmit();
    scheduleAutoSend();
    scheduleCoordinatorHandoff();
    scheduleCoordinatorAuto();
    scheduleCoordinatorQueueNotice();
    monitorPending().catch((error) => console.error("[CF auto-monitor]", error));
  }
  document.addEventListener("visibilitychange", resumeWhenVisible);
  window.addEventListener("focus", resumeWhenVisible);
  window.addEventListener("pageshow", resumeWhenVisible);
  new MutationObserver(() => {
    mount();
    mountModeToggle();
    scheduleAutoSubmit();
    scheduleAutoSend();
    scheduleCoordinatorHandoff();
    scheduleCoordinatorAuto();
    scheduleCoordinatorQueueNotice();
  }).observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  let path = location.pathname;
  setInterval(() => {
    if (path !== location.pathname) {
      path = location.pathname;
      mount();
      mountModeToggle();
      scheduleAutoSubmit();
      scheduleAutoSend();
      scheduleCoordinatorHandoff();
      scheduleCoordinatorAuto();
      scheduleCoordinatorQueueNotice();
    } else {
      if (!document.getElementById(C.button)) mount();
      if (!document.getElementById(C.modeButton)) mountModeToggle();
    }
  }, 700);
})();
