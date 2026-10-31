# STAB-1.17 — §4 red gates and ScriptCat reissue

Дата: 2026-10-31
Dispatch: `40a6f0cf-5705-8174-b0b3-e4c05b09970d`
Run: `06debdd4-89d1-4583-a7f6-158b10c9dda4`
Branch: `arena/3971feef-narthex`
Baseline commit: `65b5a28c1f85d9747dd5c4ba017811ac8ff980ab` (on top of `2e12c6cfb7955a68d2f309cfb8be2023376f0e38`)

## Итог

Адаптация ScriptCat выполнена для действующего `_tools/ScriptCat/narthex.user.js` и Drive Gateway 1.5; `dispatch.user.js` не восстановлен. Все 71 существующий файл `_tools/ScriptCat/tests/*.mjs` сохранён и запущен без `skip`, `not-run` или отключённых проверок: 71 прошёл, 0 упал. Тесты Drive/Arena/Notion используют локальные модели; живая проверка Arena или Google Drive не выполнялась.

Из 21 ворот §4 прошли 12; команда ScriptCat улучшилась с RC 1 до RC 0. Девять остающихся красных результатов перечислены с конкретными причинами и владельцами ниже. Build прошёл. `check:mission` запущен и завершился RC 1: его состав включает чужие красные ворота и не может честно стать зелёным в Scope STAB-1.17 без правок защищённых данных, иных карточек или самих оракулов. Ни один оракул, порог, исключение или защищённый путь не ослаблялся.

## §4 — 21 команда, baseline и кандидат

«До» — clean baseline SHA `65b5a28c1f85d9747dd5c4ba017811ac8ff980ab`. «После» — конечный кандидат этой reissue; команды выполнялись на одном и том же дереве, а значения подтверждены финальным прогоном. RC 0 означает успех; RC 1 — зафиксированный отказ, не подавленный.

| # | Команда | RC до | RC после | Однострочный результат после |
|---:|---|---:|---:|---|
| 1 | `npm ci` | 0 | 0 | Чистая установка завершилась; npm сообщил о 4 известных уязвимостях зависимостей (1 moderate, 1 high, 2 critical). |
| 2 | `npm run check:audit-bundle` (до build) | 0 | 0 | Bundle совпал с исходником: 1,002,333 байта, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| 3 | `npx tsc -b` (до build) | 0 | 0 | TypeScript build завершился без ошибок. |
| 4 | Цикл `node` по `_tools/ScriptCat/tests/*.mjs` | 1 | 0 | 71/71 прошло; актуальный userscript, Gateway 1.5 и отрицательные сценарии; интеграции только локальные. |
| 5 | `npm run check:contracts` | 1 | 1 | `check:decisions` остановился на трёх неподдерживаемых `accepted (...)` статусах; последующие composite-подкоманды не достигнуты. |
| 6 | `npm run check:core-graph` | 0 | 0 | Core graph OK: 37 модулей, без циклов и импорта `engine.ts`. |
| 7 | `npm run check:module-size` | 1 | 1 | `campaignAudit.ts` 705/450, `store.ts` 1,407/450, `types.ts` 3,406/450; пороги не менялись. |
| 8 | `npm run check:brand` | 1 | 1 | Guard обнаружил 137 брендовых совпадений в неизменённых файлах; исключения и правила не менялись. |
| 9 | `npm run check:version` | 0 | 0 | Версия 0.8.0 согласована между манифестами и документацией. |
| 10 | `npm run check:guide` | 1 | 1 | Канонический гайд и публичная копия расходятся. |
| 11 | `npm run check:playkit-bundle` | 1 | 1 | Публичный bundle 1,072,558 байт (`b06f8c18…`), сборка из `src` 1,072,575 байт (`b468dd4d…`); первое отличие — byte 30,373. |
| 12 | `npm run check:campaigns` | 1 | 1 | Обнаружено одно расхождение `campaign.json` в Ash-копии. |
| 13 | `npm run check:compat-corpus` | 1 | 1 | Оба Ash-проекта завершаются RC 1 с тремя graph warnings каждый; остальные corpus cases проходят. |
| 14 | `npm run check:narrative-codes` | 0 | 0 | Все 28 кодов объяснений согласованы. |
| 15 | `npm run smoke:core` | 0 | 0 | Все якоря core smoke прошли с загрузкой реального Narrative pack. |
| 16 | `npm run smoke:mission` | 1 | 1 | 45/55 прошли; отказы: design-doc, p2, ai-task, dialogues-r31/r32, breathe-toggle, encounters-loader, saves-compat, pack-missing, capability-modes. |
| 17 | `npm run cf-play:negative` | 0 | 0 | Оба отрицательных fixture дали ожидаемый отказ; wrapper сообщил `ok=true`. |
| 18 | `npm run lint` (до build) | 0 | 0 | 0 ошибок, 1,512 предупреждений на 519 файлах. |
| 19 | `npm run build` (штатный, изолированный) | 0 | 0 | `tsc -b`, audit bundle и Vite build завершились успешно; Vite преобразовал 1,492 модуля; status после build чистый. |
| 20 | `npm run check:audit-bundle` (после build) | 0 | 0 | SHA-256 до/после build одинаков: `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| 21 | `npm run check:mission` (изолированный) | 1 | 1 | Из 13 шагов 6 зелёные, 7 RC 1: contracts, guide, corpus, brand, mission smoke и два Ash CLI запуска; determinism RC 0. |

После штатного build повторно запускались `npx tsc -b` и `npm run lint`: RC 0; lint сохранил 1,512 предупреждений и 0 ошибок. И pre-build, и post-build `git status --short` были пустыми; audit bundle и все защищённые пути сохранили хэши.

## ScriptCat: перенос старых сценариев на текущий контракт

`dispatch-coordinator-smoke.mjs` теперь читает действующий userscript, проверяет его version/header и отсутствие `dispatch.user.js`; UUID для карточки, миссии, Run и ролей проходят production `isUuid`. Негативы live-run guard сохранены: не-Running/Submitted, пустой и чужой Run ID, неправильный/пустой recipient, чужая роль. Retry остаётся bounded: ровно один короткий повтор; устаревший, просроченный, неполный или исчерпанный handoff ничего не записывает и не пересылает.

Покрытие действующих эквивалентов и обязательных сценариев §2.6 обеспечивается оставшимися файлами в том же полном цикле: auto-run; безопасный выбор composer Send и подтверждение доставки; повторы без дубликатов; свежесть ответа и разбор маркеров; валидность ID; выбор роли; Coordinator turn/marker/authority; Reviewer → Drive journal → Submitted → отдельная acceptance; poll Gateway `doPost`, идемпотентность, старый/невалидный marker и live-run защита. Сам тест coordinator требует присутствия этих companion-файлов и сохраняет их в составе из 71.

`drive-gateway-arena-smoke.mjs` выполняет Apps Script Gateway 1.5 в локальном VM harness: проверяет `Arena/logs` и `Arena/payloads`, валидные/невалидные UUID, повтор `createLog` для той же Dispatch/Run пары, duplicate append и отказ старого marker. `narthex-poll-gateway-integration.mjs` исполняет настоящие фрагменты userscript и `doPost`, но Drive, сеть, DOM и хранилище — локальные модели. Эти результаты не являются живой проверкой.

## Оставшиеся RC 1: причина и владелец

- `check:contracts` → **STAB-1.19**: `check:decisions` отклоняет статусы в `docs/decisions/GOLD-1.6c.md`, `STAB-1.11.md` и `STAB-1.15.md`. Файлы не менялись; composite останавливается до последующих проверок.
- `check:module-size` → **STAB-1.18**: существующие превышения `src/editor/campaignAudit.ts` (705 строк), `src/editor/store.ts` (1,407) и `src/shared/types.ts` (3,406); threshold не снижен.
- `check:brand` → **STAB-1.18**: repository-wide legacy-brand hits находятся в старых документах/публичных материалах; область 1.17 не включает их массовое переименование. Исключения не добавлялись.
- `check:guide` → **STAB-1.19** для oracle/синхронизации документации; расхождение между `docs/ai-campaign-guide.md` и `public/ai/campaign-guide.md` не исправлялось, так как публичная копия — защищённый путь 1.17 и находится вне scope 1.19 (её владелец — STAB-1.18).
- `check:playkit-bundle` → **STAB-1.18**: `public/ai/cf-play.mjs` отличается от стандартного bundle из `src`; файл защищён для 1.17. Только штатная сборка и синхронный commit с источником могут закрыть gate; здесь bundle вручную не собирался.
- `check:campaigns` → **STAB-1.19** для проверки копий/oracle: одно расхождение `packs/narrative/data/ash-of-caerden/campaign.json` ↔ защищённая `public/campaigns/ash-of-caerden/campaign.json`. Оба дерева не менялись; публикацию кампании не запускали.
- `check:compat-corpus` → **STAB-1.19**: `ash-of-caerden` и `ash-of-caerden-adventure` дают по 3 `flag_written_never_read` warnings, поэтому corpus требует RC 1. Кампании и oracle остались неизменны; предупреждения не подавлялись.
- `smoke:mission` (10 из 55 дочерних смоуков; 45 прошли):
  - `design-doc` — **STAB-1.18**: assertion ожидает прежнюю формулировку archive-format в `docs/ai-start-instruction.md`; manifest audit также находит лишние `PLAYKIT.md` и `cf-play.mjs` в публичной копии.
  - `p2` — вне этой миссии: проверка `engine.entityState` требует `src/player/SceneScreen.tsx`; Player UI исключён из scope 1.17 и владельцев 1.18/1.19/1.21.
  - `ai-task` — **STAB-1.18**: AI export в `src/editor/aiTask.ts` не даёт ожидаемый `campaign.json`; editor вне scope 1.17.
  - `dialogues-r31`, `dialogues-r32` — вне этого checkout/миссии: отсутствуют неотслеживаемые fixtures `_ai-temp/campaing/**`; фикстуры не подменялись и не создавались.
  - `breathe-toggle` — вне этой миссии: ожидаемая логика находится в `src/player/SceneScreen.tsx`, а путь исключён из scope 1.17.
  - `encounters-loader` — вне этой миссии: отсутствует fixture `/campaigns/shepot-shesteren/campaign.json` в защищённом `public/campaigns/**`; данные не синтезировались.
  - `saves-compat` — вне этой миссии: проверка справки требует `src/player/HelpPanel.tsx`, исключённый из scope 1.17.
  - `pack-missing` и `capability-modes` — **STAB-1.19** для oracle: пробные проекты повторяют три Ash graph warnings из compatibility corpus; Ash-данные защищены и не редактировались.
- `check:mission` — RC 1 не отдельная причина: это агрегатор, который повторяет перечисленные red gates и ещё два `public/campaigns/ash-of-caerden*` отказа. Его нельзя честно получить RC 0 в STAB-1.17 без выполнения работ владельцев или изменения защищённых campaign/oracle данных. Не выдаётся за успешный gate.

**STAB-1.21** владеет отдельным Actions visual/golden soak на итоговом SHA: в карточке записано отсутствие успешного visual run и полного golden soak из-за недоступности Actions/billing. Эта внешняя проверка не является одной из 21 локальных команд §4; в этом run она не запускалась и не маскируется локальными smoke результатами.

## Изоляция и неизменность

Штатный `build` и `check:mission` запускались в двух отдельных чистых detached worktree от одного candidate commit, каждый со своим `npm ci`. У обоих worktree `git status --porcelain` был пуст до и после целевой проверки; у build также пуст после post-build audit, `tsc` и lint. Совокупный SHA-256 756 отслеживаемых файлов защищённых областей до и после обеих проверок: `64b27b8812b5808608f1b2ec70c402c9c3c18c64a30a527e7e07800ef8b7f395`. Сверка охватывала `src/editor/**`, `src/shared/**`, `src/player/**`, `public/ai/**`, `public/campaigns/**`, `packs/**`, `.golden/**`, `scripts/golden/**`, `golden.yml`, `docs/contracts/**` и `.github/workflows/**`; diff относительно `origin/main` и baseline по этим путям пуст. `public/ai/campaign-audit.mjs` остался размером 1,002,333 байта с SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d` до/после штатного build. Ни один bundle вручную не пересобирался.

## Merge

Карточка требует squash-merge PR #182 даже если оставшийся RC 1 принадлежит другим owner-картам. Проверка/состояние PR и фактический результат merge фиксируются в ответе; PR не обходится.
