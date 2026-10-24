// ==UserScript==
// @name         Narthex — передача хода между агентами
// @namespace    https://arena.ai/
// @version      1.4.46
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
    continueWaitMs: 20000, // после Merged ждём Continue: без неё агент не получит новую ветку
    prCardWaitMs: 8000, // карточка PR может отрисоваться позже ответа
    prWaitMs: 300000, // общий предел ожидания мержа
    maxLog: 200, // журнал хранится в ScriptCat; панель показывает хвост
    markerIdleMs: 20000, // ответ стабилен столько — считаем, что маркера не будет
    markerReminders: 2, // напоминаний до паузы: дальше решает Мастер
    minAnswerChars: 200, // маркер без отчёта — не ответ: короче — просим отчёт заново
    draftLineMax: 6, // сколько черновиков Координатор видит списком в промпте
    readyLineMax: 6, // сколько карточек Ready Координатор видит списком в промпте
    insertRetries: 3, // с какой попытки вставки в редактор звать Мастера (раньше — сами)
    pendingTtlMs: 600000, // отправка старше 10 минут не досылается: адресат её не получил
    replyWaitMs: 1800000, // 30 минут без единого сообщения — повод остановиться
    sendVerifyMs: 6000, // сколько ждём своё сообщение в чате после нажатия Send
    captchaGuardMs: 8000, // сколько после «отправлено» ждём капчу: она всплывает с задержкой
    stalledMs: 2700000, // 45 минут — и только для карточки, по которой ход потерян
    longWaitNoticeMs: 600000, // раз в 10 минут напоминаем, что долгое ожидание — норма
    pollPauseCount: 3, // столько опросов подряд — уже поломка промпта, а не случайность
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
  /**
   * Момент последнего признака жизни шага. Объявлен здесь, а не рядом с циклом:
   * `sleep` нужен всем, и он же отмечает, что шаг жив.
   */
  let busyAt = 0;

  /**
   * Пауза с отметкой «шаг жив». Сторож снимает блокировку по двухминутной
   * тишине, поэтому долгая, но честная работа не должна выглядеть зависанием:
   * 24.10 в 14:48 живого шага как раз и перезапустили поверх первого.
   */
  const sleep = (ms) => {
    busyAt = Date.now();
    return new Promise((r) => setTimeout(r, ms));
  };
  const norm = (x) => String(x || "").replace(/-/g, "").toLowerCase();
  /** Текст для сравнения: без разницы в регистре и пробелах. */
  const flat = (x) => String(x || "").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
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
    if (!el || !el.isConnected) return false;
    // Нулевая площадь — не «видно». В DOM Arena остаются кнопки и плашки
    // прошлых состояний: rect у них есть, а ширины и высоты нет. Именно такая
    // кнопка Stop от прошлой генерации держала шаг в ожидании.
    const rect = el.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0 && rect.height > 0)) return false;
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
  /**
   * Цвет строки журнала. Красный — ошибка и пауза, зелёный — событие, которое
   * Мастеру важно увидеть (миссия завершена), жёлтый — предупреждение.
   * До 1.4.42 состояний было два, и «задача → Submitted» или конец миссии
   * выглядели как рутина наравне с «открыл страницу роли».
   */
  const logColor = (e) =>
    e.error ? "#ff9a9a" : e.tone === "ok" ? "#8ee28e" : e.tone === "warn" ? "#ffd479" : "inherit";

  function renderLog() {
    const el = document.getElementById(ui.log);
    if (!el) return;
    el.innerHTML = entries
      .slice(-C.maxLog)
      .map((e) => `<div style="opacity:${e.error ? 1 : 0.85};color:${logColor(e)}">${escapeHtml(e.t)}</div>`)
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
    entries.push({ t: `${new Date().toLocaleTimeString("ru-RU")} ${text}`, error, tone: options.tone || "" });
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
  /**
   * В автоцикле тик идёт каждые 15 секунд. Фразы вроде «нет активной миссии»
   * не должны занимать журнал целиком: пишем их не чаще раза в 5 минут.
   */
  const throttleAt = {};
  function logThrottled(key, text, error = false, ms = 300_000) {
    const now = Date.now();
    if (now - Number(throttleAt[key] || 0) < ms) return;
    throttleAt[key] = now;
    log(text, error);
  }

  const NTFY_BASE = "https://ntfy.sh";
  const SCRIPT_VERSION =
    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.46";

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
      auto: autoOn(),
      paused: GM_getValue(K.paused, "") || false,
      pending: GM_getValue(K.pending, null),
      expect: GM_getValue(K.expect, null),
      generating: generating(),
      busy: busyReason(),
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
    /** Что скрипт видит вокруг поля ввода: кандидаты, кнопки, координаты. */
    dom: () => {
      const report = domReport();
      console.info("[Narthex] снимок разметки:", report);
      return report;
    },
    /** Снимок, сохранённый при последнем отказе отправки. */
    sendDebug: () => GM_getValue("cfn-send-debug", null),
    sendButton: () => debugSendButton(composer()),
    panels: () => completionPanels().map(describe),
    /** Капча на экране: без человека цикл не пойдёт. */
    captcha: () => Boolean(captchaDialog()),
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
   * Автоцикл — состояние ОКНА, а не хранилища скрипта.
   *
   * Хранилище ScriptCat переживает браузер: включённый однажды автоцикл
   * подхватывал процесс при следующем открытии страницы, без единого нажатия.
   * Теперь флаг лежит в `sessionStorage`: переживает переходы между страницами
   * агентов в той же вкладке, но исчезает вместе с браузером. Новый запуск
   * всегда начинается с ручного «Включить».
   */
  let autoMem = false;
  function autoOn() {
    try {
      return sessionStorage.getItem(K.auto) === "1";
    } catch {
      return autoMem;
    }
  }
  function autoSet(on) {
    autoMem = Boolean(on);
    try {
      if (on) sessionStorage.setItem(K.auto, "1");
      else sessionStorage.removeItem(K.auto);
    } catch {
      // Приватный режим или запрет storage: остаётся память вкладки.
    }
  }

  /** Старое значение в хранилище скрипта снимаем: оно больше не управляет циклом. */
  function autoForgetPersisted() {
    const stale = GM_getValue(K.auto, false);
    GM_setValue(K.auto, false);
    if (stale) {
      log(
        "Автоцикл прошлой сессии снят: он включается только вручную, кнопкой «Включить».",
        false,
        { skip: true },
      );
    }
  }

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
      wasAuto: autoOn(),
    };
    GM_setValue(K.paused, info.reason);
    GM_setValue(K.pause, info);
    log(`ПАУЗА: ${info.reason}`, true, { skip: true });
    notifyNtfy(`Цикл остановлен и ждёт Мастера: ${info.reason}`, {
      title: context.notifyTitle || "Narthex: пауза",
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

  /**
   * Ход не дошёл до исполнителя — карточка не имеет права оставаться Running.
   *
   * «Running», «Started At» и «Run ID» ставит выдача (`dispatchTask`), и ставит
   * до отправки: иначе Координатор успел бы выдать ту же карточку второй раз.
   * Но «выдана» и «дошла» — разные вещи. Пока сообщения в чате нет, работы по
   * карточке тоже нет, а в Running она ждала бы `releaseStalled` — 45 минут
   * впустую, и всё это время человек видит Running там, где ничего не начато.
   * Вопрос Мастера (53) был ровно про это.
   *
   * Возвращаем Ready и снимаем Run ID со Started At. Своего «Submitted At» и PR
   * у такой карточки нет, поэтому повторная выдача не запрещена.
   */
  function rollbackProps(card, runId) {
    const props = card && card.properties;
    if (!props) return null;
    if (props["Dispatch State"]?.select?.name !== "Running") return null;
    if (props["Submitted At"]?.date?.start || props["PR"]?.url) return null;
    const onCard = rt(props["Run ID"]);
    if (runId && onCard && norm(onCard) !== norm(runId)) return null;
    return {
      "Dispatch State": { select: { name: "Ready" } },
      "Started At": { date: null },
      "Run ID": { rich_text: [] },
    };
  }

  /**
   * Вернуть карточку в Ready, если ход так и не ушёл.
   *
   * true — карточка действительно переписана; вызывающий по этому признаку
   * решает, снимать ли очередь и ожидание. Ошибка Notion ход не съедает: всё
   * остаётся как было, и работает прежнее правило 45 минут.
   */
  async function releaseUndelivered(expect, why) {
    if (!expect || expect.kind !== "dispatch" || !expect.ref) return false;
    let card;
    try {
      card = await notion("GET", `pages/${expect.ref}`);
    } catch (e) {
      log(`Карточку «${expect.ref}» не прочитать — статус не снимаю: ${e.message}`, true);
      return false;
    }
    const runId = rt(card.properties["Run ID"]);
    // Сверяем с выдачей, которая не ушла: если карточку уже перевыдали с другим
    // Run ID, откат снял бы чужой, живой ход.
    const props = rollbackProps(card, expect.runId || runId);
    if (!props) return false;
    try {
      await patch(card.id, props);
    } catch (e) {
      log(`«${taskTitle(card)}» осталась в Running: статус не снялся (${e.message}).`, true);
      return false;
    }
    const logId = rt(card.properties["Output Drive File ID"]);
    if (logId) {
      try {
        await gateway("append", logId, {
          marker: `<!-- CF_DISPATCH ${card.id}:${runId}:undelivered -->`,
          entry:
            `\n\n<!-- CF_DISPATCH ${card.id}:${runId}:undelivered -->\n## Ход не дошёл до исполнителя\n\n` +
            `${why}\n\nКарточка возвращена в Ready, «Started At» и «Run ID» сняты: работы по ней не было.\n`,
        });
      } catch (e) {
        log(`Отметка о неудачной отправке не записалась в журнал: ${e.message}`, true);
      }
    }
    log(`«${taskTitle(card)}» возвращена в Ready: ${why}. В Running она бы ждала 45 минут.`, true, {
      ntfy: "quiet",
      title: "Narthex: карточка возвращена в Ready",
    });
    return true;
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

  /**
   * Проверка после капчи: задание действительно дошло до агента?
   *
   * 24.10 (13:47) отправка была засчитана в 13:47:03, окно проверки всплыло в
   * 13:47:15. Мастер решил капчу и нажал «Продолжить» — а скрипт, у которого
   * очередь уже была снята, честно ждал ответа на сообщение, которого агент не
   * получал: тридцать минут впустую и карточка в Running.
   *
   * Признак настоящей доставки — поздний: агент начал ход. Если после отметки
   * нет ни одного его сообщения и он не работает, ход потерян.
   */
  async function verifyAfterCaptcha(ctx) {
    if (!ctx || ctx.kind !== "captcha") return false;
    const expect = GM_getValue(K.expect, null);
    if (!expect || !expect.sentAt) return false;
    // Агенту нужно время, чтобы начать: сразу после «Продолжить» он молчит и
    // при доставленном задании.
    for (let i = 0; i < 3; i += 1) {
      await sleep(1500);
      if (stillWorking() || generating()) return false;
    }
    if (messagesAfter(expect.watermark || "").length) return false;
    const isDispatch = expect.kind === "dispatch" && Boolean(expect.ref);
    const rolled = isDispatch ? await releaseUndelivered(expect, "капча не пропустила задание") : true;
    GM_setValue(K.expect, null);
    GM_setValue(K.pending, null);
    if (!rolled) {
      log("Задание до агента не дошло: капча закрыла отправку, а карточку вернуть в Ready не удалось. Статус оставлен как есть.", true);
      return false;
    }
    log(
      isDispatch
        ? "Задание до агента не дошло: капча закрыла отправку, ответа нет. Карточка возвращена в Ready — выдаю заново."
        : "Ход Координатора до агента не дошёл: капча закрыла отправку. Запрошу план заново.",
      true,
      { ntfy: "quiet", title: "Narthex: задание не дошло, выдаю заново" },
    );
    return true;
  }

  function roleFromPath() {
    const id = (location.pathname.match(/\/agent\/([\w-]+)/) || [])[1];
    return id || "";
  }

  function setStatus(extra) {
    const el = document.getElementById(ui.status);
    if (!el) return;
    const auto = autoOn();
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
      autoSet(false);
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

  async function toggleAuto() {
    const auto = autoOn();
    const reason = GM_getValue(K.paused, "");

    // Пауза. Снять её может только человек: подтверждение показывает причину.
    if (reason) {
      if (!confirm(`Цикл стоит на паузе.\n\nПричина: ${reason}\n\nСнять паузу и продолжить?`)) return;
      const ctx = GM_getValue(K.pause, null) || {};
      // Возвращаем тот режим, в котором цикл стоял: пауза не должна
      // превращать ручной шаг в постоянный автоцикл.
      autoSet(ctx.wasAuto === true);
      resume("кнопка «Продолжить»");
      // Капча могла всплыть уже после того, как скрипт записал «отправлено»:
      // тогда без этой проверки «Продолжить» ждёт ответа на неотправленное.
      await verifyAfterCaptcha(ctx);
      tick(true);
      return;
    }

    if (auto) {
      autoSet(false);
      log("Автоцикл выключен.");
      return;
    }

    autoSet(true);
    log("Автоцикл включён.");
    // Обычный тик, а не «Шаг»: в автоцикле нет нажатия, и следующая страница
    // открывается сама, если работы нет на текущей.
    tick(false);
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
  /** Сбой на уровне сети: запрос не дошёл. Повторять имеет смысл. */
  const networkish = (text) => /сеть|таймаут|failed to fetch|network|load failed/i.test(String(text || ""));

  function requestOnce(method, url, headers, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        // Строка уходит как есть: шлюз Apps Script читает `postData.contents`
        // и ждёт там JSON-текст, а не JSON-строку в кавычках.
        data: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
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
        onerror: () => reject(new Error("сеть недоступна или хост не разрешён в @connect")),
        ontimeout: () => reject(new Error("таймаут запроса")),
      });
    });
  }

  /**
   * Запрос с одним повтором на сетевом сбое.
   *
   * 24.10 (14:41) шаг упал на «Failed to fetch» посреди записи ответа: цикл
   * встал на паузе из-за секундного сбоя сети. Повтор дешевле, чем Мастер у
   * экрана; повторяем только то, что не дошло (сеть, таймаут), — отказ прав
   * или HTTP 4xx повторять незачем.
   */
  async function request(method, url, headers, body) {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await requestOnce(method, url, headers, body);
      } catch (e) {
        last = e;
        if (!networkish(e && e.message)) break;
        await sleep(700);
      }
    }
    throw last;
  }

  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());

  /**
   * Id из строки-маркера не адресуют запись.
   *
   * 24.10 Kernel прислал «4036f0cf-5705-ba9f-79ed-59fe3b8e» вместо id карточки,
   * и цикл встал на HTTP 400 «path.page_id should be a valid uuid» — работа была
   * сделана, а ход потерялся в паузе. Истина — та выдача, которую движок сам
   * поставил в Running: её id и run_id подставляются вместо чужих.
   */
  function adoptIds(result, expect) {
    const fixed = { ...result };
    const stray = [];
    if (!isUuid(fixed.dispatch_id) || norm(fixed.dispatch_id) !== norm(expect.ref)) {
      stray.push(`dispatch_id «${fixed.dispatch_id || "нет"}»`);
      fixed.dispatch_id = expect.ref;
    }
    if (expect.runId && norm(fixed.run_id) !== norm(expect.runId)) {
      stray.push(`run_id «${fixed.run_id || "нет"}»`);
      fixed.run_id = expect.runId;
    }
    return { result: fixed, stray };
  }

  async function notion(method, path, body) {
    const token = GM_getValue(K.notion, "");
    if (!token) throw new Error("Не задан Notion token: откройте ?cf-auth-setup=1 и нажмите ⚙.");
    // Страховка от чужого текста в адресе: 24.10 исполнитель прислал в маркере
    // id с опечаткой, и Notion ответил HTTP 400 «path.page_id should be a valid
    // uuid», а цикл встал на паузу с нечитаемой причиной. Лучше остановиться
    // здесь и сказать по-русски, что именно не так.
    const segment = String(path).match(/^(?:pages|blocks|data_sources)\/([^/?#]+)/);
    if (segment && !isUuid(segment[1]))
      throw new Error(`в адресе записи битый id «${segment[1]}» — запрос не отправлен`);
    try {
      return await request(method, `https://api.notion.com/v1/${path}`, {
        Authorization: `Bearer ${token}`,
        "Notion-Version": C.notionV,
        "Content-Type": "application/json",
      }, body);
    } catch (e) {
      e.narthex = "notion";
      e.message = `Notion не ответил на ${method} ${path}: ${e.message}`;
      throw e;
    }
  }

  /**
   * Вызов шлюза Drive.
   *
   * 24.10 (14:41) запись ответа упала на «Failed to fetch»: шлюз вызывался
   * обычным `fetch` из страницы Arena, а такой запрос живёт по правилам
   * страницы (CORS и её CSP). Сеть при этом была жива. Теперь первый путь —
   * `GM_xmlhttpRequest` расширения: он страницу обходит, а `@connect
   * script.google.com` в заголовке скрипта уже есть. `fetch` остался вторым,
   * как у пушей.
   */
  async function gateway(action, fileId, extra = {}) {
    const url = GM_getValue(K.gwUrl, "");
    if (!url) throw new Error("Не задан URL шлюза Drive: откройте ⚙ и вставьте ссылку /exec.");
    const payload = JSON.stringify({ action, fileId, key: GM_getValue(K.gwKey, ""), ...extra });
    const headers = { "Content-Type": "text/plain;charset=utf-8" };

    let gmError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await request("POST", url, headers, payload);
        if (data && data.ok === true) return data;
        const why = String((data && data.error) || "шлюз вернул отказ");
        // append идемпотентен по маркеру: «duplicate» — это «запись уже в
        // журнале», а не отказ. Без этого шаг, сорвавшийся ПОСЛЕ записи
        // журнала (так было на NAR-1.10: ответ записан, запись в Notion
        // прервалась), не мог завершиться никогда: повтор упирался в
        // собственный маркер и падал на нём же.
        if (action === "append" && /duplicate/i.test(why)) return { ok: true, duplicate: true };
        throw new Error(why);
      } catch (e) {
        gmError = String((e && e.message) || e);
        if (!networkish(gmError)) break;
        await sleep(700);
      }
    }

    let fetchError = "";
    try {
      const res = await fetch(url, { method: "POST", headers, body: payload });
      const data = await res.json();
      if (data && data.ok === true) return data;
      if (action === "append" && /duplicate/i.test(String((data && data.error) || ""))) return { ok: true, duplicate: true };
      fetchError = String((data && data.error) || `HTTP ${res.status}`);
    } catch (e) {
      fetchError = String((e && e.message) || e);
    }

    const err = new Error(`шлюз Drive не ответил: GM: ${gmError}; fetch: ${fetchError}`);
    err.narthex = "gateway";
    throw err;
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

  /** Вся база «Роли»: и активные, и те, что Мастер ещё не включил. */
  async function roleRows() {
    return (await query(C.roles)).map((p) => {
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
  }

  async function roles() {
    const rows = await roleRows();
    const active = rows.filter((r) => r.id && r.url && r.status === "Активна");
    const ids = active.map((r) => norm(r.id));
    if (new Set(ids).size !== ids.length) throw new Error("Две активные роли указывают на один Agent URL.");
    if (active.filter((r) => r.fn === "Coordinator").length > 1)
      throw new Error("Активных Coordinator больше одного.");
    return active;
  }

  /**
   * Активная миссия — это «Активна» ИЛИ «Возвращена».
   *
   * «Возвращена» ставит Мастер, когда миссия закрыта, а работа не принята:
   * замечания лежат в полях карточки миссии. Если не учитывать это состояние,
   * возврат выглядит как «нет активной миссии», и цикл просто стоит.
   */
  async function activeMission() {
    const rows = await query(
      C.missions,
      {
        or: [
          { property: "Состояние", select: { equals: "Активна" } },
          { property: "Состояние", select: { equals: "Возвращена" } },
        ],
      },
      [{ property: "Создана", direction: "descending" }],
    );
    return rows[0] || null;
  }

  const missionKind = (p) => sel(p.properties["Состояние"]);
  const isReturned = (p) => missionKind(p) === "Возвращена";
  const missionRemarks = (p) => rt(p.properties["Замечания"]).trim();

  /**
   * Первая строка длинного текста: список замечаний в строку журнала не влезет.
   *
   * 24.10 Мастер записал три замечания одним абзацем без переводов строки, и
   * `firstLine` вернула все три целиком — строка журнала на тысячу символов.
   * Теперь длинная строка режется по границе слова: в журнале и пуше видно
   * суть первого замечания, а полный текст остаётся в Notion и в плане.
   */
  const firstLine = (text, max = 220) => {
    const line =
      String(text || "")
        .split("\n")
        .map((part) => part.trim())
        .filter(Boolean)[0] || "";
    if (line.length <= max) return line;
    const cut = line.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
  };

  /**
   * Замечания — по пунктам. Мастер пишет их и списком с переводом строки, и
   * одним абзацем «1) … 2) … 3) …». Координатору нужны отдельные пункты:
   * правило возврата — на каждое замечание своя карточка.
   */
  const remarkItems = (text) =>
    String(text || "")
      // Граница пункта — пробел или точка перед «2) », а не только перевод
      // строки: Notion хранит замечания несколькими rich_text-элементами, и
      // `rt` склеивает их без разделителя («…не менялся.2) docs…»).
      .replace(/([.\s])(\d{1,2}[).]\s)/g, "$1\n$2")
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

  /** Последняя закрытая миссия: по ней видно, что цикл остановился не «просто так». */
  async function lastClosedMission() {
    const rows = await query(
      C.missions,
      {
        or: [
          { property: "Состояние", select: { equals: "Завершена" } },
          { property: "Состояние", select: { equals: "Провалена" } },
        ],
      },
      [{ property: "Завершена", direction: "descending" }],
    );
    return rows[0] || null;
  }

  /**
   * Конец миссии — событие, а не тишина.
   *
   * 24.10 в 15:49 Координатор закрыл NAR-1, а ScriptCat сказал только «Нет
   * активной миссии — ждём»: ни зелёной строки, ни пуша, ни выключенного
   * автоцикла. Мастер узнал о конце миссии из чата. Теперь событие
   * объявляется один раз на миссию: зелёная строка, громкий пуш, автоцикл
   * выключен, ожидание снято.
   */
  async function missionDoneNotice(expect) {
    let closed = null;
    try {
      closed = await lastClosedMission();
    } catch {
      return false; // Notion не ответил — не выдумываем событие
    }
    if (!closed) return false;
    const at = closed.properties?.["Завершена"]?.date?.start || "";
    const waited = Boolean(expect && (expect.kind === "plan" || expect.kind === "reminder"));
    const recent = Boolean(at) && Date.now() - Date.parse(at) < 10 * 60 * 1000;
    // Обычное «миссии пока нет» остаётся тишиной: закрытая миссия недельной
    // давности не повод пушить при каждом открытии страницы.
    if (!waited && !recent) return false;

    const key = `cfn-mission-done:${closed.id}`;
    const announced = Boolean(GM_getValue(key, false));
    if (waited) GM_setValue(K.expect, null);
    if (announced) return waited;

    GM_setValue(key, true);
    autoSet(false);
    const name = rt(closed.properties["Миссия"]) || "миссия";
    const failed = missionKind(closed) === "Провалена";
    log(
      failed
        ? `Миссия «${name}» закрыта как «Провалена». Автоцикл остановлен: дальше решает Мастер.`
        : `Миссия «${name}» завершена${at ? ` (${String(at).slice(0, 10)})` : ""}: очередь пуста, цикл остановлен. ` +
            "Следующая работа — новым ТЗ и новой миссией, а не хвостом этой.",
      false,
      {
        tone: failed ? "warn" : "ok",
        ntfy: "loud",
        title: failed ? "Narthex: миссия провалена" : "Narthex: миссия завершена",
      },
    );
    return true;
  }

  /**
   * Блок замечаний Мастера в плане Координатора. Без него «Возвращена» —
   * просто слово в Notion: агент не знает, что именно не принято.
   */
  function returnBlock(mission) {
    if (!isReturned(mission)) return "";
    const remarks = missionRemarks(mission);
    if (!remarks) return "";
    const at = mission.properties["Возвращена"]?.date?.start || "";
    const items = remarkItems(remarks).map((line) => `- ${line}`);
    return [
      `МИССИЯ ВОЗВРАЩЕНА МАСТЕРОМ${at ? ` ${String(at).slice(0, 10)}` : ""} НА ДОРАБОТКУ. Замечания:`,
      ...items,
      "Правила возврата: на каждое замечание — отдельная карточка с оракулом, который именно это замечание проверяет; переделывать фазу целиком нельзя. " +
        "Миссию можно закрыть только когда все замечания закрыты карточками, а в «Итоге» есть раздел «Возврат» с ответом на каждое.",
    ].join("\n");
  }

  /**
   * Отпечаток возврата: дата, круг и замечания.
   *
   * Повторный возврат той же миссии (новый круг или новые замечания) — это
   * новое событие, а не продолжение прошлого: у него свой отсчёт.
   */
  const returnFingerprint = (mission) =>
    [
      mission.properties?.["Возвращена"]?.date?.start || "",
      String(mission.properties?.["Круг"]?.number ?? ""),
      missionRemarks(mission),
    ].join("|");

  /**
   * Момент, с которого возврат миссии известен скрипту.
   *
   * 24.10 в 15:47 Координатор ответил `done`, миссия закрылась, а ожидание
   * плана осталось висеть: 1.4.41 на «нет активной миссии» его не снимала.
   * В 16:07 Мастер вернул миссию, и в 16:12 шаг принял тот старый `done` за
   * ответ на замечания — пауза «в «Итоге» нет раздела «Возврат»», хотя нового
   * хода Координатора не было вовсе.
   *
   * Поэтому у каждого возврата свой отсчёт: всё, что запрошено раньше, —
   * прошлый ход. Оно снимается, а Координатор получает новый план с
   * замечаниями. Как только план запрошен после отсчёта, он уже не старый:
   * перезагрузка страницы и повторный шаг его не трогают.
   */
  function returnEpoch(mission) {
    const key = `cfn-mission-return-at:${mission.id}`;
    const fp = returnFingerprint(mission);
    const saved = GM_getValue(key, null);
    if (saved && saved.fp === fp && Number(saved.at)) return saved;
    // Время возврата — последняя правка карточки миссии: именно тогда Мастер
    // поставил «Возвращена» и написал замечания. Оно точнее, чем «первый шаг
    // после обновления»: план, запрошенный уже после возврата (например, ещё
    // на 1.4.42), не снимается как прошлый. Нет правки — считаем по часам.
    const edited = Date.parse(mission.last_edited_time || "");
    const fresh = { at: Number.isFinite(edited) && edited <= Date.now() ? edited : Date.now(), fp };
    GM_setValue(key, fresh);
    // 1.4.42 объявляла возврат меткой без отпечатка. Если она есть, этот
    // возврат уже был в журнале — переносим метку, чтобы обновление не дало
    // вторую такую же строку. Дальше метка живёт с отпечатком, и новый
    // возврат (другой круг или замечания) объявляется заново.
    const legacy = `cfn-mission-return:${mission.id}`;
    if (!saved && GM_getValue(legacy, false)) {
      GM_setValue(`cfn-mission-return:${mission.id}:${textHash(fp)}`, true);
    }
    return fresh;
  }

  /**
   * Ожидание Координатора началось до возврата — это прошлый ход, а не ответ
   * на замечания. Снимаем его и разрешаем новый план немедленно: иначе
   * `done` из прошлого хода выглядит как отказ работать, и цикл встаёт на
   * паузу, которой не за что стоять.
   */
  function dropStalePlan(mission, expect, epoch) {
    if (!isReturned(mission) || !expect) return false;
    const at = Number(expect.at) || Number(expect.sentAt) || 0;
    const since = Number(epoch && epoch.at) || returnEpoch(mission).at;
    if (at && at >= since) return false;
    GM_setValue(K.expect, null);
    GM_setValue("cfn-plan-at", 0);
    return true;
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

  /**
   * Тело сообщения — последний настоящий блок `.prose`.
   *
   * В живой разметке Arena первым `[class*="prose"]` оказывается `not-prose`:
   * свёрнутая плашка «Thought for 2 seconds» с черновиком рассуждения. Из-за
   * этого ответом считалось рассуждение без маркера: шаг писал «дописывает
   * ответ» и готовил напоминание, хотя настоящий ответ с маркером лежал
   * следующим блоком.
   */
  const proseBlocks = (node) =>
    [...node.querySelectorAll(".prose")].filter(
      (el) => !el.classList.contains("not-prose") && !el.closest(".not-prose"),
    );

  function messageBody(node) {
    const blocks = proseBlocks(node);
    return blocks.at(-1) || node;
  }

  function messageText(node) {
    const prose = messageBody(node);
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
    const blocks = proseBlocks(node);
    // Разбор идёт по всем настоящим блокам: маркер может оказаться не в
    // последнем, а рассуждения из `not-prose` в него не попадают вовсе.
    return (blocks.length ? blocks : [node])
      .map((el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll("button,svg,[role='alert']").forEach((n) => n.remove());
        return String(clone.textContent || "");
      })
      .join("\n")
      .replace(/\u00a0/g, " ");
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

  /** Наша реплика: в транскрипте Arena она помечена отдельным layout. */
  const isUserNode = (n) => Boolean(n.querySelector('[data-user-message-layout="true"]'));

  /** Строка-результат: такая реплика — ответ, даже если цитирует задание. */
  const RESULT_LINE = /\bCF_(?:AGENT|COORDINATOR)_RESULT\b/;

  /**
   * Наша служебная реплика, потерявшая разметку пользователя.
   *
   * `CF_TECH` есть только в задании и напоминании, но проверять его в лоб
   * нельзя: агент вправе процитировать задание в отчёте, и тогда настоящий
   * ответ выпадал бы из чтения. Цитата с маркером остаётся ответом.
   */
  const looksLikeOwnTask = (raw) => {
    const text = String(raw || "");
    if (RESULT_LINE.test(text)) return false;
    return isOwnPrompt(text) || /^\s*(?:###\s*)?(?:Задача|НАПОМИНАНИЕ)\b/i.test(text);
  };

  /**
   * Время из id сообщения — только как подсказка «из этого хода или из
   * прошлого круга». Arena выдаёт id в формате UUIDv7 (первые 48 бит —
   * миллисекунды), но опираться на это в основной логике нельзя: у неё есть
   * сборки и с другим генератором id. Неправдоподобное время возвращает 0.
   */
  function idTime(id) {
    const hex = String(id || "").replace(/-/g, "");
    if (hex.length < 13) return 0;
    const ms = Number.parseInt(hex.slice(0, 12), 16);
    // Мусор и чужие эпохи — «времени нет». Всё, что попало в разумный
    // диапазон, считается временем сообщения: по нему видно, из этого хода
    // оно или из прошлого круга.
    const floor = Date.UTC(2020, 0, 1);
    if (!Number.isFinite(ms) || ms < floor || ms > Date.now() + 24 * 3600 * 1000) return 0;
    return ms;
  }

  /**
   * Сообщения, появившиеся ПОСЛЕ водяного знака. Водяной знак — id последнего
   * сообщения на момент отправки задания. Без него скрипт читал бы старые
   * ответы: кнопки Create/Merge PR тоже порождают сообщения агента.
   *
   * Граница считается по ПОЛНОМУ списку, вместе с нашими репликами. Прежде
   * она считалась по списку одних ответов, а водяной знак — это id нашей же
   * отправки: в отфильтрованном списке он не находился, и «новых сообщений»
   * не оставалось вовсе. Так 24.10 в 14:27 скрипт сказал «новых сообщений
   * нет», хотя ответ Build/Release с маркером лежал в чате: id сообщений
   * Arena не упорядочены по времени (ответ `01a16da4-10b2…` пришёл позже
   * запроса `01a16da4-1dc9…`, но меньше его).
   */
  function messagesAfter(watermark, seen) {
    const all = messages();
    const one = (n) => ({ id: nodeId(n), text: messageText(n), raw: messageRaw(n), ended: replyEnded(n) });

    let cut = -1;
    if (watermark) cut = all.findIndex((n) => nodeId(n) === watermark);
    if (cut === -1 && Array.isArray(seen) && seen.length) {
      // Водяного знака в разметке нет (транскрипт перерисовали) — границу
      // держит снимок id, снятый перед отправкой.
      const known = new Set(seen);
      const firstNew = all.findIndex((n) => !known.has(nodeId(n)));
      cut = firstNew === -1 ? all.length - 1 : firstNew - 1;
    }
    const tail = cut >= 0 ? all.slice(cut + 1) : all;

    const list = tail.filter((n) => !isUserNode(n) && !looksLikeOwnTask(messageRaw(n))).map(one);
    if (list.length) return list;
    return rescueReplies();
  }

  /**
   * Страховка от ошибки в границе: ответ агента с маркером ТЕКУЩЕЙ выдачи.
   *
   * Проверки две и обе обязательны: маркер ссылается на нашу выдачу, а само
   * сообщение — из этого хода, а не из прошлого круга (id-время, допуск
   * две минуты). Порядок в разметке здесь не используется: ответ может
   * оказаться и выше нашего задания.
   *
   * Смысл: молчаливое «новых сообщений нет» при лежащем в чате ответе
   * недопустимо, поэтому ответ ищется ещё и по маркеру.
   */
  function rescueReplies() {
    const waiting = GM_getValue(K.expect, null);
    const ref = norm(waiting && waiting.ref);
    if (!ref) return [];
    const since = Number((waiting && (waiting.sentAt || waiting.at)) || 0);
    const all = messages();
    const one = (n) => ({ id: nodeId(n), text: messageText(n), raw: messageRaw(n), ended: replyEnded(n) });
    // Ответ этого хода стоит НИЖЕ нашего последнего задания. Это главная
    // защита от прошлого круга: ответ по той же карточке (Rework) в старом
    // месте разметки не должен сойти за новый.
    let from = 0;
    let sawTask = false;
    for (let i = all.length - 1; i >= 0; i -= 1) {
      if (isUserNode(all[i])) {
        from = i + 1;
        sawTask = true;
        break;
      }
    }
    const mine = (m) => {
      const result = parseMarker(m.raw, "CF_AGENT_RESULT") || parseMarker(m.raw, "CF_COORDINATOR_RESULT");
      if (!result) return false;
      const ids = [result.dispatch_id, result.turn_id, result.mission_id].map(norm);
      if (!ids.includes(ref)) return false;
      const at = idTime(m.id);
      return !(since && at && at < since - 120000);
    };
    let found = all.slice(from).filter((n) => !isUserNode(n)).map(one).filter(mine);
    if (!found.length && !sawTask) {
      // Наших реплик в разметке нет — место ответа взять неоткуда, остаётся
      // маркер вместе с временем id.
      found = all.filter((n) => !isUserNode(n)).map(one).filter(mine);
    }
    if (!found.length) return [];
    const last = found.at(-1);
    logThrottled(
      `rescue:${ref}:${last.id}`,
      `Ответ «${(waiting && waiting.roleName) || (waiting && waiting.roleId) || ""}» найден по маркеру выдачи ` +
        `(сообщение ${last.id}): граница «после отправки» его пропускала. Ответ принят, повторять работу не нужно.`,
      false,
      C.longWaitNoticeMs,
    );
    return found;
  }

  const nodeId = (n) => n.id.replace("chat-message-", "");

  /**
   * Ответ закончен — по разметке Arena, а не по таймеру.
   *
   * Внизу завершённого ответа стоит `data-latest-assistant-response-bottom`,
   * а у времени ответа есть подпись «Response ended …». Это точный признак:
   * не нужно ждать 20 секунд «стабильности», чтобы прочитать уже готовый
   * ответ. Пока агент печатает, подписи нет.
   */
  function replyEnded(node) {
    if (!node) return false;
    const labels = [...node.querySelectorAll("[aria-label]")].map((el) => el.getAttribute("aria-label") || "");
    if (labels.some((text) => /response ended|ответ заверш|generation complete/i.test(text))) return true;
    const bottom = document.querySelector('[data-latest-assistant-response-bottom="true"]');
    if (!bottom) return false;
    // Узел идёт в документе раньше отметки о конце ответа.
    return Boolean(node.compareDocumentPosition(bottom) & 4);
  }

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

  /** Короткая подпись элемента для журнала: без разметки и лишнего текста. */
  const shortLabel = (el) =>
    `${el?.getAttribute?.("aria-label") || el?.getAttribute?.("title") || el?.textContent || ""}`
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

  /**
   * Причина «агент ещё работает» — или null.
   *
   * Раньше это были два независимых поиска, и любой ложный признак держал шаг.
   * Теперь признак один и у него есть причина, которую видно в журнале:
   *   • кнопка Stop — только с площадью, не disabled и не прозрачная;
   *   • «думающая» плашка — только короткая подпись, не свёрнутая история
   *     («Thought for 2 seconds» — это прошлое, а не работа) и не транскрипт.
   */
  /**
   * Кнопка «Stop» может быть видимой самой по себе, но лежать в скрытом
   * контейнере: в Arena панель действий сообщения гасится `opacity: 0` на
   * обёртке и проявляется при наведении. Собственная прозрачность кнопки при
   * этом — единица, площадь есть, `display` не тронут. Именно такая кнопка
   * прошлой генерации и держала шаг: «агент ещё отвечает», хотя ответ давно
   * закончен.
   */
  const hiddenByAncestor = (el) => {
    let node = el;
    for (let depth = 0; node && depth < 8; depth += 1) {
      if (node.getAttribute?.("aria-hidden") === "true") return true;
      if (node.hasAttribute?.("inert") || node.hasAttribute?.("hidden")) return true;
      const style = getComputedStyle(node);
      if (Number(style.opacity) === 0) return true;
      if (style.visibility === "hidden" || style.display === "none") return true;
      node = node.parentElement;
    }
    return false;
  };

  /** Где живёт кнопка — нужно только для понятной строки в журнале. */
  const whereIs = (el) => {
    if (!el?.closest) return "";
    if (el.closest("[data-agent-transcript-message]")) return " в сообщении";
    if (el.closest('form, footer, [class*="composer"], [data-testid*="composer"]')) return " в поле ввода";
    return "";
  };

  /**
   * Кнопка стоит в слоте отправки панели ввода. Send и Stop рисуются в одном
   * месте и помечены `data-perf-target="send"`; Мастер 24.10 прислал разметку:
   * `<button aria-label="Stop generating" data-perf-target="send">` в
   * `div.bg-surface-secondary.rounded-[14px]`.
   *
   * В покое этой кнопки в разметке нет вовсе («когда он не активен, его нигде
   * не видно»), поэтому Stop в слоте — честный признак генерации, и правило
   * «ответ закончился — значит призрак» к нему не применяется.
   */
  const composerSlot = (el) => Boolean(el?.closest?.('[data-perf-target="send"]'));

  /**
   * Кнопка Stop из уже законченного сообщения — протухшая: Arena оставляет
   * панель действий в DOM и после окончания ответа. Такой признак не должен
   * останавливать шаг, иначе «Шаг» навсегда упирается в прошлую генерацию.
   *
   * Это правило — только для кнопок в панели действий сообщения. Stop в слоте
   * отправки не протухает никогда: в покое его нет в разметке вовсе.
   */
  const stopIsStale = (el) => {
    const all = [...document.querySelectorAll("[data-agent-transcript-message]")];
    const msg = el?.closest?.("[data-agent-transcript-message]");
    // Кнопка вне сообщений — панель над полем ввода. Приписать её конкретному
    // ответу нельзя, поэтому смотрим на последний ответ: если он закончился,
    // генерации нет и это остаток прошлой отрисовки (24.10, 14:20: сразу
    // после перехода к Build/Release «Шаг» сказал «агент ещё отвечает», хотя
    // агент был спокоен, а ответ ещё не начинался). Ответа в чате ещё нет
    // вовсе (первый ход) — тогда верим кнопке.
    // Наша реплика — это вопрос, а не ответ: «закончился» к ней неприменимо.
    // Если последним в чате стоит наше задание, значит ответа ещё нет и Stop
    // настоящий.
    const last = all.at(-1);
    const answered =
      Boolean(last) && !last.querySelector?.('[data-user-message-layout="true"]') && replyEnded(last);
    if (!msg) return answered;
    if (replyEnded(msg)) return true;
    return all.length > 0 && all.at(-1) !== msg;
  };

  function busyReason() {
    // Плашка «задача выполнена» — самый точный признак покоя: Arena показывает
    // её только после законченного хода. 24.10 в 14:48 скрипт ещё считал агента
    // работающим, хотя плашка уже висела, а агент отвечал на прошлый ход.
    if (completionPlaque()) return null;
    // Сначала подпись (дешёвое чтение атрибутов), потом геометрия и стили:
    // иначе на каждый тик пересчитываются стили сотни посторонних кнопок.
    const stop = [...document.querySelectorAll('button, [role="button"]')].find((b) => {
      if (!/stop generating|остановить генерац|stop response/i.test(shortLabel(b))) return false;
      if (!visible(b) || b.disabled) return false;
      if (b.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(b);
      if (Number(style.opacity) === 0) return false;
      if (style.pointerEvents === "none") return false;
      if (hiddenByAncestor(b)) return false;
      // Stop в слоте отправки — настоящий: в покое Arena не рисует его вовсе.
      if (!composerSlot(b) && stopIsStale(b)) return false;
      return true;
    });
    if (stop)
      return {
        kind: "stop",
        label: shortLabel(stop) || "кнопка Stop",
        where: whereIs(stop),
        slot: composerSlot(stop),
      };

    const marks = document.querySelectorAll(
      '[role="status"], [aria-live], [class*="thinking"], [class*="reasoning"], [class*="typing"]',
    );
    for (const el of marks) {
      if (!visible(el)) continue;
      // Свёрнутая история рассуждений — это уже прошлое.
      if (el.closest('[data-state="closed"], .not-prose')) continue;
      const label = shortLabel(el);
      if (!label || label.length > 80) continue; // длинный текст — транскрипт, а не индикатор
      if (!/thinking|reasoning|typing|дума|размышл|анализ/i.test(label)) continue;
      if (/^thought\b|^думал|^размышлял/i.test(label)) continue; // прошедшее время
      return { kind: "status", label };
    }
    return null;
  }

  const generating = () => busyReason()?.kind === "stop";

  /**
   * «Агент ещё работает» — это состояние, а не кадр.
   *
   * Сразу после перехода на страницу агента Arena успевает показать кнопку
   * Stop на время загрузки транскрипта, хотя ответ давно закончен. Один
   * мгновенный кадр не должен останавливать нажатый «Шаг»: подтверждаем
   * признак повторной проверкой через секунду. Настоящая генерация никуда не
   * денется, а ложная исчезнет — и шаг пойдёт дальше.
   */
  async function busySettled(stepMs = 1200) {
    const first = busyReason();
    if (!first) return null;
    await sleep(stepMs);
    const second = busyReason();
    if (!second) {
      dbg("Stop был мгновенным: страница ещё дорисовывалась, шаг продолжается.");
      return null;
    }
    return second;
  }

  const busyLabel = (reason) =>
    reason?.kind === "stop"
      ? `кнопка «${reason.label}»${reason.where || ""}`
      : `плашка «${reason?.label || "думает"}»`;

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
   *
   * why = "thin" — маркер есть, а отчёта нет (NAR-1.8, 23.10.2026: агент понял
   * «ответь одной последней строкой» буквально, а в журнал попал только маркер).
   */
  function markerReminder(role, expect, attempt, markerName, why = "") {
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
        "Остальное в чате на месте — не хватает только служебной строки.",
      ],
    ];
    // Маркер вместо отчёта. Просить «одну последнюю строку» нельзя: агент
    // присылает ровно её, отчёт остаётся в чате, а журнал хода пустеет.
    const thin = [
      `ОТЧЁТ НЕ ЗАПИСАН (${attempt} из ${C.markerReminders}; это не задание и не новый ход).`,
      `В последнем ответе${about} пришла только служебная строка ${markerName}, без отчёта.`,
      "Маркер без фактов не считается ответом: по нему нельзя принять работу.",
    ];
    return [
      ...(why === "thin" ? thin : variants[(attempt - 1) % variants.length]),
      "Не повторяй уже сделанное и не жди Мастера — это ошибка формата, а не работы.",
      why === "thin"
        ? "Пришли ответ ещё раз целиком: что изменил, что показали команды, какие числа получились — и последней строкой маркер."
        : "Пришли ответ ещё раз целиком и последней строкой добавь маркер: одним маркером вместо отчёта отвечать нельзя.",
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
    return Boolean(busyReason());
  }

  /** Хвост текста для журнала: по нему видно, ответ это или «думаю…». */
  const tail = (text, n = 120) => {
    const flat = String(text || "").replace(/\s+/g, " ").trim();
    return flat.length <= n ? flat : `…${flat.slice(-n)}`;
  };

  /**
   * Заявка «почти по формату»: id выдачи есть, номер PR есть, признак мержа
   * есть, а литерала маркера нет. Пример, на котором это понадобилось:
   * «NAR-1.7 RESULT — dispatch 4016f0cf-…; run 8abe7712-…; PR #31 MERGED.»
   */
  function looseResult(raw, role, expect) {
    if (role.fn === "Auditor") return null;
    const text = String(raw || "");
    const ref = String((expect && expect.ref) || "");
    if (!text || !ref || !norm(text).includes(norm(ref))) return null;
    const pr = Number((text.match(/\bPR\s*#?\s*(\d+)/i) || text.match(/\/pull\/(\d+)/) || [])[1]) || null;
    if (!pr) return null;
    const merged = /\bmerged\b|слит|слито|слита|слиты|\bв main\b/i.test(text);
    const run =
      (text.match(/run[`\s]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1] ||
      String((expect && expect.runId) || "");
    if (!run) return null;
    return { dispatch_id: ref, run_id: run, status: "submitted", pr, merged };
  }

  /**
   * Текст ответа для журнала: все сообщения агента за ход, а не только последнее.
   *
   * Инцидент NAR-1.8 (23.10.2026). Kernel отчитался без маркера, получил
   * напоминание и прислал одну строку маркера. В журнал попал только маркер:
   * Координатор прочитал его, не увидел работы и поставил Rework при слитом PR.
   * Теперь журнал собирается из всего хода, а одинаковые части не дублируются.
   */
  function runAnswer(expect, hit) {
    const seen = new Set();
    const parts = [];
    const push = (m) => {
      const text = String((m && m.text) || "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      parts.push(text);
    };
    messagesAfter(expect.watermark).forEach(push);
    push(hit);
    const text = parts
      .map((part, i) => (parts.length > 1 ? `### Часть ${i + 1} из ${parts.length}\n\n${part}` : part))
      .join("\n\n");
    return { text, parts: parts.length, body: answerBody(text) };
  }

  /** Длина текста без служебных строк маркера: по ней видно, есть ли отчёт. */
  const answerBody = (text) =>
    String(text || "")
      .split("\n")
      .filter((line) => !/^\s*CF_(AGENT|COORDINATOR)_RESULT\b/.test(line) && !/^### Часть \d+ из \d+/.test(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim().length;

  /**
   * Ждём ответ без маркера. Возвращает true, если ход уже обработан
   * (напоминание ушло или цикл поставлен на паузу).
   *
   * why = "thin" — маркер пришёл, а отчёта в нём нет.
   */
  async function markerMissing(role, expect, markerName, manual = false, why = "") {
    // Пока агент печатает или «думает», ответа ещё нет: молчим, но по нажатию
    // «Шаг» объясняем, что именно ждём.
    if (stillWorking()) {
      if (manual) log(`${role.name} ещё отвечает (${busyLabel(busyReason())}) — подождите, потом нажмите «Шаг».`);
      return false;
    }
    const replies = messagesAfter(expect.watermark || "");
    const last = replies.at(-1);
    if (!last) {
      // Нормальное ожидание, но нажатый «Шаг» должен получить ответ, а не тишину.
      if (manual) {
        const sentMin = expect.sentAt ? Math.max(1, Math.round((Date.now() - expect.sentAt) / 60000)) : 0;
        const delivered = expect.verified === true ? "доставка подтверждена" : "доставка не подтверждена";
        // Молчаливое «новых сообщений нет» уже один раз скрыло готовый ответ,
        // поэтому в журнал идёт разбор чата: сколько наших реплик, сколько
        // ответов и какой из них последний.
        const chat = messages();
        const mine = chat.filter(isUserNode).length;
        const answers = chat.filter((n) => !isUserNode(n));
        const lastAnswer = answers.at(-1);
        log(
          `Жду ответ ${role.name}: сообщений агента после нашего задания нет` +
            `${sentMin ? ` (отправлено ${sentMin} мин назад, ${delivered})` : " (ещё не отправлено)"}` +
            `, в чате ${chat.length} (наших ${mine}, ответов агента ${answers.length}` +
            `${lastAnswer ? `, последний ${nodeId(lastAnswer)}` : ""}). Маркера этой выдачи в чате нет.`,
        );
        dbg("ожидание ответа", { role: role.name, watermark: expect.watermark, sentAt: expect.sentAt, verified: expect.verified });
      }
      return false;
    }

    // Подпись считается по сырому тексту: текст, который «дописывается»,
    // каждый раз даёт другую подпись и откладывает решение.
    const signature = `${last.id}:${last.raw.length}`;
    // Ответ, который Arena уже закрыла, читается сразу: ждать «стабильности»
    // незачем, иначе нажатый «Шаг» дважды отвечает «дописывает».
    if (!last.ended && expect.lastReplySig !== signature) {
      GM_setValue(K.expect, { ...expect, lastReplySig: signature, lastReplyAt: Date.now() });
      if (manual) log(`${role.name} дописывает ответ — дочитаю, когда закончит.`);
      return false;
    }
    if (!last.ended && Date.now() - (expect.lastReplyAt || Date.now()) < C.markerIdleMs) {
      if (manual) log(`Ответ ${role.name} ещё может дописаться — подождите.`);
      return false;
    }

    dbg("ответ без маркера", { id: last.id, length: last.raw.length, tail: tail(last.raw, 300), why });
    const sent = Number(expect.tries) || 0;
    if (markerStep(sent) === "remind") {
      log(
        why === "thin"
          ? `${role.name} прислал только маркер ${markerName}, без отчёта — напоминание ${sent + 1} из ${C.markerReminders}.`
          : `${role.name} ответил без маркера ${markerName} — напоминание ${sent + 1} из ${C.markerReminders}. ` +
              `Прочитан хвост: «${tail(last.text, 110)}»`,
        true,
        { ntfy: "quiet", title: why === "thin" ? "Narthex: маркер без отчёта" : "Narthex: нет маркера" },
      );
      await sendToRole(role, markerReminder(role, expect, sent + 1, markerName, why), expect.kind, expect.ref, {
        missionId: expect.missionId,
        turnId: expect.turnId,
        runId: expect.runId,
        title: expect.title,
        tries: sent + 1,
      });
      return true;
    }

    pause(
      why === "thin"
        ? `${role.name} присылает только маркер ${markerName}, без отчёта, после ${C.markerReminders} напоминаний. ` +
            "Нужен Мастер: проверьте страницу агента."
        : `${role.name} ответил без маркера ${markerName} после ${C.markerReminders} напоминаний. ` +
            "Нужен Мастер: проверьте страницу агента.",
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
  /** Свой пульт ScriptCat — не поле ввода и не кнопка отправки. */
  const inOwnPanel = (el) => Boolean(el?.closest?.(`#${ui.panel}`));

  /**
   * Боковая панель: аккаунт, навигация, поиск.
   *
   * В разметке Arena это `div.group/sidebar-wrapper`, у кнопки аккаунта —
   * `div.fixed.z-10 … > … > ul > button`. Кнопки оттуда не нажимаются никогда:
   * 23.10 в 22:02 три «клика Send» ушли ровно в аккаунт Мастера.
   */
  const SIDEBAR_SELECTOR = `nav, aside, [role="navigation"], [data-sidebar], [class*="sidebar"]`;

  /**
   * Боковая панель — это та ветка дерева, в которой нет `main`.
   *
   * Тонкость, на которой 23.10 сломался 1.4.25: **вся страница** обёрнута в
   * `div.group/sidebar-wrapper …` — в её классе тоже есть «sidebar». Если
   * исключать всё внутри такого предка, из поиска выпадает и `main`, и поле
   * ввода с кнопкой отправки: скрипт пишет «не нашёл поле ввода», хотя оно на
   * экране. Настоящий сайдбар — сосед `main`, он `main` внутри себя не
   * содержит; обёртка страницы — содержит.
   */
  function sidebarRoot(el) {
    let node = el?.closest?.(SIDEBAR_SELECTOR) || null;
    for (let depth = 0; depth < 6 && node; depth += 1) {
      if (!node.querySelector?.("main")) return node;
      node = node.parentElement?.closest?.(SIDEBAR_SELECTOR) || null;
    }
    return null;
  }

  const inSidebar = (el) => Boolean(sidebarRoot(el));

  /** Служебные поля вроде капчи: под селектор поля ввода они тоже подходят. */
  const isServiceField = (el) =>
    Boolean(el?.closest?.('[class*="captcha"], [name="g-recaptcha-response"]')) ||
    Boolean(el?.classList?.contains?.("g-recaptcha-response"));

  /**
   * Панель ввода: ближайший предок поля, внутри которого есть кнопки.
   *
   * В текущей разметке Arena это
   * `div.bg-surface-secondary…rounded-b-none`, а внутри — и редактор
   * (`.editor-content`), и ряд `.flex.justify-between.gap-4` с кнопкой
   * отправки. Именно эта панель, и только она, задаёт область поиска кнопки
   * Send: «Merge PR» и информация о ветке лежат выше и сюда не попадают, а
   * сайдбар — совсем в другой ветке дерева.
   *
   * До `main` и `body` не поднимаемся: там кнопок сколько угодно, и любая из
   * них — не наша.
   */
  function composerBox(editor) {
    let node = editor?.parentElement || null;
    for (let depth = 0; depth < 8 && node; depth += 1) {
      const tag = String(node.tagName || "").toUpperCase();
      if (tag === "BODY" || tag === "HTML" || tag === "MAIN") return null;
      const buttons = [...(node.querySelectorAll?.('button, [role="button"]') || [])].filter(
        (b) => visible(b) && !inSidebar(b) && !inOwnPanel(b),
      );
      if (buttons.length) return node;
      node = node.parentElement;
    }
    return null;
  }

  /**
   * Узел действительно в документе.
   *
   * После перерисовки чата Arena заменяет поле ввода новым элементом, а у нас
   * остаётся ссылка на старый. `isConnected` у него уже false, и `addRange`
   * падает: «The given range isn't in document». Именно это случилось 23.10 в
   * 22:02 — текст «вставился» в отвязанный узел, настоящее поле осталось
   * пустым, Send — серым.
   */
  function composerAlive(el) {
    if (!el || el.isConnected === false) return false;
    try {
      return typeof document.contains === "function" ? document.contains(el) : true;
    } catch {
      return true;
    }
  }

  /**
   * Редактор сообщения.
   *
   * В живой разметке поле — это `.editor-content > div.tiptap.ProseMirror > p`,
   * и параграфов внутри может быть несколько: они разделяют строки. Редактор
   * поэтому ищется по `contenteditable`, а не по `.editor-content`: обёртка
   * сама не редактируемая.
   *
   * Сайдбар и служебные поля (капча) исключены: под те же селекторы подходят
   * чужие `[role="textbox"]` и `textarea`, а вставка в них — это не отправка
   * задания, а мусор в чужом поле.
   */
  function composer() {
    const good = (el) => el.tagName !== "INPUT" && !inOwnPanel(el) && !inSidebar(el) && !isServiceField(el);
    const candidates = [
      ...document.querySelectorAll(
        ".editor-content [contenteditable]:not([contenteditable='false']), " +
          ".editor-content .ProseMirror, .editor-content[contenteditable], " +
          "[contenteditable]:not([contenteditable='false']), .ProseMirror, [role='textbox']",
      ),
    ].filter(good);
    const shown = candidates.filter(visible);

    // 1. Редактор в панели `.editor-content` — единственный, который Arena
    //    считает полем сообщения.
    const editorContent = shown.find((el) => el.closest?.(".editor-content"));
    if (editorContent) return editorContent;

    // 2. Любой видимый, у которого есть панель с кнопками: значит, это
    //    панель ввода, а не посторонний `[role=textbox]`.
    const withBox = shown.find((el) => composerBox(el));
    if (withBox) return withBox;

    // 3. Запас: на странице агента поле ввода одно. Если под жёсткие правила
    //    оно не подошло (например, поменяли классы), лучше взять единственное
    //    видимое, чем встать: вставка и отправка всё равно проверяются дальше.
    if (shown.length === 1) {
      dbg("composer: единственное видимое поле взято запасным правилом", {
        cls: String(shown[0].className || "").slice(0, 60),
      });
      return shown[0];
    }

    const prompt = document.querySelector(".editor-content p, [data-placeholder] p");
    const nearPrompt = prompt?.closest("[contenteditable]") || null;
    if (nearPrompt && visible(nearPrompt) && good(nearPrompt)) return nearPrompt;
    return (
      [...document.querySelectorAll("textarea:not([readonly])")].find(
        (el) => good(el) && visible(el) && !el.closest?.('[class*="captcha"]'),
      ) || null
    );
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

  // Только начало подписи: «Send», «Send message», «send-button» проходят,
  // подпись аккаунта в сайдбаре — нет. Прежнее правило искало слово «send»
  // где угодно в тексте кнопки и было слишком щедрым.
  const SEND_LABEL = /^(send|submit|отправ\w*)(\b|$)/;

  // Кнопка остановки стоит на месте Send, пока агент работает. Нажимать её
  // вместо отправки нельзя: это обрывает ответ.
  const STOP_LABEL = /stop|останов|cancel|отмен/i;

  /**
   * Снимок разметки для разбора отказов.
   *
   * Когда что-то не находится, спорить о причинах бессмысленно: нужны
   * координаты и подписи того, что реально видит скрипт. Снимок пишется в
   * хранилище при отказе отправки и печатается в консоль через
   * `__narthex.dom()`.
   */
  function domReport() {
    const box = (el) => {
      try {
        const r = el.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
      } catch {
        return null;
      }
    };
    const about = (el) => ({
      tag: String(el.tagName || "").toLowerCase(),
      role: el.getAttribute?.("role") || "",
      ce: el.getAttribute?.("contenteditable") || "",
      label: String(labelText(el)[0] || "").slice(0, 40),
      cls: String(el.className || el.getAttribute?.("class") || "").slice(0, 70),
      box: box(el),
      alive: el.isConnected !== false,
      own: inOwnPanel(el),
      sidebar: Boolean(el.closest?.("nav, aside, [role='navigation'], [data-sidebar], [data-slot='sidebar']")),
    });
    const editors = [
      ...document.querySelectorAll(
        ".editor-content[contenteditable], .editor-content [contenteditable], " +
          "[contenteditable]:not([contenteditable='false']), .ProseMirror, [role='textbox']",
      ),
    ]
      .filter((el) => el.tagName !== "INPUT")
      .slice(0, 12)
      .map(about);
    const buttons = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')]
      .slice(0, 60)
      .map(about)
      .filter((b) => b.box && b.box[2] > 0 && b.box[3] > 0);
    const pick = composer();
    const dialog = openDialog();
    return {
      at: Date.now(),
      path: location.pathname,
      hidden: typeof tabHidden === "function" ? tabHidden() : null,
      pick: pick ? about(pick) : null,
      box: pick ? about(composerBox(pick) || {}) : null,
      dialog: dialog ? about(dialog) : null,
      editors,
      buttons,
    };
  }

  /**
   * Открытый диалог Arena поверх чата.
   *
   * Пока он висит, `focus()` не отдаёт каретку полю ввода, и `execCommand`
   * вставляет текст туда, где сейчас фокус. Вставка это заметит (текст не
   * появится в поле), но причину надо называть прямо, иначе Мастер видит
   * только «не удалось вставить задание».
   */
  function openDialog() {
    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')];
    return dialogs.find((el) => visible(el) && !inOwnPanel(el)) || null;
  }

  /**
   * Капча («Security Verification» с reCAPTCHA) поверх чата.
   *
   * Появляется не по расписанию, а в момент отправки — и тогда клик по Send
   * ничего не отправляет: Arena показывает окно проверки, а сообщение до
   * агента не доходит. Хуже того, поле на миг пустеет, а в транскрипте
   * появляется наша реплика, поэтому `waitSent` честно докладывал «отправлено».
   * 11:56:47 так и вышло: «Задание отправлено», а Координатор ничего не
   * получил (вопрос Мастера 53).
   *
   * Поэтому капча проверяется до клика, после клика и в ожидании доставки: пока
   * окно висит, отправки нет — что бы ни показывал счётчик сообщений.
   */
  const CAPTCHA_SELECTORS = [
    ".recaptcha-v2-container",
    'iframe[title="reCAPTCHA"]',
    'iframe[src*="recaptcha"]',
    "#g-recaptcha-response",
  ];

  function captchaDialog() {
    for (const el of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
      if (!visible(el)) continue;
      if (CAPTCHA_SELECTORS.some((sel) => el.querySelector(sel))) return el;
      // Разметку Arena можно переверстать: окно всё равно узнаётся по заголовку.
      if (/(security verification|recaptcha|подтвердите, что вы человек)/i.test(String(el.textContent || ""))) return el;
    }
    for (const el of document.querySelectorAll(".recaptcha-v2-container")) {
      if (visible(el)) return el.closest?.('[role="dialog"]') || el;
    }
    return null;
  }

  /**
   * Доставка без человека невозможна: пауза с громким пушем.
   *
   * Очередь не снимается: после решения капчи «Продолжить» отправит то же
   * задание, а не начнёт ход заново. Карточка остаётся Running — ход жив, он
   * ждёт человека; вернуть её в Ready значило бы потом отказаться записывать
   * ответ («Задача уже не Running»).
   */
  function captchaPause(extra = "") {
    pause(
      `Появилась капча (Security Verification): без человека сообщение не уйдёт. ` +
        `Решите её и нажмите «Продолжить» — задание осталось в очереди.${extra}`,
      { kind: "captcha", notifyTitle: "Narthex: капча — нужен человек" },
    );
  }

  /**
   * Кнопка рядом с полем ввода.
   *
   * Геометрия — единственный признак, который отличает Send от кнопки аккаунта
   * в сайдбаре: подписи у них разные, а вот «первая доступная кнопка в общем
   * контейнере» может оказаться любой. Допуски щедрые: панель ввода бывает
   * и под полем, и справа от него.
   */
  function isNearComposer(el, editor) {
    try {
      const a = editor.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      if (!a.width || !a.height || !b.width || !b.height) return false;
      // Границы считаются из top/left/width/height: `bottom` и `right` есть у
      // настоящего DOMRect, но полагаться только на них незачем.
      const aBottom = a.top + a.height;
      const aRight = a.left + a.width;
      const bBottom = b.top + b.height;
      const bRight = b.left + b.width;
      return (
        bBottom >= a.top - 160 &&
        b.top <= aBottom + 200 &&
        bRight >= a.left - 80 &&
        b.left <= aRight + 220
      );
    } catch {
      return false;
    }
  }

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
    if (!composerAlive(editor)) return null;

    // Область поиска — панель ввода. Не документ: 23.10 в 22:02 «первая
    // доступная кнопка в родителе редактора» оказалась кнопкой аккаунта в
    // сайдбаре, и три клика ушли туда. Кнопки вне панели ввода не
    // рассматриваются вообще — ни как запасной путь, ни при нестандартной
    // вёрстке. Лучше пауза, чем клик в неизвестное место.
    const box = composerBox(editor);
    const scope = box || (editor.closest?.("form") || null);
    if (!scope) return null;

    const panels = completionPanels();
    const inPanel = (b) => panels.some((p) => p.contains?.(b));
    const usable = (b) =>
      b &&
      b.isConnected !== false &&
      !b.disabled &&
      b.getAttribute?.("aria-disabled") !== "true" &&
      b.getAttribute?.("data-disabled") !== "true" &&
      visible(b) &&
      !inPanel(b) &&
      !inOwnPanel(b) &&
      !inSidebar(b) &&
      !STOP_LABEL.test(String(labelText(b)[0] || ""));
    const controls = [...scope.querySelectorAll('button, [role="button"], input[type="submit"]')].filter(usable);
    if (!controls.length) return null;

    // 1. Явная подпись отправки. Из нескольких — последняя в панели: ряд
    //    `.flex.justify-between` держит подпись справа.
    const labelled = controls.filter((b) => labelText(b).some((l) => SEND_LABEL.test(l)));
    if (labelled.length) return labelled.at(-1);

    // 2. `type=submit` внутри панели.
    const submit = controls.filter((b) => String(b.getAttribute?.("type") || b.type || "") === "submit");
    if (submit.length) return submit.at(-1);

    // 3. Подписи нет (одна иконка). Узнать её можно только по месту: кнопка
    //    отправки стоит одна в своей группе, эта группа — последняя в ряду
    //    `.flex.justify-between`, а сама кнопка — в правой половине панели.
    //    Всё, что не подходит под это описание, отправкой не считается:
    //    скрепка и выбор модели стоят слева и в первой группе.
    const nearField = controls.filter((b) => {
      const holder = b.parentElement;
      if (!holder) return false;
      const siblings = [...holder.querySelectorAll('button, [role="button"]')].filter(usable);
      if (siblings.length !== 1) return false;
      if (holder !== holder.parentElement?.lastElementChild) return false;
      if (!isNearComposer(b, editor)) return false;
      const a = editor.getBoundingClientRect();
      const r = b.getBoundingClientRect();
      return r.left >= a.left + a.width / 2 - 40;
    });
    return nearField.at(-1) || null;
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
  function writePrompt(editor, text, attempt = 1) {
    // Поле могло исчезнуть из документа между поиском и вставкой — тогда
    // ищем заново, а не пишем в копию.
    let live = composerAlive(editor) ? editor : composer();
    if (!live) return false;
    if (live !== editor) dbg("writePrompt: поле ввода перечитано", { attempt });

    live.focus();
    if (live.tagName === "TEXTAREA" || live.tagName === "INPUT") {
      const proto = live.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(live, text);
      else live.value = text;
      live.dispatchEvent(new Event("input", { bubbles: true }));
      live.dispatchEvent(new Event("change", { bubbles: true }));
      if (live.value.trim().length) return true;
      return attempt < 2 ? writePrompt(composer(), text, attempt + 1) : false;
    }

    let inserted = false;
    try {
      const range = document.createRange();
      range.selectNodeContents(live);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      inserted = document.execCommand("insertText", false, text);
    } catch (e) {
      // «The given range isn't in document» — узел успел отвалиться.
      dbg("writePrompt: выделение не поставилось", {
        error: String(e?.message || e),
        alive: composerAlive(live),
      });
    }
    // Запасной путь — только в живой узел: у отвязанного текст «есть», но
    // редактор о нём не знает, и Send остаётся серым.
    if (!inserted && composerAlive(live)) {
      live.textContent = text;
      live.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
    if (composerAlive(live)) live.dispatchEvent(new Event("change", { bubbles: true }));

    const written = composerAlive(live) ? composerText(live).length : 0;
    dbg("writePrompt", () => ({
      via: inserted ? "execCommand" : "textContent",
      written,
      expected: text.length,
      alive: composerAlive(live),
    }));
    if (written > 0) return true;

    // Поле перерисовали: одна повторная попытка в новом узле.
    if (attempt < 2) return writePrompt(composer(), text, attempt + 1);
    return false;
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
        if (!/^skip$/i.test(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.trim())) continue;
        if (!visible(button)) continue;
        // Skip внутри группы вариантов — это вопрос агента, а не плашка.
        // Один клик закрыл бы сразу весь опросник, и остальные вопросы исчезли
        // бы, не попав ни в журнал, ни в журнал попытки (24.10, NAR-1.12).
        if (button.closest?.('[role="radiogroup"]')) continue;
        return button;
      }
    }
    return null;
  }

  /**
   * Плашка «Эта задача была выполнена успешно?» — опрос внизу чата.
   *
   * Мастер: пока она на экране, задача не выполняется — Arena не показывает
   * этот опрос во время работы. И она перекрывает поле ввода, поэтому её
   * закрывает скрипт, а не человек.
   */
  const COMPLETION_TEXT = /эта задача была выполнена успешно|was this task completed successfully|did this task complete successfully/i;

  function completionPlaque() {
    for (const panel of completionPanels()) {
      if (!COMPLETION_TEXT.test(panel.textContent || "")) continue;
      // Контейнер с целым чатом под этот селектор тоже попадает: плашкой он не
      // становится, и «закрывать» его кнопкой шапки нельзя.
      if (panel.querySelector('[data-agent-transcript-message="true"]')) continue;
      return panel;
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
    const captcha = captchaDialog();
    const panels = completionPanels();
    for (const panel of panels) {
      // Окно проверки не плашка: его кнопки нажимает человек, а не скрипт.
      if (captcha && (panel === captcha || panel.contains(captcha))) continue;
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

  // ───────────────────────────── опрос агента ─────────────────────────────

  /**
   * Опрос вместо ответа.
   *
   * 24.10 Kernel на середине NAR-1.12 остановился и выставил карточку с
   * вопросом «May I expand the write zone for this task?»: кнопки с вариантами,
   * свободное поле и `Skip`. Для цикла это конец хода без маркера — работа не
   * сдана, карточка висит в Running, ждать нечего.
   *
   * Отвечать за человека скрипт не берётся, но и молчать нельзя: он
   * перечисляет вопросы и варианты в журнал попытки и отправляет один и тот же
   * универсальный ответ. Он повторяет то, что и так написано в промпте: решай
   * сам в рамках Scope и запиши допущение. Такой ответ годится на любой вопрос
   * агента — про зону, про формат, про выбор из вариантов. `Skip` не годится:
   * он закрывает весь опросник разом, и остальные вопросы пропали бы бесследно.
   */
  const POLL_REPLY = "Реши сам в рамках Scope карточки и продолжай; допущение запиши в отчёт.";

  const buttonLabel = (b) =>
    `${(b && b.getAttribute && b.getAttribute("aria-label")) || ""} ${(b && b.textContent) || ""}`.trim();

  /** Текст вопроса: подпись группы, иначе заголовок карточки. */
  function pollQuestionText(group) {
    const label = String(group.getAttribute("aria-label") || "").trim();
    if (label) return label;
    const head = group.querySelector(".body-base, .body-sm");
    const text = String((head && (head.innerText || head.textContent)) || group.innerText || "");
    return text.replace(/\s+/g, " ").trim().slice(0, 300);
  }

  /**
   * Вопросы в последнем ответе агента.
   *
   * Смотрим только последнее сообщение: отвеченные карточки прошлых ходов
   * остаются в транскрипте, и трогать их нельзя. В одном опросе может быть
   * несколько вопросов — у каждого своя группа `radiogroup`, свои варианты и
   * своё поле свободного ответа.
   */
  function pollQuestions(root = document) {
    const last = [...root.querySelectorAll('[data-agent-transcript-message="true"]')]
      .filter((n) => !n.querySelector('[data-user-message-layout="true"]'))
      .at(-1);
    if (!last) return [];
    const id = nodeId(last);
    const out = [];
    for (const group of last.querySelectorAll('[role="radiogroup"]')) {
      if (!visible(group)) continue;
      const buttons = [...group.querySelectorAll("button")];
      out.push({
        id,
        el: group,
        question: pollQuestionText(group),
        options: [...group.querySelectorAll('[role="radio"]')].map((b) =>
          String(b.innerText || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
        ),
        input: group.querySelector('input[type="text"], input:not([type])') || null,
        submit: buttons.find((b) => /submit custom response|отправить/i.test(buttonLabel(b))) || null,
        skip: buttons.find((b) => /^skip$/i.test(buttonLabel(b))) || null,
      });
    }
    return out;
  }

  /**
   * Записать текст в поле так, чтобы это увидел React.
   *
   * `input.value = …` меняет свойство экземпляра, а React читает сеттер
   * прототипа: без него кнопка Submit остаётся disabled и ответ не уходит.
   */
  function fillInput(input, value) {
    const doc = input.ownerDocument || document;
    const view = doc.defaultView || window;
    const set = (text) => {
      const proto = Object.getPrototypeOf(input);
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(input, text);
      else input.value = text;
      for (const name of ["input", "change"]) {
        input.dispatchEvent(new view.Event(name, { bubbles: true }));
      }
    };
    // Пустая строка перед текстом: если прошлая попытка уже оставила здесь
    // этот же текст, React не увидит изменения и не включит Submit.
    if (String(input.value || "")) set("");
    set(value);
  }

  /**
   * Ждём, пока условие станет истинным.
   *
   * После вставки текста карточка перерисовывается, и кнопка Submit оживает не
   * в тот же кадр: клик «одновременно с текстом» уходит в ещё выключенную
   * кнопку, а текст остаётся висеть в поле (24.10, 18:50).
   */
  async function pollWait(check, timeoutMs = 4000, stepMs = 120) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = check();
      if (found) return found;
      await sleep(stepMs);
    }
    return check() || null;
  }

  /** Запись в журнал попытки: вопрос агента — часть хода, его читает Координатор. */
  function pollLogEntry(role, questions, reply) {
    const hash = textHash(questions.map((q) => q.question).join("|"));
    const marker = `<!-- CF_POLL ${questions.map((q) => q.id).join(",")}:${hash} -->`;
    return [
      marker,
      `## Вопрос агента вместо работы (${(role && role.name) || "агент"})`,
      "",
      `- когда: ${nowIso()}`,
      `- ответ скрипта: «${reply}»`,
      "- ответ человека не запрашивался: опрос останавливает ход, цикл отвечает сам",
      "",
      ...questions.flatMap((q, i) => [
        `### Вопрос ${i + 1}`,
        q.question || "(без текста)",
        "",
        ...(q.options.length ? q.options.map((o) => `- ${o}`) : ["- вариантов не было"]),
        "",
      ]),
    ].join("\n");
  }

  let pollBusy = false;

  /**
   * Разобрать опрос: перечислить вопросы, ответить «Решай сам», записать в
   * журнал попытки.
   *
   * Возвращает `"answered"` (только что ответили), `"waiting"` (опрос уже
   * отвечен, агент ещё не продолжил) или `null` (опроса нет).
   */
  async function answerPolls(role, expect = null) {
    if (pollBusy) return "waiting";
    const found = pollQuestions();
    if (!found.length) return null;
    const who = (role && role.name) || "агент";
    // Ключ — ход агента: повторный тик не отвечает на тот же вопрос дважды.
    // Метки 1.4.45 сюда не читаются: они ставились без проверки, что Submit
    // сработал, и на живом опросе Kernel заблокировали бы повтор.
    const key = `cfn-poll2:${(expect && (expect.runId || expect.turnId || expect.ref)) || location.pathname}`;
    const handled = new Set(GM_getValue(key, []));
    const pending = found.filter((q) => !handled.has(`${q.id}:${q.question}`));
    if (!pending.length) return "waiting";

    pollBusy = true;
    try {
      // Вопросы перечисляются ДО ответа: после Submit карточка
      // перерисовывается, и остальные могли бы исчезнуть вместе с ней.
      for (const q of pending) {
        log(
          `${who} спросил вместо работы: «${firstLine(q.question, 200)}»` +
            `${q.options.length ? ` — вариантов ${q.options.length}` : ""}.`,
          false,
          { tone: "warn", ntfy: "quiet", title: "Narthex: агент спросил" },
        );
      }
      let answered = 0;
      const failed = [];
      for (const first of pending) {
        // После Submit карточка перерисовывается: узлы вопроса уже отвязаны.
        // Поэтому перед каждым ответом берём живые узлы заново.
        const live = () => pollQuestions().find((x) => x.question === first.question) || null;
        const q = live();
        // Вопрос пропал — его уже закрыли, это не наша забота. Вопрос есть, а
        // свободного поля нет — ответить некуда, и это уже потеря.
        if (!q) continue;
        if (!q.input) {
          failed.push(first);
          continue;
        }
        fillInput(q.input, POLL_REPLY);
        // Ответ считается ушедшим, только если поле перестало держать наш
        // текст или вопрос пропал из карточки. Иначе текст висит в поле, а
        // Submit остаётся выключенным — это и случилось 24.10 в 18:50.
        const sent = () => {
          const now = live();
          return !now || !now.input || String(now.input.value || "") !== POLL_REPLY;
        };
        let done = false;
        for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
          const button = await pollWait(() => {
            const now = live();
            return now && now.submit && now.submit.disabled === false && now.submit.isConnected !== false
              ? now.submit
              : null;
          }, attempt === 1 ? 4000 : 2000);
          if (button) button.click();
          if (await pollWait(() => (sent() ? true : null), 2000)) done = true;
          else if (attempt === 2 && q.input) {
            const view = (q.input.ownerDocument || document).defaultView || window;
            q.input.dispatchEvent(new view.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
            if (await pollWait(() => (sent() ? true : null), 1500)) done = true;
          }
        }
        if (done) {
          handled.add(`${first.id}:${first.question}`);
          answered += 1;
        } else {
          failed.push(first);
        }
        await sleep(300);
      }
      if (!answered && failed.length) {
        // Ни один ответ не ушёл. Опрос нельзя оставить висеть: он держит ход.
        // Skip закрывает сразу весь опросник, поэтому идём на него только
        // здесь — вопросы уже перечислены в журнале — и говорим, что теряем.
        const skip = failed.find((q) => q.skip)?.skip;
        if (skip) {
          skip.click();
          for (const q of failed) handled.add(`${q.id}:${q.question}`);
          log(
            `${who}: ответ на вопрос не отправился — нажал Skip, чтобы ход не стоял. ` +
              "Вопрос и варианты записаны в журнал попытки.",
            true,
            { tone: "warn", ntfy: "quiet", title: "Narthex: опрос закрыт кнопкой Skip" },
          );
        } else {
          log(
            `${who}: ответ на вопрос не отправился, и Skip не нашёлся — опрос держит ход. ` +
              "Нажмите кнопку ответа в чате вручную.",
            true,
            { tone: "warn", ntfy: "loud", title: "Narthex: опрос держит ход" },
          );
        }
      }
      GM_setValue(key, [...handled].slice(-25));
      if (answered) {
        log(
          `Ответил ${who} на опрос: «${firstLine(POLL_REPLY, 90)}» (вопросов ${answered}). ` +
            "Сам вопрос и варианты записаны в журнал попытки.",
          false,
          { tone: "warn" },
        );
      }
      const logId = expect && expect.logId;
      if (logId) {
        const all = found.map(({ id, question, options }) => ({ id, question, options }));
        const entry = pollLogEntry(role, all, POLL_REPLY);
        try {
          await gateway("append", logId, { marker: entry.split("\n")[0], entry });
        } catch (e) {
          log(`Вопрос агента не записался в журнал попытки: ${e.message}`, true);
        }
      }
      if (answered && expect && expect.runId) {
        const strikes = (Number(GM_getValue(`cfn-poll-count:${key}`, 0)) || 0) + 1;
        GM_setValue(`cfn-poll-count:${key}`, strikes);
        if (strikes >= C.pollPauseCount) {
          pause(
            `${who} спрашивает вместо работы ${strikes} раз за ход. Это не случайность: ` +
              "противоречие в карточке или в промпте. Проверьте Scope и зону записи, " +
              "затем нажмите «Продолжить».",
            { kind: "poll-loop", ref: (expect && expect.ref) || "", runId: (expect && expect.runId) || "" },
          );
        }
      }
      return answered ? "answered" : "waiting";
    } finally {
      pollBusy = false;
    }
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
    let polled = 0;
    while (Date.now() < deadline) {
      const editor = composer();
      if (editor) return { editor, closed, polled, overlay: false };

      const panel = closeCompletionPanel();
      if (panel === "closed") {
        closed += 1;
        dbg("editor: поля ввода нет — убрал карточку и жду", { attempt: closed });
        if (closed >= 2) break;
        await sleep(700);
        continue;
      }
      // Поле не находится, а в чате висит вопрос агента: отвечаем на него, а не
      // жмём Skip. Иначе первый же вопрос тихо закрывал бы весь опросник.
      if ((await answerPolls(null)) === "answered") {
        polled += 1;
        dbg("editor: ответил на вопрос агента");
        await sleep(700);
        continue;
      }
      await sleep(400);
    }
    return { editor: null, closed, polled, overlay: completionPanels().length > 0 };
  }

  /** Короткая диагностика, почему поле не нашлось: без неё остаётся гадать. */
  function composerDiagnostics() {
    const count = (selector) => document.querySelectorAll(selector).length;
    // Сколько кандидатов отброшено и по какой причине: без этого «не нашёл
    // поле ввода» не отличить от «нашёл, но исключил своим же фильтром».
    let droppedSidebar = 0;
    let droppedHidden = 0;
    for (const el of document.querySelectorAll(
      "[contenteditable]:not([contenteditable='false']), .ProseMirror, [role='textbox']",
    )) {
      if (el.tagName === "INPUT") continue;
      if (inSidebar(el)) droppedSidebar += 1;
      else if (!visible(el)) droppedHidden += 1;
    }
    const parts = [
      `contenteditable ${count("[contenteditable]")}`,
      `textarea ${count("textarea")}`,
      `textbox ${count("[role='textbox']")}`,
      droppedSidebar ? `в сайдбаре ${droppedSidebar}` : "",
      droppedHidden ? `скрытых ${droppedHidden}` : "",
      `панель ${completionPanels().length}`,
      `skip ${count('[data-agent-transcript-message="true"] button') && skipCardButton() ? "да" : "нет"}`,
      `путь ${location?.pathname || "/"}`
    ].filter(Boolean);
    return parts.join(", ");
  }

  /** Ждём активную кнопку Send (ниже — единственная реализация). */
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
   * Отличительная строка задания: по ней видно, что в чат ушло именно это
   * сообщение, а не предыдущее. Первые строки промпта у всех заданий
   * одинаковые (технический блок), поэтому ключ берётся из строки с
   * `dispatch <id>` — она своя у каждой выдачи.
   */
  function sendKey(text) {
    const src = String(text || "");
    const lines = src.split("\n");
    const task = lines.find((l) => /Задача .*\(dispatch /.test(l));
    if (task) return flat(task).slice(0, 90);
    // Напоминание отличается от задания первой строкой «1 из 2», «2 из 2».
    const reminder = lines.find((l) => /НАПОМИНАНИЕ/.test(l));
    if (reminder) return flat(reminder).slice(0, 90);
    // Ход Координатора опознаётся по номеру хода: он свой у каждого запроса.
    const turn = src.match(/"turn_id"\s*:\s*"([^"]+)"/);
    if (turn) return flat(turn[1]);
    // Короткое сообщение (напоминание, реплика) опознаётся целиком; длинный
    // промпт без опознавательных строк — нет, иначе ключом стал бы общий
    // технический блок.
    const plain = flat(src);
    return plain.length <= 120 ? plain : "";
  }

  /** Своё сообщение в транскрипте — независимо от того, как оно обёрнуто. */
  function userMessages() {
    const found = new Set();
    for (const el of document.querySelectorAll('[data-user-message-layout="true"]')) {
      found.add(el.closest('[data-agent-transcript-message="true"]') || el);
    }
    return [...found];
  }

  /** В чате уже есть наше сообщение с этой строкой? Это и есть доставка. */
  function lastUserSays(key) {
    if (!key) return false;
    const list = userMessages();
    const last = list.at(-1);
    return Boolean(last) && flat(last.textContent || "").includes(key);
  }

  /** Ждём подтверждение доставки: сообщение в чате, а не «поле опустело». */
  async function waitSent(key, before, timeoutMs) {
    // Ожидание не должно стать бесконечным из-за пустой настройки: без числа
    // deadline был бы NaN, и опрос шёл бы вечно.
    const deadline = Date.now() + (Number(timeoutMs) || 6000);
    for (;;) {
      // Капча важнее счётчика: Arena успевает показать нашу реплику до
      // проверки, а до агента она не доходит. Признак «отправлено» в это
      // время — ложь, из-за которой 11:56:47 задание считалось ушедшим.
      if (captchaDialog()) return "";
      if (lastUserSays(key)) return "message";
      if (messages().length > before) return "count";
      const live = composer();
      // Пустое поле плюс работающий агент — тоже след отправки, но только
      // вместе: по отдельности каждый признак обманывает.
      if (live && !composerText(live) && generating()) return "generating";
      if (Date.now() >= deadline) return "";
      await sleep(300);
    }
  }

  /**
   * Капча после «отправлено».
   *
   * 24.10 задание ушло в 13:47:03, а окно Security Verification всплыло в
   * 13:47:15 — через двенадцать секунд. К этому времени очередь уже была
   * снята, отметка доставки поставлена, и «Продолжить» после решения капчи
   * стало ждать ответа на сообщение, которого агент не получал.
   *
   * Поэтому успешная отправка подтверждается не сразу: короткий карантин, в
   * котором появление капчи отменяет её так же, как капча до клика.
   */
  async function captchaGuard() {
    const deadline = Date.now() + (Number(C.captchaGuardMs) || 8000);
    while (Date.now() < deadline) {
      if (captchaDialog()) return true;
      await sleep(400);
    }
    return Boolean(captchaDialog());
  }

  /** Enter в поле ввода: второй канал отправки, если клик не дошёл. */
  function pressEnter(editor) {
    if (!editor) return false;
    try {
      editor.focus();
      const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
      for (const type of ["keydown", "keypress", "keyup"]) editor.dispatchEvent(new KeyboardEvent(type, opts));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Нажатие Send с проверкой появления своего сообщения.
   *
   * До 1.4.20 доставка подтверждалась косвенными признаками: счётчик сообщений
   * вырос, поле опустело или агент уже печатает. Каждый обманывает: счётчик
   * обновляется только после отрисовки, поле «пусто» у отвязанного узла от
   * прошлого рендера, а кнопка Stop бывает от прошлой генерации. 23.10 из-за
   * этого три клика прошли впустую: шаг встал на паузу «Send нажат, но
   * сообщение не появилось», хотя сказать, что именно не сработало, было
   * нельзя.
   *
   * Теперь подтверждение — само сообщение с отличительной строкой задания.
   * Поле и кнопка перечитываются из живого DOM перед каждой попыткой, а
   * ожидание длится `sendVerifyMs`: в фоновой вкладке браузер режет таймеры,
   * и одной секунды на отрисовку мало.
   */
  async function deliver(editor, text) {
    const before = messages().length;
    const key = sendKey(text);
    let live = composerAlive(editor) ? editor : composer();
    dbg("Send: начало", () => ({ messages: before, button: debugSendButton(live), textLength: composerText(live).length }));

    const why = [];
    let clicked = 0;
    const blocked = () => ({
      ok: false,
      captcha: true,
      reason: "Появилась капча (Security Verification) — сообщение не ушло",
      detail: clicked ? `клик ${clicked}: вместо отправки окно проверки` : "окно проверки до клика",
    });
    if (captchaDialog()) return blocked();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      // Сообщение могло уйти с прошлой попытки — проверяем до нового клика.
      if (captchaDialog()) return blocked();
      if (lastUserSays(key)) return { ok: true, via: "message" };

      // Узел редактора мог смениться при перерисовке чата: тогда и вставка,
      // и клик уходят в копию, которой уже нет в документе.
      if (!composerAlive(live)) {
        live = composer();
        dbg("Send: редактор перечитан", { found: Boolean(live), attempt });
        if (!live) {
          why.push("поле ввода пропало");
          break;
        }
      }

      let btn = await waitForSendReady(live, 1500);
      if (!btn) {
        // Редактор не зарегистрировал ввод: повторяем его и ждём снова.
        dbg("Send: кнопка неактивна — повторяю вставку текста", () => debugSendButton(live));
        writePrompt(live, text);
        btn = await waitForSendReady(live, 3000);
      }
      if (!btn) {
        why.push(`активной кнопки Send нет (${composerDiagnostics()})`);
        break;
      }

      // Текст мог пропасть вместе с перерисованным полем: тогда клик по Send
      // ничего не отправит. Проверяем перед каждым кликом.
      const probe = key || flat(text).slice(0, 40);
      if (probe && !flat(composerText(live)).includes(probe)) {
        dbg("Send: текст в поле пропал — вставляю заново", { attempt });
        if (!writePrompt(live, text)) {
          why.push("текст не удержался в поле ввода");
          break;
        }
        await sleep(300);
        const again = sendButton(live);
        if (!again) {
          why.push("после повторной вставки кнопки Send нет");
          break;
        }
        btn = again;
      }

      // Человек не отправляет через миллисекунду после ввода: даём паузу.
      await sleep(500 + Math.floor(Math.random() * 1200));
      if (lastUserSays(key)) return { ok: true, via: "message" };
      if (!composerAlive(live)) {
        why.push(`клик ${attempt}: поле перерисовано`);
        continue;
      }
      // Кнопка пересчитывается в последний момент: за паузу DOM мог смениться.
      const latest = sendButton(live);
      if (!latest) {
        why.push(`клик ${attempt}: кнопка Send пропала`);
        break;
      }
      btn = latest;
      if (captchaDialog()) return blocked();
      dbg(`Send: клик ${attempt}`, () => debugSendButton(live));
      btn.click();
      clicked += 1;

      let via = await waitSent(key, before, C.sendVerifyMs);
      if (!via && attempt === 3) {
        // Последняя попытка: если клик не дошёл, отправляем с клавиатуры.
        dbg("Send: клик не дал сообщения — пробую Enter");
        pressEnter(live);
        via = await waitSent(key, before, C.sendVerifyMs);
      }
      if (via) {
        // Клик прошёл, но поверх чата висит проверка: сообщение могло не
        // дойти, даже если отрисовалось. Считаем отправку неудачной — ход
        // повторится после того, как человек решит капчу.
        if (captchaDialog()) return blocked();
        // Проверка не разовая: окно проверки всплывает через несколько секунд.
        if (await captchaGuard()) return blocked();
        dbg("Send: сообщение в чате", { via, attempt });
        return { ok: true, via };
      }
      if (captchaDialog()) return blocked();

      // Не дошло. Карточка могла появиться между вставкой и кликом — убираем
      // её один раз и повторяем; гоняться за ней циклом смысла нет.
      const plaque = closeCompletionPlaque();
      dbg("Send: сообщение не появилось", { plaque, attempt });
      why.push(plaque === "none" ? `клик ${attempt} без следа` : `клик ${attempt}: закрыл плашку`);
      await sleep(500);
    }

    // Капча могла появиться уже после кликов — в ожидании доставки. Тогда
    // причина отказа именно она, а не «кнопка не нашлась»: от неё зависит,
    // снимать ли очередь (её не снимаем — ждём человека).
    if (captchaDialog()) return blocked();

    const now = composer();
    const button = now ? sendButton(now) : null;
    const dialog = openDialog();
    dbg("Send: кандидаты у поля", () => ({ dialog: Boolean(dialog), candidates: sendDiagnostics(now) }));
    const detail = [
      `поле ${now ? (composerAlive(now) ? "в документе" : "отвязано") : "не найдено"}`,
      `в поле ${now ? composerText(now).length : "—"} симв.`,
      `кнопка ${button ? `«${String(labelText(button)[0] || "").slice(0, 28)}»` : "не найдена"}`,
      `сообщений ${before} → ${messages().length}`,
      `своих ${userMessages().length}`,
      ...(dialog ? ["поверх чата открыт диалог Arena"] : []),
      ...why,
    ].join(", ");
    const report = domReport();
    GM_setValue("cfn-send-debug", { at: Date.now(), detail, key, text: String(text).slice(0, 300), report });
    console.warn("[Narthex] снимок разметки при отказе отправки:", report);
    return {
      ok: false,
      // Без единого клика причина другая: кнопка не нашлась, а не «нажали
      // и ничего не вышло». Смешивать их нельзя — по причине чинят.
      reason: clicked
        ? "Send нажат, но своё сообщение в чате не появилось"
        : "Кнопка Send неактивна или не найдена — редактор не принял текст",
      detail,
    };
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

    GM_setValue(K.pending, {
      roleId: role.id,
      roleName: role.name,
      roleUrl: role.url,
      text,
      at: Date.now(),
    });
    GM_setValue(K.expect, {
      roleId: role.id,
      roleName: role.name,
      roleUrl: role.url,
      kind,
      ref,
      watermark: lastMessageId(),
      // Снимок id на момент выдачи: водяной знак может исчезнуть из разметки
      // при перерисовке транскрипта, а «после отправки» должно остаться верным.
      seen: messages().map(nodeId).slice(-40),
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
    navigateTo(role, "туда возвращается ход");
  }

  // Одно и то же ожидание не должно заливать журнал каждые пару секунд.
  let pendingNoticeAt = 0;
  // Отказы вставки считаются подряд: плашка или поздняя отрисовка проходят
  // следующим тиком через 15 секунд, и будить Мастера из-за них незачем.
  let insertFail = { at: 0, count: 0 };
  const pendingSay = (pending, text, error = false) => {
    if (pendingNoticeAt === pending.at) return;
    pendingNoticeAt = pending.at;
    log(text, error);
  };

  /**
   * Ожидание без отметки отправки — след прошлой попытки, а не ход.
   *
   * 24.10 в 16:35 карточка NAR-1.12 ушла в Running, а страница Arena упала до
   * отправки: сообщение в чат Kernel не попало. Через 34 минуты очередь
   * снялась, но карточку скрипт не тронул — он стоял не на странице адресата,
   * а откат статуса был привязан к ней. В Running карточка ждала ещё 11 минут
   * до `releaseStalled`, и всё это время Координатор видел «1 Running» и
   * выдавать её не мог.
   *
   * Отметки отправки нет — значит работы по карточке не было, и в Running ей
   * держаться не за что, на какой бы странице ни стоял Мастер. Возвращаем
   * Ready, снимаем ожидание и разрешаем новый план сразу: ход начинается
   * заново с чистого листа.
   *
   * `ignoreQueue` — очередь уже признана просроченной и снимается этим же
   * шагом: тогда она не повод оставить карточку в Running.
   *
   * Возвращает `{ expect, rolled }`, если след был снят, иначе `null`.
   */
  async function dropGhostHandoff(why, { ignoreQueue = false } = {}) {
    const expect = GM_getValue(K.expect, null);
    if (!expect || Number(expect.sentAt)) return null;
    if (!ignoreQueue && GM_getValue(K.pending, null)) return null;
    const rolled = await releaseUndelivered(expect, why);
    GM_setValue(K.expect, null);
    GM_setValue("cfn-plan-at", 0);
    return { expect, rolled };
  }

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
      GM_setValue(K.pending, null);
      // Карточку возвращаем с любой страницы: отметки отправки нет, работы не
      // было, и ждать 45 минут `releaseStalled` ей незачем.
      const ghost = await dropGhostHandoff("очередь отправки просрочена", { ignoreQueue: true });
      // В ручном режиме шаг делает только нажатие: на загрузке страницы
      // ограничиваемся уборкой, а не отправкой плана за спиной Мастера.
      const act = manual || autoOn();
      const next = GM_getValue(K.expect, null)
        ? "Сообщение в чате есть — ожидание ответа оставлено."
        : ghost && ghost.rolled
          ? "Карточка возвращена в Ready — Координатор выдаст её заново."
          : act
            ? "Продолжаю шаг с чистого листа."
            : "Нажмите «Шаг», чтобы начать заново.";
      log(
        `Снял просроченную отправку из очереди (${Math.round(age / 60000)} мин): задание до адресата не дошло, ` +
          `это остаток прошлой попытки. ${next}`,
        true,
      );
      return !act;
    }

    if (!me || norm(me) !== norm(pending.roleId)) return false;

    // Сообщение могло уйти, пока человек решал капчу. Тогда повторная
    // отправка была бы дублем: в чате уже есть эта реплика.
    if (pending.captcha && !captchaDialog() && lastUserSays(sendKey(pending.text))) {
      const waiting = GM_getValue(K.expect, null);
      // Водяной знак не переписываем: он снят до отправки. Если за время
      // капчи агент успел ответить, последним сообщением окажется уже ответ —
      // и граница «после отправки» съела бы его целиком.
      if (waiting) GM_setValue(K.expect, { ...waiting, sentAt: Date.now(), verified: true, captcha: false });
      GM_setValue(K.pending, null);
      pendingNoticeAt = 0;
      log("После капчи сообщение уже в чате — отправку не повторяю, жду ответа.");
      return true;
    }

    // Один кадр ничего не доказывает: сразу после перехода Arena показывает
    // Stop на время загрузки транскрипта. Признак подтверждается вторым
    // чтением через секунду — так же, как это уже сделано для «Шага».
    const busy = await busySettled();
    if (busy) {
      pendingSay(
        pending,
        `Агент ещё отвечает: задание из очереди подождёт и уйдёт, как только он закончит (${busyLabel(busy)}).`,
      );
      return true;
    }

    // Капча висит поверх чата: ни вставлять, ни кликать некуда. Ждём человека.
    if (captchaDialog()) {
      captchaPause();
      return true;
    }

    // Плашка «Эта задача была выполнена успешно?» закрывает поле ввода. Мастер
    // просит убирать её скриптом: человек не должен щёлкать по опросу, чтобы
    // цикл поехал дальше.
    //
    // Закрываем её ОДИН раз и только тогда, когда поле ввода правда не
    // находится. Прежняя попытка «закрыть заранее» не срабатывала (backend
    // возвращал плашку при перерисовке) и давала вторую такую же строку в
    // журнале — со счётчиком закрытий, который Мастер читал как сбой.
    const { editor, closed, overlay } = await ensureComposer();
    if (closed) log("Убрал плашку «задача выполнена» — она закрывала поле ввода.");
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
      const dialog = openDialog();
      const report = domReport();
      GM_setValue("cfn-send-debug", { at: Date.now(), detail: "вставка не удалась", text: String(pending.text).slice(0, 300), report });
      console.warn("[Narthex] снимок разметки при отказе вставки:", report);
      if (insertFail.at !== pending.at) insertFail = { at: pending.at, count: 0 };
      insertFail.count += 1;
      const attempt = insertFail.count;
      const hint = dialog ? " Поверх чата открыт диалог Arena — закройте его." : "";
      if (attempt === 1 || attempt >= C.insertRetries) {
        pendingNoticeAt = pending.at; // чтобы pendingSay не сказал то же второй раз
        log(
          attempt < C.insertRetries
            ? `Не удалось вставить задание в редактор — повторю через 15 секунд, задание в очереди.${hint}`
            : `Вставка не проходит ${attempt}-й раз: задание в очереди и само не уйдёт.${hint} Нажмите «Шаг».`,
          attempt >= C.insertRetries,
          attempt >= C.insertRetries ? {} : { ntfy: false },
        );
      }
      return true;
    }
    insertFail = { at: 0, count: 0 };
    await sleep(600);

    // Водяной знак — id последнего сообщения ДО отправки. На странице
    // отправителя он был бы чужим, и «ответ без маркера» нельзя было бы
    // отличить от старой переписки.
    const watermark = lastMessageId();
    const seen = messages().map(nodeId).slice(-40);
    const delivery = await deliver(editor, pending.text);
    // Капча — не обычный отказ: очередь не снимается, карточка не
    // откатывается, ждём человека. Отметки отправки при этом не появляется:
    // «откат отправки» и значит, что `sentAt` не ставится.
    if (delivery.captcha) {
      const waiting = GM_getValue(K.expect, null);
      if (waiting) GM_setValue(K.expect, { ...waiting, captcha: true, sentAt: null, verified: false });
      // Очередь остаётся, но с отметкой: после решения капчи сначала надо
      // посмотреть, не дошло ли сообщение всё-таки. Отсчёт TTL начинается
      // заново — человек решает капчу не за десять секунд.
      GM_setValue(K.pending, { ...pending, captcha: true, at: Date.now() });
      captchaPause();
      return true;
    }
    if (!delivery.ok) {
      // Сообщение в чат не попало — работы по карточке нет, и в Running ей
      // делать нечего. Очередь снимается вместе со статусом: иначе ответ по
      // этой же карточке пришёл бы, когда она уже не Running, и
      // `submitExecutor` честно отказался бы его записывать.
      const failed = GM_getValue(K.expect, null);
      const rolled = await releaseUndelivered(
        failed,
        `сообщение не ушло (${String(delivery.reason).toLowerCase()})`,
      );
      if (rolled) {
        GM_setValue(K.pending, null);
        GM_setValue(K.expect, null);
        pendingNoticeAt = 0;
      }
      pause(
        `${delivery.reason}${delivery.detail ? ` (${delivery.detail})` : ""}. ` +
          (rolled
            ? "Ход снят, карточка возвращена в Ready: нажмите «Продолжить» — Координатор выдаст её заново."
            : "Задание осталось в поле ввода и в очереди: поправьте и нажмите «Продолжить»."),
        { kind: "send" },
      );
      return true;
    }
    const expect = GM_getValue(K.expect, null);
    if (expect && norm(expect.roleId) === norm(me)) {
      GM_setValue(K.expect, { ...expect, watermark, sentAt: Date.now(), verified: true, seen });
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
    // Обновление не должно бросать карточку: если ход успел уйти в Running, а
    // сообщение — нет, вернуть её в Ready обязан первый шаг (24.10, NAR-1.12).
    ghostAfterUpdate = expect;
    const who = `«${expect.roleName || expect.roleId}», ${expect.kind || "?"}`;
    log(
      `Обновился до ${SCRIPT_VERSION}${seen ? ` с ${seen}` : ""}: снял ожидание без отметки отправки (${who}) — ` +
        "в чат оно не уходило, это след прошлой попытки. Его карточку, если она в Running, верну в Ready первым шагом. " +
        "Очередь и журнал на месте.",
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

  /**
   * Кнопка «Continue» — та, что после мержа выдаёт агенту новую ветку.
   *
   * Подпись ищем и в тексте, и в `aria-label`: в разметке Arena рядом с текстом
   * лежит иконка, а её `<title>` тоже попадает в `textContent` («ContinueContinue»).
   * Точное сравнение с "Continue" из-за этого не срабатывало, и клика не было.
   */
  const isContinueLabel = (raw) =>
    /^((continue|продолжить)\s*){1,2}$/i.test(String(raw || "").replace(/\s+/g, " ").trim());

  function continueButton() {
    return [...document.querySelectorAll('button, [role="button"]')].find((b) => {
      if (!visible(b) || b.disabled || b.getAttribute("aria-hidden") === "true") return false;
      const text = (b.textContent || "").replace(/\s+/g, " ").trim();
      const aria = (b.getAttribute("aria-label") || "").trim();
      return isContinueLabel(text) || isContinueLabel(aria);
    }) || null;
  }

  /** Что из PR-интерфейса видно прямо сейчас. */
  const prSurface = () => ({
    merged: mergedFlag(),
    closed: closedFlag(),
    cont: continueButton(),
    create: createPr(),
    merge: mergePr(),
  });

  const hasPrUi = () => {
    // Кнопка «Create pull request» из плашки «задача выполнена» — это действие
    // чата, а не PR-интерфейс: нажатие отправляет агенту реплику «Please open a
    // pull request…». 24.10 (14:48) именно так в чат Build/Release улетело
    // лишнее сообщение, и агент бросил работу отвечать на него.
    if (completionPlaque()) return false;
    const s = prSurface();
    return Boolean(s.merged || s.closed || s.cont || s.create || s.merge);
  };

  /**
   * Фоновая вкладка.
   *
   * Фокус скрипту не нужен: он ищет элементы и кликает из кода, поэтому цикл
   * идёт и в скрытой вкладке. Но браузер режет там таймеры — сначала до
   * секунды, а через пять минут до одного пробуждения в минуту. Из-за этого
   * короткие ожидания («Continue» за 20 с, карточка PR за 8 с) успевают
   * истечь раньше, чем скрипт проснётся. В фоне растягиваем их: лучше
   * подождать минуту, чем решить, что кнопки нет.
   */
  const tabHidden = () => {
    try {
      return document.visibilityState === "hidden";
    } catch {
      return false;
    }
  };
  const patience = (ms) => (tabHidden() ? Math.max(ms * 3, 60_000) : ms);

  /** Ждём, пока условие станет истинным. Возвращает значение или null. */
  async function waitFor(check, timeoutMs, stepMs = 700) {
    const until = Date.now() + Math.max(0, Number(timeoutMs) || 0);
    for (;;) {
      const value = check();
      if (value) return value;
      stepAlive();
      if (Date.now() >= until) return null;
      await sleep(stepMs);
    }
  }

  /**
   * Имя текущей ветки. В разметке Arena `span.min-w-0.truncate` встречается
   * несколько раз (заголовок чата, ветка), поэтому берём то, что похоже на
   * ветку, и предпочитаем `arena/…`.
   */
  function branchName() {
    const candidates = [...document.querySelectorAll("span.min-w-0.truncate")]
      .map((el) => (el.textContent || "").trim())
      .filter((text) => /^[\w./-]{3,120}$/.test(text));
    const branchy = candidates.filter((text) => /^(arena|nar|cf)\//.test(text));
    return (branchy.at(-1) || candidates.at(-1) || "");
  }

  /**
   * Ждём, что PR слит. Агент делает это сам (`gh pr merge`). Кнопки — запасной
   * путь: если агент не запушил, Create PR активна, и мы нажимаем её; ответ
   * агента при этом не считается результатом задания (водяной знак).
   *
   * Бейджи PR живут на странице PR, а ответ агента читается на его странице:
   * ни Merge, ни Continue там нет. Поэтому, если никакого PR-интерфейса на
   * экране нет, ждать пять минут бессмысленно — решает маркер (`pr` +
   * `merged: true`). Если кода в main не окажется, это увидит Координатор и
   * вернёт карточку в Rework.
   */
  async function ensureMerged(task, result) {
    const key = `${K.merged}${task.id}`;
    if (GM_getValue(key, false)) return "already";

    // Карточка PR может отрисоваться на пару секунд позже ответа. Без неё мы не
    // нажмём Continue, и агент останется на уже слитой ветке — поэтому ждём.
    const prUi = hasPrUi() ? true : Boolean(await waitFor(hasPrUi, patience(C.prCardWaitMs), 500));
    if (!prUi) {
      if (!hasMergedClaim(result)) {
        log("PR на странице нет и в ответе нет заявки о мерже — считаю, что работа в main не попала.", true);
        return "unconfirmed";
      }
      return claimMerge(task, result, key, " (PR-интерфейс живёт на странице PR, а не в чате)");
    }

    const started = Date.now();
    const grace = Date.now() + C.mergeGraceMs;
    let clickedCreate = false;
    let clickedMerge = false;

    while (Date.now() - started < C.prWaitMs) {
      if (mergedFlag()) return finishMerge(task, key);
      if (closedFlag()) return finishClosed(task, key);
      if (continueButton()) return finishMerge(task, key);

      // Агент уже заявил о мерже — кнопки PR не трогаем вовсе, даже если
      // «Create pull request» видна. 24.10 (14:48) именно этот клик отправил в
      // чат Build/Release реплику «Please open a pull request…», и агент вместо
      // работы начал отвечать на неё. Заявка — тот же сигнал, что и в ветке
      // «PR-интерфейса нет вовсе»: из ScriptCat нет доступа к API GitHub.
      if (hasMergedClaim(result)) {
        return claimMerge(
          task,
          result,
          key,
          " (кнопки Create/Merge не нажимаю — они отправят агенту лишнюю реплику)",
        );
      }

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
    // Continue появляется не мгновенно после бейджа Merged. Раньше кнопку
    // искали один раз: если её ещё не было, клика не происходило вовсе, и
    // агент не получал новую ветку — молча, без единой строки в журнале.
    const cont = await waitFor(continueButton, patience(C.continueWaitMs), 700);
    if (cont) {
      cont.click();
      log("PR слит: нажата Continue — агент получит новую ветку.");
      const gone = await waitFor(() => !continueButton(), 8000, 500);
      if (!gone) {
        const again = continueButton();
        if (again) {
          again.click();
          log("Continue осталась на месте — нажал ещё раз.", true);
          await waitFor(() => !continueButton(), 6000, 500);
        }
      }
      await sleep(3000);
      if (continueButton()) {
        log("Continue всё ещё видна: клик не дошёл. Ветка может остаться прежней — проверьте страницу агента.", true);
      } else {
        log("Continue принята: страница обновилась.");
      }
    } else {
      log(
        `Бейдж Merged есть, а Continue не появилась за ${Math.round(C.continueWaitMs / 1000)} с: ` +
          "продолжаю без неё. Новая ветка появится, когда агент получит следующий ход.",
      );
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
    } else {
      log("Имя ветки на странице не нашлось — в Notion не записываю, карточка останется без «Branch».");
    }
    GM_setValue(key, true);
    return "merged";
  }

  /**
   * Мерж заявлен маркером, PR-интерфейса на странице ещё нет.
   *
   * Кнопки Create/Merge не трогаем: они отправляют агенту лишнюю реплику
   * (24.10 в 14:48 именно так в чат ушло «Please open a pull request…»). Но
   * Continue — это не реплика, а выдача новой ветки, и Arena дорисовывает её
   * уже после того, как узнала о мерже. До 1.4.42 здесь был немедленный
   * выход, поэтому Continue оставалась ненажатой: NAR-1.11, PR #35 — Мастер
   * жал её руками. Ждём бейдж или Continue до mergeGraceMs.
   */
  async function claimMerge(task, result, key, note = "") {
    const seen = await waitFor(() => mergedFlag() || continueButton(), patience(C.mergeGraceMs), 1000);
    if (seen) return finishMerge(task, key);
    GM_setValue(key, true);
    log(
      `${prLabelOf(result)} слит: принято по маркеру агента${note}. ` +
        `Бейджа Merged и Continue на странице нет и через ${Math.round(patience(C.mergeGraceMs) / 1000)} с: ` +
        "если Continue появится позже, нажмите её сами — на запись результата это уже не влияет.",
    );
    return "claimed";
  }

  /**
   * PR закрыт. Дальше на странице остаётся только Continue — жмём её, чтобы
   * цикл не встал, и читаем новую рабочую ветку. Решение «слито или провалено»
   * принимает вызывающий код по маркеру исполнителя.
   */
  async function finishClosed(task, key) {
    const cont = await waitFor(continueButton, patience(Math.min(C.continueWaitMs, 10000)), 700);
    if (cont) {
      cont.click();
      log("PR закрыт: нажата Continue, состояние передано дальше.");
      await waitFor(() => !continueButton(), 8000, 500);
      await sleep(3000);
    } else {
      log("PR закрыт, но Continue на странице нет: перехожу дальше без неё.");
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

  /** Подпись PR для журнала: номер или ссылка из маркера. */
  const prLabelOf = (result) => {
    const pr = String((result && result.pr) ?? "").trim();
    return !pr ? "PR" : /^https?:/i.test(pr) ? pr : `PR #${pr.replace(/^#/, "")}`;
  };

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
    "трогать пути вне своего Scope; мержить в main в обход PR.",
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
    "В «Ролях» ты только читаешь: Статус и Agent URL ставит Мастер.",
    "Ветки, коммиты и PR — не твоя зона: за них отвечают Executor и Auditor.",
    "Очередь — твоя: нарезка, Кому, Sequence, число Ready и выдача работы — новой карточкой или Draft → Ready. Оракул фазы — не твоя:",
    "команду проверки и инварианты менять нельзя, только ADR proposed с паузой.",
    "",
    "ФАЙЛ ЗАДАНИЯ (Payload Drive File ID) обычно не нужен:",
    "карточка и есть задание — её Намерение, Инварианты, Оракул и Scope уходят исполнителю.",
    "Заводить файл стоит, только если текст не влезает в поля карточки:",
    "создай его в Arena/payloads и впиши id в «Payload Drive File ID» — скрипт",
    "прочитает файл и приложит его к заданию исполнителя.",
    "Точный id важен: нечитаемый файл останавливает выдачу. Корень один — Arena,",
    "в корень Диска не писать. Раскладка и правила — docs/agents/drive.md.",
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
      "Не меняй чужие зоны: чужая правка — не твоя работа, даже если она кажется мелкой.",
      "Мерж PR делаешь сам командой `gh pr merge --squash`.",
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
      workRules(role),
    ].filter(Boolean).join("\n");
  }

  /**
   * Дисциплина хода: зоны, вопросы, решения.
   *
   * 24.10 Kernel на середине NAR-1.12 остановился и выставил опрос «May I
   * expand the write zone for this task?». Формально он был прав: в
   * техническом блоке стояла зона `src/core/`, а Scope карточки разрешал ещё
   * пробу, `package.json` и запись решения. Два правила это снимают: зона —
   * рамка по умолчанию, Scope карточки её расширяет на этот ход; вопросов не
   * задаём вовсе.
   */
  function workRules(role) {
    return [
      "КАК РЕШАТЬ",
      `Зона записи${role && role.zone ? ` (${role.zone})` : ""} — рамка по умолчанию. Scope карточки расширяет её на этот ход: если в Scope назван файл, каталог или артефакт, писать туда можно. Противоречия здесь нет — на этот ход карточка главнее общей рамки.`,
      "Не задавай вопросов, не создавай опросов и не проси разрешений. Опрос останавливает ход: работа не сдаётся, карточка висит в Running, а цикл ждёт ответа, которого никто не даст.",
      "Неоднозначность решаешь сам: минимальное изменение, допущение — одной строкой в отчёт «Допущение: …»; если это меняет контракт, то в docs/decisions.",
      "Если решение правда не твоё — допиши в отчёт строку «Нужно решение Мастера: …» и сдай ход. Поднимет его Координатор или Мастер, а не опрос.",
      "Незаконченный ход — это отчёт без маркера, а не вопрос с вариантами.",
    ];
  }

  /** Порядок работы для того, кто пишет код: коммит, пуш, PR, мерж. */
  function executorOrder(task, runId) {
    return [
      "ПОРЯДОК (каждый ход, обязательно)",
      "1. Ветка: git switch -c nar/<номер задачи> от свежего main (ритуал старта — в блоке выше).",
      "2. Коммит: git add -A && git commit -m \"<номер>: <суть>\".",
      "3. Пуш: git push -u origin HEAD.",
      "4. PR и мерж — сам, командами:",
      "   gh pr create --fill --base main   # если PR уже есть — пропусти",
      "   gh pr merge --squash --delete-branch",
      "5. Проверка: команда, код возврата, путь к отчёту. Если задание молчит в чём-то,",
      "   реши сам и запиши решение в docs/decisions/<миссия>.md — останавливаться не нужно.",
      "6. Последней строкой ответа — ровно один маркер:",
      `CF_AGENT_RESULT {"dispatch_id":"${task.id}","run_id":"${runId}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR>,"merged":true}`,
      "`pr` и `merged: true` обязательны, если PR слит: без них «слит» не отличить от",
      "«закрыт без мержа» — снаружи оба случая выглядят одинаково.",
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

  /**
   * Текст задания.
   *
   * Отдельный файл-задание (Payload Drive File ID) не обязателен: карточка уже
   * несёт Намерение, Инварианты, Оракул и Scope. Раньше без файла в чат уходило
   * «(текст задания не найден — работай по карточке)»: агент читал это как сбой
   * и шёл искать несуществующий текст, хотя задание было строкой выше.
   */
  function assignmentBody(task, payload) {
    const body = String(payload || "").trim();
    if (body) return body;
    return [
      "Отдельного файла с текстом задания нет: карточка и есть задание.",
      "Сделай ровно то, что описано выше в «ЦЕЛЬ И ГРАНИЦЫ»:",
      "  • Намерение — что должно появиться;",
      "  • Инварианты — что обязано остаться верным;",
      "  • Оракул — команда, которой проверяют результат;",
      "  • Scope — единственное место записи.",
      "Если чего-то не хватает — реши сам, выбери обратимый вариант и запиши",
      "три строки (неясно / решил / откат) в docs/decisions/<миссия>.md.",
    ].join("\n");
  }

  /**
   * Журнал попытки — файл в Arena/logs, который создаётся при выдаче хода.
   *
   * Раньше он создавался пустым, а в задании стояла строка «Лог попытки: …»:
   * агент открывал пустой файл и не понимал, зачем он. Теперь туда сразу
   * пишется само задание, а позже — ответ агента: файл читается как журнал
   * одного хода, от выдачи до ответа.
   */
  function taskLogEntry(task, role, payload, runId) {
    const marker = `<!-- CF_DISPATCH ${task.id}:${runId}:task -->`;
    return [
      marker,
      `## Задание ${taskTitle(task)}`,
      "",
      `- dispatch: \`${task.id}\``,
      `- run: \`${runId}\``,
      `- кому: ${role.name}`,
      `- выдано: ${nowIso()}`,
      "",
      "### Намерение",
      rt(task.properties["Намерение"]) || taskTitle(task),
      "",
      "### Инварианты",
      rt(task.properties["Инварианты"]) || "не заданы — держи поведение неизменным",
      "",
      "### Оракул",
      rt(task.properties["Acceptance"]) || "не задан",
      "",
      "### Scope",
      rt(task.properties["Scope"]) || "не задан",
      "",
      "### Задание",
      assignmentBody(task, payload),
      "",
    ].join("\n");
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
      assignmentBody(task, payload),
      "",
      ...(role.fn === "Auditor" ? auditorOrder(task, runId) : executorOrder(task, runId)),
      "",
      roleContext(role),
    ].join("\n");
  }

  /**
   * Ссылка на журнал последнего ответа — только для Координатора.
   *
   * Мастер (49): Координатору важно видеть, что ответил тот, за кем был
   * последний ход, иначе приёмка идёт по короткой строке «Ответ ... записан
   * в лог». Исполнителю эта строка не нужна: ему выдали задание, а не чужой
   * ответ (из executorPrompt она убрана в 1.4.16).
   */
  function answerLogLine(cards) {
    const at = (card) => card?.properties?.["Submitted At"]?.date?.start || "";
    const rows = (cards || [])
      .filter((card) => rt(card.properties["Output Drive File ID"]))
      .sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0));
    const card = rows.at(-1);
    if (!card) return "";
    const id = taskTitle(card).split("·")[0].trim() || taskTitle(card);
    const who = taskRole(card) || "исполнителя";
    const link = `https://drive.google.com/file/d/${rt(card.properties["Output Drive File ID"])}/view`;
    return `Журнал ответа ${who} (${id}): ${link} — прочитай, если нужны детали ответа.`;
  }

  function coordinatorPrompt(mission, role, queueSummary, turnId, note = "", answerLine = "", drafts = "", ready = "") {
    return [
      technicalInfo(role),
      "",
      `Миссия: ${rt(mission.properties["Миссия"])}.`,
      `ТЗ: ${mission.properties["ТЗ URL"]?.url || "не задано"}`,
      `Очередь: ${queueSummary}`,
      returnBlock(mission),
      ready,
      drafts,
      answerLine,
      note ? `Комментарий: ${note}` : "",
      "",
      "Очередь — твоя. Ты не только нарезаешь карточки, но и выдаёшь их: черновик (Draft) → Ready, правка полей черновика и архив лишнего — такие же твои действия, как порядок и число Ready.",
      "Мастер и Архитектор пишут только черновики: Draft — предложение, а не приказ. Работу исполнителю выдаёшь ты, не дожидаясь Мастера.",
      "Движок ставит Running и Submitted. Accepted и Rework ставишь ты. Ready ставишь тоже ты — и новой карточке, и черновику, который решил выдать.",
      "next называй ролью той карточки, которую выдаёшь: у готовой она написана в списке «Готовы к выдаче», у новой — та, что ты поставил в «Кому». Назвать чужую роль — значит остановить ход подсказкой вместо выдачи.",
      "Карточку, по которой уже есть ответ (Submitted или Accepted), обратно в Ready не возвращай — это повторная выдача той же работы.",
      "Оракул и инварианты менять нельзя: только ADR proposed и пауза миссии.",
      "",
      "Твой ход. Один ответ — законченный ход:",
      "1) есть Submitted → проверь по Acceptance и поставь Accepted или Rework (причина в «Ответ»);",
      "2) сразу после этого очередь не должна оставаться пустой: если в ней нет ни Running, ни Ready — выдай работу в этом же ответе: создай следующую карточку в «Запросы» (Намерение, Инварианты, Acceptance с командой-оракулом, Свободно, Scope, Кому, Sequence, Миссия, Dispatch State = Ready) или переведи в Ready подходящий Draft;",
      "3) миссия выполнена → поставь «Состояние» = «Завершена» и направь ход done.",
      "",
      "Черновики — твой задел: бери из них, правь под оракул миссии и выдавай. В архив — только если черновик дублирует уже выданное.",
      "Если у черновика помечено, что роль не может получить работу («Статус «Ждёт»», «нет Agent URL», «нет в «Ролях»») — выдать его некому: назначь в «Кому» активную роль (правка черновика — твоё право) или оставь в Draft и напиши, кого он ждёт.",
      "Статус роли и Agent URL — зона Мастера: агента в Arena создаёт он, а не ты. Ты их не меняешь — только называешь в отчёте, какую роль нужно включить.",
      "Scope карточки должен покрывать все артефакты её Оракула: если команда-оракул запускает пробу, а пробы нет в Scope — карточка неполная. Пробу, npm-скрипт и запись решения перечисляй в Scope прямо: иначе исполнитель остановится на границе зоны вместо работы.",
      "Если для хода нет роли (её нет в «Ролях», она «Ждёт» или у неё пустой Agent URL) и заменить её некем — останови цикл сам: в маркере next = \"blocked\" и need = \"<роль>\". Других поводов останавливать цикл у тебя нет: всё остальное решай сам и продолжай.",
      "Приёмка и выдача — не два хода. Принял Submitted — в этом же ответе выстави следующую карточку Ready и назови в next исполнителя, а не Coordinator.",
      "Пустая очередь после твоего ответа считается незаконченным ходом.",
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
    let hit = (exact.length ? exact : candidates).at(-1);
    if (!hit) {
      // Напоминания исчерпаны — дальше пауза не помогает: работа сделана, а
      // страдает только формат. Читаем ответ по тексту, но обязательно с id
      // этой выдачи и номером PR: иначе за результат сойдёт любая реплика.
      const last = messagesAfter(expect.watermark).at(-1);
      const loose =
        last && Number(expect.tries) >= C.markerReminders ? looseResult(last.raw, role, expect) : null;
      if (loose) {
        log(
          `${role.name} написал ответ без строки-маркера — разобрал по тексту: PR #${loose.pr}` +
            `${loose.merged ? ", слит" : ""}. Повторять работу не нужно.`,
          true,
          { ntfy: "quiet", title: "Narthex: ответ без маркера" },
        );
        hit = { ...last, result: loose };
      }
    }
    if (!hit) return markerMissing(role, expect, "CF_AGENT_RESULT", manual);

    const { result, stray } = adoptIds(hit.result, expect);
    if (stray.length) {
      log(
        `В маркере чужой или битый id (${stray.join(", ")}) — беру свой из выдачи. Работа не потерялась.`,
        false,
        { ntfy: false },
      );
    }
    if (GM_getValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, false)) return false;

    const page = await notion("GET", `pages/${result.dispatch_id}`);
    if (taskState(page) !== "Running") {
      // Карточку уже оформили — прошлой попыткой скрипта или руками после
      // паузы. Ждать больше нечего: ожидание снимается, иначе страница
      // исполнителя продолжает считать, что агент ещё отвечает.
      if (norm(expect && expect.ref) === norm(result.dispatch_id)) GM_setValue(K.expect, null);
      log("Задача уже не Running — повторная запись не нужна, ожидание снято.");
      return false;
    }
    if (norm(rt(page.properties["Recipient Agent ID"])) && norm(rt(page.properties["Recipient Agent ID"])) !== norm(role.id)) {
      log("Ответ принадлежит другому агенту — пропуск.", true);
      return false;
    }

    // Журнал собирается из всего хода: ответ мог прийти частями — отчёт первым
    // сообщением, маркер отдельным после напоминания. Маркер без отчёта в журнал
    // не пишем вовсе: именно такая запись и обманула Координатора на NAR-1.8.
    const answer = runAnswer(expect, hit);
    if (answer.body < C.minAnswerChars) {
      log(`В ответе ${role.name} только маркер, отчёта нет — в журнал не пишу.`, true);
      return markerMissing(role, expect, "CF_AGENT_RESULT", manual, "thin");
    }
    const logId = rt(page.properties["Output Drive File ID"]);
    if (!logId) throw new Error("В карточке нет Output Drive File ID.");
    const marker = `<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id} -->`;
    const partsNote = answer.parts > 1 ? `_Ответ собран из ${answer.parts} сообщений хода._\n\n` : "";
    const wrote = await gateway("append", logId, {
      marker,
      entry: `\n\n${marker}\n## Ответ ${role.name}\n\n${partsNote}${answer.text}\n`,
    });
    if (wrote && wrote.duplicate) {
      log("Ответ уже был в журнале Drive (маркер этой же выдачи) — второй раз не пишу, оформляю карточку.");
    }

    // Аудитор не открывает PR: ждать мерж и нажимать Continue нечего.
    // Иначе цикл встал бы на 5 минут на каждом аудите.
    const merged = role.fn === "Auditor" ? "none" : await ensureMerged(page, result);

    // PR закрыт. Так выглядит и ручной мерж через GitHub, и отказ от работы:
    // различаем по маркеру. Без заявки о мерже работа в main не попала —
    // возвращаем карточку в Rework с причиной, решение остаётся за Координатором.
    if ((merged === "closed" || merged === "unconfirmed") && !hasMergedClaim(result)) {
      const reason =
        merged === "closed"
          ? "PR закрыт без мержа (Closed). Работа в main не попала — нужна повторная выдача."
          : "Исполнитель не заявил о мерже (нет merged: true) и PR не открыт. Работа в main не попала — нужна повторная выдача.";
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
      `Ответ ${role.name} записан, PR ${merged === "claimed" ? "слит (по маркеру)" : "слит"}, задача → Submitted.` +
        (link ? ` PR: ${link}` : " (номер PR не указан в маркере)"),
    );

    const co = (await roles()).find((r) => r.fn === "Coordinator");
    if (!co) throw new Error("Нет активного Coordinator.");
    GM_setValue(K.expect, null);
    await goTo(co);
    return true;
  }

  // ───────────────────────────── ход Координатора ─────────────────────────────
  /**
   * Возврат «зависших» карточек в Ready.
   *
   * Это не лимит на работу агента. 45 минут — срок, после которого карточка в
   * Running считается брошенной: задание до исполнителя не дошло, ответ
   * потерялся, вкладку закрыли. Пока у скрипта есть живой ход (неотправленное
   * задание или ожидание ответа), карточка не трогается никогда: агент может
   * работать и два, и три часа, и это нормально.
   */
  async function releaseStalled(mission) {
    // Идёт отправка — не наше дело, что там на часах.
    if (GM_getValue(K.pending, null)) return;
    const expect = GM_getValue(K.expect, null);
    const running = await tasks("Running", mission);
    for (const card of running) {
      // По этой карточке скрипт как раз ждёт ответа: ход живой.
      if (expect && Number(expect.sentAt) && norm(expect.ref) === norm(card.id)) continue;
      const started = card.properties["Started At"]?.date?.start;
      if (!started) continue;
      if (Date.now() - Date.parse(started) < C.stalledMs) continue;
      // Ready — это «хода на карточке нет»: снимаем и след выдачи, иначе
      // карточка выглядит выданной, хотя её уже никто не ведёт.
      await patch(card.id, {
        "Dispatch State": { select: { name: "Ready" } },
        "Started At": { date: null },
        "Run ID": { rich_text: [] },
      });
      log(
        `«${taskTitle(card)}» висит в Running ${Math.round((Date.now() - Date.parse(started)) / 60000)} мин без хода скрипта — возвращена в Ready.`,
        false,
        { ntfy: "quiet" },
      );
    }
  }

  /**
   * Что делать по решению Координатора — без сети, чтобы это можно было
   * проверить пробой.
   *
   * `next` — имя роли из маркера. Четыре исхода:
   *   • роль есть и её карточка лежит в Ready → отправляем задание;
   *   • `next` — сам Координатор: он вернул ход себе (например, принял
   *     Submitted и не успел выдать следующую карточку). Это не ошибка и не
   *     повод для паузы — просим ещё один ход с подсказкой, что очередь пуста;
   *   • роли нет или карточки нет → тоже просим ход, но говорим, чего не
   *     хватает: имени роли или самой карточки;
   *   • второй промах подряд → пауза: дальше это уже не «не понял», а поломка.
   */
  function decisionRoute(next, { roles: list = [], directory = [], readyRoles = [], misses = 0 } = {}) {
    const name = String(next || "").trim();
    if (!name) return { kind: "ask", note: "В маркере не указано, кому передаётся ход: назови роль или done." };
    if (norm(name) === norm("done")) return { kind: "done" };
    const target = list.find((r) => norm(r.name) === norm(name)) || null;
    if (!target) {
      // Карточка этой роли может уже лежать в Ready — тогда дело не в
      // опечатке, а в статусе роли. Молчать об этом значит гонять
      // Координатора по кругу «роли нет среди активных».
      if (readyRoles.some((r) => norm(r) === norm(name))) {
        const row = (directory || []).find((r) => norm(r.name) === norm(name));
        const state = row
          ? [`Статус «${row.status || "пуст"}»`, row.url ? "Agent URL заполнен" : "Agent URL пуст"].join(", ")
          : directory.length
            ? "такой роли нет в базе «Роли»"
            : "роль не активна";
        const why =
          `«${name}»: карточка в Ready есть, но выдать её некому — ${state}. ` +
          `Активные роли: ${list.map((r) => r.name).join(", ") || "нет"}. ` +
          "Статус роли и Agent URL ставит Мастер: агента в Arena создаёт он.";
        if (misses >= 1) {
          return {
            kind: "pause",
            reason: `${why} Нажмите «Продолжить» — Координатор получит подсказку и назначит активную роль.`,
          };
        }
        return {
          kind: "ask",
          note:
            `${why} Назначь в «Кому» активную роль (правка черновика — твоё право) и повтори next, ` +
            "либо оставь карточку в Draft и напиши, кого она ждёт.",
        };
      }
      // Третий подряд промах — уже не «модель не поняла», а поломка: без
      // человека это превращается в бесконечную переписку с Координатором.
      if (misses >= 2) {
        return {
          kind: "pause",
          reason:
            `Координатор третий раз подряд называет роль «${name}», которой нет среди активных. ` +
            "Проверьте базу «Роли»: имя в next должно совпадать с ролью.",
        };
      }
      return { kind: "ask", note: `Роли «${name}» нет среди активных. Назови роль из базы «Роли» или done.` };
    }
    if (target.fn === "Coordinator") {
      if (misses >= 2) {
        return {
          kind: "pause",
          reason:
            "Координатор третий раз подряд возвращает ход себе и не выдаёт карточку. " +
            "Похоже, он не видит очередь или не может создать карточку — посмотрите его ответ.",
        };
      }
      return {
        kind: "ask",
        note:
          "Ход вернулся Координатору. Очередь пуста — в этом ходе выдай работу сам: создай карточку " +
          "Ready или переведи в Ready подходящий Draft и назови в next исполнителя (или done, если миссия закончена).",
      };
    }
    if (readyRoles.some((r) => norm(r) === norm(target.name))) return { kind: "dispatch", roleName: target.name };
    if (misses >= 1) {
      return {
        kind: "pause",
        reason:
          `Координатор второй раз направил ход в «${target.name}», но карточки в Ready нет. ` +
          "Нажмите «Продолжить»: он получит подсказку и сможет создать карточку или выдать черновик. " +
          "Если и это не поможет — проверьте, видит ли Координатор базу «Запросы».",
      };
    }
    return {
      kind: "ask",
      note:
        `Ты направил ход в «${target.name}», но в Ready нет карточки для этой роли. ` +
        "Создай её или переведи в Ready подходящий Draft — и в этом же ответе повтори next.",
    };
  }

  /** Свежие счётчики очереди: после решения Координатора старые уже неверны. */
  async function queueOf(mission) {
    const [submitted, running, ready, rework, draft] = await Promise.all([
      tasks("Submitted", mission),
      tasks("Running", mission),
      tasks("Ready", mission),
      tasks("Rework", mission),
      tasks("Draft", mission),
    ]);
    return {
      submitted,
      running,
      ready,
      rework,
      draft,
      summary:
        `${submitted.length} Submitted, ${running.length} Running, ${ready.length} Ready, ` +
        `${rework.length} Rework, ${draft.length} Draft`,
    };
  }

  /**
   * Черновики миссии — списком, а не числом.
   *
   * Мастер (2026-10-24): Координатор ответил «перевести Draft в Ready я не
   * вправе» и архивировал собственный черновик, чтобы создать точно такой же
   * новый. Дело было не в правах: в промпте стояла строка «Ready ставит
   * движок», а сами черновики в очереди не показывались вовсе. Теперь
   * Координатор видит свой задел и распоряжается им сам.
   */
  function draftLine(cards, known = []) {
    const rows = [...(cards || [])].sort((a, b) => {
      const sa = Number(a.properties?.["Sequence"]?.number ?? 0);
      const sb = Number(b.properties?.["Sequence"]?.number ?? 0);
      return sa - sb;
    });
    if (!rows.length) return "Черновиков нет — следующий шаг миссии предложи сам.";
    // Почему роль не может получить работу — тремя разными словами. 24.10
    // Мастер создал агента Build/Release и заполнил Agent URL, но оставил
    // Статус «Ждёт»: общая фраза «роль не активна» прятала это, и по ней
    // нельзя было понять, чего именно не хватает. Строки принимаются двух
    // видов: имя (значит «активна») и строка базы «Роли» целиком.
    const seen = new Map();
    for (const item of known || []) {
      if (typeof item === "string") seen.set(norm(item), { status: "Активна", url: "есть" });
      else if (item && item.name) seen.set(norm(item.name), { status: item.status || "", url: item.url || "" });
    }
    const why = (role) => {
      const row = seen.get(norm(role));
      if (!row) return `${role} — нет в «Ролях»`;
      if (row.status !== "Активна") return `${role} — Статус «${row.status || "пуст"}»`;
      if (!row.url) return `${role} — нет Agent URL`;
      return role;
    };
    const who = (card) => {
      const role = taskRole(card);
      if (!role) return "роль не задана";
      return seen.size ? why(role) : role;
    };
    const shown = rows.slice(0, C.draftLineMax).map((card) => {
      const seq = card.properties?.["Sequence"]?.number;
      return `${taskTitle(card)} (${who(card)}, Sequence ${seq ?? "—"})`;
    });
    const more = rows.length > shown.length ? `; и ещё ${rows.length - shown.length}` : "";
    return `Черновики (предложения — выдаёшь их ты): ${shown.join("; ")}${more}.`;
  }

  /**
   * Что уже лежит в Ready — с ролью и номером.
   *
   * 24.10 карточка NAR-1.10 вернулась в Ready после неудачной выдачи, а в
   * строке «Очередь» видно только число: Координатор не знал, чья она, и мог
   * назвать в next не ту роль — или создать дубликат «на всякий случай».
   */
  function readyLine(cards) {
    const rows = [...(cards || [])].sort((a, b) => {
      const sa = Number(a.properties?.["Sequence"]?.number ?? 0);
      const sb = Number(b.properties?.["Sequence"]?.number ?? 0);
      return sa - sb;
    });
    if (!rows.length) return "Готовы к выдаче: ничего — Ready пуст.";
    const shown = rows.slice(0, C.readyLineMax).map((card) => {
      const seq = card.properties?.["Sequence"]?.number;
      return `${taskTitle(card)} (${taskRole(card) || "роль не задана"}, Sequence ${seq ?? "—"})`;
    });
    const more = rows.length > shown.length ? `; и ещё ${rows.length - shown.length}` : "";
    return `Готовы к выдаче: ${shown.join("; ")}${more}.`;
  }

  async function coordinatorStep(role, expect, manual = false) {
    const mission = await activeMission();
    if (!mission) {
      // Миссию закрыли — говорим об этом зелёной строкой и громким пушем,
      // а не тихим «ждём»: это конец работы, а не пустая страница.
      if (await missionDoneNotice(expect)) return true;
      logThrottled("no-mission", "Нет активной миссии — ждём.");
      return false;
    }
    GM_setValue("cfn-me", role.name);

    // Возврат миссии Мастером — событие уровня «нужен Мастер»: строка в
    // журнале и пуш. Повторно на ту же миссию не повторяем.
    if (isReturned(mission)) {
      const remarks = missionRemarks(mission);
      if (!remarks) {
        pause(
          "Миссия возвращена на доработку, но поле «Замечания» пусто: исправлять нечего. " +
            "Запишите, что именно не принято, и снимите паузу.",
          { kind: "return-empty", ref: mission.id },
        );
        return true;
      }
      // У каждого возврата свой отсчёт: ожидание, начатое раньше, — прошлый
      // ход. Снимаем его до разбора маркера, иначе `done` из прошлого хода
      // выглядит как отказ отвечать на замечания (24.10, 16:12).
      const epoch = returnEpoch(mission);
      const seen = `cfn-mission-return:${mission.id}:${textHash(epoch.fp)}`;
      if (!GM_getValue(seen, false)) {
        GM_setValue(seen, true);
        log(
          `Миссия возвращена Мастером: ${firstLine(remarks)}. Координатор получит замечания в плане хода.`,
          false,
          { tone: "warn", ntfy: "loud", title: "Narthex: миссия возвращена" },
        );
      }
      if (dropStalePlan(mission, expect, epoch)) {
        expect = null;
        log(
          "Ожидание Координатора началось до возврата миссии — это прошлый ход, а не ответ на замечания. " +
            "Снимаю его и прошу новый план: замечания будут в промпте.",
          false,
          { tone: "warn" },
        );
      }
    }

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
      if (norm(decision.next) === "blocked") {
        // Право Координатора остановить цикл. Повод ровно один: нужной роли
        // нет, и заменить её некем — агента в Arena создаёт Мастер. Всё
        // остальное (пустая очередь, спорный Scope, неясное ТЗ) Координатор
        // решает сам, иначе «остановлю, когда мне неудобно» съедает цикл.
        const need = String(decision.need || "").trim();
        pause(
          `Координатор остановил цикл: ${need ? `нужна роль «${need}»` : "нужна роль, которой нет в «Ролях»"}. ` +
            "Создайте агента в Arena, заполните «Agent URL», поставьте «Статус» = «Активна» и нажмите «Продолжить». " +
            "Других поводов останавливать цикл у Координатора нет.",
          { kind: "blocked-role", ref: mission.id, need, notifyTitle: "Narthex: нужна роль" },
        );
        return true;
      }
      if (decision.next === "done") {
        // Гейт в роли говорит «done только при нуле открытых задач», но верить
        // на слово в автоцикле опасно: закрытая миссия с живыми карточками
        // останавливает весь процесс, и заметит это только человек.
        const fresh = await queueOf(mission);
        const open = fresh.submitted.length + fresh.running.length + fresh.ready.length + fresh.rework.length;
        if (open > 0) {
          pause(
            `Координатор объявил миссию завершённой, но в очереди ${fresh.summary}. ` +
              "Миссию не закрываю: сначала закройте карточки (Accepted) или уберите их из очереди.",
            { kind: "done-with-open", ref: mission.id },
          );
          return true;
        }
        const returned = isReturned(mission);
        if (returned && !/возврат/i.test(rt(mission.properties["Итог"]))) {
          // Сюда попадает только ответ на план, запрошенный уже после
          // возврата: старый маркер снят выше. Значит, замечания правда не
          // разобраны. Снимаем троттлинг, чтобы «Продолжить» сразу вернуло
          // ход Координатору, а не ждало минуту.
          GM_setValue("cfn-plan-at", 0);
          pause(
            "Координатор ответил «done» уже после возврата миссии, но в «Итоге» нет раздела «Возврат»: " +
              "замечания не разобраны. Нажмите «Продолжить» — он получит замечания заново; " +
              "закрывать миссию без ответа на каждое замечание нельзя.",
            { kind: "done-with-remarks", ref: mission.id },
          );
          return true;
        }
        if (fresh.draft.length) {
          log(
            `Миссия завершена, в черновиках осталось ${fresh.draft.length} — это предложения на будущее, ` +
              "а не обязательства: очередь закрыта.",
          );
        }
        await patch(mission.id, {
          "Состояние": { select: { name: "Завершена" } },
          "Завершена": { date: { start: nowIso() } },
        });
        autoSet(false);
        log(
          returned
            ? "Миссия завершена после возврата: замечания закрыты. Автоцикл остановлен."
            : "Миссия завершена Координатором. Автоцикл остановлен.",
          false,
          { tone: "ok", ntfy: "loud", title: "Narthex: миссия завершена" },
        );
        return true;
      }
      const route = decisionRoute(decision.next, {
        roles: await roles(),
        directory: await roleRows().catch(() => []),
        readyRoles: ready.map(taskRole),
        misses: Number(GM_getValue("cfn-plan-miss", 0)) || 0,
      });

      if (route.kind === "pause") {
        GM_setValue("cfn-plan-miss", 0);
        pause(route.reason, { kind: "plan-miss", ref: mission.id });
        return true;
      }
      if (route.kind === "dispatch") {
        GM_setValue("cfn-plan-miss", 0);
        // Только карточка этой роли. Прежний запасной вариант «или первая из
        // Ready» отдавал исполнителю чужое задание, если роль в карточке
        // записана иначе (регистр, пробелы) — и работа уходила не туда.
        const card = ready.find((t) => norm(taskRole(t)) === norm(route.roleName));
        if (!card) {
          pause(
            `Координатор направил ход в «${route.roleName}», но карточки этой роли в Ready нет: ` +
              "похоже, очередь изменилась между запросом и выдачей. Нажмите «Продолжить» — ход начнётся заново.",
            { kind: "plan-miss", ref: mission.id },
          );
          return true;
        }
        return dispatchTask(card, route.roleName);
      }

      // ask: ход возвращается Координатору — это его следующий ход, а не
      // ошибка. Просим план заново, но с подсказкой, чего не хватает.
      GM_setValue("cfn-plan-miss", (Number(GM_getValue("cfn-plan-miss", 0)) || 0) + 1);
      const fresh = await queueOf(mission);
      log(`Ход снова у Координатора: ${fresh.summary}. Прошу закончить ход.`);
      await requestPlan(mission, role, fresh, route.note, { force: true });
      return true;
    }

    const note = submitted.length
      ? "Разбери Submitted — и в этом же ответе выставь следующую карточку Ready, если очередь опустеет."
      : rework.length
        ? "Есть Rework: посмотри «Ответ» — там причина (например, PR закрыт без мержа)."
        : "";
    return requestPlan(mission, role, await queueOf(mission), note, { manual });
  }

  /**
   * Запрос хода Координатора. `force` нужен, когда ход возвращается ему же по
   * его собственному решению: там минута ожидания была бы наказанием за
   * аккуратный ответ, а не защитой от спама.
   */
  async function requestPlan(mission, role, queue, note = "", { manual = false, force = false } = {}) {
    const lastPlan = GM_getValue("cfn-plan-at", 0);
    const waitMs = force ? 5_000 : 60_000;
    if (Date.now() - lastPlan < waitMs) {
      if (manual) log(`Шаг не выполнен: план запрашивали ${Math.ceil((waitMs - (Date.now() - lastPlan)) / 1000)} с назад.`);
      return false;
    }
    GM_setValue("cfn-plan-at", Date.now());

    const summary =
      queue.summary ||
      `${queue.submitted.length} Submitted, ${queue.running.length} Running, ${queue.ready.length} Ready, ` +
        `${queue.rework.length} Rework, ${(queue.draft || []).length} Draft`;
    const turnId = uid();
    // Ход Координатора начинается с разбора Submitted: даём ссылку на журнал
    // ответа, который он принимает, а не только счётчики очереди.
    const answerLine = answerLogLine(queue.submitted);
    log(`План Координатора запрошен (${summary}).`);
    // Вся база, а не только активные: по ней видно, чего именно не хватает —
    // статуса, Agent URL или самой роли.
    const directory = await roleRows().catch(() => []);
    const drafts = draftLine(queue.draft || [], directory);
    await sendToRole(role, coordinatorPrompt(mission, role, summary, turnId, note, answerLine, drafts, readyLine(queue.ready)), "plan", mission.id, {
      missionId: mission.id,
      turnId,
      title: "план Координатора",
    });
    return true;
  }

  async function dispatchTask(card, roleName) {
    const role = (await roles()).find((r) => r.name === roleName);
    if (!role) throw new Error(`Роль «${roleName}» не найдена среди активных.`);

    // Карточка перечитывается прямо перед выдачей: между выбором из списка и
    // отправкой её мог тронуть Координатор, прошлый тик или человек. 23.10
    // NAR-1.7 выдали второй раз с новым run — она была в списке Ready уже
    // отвеченной, и агент честно повторил ту же работу.
    const fresh = await notion("GET", `pages/${card.id}`);
    const state = taskState(fresh);
    const prLink = fresh.properties["PR"]?.url || "";
    const submittedAt = fresh.properties["Submitted At"]?.date?.start || "";
    if (state !== "Ready" || submittedAt || prLink) {
      const why =
        state !== "Ready"
          ? `уже ${state || "не в Ready"}`
          : `уже отвечена${prLink ? ` (${prLink})` : ""}`;
      const misses = (Number(GM_getValue("cfn-answered-miss", 0)) || 0) + 1;
      GM_setValue("cfn-answered-miss", misses);
      log(`«${taskTitle(fresh)}» ${why} — повторно не выдаю.`, true, {
        ntfy: "quiet",
        title: "Narthex: повторная выдача отменена",
      });
      if (misses >= 2) {
        pause(
          `«${taskTitle(fresh)}» ${why}, но Координатор снова направил ход в «${roleName}». ` +
            "Похоже, карточку вернули в Ready вручную. Уберите её из Ready (или очистите «Submitted At» " +
            "и «PR», если работу правда надо повторить) и нажмите «Продолжить».",
          { kind: "redispatch", ref: fresh.id },
        );
      }
      return false;
    }
    GM_setValue("cfn-answered-miss", 0);

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
    // Файл журнала создаётся пустым, поэтому задание пишем в него сразу:
    // иначе агент получает ссылку на пустой файл и не понимает, зачем она.
    try {
      await gateway("append", logId, {
        marker: `<!-- CF_DISPATCH ${card.id}:${runId}:task -->`,
        entry: taskLogEntry(card, role, payload, runId),
      });
    } catch (e) {
      log(`Задание не записалось в журнал попытки: ${e.message}`, true);
    }
    log(
      `Выдан ход ${roleName}: «${taskTitle(card)}»` +
        (payload.trim() ? "." : " (отдельного файла с заданием нет — текст собран из карточки)."),
    );
    return Boolean(await sendToRole(role, executorPrompt(card, role, payload, logId, runId), "dispatch", card.id, {
      runId,
      logId,
      title: taskTitle(card),
    }));
  }

  // ───────────────────────────── цикл ─────────────────────────────
  let busy = false;
  /** Сколько раз подряд шаг снимали с блокировки по тишине. */
  let stepRestarts = 0;

  /**
   * «Шаг жив». Сторож снимает блокировку через две минуты, а ожидание мержа
   * длится до пяти — без этой отметки долгий, но честный шаг выглядел
   * зависанием, и второй тик запускал его заново поверх первого (24.10, 14:48).
   */
  function stepAlive() {
    busyAt = Date.now();
  }

  /**
   * Перейти на страницу роли. Один и тот же переход из одного и того же места
   * дважды за 20 секунд — это не «ещё раз», а зацикливание: значит страница не
   * открылась или адрес в «Ролях» указывает не туда. Тогда пауза и понятная
   * причина, а не бесконечные прыжки.
   */
  function navigateTo(role, why) {
    const from = location.pathname || "/";
    const last = GM_getValue("cfn-nav", null);
    const recent =
      last &&
      norm(last.roleId) === norm(role.id) &&
      last.from === from &&
      Date.now() - Number(last.at || 0) < 20_000;
    if (recent) {
      pause(
        `Не удалось открыть страницу «${role.name}»: остаюсь на ${from}. ` +
          "Похоже, «Agent URL» в базе «Роли» ведёт не туда — поправьте адрес и снимите паузу.",
        { kind: "nav", ref: role.id },
      );
      return true;
    }
    GM_setValue("cfn-nav", { roleId: role.id, from, at: Date.now() });
    log(`Сейчас ${from} — открываю страницу «${role.name}»: ${why}.`);
    location.assign(role.url);
    return true;
  }

  // Ожидание, снятое как фантом, — чтобы тик мог вернуть его карточку в Ready.
  let droppedHandoff = null;
  // Ожидание, снятое обновлением скрипта: карточку вернёт первый же шаг.
  let ghostAfterUpdate = null;

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
    if (messagesAfter(waiting.watermark || "", waiting.seen).length) {
      GM_setValue(K.expect, { ...waiting, verified: true });
      dbg("revive: после водяного знака есть сообщения — считаю отправку доставленной");
      return "";
    }

    const text = String(waiting.text || "");
    GM_setValue(K.expect, null);
    GM_setValue("cfn-plan-at", 0);
    if (!text) {
      droppedHandoff = waiting;
      log(
        "Снял ожидание без подтверждённой отправки: в чат ничего не ушло, текста задания не сохранилось. " +
          "Нажмите «Шаг», чтобы начать ход заново.",
        true,
      );
      return "dropped";
    }
    GM_setValue(K.pending, {
      roleId: waiting.roleId,
      roleName: waiting.roleName,
      roleUrl: waiting.roleUrl,
      text,
      at: Date.now(),
    });
    log(
      `Прошлая отправка «${waiting.title || waiting.kind}» не подтверждена (сообщение в чате не появилось) — ` +
        "ставлю задание обратно в очередь и отправляю заново.",
      true,
    );
    return "revived";
  }

  /**
   * Один отложенный повтор нажатого «Шага». Он ничего не отправляет: первый
   * проход остановился до любой отправки, значит дубля не будет. Нужен потому,
   * что кнопка Stop может быть мгновенной заставкой загрузки страницы.
   */
  let stepRetry = 0;
  function scheduleStepRetry(delayMs = 4000) {
    if (stepRetry >= 2) return;
    stepRetry += 1;
    log(`Проверю ещё раз через ${Math.round(delayMs / 1000)} с: если это была заставка загрузки, шаг пойдёт сам.`);
    setTimeout(() => {
      if (busyReason()?.kind === "stop") {
        log("Кнопка Stop всё ещё на месте — шаг остаётся на паузе до вашего нажатия.");
        stepRetry = 0;
        return;
      }
      stepRetry = 0;
      tick(true);
    }, delayMs);
  }

  async function tick(fromToggle = false) {
    // Фоновая вкладка в журнале не отмечается: Мастер работает в другой
    // вкладке постоянно, и строка «браузер режет таймеры» превращалась в шум.
    // Растянутые ожидания (`patience`) от этого никуда не делись.
    if (busy) {
      // Шаг мог повиснуть на сетевом запросе без таймаута. Тогда «Шаг» и
      // автоцикл молчат навсегда — снимаем блокировку и говорим об этом.
      //
      // Тишина здесь настоящая: `sleep` и `waitFor` отмечаются в `busyAt`
      // каждые несколько секунд, поэтому живого шага этот сторож не касается.
      // Старый проход остаётся стоять на await, который уже не завершится, —
      // значит перезапуск не дубль, а выход из тупика. Но третий раз подряд —
      // это не сбой одного запроса, а поломка: дальше решает Мастер.
      const silentMs = Date.now() - busyAt;
      if (silentMs < 120000) {
        if (fromToggle) log("Шаг уже выполняется: дождитесь его конца, повторный не нужен.");
        return;
      }
      stepRestarts += 1;
      log(
        `Предыдущий шаг молчал ${Math.round(silentMs / 1000)} с (ни одной отметки жизни) — ` +
          `снимаю блокировку и запускаю заново: ${stepRestarts} из 2.`,
        true,
      );
      busy = false;
      if (stepRestarts > 2) {
        pause(
          "Шаг трижды подряд переставал отвечать на одном и том же месте. Параллельных запусков нет: " +
            "снятый проход не продолжается. Проверьте страницу агента и нажмите «Продолжить».",
          { kind: "step" },
        );
        return;
      }
    }
    // Незавершённая отправка живёт в очереди и не зависит от автоцикла:
    // иначе после перехода на страницу адресата задание никто не досылал.
    const auto = autoOn();
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
      // Капча важнее любого шага: она останавливает и отправку, и ответ.
      if (captchaDialog()) {
        // «Отправлено» перед капчей ничего не доказывает: Arena рисует реплику
        // раньше, чем проверка её пропустит. В журнале должно быть «доставка не
        // подтверждена» — иначе непонятно, зачем переотправлять задание.
        const seen = GM_getValue(K.expect, null);
        if (seen?.sentAt && seen.verified !== false) {
          GM_setValue(K.expect, { ...seen, captcha: true, verified: false });
        }
        captchaPause();
        return;
      }
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
      if (droppedHandoff) {
        const gone = droppedHandoff;
        droppedHandoff = null;
        await releaseUndelivered(gone, "отправка не подтвердилась, текста задания не сохранилось");
      }
      if (ghostAfterUpdate) {
        const gone = ghostAfterUpdate;
        ghostAfterUpdate = null;
        await releaseUndelivered(gone, "обновление скрипта: задание не уходило");
      }
      if (await consumePending(fromToggle)) return;
      // Фантом старой версии снят, повторять нечего: без нажатия не начинаем ход.
      if (revived === "dropped" && !auto && !fromToggle) return;
      // Ожидание без отметки отправки и без очереди — след упавшей попытки:
      // сообщения в чате нет, карточке в Running делать нечего. Убираем это
      // на любой странице, иначе Координатор видит живой ход там, где работы
      // не начиналось (24.10, NAR-1.12).
      const ghost = await dropGhostHandoff("задание не дошло: отметки отправки нет");
      if (ghost) {
        log(
          `${ghost.expect.roleName || ghost.expect.roleId}: ожидание без отметки отправки — это прошлый ход, ` +
            "а не работа. " +
            (ghost.rolled
              ? "Карточка возвращена в Ready — ход начнётся заново."
              : "Ожидание снято, ход начнётся заново."),
          false,
          { tone: "warn" },
        );
      }
      // Ручной режим: нажатие «Шаг» делает ровно один шаг. Фон (таймер)
      // досылает очередь после перехода, но не читает ответы и не выдаёт
      // новые задания: иначе один ход превращался в цепочку из трёх отправок.
      if (!auto && !fromToggle) return;
      if (fromToggle) dbg("шаг: начало", () => debugSnapshot());

      // Неотправленное задание важнее всего остального: пока оно в очереди,
      // ни план, ни новый ход не начинаются. В автоцикле страницу адресата
      // открываем сами — иначе после перезагрузки вкладки очередь стояла бы
      // вечно, а браузер ждал бы человека.
      const pendingNow = GM_getValue(K.pending, null);
      if (pendingNow && (fromToggle || autoOn())) {
        const here = roleFromPath();
        if (norm(here) !== norm(pendingNow.roleId)) {
          const all = await roles();
          const target = all.find((r) => norm(r.id) === norm(pendingNow.roleId)) || null;
          if (target) return navigateTo(target, "там ждёт отправки задание");
        }
      }

      const meId = roleFromPath();
      if (!meId) {
        // Мастер не обязан помнить, на какой странице стоит цикл, но и угадывать
        // ему не нужно: «Шаг» открывает ту страницу, где действительно есть
        // работа. Сначала — адресат неотправленного задания, потом — тот, чей
        // ответ ждём, и только потом Координатор (там начинается новый ход).
        // В автоцикле Мастер не жмёт «Шаг»: цикл сам открывает ту страницу,
        // где есть работа. Иначе «Включить» на главной ничего не делал.
        if (!fromToggle && !autoOn()) return;
        const list = await roles();
        const pendingNow = GM_getValue(K.pending, null);
        const waitingNow = GM_getValue(K.expect, null);
        const byId = (id) => (id ? list.find((r) => norm(r.id) === norm(id)) || null : null);
        const pendingRole = pendingNow ? byId(pendingNow.roleId) : null;
        const waitingRole = waitingNow ? byId(waitingNow.roleId) : null;
        const coord = list.find((r) => r.fn === "Coordinator");
        const target = pendingRole || waitingRole || coord;
        if (!target) {
          log(
            list.length
              ? "Шаг не выполнен: нет активного Coordinator с заполненным «Agent URL»."
              : "Шаг не выполнен: нет ни одной активной роли с заполненным «Agent URL» — заполните поле в базе «Роли».",
            true,
          );
          return;
        }
        // В ручном режиме отложенный шаг выполняет уже открытая страница.
        // В автоцикле он не нужен: следующий тик продолжит сам.
        if (!pendingNow && fromToggle) GM_setValue(K.step, true);
        const why = target === pendingRole
          ? "там ждёт отправки задание"
          : target === waitingRole
            ? `ждём ответа «${target.name}»`
            : "там начинается ход";
        return navigateTo(target, why);
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
      const working = fromToggle ? await busySettled() : busyReason();
      if (working) {
        if (fromToggle) {
          log(`Шаг не выполнен: агент ещё отвечает (${busyLabel(working)}).`);
          // Ложный Stop исчезает сам: не заставляем Мастера жать второй раз.
          if (working.kind === "stop") scheduleStepRetry();
        }
        return;
      }

      let expect = GM_getValue(K.expect, null);
      if (expect && norm(expect.roleId) !== norm(me.id)) {
        const owner = list.find((r) => norm(r.id) === norm(expect.roleId)) || null;
        const ownerName = expect.roleName || owner?.name || "другой роли";
        if ((fromToggle || autoOn()) && owner) {
          let samePage = false;
          try {
            samePage = new URL(owner.url, location.href).pathname === location.pathname;
          } catch {
            samePage = false;
          }
          // Стоим не там, где идёт работа: открываем нужную страницу, а не
          // просим Мастера перейти вручную.
          if (!samePage) {
            if (fromToggle) GM_setValue(K.step, true);
            return navigateTo(owner, `ждём ответа «${owner.name}», а не «${me.name}»`);
          }
        }
        if (fromToggle) log(`Шаг не выполнен: ход ждёт ответа «${ownerName}», а не «${me.name}».`);
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
        const ghost2 = await dropGhostHandoff("задание не дошло: отметки отправки нет");
        GM_setValue(K.expect, null);
        GM_setValue("cfn-plan-at", 0);
        log(
          `${me.name}: в чате нет отметки прошлой отправки — это след прошлой попытки, снимаю ожидание и начинаю ход заново.` +
            (ghost2 && ghost2.rolled ? " Карточка возвращена в Ready." : ""),
          true,
        );
        expect = null;
      }

      // Опрос вместо ответа — не ответ. Разбираем его раньше любых
      // напоминаний: иначе «маркера нет» превращается в напоминание агенту,
      // который просто ждёт ответа на свой вопрос (24.10, NAR-1.12).
      const poll = await answerPolls(me, expect);
      if (poll === "answered") {
        log(`Жду, что ${me.name} напишет после ответа на вопрос.`);
        return;
      }
      if (poll === "waiting") {
        // Опрос уже отвечен, продолжения ещё нет. Ждём, но не бесконечно:
        // вопрос в чате — не «свежее сообщение», и общий сторож тишины на нём
        // не сработал бы, оставив карточку в Running навсегда.
        const since = Number((expect && (expect.sentAt || expect.at)) || 0);
        const waitedPoll = since ? Date.now() - since : 0;
        if (expect && waitedPoll > C.replyWaitMs) {
          const stuck = expect;
          dropHandoff(
            `${me.name}: опрос отвечен, но продолжения нет ${Math.round(waitedPoll / 60000)} мин — ` +
              "похоже, ход встал. Очередь и ожидание сняты; нажмите «Продолжить» и пройдите шаг заново.",
          );
          await releaseUndelivered(stuck, "агент не продолжил после ответа на вопрос");
        }
        return;
      }

      // Ждать ответа бесконечно нельзя: если агент не прислал ни строки за
      // replyWaitMs, задание до него, скорее всего, не дошло (например,
      // осталось от старой версии). Молчание тут — ошибка, а не терпение.
      //
      // Но молчание и работа — разные вещи. Задача может идти часами: пока
      // виден Stop или плашка «думает», ход живой, и снимать передачу нельзя —
      // иначе агент останется без ответа, а карточка вернётся в Ready.
      if (expect) {
        const since = Number(expect.sentAt || expect.at) || 0;
        const waited = Date.now() - since;
        const fresh = messagesAfter(expect.watermark || "").length;
        const working = stillWorking();
        if (waited > C.replyWaitMs && !fresh && !working) {
          const stuck = expect;
          dropHandoff(
            `${me.name} не ответил ни одним сообщением за ${Math.round(waited / 60000)} мин и ничего не делает: похоже, задание до него не дошло. ` +
              `Очередь и ожидание сняты — нажмите «Продолжить» и пройдите шаг заново.`,
          );
          await releaseUndelivered(stuck, "агент не ответил и ничего не делает");
          return;
        }
        if (waited > C.longWaitNoticeMs) {
          logThrottled(
            `long-wait:${expect.ref || expect.roleId || ""}`,
            `Жду ответа «${expect.roleName || expect.roleId}» ${Math.round(waited / 60000)} мин` +
              `${fresh ? " — агент уже отвечает" : working ? " — агент работает" : ""}. ` +
              "Длинная задача может идти часами: ждём, передачу не снимаю.",
            false,
            C.longWaitNoticeMs,
          );
        }
      }

      if (me.fn === "Coordinator") {
        await coordinatorStep(me, expect, fromToggle);
      } else if (!expect) {
        // Без ожидания `messagesAfter(expect.watermark)` упал бы в catch,
        // и «Шаг» на странице исполнителя ставил бы паузу вместо ответа.
        const coord = list.find((r) => r.fn === "Coordinator");
        if (fromToggle && coord) {
          // «Шаг» не должен упираться в тупик: работа начинается у
          // Координатора, туда и ведём. Раньше здесь была только строка в
          // журнале, и на опустевшей странице исполнителя жать было некуда —
          // например, после того как задание сняли как просроченное.
          log(`У «${me.name}» нет задания в очереди — открываю Координатора: там начинается ход.`);
          GM_setValue(K.step, true);
          return navigateTo(coord, "там начинается ход");
        }
        if (fromToggle) {
          log(`Шаг не выполнен: у «${me.name}» нет задания в очереди. Ход начинается с Координатора.`, true);
        } else if (autoOn() && coord) {
          // В автоцикле незанятая страница исполнителя — не повод стоять:
          // новый ход начинается у Координатора, туда и переходим.
          return navigateTo(coord, "там начинается ход");
        }
      } else {
        await submitExecutor(me, expect, fromToggle);
      }
    } catch (e) {
      // «HTTP 400: path failed validation» Мастеру ничего не говорит. Сначала
      // что случилось и что делать, потом техническая строка — она нужна,
      // если придётся разбираться.
      const raw = String((e && e.message) || e);
      // Причина называется по источнику: «Notion» и «шлюз Drive» — разные
      // поломки и разные действия Мастера.
      const plain = /битый id|valid uuid|path failed validation/i.test(raw)
        ? "Notion не принял адрес записи: в нём оказался битый id — обычно это " +
          "опечатка в строке-маркере ответа."
        : e && e.narthex === "gateway"
          ? "Шлюз Drive не ответил, ответ агента в журнал не записан. Проверьте, что " +
            "развёртывание Apps Script открыто «любому, у кого есть ссылка», и что ссылка в ⚙ та же."
          : e && e.narthex === "notion" || networkish(raw)
            ? "Notion не ответил: сеть или блокировка запроса. Запись не сделана."
            : "Шаг прервался на записи в Notion.";
      pause(
        `Цикл остановлен. ${plain} Ход не потерян: очередь и карточка на месте, ` +
          `после «Продолжить» скрипт перечитает ответ.\nТехнически: ${raw}`,
        { kind: "error" },
      );
    } finally {
      busy = false;
      stepRestarts = 0;
      setStatus();
    }
  }

  // ───────────────────────────── старт ─────────────────────────────
  entries = (GM_getValue(K.log, []) || []).slice(-C.maxLog);
  const boot = () => {
    migrateState();
    // Автоцикл не наследуется от прошлого запуска браузера: сначала — руками.
    autoForgetPersisted();
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
      autoSet(true);
      GM_setValue(K.paused, "");
      GM_setValue(K.pause, null);
      log("Автоцикл включён через ссылку — только для этой вкладки.");
    }
    setStatus();
    setup(false);
    setInterval(() => tick(false), C.tickMs);
    // Вернулись во вкладку — не ждём очередного тика: в фоне таймеры режутся,
    // и без этого следующая проверка могла бы случиться через минуту.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tick(false);
    });
    if (GM_getValue(K.step, false)) {
      GM_setValue(K.step, false);
      log("Открыл страницу роли — выполняю отложенный шаг.");
      tick(true);
      return;
    }
    tick(false);
  };
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();
