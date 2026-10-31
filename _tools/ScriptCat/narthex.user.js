// ==UserScript==
// @name         Narthex — передача хода между агентами
// @namespace    https://arena.ai/
// @version      1.4.90
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
// @connect      api.github.com
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
 *  - РЕШЕНИЯ о работе (какая задача, принята ли карточка) принимает
 *    Координатор. Конец миссии — не его решение: next:"done" передаёт миссию
 *    приёмке (роль с функцией Reviewer), и только её `accept` останавливает
 *    цикл. Больше трёх доработок не бывает: четвёртый возврат будит Мастера.
 *
 * Состояния PR, которые скрипт различает:
 *   Merged   — бейдж «Pull request merged»; мерж подтверждён интерфейсом.
 *   Closed   — бейдж «Pull request closed». Так выглядит и PR, слитый через
 *              GitHub, и PR, закрытый без мержа; что именно — решает маркер
 *              исполнителя (`merged: true`). Без заявки о мерже карточка
 *              уходит в Rework с причиной, а цикл продолжается.
 *   Timeout  — за prWaitMs мерж не появился: пауза, решение за человеком.
 *
 * Требует совместимого шлюза Drive с CF_DISPATCH, Notion-токена с доступом
 * к источникам и GitHub-токена на чтение PR: приватный репозиторий отвечает 404.
 */

(() => {
  "use strict";

  // ───────────────────────────── конфиг ─────────────────────────────
  const C = {
    notionV: "2025-09-03",
    roles: "ed076bfe-99dd-447d-9cac-55ca14661e99",
    missions: "c84a3f11-2dcf-414d-b4bf-35beaa7b2c0c",
    requests: "11b41fcc-7c84-406d-bc3b-5bf76ace79bb",
    // База «Вопросы»: вопросы агентов к Мастеру, которые не останавливают цикл.
    questions: "54ac1a79-fef2-4384-ac2c-c0f53379d3ab",
    questionsUrl: "https://app.notion.com/p/e00d99c8b526461ea7e900b9e988e149",
    questionHours: 24, // срок молчания по умолчанию: дальше действует вариант агента
    questionLineMax: 3, // сколько вопросов и ответов видно в одном промпте
    questionTextMax: 180, // столько влезает в заголовок «Вопрос» читаемо
    questionTextFull: 12000, // полный текст — в тело страницы вопроса, его не режем
    questionDefaultMax: 200,
    questionCheckMs: 600000, // как часто проверять сроки вопросов (10 минут)
    adrCheckMs: 600000, // как часто смотреть docs/decisions на proposed (10 минут)
    pageUrl: "https://app.notion.com/p/Narthex-4016f0cf570581f7a1f7c3661c608ffd",
    repo: "Creative36711/narthex", // для ссылки на PR из номера
    tickMs: 15000,
    mergeGraceMs: 90000, // сколько ждём мерж, прежде чем нажать кнопки за агента
    arenaResendMax: 1, // один минимальный повтор после ошибки Arena; второй отказ — пауза
    arenaRetryMs: 180000, // ошибка старше трёх минут уже не про нашу отправку
    maxReloadAttempts: 3, // максимум автоматических перезагрузок страницы при ошибке Arena
    reloadCountPrefix: "cf-auto-error-reload-count:", // префикс ключа счётчика перезагрузок
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
    composerGraceMs: 8000, // сколько ждём возврата поля ввода, если оно исчезло при перерисовке
    sendRetries: 3, // сколько тиков ждём дорисовку страницы, прежде чем звать Мастера
    sendReadyMs: 20000, // столько ждём активную кнопку Send на дорисовывающейся странице
    clickReadyMs: 8000, // столько ждём кнопку, прежде чем считать её недоступной
    pendingTtlMs: 600000, // отправка старше 10 минут не досылается: адресат её не получил
    undeliveredTtlMs: 7200000, // неотправленное задание ждёт Мастера два часа, а не десять минут
    replyWaitMs: 1800000, // 30 минут без единого сообщения — повод остановиться
    pageWaitMs: 90000, // страница адресата не отрисовалась — это «нет связи», а не молчание агента
    pageReloadMs: 20000, // столько ждём отрисовку, прежде чем перечитать страницу один раз
    observeGraceMs: 30000, // сколько смотрим на отрисованную страницу, прежде чем судить о молчании
    sendVerifyMs: 6000, // сколько ждём своё сообщение в чате после нажатия Send
    captchaGuardMs: 8000, // сколько после «отправлено» ждём капчу: она всплывает с задержкой
    stalledMs: 2700000, // 45 минут — и только для карточки, по которой ход потерян
    orphanGraceMs: 120000, // столько ждём, прежде чем вернуть в Ready карточку без хода
    longWaitNoticeMs: 600000, // раз в 10 минут напоминаем, что долгое ожидание — норма
    pollPauseCount: 3, // столько опросов подряд — уже поломка промпта, а не случайность
    reworkLimit: 3, // доработок миссии больше этого — стоп и вызов Мастера
    retryWaits: [800, 2500, 6000], // выдержки перед повторами: 4 попытки, ~9 с
    linkProbeWaits: [5000, 15000], // зонды связи после обрыва: 5 и 15 с
    rolesCacheMs: 600000, // база «Роли» — настройка: кеш на 10 минут
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
    mission: "cfn-mission-id",
    merged: "cfn-merged:",
    branch: "cfn-branch",
    pause: "cfn-pause-context",
    ntfyTopic: "cfn-ntfy-topic",
    ntfyToken: "cfn-ntfy-token",
    ghToken: "cfn-github-token",
    ghAsk: "cfn-github-ask",
    lastResult: "cfn-last-result",
    errSeen: "cfn-error-seen",
    step: "cfn-step-request",
    debug: "cfn-debug",
    lastSend: "cfn-last-send",
    deadSend: "cfn-dead-send",
    qQueue: "cfn-q-queue",
    answers: "cfn-answer-queue",
    collapsed: "cfn-panel-collapsed",
    stateV: "cfn-state-v",
    rolesCache: "cfn-roles-cache",
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
    gh: "cfn-gh",
    questions: "cfn-questions",
    qBadge: "cfn-q-badge",
    adr: "cfn-adr",
    adrBadge: "cfn-adr-badge",
    collapse: "cfn-collapse",
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

  /**
   * `rich_text` для поля Notion: один объект — не больше 2000 знаков.
   *
   * 28.10 в 22:00 цикл дважды подряд встал на записи ответа приёмки: Notion
   * ответил HTTP 400 «body.properties.Ответ.rich_text[0].text.content.length
   * should be ≤ 2000, instead was 2296». Ответ был верный и полный — длина
   * решения не порок, а предел одного объекта. Notion принимает до 100
   * объектов в массиве, поэтому длинный текст режется на части и уезжает
   * целиком, без потери второй половины решения.
   *
   * Ошибка транспорта была второй и худшей: любой HTTP-ответ, включая 400,
   * назывался «Notion не ответил: сеть или блокировка запроса» — сеть тут ни
   * при чём, Notion ответил и объяснил причину.
   */
  function richText(value, step = 1900) {
    const text = String(value == null ? "" : value);
    const parts = [];
    let at = 0;
    while (at < text.length && parts.length < 100) {
      let end = Math.min(text.length, at + step);
      // Суррогатная пара на границе: половина эмодзи ломает JSON запроса.
      const code = text.charCodeAt(end - 1);
      if (end < text.length && code >= 0xd800 && code <= 0xdbff) end -= 1;
      parts.push({ type: "text", text: { content: text.slice(at, end) } });
      at = end;
    }
    return parts;
  }
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
    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.90";

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
    /**
     * Что скрипт видит про отправку прямо сейчас.
     *
     * Нужен, когда журнал говорит «отправлено», а глаза видят другое: в снимке
     * поле ввода, кнопка Send, ключ доставки, свои реплики с id и временем из
     * id. В консоли: `copy(JSON.stringify(__narthex.send(), null, 2))`.
     */
    send: () => {
      const pending = GM_getValue(K.pending, null);
      const live = composer();
      return {
        version: SCRIPT_VERSION,
        at: new Date().toISOString(),
        composer: live
          ? {
              found: true,
              inDocument: composerAlive(live),
              length: composerText(live).length,
              head: composerText(live).slice(0, 120),
            }
          : { found: false, why: composerDiagnostics() },
        button: live ? debugSendButton(live) : null,
        pending: pending
          ? {
              role: pending.roleName || pending.roleId,
              at: pending.at,
              length: String(pending.text || "").length,
              undelivered: Boolean(pending.undelivered),
              captcha: Boolean(pending.captcha),
            }
          : null,
        key: pending ? sendKey(pending.text) || flat(pending.text).slice(0, 60) : "",
        deadSend: GM_getValue(K.deadSend, ""),
        own: userMessages().map((node) => {
          const id = String(node.id || "").replace("chat-message-", "");
          return { id, at: idTime(id) || 0, head: flat(node.textContent || "").slice(0, 80) };
        }),
        lastRefusal: GM_getValue("cfn-send-debug", null),
      };
    },
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
          parseMarker(m.raw, "CF_COORDINATOR_RESULT") || parseMarker(m.raw, "CF_AGENT_RESULT") || parseMarker(m.raw, "CF_REVIEW_RESULT") || null,
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
    // Тихая пауза — для остановок, которые Мастер не разбирает: вопрос ушёл
    // приёмке, миссию закрыли в обход неё, приёмка сама решает по существу.
    // С 1.4.80 такие события не повод звонить в телефон: их закрывает приёмка,
    // а Мастер нужен только там, где без него физически нельзя (нет роли,
    // нет прав, предел доработок).
    if (context.quiet) {
      notifyNtfy(`Цикл остановлен: ${info.reason}`, {
        title: context.notifyTitle || "Narthex: пауза",
        priority: "2",
        tags: "memo",
      });
      setStatus();
      return;
    }
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
   * Признаки прошлого ответа на карточке: дата, ссылка на PR и номер прогона.
   *
   * Поля эти ставит транспорт, поэтому снимает их тоже он, а не Координатор
   * через коннектор: 25.10 коннектор отвечал `validation_error` на очистку, и
   * карточка запиралась (NAR-2.3).
   */
  const answeredMarks = (card) => {
    const props = (card && card.properties) || {};
    return {
      "Submitted At": Boolean(props["Submitted At"]?.date?.start),
      "PR": Boolean(props["PR"]?.url),
      "Run ID": Boolean(rt(props["Run ID"])),
    };
  };
  const answeredCard = (card) => Object.values(answeredMarks(card)).some(Boolean);

  /**
   * Память о Rework — только для объяснения в журнале, не для разрешения.
   *
   * Раньше без этой памяти выдача отказывала, и карточка запиралась. 27.10 на
   * NAR-4.9 это и случилось: Координатор одним ходом перевёл карточку в Rework
   * и тут же вернул в Ready (Check=fail, Инварианты переписаны). Состояние
   * Rework продержалось меньше одного тика, в очередь не попало — памяти нет,
   * выдача отказала, цикл встал на паузе. Rework, который длился секунды, —
   * всё равно Rework; ждать, пока транспорт «увидит» его в опросе, нельзя.
   */
  const reworkKey = (id) => `cfn-rework:${id}`;
  const reworkSeen = (id) =>
    Boolean(id) && typeof GM_getValue === "function" && Number(GM_getValue(reworkKey(id), 0)) > 0;

  function rememberRework(cards) {
    if (typeof GM_setValue !== "function") return;
    for (const card of cards || []) if (card && card.id) GM_setValue(reworkKey(card.id), Date.now());
  }

  /**
   * Отметка «вот в таком виде страницу оставил ответ».
   *
   * «Submitted At» пишет браузер, «last_edited_time» — Notion: часы у них
   * разные, сравнивать эти два времени напрямую нельзя. Поэтому запоминаем
   * ровно то время, которое Notion вернул на записи ответа: любая правка после
   * него — чужая, то есть карточку трогали уже после вердикта.
   */
  const answerStampKey = (id) => `cfn-answer-stamp:${id}`;
  function rememberAnswerStamp(id, page) {
    const at = page && page.last_edited_time;
    if (id && at && typeof GM_setValue === "function") GM_setValue(answerStampKey(id), String(at));
  }
  function editedSinceAnswer(card) {
    const stamp = card && card.id && GM_getValue(answerStampKey(card.id), "");
    if (!stamp || !card.last_edited_time) return false;
    return String(card.last_edited_time) !== String(stamp);
  }

  /**
   * Почему карточка снова идёт в работу — для журнала.
   *
   * Ни один из этих признаков не обязателен: право на повторную выдачу даёт
   * указание Координатора (см. `redispatchClearProps`). Признаки нужны, чтобы
   * Мастер видел причину, а не догадывался по логу Notion.
   */
  function redispatchWhy(card) {
    if (reworkSeen(card && card.id)) return "её видели в Rework";
    if (card?.properties?.["Check"]?.select?.name === "fail") return "проверка ответа не прошла (Check=fail)";
    if (editedSinceAnswer(card)) return "карточку правили после ответа";
    return "Координатор направил её в работу снова";
  }

  /**
   * Что снять с карточки, которую Координатор снова направил в работу.
   *
   * Ход в Ready направляет только Координатор — транспорт сам из Ready ничего
   * не берёт. Поэтому если он назвал эту карточку, значит работа нужна заново,
   * и следы прошлого ответа снимаются: без этого выдача отказывала и цикл
   * вставал (NAR-4.9, 27.10).
   *
   * Осторожность сохранена там, где она нужна: если у роли в Ready есть и
   * свежая карточка, и отвеченная, берётся свежая (см. `pickReadyForRole`), —
   * повторная работа не подменяет новую.
   *
   * Чистка идёт одной записью: «Submitted At» (date), «PR» (url) и «Run ID»
   * (rich_text) снимаются пустыми значениями Notion — `null` и `[]`.
   */
  function redispatchClearProps(card) {
    const props = card && card.properties;
    if (!props) return null;
    if (props["Dispatch State"]?.select?.name !== "Ready") return null;
    if (!answeredCard(card)) return null;
    return {
      "Submitted At": { date: null },
      "PR": { url: null },
      "Run ID": { rich_text: [] },
    };
  }

  /**
   * Карточка этой роли из Ready: свежая вперёд.
   *
   * Отвеченная карточка — это Rework, а не новая работа. Если Координатор
   * направил ход роли, а у неё в Ready лежат обе, выдавать надо ту, которую ещё
   * не отвечали: иначе повторная работа подменит новую и Мастер получит две
   * копии одного задания.
   */
  function pickReadyForRole(ready, roleName) {
    const mine = (ready || []).filter((t) => norm(taskRole(t)) === norm(roleName));
    if (!mine.length) return null;
    return mine.find((t) => !answeredCard(t)) || mine[0];
  }

  /**
   * Счётчик повторных выдач одной карточки.
   *
   * Одна повторная выдача — нормальный Rework. Третья подряд за шесть часов —
   * это уже зацикливание: Координатор и исполнитель гоняют одну и ту же работу
   * и не замечают этого. Такую петлю показываем Мастеру, а счётчик обнуляем,
   * чтобы «Продолжить» действительно продолжало, а не упиралось в тот же
   * порог.
   */
  const redispatchKey = (id) => `cfn-redispatch:${id}`;
  const REDISPATCH_WINDOW = 6 * 3600 * 1000;
  const REDISPATCH_LIMIT = 3;
  function noteRedispatch(id) {
    const now = Date.now();
    const kept = (GM_getValue(redispatchKey(id), []) || []).map(Number).filter((at) => now - at < REDISPATCH_WINDOW);
    kept.push(now);
    GM_setValue(redispatchKey(id), kept);
    return kept.length;
  }

  /**
   * Вернуть карточку в Ready, если ход так и не ушёл.
   *
   * true — карточка действительно переписана; вызывающий по этому признаку
   * решает, снимать ли очередь и ожидание. Ошибка Notion ход не съедает: всё
   * остаётся как было, и работает прежнее правило 45 минут.
   */
  async function releaseUndelivered(expect, why, { cause = "undelivered" } = {}) {
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
          marker: `<!-- CF_DISPATCH ${card.id}:${runId}:${cause} -->`,
          entry:
            `\n\n<!-- CF_DISPATCH ${card.id}:${runId}:${cause} -->\n## ` +
            `${cause === "manual-reset" ? "Ход снят Мастером" : "Ход не дошёл до исполнителя"}\n\n` +
            `${why}\n\nКарточка возвращена в Ready, «Started At» и «Run ID» сняты: работы по ней не было.\n`,
        });
      } catch (e) {
        log(`Отметка о неудачной отправке не записалась в журнал: ${e.message}`, true);
      }
    }
    log(
      `«${taskTitle(card)}» возвращена в Ready: ${why}.` +
        (cause === "manual-reset" ? "" : " В Running она бы ждала 45 минут."),
      true,
      { ntfy: "quiet", title: "Narthex: карточка возвращена в Ready" },
    );
    return true;
  }

  function resume(reason = "проверено Мастером") {
    const before = GM_getValue(K.paused, "");
    if (!before) return;
    const paused = GM_getValue(K.pause, null);
    GM_setValue(K.paused, "");
    GM_setValue(K.pause, null);
    // Пауза из-за «Something went wrong»: сообщение не приняли, и ожидание
    // ответа — фикция. «Продолжить» — это и есть просьба отправить заново,
    // поэтому окно свежести ошибки (`arenaRetryMs`) считается от нажатия, а в
    // очередь кладётся минимальное сообщение «прочитай карточку сам». Старая
    // отметка «эту ошибку уже видели» снимается: иначе новый код её не тронет.
    if (paused && paused.kind === "arena-error") {
      GM_setValue(K.errSeen, "");
      const waiting = GM_getValue(K.expect, null);
      if (waiting) {
        GM_setValue(K.expect, {
          ...waiting,
          sentAt: Date.now(),
          verified: false,
          arenaResend: 0,
        });
        retryRejectedHandoff(
          GM_getValue(K.expect, null),
          { messageId: paused.ref || "" },
          "Пауза была из-за ошибки Arena",
        );
      } else {
        log("Пауза была из-за ошибки Arena, а ожидания уже нет: нажмите «Шаг», чтобы начать ход заново.", true);
      }
    }
    // Новый бюджет напоминаний: Мастер уже посмотрел, почему агент молчал.
    const expect = GM_getValue(K.expect, null);
    if (expect) {
      // «Продолжить» возвращает право и на автоматический повтор после ошибки
      // Arena (`arenaResend`), и на напоминания: Мастер уже увидел ошибку и ждёт,
      // что задание уйдёт само.
      GM_setValue(K.expect, {
        ...expect,
        tries: 0,
        autoResend: 0,
        arenaResend: 0,
        lastReplySig: "",
        lastReplyAt: 0,
      });
    }
    log(`Пауза снята Мастером (${reason}). Продолжаю.`, false, { ntfy: "quiet" });
    if (GM_getValue(K.pending, null)) {
      log("Задание уже в очереди — отправляю его заново, новый ход Координатора не нужен.", false, {
        ntfy: "quiet",
      });
    }
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

  /**
   * Свёрнутая панель.
   *
   * 28.10 Мастер попросил свернуть окно приложения: панель занимает угол
   * страницы агента и мешает читать чат. Свёрнутое состояние — только полоса с
   * названием, статусом и кнопкой «Стоп»: журнал и остальные кнопки скрыты, но
   * счётчики вопросов и решений остаются на самой кнопке, чтобы свёрнутое окно
   * не прятало работу, которая ждёт человека. Состояние помнится в ScriptCat и
   * переживает перезагрузку страницы.
   */
  const panelCollapsed = () => GM_getValue(K.collapsed, false) === true;

  function paintPanelChrome() {
    const panel = document.getElementById(ui.panel);
    if (!panel) return;
    const collapsed = panelCollapsed();
    panel.classList.toggle("cfn-panel-collapsed", collapsed);
    panel.style.width = collapsed ? "208px" : "360px";
    const log = document.getElementById(ui.log);
    if (log) log.style.display = collapsed ? "none" : "";
    for (const id of [ui.step, ui.ntfy, ui.questions, ui.adr, ui.gh, ui.debug, ui.reset, ui.clear, ui.setup]) {
      const el = document.getElementById(id);
      if (el) el.style.display = collapsed ? "none" : "";
    }
    const status = document.getElementById(ui.status);
    if (status) status.style.maxWidth = collapsed ? "120px" : "190px";
    const button = document.getElementById(ui.collapse);
    if (!button) return;
    const count = (id) => Number(document.getElementById(id)?.textContent || 0) || 0;
    const openQ = count(ui.qBadge);
    const openAdr = count(ui.adrBadge);
    const marks = `${openQ ? ` ❓${openQ}` : ""}${openAdr ? ` ⚖${openAdr}` : ""}`;
    button.textContent = collapsed ? `▸${marks}` : "▾";
    button.title = collapsed
      ? `Развернуть панель${openQ || openAdr ? ` (ждут: ${openQ ? `вопросов ${openQ}` : ""}${openQ && openAdr ? ", " : ""}${openAdr ? `решений ${openAdr}` : ""})` : ""}`
      : "Свернуть панель";
    button.style.background = collapsed ? "#2c3a2f" : "#242833";
  }

  function togglePanel() {
    GM_setValue(K.collapsed, !panelCollapsed());
    paintPanelChrome();
  }

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
        <button id="${ui.questions}" title="Вопросы агентов к Мастеру — база «Вопросы» в Notion" style="${btnStyle()}">❓<span id="${ui.qBadge}" style="display:none;margin-left:3px;padding:0 4px;border-radius:7px;background:#b23b3b;color:#fff;font-size:10px;line-height:14px;vertical-align:middle">0</span></button>
        <button id="${ui.adr}" title="Решения (ADR) со статусом proposed — ждут Мастера" style="${btnStyle()}">⚖<span id="${ui.adrBadge}" style="display:none;margin-left:3px;padding:0 4px;border-radius:7px;background:#8a6b2a;color:#fff;font-size:10px;line-height:14px;vertical-align:middle">0</span></button>
        <button id="${ui.gh}" title="GitHub: токен для приватного репозитория и возврат карточки после ложного отказа" style="${btnStyle()}">🐙</button>
        <button id="${ui.debug}" title="Отладка в консоли браузера (F12)" style="${btnStyle()}">🐞</button>
        <button id="${ui.reset}" title="Снять ход: очередь, ожидание и карточки в Running без хода (журнал и настройки останутся)" style="${btnStyle()}">↺</button>
        <button id="${ui.clear}" title="Очистить журнал; очередь снимается кнопкой ↺" style="${btnStyle()}">🧹</button>
        <button id="${ui.setup}" title="Настройка" style="${btnStyle()}">⚙</button>
        <button id="${ui.stop}" title="Остановить цикл и снять паузу" style="${btnStyle()}">✕</button>
        <button id="${ui.collapse}" title="Свернуть панель" style="${btnStyle()}">▾</button>
      </div>
      <div id="${ui.log}" style="max-height:200px;overflow:auto;padding:6px 10px"></div>`;
    document.body.appendChild(panel);

    document.getElementById(ui.collapse).onclick = () => togglePanel();

    document.getElementById(ui.setup).onclick = () => setup(true);
    document.getElementById(ui.reset).onclick = () => {
      // Сброс теперь ходит в Notion: без перехвата отказ сети остался бы
      // необработанным обещанием и молчаливой кнопкой.
      resetStateDialog().catch((e) => log(`Сброс не удался: ${e.message}`, true));
    };
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
    document.getElementById(ui.questions).onclick = () => window.open(C.questionsUrl, "_blank", "noopener");
    document.getElementById(ui.adr).onclick = () =>
      window.open(`https://github.com/${C.repo}/tree/main/docs/decisions`, "_blank", "noopener");
    document.getElementById(ui.ntfy).onclick = () => ntfyDialog();
    document.getElementById(ui.gh).onclick = () => githubDialog();
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
    paintPanelChrome();
    paintQuestions(openQuestions().rows);
    watchQuestions();
    paintDecisions(openDecisions().rows);
    watchDecisions();
    maybeGhDialog();
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
    // Новый токен — новый доступ: список ролей перечитываем, а не берём из кеша.
    GM_setValue(K.rolesCache, null);
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
      if (!ghToken()) {
        log("Токен GitHub не задан: приватный репозиторий анонимно не виден, PR не проверить. Кнопка 🐙.", false, {
          tone: "warn",
        });
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

  // ───────────────────────────── GitHub ─────────────────────────────
  /**
   * Токен GitHub и возврат карточки после ложного отказа.
   *
   * 24.10 Мастер нажал «Шаг» и не увидел, что скрипту не хватает доступа:
   * проверка молча получила 404 от приватного репозитория и отправила готовую
   * работу в Rework. Теперь скрипт говорит об этом сам — в журнале и этим
   * диалогом, — а кнопка «Вернуть карточку» исправляет уже случившееся.
   */
  function githubDialog() {
    document.getElementById("cfn-gh-dialog")?.remove();
    const box = document.createElement("div");
    box.id = "cfn-gh-dialog";
    box.style.cssText = [
      "position:fixed", "right:14px", "bottom:150px", "z-index:2147483001", "width:400px",
      "max-height:70vh", "overflow:auto",
      "background:#15171c", "color:#e7eaee", "border:1px solid #2b2f38", "border-radius:10px",
      "padding:10px", "font:12px/1.5 ui-monospace,Menlo,Consolas,monospace",
      "box-shadow:0 10px 30px rgba(0,0,0,.45)",
    ].join(";");
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <strong>🐙 GitHub</strong>
        <span style="opacity:.5;font-size:10px">v${SCRIPT_VERSION}</span>
        <span style="flex:1"></span>
        <button id="cfn-gh-close" title="Закрыть" style="${btnStyle()}">✕</button>
      </div>
      <div style="opacity:.7;margin-bottom:8px">
        <code>${C.repo}</code> приватный, поэтому без токена GitHub отвечает «404 —
        такого PR нет». Токен нужен только на чтение: fine-grained с правом
        <b>Pull requests: read</b> (и доступом к репозиторию) либо classic с <code>repo</code>.
        Хранится в ScriptCat, в журнал не попадает.
      </div>
      <label style="display:block;margin-bottom:6px">Токен GitHub<br>
        <input id="cfn-gh-token" type="password" placeholder="github_pat_…" style="${inputStyle()}"></label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="cfn-gh-save" style="${btnStyle()}">Сохранить</button>
        <button id="cfn-gh-check" style="${btnStyle()}">Проверить доступ</button>
        <button id="cfn-gh-recover" style="${btnStyle()}">Вернуть карточку</button>
        <button id="cfn-gh-adopt" title="Ответ уже в чате, а ожидание потеряно" style="${btnStyle()}">Взять ответ</button>
        <button id="cfn-gh-open" style="${btnStyle()}">Открыть токены</button>
        <button id="cfn-gh-off" style="${btnStyle()}">Забыть токен</button>
      </div>
      <div id="cfn-gh-note" style="margin-top:8px;min-height:32px;white-space:pre-wrap;opacity:.9;font-size:11px;line-height:1.45"></div>`;
    document.body.appendChild(box);

    const input = box.querySelector("#cfn-gh-token");
    const note = box.querySelector("#cfn-gh-note");
    const say = (text, error = false) => {
      note.textContent = text;
      note.style.color = error ? "#ff9a9a" : "#bfe6c4";
    };
    input.value = ghToken();
    say(ghToken() ? `Токен сохранён: ${ghMask(ghToken())}.` : "Токена нет: проверка PR по GitHub пока не работает.");

    box.querySelector("#cfn-gh-close").onclick = () => box.remove();
    box.querySelector("#cfn-gh-save").onclick = () => {
      GM_setValue(K.ghToken, input.value.trim());
      say(ghToken() ? `Сохранено: ${ghMask(ghToken())}. Проверьте доступ кнопкой ниже.` : "Токен удалён.");
    };
    box.querySelector("#cfn-gh-off").onclick = () => {
      GM_setValue(K.ghToken, "");
      input.value = "";
      say("Токен удалён: PR будет проверяться анонимно, для приватного репозитория — никак.", true);
    };
    box.querySelector("#cfn-gh-open").onclick = () =>
      window.open("https://github.com/settings/personal-access-tokens/new", "_blank", "noopener");
    box.querySelector("#cfn-gh-check").onclick = async () => {
      const token = input.value.trim();
      say(token ? "Проверяю доступ к репозиторию…" : "Токена в поле нет — проверяю анонимный доступ…");
      try {
        const repo = await request("GET", `https://api.github.com/repos/${C.repo}`, githubHeaders(token));
        const rights = repo && repo.permissions ? Object.keys(repo.permissions).filter((k) => repo.permissions[k]) : [];
        say(
          `Доступ есть: ${repo.full_name}, ${repo.private ? "приватный" : "публичный"}` +
            (rights.length ? `, права: ${rights.join(", ")}` : "") +
            ". Если токен новый — нажмите «Сохранить».",
        );
      } catch (e) {
        const code = Number((e && e.status) || 0);
        say(
          code === 404
            ? `Репозиторий не виден (HTTP 404): токен не выдан на ${C.repo} или просрочен.`
            : code === 401
              ? "Токен не принят (HTTP 401): проверьте, что скопирован целиком и не истёк."
              : `Проверка не прошла: ${(e && e.message) || e}`,
          true,
        );
      }
    };
    box.querySelector("#cfn-gh-recover").onclick = async () => {
      say("Перепроверяю последнюю заявку о мерже…");
      try {
        const res = await recoverLastClaim();
        say(res.text, !res.ok);
      } catch (e) {
        say(`Вернуть не удалось: ${e.message}`, true);
      }
    };
    box.querySelector("#cfn-gh-adopt").onclick = async () => {
      say("Ищу ответ на этой странице…");
      try {
        const res = await adoptPageAnswer();
        say(res.text, !res.ok);
      } catch (e) {
        say(`Ответ не взят: ${e.message}`, true);
      }
    };
  }

  /** Один раз после ложного отказа сами показываем, где взять токен. */
  function maybeGhDialog() {
    if (!GM_getValue(K.ghAsk, 0)) return;
    GM_setValue(K.ghAsk, 0);
    setTimeout(() => githubDialog(), 400);
  }

  // ───────────────────────────── HTTP ─────────────────────────────
  /**
   * Сбой, который имеет смысл повторить: запрос не дошёл или чужая сторона
   * ответила своей ошибкой.
   *
   * 27.10 в 19:23 POST `data_sources/…/query` получил от Notion HTTP 502 —
   * ответ на стороне Notion, карточка и ход целы. Раньше такой ответ считался
   * отказом по существу, повтора не было, и цикл вставал на паузу из-за
   * чужой пятиминутной аварии.
   */
  const networkish = (text) =>
    /сеть|таймаут|failed to fetch|network|load failed|HTTP (?:429|5\d\d)/i.test(String(text || ""));

  /**
   * Причина обрыва в читаемом виде.
   *
   * 29.10 в 10:08 цикл встал на паузе посреди шага 5.20: POST
   * `data_sources/ed076bfe-…/query` не получил вообще ничего — ни кода, ни
   * тела ответа. Notion был жив (отдельный запрос в ту же минуту это
   * подтвердил), но `onerror` не сохранял ни `statusText`, ни `error`:
   * «оборвано» и «запрещено менеджером скриптов» выглядели одинаково, а
   * фраза про `@connect` отправляла Мастера искать блокировку, которой нет.
   */
  function linkError(kind, r) {
    const detail = [r && r.statusText, r && r.error && (r.error.message || String(r.error))]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" / ");
    const err = new Error(detail ? `${kind}: ${detail}` : kind);
    err.status = 0;
    err.link = true;
    return err;
  }

  function requestOnce(method, url, headers, body, timeout = 45000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        // Строка уходит как есть: шлюз Apps Script читает `postData.contents`
        // и ждёт там JSON-текст, а не JSON-строку в кавычках.
        data: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        timeout,
        onload: (r) => {
          let parsed = null;
          try {
            parsed = r.responseText ? JSON.parse(r.responseText) : null;
          } catch {
            parsed = r.responseText;
          }
          if (r.status >= 200 && r.status < 300) resolve(parsed);
          else {
            const err = new Error(`HTTP ${r.status}: ${(parsed && (parsed.message || parsed.error)) || r.statusText}`);
            // Код нужен вызывающему: 404 приватного репозитория и 404 «PR нет» —
            // разные вещи, и различает их только наличие токена (1.4.49).
            err.status = Number(r.status) || 0;
            reject(err);
          }
        },
        onerror: (r) => reject(linkError("сеть недоступна или запрос оборвался", r)),
        ontimeout: (r) => reject(linkError("таймаут запроса", r)),
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
  async function request(method, url, headers, body, opts = {}) {
    // Кому нужен свой распорядок повторов, тот просит один запрос: иначе
    // вложенные циклы перемножаются (2 × 3 = шесть попыток на один сбой), и
    // выдержка перестаёт быть предсказуемой. Так делает `notion()`.
    const tries = opts.retry === false ? 1 : 2;
    let last = null;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      try {
        return await requestOnce(method, url, headers, body);
      } catch (e) {
        last = e;
        // Выдержка — только перед следующей попыткой. Иначе последняя,
        // заведомо холостая пауза добавляла 0,7 с к каждой неудаче.
        if (attempt === tries - 1 || !networkish(e && e.message)) break;
        await sleep(700);
      }
    }
    throw last;
  }

  /**
   * Сбой, который имеет смысл повторить: обрыв, таймаут, 429 или чужая 5xx.
   *
   * Обрыв (`status 0`) раньше повторялся реже, чем 502: внешний цикл смотрел
   * только на `HTTP 429|5xx`, и секундная потеря связи стоила паузы. 29.10
   * именно так встал шаг 5.20 — на девятом часу работы, без единого отказа
   * Notion по существу.
   */
  const retriable = (e) =>
    Boolean(e) && (Number(e.status) === 0 || /HTTP (?:429|5\d\d)/i.test(String(e.message || "")));

  /**
   * Связь после обрыва: два зонда, через 5 и 15 секунд.
   *
   * `true` — Notion снова отвечает, и шаг повторяется; `false` — связи нет,
   * и пауза говорит об этом прямо. Зонд — самое дешёвое чтение: `users/me`.
   */
  async function linkBack() {
    const token = GM_getValue(K.notion, "");
    for (const wait of C.linkProbeWaits) {
      await sleep(wait);
      try {
        // Короткий таймаут: зонд — это «есть связь или нет», а не запрос данных.
        // Два зонда по 45 с растянули бы паузу сильнее, чем сама поломка.
        await requestOnce("GET", "https://api.notion.com/v1/users/me", {
          Authorization: `Bearer ${token}`,
          "Notion-Version": C.notionV,
        }, 8000);
        log(
          `Связь с Notion пропадала и вернулась через ${Math.round(wait / 1000)} с — повторяю запрос.`,
          false,
          { tone: "warn", ntfy: "quiet" },
        );
        return true;
      } catch {
        /* зонд не прошёл — ждём следующий */
      }
    }
    return false;
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
    // Короткие ключи `dispatch`/`run` — не «чужой id», а тот же самый: 25.10
    // Tools прислал маркер с верными значениями под короткими именами, и
    // журнал получил предупреждение о битом id. Принимаем синонимы молча;
    // вслух называем только то, что действительно не совпало.
    const given = (...keys) => {
      for (const key of keys) {
        const value = fixed[key];
        if (value !== undefined && value !== null && value !== "") return String(value);
      }
      return "";
    };
    const dispatch = given("dispatch_id", "dispatch", "dispatchId");
    const run = given("run_id", "run", "runId");
    if (!isUuid(dispatch) || norm(dispatch) !== norm(expect.ref)) {
      stray.push(`dispatch_id «${dispatch || "нет"}»`);
    }
    fixed.dispatch_id = expect.ref;
    if (expect.runId) {
      if (norm(run) !== norm(expect.runId)) stray.push(`run_id «${run || "нет"}»`);
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
    // Повторяем только то, что безопасно повторить: чтение, правку свойств и
    // запрос очереди. Создание страниц (`POST pages`) не повторяем никогда —
    // на 502 или на обрыве запрос мог уже пройти, и повтор сделал бы вторую
    // карточку.
    const safeToRepeat = method !== "POST" || /\/query$/.test(String(path));
    const url = `https://api.notion.com/v1/${path}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Notion-Version": C.notionV,
      "Content-Type": "application/json",
    };
    // Распорядок один на всех: 4 попытки с выдержкой 0,8 / 2,5 / 6 с. Обрыв
    // связи повторяется так же, как 5xx: это одинаково чужой сбой.
    const tries = safeToRepeat ? C.retryWaits.length + 1 : 1;
    let last = null;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      try {
        return await request(method, url, headers, body, { retry: false });
      } catch (e) {
        last = e;
        if (attempt === tries - 1 || !retriable(e)) break;
        await sleep(C.retryWaits[attempt]);
      }
    }
    // Связи нет — но это может быть сон машины или фоновая вкладка, а не
    // поломка. Прежде чем останавливать цикл, проверяем связь и повторяем.
    if (safeToRepeat && Number(last.status) === 0) {
      if (await linkBack()) {
        try {
          return await request(method, url, headers, body, { retry: false });
        } catch (e) {
          last = e;
        }
      } else {
        last.probed = true;
      }
    }
    last.narthex = "notion";
    // «Не ответил», «ответил отказом» и «связь пропала» — разные поломки. 4xx
    // значит, что Notion всё получил и объяснил, что не так с данными: чинить
    // надо запрос, а не сеть. 28.10 HTTP 400 «content.length should be ≤ 2000»
    // показывался как «сеть или блокировка», и Мастер искал сеть, которой
    // ничего не было. 429 и 5xx — короткий сбой на стороне Notion.
    const raw = String(last.message || "");
    last.message =
      /HTTP 4\d\d/i.test(raw) && !/HTTP 429/i.test(raw)
        ? `Notion отказал на ${method} ${path} (он получил запрос и не принял данные): ${raw}`
        : last.probed
          ? `Notion не ответил на ${method} ${path}: ${raw}; связь не восстановилась за ` +
            `${Math.round(C.linkProbeWaits.reduce((a, b) => a + b, 0) / 1000)} с (два зонда users/me)`
          : `Notion не ответил на ${method} ${path}: ${raw}`;
    throw last;
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
    let refused = "";
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
        // Шлюз ответил и отказал — это не молчание. Повтор и второй путь дадут
        // тот же ответ (а у append есть побочный эффект), поэтому сразу наверх:
        // Мастеру важно видеть «отказал, потому что…», а не «не ответил».
        refused = why;
        gmError = why;
        break;
      } catch (e) {
        gmError = String((e && e.message) || e);
        if (!networkish(gmError)) break;
        await sleep(700);
      }
    }

    let fetchError = "";
    if (!refused) {
      try {
        const res = await fetch(url, { method: "POST", headers, body: payload });
        const data = await res.json();
        if (data && data.ok === true) return data;
        if (action === "append" && /duplicate/i.test(String((data && data.error) || ""))) return { ok: true, duplicate: true };
        refused = String((data && data.error) || "");
        fetchError = refused || `HTTP ${res.status}`;
      } catch (e) {
        fetchError = String((e && e.message) || e);
      }
    }

    const err = new Error(
      refused
        ? `шлюз Drive отказал: ${refused}`
        : `шлюз Drive не ответил: GM: ${gmError}; fetch: ${fetchError}`,
    );
    err.narthex = "gateway";
    err.refused = Boolean(refused);
    err.reason = refused;
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

  /** Строка базы «Роли» в том виде, в каком её видит остальной скрипт. */
  const mapRoleRow = (p) => {
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
  };

  /**
   * Вся база «Роли»: и активные, и те, что Мастер ещё не включил.
   *
   * Кеш на 10 минут — потому что это настройка, а не данные миссии: список
   * агентов читается в начале каждого шага, а меняет его человек. 29.10 обрыв
   * связи именно на этом чтении остановил цикл на девятом часу работы; с
   * кешем шаг переживает потерю сети, а не ждёт Мастера у экрана.
   *
   * `fresh: true` — мимо кеша: смена токена в ⚙ и случаи, где список только
   * что правили руками.
   */
  async function roleRows({ fresh = false } = {}) {
    const cached = GM_getValue(K.rolesCache, null);
    const usable = cached && Array.isArray(cached.rows) && cached.rows.length ? cached : null;
    const age = usable ? Date.now() - Number(usable.at || 0) : Number.POSITIVE_INFINITY;
    if (!fresh && usable && age < C.rolesCacheMs) return usable.rows;
    try {
      const rows = (await query(C.roles)).map(mapRoleRow);
      if (rows.length) GM_setValue(K.rolesCache, { at: Date.now(), rows });
      return rows;
    } catch (e) {
      if (!usable) throw e;
      log(
        `База «Роли» не ответила (${firstLine(String((e && e.message) || e))}) — работаю по кешу ` +
          `${Math.max(1, Math.round(age / 60000))} мин назад: список агентов с тех пор не менялся.`,
        false,
        { tone: "warn", ntfy: "quiet" },
      );
      return usable.rows;
    }
  }

  /** Свежий список ролей: сбросить кеш и перечитать. */
  async function rolesFresh() {
    GM_setValue(K.rolesCache, null);
    return roles();
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
    if (expect?.kind === "dispatch" || (expect?.kind === "reminder" && expect.runId)) {
      // Закрытие миссии извне не доказывает, что ответ этой карточки записан.
      // Не теряем её Run ID и не принимаем остальные Running «за компанию».
      autoSet(false);
      pause("Миссия уже закрыта, но есть незавершённое ожидание карточки. " +
        "Ответ и Run ID сохраняю; проверьте карточку и журнал, прежде чем снимать ожидание.", {
        kind: "closed-with-running", ref: expect.ref || "", runId: expect.runId || "",
      });
      return true;
    }
    const at = closed.properties?.["Завершена"]?.date?.start || "";
    // «Ждали ход» — любое незавершённое ожидание, а не только план или
    // напоминание. 28.10 NAR-4 закрыли своим ходом, в памяти осталось
    // ожидание вида «marker» — конец миссии прошёл молча.
    const waited = Boolean(expect && expect.kind);
    // «Завершена» — дата без времени, `Date.parse` даёт полночь. Прежние
    // десять минут означали: закрытие, увиденное через полчаса, уже «старое»,
    // и о нём не сообщали. Сутки покрывают любую дату закрытия этого дня.
    const age = at ? Date.now() - Date.parse(at) : Infinity;
    const recent = Number.isFinite(age) && age < 24 * 60 * 60 * 1000;
    // Включённый автоцикл сам по себе довод: он крутится, работы нет —
    // значит, миссия кончилась, и он обязан встать и сказать об этом.
    const running = autoOn();
    // Обычное «миссии пока нет» остаётся тишиной: закрытая миссия недельной
    // давности не повод пушить при каждом открытии страницы. Но автоцикл
    // гасим и здесь — закрытая миссия означает конец работы.
    if (!waited && !recent && !running) {
      autoSet(false);
      setStatus();
      return false;
    }

    // Отсчёт закрытия, а не только id: миссию возвращают и закрывают снова,
    // и второе закрытие — такое же событие, как первое. 28.10 NAR-4 закрыли
    // повторно после возврата, флаг по одному id остался с 27.10 — Мастер
    // не получил ни пуша, ни выключенного автоцикла. Поэтому в ключ входит
    // дата возврата: у каждой пары «возврат → закрытие» свой отсчёт.
    const returnedAt = closed.properties?.["Возвращена"]?.date?.start || "";
    const key = `cfn-mission-done:${closed.id}:${at}:${returnedAt}`;
    const announced = Boolean(GM_getValue(key, false));
    // Закрытие в обход приёмки. Миссию закрывает вердикт Reviewer, и только он:
    // если «Завершена» появилась без отметки `cfn-review:<id>`, значит её
    // поставил агент (или человек руками). Это не конец работы, а конец
    // проверки — про такое Мастер должен узнать сразу, а не через неделю.
    const verdict = String(GM_getValue(`cfn-review:${closed.id}`, "") || "");
    const ackKey = `cfn-review-ack:${closed.id}:${at}`;
    // Пауза — только когда закрытие кого-то застало: шёл ход или крутился
    // автоцикл. Миссию, закрытую Мастером на тихом стенде, будить незачем.
    if (!announced && !verdict && recent && (waited || running) && !GM_getValue(ackKey, false)) {
      GM_setValue(ackKey, true);
      if (waited) GM_setValue(K.expect, null);
      const name = rt(closed.properties["Миссия"]) || "миссия";
      pause(
        `Миссию «${name}» закрыли, но приёмка вердикта не давала: «Завершена» стоит в обход приёмки. ` +
          "Если работу действительно приняли — нажмите «Продолжить», цикл закроет миссию как обычно. " +
          "Если нет — верните её в «Возвращена», напишите «Замечания» и нажмите «Продолжить»: " +
          "Координатор разберёт их карточками.",
        {
          kind: "closed-unreviewed",
          ref: closed.id,
          quiet: true,
          notifyTitle: "Narthex: миссия закрыта без приёмки",
        },
      );
      return true;
    }
    if (waited) GM_setValue(K.expect, null);
    // Автоцикл гасим и при повторном проходе: закрытая миссия означает конец
    // работы, даже если строку с пушем уже печатали (перезагрузка страницы,
    // второй «Шаг» по той же очереди).
    if (announced) {
      autoSet(false);
      setStatus();
      return waited;
    }

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
        // Принятую миссию объявляет сама приёмка (`closeMission`) — громко и
        // один раз. Здесь остаётся закрытие в обход приёмки: о нём Мастер уже
        // знает из тихой паузы, звонить второй раз незачем (1.4.80).
        ntfy: failed ? "loud" : "quiet",
        title: failed ? "Narthex: миссия провалена" : "Narthex: миссия завершена",
      },
    );
    return true;
  }

  /** Активная миссия и сменилась ли она относительно той, что помнит транспорт. */
  async function missionProbe() {
    const mission = await activeMission();
    const known = String(GM_getValue(K.mission, "") || "");
    return { mission, known, changed: Boolean(mission && known) && known !== mission.id };
  }

  /**
   * Паузы, которые миссией не ограничены.
   *
   * Капча, сломанная страница и ошибка на экране ждут человека, а не хода
   * внутри миссии: снимать их сменой миссии нельзя. Всё остальное — остановки
   * конкретного хода, и к новой миссии они отношения не имеют.
   */
  const PAUSE_BEYOND_MISSION = new Set(["captcha", "ui-error", "arena-error", "mission-change-running"]);

  /** Пауза прошлого хода к новой миссии не относится. */
  function dropPauseOfMission(cleared = []) {
    if (!GM_getValue(K.paused, "")) return false;
    const ctx = GM_getValue(K.pause, null);
    if (ctx && PAUSE_BEYOND_MISSION.has(ctx.kind)) return false;
    GM_setValue(K.paused, "");
    GM_setValue(K.pause, null);
    cleared.push(`пауза прошлой миссии (${ctx?.kind || "без контекста"})`);
    return true;
  }

  /**
   * Смена миссии обнуляет прошлый ход.
   *
   * 24.10 миссия NAR-1 закрылась, а следующая начинается новой карточкой в
   * «Миссиях». Ожидание ответа и очередь отправки от прошлой миссии к новой не
   * относятся — но именно они решают, куда пойдёт «Шаг»: транспорт повёл бы
   * Мастера на страницу исполнителя, который уже ничего не делает, и новая
   * миссия не началась бы вовсе. Поэтому при смене миссии остатки снимаются,
   * а запись в журнале говорит, что именно.
   */
  async function syncMissionState() {
    const probe = await missionProbe();
    const live = GM_getValue(K.expect, null);
    const liveDispatch = live?.kind === "dispatch" || (live?.kind === "reminder" && !!live.runId);
    if (!probe.mission) {
      const missionId = liveDispatch && (live.missionId || probe.known);
      if (missionId) {
        const previous = await notion("GET", `pages/${missionId}`);
        const state = previous?.properties?.["Состояние"]?.select?.name || "";
        if (["Завершена", "Провалена"].includes(state)) {
          autoSet(false);
          pause("Миссия уже закрыта, но есть незавершённое ожидание карточки. " +
            "Ответ и Run ID сохраняю; проверьте карточку и журнал, прежде чем снимать ожидание.", {
            kind: "closed-with-running", ref: live.ref || "", runId: live.runId || "",
          });
          return true;
        }
      }
      return;
    }
    const changed = probe.changed || (live?.missionId && norm(live.missionId) !== norm(probe.mission.id));
    if (changed && liveDispatch) {
      // Новая миссия не доказывает, что старая карточка сдана. Не стираем
      // ожидание и не выдаём её ответ за ответ новой миссии.
      pause("Появилась новая миссия, пока ждём ответ по карточке прошлой. " +
        "Ожидание и Run ID сохранены: сначала сверьте старую карточку и журнал, затем продолжайте.", {
        kind: "mission-change-running", ref: live.ref || "", runId: live.runId || "",
      });
      return true;
    }
    GM_setValue(K.mission, probe.mission.id);
    if (!probe.changed) return;

    const cleared = [];
    if (GM_getValue(K.expect, null)) {
      GM_setValue(K.expect, null);
      cleared.push("ожидание ответа");
    }
    if (GM_getValue(K.pending, null)) {
      GM_setValue(K.pending, null);
      cleared.push("очередь отправки");
    }
    // Вопросы прошлой миссии к новой не относятся: ответ на них теперь
    // бессмысленен, а очередь ответов иначе держала бы цикл (1.4.80).
    const pendingAnswers = GM_getValue(K.answers || "cfn-answer-queue", null);
    if (Array.isArray(pendingAnswers) && pendingAnswers.length) {
      GM_setValue(K.answers || "cfn-answer-queue", []);
      cleared.push("очередь ответов на вопросы");
    }
    GM_setValue("cfn-blocked-norole", 0);
    GM_setValue("cfn-plan-at", 0);
    GM_setValue("cfn-plan-miss", 0);
    dropPauseOfMission(cleared);

    const name = rt(probe.mission.properties["Миссия"]) || "без названия";
    log(
      `Новая миссия «${name}»: ${cleared.length ? `снял прошлый ход — ${cleared.join(", ")}` : "прошлый ход был чистым"}. ` +
        "Ход начинается с Координатора.",
      false,
      { tone: "ok" },
    );
  }

  /**
   * Пауза прошлой миссии не имеет права держать новую.
   *
   * Проверка стоит до общего стража паузы: иначе тик молча выходил бы, а
   * «Шаг» на любой странице отвечал бы «цикл на паузе» — и новая миссия не
   * начиналась бы, пока Мастер не нажмёт «Продолжить» без причины.
   */
  async function clearStaleMissionPause() {
    try {
      const probe = await missionProbe();
      if (!probe.changed) return false;
      const live = GM_getValue(K.expect, null);
      if (live?.kind === "dispatch" || (live?.kind === "reminder" && live.runId)) {
        // И эта ранняя ветка не должна закрепить новую миссию до сверки
        // старой выдачи, иначе syncMissionState уже не увидит смену.
        const context = GM_getValue(K.pause, null);
        if (!PAUSE_BEYOND_MISSION.has(context?.kind)) {
          pause("Появилась новая миссия, пока ждём ответ по карточке прошлой. " +
            "Ожидание и Run ID сохранены: сначала сверьте старую карточку и журнал, затем продолжайте.", {
            kind: "mission-change-running", ref: live.ref || "", runId: live.runId || "",
          });
        }
        return false;
      }
      const cleared = [];
      dropPauseOfMission(cleared);
      if (!cleared.length) return false;
      GM_setValue(K.mission, probe.mission.id);
      const name = rt(probe.mission.properties["Миссия"]) || "без названия";
      log(`Пауза относилась к прошлой миссии — снимаю: новая «${name}» начинается с чистого хода.`, false, { tone: "ok" });
      return true;
    } catch {
      return false;
    }
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

  /**
   * Слова названия миссии — без знаков и связок.
   *
   * 25.10 (фаза 2) Координатор создал NAR-2.14 и NAR-2.15 с «Миссией»
   * «NAR-2 · Шов движок и пак», а миссия называется «NAR-2 · Шов «движок /
   * пак»». Сравнение строк в лоб (`includes`) не совпало, обе карточки
   * выпали из очереди, и транспорт дважды просил план с «0 Ready, 0 Draft»,
   * хотя карточки лежали в базе, — а потом встал на паузу «в Ready нет
   * карточки». Поэтому имена сравниваются по словам: кавычки, «·», «/» и
   * связки «и» на смысл не влияют.
   */
  const MISSION_STOPWORDS = new Set(["и", "миссия", "миссии", "фаза", "этап"]);
  const missionWords = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((w) => w && !MISSION_STOPWORDS.has(w));

  /**
   * Одна ли это миссия. Точное совпадение слов — да; перестановка слов и
   * лишнее слово — тоже да, если короткое название содержит не меньше трёх
   * слов (иначе «NAR-2» цепляло бы карточки соседних миссий). Пустое поле
   * «Миссия» в карточке — не чужая миссия: такие карточки считаются всегда.
   */
  function missionSame(a, b) {
    const left = missionWords(a);
    const right = missionWords(b);
    if (!left.length || !right.length) return false;
    const key = (list) => [...list].sort().join(" ");
    if (key(left) === key(right)) return true;
    const [small, big] = left.length <= right.length ? [left, right] : [right, left];
    return small.length >= 3 && small.every((w) => big.includes(w));
  }

  /** Сказать про «потерянные» карточки — один раз на набор, а не на каждый план. */
  const missionSkipSeen = new Set();

  async function tasks(state, mission) {
    const rows = await query(
      C.requests,
      { property: "Dispatch State", select: { equals: state } },
      [{ property: "Sequence", direction: "ascending" }],
    );
    if (!mission) return rows;
    const wanted = rt(mission.properties["Миссия"]).trim();
    const skipped = [];
    const kept = rows.filter((row) => {
      const value = rt(row.properties["Миссия"]).trim();
      if (!value) return true;
      if (norm(value) === norm(mission.id)) return true;
      if (missionSame(value, wanted)) return true;
      skipped.push({ row, value });
      return false;
    });
    if (skipped.length) {
      const key = `${state}|${skipped.map((s) => s.row.id).join(",")}`;
      if (!missionSkipSeen.has(key)) {
        missionSkipSeen.add(key);
        const list = skipped
          .map((s) => `«${firstLine(taskTitle(s.row), 40)}» — «${firstLine(s.value, 60)}»`)
          .join("; ");
        log(
          `В «${state}» есть карточки другой миссии, они не в очереди: ${list}. ` +
            `Очередь миссии «${firstLine(wanted, 60)}».`,
          false,
          { tone: "warn", ntfy: "quiet", title: "Narthex: карточка вне миссии" },
        );
      }
    }
    return kept;
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

  /**
   * Страница адресата отрисована — и только тогда по ней можно судить.
   *
   * 25.10, 16:55:59–16:56:07. Мастер снял паузу после обрыва связи, скрипт
   * открыл страницу Turn Runtime, а через 8 секунд решил, что агент молчит
   * 77 минут: транскрипт ещё не отрисовался, `messagesAfter()` вернул пусто,
   * кнопка Stop не нарисована. Ожидание сняли, карточку вернули в Ready —
   * а ответ лежал в чате: агент отработал 17 м 53 с и прислал маркер.
   *
   * «Пусто на странице» и «агент молчит» — разные вещи. Пока транскрипт не
   * отрисован, о молчании не судим вовсе: это либо загрузка, либо сеть.
   */
  function pageReady(expect) {
    const state = String((typeof document !== "undefined" && document.readyState) || "");
    if (state && state !== "interactive" && state !== "complete") {
      return { ok: false, why: `страница ещё грузится (${state})` };
    }
    // Ошибка связи в самой странице: чат остаётся пустым, сколько ни жди.
    const broken = [...document.querySelectorAll('[role="alert"]')].find((el) => {
      if (!visible(el)) return false;
      const text = shortLabel(el) || String(el.textContent || "");
      return /connection|соединени|network|reconnect|переподключ/i.test(text);
    });
    if (broken) return { ok: false, why: "страница не догрузилась: нет связи" };
    const nodes = messages();
    if (nodes.length) return { ok: true, why: `сообщений ${nodes.length}` };
    // Задание отправлено и подтверждено — значит в этом чате есть как минимум
    // наша реплика. Пустой транскрипт при этом значит одно: список сообщений
    // ещё не смонтирован. 25.10 в 17:47 поле ввода уже было, сообщений 0 —
    // и скрипт по нажатому «Шагу» написал «маркера этой выдачи в чате нет»,
    // хотя маркер лежал в чате.
    if (userMessages().length) return { ok: true, why: "свои реплики видны, транскрипт отрисован" };
    if (expect && Number(expect.sentAt)) {
      return { ok: false, why: "транскрипт ещё не отрисован: своих реплик не видно" };
    }
    // Пустой транскрипт ещё не значит «ответа нет»: у только что открытой
    // страницы поле ввода рисуется раньше истории. Готовой считаем страницу,
    // где видно поле ввода или плашку завершения, — там уже есть что читать.
    if (composer() || completionPlaque()) return { ok: true, why: "поле ввода на месте, транскрипт пуст" };
    return { ok: false, why: "ни реплик, ни поля ввода — страница не отрисовалась" };
  }

  /**
   * Приложение Arena отрисовалось — только тогда на странице можно что-то делать.
   *
   * 25.10, 17:30:24–17:30:44. Скрипт перешёл на страницу Turn Runtime и через
   * 20 секунд попытался отправить задание: поле ввода уже было, текст встал
   * (9186 символов), кнопка Send была в разметке — но `disabled`, потому что
   * транскрипт в этот момент монтировался (сообщений 0 → 18). Скрипт решил,
   * что редактор «не принял текст», вернул карточку NAR-2.12 в Ready и встал
   * на паузу. Работы по карточке не было — виновата спешка.
   *
   * Правило: пока документ не догружен, скрипт не делает ничего — ни вставки,
   * ни кликов, ни закрытия панелей. Ожидание дешевле отката карточки.
   */
  function appReady() {
    if (typeof document === "undefined") return { ok: false, why: "нет документа" };
    const state = String(document.readyState || "");
    if (state && state !== "complete" && state !== "interactive") {
      return { ok: false, why: `документ грузится (${state})` };
    }
    // Оболочка приложения: без неё на странице нечего читать и некуда писать.
    if (!document.querySelector('main, [data-agent-transcript-message], .editor-content, [role="textbox"]')) {
      return { ok: false, why: "оболочка приложения не отрисована" };
    }
    return { ok: true, why: "" };
  }

  /** Кнопка действительно готова: в документе, видима и не заблокирована. */
  async function clickReady(el, timeoutMs = C.clickReadyMs) {
    if (pressable(el)) return true;
    const found = await waitFor(() => (pressable(el) ? el : null), timeoutMs, 250);
    return Boolean(found);
  }

  /** Наша реплика: в транскрипте Arena она помечена отдельным layout. */
  const isUserNode = (n) => Boolean(n.querySelector('[data-user-message-layout="true"]'));

  /** Строка-результат: такая реплика — ответ, даже если цитирует задание. */
  const RESULT_LINE = /\bCF_(?:AGENT|COORDINATOR|REVIEW|ANSWER)_RESULT\b/;

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
        const result = parseMarker(m.raw, "CF_AGENT_RESULT") || parseMarker(m.raw, "CF_COORDINATOR_RESULT") || parseMarker(m.raw, "CF_REVIEW_RESULT");
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
   * Шаблонное значение (`<роль|done>`, `<путь>`, `<решение: …>`) — это наш же
   * пример из задания или напоминания, а не ответ агента. Такой «маркер» не
   * принимаем: иначе собственный промпт засчитывается как готовый ответ.
   *
   * Ловим пару скобок вокруг описания, а не знак «меньше» вообще. Прежнее
   * правило искало `[<>]` в любом месте строки и требовало, чтобы всё
   * значение было ASCII-путём: живой ответ «6<7, порог не достигнут»
   * (кириллица, пробелы) попадал в «шаблоны» и молча выбрасывался.
   * 28.10 18:19 приёмка трижды «ответила без маркера» именно из-за «6<7»:
   * маркер был, а разбор его отклонял — и в журнале это выглядело как
   * отсутствие маркера.
   */
  const placeholderShape = (value) => {
    const text = String(value || "").trim();
    if (!text) return false;
    // Всё значение в скобках — точно пример: «<путь>», «<решение>».
    if (/^<[^<>\n]{1,200}>$/.test(text)) return true;
    // Скобки внутри текста: шаблон узнаём по описанию внутри («<роль|done>»,
    // «<чего именно не хватает: роль, доступ>»), а `<div>`/`<b>` в коде — нет.
    const token = /<([^<>\n]{1,200})>/.exec(text);
    return Boolean(token && /[\s|:…]|[А-Яа-яЁё]/.test(token[1]));
  };

  function isPlaceholderMarker(obj) {
    return Object.values(obj || {}).some((v) => typeof v === "string" && placeholderShape(v));
  }

  /**
   * Почему последний разбор не сложился: по имени маркера храним причину и
   * начало отвергнутого JSON. Журналу это нужно, чтобы «маркер есть, но он
   * отвергнут как шаблон» не сливалось с «маркера нет» — разные беды и чинятся
   * по-разному.
   */
  const markerNotes = {};

  function parseMarker(text, name) {
    const src = String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n");
    let from = src.length;
    let rejected = "";
    while (from > 0) {
      const at = src.lastIndexOf(name, from - 1);
      if (at === -1) break;
      const raw = braceJson(src.slice(at + name.length));
      const obj = markerJson(raw);
      if (obj && !isPlaceholderMarker(obj)) {
        delete markerNotes[name];
        return obj;
      }
      if (obj && !rejected) rejected = raw.replace(/\s+/g, " ").trim().slice(0, 160);
      from = at;
    }
    if (rejected) markerNotes[name] = { reason: "placeholder", sample: rejected };
    else delete markerNotes[name];
    return null;
  }

  /** Пояснение к «маркера нет», если маркер был, но его отверг разбор. */
  const markerRejectHint = (name) => {
    const note = markerNotes[name];
    if (!note || note.reason !== "placeholder") return "";
    return (
      ` В ответе есть ${name}, но разбор счёл его шаблоном из задания` +
      `${note.sample ? ` (${note.sample})` : ""} — это дефект разбора, а не ответ агента.`
    );
  };

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
    // Формат маркера зависит от вида хода: их четыре, и путать их нельзя —
    // напоминание не должно просить у приёмки маркер исполнителя.
    let line;
    if (expect.kind === "answer") {
      line = `CF_ANSWER_RESULT {"question_id":"${expect.ref}","turn_id":"${expect.turnId || ""}","verdict":"answer","answer":"<решение>"}`;
    } else if (expect.kind === "plan") {
      line = `CF_COORDINATOR_RESULT {"mission_id":"${expect.missionId || expect.ref}","turn_id":"${expect.turnId || ""}","status":"completed","next":"<роль|done>"}`;
    } else if (expect.kind === "review") {
      line = `CF_REVIEW_RESULT {"mission_id":"${expect.missionId || expect.ref}","turn_id":"${expect.turnId || ""}","verdict":"accept|rework","remarks":"<пункты замечаний>"}`;
    } else if (role.fn === "Reviewer" && markerName === "CF_REVIEW_RESULT") {
      line = `CF_REVIEW_RESULT {"mission_id":"${expect.missionId || ""}","dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","verdict":"accept|rework|master","remarks":"<причина или замечания>"}`;
    } else if (role.fn === "Reviewer") {
      line = `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","pr":null}`;
    } else if (role.fn === "Auditor") {
      line = `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь к отчёту>"}`;
    } else {
      line = `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR|null>,"merged":true}`;
    }
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
      .filter((line) => !/^\s*CF_(AGENT|COORDINATOR|REVIEW|ANSWER)_RESULT\b/.test(line) && !/^### Часть \d+ из \d+/.test(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim().length;

  /**
   * Минимальное сообщение вместо отклонённого задания.
   *
   * 25.10 задание Architect (NAR-2.16) не принималось трижды: «Something went
   * wrong. Please try again.» — и на полном тексте (7 586 символов), и на
   * сокращённом техблоке (7 610 после переотправки). Дело не в длине и не в
   * разметке: Arena отклоняет сам текст задания. Поэтому повтор — это не
   * пересказ, а просьба прочитать задание самому: ссылка на карточку, номера
   * выдачи и формат маркера. Всё остальное агент берёт из карточки.
   */
  function minimalPrompt(expect) {
    const id = String(expect.ref || "");
    const url = expect.url || (id ? `https://app.notion.com/p/${id.replace(/-/g, "")}` : "");
    return [
      `Задание ${expect.title || id} (dispatch ${id}, run ${expect.runId || ""}).`,
      "Полный текст Arena не приняла ошибкой. Прочитай задание сам — оно в карточке:",
      url || `(карточка Notion ${id})`,
      "Поля карточки — Намерение, Инварианты, Оракул (Acceptance), Scope — и есть задание.",
      expect.roleFn === "Reviewer"
        ? "Проверь оракул и дай отчёт. Код, ветки и PR не меняй. Если карточка требует CF_REVIEW_RESULT, включи в него dispatch_id и run_id этой выдачи."
        : "Работай только в своей зоне, PR мержи сам (`gh pr merge --squash`), оракул не ослабляй.",
      "Последней строкой ответа — ровно один маркер сдачи карточки:",
      expect.roleFn === "Reviewer"
        ? `CF_AGENT_RESULT {"dispatch_id":"${id}","run_id":"${expect.runId || ""}","status":"submitted","pr":null}`
        : `CF_AGENT_RESULT {"dispatch_id":"${id}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR>,"merged":true}`,
      'Работа без PR — `"pr": null`.',
    ].join("\n");
  }

  /**
   * Задание, которое Arena съела ошибкой, возвращается в очередь минимальным
   * сообщением. Повтор один: второй отказ подряд — пауза, а не цикл.
   *
   * «Задание отправлено» в этом случае врёт: сообщение в транскрипте есть, ход у
   * агента не начался. Отметка доставки снимается, id «мёртвого» сообщения
   * запоминается (иначе `lastUserSays` примет старую копию за новую отправку).
   */
  function retryRejectedHandoff(expect, alert, why) {
    if (!expect || !expect.roleId) return false;
    if (!expect.sentAt) return false;
    if (Date.now() - Number(expect.sentAt || 0) > C.arenaRetryMs) return false;
    const done = Number(expect.arenaResend) || 0;
    if (done >= C.arenaResendMax) return false;
    const text = minimalPrompt(expect);
    GM_setValue(K.deadSend, (alert && alert.messageId) || "");
    GM_setValue(K.pending, {
      roleId: expect.roleId,
      roleName: expect.roleName,
      roleUrl: expect.roleUrl,
      text,
      at: Date.now(),
      sendTries: 0,
    });
    GM_setValue(K.expect, {
      ...expect,
      text,
      sentAt: null,
      verified: false,
      undelivered: true,
      cardRolled: false,
      arenaResend: done + 1,
      tries: 0,
      lastReplySig: "",
      lastReplyAt: 0,
    });
    log(
      `${why}: задание до «${expect.roleName || "агента"}» не принялось — повторяю минимальным сообщением ` +
        `«прочитай карточку сам» (${text.length} символов вместо ${String(expect.text || "").length}). ` +
        "Второй отказ подряд — пауза. Новый ход Координатора не нужен.",
      true,
      { ntfy: "quiet", title: "Narthex: повторяю задание" },
    );
    return true;
  }

  /**
   * Отказ из-за уже слитой ветки.
   *
   * 27.10 Архитектор получил новый прогон на ветке со статусом `pr_merged`
   * (PR #97 той же карточки) и ответил честно: «не могу выполнить прогон на
   * слитой ветке; нажмите Continue рядом со статусом PR». Это не ответ на
   * задание и не «агент молчит»: работа не начиналась, маркера не будет,
   * напоминания бесполезны — они уйдут в ту же мёртвую ветку.
   *
   * Признак требует сразу четырёх вещей: отказ, слово о ветке, слово о мерже
   * и подсказку про Continue. Обычный отчёт («PR #97 слит, ветка …») без
   * отказа под него не попадает — и он всё равно приходит с маркером.
   */
  function staleBranchRefusal(raw) {
    const text = String(raw || "");
    if (!text) return false;
    const refusal = /не могу|не получается|невозможно|cannot|can'?t|unable/i;
    // Границы слова `\b` в JavaScript считаются по ASCII, поэтому на кириллице
    // они не срабатывают: «ветка» — это не слово для регулярки. Берём основу.
    const branch = /pr_merged|\bbranch\b|ветк[а-яё]/iu;
    const merged = /слит|merged|pr_merged/i;
    const hint = /continue|продолж/i;
    return refusal.test(text) && branch.test(text) && merged.test(text) && hint.test(text);
  }

  /**
   * Повторить выдачу в чистую ветку, если агент отказался из-за `pr_merged`.
   *
   * Карточка остаётся Running с тем же Run ID: работа по ней не начиналась,
   * новый ход Координатора не нужен, откат в Ready только запутал бы очередь.
   * Повтор один: второй такой отказ — пауза с точной причиной, а не цикл.
   */
  function retryStaleBranchHandoff(expect) {
    if (!expect || !expect.roleId || !expect.sentAt) return false;
    const done = Number(expect.branchResend) || 0;
    if (done >= 1) return false;
    // Наша реплика с заданием — последняя в чате. Без этой отметки `deliver`
    // увидит её и решит, что сообщение уже отправлено, — повтор молча не уйдёт.
    const mine = messages().filter(isUserNode).at(-1);
    GM_setValue(K.deadSend, mine ? nodeId(mine) : "");
    GM_setValue(K.pending, {
      roleId: expect.roleId,
      roleName: expect.roleName,
      roleUrl: expect.roleUrl,
      text: expect.text,
      at: Date.now(),
      sendTries: 0,
    });
    GM_setValue(K.expect, {
      ...expect,
      sentAt: null,
      verified: false,
      branchResend: done + 1,
      tries: 0,
      lastReplySig: "",
      lastReplyAt: 0,
    });
    log(
      `${expect.roleName || "Агент"} отказался начинать ход: его ветка уже слита (pr_merged). ` +
        "Это не ответ на задание — работы не было. Нажимаю Continue и отправляю задание заново, " +
        "в чистую ветку.",
      true,
      { ntfy: "quiet", title: "Narthex: ветка слита, повторяю выдачу" },
    );
    return true;
  }

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
    // Страница ещё не отрисована — «маркера нет» говорить нельзя: его просто
    // не видно. То же правило, что в сторожe тишины, распространено на ручной
    // «Шаг»: пустая страница — не пустой чат.
    const page = pageReady(expect);
    if (!page.ok) {
      if (manual) {
        log(
          `Страница «${role.name}» ещё не отрисовалась (${page.why}) — подождите: ` +
            "читаю ответ из чата, а не из пустой страницы.",
        );
      }
      return false;
    }

    const replies = messagesAfter(expect.watermark || "");
    const last = replies.at(-1);
    if (!last) {
      // Ошибка Arena поверх нашего задания: сообщение в чате есть, а ход не
      // начался. От «агент думает» это отличается только самой ошибкой, поэтому
      // проверка стоит здесь. Первая переотправка — автоматическая (Мастер уже
      // нажал «Продолжить»); вторая подряд — пауза с честной причиной.
      const eaten = latestUserMessageAlert();
      if (eaten && expect.sentAt) {
        if (retryRejectedHandoff(expect, eaten, `Arena ответила «${eaten.text}»`)) {
          // Отправляем прямо здесь, а не «следующим тиком»: шаг уже выполняется,
          // и отложенный тик был бы молча проглочен сторожем блокировки.
          const again = await consumePending(true);
          if (!again) {
            log("Переотправка на этой странице не началась — задание осталось в очереди и уйдёт на следующем шаге.", true, {
              ntfy: "quiet",
            });
          }
          return true;
        }
        const isReloadable = /something went wrong|please try again/i.test(eaten.text || "");
        if (isReloadable) {
          const reloadKey = `${C.reloadCountPrefix}${expect.dispatchId || expect.ref || "unknown"}`;
          const count = Number(await GM_getValue(reloadKey, 0)) || 0;
          if (count < C.maxReloadAttempts) {
            await GM_setValue(reloadKey, count + 1);
            log(
              `Ошибка Arena «${eaten.text}»: перезагрузка страницы (попытка ${count + 1} из ${C.maxReloadAttempts}) и повтор отправки.`,
              true,
              { ntfy: "quiet" },
            );
            location.reload();
            return true;
          }
          await pause(
            `Ошибка Arena «${eaten.text}» повторился ${C.maxReloadAttempts} раз. Страница не восстанавливается автоматически; требуется Мастер.`,
            { kind: "arena-error", ref: eaten.messageId },
          );
          return true;
        }
        pause(
          `Arena снова не приняла задание: «${eaten.text}» (коротких повторов подряд: ${C.arenaResendMax}). ` +
            "Задание осталось в очереди — нажмите «Продолжить», оно уйдёт этой же карточке, " +
            "без нового хода Координатора.",
          { kind: "arena-error", ref: eaten.messageId },
        );
        return true;
      }
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
    // Маркер мог быть и отвергнутым: «нет маркера» и «есть, но разбор его
    // выбросил» — разные поломки, и журнал обязан их различать.
    const reject = markerRejectHint(markerName);
    if (markerStep(sent) === "remind") {
      log(
        why === "thin"
          ? `${role.name} прислал только маркер ${markerName}, без отчёта — напоминание ${sent + 1} из ${C.markerReminders}.`
          : `${role.name} ответил без маркера ${markerName} — напоминание ${sent + 1} из ${C.markerReminders}. ` +
              `Прочитан хвост: «${tail(last.text, 110)}»${reject}`,
        true,
        { ntfy: "quiet", title: why === "thin" ? "Narthex: маркер без отчёта" : "Narthex: нет маркера" },
      );
      await sendToRole(role, markerReminder(role, expect, sent + 1, markerName, why), expect.kind, expect.ref, {
        missionId: expect.missionId,
        turnId: expect.turnId,
        runId: expect.runId,
        logId: expect.logId,
        title: expect.title,
        url: expect.url,
        tries: sent + 1,
      });
      return true;
    }

    pause(
      why === "thin"
        ? `${role.name} присылает только маркер ${markerName}, без отчёта, после ${C.markerReminders} напоминаний. ` +
            "Нужен Мастер: проверьте страницу агента."
        : `${role.name} ответил без маркера ${markerName} после ${C.markerReminders} напоминаний. ` +
            `Нужен Мастер: проверьте страницу агента.${reject}`,
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
      // Ошибка поверх нашего же задания — это не «агент сломался», а «сообщение
      // не приняли». Ход не снимаем и Мастера не зовём: в очередь кладётся
      // короткая версия, её отправит ближайший тик. Пауза — только когда
      // короткие повторы уже исчерпаны.
      const expect = GM_getValue(K.expect, null);
      if (retryRejectedHandoff(expect, alert, `Arena ответила «${alert.text || "ошибка без текста"}»`)) {
        return true;
      }
      const tried = Number(expect?.arenaResend) || 0;
      if (tried > 0) {
        // Минимальное сообщение тоже не прошло: второй отказ подряд — стоп.
        pause(
          `Arena второй раз не приняла задание «${expect?.title || expect?.ref || "агента"}»: ` +
            `«${alert.text || "ошибка без текста"}». Минимальное сообщение тоже отклонено — ` +
            "цикл остановлен. Задание в очереди, карточка Running: посмотрите страницу агента.",
          { kind: "arena-error", ref: alert.messageId, runId: expect?.runId || "" },
        );
        return true;
      }
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
   * Очистить поле ввода.
   *
   * 25.10 Arena вернула отклонённый текст задания обратно в поле: сообщение «не
   * ушло», а черновик остался. Если этого не заметить, следующая вставка
   * склеится со старым текстом, и вместо минимального сообщения уйдёт тот же
   * отклонённый промпт — ошибка повторится.
   */
  function clearComposer(editor) {
    const live = composerAlive(editor) ? editor : composer();
    if (!live) return false;
    if (!composerText(live)) return true;
    live.focus();
    try {
      if (live.tagName === "TEXTAREA" || live.tagName === "INPUT") {
        const proto = live.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(live, "");
        else live.value = "";
        live.dispatchEvent(new Event("input", { bubbles: true }));
        return !composerText(live);
      }
      const range = document.createRange();
      range.selectNodeContents(live);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("delete");
    } catch (e) {
      dbg("composer: очистка не удалась", String(e?.message || e));
    }
    // Запасной путь — как у вставки: иначе ProseMirror оставит свой старый узел.
    if (composerText(live) && composerAlive(live)) {
      live.textContent = "";
      live.dispatchEvent(new InputEvent("input", { bubbles: true, data: "", inputType: "deleteContentBackward" }));
    }
    return !composerText(live);
  }

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
    // Раскрывашки (`aria-expanded`) — не закрытие: клик по ним сворачивает
    // панель, а не убирает её, и снаружи это выглядит как «плашка вернулась».
    const buttons = [...panel.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-expanded") === null,
    );
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

  /**
   * Убрать все панели завершения, а не одну.
   *
   * 24.10 в 20:15 шаг встал на «поле ввода пропало»: плашка «Эта задача была
   * выполнена успешно?» закрылась и тут же появилась снова. Клик был не при
   * чём — на странице две панели (одна в переписке, вторая липкая снизу), и
   * закрытие верхней просто показывало нижнюю. Поэтому закрываем все видимые
   * подряд, пока они не кончатся, и только потом ищем поле ввода.
   */
  async function closeCompletionPanels(max = 4) {
    let closed = 0;
    for (let pass = 0; pass < max; pass += 1) {
      const captcha = captchaDialog();
      const panels = completionPanels().filter(
        (panel) =>
          // Контейнер с целым чатом панелью не считается, окно проверки не наше.
          !panel.querySelector('[data-agent-transcript-message="true"]') &&
          !(captcha && (panel === captcha || panel.contains(captcha))),
      );
      if (!panels.length) break;
      let clicked = 0;
      for (const panel of panels) {
        const close = closeButtonIn(panel);
        if (close && visible(close)) {
          close.click();
          clicked += 1;
        }
      }
      if (!clicked) break;
      closed += clicked;
      // Пауза между проходами: вторая панель появляется после перерисовки.
      await sleep(350);
    }
    return closed;
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
    return text.replace(/\s+/g, " ").trim();
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
          String(b.innerText || b.textContent || "").replace(/\s+/g, " ").trim(),
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

  // Снимок опроса сохраняется до Submit/Skip: после клика карточка может
  // исчезнуть, а сеть или сама вкладка — оборваться. Очередь живёт отдельно от
  // очереди ответов Notion и не зависит от текущей миссии или режима цикла.
  const POLL_JOURNAL_QUEUE = "cfn-poll-journal-queue";
  const POLL_JOURNAL_CAPTURE_MS = 300000; // после аварии незавершённый снимок тоже можно дописать

  /** Маркер совместим с обоими шлюзами: append разрешён только для CF_DISPATCH. */
  function pollLogEntry(role, questions, reply, expect = null, outcomes = [], at = nowIso(), attempt = 1) {
    const safePart = (value) => String(value || "unknown").replace(/[^a-z0-9_-]/gi, "_").slice(0, 120);
    const hash = textHash(JSON.stringify(questions.map((q) => [q.id, q.question, q.options])));
    const marker = `<!-- CF_DISPATCH ${safePart(expect?.ref)}:${safePart(expect?.runId || expect?.turnId)}:poll:${hash}:${attempt} -->`;
    return [
      marker,
      `## Вопрос агента вместо работы (${(role && role.name) || "агент"})`,
      "",
      `- когда: ${at}`,
      `- универсальный вариант ответа: «${reply}»`,
      "- ответ человека не запрашивался; результат каждой попытки указан ниже",
      "",
      ...questions.flatMap((q, i) => [
        `### Вопрос ${i + 1}`,
        q.question || "(без текста)",
        "",
        ...(q.options.length ? q.options.map((o) => `- ${o}`) : ["- вариантов не было"]),
        `- результат при обработке: ${outcomes[i] || "не подтверждён"}`,
        "",
      ]),
    ].join("\n");
  }

  const pollJournalQueue = () => {
    const saved = GM_getValue(POLL_JOURNAL_QUEUE, []);
    return Array.isArray(saved) ? saved : [];
  };
  const samePollRecord = (a, b) => a && b && a.fileId === b.fileId && a.marker === b.marker;

  /** Сохраняем снимок до клика; старый не перезаписываем при новом проходе. */
  function queuePollJournal(record) {
    const list = pollJournalQueue();
    if (list.some((item) => samePollRecord(item, record))) return false;
    GM_setValue(POLL_JOURNAL_QUEUE, [...list, record]);
    return true;
  }

  /** После обработки можно записать фактический исход, не выдумывая успех. */
  function finishPollJournal(record, entry) {
    const list = pollJournalQueue();
    const index = list.findIndex((item) => samePollRecord(item, record));
    if (index < 0) return;
    list[index] = { ...list[index], entry: `\n\n${entry}\n`, readyAt: 0 };
    GM_setValue(POLL_JOURNAL_QUEUE, list);
  }

  let pollJournalBusy = false;
  /**
   * Отдельный повтор записи, никогда не повторяет Submit. Даже если шлюз уже
   * записал файл, но ответ потерялся, его маркер превращает повтор в duplicate.
   * Читаем очередь заново после каждого await, чтобы не затереть новые записи.
   */
  async function flushPollJournal() {
    if (pollJournalBusy) return;
    pollJournalBusy = true;
    try {
      const due = pollJournalQueue().filter((item) =>
        item && item.fileId && item.marker && item.entry &&
        Date.now() >= Number(item.readyAt || 0) && Date.now() >= Number(item.nextAt || 0),
      ).slice(0, 10);
      for (const item of due) {
        try {
          const result = await gateway("append", item.fileId, { marker: item.marker, entry: item.entry });
          if (!result || result.ok !== true) throw new Error("шлюз не подтвердил запись");
          GM_setValue(POLL_JOURNAL_QUEUE, pollJournalQueue().filter((row) => !samePollRecord(row, item)));
          const duplicate = result.duplicate || result.result === "duplicate";
          log(
            `${item.roleName}: вопрос и варианты ${duplicate ? "уже были" : "записаны"} в журнале попытки.`,
            false,
            { ntfy: false },
          );
        } catch (e) {
          const list = pollJournalQueue();
          const index = list.findIndex((row) => samePollRecord(row, item));
          if (index < 0) continue;
          const attempts = (Number(list[index].attempts) || 0) + 1;
          const wait = Math.min(300000, 15000 * 2 ** Math.min(attempts - 1, 5));
          list[index] = { ...list[index], attempts, nextAt: Date.now() + wait };
          GM_setValue(POLL_JOURNAL_QUEUE, list);
          if (attempts === 1) {
            log(
              `Вопрос агента не записался в журнал попытки: ${(e && e.message) || e}. ` +
                "Снимок сохранён в ScriptCat, запись повторится без повторного ответа агенту.",
              true,
              { ntfy: "quiet", title: "Narthex: запись опроса отложена" },
            );
          }
        }
      }
    } finally {
      pollJournalBusy = false;
    }
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
    // Последняя реплика агента может быть старой, даже если ниже уже стоит
    // наше новое задание. Не отвечаем ей заново и не пишем в чужую попытку.
    const messageId = found[0].id;
    if (expect && messageId &&
        (messageId === expect.watermark || (Array.isArray(expect.seen) && expect.seen.includes(messageId)))) return null;
    const who = (role && role.name) || (expect && expect.roleName) || "агент";
    // Ключ — ход агента: повторный тик не отвечает на тот же вопрос дважды.
    // Метки 1.4.45 сюда не читаются: они ставились без проверки, что Submit
    // сработал, и на живом опросе Kernel заблокировали бы повтор.
    const key = `cfn-poll2:${(expect && (expect.runId || expect.turnId || expect.ref)) || location.pathname}`;
    const handled = new Set(GM_getValue(key, []));
    const pending = found.filter((q) => !handled.has(`${q.id}:${q.question}`));
    if (!pending.length) return "waiting";

    pollBusy = true;
    const all = pending.map(({ id, question, options }) => ({ id, question, options }));
    const outcomes = all.map(() => "не подтверждён");
    const at = nowIso();
    let journal = null;
    let journalAttempt = 1;
    try {
      const logId = expect && expect.logId;
      if (logId) {
        // Новая попытка ответить на тот же вопрос — отдельное событие с новым
        // исходом. Сетевые повторы этого события используют сохранённый маркер.
        const attemptKey = `${key}:journal-attempt`;
        journalAttempt = (Number(GM_getValue(attemptKey, 0)) || 0) + 1;
        GM_setValue(attemptKey, journalAttempt);
        const entry = pollLogEntry({ name: who }, all, POLL_REPLY, expect, outcomes, at, journalAttempt);
        journal = {
          fileId: logId,
          marker: entry.split("\n")[0],
          entry: `\n\n${entry}\n`,
          roleName: who,
          readyAt: Date.now() + POLL_JOURNAL_CAPTURE_MS,
          attempts: 0,
          nextAt: 0,
        };
        queuePollJournal(journal);
      } else {
        // Без привязки к достоверному ходу нельзя угадывать чужой Drive-файл.
        // Сохраняем то, что удалось прочитать, в панели для ручного переноса.
        log("Вопрос агента не записан в журнал попытки: нет ID журнала для этого хода. Вопрос и варианты ниже — для ручного переноса.", true, { ntfy: "quiet" });
        for (const q of all) {
          log(`Для ручного переноса: ${q.question || "(без текста)"} — варианты: ${q.options.join("; ") || "нет"}.`, false, { ntfy: false });
        }
      }
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
      for (const [index, first] of pending.entries()) {
        // После Submit карточка перерисовывается: узлы вопроса уже отвязаны.
        // Поэтому перед каждым ответом берём живые узлы заново.
        const live = () => pollQuestions().find((x) => x.question === first.question) || null;
        const q = live();
        // Вопрос пропал — его уже закрыли, это не наша забота. Вопрос есть, а
        // свободного поля нет — ответить некуда, и это уже потеря.
        if (!q) {
          outcomes[index] = "карточка исчезла до подтверждения ответа";
          continue;
        }
        if (!q.input) {
          outcomes[index] = "нет поля для ответа";
          failed.push({ first, index });
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
          // После Submit Arena может сразу перезагрузить вкладку: не ждём конца
          // остальных вопросов, чтобы не ответить на этот второй раз.
          GM_setValue(key, [...handled].slice(-25));
          answered += 1;
          outcomes[index] = "универсальный ответ отправлен";
        } else {
          outcomes[index] = "отправка ответа не подтверждена";
          failed.push({ first, index });
        }
        await sleep(300);
      }
      if (!answered && failed.length) {
        // Ни один ответ не ушёл. Опрос нельзя оставить висеть: он держит ход.
        // Skip закрывает сразу весь опросник, поэтому идём на него только
        // здесь — вопросы уже перечислены в журнале — и говорим, что теряем.
        const remaining = () => pollQuestions().filter((q) =>
          failed.some(({ first }) => first.id === q.id && first.question === q.question),
        );
        const skip = remaining().find((q) => q.skip && q.skip.disabled !== true && q.skip.isConnected !== false)?.skip;
        if (skip) {
          skip.click();
          const closed = await pollWait(() => (remaining().length ? null : true), 2500);
          for (const { first, index } of failed) {
            if (closed) handled.add(`${first.id}:${first.question}`);
            outcomes[index] = closed ? "нажат Skip, ответ не отправлен" : "Skip нажат, закрытие не подтверждено";
          }
          log(
            closed
              ? `${who}: ответ на вопрос не отправился — Skip закрыл опрос.`
              : `${who}: Skip нажат, но опрос не исчез. Закрытие не подтверждено; проверьте чат.`,
            true,
            { tone: "warn", ntfy: closed ? "quiet" : "loud", title: closed ? "Narthex: опрос закрыт кнопкой Skip" : "Narthex: опрос держит ход" },
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
          `Ответил ${who} на опрос: «${firstLine(POLL_REPLY, 90)}» (вопросов ${answered}).`,
          false,
          { tone: "warn" },
        );
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
      try {
        if (journal) {
          finishPollJournal(journal, pollLogEntry({ name: who }, all, POLL_REPLY, expect, outcomes, at, journalAttempt));
        }
      } finally {
        pollBusy = false;
      }
      if (journal) await flushPollJournal();
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

      // Панелей завершения может быть больше одной: закрытая верхняя
      // открывает нижнюю — снаружи это выглядит как «плашка вернулась».
      if (closed < 6 && completionPanels().length) {
        const n = await closeCompletionPanels();
        if (n) {
          closed += n;
          dbg("editor: поля ввода нет — убрал панели и жду", { closed });
          await sleep(600);
          continue;
        }
      }
      // Поле не находится, а в чате висит вопрос агента: отвечаем на него, а не
      // жмём Skip. K.expect здесь относится к ещё не отправленному заданию;
      // привязать старый опрос к его журналу было бы записью в чужую попытку.
      // Без достоверного ID answerPolls прямо предупредит и выведет снимок.
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
    let droppedOwn = 0;
    let droppedService = 0;
    // `textarea` в перечне не было, а зря: 25.10 в 14:57 диагностика
    // показывала «contenteditable 0, textarea 1», и по ней нельзя было
    // понять, чьё это поле — сайдбара, капчи или нашей же панели.
    for (const el of document.querySelectorAll(
      "textarea:not([readonly]), [contenteditable]:not([contenteditable='false']), .ProseMirror, [role='textbox']",
    )) {
      if (el.tagName === "INPUT") continue;
      if (isServiceField(el)) droppedService += 1;
      else if (inOwnPanel(el)) droppedOwn += 1;
      else if (inSidebar(el)) droppedSidebar += 1;
      else if (!visible(el)) droppedHidden += 1;
    }
    const parts = [
      `contenteditable ${count("[contenteditable]")}`,
      `textarea ${count("textarea")}`,
      `textbox ${count("[role='textbox']")}`,
      droppedSidebar ? `в сайдбаре ${droppedSidebar}` : "",
      droppedHidden ? `скрытых ${droppedHidden}` : "",
      droppedOwn ? `в своей панели ${droppedOwn}` : "",
      droppedService ? `служебных ${droppedService}` : "",
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
   * Поле и кнопка отправки готовы принять клик.
   *
   * `sendButton()` уже отбрасывает `disabled`, поэтому «кнопки нет» и «кнопка
   * есть, но заблокирована» здесь — одно состояние: страница ещё не готова.
   */
  function sendReady(editor) {
    const live = editor && composerAlive(editor) ? editor : composer();
    if (!live) return { ok: false, why: "поле ввода не найдено" };
    const state = String(document.readyState || "");
    if (state && state !== "complete" && state !== "interactive") {
      return { ok: false, why: `страница грузится (${state})`, editor: live };
    }
    const btn = sendButton(live);
    if (!btn) return { ok: false, why: "кнопка Send ещё неактивна", editor: live };
    return { ok: true, btn, editor: live };
  }

  /**
   * Ждём активную кнопку Send, не снимая задание.
   *
   * 17:30:24 (25.10): два фиксированных ожидания по 1,5 и 3 с закончились
   * раньше, чем страница дорисовала транскрипт, и отказ ушёл в паузу с
   * откатом карточки. Ждать надо столько, сколько рисуется страница, а текст
   * в поле — возвращать, если его стёрла перерисовка.
   */
  async function waitSendReady(editor, text, timeoutMs = C.sendReadyMs) {
    const started = Date.now();
    // Пустая настройка не должна превращать ожидание в NaN: без числа
    // deadline был бы NaN, и кнопка считалась бы недоступной мгновенно.
    const deadline = started + (Number(timeoutMs) || 20000);
    let lastPrompt = 0;
    let told = false;
    while (Date.now() < deadline) {
      const probe = sendReady(editor);
      if (probe.ok) return probe.btn;
      if (probe.editor && Date.now() - lastPrompt > 1500) {
        lastPrompt = Date.now();
        writePrompt(probe.editor, text);
      }
      if (!told && Date.now() - started > 3000) {
        told = true;
        log("Страница дорисовывается: кнопка Send ещё неактивна — жду. Задание остаётся в очереди.");
      }
      await sleep(300);
    }
    return null;
  }

  /**
   * Отличительная строка задания: по ней видно, что в чат ушло именно это
   * сообщение, а не предыдущее. Первые строки промпта у всех заданий
   * одинаковые (технический блок), поэтому ключ берётся из строки с
   * `dispatch <id>` и `run <id>`.
   *
   * Ключ обязан быть своим у каждой ВЫДАЧИ, а не у карточки. 28.10 карточку
   * NAR-5.3 выдали второй раз («проверка ответа не прошла, выдаю заново»);
   * строка задания у обеих выдач начинается одинаково, а прежний ключ —
   * первые 90 знаков этой строки — обрезался раньше номера выдачи. Прошлое
   * сообщение с тем же ключом лежало в чате, проверка «моё сообщение уже в
   * чате» подтвердила отправку, которой не было (19:38:49: текст остался в
   * поле ввода). Поэтому в ключ идут оба номера: `dispatch` — карточка,
   * `run` — выдача; выдача у повторной отправки новая.
   */
  function sendKey(text) {
    const src = String(text || "");
    const lines = src.split("\n");
    const task = lines.find((l) => /Задача .*\(dispatch /.test(l));
    if (task) {
      const ids = task.match(/\(dispatch\s+([^,)]+)(?:,\s*run\s*([^)]*))?\)/i);
      if (ids) {
        const dispatch = String(ids[1] || "").trim();
        const run = String(ids[2] || "").trim();
        if (dispatch) return flat(`dispatch ${dispatch}${run ? `, run ${run}` : ""}`);
      }
      return flat(task).slice(0, 90);
    }
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
    if (!last) return false;
    // Сообщение, которое Arena съела ошибкой, осталось в транскрипте — но
    // агенту оно не ушло. Принять его за новую отправку значило бы снова
    // поверить в доставку, которой нет (25.10, 21:24).
    const dead = GM_getValue(K.deadSend, "");
    if (dead && nodeId(last) === dead) return false;
    return flat(last.textContent || "").includes(key);
  }

  /** id «своих» реплик в транскрипте — снимок до отправки. */
  function userNodeIds() {
    return userMessages()
      .map((node) => String(node.id || "").replace("chat-message-", ""))
      .filter(Boolean);
  }

  /**
   * Своё сообщение, которого до попытки отправки не было.
   *
   * `lastUserSays` отвечает на вопрос «в чате есть реплика с этой строкой», и
   * для доставки этого мало: ключ повторной выдачи совпадает с прошлой, а
   * прошлая реплика из транскрипта никуда не девается. 28.10 в 19:38 именно
   * так и вышло — проверка нашла СТАРОЕ сообщение, вернула «отправлено» через
   * секунду после вставки, текст остался в поле ввода, и цикл ждал ответа на
   * задание, которого агент не получал.
   *
   * Поэтому доставкой считается только реплика с id, которого нет в снимке
   * `known` (снимок снимается перед кликом). Две страховки:
   *  • сообщение, которое Arena съела ошибкой (`K.deadSend`), не в счёт;
   *  • реплика с явно старым id-временем не в счёт — так выглядит старый
   *    транскрипт, который доехал уже после снимка.
   */
  function userSaysSince(key, known, since = 0) {
    if (!key) return null;
    const seen = known instanceof Set ? known : new Set(known || []);
    const dead = GM_getValue(K.deadSend, "");
    const list = userMessages();
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const node = list[i];
      const id = String(node.id || "").replace("chat-message-", "");
      if (!id || seen.has(id)) continue;
      if (dead && id === dead) continue;
      if (!flat(node.textContent || "").includes(key)) continue;
      // `idTime` — подсказка, а не истина: если генератор id не UUIDv7,
      // проверка просто не срабатывает. Допуск две минуты — время от вставки
      // текста до отрисовки сообщения бывает и таким.
      const at = idTime(id);
      if (since && at && at < since - 120000) continue;
      return { id, at };
    }
    return null;
  }

  /**
   * Ждём подтверждение доставки: новое своё сообщение в чате, а не «поле
   * опустело».
   *
   * Подтверждением не считаются ни выросший счётчик сообщений, ни пустое поле
   * при работающем агенте (1.4.82: 28.10, 19:08), ни реплика, лежавшая в чате
   * до попытки (1.4.84: 19:38 — повторная выдача той же карточки дала тот же
   * ключ, и старая реплика сошла за новую).
   *
   * Возвращает `{ id }` — id сообщения, которым подтверждена отправка: по нему
   * видно в журнале, что именно ушло. Пустая строка — доставка не доказана.
   */
  async function waitSent(key, known, timeoutMs, text = "", since = 0) {
    // Ожидание не должно стать бесконечным из-за пустой настройки: без числа
    // deadline был бы NaN, и опрос шёл бы вечно.
    const deadline = Date.now() + (Number(timeoutMs) || 6000);
    for (;;) {
      // Капча важнее любого признака: Arena успевает показать нашу реплику до
      // проверки, а до агента она не доходит. Признак «отправлено» в это
      // время — ложь, из-за которой 11:56:47 задание считалось ушедшим.
      if (captchaDialog()) return "";
      // Текст в поле ввода — veto: пока он там, отправки не было, какую бы
      // реплику ни нашлось в транскрипте.
      if (!composerHolds(key, text)) {
        const sent = userSaysSince(key, known, since);
        if (sent) return sent;
      }
      if (Date.now() >= deadline) return "";
      await sleep(300);
    }
  }

  /**
   * Текст задания всё ещё в поле ввода?
   *
   * Это второй признак доставки, и он нужен именно вместе с первым. 28.10 в
   * 19:08 скрипт написал «Задание отправлено (7829 символов)», а текст остался
   * в поле: клик по Send ушёл в перерисованное поле, сообщение не появилось, а
   * ожидание подтвердилось счётчиком сообщений (страница в этот момент
   * догружала транскрипт). Пока наш текст лежит в поле, отправки не было —
   * каким бы ни был счётчик.
   */
  function composerHolds(key, text) {
    const live = composer();
    if (!live) return false;
    const body = flat(composerText(live));
    if (!body) return false;
    const probe = flat(key || "").trim() || flat(text || "").slice(0, 60);
    if (!probe) return false;
    return body.includes(probe);
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
    // Ключ доставки — отличительная строка задания. Если её нет (короткий
    // промпт без маркера), берём начало текста: без ключа подтвердить отправку
    // нечем, и «сообщение ушло» пришлось бы брать на веру.
    const key = sendKey(text) || flat(text).slice(0, 60);
    // Снимок «своих» реплик и время начала попытки. Доставка — это сообщение,
    // которого в снимке нет: старая реплика с тем же текстом (повторная выдача
    // той же карточки) доставкой не считается.
    const known = userNodeIds();
    const since = Date.now();
    let live = composerAlive(editor) ? editor : composer();
    dbg("Send: начало", () => ({
      messages: before,
      own: known.length,
      button: debugSendButton(live),
      textLength: composerText(live).length,
    }));

    const why = [];
    let clicked = 0;
    /**
     * Доставка доказана новым сообщением. Если поле при этом ещё держит текст,
     * второй раз не кликаем: Arena не всегда очищает поле сразу, а повторный
     * клик отправил бы то же задание дважды. Пишем об этом в журнал — пусть
     * Мастер видит, что поле осталось неубранным.
     */
    const accepted = (found) => {
      const holds = composerHolds(key, text);
      if (holds) {
        dbg("Send: новое сообщение есть, а текст ещё в поле", { id: found.id });
        log(
          `В чате появилось новое сообщение (${found.id}), но текст остался в поле ввода — повторно не отправляю, ` +
            "поле можно очистить вручную.",
          false,
          { ntfy: false, tone: "warn" },
        );
      }
      return { ok: true, via: "message", msgId: found.id, draftLeft: holds };
    };
    const blocked = () => ({
      ok: false,
      captcha: true,
      reason: "Появилась капча (Security Verification) — сообщение не ушло",
      detail: clicked ? `клик ${clicked}: вместо отправки окно проверки` : "окно проверки до клика",
    });
    if (captchaDialog()) return blocked();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      // Сообщение могло уйти с прошлой попытки — проверяем до нового клика.
      // Только новое сообщение: старая реплика с тем же ключом подтверждала
      // отправку, которой не было (28.10, 19:38).
      if (captchaDialog()) return blocked();
      const already = userSaysSince(key, known, since);
      if (already) {
        dbg("Send: сообщение уже в чате до клика", { id: already.id, attempt });
        return accepted(already);
      }

      // Узел редактора мог смениться при перерисовке чата: тогда и вставка,
      // и клик уходят в копию, которой уже нет в документе.
      if (!composerAlive(live)) {
        live = composer();
        if (!live) {
          // Плашка «задача выполнена» закрывает поле ввода и могла всплыть
          // между вставкой и кликом (24.10, 20:15). Убираем панели — но ждём
          // поле ВСЕГДА, даже если панелей не нашлось.
          //
          // 25.10 в 14:57 было иначе: панель на месте, кнопки закрытия в ней
          // нет, `closeCompletionPanels()` вернул 0 — и ожидание пропускалось.
          // Скрипт сдался через три секунды после вставки, хотя страница ещё
          // дорисовывала транскрипт (сообщений 0 → 15, contenteditable 0),
          // вернул карточку в Ready и встал на паузу. Работы по карточке не
          // было — виновата не отправка, а нетерпение.
          const panels = await closeCompletionPanels();
          if (panels) {
            log(`Поле ввода пропало посреди отправки: убрал панелей ${panels}.`);
            why.push(`поле ввода пропало — убрал панелей ${panels}`);
          }
          live = await waitFor(composer, C.composerGraceMs, 300);
          if (live) {
            dbg("Send: поле вернулось после перерисовки", { attempt, panels });
            writePrompt(live, text);
          }
        }
        dbg("Send: редактор перечитан", { found: Boolean(live), attempt });
        if (!live) {
          why.push("поле ввода пропало");
          break;
        }
      }

      // Ждём столько, сколько рисуется страница: кнопка Send появляется
      // активной только после того, как редактор зарегистрировал ввод.
      // Два коротких ожидания (1,5 и 3 с) кончались раньше, чем Arena
      // успевала смонтировать транскрипт.
      let btn = await waitSendReady(live, text);
      if (!btn) {
        why.push(
          `активной кнопки Send нет за ${Math.round((Number(C.sendReadyMs) || 20000) / 1000)} с (${composerDiagnostics()})`,
        );
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
      const meanwhile = userSaysSince(key, known, since);
      if (meanwhile) {
        dbg("Send: сообщение появилось до клика", { id: meanwhile.id, attempt });
        return accepted(meanwhile);
      }
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

      let via = await waitSent(key, known, C.sendVerifyMs, text, since);
      if (!via && attempt === 3) {
        // Последняя попытка: если клик не дошёл, отправляем с клавиатуры.
        dbg("Send: клик не дал сообщения — пробую Enter");
        pressEnter(live);
        via = await waitSent(key, known, C.sendVerifyMs, text, since);
      }
      if (via) {
        // Клик прошёл, но поверх чата висит проверка: сообщение могло не
        // дойти, даже если отрисовалось. Считаем отправку неудачной — ход
        // повторится после того, как человек решит капчу.
        if (captchaDialog()) return blocked();
        // Проверка не разовая: окно проверки всплывает через несколько секунд.
        if (await captchaGuard()) return blocked();
        // Последняя проверка перед словом «отправлено»: текст задания не
        // должен остаться в поле ввода. 19:08 он там остался, а журнал сказал,
        // что задание ушло (7829 символов) — и цикл ждал ответа впустую.
        //
        // Но новое сообщение — сильнее поля: если в чате появилась реплика,
        // которой до попытки не было, отправка состоялась, а текст в поле —
        // черновик, который Arena не убрала. Повторный клик отправил бы то же
        // задание второй раз, поэтому здесь мысль не «нажмём ещё», а «скажем
        // об этом в журнале».
        if (composerHolds(key, text)) {
          const fresh = userSaysSince(key, known, since);
          if (fresh && fresh.id === via.id) return accepted(fresh);
          why.push(`клик ${attempt}: текст остался в поле ввода`);
          dbg("Send: текст в поле после клика — отправки не было", { attempt });
          await sleep(500);
          continue;
        }
        dbg("Send: сообщение в чате", { via, attempt });
        return { ok: true, via: "message", msgId: via.id || "" };
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
      `панелей ${completionPanels().length}`,
      ...(dialog ? ["поверх чата открыт диалог Arena"] : []),
      ...why,
    ].join(", ");
    const report = domReport();
    GM_setValue("cfn-send-debug", { at: Date.now(), detail, key, text: String(text).slice(0, 300), report });
    console.warn("[Narthex] снимок разметки при отказе отправки:", report);
    return {
      ok: false,
      // Ни одного клика и поля ввода нет — это не отказ доставки, а
      // недорисованная страница. Задание осталось в очереди, ход не начат:
      // откат карточки и пауза тут дороже, чем ещё один тик ожидания.
      // Клика не было вовсе — сообщение никуда не ушло, и виновата не
      // доставка, а недорисованная страница: поле есть, кнопка ещё `disabled`,
      // транскрипт монтируется. Задание остаётся в очереди до `sendRetries`.
      retry: clicked === 0,
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
      roleFn: role.fn || "",
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
    // Неотправленное задание ждёт Мастера дольше: он узнаёт о паузе не сразу,
    // а очередь — это тот же ход, который не надо начинать заново.
    if (age > (pending.undelivered ? C.undeliveredTtlMs : C.pendingTtlMs)) {
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

    // Страница ещё не отрисована: вставлять текст некуда, а «не нашёл поле»
    // на недогруженной странице — не повод откатывать карточку. Ждём тик.
    const shell = appReady();
    if (!shell.ok) {
      pendingSay(pending, `Страница ещё грузится (${shell.why}) — задание подождёт.`);
      return true;
    }

    if (!me || norm(me) !== norm(pending.roleId)) return false;

    // Задание, которое не ушло в прошлый раз. Карточку тогда вернули в Ready,
    // чтобы она не ждала 45 минут впустую, но текст остался в очереди:
    // «Продолжить» отправляет его этой же карточке и с тем же Run ID — новый
    // ход Координатора для этого не нужен (24.10, NAR-1.15).
    if (pending.undelivered) {
      const waiting = GM_getValue(K.expect, null);
      if (waiting && waiting.ref && waiting.runId) {
        let fresh = null;
        try {
          fresh = await notion("GET", `pages/${waiting.ref}`);
        } catch (e) {
          log(`Карточку «${waiting.ref}» не прочитать — отправку не начинаю: ${e.message}`, true);
          return true;
        }
        const state = taskState(fresh);
        if (state !== "Ready" && state !== "Running") {
          GM_setValue(K.pending, null);
          GM_setValue(K.expect, null);
          pause(
            `Задание не ушло, а карточка уже «${state || "без состояния"}» — повторную отправку отменяю.`,
            { kind: "send", ref: waiting.ref },
          );
          return true;
        }
        if (state === "Ready") {
          try {
            await patch(waiting.ref, {
              "Dispatch State": { select: { name: "Running" } },
              "Run ID": { rich_text: [{ type: "text", text: { content: waiting.runId } }] },
              "Recipient Agent ID": { rich_text: [{ type: "text", text: { content: pending.roleId } }] },
              "Started At": { date: { start: nowIso() } },
            });
            log("Карточка снова Running: отправляю задание из очереди, новый ход Координатора не нужен.");
          } catch (e) {
            log(`Карточка не вернулась в Running (${e.message}) — задание осталось в очереди.`, true);
            return true;
          }
        }
        GM_setValue(K.expect, { ...waiting, undelivered: false, cardRolled: false, sentAt: null, verified: false });
        GM_setValue(K.pending, { ...pending, undelivered: false, at: Date.now() });
      }
    }

    // Сообщение могло уйти, пока человек решал капчу. Тогда повторная
    // отправка была бы дублем: в чате уже есть эта реплика.
    // Ключ и снимок — те же, что при обычной отправке: доставкой считается
    // реплика, которой до выдачи не было, и только если текст не остался в
    // поле. Прошлая реплика с тем же ключом (повторная выдача карточки) —
    // по-прежнему не доказательство (28.10, 19:38).
    const captchaKey = sendKey(pending.text) || flat(pending.text).slice(0, 60);
    const captchaHandoff = GM_getValue(K.expect, null);
    const captchaKnown = Array.isArray(captchaHandoff?.seen) ? captchaHandoff.seen : null;
    const captchaSent =
      captchaKnown && !composerHolds(captchaKey, pending.text)
        ? userSaysSince(captchaKey, captchaKnown)
        : !composerHolds(captchaKey, pending.text) && lastUserSays(captchaKey)
          ? { id: "message" }
          : null;
    if (pending.captcha && !captchaDialog() && captchaSent) {
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

    // Ветка прошлого хода слита — сначала Continue, потом текст.
    //
    // 27.10 в 21:15 Архитектор слил PR #97 и записал ответ; Continue после
    // этого не нажалась (память о мерже была на карточку, а не на выдачу).
    // В 21:18 Координатор вернул ту же карточку в работу, задание ушло в чат со
    // старой веткой `arena/73b6f5a4-narthex` — статус `pr_merged`. Агент
    // отказался работать («нажмите Continue»), маркера не прислал, и цикл встал
    // на маркер-паузу. Проверяем страницу сами: пока Continue видна, задание
    // отправлять некуда.
    await ensureFreshBranch("Задание в очереди");

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

    // Что было в поле, не важно: задание в очереди — это текущий ход. Но сначала
    // поле очищается: Arena возвращает туда отклонённый текст, и вставка поверх
    // склеила бы минимальное сообщение со старым промптом.
    if (composerText(editor)) {
      const cleared = clearComposer(editor);
      log(
        cleared
          ? "В поле ввода был текст (Arena возвращает туда отклонённое) — очистил перед вставкой задания."
          : "Поле ввода не очистилось — вставляю задание поверх: вставка заменяет текст целиком.",
        !cleared,
      );
    }

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
    // Поле ввода не нашлось ни на одной попытке — страница ещё дорисовывается
    // (25.10, 14:57: шестнадцать секунд после перехода, транскрипт 0 → 15
    // сообщений, `contenteditable` в документе ноль). Клика не было, значит
    // работы по карточке нет: держим очередь, карточку не трогаем и повторяем
    // отправку следующим тиком. Пауза и откат в Ready — только когда ожидание
    // исчерпано, иначе Мастеру достаётся остановка из-за чужой перерисовки.
    if (delivery.retry) {
      const tries = Number(pending.sendTries || 0) + 1;
      if (tries <= C.sendRetries) {
        GM_setValue(K.pending, { ...pending, sendTries: tries, at: Date.now() });
        log(
          `Страница адресата ещё дорисовывается — повторю отправку через ${Math.round(C.tickMs / 1000)} с ` +
            `(попытка ${tries} из ${C.sendRetries}). Задание в очереди, карточка не тронута.`,
          false,
          { ntfy: false },
        );
        setTimeout(() => tick(false), C.tickMs);
        return true;
      }
      log(`Поле ввода не вернулось за ${C.sendRetries} попыток — останавливаюсь и жду Мастера.`, true);
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
        // Ход НЕ снимаем: текст задания остаётся в очереди, и «Продолжить»
        // отправит его этой же карточке. Карточка возвращена в Ready только
        // затем, чтобы не висеть в Running 45 минут; перед отправкой она
        // снова станет Running с тем же Run ID.
        GM_setValue(K.pending, { ...pending, undelivered: true, sendTries: 0, at: Date.now() });
        if (failed) {
          GM_setValue(K.expect, {
            ...failed,
            undelivered: true,
            cardRolled: true,
            sentAt: null,
            verified: false,
          });
        }
        pendingNoticeAt = 0;
      }
      pause(
        `${delivery.reason}${delivery.detail ? ` (${delivery.detail})` : ""}. ` +
          (rolled
            ? "Задание осталось в очереди: нажмите «Продолжить» — оно уйдёт этой же карточке, " +
              "без нового хода Координатора."
            : "Задание осталось в поле ввода и в очереди: поправьте и нажмите «Продолжить»."),
        { kind: "send" },
      );
      return true;
    }
    const expect = GM_getValue(K.expect, null);
    if (expect && norm(expect.roleId) === norm(me)) {
      // Граница «после отправки» — id подтвердившего сообщения, а не последнего
      // перед отправкой: ответ агента читается строго после нашей реплики, и
      // старое сообщение с тем же текстом границу не сдвигает (1.4.84).
      // Если id не пришёл (старая ветка), остаётся прежний водяной знак.
      const mark = delivery.msgId || watermark;
      GM_setValue(K.expect, { ...expect, watermark: mark, sentAt: Date.now(), verified: true, seen });
      dbg("Send: доставка подтверждена, отметка внутри чата", { watermark: mark, via: delivery.via || "message" });
    }
    GM_setValue(K.pending, null);
    GM_setValue(K.deadSend, "");
    pendingNoticeAt = 0;
    // Длина — в журнал: по ней видно, какое сообщение Arena не приняла, и
    // сравнить его с коротким повтором (25.10: дважды на задании 2.16).
    // id сообщения — по той же причине: «отправлено» должно быть проверяемо,
    // иначе Мастеру остаётся верить журналу на слово (28.10, 19:38).
    log(
      `Задание отправлено (${String(pending.text || "").length} символов` +
        `${delivery.msgId ? `, сообщение ${delivery.msgId}` : ""}).`,
    );
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

  /**
   * Кнопка ↺: снять ход, а не только память транспорта.
   *
   * 28.10 Мастер нажал ↺, когда задание не ушло. Очередь и ожидание в
   * хранилище снялись — а карточка NAR-5.3 осталась в Notion в Running.
   * Координатор увидел «1 Running», решил, что работа идёт, и выдал следующую
   * карточку; прежняя так и висела. Сброс, после которого карточка выглядит
   * выданной, — это не сброс, а потерянная работа.
   *
   * Поэтому теперь ↺ делает три вещи по порядку:
   *  1) возвращает в Ready карточку текущего хода (`releaseUndelivered`);
   *  2) чистит очередь, ожидание и защиту от повторов (`resetState`);
   *  3) возвращает в Ready все карточки, висящие в Running без хода, — в том
   *     числе оставшиеся от прошлых сбросов и обновлений (`sweepOrphans`).
   *
   * Отмена в диалоге не трогает ничего.
   */
  async function resetStateDialog() {
    const state = transientState();
    const what = describeTransient(state);
    const handoff = state.expect && state.expect.kind === "dispatch" && state.expect.ref ? state.expect : null;
    const cardLine = handoff
      ? `Карточка «${handoff.title || handoff.ref}» вернётся в Ready: сниму «Run ID» и «Started At», ` +
        "чтобы она не висела в Running без хода. Если агент ещё работает, его ответ придёт в чат уже без карточки."
      : what
        ? "Карточку текущего хода верну в Ready, если она висит в Running."
        : "";
    const plan = [
      what ? `Снять с транспорта: ${what}.` : "На транспорте пусто: очереди и ожидания нет.",
      cardLine,
      "Карточки миссии, которые висят в Running без хода, тоже вернутся в Ready.",
      "Журнал и настройки останутся.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const head = what ? "Снять ход?" : "Проверить карточки в Running?";
    if (!confirm(`${head}\n\n${plan}`)) return;

    // 1. Карточка текущего хода — до очистки: после неё `expect` уже не найти.
    let rolled = false;
    if (handoff) {
      rolled = await releaseUndelivered(handoff, "ход снят Мастером кнопкой ↺", { cause: "manual-reset" });
    }
    // 2. Память транспорта.
    resetState();
    if (what) log(`Снял ход вручную (${what}).`);

    // 3. Остальные Running без хода — на любой странице и в любой момент.
    let swept = [];
    try {
      const mission = await activeMission();
      if (mission) swept = await sweepOrphans(mission);
    } catch (e) {
      dbg("сброс: карточки в Running не проверены", e.message);
    }

    if (!what && !swept.length) {
      log("Снимать нечего: очередь пуста, ожидания нет, в Running без хода тоже ничего не висит.");
      return;
    }
    log(
      `Готово: ${what ? "очередь и ожидание сняты" : "транспорт был пуст"}` +
        `${rolled ? ", карточка хода возвращена в Ready" : ""}` +
        `${swept.length ? `, без хода висели ${swept.length} — тоже в Ready` : ""}. ` +
        "Нажмите «Шаг», чтобы начать с чистого листа.",
    );
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

  // Кнопка PR считается доступной, только когда её можно нажать: пока
  // страница дорисовывается, Arena держит их `disabled`, и клик по такой
  // кнопке — это не «нажал», а «ничего не произошло» с записью в журнал.
  const pressable = (b) =>
    Boolean(b) &&
    b.isConnected !== false &&
    !b.disabled &&
    b.getAttribute?.("aria-disabled") !== "true" &&
    visible(b);

  const createPr = () =>
    [...document.querySelectorAll('button[aria-label="Create pull request"]')].find(pressable) || null;

  const mergePr = () =>
    [...document.querySelectorAll('button[aria-label="Merge pull request"]')].find(pressable) || null;

  const mergedFlag = () => badgeVisible("Pull request merged");

  /**
   * «Closed» — не синоним ошибки. Так выглядит и PR, слитый через GitHub, и PR,
   * закрытый без мержа. Что именно произошло, решает маркер исполнителя
   * (`merged: true`), а не бейдж. С 1.4.48 заявка проверяется по GitHub API.
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

  /**
   * Свежая ветка перед выдачей хода.
   *
   * Continue на странице агента означает ровно одно: прошлый ход закончился
   * слитым (или закрытым) PR, и сессия стоит на ветке, работать в которой уже
   * нельзя. Агент это видит как `pr_merged` и отказывается: «нажмите Continue
   * рядом со статусом PR». Пока Continue не нажата, любое задание в этот чат
   * уходит в мёртвую ветку — работа не начинается, маркера нет, цикл встаёт
   * (27.10, NAR-4.9, ветка `arena/73b6f5a4-narthex` после PR #97).
   *
   * Клик по Continue — это не реплика агенту и не команда в репозиторий: Arena
   * просто выдаёт новую ветку от последней базовой версии. Поэтому проверка
   * стоит перед КАЖДОЙ отправкой из очереди, а не только в конце хода: пропуск
   * в одном месте (память о мерже, потерянный клик, ручная правка карточки)
   * больше не превращается в паузу.
   */
  async function ensureFreshBranch(why = "перед выдачей") {
    let cont = continueButton();
    if (!cont && mergedFlag()) {
      // Бейдж «Pull request merged» уже есть, а кнопка ещё не дорисовалась.
      // Ждать дешевле, чем отправить задание в слитую ветку.
      cont = await waitFor(() => continueButton(), patience(4000), 400);
    }
    if (!cont) return "none";
    cont.click();
    log(
      `${why}: на странице видна Continue — ветка прошлого хода слита, работать в ней агент не может. ` +
        "Нажал Continue: Arena выдаст чистую ветку.",
      false,
      { tone: "ok" },
    );
    const gone = await waitFor(() => !continueButton(), patience(8000), 500);
    if (!gone) {
      const again = continueButton();
      if (again) {
        again.click();
        log("Continue осталась на месте — нажал ещё раз.", true);
        await waitFor(() => !continueButton(), patience(6000), 500);
      }
    }
    // После Continue страница перерисовывается: поле ввода и водяной знак
    // читаются уже в новой сессии, поэтому ждём дорисовку до вставки.
    await sleep(1200);
    return continueButton() ? "stuck" : "pressed";
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
    // Память о мерже — на выдачу, а не на карточку.
    //
    // 27.10 NAR-4.9 ответили дважды: PR #95 в 16:41 и PR #97 в 21:15. Ключ был
    // один на карточку, поэтому после второго мержа `ensureMerged` сразу
    // отвечал «already»: ни бейджа, ни Continue скрипт не искал, Continue не
    // нажималась, и сессия Архитектора осталась на ветке
    // `arena/73b6f5a4-narthex` со статусом `pr_merged`. Следующая выдача ушла
    // в мёртвую ветку, агент отказался работать, маркера не было, и цикл встал.
    // Повторная работа по той же карточке — это новая выдача, у неё свой run.
    const runId = String(result.run_id || rt(task.properties?.["Run ID"]) || "").trim();
    const key = `${K.merged}${task.id}:${runId || "run"}`;
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
      // «PR-интерфейса нет вовсе»: заявка о мерже проверяется по GitHub API.
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
    // Маркеру верим не на слово: «merged: true» — это заявка, а не факт.
    // 24.10 на экране Build/Release висела активная «Create PR» (Arena не
    // знает о PR, слитом через `gh`), и отличить сделанную работу от
    // выдуманной было нечем. Теперь состояние спрашиваем у GitHub.
    const check = await verifyMergeClaim(result, ghToken());
    lastMergeCheck = check;
    // Проверка не дошла до GitHub (нет токена, отказ прав, сеть). Заявку это не
    // отменяет: без проверки действует прежнее правило, но мастер должен знать,
    // что «слит» принято на слово, и что делать.
    if (check.status === "unknown" && check.needsToken) {
      log(
        `GitHub не проверил ${prLabelOf(result)}: ${check.why}. Заявка принимается по маркеру; ` +
          "чтобы проверять по GitHub, вставьте токен в 🐙.",
        false,
        { tone: "warn", ntfy: "quiet", title: "Narthex: GitHub без токена" },
      );
    }
    if (check.notFound) {
      // Самая дорогая ошибка суток: слитый PR #37 объявили отсутствующим, и
      // готовая работа уехала в Rework. 404 не доказывает, что PR нет.
      log(
        `GitHub не читает ${prLabelOf(result)}: ${check.why}. ` +
          "Заявка принимается по маркеру, карточку в Rework за 404 не отправляю.",
        true,
        { tone: "warn", ntfy: "quiet", title: "Narthex: PR не виден по API" },
      );
    }
    if (check.status === "open" || check.status === "closed") {
      log(
        `Заявка «${prLabelOf(result)} слит» не подтвердилась: ${check.why}. ` +
          "Карточка вернётся в Rework — работа в main не попала.",
        true,
        { tone: "warn", ntfy: "quiet", title: "Narthex: заявка о мерже не подтвердилась" },
      );
      return "claim-rejected";
    }
    const seen = await waitFor(() => mergedFlag() || continueButton(), patience(C.mergeGraceMs), 1000);
    if (seen) return finishMerge(task, key);
    GM_setValue(key, true);
    const proof =
      check.status === "merged"
        ? `, GitHub подтвердил (${check.why})`
        : `; проверить по GitHub не удалось — ${check.why}`;
    log(
      `${prLabelOf(result)} слит: принято по маркеру агента${note}${proof}. ` +
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

  /**
   * Токен GitHub.
   *
   * 24.10 репозиторий `Creative36711/narthex` оказался приватным: анонимный
   * запрос к API отвечает на него «404 Not Found» — так же, как на PR, которого
   * нет. 1.4.48 приняла этот ответ за правду и отправила готовую работу
   * (PR #37) в Rework. Токен читает состояние PR; хранится в ScriptCat и в
   * журнал не попадает.
   */
  const ghToken = () => String(GM_getValue(K.ghToken, "") || "").trim();

  /** Подпись токена для журнала и диалога: сам токен не показываем. */
  const ghMask = (token) => (token ? `${token.slice(0, 4)}…${token.slice(-4)}` : "не задан");

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

  /**
   * Номер и репозиторий PR из маркера.
   *
   * Принимаем и число, и «#37», и полный адрес: агент может сослаться на PR
   * словами. Адрес важнее номера — он называет репозиторий, а номер без
   * репозитория проверяется в нашем.
   */
  function prRef(result) {
    const raw = String((result && result.pr) ?? "").trim();
    if (!raw) return null;
    const url = raw.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i);
    if (url) return { repo: `${url[1]}/${url[2]}`, number: Number(url[3]) };
    const num = raw.replace(/^#/, "").match(/^(\d+)$/);
    return num ? { repo: C.repo, number: Number(num[1]) } : null;
  }

  /** Заголовки GitHub API. Без токена запрос остаётся анонимным (60 в час). */
  function githubHeaders(token) {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "narthex-scriptcat",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  /**
   * Состояние PR по GitHub API.
   *
   * Проверка идёт один раз за ход. Приватному репозиторию нужен токен:
   * без него GitHub отвечает 404 независимо от того, есть PR или нет.
   */
  async function githubPr(repo, number, token = "") {
    return request("GET", `https://api.github.com/repos/${repo}/pulls/${number}`, githubHeaders(token));
  }

  /**
   * Проверка «PR слит» из маркера.
   *
   * `status`: merged — GitHub подтвердил; open / closed — заявка ложная,
   * принимать её нельзя; unknown — проверить не удалось (сеть, лимит, нет
   * номера, нет токена, PR не читается), и тогда остаётся прежнее правило
   * «верим маркеру, но говорим об этом в журнале». Статуса «PR нет» больше
   * нет: 404 означает только «не видно».
   *
   * `needsToken` — проверка упёрлась в доступ, а не в состояние PR: приватный
   * репозиторий без токена отвечает 404, и это нельзя читать как «PR нет».
   */
  async function verifyMergeClaim(result, token = "") {
    const ref = prRef(result);
    if (!ref) return { status: "unknown", why: "в маркере нет номера PR" };
    try {
      const pr = await githubPr(ref.repo, ref.number, token);
      if (!pr || typeof pr !== "object") return { status: "unknown", why: "GitHub ответил пустым ответом" };
      const merged = pr.merged === true || Boolean(pr.merged_at);
      if (merged) return { status: "merged", why: `PR #${ref.number} слит ${pr.merged_at || ""}`.trim(), pr };
      if (String(pr.state || "").toLowerCase() === "closed")
        return { status: "closed", why: `PR #${ref.number} закрыт без мержа`, pr };
      return { status: "open", why: `PR #${ref.number} ещё открыт`, pr };
    } catch (e) {
      const raw = String((e && e.message) || e);
      const code = Number((e && e.status) || (raw.match(/HTTP (\d{3})/) || [])[1] || 0);
      // 404 без токена — «не видно», а не «нет»: именно на этом 24.10 готовый
      // PR #37 уехал в Rework. Проверять наличие PR вправе только токен.
      if (code === 404 && !token)
        return {
          status: "unknown",
          needsToken: true,
          why: `PR #${ref.number} анонимно не виден: ${ref.repo} приватный — нужен токен GitHub (🐙)`,
        };
      if (code === 404) {
        // Прежде чем сказать «PR нет», убеждаемся, что токен вообще видит
        // репозиторий: иначе «нет прав» снова станет «нет работы».
        try {
          await request("GET", `https://api.github.com/repos/${ref.repo}`, githubHeaders(token));
        } catch (e2) {
          return {
            status: "unknown",
            needsToken: true,
            why: `ни PR #${ref.number}, ни сам ${ref.repo} токену не видны — проверьте доступ к репозиторию`,
          };
        }
        // 404 — это «не видно», а не «нет». Отсутствие PR по нему не
        // доказывается: 24.10 такой ответ уже отправил слитый PR #37 в Rework.
        // Поэтому статус остаётся unknown, и карточку за него не отбираем.
        return {
          status: "unknown",
          notFound: true,
          why: `PR #${ref.number} в ${ref.repo} не читается (404), но отсутствие PR этим не доказывается`,
        };
      }
      if (code === 401 || code === 403)
        return {
          status: "unknown",
          needsToken: true,
          why: `GitHub не принял токен (HTTP ${code}): проверьте срок и право «Pull requests: read»`,
        };
      if (!code) return { status: "unknown", why: `GitHub не ответил: ${raw}` };
      return { status: "unknown", why: `GitHub ответил HTTP ${code}`, code };
    }
  }

  /**
   * Вернуть карточку, которую проверка ошибочно отправила в Rework.
   *
   * 24.10 NAR-1.13 лежала в Rework при слитом PR #37: работа в main, а
   * Координатор уже готовил повторную выдачу. Кнопка 🐙 → «Вернуть карточку»
   * спрашивает GitHub ещё раз и, если мерж подтверждён, ставит ровно то, что
   * поставила бы удачная проверка: Submitted, Submitted At, PR и отметку в
   * «Ответ». Ready не трогаем: если карточку уже выдали заново, решает Мастер.
   */
  async function recoverLastClaim(adopt = true) {
    const last = GM_getValue(K.lastResult, null);
    if (!last || !last.dispatch_id) return { ok: false, text: "Нет запомненной выдачи: возвращать нечего." };
    const check = await verifyMergeClaim(last.result || last, ghToken());
    if (check.status !== "merged")
      return { ok: false, text: `GitHub мерж не подтверждает: ${check.why}. Карточка не тронута.` };
    const page = await notion("GET", `pages/${last.dispatch_id}`);
    const state = taskState(page);
    const name = last.task || last.dispatch_id;
    if (state === "Ready")
      return {
        ok: false,
        text: `«${name}» уже вернулась в Ready: её могли выдать заново. Правку не делаю — решение за Мастером.`,
      };
    const link = prUrl((check.pr && check.pr.html_url) || last.pr);
    const note =
      `Восстановлено после ложного отказа проверки: GitHub подтвердил мерж ${link || `PR #${last.pr}`}` +
      ` (${check.why}). Повторная работа по карточке не нужна.`;

    // Журнал важнее карточки: Координатор принимает по нему. 24.10 в 19:57
    // случилось ровно это — карточка уже была возвращена в Submitted, а в
    // журнале остался блок «Заявка о мерже не подтвердилась», и Координатор
    // снова поставил Rework, хотя PR #37 лежал в main. Опровержение пишется
    // отдельным маркером, поэтому повторный клик его не дублирует.
    let logFix = "";
    if (last.logId) {
      const marker = `<!-- CF_DISPATCH ${last.dispatch_id}:${last.run_id}:recovered -->`;
      try {
        const wrote = await gateway("append", last.logId, {
          marker,
          entry: `\n\n${marker}\n## Проверка мержа исправлена\n\n${note}\n`,
        });
        logFix = wrote && wrote.duplicate ? " Опровержение уже было в журнале." : " Опровержение записано в журнал.";
      } catch (e) {
        logFix = ` Опровержение в журнал записать не удалось: ${e.message}.`;
      }
    }

    if (state === "Submitted" || state === "Accepted") {
      log(`«${name}» уже ${state}: журнал проверен${logFix ? "," : ""}${logFix}`, false, { tone: "ok" });
      return { ok: true, text: `«${name}» уже ${state}.${logFix}` };
    }

    // Rework — это отказ, при котором ответ агента так и не был прочитан
    // (24.10: работа в main, а карточка ушла в Rework). Такую карточку
    // возвращаем не в Submitted, а в Running: иначе ответ останется в чате
    // невычитанным, и следующая выдача станет дублем (🐙 → «Взять ответ»).
    if (state === "Rework" || state === "Running") {
      if (state === "Rework") {
        const props = {
          "Dispatch State": { select: { name: "Running" } },
          "Ответ": { rich_text: richText(note) },
        };
        if (link) props["PR"] = { url: link };
        await patch(last.dispatch_id, props);
      }
      GM_setValue(`cfn-done:${last.dispatch_id}:${last.run_id}`, false);
      GM_setValue(K.lastResult, { ...last, recoveredAt: Date.now(), verdict: "Running" });
      let taken = "";
      try {
        const here = adopt && typeof roleFromPath === "function" ? roleFromPath() : "";
        if (here && norm(here) === norm(last.roleId)) {
          const got = await adoptPageAnswer();
          taken =
            got && got.ok
              ? " Ответ прочитан и оформлен обычным путём."
              : ` Ответ сразу не прочитан: ${(got && got.text) || "неизвестно"}.`;
        } else {
          taken =
            ` Откройте страницу «${last.roleName || "исполнителя"}» и нажмите «Взять ответ»:` +
            " карточка снова Running, ответ ждёт.";
        }
      } catch (e) {
        taken = ` Ответ сразу не прочитан: ${e.message}. Кнопка «Взять ответ» на странице роли.`;
      }
      log(`«${name}» возвращена в Running: GitHub подтвердил мерж ${link || ""}`.trim() + logFix, false, {
        tone: "ok",
        ntfy: "quiet",
        title: "Narthex: карточка возвращена в работу",
      });
      return { ok: true, text: `Готово: «${name}» снова Running, ${link || `PR #${last.pr}`}.${logFix}${taken}` };
    }

    const props = {
      "Dispatch State": { select: { name: "Submitted" } },
      "Ответ": { rich_text: richText(note) },
      "Submitted At": { date: { start: nowIso() } },
    };
    if (link) props["PR"] = { url: link };
    await patch(last.dispatch_id, props);
    GM_setValue(`cfn-done:${last.dispatch_id}:${last.run_id}`, true);
    GM_setValue(K.lastResult, { ...last, recoveredAt: Date.now(), verdict: "Submitted" });
    log(`«${name}» возвращена в Submitted: GitHub подтвердил мерж ${link || ""}`.trim() + logFix, false, {
      tone: "ok",
      ntfy: "quiet",
      title: "Narthex: карточка восстановлена",
    });
    return { ok: true, text: `Готово: «${name}» снова Submitted, ${link || `PR #${last.pr}`}.${logFix}` };
  }

  /**
   * Ложный отказ чинится сам, не дожидаясь Мастера.
   *
   * 24.10 транспорт дважды возвращал слитую работу в Rework: человек узнавал
   * об этом от Координатора, а не от скрипта. Если последняя проверка сказала
   * «заявка не подтвердилась», а GitHub теперь говорит «слит», это уже
   * известный дефект — карточка и журнал исправляются без кликов. Ответ при
   * этом не берётся: его читают кнопкой на странице роли, иначе ход пойдёт
   * мимо очереди.
   */
  let healedThisPage = false;
  async function selfHealClaim() {
    if (healedThisPage) return;
    const last = GM_getValue(K.lastResult, null);
    if (!last || last.verdict !== "claim-rejected" || last.recoveredAt) return;
    healedThisPage = true;
    const check = await verifyMergeClaim(last.result || last, ghToken());
    if (check.status !== "merged") return;
    log(
      `Проверка ошиблась: GitHub подтвердил мерж ${prLabelOf(last.result || last)} — ` +
        "возвращаю карточку и исправляю журнал.",
      false,
      { tone: "ok", ntfy: "quiet", title: "Narthex: ложный отказ исправлен" },
    );
    await recoverLastClaim(false);
  }

  /**
   * Ответ уже в чате, а ожидания нет.
   *
   * Скрипт перезапускался, страницу перезагружали, прошлая попытка снимала
   * ожидание — а агент ответил, и карточка осталась в Running. Тогда
   * Координатор ждёт ход, которого никто не начнёт, и через 45 минут карточка
   * уедет в Ready как «брошенная» — то есть работа пойдёт по второму кругу.
   * Кнопка «Взять ответ» читает последний маркер этой страницы и отдаёт его
   * обычному пути submitExecutor. Ничего не додумывает: нужен маркер, карточка
   * в Running, тот же адресат и отсутствие отметки «уже обработано».
   */
  async function adoptPageAnswer() {
    if (GM_getValue(K.expect, null) || GM_getValue(K.pending, null)) {
      return { ok: false, text: "Уже есть ожидание или очередь отправки: сначала завершите текущий ход; для него нажмите «Шаг»." };
    }
    const roleId = roleFromPath();
    if (!roleId) return { ok: false, text: "Откройте страницу агента: брать ответ не с кого." };
    const list = await roles();
    const role = list.find((r) => norm(r.id) === norm(roleId));
    if (!role) return { ok: false, text: "Страница не привязана к активной роли — проверьте «Agent URL»." };
    if (role.fn === "Coordinator")
      return { ok: false, text: "Это страница Координатора: его ход читается кнопкой «Шаг», а не отсюда." };
    const all = messages();
    const last = [...all].reverse().find((n) => !isUserNode(n));
    if (!last) return { ok: false, text: "В чате нет ответов агента." };
    const result = parseMarker(messageRaw(last), "CF_AGENT_RESULT") || parseMarker(messageRaw(last), "CF_COORDINATOR_RESULT") || parseMarker(messageRaw(last), "CF_REVIEW_RESULT");
    if (!result) return { ok: false, text: "В последнем ответе нет маркера выдачи — читать нечего." };
    const ref = String(result.dispatch_id || result.dispatch || result.dispatchId || "").trim();
    if (!isUuid(ref)) return { ok: false, text: `В маркере нет корректного dispatch_id («${ref || "нет"}») — карточку не угадываю.` };
    const run = String(result.run_id || result.run || result.runId || "").trim();
    if (!isUuid(run)) return { ok: false, text: "В маркере нет корректного run_id — чужую выдачу не угадываю." };
    if (GM_getValue(`cfn-done:${ref}:${run}`, false))
      return { ok: false, text: "Эта выдача уже обработана — второй раз не читаю." };
    const page = await notion("GET", `pages/${ref}`);
    const state = taskState(page);
    if (state !== "Running")
      return { ok: false, text: `Карточка уже «${state || "без состояния"}» — читать нечего.` };
    const owner = norm(rt(page.properties["Recipient Agent ID"]));
    if (owner && owner !== norm(role.id))
      return { ok: false, text: "Ответ принадлежит другому агенту — не беру." };
    // Граница — сообщение перед ответом: в журнал попадёт только он.
    const at = all.indexOf(last);
    const watermark = at > 0 ? nodeId(all[at - 1]) : "";
    const expect = {
      ref,
      runId: run,
      roleId: role.id,
      roleName: role.name,
      kind: "dispatch",
      sentAt: Date.now(),
      verified: true,
      watermark,
      tries: 0,
      lastReplySig: "",
      lastReplyAt: 0,
      adopted: true,
    };
    if (GM_getValue(K.expect, null) || GM_getValue(K.pending, null)) {
      return { ok: false, text: "Пока читалась карточка, начался другой ход: его ожидание не перезаписываю." };
    }
    GM_setValue(K.expect, expect);
    await submitExecutor(role, expect, true);
    const updated = await notion("GET", `pages/${ref}`);
    const finished = norm(rt(updated.properties?.["Run ID"])) === norm(run) &&
      ["Submitted", "Accepted", "Rework"].includes(taskState(updated));
    return finished
      ? { ok: true, text: `Ответ ${role.name} обработан: состояние карточки «${taskState(updated)}».` }
      : { ok: false, text: "Карточка ещё не оформлена: проверьте сообщение в панели, ожидание сохранено." };
  }

  /** Последняя проверка заявки — причина для карточки Rework. */
  let lastMergeCheck = null;

  /** Исполнитель утверждает, что слил PR сам. Единственный доступный сигнал. */
  const hasMergedClaim = (result) =>
    !!result && (result.merged === true || String(result.status || "").toLowerCase() === "merged");

  /**
   * «У этой работы нет PR» — сказано в маркере явно.
   *
   * Отчёт, аудит, запись решения в Notion: кода нет, мержить нечего. Пропуск
   * `pr` значит «забыл» и по-прежнему ведёт в Rework, а вот `"pr": null`,
   * `"none"`, `"-"` или `"нет"` — это заявка «PR не будет», и ждать мерж по ней
   * нельзя: исполнитель честно ничего не пушил (Arena, 24.10: Build/Release на
   * карточке-отчёте получил «Please open a pull request…» на пустом месте).
   *
   * Аудитору PR не нужен никогда: он не меняет репозиторий. Это правило живёт
   * в `submitExecutor` по `role.fn`, а не здесь.
   */
  const prDeclined = (result) => {
    if (!result || !("pr" in result)) return false;
    const pr = result.pr;
    if (pr === null || pr === undefined) return true;
    return /^(none|null|no|нет|—|-)$/i.test(String(pr).trim());
  };

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

  // Разметка блока — обычный текст, а не HTML-комментарии: `<!-- -->`
  // вырезают чистильщики разметки, и своё же задание перестаёт опознаваться
  // в транскрипте (25.10: дважды подряд ошибка Arena на задании 2.16).
  const TECH_OPEN = "=== CF_TECH v1 ===";
  const TECH_CLOSE = "=== /CF_TECH ===";
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

  /**
   * Поля карточки, которые ставит скрипт.
   *
   * На NAR-2.13 Runtime Auditor вписал в `Output Drive File ID` id своего отчёта
   * из Arena/reports. Поле — единственная ссылка на журнал попытки, поэтому
   * запись ответа упёрлась в отказ шлюза («только Arena/logs»), а цикл встал на
   * паузе. Правило ставится и исполнителю, и аудитору: карточка — не блокнот.
   */
  const CARD_FIELDS_RULE = [
    "КАРТОЧКА: твой выход — ответ в чате и последняя строка-маркер. Поля `Dispatch State`,",
    "`Run ID`, `Output Drive File ID`, `Recipient Agent ID`, `Started At`, `Submitted At`,",
    "`PR`, `Check` ставит скрипт; вписанное руками значение ломает запись ответа в журнал",
    "(NAR-2.13: в `Output Drive File ID` попал отчёт, шлюз отказал). Ссылку на отчёт даёт",
    "поле `report` в маркере, а не поле карточки.",
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
    "",
    CARD_FIELDS_RULE,
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
    "",
    CARD_FIELDS_RULE,
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

  /**
   * Приёмке не нужны git, PR и мерж: её выход — вердикт, а не правка.
   * Без собственного блока она получила бы исполнительский и пошла бы
   * «доделывать» то, что должна была вернуть.
   */
  const REVIEWER_TECH = [
    "Репозиторий и «Запросы» тебе не подчиняются: ты не правишь ни код, ни карточки.",
    "Читать можно всё: карточку миссии («Итог», «Замечания», «Круг»), принятые карточки, документы репозитория.",
    "В отдельной приёмке миссии твой выход — CF_REVIEW_RESULT: verdict accept, rework или master.",
    "Если тебе выдали карточку, это отдельный ход: её отчёт заканчивается CF_AGENT_RESULT с dispatch_id и run_id.",
    "Если оракул карточки требует CF_REVIEW_RESULT, добавь его в отчёт с теми же dispatch_id и run_id; сам по себе он миссию не закрывает.",
    "Нет нужного маркера — хода не было: цикл ждёт ответ, потом напомнит и встанет.",
  ].join("\n");

  const TECH_BY_FN = {
    Executor: EXECUTOR_TECH,
    Auditor: AUDITOR_TECH,
    Coordinator: COORDINATOR_TECH,
    Reviewer: REVIEWER_TECH,
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
      return "Ты принимаешь решения в Notion; код, ветки и PR — не твоя зона. Нарезка, порядок, Кому, Sequence и число Ready — твои.";
    }
    if (role.fn === "Reviewer") {
      return [
        "Ты ничего не меняешь: ни в репозитории, ни в карточках — ни «на минутку», ни «чтобы стало зелёным».",
        "Твой выход — вердикт: accept или rework с проверяемыми замечаниями, а на вопросы агентов — решение или master.",
        "Вопрос агента ты закрываешь вместо Мастера; зовёшь Мастера только там, где без него физически нельзя.",
        "Чинит исполнитель, разбирает замечания карточками Координатор: чужая работа остаётся чужой.",
      ].join(" ");
    }
    return [
      "Не меняй чужие зоны: чужая правка — не твоя работа, даже если она кажется мелкой.",
      "Мерж PR делаешь сам: `gh pr merge --squash`.",
      "Оракул — смоуки, эталон, контракты, существующие типы — ослаблять нельзя.",
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
   * Дисциплина хода: зоны, решения, вопросы.
   *
   * 24.10 Kernel на середине NAR-1.12 выставил опрос «May I expand the write
   * zone?»: в техблоке стояла зона `src/core/`, а Scope карточки разрешал ещё
   * пробу и `package.json`. Тогда это вылечили запретом вопросов вовсе — и
   * получили обратную беду: важный вопрос стало некуда задать, он уходил
   * строкой в отчёт и терялся. 25.10 (фаза 2) так потерялись оба.
   *
   * Теперь вопрос — поле маркера с обязательным вариантом по умолчанию:
   * транспорт пишет его в базу «Вопросы», работа идёт дальше, ответ приходит
   * на следующем ходе. Вопрос перестал быть остановкой и перестал теряться.
   */
  function workRules(role) {
    return [
      "КАК РЕШАТЬ",
      `Зона записи${role && role.zone ? ` (${role.zone})` : ""} — рамка по умолчанию; Scope карточки расширяет её на этот ход. На этот ход карточка главнее общей рамки.`,
      "Неоднозначность решаешь сам: минимальное изменение, «Допущение: …» строкой в отчёт; меняет контракт — запись в docs/decisions.",
      'Вопрос задаётся только полем question в маркере: {"text":"…","options":["A","B"],"default":"A","hours":24}. Вариант по умолчанию обязателен — по нему ты работаешь сразу, не дожидаясь ответа. Вопрос уходит приёмке сразу, как только записан: ответ придёт строкой в следующем промпте, обычно в том же ходе цикла. Больше одного вопроса за ход не задавай.',
      "Вопрос уместен, только если ответ меняет то, что будет построено, и ни ТЗ, ни карточка его не дают. Порядок, формулировки, оформление — решай сам.",
      "Предложение (ADR `proposed` в docs/decisions) — это тоже вопрос, и оно не работает без второго шага: в том же ходе задай question со ссылкой на файл, тремя вариантами и default = «оставить как есть». Иначе решение лежит в репозитории, где Мастер его не увидит. Ответ придёт строкой в следующем промпте — тогда и меняй статус: `accepted` или `rejected`, с датой. Оставлять `proposed` после ответа нельзя: это выглядит как нерешённый вопрос.",
      "Статус решения не проверяет ни один тест и не должен проверять: оракул, который требует `Статус: proposed`, защищает открытый вопрос от ответа. Проверка вправе требовать только допустимый статус, а не конкретный.",
      "Опрос в чате, «May I…», просьба разрешения — не вопрос, а остановка хода: работа не сдаётся, карточка висит в Running. Не делай так.",
      "Файлы для показа не открывай: путь к файлу назови текстом в отчёте — Мастер откроет сам, если нужно.",
    ].join("\n");
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
      "   Своих изменений в репозитории нет (отчёт, аудит-справка, запись решения): PR не открывай,",
      "   пустой PR ради галочки не нужен — в маркере поставь \"pr\": null.",
      "5. Проверка: команда, код возврата, путь к отчёту. Если задание молчит в чём-то,",
      "   реши сам и запиши решение в docs/decisions/<миссия>.md — останавливаться не нужно.",
      "   Вопрос Мастеру — полем question в маркере (формат в «КАК РЕШАТЬ»); работа от него не встаёт.",
      "6. Последней строкой ответа — ровно один маркер:",
      `CF_AGENT_RESULT {"dispatch_id":"${task.id}","run_id":"${runId}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR>,"merged":true}`,
      "`pr` и `merged: true` обязательны, если PR слит: без них «слит» не отличить от",
      "«закрыт без мержа» — снаружи оба случая выглядят одинаково. Работа без PR —",
      "`\"pr\": null`: пропущенный `pr` считается забытым, а не отсутствующим.",
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

  /** Карточка Reviewer — отчёт о своей работе, не отдельное закрытие миссии. */
  function reviewerOrder(task, runId, missionId = "") {
    const missionField = missionId ? `"mission_id":"${missionId}",` : "";
    return [
      "ПОРЯДОК ДЛЯ КАРТОЧКИ ПРИЁМКИ",
      "1. Проверь задание по его оракулу. Код, ветки и PR не меняй.",
      "2. Дай полный отчёт с фактами; если оракул карточки требует вердикт, добавь в отчёт отдельную строку:",
      `CF_REVIEW_RESULT {${missionField}"dispatch_id":"${task.id}","run_id":"${runId}","verdict":"accept|rework|master","remarks":"<проверяемые замечания или причина>"}`,
      "В реальном вердикте выбери одно значение, а не шаблон; поля карточки и её оракул сохраняются.",
      "3. Последней строкой ответа — маркер сдачи карточки (работа без PR):",
      `CF_AGENT_RESULT {"dispatch_id":"${task.id}","run_id":"${runId}","status":"submitted","pr":null}`,
      "Этот ход сдаёт карточку Координатору; отдельно назначенная приёмка решает судьбу всей миссии.",
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

  function executorPrompt(task, role, payload, logId, runId, missionId = "") {
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
      ...(role.fn === "Auditor"
        ? auditorOrder(task, runId)
        : role.fn === "Reviewer"
          ? reviewerOrder(task, runId, missionId)
          : executorOrder(task, runId)),
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

  function coordinatorPrompt(
    mission,
    role,
    queueSummary,
    turnId,
    note = "",
    answerLine = "",
    drafts = "",
    ready = "",
    rework = "",
    openQuestions = "",
    answers = "",
  ) {
    return [
      technicalInfo(role),
      "",
      `Миссия: ${rt(mission.properties["Миссия"])}.`,
      `ТЗ: ${mission.properties["ТЗ URL"]?.url || "не задано"}`,
      `Очередь: ${queueSummary}`,
      returnBlock(mission),
      ready,
      rework,
      drafts,
      answerLine,
      openQuestions,
      answers,
      note ? `Комментарий: ${note}` : "",
      "",
      "ОЧЕРЕДЬ — ТВОЯ",
      "Running в очереди — это работа, которая идёт прямо сейчас: его ставит транспорт на время хода и сам возвращает карточку в Ready, если хода по ней нет. Перевыдавать такую карточку не надо.",
      "Движок ставит Running и Submitted; Accepted, Rework и Ready ставишь ты. Нарезка, порядок, Кому, Sequence, число Ready, выдача черновика (Draft → Ready), правка его полей и архив лишнего — твои действия. Код, ветки и PR — не твоя зона.",
      "Мастер и Архитектор пишут только черновики: это твой задел, а не приказ — правь под оракул миссии и выдавай сам, не дожидаясь Мастера. В архив — только если черновик дублирует уже выданное.",
      "Прежде чем заводить карточку, пролистай «Запросы» по номеру: карточка с этим номером уже есть (Draft, Ready, Rework — всё равно) — правь её и выдавай, второй такой же номер не создавай. Дубль без «Ответа» убери в архив. В «Миссию» пиши полное название миссии, а не «NAR-4»: по этому полю транспорт отличает очередь миссии от чужой, и короткое название прячет карточку от всех.",
      "Rework — не выдача и не приговор: разбираешь его ты, а не Мастер. (а) Нужна переделка — верни её в Ready и в том же ответе направь ход роли из карточки: следы прошлого ответа («Submitted At», «PR», «Run ID») снимет транспорт на выдаче, даже если Rework и Ready проставлены одним ходом. Чистить поля коннектором не надо и не пытайся. (б) Карточка была сформулирована с ошибкой — перепиши её Намерение, Инварианты, Acceptance и Scope; это правка карточки, а не смена оракула миссии. (в) Работа уже сделана другими карточками — поставь Accepted с пометкой «остаток разбит на …» или убери её. Принятую (Accepted) обратно в Ready не возвращай. Держать Rework «на всякий случай» нельзя: он висит в очереди и мешает закрыть миссию.",
      "Ready-карточку с меньшим Sequence не обходи молча. Выдаёшь не её — назови в ответе причину (ждёт решения Мастера, зависит от другой карточки, сформулирована неверно) и поправь ей Sequence или убери в Draft. Молчаливый обход выглядит как потерянная работа: карточка остаётся Ready и ждёт следующего круга.",
      "Scope карточки обязан покрывать артефакты её Оракула: пробу, npm-скрипт и запись решения перечисляй в Scope прямо — иначе исполнитель встанет на границе зоны.",
      "Если роль не может получить работу («Ждёт», пустой Agent URL, нет в «Ролях») — назначь в «Кому» активную роль или оставь Draft и назови, кого он ждёт. Статус роли и Agent URL — зона Мастера, не меняй их.",
      "Оракул миссии (ТЗ §2/§3) и инварианты миссии менять нельзя: если проверка требует другого смысла — только ADR proposed и решение Мастера. Acceptance карточки — не оракул миссии: ошибочную формулировку ты исправляешь сам, но так, чтобы смысл проверки миссии не изменился.",
      "ADR proposed — это очередь решений Мастера, и она видна ему счётчиком «⚖» на панели. Каждое своё предложение сопровождай вопросом в том же маркере: текст — суть решения плюс имя файла, три варианта, default = «оставить как есть». Ответ Мастера придёт строкой «Ответы Мастера» — по нему ты либо принимаешь решение (переведи ADR в `accepted`/`rejected` с датой в том же ходе, через исполнителя), либо продолжаешь по варианту по умолчанию. Нерешённое предложение — долг, а не состояние: если оно висит, назови его в Итоге миссии.",
      "",
      "ХОД — один ответ:",
      "1) Submitted → проверь по Acceptance, поставь Accepted или Rework (причина в «Ответ»).",
      "2) В этом же ответе выдай работу: новая карточка (Намерение, Инварианты, Acceptance с командой-оракулом, Свободно, Scope, Кому, Sequence, Миссия, Dispatch State = Ready) или Draft → Ready. Пустая очередь после хода — незаконченный ход. В «Миссию» карточки копируй строку «Миссия: …» из этого промпта как есть: по этому полю транспорт отличает очередь миссии от чужой.",
      '3) Миссия выполнена → допиши «Итог» миссии (что сделано, чем проверено, какие долги остались) и поставь next = "done". Поле «Состояние» сам не ставь: «done» — это передача на приёмку, а не закрытие. Миссию закрывает роль с функцией Reviewer своим вердиктом; если она вернёт работу, замечания придут в плане следующего хода.',
      "",
      "next — имя роли той карточки, которую выдаёшь. Своё имя значит «ход снова мне»: это не ошибка, но работу надо выдать в этом же ответе.",
      'Остановить цикл можно только одним способом: next = "blocked" и need = "<роль>" — когда работы для активных ролей нет вовсе. Rework, черновики и спорный Scope — твоя работа, а не повод. Остановка без need не принимается: транспорт вернёт ход тебе же. Вопрос — не остановка: он уходит приёмке сразу, она отвечает вместо Мастера, и ответ придёт тебе строкой в следующем плане. Иначе — работай дальше.',
      "Вопрос Мастеру задаётся полем question в маркере (формат — в «КАК РЕШАТЬ»): цикл при этом не останавливается.",
      "",
      "Последней строкой ответа:",
      `CF_COORDINATOR_RESULT {"mission_id":"${mission.id}","turn_id":"${turnId}","status":"completed","next":"<роль|done>"}`,
      "Строку копируй целиком, подставляя только next: mission_id и turn_id — из этого промпта. Id прошлого хода выдумывать не надо — транспорт всё равно возьмёт свой.",
      'Поле question необязательное и идёт в тот же JSON: {... "next":"Turn Runtime", "question":{"text":"…","options":["A","B"],"default":"A","hours":24}}',
      "",
      roleContext(role),
    ].filter(Boolean).join("\n");
  }


  // ───────────────────────────── ход исполнителя ─────────────────────────────
  /**
   * Запись ответа в журнал хода — с возвратом ссылки, если поле в карточке
   * переписали.
   *
   * `Output Drive File ID` — единственная ссылка на журнал попытки, и её может
   * переписать любой, у кого есть доступ к карточке. На NAR-2.13 (25.10,
   * 15:59Z) Runtime Auditor создал `Arena/reports`, положил туда отчёт и вписал
   * его id в это поле вместо журнала. Шлюз отказал по делу — «Запись разрешена
   * только в текстовые файлы Arena/logs», — а скрипт назвал это «шлюз Drive не
   * ответил» и встал на паузу: Мастер пошёл проверять развёртывание, хотя шлюз
   * был жив и прав.
   *
   * Порядок: обычная запись → отказ про папку → журнал этой выдачи
   * (`createLog` идемпотентен по паре Dispatch/Run) → запись в него → ссылка
   * возвращается в карточку. Отчёт агента не трогается: он не журнал.
   */
  async function appendToJournal(dispatchId, runId, declaredLogId, marker, entry) {
    const refusedBecauseOfFolder = (e) =>
      Boolean(e && e.refused) &&
      /текстовые файлы/i.test(String(e.reason || (e && e.message) || e));
    try {
      const wrote = await gateway("append", declaredLogId, { marker, entry });
      return { wrote, logId: declaredLogId };
    } catch (e) {
      if (!refusedBecauseOfFolder(e)) throw e;
      log(
        `Поле «Output Drive File ID» указывает не на журнал (${declaredLogId}): ` +
          "шлюз пишет только в Arena/logs. Беру журнал этой выдачи и возвращаю ссылку в карточку.",
        true,
        { ntfy: false },
      );
      let journalId = "";
      try {
        const created = await gateway("createLog", "", { dispatchId, runId });
        journalId = String(
          (created && (created.fileId || (created.result && created.result.fileId))) || "",
        );
      } catch (createdError) {
        log(`Журнал этой выдачи не открылся: ${createdError.message}`, true, { ntfy: false });
        throw e;
      }
      if (!journalId) throw e;
      if (journalId !== declaredLogId) {
        try {
          const fresh = await notion("GET", `pages/${dispatchId}`);
          if (taskState(fresh) !== "Running" || !runId || norm(rt(fresh.properties?.["Run ID"])) !== norm(runId)) {
            throw new Error("карточка уже не принадлежит этой выдаче");
          }
          await patch(dispatchId, {
            "Output Drive File ID": { rich_text: [{ type: "text", text: { content: journalId } }] },
          });
          log(`Ссылка на журнал возвращена в карточку: ${journalId}.`);
        } catch (patchError) {
          log(`Ссылка на журнал не вернулась в карточку: ${patchError.message}`, true, { ntfy: false });
        }
      }
      const wrote = await gateway("append", journalId, { marker, entry });
      return { wrote, logId: journalId };
    }
  }

  /** Reviewer сдаёт именно свою выдачу; чужой вердикт нельзя «починить» подстановкой ID. */
  function reviewerDispatchEvidence(messages, hit, expect) {
    const field = (obj, ...names) => names.map((name) => obj?.[name]).find((v) => v !== undefined && v !== null && v !== "") || "";
    const match = (obj) =>
      Boolean(expect.ref && expect.runId) &&
      norm(field(obj, "dispatch_id", "dispatch", "dispatchId")) === norm(expect.ref) &&
      norm(field(obj, "run_id", "run", "runId")) === norm(expect.runId);
    if (!match(hit.result)) return { error: "маркер сдачи относится к другой карточке или Run ID" };
    const agent = parseMarker(hit.raw, "CF_AGENT_RESULT");
    if (agent && String(agent.status || "").trim().toLowerCase() !== "submitted") {
      return { error: "в CF_AGENT_RESULT нет status submitted" };
    }
    const decision = messages.map((m) => parseMarker(m.raw, "CF_REVIEW_RESULT")).filter(Boolean).at(-1) || null;
    if (!decision) return { decision: null, verdict: "" };
    if (!match(decision)) return { error: "вердикт относится к другой карточке или Run ID" };
    if (decision.mission_id && expect.missionId && norm(decision.mission_id) !== norm(expect.missionId)) {
      return { error: "вердикт относится к другой миссии" };
    }
    const verdict = String(decision.verdict || "").trim().toLowerCase();
    if (!["accept", "rework", "master"].includes(verdict)) return { error: "в вердикте нет accept, rework или master" };
    if (verdict === "rework" && !String(decision.remarks || "").trim()) return { error: "rework без замечаний" };
    return { decision, verdict };
  }

  /** Ожидание могло смениться в другой вкладке во время сетевого запроса. */
  function currentDispatch(expect) {
    const live = GM_getValue(K.expect, null);
    return Boolean(live && live.kind === "dispatch" && expect?.runId &&
      norm(live.ref) === norm(expect.ref) && norm(live.runId) === norm(expect.runId) &&
      (!expect.roleId || norm(live.roleId) === norm(expect.roleId)));
  }

  /** Сверка карточки перед записью; Notion не предоставляет атомарный compare-and-set. */
  function dispatchGuard(page, expect, role) {
    if (taskState(page) !== "Running") return "карточка уже не Running";
    const run = rt(page.properties?.["Run ID"]);
    if (!expect.runId || !run || norm(run) !== norm(expect.runId)) return "Run ID карточки изменился или отсутствует";
    const owner = rt(page.properties?.["Recipient Agent ID"]);
    if (expect.roleId && norm(expect.roleId) !== norm(role.id)) return "ожидание адресовано другому агенту";
    if (role.fn === "Reviewer" && !owner) return "в карточке не указан адресат выдачи";
    if (owner && norm(owner) !== norm(role.id)) return "карточка выдана другому агенту";
    return "";
  }

  async function submitExecutor(role, expect, manual = false) {
    if (!expect || expect.kind !== "dispatch") {
      pause("Это не ход по карточке: ответ не записываю.", { kind: "handoff-kind", ref: expect?.ref || "" });
      return true;
    }
    const replies = messagesAfter(expect.watermark);
    const candidates = replies
      .map((m) => ({ ...m, result: parseMarker(m.raw, "CF_AGENT_RESULT") || parseMarker(m.raw, "CF_REVIEW_RESULT") }))
      .filter((m) => m.result);
    const exact = candidates.filter((m) => norm(m.result.dispatch_id) === norm(expect.ref));
    let hit = (role.fn === "Reviewer" ? candidates : exact.length ? exact : candidates).at(-1);
    if (!hit) {
      // Напоминания исчерпаны — дальше пауза не помогает: работа сделана, а
      // страдает только формат. Читаем ответ по тексту, но обязательно с id
      // этой выдачи и номером PR: иначе за результат сойдёт любая реплика.
      const last = messagesAfter(expect.watermark).at(-1);
      const loose =
        role.fn !== "Reviewer" && last && Number(expect.tries) >= C.markerReminders
          ? looseResult(last.raw, role, expect)
          : null;
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
    if (!hit) {
      // Отказ среды, а не молчание агента: ветка прошлого хода слита, и новый
      // прогон в ней невозможен. Напоминания и пауза «нет маркера» здесь
      // бессмысленны — сначала Continue и одна повторная выдача (27.10, NAR-4.9).
      const lastReply = messagesAfter(expect.watermark || "").at(-1);
      if (
        lastReply &&
        !stillWorking() &&
        staleBranchRefusal(lastReply.raw) &&
        retryStaleBranchHandoff(expect)
      ) {
        // Отправляем прямо здесь: шаг уже выполняется, отложенный тик съел бы
        // сторож блокировки (та же причина, что у переотправки после ошибки).
        const again = await consumePending(true);
        if (!again) {
          log(
            "Повторная выдача не началась на этой странице — задание в очереди и уйдёт следующим шагом.",
            true,
            { ntfy: "quiet" },
          );
        }
        return true;
      }
      return markerMissing(role, expect, "CF_AGENT_RESULT", manual);
    }

    const review = role.fn === "Reviewer" ? reviewerDispatchEvidence(replies, hit, expect) : null;
    if (review?.error) {
      pause(`Ответ Reviewer не привязан к текущей выдаче: ${review.error}. Карточку и миссию не меняю.`, {
        kind: "marker-mismatch", ref: expect.ref, runId: expect.runId || "",
      });
      return true;
    }
    const { result, stray } = adoptIds(hit.result, expect);
    if (stray.length) {
      log(
        `В маркере чужой или битый id (${stray.join(", ")}) — беру свой из выдачи. Работа не потерялась.`,
        false,
        { ntfy: false },
      );
    }
    if (GM_getValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, false)) {
      const waiting = GM_getValue(K.expect, null);
      if (waiting && norm(waiting.ref) === norm(expect.ref) && norm(waiting.runId) === norm(expect.runId)) {
        GM_setValue(K.expect, null);
      }
      return false;
    }
    if (!currentDispatch(expect)) {
      pause("Ожидание выдачи изменилось: чужой ход не перезаписываю.", {
        kind: "dispatch-changed", ref: expect.ref, runId: expect.runId || "",
      });
      return true;
    }

    const page = await notion("GET", `pages/${result.dispatch_id}`);
    const guard = dispatchGuard(page, expect, role);
    if (guard) {
      const onCard = rt(page.properties?.["Run ID"]);
      const waiting = GM_getValue(K.expect, null);
      if (taskState(page) !== "Running" && onCard && norm(onCard) === norm(expect.runId) &&
          waiting && norm(waiting.ref) === norm(expect.ref) && norm(waiting.runId) === norm(expect.runId)) {
        GM_setValue(K.expect, null);
        log("Эта выдача уже не Running — повторная запись не нужна, ожидание снято.");
        return false;
      }
      pause(`Ответ не записан: ${guard}. Новую выдачу не перезаписываю.`, {
        kind: "dispatch-changed", ref: expect.ref, runId: expect.runId || "",
      });
      return true;
    }
    let reviewMission = null;
    if (role.fn === "Reviewer") {
      // Старая версия ожидания могла не хранить missionId; тогда нужна именно
      // текущая активная миссия и совпадение её названия с полем карточки.
      const mission = expect.missionId
        ? await notion("GET", `pages/${expect.missionId}`)
        : await activeMission();
      const state = mission?.properties?.["Состояние"]?.select?.name || "";
      const cardMission = rt(page.properties?.["Миссия"]).trim();
      const name = rt(mission?.properties?.["Миссия"]).trim();
      const matches = mission && cardMission &&
        (norm(cardMission) === norm(mission.id) || missionSame(cardMission, name));
      if (!matches || !["Активна", "Возвращена"].includes(state) ||
          (expect.missionId && norm(mission.id) !== norm(expect.missionId)) ||
          (review?.decision?.mission_id && norm(review.decision.mission_id) !== norm(mission.id))) {
        pause("Миссия карточки Reviewer не совпадает с активным ходом или уже закрыта: ничего не принимаю. " +
          "Сверьте миссию, карточку и Run ID.", {
          kind: "dispatch-mission", ref: expect.ref, runId: expect.runId || "",
        });
        return true;
      }
      reviewMission = mission;
      if (/\bCF_REVIEW_RESULT\b/i.test(rt(page.properties?.["Acceptance"])) && !review?.decision) {
        return markerMissing(role, expect, "CF_REVIEW_RESULT", manual);
      }
    }
    // `"question":null` — это «вопроса нет», а не «вопрос без варианта».
    const asked = questionInMarker(result.question, "Работа идёт по решению исполнителя");
    if (asked.kind === "asked") {
      await askQuestion(asked.question, {
        roleName: role.name,
        card: taskTitle(page),
        mission: rt(page.properties["Миссия"]),
        key: `${result.dispatch_id}:${result.run_id}`,
      });
    } else if (asked.kind === "text") {
      // Вопрос написан, а варианта по умолчанию нет. Раньше он выбрасывался:
      // Мастер видел громкую ошибку и не видел вопроса. Записываем с честным
      // вариантом — работа и так идёт по решению исполнителя.
      log(
        `Вопрос исполнителя пришёл без варианта по умолчанию — записан с вариантом «${asked.question.fallback}»: ответ Мастера дойдёт следующим ходом.`,
        false,
        { ntfy: "quiet", title: "Narthex: вопрос без варианта по умолчанию" },
      );
      await askQuestion(asked.question, {
        roleName: role.name,
        card: taskTitle(page),
        mission: rt(page.properties["Миссия"]),
        key: `${result.dispatch_id}:${result.run_id}`,
      });
    }
    // Журнал собирается из всего хода: ответ мог прийти частями — отчёт первым
    // сообщением, маркер отдельным после напоминания. Маркер без отчёта в журнал
    // не пишем вовсе: именно такая запись и обманула Координатора на NAR-1.8.
    const answer = runAnswer(expect, hit);
    if (answer.body < C.minAnswerChars) {
      log(`В ответе ${role.name} только маркер, отчёта нет — в журнал не пишу.`, true);
      return markerMissing(role, expect, "CF_AGENT_RESULT", manual, "thin");
    }
    const declaredLog = rt(page.properties["Output Drive File ID"]);
    if (!declaredLog) throw new Error("В карточке нет Output Drive File ID.");
    const marker = `<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id} -->`;
    const partsNote = answer.parts > 1 ? `_Ответ собран из ${answer.parts} сообщений хода._\n\n` : "";
    // Ссылку на журнал мог переписать агент: пишем в журнал выдачи, а не в то,
    // что окажется в поле (NAR-2.13, D-071).
    const { wrote, logId } = await appendToJournal(
      result.dispatch_id,
      result.run_id,
      declaredLog,
      marker,
      `\n\n${marker}\n## Ответ ${role.name}\n\n${partsNote}${answer.text}\n`,
    );
    if (wrote && wrote.duplicate) {
      log("Ответ уже был в журнале Drive (маркер этой же выдачи) — второй раз не пишу, оформляю карточку.");
    }

    // Аудитор и Reviewer не открывают PR: по карточке приёмки тоже нечего
    // мержить. Исполнитель может явно сказать то же самое через `pr: null`.
    const noPr = role.fn === "Auditor" || role.fn === "Reviewer" || prDeclined(result);
    const merged = noPr ? "none" : await ensureMerged(page, result);
    // После записи в Drive или долгой проверки PR карточку могли перевыдать.
    // Ещё раз читаем состояние, run, владельца и миссию перед любой её правкой.
    const current = await notion("GET", `pages/${result.dispatch_id}`);
    const changed = dispatchGuard(current, expect, role);
    let changedMission = false;
    if (reviewMission) {
      const latestMission = await notion("GET", `pages/${reviewMission.id}`);
      const latestState = latestMission?.properties?.["Состояние"]?.select?.name || "";
      const cardMission = rt(current.properties?.["Миссия"]).trim();
      const missionName = rt(latestMission?.properties?.["Миссия"]).trim();
      changedMission = !["Активна", "Возвращена"].includes(latestState) || !cardMission ||
        !(norm(cardMission) === norm(latestMission.id) || missionSame(cardMission, missionName));
    }
    if (changed || changedMission || !currentDispatch(expect)) {
      pause(`Ответ записан в журнал, но карточка, миссия или ожидание успели измениться (${changed || (changedMission ? "миссия" : "ожидание")}). ` +
        "Статус не перезаписываю; сверить выдачу нужно вручную.", {
        kind: "dispatch-changed", ref: expect.ref, runId: expect.runId || "",
      });
      return true;
    }
    // Что решила проверка — запоминаем до записи в Notion. Если она ошиблась,
    // 🐙 → «Вернуть карточку» перепроверит GitHub и вернёт Submitted, не гоняя
    // исполнителя по второму кругу.
    GM_setValue(K.lastResult, {
      at: Date.now(),
      dispatch_id: result.dispatch_id,
      run_id: result.run_id,
      pr: result.pr ?? null,
      merged: result.merged === true,
      task: taskTitle(page),
      logId,
      roleId: role.id,
      roleName: role.name,
      verdict: merged,
      why: (lastMergeCheck && lastMergeCheck.why) || "",
      result: {
        pr: result.pr ?? null,
        merged: result.merged === true,
        status: result.status ?? null,
        report: result.report ?? null,
      },
    });
    if (!noPr && lastMergeCheck && lastMergeCheck.needsToken) GM_setValue(K.ghAsk, Date.now());
    if (prDeclined(result) && role.fn !== "Auditor" && role.fn !== "Reviewer") {
      log(
        `PR не ждём: ${role.name} заявил работу без PR (pr: null) — принято по отчёту, ` +
          "кнопки Create/Merge не трогал.",
      );
    }

    // Заявка о мерже не подтвердилась по GitHub: агент написал «слит», а PR
    // открыт, закрыт без мержа или его нет вовсе. Это не «PR закрыт» — это
    // работа, которой в main нет, поэтому карточка идёт в Rework с причиной.
    if (merged === "claim-rejected") {
      const why = (lastMergeCheck && lastMergeCheck.why) || "состояние PR не подтвердилось";
      const reason =
        `Исполнитель заявил, что PR слит, но GitHub говорит другое: ${why}. ` +
        "Работа в main не попала — нужна повторная выдача.";
      try {
        await gateway("append", logId, {
          marker: `<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id}:claim-rejected -->`,
          entry: `\n\n<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id}:claim-rejected -->\n## Заявка о мерже не подтвердилась\n\n${reason}\n`,
        });
      } catch (e) {
        log(`Причина не записана в лог: ${e.message}`, true);
      }
      await patch(result.dispatch_id, {
        "Dispatch State": { select: { name: "Rework" } },
        "Ответ": { rich_text: richText(`${reason} Ответ ${hit.id} в логе ${logId}.`) },
      });
      GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
      log(`«${taskTitle(page)}» → Rework: заявка о мерже не подтвердилась (${why}).`, true, {
        tone: "warn",
      });
      const coord = (await roles()).find((r) => r.fn === "Coordinator");
      if (!coord) throw new Error("Нет активного Coordinator.");
      if (currentDispatch(expect)) GM_setValue(K.expect, null);
      await goTo(coord);
      return true;
    }

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
        "Ответ": { rich_text: richText(`${reason} Ответ ${hit.id} в логе ${logId}.`) },
      });
      GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
      log(`«${taskTitle(page)}» → Rework: PR закрыт без мержа.`);
      const coord = (await roles()).find((r) => r.fn === "Coordinator");
      if (!coord) throw new Error("Нет активного Coordinator.");
      if (currentDispatch(expect)) GM_setValue(K.expect, null);
      await goTo(coord);
      return true;
    }

    if (merged === "timeout")
      throw new Error(`PR по «${taskTitle(page)}» не слит за отведённое время. Проверьте страницу Arena.`);

    const props = {
      "Dispatch State": { select: { name: "Submitted" } },
      "Ответ": { rich_text: richText(`${review?.verdict ? `Вердикт Reviewer по карточке: ${review.verdict}. ` : ""}Ответ ${hit.id} записан в лог ${logId}.`) },
      "Submitted At": { date: { start: nowIso() } },
    };
    if (typeof result.check === "number") props["Check"] = { select: { name: result.check === 0 ? "pass" : "fail" } };
    if (result.report) props["Report SHA"] = { rich_text: [{ type: "text", text: { content: String(result.report).slice(0, 200) } }] };
    const link = prUrl(result.pr);
    if (link) props["PR"] = { url: link };
    // Время записи ответа глазами Notion: по нему потом видно, трогал ли
    // карточку кто-то ещё (Rework → Ready). Часы браузера и Notion разные,
    // поэтому запоминаем именно ответ сервера.
    rememberAnswerStamp(result.dispatch_id, await patch(result.dispatch_id, props));
    GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
    log(
      noPr
        ? `Ответ ${role.name} записан${review?.verdict ? ` (вердикт: ${review.verdict})` : ""}, PR не нужен, задача → Submitted.`
        : `Ответ ${role.name} записан, PR ${merged === "claimed" ? "слит (по маркеру)" : "слит"}, задача → Submitted.` +
            (link ? ` PR: ${link}` : " (номер PR не указан в маркере)"),
    );

    if (!currentDispatch(expect)) {
      log("Карточка оформлена, но ожидание уже сменилось — новый ход не трогаю.", true, { ntfy: "quiet" });
      return true;
    }
    GM_setValue(K.expect, null);
    if (review?.verdict === "master") {
      pause(`Reviewer просит Мастера: ${firstLine(review.decision.reason || review.decision.remarks || "причина не указана")}. ` +
        "Ответ записан в журнал, карточка Submitted; миссия не закрыта.", {
        kind: "review-needs-master", ref: expect.ref, runId: expect.runId,
      });
      return true;
    }
    const co = (await roles()).find((r) => r.fn === "Coordinator");
    if (!co) throw new Error("Нет активного Coordinator.");
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
  /**
   * Карточки в Running, по которым у транспорта нет хода.
   *
   * В Running карточку ставит только транспорт (`dispatchTask`) — тем самым он
   * берёт её в работу. Значит Running без живого ожидания означает, что работу
   * никто не ведёт: скрипт про неё забыл (сброс кнопкой ↺, обновление, чужой
   * браузер), а в очереди она выглядит как ход. Координатор видит «1 Running»,
   * считает, что работа идёт, и выдаёт вместо неё следующую карточку — а эта
   * висит до 45 минут и потом всё равно возвращается.
   *
   * 28.10 так и вышло: ↺ снял ожидание, NAR-5.3 осталась Running, и новый ход
   * ушёл Architect'у. Теперь такие карточки возвращаются в Ready сразу — до
   * того, как Координатор увидит очередь.
   *
   * Не трогаем три вещи:
   *  • карточку текущего хода — по ней скрипт правда ждёт ответа;
   *  • всё, пока идёт отправка (`K.pending`) или транспорт занят другим ходом
   *    (ответ приёмки, вопрос, план): тогда «без хода» — наша невнимательность,
   *    а не факт;
   *  • карточку, выданную только что (`orphanGraceMs`) — ход мог уйти из
   *    другой вкладки, и `K.expect` ещё не перечитан.
   *
   * Возвращает список возвращённых карточек (для журнала и проб).
   */
  async function sweepOrphans(mission, cards = null) {
    if (!mission || GM_getValue(K.pending, null)) return [];
    const expect = GM_getValue(K.expect, null);
    if (expect && Number(expect.sentAt) && expect.kind !== "dispatch") return [];
    const live = expect && expect.kind === "dispatch" && expect.ref ? norm(expect.ref) : "";
    const running = cards || (await tasks("Running", mission));
    const swept = [];
    for (const card of running) {
      if (live && norm(card.id) === live) continue;
      const started = card.properties?.["Started At"]?.date?.start;
      const age = started ? Date.now() - Date.parse(started) : Number.POSITIVE_INFINITY;
      if (age < C.orphanGraceMs) continue;
      // `rollbackProps` сам откажется, если карточка уже отвечена («Submitted
      // At», «PR») или её Run ID сменился: чужой ход не снимаем.
      const props = rollbackProps(card, rt(card.properties?.["Run ID"]));
      if (!props) continue;
      try {
        await patch(card.id, props);
      } catch (e) {
        log(`«${taskTitle(card)}» висит в Running без хода, но статус не снялся: ${e.message}.`, true);
        continue;
      }
      GM_setValue(answerStampKey(card.id), "");
      swept.push(card);
      const how = Number.isFinite(age) ? `${Math.round(age / 60000)} мин` : "неизвестно сколько";
      log(
        `«${taskTitle(card)}» висит в Running ${how} без хода скрипта — вернул в Ready: ` +
          "ожидания по ней нет, работа по ней не идёт.",
        false,
        { tone: "warn", ntfy: "quiet", title: "Narthex: карточка возвращена в Ready" },
      );
    }
    return swept;
  }

  async function releaseStalled(mission) {
    // Идёт отправка — не наше дело, что там на часах.
    if (GM_getValue(K.pending, null)) return;
    const running = await tasks("Running", mission);
    // Сироты — до всех отсчётов: карточка без хода не работает ни секунды, и
    // ждать 45 минут ей незачем. Список передаём тот же, второй раз Notion не
    // читаем.
    const swept = new Set((await sweepOrphans(mission, running) || []).map((card) => norm(card.id)));
    const expect = GM_getValue(K.expect, null);
    for (const card of running) {
      // Карточку уже вернул `sweepOrphans`: второй раз её не читаем.
      if (swept.has(norm(card.id))) continue;
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

  // ───────────────────────────── вопросы к Мастеру ─────────────────────────────
  /**
   * Вопрос — не остановка.
   *
   * 25.10 фаза 2 дала два вопроса к Мастеру, и оба «потерялись»: один жил
   * строкой в поле «Ответ» карточки, второй — предложением выбрать между двумя
   * вариантами в конце хода. Регламент (`freedom.md`) запрещал вопросы вообще, а
   * единственной законной остановкой была «нет роли». Итог: либо вопрос терялся,
   * либо стоил всего цикла — третьего не было.
   *
   * Теперь у вопроса есть место и цена. Агент пишет его полем `question` в
   * маркере и обязан назвать вариант по умолчанию: транспорт записывает строку в
   * базу «Вопросы», цикл идёт дальше по этому варианту, ответ Мастера приходит
   * на следующем ходе. Без варианта по умолчанию вопрос не принимается — иначе
   * это не вопрос, а остановка.
   */
  const Q = { wait: "Ждёт", done: "Решено", byDefault: "Принят дефолт", cancelled: "Отменён" };

  /**
   * Вопросы к Мастеру: счётчик на панели и громкий пуш о новом.
   *
   * 25.10 Мастер заметил: вопрос в Notion легко пропустить, а рядом со знаком
   * «?» на панели не было ни числа, ни подсказки. Теперь счётчик открытых
   * вопросов висит на самой кнопке, подсказка перечисляет первые три, а каждый
   * новый вопрос даёт громкое уведомление в ntfy — ровно один раз: id
   * запоминаются. Снимок списка лежит в ScriptCat, поэтому панель показывает
   * число сразу после загрузки страницы, ещё до запроса в Notion.
   *
   * Опрос — не чаще раза в questionCheckMs (10 минут): Notion не любит лишних
   * запросов, а вопрос, который ждёт сутки, за десять минут не изменится.
   * Вопрос, который задал сам скрипт, уходит в пуш сразу из `askQuestion`.
   */
  const qText = (row) => row.text ?? rt(row?.properties?.["Вопрос"]);
  const qFallback = (row) => row.fallback ?? rt(row?.properties?.["По умолчанию"]);

  function openQuestions() {
    const cache = GM_getValue("cfn-q-open", null);
    return cache && Array.isArray(cache.rows) ? cache : { at: 0, rows: [] };
  }

  function paintQuestions(rows) {
    // Пробы вызывают вопросы в Node: без DOM панели нет, и это не ошибка.
    if (typeof document === "undefined") return;
    const list = rows || [];
    const badge = document.getElementById(ui.qBadge);
    if (badge) {
      badge.textContent = list.length ? String(list.length) : "";
      badge.style.display = list.length ? "inline-block" : "none";
    }
    const button = document.getElementById(ui.questions);
    if (!button) return;
    const shown = list.slice(0, 3).map((row) => {
      const fallback = qFallback(row);
      return `«${qText(row)}»${fallback ? ` (по умолчанию: ${fallback})` : ""}`;
    });
    button.title = list.length
      ? `Открытых вопросов к Мастеру: ${list.length}. ${shown.join("; ")}${
          list.length > 3 ? `; и ещё ${list.length - 3}` : ""
        }. Нажмите, чтобы открыть базу «Вопросы».`
      : "Вопросов к Мастеру нет — база «Вопросы» в Notion";
    button.style.background = list.length ? "#3a3320" : "#242833";
    button.style.borderColor = list.length ? "#8a6b2a" : "#343a46";
    // Свёрнутая панель показывает те же числа на своей кнопке: вопрос не
    // должен потеряться только потому, что окно сжали.
    if (typeof paintPanelChrome === "function") paintPanelChrome();
  }

  /**
   * Отметить только что созданный вопрос: снимок для панели, память о
   * показанном. Сбой здесь не должен стоить вопроса — поэтому глушим его.
   */
  function noteQuestionAsked(row, q) {
    try {
      const cache = openQuestions();
      if (!questionsSeen()) rememberQuestionSeen(cache.rows.map((item) => item.id));
      rememberQuestionSeen([row.id]);
      GM_setValue("cfn-q-open", {
        at: cache.at || Date.now(),
        rows: [
          ...cache.rows.filter((item) => item.id !== row.id),
          { id: row.id, text: q.text, fallback: q.fallback, due: row.properties?.["Срок"]?.date?.start || "" },
        ],
      });
      paintQuestions(openQuestions().rows);
    } catch (e) {
      // Счётчик — удобство, а не работа: молча продолжаем.
    }
  }

  function questionsSeen() {
    const seen = GM_getValue("cfn-q-seen", null);
    return Array.isArray(seen) ? seen : null;
  }

  function rememberQuestionSeen(ids) {
    const seen = questionsSeen() || [];
    GM_setValue("cfn-q-seen", [...seen, ...(ids || []).filter((id) => !seen.includes(id))].slice(-200));
  }

  /**
   * Новый вопрос — громкий пуш. Первый запуск не будит Мастера пачкой старых:
   * он только запоминает их и пишет число в журнал.
   */
  function notifyNewQuestions(rows) {
    const seen = questionsSeen();
    if (!seen) {
      rememberQuestionSeen((rows || []).map((row) => row.id));
      if ((rows || []).length) log(`Открытых вопросов к Мастеру: ${rows.length}. Смотрите базу «Вопросы».`);
      return 0;
    }
    const fresh = (rows || []).filter((row) => !seen.includes(row.id));
    if (!fresh.length) return 0;
    rememberQuestionSeen(fresh.map((row) => row.id));
    for (const row of fresh.slice(0, 3)) {
      const fallback = qFallback(row);
      log(
        `Новый вопрос: «${qText(row)}»${fallback ? ` — по умолчанию: ${fallback}` : ""}. Отвечает приёмка.`,
        false,
        { ntfy: "quiet", title: "Narthex: новый вопрос" },
      );
    }
    if (fresh.length > 3) {
      log(`И ещё ${fresh.length - 3} новых вопроса — откройте базу «Вопросы».`, false, {
        ntfy: "quiet",
        title: "Narthex: вопросы",
      });
    }
    return fresh.length;
  }

  /**
   * Обновить снимок открытых вопросов. Здесь же закрываются по сроку те, у
   * кого вариант по умолчанию уже наступил: это бухгалтерия, а не работа
   * цикла, поэтому она идёт и на паузе.
   */
  async function refreshQuestions({ force = false, quiet = false } = {}) {
    // Отложенные вопросы повторяются здесь же: проверка идёт и на паузе, а
    // вопрос, который ждёт Мастера, не должен зависеть от хода цикла.
    try {
      await flushQuestionQueue();
    } catch (e) {
      dbg("вопросы: очередь не обработана", e.message);
    }
    const cache = openQuestions();
    if (!force && Date.now() - cache.at < C.questionCheckMs) {
      paintQuestions(cache.rows);
      return cache.rows;
    }
    try {
      const rows = await questionRows([Q.wait]);
      let closed = new Set();
      const active = await activeMission().catch(() => null);
      if (active) {
        const wanted = rt(active.properties["Миссия"]).trim();
        const mine = rows.filter((row) => {
          const value = rt(row.properties["Миссия"]).trim();
          return !value || missionSame(value, wanted);
        });
        const due = expiredQuestions(mine).filter((row) => rt(row.properties["По умолчанию"]));
        await closeExpired(due);
        closed = new Set(due.map((row) => row.id));
        // Строка «Ждёт» без ответа — вопрос, который ещё не передавали
        // приёмке. Проверка идёт при каждой загрузке страницы, поэтому вопрос,
        // созданный прошлой версией (или агентом без очереди), тоже доходит:
        // 28.10 строка про NAR-5 висела с 15:41 и до приёмки не дошла.
        const adopted = mine.filter(
          (row) =>
            !closed.has(row.id) &&
            !rt(row.properties["Ответ"]).trim() &&
            !GM_getValue(answerHandoffKey(row.id), 0),
        );
        for (const row of adopted) {
          handWaitingRow(row, questionFromRow(row), {
            roleName: "Narthex (транспорт)",
            mission: wanted,
          });
        }
        if (adopted.length) {
          log(
            `Вопросов «Ждёт» без ответа, которые не передавались приёмке: ${adopted.length} — поставил в очередь, ` +
              "она ответит на ближайшем шаге.",
            false,
            { ntfy: "quiet", title: "Narthex: вопрос передан приёмке" },
          );
        }
      }
      const open = rows
        .filter((row) => !closed.has(row.id))
        .map((row) => ({
          id: row.id,
          text: qText(row),
          fallback: qFallback(row),
          due: row.properties?.["Срок"]?.date?.start || "",
        }));
      GM_setValue("cfn-q-open", { at: Date.now(), rows: open });
      paintQuestions(open);
      if (!quiet) notifyNewQuestions(open);
      return open;
    } catch (e) {
      dbg("вопросы: список не обновлён", e.message);
      paintQuestions(cache.rows);
      return cache.rows;
    }
  }

  let questionsWatch = 0;
  function watchQuestions() {
    if (questionsWatch) return;
    questionsWatch = window.setInterval(() => refreshQuestions().catch(() => {}), C.questionCheckMs);
    refreshQuestions().catch(() => {});
  }


  /** Одна строка без переводов и лишних пробелов — Notion не любит простыни. */
  const oneLine = (value, max) =>
    String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);

  /**
   * Вариант ответа из маркера — строкой.
   *
   * 28.10 поле «Варианты» в «Вопросах» содержало «[object Object] ·
   * [object Object]»: агент прислал варианты объектами, а транспорт склеил их
   * через `String`. Объект без подписи — не вариант: читаем известные поля.
   */
  const optionLabel = (option) => {
    if (option == null) return "";
    if (typeof option === "string" || typeof option === "number") return String(option);
    if (typeof option !== "object") return String(option);
    for (const key of ["label", "text", "title", "name", "value", "id"]) {
      const value = option[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  /**
   * Заголовок вопроса: 180 символов в таблице «Вопросы» — предел читаемости.
   *
   * Раньше текст резался молча (`slice(0, 180)`), и Мастер видел оборванную на
   * полуслове фразу, не зная, что она короче исходной: 27.10 две карточки имели
   * ровно 180 символов и обрывались на «…(сейчас это да». Теперь рез идёт по
   * границе слова, а многоточие прямо говорит, что текст длиннее. Сам текст
   * целиком уходит в тело страницы (`appendQuestionBody`), а не теряется.
   */
  const questionTitle = (value, max) => {
    const flat = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    const head = (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd();
    return `${head}…`;
  };

  /**
   * Разбор поля `question` из маркера. `null` — вопроса нет.
   *
   * Жёстко только необходимое: текст и вариант по умолчанию. Остальное —
   * подробности для Мастера, их отсутствие вопрос не отменяет.
   */
  function parseQuestion(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const text = questionTitle(raw.text, C.questionTextMax);
    const fullText = oneLine(raw.text, C.questionTextFull);
    const fallback = oneLine(optionLabel(raw.default), C.questionDefaultMax);
    if (!text || !fallback) return null;
    const options = Array.isArray(raw.options)
      ? raw.options.map((option) => oneLine(optionLabel(option), 80)).filter(Boolean).slice(0, 4)
      : [];
    const hours = Number(raw.hours);
    return {
      text,
      fullText,
      fallback,
      options,
      blocks: oneLine(raw.blocks, 200),
      hours: Number.isFinite(hours) && hours >= 1 ? Math.min(hours, 168) : C.questionHours,
    };
  }

  /**
   * Что на самом деле пришло в поле `question`.
   *
   * `"question":null` — обычный способ сказать «вопроса нет»: поле пишут явно,
   * чтобы маркер был полным. Пока проверка была на `!== undefined`, такой
   * маркер давал громкую ошибку «вопрос без варианта по умолчанию» при том,
   * что вопроса не было (25.10, NAR-2.15: `"question":null`, ошибка Мастеру).
   *
   *   none  — вопроса нет: поля нет, `null`, пустая строка, объект без текста;
   *   asked — вопрос с текстом и вариантом по умолчанию;
   *   text  — вопрос написан, а варианта по умолчанию нет.
   *
   * Вопрос из `text` не выбрасывается: он попадает в базу с честным вариантом
   * по умолчанию — тем, по которому работа и так идёт. Иначе Мастер получает
   * ошибку вместо вопроса.
   */
  function questionInMarker(raw, fallback) {
    if (raw === undefined || raw === null) return { kind: "none" };
    const obj = typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const rawText = typeof raw === "string" ? raw : obj.text;
    const text = questionTitle(rawText, C.questionTextMax);
    if (!text) return { kind: "none" };
    const asked = parseQuestion(raw);
    if (asked) return { kind: "asked", question: asked };
    const options = Array.isArray(obj.options)
      ? obj.options.map((option) => oneLine(optionLabel(option), 80)).filter(Boolean).slice(0, 4)
      : [];
    const hours = Number(obj.hours);
    return {
      kind: "text",
      question: {
        text,
        fullText: oneLine(rawText, C.questionTextFull),
        options,
        blocks: oneLine(obj.blocks, 200),
        hours: Number.isFinite(hours) && hours >= 1 ? Math.min(hours, 168) : C.questionHours,
        fallback: oneLine(optionLabel(fallback), C.questionDefaultMax) || "Работа идёт по решению агента",
      },
    };
  }

  /** Срок: когда молчание Мастера превращается в вариант по умолчанию. */
  const questionDeadline = (hours, now = Date.now()) => new Date(now + hours * 3_600_000).toISOString();

  /** Открытые вопросы, у которых срок уже вышел. */
  function expiredQuestions(rows, now = Date.now()) {
    return (rows || []).filter((row) => {
      if (sel(row.properties?.["Статус"]) !== Q.wait) return false;
      const due = row.properties?.["Срок"]?.date?.start || "";
      return Boolean(due) && Date.parse(due) < now;
    });
  }

  /** Строка об открытых вопросах: чтобы Координатор не задавал их снова. */
  function openQuestionsLine(rows) {
    const all = rows || [];
    if (!all.length) return "";
    const shown = all
      .slice(0, C.questionLineMax)
      .map((row) => `«${rt(row.properties["Вопрос"])}» (по умолчанию: ${rt(row.properties["По умолчанию"])})`);
    const more = all.length > shown.length ? `; и ещё ${all.length - shown.length}` : "";
    return (
      `Вопросы к Мастеру без ответа: ${shown.join("; ")}${more}. ` +
      "Ответ придёт на следующем ходе — не задавай их снова и не останавливайся."
    );
  }

  /** Строка с ответами Мастера, которые агенту ещё не показывали. */
  function answersLine(rows) {
    const all = rows || [];
    if (!all.length) return "";
    const shown = all.slice(0, C.questionLineMax).map((row) => {
      const byDefault = sel(row.properties["Статус"]) === Q.byDefault;
      const answer = rt(row.properties["Ответ"]);
      return `«${rt(row.properties["Вопрос"])}» → ${answer}${byDefault ? " (срок истёк, принят вариант по умолчанию)" : ""}`;
    });
    const more = all.length > shown.length ? `; и ещё ${all.length - shown.length}` : "";
    return `Ответы Мастера на вопросы — учти их в этом ходе: ${shown.join("; ")}${more}.`;
  }

  /** Свойства строки базы «Вопросы». */
  function questionProps(q, ctx = {}) {
    const text = (value) => ({ rich_text: richText(value) });
    const props = {
      "Вопрос": { title: [{ type: "text", text: { content: q.text } }] },
      "Статус": { select: { name: Q.wait } },
      "По умолчанию": text(q.fallback),
      "Срок": { date: { start: questionDeadline(q.hours) } },
      "Роль": text(ctx.roleName || ""),
      "Карточка": text(ctx.card || "—"),
      "Миссия": text(ctx.mission || ""),
    };
    if (q.blocks) props["Что блокирует"] = text(q.blocks);
    if (q.options.length) props["Варианты"] = text(q.options.join(" · "));
    return props;
  }

  /**
   * Полный текст вопроса — в тело страницы.
   *
   * Заголовок «Вопрос» живёт в таблице и режется до 180 символов; тело страницы
   * ограничено только размером одного rich_text-объекта (2000 знаков), поэтому
   * длинный вопрос сохраняется целиком. Ошибка этой записи вопрос не отменяет:
   * строка в базе уже создана, агент уже идёт по варианту по умолчанию.
   */
  async function appendQuestionBody(row, q) {
    const full = String(q?.fullText || "").trim();
    if (!row?.id || !full || full.length <= String(q?.text || "").length) return;
    // Режется тем же `richText`, что и «Ответ»: одно правило на весь файл, и
    // эмодзи на границе части остаётся целым (1.4.85).
    const chunks = richText(full);
    try {
      await notion("POST", `blocks/${row.id}/children`, {
        children: [
          {
            object: "block",
            type: "heading_3",
            heading_3: { rich_text: [{ type: "text", text: { content: "Полный текст вопроса" } }] },
          },
          { object: "block", type: "paragraph", paragraph: { rich_text: chunks } },
        ],
      });
    } catch (e) {
      dbg("вопросы: полный текст не записался", e.message);
    }
  }

  /**
   * Записать вопрос в базу. Ошибка Notion ход не срывает: агент уже идёт по
   * варианту по умолчанию, а строка нужна Мастеру, а не циклу.
   */
  /**
   * Вопрос, который не записался, не теряется.
   *
   * 25.10 в 21:28 Координатор задал вопрос о пределе руководства, а строки в
   * «Вопросах» не появилось: база показала 0 «Ждёт». Вопрос жил только в
   * маркере — Мастер увидел его лишь случайно, а ❓ и пуш молчали. Notion не
   * любит отвечать быстро и иногда отказывает; запись, которая уже не
   * повторится, — потерянный вопрос. Поэтому неудача складывается в очередь и
   * повторяется при следующей проверке вопросов.
   */
  function queueQuestion(q, ctx = {}) {
    const stored = GM_getValue(K.qQueue, []);
    const list = Array.isArray(stored) ? stored : [];
    const sameText = norm(q?.text);
    if (sameText && list.some((item) => norm(item?.q?.text) === sameText)) return;
    list.push({ q, ctx, at: Date.now() });
    GM_setValue(K.qQueue, list.slice(-10));
  }

  async function flushQuestionQueue() {
    const stored = GM_getValue(K.qQueue, []);
    const list = Array.isArray(stored) ? stored : [];
    if (!list.length) return 0;
    const left = [];
    let saved = 0;
    for (const item of list) {
      if (!item || !item.q || !item.q.text) continue;
      // Пока вопрос лежал в очереди, Мастер мог уже ответить на такой же (или на
      // тот же ADR) — тогда не пишем и не будим.
      const same = await sameQuestionRow(item.q.text);
      if (same) {
        // Строка «Ждёт» без «Ответа» — это не «вопрос уже задан», а вопрос,
        // который никто не передал приёмке (1.4.82). Молча пропустить его
        // значит потерять его совсем: так NAR-5 висел с 15:41.
        const handled = handWaitingRow(same.row, item.q, item.ctx || {});
        log(
          handled
            ? `Отложенный вопрос «${item.q.text}» уже есть в «Вопросах» и ждёт без ответа — передаю приёмке, второй строки не пишу.`
            : `Отложенный вопрос «${item.q.text}» уже есть в «Вопросах» с ответом — не записываю второй раз.`,
          false,
          { ntfy: false },
        );
        continue;
      }
      try {
        const row = await notion("POST", "pages", {
          parent: { type: "data_source_id", data_source_id: C.questions },
          properties: questionProps(item.q, item.ctx || {}),
        });
        noteQuestionAsked(row, item.q);
        await appendQuestionBody(row, item.q);
        queueAnswer(row, item.q, item.ctx || {});
        saved += 1;
        log(`Отложенный вопрос записался: «${item.q.text}» — отвечает приёмка.`, false, {
          ntfy: "quiet",
          title: "Narthex: вопрос приёмке",
        });
      } catch (e) {
        left.push(item);
      }
    }
    GM_setValue(K.qQueue, left);
    if (left.length && saved === 0) {
      dbg("вопросы: очередь не ушла", left.length);
    }
    return saved;
  }

  /**
   * Ссылки на решения в тексте вопроса: `docs/decisions/NAR-2.14.md` и `NAR-2.14`.
   *
   * Номер миссии (`NAR-2`) сюда не попадает намеренно: по нему склеились бы
   * разные вопросы одной миссии.
   */
  const adrRefsOf = (text) => {
    const out = new Set();
    const src = String(text || "");
    for (const m of src.matchAll(/docs\/decisions\/([\w.-]+?)\.md/gi)) out.add(`file:${m[1].toLowerCase()}`);
    for (const m of src.matchAll(/\bNAR-\d+\.\d+(?:-[\wА-Яа-яЁё]+)?/gi)) out.add(`adr:${m[0].toLowerCase()}`);
    return out;
  };

  /**
   * Явная пометка «это не повтор»: по одному и тому же решению Мастера можно
   * спросить второй раз, если вопрос правда другой. Без пометки повтор про
   * уже решённый ADR не создаётся и не будит Мастера.
   */
  const followUpOf = (text) => /(уточнени|ещ[её] вопрос|новый вопрос|дополнительн|вдогонку)/i.test(String(text || ""));

  /** Варианты из строки «Вопросов» — строкой в ` · `, как их пишет `questionProps`. */
  const qOptions = (row) =>
    rt(row?.properties?.["Варианты"])
      .split("·")
      .map((item) => item.trim())
      .filter(Boolean);

  /**
   * Вопрос из самой строки «Вопросов» — без новой записи.
   *
   * Нужен, когда строка уже есть, а приёмка её не видела: повторной записи не
   * делаем, передаём то, что лежит в базе.
   */
  function questionFromRow(row) {
    const text = rt(row?.properties?.["Вопрос"]);
    const options = qOptions(row);
    const fallback = rt(row?.properties?.["По умолчанию"]);
    const blocks = rt(row?.properties?.["Что блокирует"]).trim();
    const full = [
      text,
      options.length ? `Варианты: ${options.join(" · ")}` : "",
      fallback ? `Вариант по умолчанию: ${fallback}` : "",
      blocks ? `Что блокирует: ${blocks}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { text, fullText: full, fallback, options, hours: 168 };
  }

  /** Отметка «эту строку приёмке уже передавали» — чтобы не гонять её кругом. */
  const answerHandoffKey = (id) => `cfn-q-handoff:${id}`;

  /**
   * Строка «Ждёт» без ответа — в очередь приёмки.
   *
   * 28.10 Мастер: «висит 1 открытый вопрос, ни то ни то не ушло к тебе». Так и
   * было: скрипт видел строку в «Вопросах», считал её уже заданной и не
   * передавал приёмке ни при создании, ни после. Строка «Ждёт» с пустым
   * «Ответом» — это долг транспорта, а не ответ Мастера.
   */
  function handWaitingRow(row, q = null, ctx = {}) {
    if (!row || !row.id) return false;
    if (sel(row.properties?.["Статус"]) !== Q.wait) return false;
    if (rt(row.properties?.["Ответ"]).trim()) return false;
    GM_setValue(answerHandoffKey(row.id), Date.now());
    queueAnswer(row, q || questionFromRow(row), ctx);
    return true;
  }

  /**
   * Такой вопрос уже есть в базе? Возвращает `{ row, why }` или null.
   *
   * 25.10 Мастер заметил: уведомления приходят о том, на что он уже ответил.
   * Причин было две — повторная запись того же вопроса (старый ход Координатора
   * применён второй раз) и другой текст про уже решённое решение («как решить
   * открытый ADR NAR-2.14.md?» при готовом ответе «принять F3–F5»). Поэтому
   * сравниваются и нормализованный текст, и ссылки на ADR.
   */
  async function sameQuestionRow(text) {
    const wanted = norm(text);
    if (!wanted) return null;
    const refs = adrRefsOf(text);
    try {
      const rows = await questionRows([Q.wait, Q.done, Q.byDefault]);
      for (const row of rows) {
        const raw = rt(row.properties["Вопрос"]);
        const got = norm(raw);
        if (!got) continue;
        if (got === wanted) return { row, why: "text" };
        const long = wanted.length >= 60 && got.length >= 60;
        if (long && (got.startsWith(wanted.slice(0, 60)) || wanted.startsWith(got.slice(0, 60)))) return { row, why: "text" };
        // Тот же вопрос другими словами: 25.10 про открытый ADR 2.14 спросили
        // второй раз («как решить…» вместо «принять или отклонить»), и Мастер
        // получил уведомление о том, на что уже ответил. Ссылка на решение —
        // достаточный признак: вопрос про тот же ADR уже задан.
        if (refs.size && !followUpOf(text)) {
          const seen = adrRefsOf(raw);
          const shared = [...refs].find((ref) => seen.has(ref));
          if (shared) return { row, why: "adr", ref: shared.replace(/^(adr|file):/, "") };
        }
      }
    } catch (e) {
      dbg("вопросы: дубль не проверен", e.message);
    }
    return null;
  }

  async function askQuestion(q, ctx = {}) {
    const key = `cfn-asked:${ctx.key || q.text}`;
    if (GM_getValue(key, false)) return null;
    const same = await sameQuestionRow(q.text);
    if (same) {
      const status = sel(same.row.properties?.["Статус"]);
      const answer = rt(same.row.properties?.["Ответ"]).replace(/\s+/g, " ").trim();
      GM_setValue(key, Date.now());
      const where = same.why === "adr" ? `По решению «${String(same.ref).toUpperCase()}»` : "Такой вопрос уже задан:";
      // Строка «Ждёт» с пустым «Ответом» — это вопрос, который не дошёл до
      // приёмки. Раньше он считался «Мастер уже ответил» и второй раз не
      // записывался: 28.10 строка про NAR-5 висела с 15:41 до вечера, а скрипт
      // писал, что отвечать нечего. Теперь такая строка передаётся приёмке.
      if (status === Q.wait && !answer) {
        handWaitingRow(same.row, q, ctx);
        log(`${where} строка есть, но она «Ждёт» без ответа: «${q.text}» — передаю приёмке, второй не пишу.`, false, {
          ntfy: false,
        });
        return same.row;
      }
      log(
        `${where} приёмка уже ответила${answer ? `: «${answer.slice(0, 140)}»` : ""} — второй раз не записываю и не уведомляю.`,
        false,
        { ntfy: false },
      );
      return null;
    }
    try {
      const row = await notion("POST", "pages", {
        parent: { type: "data_source_id", data_source_id: C.questions },
        properties: questionProps(q, ctx),
      });
      GM_setValue(key, Date.now());
      noteQuestionAsked(row, q);
      await appendQuestionBody(row, q);
      // Вопрос сразу ставится в очередь приёмки: она отвечает вместо Мастера
      // (1.4.80). Громкого пуша нет — вопрос больше не требует человека.
      queueAnswer(row, q, ctx);
      log(`Вопрос записан: «${q.text}». По умолчанию: ${q.fallback} — отвечает приёмка.`, false, {
        ntfy: "quiet",
        title: "Narthex: вопрос приёмке",
      });
      return row;
    } catch (e) {
      // Запись, которая уже не повторится, — потерянный вопрос: Мастер увидит
      // его только в маркере. Поэтому строка ждёт в очереди и повторяется.
      queueQuestion(q, ctx);
      log(
        `Вопрос к Мастеру в базу не записался (${e.message}). Строка отложена и повторится сама; ` +
          `пока агент идёт по варианту по умолчанию: ${q.fallback}.`,
        true,
      );
      return null;
    }
  }

  /** Отметить ответы доставленными — только после того, как промпт ушёл. */
  async function markDelivered(rows, now = Date.now()) {
    for (const row of rows || []) {
      try {
        await patch(row.id, { "Доставлено": { date: { start: new Date(now).toISOString() } } });
      } catch (e) {
        log(`Отметка о доставке ответа не записалась: ${e.message}`, true);
      }
    }
  }

  /** Срок вышел — закрываем вопрос вариантом по умолчанию, но не молча. */
  async function closeExpired(rows) {
    let closed = 0;
    for (const row of rows || []) {
      const fallback = rt(row.properties["По умолчанию"]);
      if (!fallback) continue;
      try {
        await patch(row.id, {
          "Статус": { select: { name: Q.byDefault } },
          "Ответ": { rich_text: richText(fallback) },
        });
        closed += 1;
        log(
          `Вопрос «${rt(row.properties["Вопрос"])}» ждал дольше срока — принят вариант по умолчанию: ${fallback}.`,
          false,
          { ntfy: "quiet", title: "Narthex: вопрос закрыт по умолчанию" },
        );
      } catch (e) {
        log(`Вопрос «${rt(row.properties["Вопрос"])}» не закрылся по сроку: ${e.message}`, true);
      }
    }
    return closed;
  }

  /** Строки базы «Вопросы» с нужным статусом, в пределах миссии. */
  async function questionRows(statuses, mission) {
    const rows = await query(C.questions, {
      or: statuses.map((name) => ({ property: "Статус", select: { equals: name } })),
    });
    const wanted = mission ? rt(mission.properties["Миссия"]).trim() : "";
    if (!wanted) return rows;
    return rows.filter((row) => {
      const value = rt(row.properties["Миссия"]).trim();
      return !value || missionSame(value, wanted);
    });
  }

  /**
   * Что показать агенту про вопросы и что Мастер уже ответил.
   *
   * Ошибка чтения не должна ломать ход: без этой строки цикл работает, просто
   * не знает про вопросы. Поэтому `catch` здесь, а не в вызывающем коде.
   */
  async function questionBriefing(mission) {
    try {
      const [open, answered] = await Promise.all([
        questionRows([Q.wait], mission),
        questionRows([Q.done, Q.byDefault], mission),
      ]);
      const fresh = answered.filter((row) => !row.properties?.["Доставлено"]?.date?.start);
      return { fresh, openLine: openQuestionsLine(open), answersLine: answersLine(fresh) };
    } catch (e) {
      log(`База «Вопросы» не читается: ${e.message}`, true);
      return { fresh: [], openLine: "", answersLine: "" };
    }
  }

  // ─────────────────────────── решения на Мастере (ADR) ───────────────────────
  /**
   * Предложение живёт в репозитории, а не в Notion: `docs/decisions/<X>.md` со
   * строкой `Статус: proposed`.
   *
   * 25.10 Мастер спросил: «предложено — это кто предложил?» Оказалось, что
   * механизм предложения работает наполовину: агент законно пишет ADR и должен
   * остановиться, но остановки не происходит, а сам файл никто не читает — из
   * 21 журнала поле `Статус:` было у двух. Счётчик вопросов тут не спасает:
   * вопрос — отдельная запись, а ADR мог появиться и без вопроса.
   *
   * Поэтому счётчик решений читает репозиторий напрямую: имена файлов и их
   * `Статус:` из `docs/decisions` в main. Содержимое кэшируется по sha: за
   * проверку уходит один запрос на каталог, а файл перечитывается только когда
   * его sha изменился. Ошибка чтения — не пауза: без счётчика цикл работает.
   */
  const ADR_FOLDER = "docs/decisions";
  const ADR_PROPOSED = "proposed";

  /**
   * Имена решений в тексте: номер карточки (`NAR-5.13`) и имя файла
   * (`0016-capability-registry-boundary`).
   *
   * Файл обязателен с 1.4.82. Прежде ключом был только номер вида `NAR-x.y`, и
   * предложение с описательным именем (`0016-…md`) не могло связаться со своим
   * ответом: оно навсегда оставалось в счётчике «ждёт Мастера», хотя решение
   * уже было принято. Обратное тоже ломалось: любое упоминание «NAR-5» в
   * ответе прятало все файлы миссии NAR-5, в том числе нерешённые.
   */
  function adrKeysOf(text) {
    const out = new Set();
    const src = String(text || "");
    for (const hit of src.matchAll(/NAR-\d+(?:\.\d+)?(?:-[\wа-яё]+)?/gi)) out.add(hit[0].toLowerCase());
    for (const hit of src.matchAll(/([\w.-]+)\.md/gi)) out.add(hit[1].toLowerCase());
    return out;
  }

  /**
   * Имена решений, по которым приёмка уже ответила в «Вопросах».
   *
   * ADR остаётся `proposed`, пока решение не записано в репозиторий. Но само
   * решение может быть уже принято — ответ лежит в базе. Держать такой ADR в
   * счётчике «ждёт Мастера» значит звать человека туда, где его больше нет:
   * осталась работа агентов. 25.10 именно так висели NAR-2.14 и NAR-2.15.
   */
  async function decidedAdrNames() {
    const names = new Set();
    try {
      const rows = await questionRows([Q.done, Q.byDefault]);
      for (const row of rows) {
        const answer = rt(row.properties?.["Ответ"]).trim();
        if (!answer) continue;
        for (const key of adrKeysOf(`${rt(row.properties?.["Вопрос"])} ${answer}`)) names.add(key);
      }
    } catch (e) {
      // `null` — «не знаю», а не «решений нет»: иначе сбой чтения вернул бы в
      // счётчик уже принятые решения и разбудил Мастера зря.
      dbg("решения: ответы Мастера не прочитаны", e.message);
      return null;
    }
    return names;
  }

  /** `Статус:` из шапки ADR; пусто — поля нет. */
  const adrStatusOf = (text) => {
    const m = String(text || "").match(/^\s*Статус:\s*(.+?)\s*$/m);
    return m ? m[1].replace(/[`*]/g, "").trim().toLowerCase() : "";
  };

  function openDecisions() {
    const cache = GM_getValue("cfn-adr-open", null);
    return cache && Array.isArray(cache.rows) ? cache : { at: 0, rows: [], known: null };
  }

  /** Содержимое файла из ответа GitHub: base64 → UTF-8, без устаревших API. */
  function b64Text(value) {
    const clean = String(value || "").replace(/\s+/g, "");
    if (!clean) return "";
    try {
      const bytes = Uint8Array.from(atob(clean), (ch) => ch.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (e) {
      return "";
    }
  }

  function paintDecisions(rows, settled = []) {
    if (typeof document === "undefined") return;
    const list = rows || [];
    const waiting = (settled || []).map((row) => row.file);
    const badge = document.getElementById(ui.adrBadge);
    if (badge) {
      badge.textContent = list.length ? String(list.length) : "";
      badge.style.display = list.length ? "inline-block" : "none";
    }
    const button = document.getElementById(ui.adr);
    if (!button) return;
    const decidedHint = waiting.length
      ? ` Решение уже принято, ждёт записи в репозиторий (это работа агентов): ${waiting.slice(0, 4).join(", ")}.`
      : "";
    button.title = list.length
      ? `Решений на Мастере: ${list.length} — ${list
          .slice(0, 4)
          .map((row) => row.file)
          .join(", ")}${list.length > 4 ? "…" : ""}. Нажмите, чтобы открыть ${ADR_FOLDER}.${decidedHint}`
      : `Решений, ждущих Мастера, нет — ${ADR_FOLDER} в main.${decidedHint}`;
    button.style.background = list.length ? "#3a3320" : "#242833";
    button.style.borderColor = list.length ? "#8a6b2a" : "#343a46";
    if (typeof paintPanelChrome === "function") paintPanelChrome();
  }

  /**
   * Новое предложение — громкий пуш. Первый запуск молчит и только запоминает,
   * что уже висит: иначе Мастер получает пачку из старых решений и перестаёт
   * верить каналу (ровно та же ошибка, что была с вопросами).
   */
  function announceDecisions(rows) {
    const cache = openDecisions();
    const names = (rows || []).map((row) => row.file);
    const before = Array.isArray(cache.known) ? cache.known : null;
    GM_setValue("cfn-adr-open", { at: Date.now(), rows: rows || [], known: names });
    if (!before) {
      if (names.length)
        log(`Решений на Мастере: ${names.length} (${names.join(", ")}).`, false, { ntfy: false });
      return 0;
    }
    const fresh = names.filter((name) => !before.includes(name));
    if (!fresh.length) return 0;
    log(`Новое предложение ждёт решения: ${fresh.join(", ")} — ${ADR_FOLDER} в main.`, false, {
      ntfy: "quiet",
      title: "Narthex: новое предложение (ADR)",
    });
    return fresh.length;
  }

  /** Ключ файла предложения: `0016-capability-registry-boundary.md` → без `.md`. */
  const adrKeyOf = (file) => String(file || "").replace(/\.md$/i, "").toLowerCase();

  /**
   * Вопрос приёмке по предложению из репозитория.
   *
   * Текст держится коротким (заголовок «Вопрос» режется на 180 знаках), а
   * полный — в теле страницы. Пересказывать предложение нельзя: приёмка
   * читает файл, иначе решение примется по моей формулировке, а не по тексту
   * агента.
   */
  function proposalQuestion(row, missionName = "") {
    const file = String(row?.file || "");
    const path = `${ADR_FOLDER}/${file}`;
    return {
      text: `Предложение ${path}: принять, отклонить или оставить как есть?`,
      fullText: [
        `Предложение лежит в репозитории: ${path} (main), статус «proposed».`,
        missionName ? `Миссия: ${missionName}` : "",
        "",
        "ЧТО РЕШИТЬ",
        "Принять как есть, отклонить или оставить как есть (вариант по умолчанию). Если принимаешь с поправкой — назови её: что поменять в предложении и по какому признаку считать решение исполненным.",
        "Статус файла меняет исполнитель карточкой: приёмка решает по существу, агенты переводят предложение в accepted или rejected с датой.",
        "Файл не пересказан здесь намеренно: решение принимается по его тексту, а не по моему пересказу.",
      ]
        .filter(Boolean)
        .join("\n"),
      fallback: "оставить как есть",
      options: ["принять", "отклонить", "оставить как есть"],
      hours: 168,
    };
  }

  /**
   * Довести нерешённые предложения до приёмки.
   *
   * Счётчик «⚖» — подсказка панели, а не доставка. 28.10 Мастер: «висит 1
   * предложение (/docs/decisions), не ушло к тебе». Так и было: статус файла
   * читался, число рисовалось, а строки в «Вопросах» не появлялось — приёмка о
   * предложении не знала, и оно могло лежать неделями.
   *
   * Теперь каждое `proposed` без принятого решения получает строку со ссылкой
   * на файл и сразу ставится в очередь приёмки. Повторная строка не
   * создаётся: `sameQuestionRow` сравнивает ссылки на решение, а отметка
   * `cfn-asked:adr:<файл>` помнит факт передачи.
   */
  async function deliverProposals(rows) {
    let missionName = "";
    try {
      const mission = await activeMission();
      missionName = mission ? rt(mission.properties["Миссия"]) : "";
    } catch (e) {
      missionName = "";
    }
    for (const row of rows || []) {
      try {
        await askQuestion(proposalQuestion(row, missionName), {
          roleName: "Narthex (транспорт)",
          card: "",
          mission: missionName,
          key: `adr:${row.file}`,
        });
      } catch (e) {
        dbg("решения: предложение не передано приёмке", e.message);
      }
    }
  }

  async function refreshDecisions(force = false) {
    const cache = openDecisions();
    if (!force && Date.now() - cache.at < C.adrCheckMs) return cache.rows;
    const token = GM_getValue(K.ghToken, "");
    try {
      const list = await request(
        "GET",
        `https://api.github.com/repos/${C.repo}/contents/${ADR_FOLDER}?ref=main`,
        githubHeaders(token),
      );
      if (!Array.isArray(list)) throw new Error("GitHub вернул не список файлов");
      const texts = GM_getValue("cfn-adr-text", {}) || {};
      const rows = [];
      for (const item of list) {
        if (!item || item.type !== "file" || !/\.md$/i.test(item.name || "")) continue;
        const cached = texts[item.name];
        let status = cached && cached.sha === item.sha ? cached.status : "";
        if (!status) {
          const file = await request("GET", item.url, githubHeaders(token));
          status = adrStatusOf(b64Text(file && file.content)) || "нет";
          texts[item.name] = { sha: item.sha, status };
        }
        if (status === ADR_PROPOSED)
          rows.push({ file: item.name, sha: item.sha, url: item.html_url || "" });
      }
      GM_setValue("cfn-adr-text", texts);
      const answered = await decidedAdrNames();
      if (answered === null) {
        // Список ответов не прочитан — показываем прежний счётчик и молчим:
        // лучше не обновить цифру, чем позвать Мастера к решённому.
        paintDecisions(cache.rows);
        return cache.rows;
      }
      const settled = rows.filter((row) => answered.has(adrKeyOf(row.file)));
      const pending = rows.filter((row) => !settled.includes(row));
      paintDecisions(pending, settled);
      announceDecisions(pending);
      // Предложение — не украшение счётчика: оно обязано дойти до приёмки так
      // же, как вопрос агента. 28.10 файл лежал в репозитории, «⚖» показывал
      // единицу, а решения не ждал никто: строки в «Вопросах» не было.
      if (pending.length) await deliverProposals(pending);
      if (settled.length) {
        logThrottled(
          "adr-settled",
          `Решение по предложению уже принято в «Вопросах», но в репозитории ADR ещё proposed: ` +
            `${settled.map((row) => row.file).join(", ")}. Это работа агентов, а не Мастера — в счётчик «⚖» не входит, ` +
            "но и не забывается: статус файла меняет исполнитель карточкой, иначе предложение выглядит нерешённым.",
          false,
          3_600_000,
        );
      }
      return pending;
    } catch (e) {
      dbg("решения: список не обновлён", e.message);
      paintDecisions(cache.rows);
      return cache.rows;
    }
  }

  let decisionsWatch = 0;
  function watchDecisions() {
    if (decisionsWatch) return;
    decisionsWatch = window.setInterval(() => refreshDecisions().catch(() => {}), C.adrCheckMs);
    refreshDecisions().catch(() => {});
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
    // Rework запоминается ради причины в журнале: право на повторную выдачу
    // даёт указание Координатора, а следы прошлого ответа снимает `dispatchTask`
    // (см. `redispatchClearProps`).
    rememberRework(rework);
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
  /**
   * Отпечаток Ready: id карточки и её Sequence.
   *
   * По нему видно, та ли это очередь, по которой Координатор принимал решение.
   * 25.10 план пришёл по одной очереди, а применился к другой: Мастер вернул
   * зависшую карточку в Ready уже после запроса плана — и вместо неё ушла
   * следующая по порядку.
   */
  const readyKeyOf = (cards) =>
    (cards || [])
      .map((card) => `${card.id}:${card.properties?.["Sequence"]?.number ?? ""}`)
      .sort()
      .join(",");

  function readyLine(cards) {
    const rows = [...(cards || [])].sort((a, b) => {
      const sa = Number(a.properties?.["Sequence"]?.number ?? 0);
      const sb = Number(b.properties?.["Sequence"]?.number ?? 0);
      return sa - sb;
    });
    if (!rows.length) return "Готовы к выдаче: ничего — Ready пуст.";
    // Ready со следами прошлого ответа — это не «готова», а «нужна заново»:
    // работа уже была и не принята. Транспорт снимет следы на выдаче сам, но
    // Координатор должен понимать, что он берёт в работу отвеченную карточку,
    // а не новую.
    const shown = rows.slice(0, C.readyLineMax).map((card) => {
      const seq = card.properties?.["Sequence"]?.number;
      const stale = staleMarks(card);
      const warn = stale.length
        ? ` — остались ${stale.join(", ")}: это повторная работа, следы прошлого ответа снимет транспорт. ` +
          "Если повторять её не надо — убери карточку из Ready"
        : "";
      return `${taskTitle(card)} (${taskRole(card) || "роль не задана"}, Sequence ${seq ?? "—"})${warn}`;
    });
    const more = rows.length > shown.length ? `; и ещё ${rows.length - shown.length}` : "";
    return `Готовы к выдаче: ${shown.join("; ")}${more}.`;
  }

  /**
   * Почему Координатор встал и что именно сделать Мастеру.
   *
   * 25.10 (пауза 19:43) он вернул `next:"blocked"` без `need`, и транспорт
   * написал «нужна роль, которой нет в «Ролях»» — при том что роль Tools в
   * базе есть, просто «Статус» = «Ждёт» и «Agent URL» пуст. Мастер по такой
   * строке пошёл бы создавать нового агента вместо того, чтобы дозаполнить
   * существующую роль. Поэтому текст паузы собирается по фактам: имя роли,
   * её настоящий статус, очередь и уже открытый вопрос.
   */
  function blockedReason({ need = "", directory = [], queue = null, open = [], ask = "", asked = false } = {}) {
    const rows = directory || [];
    const find = (name) => rows.find((r) => norm(r.name) === norm(name));
    const lacks = (row) => {
      if (!row) return "";
      const bits = [];
      if ((row.status || "") !== "Активна") bits.push(`«Статус» = «${row.status || "пуст"}»`);
      if (!row.url) bits.push("«Agent URL» пуст");
      return bits.join(", ");
    };
    const parts = [];
    const name = String(need || "").trim();
    if (name) {
      const row = find(name);
      const gap = lacks(row);
      parts.push(`Координатор остановил цикл: нужна роль «${name}».`);
      if (!row) {
        parts.push(
          `Роли «${name}» в базе «Роли» нет — создайте агента в Arena, заполните «Agent URL» и поставьте «Статус» = «Активна».`,
        );
      } else if (!gap) {
        parts.push(
          `Роль «${name}» активна и «Agent URL» заполнен — значит, Координатор её не увидел: проверьте «Функцию» и «Зону записи».`,
        );
      } else {
        parts.push(
          `Роль «${name}» в «Ролях» есть, но ${gap} — создавать агента не нужно: заполните «Agent URL» и поставьте «Статус» = «Активна».`,
        );
      }
    } else {
      // Роль не названа — показываем очередь: по ней видно, чья это работа.
      parts.push("Координатор остановил цикл, но роль не назвал.");
      const waiting = ((queue && queue.draft) || [])
        .map((card) => ({ card, role: taskRole(card) }))
        .filter(({ role }) => role && !find(role)?.url)
        .map(
          ({ card, role }) =>
            `черновик «${taskTitle(card)}» ждёт роль ${role} — ${lacks(find(role)) || "роли нет в «Ролях»"}`,
        );
      if (waiting.length) {
        parts.push(`По очереди видно: ${waiting.join("; ")}. Новый агент нужен только если роли правда нет.`);
      } else if (queue) {
        parts.push(
          (queue.rework || []).length
            ? "Черновиков, которым не хватает роли, нет — значит, причина другая: смотрите «Ответ» карточек в Rework."
            : "Черновиков, которым не хватает роли, нет, и Rework пуст — по очереди причину не видно.",
        );
      }
    }
    if (queue && queue.summary) parts.push(`Очередь: ${queue.summary}.`);
    if (queue && (queue.rework || []).length) {
      parts.push(
        "Rework — это не «нет роли»: Координатор разбирает причину из «Ответа» карточки и сам решает, выдавать снова или править карточку.",
      );
    }
    if (ask) {
      parts.push(
        `Координатор спрашивает: «${ask}». ` +
          (asked
            ? "Вопрос записан в базу «Вопросы» — он виден там и счётчиком на панели."
            : "Вопрос в «Вопросы» не записался — он есть только в этом сообщении, запишите его сами."),
      );
    }
    const first = (open || [])[0];
    if (first) {
      const due = first.properties?.["Срок"]?.date?.start || "";
      const when = due
        ? `, срок ${new Date(due).toLocaleString("ru-RU", {
            timeZone: "Europe/Moscow",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "";
      parts.push(
        `Вопрос об этом уже задан: «${rt(first.properties?.["Вопрос"])}» (по умолчанию: ${rt(
          first.properties?.["По умолчанию"],
        )}${when}) — он ждёт ответа в базе «Вопросы».`,
      );
    }
    parts.push(
      "Право на остановку у Координатора одно — роль, которая не может взять работу; пустую очередь, Rework и спорный Scope он разбирает сам.",
    );
    return parts.join(" ");
  }

  /**
   * Rework — статус, а не очередь.
   *
   * 25.10 Координатор поставил NAR-2.5 в Rework за форму ответа: код уже был в
   * main, а в отчёте не хватало цитат. Из Rework карточка сама никуда не
   * уходит — транспорт выдаёт только Ready, — а в промпте стояло «карточку с
   * ответом обратно в Ready не возвращай». Два правила вместе запирали карточку
   * навсегда. Теперь причина и путь назад названы прямо: вернуть в Ready можно,
   * а следы прошлого ответа снимает транспорт на выдаче (1.4.76 — без опоры на
   * память о Rework: 27.10 NAR-4.9 прошла Rework → Ready за один ход, и память
   * о нём не успела появиться).
   */
  const reworkCause = (card) => {
    const answer = rt(card.properties?.["Ответ"]).replace(/\s+/g, " ").trim();
    if (!answer) return "«Ответ» пуст — причина не записана";
    return answer.length > 160 ? `${answer.slice(0, 160)}…` : answer;
  };

  /**
   * Следы прошлого ответа, из-за которых выдача откажет.
   *
   * Читаются здесь, а не через `rt`: строка попадает в промпт Координатора, а
   * пробы вырезают этот блок отдельно — лишняя зависимость ломала бы их
   * песочницу ради одной строки.
   */
  const textOf = (prop) => (prop?.rich_text || prop?.title || []).map((x) => x.plain_text || "").join("");
  const staleMarks = (card) => {
    const marks = [];
    if (card.properties?.["Submitted At"]?.date?.start) marks.push("«Submitted At»");
    if (card.properties?.["PR"]?.url) marks.push("«PR»");
    if (textOf(card.properties?.["Run ID"])) marks.push("«Run ID»");
    return marks;
  };

  function reworkLine(cards) {
    const rows = [...(cards || [])].sort((a, b) => {
      const sa = Number(a.properties?.["Sequence"]?.number ?? 0);
      const sb = Number(b.properties?.["Sequence"]?.number ?? 0);
      return sa - sb;
    });
    if (!rows.length) return "";
    const shown = rows.slice(0, C.readyLineMax).map(
      (card) => `${taskTitle(card)} (${taskRole(card) || "роль не задана"}) — причина: ${reworkCause(card)}`,
    );
    const more = rows.length > shown.length ? `; и ещё ${rows.length - shown.length}` : "";
    return (
      `На доработке (Rework): ${shown.join("; ")}${more}. ` +
      "Rework сам не выдаётся — исполнителю уходит только Ready. Чтобы работа пошла заново: " +
      "верни карточку в Ready — следы прошлого ответа («Submitted At», «PR», «Run ID») снимет " +
      "транспорт на выдаче, коннектором их чистить не надо. Если переделывать нечего — прими, " +
      "запиши в «Ответ», почему, и оставь карточку принятой."
    );
  }

  async function coordinatorStep(role, expect, manual = false) {
    const mission = await activeMission();
    if (!mission) {
      // Миссию закрыли — говорим об этом зелёной строкой и громким пушем,
      // а не тихим «ждём»: это конец работы, а не пустая страница.
      if (await missionDoneNotice(expect)) return true;
      logThrottled(
        "no-mission",
        "Миссий в работе нет. Создайте карточку в «Миссиях» (Состояние = «Активна») и нажмите «Шаг»: ход начнётся с Координатора, он и нарежет очередь.",
      );
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
          // Мастер вернул миссию сам — звонить ему об этом незачем (1.4.80).
          { tone: "warn", ntfy: "quiet", title: "Narthex: миссия возвращена" },
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

    // Ход не у Координатора: ему тут делать нечего, а новый план — вреден.
    // `requestPlan` перезаписывает `K.expect`, и ожидание живого хода
    // пропадает: карточка остаётся в Running без хода, а ответ агента приходит
    // в пустоту. Ровно так теряется работа, если открыть страницу Координатора
    // (или перезагрузить её) посреди ответа исполнителя или приёмки.
    //
    // Ждём только свой ход — `plan` и `reminder` адресованы Координатору, их
    // разбирает код ниже. Всё остальное — на странице адресата: ответ читается
    // только там.
    if (expect && Number(expect.sentAt) && expect.kind !== "plan" && expect.kind !== "reminder") {
      const who = expect.roleName || expect.roleId;
      const list = await roles().catch(() => []);
      const target = list.find((r) => norm(r.id) === norm(expect.roleId)) || null;
      if (target) return navigateTo(target, "там ждёт ответа исполнитель");
      logThrottled(
        `coord-busy:${expect.ref || who}`,
        `Ход у «${who}»: жду ответа. Новый план Координатору не нужен — он перезапишет ожидание, ` +
          "и карточка останется в Running без хода.",
        false,
        C.tickMs * 4,
      );
      return true;
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

      // Решение по устаревшей очереди не применяется.
      //
      // 25.10, 21:36–21:42. Карточка NAR-2.16 висела в Running после съеденной
      // отправки; Мастер вернул её в Ready. Скрипт в это время дочитывал ответ
      // Координатора, полученный ДО правки, — в нём стояло next: "Tools", и
      // ушла NAR-2.17, хотя в Ready уже лежала NAR-2.16 с меньшим Sequence.
      // Транспорт не выбирает за Координатора, но и применять его решение к
      // другой очереди не имеет права: план посчитан по снимку, снимок устарел.
      if (expect.kind === "plan" && typeof expect.readyKey === "string") {
        const was = new Map(
          expect.readyKey
            .split(",")
            .filter(Boolean)
            .map((part) => {
              const [id, seq] = part.split(":");
              return [id, seq || ""];
            }),
        );
        const now = new Map(ready.map((card) => [card.id, String(card.properties?.["Sequence"]?.number ?? "")]));
        // Ушла из Ready, сменился её Sequence, или карточка, которая в момент
        // вопроса была в работе, снова стала Ready — всё это чужие правки:
        // план считался по другому снимку. Появление новой карточки само по
        // себе не признак: её в этом же ответе мог создать Координатор.
        const left = [...was.keys()].filter((id) => !now.has(id));
        const moved = [...was.keys()].filter((id) => now.has(id) && now.get(id) !== was.get(id));
        const returned = (Array.isArray(expect.runningIds) ? expect.runningIds : []).filter((id) => now.has(id));
        if (left.length || moved.length || returned.length) {
          const what = [
            left.length ? `ушли из Ready: ${left.join(", ")}` : "",
            moved.length ? `сменился Sequence у ${moved.join(", ")}` : "",
            returned.length ? `вернулись в Ready из работы: ${returned.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join("; ");
          const shifts = (Number(GM_getValue("cfn-plan-shift", 0)) || 0) + 1;
          GM_setValue("cfn-plan-shift", shifts);
          GM_setValue(K.expect, null);
          GM_setValue("cfn-plan-at", 0);
          if (shifts > 2) {
            pause(
              `План Координатора не совпадает с очередью уже ${shifts}-й раз (${what}). ` +
                "Решение по устаревшей очереди не применяю: проверьте карточки и нажмите «Продолжить».",
              { kind: "plan-shift", ref: mission.id },
            );
            return true;
          }
          log(
            `Пока ждали план, очередь изменилась (${what}). Решение «${decision.next}» относится к прежней очереди — ` +
              "не применяю, прошу новый план: иначе уйдёт не та карточка.",
            true,
            { ntfy: "quiet", title: "Narthex: план по устаревшей очереди" },
          );
          await requestPlan(
            mission,
            role,
            await queueOf(mission),
            `Пока ты отвечал, очередь изменилась: ${what}. Пересчитай план по текущей очереди.`,
            { force: true },
          );
          return true;
        }
        GM_setValue("cfn-plan-shift", 0);
      }

      // Миссия в маркере — проверка по существу: решение чужой миссии
      // применять нельзя, тут пауза оправдана.
      //
      // turn_id — другое дело. 25.10 (ход 41) Coordinator ответил на свежий
      // вопрос, но вписал id прошлого хода (f214b8e0 вместо 8453c8ac) и
      // потерял mission_id: транспорт встал на паузу, хотя ответ был именно
      // на наш вопрос и вёл в «Runtime Auditor» — карточка уже лежала в Ready.
      // Поле, которое транспорт знает сам, — не повод останавливать цикл:
      // берём свой turn_id, решение применяем. Ошибку агента видно в журнале,
      // а от чужой выдачи защищает `decisionRoute` ниже (роль, статус, Ready).
      const sameMission = !decision.mission_id || norm(decision.mission_id) === norm(mission.id);
      const gotTurn = String(decision.turn_id || "").trim();
      const sameTurn = !expect.turnId || !gotTurn || norm(gotTurn) === norm(expect.turnId);
      GM_setValue(K.expect, null);
      if (!sameMission) {
        pause(
          `Маркер Координатора относится к другой миссии (${decision.mission_id}), а ждём ${mission.id}: ничего не запускаю.`,
          { kind: "marker-mismatch", ref: mission.id, turnId: expect.turnId },
        );
        return true;
      }
      if (!String(decision.next || "").trim()) {
        pause(
          "В маркере Координатора нет next: кому передавать ход — непонятно. Ответ без next решением не считается.",
          { kind: "marker-mismatch", ref: mission.id, turnId: expect.turnId },
        );
        return true;
      }
      if (!sameTurn) {
        log(
          `В маркере Координатора чужой turn_id «${gotTurn}» вместо «${expect.turnId}» — беру свой из выдачи, ` +
            `решение «${decision.next}» применяю: миссия та же, а id хода транспорт знает сам.`,
          true,
          { ntfy: "quiet", title: "Narthex: чужой turn_id в маркере" },
        );
        decision.turn_id = expect.turnId;
      }
      log(`Маркер Координатора найден: дальше «${decision.next}» (turn ${decision.turn_id || expect.turnId}).`);
      // Счётчик ложных остановок живёт подряд: обычное решение его обнуляет.
      if (norm(decision.next) !== "blocked") GM_setValue("cfn-blocked-norole", 0);
      // Вопрос не останавливает цикл: он живёт строкой в базе «Вопросы», а
      // работа идёт по варианту, который агент назвал сам.
      let askedRow = null;
      if (norm(decision.next) !== "blocked") {
        // Та же история, что у исполнителя: `"question":null` — не вопрос, а
        // вопрос без варианта по умолчанию записывается с честным вариантом
        // «работа идёт по решению Координатора» — по next он и так идёт.
        const asked = questionInMarker(decision.question, "Работа идёт по решению Координатора");
        if (asked.kind === "text") {
          log(
            `Вопрос Координатора пришёл без варианта по умолчанию — записан с вариантом «${asked.question.fallback}»: дальше идём по next.`,
            false,
            { ntfy: "quiet", title: "Narthex: вопрос без варианта по умолчанию" },
          );
        }
        if (asked.kind !== "none") {
          askedRow = await askQuestion(asked.question, {
            roleName: role.name,
            card: "",
            mission: rt(mission.properties["Миссия"]),
            key: `${mission.id}:${decision.turn_id || expect.turnId}`,
          });
        }
      }
      // Вопрос не «висит» до конца хода: ход сразу переходит приёмке, а next из
      // этого маркера не применяется — он посчитан без ответа. Ответ придёт
      // Координатору следующим планом, строкой «Ответы на вопросы».
      if (askedRow) {
        const item = answerQueue().find((row) => row.id === askedRow.id);
        if (item && (await startAnswer(mission, item))) return true;
      }
      if (norm(decision.next) === "blocked") {
        // Право Координатора остановить цикл. Повод ровно один: нужной роли
        // нет, и заменить её некем — агента в Arena создаёт Мастер. Всё
        // остальное (пустая очередь, спорный Scope, неясное ТЗ) Координатор
        // решает сам, иначе «остановлю, когда мне неудобно» съедает цикл.
        //
        // 25.10 в 19:43 он вернул next:"blocked" без need, и пауза сказала
        // «нужна роль, которой нет в «Ролях»» — при том что Tools в базе была,
        // просто «Ждёт». Поэтому текст собирается по фактам (blockedReason), а
        // не по шаблону: Мастер должен видеть, что дозаполнить, а что создать.
        const need = String(decision.need || "").trim();
        // Остановка законна только тогда, когда названной роли действительно
        // некому отвечать: её нет в «Ролях», у неё не «Активна» или пуст
        // «Agent URL». Роль, которая активна и имеет адрес, — не повод встать:
        // работа для неё либо есть, либо решение за Координатором.
        //
        // Всё остальное («непонятно, что дальше», пустая очередь, спорный
        // Scope) — работа Координатора, а не повод будить Мастера (1.4.80).
        // Ход возвращается ему же с точной причиной; вторая такая попытка
        // подряд — уже поломка, и тогда пауза честно зовёт человека.
        const directory = need ? await roleRows().catch(() => []) : [];
        const named = need ? directory.find((r) => norm(r.name) === norm(need)) : null;
        const canTake = Boolean(named && (named.status || "") === "Активна" && named.url);
        if (!need || canTake) {
          const why = need
            ? `роль «${need}» активна и «Agent URL» заполнен — значит, Координатор её не увидел`
            : "роль не названа";
          const tries = (Number(GM_getValue("cfn-blocked-norole", 0)) || 0) + 1;
          GM_setValue("cfn-blocked-norole", tries);
          const fresh0 = await queueOf(mission).catch(() => null);
          if (tries >= 2) {
            GM_setValue("cfn-blocked-norole", 0);
            pause(
              `Координатор второй раз подряд останавливает цикл, хотя ${why} (${fresh0?.summary || "очередь не прочитана"}). ` +
                'Остановка с next = "blocked" законна только с need = "<роль>", которой не хватает: ' +
                "очередь, Scope и неясное ТЗ решает Координатор. Посмотрите «Итог» и карточки — " +
                "или назовите роль, которой действительно не хватает.",
              { kind: "blocked-norole", ref: mission.id },
            );
            return true;
          }
          log(
            `Остановка не принята (${tries} из 2): ${why}. Ход возвращается Координатору.`,
            false,
            { tone: "warn", ntfy: "quiet" },
          );
          await requestPlan(
            mission,
            role,
            fresh0 || { summary: "очередь не прочитана" },
            'Остановка не принимается: next = "blocked" законен только с need = "<роль>", которой нет ' +
              "или которая не активна. " +
              (need ? `Роль «${need}» активна и «Agent URL» заполнен — ход возможен. ` : "") +
              "Реши сам — или назови роль, которой действительно не хватает.",
            { force: true },
          );
          return true;
        }
        GM_setValue("cfn-blocked-norole", 0);
        // Вопрос при остановке раньше выбрасывался: у него нет варианта по
        // умолчанию (цикл и так стоит), а `parseQuestion` такие не принимает.
        // Мастер видел только «нужна роль», а суть вопроса оставалась в чате.
        // Теперь он записывается в «Вопросы» с прямым вариантом по умолчанию —
        // «ждать ответа Мастера» — и попадает в текст паузы.
        const rawAsk = decision.question;
        const askText = rawAsk === undefined ? "" : oneLine(typeof rawAsk === "object" && rawAsk ? rawAsk.text : rawAsk, C.questionTextMax);
        let askRow = null;
        if (askText) {
          const ask = typeof rawAsk === "object" && rawAsk ? rawAsk : {};
          const asked = parseQuestion({
            ...ask,
            text: askText,
            default: oneLine(ask.default, C.questionDefaultMax) || "Ответ Мастера: цикл уже остановлен и ждёт его",
            hours: Number(ask.hours) || 168,
          });
          if (asked) {
            askRow = await askQuestion(asked, {
              roleName: role.name,
              card: "",
              mission: rt(mission.properties["Миссия"]),
              key: `${mission.id}:${decision.turn_id || expect.turnId}:blocked`,
            });
          }
        }
        const [fresh, open] = await Promise.all([
          queueOf(mission).catch(() => null),
          questionRows([Q.wait], mission).catch(() => []),
        ]);
        pause(blockedReason({ need, directory, queue: fresh, open, ask: askText, asked: Boolean(askRow) }), {
          kind: "blocked-role",
          ref: mission.id,
          need,
          notifyTitle: "Narthex: нужна роль",
        });
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
            `Очередь закрыта, в черновиках осталось ${fresh.draft.length} — это предложения на будущее, ` +
              "а не обязательства.",
          );
        }
        // `done` — не закрытие, а передача на приёмку: миссию закрывает
        // вердикт `accept`, а не желание Координатора закончить ход.
        if (returned) log("Миссия возвращена, «Возврат» в «Итоге» есть — передаю на приёмку повторно.");
        return startReview(mission, fresh);
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
        // Среди карточек роли свежая идёт впереди отвеченной: возврат в работу
        // не должен подменять новую работу.
        const card = pickReadyForRole(ready, route.roleName);
        if (!card) {
          pause(
            `Координатор направил ход в «${route.roleName}», но карточки этой роли в Ready нет: ` +
              "похоже, очередь изменилась между запросом и выдачей. Нажмите «Продолжить» — ход начнётся заново.",
            { kind: "plan-miss", ref: mission.id },
          );
          return true;
        }
        const problem = await dispatchTask(card, route.roleName, mission);
        if (problem === true) {
          GM_setValue("cfn-dispatch-miss", 0);
          return true;
        }
        // Выдача не состоялась: названная карточка не в Ready или её не удалось
        // очистить. Это не повод будить Мастера с первого раза — ход остаётся у
        // Координатора, и он получает точную причину. Пауза будет, только если
        // он трижды подряд назовёт карточку, которой нет в очереди.
        const misses = (Number(GM_getValue("cfn-dispatch-miss", 0)) || 0) + 1;
        GM_setValue("cfn-dispatch-miss", misses);
        const why = `карточка «${taskTitle(card)}» не выдана: ${problem}`;
        if (misses >= 3) {
          GM_setValue("cfn-dispatch-miss", 0);
          pause(
            `Координатор третий раз подряд направляет ход в «${route.roleName}», но ${why}. ` +
              "Работа не потеряна, очередь на месте: посмотрите карточку в Notion, поправьте её состояние " +
              "(работа должна стоять в Ready) и нажмите «Продолжить».",
            { kind: "redispatch", ref: card.id },
          );
          return true;
        }
        log(`Ход не передан: ${why}. Возвращаю Координатору.`, true, { ntfy: "quiet" });
        const fresh = await queueOf(mission);
        await requestPlan(mission, role, fresh, `Карточку выдать не удалось — ${problem}. Поправь её состояние.`, {
          force: true,
        });
        return true;
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
    // Вопросы к Мастеру и его ответы: ответы доставляются ровно один раз —
    // отметка ставится после того, как промпт действительно ушёл.
    const briefing = await questionBriefing(mission);
    const sent = await sendToRole(
      role,
      coordinatorPrompt(
        mission,
        role,
        summary,
        turnId,
        note,
        answerLine,
        drafts,
        readyLine(queue.ready),
        reworkLine(queue.rework),
        briefing.openLine,
        briefing.answersLine,
      ),
      "plan",
      mission.id,
      {
        missionId: mission.id,
        turnId,
        title: "план Координатора",
        // Снимок очереди на момент вопроса: по нему видно, устарел ли ответ.
        readyKey: readyKeyOf(queue.ready),
        runningIds: (queue.running || []).map((card) => card.id),
      },
    );
    if (sent) await markDelivered(briefing.fresh);
    return true;
  }

  // ───────────────────────────── приёмка миссии ─────────────────────────────
  /**
   * Конец миссии решает приёмка, а не Координатор.
   *
   * До 1.4.79 цикл останавливался по `next: "done"`: Координатор объявлял
   * миссию выполненной, скрипт ставил «Завершена» и гасил автоцикл. Проверка
   * была формальной — «в очереди ноль карточек», — и отвечала на вопрос «всё ли
   * выдано», а не «получилось ли то, о чём миссия». Настоящую ошибку видел
   * только человек, и только если открывал «Итог».
   *
   * Теперь `done` — это передача на приёмку. Роль с функцией `Reviewer`
   * получает промпт с оракулом, очередью и «Итогом» и отвечает маркером
   * `CF_REVIEW_RESULT`:
   *   accept → миссия «Завершена», автоцикл выключен, громкий пуш;
   *   rework → «Возвращена», круг +1, замечания в карточку миссии, ход
   *            Координатору — он разбирает их карточками.
   *
   * Доработок больше `reworkLimit` не бывает: следующий возврат не запускает
   * работу, а останавливает цикл и зовёт Мастера. Приёмка, которая возвращает
   * бесконечно, — не контроль, а вечный цикл.
   */
  const reviewerRole = async () => (await roles()).find((r) => r.fn === "Reviewer") || null;

  const missionRound = (mission) => {
    const n = mission?.properties?.["Круг"]?.number;
    return Number.isFinite(Number(n)) ? Number(n) : 0;
  };

  /** Принятые карточки списком: что именно принято, с ответом и PR. */
  function reviewCards(cards) {
    const rows = Array.isArray(cards) ? cards : [];
    if (!rows.length) return "Принятых карточек нет — миссия закрывается без работы?";
    return rows
      .slice(0, 20)
      .map((card) => {
        const id = taskTitle(card).split("·")[0].trim() || taskTitle(card);
        const who = taskRole(card) || "—";
        const pr = card.properties?.["PR"]?.url || "";
        const answer = rt(card.properties["Ответ"]).replace(/\s+/g, " ").slice(0, 160);
        return `- ${id} · ${who}${pr ? ` · ${pr}` : ""}${answer ? ` · ответ: ${answer}` : ""}`;
      })
      .join("\n");
  }

  function reviewPrompt(mission, role, turnId, round, queue, accepted) {
    const name = rt(mission.properties["Миссия"]) || "миссия";
    const tz = mission.properties["ТЗ URL"]?.url || "не задано";
    const result = rt(mission.properties["Итог"]).trim();
    return [
      technicalInfo(role),
      "",
      `Миссия: ${name}`,
      `ТЗ и оракул: ${tz}`,
      `Круг: ${round} (доработок было ${round}, предел ${C.reworkLimit})`,
      `Очередь: ${queue.summary}`,
      "",
      "ПРИНЯТЫЕ КАРТОЧКИ (ответ и PR каждой):",
      reviewCards(accepted),
      "",
      result
        ? `ИТОГ МИССИИ (как его записал Координатор):\n${result}`
        : "ИТОГ МИССИИ: поле «Итог» пусто — это уже повод не принимать.",
      "",
      "ЧТО ОТ ТЕБЯ ТРЕБУЕТСЯ",
      "Ты — приёмка миссии, а не исполнитель. Ничего не правь: ни карточки, ни код, ни документы. Смотри, выполнено ли то, о чём миссия, а не только «всё ли выдано».",
      "Проверяй по оракулу из ТЗ: каждый его пункт должен закрываться командой или артефактом, а не фразой. Если команду нельзя запустить — это и есть замечание.",
      "",
      "Решай по существу:",
      "1) Заявленное в «Итоге» совпадает с тем, что реально сделано карточками? Есть ли работа, которой нет в отчёте, и отчёт без работы?",
      "2) Оракул закрыт целиком? Проверки не ослаблены, не подменены и не «зелёные по договорённости»?",
      "3) Остались ли долги, обещанные «в следующий раз» без карточки и без записи в реестре?",
      "Принимаешь — цикл останавливается. Возвращаешь — Координатор получает замечания и разбирает их карточками.",
      "",
      "ОТВЕТ — одной строкой в конце:",
      `CF_REVIEW_RESULT {"mission_id":"${mission.id}","turn_id":"${turnId}","verdict":"accept","summary":"<одна строка: на что опирался>"}`,
      "или",
      `CF_REVIEW_RESULT {"mission_id":"${mission.id}","turn_id":"${turnId}","verdict":"rework","remarks":"1) <что не принято и чем это проверяется> 2) …"}`,
      "или, если без Мастера решить нельзя (нужен новый агент, доступ, смена ТЗ или оракула):",
      `CF_REVIEW_RESULT {"mission_id":"${mission.id}","turn_id":"${turnId}","verdict":"master","reason":"<чего именно не хватает>"}`,
      "Замечания — по пунктам и проверяемо: «не соответствует», «нет команды», «долг без записи». Придирка без проверки вернётся тебе же на четвёртом круге.",
      `Предел доработок: ${C.reworkLimit}. Следующий возврат не запускает работу, а будит Мастера — возвращай то, без чего миссию нельзя считать сделанной, а не то, что можно доделать следующим ТЗ.`,
      "verdict master — не «мне не нравится»: это остановка цикла и вызов Мастера. Только когда без него физически нельзя.",
      "",
      roleContext(role),
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Передать миссию на приёмку. Возвращает true: ход уже не у Координатора. */
  async function startReview(mission, queue) {
    const reviewer = await reviewerRole().catch(() => null);
    if (!reviewer) {
      // Приёмки нет — закрывать «за компанию» нельзя: миссия без вердикта
      // ничем не отличается от миссии, которую никто не проверял. Цикл стоит,
      // Мастер заводит роль (или закрывает миссию сам, зная, что принял её).
      pause(
        "Миссия готова к приёмке, но в базе «Роли» нет активной роли с функцией Reviewer: " +
          "принимать некому. Заведите роль (например, Warden с Agent URL) или закройте миссию сами — " +
          "без вердикта она не закроется.",
        { kind: "no-reviewer", ref: mission.id, notifyTitle: "Narthex: приёмка не настроена" },
      );
      return true;
    }
    const round = missionRound(mission);
    const accepted = await tasks("Accepted", mission).catch(() => []);
    const turnId = uid();
    log(`Миссия готова к приёмке: круг ${round}, принято карточек ${accepted.length}. Передаю «${reviewer.name}».`);
    await sendToRole(reviewer, reviewPrompt(mission, reviewer, turnId, round, queue, accepted), "review", mission.id, {
      missionId: mission.id,
      turnId,
      round,
      title: "приёмка миссии",
    });
    return true;
  }

  /** Закрыть миссию. Право на это есть только у приёмки и у Мастера. */
  async function closeMission(mission, reviewer) {
    const at = nowIso();
    const returnedAt = mission.properties?.["Возвращена"]?.date?.start || "";
    await patch(mission.id, {
      "Состояние": { select: { name: "Завершена" } },
      "Завершена": { date: { start: at } },
    });
    // Событие объявляем сами и один раз: иначе `missionDoneNotice` следующим
    // тиком повторит тот же пуш про ту же дату.
    GM_setValue(`cfn-mission-done:${mission.id}:${at}:${returnedAt}`, true);
    // Отметка «закрыто приёмкой»: по ней `missionDoneNotice` отличает наше
    // закрытие от того, что агент поставил «Завершена» своей рукой.
    GM_setValue(`cfn-review:${mission.id}`, "accept");
    autoSet(false);
    const name = rt(mission.properties["Миссия"]) || "миссия";
    log(
      `Миссия «${name}» принята «${reviewer.name}»: закрыта, автоцикл остановлен. ` +
        "Следующая работа — новым ТЗ и новой миссией, а не хвостом этой.",
      false,
      { tone: "ok", ntfy: "loud", title: "Narthex: миссия принята" },
    );
    return true;
  }

  /** Вернуть миссию Координатору с замечаниями — или остановиться на пределе. */
  async function returnMission(mission, verdict, reviewer) {
    const round = missionRound(mission);
    const next = round + 1;
    const remarks = String(verdict.remarks || "").trim();
    if (!remarks) {
      pause(
        `«${reviewer.name}» вернул миссию без замечаний: исправлять нечего. Приёмка без причины — не приёмка: ` +
          "допишите замечания в карточку миссии и снимите паузу.",
        { kind: "review-empty", ref: mission.id },
      );
      return true;
    }
    if (next > C.reworkLimit) {
      // Предел доработок — не «ещё круг», а вызов Мастера: если три раза не
      // сошлось, четвёртый не сойдётся тоже. Расходится постановка, а не работа.
      pause(
        `Миссия прошла ${round} кругов доработки, и приёмка снова не приняла работу. Дальше решаете вы: ` +
          "сократить объём миссии, разделить её на две или принять как есть. Последние замечания:\n" +
          remarks,
        { kind: "rework-limit", ref: mission.id, notifyTitle: "Narthex: миссия застряла в доработке" },
      );
      return true;
    }
    await patch(mission.id, {
      "Состояние": { select: { name: "Возвращена" } },
      "Возвращена": { date: { start: nowIso() } },
      "Круг": { number: next },
      "Замечания": { rich_text: richText(remarks) },
    });
    GM_setValue("cfn-plan-at", 0);
    GM_setValue(`cfn-review:${mission.id}`, "rework");
    log(
      `«${reviewer.name}» не принял миссию (круг ${next} из ${C.reworkLimit}): ${firstLine(remarks)}. ` +
        "Замечания в карточке миссии, ход — Координатору.",
      false,
      { tone: "warn", ntfy: "quiet", title: "Narthex: миссия возвращена" },
    );
    const fresh = await notion("GET", `pages/${mission.id}`).catch(() => mission);
    const coord = (await roles().catch(() => [])).find((r) => r.fn === "Coordinator");
    if (!coord) {
      pause("Миссия возвращена с приёмки, но активного Coordinator нет: ход возвращать некому.", {
        kind: "review-nocoord",
        ref: mission.id,
      });
      return true;
    }
    await requestPlan(fresh, coord, await queueOf(fresh), "Миссия возвращена с приёмки: разбери замечания карточками.", {
      force: true,
    });
    return true;
  }

  /** Ход отдельной приёмки миссии; вердикт по карточке сюда не относится. */
  async function reviewStep(role, expect, manual = false) {
    if (!expect || expect.kind !== "review") {
      pause("Это не отдельный ход приёмки миссии: вердикт не применяю.", {
        kind: "handoff-kind", ref: expect?.ref || "",
      });
      return true;
    }
    const currentReview = () => {
      const live = GM_getValue(K.expect, null);
      return Boolean(live && live.kind === "review" && norm(live.ref) === norm(expect.ref) &&
        norm(live.turnId) === norm(expect.turnId));
    };
    if (!currentReview()) {
      pause("Ожидание приёмки изменилось: чужой ход не перезаписываю.", {
        kind: "marker-mismatch", ref: expect.ref || "",
      });
      return true;
    }
    const mission = await activeMission();
    if (!mission) {
      pause("Приёмка ждёт ответа, а активной миссии нет: закрывать нечего.", {
        kind: "review-no-mission", ref: expect.ref || "",
      });
      return true;
    }
    if (norm(expect.ref) !== norm(mission.id) || (expect.missionId && norm(expect.missionId) !== norm(mission.id))) {
      pause("Ожидание приёмки относится к другой миссии: ничего не меняю.", {
        kind: "marker-mismatch", ref: expect.ref || "",
      });
      return true;
    }
    const decision = messagesAfter(expect.watermark)
      .map((m) => parseMarker(m.raw, "CF_REVIEW_RESULT"))
      .filter(Boolean)
      .at(-1);
    if (!decision) return markerMissing(role, expect, "CF_REVIEW_RESULT", manual);
    if (!decision.mission_id || norm(decision.mission_id) !== norm(mission.id) ||
        (expect.turnId && (!decision.turn_id || norm(decision.turn_id) !== norm(expect.turnId))) ||
        decision.dispatch_id || decision.run_id) {
      pause("Маркер не относится к этому ходу приёмки миссии (mission_id / turn_id / карточка): ничего не меняю.", {
        kind: "marker-mismatch", ref: mission.id, turnId: expect.turnId || "",
      });
      return true;
    }
    const verdict = String(decision.verdict || "").trim().toLowerCase();
    if (verdict === "accept") {
      // Очередь могла измениться, пока Reviewer проверял миссию. Старый
      // вердикт не распространяется на новые или незакрытые карточки.
      const fresh = await queueOf(mission);
      const open = fresh.submitted.length + fresh.running.length + fresh.ready.length + fresh.rework.length;
      if (open) {
        if (currentReview()) GM_setValue(K.expect, null); // старое принятие нельзя повторить после обработки новой работы
        pause(`Пока шла приёмка, очередь изменилась: ${fresh.summary}. Миссия не закрыта; ` +
          "разберите карточки и запустите приёмку заново.", {
          kind: "review-with-open", ref: mission.id,
        });
        return true;
      }
      const stillActive = await activeMission();
      if (!stillActive || norm(stillActive.id) !== norm(mission.id) || !currentReview()) {
        pause("Пока шла приёмка, активная миссия или ожидание изменились: ничего не закрываю.", {
          kind: "marker-mismatch", ref: mission.id,
        });
        return true;
      }
      if (decision.summary) log(`Приёмка: ${oneLine(decision.summary, 300)}`);
      const closed = await closeMission(stillActive, role);
      if (currentReview()) GM_setValue(K.expect, null); // только после подтверждённой записи миссии
      return closed;
    }
    if (verdict === "rework") {
      if (!currentReview()) {
        pause("Ожидание приёмки изменилось: возврат не применяю.", { kind: "marker-mismatch", ref: mission.id });
        return true;
      }
      GM_setValue(K.expect, null);
      try {
        return await returnMission(mission, decision, role);
      } catch (e) {
        if (!GM_getValue(K.expect, null)) GM_setValue(K.expect, expect);
        throw e;
      }
    }
    if (verdict === "master") {
      pause(`Приёмка просит Мастера: ${firstLine(decision.reason || decision.remarks || "причина не указана")}. Миссия не закрыта.`, {
        kind: "review-needs-master", ref: mission.id,
      });
      return true;
    }
    pause(
      `В маркере приёмки нет verdict accept, rework или master (пришло «${verdict || "пусто"}»): миссию не трогаю. ` +
        "Поправьте маркер в ответе приёмки и нажмите «Продолжить».",
      { kind: "review-marker", ref: mission.id },
    );
    return true;
  }

  // ─────────────────────── вопросы: отвечает приёмка ───────────────────────
  /**
   * Вопрос агента больше не ждёт Мастера.
   *
   * Раньше вопрос ложился строкой в «Вопросы» со сроком, цикл шёл по варианту
   * по умолчанию, а ответ Мастера мог прийти через сутки или не прийти вовсе.
   * 28.10 Мастер сказал прямо: на вопросы отвечает приёмка, и отвечает сразу —
   * ход переключается на неё, как только вопрос записан.
   *
   * Теперь у вопроса две судьбы:
   *   answer — приёмка решила по существу: «Ответ» записан, «Статус» =
   *            «Решено», и ответ уезжает агентам обычным путём на следующем
   *            ходе («Ответы на вопросы» в промпте);
   *   master — без Мастера физически нельзя (нужен новый агент, доступ, смена
   *            ТЗ или оракула): только тогда цикл встаёт и зовёт его.
   *
   * Предел срока (`Срок`, «Принят дефолт») остаётся страховкой: если приёмка
   * недоступна, вопрос не висит вечно, а закрывается вариантом по умолчанию.
   */
  const answerQueue = () => {
    const stored = GM_getValue(K.answers, []);
    return Array.isArray(stored) ? stored : [];
  };

  /** Поставить вопрос в очередь приёмки. Повтор с тем же id не дублируется. */
  function queueAnswer(row, q, ctx = {}) {
    if (!row || !row.id) return null;
    const item = {
      id: row.id,
      text: q.text,
      fullText: q.fullText || q.text,
      fallback: q.fallback,
      options: Array.isArray(q.options) ? q.options : [],
      role: ctx.roleName || "",
      card: ctx.card || "",
      mission: ctx.mission || "",
      at: Date.now(),
    };
    const list = answerQueue().filter((row0) => row0.id !== item.id);
    list.push(item);
    GM_setValue(K.answers, list.slice(-10));
    return item;
  }

  const dropAnswer = (id) => GM_setValue(K.answers, answerQueue().filter((item) => item.id !== id));

  const answerPending = () => answerQueue()[0] || null;

  /** Промпт приёмке: ответить на вопрос агента по существу или позвать Мастера. */
  function answerPrompt(mission, role, item, turnId) {
    const name = rt(mission.properties["Миссия"]) || "миссия";
    const tz = mission.properties["ТЗ URL"]?.url || "не задано";
    return [
      technicalInfo(role),
      "",
      `Миссия: ${name}`,
      `ТЗ и оракул: ${tz}`,
      `Вопрос задал: ${item.role || "агент"}${item.card ? ` · карточка «${item.card}»` : ""}`,
      "",
      "ВОПРОС",
      item.fullText,
      "",
      item.options.length ? `Варианты, которые предложил агент: ${item.options.join(" · ")}` : "",
      `Вариант по умолчанию (по нему работа идёт прямо сейчас): ${item.fallback}`,
      "",
      "ЧТО ОТ ТЕБЯ ТРЕБУЕТСЯ",
      "Ты — приёмка миссии и на вопросы агентов отвечаешь вместо Мастера. Решай по существу: что правильнее для миссии и её оракула, а не что проще согласовать.",
      "Ответ увидят исполнитель и Координатор на следующем ходе — пиши решение, а не рассуждение: что делать, где граница, по какому признаку считать сделанным.",
      "Твой ответ записывается в «Ответ» этой строки, статус становится «Решено», и на следующем ходе он уезжает агентам строкой «Ответы на вопросы». Поэтому ответ должен быть самодостаточным: агент увидит его без твоего чата.",
      "Если вопрос про предложение (`docs/decisions/*.md`, статус `proposed`) — отвечай решением по существу: принять, отклонить или отложить, и что именно поменять. Статус файла меняет исполнитель карточкой, не ты.",
      "Ничего не правь: ни карточки, ни код, ни документы. Твой выход — ответ или вызов Мастера.",
      "Мастера зовёшь только тогда, когда без него физически нельзя: нужен новый агент в Arena, доступ или ключ, смена ТЗ или оракула. «Так спокойнее» и «пусть подтвердит» — не повод.",
      "",
      "ОТВЕТ — одной строкой в конце, ровно один маркер:",
      `CF_ANSWER_RESULT {"question_id":"${item.id}","turn_id":"${turnId}","verdict":"answer","answer":"<решение: что делать и по какому признаку считать сделанным>"}`,
      "или, если без Мастера физически нельзя:",
      `CF_ANSWER_RESULT {"question_id":"${item.id}","turn_id":"${turnId}","verdict":"master","reason":"<чего именно не хватает: роль, доступ, решение по ТЗ>"}`,
      "",
      roleContext(role),
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Передать вопрос приёмке. `true` — ход ушёл ей; `false` — отвечать некому
   * (вопрос остаётся «Ждёт» и закрывается сроком или Мастером).
   */
  async function startAnswer(mission, item) {
    const role = await reviewerRole();
    if (!role) {
      log(
        "Вопрос записан, но активной роли с функцией Reviewer нет: отвечать некому — вопрос ждёт Мастера.",
        false,
        { ntfy: "quiet", title: "Narthex: отвечать на вопрос некому" },
      );
      dropAnswer(item.id);
      return false;
    }
    const turnId = uid();
    log(`Вопрос «${oneLine(item.text, 90)}» передан приёмке «${role.name}».`, false, { ntfy: "quiet" });
    await sendToRole(role, answerPrompt(mission, role, item, turnId), "answer", item.id, {
      questionId: item.id,
      missionId: mission.id,
      turnId,
      title: "ответ на вопрос агента",
    });
    return true;
  }

  /** Ход приёмки по вопросу: записать ответ или позвать Мастера. */
  async function answerStep(role, expect, manual = false) {
    const decision = messagesAfter(expect.watermark)
      .map((m) => parseMarker(m.raw, "CF_ANSWER_RESULT"))
      .filter(Boolean)
      .at(-1);
    if (!decision) return markerMissing(role, expect, "CF_ANSWER_RESULT", manual);
    GM_setValue(K.expect, null);
    const qid = String(decision.question_id || "").trim();
    if (qid && norm(qid) !== norm(expect.ref)) {
      pause(`Маркер ответа относится к другому вопросу (${qid}), а ждём ${expect.ref}: ничего не меняю.`, {
        kind: "marker-mismatch",
        ref: expect.ref,
      });
      return true;
    }
    const verdict = String(decision.verdict || "").trim().toLowerCase();
    const answer = String(decision.answer || "").trim();
    if (verdict === "master") {
      const reason = firstLine(String(decision.reason || answer || "").trim()) || "приёмка не назвала причину";
      dropAnswer(expect.ref);
      pause(
        `Приёмка не может ответить на вопрос без Мастера: ${reason}. Вопрос остался в базе «Вопросы» со статусом ` +
          "«Ждёт» — ответьте в поле «Ответ», поставьте «Решено» и нажмите «Продолжить».",
        { kind: "answer-needs-master", ref: expect.ref, notifyTitle: "Narthex: вопрос ждёт Мастера" },
      );
      return true;
    }
    if (verdict !== "answer") {
      pause(
        `В маркере ответа нет verdict answer или master (пришло «${verdict || "пусто"}»): вопрос не закрываю. ` +
          "Поправьте маркер в ответе приёмки и нажмите «Продолжить».",
        { kind: "answer-marker", ref: expect.ref },
      );
      return true;
    }
    if (!answer) {
      pause("Приёмка ответила без текста решения: пустой ответ ничего не меняет, вопрос остаётся открытым.", {
        kind: "answer-empty",
        ref: expect.ref,
      });
      return true;
    }
    // Вопрос могли закрыть руками, пока приёмка думала: тогда её ответ уже
    // никому не нужен, и перезаписывать чужое решение нельзя.
    const row = await notion("GET", `pages/${expect.ref}`).catch(() => null);
    const state = row?.properties?.["Статус"]?.select?.name || "";
    if (state && state !== Q.wait) {
      dropAnswer(expect.ref);
      log(
        `Вопрос закрыт раньше приёмки («${state}») — ответ не перезаписываю, ход возвращается Координатору.`,
        false,
        { tone: "warn", ntfy: "quiet" },
      );
    } else {
      await patch(expect.ref, {
        "Статус": { select: { name: Q.done } },
        "Ответ": { rich_text: richText(answer) },
      });
      dropAnswer(expect.ref);
    }
    // Панель знает про ответ сразу: вопрос больше не «Ждёт».
    try {
      const cache = openQuestions();
      GM_setValue("cfn-q-open", { at: cache.at, rows: cache.rows.filter((row) => row.id !== expect.ref) });
      paintQuestions(openQuestions().rows);
    } catch (e) {
      dbg("вопросы: панель не обновилась", e.message);
    }
    log(`Вопрос закрыт приёмкой «${role.name}»: ${oneLine(answer, 160)}`, false, { tone: "ok", ntfy: "quiet" });
    // Ход возвращается Координатору: ответ придёт ему строкой в промпте
    // («Ответы на вопросы»), а next из хода, где вопрос был задан, не
    // применялся — он посчитан без ответа.
    const mission = await activeMission().catch(() => null);
    if (!mission) {
      log("Вопрос закрыт, но активной миссии нет: продолжать не с чего.");
      return true;
    }
    const coord = (await roles().catch(() => [])).find((r) => r.fn === "Coordinator");
    if (!coord) {
      pause("Вопрос закрыт, но активного Coordinator нет: ход возвращать некому.", {
        kind: "answer-nocoord",
        ref: mission.id,
      });
      return true;
    }
    const queue = await queueOf(mission).catch(() => ({ summary: "очередь не прочитана" }));
    await requestPlan(mission, coord, queue, "Ответ на вопрос записан — учти его и продолжи план.", {
      force: true,
    });
    return true;
  }

  async function dispatchTask(card, roleName, mission = null) {
    const role = (await roles()).find((r) => r.name === roleName);
    if (!role) throw new Error(`Роль «${roleName}» не найдена среди активных.`);

    // Карточка перечитывается прямо перед выдачей: между выбором из списка и
    // отправкой её мог тронуть Координатор, прошлый тик или человек. 23.10
    // NAR-1.7 выдали второй раз с новым run — она была в списке Ready уже
    // отвеченной, и агент честно повторил ту же работу.
    const fresh = await notion("GET", `pages/${card.id}`);
    const state = taskState(fresh);
    let prLink = fresh.properties["PR"]?.url || "";
    let submittedAt = fresh.properties["Submitted At"]?.date?.start || "";
    // Карточку, которую Координатор снова направил в работу, транспорт чистит
    // сам: следы прошлого ответа («Submitted At», «PR», «Run ID») ставит выдача,
    // и только она имеет право их снять. Координатор их не трогает — коннектор
    // отвечает validation_error, а ждать, пока Rework попадёт в опрос, нельзя:
    // 27.10 на NAR-4.9 он длился меньше одного тика и выдача отказала.
    const clearing = redispatchClearProps(fresh);
    if (clearing) {
      const why = redispatchWhy(fresh);
      try {
        await patch(fresh.id, clearing);
        // Ответа на карточке больше нет — и отметка о нём тоже: следующий
        // ответ поставит новую.
        GM_setValue(answerStampKey(fresh.id), "");
      } catch (e) {
        log(
          `«${taskTitle(fresh)}» вернулась в работу (${why}), но следы прошлого ответа не снялись (${e.message}) — выдача отменена.`,
          true,
        );
        return `следы прошлого ответа не снялись: ${e.message}`;
      }
      GM_setValue(reworkKey(fresh.id), 0);
      submittedAt = "";
      prLink = "";
      log(`«${taskTitle(fresh)}» снова в работе — ${why}: снял «Submitted At», «PR» и «Run ID», выдаю заново.`, false, {
        tone: "ok",
      });
      const times = noteRedispatch(fresh.id);
      if (times >= REDISPATCH_LIMIT) {
        GM_setValue(redispatchKey(fresh.id), []);
        pause(
          `«${taskTitle(fresh)}» перевыдали ${times} раз за шесть часов — похоже, Координатор и исполнитель ` +
            "гоняют одну и ту же карточку и не замечают этого. Очередь и карточка на месте: посмотрите «Ответ» " +
            "и журнал, поправьте постановку и нажмите «Продолжить».",
          { kind: "redispatch", ref: fresh.id },
        );
        return true;
      }
    }
    if (state !== "Ready" || submittedAt || prLink) {
      const why =
        state !== "Ready"
          ? `уже ${state || "не в Ready"}`
          : `уже отвечена${prLink ? ` (${prLink})` : ""}`;
      log(`«${taskTitle(fresh)}» ${why} — повторно не выдаю.`, true, {
        ntfy: "quiet",
        title: "Narthex: повторная выдача отменена",
      });
      // Карточка не в Ready — значит Координатор назвал работой ту, которую сам
      // же не вернул в очередь. Это его ход, а не сбой сети: пауза ставится
      // только на третьем повторе (см. ветку `dispatch` в `coordinatorStep`),
      // а до тех пор ход возвращается Координатору с точной причиной.
      return state !== "Ready"
        ? `сейчас она в «${state || "неизвестном состоянии"}», а не в Ready`
        : "на ней остались следы прошлого ответа";
    }
    GM_setValue("cfn-dispatch-miss", 0);

    // Карточку выдали заново — прошлое неотправленное задание к ней больше не
    // относится: иначе оно ушло бы вторым сообщением уже после новой выдачи.
    const stale = GM_getValue(K.pending, null);
    const staleExpect = GM_getValue(K.expect, null);
    if (stale && stale.undelivered && staleExpect && norm(staleExpect.ref) === norm(card.id)) {
      GM_setValue(K.pending, null);
      GM_setValue(K.expect, null);
      log("Карточку выдали заново — прошлая неотправленная очередь снята.");
    }

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
    // Карточка уже в Running, задание в очереди: отсюда выдача состоялась, даже
    // если `sendToRole` не отправил текст (тот же текст уходил минуту назад —
    // это защита от дубля, а не отказ). Отказ отправки разбирает сторож
    // неотправленной очереди, а не вызывающий.
    const queued = await sendToRole(role, executorPrompt(card, role, payload, logId, runId, mission?.id || ""), "dispatch", card.id, {
      runId,
      missionId: mission?.id || "",
      logId,
      title: taskTitle(card),
      // Ссылка нужна минимальному повтору: «прочитай карточку сам».
      url: card.url || "",
    });
    if (!queued) {
      // Очередь не создалась (сработала защита от повтора — тот же текст уже
      // уходил этой роли минуту назад). Значит хода нет, а карточка уже
      // Running: без ожидания её никто не поведёт, и Координатор увидит
      // «работу», которой нет. Возвращаем в Ready и говорим об этом прямо.
      const left = GM_getValue(K.expect, null);
      if (!left || norm(left.ref) !== norm(card.id)) {
        await releaseUndelivered(
          { kind: "dispatch", ref: card.id, runId, title: taskTitle(card) },
          "задание не поставлено в очередь",
        );
        return "задание не поставлено в очередь (то же сообщение уже уходило)";
      }
    }
    return true;
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
   * дважды за 30 секунд — это не «ещё раз», а зацикливание: значит страница не
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
      Date.now() - Number(last.at || 0) < 30_000;
    if (recent) {
      pause(
        `Не удалось открыть страницу «${role.name}»: остаюсь на ${from}. ` +
          "Страница не открылась за два перехода подряд — возможно, медленная загрузка или адрес в «Ролях» неверен. Проверьте адрес и нажмите «Продолжить».",
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
    // Повтор записи снимка не запускает ход и работает также в ручном режиме
    // и на паузе. Его не ждём: сетевой шлюз не должен блокировать «Шаг».
    flushPollJournal().catch((e) => log(`Очередь записи опросов не обработана: ${e.message}`, true));
    // Ложный отказ проверки мержа чинится сам: иначе карточка ждёт Мастера,
    // а работа уже лежит в main (24.10 так было дважды).
    try {
      await selfHealClaim();
    } catch (e) {
      log(`Самопроверка последнего отказа не удалась: ${e.message}`, true);
    }
    // Незавершённая отправка живёт в очереди и не зависит от автоцикла:
    // иначе после перехода на страницу адресата задание никто не досылал.
    const auto = autoOn();
    const pending = GM_getValue(K.pending, null);
    const waiting = GM_getValue(K.expect, null);
    if (!auto && !fromToggle && !pending && !waiting) return;
    // Пауза снимается только человеком: тик не имеет права её обойти.
    if (isPaused()) {
      // Единственное исключение — пауза, поставленная прошлой миссией: к
      // текущей она не относится и молча держала бы новый цикл.
      if (!(await clearStaleMissionPause())) {
        if (fromToggle) log(`Шаг не выполнен: цикл на паузе (${GM_getValue(K.paused, "")}).`, true);
        return;
      }
    }
    // Вопросы к Мастеру живут отдельным сторожем (`watchQuestions`): они видны
    // и на паузе, а тик до паузы не доходит.
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
      // Новая миссия — новый ход: остатки прошлой снимаются до любых решений.
      try {
        if (await syncMissionState()) return;
      } catch (e) {
        dbg("миссия: сверка не удалась", e.message);
        const held = GM_getValue(K.expect, null);
        if (held?.kind === "dispatch" || (held?.kind === "reminder" && held.runId)) {
          logThrottled("dispatch-mission-check", "Не удалось сверить миссию выдачи с Notion: ожидание сохранено, повторю проверку на следующем шаге.", true);
          return;
        }
      }
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
      let me = list.find((r) => norm(r.id) === norm(meId));
      // Список мог устареть в кеше: Мастер только что вписал этот Agent URL.
      // Один перечит мимо кеша дешевле, чем «страница не привязана к роли».
      if (!me) me = (await rolesFresh().catch(() => [])).find((r) => norm(r.id) === norm(meId));
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

      // Страница не догружена — шаг ничего не делает. Ни вставки, ни кликов,
      // ни закрытия панелей: на недорисованной странице любое действие либо
      // уходит в пустоту, либо бьёт по чужому элементу.
      const shell = appReady();
      if (!shell.ok) {
        logThrottled(
          "app-ready",
          `Страница ещё грузится (${shell.why}) — ничего не делаю, жду.`,
          false,
          C.tickMs * 4,
        );
        return;
      }

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
        expect = {
          ...expect,
          kind: expect.runId
            ? "dispatch"
            : expect.questionId
              ? "answer"
              : me.fn === "Coordinator" ? "plan" : me.fn === "Reviewer" ? "review" : "dispatch",
        };
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
      //
      // И третья разница, из-за которой этот блок переписан 25.10: отсутствие
      // ответа на ещё не отрисованной странице — не молчание, а загрузка.
      if (expect) {
        const since = Number(expect.sentAt || expect.at) || 0;
        const waited = Date.now() - since;

        // Отсчёт наблюдения — с того момента, когда страница адресата открылась
        // в этой попытке, а не с отправки: после обрыва связи и «Продолжить»
        // скрипт заходит на страницу, которой ещё секунду назад не видел.
        const path = location.pathname || "/";
        if (expect.seenPath !== path || !Number(expect.seenAt)) {
          expect = { ...expect, seenPath: path, seenAt: Date.now(), readyAt: 0, pageReloaded: false };
          GM_setValue(K.expect, expect);
        }
        const watched = Date.now() - Number(expect.seenAt || Date.now());

        // Пока транскрипт не отрисован, о молчании агента не судим: пустая
        // страница — это загрузка или сеть, а не «задание не дошло».
        const page = pageReady(expect);
        if (page.ok && !Number(expect.readyAt)) {
          // Дальше короткая выдержка: сразу после отрисовки ответ может ещё
          // доезжать, и «пусто» в этот момент ничего не доказывает.
          expect = { ...expect, readyAt: Date.now() };
          GM_setValue(K.expect, expect);
        }
        if (!page.ok) {
          if (watched > C.pageWaitMs) {
            // Ожидание НЕ снимаем и карточку НЕ трогаем: работа могла быть
            // сделана, а ответ — лежать в чате. Это пауза про связь, а не про
            // исполнителя, поэтому после «Продолжить» всё перечитывается.
            expect = { ...expect, seenAt: 0, readyAt: 0, pageReloaded: false };
            GM_setValue(K.expect, expect);
            pause(
              `Страница «${me.name}» не открылась за ${Math.round(watched / 1000)} с (${page.why}). ` +
                "Это не молчание агента: ожидание, очередь и карточка на месте. " +
                "Проверьте связь и нажмите «Продолжить» — скрипт перечитает страницу и заберёт ответ.",
              { kind: "offline", ref: me.id, runId: expect.runId || "" },
            );
            return;
          }
          if (watched > C.pageReloadMs && !expect.pageReloaded) {
            expect = { ...expect, pageReloaded: true };
            GM_setValue(K.expect, expect);
            log(
              `Страница «${me.name}» не отрисовалась за ${Math.round(watched / 1000)} с (${page.why}) — ` +
                "перечитываю её. Ожидание не снимаю: ответ агента остаётся в чате.",
            );
            location.reload();
            return;
          }
          logThrottled(
            `page-render:${me.id}`,
            `Страница «${me.name}» ещё не отрисовалась (${page.why}) — жду, ответ не снимаю.`,
            false,
            C.tickMs,
          );
          return;
        }

        const observed = Number(expect.readyAt) ? Date.now() - Number(expect.readyAt) : 0;
        const fresh = messagesAfter(expect.watermark || "").length;
        const working = stillWorking();
        if (waited > C.replyWaitMs && observed > C.observeGraceMs && !fresh && !working) {
          const stuck = expect;
          dropHandoff(
            `${me.name} не ответил ни одним сообщением за ${Math.round(waited / 60000)} мин и ничего не делает: ` +
              `страница открыта и видна, ответа в ней нет — похоже, задание до него не дошло. ` +
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

      // Вопрос, который ещё не отвечен, важнее нового хода: как только вопрос
      // записан, ход переходит приёмке (1.4.80). Проверка стоит до выбора
      // роли, поэтому работает и на странице исполнителя, и на странице
      // Координатора — с любой из них транспорт уходит к приёмке сам.
      if (!expect && me.fn !== "Reviewer") {
        const item = answerPending();
        if (item && (fromToggle || autoOn())) {
          const mission = await activeMission().catch(() => null);
          if (mission && (await startAnswer(mission, item))) return;
        }
      }

      if (expect?.kind === "dispatch") {
        // У Reviewer тоже бывают карточки. Их вердикт — ответ по карточке,
        // а не назначенная отдельно приёмка миссии.
        await submitExecutor(me, expect, fromToggle);
      } else if (me.fn === "Coordinator") {
        await coordinatorStep(me, expect, fromToggle);
      } else if (me.fn === "Reviewer" && expect) {
        if (expect.kind === "answer") await answerStep(me, expect, fromToggle);
        else if (expect.kind === "review") await reviewStep(me, expect, fromToggle);
        else pause(`Неизвестный вид хода приёмки «${expect.kind || "пусто"}»: ничего не меняю.`, {
          kind: "handoff-kind", ref: expect.ref || "",
        });
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
        pause(`Неизвестный вид хода «${expect.kind || "пусто"}»: карточку и миссию не меняю.`, {
          kind: "handoff-kind", ref: expect.ref || "",
        });
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
          ? e.refused
            ? `Шлюз Drive ответил отказом: ${e.reason} Запись не сделана, в Диске ничего не менялось. ` +
              "Если отказ про папку — в карточке указан не журнал: «Output Drive File ID» должен " +
              "указывать на файл из Arena/logs; скрипт вернёт его сам после обновления."
            : "Шлюз Drive не ответил, ответ агента в журнал не записан. Проверьте, что " +
              "развёртывание Apps Script открыто «любому, у кого есть ссылка», и что ссылка в ⚙ та же."
          : /HTTP (?:429|5\d\d)/i.test(raw)
            ? "Notion ответил сбоем на своей стороне — это не ошибка карточки и не потерянный ход. " +
              "Скрипт повторил запрос и подождал; Notion не восстановился за это время. Обычно проходит за минуту-другую."
            : /HTTP 4\d\d/i.test(raw)
              ? "Notion отклонил запись: он ответил, и сеть тут ни при чём — данные не прошли его проверку. " +
                (/length should be/i.test(raw)
                  ? "Не поместился текст: одно поле принимает не больше 2000 знаков на объект — " +
                    "это дефект скрипта, а не ошибка карточки или ответа. "
                  : "") +
                "Запись не сделана, ход не потерян."
              : e && e.narthex === "notion" && e.link
                ? "Связь с Notion пропала: запрос не дошёл, и два зонда (через 5 и 15 с) её не вернули. " +
                  "Обычно это сон машины или вкладка в фоне — проверьте интернет и нажмите «Продолжить». " +
                  "Запись не сделана, ход не потерян."
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
