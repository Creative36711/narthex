# STAB-1.17 — предлагаемое решение §2.6: ответ createLog в Drive Gateway

Статус: proposed
Дата: 2026-11-01
Связанный отчёт: [`_tools/reports/STAB-1.42.md`](../../_tools/reports/STAB-1.42.md)
Связанный принятый ADR: [`STAB-1.17.md`](./STAB-1.17.md)

## Вопрос Мастеру

Какой набор response-нормализации и восстановления `createLog` оставить правилом §2.6 для Gateway 1.5?

- **A — оставить старый оракул (default):** сохранять прежнюю нормализацию `result.fileId`, top-level `fileId`, JSON-вложенного response, `data.file.id` и Google Drive URL; отклонять не-ID result и unrelated generic `id`; при успешном ответе без распознанного ID сделать ровно один идемпотентный retry с той же парой Dispatch/Run.
- **B — канонический Gateway 1.5:** принимать только top-level `fileId` или `result.fileId`; generic `data.file`, JSON-текст и Drive URL не нормализовать; успешный ответ без ID сразу считать ошибочным, повторять только transport/network failures в установленных границах.
- **C — сохранить документированный минимум:** top-level `fileId` и `result.fileId` оставить; JSON/data.file/Drive URL считать недопустимыми; сохранить один retry успешного ответа без ID с той же Dispatch/Run парой.

## Фактическая база и решение этой проверки

1. Старый `_tools/ScriptCat/tests/scriptcat-gateway-smoke.mjs` на базовом SHA `297eaba6833ad13bab52eb93a205046fed3f0cce` читал `../dispatch.user.js` (`:4`), а этот файл уже был удалён commit `03cf84241f55ccdb645aa6a79b08bce6548a6097` до начала диапазона. Поэтому assertions `:14-40` и `:42-71` — сохранившийся исторический контракт теста, но не успешно исполняемая базовая проба.
2. Старые позитивные формы: result-wrapped объект (`:14-18`), top-level + result (`:19-23`), JSON-вложенный wrapper (`:24-28`), generic `data.file` с metadata (`:29-33`) и Drive URL (`:34-38`). Старые negatives: строка `duplicate` без ID и unrelated generic `id` (`:39-40`). Старый retry: успешный ответ без распознанной формы, ровно одна попытка повторно, неизменные Dispatch/Run (`:42-71`).
3. На проверенном SHA `5bdfef6187985a57dea6587958ae49ef11f889f0` текущая `scriptcat-gateway-smoke.mjs:60-82` исполняет активный userscript `gateway()` с двойным top-level/result response, а `:84-112` проверяет bounded GM transport retry + `fetch` fallback и стабильные Dispatch/Run при network failure. Она не исполняет общий normalizer, JSON/data.file/URL формы или malformed-success retry. `narthex-journal-recover-smoke.mjs:82-120` также гоняет production `appendToJournal`, но fixture одновременно содержит top-level `fileId` и `result.fileId`; отдельная result-only форма там не выделена.
4. Фактический текущий код: Gateway transport `narthex.user.js:1807-1861` возвращает ответ с `ok === true` как есть (`:1815-1819`), ограниченно повторяет только сетевую ошибку GM (`:1832-1837`) и затем делает fetch fallback; успешный объект без распознанного ID не вызывает transport retry. При восстановлении журнала `appendToJournal` извлекает только `created.fileId` или `created.result.fileId` (`:6977-6980`); для остальных форм ID пуст и helper возвращает исходный отказ, без отдельного malformed-success retry (`:6981-6985`). Поэтому текущий runtime не нормализует JSON `content`, `data.file` или Drive URL и не сохраняет старый retry на malformed success.
5. Apps Script Gateway 1.5 обеспечивает идемпотентность `createLog` для одинаковых Dispatch/Run (`drive-gateway.gs`; `scriptcat-gateway-smoke.mjs:16-23` проверяет этот контракт по исходнику). Это не является доказательством клиентского retry malformed-success. В `README-авторизация.md:19` на том же проверенном SHA всё ещё написано, что userscript понимает top-level/result и делает один безопасный retry при успешном ответе без ID; это утверждение документации расходится с описанным текущим путём кода. README вне scope этой карточки и не редактировался.
6. `dispatch.user.js` отсутствует также на конечном историческом endpoint и на проверенном SHA. Поле `Ответ` карточки STAB-1.42 пусто на момент проверки 2026-11-01; ответа Мастера на этот контракт нет.

**Фактическое решение:** старый normalizer/retry оракул и текущий исполняемый Gateway 1.5-путь неэквивалентны; выбран разрешённый карточкой путь **ADR `proposed` + вопрос**, а не тихое снятие перечисленных старых случаев. Старые требования остаются нормативными до ответа. Эта карточка не меняла userscript, gateway, тесты или README и не объявляет вариант A/B/C принятым. После ответа заменить статус на `accepted` или `rejected`, указать дату и записать решение отдельным коммитом; тест не должен требовать конкретного статусного значения.
