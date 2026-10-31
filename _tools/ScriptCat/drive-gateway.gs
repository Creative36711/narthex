/** Narthex ScriptCat Drive gateway. Deploy as a web app executing as the owner. */
const CF_RUN_LOG_FOLDER_ID = "19ljf2TgeDg6j-jIamGira8K8_2NjC1BT";
const CF_KEY_PROPERTY = "CF_GATEWAY_KEY";

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
    version: "1.2",
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
    if (request.action === "ping") return json_({ ok: true, result: "pong" });

    if (request.action === "createLog") {
      const folderId = String(request.folderId || "");
      const dispatchId = String(request.dispatchId || "");
      const runId = String(request.runId || "");
      if (folderId !== CF_RUN_LOG_FOLDER_ID)
        throw new Error("Создание разрешено только в папке логов Dispatch-Run.");
      if (!/^[0-9a-f-]{36}$/i.test(dispatchId) || !/^[0-9a-f-]{36}$/i.test(runId))
        throw new Error("Некорректные Dispatch ID или Run ID.");
      const name = dispatchId + "_" + runId + ".md";
      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        const folder = DriveApp.getFolderById(CF_RUN_LOG_FOLDER_ID);
        const matches = folder.getFilesByName(name);
        if (matches.hasNext()) {
          const existing = matches.next();
          const result = { fileId: existing.getId(), name: name };
          return json_({ ok: true, fileId: result.fileId, name: result.name, result: result });
        }
        const content = "# Dispatch-Run log\n\nDispatch ID: " + dispatchId +
          "\nRun ID: " + runId + "\n";
        const file = folder.createFile(name, content, MimeType.PLAIN_TEXT);
        const result = { fileId: file.getId(), name: name };
        return json_({ ok: true, fileId: result.fileId, name: result.name, result: result });
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
      const parents = file.getParents();
      let isRunLog = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === CF_RUN_LOG_FOLDER_ID) isRunLog = true;
      }
      const mime = String(file.getMimeType() || "");
      if (!isRunLog || !mime.startsWith("text/"))
        throw new Error("Запись разрешена только в текстовые файлы папки логов Dispatch-Run.");
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
        if (old.includes(marker))
          return json_({ ok: true, result: "duplicate" });
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
