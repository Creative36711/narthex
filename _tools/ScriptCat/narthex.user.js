// ==UserScript==
// @name         Narthex — передача хода между агентами
// @namespace    https://arena.ai/
// @version      1.0.1
// @description  Бесконечный цикл Координатор → исполнитель → Координатор с авто-мержем PR и явным флагом завершения миссии.
// @match        https://arena.ai/*
// @match        https://www.arena.ai/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.notion.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// ==/UserScript==

/**
 * Narthex dispatch — тонкий транспорт.
 *
 * Что делает скрипт:
 *  - читает миссию, роли и очередь из Notion;
 *  - выдаёт задачу исполнителю, забирает ответ, пишет лог в Drive;
 *  - прокручивает PR: Create pull request → Merge pull request → Continue;
 *  - возвращает ход Координатору и повторяет, пока миссия не завершена.
 *
 * Требует шлюза Drive v1.3 (папка логов определяется самим шлюзом) и токена
 * Notion с доступом к трём источникам данных страницы «Narthex».
 *
 * Что скрипт НЕ делает: не придумывает задачи, не оценивает качество, не
 * решает, что миссия выполнена. Это работа Координатора; скрипт только
 * исполняет его решение (поле "next" в маркере) и останавливается, когда
 * миссия перестала быть активной.
 */
(() => {
  "use strict";

  // ───────────────────────────── конфиг ─────────────────────────────
  const C = {
    notionV: "2025-09-03",
    roles: "72202ed5-bace-4136-bc68-4ae91c4f659c",
    requests: "10a1e55a-832e-499f-b14c-b42b0d0a3c6e",
    missions: "2f3ddf72-9797-4d9d-b810-26ca3995673a",
    pageUrl: "https://app.notion.com/p/4016f0cf57058118910cfae5f0d67bcf",
    tickMs: 15000,
    prWaitMs: 240000,
    markerRetries: 2,
    maxLog: 80,
  };

  const K = {
    notion: "cfn-notion-token",
    gwUrl: "cfn-gw-url",
    gwKey: "cfn-gw-key",
    auto: "cfn-auto-enabled",
    paused: "cfn-paused",
    log: "cfn-console-log",
    pending: "cfn-pending-dispatch",
    note: "cfn-pending-note",
    merged: "cfn-pr-merged:",
    branch: "cfn-branch",
    collapsed: "cfn-collapsed",
  };

  const ui = {
    panel: "cfn-panel",
    log: "cfn-log",
    status: "cfn-status",
    toggle: "cfn-toggle",
    setup: "cfn-setup",
    stop: "cfn-stop",
  };

  // ───────────────────────────── утилиты ─────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (x) => String(x || "").replace(/-/g, "").toLowerCase();
  const nowIso = () => new Date().toISOString();
  const rt = (p) => (p?.rich_text || p?.title || []).map((x) => x.plain_text || x.text?.content || "").join("");
  const sel = (p) => p?.select?.name || "";
  const uid = () => crypto.randomUUID();

  let entries = [];

  function renderLog() {
    const box = document.getElementById(ui.log);
    if (!box) return;
    box.innerHTML = entries
      .slice(-C.maxLog)
      .map((e) => `<div style="padding:1px 0;color:${e.error ? "#ff9c8a" : "#cfd3da"}">${e.text}</div>`)
      .join("");
    box.scrollTop = box.scrollHeight;
  }

  function log(text, error = false) {
    entries.push({ text: `${new Date().toLocaleTimeString("ru-RU")} ${text}`, error });
    GM_setValue(K.log, entries.slice(-C.maxLog));
    console.log(`[Narthex] ${text}`);
    renderLog();
    setStatus();
  }

  function setStatus(extra) {
    const el = document.getElementById(ui.status);
    if (!el) return;
    const auto = GM_getValue(K.auto, false);
    const paused = GM_getValue(K.paused, "");
    el.textContent = extra || (paused ? `Пауза: ${paused}` : auto ? "Автоцикл включён" : "Ручной режим");
    const toggle = document.getElementById(ui.toggle);
    if (toggle) toggle.textContent = auto ? "Остановить автоцикл" : "Запустить автоцикл";
  }

  function mount() {
    if (document.getElementById(ui.panel)) return;
    const panel = document.createElement("div");
    panel.id = ui.panel;
    panel.style.cssText = [
      "position:fixed", "right:14px", "bottom:14px", "z-index:2147483000",
      "width:340px", "background:#15171c", "color:#e7eaee", "border:1px solid #2b2f38",
      "border-radius:10px", "font:12px/1.4 ui-monospace,Menlo,Consolas,monospace",
      "box-shadow:0 10px 30px rgba(0,0,0,.45)", "overflow:hidden",
    ].join(";");
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b1e25;border-bottom:1px solid #2b2f38">
        <strong style="font-size:12px">Narthex</strong>
        <span id="${ui.status}" style="opacity:.7;font-size:11px"></span>
        <span style="flex:1"></span>
        <button id="${ui.setup}" style="${btnStyle()}">⚙</button>
        <button id="${ui.toggle}" style="${btnStyle()}">…</button>
        <button id="${ui.stop}" style="${btnStyle()}">✕</button>
      </div>
      <div id="${ui.log}" style="max-height:190px;overflow:auto;padding:6px 10px"></div>`;
    document.body.appendChild(panel);
    document.getElementById(ui.setup).onclick = () => setup(true);
    document.getElementById(ui.stop).onclick = () => {
      GM_setValue(K.paused, "остановлено вручную");
      GM_setValue(K.auto, false);
      log("Автоцикл остановлен вручную.");
    };
    document.getElementById(ui.toggle).onclick = () => {
      const auto = !GM_getValue(K.auto, false);
      GM_setValue(K.auto, auto);
      GM_setValue(K.paused, auto ? "" : "остановлено вручную");
      log(auto ? "Автоцикл включён." : "Автоцикл выключен.");
      if (auto) tick(true);
    };
    renderLog();
    setStatus();
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
    if (new URL(location.href).searchParams.has("cf-auth-setup")) {
      const clean = new URL(location.href);
      clean.searchParams.delete("cf-auth-setup");
      history.replaceState(null, "", clean.toString());
    }
    try {
      const me = await notion("GET", "users/me");
      const ping = await gateway("ping", "");
      log(`Настройка сохранена: ${me.name || "Notion OK"}, шлюз ${ping.result || "OK"}.`);
    } catch (e) {
      log(`Настройка сохранена, но проверка не прошла: ${e.message}`, true);
    }
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

  async function roles() {
    const rows = (await query(C.roles)).map((p) => ({
      id: rt(p.properties["Arena Agent ID"]),
      name: rt(p.properties["Роль"]),
      url: p.properties["Arena Agent URL"]?.url || "",
      target: sel(p.properties["Execution Target"]),
      fn: sel(p.properties["Dispatch Function"]),
      status: sel(p.properties["Статус"]),
      pageId: p.id,
      notionUrl: p.url,
    }));
    // В цикле участвуют только роли со статусом «Активна»: «Ждёт» означает,
    // что агент ещё не подключён, и выдавать ему задачу бессмысленно.
    const active = rows.filter((r) => r.id && r.url && r.target === "Arena agent" && r.status === "Активна");
    const ids = active.map((r) => norm(r.id));
    if (new Set(ids).size !== ids.length) throw new Error("В реестре ролей повторяется Arena Agent ID.");
    if (active.filter((r) => r.fn === "Coordinator").length > 1)
      throw new Error("В Notion должна быть ровно одна активная роль Coordinator.");
    return active;
  }

  async function activeMission() {
    const rows = await query(C.missions, { property: "Состояние", select: { equals: "Активна" } }, [
      { property: "Создана", direction: "descending" },
    ]);
    return rows[0] || null;
  }

  const taskTitle = (p) => rt(p.properties["Запрос"]);
  const taskState = (p) => sel(p.properties["Dispatch State"]);
  const taskRole = (p) => sel(p.properties["Кому"]);
  const taskSeq = (p) => p.properties["Sequence"]?.number ?? 0;

  /**
   * Задачи миссии в заданном состоянии. Совпадение по «Миссия» принимаем в двух
   * видах: id страницы миссии или её название. Координатор — ИИ, и требовать от
   * него uuid в каждом поле значит гарантированно получить расхождение.
   */
  async function tasks(state, mission) {
    const rows = await query(
      C.requests,
      { property: "Dispatch State", select: { equals: state } },
      [{ property: "Sequence", direction: "ascending" }],
    );
    if (!mission) return rows;
    const wanted = [mission.id, rt(mission.properties["Миссия"])].filter(Boolean).map((x) => x.trim().toLowerCase());
    return rows.filter((row) => {
      const value = rt(row.properties["Миссия"]).trim().toLowerCase();
      return !value || wanted.some((w) => value === w || value.includes(w) || w.includes(value));
    });
  }

  // ───────────────────────────── маркеры ─────────────────────────────
  function lastLines(text) {
    return String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trimEnd()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function parseMarker(text, name) {
    const line = lastLines(text).at(-1) || "";
    const m = line.match(new RegExp(`^${name}[ \\t]+(\\{[^\\r\\n]*\\})$`));
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }

  const agentResult = (t) => parseMarker(t, "CF_AGENT_RESULT");
  const coordinatorResult = (t) => parseMarker(t, "CF_COORDINATOR_RESULT");

  // ───────────────────────────── DOM ─────────────────────────────
  const visible = (el) => !!el && el.getClientRects().length > 0;

  function composer() {
    return [...document.querySelectorAll('div[contenteditable="true"], textarea')].find(visible) || null;
  }

  function sendButton(editor = composer()) {
    if (!editor) return null;
    const pool = [...document.querySelectorAll("button")].filter((b) => visible(b) && !b.disabled);
    const labelled = pool.find((b) => /send message|отправить/i.test(`${b.getAttribute("aria-label") || ""} ${b.textContent || ""}`));
    if (labelled) return labelled;
    const form = editor.closest("form");
    if (form) {
      const submits = [...form.querySelectorAll('button[type="submit"]')].filter(visible);
      if (submits.length === 1) return submits[0];
    }
    return null;
  }

  function fillComposer(text) {
    const editor = composer();
    if (!editor) return false;
    editor.focus();
    if (editor.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(editor, text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      editor.innerHTML = "";
      const lines = String(text).split("\n");
      for (const line of lines) {
        const p = document.createElement("div");
        p.textContent = line || "\u200b";
        editor.appendChild(p);
      }
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    }
    return true;
  }

  function lastAssistantText() {
    const nodes = [...document.querySelectorAll('[data-agent-transcript-message="true"][id^="chat-message-"]')];
    const node = nodes.at(-1);
    if (!node) return null;
    const prose = node.querySelector('[class*="prose"]') || node;
    const clone = prose.cloneNode(true);
    clone.querySelectorAll("button,svg,[role='alert']").forEach((n) => n.remove());
    return { id: node.id.replace("chat-message-", ""), text: clone.innerText.trim() };
  }

  const generating = () => !!document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i]');

  // ───────────────────────────── PR ─────────────────────────────
  function prButton() {
    return [...document.querySelectorAll("button[aria-label]")].find(
      (b) => visible(b) && !b.disabled && /^(Create pull request|Merge pull request)$/i.test(b.getAttribute("aria-label")),
    ) || null;
  }

  const prMerged = () => !!document.querySelector('[aria-label="Pull request merged"]');

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

  async function waitFor(predicate, timeoutMs, stepMs = 1500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = predicate();
      if (value) return value;
      await sleep(stepMs);
    }
    return null;
  }

  /**
   * Доводит PR до состояния Merged и жмёт Continue.
   * Кнопки отправляют текст агенту, поэтому каждая нажимается не более одного
   * раза на задачу и только когда она видима и активна.
   */
  async function ensureMerged(task) {
    const key = `${K.merged}${task.id}`;
    if (GM_getValue(key, false)) return "already";
    const deadline = Date.now() + C.prWaitMs;
    let clickedCreate = false;
    let clickedMerge = false;

    while (Date.now() < deadline) {
      if (prMerged()) {
        log("PR в состоянии Merged.");
        const cont = continueButton();
        if (cont) {
          cont.click();
          log("Нажата Continue после мержа.");
          await sleep(2500);
        }
        const branch = branchName();
        if (branch) {
          GM_setValue(K.branch, branch);
          try {
            await patch(task.id, { Branch: { rich_text: [{ type: "text", text: { content: branch } }] } });
          } catch (e) {
            log(`Ветка ${branch} не записана в Notion: ${e.message}`, true);
          }
          log(`Рабочая ветка: ${branch}`);
        }
        GM_setValue(key, true);
        return "merged";
      }

      const btn = prButton();
      if (btn) {
        const label = btn.getAttribute("aria-label");
        if (label === "Create pull request" && !clickedCreate) {
          clickedCreate = true;
          btn.click();
          log("Нажата «Create pull request» — агент создаёт PR.");
          await sleep(4000);
          continue;
        }
        if (label === "Merge pull request" && !clickedMerge) {
          clickedMerge = true;
          btn.click();
          log("Нажата «Merge pull request» — PR сливается.");
          await sleep(4000);
          continue;
        }
      }
      await sleep(2000);
    }
    log("PR не доведён до Merged за отведённое время; шаг пропущен.", true);
    return "timeout";
  }

  // ───────────────────────────── промпты ─────────────────────────────
  function roleContext(role) {
    return [
      `Ты — ${role.name}. Твоя зона и гейт записаны в Notion → Роли.`,
      `Общие правила платформы: ${C.pageUrl}`,
      "Работай только в пределах карточки задачи. Не меняй чужие зоны, не мержи PR сам.",
    ].join("\n");
  }

  function executorPrompt(task, role, payload, logId, runId) {
    return [
      `Задача ${taskTitle(task)} (Dispatch ${task.id}, Run ${runId}).`,
      "",
      "ЦЕЛЬ И ГРАНИЦЫ",
      `Scope: ${rt(task.properties["Scope"]) || "не задан"}`,
      `Критерий приёмки: ${rt(task.properties["Acceptance"]) || "не задан"}`,
      "",
      "ЗАДАНИЕ",
      payload || "(текст задания не найден — работай по карточке)",
      "",
      "ПОРЯДОК",
      "1. Сделай работу в своей ветке.",
      "2. Закоммить и запушь. Если есть изменения — создай PR в main.",
      "3. Приложи проверку: команда, код возврата, путь к отчёту.",
      "4. В конце ответа — отдельной последней строкой маркер:",
      `CF_AGENT_RESULT {"dispatch_id":"${task.id}","run_id":"${runId}","status":"submitted","check":0,"report":"…"}`,
      "",
      roleContext(role),
      `Лог этой попытки: https://drive.google.com/file/d/${logId}/view`,
    ].join("\n");
  }

  function coordinatorPrompt(mission, role, queueSummary) {
    const turn = uid();
    return [
      `Миссия: ${rt(mission.properties["Миссия"])}.`,
      `ТЗ: ${mission.properties["ТЗ URL"]?.url || "не задано"}`,
      `Очередь: ${queueSummary}`,
      "",
      "Твой ход. Выбери ровно одно действие:",
      "1) если есть Submitted — проверь и поставь вердикт (Accepted/Rework) в Notion;",
      "2) если нужен исполнитель — создай карточку в «Запросы» со статусом Ready, полями Scope, Acceptance, Sequence и Кому, затем направь ход;",
      "3) если миссия выполнена — поставь «Состояние» = «Завершена» и направь ход done.",
      "",
      "Заверши ответ отдельной последней строкой:",
      `CF_COORDINATOR_RESULT {"mission_id":"${mission.id}","turn_id":"${turn}","status":"completed","next":"<роль|done>"}`,
      "",
      roleContext(role),
    ].join("\n");
  }

  // ───────────────────────────── отправка промпта ─────────────────────────────
  async function sendToRole(role, text, tag) {
    await GM_setValue(K.pending, { roleId: role.id, text, tag, at: Date.now() });
    location.assign(role.url);
  }

  async function tryDispatchPending() {
    const pending = await GM_getValue(K.pending, null);
    if (!pending) return false;
    const me = (location.pathname.match(/\/agent\/([\w-]+)/) || [])[1];
    if (!me || norm(me) !== norm(pending.roleId)) return false;
    if (Date.now() - pending.at > 10 * 60 * 1000) {
      await GM_setValue(K.pending, null);
      return false;
    }
    if (generating()) return false;
    const editor = composer();
    if (!editor) return false;
    if (!fillComposer(pending.text)) return false;
    await sleep(800);
    const btn = sendButton(editor);
    if (!btn) {
      log("Кнопка Send не найдена — текст остался в редакторе, нажмите вручную.", true);
      return false;
    }
    btn.click();
    await GM_setValue(K.pending, null);
    log(`Задание отправлено (${pending.tag}).`);
    return true;
  }

  // ───────────────────────────── ход исполнителя ─────────────────────────────
  async function submitExecutor(role) {
    const msg = lastAssistantText();
    if (!msg) return false;
    const result = agentResult(msg.text);
    if (!result) return false;
    if (GM_getValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, false)) return false;

    const page = await notion("GET", `pages/${result.dispatch_id}`);
    if (taskState(page) !== "Running") {
      log("Задача уже не Running — повторная запись не нужна.");
      await GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
      return false;
    }
    if (norm(rt(page.properties["Recipient Agent ID"])) !== norm(role.id)) {
      log("Ответ принадлежит другому агенту — пропуск.", true);
      return false;
    }

    const logId = rt(page.properties["Output Drive File ID"]);
    if (!logId) throw new Error("В карточке нет Output Drive File ID.");
    const marker = `<!-- CF_DISPATCH ${result.dispatch_id}:${result.run_id} -->`;
    await gateway("append", logId, {
      marker,
      entry: `\n\n${marker}\n## Ответ ${role.name}\n\n${msg.text}\n`,
    });

    // Сначала PR, потом статус. Если мерж не состоялся, задача остаётся
    // Running, цикл встаёт на паузу, и после снятия паузы шаг повторится:
    // лог дописывается идемпотентно по маркеру.
    const merged = await ensureMerged(page);
    if (merged === "timeout")
      throw new Error(`PR по задаче «${taskTitle(page)}» не слит — проверьте страницу Arena.`);

    const props = {
      "Dispatch State": { select: { name: "Submitted" } },
      "Ответ": { rich_text: [{ type: "text", text: { content: `Ответ из chat-message-${msg.id} записан в лог ${logId}.` } }] },
      "Submitted At": { date: { start: nowIso() } },
    };
    if (typeof result.check === "number")
      props["Check"] = { select: { name: result.check === 0 ? "pass" : "fail" } };
    if (result.report)
      props["Report SHA"] = { rich_text: [{ type: "text", text: { content: String(result.report).slice(0, 200) } }] };
    await patch(result.dispatch_id, props);
    await GM_setValue(`cfn-done:${result.dispatch_id}:${result.run_id}`, true);
    log(`Ответ ${role.name} записан, PR слит, задача → Submitted.`);

    const co = (await roles()).find((r) => r.fn === "Coordinator");
    location.assign(co.url);
    return true;
  }

  // ───────────────────────────── ход Координатора ─────────────────────────────
  async function coordinatorStep(role) {
    const mission = await activeMission();
    if (!mission) {
      log("Нет активной миссии. Автоцикл ждёт.");
      return false;
    }

    await releaseStalled(mission);
    const submitted = await tasks("Submitted", mission);
    const running = await tasks("Running", mission);
    const ready = await tasks("Ready", mission);

    const last = lastAssistantText();
    const decision = last ? coordinatorResult(last.text) : null;
    const tag = `cfn-turn:${mission.id}:${submitted.length}:${ready.length}:${running.length}`;
    if (decision && GM_getValue(tag, false)) return false;

    if (decision) {
      await GM_setValue(tag, true);
      if (decision.next === "done") {
        await patch(mission.id, {
          "Состояние": { select: { name: "Завершена" } },
          "Завершена": { date: { start: nowIso() } },
        });
        GM_setValue(K.auto, false);
        log("Координатор объявил миссию завершённой. Автоцикл остановлен.");
        return true;
      }
      const roleName = decision.next;
      const card = ready.find((t) => taskRole(t) === roleName) || ready[0];
      if (!card) {
        throw new Error(`Координатор направил ход в «${roleName}», но Ready-карточки нет.`);
      }
      return dispatchTask(card, roleName, mission);
    }

    if (submitted.length) {
      const summary = `${submitted.length} Submitted, ${running.length} Running, ${ready.length} Ready`;
      await sendToRole(role, coordinatorPrompt(mission, role, summary), "review");
      return true;
    }

    // Без явного решения Координатора ход никому не выдаётся: очередь — его
    // зона, а скрипт только исполняет. Готовые карточки тоже ждут "next".
    const summary = `0 Submitted, ${running.length} Running, ${ready.length} Ready`;
    await sendToRole(role, coordinatorPrompt(mission, role, summary), "plan");
    return true;
  }

  /** Задача в Running без движения дольше 45 минут возвращается в Ready. */
  async function releaseStalled(mission) {
    const running = await tasks("Running", mission);
    const limit = 45 * 60 * 1000;
    for (const card of running) {
      const started = card.properties["Started At"]?.date?.start;
      if (!started) continue;
      if (Date.now() - Date.parse(started) < limit) continue;
      await patch(card.id, { "Dispatch State": { select: { name: "Ready" } } });
      log(`Задача «${taskTitle(card)}» зависла в Running — возвращена в Ready.`, true);
    }
  }

  async function dispatchTask(card, roleName, mission) {
    const role = (await roles()).find((r) => r.name === roleName);
    if (!role || !role.url) {
      log(`Роль «${roleName}» не найдена или без Arena URL.`, true);
      return false;
    }
    const runId = uid();
    const payloadId = rt(card.properties["Payload Drive File ID"]);
    let payload = "";
    if (payloadId) {
      try {
        const res = await gateway("read", payloadId);
        payload = res.content || "";
      } catch (e) {
        log(`Payload не прочитан: ${e.message}`, true);
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
    await sendToRole(role, executorPrompt(card, role, payload, logId, runId), "dispatch");
    return true;
  }

  // ───────────────────────────── цикл ─────────────────────────────
  let busy = false;

  async function tick(fromToggle = false) {
    if (busy) return;
    if (!GM_getValue(K.auto, false) && !fromToggle) return;
    if (GM_getValue(K.paused, "")) return;
    busy = true;
    try {
      await setup(false);
      if (await tryDispatchPending()) return;
      const id = (location.pathname.match(/\/agent\/([\w-]+)/) || [])[1];
      if (!id) return;
      const list = await roles();
      const me = list.find((r) => norm(r.id) === norm(id));
      if (!me) return;
      if (generating()) return;
      if (me.fn === "Coordinator") await coordinatorStep(me);
      else await submitExecutor(me);
    } catch (e) {
      log(`Ошибка цикла: ${e.message}`, true);
      GM_setValue(K.paused, e.message);
      GM_setValue(K.auto, false);
      setStatus(`Пауза: ${e.message}`);
    } finally {
      busy = false;
      setStatus();
    }
  }

  // ───────────────────────────── старт ─────────────────────────────
  entries = GM_getValue(K.log, []) || [];
  const boot = () => {
    mount();
    setStatus();
    setup(false);
    setInterval(() => tick(false), C.tickMs);
    tick(false);
  };
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();
