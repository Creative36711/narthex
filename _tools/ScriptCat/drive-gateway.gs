/** Narthex ScriptCat Drive gateway 1.5. Deploy as a web app executing as the owner. */
const CF_KEY_PROPERTY = "CF_GATEWAY_KEY";
const CF_ARENA_FOLDER_NAME = "Arena";
const CF_LOGS_FOLDER_NAME = "logs";
const CF_PAYLOADS_FOLDER_NAME = "payloads";
const CF_LEGACY_LOG_FOLDER_NAME = "Narthex — логи";
// Read-only compatibility for callers from gateway 1.2; writes still go to Arena/logs.
const CF_LEGACY_RUN_LOG_FOLDER_ID = "19ljf2TgeDg6j-jIamGira8K8_2NjC1BT";

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
    service: "Narthex Drive gateway",
    version: "1.5",
  });
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
      return withScriptLock_(function () {
        const layout = ensureLayout_();
        return json_({
          ok: true,
          service: "Narthex Drive gateway",
          version: "1.5",
          arena: folderInfo_(layout.arena),
          logs: folderInfo_(layout.logs),
          payloads: folderInfo_(layout.payloads),
        });
      });
    }

    if (request.action === "createLog") {
      const folderId = String(request.folderId || "");
      if (folderId && folderId !== CF_LEGACY_RUN_LOG_FOLDER_ID) {
        throw new Error("Прямой folderId запрещён: createLog сам выбирает Arena/logs.");
      }
      const dispatchId = String(request.dispatchId || "");
      const runId = String(request.runId || "");
      if (!/^[0-9a-f-]{36}$/i.test(dispatchId) || !/^[0-9a-f-]{36}$/i.test(runId)) {
        throw new Error("Некорректные Dispatch ID или Run ID.");
      }
      const name = dispatchId + "_" + runId + ".md";
      return withScriptLock_(function () {
        const logs = ensureLayout_().logs;
        const matches = logs.getFilesByName(name);
        if (matches.hasNext()) {
          const existing = matches.next();
          const result = { fileId: existing.getId(), name: name };
          return json_({ ok: true, fileId: result.fileId, name: result.name, result: result });
        }
        const content = "# Dispatch-Run log\n\nDispatch ID: " + dispatchId +
          "\nRun ID: " + runId + "\n";
        const file = logs.createFile(name, content, MimeType.PLAIN_TEXT);
        const result = { fileId: file.getId(), name: name };
        return json_({ ok: true, fileId: result.fileId, name: result.name, result: result });
      });
    }

    if (request.action === "savePayload") {
      const name = safePayloadName_(request.name);
      const content = String(request.content || "");
      if (content.length > 1500000) throw new Error("Payload превышает допустимый размер.");
      return withScriptLock_(function () {
        const payloads = ensureLayout_().payloads;
        const matches = payloads.getFilesByName(name);
        if (matches.hasNext()) {
          const existing = matches.next();
          return json_({ ok: true, fileId: existing.getId(), name: name, duplicate: true });
        }
        const file = payloads.createFile(name, content, MimeType.PLAIN_TEXT);
        return json_({ ok: true, fileId: file.getId(), name: name, duplicate: false });
      });
    }

    const id = String(request.fileId || "");
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) {
      throw new Error("Некорректный Drive file ID.");
    }

    if (request.action === "read") {
      // Reads are needed for the task payload selected from the Notion record.
      const file = DriveApp.getFileById(id);
      const mime = String(file.getMimeType() || "");
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
      const marker = String(request.marker || "");
      const entry = String(request.entry || "");
      if (!marker.startsWith("<!-- CF_DISPATCH ") || !entry.includes(marker)) {
        throw new Error("Некорректный маркер записи.");
      }
      if (entry.length > 1500000) throw new Error("Запись превышает допустимый размер.");
      return withScriptLock_(function () {
        const logs = ensureLayout_().logs;
        if (!isDirectChildOf_(file, logs.getId()) || !String(file.getMimeType() || "").startsWith("text/")) {
          throw new Error("Запись разрешена только в текстовые файлы Arena/logs.");
        }
        const old = file.getBlob().getDataAsString("UTF-8");
        if (old.includes(marker)) return json_({ ok: true, result: "duplicate" });
        file.setContent(old + entry);
        return json_({ ok: true, result: "appended" });
      });
    }

    throw new Error("Неизвестное действие шлюза.");
  } catch (error) {
    return json_({ ok: false, error: String(error?.message || error) });
  }
}

function withScriptLock_(operation) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}

/** Create the one owned root folder and its two gateway-managed children. */
function ensureLayout_() {
  const root = DriveApp.getRootFolder();
  const arena = getFolderByName_(root, CF_ARENA_FOLDER_NAME) || root.createFolder(CF_ARENA_FOLDER_NAME);
  const logs = getFolderByName_(arena, CF_LOGS_FOLDER_NAME) || adoptLegacyLogs_(root, arena) || arena.createFolder(CF_LOGS_FOLDER_NAME);
  const payloads = getFolderByName_(arena, CF_PAYLOADS_FOLDER_NAME) || arena.createFolder(CF_PAYLOADS_FOLDER_NAME);
  return { arena: arena, logs: logs, payloads: payloads };
}

/** Move and rename the v1.4 root folder only when Arena/logs does not exist. */
function adoptLegacyLogs_(root, arena) {
  const legacy = getFolderByName_(root, CF_LEGACY_LOG_FOLDER_NAME);
  if (!legacy) return null;
  legacy.setName(CF_LOGS_FOLDER_NAME);
  legacy.moveTo(arena);
  return legacy;
}

function getFolderByName_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : null;
}

function folderInfo_(folder) {
  return { id: folder.getId(), name: folder.getName() };
}

function safePayloadName_(value) {
  let name = String(value || "payload").trim()
    .replace(/[\\/:]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);
  if (!name || name === "." || name === "..") name = "payload";
  if (!/\.md$/i.test(name)) name += ".md";
  return name;
}

function isDirectChildOf_(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
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
