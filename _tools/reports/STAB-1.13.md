# STAB-1.13 — текстовая очистка старого бренда вне `src/**`

## Результат и база

- Dispatch: `4096f0cf-5705-8171-b94f-c2ac07fef08a`; run: `d004cac6-b17c-43d3-87e9-85d72595cb42`.
- Рабочая ветка: закреплённая `arena/beb74077-narthex`; исходная задача просила `nar/...`, но ветку сессии не переименовывал и новую не создавал.
- Перед изменениями рабочее дерево было чистым. Выданный snapshot `cffe79765b52aad42dc666f24d66b9fcd5cc1b16` был shallow и не имел общего предка с origin/main. После `git fetch origin main` текущая закреплённая ветка была обновлена на свежий `origin/main` `f169dfa9ef979c1c2e5aea771a5fa8159eb3190d` командой `git reset --hard`; до правок `HEAD` совпадал с `origin/main`.
- PR: ожидает создания с закреплённой ветки.
- Squash merge SHA: будет записан после мержа.
- Никакие пороги, allowlist или код `scripts/brand-guard.mts` не менялись. `package.json` и `public/ai/**` не изменялись; AI-артефакты не пересобирались.

## Baseline и результат проверки

Карточка приводит исторические `266` совпадений в `75` файлах и `59` в `src/**`. Эти цифры не воспроизводятся на обязательной свежей базе: неизменённая `npm run check:brand` на `f169dfa` возвращает RC 1 и сообщает `267` совпадений; точная инвентаризация теми же шаблонами даёт `72` файла, из них `32` совпадения в `src/**`. Для сравнения использована свежая база, без изменения проверяющего скрипта.

| Каталог | До: совпадения / файлы | После: совпадения / файлы |
|---|---:|---:|
| `README.md` + `ARCHITECTURE.md` | 39 / 2 | 0 / 0 |
| `docs/**` | 78 / 15 | 10 / 4 |
| `scripts/**` | 39 / 19 | 26 / 13 |
| `_tools/**` | 39 / 10 | 35 / 8 |
| `src-tauri/**` | 5 / 2 | 0 / 0 |
| `public/ai/**` | 30 / 4 | 30 / 4 |
| `src/**` | 32 / 16 | 32 / 16 |
| Защищённые `public/campaigns/**` | 1 / 1 | 1 / 1 |
| Прочее вне Scope (`index.html`, `package.json`, `vite.config.ts`) | 4 / 3 | 4 / 3 |
| **Всего** | **267 / 72** | **138 / 49** |

Итоговое снижение — **129 совпадений и 23 файла**. `npm run check:brand` остаётся RC 1: ниже перечислены все группы сохранённых совпадений и причины. Никакие исключения не добавлялись; счётчик не ослаблялся.

## Что изменено

- `README.md`, `ARCHITECTURE.md`, текущие гайды и главы книги: заменены только устаревшие отображаемые названия, расширения пакета/сохранения, ключи и форматные идентификаторы на действующие значения из ADR 0001. Остальные предложения и разделы сохранены.
- Текущие инструкции ScriptCat и ответ Drive gateway: обновлены брендовые подписи/сообщения.
- `scripts/**`: исправлены только комментарии и тексты сообщений. Предикаты, тестовые входы, проверки форматов и логика smoke-оракулов не менялись.
- `src-tauri/**`: имя пакета и отображаемые поля приложения приведены к действующей идентичности из ADR 0001.
- `docs/campaign.schema.json` и `scripts/gen-schema.mts` оставлены без изменений: схема импортируется аудитом, а её правка изменила бы вход замороженного bundle. После отказа от этой правки `npm run check:audit-bundle` снова прошёл без пересборки.
- Защищённые пути, `src/**`, `public/campaigns/**`, `public/ai/**`, `scripts/golden/**`, `docs/contracts/**`, `package.json` и сам checker не изменялись.

## Примеры «до / после»

| Место | До (токен обозначен описательно) | После |
|---|---|---|
| `README.md`, заголовок | `# [прежнее имя продукта]` | `# Narthex` |
| `ARCHITECTURE.md`, описание профиля | «фирменный [прежний бренд] — дефолт» | «фирменный Narthex — дефолт» |
| `docs/compatibility.md`, ключ сейва | `[прежний namespace]:save:<campaignId>` | `narthex:save:<campaignId>` |

Плейсхолдеры в колонке «До» намеренные: точные удалённые токены не перепечатываются в отчёт, который сам проходит через тот же checker. В изменённых документах заменялись только брендовые подстроки/идентификаторы; окружающий текст не переписывался.

## Остатки и причины

| Остаток | Совпадения | Причина сохранения |
|---|---:|---|
| `src/**` | 32 в 16 файлах | Явно вне Scope; оставшиеся строки — смысловые тексты/идентификаторы интерфейса. |
| `public/ai/**` | 30 в 4 файлах | Собранный AI-кит заморожен; его пересборка и ручная правка запрещены. |
| `_tools/reports/GOLD-1.10.md` | 2 | Исторический отчёт хранит фактические значения на момент прогона. |
| `_tools/reports/GOLD-1.13.md` | 5 | Аудит-отчёт сохраняет исходные имена/значения как доказательства. |
| `_tools/reports/GOLD-1.6b.md` | 1 | Исторический отчёт фиксирует package metadata того релиза. |
| `_tools/reports/GOLD-1.6d.md` | 12 | Исторические логи сравнивают реально наблюдавшиеся ключи до/после миграции; замена исказила бы evidence. |
| `_tools/reports/STAB-1.14.md` | 1 | Отчёт предыдущей задачи фиксирует конкретное имя fixture-файла. |
| `_tools/reports/STAB-1.3.md` | 11 | Сохранён вывод команд и точное состояние прежней сборки. |
| `_tools/reports/STAB-1.8.md` | 2 | Сохранена запись принятого тогда решения и его контекста. |
| `docs/decisions/GOLD-1.13.md` | 2 | Архивное решение описывает прежний runtime и ожидания harness. |
| `docs/decisions/STAB-1.8.md` | 2 | Архивная запись описывает прежнее состояние; редактирование изменило бы смысл решения. |
| `docs/campaign.schema.json` | 5 | Вход schema-backed audit; его изменение делает замороженный bundle несвежимым. |
| `docs/ai-campaign-guide.md` | 1 | Упоминание бывшей подписи оставлено один раз как историческое; неизменённый predicate `tz12` требует эту строку, а править логику smoke запрещено. |
| `scripts/gen-schema.mts` | 3 | Генератор этих schema-метаданных; оставлен согласованным с замороженными выходами. |
| Остальные 12 probe-файлов из `scripts/**` | 23 всего по 12 файлам | Совпадения находятся в ожидаемых входах/выходах, фикстурах и предикатах проверок; менять их означало бы менять логику smoke-оракулов. Файлы: `ai-task-smoke.mts` (3), `chronicle-import-identity-smoke.mts` (1), `combat-rules-smoke.mts` (2), `design-doc-guard.mts` (2), `feedback29-smoke.mts` (1), `feedback8-A-smoke.mts` (2), `feedback8-G-smoke.mts` (2), `no-campaign-smoke.mts` (4), `p2-mechanics-smoke.mts` (2), `saves-compat-smoke.mts` (1), `tz12-profiles-smoke.mts` (1), `tz7-slots-smoke.mts` (2). |
| `_tools/ScriptCat/tests/visible-error-master-smoke.mjs` | 1 | Явно исключённая зона 1.12. |
| `public/campaigns/ash-of-caerden/campaign.json` | 1 | Защищённый путь. |
| `index.html` | 1 | Не входит в перечисленный Scope. |
| `package.json` | 1 | Вне разрешённой зоны; менять его для счёта запрещено. |
| `vite.config.ts` | 2 | Вне Scope; значения участвуют в конфигурации, а не являются документацией. |

## Проверки

| Команда | Результат |
|---|---|
| `npm run check:brand` | RC 1; `267/72` до → `138/49` после. Остатки перечислены выше. |
| `npx tsc -b` | RC 0 |
| `npm run lint` | RC 0; 1,511 предупреждений, 0 ошибок |
| `npm run check:audit-bundle` | RC 0; bundle остался `1,002,333` байта, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`; пересборки не было |
| `node public/ai/cf-play.mjs check public/campaigns/fmv-crossing --seeds 1-5 --steps 300` | До/после идентичный вывод, RC 0; 0 ошибок/предупреждений, 5 seed, 1/1 достижимых сцен |
| Та же проверка на `public/campaigns/ash-of-caerden` | До/после идентичный вывод, RC 1 из-за тех же 3 warning-строк; 0 ошибок, одинаковые исходы/покрытие |
| `npm run cf-play:negative` | До/после идентичный вывод, RC 0; source и negative fixture внутри kit выдают ожидаемые RC 1, harness `ok=true` |
| `npm run pack:ai-kit` | RC 0; созданный `dist-ai/` удалён после проверки |
| Проверка `cf-play` из распакованного кита на `fmv-crossing` | RC 0; вывод совпал с прямой проверкой эталона |
| `git diff --check` | RC 0 |

### Дополнительные целевые проверки

С Vite dev-сервером на `:5173` прошли `smoke:campaign-index`, `smoke:no-campaign`, `smoke:char-templates` и `compat-publish-smoke`; также прошёл `chronicle-import-identity-smoke`. Результаты других запущенных probes:

- `npm run check:campaign-formats` — RC 1: базовая проверка остановилась на незарегистрированном `fmv-crossing` fixture; реестр/кампания не входят в diff.
- `npm run smoke:dlg-ui` — RC 1: `PACK_OPERATION_MISSING` для `(host).initialStateFields`; падающий участок и код источника не изменялись.
- `npm run smoke:drive-gateway` — RC 1: зафиксированный в исключённом тесте вызов `createLog` не передаёт `folderId`, который требует функция шлюза; `doPost` и тест не менялись.
- `tz12-profiles-smoke` — RC 1: тест на подпись гида прошёл после исторической оговорки; остаются две независимые проверки: пустые переменные темы и класс профиля на корневом элементе.

Эти результаты не меняют обязательные acceptance-gates выше; predicates и исключённые тесты не переписывались.

`npm run check:audit-bundle` не пересобирает и не меняет bundle: после восстановления schema-входа до исходного состояния он проходит. `cargo` в среде отсутствует, поэтому `cargo metadata` не запускался.

## PR и diff stat

- Base SHA: `f169dfa9ef979c1c2e5aea771a5fa8159eb3190d`.
- PR: ожидает создания.
- Squash merge SHA: появится после мержа.
- `git diff --stat`:

```text
 ARCHITECTURE.md                                    |  46 +++----
 README.md                                          |  20 +--
 ...270\320\267\320\260\321\206\320\270\321\217.md" |   4 +-
 _tools/ScriptCat/drive-gateway.gs                  |   4 +-
 _tools/reports/STAB-1.13.md                        | 142 +++++++++++++++++++++
 docs/ai-campaign-guide.md                          |  30 ++---
 docs/ai-start-instruction.md                       |   8 +-
 docs/book/02-editor.md                             |   2 +-
 docs/book/04-visual.md                             |   2 +-
 docs/book/06-technical.md                          |  10 +-
 docs/book/07-ai.md                                 |  22 ++--
 docs/book/08-limits.md                             |   2 +-
 docs/book/09-license.md                            |   6 +-
 docs/book/README.md                                |   6 +-
 docs/compatibility.md                              |  18 +--
 docs/decisions/STAB-1.13.md                        |  11 ++
 docs/glossary.md                                   |   6 +-
 docs/workshop.md                                   |  24 ++--
 scripts/audit-campaign-formats.mts                 |   6 +-
 scripts/campaign-index-smoke.mts                   |   2 +-
 scripts/char-template-smoke.mts                    |   2 +-
 scripts/chronicle-import-identity-smoke.mts        |   2 +-
 scripts/compat-publish-smoke.mts                   |   4 +-
 scripts/compat-report.mts                          |   2 +-
 scripts/dlg-ui-smoke.mts                           |   2 +-
 scripts/feedback29-smoke.mts                       |   2 +-
 scripts/no-campaign-smoke.mts                      |   2 +-
 scripts/tz12-profiles-smoke.mts                    |   2 +-
 src-tauri/Cargo.toml                               |   4 +-
 src-tauri/tauri.conf.json                          |   6 +-
 30 files changed, 276 insertions(+), 123 deletions(-)
```
