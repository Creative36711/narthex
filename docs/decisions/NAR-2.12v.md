# NAR-2.12-В — физический перенос девяти жанровых модулей в `packs/narrative`

## Намерение и граница

База — `68ba2ffc3d511cb67481e8e8f6a3ab85e758bc09` (NAR-2.12-Б). Девять реализаций физически удалены из `src/core` и находятся только в `packs/narrative`. Их тела, экспортируемые имена, сигнатуры и построчная структура не изменены: diff каждого перенесённого файла содержит исключительно спецификаторы import. Core не содержит копий, shim’ов, re-export’ов или импортов из пака.

`packs/narrative/index.ts` — публичный barrel самого пака, а не обходной facade в core. Потребители редакторского и player UI, операции пака и executable scripts используют новые пути. Составной root по-прежнему подключает `packs/narrative/operations.ts`; регистрация операций не выбирается по pack id и не имеет fallback в core.

Campaign data, fixtures и их ожидания, save format, manifest semantics и инструменты гейтов не менялись. Сгенерированный `public/ai/cf-play.mjs` только пересобран штатным esbuild-скриптом из новых исходных путей.

## Таблица переноса

| модуль | старый путь (удалён) | новый единственный путь | строк до/после | изменённые import-строки |
|---|---|---|---:|---:|
| dialogue | `src/core/dialogue.ts` | `packs/narrative/dialogue.ts` | 441 / 441 | 3 |
| dialogue-runtime | `src/core/dialogue-runtime.ts` | `packs/narrative/dialogue-runtime.ts` | 360 / 360 | 4 |
| scene-slots | `src/core/scene-slots.ts` | `packs/narrative/scene-slots.ts` | 341 / 341 | 6 |
| encounters | `src/core/encounters.ts` | `packs/narrative/encounters.ts` | 352 / 352 | 6 |
| world | `src/core/world.ts` | `packs/narrative/world.ts` | 357 / 357 | 7 |
| social | `src/core/social.ts` | `packs/narrative/social.ts` | 302 / 302 | 4 |
| director | `src/core/director.ts` | `packs/narrative/director.ts` | 243 / 243 | 6 |
| roguelike | `src/core/roguelike.ts` | `packs/narrative/roguelike.ts` | 103 / 103 | 5 |
| quests | `src/core/quests.ts` | `packs/narrative/quests.ts` | 70 / 70 | 4 |
| **итого** | **9 удалений, других изменений в `src/core` нет** | **9 pack-файлов** | **2569 / 2569** | **45** |

Проверка выполнялась против `git show 68ba2ff:src/core/<module>.ts`: каждый непустой diff-hunk относится только к import-строке. Маркер `PACK_MOVE pack=narrative modules=9 lines=2569` и девять `PACK_MOVE_PATH` выводит `npm run probe:pack-move`.

## Полный реестр pack→core import

Перенос не означает запрет использования generic core services паком; запрещено обратное направление core→pack. Ниже перечислены **все 37 статических pack→core import** в 16 TypeScript-файлах `packs/narrative`: 25 в перенесённых модулях и 12 в уже существовавших адаптерах/портах/пробе. Импорты из `src/shared` в это число не входят.

| потребитель | импортируемое | core-путь | причина оставить направление pack→core |
|---|---|---|---|
| `dialogue-runtime.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context; не дублировать контракт |
| `dialogue.ts` | `type EngineCtx` | `core/context` | прежний тип Ink external functions |
| `director.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `director.ts` | `featureOn` | `core/caps` | единый capability-gate вместо нового условия по pack id |
| `director.ts` | `CombatController` | `core/combat` | существующий общий боевой контроллер; director только делегирует |
| `encounters.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `encounters.ts` | `featureOn` | `core/caps` | единые capability semantics для stealth/encounters |
| `encounters.ts` | `skillCheck`, `difficultyModifier`, `CHECK_RESULT_LABEL` | `core/brp` | общие BRP-проверки и прежние русские подписи |
| `encounters.ts` | `timeOfDay` | `core/time` | единые правила времени для таблиц событий |
| `encounters.ts` | `effects` | `core/effects` | существующий общий конвейер эффектов встреч |
| `fmv.ts` | `type DeepReadonly`, `type PackDrawCommand` | `core/pack/host` | существующий generic view/draw contract пака |
| `hooks.ts` | `type PackHooks` | `core/pack/host` | существующий generic lifecycle contract |
| `operations.ts` | `type EngineCtx` | `core/context` | тип generic operation adapter без копии engine |
| `operations.ts` | `capabilityIsOff` | `core/caps` | прежнее cap-off поведение для `effect:fail_quest` |
| `operations.ts` | `GameEngine` | `core/engine` | установка уже существующего lower-camel `dialogueTimeout` на прежнем prototype; новых имён нет |
| `operations.ts` | `packOperations`, `PackOperationError`, `type PackOperation` | `core/pack/host` | generic registry и типизированные отказы из NAR-2.12-Б |
| `probes/campaign.mts` | `PackHost` | `core/pack/host` | проба использует настоящий host, а не mock |
| `probes/campaign.mts` | `resolvePackRegistry`, `type PackManifest`, `type PackRegistryFile` | `core/pack/registry` | проба использует настоящий registry resolver |
| `quests.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `quests.ts` | `capabilityIsOff` | `core/caps` | единый quests capability-gate |
| `quests.ts` | `evalCondition` | `core/conditions` | общий evaluator условий квестовых стадий |
| `roguelike.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `roguelike.ts` | `evalCondition` | `core/conditions` | общий evaluator условий NG+/game over |
| `roguelike.ts` | `removeSave` | `core/savemigrate` | существующее удаление старого save при NG+; формат не меняется |
| `roguelike.ts` | `meta` | `core/meta` | существующие общие meta-операции NG+ |
| `runtime.ts` | `type PackSimBinding` | `core/pack/host` | существующий generic sim-binding contract |
| `runtime.ts` | `type PackManifest` | `core/pack/registry` | существующий manifest contract |
| `scene-slots.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `scene-slots.ts` | `evalCondition` | `core/conditions` | общий evaluator условий слотов и предметов |
| `sim.ts` | `type DeepReadonly`, `type PackSimHook` | `core/pack/host` | существующий generic sim-hook contract |
| `social.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `social.ts` | `CHECK_RESULT_LABEL`, `skillCheck` | `core/brp` | общие BRP-проверки социальных действий |
| `social.ts` | `rollDice` | `core/dice` | общий детерминированный dice path |
| `view.ts` | `type PackViewHook` | `core/pack/host` | существующий generic view-hook contract |
| `world.ts` | `evalCondition`, `evalSceneCondition` | `core/conditions` | общие условия сцен, переходов и присутствия NPC |
| `world.ts` | `type EngineCtx` | `core/context` | прежний типизированный engine context |
| `world.ts` | `hourOfDay`, `inTimeRange` | `core/time` | общие часы и интервалы расписаний NPC |

В таблице префиксы `packs/narrative/` и `src/` сокращены только для читаемости; фактические спецификаторы в файлах начинаются с `../../` либо `../../../`. `grep -rn packs/narrative src/core` пуст: обратных рёбер нет.

## Операции, barrel и совместимость API

Восемь object-реализаций регистрируются прежними адаптерами `addThisOperations`/`addContextOperations`. У `dialogue.ts` нет такого object-реализации, поэтому для видимого вызова именно девятого модуля в existing registry добавлена одна чистая операция `cleanDialogueLine`; она делегирует существующей функции без изменения её тела. Narrative registry содержит 129 операций.

`packs/narrative/index.ts` делает `export *` ровно для девяти перенесённых файлов. Проба импортирует barrel и проверяет девять характерных exports (`cleanDialogueLine` и восемь implementation objects).

Список `Object.getOwnPropertyNames(GameEngine.prototype).sort()` до и после содержит 269 имён и имеет один SHA-256: `3ff22ce79ef63770d477b2749a5a10db18e1cd5bf937510229172c4168238973`. Отдельный unregistered-core child process получает `PACK_OPERATION_MISSING` для `currentScene`; скрытого core fallback нет.

Save envelope, `save_version`, миграции и campaign fixtures не изменены. Поэтому перенос не добавляет никакой миграции: старые saves проходят через тот же baseline `openSave` path. Существующая проверка совместимости по-прежнему включает штатный перенос v3→v4; это прежнее поведение, а не новая миграция NAR-2.12-В.

## Неясно / решил / откат

### 1. Как перенести файлы без скрытого изменения логики

- **неясно** — после смены глубины каталога относительные core/shared imports ломаются, но переписывать тела или создавать core re-export запрещено.
- **решил** — сделать `git mv`, затем заменить только 45 import-спецификаторов; line counts и import-only diff зафиксированы для каждого файла.
- **откат** — revert объединённого коммита PR возвращает девять исходных core-файлов и прежние import-строки; данных для обратной миграции нет.

### 2. Как показать вызов `dialogue` через generic registry

- **неясно** — остальные восемь модулей экспортируют implementation objects, а `dialogue.ts` экспортирует отдельные Ink helpers.
- **решил** — зарегистрировать существующий чистый `cleanDialogueLine` в `operations.ts`, не добавляя метод в `GameEngine` и не меняя модуль.
- **откат** — удалить одну registration-строку и соответствующий вызов пробы вместе с откатом переноса.

### 3. Почему появился npm-alias `smoke:saves-compat`

- **неясно** — карточка называет `smoke:saves-compat`, а в базе есть `scripts/saves-compat-smoke.mts`, но нет одноимённой npm-команды.
- **решил** — зарегистрировать существующий файл без правок; не создавать второй тест и не менять ожидания. Поэтому baseline-счётчик остаётся 54/54, а полный текущий NPM-список честно равен 55/55, где дополнительная проверка — saves compatibility.
- **откат** — удалить одну строку `smoke:saves-compat` из `package.json`; файл и save format при этом не затрагиваются.

### 4. Какой результат `cutsceneKey` считать поведенческой пробой

- **неясно** — первая версия новой пробы ожидала `0`, но предшествующий настоящий `startDialogue` уже поставил cutscene в очередь, и ключ стал `1`.
- **решил** — проверять неотрицательный safe integer и выводить фактическое значение, а не менять game logic или порядок campaign operations ради нуля.
- **откат** — новая проба удаляется вместе с задачей; этот assertion не затрагивает производственный код и не ослабляет старые тесты.

## Проверка решения

- Placement oracle: 9 `PACK:`, 0 `CORE:`; 2569 строк; старые runtime/script paths отсутствуют; core→pack imports отсутствуют.
- `probe:pack-move`: barrel, 9 registry operations, `currentScene()`, 269-method API и typed unregistered-core refusal — rc=0.
- Ash: 10/8/6/21, 0 ошибок, 8 предупреждений, 5 deaths (1 exhaustion + 4 combat), покрытие 6/10. Source и rebuilt cf-play совпали с baseline.
- `explain --catalogue` текущего и базового cf-play: byte-identical output; adventure/FMV probes и smokes зелёные.
- TypeScript, 25 acyclic core modules, 41 contracts, brand/version/packs/campaigns/playkit freshness — rc=0.
- Baseline smoke: 54/54; отдельный `smoke:saves-compat`: rc=0; полный текущий список: 55/55. Все `probe:*` из NPM: 10/10.
- `public/ai/cf-play.mjs` пересобран штатно, SHA-256 `6f1c5c999f2c63cd240558ce6c16577d039d5eb3c30485ba1e24719b56f79e3c`; `check:playkit-bundle` подтверждает freshness.

Сырые логи обязательного оракула и полного NPM-списка вынесены в отдельный Drive report-log. Откат выполняется одним revert merge-коммита: он восстанавливает только исходные пути и адаптеры, не требуя изменения кампаний, saves или manifest’ов.
