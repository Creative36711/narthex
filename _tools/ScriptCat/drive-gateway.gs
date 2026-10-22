/**
 * Drive-шлюз ScriptCat для Narthex.
 *
 * Один корень, никакой самодеятельности:
 *
 *   Arena/
 *     Gateway     — этот Apps Script (создаёт человек, шлюз его не трогает)
 *     logs/       — лог на каждую пару Dispatch-Run
 *     payloads/   — тексты заданий длиннее 2000 знаков
 *
 * Шлюз не пишет в корень Диска вообще: и logs, и payloads создаются только
 * внутри Arena, а чужая папка в запросе отклоняется. Папка «Narthex — логи»
 * из версии 1.4 переносится внутрь Arena автоматически при первом обращении.
 *
 * Разворачивается как веб-приложение от имени владельца Диска.
 */
const CF_KEY_PROPERTY = "CF_GATEWAY_KEY";
const CF_ARENA_FOLDER_NAME = "Arena";
const CF_LOG_FOLDER_NAME = "logs";
const CF_PAYLOAD_FOLDER_NAME = "payloads";
// Версия 1.4 создавала эту папку в корне Диска. Оставлена только для переноса.
const CF_LEGACY_LOG_FOLDER_NAME = "Narthex — логи";
// legacy-путь: кампанийный dispatch.user.js присылает этот id. Папка в корзине,
// поэтому createLog с ним уходит в Arena/logs, а не падает.
const CF_RUN_LOG_FOLDER_ID = "19ljf2TgeDg6j-jIamGira8K8_2NjC1BT";

/** Run once in the Apps Script editor; copy the returned key into ScriptCat. */
function setupGatewayKey() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty(CF_KEY_PROPERTY);
  if (!key) {
    key =
      Utilities.getUuid().replace(/-/g, "") +
      Utilities.getUuid().replace(/-/g, "");
    props.setProperty(CF_KEY_PROPERTY, key);
  }
  console.log("CF Gateway key (keep private): " + key);
  return key;
}

function doGet() {
  return json_({
    ok: true,
    service: "Narthex / Chronicle Forge Drive gateway",
    version: "1.5",
    layout: CF_ARENA_FOLDER_NAME + "/{" + CF_LOG_FOLDER_NAME + "," + CF_PAYLOAD_FOLDER_NAME + "}",
  });
}

/**
 * Корень всей работы — папка Arena в «Моём диске». Единственное место, где
 * шлюз создаёт папки. Ищется по имени, чтобы переезд Диска не ломал шлюз.
 */
function arenaFolder_() {
  const root = DriveApp.getRootFolder();
  const found = root.getFoldersByName(CF_ARENA_FOLDER_NAME);
  return found.hasNext() ? found.next() : root.createFolder(CF_ARENA_FOLDER_NAME);
}

/** Дочерняя папка по имени; создаётся только внутри переданного родителя. */
function childFolder_(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

/**
 * Папка логов. Если в корне осталась папка версии 1.4 — переносим её в Arena и
 * переименовываем. Неудачный перенос не должен ломать запись: тогда создаётся
 * новая logs, а старая остаётся человеку на разбор.
 */
function logsFolder_() {
  const arena = arenaFolder_();
  const found = arena.getFoldersByName(CF_LOG_FOLDER_NAME);
  if (found.hasNext()) return found.next();

  const legacy = DriveApp.getRootFolder().getFoldersByName(CF_LEGACY_LOG_FOLDER_NAME);
  if (legacy.hasNext()) {
    const folder = legacy.next();
    try {
      folder.setName(CF_LOG_FOLDER_NAME);
      folder.moveTo(arena);
      return folder;
    } catch (error) {
      // Ниже создадим новую; старое содержимое останется видимым в корне.
    }
  }
  return arena.createFolder(CF_LOG_FOLDER_NAME);
}

function payloadFolder_() {
  return childFolder_(arenaFolder_(), CF_PAYLOAD_FOLDER_NAME);
}

function folderInfo_(folder) {
  return {
    id: folder.getId(),
    name: folder.getName(),
    url: folder.getUrl(),
  };
}

function doPost(e) {
  try {
    const request = JSON.parse(e?.postData?.contents || "{}");
    const expected =
      PropertiesService.getScriptProperties().getProperty(CF_KEY_PROPERTY);
    if (!expected || !constantTimeEqual_(String(request.key || ""), expected)) {
      return json_({ ok: false, error: "Неверный ключ шлюза." });
    }

    if (request.action === "ping") {
      return json_({
        ok: true,
        result: "pong",
        version: "1.5",
        arena: folderInfo_(arenaFolder_()),
        logs: folderInfo_(logsFolder_()),
        payloads: folderInfo_(payloadFolder_()),
      });
    }

    if (request.action === "createLog") {
      const dispatchId = String(request.dispatchId || "");
      const runId = String(request.runId || "");
      if (!/^[0-9a-f-]{36}$/i.test(dispatchId) || !/^[0-9a-f-]{36}$/i.test(runId))
        throw new Error("Некорректные Dispatch ID или Run ID.");
      const folder = logsFolder_();
      // legacy dispatch.user.js присылает id своей папки — принимаем, но пишем
      // в Arena/logs: старые id больше не создают файлов вне Arena.
      const requestedFolder = String(request.folderId || "");
      if (requestedFolder && requestedFolder !== folder.getId() && requestedFolder !== CF_RUN_LOG_FOLDER_ID)
        throw new Error("Создание разрешено только в папке " + CF_ARENA_FOLDER_NAME + "/" + CF_LOG_FOLDER_NAME + ".");

      const name = dispatchId + "_" + runId + ".md";
      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        const matches = folder.getFilesByName(name);
        if (matches.hasNext()) {
          const existing = matches.next();
          return json_({
            ok: true,
            fileId: existing.getId(),
            name: name,
            result: { fileId: existing.getId(), name: name },
          });
        }
        const content =
          "# Dispatch-Run log\n\nDispatch ID: " + dispatchId + "\nRun ID: " + runId + "\n";
        const file = folder.createFile(name, content, MimeType.PLAIN_TEXT);
        return json_({
          ok: true,
          fileId: file.getId(),
          name: name,
          result: { fileId: file.getId(), name: name },
        });
      } finally {
        lock.releaseLock();
      }
    }

    if (request.action === "savePayload") {
      const name = payloadName_(request.name);
      const content = String(request.content || "");
      if (!content.trim()) throw new Error("Пустой текст задания.");
      if (content.length > 400000) throw new Error("Текст задания больше 400 000 знаков.");
      const folder = payloadFolder_();
      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        const matches = folder.getFilesByName(name);
        if (matches.hasNext()) {
          const file = matches.next();
          if (request.overwrite === true) file.setContent(content);
          return json_({
            ok: true,
            fileId: file.getId(),
            name: name,
            duplicate: request.overwrite !== true,
            folder: folderInfo_(folder),
          });
        }
        const file = folder.createFile(name, content, MimeType.PLAIN_TEXT);
        return json_({
          ok: true,
          fileId: file.getId(),
          name: name,
          folder: folderInfo_(folder),
        });
      } finally {
        lock.releaseLock();
      }
    }

    const id = String(request.fileId || "");
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id))
      throw new Error("Некорректный Drive file ID.");

    if (request.action === "read") {
      // Reads are needed for the task payload selected from the Notion record.
      const file = DriveApp.getFileById(id);
      const mime = file.getMimeType();
      if (!mime.startsWith("text/")) {
        throw new Error("Шлюз читает только текстовые файлы.");
      }
      return json_({
        ok: true,
        content: file.getBlob().getDataAsString("UTF-8"),
      });
    }

    if (request.action === "append") {
      const file = DriveApp.getFileById(id);
      const allowed = logsFolder_().getId();
      const parents = file.getParents();
      let isRunLog = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === allowed) isRunLog = true;
      }
      const mime = String(file.getMimeType() || "");
      if (!isRunLog || !mime.startsWith("text/"))
        throw new Error(
          "Запись разрешена только в текстовые файлы " + CF_ARENA_FOLDER_NAME + "/" + CF_LOG_FOLDER_NAME + ".",
        );
      const marker = String(request.marker || "");
      const entry = String(request.entry || "");
      if (!marker.startsWith("<!-- CF_DISPATCH ") || !entry.includes(marker)) {
        throw new Error("Некорректный маркер записи.");
      }
      if (entry.length > 1500000)
        throw new Error("Запись превышает допустимый размер.");
      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        const old = file.getBlob().getDataAsString("UTF-8");
        if (old.includes(marker)) return json_({ ok: true, result: "duplicate" });
        file.setContent(old + entry);
      } finally {
        lock.releaseLock();
      }
      return json_({ ok: true, result: "appended" });
    }
    throw new Error("Неизвестное действие шлюза.");
  } catch (error) {
    return json_({ ok: false, error: String(error?.message || error) });
  }
}

/** Имя файла задания: без путей и запрещённых символов, всегда .md. */
function payloadName_(value) {
  const base = String(value || "").trim() || "payload";
  const safe = base
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return /\.md$/i.test(safe) ? safe : safe + ".md";
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
