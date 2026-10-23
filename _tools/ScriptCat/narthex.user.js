// ==UserScript==
// @name         Narthex — передача хода между агентами
// @namespace    https://arena.ai/
// @version      1.4.1
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
    ntfy: "cfn-ntfy",
    count: "cfn-log-count",
  };

  // ───────────────────────────── утилиты ─────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (x) => String(x || "").replace(/-/g, "").toLowerCase();
  const nowIso = () => new Date().toISOString();
  const rt = (p) => (p?.rich_text || p?.title || []).map((x) => x.plain_text || x.text?.content || "").join("");
  const sel = (p) => p?.select?.name || "";
  const uid = () => crypto.randomUUID();

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
    (typeof GM_info !== "undefined" && GM_info?.script?.version) || "1.4.1";

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
        <span id="${ui.status}" style="opacity:.75;font-size:11px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">…</span>
        <span id="${ui.count}" style="opacity:.45;font-size:10px">0/${C.maxLog}</span>
        <span style="flex:1"></span>
        <button id="${ui.step}" title="Один шаг цикла" style="${btnStyle()}">Шаг</button>
        <button id="${ui.toggle}" style="${btnStyle()}">▶ Включить</button>
        <button id="${ui.ntfy}" title="Уведомления ntfy: тихие вехи и громкие тревоги" style="${btnStyle()}">🔔</button>
        <button id="${ui.clear}" title="Очистить журнал" style="${btnStyle()}">🧹</button>
        <button id="${ui.setup}" title="Настройка" style="${btnStyle()}">⚙</button>
        <button id="${ui.stop}" title="Остановить цикл и снять паузу" style="${btnStyle()}">✕</button>
      </div>
      <div id="${ui.log}" style="max-height:200px;overflow:auto;padding:6px 10px"></div>`;
    document.body.appendChild(panel);

    document.getElementById(ui.setup).onclick = () => setup(true);
    document.getElementById(ui.clear).onclick = () => clearLog();
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
      tick(true);
    };
    document.getElementById(ui.toggle).onclick = () => toggleAuto();
    renderLog();
    setStatus();
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
    return clone.innerText.trim();
  }

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
    // сообщения в транскрипте помечены отдельным layout.
    const list = messages().filter((n) => !n.querySelector('[data-user-message-layout="true"]'));
    if (!watermark) return list.map((n) => ({ id: nodeId(n), text: messageText(n) }));
    const out = [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const id = nodeId(list[i]);
      if (id === watermark) break;
      out.unshift({ id, text: messageText(list[i]) });
    }
    return out;
  }

  const nodeId = (n) => n.id.replace("chat-message-", "");

  function parseMarker(text, name) {
    const lines = String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      const at = line.indexOf(name);
      if (at === -1) continue;
      const json = line.slice(at + name.length).trim();
      try {
        return JSON.parse(json);
      } catch {
        continue;
      }
    }
    return null;
  }

  const generating = () => !!document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i]');

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

  function markerReminder(role, expect, attempt, markerName) {
    const line =
      expect.kind === "plan"
        ? `CF_COORDINATOR_RESULT {"mission_id":"${expect.missionId || expect.ref}","turn_id":"${expect.turnId || ""}","status":"completed","next":"<роль|done>"}`
        : role.fn === "Auditor"
          ? `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь к отчёту>"}`
          : `CF_AGENT_RESULT {"dispatch_id":"${expect.ref}","run_id":"${expect.runId || ""}","status":"submitted","check":0,"report":"<путь>","pr":<номер PR>,"merged":true}`;
    return [
      `ТЕХНИЧЕСКОЕ НАПОМИНАНИЕ ScriptCat (${attempt} из ${C.markerReminders}; это не задание и не новый ход).`,
      `Твой предыдущий ответ${expect.title ? ` по «${expect.title}»` : ""} пришёл без обязательного маркера ${markerName}.`,
      "Он не засчитан: ScriptCat не видит, закончена работа или нет.",
      "Не повторяй уже сделанное и не жди Мастера — отсутствие маркера техническая ошибка формата.",
      "Если работа завершена, ответь ровно одной последней строкой:",
      line,
      "Строка должна быть последней, без блока кода и без текста после неё.",
      "",
      roleContext(role),
    ].filter(Boolean).join("\n");
  }

  /**
   * Ждём ответ без маркера. Возвращает true, если ход уже обработан
   * (напоминание ушло или цикл поставлен на паузу).
   */
  async function markerMissing(role, expect, markerName) {
    if (generating()) return false;
    const replies = messagesAfter(expect.watermark || "");
    const last = replies.at(-1);
    if (!last) return false; // агент ещё не ответил — это нормальное ожидание

    const signature = `${last.id}:${last.text.length}`;
    if (expect.lastReplySig !== signature) {
      GM_setValue(K.expect, { ...expect, lastReplySig: signature, lastReplyAt: Date.now() });
      return false; // ответ ещё дописывается
    }
    if (Date.now() - (expect.lastReplyAt || Date.now()) < C.markerIdleMs) return false;

    const sent = Number(expect.tries) || 0;
    if (markerStep(sent) === "remind") {
      log(
        `${role.name} ответил без маркера ${markerName} — напоминание ${sent + 1} из ${C.markerReminders}.`,
        true,
        { ntfy: "quiet", title: "Narthex: нет маркера" },
      );
      await sendToRole(role, markerReminder(role, expect, sent + 1, markerName), "reminder", expect.ref, {
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
  function composer() {
    return document.querySelector('[contenteditable="true"]');
  }

  function sendButton(editor) {
    const scope = editor?.closest("form") || document;
    return [...scope.querySelectorAll("button")].find(
      (b) => !b.disabled && (b.type === "submit" || /send/i.test(b.getAttribute("aria-label") || "")),
    ) || null;
  }

  function fillComposer(text) {
    const editor = composer();
    if (!editor) return false;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
    if ((editor.innerText || "").length < 10) {
      editor.innerText = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
    return true;
  }

  async function sendToRole(role, text, kind, ref, extra = {}) {
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
      ...extra,
    });
    GM_setValue("cfn-me", role.name);
    setStatus();
    location.assign(role.url);
  }

  /** Перейти на страницу роли без задания: используется для возврата хода. */
  async function goTo(role) {
    GM_setValue(K.pending, null);
    GM_setValue("cfn-me", role.name);
    setStatus();
    location.assign(role.url);
  }

  async function consumePending() {
    const pending = GM_getValue(K.pending, null);
    if (!pending) return false;
    const me = roleFromPath();
    if (!me || norm(me) !== norm(pending.roleId)) return false;
    if (Date.now() - pending.at > 10 * 60 * 1000) {
      GM_setValue(K.pending, null);
      return false;
    }
    if (generating()) return false;
    const editor = composer();
    if (!editor) return false;
    if (!fillComposer(pending.text)) return false;
    await sleep(800);
    const btn = sendButton(editor);
    if (!btn) {
      pause("Кнопка Send не найдена: задание осталось в редакторе, автоклик отменён.", { kind: "send" });
      return false;
    }
    // Водяной знак ставится здесь, на странице адресата: id последнего
    // сообщения ДО отправки. На странице отправителя он был бы чужим, и
    // «ответ без маркера» нельзя было бы отличить от старой переписки.
    const expect = GM_getValue(K.expect, null);
    if (expect && norm(expect.roleId) === norm(me)) {
      GM_setValue(K.expect, { ...expect, watermark: lastMessageId(), sentAt: Date.now() });
    }
    btn.click();
    GM_setValue(K.pending, null);
    log("Задание отправлено.");
    return true;
  }

  // ───────────────────────────── PR ─────────────────────────────
  /**
   * Видимость по геометрии плюс computed style. Поймано пробой на разметке
   * Arena: скрытый бейдж «Merged» остаётся в DOM рядом с видимым «Closed»,
   * а поиск по одному querySelector находил именно скрытый и считал
   * закрытый PR слитым.
   */
  const visible = (el) => {
    if (!el || el.getClientRects().length === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  };

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
      "Сгенерировано ScriptCat. Это не задание и не текст Координатора: это факты о",
      "среде, в которой ты работаешь. Задание — ниже, под блоком.",
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
      "`pr` и `merged: true` обязательны, если PR слит: по ним ScriptCat отличает «слит» от «закрыт без мержа» — бейдж в интерфейсе у обоих случаев один и тот же (Closed).",
      "",
      "Кнопки «Create pull request» и «Merge pull request» нажимать не нужно: их нажимает",
      "ScriptCat только если ты не запушил. После мержа ScriptCat сам нажмёт Continue.",
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
      "отдельного PR у тебя нет, ScriptCat не ждёт мержа и сразу запишет ответ.",
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
  async function submitExecutor(role, expect) {
    const candidates = messagesAfter(expect.watermark)
      .map((m) => ({ ...m, result: parseMarker(m.text, "CF_AGENT_RESULT") }))
      .filter((m) => m.result);
    const exact = candidates.filter((m) => norm(m.result.dispatch_id) === norm(expect.ref));
    const hit = (exact.length ? exact : candidates).at(-1);
    if (!hit) return markerMissing(role, expect, "CF_AGENT_RESULT");

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

    if (expect && expect.kind === "plan") {
      const decision = messagesAfter(expect.watermark)
        .map((m) => parseMarker(m.text, "CF_COORDINATOR_RESULT"))
        .filter(Boolean)
        .at(-1);
      if (!decision) return markerMissing(role, expect, "CF_COORDINATOR_RESULT");

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
    await sendToRole(role, executorPrompt(card, role, payload, logId, runId), "dispatch", card.id, {
      runId,
      title: taskTitle(card),
    });
    return true;
  }

  // ───────────────────────────── цикл ─────────────────────────────
  let busy = false;

  async function tick(fromToggle = false) {
    if (busy) return;
    if (!GM_getValue(K.auto, false) && !fromToggle) return;
    // Пауза снимается только человеком: тик не имеет права её обойти.
    if (isPaused()) return;
    busy = true;
    try {
      // Ошибка на экране важнее любого шага: сначала остановиться.
      if (monitorVisibleErrors()) return;
      await setup(false);
      if (await consumePending()) return;
      const meId = roleFromPath();
      if (!meId) return;
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

      const expect = GM_getValue(K.expect, null);
      if (expect && norm(expect.roleId) !== norm(me.id)) {
        if (fromToggle) log("Шаг не выполнен: сейчас очередь другой роли.");
        return;
      }

      if (me.fn === "Coordinator") await coordinatorStep(me, expect, fromToggle);
      else await submitExecutor(me, expect);
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
    mount();
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
    tick(false);
  };
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();
