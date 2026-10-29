# GOLD-1.8c — `project.json` contract для campaign-1

**Итог:** точные байты подготовлены, провалидированы схемой и реально прошли через `loadPlayerPackSession` с HTTP 200 и вызовом `Response.json()`. Campaign-1 и Narthex-код не менялись; в этой работе допускаются только этот отчёт и JSONL-лог.

## 1. Запрошенный путь и источник

- HTTP-путь: `/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/project.json`.
- Файл внутри архива campaign-1: `<root>/project.json`. При размещении в публичном каталоге Narthex: `public/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/project.json`.
- Проверен архив из `.golden/manifest.json`: commit `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`, URL `https://codeload.github.com/Creative36711/campaign-1/tar.gz/71dbbc1056fd34679cf9017ee7dc5ecff29d666c`, размер `188669895` байт, SHA-256 `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`.
- Архив прочитан напрямую во временный `/tmp`-каталог. В корне есть `campaign.json`, `manifest.json`, `world.json`; **`project.json` в зафиксированном campaign-1 нет**. Извлечено 1290 файлов. `.golden/karkas/` не создавался и не менялся; `.golden/manifest.json` не изменён.
- `campaign.json` из этого pin задаёт `id=b7305faa-8e10-4d26-96bb-f1b5ed5e493f`, `title=Каркас: Дело о седьмой помпе`, `min_engine=0.8.0`, `engine_version=0.8.0`. Корневые `world.json` и `manifest.json` существуют.

## 2. Готовые к копированию байты

Кодировка UTF-8 без BOM, завершающий LF. Размер — **510 байт**; SHA-256 — `489cf44da06347eede87db3df5472cf80afea8d02d6c7ec83dbb90d100efa5dd`.

```json
{
  "format": 2,
  "id": "b7305faa-8e10-4d26-96bb-f1b5ed5e493f",
  "title": "Каркас: Дело о седьмой помпе",
  "kind": "narrative",
  "caps": [
    "narrative",
    "scenes",
    "dialogue",
    "map",
    "inventory",
    "needs",
    "skills",
    "relationships",
    "trade",
    "combat",
    "quests",
    "cutscenes",
    "codex",
    "crafting",
    "time"
  ],
  "engine": {
    "min": "0.8.0",
    "tested": "0.8.0"
  },
  "entry": "world.json",
  "manifest": "manifest.json"
}
```

Все 15 объявленных `caps` — стабильные возможности narrative из `docs/contracts/caps.json:25-41`; `fmv` намеренно не включён (experimental и не заявлен данными этого проекта). Для `kind=narrative` каталог требует cap `narrative` (`docs/contracts/caps.json:9-15`). `kind=adventure` здесь не подходит: campaign-1 — сюжетный turn-проект; кроме того, в текущем JSON Schema enum `kind` не содержит `adventure`, хотя каталог `caps.json` содержит такой kind. Выбранное `narrative` допустимо в обоих источниках; их несогласованность не исправлялась.

Решение обратимо: стабильный project ID совпадает с ID кампании; `engine.min` и `engine.tested` напрямую сопоставлены с `min_engine` и `engine_version` архивного `campaign.json`; список caps взят из поддерживаемого stable-набора narrative. Необязательные поля не добавлялись без источника данных.

## 3. По-полевой контракт и ссылки на Narthex

`docs/contracts/project.schema.json:7-15` требует `format`, `id`, `kind`, `caps`, `engine`, `entry` и запрещает прочие поля, кроме `x-*`. Схема задаёт ограничения `format`/`id`/`title`/`kind`/`caps` в строках 17-50, `engine`/`entry`/`manifest` — в 119-147. `src/core/pack/registry.ts:61-67` показывает, что player-пак получает `kind`, `caps`, `cap_options`, `code` как вход, а остальные свойства — как неизвестные поля.

| Поле из файла | Откуда взято / проверка | Где читается и поведение при пропуске или несовпадении |
|---|---|---|
| `format` | Значение `2`; `docs/contracts/project.schema.json:17-20` фиксирует `const: 2` и говорит, что format 1 — legacy campaign без этого файла. | `loadPlayerPackSession` не читает `project.format`. Schema/contract-проверка отклонит отсутствие или значение не `2`; сам player после успешного JSON.parse продолжит только по `kind`. |
| `id` | UUID кампании из архивного `campaign.json`; шаблон проекта допускает его (`docs/contracts/project.schema.json:21-24`). | В `loadPlayerPackSession` не читается и не сверяется с campaign ID. Несовпадение не меняет выбор пака в этом пути; формально неверный ID отклоняется схемой. |
| `title` | Точное название из архивного `campaign.json`; поле опционально, длина 1-120 (`docs/contracts/project.schema.json:26-30`). | Player-loader не читает. Пропуск не нарушает схему; пустое/слишком длинное значение схема отклонит. |
| `kind` | `narrative`; kind связывается с паком `narrative` и обязательным cap `narrative` в `docs/contracts/caps.json:9-10`; enum схемы — `docs/contracts/project.schema.json:31-39`. | Фактический читатель — `src/core/pack/registry.ts:82-107` (значение и поиск установленного манифеста); его вызывает `src/player/adventureRuntime.ts:166`. Пустой/пропущенный kind превращается в `(не указан)`; неизвестный kind или отсутствующий пак даёт `status=missing`, затем loader возвращает `null` (`adventureRuntime.ts:166-170`). |
| `caps` | 15 stable narrative IDs из `docs/contracts/caps.json:25-41`, как в действующем примере `packs/narrative/data/ash-of-caerden/project.json`. | Валидация/режимы — `src/core/pack/capability-modes.ts:43-101`; семантическая проверка kind→required caps и статуса — `scripts/contracts-check.mts:145-165`. **`loadPlayerPackSession` caps не читает и resolver режимов не вызывает.** Неизвестная/повторная capability будет `invalid` в mode resolver/schema-check, но сама по себе не заставит этот player-loader упасть. |
| `engine.min`, `engine.tested` | `0.8.0` из `campaign.json.min_engine` и `.engine_version`; формат версии задан `docs/contracts/project.schema.json:119-135`. | Семантическая проверка `tested >= min` находится в `scripts/contracts-check.mts:194-195`. Player-loader эти значения не читает; неверная версия отклоняется контрактной проверкой, не HTTP-парсером. |
| `entry` | `world.json` — фактический корневой файл в pin; схема требует строку и указывает обычное имя `world.json` (`docs/contracts/project.schema.json:137-140`). | Свойство `project.entry` в этом player-пути не читается. `src/player/adventureRuntime.ts:47-52` отдельно и жёстко запрашивает `${base}/world.json` (и только при создании adventure-session). Несовпадение `entry` само по себе не меняет этот URL; отсутствие фактического `world.json` затронет загрузку содержимого позже. |
| `manifest` | `manifest.json` — фактический корневой файл pin; схема документирует это значение как default в `docs/contracts/project.schema.json:142-147`. | Свойство `project.manifest` не читается `loadPlayerPackSession`. Player-код жёстко запрашивает `${base}/manifest.json` в `src/player/adventureRuntime.ts:49-54`; значение в `project.json` этот запрос не перенаправляет. |

### Реальное поведение player

`src/player/adventureRuntime.ts:155-171` формирует точный URL `${engine.campaign.basePath}/project.json`. Неуспешный HTTP-ответ (`!response.ok`) даёт `null` без JSON-парсинга (строки 157-158); исключение `response.json()` даёт `null` (159-165); неразрешённый kind/пак или отсутствие фабрики тоже дают `null` (166-170). Это fallback, а не авария.

Для именно этого файла `kind=narrative` корректно разрешается в установленный `narrative` pack, однако `sessionFactories` создан только с фабрикой adventure (`adventureRuntime.ts:152-153`). Поэтому `loadPlayerPackSession` ожидаемо возвращает `null` после parse/resolve, не создавая Narrative-сессию. Отчёт не утверждает, что этот loader запускает campaign-1 как отдельную narrative-сессию: доказано именно HTTP 200, JSON parse и успешное разрешение kind без исключения.

## 4. Проверки выполненного контракта

- Ajv 2020: файл валиден по `docs/contracts/project.schema.json`.
- `resolveProjectCapabilityModes`: `status=ready`, все 15 caps активны; обязательный для narrative cap присутствует.
- `resolveProjectPackForStudio`: `status=ready`, `packId=narrative`.
- Одноразовый HTTP + настоящий модуль `loadPlayerPackSession`, загруженный через Vite SSR: `GET http://127.0.0.1:44671/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/project.json` → **200**, `application/json; charset=utf-8`, запросов к маршруту `1`; player вызвал `Response.json()` **1** раз; resolution `ready/narrative`; исключения не было, результат функции — ожидаемый `null` из-за отсутствия narrative session factory. Сервер был временным и закрыт; это не меняло `public/campaigns`.
- Контрольная матрица на том же player-loader: HTTP 404 → `null`, JSON parse не вызывался; HTTP 200 с некорректным JSON → `null`, parse вызван один раз; отсутствующий `kind` → resolver `missing`, `null`; неизвестный cap → отдельный mode resolver `invalid`, без исключения из player-loader.
- `npm ci`: rc=0; npm сообщил 4 advisory (1 moderate, 1 high, 2 critical); зависимости не обновлялись.
- `npm run check:contracts`: **rc=1**, остановился на уже существующей проверке `featureOn реализован в caps.ts, а не в types.ts`; последующие команды в `&&`-цепочке не выполнялись. Этот source-code failure не исправлялся, так как вне write-scope.

## 5. Browser/CI и фактические 404

Использован существующий workflow `.github/workflows/golden.yml` (`golden-playthrough`): он сам ставит headless Chromium и запускает `npm run playthrough:golden`; локальный Chromium для этого не требуется.

- Успешный существующий CI job: run `40924355797`, job `golden-playthrough`, **success** за 1m58s: https://github.com/Creative36711/narthex/actions/runs/40924355797. Его исходная проверка использовала тот же campaign-1 archive SHA/commit; в archive `project.json` отсутствовал.
- Повторный `workflow_dispatch` для текущей ветки `arena/0478fff9-narthex` запрошен через `gh workflow run 400919893 --ref arena/0478fff9-narthex`, но GitHub вернул `403 Resource not accessible by integration`; новый run не создан. Последний более поздний прежний main-run `40945413575` завершился failure на шаге 7 (exit 1); у GitHub API нет причины кроме `Process completed with exit code 1`, а загрузка удалённого Actions log/artifact вернула EOF. Этот run не объявляется успешным.
- Измеренная браузерная база на том же pin находится в `_tools/reports/GOLD-1.6.log`: `:459` — `scene_gate_hall`, `expectedProjectJson404=2`; `:506` — весь save/reload/load-run, `projectJson404Count=5`. Независимая GOLD-1.4 JSONL-фиксация показывает два конкретных 404 на входе (`_tools/reports/GOLD-1.4.log:18,20`, checkpoint `:31`) и пять за полный прогон (`:78`). GOLD-1.6 отчёт подтверждает 5 HTTP 404 и их разбивку (2 вход, 2 Continue, 1 загрузка слота): `_tools/reports/GOLD-1.6.md:74-76`.

| Измерение на неизменённом pinned campaign-1 | База | После этой report-only работы | Ноль достигнут? |
|---|---:|---:|---|
| Вход в `scene_gate_hall` | 2 | 2 (ресурс в campaign-1 не добавлялся) | нет |
| Полный GOLD-1.4/GOLD-1.6 save/reload/load run | 5 | 5 (ресурс в campaign-1 не добавлялся) | нет |

Причина остаётся конкретной: `project.json` отсутствует в архиве, а golden route отвечает 404 и увеличивает счётчик при каждом запросе (`scripts/golden/play.mjs:143-155`). Временный HTTP overlay выше доказал успешные 200/parse для подготовленных байтов, но не подменял pinned archive и не является browser run. **0/0 не заявляется.**

## 6. Scope и PR

В этой задаче не менялись campaign-1, `.golden/manifest.json`, `.golden/karkas/`, `src/player/**`, `src/core/**`, `scripts/golden/**`, `public/ai/*.mjs`, `packs/**` или `docs/contracts/**`. Контракт оставлен в готовых байтах выше; фактическое добавление файла принадлежит campaign-1. Целевой diff этой ветки — только `_tools/reports/GOLD-1.8c.md` и `_tools/reports/GOLD-1.8c.log`.
