# STAB-1.17 — результаты проверки и ограничения Scope

Дата: 2026-10-31
Dispatch: `40a6f0cf-5705-8174-b0b3-e4c05b09970d`
Run: `254f8d52-b891-46aa-943c-9827b20c5e91`
База: `2e12c6cfb7955a68d2f309cfb8be2023376f0e38`
Статус: **не принято** — после изменений остаются 10 RC 1 из 21; мержа нет.

## Краткий итог

В пределах разрешённых путей исправлена регистрация Narrative pack для прямого запуска `smoke:core`; прямой смоук теперь проходит без изменения якорей. В шести smoke-скриптах обновлены импорты диалогового модуля на его действующий путь в `packs/narrative`. В ScriptCat обновлён Drive Gateway до контракта 1.5: журналы и payload-файлы создаются в `Arena/logs` и `Arena/payloads`, старый каталог логов переносится, внешние записи ограничены журналами, а `ping` сообщает раскладку. Обновлена инструкция установки шлюза.

Пути кампаний, `src/player/**`, `src/editor/**`, `src/shared/**`, `public/ai/**`, `docs/contracts/**` и прочие запрещённые области не менялись. Диагностики и пороги не ослаблялись. Переименование или переписывание устаревшего ScriptCat теста не выполнялось.

## Все 21 команды §4

«До» — чистая worktree на базовом SHA с отдельным `npm ci`; после первоначального прогона 1–18 на ней также выполнены команды 19–21. «После» — свежая кандидатная worktree на той же базе со всеми изменениями этой карточки и отдельным `npm ci`.

| # | Команда | RC до | RC после | Однострочный результат после |
|---:|---|---:|---:|---|
| 1 | `npm ci` | 0 | 0 | Чистая установка зависимостей завершилась. |
| 2 | `npm run check:audit-bundle` | 0 | 0 | Аудитный bundle актуален: 1,002,333 байта, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| 3 | `npx tsc -b` | 0 | 0 | Компиляция TypeScript без ошибок. |
| 4 | `for t in _tools/ScriptCat/tests/*.mjs; do node "$t" || exit 1; done` | 1 | 1 | Останавливается на первом smoke: `dispatch-coordinator-smoke.mjs:4` не находит `dispatch.user.js`. |
| 5 | `npm run check:contracts` | 1 | 1 | `check:decisions` отклоняет три значения Status в существующих ADR. |
| 6 | `npm run check:core-graph` | 0 | 0 | Core graph OK: 37 модулей. |
| 7 | `npm run check:module-size` | 1 | 1 | Три запрещённых области превышают лимит 450 строк: 705, 1,407 и 3,406. |
| 8 | `npm run check:brand` | 1 | 1 | Найдено 138 существующих legacy-brand попаданий. |
| 9 | `npm run check:version` | 0 | 0 | Версия 0.8.0 согласована. |
| 10 | `npm run check:guide` | 1 | 1 | Каноническая и публичная копии руководства расходятся; `check-guide.mts:38`. |
| 11 | `npm run check:playkit-bundle` | 1 | 1 | Публичный bundle: 1,072,558 байт / SHA `b06f8c18…`; генератор: 1,072,575 байт / SHA `b468dd4d…`. |
| 12 | `npm run check:campaigns` | 1 | 1 | Найдено расхождение `campaign.json` у копии `ash-of-caerden`. |
| 13 | `npm run check:compat-corpus` | 1 | 1 | Два Ash-проекта завершаются с RC 1 и тремя graph warnings каждый. |
| 14 | `npm run check:narrative-codes` | 0 | 0 | Все 28 кодов объяснений согласованы. |
| 15 | `npm run smoke:core` | 1 | 0 | Все якоря core smoke зелёные с Narrative preload. |
| 16 | `npm run smoke:mission` | 1 | 1 | 45/55 смоуков проходят; остаются 10 отказов. |
| 17 | `npm run cf-play:negative` | 0 | 0 | Оба отрицательных сценария дают ожидаемый отказ. |
| 18 | `npm run lint` | 0 | 0 | 0 ошибок; 1,511 предупреждений. |
| 19 | `npm run build` | 0 | 0 | Стандартная сборка завершилась; защищённые файлы и audit bundle не изменены. |
| 20 | `npm run check:audit-bundle` | 0 | 0 | SHA-256 остался `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| 21 | `npm run check:mission` | 1 | 1 | Не проходит из-за красных контрактов, руководства, corpus, brand, mission smokes и Ash-проверок. |

Итого после: **11/21 RC 0, 10/21 RC 1**. Требование 21/21 не выполнено.

## Причины красных ворот и изменения

### ScriptCat — RC 1, причина не устранена в этой карточке

Три теста (`dispatch-coordinator-smoke.mjs:4`, `scriptcat-gateway-smoke.mjs:4` и `visible-error-master-smoke.mjs:4`) читают `../dispatch.user.js`, которого в репозитории нет; актуальный файл — `_tools/ScriptCat/narthex.user.js`. Временная проверка coordinator с единственной заменой пути доходит до старого контракта и падает на требовании `AUTO.maxSends`; gateway smoke также ожидает прежние helper-имена и версию Gateway 1.2. Поэтому простой retarget этих тестов неверен, а создание псевдонима или изменение проверок скрыло бы несоответствие. Тесты оставлены без изменений; этот RC 1 сохраняется.

Отдельно исправлен реальный отказ `drive-gateway-arena-smoke.mjs`: `_tools/ScriptCat/drive-gateway.gs` не реализовывал уже описанный контракт Gateway 1.5 и требовал фиксированный `folderId` даже для `createLog`. Теперь `node _tools/ScriptCat/tests/drive-gateway-arena-smoke.mjs` проходит; инструкция `_tools/ScriptCat/README-авторизация.md` указывает версию 1.5 и существующий `narthex.user.js`. Общий цикл §4 всё равно останавливается раньше на старом coordinator smoke.

### `check:contracts` — RC 1, не исправлено

`scripts/check-decisions.mts:97–100` отклоняет аннотированные статусы в `docs/decisions/GOLD-1.6c.md:1`, `docs/decisions/STAB-1.11.md:5` и `docs/decisions/STAB-1.15.md:5`. Эти файлы вне Scope. Независимый `check:module-size` дополнительно находит превышения в `src/editor/campaignAudit.ts` (705 строк), `src/editor/store.ts` (1,407) и `src/shared/types.ts` (3,406); разрешённая область не включает эти модули. Порог не снижен, существующие решения не переписаны.

### `check:guide` — RC 1, не исправлено

`scripts/check-guide.mts:38` сравнивает `docs/ai-campaign-guide.md` и `public/ai/campaign-guide.md`; содержимое не совпадает. Публичная копия находится в запрещённой `public/ai/**`, а изменение основной документации также вне узкого Scope этой карточки. Копии и проверка оставлены нетронутыми.

### `check:compat-corpus` — RC 1, не исправлено

`scripts/check-compat-corpus.mts:359` требует RC 0 и verdict `ok`. `ash-of-caerden` и `ash-of-caerden-adventure` каждый возвращают RC 1 из-за трёх graph warnings (`flag_written_never_read`). Оба примера расположены в защищённом `public/campaigns/**`; проверка и корпус не ослаблялись.

### `check:campaigns` — RC 1, не исправлено

`scripts/campaign-copies.mts:177–196` обнаруживает отличие `campaign.json` между `packs/narrative/data/ash-of-caerden` и защищённой копией `public/campaigns/ash-of-caerden`. Источник `packs/**` и цель `public/campaigns/**` находятся вне разрешённой зоны; публикацию или ручную синхронизацию не выполнял.

### `smoke:core` — исправлено, RC 1 → RC 0

`scripts/core-semantics-smoke.mts:68` создаёт `GameEngine`, которому нужны операции Narrative pack; их регистрация происходит через `packs/narrative/index.ts`. Прямой `tsx` запуск не загружал этот composition root и завершался `PACK_OPERATION_MISSING` при конструкторе `src/core/engine.ts:114,154–155`. Изменена только npm-команда в `package.json`: она предварительно загружает `tsx` и реальный `packs/narrative/index.ts`. Якоря теста не менялись; ручной bundle rebuild не выполнялся.

### `smoke:mission` — RC 1, частично исправлено

Обновлены только пути импорта/чтения диалогового модуля после его переноса в `packs/narrative/dialogue.ts`: `scripts/ai-runtime-smoke.mts`, `scripts/dialogues-round31-smoke.mts`, `scripts/dialogues-round32-smoke.mts`, `scripts/narrative-intro-and-ai-features-smoke.mts`, `scripts/p2-mechanics-smoke.mts` и `scripts/smoke-dialogue-speaker.mts`. Эти правки не меняют assertions; после них `ai-runtime`, `narrative-intro` и `dialogue-speaker` проходят.

Оставшиеся 10 отказов и их локальные причины:

- `design-doc`: `scripts/design-doc-guard.mts:109–114` не находит ожидаемый output-format anchor в `docs/ai-start-instruction.md`; дополнительно `:138–142` обнаруживает лишние `PLAYKIT.md` и `cf-play.mjs` в `public/ai`. И исходная инструкция, и публичный манифест вне разрешённой зоны.
- `p2`: `scripts/p2-mechanics-smoke.mts` падает на проверке `engine.entityState` в `src/player/SceneScreen.tsx`; Player UI вне Scope.
- `ai-task`: `scripts/ai-task-smoke.mts:58` ожидает `campaign.json` в созданном архиве, но файла там нет; исправляемая реализация находится в запрещённом `src/editor/aiTask.ts`.
- `dialogues-r31` и `dialogues-r32`: после исправления импорта отсутствуют неотслеживаемые фикстуры `_ai-temp/campaing/**` (первые чтения — `scripts/dialogues-round31-smoke.mts:18` и `scripts/dialogues-round32-smoke.mts:16`). Таких файлов нет в чистом checkout; тестовые данные не подменялись.
- `breathe-toggle`: `scripts/breathe-toggle-smoke.mts` ожидает логику в защищённых `src/player/SceneScreen.tsx`, `src/shared/types.ts` и `src/editor/EntityEditor.tsx`.
- `encounters-loader`: `scripts/encounters-loader-smoke.mts:38` не находит `/campaigns/shepot-shesteren/campaign.json`; соответствующей кампании/фикстуры в checkout нет, а `public/campaigns/**` защищён.
- `saves-compat`: `scripts/saves-compat-smoke.mts:200` ожидает упоминание формата сохранения в `src/player/HelpPanel.tsx`; Player UI вне Scope.
- `pack-missing` и `capability-modes`: их пробные проекты используют защищённый Ash и падают на тех же трёх graph warnings из corpus; обход предупреждений не добавлялся.

## Изоляция сборки, аудит и защищённые пути

Стандартные `npm run build` и `npm run check:mission` запускались в отдельной кандидатной worktree с собственным `npm ci`, не в рабочем checkout. Build завершился RC 0; `check:mission` завершился RC 1. До/после build `npx tsc -b` и lint возвращали RC 0. Lint сообщал одинаковые 1,511 предупреждений и 0 ошибок. `check:audit-bundle` до и после build прошёл при SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`; bundle не перестраивался вручную.

В чистых базовой и кандидатной worktree `git diff --exit-code` для `.golden/**`, `public/campaigns/ash-of-caerden*`, `scripts/golden/**`, `golden.yml` и `docs/contracts/**` завершился с RC 0. Совокупный SHA-256 списка отслеживаемых файлов этих путей в обеих worktree совпал: `00dbc76d9c770c7137d6230cba9f4240fed770dec92aeca7528fde3c4ef72ee9`. `golden.yml` отсутствует в базовом дереве. В чистой кандидатной worktree `git status --short` был пуст до build и после check:mission; обе проверки заняли 0 байт вывода статуса. Ни одна защищённая папка не менялась.

## Решение по приёмке

21/21 RC 0 недостижимо при действующем Scope без изменения запрещённых данных и кода либо без ослабления проверок. Ни одно из этих действий не предпринималось. Кандидат следует оставить неслитым до выдачи отдельных карточек на владельцев защищённых областей и на устаревшие ScriptCat-контракты. Неизменённый остаток проводится через новую карточку/реестр, не через подавление checker-а.
