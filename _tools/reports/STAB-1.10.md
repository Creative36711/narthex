# STAB-1.10 — модульный размер и старый бренд: приведение к нулю правкой данных, а не порогами

Карточка: `4096f0cf-5705-813c-814f-c73e30363a63` (STAB-1.10, шаг 2 порядка STAB после
1.8 «сборка» и 1.9 «бандл»). Ветка: `arena/ed2c09ee-narthex`. База: `60f671b` (main).

Задача: убрать последний массово-красный класс базовых проверок — модули сверх лимита
и следы старого бренда — **разбиением модулей и правкой данных**, без подъёма лимитов,
без новых исключений и без пересборки `public/ai/**`.

## 1. «До» — исходное состояние (`60f671b`, чистый main)

| Проверка | rc | Счёт |
| --- | --- | --- |
| `npm run check:module-size` | 1 | 11 модулей > 450 строк |
| `npm run check:brand` | 1 | 302 следа старого бренда в 75 файлах |

Модули сверх лимита (`MODULE_LIMIT = 450`):

| Модуль | Строк |
| --- | --- |
| `src/editor/CampaignEditor.tsx` | 5199 |
| `src/shared/types.ts` | 3406 |
| `src/editor/store.ts` | 1407 |
| `src/editor/EditorApp.tsx` | 1394 |
| `src/editor/inkImport.ts` | 883 |
| `src/editor/campaignAudit.ts` | 705 |
| `src/editor/newCampaign.ts` | 690 |
| `src/editor/AiWizard.tsx` | 636 |
| `src/shared/compat.ts` | 496 |
| `src/App.tsx` | 470 |
| `src/shared/CutscenePlayer.tsx` | 460 |

## 2. Что сделано

### 2.1 Разбиение модулей (поведение не менялось, ничего не удалено)

| Было | Стало | Новые модули (смысл) |
| --- | --- | --- |
| `src/editor/newCampaign.ts` 690 | **378** | `campaignFiles.ts` 140 — файловые операции пакета (запись, base64, zip-префикс, белый список); `campaignIndex.ts` 83 — реестр кампаний (чтение, резерв id, гидратация); `campaignFolderImport.ts` 136 — импорт папки кампании с разрешением конфликтов id |
| `src/editor/inkImport.ts` 883 | **197** | `inkImportLines.ts` 212 — построчный разбор (условия, эффекты, реплики); `inkImportFlow.ts` 192 — поток строк и блоки условий; `inkImportChoices.ts` 236 — ответы и проверки навыка; `inkImportKnots.ts` 97 — таймер реплики и русские подписи узлов |
| `src/editor/AiWizard.tsx` 636 | **384** | `AiNewCampaignTab.tsx` 206 — вкладка «создать кампанию» и справочники жанров/тонов/масштабов; `AiPatchSection.tsx` 168 — блок ручных правок мастера и выбор состава чемодана |
| `src/shared/compat.ts` 496 | **248** | `compatInventory.ts` 270 — инвентаризация пакета и свёртки (digest/canonical/value-digest) |
| `src/shared/CutscenePlayer.tsx` 460 | **384** | `cutsceneYoutube.tsx` 88 — встраивание YouTube-слайда и оффлайн-фолбэк |
| `src/App.tsx` 470 | **443** | `appShell.ts` 67 — классы оболочки на `<html>`/`<body>`, разблокировка WebAudio |

Итог по размеру: 6 из 11 модулей ушли под лимит; все новые модули ≤ 450 строк
(`468` строк суммарно на 8 новых файлов в `src/editor`, `src/shared`).

Ограничения, которые пришлось соблюсти (иначе краснеют smokes, читающие файлы по пути):
в исходных файлах остались закреплённые литералы — например `index.push({ id, title,
author, description: meta.description })` и `export async function syncIndexEntry` в
`newCampaign.ts`, `const stableId = campaignIdFromPath(base)` и `ID кампании` в
`EditorApp.tsx`, `function pickCampaign(` и `<NoCampaignScreen` в `App.tsx`.

### 2.2 Старый бренд

«До»: 302 следа в 75 файлах. «После»: **266**.

Исправлено содержательно (в зоне, вне входа генератора бандла аудита):

| Файл | Что заменено |
| --- | --- |
| `src/index.css` (5), `src/editor/editor.css` (2) | название фирменного профиля в комментариях токен-системы |
| `src/editor/EditorApp.tsx` (4) | заголовок режима редактора, шапка «редактор», текст предупреждения о версии движка |
| `src/editor/AiWizard.tsx` (3) | стартовый промпт, подпись «AI Toolkit», текст отчёта для ИИ |
| `src/editor/aiTask.ts` (3), `src/editor/aiPrompt.ts` (1) | заголовки пакета задания и текст промпта MonolithDoc |
| `src/editor/chronicle.ts` (4) | заголовок README патча и комментарии экспорта/импорта |
| `src/editor/assets.ts` (1), `src/editor/CampaignEditor.tsx` (1) | комментарии |
| `src/shared/profiles.ts` (1) | подпись фирменного профиля → «Narthex» (id `forge` не менялся, ADR 0001) |
| `src/shared/icons.tsx`, `tauri.ts`, `types.ts` (4), `versions.ts` (1) | комментарии |

Замены — реальные значения (название продукта и подпись профиля), не заглушки и не
отключение правила.

## 3. «После» — итог проверок

| Проверка | rc | Счёт | Δ |
| --- | --- | --- | --- |
| `npm run check:module-size` | 1 | 5 модулей > 450 | −6 |
| `npm run check:brand` | 1 | 266 следов | −36 |

Ноль не достигнут. Ниже — точная причина по каждому остатку, пороги не трогались,
новых исключений нет.

### 3.1 `src/editor/store.ts` (1407) и `src/editor/campaignAudit.ts` (705) — вход генератора бандла аудита

Оба файла входят в граф `scripts/campaign-audit.mts` (15 проектных входов: `src/core/{brp,
caps,charcreate,dice,loader,pack/capability-modes,prng}`, `src/editor/{campaignAudit,store}`,
`src/shared/{aiBaseline,migrate,ruleFiles,skills,types,versions}`). Разбиение меняет порядок
модулей в выводе esbuild, то есть байты `public/ai/campaign-audit.mjs`.

Проверено фактически: пробное разбиение `campaignAudit.ts` на `campaignAuditSchema.ts` /
`campaignAuditMedia.ts` / `campaignAuditFindings.ts` / `campaignAuditReport.ts` дало
`check:audit-bundle` rc 1 — сгенерировано 1 003 043 байта против закоммиченных 1 002 333,
первое расхождение в байте 96 536. Правка откатана.

Пересборка `public/ai/**` — вне зоны карточки (инвариант 4: «не пересобирать; если правка
меняет вход генератора — стоп и факт»). Поэтому разбиение остановлено здесь.

То же ограничение держит два следа бренда в этих файлах:
`src/editor/campaignAudit.ts:686` и `src/shared/versions.ts:53,137,164` — это строки
рантайма, они попадают в вывод бандла.

### 3.2 `src/shared/types.ts` (3406) — объявления закреплены 10 smokes, читающими файл по пути

`src/shared/types.ts` читают (и проверяют конкретные объявления) работающие smokes:
`breathe-toggle` (`breathe?: boolean`), `feedback16` (`NpcDef`, `Effect`/`DlgEffect`,
`desc_overrides`), `feedback17` (отсутствие `BUILTIN_EQUIPMENT_SLOTS`), `feedback25`
(`hide_label`, `scene_sprite_states`, `sprite_state`, `ImageValue`, `conditions_any`,
`combat_figure_states`, `scene_sprite`, `interact_options`, `interactable_when`),
`feedback26` (`{ type: 'weather'; … }`), `feedback8-A` (`player_enters_location`,
`flag_set`), `feedback8-D` (`ArtDoc` и примитивы), `feedback8-G` (`voice?: string`),
`feedback9` (`loop`, `ambient`, `MusicMood`/`MusicLayer`, `EmotionDef`, `DEFAULT_EMOTION`),
`smoke-dialogue-speaker` (`speaker?: string` и комментарий о присутствии спикера).

Проверено фактически: вынос объявлений по доменам (14 модулей, `types.ts` → 400 строк,
`check:audit-bundle` при этом остаётся 0 — типы не попадают в вывод) добавил 6 новых
провалов `feedback25`, потому что объявления уехали из читаемого файла. Правка откатана:
`types.ts` возвращён к 3406 строкам.

Вывод: содержимое `types.ts` — не «долг по размеру», а закреплённый контракт для
работающих оракулов. Разбиение возможно только вместе с правкой `scripts/**` (вне зоны).

### 3.3 `src/editor/CampaignEditor.tsx` (5199) и `src/editor/EditorApp.tsx` (1394) — долг, не блокировка

Эти два модуля не входят ни в граф бандла аудита, ни в закреплённые чтения — их можно
и нужно разбивать. В этом прогоне не успели: разбиение `CampaignEditor.tsx` требует
выделения секций-вкладок единого компонента (~2500 строк одной функции) с пробросом
состояния, а `EditorApp.tsx` — выноса обработчиков, замкнутых на состояние компонента.
Это остаётся долгом STAB-1.10 и переносится в следующий шаг (STAB-1.11).

### 3.4 Остаток бренда: 266 следов

Вне зоны карточки (207 следов, файлы нельзя править по условию «дифф только
`src/**` + `public/**` минус две зоны + отчёт + решение»):

| Путь | Следов |
| --- | --- |
| `docs/**` | 74 |
| `scripts/**` | 34 |
| `_tools/**` | 29 |
| `ARCHITECTURE.md` | 23 |
| `README.md` | 10 |
| `public/ai/**` (пересборка запрещена) | 27 |
| `src-tauri/**` | 5 |
| `vite.config.ts` | 2 |
| `index.html` | 1 |
| `package.json` | 1 |
| `public/campaigns/ash-of-caerden/**` (защищённый путь) | 1 |

В зоне (`src/**`), но закреплено оракулами вне зоны — правка сделала бы их красными
именно из-за переименования:

| Файл | Что закреплено | Кем |
| --- | --- | --- |
| `src/editor/aiTask.ts:220`, `src/editor/chronicle.ts:126`, `src/editor/EditorApp.tsx` (6), `src/editor/AiWizard.tsx:325`, `src/editor/aiPrompt.ts:28,40` | старое расширение пакета в имени файла и текстах | `scripts/ai-task-smoke.mts:39` |
| `src/shared/settings.ts:48` | ключ настроек старого бренда | `scripts/feedback8-G-smoke.mts:80` |
| `src/editor/playtestNotes.ts:9,10` | ключи заметок плейтеста | ADR 0001 требует перенос, но ключ читается как часть формата заметок |
| `src/App.tsx:401` | старое расширение сохранения | `scripts/saves-compat-smoke.mts:200` |
| `src/shared/compat.ts:32`, `src/shared/compatInventory.ts:11`, `src/shared/types.ts:3214` | строки формата обмена (`COMPAT_FORMAT`, `INVENTORY_FORMAT` и литеральный тип) | значение лежит в данных кампаний и в `docs/campaign.schema.json` (вне зоны) |
| `src/shared/types.ts:193,1102` | ключ мета-хранилища в комментариях | `scripts/p2-mechanics-smoke.mts:216`, `scripts/combat-rules-smoke.mts:1025` |

## 4. Оракулы (не покраснели)

| Команда | rc | Итог |
| --- | --- | --- |
| `npx tsc -b` | 0 | молчит |
| `npm run lint` | 0 | 1517 warnings, 0 errors (до правок — 1515 warnings, 0 errors; +2 предупреждения перенесены вместе с кодом YouTube-слайда) |
| `npm run check:audit-bundle` | 0 | 1 002 333 байта, sha256 `b7f271bf…` — совпадает с закоммиченным |
| smokes (73 шт.) | — | 31 rc 0 / 41 rc 1 / 1 rc 2 — **ровно как на базе `60f671b`**; ни один smoke не сменил rc, состав провалов в красных smokes тот же (сверка построчно, кроме случайных UUID в тексте) |

## 5. Допущения

- «Допущение: строки бренда, которые попадают в вывод `scripts/campaign-audit.mts`, считаются
  входом генератора и в этой карточке не правятся — пересборка `public/ai/**` вне зоны.»
- «Допущение: комментарии и CSS-подписи можно править свободно: esbuild срезает
  комментарии, поэтому байты бандла не меняются (проверено `check:audit-bundle` после
  каждой правки).»
- «Допущение: объявления в `src/shared/types.ts`, которые проверяют работающие smokes,
  остаются в этом файле: перенос равносилен поломке оракула, а править `scripts/**` нельзя.»
- «Допущение: расширения/ключи/форматы старого бренда в `src/**` не переименовываются, пока
  соответствующие строки закреплены в `scripts/**`: переименование сделало бы эти smokes
  красными по причине правки, а не по причине бага.»

## 6. Итог

- Модульный размер: 11 → 5 модулей сверх лимита; 6 модулей разбиты по смыслу, ни один
  порог и ни одно исключение не добавлены.
- Бренд: 302 → 266 следов; из 36 исправленных — название продукта и подпись профиля в
  `src/**`, а также комментарии/CSS.
- Ноль не достигнут: `store.ts`, `campaignAudit.ts`, `versions.ts` входят в генератор
  бандла аудита (пересборка `public/ai/**` вне зоны); `types.ts` закреплён работающими
  smokes; `CampaignEditor.tsx` и `EditorApp.tsx` — долг, перенесённый в STAB-1.11;
  266 следов бренда в основном лежат в путях вне зоны карточки.
