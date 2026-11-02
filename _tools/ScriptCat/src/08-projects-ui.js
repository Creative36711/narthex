  // ───────────────────────────── управление проектами ─────────────────────────────
  // Смена адресов источников у уже работающего профиля не переносит очередь:
  // изменённая копия получает новый UUID и новое пространство состояния.
  let projectAsyncWork = 0;
  const PROJECT_HOLD_PREFIX = "cfn-project-switch-hold:";
  function projectHeld() {
    try { return sessionStorage.getItem(PROJECT_HOLD_PREFIX + ACTIVE_PROFILE.id) === "1"; }
    catch { return true; }
  }
  function releaseProjectHold() {
    try {
      const held = projectHeld();
      sessionStorage.removeItem(PROJECT_HOLD_PREFIX + ACTIVE_PROFILE.id);
      // Отложенный шаг старой сессии не должен запуститься второй раз при
      // следующей навигации: пользователь сейчас запускает этот шаг вручную.
      if (held) GM_setValue(K.step, false);
      return true;
    } catch { return false; }
  }
  function projectRoleAllowed(role) {
    if (ACTIVE_PROFILE.legacy) return true;
    try {
      const target = new URL(role.url, location.href);
      if (target.origin === location.origin && /^\/agent\/[\w-]+\/?$/.test(target.pathname)) return true;
    } catch { /* остановка ниже */ }
    pause("Адрес роли должен быть страницей агента Arena на том же домене, что и эта вкладка. " +
      "Иначе браузер потеряет выбранный профиль: поправьте Agent URL в базе «Роли».",
      { kind: "project-role-origin", ref: role.id || "" });
    return false;
  }
  function trackProjectTask(promise) {
    projectAsyncWork += 1;
    return Promise.resolve(promise).finally(() => { projectAsyncWork -= 1; });
  }

  /** Проверка схемы и ролей только чтением, до включения фоновых сторожей. */
  async function validateProjectSchema(settings) {
    const headers = { Authorization: `Bearer ${settings.notion}`, "Notion-Version": C.notionV, "Content-Type": "application/json" };
    const contracts = [
      ["Роли", C.roles, { "Роль": "title", "Функция": "select", "Статус": "select", "Agent URL": "url", "Зона записи": "rich_text", "Гейт": "rich_text" },
        { "Функция": ["Coordinator", "Executor", "Auditor", "Reviewer"], "Статус": ["Активна"] }],
      ["Миссии", C.missions, { "Миссия": "title", "Состояние": "select", "Создана": "date", "Завершена": "date", "Возвращена": "date", "Круг": "number", "Замечания": "rich_text", "Итог": "rich_text", "ТЗ URL": "url" },
        { "Состояние": ["Активна", "Возвращена", "Завершена", "Провалена"] }],
      ["Запросы", C.requests, { "Запрос": "title", "Миссия": "rich_text", "Кому": "select", "Sequence": "number", "Dispatch State": "select", "Run ID": "rich_text", "Recipient Agent ID": "rich_text", "Started At": "date", "Submitted At": "date", "PR": "url", "Check": "select", "Output Drive File ID": "rich_text", "Payload Drive File ID": "rich_text", "Намерение": "rich_text", "Инварианты": "rich_text", "Acceptance": "rich_text", "Свободно": "rich_text", "Scope": "rich_text", "Ответ": "rich_text", "Branch": "rich_text", "Report SHA": "rich_text" },
        { "Dispatch State": ["Draft", "Ready", "Running", "Submitted", "Accepted", "Rework", "Blocked"], "Check": ["pass", "fail"] }],
      ["Обратная связь", C.questions, { "Вопрос": "title", "Статус": "select", "По умолчанию": "rich_text", "Ответ": "rich_text", "Варианты": "rich_text", "Срок": "date", "Доставлено": "date", "Материал": "url", "Роль": "rich_text", "Карточка": "rich_text", "Миссия": "rich_text", "Что блокирует": "rich_text" },
        { "Статус": ["Ждёт", "Решено", "Принят дефолт", "Отменён"] }],
    ];
    const schemas = {};
    try {
      for (const [label, id, fields, options] of contracts) {
        const source = await request("GET", `https://api.notion.com/v1/data_sources/${id}`, headers);
        if (!source || source.object !== "data_source" || !source.properties) throw new Error(`«${label}»: источник не вернул схему.`);
        const errors = [];
        for (const [name, type] of Object.entries(fields)) {
          if (source.properties[name]?.type !== type) errors.push(`${name}: нужен ${type}`);
        }
        for (const [name, required] of Object.entries(options)) {
          const actual = source.properties[name]?.select?.options;
          if (!Array.isArray(actual)) errors.push(`${name}: нет списка select`);
          else for (const value of required) if (!actual.some((option) => option.name === value)) errors.push(`${name}: нет «${value}»`);
        }
        if (errors.length) throw new Error(`«${label}»: ${errors.join(", ")}.`);
        schemas[label] = source.properties;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      const rows = [], cursors = new Set();
      let cursor = "";
      while (true) {
        const page = await request("POST", `https://api.notion.com/v1/data_sources/${C.roles}/query`, headers,
          { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }, { retry: false });
        if (!page || !Array.isArray(page.results) || typeof page.has_more !== "boolean") throw new Error("База «Роли» вернула неполный список.");
        rows.push(...page.results);
        if (rows.length > 1000) throw new Error("База «Роли» слишком велика для проверки.");
        if (!page.has_more) break;
        cursor = String(page.next_cursor || "");
        if (!cursor || cursors.has(cursor)) throw new Error("База «Роли» вернула неверный курсор.");
        cursors.add(cursor);
      }
      const active = rows.map(mapRoleRow).filter((role) => role.status === "Активна");
      if (active.filter((role) => role.fn === "Coordinator").length !== 1) throw new Error("Нужен ровно один активный Coordinator.");
      if (!active.some((role) => role.fn === "Reviewer")) throw new Error("Нужна активная роль Reviewer для приёмки и вопросов.");
      if (!active.some((role) => ["Executor", "Auditor"].includes(role.fn))) throw new Error("Нужен активный исполнитель или аудитор.");
      const roleIds = new Set();
      const recipientOptions = schemas["Запросы"]["Кому"].select.options || [];
      for (const role of active) {
        let url;
        try { url = new URL(role.url); } catch { throw new Error(`У роли «${role.name}» некорректный Agent URL.`); }
        if (url.origin !== location.origin || !/^\/agent\/[\w-]+\/?$/.test(url.pathname) || !role.id)
          throw new Error(`У роли «${role.name}» Agent URL должен быть страницей агента на домене этой вкладки.`);
        if (roleIds.has(role.id.toLowerCase())) throw new Error("Несколько активных ролей используют один Agent URL.");
        roleIds.add(role.id.toLowerCase());
        if (["Executor", "Auditor"].includes(role.fn) && !recipientOptions.some((option) => option.name === role.name))
          throw new Error(`В «Запросы → Кому» отсутствует вариант «${role.name}».`);
      }
      const branch = await request("GET", `https://api.github.com/repos/${C.repo}/branches/${encodeURIComponent(C.branch)}`, githubHeaders(settings.github));
      if (!branch || branch.name !== C.branch) throw new Error(`GitHub не подтвердил ветку ${C.branch}.`);
      return { ok: true, text: "Основные поля, варианты select, роли и базовая ветка читаются. Права записи и содержимое старых карточек не проверялись." };
    } catch (e) {
      return { ok: false, text: `Схема или роли не прошли проверку: ${connectionProblem(e, settings)}` };
    }
  }

  /** UUID базы из HTTPS-ссылки Notion; ID представления в query не используется. */
  function notionDatabaseId(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "https:" || url.username || url.password ||
          !["app.notion.com", "notion.so", "www.notion.so"].includes(url.hostname)) return "";
      const path = decodeURIComponent(url.pathname);
      const matches = path.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/ig) || [];
      const id = (matches.at(-1) || "").replace(/-/g, "").toLowerCase();
      return id.length === 32 ? `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}` : "";
    } catch { return ""; }
  }

  function projectsDialog() {
    if (document.getElementById("cfn-projects")) return;
    const box = document.createElement("div");
    box.id = "cfn-projects";
    box.style.cssText = "position:fixed;inset:0;z-index:2147483201;background:rgba(5,7,12,.76);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;color:#e7eaee;font:13px/1.5 system-ui;color-scheme:dark";
    const field = `${inputStyle()};padding:8px;margin-top:4px;font:13px/1.35 ui-monospace,monospace`;
    const action = `${btnStyle()};font:12px/1.3 system-ui;padding:8px 10px`;
    box.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="cfn-projects-title" tabindex="-1" style="width:min(700px,100%);max-height:calc(100vh - 28px);overflow:auto;background:#151922;border:1px solid #434c5c;border-radius:14px;padding:18px">
        <div style="display:flex;gap:12px;align-items:start"><div style="flex:1"><h2 id="cfn-projects-title" style="margin:0 0 4px">Проекты</h2>
          <div style="color:#aab4c3">Текущий проект: <b id="cfn-project-current"></b>. Выбор закрепляется за этой вкладкой. Для одного проекта используйте только одну активную вкладку.</div></div>
          <button id="cfn-project-close" style="${action}" aria-label="Закрыть">✕</button></div>
        <label style="display:block;margin-top:14px">Сохранённые профили<select id="cfn-project-list" style="${field}"></select></label>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin:10px 0">
          <button id="cfn-project-switch" style="${action}">Открыть выбранный проект</button>
          <button id="cfn-project-new" style="${action}">Новый профиль</button>
          <button id="cfn-project-copy" style="${action}">Создать на основе выбранного</button>
          <button id="cfn-project-edit" style="${action}">Исправить текущий до первого допуска</button>
        </div>
        <div id="cfn-project-info" style="color:#aab4c3;white-space:pre-wrap"></div>
        <button id="cfn-project-enable" style="${action};margin-top:8px;background:#285638">Проверить подключения и разрешить работу</button>
        <div style="margin:8px 0;color:#ffd479;font-size:12px">Для нового проекта необходим шлюз 1.6 с отдельным ключом. После разрешения фоновые сторожа вопросов и старых ADR могут создавать записи; сам автоцикл не запускается.</div>
        <div id="cfn-project-form" style="display:none;border-top:1px solid #343b48;margin-top:14px;padding-top:12px">
          <h3 id="cfn-project-form-title" style="margin:0 0 6px">Новый профиль</h3>
          <div style="color:#aab4c3;font-size:12px">Нужны ID именно источников данных Notion, а не ID представлений или баз. Используйте отдельную копию четырёх баз с той же схемой и ролями Coordinator и Reviewer. Доступы сохраняются отдельно в «Подключениях» после переключения.</div>
          <div style="display:grid;gap:9px;margin-top:10px">
            <label>Имя проекта<input id="cfn-project-name" style="${field}" maxlength="80"></label>
            <label>Notion: источник «Роли»<input id="cfn-project-roles" style="${field}" placeholder="UUID источника или ссылка на базу"></label>
            <label>Notion: источник «Миссии»<input id="cfn-project-missions" style="${field}" placeholder="UUID источника или ссылка на базу"></label>
            <label>Notion: источник «Запросы»<input id="cfn-project-requests" style="${field}" placeholder="UUID источника или ссылка на базу"></label>
            <label>Notion: источник «Обратная связь»<input id="cfn-project-questions" style="${field}" placeholder="UUID источника или ссылка на базу"></label>
            <div style="border:1px solid #343b48;border-radius:8px;padding:10px;color:#aab4c3;font-size:12px">
              Если у вас ссылки на четыре отдельные базы, вставьте их выше и временно введите токен интеграции: кнопка прочитает ID источников. Токен не сохраняется и после поиска очищается; вводите его только на доверенной странице.
              <label style="display:block;margin-top:6px">Токен для поиска ID<input id="cfn-project-lookup-notion" type="password" autocomplete="off" style="${field}" placeholder="Токен Notion (не сохраняется)"></label>
              <button id="cfn-project-resolve" type="button" style="${action};margin-top:7px">Найти ID источников по ссылкам</button>
            </div>
            <label>URL регламента проекта в Notion<input id="cfn-project-pageUrl" style="${field}" placeholder="https://…"></label>
            <label>URL базы «Обратная связь» в Notion<input id="cfn-project-questionsUrl" style="${field}" placeholder="https://…"></label>
            <label>GitHub репозиторий<input id="cfn-project-repo" style="${field}" placeholder="owner/repository"></label>
            <label>Базовая ветка<input id="cfn-project-branch" style="${field}" value="main"></label>
            <label>Папка проекта внутри Arena (латиница)<input id="cfn-project-driveFolder" style="${field}" placeholder="synapse"></label>
          </div>
          <button id="cfn-project-save" style="${action};margin-top:12px;background:#285638">Создать профиль</button>
        </div>
        <div id="cfn-project-note" role="status" style="white-space:pre-wrap;color:#bfe6c4;margin-top:12px"></div>
      </div>`;
    document.body.appendChild(box);
    const find = (key) => box.querySelector(`#cfn-project-${key}`);
    const list = find("list"), note = find("note"), form = find("form");
    const fields = ["name", "roles", "missions", "requests", "questions", "pageUrl", "questionsUrl", "repo", "branch", "driveFolder"];
    const say = (message, error = false) => { note.textContent = message; note.style.color = error ? "#ffb4ad" : "#bfe6c4"; };
    let checking = false;
    let editingId = "";
    let openingRevision = JSON.stringify(profileRegistry());
    const profiles = () => [LEGACY_PROFILE, ...profileRegistry().filter(validProfile)];
    const chosen = () => profiles().find((p) => p.id === list.value);
    const render = (selected = ACTIVE_PROFILE.id) => {
      list.textContent = "";
      for (const profile of profiles()) {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        list.appendChild(option);
      }
      list.value = profiles().some((p) => p.id === selected) ? selected : LEGACY_PROFILE_ID;
      find("current").textContent = ACTIVE_PROFILE.name;
      const p = chosen();
      find("info").textContent = p ? `ID: ${p.id}\nGitHub: ${p.repo} · ветка ${p.branch}\nDrive: ${p.legacy ? "Arena/logs и Arena/payloads (совместимость)" : `Arena/${p.driveFolder}/{logs,payloads}`}` : "Профиль не найден.";
      find("enable").style.display = !ACTIVE_PROFILE.legacy && !ACTIVE_PROFILE.invalid && !projectApproved() ? "inline-block" : "none";
      const everApproved = !ACTIVE_PROFILE.legacy && (GM_getValue("cfn-project-ever-approved", false) || projectApproved());
      find("edit").style.display = !ACTIVE_PROFILE.legacy && !ACTIVE_PROFILE.invalid && !everApproved ? "inline-block" : "none";
    };
    const close = () => {
      if (checking) { say("Дождитесь завершения проверки проекта.", true); return; }
      find("lookup-notion").value = "";
      box.remove();
      document.getElementById(ui.setup)?.focus();
    };
    find("close").onclick = close;
    box.onkeydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const all = [...box.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.getClientRects().length);
      if (!all.length) return;
      if (event.shiftKey && (document.activeElement === all[0] || !all.includes(document.activeElement))) { event.preventDefault(); all.at(-1).focus(); }
      else if (!event.shiftKey && (document.activeElement === all.at(-1) || !all.includes(document.activeElement))) { event.preventDefault(); all[0].focus(); }
    };
    list.onchange = () => render(list.value);
    find("new").onclick = () => {
      editingId = "";
      find("save").textContent = "Создать профиль";
      find("form-title").textContent = "Новый профиль";
      for (const field of fields) find(field).value = field === "branch" ? "main" : "";
      form.style.display = "block"; say("Заполните настройки. Ничего в сервисах не создаётся автоматически.");
      find("name").focus();
    };
    find("copy").onclick = () => {
      editingId = "";
      find("save").textContent = "Создать профиль";
      find("form-title").textContent = "Новый профиль";
      const p = chosen(); if (!p) return;
      for (const field of fields) find(field).value = p[field] || (field === "branch" ? "main" : "");
      find("name").value = `${p.name} — новая настройка`;
      form.style.display = "block";
      say("Будет создан новый профиль с пустым состоянием и отдельными доступами; старый профиль не изменится.");
      find("name").focus();
    };
    find("edit").onclick = () => {
      if (ACTIVE_PROFILE.legacy || ACTIVE_PROFILE.invalid || projectApproved() || GM_getValue("cfn-project-ever-approved", false)) {
        say("Этот профиль уже использовался. Для других источников создайте новый профиль, не перенося очередь автоматически.", true); return;
      }
      if (checking || autoOn() || busy || projectAsyncWork > 0) {
        say("Дождитесь окончания всех начатых операций.", true); return;
      }
      editingId = ACTIVE_PROFILE.id;
      for (const field of fields) find(field).value = ACTIVE_PROFILE[field] || (field === "branch" ? "main" : "");
      find("save").textContent = "Сохранить исправления и перезагрузить вкладку";
      find("form-title").textContent = "Исправить текущий профиль";
      form.style.display = "block";
      say("Исправляется текущий профиль до первого допуска. Выбранный ID и сохранённые доступы остаются; схема и подключения будут проверены заново.");
      find("name").focus();
    };
    find("resolve").onclick = async () => {
      if (checking) return;
      const names = ["roles", "missions", "requests", "questions"];
      const values = names.map((name) => find(name).value.trim());
      const ids = values.map(notionDatabaseId);
      const token = find("lookup-notion").value.trim();
      if (!token || ids.some((id) => !id) || new Set(ids).size !== 4) {
        find("lookup-notion").value = "";
        say("Для поиска введите токен и четыре разные HTTPS-ссылки на базы Notion (не ссылки на представления).", true); return;
      }
      checking = true;
      say("Читаю источники четырёх баз в Notion; ничего не меняю и токен не сохраняю…");
      try {
        const headers = { Authorization: `Bearer ${token}`, "Notion-Version": C.notionV, "Content-Type": "application/json" };
        const sources = [];
        for (const id of ids) {
          const database = await request("GET", `https://api.notion.com/v1/databases/${id}`, headers);
          const list = database?.data_sources;
          if (!Array.isArray(list) || list.length !== 1 || !PROJECT_UUID.test(String(list[0]?.id || "")))
            throw new Error("У базы не ровно один доступный источник: укажите ID нужного data source вручную.");
          sources.push(list[0].id);
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        if (names.some((name, i) => find(name).value.trim() !== values[i]) || find("lookup-notion").value.trim() !== token) {
          say("Поля изменились во время поиска: результаты не подставлены, повторите проверку.", true); return;
        }
        if (new Set(sources.map((id) => id.toLowerCase())).size !== 4)
          throw new Error("У четырёх баз должны быть разные источники.");
        names.forEach((name, i) => { find(name).value = sources[i]; });
        say("ID четырёх источников найдены и подставлены. Это чтение не проверяет права записи или схему.");
      } catch (e) {
        say(`Поиск ID не завершён: ${connectionProblem(e, { notion: token, gwKey: "", github: "" })}`, true);
      } finally {
        find("lookup-notion").value = "";
        checking = false;
      }
    };
    find("save").onclick = () => {
      if (checking) { say("Дождитесь окончания поиска или проверки.", true); return; }
      if (JSON.stringify(profileRegistry()) !== openingRevision) {
        say("Список проектов изменился в другой вкладке. Закройте окно и откройте его заново.", true); return;
      }
      if (editingId && (editingId !== ACTIVE_PROFILE.id || profileRegistry().filter((item) => item.id === editingId).length !== 1 ||
          projectApproved() || GM_getValue("cfn-project-ever-approved", false) || checking || autoOn() || busy || projectAsyncWork > 0)) {
        say("Исправление доступно только текущему неиспользованному профилю и после окончания операций.", true); return;
      }
      const p = { id: editingId || crypto.randomUUID() };
      for (const field of fields) p[field] = find(field).value.trim();
      p.driveFolder = p.driveFolder.toLowerCase();
      if (!validProfile(p)) {
        say("Проверьте четыре разных UUID источников, HTTPS-ссылки Notion, owner/repository, допустимую ветку и имя папки из латинских букв, цифр, . _ -.", true); return;
      }
      const known = [LEGACY_PROFILE, ...profileRegistry().filter((item) => validProfile(item) && item.id !== editingId)];
      const sourceIds = new Set(known.flatMap((item) => [item.roles, item.missions, item.requests, item.questions]).map((id) => id.toLowerCase()));
      if ([p.roles, p.missions, p.requests, p.questions].some((id) => sourceIds.has(id.toLowerCase()))) {
        say("Один из источников уже используется другим профилем. Создайте отдельные копии всех четырёх баз, чтобы не смешать очереди и роли.", true); return;
      }
      if (known.some((item) => !item.legacy && item.driveFolder === p.driveFolder)) {
        say("Имя папки Drive уже занято другим профилем. Выберите отдельное имя.", true); return;
      }
      if (known.some((item) => item.repo.toLowerCase() === p.repo.toLowerCase()) &&
          !confirm("Этот GitHub-репозиторий уже используется другим профилем. Проекты смогут видеть и изменять один репозиторий. Продолжить?")) return;
      // Пока было открыто подтверждение, другая вкладка могла допустить
      // профиль или изменить реестр. Не записываем старый снимок поверх него.
      if (JSON.stringify(profileRegistry()) !== openingRevision ||
          (editingId && (projectApproved() || GM_getValue("cfn-project-ever-approved", false)))) {
        say("Профиль или его допуск изменился во время подтверждения. Откройте окно заново.", true); return;
      }
      try {
        if (editingId) {
          // Сначала ставим удержание, затем меняем реестр и перезагружаем closure.
          sessionStorage.setItem(PROJECT_HOLD_PREFIX + p.id, "1");
          rawSet(PROFILE_REGISTRY_KEY, profileRegistry().map((item) => item.id === editingId ? p : item));
          location.reload();
          return;
        }
        rawSet(PROFILE_REGISTRY_KEY, [...profileRegistry(), p]);
        openingRevision = JSON.stringify(profileRegistry());
      } catch { say("Не удалось сохранить профиль или перезагрузить вкладку. Проверьте настройки и обновите страницу вручную.", true); return; }
      form.style.display = "none"; render(p.id);
      say(`Профиль создан. ID: ${p.id}\nТеперь зарегистрируйте его в шлюзе Drive, откройте этот профиль и сохраните отдельные подключения.`);
    };
    find("switch").onclick = () => {
      const target = chosen();
      if (!target || target.id === ACTIVE_PROFILE.id) { say("Этот проект уже выбран."); return; }
      if (checking || autoOn() || busy || projectAsyncWork > 0) {
        say("Остановите автоцикл и дождитесь окончания всех начатых шагов и фоновых запросов. Затем повторите.", true); return;
      }
      const handoff = GM_getValue(K.pending, null) || GM_getValue(K.expect, null);
      if (!confirm(`Открыть «${target.name}»? Вкладка перезагрузится, автоцикл останется выключенным.${handoff ? "\nУ текущего проекта есть очередь или ожидание: они останутся в его профиле." : ""}\nПри возвращении к проекту ожидающий ход не продолжится без ручного шага.`)) return;
      try {
        sessionStorage.removeItem(projectStorageKey(target.id, "cfn-auto-enabled"));
        sessionStorage.setItem(PROJECT_HOLD_PREFIX + target.id, "1");
        sessionStorage.setItem(PROFILE_SESSION_KEY, target.id);
        location.reload();
      } catch { say("Не удалось сохранить выбор во вкладке; проект не переключён.", true); }
    };
    find("enable").onclick = async () => {
      if (checking || ACTIVE_PROFILE.invalid || ACTIVE_PROFILE.legacy) return;
      if (autoOn() || busy || projectAsyncWork > 0) { say("Сначала остановите цикл и дождитесь завершения операций.", true); return; }
      const settings = connectionSettings();
      const profileUnchanged = () => JSON.stringify(resolveProfile(ACTIVE_PROFILE.id)) === JSON.stringify(ACTIVE_PROFILE);
      if (!profileUnchanged()) { say("Профиль изменён в другой вкладке: обновите страницу и проверьте его заново.", true); return; }
      if (!settings.notion || !settings.gwUrl || !settings.gwKey) { say("Сначала сохраните Notion и Drive в «Подключениях»; затем вернитесь сюда.", true); return; }
      checking = true; say("Проверяю сохранённые подключения, проектный шлюз, основные поля Notion и роли…");
      try {
        const results = await Promise.all([probeNotionConnection(settings), probeDriveConnection(settings), probeGithubConnection(settings)]);
        if (results.some((result) => !result.ok)) { say(results.map((result) => result.text).join("\n"), true); return; }
        const schema = await validateProjectSchema(settings);
        if (!schema.ok) { say(schema.text, true); return; }
        if (!profileUnchanged()) { say("Профиль изменён в другой вкладке: обновите страницу и проверьте его заново.", true); return; }
        if (!sameConnections(settings, connectionSettings())) { say("Подключения изменились в другой вкладке; проверьте проект заново.", true); return; }
        if (!confirm("Источники, основные поля, роли, ветка и проектный шлюз проверены. Права записи и содержимое старых карточек не проверены.\n\nРазрешить работу? Фоновые сторожа вопросов и предложений могут создавать записи в Notion; автоцикл не запустится.")) return;
        if (!profileUnchanged()) { say("Профиль изменён во время подтверждения: обновите страницу и проверьте его заново.", true); return; }
        if (!sameConnections(settings, connectionSettings())) { say("Подключения изменились во время подтверждения; проверьте проект заново.", true); return; }
        GM_setValue("cfn-project-ever-approved", true);
        GM_setValue("cfn-project-approved", true);
        watchQuestions(); watchDecisions(); render();
        say("Работа проекта разрешена. Автоцикл выключен; запустите его вручную только после проверки схемы и ролей.");
      } catch (e) { say(`Проверка не завершена: ${connectionProblem(e, settings)}`, true); }
      finally { checking = false; }
    };
    render();
    find("close").focus();
  }
