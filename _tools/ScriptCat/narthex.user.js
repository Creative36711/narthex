// ==UserScript==
// @name         Narthex — передача хода между агентами
// @namespace    https://arena.ai/
// @version      1.4.9
// @description  Цикл Координатор → исполнитель → Координатор: агент сам коммитит, пушит и мержит PR; ScriptCat ждёт мерж и нажимает Continue.
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

/**
 * Narthex dispatch — тонкий транспорт.
 *
 * Разделение труда (важно, иначе всё ломается):
 *  - АГЕНТ сам делает `git commit`, `git push`, `gh pr create`, `gh pr merge`
 *    и заканчивает ответ маркером результата.
 *  - SCRIPT ждёт состояние «PR merged», нажимает Continue и пишет ветку.
 *    Кнопки Create/Merge — только запасной путь, если агент не справился сам:
 *    каждая кнопка порождает ответ агента, то есть новый chat-message.
 *  - РЕШЕНИЯ (какая задача, принята ли работа, конец миссии) принимает только
 *    Координатор. Скрипт исполняет и останавливается по next:"done".
 *
 * Состояния PR, которые скрипт различает:
 *   Merged   — бейдж «Pull request merged»; мерж подтверждён интерфейсом.
 *   Closed   — бейдж «Pull request closed». Так выглядит и PR, слитый через
 *              GitHub, и PR, закрытый без мержа; что именно — решает маркер
 *              исполнителя (`merged: true`). Без заявки о мерже карточка
 *              уходит в Rework с причиной, а цикл продолжается.
 *   Timeout  — за prWaitMs мерж не появился: пауза, решение за человеком.
 *
 * Требует шлюза Drive v1.5 и Notion-токена с доступом к трём источникам.
 */

(() => {
  "use strict";

  // ───────────────────────────── конфиг ─────────────────────────────
  const C = {
    notionV: "2025-09-03",
    roles: "ed076bfe-99dd-447d-9cac-55ca14661e99",
    missions: "c84a3f11-2dcf-414d-b4bf-35beaa7b2c0c",
    requests: "11b41fcc-7c84-406d-bc3b-5bf76ace79bb",
    pageUrl: "https://app.notion.com/p/Narthex-4016f0cf570581f7a1f7c3661c608ffd",
    repo: "Creative36711/narthex", // для ссылки на PR из номера
    tickMs: 15000,
    mergeGraceMs: 90000, // сколько ждём мерж, прежде чем нажать кнопки за агента
    prWaitMs: 300000, // общий предел ожидания мержа
    maxLog: 200, // журнал хранится в ScriptCat; панель показывает хвост
    markerIdleMs: 20000, // ответ стабилен столько — считаем, что маркера не будет
    markerReminders: 2, // напоминаний до паузы: дальше решает Мастер
    pendingTtlMs: 600000, // отправка старше 10 минут не досылается: адресат её не получил
    replyWaitMs: 1800000, // 30 минут без единого сообщения — повод остановиться
  };

  const K = {
    notion: "cfn-notion-token",
    gwUrl: "cfn-gw-url",
    gwKey: "cfn-gw-key",
    auto: "cfn-auto-enabled",
    paused: "cfn-paused",
    log: "cfn-console-log",
    pending: "cfn-pending",
    expect: "cfn-expect",
    merged: "cfn-merged:",
    branch: "cfn-branch",
    pause: "cfn-pause-context",
    ntfyTopic: "cfn-ntfy-topic",
    ntfyToken: "cfn-ntfy-token",
    errSeen: "cfn-error-seen",
    step: "cfn-step-request",
    debug: "cfn-debug",
    lastSend: "cfn-last-send",
    stateV: "cfn-state-v",
  };

  const ui = {
    panel: "cfn-panel",
    log: "cfn-log",
    status: "cfn-status",
    toggle: "cfn-toggle",
    step: "cfn-step",
    setup: "cfn-setup",
    stop: "cfn-stop",
    clear: "cfn-clear",
    reset: "cfn-reset",
    ntfy: "cfn-ntfy",
    count: "cfn-log-count",
    debug: "cfn-debug-toggle",
  };

  // ───────────────────────────── утилиты ─────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (x) => String(x || "").replace(/-/g, "").toLowerCase();
  const nowIso = () => new Date().toISOString();
  const rt = (p) => (p?.rich_text || p?.title || []).map((x) => x.plain_text || x.text?.content || "").join("");
  const sel = (p) => p?.select?.name || "";
  const uid = () => crypto.randomUUID();

  /**
   * Видимость по геометрии плюс computed style. Одного querySelector мало:
   * в DOM Arena остаются скрытые бейджи и кнопки прошлых состояний, и без
   * проверки «Stop» находится на странице, где агент давно молчит.
   */
  const visible = (el) => {
    if (!el || !el.isConnected || el.getClientRects().length === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  };

  /** Шлюз 1.5 — первый, который пишет только в Arena; всё старше — предупреждение. */
  const gatewayIsOld = (version) => {
    const [major, minor] = String(version).split(".").map((x) => Number(x) || 0);
    return major < 1 || (major === 1 && minor < 5);
  };

  let entries = [];

  /**
   * Журнал живёт в ScriptCat и не должен расти бесконечно: храним только
   * последние maxLog записей, а старые отбрасываем при каждой записи и при
   * загрузке страницы. Кнопка «Очистить» удаляет и память, и сохранённый хвост.
   */
  function renderLog() {
    const el = document.getElementById(ui.log);
    if (!el) return;
    el.innerHTML = entries
      .slice(-C.maxLog)
      .map((e) => `<div style="opacity:${e.error ? 1 : 0.85};color:${e.error ? "#ff9a9a" : "inherit"}">${escapeHtml(e.t)}</div>`)
      .join("");
    el.scrollTop = el.scrollHeight;
    const counter = document.getElementById(ui.count);
    if (counter) counter.textContent = `${entries.length}/${C.maxLog}`;
  }

  const escapeHtml = (text) =>
    String(text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

  function clearLog() {
    entries = [];
    GM_setValue(K.log, []);
    console.log("[Narthex] журнал очищен");
    renderLog();
    setStatus();
    log("Журнал очищен.");
  }

  /**
   * В журнал попадает всё; в ntfy — только важное. Тем самым «тихий» и
   * «громкий» поток разделены: см. classifyNtfy ниже.
   */
  function log(text, error = false, options = {}) {
    entries.push({ t: `${new Date().toLocaleTimeString("ru-RU")} ${text}`, error });
    entries = entries.slice(-C.maxLog);
    GM_setValue(K.log, entries);
    console.log(`[Narthex] ${text}`);
    renderLog();
    setStatus();
    const plan = classifyNtfy(text, error, options);
    if (plan) notifyNtfy(text, plan);
  }

  // ───────────────────────────── ntfy ─────────────────────────────
  /**
   * Два уровня пушей, как в старом dispatch:
   *   тихий  (priority 2, memo)          — вехи, после которых цикл идёт сам:
   *                                        ход выдан, ответ записан → Submitted,
   *                                        пауза снята Мастером.
   *   громкий (priority 5, warning)      — всё, что требует человека: пауза,
   *                                        ошибка Notion/Drive/сети, таймаут PR,
   *                                        маркер не пришёл после напоминаний,
   *                                        видимая ошибка Arena, конец миссии.
   * Рутинные шаги не уведомляются вовсе.
   */
  const QUIET_NTFY = [
    /^Выдан ход /,
    /^Задание отправлено/,
    /→ Submitted/,
    /^Пауза снята Мастером/,
    /^Миссия завершена/,
    /вернулась в Ready/,
  ];

  function classifyNtfy(text, error = false, options = {}) {
    if (options.skip || options.ntfy === false) return null;
    const clean = String(text || "").trim();
    if (!clean) return null;
    if (options.ntfy === "loud" || options.urgent === true) {
      return { loud: true, priority: "5", tags: "warning,rotating_light", title: options.title || "Narthex: нужен Мастер" };
    }
    if (options.ntfy === "quiet") {
      return { loud: false, priority: "2", tags: "memo", title: options.title || "Narthex" };
    }
    if (error) {
      return { loud: true, priority: "5", tags: "warning,rotating_light", title: options.title || "Narthex: ошибка" };
    }
    if (QUIET_NTFY.some((re) => re.test(clean))) {
      return { loud: false, priority: "2", tags: "memo", title: options.title || "Narthex" };
    }
    return null;
  }

  /**
   * Публикация через JSON, а не через заголовки.
   *
   * Почему: `X-Title`/`X-Tags` — обычные HTTP-заголовки, а они допускают только
   * ISO-8859-1. Кириллица в заголовке отклоняется браузером ещё до отправки,
   * и запрос тихо не уходит — именно так «тест ничего не делает». В JSON-теле
   * UTF-8 разрешён, а ntfy читает topic/title/priority/tags оттуда.
   */
  const NTFY_BASE = "https://ntfy.sh";
  const SCRIPT_VERSION =
    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.9";

  /** «https://ntfy.sh/topic?x=1» и «topic» одинаково дают topic. */
  function normalizeNtfyTopic(raw) {
    let value = String(raw || "").trim();
    if (!value) return "";
    value = value.replace(/^https?:\/\//i, "").replace(/^ntfy\.sh\//i, "");
    value = value.split(/[?#]/)[0].replace(/\/+$/, "");
    const last = value.split("/").filter(Boolean).pop() || "";
    return /^[A-Za-z0-9_-]{1,64}$/.test(last) ? last : "";
  }

  /** GM_xmlhttpRequest в обёртке: одинаковый результат и в ScriptCat, и в тестах. */
  function gmRequest({ method = "GET", url, headers = {}, body, timeout = 15000 }) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest недоступен"));
        return;
      }
      try {
        GM_xmlhttpRequest({
          method,
          url,
          headers,
          data: body,
          timeout,
          onload: (r) => resolve({ status: r.status, text: String(r.responseText || "").slice(0, 300) }),
          onerror: () => reject(new Error("сеть недоступна или хост не разрешён в @connect")),
          ontimeout: () => reject(new Error("таймаут")),
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Отправка пуша: сначала GM (обходит CSP страницы), затем обычный fetch —
   * ntfy отдаёт CORS-заголовки, так что второй путь работает без @connect.
   * Ошибки складываются в одно сообщение: по нему видно, где именно порвалось.
   */
  async function ntfyPublish(topic, token, { message, title = "Narthex", priority = 2, tags = [] } = {}) {
    const name = normalizeNtfyTopic(topic);
    if (!name) throw new Error("топик не задан или содержит недопустимые символы");
    const payload = JSON.stringify({
      topic: name,
      message: String(message).slice(0, 3500),
      title: String(title),
      priority: Number(priority) || 2,
      tags: String(tags).split(",").map((t) => t.trim()).filter(Boolean),
    });
    const headers = { "Content-Type": "application/json; charset=utf-8" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = `${NTFY_BASE}/`;

    let gmError = "";
    try {
      const r = await gmRequest({ method: "POST", url, headers, body: payload });
      if (r.status >= 200 && r.status < 300) return { via: "gm", status: r.status };
      gmError = `HTTP ${r.status} ${r.text.slice(0, 120)}`.trim();
    } catch (e) {
      gmError = e.message;
    }

    try {
      const res = await fetch(url, { method: "POST", headers, body: payload });
      if (res.ok) return { via: "fetch", status: res.status };
      const text = (await res.text()).slice(0, 120);
      throw new Error(`HTTP ${res.status} ${text}`.trim());
    } catch (e) {
      throw new Error(`GM: ${gmError}; fetch: ${e.message}`);
    }
  }

  /** Проверка связи отдельно от публикации: жив ли ntfy.sh и каким путём. */
  async function ntfyHealth() {
    const out = [];
    try {
      const r = await gmRequest({ url: `${NTFY_BASE}/v1/health` });
      out.push(`GM: HTTP ${r.status} ${r.text.slice(0, 80)}`.trim());
    } catch (e) {
      out.push(`GM: ${e.message}`);
    }
    try {
      const res = await fetch(`${NTFY_BASE}/v1/health`, { cache: "no-store" });
      out.push(`fetch: HTTP ${res.status} ${(await res.text()).slice(0, 80)}`.trim());
    } catch (e) {
      out.push(`fetch: ${e.message}`);
    }
    return out;
  }

  // ───────────────────────────── отладка ─────────────────────────────
  /**
   * Отладка в консоль браузера (F12), а не только в панель.
   *
   * Включается тремя способами: `?cfn-debug` в адресе, кнопка 🐞 в панели и
   * `__narthex.debug(true)` в консоли. Состояние хранится в ScriptCat, поэтому
   * переживает переходы между страницами агентов — именно там всё и ломается.
   *
   * В консоль печатается не «шаг выполнен», а решение и его причина: какие
   * селекторы сработали, сколько элементов нашли, активна ли кнопка Send, что
   * перекрывает клик, сколько сообщений в чате до и после.
   */
  const debugOn = () => {
    try {
      if (new URL(location.href).searchParams.has("cfn-debug")) return true;
    } catch {
      /* адрес нечитаем — решает сохранённый флаг */
    }
    return GM_getValue(K.debug, false) === true;
  };

  function dbg(step, data) {
    if (!debugOn()) return;
    // Снимок можно передать функцией: в выключенном режиме он не считается.
    let payload = data;
    if (typeof data === "function") {
      try {
        payload = data();
      } catch (e) {
        payload = `снимок не удался: ${e.message}`;
      }
    }
    const line = `[Narthex ${SCRIPT_VERSION}] ${step}`;
    try {
      if (payload === undefined) console.log(line);
      else console.log(line, payload);
    } catch {
      /* консоль недоступна — молча */
    }
  }

  /** Короткое описание элемента: по нему видно, что нашли, а что нет. */
  function describe(el) {
    if (!el) return "нет";
    const cls = String(el.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(".");
    const label = el.getAttribute?.("aria-label") || el.getAttribute?.("title") || "";
    return `${String(el.tagName || "?").toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}${label ? ` [${label}]` : ""}`;
  }

  /** Кнопка Send «как её видит скрипт»: найдена, активна, не перекрыта. */
  function debugSendButton(editor) {
    let btn = null;
    try {
      btn = editor ? sendButton(editor) : null;
    } catch {
      btn = null;
    }
    if (!btn) return { found: false };
    return {
      found: true,
      el: describe(btn),
      disabled: Boolean(btn.disabled),
      ariaDisabled: btn.getAttribute?.("aria-disabled") || "",
      covered: elementCovered(btn),
    };
  }

  /** Снимок страницы для консоли: одним объектом, без догадок. */
  function debugSnapshot() {
    const editor = composer();
    return {
      url: location.href,
      path: location.pathname,
      role: roleFromPath() || "—",
      auto: GM_getValue(K.auto, false),
      paused: GM_getValue(K.paused, "") || false,
      pending: GM_getValue(K.pending, null),
      expect: GM_getValue(K.expect, null),
      generating: generating(),
      editor: {
        found: Boolean(editor),
        el: describe(editor),
        covered: editor ? elementCovered(editor) : null,
        textLength: editor ? composerText(editor).length : 0,
      },
      send: debugSendButton(editor),
      panels: completionPanels().map((panel) => ({
        el: describe(panel),
        close: describe(closeButtonIn(panel)),
      })),
      skipCard: Boolean(skipCardButton()),
      messages: messages().length,
      lastMessage: lastMessageId() || "—",
      diagnostics: composerDiagnostics(),
    };
  }

  /** `__narthex` — ручной пульт в консоли браузера. */
  const debugApi = {
    version: SCRIPT_VERSION,
    debug(on = true) {
      GM_setValue(K.debug, Boolean(on));
      if (on) installDebugApi();
      console.info(`[Narthex] отладка ${on ? "включена: подробные сообщения пойдут в эту консоль" : "выключена"}.`);
      return Boolean(on);
    },
    state: () => debugSnapshot(),
    composer: () => composer(),
    sendButton: () => debugSendButton(composer()),
    panels: () => completionPanels().map(describe),
    closePanel: () => closeCompletionPlaque(),
    messages: () => messages().map((n) => ({ id: nodeId(n), head: messageText(n).slice(0, 60) })),
    /** Что скрипт считает ответом после водяного знака — с хвостом и маркером. */
    replies: () => {
      const waiting = GM_getValue(K.expect, null);
      return messagesAfter(waiting?.watermark || "").map((m) => ({
        id: m.id,
        length: m.raw.length,
        tail: tail(m.text, 220),
        marker:
          parseMarker(m.raw, "CF_COORDINATOR_RESULT") || parseMarker(m.raw, "CF_AGENT_RESULT") || null,
      }));
    },
    resend: () => {
      const waiting = GM_getValue(K.expect, null);
      if (!waiting?.text) return "в ожидании нет текста задания";
      GM_setValue(K.expect, null);
      GM_setValue(K.pending, { roleId: waiting.roleId, text: waiting.text, at: Date.now() });
      return "задание возвращено в очередь";
    },
    step: () => tick(true),
    /** Снять очередь и ожидание прошлой попытки, не трогая журнал. */
    reset: () => resetStateDialog(),
  };
  /** Пульт появляется в консоли только когда отладка включена. */
  function installDebugApi() {
    if (!debugOn()) return;
    window.__narthex = debugApi;
  }

  function notifyNtfy(text, { title = "Narthex", priority = "2", tags = "memo" } = {}) {
    const topic = GM_getValue(K.ntfyTopic, "");
    if (!normalizeNtfyTopic(topic)) return;
    ntfyPublish(topic, GM_getValue(K.ntfyToken, ""), { message: text, title, priority, tags }).catch((e) => {
      console.warn("[Narthex ntfy]", e.message);
      log(`ntfy: пуш не ушёл — ${e.message}`, true, { skip: true });
    });
  }

  /** Гудок в браузере: страховка, если ntfy не настроен или телефон молчит. */
  let alertCtx = null;
  function playAlert() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = alertCtx || (alertCtx = new Ctx());
      const play = () => {
        const start = ctx.currentTime + 0.03;
        [880, 660, 880].forEach((frequency, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const at = start + index * 0.22;
          osc.type = "sine";
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.16, at + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(at);
          osc.stop(at + 0.18);
        });
      };
      if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
      else play();
    } catch (e) {
      console.warn("[Narthex alert]", e);
    }
  }

  // ───────────────────────────── пауза ─────────────────────────────
  const isPaused = () => Boolean(GM_getValue(K.paused, ""));

  /**
   * Единственная точка остановки. Любая ошибка на экране, таймаут или
   * невыданный маркер приводят сюда: цикл замирает, статус краснеет, уходит
   * громкий пуш, а продолжает только Мастер — кнопкой «Продолжить».
   */
  function pause(reason, context = {}) {
    const info = {
      kind: context.kind || "error",
      reason: String(reason),
      at: Date.now(),
      ref: context.ref || "",
      runId: context.runId || "",
      turnId: context.turnId || "",
      tries: context.tries ?? null,
      wasAuto: GM_getValue(K.auto, false),
    };
    GM_setValue(K.paused, info.reason);
    GM_setValue(K.pause, info);
    log(`ПАУЗА: ${info.reason}`, true, { skip: true });
    notifyNtfy(`Цикл остановлен и ждёт Мастера: ${info.reason}`, {
      title: "Narthex: пауза",
      priority: "5",
      tags: "warning,rotating_light",
    });
    playAlert();
    setStatus();
  }

  /**
   * Передача потерялась: очередь и ожидание маркера относятся к ходу, которого
   * уже нет. Снимаем оба и ставим паузу, чтобы Мастер увидел причину, а не
   * бесконечное «жду ответа».
   */
  function dropHandoff(reason) {
    GM_setValue(K.pending, null);
    GM_setValue(K.expect, null);
    pause(reason, { kind: "no-reply" });
  }

  function resume(reason = "проверено Мастером") {
    const before = GM_getValue(K.paused, "");
    if (!before) return;
    GM_setValue(K.paused, "");
    GM_setValue(K.pause, null);
    // Новый бюджет напоминаний: Мастер уже посмотрел, почему агент молчал.
    const expect = GM_getValue(K.expect, null);
    if (expect) {
      GM_setValue(K.expect, { ...expect, tries: 0, lastReplySig: "", lastReplyAt: 0 });
    }
    log(`Пауза снята Мастером (${reason}). Продолжаю.`, false, { ntfy: "quiet" });
  }

  function roleFromPath() {
    const id = (location.pathname.match(/\/agent\/([\w-]+)/) || [])[1];
    return id || "";
  }

  function setStatus(extra) {
    const el = document.getElementById(ui.status);
    if (!el) return;
    const auto = GM_getValue(K.auto, false);
    const paused = GM_getValue(K.paused, "");
    const me = GM_getValue("cfn-me", "");
    const short = paused.length > 70 ? `${paused.slice(0, 70)}…` : paused;
    const text = extra || (paused ? `Пауза: ${short}` : auto ? "Работает" : "Выключен");
    el.textContent = me ? `${text} · ${me}` : text;
    el.title = paused || text;
    el.style.color = paused ? "#ff9a9a" : auto ? "#8ee28e" : "inherit";
    const toggle = document.getElementById(ui.toggle);
    if (toggle) {
      toggle.textContent = paused ? "▶ Продолжить" : auto ? "⏸ Стоп" : "▶ Включить";
      toggle.style.background = paused ? "#3a3320" : auto ? "#3a2a2a" : "#24402a";
      toggle.style.borderColor = paused ? "#6b5a2a" : auto ? "#6b3a3a" : "#3f6b45";
    }
  }

  const paintDebugButton = () => {
    const el = document.getElementById(ui.debug);
    if (!el) return;
    const on = debugOn();
    el.style.background = on ? "#2c4a6b" : "#242833";
    el.style.borderColor = on ? "#4a7ba7" : "#343a46";
    el.title = on ? "Отладка включена: подробности в консоли браузера" : "Отладка в консоли браузера (F12)";
  };

  function mount() {
    if (document.getElementById(ui.panel)) return;
    const panel = document.createElement("div");
    panel.id = ui.panel;
    panel.style.cssText = [
      "position:fixed", "right:14px", "bottom:14px", "z-index:2147483000",
      "width:360px", "background:#15171c", "color:#e7eaee", "border:1px solid #2b2f38",
      "border-radius:10px", "font:12px/1.4 ui-monospace,Menlo,Consolas,monospace",
      "box-shadow:0 10px 30px rgba(0,0,0,.45)", "overflow:hidden",
    ].join(";");
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b1e25;border-bottom:1px solid #2b2f38;flex-wrap:wrap">
        <strong style="font-size:12px">Narthex</strong>
        <span style="opacity:.45;font-size:10px" title="версия скрипта">v${SCRIPT_VERSION}</span>
        <span id="${ui.status}" style="opacity:.75;font-size:11px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">…</span>
        <span id="${ui.count}" style="opacity:.45;font-size:10px">0/${C.maxLog}</span>
        <span style="flex:1"></span>
        <button id="${ui.step}" title="Один шаг цикла" style="${btnStyle()}">Шаг</button>
        <button id="${ui.toggle}" style="${btnStyle()}">▶ Включить</button>
        <button id="${ui.ntfy}" title="Уведомления ntfy: тихие вехи и громкие тревоги" style="${btnStyle()}">🔔</button>
        <button id="${ui.debug}" title="Отладка в консоли браузера (F12)" style="${btnStyle()}">🐞</button>
        <button id="${ui.reset}" title="Сбросить очередь и ожидание прошлых попыток (журнал и настройки останутся)" style="${btnStyle()}">↺</button>
        <button id="${ui.clear}" title="Очистить журнал; очередь снимается кнопкой ↺" style="${btnStyle()}">🧹</button>
        <button id="${ui.setup}" title="Настройка" style="${btnStyle()}">⚙</button>
        <button id="${ui.stop}" title="Остановить цикл и снять паузу" style="${btnStyle()}">✕</button>
      </div>
      <div id="${ui.log}" style="max-height:200px;overflow:auto;padding:6px 10px"></div>`;
    document.body.appendChild(panel);

    document.getElementById(ui.setup).onclick = () => setup(true);
    document.getElementById(ui.reset).onclick = () => resetStateDialog();
    document.getElementById(ui.clear).onclick = () => clearLog();
    document.getElementById(ui.debug).onclick = () => {
      const on = !debugOn();
      GM_setValue(K.debug, on);
      debugApi.debug(on);
      installDebugApi();
      log(
        on
          ? "Отладка включена: подробности идут в консоль браузера (F12), панель — только вехи. Команды: __narthex.state(), __narthex.step()."
          : "Отладка выключена.",
      );
      paintDebugButton();
    };
    document.getElementById(ui.ntfy).onclick = () => ntfyDialog();
    document.getElementById(ui.stop).onclick = () => {
      GM_setValue(K.paused, "");
      GM_setValue(K.pause, null);
      GM_setValue(K.auto, false);
      log("Автоцикл остановлен вручную.");
    };
    document.getElementById(ui.step).onclick = () => {
      const reason = GM_getValue(K.paused, "");
      if (reason && !confirm(`Снять паузу и выполнить один шаг?\n\n${reason}`)) return;
      if (reason) resume("ручной шаг");
      log("Шаг нажат: смотрю страницу, очередь и задание.");
      tick(true);
    };
    document.getElementById(ui.toggle).onclick = () => toggleAuto();
    renderLog();
    setStatus();
    paintDebugButton();
  }

  function toggleAuto() {
    const auto = GM_getValue(K.auto, false);
    const reason = GM_getValue(K.paused, "");

    // Пауза. Снять её может только человек: подтверждение показывает причину.
    if (reason) {
      if (!confirm(`Цикл стоит на паузе.\n\nПричина: ${reason}\n\nСнять паузу и продолжить?`)) return;
      const ctx = GM_getValue(K.pause, null) || {};
      // Возвращаем тот режим, в котором цикл стоял: пауза не должна
      // превращать ручной шаг в постоянный автоцикл.
      GM_setValue(K.auto, ctx.wasAuto === true);
      resume("кнопка «Продолжить»");
      tick(true);
      return;
    }

    if (auto) {
      GM_setValue(K.auto, false);
      log("Автоцикл выключен.");
      return;
    }

    GM_setValue(K.auto, true);
    log("Автоцикл включён.");
    tick(true);
  }

  function btnStyle() {
    return "background:#242833;color:#e7eaee;border:1px solid #343a46;border-radius:6px;padding:2px 6px;cursor:pointer;font:11px/1.2 inherit";
  }

  // ───────────────────────────── настройка ─────────────────────────────
  async function setup(force = false) {
    const fromParam = new URL(location.href).searchParams.has("cf-auth-setup");
    if (!force && !fromParam) return;
    const token = prompt("Notion integration token (secret_…):", GM_getValue(K.notion, ""));
    if (token === null) return;
    const gwUrl = prompt("URL веб-приложения Apps Script (/exec):", GM_getValue(K.gwUrl, ""));
    if (gwUrl === null) return;
    const gwKey = prompt("Ключ шлюза:", GM_getValue(K.gwKey, ""));
    if (gwKey === null) return;
    GM_setValue(K.notion, token.trim());
    GM_setValue(K.gwUrl, gwUrl.trim());
    GM_setValue(K.gwKey, gwKey.trim());
    const clean = new URL(location.href);
    if (clean.searchParams.has("cf-auth-setup")) {
      clean.searchParams.delete("cf-auth-setup");
      history.replaceState(null, "", clean.toString());
    }
    try {
      const me = await notion("GET", "users/me");
      const ping = await gateway("ping", "");
      const gatewayVersion = String(ping.version || "1.0");
      log(
        `Настройка сохранена: ${me.name || "Notion OK"}, шлюз ${ping.result || "OK"} v${gatewayVersion}` +
          (ping.logs?.name ? `, логи в ${ping.arena?.name || "Arena"}/${ping.logs.name}` : "."),
      );
      if (gatewayIsOld(gatewayVersion)) {
        log("Шлюз старше 1.5: логи уедут в корень Диска. Обновите drive-gateway.gs.", true);
      }
    } catch (e) {
      log(`Настройка сохранена, но проверка не прошла: ${e.message}`, true);
    }
  }

  // ───────────────────────────── ntfy-настройка ─────────────────────────────
  function ntfyDialog() {
    document.getElementById("cfn-ntfy-dialog")?.remove();
    const box = document.createElement("div");
    box.id = "cfn-ntfy-dialog";
    box.style.cssText = [
      "position:fixed", "right:14px", "bottom:150px", "z-index:2147483001", "width:380px",
      "max-height:70vh", "overflow:auto",
      "background:#15171c", "color:#e7eaee", "border:1px solid #2b2f38", "border-radius:10px",
      "padding:10px", "font:12px/1.5 ui-monospace,Menlo,Consolas,monospace",
      "box-shadow:0 10px 30px rgba(0,0,0,.45)",
    ].join(";");
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <strong>ntfy</strong>
        <span style="opacity:.5;font-size:10px">v${SCRIPT_VERSION}</span>
        <span style="flex:1"></span>
        <button id="cfn-ntfy-close" title="Закрыть" style="${btnStyle()}">✕</button>
      </div>
      <div style="opacity:.7;margin-bottom:8px">Топик на ntfy.sh; пусто — уведомления выключены.<br>
      Тихие (priority 2): ход выдан, ответ записан, пауза снята.<br>
      Громкие (priority 5): пауза, ошибка, таймаут, конец миссии.</div>
      <label style="display:block;margin-bottom:6px">Топик или ссылка<br>
        <input id="cfn-ntfy-topic" placeholder="arena-creative36711" style="${inputStyle()}"></label>
      <label style="display:block;margin-bottom:6px">Access token (необязательно)<br>
        <input id="cfn-ntfy-token" type="password" placeholder="tk_…" style="${inputStyle()}"></label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="cfn-ntfy-save" style="${btnStyle()}">Сохранить</button>
        <button id="cfn-ntfy-quiet" style="${btnStyle()}">Тихий тест</button>
        <button id="cfn-ntfy-loud" style="${btnStyle()}">Громкий тест</button>
        <button id="cfn-ntfy-health" style="${btnStyle()}">Проверка связи</button>
        <button id="cfn-ntfy-open" style="${btnStyle()}">Открыть топик</button>
        <button id="cfn-ntfy-off" style="${btnStyle()}">Выключить</button>
      </div>
      <div id="cfn-ntfy-note" style="margin-top:8px;min-height:32px;white-space:pre-wrap;opacity:.9;font-size:11px;line-height:1.45"></div>`;
    document.body.appendChild(box);

    const topic = box.querySelector("#cfn-ntfy-topic");
    const token = box.querySelector("#cfn-ntfy-token");
    const note = box.querySelector("#cfn-ntfy-note");
    topic.value = String(GM_getValue(K.ntfyTopic, "") || "");
    token.value = String(GM_getValue(K.ntfyToken, "") || "");

    const say = (text, error = false) => {
      note.textContent = text;
      note.style.color = error ? "#ff9a9a" : "#bfe6c4";
    };

    /** Топик нормализуется: ссылка и «ntfy.sh/имя» тоже принимаются. */
    const persist = () => {
      const raw = topic.value.trim();
      const name = normalizeNtfyTopic(raw);
      if (!name) {
        throw new Error(
          `Топик «${raw || "пусто"}» не подходит: нужно 1–64 символа A–Z, a–z, 0–9, дефис или подчёркивание.`,
        );
      }
      GM_setValue(K.ntfyTopic, name);
      GM_setValue(K.ntfyToken, token.value.trim());
      topic.value = name;
      return name;
    };

    const test = async (priority, tags, title, label) => {
      say(`Отправляю в https://ntfy.sh/${normalizeNtfyTopic(topic.value) || "…"} …`);
      // Сторож: если менеджер скриптов не ответил ни успехом, ни ошибкой,
      // молчания быть не должно — через 25 с диалог сам скажет о зависании.
      const watchdog = setTimeout(() => {
        say(
          `Нет ответа за 25 с. Нажмите «Проверка связи»: если и она молчит — ` +
            `запрос блокирует менеджер скриптов (проверьте @connect ntfy.sh), а не ntfy.`,
          true,
        );
      }, 25000);
      try {
        const name = persist();
        const result = await ntfyPublish(name, token.value.trim(), {
          message: `Narthex: ${label} (priority ${priority}).`,
          title,
          priority,
          tags,
        });
        say(
          `Отправлено: ${result.via === "gm" ? "ScriptCat" : "fetch"}, HTTP ${result.status}.\n` +
            `Подписка должна быть на «${name}». Если пуша нет — нажмите «Открыть топик»: сообщение, видимое на странице ntfy.sh, до сервера дошло, значит дело в подписке телефона.`,
        );
        log(`ntfy: ${label} отправлен (${result.via}, HTTP ${result.status}).`, false, { skip: true });
      } catch (e) {
        say(`Не ушло: ${e.message}`, true);
        log(`ntfy: ${label} не отправлен — ${e.message}`, true, { skip: true });
      } finally {
        clearTimeout(watchdog);
      }
    };

    box.querySelector("#cfn-ntfy-save").onclick = () => {
      try {
        const name = persist();
        say(`Сохранено: «${name}». Проверьте тестами.`);
        log(`ntfy: топик «${name}» сохранён.`, false, { skip: true });
      } catch (e) {
        say(e.message, true);
      }
    };
    box.querySelector("#cfn-ntfy-quiet").onclick = () =>
      test(2, "memo", "Narthex: тихий тест", "тихий тест");
    box.querySelector("#cfn-ntfy-loud").onclick = () =>
      test(5, "warning,rotating_light", "Narthex: громкий тест", "громкий тест");
    box.querySelector("#cfn-ntfy-health").onclick = async () => {
      say("Проверяю связь с ntfy.sh…");
      const lines = await ntfyHealth();
      say(`Проверка связи:\n${lines.join("\n")}`);
    };
    box.querySelector("#cfn-ntfy-open").onclick = () => {
      const name = normalizeNtfyTopic(topic.value);
      if (!name) {
        say("Сначала введите корректный топик.", true);
        return;
      }
      window.open(`https://ntfy.sh/${encodeURIComponent(name)}`, "_blank", "noopener");
    };
    box.querySelector("#cfn-ntfy-off").onclick = () => {
      GM_setValue(K.ntfyTopic, "");
      GM_setValue(K.ntfyToken, "");
      topic.value = "";
      token.value = "";
      say("ntfy выключен: пуши больше не отправляются.");
    };
    box.querySelector("#cfn-ntfy-close").onclick = () => box.remove();
  }

  function inputStyle() {
    return "width:100%;box-sizing:border-box;background:#0f1115;color:#e7eaee;border:1px solid #343a46;border-radius:6px;padding:4px 6px;font:12px ui-monospace,Menlo,Consolas,monospace";
  }

  // ───────────────────────────── HTTP ─────────────────────────────
  function request(method, url, headers, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: body === undefined ? undefined : JSON.stringify(body),
        timeout: 45000,
        onload: (r) => {
          let parsed = null;
          try {
            parsed = r.responseText ? JSON.parse(r.responseText) : null;
          } catch {
            parsed = r.responseText;
          }
          if (r.status >= 200 && r.status < 300) resolve(parsed);
          else reject(new Error(`HTTP ${r.status}: ${(parsed && (parsed.message || parsed.error)) || r.statusText}`));
        },
        onerror: () => reject(new Error("сеть недоступна")),
        ontimeout: () => reject(new Error("таймаут запроса")),
      });
    });
  }

  async function notion(method, path, body) {
    const token = GM_getValue(K.notion, "");
    if (!token) throw new Error("Не задан Notion token: откройте ?cf-auth-setup=1 и нажмите ⚙.");
    return request(method, `https://api.notion.com/v1/${path}`, {
      Authorization: `Bearer ${token}`,
      "Notion-Version": C.notionV,
      "Content-Type": "application/json",
    }, body);
  }

  async function gateway(action, fileId, extra = {}) {
    const url = GM_getValue(K.gwUrl, "");
    if (!url) throw new Error("Не задан URL шлюза Drive.");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, fileId, key: GM_getValue(K.gwKey, ""), ...extra }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "шлюз вернул отказ");
    return data;
  }

  // ───────────────────────────── Notion ─────────────────────────────
  const query = (ds, filter, sorts) =>
    notion("POST", `data_sources/${ds}/query`, {
      page_size: 100,
      ...(filter ? { filter } : {}),
      ...(sorts ? { sorts } : {}),
    }).then((r) => r.results || []);

  const patch = (pageId, properties) => notion("PATCH", `pages/${pageId}`, { properties });

  /** id агента выводится из ссылки: отдельное поле в Notion не нужно. */
  function agentIdFromUrl(url) {
    const m = String(url || "").match(/\/agent\/([\w-]+)/);
    return m ? m[1] : "";
  }

  async function roles() {
    const rows = (await query(C.roles)).map((p) => {
      const url = p.properties["Agent URL"]?.url || "";
      return {
        id: agentIdFromUrl(url),
        name: rt(p.properties["Роль"]),
        url,
        fn: sel(p.properties["Функция"]),
        status: sel(p.properties["Статус"]),
        zone: rt(p.properties["Зона записи"]),
        gate: rt(p.properties["Гейт"]),
        pageId: p.id,
      };
    });
    const active = rows.filter((r) => r.id && r.url && r.status === "Активна");
    const ids = active.map((r) => norm(r.id));
    if (new Set(ids).size !== ids.length) throw new Error("Две активные роли указывают на один Agent URL.");
    if (active.filter((r) => r.fn === "Coordinator").length > 1)
      throw new Error("Активных Coordinator больше одного.");
    return active;
  }

  async function activeMission() {
    const rows = await query(
      C.missions,
      { property: "Состояние", select: { equals: "Активна" } },
      [{ property: "Создана", direction: "descending" }],
    );
    return rows[0] || null;
  }

  const taskTitle = (p) => rt(p.properties["Запрос"]);
  const taskState = (p) => sel(p.properties["Dispatch State"]);
  const taskRole = (p) => sel(p.properties["Кому"]);

  async function tasks(state, mission) {
    const rows = await query(
      C.requests,
      { property: "Dispatch State", select: { equals: state } },
      [{ property: "Sequence", direction: "ascending" }],
    );
    if (!mission) return rows;
    const wanted = [mission.id, rt(mission.properties["Миссия"])]
      .filter(Boolean)
      .map((x) => x.trim().toLowerCase());
    return rows.filter((row) => {
      const value = rt(row.properties["Миссия"]).trim().toLowerCase();
      return !value || wanted.some((w) => value === w || value.includes(w) || w.includes(value));
    });
  }

  // ───────────────────────────── сообщения чата ─────────────────────────────
  function messages() {
    return [...document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]')];
  }

  function messageText(node) {
    const prose = node.querySelector('[class*="prose"]') || node;
    const clone = prose.cloneNode(true);
    clone.querySelectorAll("button,svg,[role='alert']").forEach((n) => n.remove());
    const shown = clone.innerText?.trim() || "";
    return shown || String(clone.textContent || "").trim();
  }

  /**
   * Сырой текст сообщения — для разбора маркера.
   *
   * `textContent` не зависит от раскладки: не вставляет переносов на границах
   * абзацев и не склеивает строки так, как это делает `innerText` у detached
   * клона. Именно на этом разбор маркера и падал в живом чате.
   */
  function messageRaw(node) {
    const prose = node.querySelector('[class*="prose"]') || node;
    const clone = prose.cloneNode(true);
    clone.querySelectorAll("button,svg,[role='alert']").forEach((n) => n.remove());
    return String(clone.textContent || "").replace(/\u00a0/g, " ");
  }

  /**
   * Наши собственные служебные сообщения (задание и напоминание) несут
   * `CF_TECH`. Их нельзя читать как ответ агента: в них есть пример маркера.
   */
  const isOwnPrompt = (raw) => /CF_TECH/.test(String(raw || ""));

  function lastMessageId() {
    const list = messages();
    return list.length ? list.at(-1).id.replace("chat-message-", "") : "";
  }

  /**
   * Сообщения, появившиеся ПОСЛЕ водяного знака. Водяной знак — id последнего
   * сообщения на момент отправки задания. Без него скрипт читал бы старые
   * ответы: кнопки Create/Merge PR тоже порождают сообщения агента.
   */
  function messagesAfter(watermark) {
    // Ответ агента — это не эхо собственного задания: пользовательские
    // сообщения в транскрипте помечены отдельным layout, а служебные тексты
    // узнаются по `CF_TECH` (в них лежит пример маркера).
    const list = messages().filter(
      (n) => !n.querySelector('[data-user-message-layout="true"]') && !isOwnPrompt(n.textContent),
    );
    const one = (n) => ({ id: nodeId(n), text: messageText(n), raw: messageRaw(n) });
    if (!watermark) return list.map(one);
    const out = [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const id = nodeId(list[i]);
      if (id === watermark) break;
      out.unshift(one(list[i]));
    }
    return out;
  }

  const nodeId = (n) => n.id.replace("chat-message-", "");

  /**
   * Вырезает первый сбалансированный JSON-объект, начиная с ближайшей `{`.
   *
   * Раньше маркер искался по строкам `innerText`. Это ломалось на живой
   * разметке: `innerText` у клона (а `messageText` клонирует узел) может
   * склеить абзацы, переносы внутри `{"..."}` рвут JSON, а пояснение вокруг
   * маркера добавляет хвост в ту же строку. Скобочный разбор не зависит от
   * того, как браузер разложил текст.
   */
  function braceJson(rest) {
    const start = rest.indexOf("{");
    if (start === -1 || start > 400) return "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < rest.length; i += 1) {
      const ch = rest[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return rest.slice(start, i + 1);
      }
    }
    return "";
  }

  /** JSON из маркера: пробуем как есть, затем с переносами и HTML-сущностями. */
  function markerJson(raw) {
    const variants = [
      raw,
      raw.replace(/\s*\n\s*/g, " "),
      raw
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
    ];
    for (const text of variants) {
      try {
        return JSON.parse(text);
      } catch {
        /* пробуем следующий вариант */
      }
    }
    return null;
  }

  /**
   * Шаблонные значения (`<роль|done>`, `<путь>`) — это наши же примеры из
   * задания и напоминания, а не ответ агента. Такой «маркер» не принимаем:
   * иначе собственный промпт засчитывается как готовый ответ.
   */
  function isPlaceholderMarker(obj) {
    return Object.values(obj || {}).some(
      (v) => typeof v === "string" && /[<>]/.test(v) && !/^https?:/.test(v) && !/^[\w./-]+$/.test(v),
    );
  }

  function parseMarker(text, name) {
    const src = String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n");
    let from = src.length;
    while (from > 0) {
      const at = src.lastIndexOf(name, from - 1);
      if (at === -1) break;
      const obj = markerJson(braceJson(src.slice(at + name.length)));
      if (obj && !isPlaceholderMarker(obj)) return obj;
      from = at;
    }
    return null;
  }

  /**
   * Агент отвечает, только если кнопка остановки видна. Скрытый `stop-button`
   * из прошлой генерации держал `generating()` вечно true, и все шаги молча
   * возвращались: «кнопка не работает», хотя цикл просто ждал призрака.
   */
  const generating = () =>
    [...document.querySelectorAll("button, [role=\"button\"]")].some(
      (b) =>
        visible(b) &&
        /stop generating|остановить генерац|stop response/i.test(
          `${b.getAttribute("aria-label") || ""} ${b.getAttribute("title") || ""} ${b.textContent || ""}`,
        ),
    );

  // ───────────────────────── ответ без маркера ─────────────────────────
  /**
   * Агент может ответить по делу и забыть маркер. Раньше это тонуло в журнале
   * («ждём следующего хода»), и цикл стоял до 45-минутного таймаута. Теперь
   * лестница: подождать, напомнить (до markerReminders раз), остановиться.
   * Число попыток живёт в ожидании, а не в счётчике страницы: перезагрузка
   * его не сбрасывает.
   *
   * tries — сколько напоминаний уже отправлено; лимит считается по ним.
   */
  function markerStep(tries, max = C.markerReminders) {
    return Number(tries) >= Number(max) ? "pause" : "remind";
  }

  /**
   * Напоминание о формате. Две формулировки — чтобы подряд идущие напоминания
   * не выглядели механической копией, и чтобы в чате не было слова ScriptCat.
   */
  function markerReminder(role, expect, attempt, markerName) {
    const line =
      expect.kind === "plan"
        ? `CF_COORDINATOR_RESULT {"mission_id":"${expect.missionId || expect.ref}","turn_id":"${expect.turnId || ""}","status":"completed","next":"<роль|done>"}`
        : role.fn === "Auditor"
          ? `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь к отчёту>"}`
          : `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR>,"merged":true}`;
    const about = expect.title ? ` по «${expect.title}»` : "";
    const variants = [
      [
        `ТЕХНИЧЕСКОЕ НАПОМИНАНИЕ (${attempt} из ${C.markerReminders}; это не задание и не новый ход).`,
        `Твой предыдущий ответ${about} пришёл без обязательного маркера ${markerName}.`,
        "Без него нельзя понять, закончена работа или нет, поэтому ответ не засчитан.",
      ],
      [
        `НАПОМИНАНИЕ О ФОРМАТЕ (${attempt} из ${C.markerReminders}; повторять работу не нужно).`,
        `В ответе${about} не нашлось последней строки с ${markerName}.`,
        "Остальное на месте, не хватает только служебной строки.",
      ],
    ];
    return [
      ...variants[(attempt - 1) % variants.length],
      "Не повторяй уже сделанное и не жди Мастера — это ошибка формата, а не работы.",
      "Если всё готово, ответь ровно одной последней строкой:",
      line,
      "Строка должна быть последней, без блока кода и без текста после неё.",
      "",
      roleContext(role),
    ].filter(Boolean).join("\n");
  }

  /**
   * Признаки того, что агент ещё работает: кнопка Stop и «думающая» плашка.
   * Пока они видны, любой текст в чате — черновик, а не ответ.
   */
  function stillWorking() {
    if (generating()) return true;
    const marks = document.querySelectorAll(
      '[role="status"], [aria-live], [class*="thinking"], [class*="reasoning"], [class*="typing"]',
    );
    return [...marks].some((el) => {
      if (!visible(el)) return false;
      const label = `${el.getAttribute?.("aria-label") || ""} ${(el.textContent || "").slice(0, 40)}`.trim();
      return /thinking|reasoning|typing|дума|размышл|анализ/i.test(label);
    });
  }

  /** Хвост текста для журнала: по нему видно, ответ это или «думаю…». */
  const tail = (text, n = 120) => {
    const flat = String(text || "").replace(/\s+/g, " ").trim();
    return flat.length <= n ? flat : `…${flat.slice(-n)}`;
  };

  /**
   * Ждём ответ без маркера. Возвращает true, если ход уже обработан
   * (напоминание ушло или цикл поставлен на паузу).
   */
  async function markerMissing(role, expect, markerName, manual = false) {
    // Пока агент печатает или «думает», ответа ещё нет: молчим, но по нажатию
    // «Шаг» объясняем, что именно ждём.
    if (stillWorking()) {
      if (manual) log(`${role.name} ещё отвечает — подождите, потом нажмите «Шаг».`);
      return false;
    }
    const replies = messagesAfter(expect.watermark || "");
    const last = replies.at(-1);
    if (!last) {
      // Нормальное ожидание, но нажатый «Шаг» должен получить ответ, а не тишину.
      if (manual) {
        const sentMin = expect.sentAt ? Math.max(1, Math.round((Date.now() - expect.sentAt) / 60000)) : 0;
        const delivered = expect.verified === true ? "доставка подтверждена" : "доставка не подтверждена";
        log(
          `Жду ответ ${role.name}: новых сообщений нет` +
            `${sentMin ? ` (отправлено ${sentMin} мин назад, ${delivered})` : " (ещё не отправлено)"}` +
            `, в чате ${messages().length} сообщений.`,
        );
        dbg("ожидание ответа", { role: role.name, watermark: expect.watermark, sentAt: expect.sentAt, verified: expect.verified });
      }
      return false;
    }

    // Подпись считается по сырому тексту: текст, который «дописывается»,
    // каждый раз даёт другую подпись и откладывает решение.
    const signature = `${last.id}:${last.raw.length}`;
    if (expect.lastReplySig !== signature) {
      GM_setValue(K.expect, { ...expect, lastReplySig: signature, lastReplyAt: Date.now() });
      if (manual) log(`${role.name} дописывает ответ — дочитаю, когда закончит.`);
      return false;
    }
    if (Date.now() - (expect.lastReplyAt || Date.now()) < C.markerIdleMs) {
      if (manual) log(`Ответ ${role.name} ещё может дописаться — подождите.`);
      return false;
    }

    dbg("ответ без маркера", { id: last.id, length: last.raw.length, tail: tail(last.raw, 300) });
    const sent = Number(expect.tries) || 0;
    if (markerStep(sent) === "remind") {
      log(
        `${role.name} ответил без маркера ${markerName} — напоминание ${sent + 1} из ${C.markerReminders}. ` +
          `Прочитан хвост: «${tail(last.text, 110)}»`,
        true,
        { ntfy: "quiet", title: "Narthex: нет маркера" },
      );
      await sendToRole(role, markerReminder(role, expect, sent + 1, markerName), expect.kind, expect.ref, {
        missionId: expect.missionId,
        turnId: expect.turnId,
        runId: expect.runId,
        title: expect.title,
        tries: sent + 1,
      });
      return true;
    }

    pause(
      `${role.name} ответил без маркера ${markerName} после ${C.markerReminders} напоминаний. Нужен Мастер: проверьте страницу агента.`,
      { kind: "marker", ref: expect.ref, runId: expect.runId, turnId: expect.turnId, tries: sent },
    );
    return true;
  }

  // ───────────────────────── ошибка на экране ─────────────────────────
  /**
   * Arena показывает сбой двумя способами: алертом внутри последнего
   * пользовательского сообщения и красной карточкой в интерфейсе. Оба —
   * повод остановиться, а не «подождать и попробовать ещё раз»: повтор поверх
   * неизвестной ошибки отправляет агенту второй промпт и путает учёт хода.
   */
  function latestUserMessageAlert() {
    const list = messages();
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const node = list[i];
      if (!node.querySelector('[data-user-message-layout="true"]')) continue;
      const alert = [...node.querySelectorAll('[role="alert"]')].find(visible);
      if (!alert) return null;
      return {
        messageId: nodeId(node),
        text: String(alert.innerText || alert.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      };
    }
    return null;
  }

  function detectVisibleErrorCard() {
    const selectors = [
      'div[class*="border-red"][class*="bg-red"][class*="rounded"]',
      'div[class*="border-red-500"][class*="bg-red-500"]',
      'div[class*="border-destructive"][class*="bg-destructive"]',
    ];
    const keywords = /something went wrong|please try again|failed|error occurred|an error|rate limit|timed out|timeout|unauthorized|ошибка|попробуйте снова|что-то пошло не так|не удалось|сбой|превышен лимит/i;
    for (const selector of selectors) {
      for (const card of document.querySelectorAll(selector)) {
        if (!visible(card) || card.dataset.cfnSeen === "1") continue;
        if (card.closest("pre, code, textarea, .shiki, .hljs, .prism, .monaco-editor, [data-language], [data-diff], [class*='diff'], [class*='code-block']")) continue;
        const text = String(card.innerText || card.textContent || "").trim();
        if (!text) continue;
        if (text.length < 400 || keywords.test(text)) {
          card.dataset.cfnSeen = "1";
          return text.replace(/\s+/g, " ").slice(0, 300);
        }
      }
    }
    return null;
  }

  /**
   * Одну и ту же ошибку не показываем дважды: после «Продолжить» Мастер уже
   * видел её, и повторная пауза на том же месте сделала бы цикл неоживучим.
   */
  function alreadyReported(key) {
    return GM_getValue(K.errSeen, "") === key;
  }

  function markReported(key) {
    GM_setValue(K.errSeen, key);
  }

  function monitorVisibleErrors() {
    const alert = latestUserMessageAlert();
    if (alert) {
      const key = `alert:${alert.messageId}`;
      if (alreadyReported(key)) return false;
      markReported(key);
      pause(`Видимая ошибка Arena в последнем сообщении: ${alert.text || "текст ошибки пуст"}.`, {
        kind: "arena-error",
        ref: alert.messageId,
      });
      return true;
    }
    const card = detectVisibleErrorCard();
    if (card) {
      const key = `ui:${card.slice(0, 80)}`;
      if (alreadyReported(key)) return false;
      markReported(key);
      pause(`Необработанная ошибка интерфейса: ${card || "текст ошибки пуст"}.`, { kind: "ui-error" });
      return true;
    }
    return false;
  }

  // ───────────────────────────── отправка ─────────────────────────────
  /**
   * Редактор агента. Селекторы — из рабочего `dispatch.user.js`, но шире:
   * `[contenteditable='true']` не совпадает с `plaintext-only`, а ProseMirror
   * вешает `role=textbox` без contenteditable. Первый найденный элемент может
   * быть скрытой копией, поэтому кандидаты перебираются с проверкой видимости.
   */
  function composer() {
    const candidates = [
      ...document.querySelectorAll(
        ".editor-content[contenteditable], .editor-content [contenteditable], " +
          "[contenteditable]:not([contenteditable='false']), .ProseMirror, [role='textbox']",
      ),
    ].filter((el) => el.tagName !== "INPUT");
    const shown = candidates.find(visible);
    if (shown) return shown;
    const prompt = document.querySelector(".editor-content p, [data-placeholder] p");
    const nearPrompt = prompt?.closest("[contenteditable]") || null;
    if (nearPrompt) return nearPrompt;
    return [...document.querySelectorAll("textarea:not([readonly])")].find(visible) || null;
  }

  /**
   * Редактор может быть на месте, но накрыт плашкой: тогда и вставка, и Send
   * уходят в оверлей. Проверяем верхний элемент в центре редактора.
   */
  function elementCovered(editor) {
    try {
      const rect = editor.getBoundingClientRect();
      if (!rect.width || !rect.height) return true;
      const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
      const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
      const top = document.elementFromPoint(x, y);
      if (!top) return false;
      return !(top === editor || editor.contains(top) || top.contains(editor));
    } catch {
      return false;
    }
  }

  const labelText = (el) =>
    [
      el?.getAttribute?.("aria-label"),
      el?.getAttribute?.("title"),
      el?.getAttribute?.("data-testid"),
      el?.getAttribute?.("data-test-id"),
      el?.textContent,
    ]
      .map((v) => String(v || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean);

  const SEND_LABEL = /(^|[\s:])(send|submit|отправ\w*)([\s:!.]|$)/;

  /**
   * Кнопка отправки. Подпись важнее формы: в Arena кнопка часто лежит вне
   * `<form>` редактора, поэтому одного `type=submit` мало. Перебираем по
   * приоритету: явная подпись Send → submit внутри формы → submit рядом.
   */
  /** Расстояние от кнопки до редактора: кнопка Send всегда рядом с полем. */
  function distanceTo(editor, el) {
    try {
      const a = editor.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      return Math.abs(b.top - a.bottom) + Math.abs(b.left - a.left) / 4;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  }

  function sendButton(editor) {
    const panels = completionPanels();
    const inPanel = (b) => panels.some((p) => p.contains?.(b));
    const scope = editor?.closest("form") || document;
    const usable = (b) =>
      b &&
      !b.disabled &&
      b.getAttribute?.("aria-disabled") !== "true" &&
      b.getAttribute?.("data-disabled") !== "true" &&
      visible(b) &&
      !inPanel(b);
    const controls = [...scope.querySelectorAll('button, [role="button"], input[type="submit"]')].filter(usable);
    // Кнопки внутри карточки завершения — не наш Send: их подписи тоже бывают
    // «Send», а клик по ним ничего не отправляет.
    const near = (list) => [...list].sort((a, b) => distanceTo(editor, a) - distanceTo(editor, b));
    const labelled = near(controls.filter((b) => labelText(b).some((l) => SEND_LABEL.test(l))))[0];
    if (labelled) return labelled;
    const submit = near(controls.filter((b) => String(b.getAttribute?.("type") || b.type || "") === "submit"))[0];
    if (submit) return submit;
    return [...(editor?.parentElement?.querySelectorAll?.('button, [role="button"]') || [])].find(usable) || null;
  }

  /**
   * Вставка текста в редактор.
   *
   * `execCommand("insertText")` — единственный путь, который редактор Arena
   * (ProseMirror) считает настоящим вводом: он обновляет состояние, и кнопка
   * Send становится активной. Запасной путь «присвоить textContent» нужен
   * только если execCommand недоступен — после него текст в DOM есть, а
   * состояние пустое, и Send остаётся серым.
   */
  function writePrompt(editor, text) {
    if (!editor) return false;
    editor.focus();
    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
      const proto = editor.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(editor, text);
      else editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return editor.value.trim().length > 0;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      // Крайний случай: браузер не дал вставить командой.
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    const written = composerText(editor).length;
    dbg("writePrompt", () => ({ via: inserted ? "execCommand" : "textContent", written, expected: text.length }));
    return written > 0;
  }

  const composerText = (editor) => (editor?.innerText || editor?.textContent || "").replace(/\s+/g, " ").trim();

  /**
   * Плашка «задание выполнено». Два вида, оба перекрывают чат:
   *  1) панель с классом из `dispatch.user.js` и кнопкой закрытия;
   *  2) карточка в транскрипте с кнопкой `Skip` (опрос, аудио, предложение).
   * Возвращает "closed" | "blocked" | "none".
   */
  /**
   * Панель завершения. В `dispatch.user.js` селектор требовал `shadow-sm`, а в
   * текущей разметке Arena у неё `shadow-none` — совпадение по всему списку
   * классов перестало находить карточку. Держим стабильную часть и проверяем
   * кандидатов по кнопке закрытия, а не по полному имени класса.
   */
  const PANEL_SELECTORS = [
    "div.border-border-medium.bg-surface-secondary.w-full.rounded-md.border",
    "div[class*='border-border-medium'][class*='bg-surface-secondary'][class*='rounded-md']",
  ];

  function skipCardButton() {
    for (const message of document.querySelectorAll('[data-agent-transcript-message="true"]')) {
      for (const button of message.querySelectorAll("button")) {
        if (/^skip$/i.test(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.trim()) && visible(button))
          return button;
      }
    }
    return null;
  }

  /** Кандидаты в панель завершения: объединение обоих селекторов, без скрытых. */
  function completionPanels() {
    const found = new Set();
    for (const selector of PANEL_SELECTORS) {
      for (const panel of document.querySelectorAll(selector)) if (visible(panel)) found.add(panel);
    }
    return [...found];
  }

  /**
   * Кнопка закрытия панели. Приоритет — явная подпись (`Close review panel`,
   * `Close`, `Закрыть`), затем последняя кнопка шапки, затем единственная.
   */
  function closeButtonIn(panel) {
    const buttons = [...panel.querySelectorAll("button")];
    const labelled = buttons.find((b) =>
      /close|dismiss|закрыть|скрыть/i.test(
        `${b.getAttribute("aria-label") || ""} ${b.getAttribute("title") || ""} ${b.textContent || ""}`,
      ),
    );
    const header = panel.querySelector(".flex.items-center.justify-between");
    const inHeader = [...(header?.querySelectorAll("button") || [])];
    return labelled || inHeader.at(-1) || (buttons.length === 1 ? buttons[0] : null);
  }

  /** Панель завершения: та же кнопка, что в dispatch.user.js (шапка, затем подпись). */
  function closeCompletionPanel() {
    const panels = completionPanels();
    for (const panel of panels) {
      const close = closeButtonIn(panel);
      if (close && visible(close)) {
        close.click();
        return "closed";
      }
    }
    return panels.length ? "blocked" : "none";
  }

  /** Плашка любым способом: панель завершения, иначе карточка с Skip. */
  function closeCompletionPlaque() {
    const panel = closeCompletionPanel();
    if (panel !== "none") return panel;
    const skip = skipCardButton();
    if (skip) {
      skip.click();
      return "closed";
    }
    return "none";
  }

  /**
   * Ждём появления редактора.
   *
   * Карточку закрываем только если редактора нет вовсе: она рисуется сверху,
   * но программный ввод и клик её не боятся. Прошлый цикл «закрыть → проверить
   * → закрыть заново» и давал мигание, которое видно глазом.
   */
  async function ensureComposer(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let closed = 0;
    while (Date.now() < deadline) {
      const editor = composer();
      if (editor) return { editor, closed, overlay: false };

      const panel = closeCompletionPanel();
      if (panel === "closed") {
        closed += 1;
        dbg("editor: поля ввода нет — убрал карточку и жду", { attempt: closed });
        if (closed >= 2) break;
        await sleep(700);
        continue;
      }
      const skip = skipCardButton();
      if (skip) {
        skip.click();
        closed += 1;
        dbg("editor: нажал Skip на карточке опроса");
        await sleep(600);
        continue;
      }
      await sleep(400);
    }
    return { editor: null, closed, overlay: completionPanels().length > 0 };
  }

  /** Короткая диагностика, почему поле не нашлось: без неё остаётся гадать. */
  function composerDiagnostics() {
    const count = (selector) => document.querySelectorAll(selector).length;
    const parts = [
      `contenteditable ${count("[contenteditable]")}`,
      `textarea ${count("textarea")}`,
      `textbox ${count("[role='textbox']")}`,
      `панель ${completionPanels().length}`,
      `skip ${count('[data-agent-transcript-message="true"] button') && skipCardButton() ? "да" : "нет"}`,
      `путь ${location?.pathname || "/"}`
    ];
    return parts.join(", ");
  }

  /**
   * Нажатие Send с проверкой результата. Плашка возвращается на место после
   * закрытия (решает backend), поэтому кнопка может оказаться под оверлеем —
   * такой клик не доходит, и раньше мы всё равно писали «Задание отправлено».
   */
  /**
   * Ждём активную кнопку Send.
   *
   * Программный `button.click()` не проходит через оверлей — карточка клик не
   * ловит. Мешает другое: пока редактор не зарегистрировал ввод, кнопка
   * `disabled`, и клик по ней ничего не делает. Поэтому ждём именно активности.
   */
  async function waitForSendReady(editor, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const btn = sendButton(editor);
      if (btn) return btn;
      await sleep(250);
    }
    return null;
  }

  /** Почему Send не нажимается: список кандидатов вокруг редактора. */
  function sendDiagnostics(editor) {
    const scope = editor?.closest?.("form") || document;
    return [...scope.querySelectorAll('button, [role="button"]')]
      .slice(0, 8)
      .map((b) => ({
        el: describe(b),
        labels: labelText(b).slice(0, 3),
        visible: visible(b),
        disabled: Boolean(b.disabled),
        ariaDisabled: b.getAttribute?.("aria-disabled") || "",
        covered: elementCovered(b),
      }));
  }

  /**
   * Нажатие Send с проверкой результата. Плашка возвращается на место после
   * закрытия (решает backend), поэтому кнопка может оказаться под оверлеем —
   * такой клик не доходит, и раньше мы всё равно писали «Задание отправлено».
   */
  /**
   * Ждём активную кнопку Send.
   *
   * Программный `button.click()` не проходит через оверлей — карточка клик не
   * ловит. Мешает другое: пока редактор не зарегистрировал ввод, кнопка
   * `disabled`, и клик по ней ничего не делает. Поэтому ждём именно активности.
   */
  async function waitForSendReady(editor, timeoutMs = 4000) {
    const deadline = Date.now() + timeoutMs;
    let attempts = 0;
    while (Date.now() < deadline) {
      const btn = sendButton(editor);
      if (btn) return btn;
      attempts += 1;
      if (attempts === 4 || attempts === 12) {
        // Половина времени ожидания прошла без активной кнопки: повторяем ввод.
        dbg("Send: кнопка неактивна, повторяю вставку текста", () => debugSendButton(editor));
        return null;
      }
      await sleep(250);
    }
    return null;
  }

  /**
   * Нажатие Send с проверкой результата.
   *
   * Порядок (по мотивам `dispatch.user.js`):
   *  1. дождаться активной кнопки — иначе клик уходит в пустоту;
   *  2. если кнопка так и не стала активной, повторить ввод и подождать ещё;
   *  3. кликнуть и проверить доставку по трём признакам;
   *  4. не подтвердилось — закрыть карточку и повторить, но не больше трёх раз.
   */
  async function deliver(editor, text) {
    const before = messages().length;
    dbg("Send: начало", () => ({ messages: before, button: debugSendButton(editor), textLength: composerText(editor).length }));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let btn = await waitForSendReady(editor, 1500);
      if (!btn) {
        // Редактор не зарегистрировал ввод: повторяем его и ждём снова.
        dbg("Send: кнопка неактивна — повторяю вставку текста", () => debugSendButton(editor));
        writePrompt(editor, text);
        btn = await waitForSendReady(editor, 3000);
      }
      if (!btn) {
        const candidates = sendDiagnostics(editor);
        dbg("Send: активной кнопки нет", { candidates });
        return {
          ok: false,
          reason: "Кнопка Send неактивна или не найдена — редактор не принял текст",
        };
      }

      // Человек не отправляет через миллисекунду после ввода: даём паузу.
      await sleep(500 + Math.floor(Math.random() * 1200));
      dbg(`Send: клик ${attempt}`, () => debugSendButton(editor));
      btn.click();
      await sleep(1200);

      const after = messages().length;
      const composerLeft = composerText(editor).length;
      dbg("Send: результат клика", () => ({ messagesBefore: before, messagesAfter: after, composerLeft, generating: generating() }));
      if (after > before || !composerLeft || generating()) return { ok: true };

      // Не дошло. Карточка могла появиться между вставкой и кликом — убираем
      // её один раз и повторяем; гоняться за ней циклом смысла нет.
      const plaque = closeCompletionPlaque();
      dbg("Send: сообщение не появилось", { plaque, attempt });
      if (plaque === "none" && attempt === 1) writePrompt(editor, text);
      await sleep(500);
    }
    return { ok: false, reason: "Send нажат, но сообщение не появилось — текст остался в поле" };
  }

  /** Короткий хеш текста: нужен, чтобы не отправить одно и то же дважды. */
  function textHash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return String(h);
  }

  async function sendToRole(role, text, kind, ref, extra = {}) {
    const force = extra.force === true;
    const payload = { ...extra };
    delete payload.force;

    // Двойная обработка одного ответа (нажали «Шаг» дважды, сработал
    // автоцикл) отправляла агенту второй такой же текст. Агент отвечал на
    // него ещё раз, и чат превращался в переписку с самим собой.
    const last = GM_getValue(K.lastSend, null);
    if (!force && last && norm(last.roleId) === norm(role.id) && last.hash === textHash(text)) {
      const ageSec = Math.round((Date.now() - Number(last.at || 0)) / 1000);
      if (ageSec < 300) {
        log(
          `Такое же сообщение уже уходило «${role.name}» ${ageSec} с назад — не дублирую, жду ответа.`,
          true,
        );
        return false;
      }
    }
    GM_setValue(K.lastSend, { roleId: role.id, hash: textHash(text), at: Date.now() });

    GM_setValue(K.pending, { roleId: role.id, text, at: Date.now() });
    GM_setValue(K.expect, {
      roleId: role.id,
      kind,
      ref,
      watermark: lastMessageId(),
      at: Date.now(),
      tries: 0,
      lastReplySig: "",
      lastReplyAt: 0,
      // Текст нужен, чтобы повторить отправку, если клик по Send не дошёл.
      text,
      ...payload,
    });
    dbg("sendToRole: задание в очереди", { role: role.name, kind, ref, длина: text.length });
    GM_setValue("cfn-me", role.name);
    setStatus();

    // Если адресат — текущая страница, перезагружать её незачем: чат уже
    // открыт, и задание уйдёт со следующего тика (человек видит, что кнопка
    // сработала, без мигания страницы).
    let same = false;
    try {
      same = new URL(role.url, location.href).pathname === location.pathname;
    } catch {
      same = false;
    }
    if (same) {
      log(`«${role.name}» уже открыт — отправляю задание здесь.`);
      setTimeout(() => tick(false), 400);
    } else {
      log(`Перехожу к «${role.name}», чтобы отправить задание.`);
      location.assign(role.url);
    }
    return true;
  }

  /** Перейти на страницу роли без задания: используется для возврата хода. */
  async function goTo(role) {
    GM_setValue(K.pending, null);
    GM_setValue("cfn-me", role.name);
    setStatus();
    location.assign(role.url);
  }

  // Одно и то же ожидание не должно заливать журнал каждые пару секунд.
  let pendingNoticeAt = 0;
  const pendingSay = (pending, text, error = false) => {
    if (pendingNoticeAt === pending.at) return;
    pendingNoticeAt = pending.at;
    log(text, error);
  };

  /**
   * Досылает задание, сохранённое перед переходом на страницу адресата.
   *
   * Возвращает true, если ход этим и занят: отправлено, ждём редактор или ждём
   * конца ответа агента. Молчаливых выходов нет — каждый пишет в журнал,
   * иначе нажатый «Шаг» выглядит как неработающая кнопка.
   */
  async function consumePending(manual = false) {
    const pending = GM_getValue(K.pending, null);
    if (!pending) return false;
    const me = roleFromPath();

    // Просроченная отправка — остаток прошлой попытки (в том числе от старой
    // версии скрипта). Задание до адресата не дошло, значит и ожидание маркера
    // бессмысленно: снимаем оба и продолжаем шаг, а не глотаем нажатие.
    const age = Date.now() - Number(pending.at || 0);
    if (age > C.pendingTtlMs) {
      const mine = Boolean(me) && norm(me) === norm(pending.roleId);
      GM_setValue(K.pending, null);
      const waiting = GM_getValue(K.expect, null);
      if (mine && waiting && norm(waiting.roleId) === norm(me)) GM_setValue(K.expect, null);
      // В ручном режиме шаг делает только нажатие: на загрузке страницы
      // ограничиваемся уборкой, а не отправкой плана за спиной Мастера.
      const act = manual || GM_getValue(K.auto, false);
      log(
        `Снял просроченную отправку из очереди (${Math.round(age / 60000)} мин): задание до адресата не дошло, ` +
          `это остаток прошлой попытки. ` +
          (mine
            ? act
              ? "Продолжаю шаг с чистого листа."
              : "Нажмите «Шаг», чтобы начать заново."
            : "Вернитесь на страницу адресата и повторите."),
        true,
      );
      return !act;
    }

    if (!me || norm(me) !== norm(pending.roleId)) return false;

    if (generating()) {
      pendingSay(pending, "Агент ещё отвечает: задание из очереди подождёт и уйдёт, как только он закончит.");
      return true;
    }

    const { editor, closed, overlay } = await ensureComposer();
    if (closed) log(`Убрал плашку, которая закрывала чат${closed > 1 ? ` (${closed} раз)` : ""}.`);
    if (!editor) {
      pendingSay(
        pending,
        `Не нашёл поле ввода на странице адресата (${composerDiagnostics()}): задание осталось в очереди и не потеряется.` +
          (overlay ? " Поле перекрыто, а кнопки закрытия не видно — закройте плашку вручную." : ""),
        true,
      );
      setTimeout(() => tick(false), 5000);
      return true;
    }

    // Что было в поле, не важно: задание в очереди — это текущий ход. Прежний
    // запрет на «чужой текст» порождал ложные паузы (остаток прошлой попытки,
    // подсказка редактора), поэтому текст просто заменяется.
    if (composerText(editor)) log("В поле ввода был текст — заменяю его заданием из очереди.");

    // Не вставляем мгновенно после загрузки страницы: ровный машинный ритм
    // выглядит как бот и мешает живому диалогу.
    await sleep(450 + Math.floor(Math.random() * 900));
    if (!writePrompt(editor, pending.text)) {
      pendingSay(pending, "Не удалось вставить задание в редактор: оно осталось в очереди.", true);
      return true;
    }
    await sleep(600);

    // Водяной знак — id последнего сообщения ДО отправки. На странице
    // отправителя он был бы чужим, и «ответ без маркера» нельзя было бы
    // отличить от старой переписки.
    const watermark = lastMessageId();
    const delivery = await deliver(editor, pending.text);
    if (!delivery.ok) {
      pause(
        `${delivery.reason}. Задание осталось в поле ввода и в очереди: поправьте и нажмите «Продолжить».`,
        { kind: "send" },
      );
      return true;
    }
    const expect = GM_getValue(K.expect, null);
    if (expect && norm(expect.roleId) === norm(me)) {
      GM_setValue(K.expect, { ...expect, watermark, sentAt: Date.now(), verified: true });
      dbg("Send: доставка подтверждена, отметка внутри чата", { watermark, via: delivery.via || "message" });
    }
    GM_setValue(K.pending, null);
    pendingNoticeAt = 0;
    log("Задание отправлено.");
    return true;
  }

  // ───────────────────── следы прошлых попыток (очистка) ─────────────────────
  /**
   * Хранилище ScriptCat не обнуляется при обновлении скрипта.
   *
   * Поэтому очередь и ожидание, записанные прошлой версией, «всплывали» уже
   * в новом запуске: шаг ссылался на отправку, которой не было, а журнал
   * выглядел так, будто скрипт помнит что-то постороннее. Начиная с 1.4.9
   * состояние помечается версией и после обновления снимается один раз.
   */
  function transientState() {
    return {
      pending: GM_getValue(K.pending, null),
      expect: GM_getValue(K.expect, null),
      last: GM_getValue(K.lastSend, null),
    };
  }

  /** Понятное описание того, что накопилось: без чтения кода. */
  function describeTransient(state) {
    const parts = [];
    if (state.pending) {
      parts.push(
        `очередь: «${state.pending.roleId}», ${String(state.pending.text || "").length} симв.`,
      );
    }
    if (state.expect) {
      parts.push(
        `ожидание: «${state.expect.roleName || state.expect.roleId}», ${state.expect.kind || "?"}` +
          (state.expect.sentAt ? "" : ", без отметки отправки"),
      );
    }
    if (state.last) parts.push("защита от повторов");
    return parts.join("; ");
  }

  /** Снять очередь, ожидание и защиту от повторов. Журнал и настройки не трогаем. */
  function resetState() {
    const state = transientState();
    GM_setValue(K.pending, null);
    GM_setValue(K.expect, null);
    GM_setValue(K.lastSend, null);
    GM_setValue("cfn-plan-at", 0);
    GM_setValue(K.step, false);
    GM_setValue(K.stateV, SCRIPT_VERSION);
    return { ...state, text: describeTransient(state) };
  }

  /**
   * Один раз после обновления.
   *
   * Снимаем только то, что заведомо не доходило до чата: ожидание без отметки
   * отправки. Настоящая отправка (`sentAt` стоит после появления сообщения)
   * и очередь с текстом остаются — иначе обновление посреди хода потеряло бы
   * задание или заставило Координатора выдать второй план.
   */
  function migrateState() {
    const seen = String(GM_getValue(K.stateV, "") || "");
    if (seen === SCRIPT_VERSION) return "";
    GM_setValue(K.stateV, SCRIPT_VERSION);

    const expect = GM_getValue(K.expect, null);
    if (!expect || Number(expect.sentAt)) return "";
    GM_setValue(K.expect, null);
    GM_setValue("cfn-plan-at", 0);
    const who = `«${expect.roleName || expect.roleId}», ${expect.kind || "?"}`;
    log(
      `Обновился до ${SCRIPT_VERSION}${seen ? ` с ${seen}` : ""}: снял ожидание без отметки отправки (${who}) — ` +
        "в чат оно не уходило, это след прошлой попытки. Очередь и журнал на месте.",
      false,
      { skip: true },
    );
    return who;
  }

  /** Кнопка ↺: очистка по воле Мастера, с показом того, что снимается. */
  function resetStateDialog() {
    const what = describeTransient(transientState());
    if (!what) {
      log("Сбрасывать нечего: очередь пуста, ожидания нет.");
      return;
    }
    if (!confirm(`Сбросить очередь и ожидание?\n\n${what}\n\nЖурнал и настройки останутся.`)) return;
    resetState();
    log(`Сбросил состояние вручную (${what}). Нажмите «Шаг», чтобы начать с чистого листа.`);
    setStatus();
  }

  // ───────────────────────────── PR ─────────────────────────────
  /**
   * Проверка видимости — общая (`visible` в утилитах). Поймано пробой на
   * разметке Arena: скрытый бейдж «Merged» остаётся в DOM рядом с видимым
   * «Closed», а поиск по одному querySelector находил именно скрытый и считал
   * закрытый PR слитым.
   */
  /**
   * Бейдж ищем только среди видимых. В DOM Arena остаются скрытые элементы
   * прошлых состояний: без этой проверки «Merged» находился на странице, где
   * показан только «Closed».
   */
  const badgeVisible = (label) =>
    [...document.querySelectorAll(`[aria-label="${label}"]`)].some(visible);

  const createPr = () =>
    [...document.querySelectorAll('button[aria-label="Create pull request"]')].find(visible) || null;

  const mergePr = () =>
    [...document.querySelectorAll('button[aria-label="Merge pull request"]')].find(visible) || null;

  const mergedFlag = () => badgeVisible("Pull request merged");

  /**
   * «Closed» — не синоним ошибки. Так выглядит и PR, слитый через GitHub, и PR,
   * закрытый без мержа. Что именно произошло, решает маркер исполнителя
   * (`merged: true`), а не бейдж: из ScriptCat нет доступа к API GitHub.
   */
  const closedFlag = () => badgeVisible("Pull request closed");

  function continueButton() {
    return [...document.querySelectorAll("button")].find(
      (b) => visible(b) && !b.disabled && (b.textContent || "").trim() === "Continue",
    ) || null;
  }

  function branchName() {
    const el = document.querySelector("span.min-w-0.truncate");
    const text = (el?.textContent || "").trim();
    return /^[\w./-]{3,120}$/.test(text) ? text : "";
  }

  /**
   * Ждём, что PR слит. Агент делает это сам (`gh pr merge`). Кнопки — запасной
   * путь: если агент не запушил, Create PR активна, и мы нажимаем её; ответ
   * агента при этом не считается результатом задания (водяной знак).
   */
  async function ensureMerged(task) {
    const key = `${K.merged}${task.id}`;
    if (GM_getValue(key, false)) return "already";

    const started = Date.now();
    const grace = Date.now() + C.mergeGraceMs;
    let clickedCreate = false;
    let clickedMerge = false;

    while (Date.now() - started < C.prWaitMs) {
      if (mergedFlag()) return finishMerge(task, key);
      if (closedFlag()) return finishClosed(task, key);
      if (continueButton()) return finishMerge(task, key);

      if (Date.now() > grace) {
        const create = createPr();
        if (create && !clickedCreate) {
          clickedCreate = true;
          create.click();
          log("Агент не открыл PR сам — нажата «Create pull request» (запасной путь).");
          await sleep(6000);
          continue;
        }
        const merge = mergePr();
        if (merge && !clickedMerge) {
          clickedMerge = true;
          merge.click();
          log("PR не слит — нажата «Merge pull request» (запасной путь).");
          await sleep(6000);
          continue;
        }
      }
      await sleep(2500);
    }
    return "timeout";
  }

  async function finishMerge(task, key) {
    const cont = continueButton();
    if (cont) {
      cont.click();
      log("Нажата Continue после мержа.");
      await sleep(3000);
    }
    const branch = branchName();
    if (branch) {
      GM_setValue(K.branch, branch);
      try {
        await patch(task.id, { Branch: { rich_text: [{ type: "text", text: { content: branch } }] } });
        log(`Рабочая ветка: ${branch}`);
      } catch (e) {
        throw new Error(`PR слит, но ветка ${branch} не записана в Notion: ${e.message}`);
      }
    }
    GM_setValue(key, true);
    return "merged";
  }

  /**
   * PR закрыт. Дальше на странице остаётся только Continue — жмём её, чтобы
   * цикл не встал, и читаем новую рабочую ветку. Решение «слито или провалено»
   * принимает вызывающий код по маркеру исполнителя.
   */
  async function finishClosed(task, key) {
    const cont = continueButton();
    if (cont) {
      cont.click();
      log("PR закрыт: нажата Continue, состояние передано дальше.");
      await sleep(3000);
    }
    const branch = branchName();
    if (branch) {
      GM_setValue(K.branch, branch);
      try {
        await patch(task.id, { Branch: { rich_text: [{ type: "text", text: { content: branch } }] } });
        log(`Рабочая ветка: ${branch}`);
      } catch (e) {
        throw new Error(`PR закрыт, но ветка ${branch} не записана в Notion: ${e.message}`);
      }
    }
    GM_setValue(key, "closed");
    return "closed";
  }

  /** Ссылка на PR: принимаем и номер, и готовый URL. */
  function prUrl(pr) {
    const value = String(pr ?? "").trim().replace(/^#/, "");
    if (!value) return "";
    if (/^https?:\/\//.test(value)) return value;
    return /^\d+$/.test(value) ? `https://github.com/${C.repo}/pull/${value}` : "";
  }

  /** Исполнитель утверждает, что слил PR сам. Единственный доступный сигнал. */
  const hasMergedClaim = (result) =>
    !!result && (result.merged === true || String(result.status || "").toLowerCase() === "merged");

  // ───────────────────────── техническая информация ─────────────────────────
  /**
   * Блок, который ScriptCat дописывает в КАЖДОЕ исходящее сообщение.
   *
   * Зачем: агент попадает в песочницу, где checkout — не main, а ветка-снимок
   * без общей истории с main (проверено: `git merge-base HEAD origin/main`
   * пусто, 46 файлов main в снимке отсутствуют). Агент, который этого не
   * знает, коммитит в мёртвую историю, а его PR показывает удаление чужих
   * файлов. Ни Координатор, ни регламент этого не видят — знание о среде
   * должно приходить автоматически, вместе с заданием.
   *
   * Блок разный по функции роли (поле «Функция» в базе «Роли»):
   *   Executor    — стартовый ритуал, зона, порядок PR и маркер;
   *   Auditor     — только origin/main, писать нельзя;
   *   Coordinator — git не нужен вообще, инструменты Notion и Drive.
   */

  const TECH_OPEN = "<!-- CF_TECH v1 -->";
  const TECH_CLOSE = "<!-- /CF_TECH -->";
  const TECH_TITLE = "ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ";

  const stampUtc = () => `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`;

  /** Шапка блока: предупреждение, что это не задание. */
  function techHeader(role) {
    return [
      TECH_OPEN,
      `━━━ ${TECH_TITLE} · ${role.name} · ${stampUtc()} ━━━`,
      "Это не задание и не текст Координатора: это факты о среде, в которой ты",
      "работаешь. Задание — ниже, под блоком.",
    ].join("\n");
  }

  /** Факт о стартовом состоянии: он одинаков для всех, кто трогает репозиторий. */
  const SNAPSHOT_FACT = [
    `Репозиторий: ${C.repo}, единственная ветка для мержа — main.`,
    "ВНИМАНИЕ: Arena может посадить сессию на ветку-СНИМОК. У неё нет общей истории",
    "с main: `git merge-base HEAD origin/main` печатает пусто, а в дереве нет файлов,",
    "которые в main уже есть (замер 2026-10-22: 46 файлов, включая сам этот скрипт;",
    "число растёт с каждой миссией).",
    "Коммит в такой ветке в main не попадёт, а PR покажет удаление чужих файлов.",
  ].join("\n");

  const EXECUTOR_TECH = [
    SNAPSHOT_FACT,
    "",
    "СТАРТ (до первой правки):",
    "  git fetch origin main",
    "  git merge-base HEAD origin/main     # пусто → ты на снимке",
    "  git status --short                  # есть незапушенное — сначала сохрани",
    "  git reset --hard origin/main        # дерево как в main, история остаётся",
    "  git switch -c nar/<номер> origin/main",
    "  git diff --stat main                # до работы — пусто",
    "",
    "ЗАПРЕЩЕНО: работать на снимке; коммитить в ветку без общей истории с main;",
    "трогать пути вне своего Scope; мержить кнопкой в интерфейсе.",
    "РАЗРЕШЕНО: только своя зона из карточки, PR в main через `gh`, squash-мерж.",
  ].join("\n");

  const AUDITOR_TECH = [
    SNAPSHOT_FACT,
    "",
    "ТЫ НЕ ПИШЕШЬ: ни ветки, ни коммита, ни пуша, ни PR. Твой выход — отчёт.",
    "ИСТОЧНИК ИСТИНЫ — origin/main, а не твоё рабочее дерево и не ветка сессии:",
    "  git fetch origin main",
    "  git log --oneline -5 origin/main",
    "  git show origin/main:<путь>          # файл из main, без checkout",
    "Проверяемая работа — это PR, слитый в main:",
    "  gh pr view <номер> --json state,mergeCommit",
    "  gh pr diff <номер>",
    "Свою ветку как эталон не используй: она может быть снимком без части файлов.",
  ].join("\n");

  const COORDINATOR_TECH = [
    "Git и репозиторий тебе не нужны: ты не читаешь код и не запускаешь команды.",
    "Твои инструменты — Notion (Миссии, Запросы, Роли) и Drive (логи передач).",
    "Ветки, коммиты и PR — не твоя зона: за них отвечают Executor и Auditor.",
    "Очередь — твоя: нарезка, Кому, Sequence, число Ready. Оракул фазы — не твоя:", 
    "команду проверки и инварианты менять нельзя, только ADR proposed с паузой.",
  ].join("\n");

  const TECH_BY_FN = {
    Executor: EXECUTOR_TECH,
    Auditor: AUDITOR_TECH,
    Coordinator: COORDINATOR_TECH,
  };

  /**
   * Полный блок для роли. Неизвестная функция трактуется как Executor:
   * забыть поле «Функция» безопаснее в сторону «проверь ветку», чем в
   * сторону «делай что хочешь».
   */
  function technicalInfo(role) {
    const body = TECH_BY_FN[role.fn] || EXECUTOR_TECH;
    return [techHeader(role), "", body, "", TECH_CLOSE].join("\n");
  }

  // ───────────────────────────── промпты ─────────────────────────────
  /** Правило поведения зависит от функции: аудитору и координатору мерж не положен. */
  function roleRule(role) {
    if (role.fn === "Auditor") {
      return [
        "Ты ничего не меняешь в репозитории: находки идут в отчёт, чинит исполнитель.",
        "Новые проверки и пробы добавлять можно и нужно; ослаблять существующие — нельзя.",
      ].join(" ");
    }
    if (role.fn === "Coordinator") {
      return [
        "Ты принимаешь решения в Notion; код, ветки и PR — не твоя зона.",
        "Нарезка, порядок, Кому, Sequence и число Ready — твои.",
        "Черновики карточек из ТЗ — предложение, а не приказ: перекраивай.",
        "Оракул и инварианты не твои: ослабить можно только ADR proposed с паузой.",
      ].join(" ");
    }
    return [
      "Не меняй чужие зоны. Мерж PR делаешь сам командой, кнопки интерфейса не нажимай.",
      "ТЗ — направление, а не инструкция: где оно молчит, решай сам, выбирай обратимый",
      "вариант и пиши три строки (неясно / решил / откат) в docs/decisions/<миссия>.md.",
      "Смоуки, эталон, контракты и существующие типы — оракул: ослаблять нельзя.",
    ].join(" ");
  }

  function roleContext(role) {
    return [
      `Ты — ${role.name}.`,
      role.zone ? `Твоя зона записи: ${role.zone}.` : "",
      role.gate ? `Гейт: ${role.gate}.` : "",
      `Регламент: ${C.pageUrl}`,
      roleRule(role),
    ].filter(Boolean).join("\n");
  }

  /** Порядок работы для того, кто пишет код: коммит, пуш, PR, мерж. */
  function executorOrder(task, runId) {
    return [
      "ПОРЯДОК (каждый ход, обязательно)",
      "1. Ветка: git switch -c nar/<номер задачи> от свежего main (ритуал старта — в блоке выше).",
      "2. Коммит: git add -A && git commit -m \"<номер>: <суть>\".",
      "3. Пуш: git push -u origin HEAD.",
      "4. PR и мерж — САМ, командами, не кнопками:",
      "   gh pr create --fill --base main   # если PR уже есть — пропусти",
      "   gh pr merge --squash --delete-branch",
      "5. Проверка: команда, код возврата, путь к отчёту. Если задание молчит в чём-то,",
      "   реши сам и запиши решение в docs/decisions/<миссия>.md — останавливаться не нужно.",
      "6. Последней строкой ответа — ровно один маркер:",
      `CF_AGENT_RESULT {"dispatch_id":"${task.id}","run_id":"${runId}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR>,"merged":true}`,
      "`pr` и `merged: true` обязательны, если PR слит: по ним отличают «слит» от «закрыт без мержа» — бейдж в интерфейсе у обоих случаев один и тот же (Closed).",
      "",
      "Кнопки «Create pull request» и «Merge pull request» нажимать не нужно: это запасной",
      "путь, если ты не запушил сам. После мержа Continue нажимается автоматически.",
    ];
  }

  /** Порядок для аудитора: ничего не менять, только проверить и вынести вердикт. */
  function auditorOrder(task, runId) {
    return [
      "ПОРЯДОК (каждый ход, обязательно)",
      "1. В репозитории ничего не менять: ни ветки, ни коммита, ни пуша, ни PR.",
      "2. Собрать факты из origin/main и из слитого PR (команды — в блоке выше).",
      "3. Вердикт: pass или fail, каждое утверждение — с командой, которой его проверить.",
      "4. Находки — в отчёт; чинить их будет исполнитель, а не ты.",
      "5. Последней строкой ответа — ровно один маркер:",
      `CF_AGENT_RESULT {"dispatch_id":"${task.id}","run_id":"${runId}","status":"submitted","check":0,"report":"<путь к отчёту>"}`,
      "`check: 0` — вердикт pass, любой другой код — fail. PR и merged для аудита не нужны:",
      "отдельного PR у тебя нет: мержа здесь не ждут, ответ записывается сразу.",
    ];
  }

  function executorPrompt(task, role, payload, logId, runId) {
    return [
      technicalInfo(role),
      "",
      `Задача ${taskTitle(task)} (dispatch ${task.id}, run ${runId}).`,
      "",
      "ЦЕЛЬ И ГРАНИЦЫ",
      `Намерение: ${rt(task.properties["Намерение"]) || taskTitle(task)}`,
      `Инварианты: ${rt(task.properties["Инварианты"]) || "не заданы — держи поведение неизменным"}`,
      `Оракул (как принимают): ${rt(task.properties["Acceptance"]) || "не задан"}`,
      `Свободно: ${rt(task.properties["Свободно"]) || "как решишь, если проходят инварианты"}`,
      `Scope: ${rt(task.properties["Scope"]) || "не задан"}`,
      "",
      "ЗАДАНИЕ",
      payload || "(текст задания не найден — работай по карточке)",
      "",
      ...(role.fn === "Auditor" ? auditorOrder(task, runId) : executorOrder(task, runId)),
      "",
      roleContext(role),
      `Лог попытки: https://drive.google.com/file/d/${logId}/view`,
    ].join("\n");
  }

  function coordinatorPrompt(mission, role, queueSummary, turnId, note = "") {
    return [
      technicalInfo(role),
      "",
      `Миссия: ${rt(mission.properties["Миссия"])}.`,
      `ТЗ: ${mission.properties["ТЗ URL"]?.url || "не задано"}`,
      `Очередь: ${queueSummary}`,
      note ? `Комментарий: ${note}` : "",
      "",
      "Кому, Sequence, порядок и число Ready ставишь ты. Черновики ТЗ — предложение, а не приказ.",
      "Оракул и инварианты менять нельзя: только ADR proposed и пауза миссии.",
      "",
      "Твой ход. Ровно одно действие:",
      "1) есть Submitted → проверь по Acceptance и поставь Accepted или Rework (причина в «Ответ»);",
      "2) нужен исполнитель → создай карточку в «Запросы»: Намерение, Инварианты, Acceptance (оракул — команда), Свободно, Scope, Кому, Sequence, Миссия, Dispatch State = Ready;",
      "3) миссия выполнена → поставь «Состояние» = «Завершена» и направь ход done.",
      "",
      "Последней строкой ответа:",
      `CF_COORDINATOR_RESULT {"mission_id":"${mission.id}","turn_id":"${turnId}","status":"completed","next":"<роль|done>"}`,
      "",
      roleContext(role),
    ].filter(Boolean).join("\n");
  }

  // ───────────────────────────── ход исполнителя ─────────────────────────────
  async function submitExecutor(role, expect, manual = false) {
    const candidates = messagesAfter(expect.watermark)
      .map((m) => ({ ...m, result: parseMarker(m.raw, "CF_AGENT_RESULT") }))
      .filter((m) => m.result);
    const exact = candidates.filter((m) => norm(m.result.dispatch_id) === norm(expect.ref));
    const hit = (exact.length ? exact : candidates).at(-1);
    if (!hit) return markerMissing(role, expect, "CF_AGENT_RESULT", manual);

    const result = hit.result;
    if (GM_getValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, false)) return false;

    const page = await notion("GET", `pages/${result.dispatch_id}`);
    if (taskState(page) !== "Running") {
      log("Задача уже не Running — повторная запись не нужна.");
      return false;
    }
    if (norm(rt(page.properties["Recipient Agent ID"])) && norm(rt(page.properties["Recipient Agent ID"])) !== norm(role.id)) {
      log("Ответ принадлежит другому агенту — пропуск.", true);
      return false;
    }

    const logId = rt(page.properties["Output Drive File ID"]);
    if (!logId) throw new Error("В карточке нет Output Drive File ID.");
    const marker = `<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id} -->`;
    await gateway("append", logId, {
      marker,
      entry: `\n\n${marker}\n## Ответ ${role.name}\n\n${hit.text}\n`,
    });

    // Аудитор не открывает PR: ждать мерж и нажимать Continue нечего.
    // Иначе цикл встал бы на 5 минут на каждом аудите.
    const merged = role.fn === "Auditor" ? "none" : await ensureMerged(page);

    // PR закрыт. Так выглядит и ручной мерж через GitHub, и отказ от работы:
    // различаем по маркеру. Без заявки о мерже работа в main не попала —
    // возвращаем карточку в Rework с причиной, решение остаётся за Координатором.
    if (merged === "closed" && !hasMergedClaim(result)) {
      const reason = "PR закрыт без мержа (Closed). Работа в main не попала — нужна повторная выдача.";
      try {
        await gateway("append", logId, {
          marker: `<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id}:closed -->`,
          entry: `\n\n<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id}:closed -->\n## PR закрыт без мержа\n\n${reason}\n`,
        });
      } catch (e) {
        log(`Причина не записана в лог: ${e.message}`, true);
      }
      await patch(result.dispatch_id, {
        "Dispatch State": { select: { name: "Rework" } },
        "Ответ": { rich_text: [{ type: "text", text: { content: `${reason} Ответ ${hit.id} в логе ${logId}.` } }] },
      });
      GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
      log(`«${taskTitle(page)}» → Rework: PR закрыт без мержа.`);
      const coord = (await roles()).find((r) => r.fn === "Coordinator");
      if (!coord) throw new Error("Нет активного Coordinator.");
      GM_setValue(K.expect, null);
      await goTo(coord);
      return true;
    }

    if (merged === "timeout")
      throw new Error(`PR по «${taskTitle(page)}» не слит за отведённое время. Проверьте страницу Arena.`);

    const props = {
      "Dispatch State": { select: { name: "Submitted" } },
      "Ответ": { rich_text: [{ type: "text", text: { content: `Ответ ${hit.id} записан в лог ${logId}.` } }] },
      "Submitted At": { date: { start: nowIso() } },
    };
    if (typeof result.check === "number") props["Check"] = { select: { name: result.check === 0 ? "pass" : "fail" } };
    if (result.report) props["Report SHA"] = { rich_text: [{ type: "text", text: { content: String(result.report).slice(0, 200) } }] };
    const link = prUrl(result.pr);
    if (link) props["PR"] = { url: link };
    await patch(result.dispatch_id, props);
    GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
    log(
      `Ответ ${role.name} записан, PR ${merged === "closed" ? "закрыт как слитый" : "слит"}, задача → Submitted.` +
        (link ? ` PR: ${link}` : " (номер PR не указан в маркере)"),
    );

    const co = (await roles()).find((r) => r.fn === "Coordinator");
    if (!co) throw new Error("Нет активного Coordinator.");
    GM_setValue(K.expect, null);
    await goTo(co);
    return true;
  }

  // ───────────────────────────── ход Координатора ─────────────────────────────
  async function releaseStalled(mission) {
    const running = await tasks("Running", mission);
    const limit = 45 * 60 * 1000;
    for (const card of running) {
      const started = card.properties["Started At"]?.date?.start;
      if (!started) continue;
      if (Date.now() - Date.parse(started) < limit) continue;
      await patch(card.id, { "Dispatch State": { select: { name: "Ready" } } });
      log(`«${taskTitle(card)}» зависла в Running — возвращена в Ready.`, false, { ntfy: "quiet" });
    }
  }

  async function coordinatorStep(role, expect, manual = false) {
    const mission = await activeMission();
    if (!mission) {
      log("Нет активной миссии — ждём.");
      return false;
    }
    GM_setValue("cfn-me", role.name);

    await releaseStalled(mission);
    const submitted = await tasks("Submitted", mission);
    const running = await tasks("Running", mission);
    const ready = await tasks("Ready", mission);
    const rework = await tasks("Rework", mission);

    if (expect && (expect.kind === "plan" || expect.kind === "reminder")) {
      const decision = messagesAfter(expect.watermark)
        .map((m) => parseMarker(m.raw, "CF_COORDINATOR_RESULT"))
        .filter(Boolean)
        .at(-1);
      if (!decision) return markerMissing(role, expect, "CF_COORDINATOR_RESULT", manual);

      // Маркер должен относиться к этому ходу: иначе легко принять решение
      // прошлой итерации за новое и выдать не ту карточку.
      const sameMission = !decision.mission_id || norm(decision.mission_id) === norm(mission.id);
      const sameTurn = !expect.turnId || !decision.turn_id || norm(decision.turn_id) === norm(expect.turnId);
      GM_setValue(K.expect, null);
      if (!sameMission || !sameTurn) {
        pause(
          `Маркер Координатора не совпал с ожидающим ходом${expect.turnId ? ` ${expect.turnId}` : ""}: ничего не запускаю.`,
          { kind: "marker-mismatch", ref: mission.id, turnId: expect.turnId },
        );
        return true;
      }
      log(`Маркер Координатора найден: дальше «${decision.next}» (turn ${decision.turn_id || expect.turnId}).`);
      if (decision.next === "done") {
        await patch(mission.id, {
          "Состояние": { select: { name: "Завершена" } },
          "Завершена": { date: { start: nowIso() } },
        });
        GM_setValue(K.auto, false);
        log("Миссия завершена Координатором. Автоцикл остановлен.", false, { ntfy: "loud", title: "Narthex: миссия завершена" });
        return true;
      }
      const roleName = decision.next;
      const card = ready.find((t) => taskRole(t) === roleName) || ready[0];
      if (!card) throw new Error(`Координатор направил ход в «${roleName}», но Ready-карточки нет.`);
      return dispatchTask(card, roleName);
    }

    const lastPlan = GM_getValue("cfn-plan-at", 0);
    // Защита от спама: план Координатора — не чаще раза в минуту. В ручном
    // режиме это иначе выглядит как «кнопка не работает».
    if (Date.now() - lastPlan < 60_000) {
      if (manual) log(`Шаг не выполнен: план запрашивали ${Math.ceil((60_000 - (Date.now() - lastPlan)) / 1000)} с назад.`);
      return false;
    }
    GM_setValue("cfn-plan-at", Date.now());

    const summary = `${submitted.length} Submitted, ${running.length} Running, ${ready.length} Ready, ${rework.length} Rework`;
    const note = submitted.length
      ? "Сначала разбери Submitted."
      : rework.length
        ? "Есть Rework: посмотри «Ответ» — там причина (например, PR закрыт без мержа)."
        : "";
    const turnId = uid();
    log(`План Координатора запрошен (${summary}).`);
    await sendToRole(role, coordinatorPrompt(mission, role, summary, turnId, note), "plan", mission.id, {
      missionId: mission.id,
      turnId,
      title: "план Координатора",
    });
    return true;
  }

  async function dispatchTask(card, roleName) {
    const role = (await roles()).find((r) => r.name === roleName);
    if (!role) throw new Error(`Роль «${roleName}» не найдена среди активных.`);

    const runId = uid();
    const payloadId = rt(card.properties["Payload Drive File ID"]);
    let payload = "";
    if (payloadId) {
      try {
        payload = (await gateway("read", payloadId)).content || "";
      } catch (e) {
        throw new Error(`Payload не прочитан: ${e.message}`);
      }
    }
    let logId = rt(card.properties["Output Drive File ID"]);
    if (!logId) {
      const created = await gateway("createLog", "", { dispatchId: card.id, runId });
      logId = created.fileId;
    }
    await patch(card.id, {
      "Dispatch State": { select: { name: "Running" } },
      "Run ID": { rich_text: [{ type: "text", text: { content: runId } }] },
      "Recipient Agent ID": { rich_text: [{ type: "text", text: { content: role.id } }] },
      "Output Drive File ID": { rich_text: [{ type: "text", text: { content: logId } }] },
      "Started At": { date: { start: nowIso() } },
    });
    log(`Выдан ход ${roleName}: «${taskTitle(card)}».`);
    return Boolean(await sendToRole(role, executorPrompt(card, role, payload, logId, runId), "dispatch", card.id, {
      runId,
      title: taskTitle(card),
    }));
  }

  // ───────────────────────────── цикл ─────────────────────────────
  let busy = false;
  let busyAt = 0;

  /**
   * Отправка без подтверждения — не отправка.
   *
   * До 1.4.7 `sentAt` ставился сразу после клика, не глядя, дошёл ли он:
   * карточка «review panel» возвращалась и накрывала кнопку Send, сообщение
   * не появлялось, а скрипт потом честно ждал ответа на несуществующий
   * вопрос. Такое ожидание возвращаем в очередь и отправляем заново.
   */
  function reviveUnverifiedHandoff() {
    const waiting = GM_getValue(K.expect, null);
    if (!waiting || !Number(waiting.sentAt) || waiting.verified === true) return "";

    // Если после водяного знака в чате уже что-то появилось, отправка всё-таки
    // дошла (или агент успел ответить): повторять нельзя, иначе будет дубль.
    if (messagesAfter(waiting.watermark || "").length) {
      GM_setValue(K.expect, { ...waiting, verified: true });
      dbg("revive: после водяного знака есть сообщения — считаю отправку доставленной");
      return "";
    }

    const text = String(waiting.text || "");
    GM_setValue(K.expect, null);
    GM_setValue("cfn-plan-at", 0);
    if (!text) {
      log(
        "Снял ожидание без подтверждённой отправки: в чат ничего не ушло, текста задания не сохранилось. " +
          "Нажмите «Шаг», чтобы начать ход заново.",
        true,
      );
      return "dropped";
    }
    GM_setValue(K.pending, { roleId: waiting.roleId, text, at: Date.now() });
    log(
      `Прошлая отправка «${waiting.title || waiting.kind}» не подтверждена (сообщение в чате не появилось) — ` +
        "ставлю задание обратно в очередь и отправляю заново.",
      true,
    );
    return "revived";
  }

  async function tick(fromToggle = false) {
    if (busy) {
      // Шаг мог повиснуть на сетевом запросе без таймаута. Тогда «Шаг» и
      // автоцикл молчат навсегда — снимаем блокировку и говорим об этом.
      if (Date.now() - busyAt < 120000) {
        if (fromToggle) log("Шаг уже выполняется: дождитесь его конца, повторный не нужен.");
        return;
      }
      log("Предыдущий шаг висел больше двух минут: снимаю блокировку и пробую снова.", true);
      busy = false;
    }
    // Незавершённая отправка живёт в очереди и не зависит от автоцикла:
    // иначе после перехода на страницу адресата задание никто не досылал.
    const auto = GM_getValue(K.auto, false);
    const pending = GM_getValue(K.pending, null);
    const waiting = GM_getValue(K.expect, null);
    if (!auto && !fromToggle && !pending && !waiting) return;
    // Пауза снимается только человеком: тик не имеет права её обойти.
    if (isPaused()) {
      if (fromToggle) log(`Шаг не выполнен: цикл на паузе (${GM_getValue(K.paused, "")}).`, true);
      return;
    }
    busy = true;
    busyAt = Date.now();
    try {
      // Ошибка на экране важнее любого шага: сначала остановиться.
      if (monitorVisibleErrors()) return;
      await setup(false);
      dbg("tick: состояние", {
        fromToggle,
        path: location.pathname,
        pending: Boolean(GM_getValue(K.pending, null)),
        expect: GM_getValue(K.expect, null) && {
          kind: GM_getValue(K.expect, null).kind,
          sentAt: GM_getValue(K.expect, null).sentAt,
          verified: GM_getValue(K.expect, null).verified,
        },
      });
      const revived = reviveUnverifiedHandoff();
      if (await consumePending(fromToggle)) return;
      // Фантом старой версии снят, повторять нечего: без нажатия не начинаем ход.
      if (revived === "dropped" && !auto && !fromToggle) return;
      // Ручной режим: нажатие «Шаг» делает ровно один шаг. Фон (таймер)
      // досылает очередь после перехода, но не читает ответы и не выдаёт
      // новые задания: иначе один ход превращался в цепочку из трёх отправок.
      if (!auto && !fromToggle) return;
      if (fromToggle) dbg("шаг: начало", () => debugSnapshot());
      const meId = roleFromPath();
      if (!meId) {
        // Мастер не обязан помнить, на какой странице стоит цикл: «Шаг»
        // открывает Координатора сам и выполняет шаг уже там.
        if (!fromToggle) return;
        const list = await roles();
        const coord = list.find((r) => r.fn === "Coordinator");
        if (!coord) {
          log("Шаг не выполнен: нет активного Coordinator с заполненным «Agent URL».", true);
          return;
        }
        // Если задание уже ждёт адресата, страница досылает его сама —
        // второй шаг не нужен и мог бы выдать лишний ход.
        if (!GM_getValue(K.pending, null)) GM_setValue(K.step, true);
        log(`Сейчас ${location.pathname || "/"} — открываю страницу Координатора и выполню шаг там.`);
        location.assign(coord.url);
        return;
      }
      const list = await roles();
      const me = list.find((r) => norm(r.id) === norm(meId));
      if (!me) {
        if (fromToggle)
          log(
            list.length
              ? `Шаг не выполнен: страница ${meId} не привязана к активной роли. Проверьте её «Agent URL».`
              : "Шаг не выполнен: нет ни одной активной роли с заполненным «Agent URL» — заполните поле в базе «Роли».",
            true,
          );
        return;
      }
      GM_setValue("cfn-me", me.name);
      setStatus();
      if (generating()) {
        if (fromToggle) log("Шаг не выполнен: агент ещё отвечает.");
        return;
      }

      let expect = GM_getValue(K.expect, null);
      if (expect && norm(expect.roleId) !== norm(me.id)) {
        if (fromToggle) log(`Шаг не выполнен: ход ждёт ответа «${expect.roleName || expect.roleId}», а не «${me.name}».`);
        return;
      }

      // Старая версия помечала напоминание отдельным видом ожидания, и после
      // него Координатор «не узнавал» свой ход и запрашивал новый план —
      // отсюда вторая и третья отправки подряд. Приводим к исходному виду.
      if (expect && expect.kind === "reminder") {
        expect = { ...expect, kind: me.fn === "Coordinator" ? "plan" : "dispatch" };
        GM_setValue(K.expect, expect);
      }

      // Ожидание без отметки отправки — не ожидание. `sentAt` ставит только
      // consumePending в момент нажатия Send на странице адресата, поэтому его
      // отсутствие значит: промпт в чат не попал (страница не открылась,
      // вкладку закрыли, запись осталась от старой версии). Ждать ответа на
      // вопрос, которого никто не задавал, можно бесконечно — снимаем и идём
      // дальше. Заодно сбрасываем троттлинг: прошлый запрос никто не получил.
      if (expect && !Number(expect.sentAt)) {
        GM_setValue(K.expect, null);
        GM_setValue("cfn-plan-at", 0);
        log(
          `${me.name}: в чате нет отметки прошлой отправки — это след прошлой попытки, снимаю ожидание и начинаю ход заново.`,
          true,
        );
        expect = null;
      }

      // Ждать ответа бесконечно нельзя: если агент не прислал ни строки за
      // replyWaitMs, задание до него, скорее всего, не дошло (например,
      // осталось от старой версии). Молчание тут — ошибка, а не терпение.
      if (expect) {
        const since = Number(expect.sentAt || expect.at) || 0;
        const waited = Date.now() - since;
        if (waited > C.replyWaitMs && !messagesAfter(expect.watermark || "").length) {
          dropHandoff(
            `${me.name} не ответил ни одним сообщением за ${Math.round(waited / 60000)} мин: похоже, задание до него не дошло. ` +
              `Очередь и ожидание сняты — нажмите «Продолжить» и пройдите шаг заново.`,
          );
          return;
        }
      }

      if (me.fn === "Coordinator") {
        await coordinatorStep(me, expect, fromToggle);
      } else if (!expect) {
        // Без ожидания `messagesAfter(expect.watermark)` упал бы в catch,
        // и «Шаг» на странице исполнителя ставил бы паузу вместо ответа.
        if (fromToggle) log(`Шаг не выполнен: у «${me.name}» нет задания в очереди. Ход начинается с Координатора.`, true);
      } else {
        await submitExecutor(me, expect, fromToggle);
      }
    } catch (e) {
      pause(`Ошибка цикла: ${e.message}`, { kind: "error" });
    } finally {
      busy = false;
      setStatus();
    }
  }

  // ───────────────────────────── старт ─────────────────────────────
  entries = (GM_getValue(K.log, []) || []).slice(-C.maxLog);
  const boot = () => {
    migrateState();
    mount();
    if (debugOn()) {
      installDebugApi();
      console.info(
        `[Narthex ${SCRIPT_VERSION}] отладка включена на ${location.pathname}. ` +
          "Снимок: __narthex.state(); шаг: __narthex.step(); выключить: __narthex.debug(false) или кнопка 🐞.",
      );
      dbg("boot", () => debugSnapshot());
    }
    if (new URL(location.href).searchParams.has("cf-auto")) {
      const clean = new URL(location.href);
      clean.searchParams.delete("cf-auto");
      history.replaceState(null, "", clean.toString());
      GM_setValue(K.auto, true);
      GM_setValue(K.paused, "");
      GM_setValue(K.pause, null);
      log("Автоцикл включён через ссылку.");
    }
    setStatus();
    setup(false);
    setInterval(() => tick(false), C.tickMs);
    if (GM_getValue(K.step, false)) {
      GM_setValue(K.step, false);
      log("Открыл страницу Координатора — выполняю отложенный шаг.");
      tick(true);
      return;
    }
    tick(false);
  };
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();
