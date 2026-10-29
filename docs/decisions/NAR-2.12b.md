# NAR-2.12-Б — generic-реестр синхронных операций пака

## Намерение и граница

`PackOperationHost` в существующем `src/core/pack/host.ts` — второй, синхронный шов рядом с событийным `PackHost` из NAR-2.11. Реестр находит реализацию по имени операции, а не ветвится по идентификатору пака. `GameEngine`, `checks` и `effects` не импортируют жанровые реализации и не знают, какой пак их зарегистрировал.

Файлы и тела девяти жанровых модулей остались на месте без изменений. `packs/narrative/operations.ts` — единственный адаптер: он сохраняет прежние соглашения вызова (`this` либо первый аргумент `EngineCtx`) и регистрирует операции при подключении пака composition root’ом. Browser catalogue, App, отдельный editor playtest, cf-play и headless smoke/probe entrypoint’ы подключают один и тот же адаптер явно; динамического поиска по pack id и скрытого fallback нет.

## Операции и прежний путь

В таблице `narrative` означает регистрацию через `registerNarrativeOperations()` в `packs/narrative/operations.ts`. Имена операций совпадают с маркером `PACK_OPERATIONS` из `npm run probe:pack-operations`.

| операция | кто регистрирует | кто вызывает | что было раньше |
|---|---|---|---|
| `allRegions`, `findRegion`, `findLocation`, `currentScene`, `arrivalSceneOf`, `diceRules`, `activeSceneState`, `changeSceneState`, `goToSceneFromDialogue`, `startCombatFromDialogue`, `activePresenceOverride`, `npcHasSchedule`, `npcHasPresenceOverrides`, `slotOccupants`, `goToScene`, `navigate`, `travelTo`, `onEnterLocation`, `visibleLocations`, `travelCost`, `travelBaseCost` | narrative | фасад `GameEngine`; `diceRules` также вызывает `checks` | прямые `world.*(this, …)`; тип `SlotOccupant` импортировался из `world` |
| `shouldShowNarrativeIntro`, `isSceneIntroActive`, `markNarrativeIntroSeen`, `cutscene`, `cutsceneKey`, `showBanner`, `showPostcard`, `hidePostcard`, `flushPendingBannersIfClear`, `playCutscene`, `endCutscene`, `onCombatResolve`, `startCombat`, `endCombat` | narrative | фасад `GameEngine`, UI и effects через фасад | прямые `director.*.call(this, …)` |
| `dlgSpeakerLabel`, `setDialogueTimer`, `commitDialogueTimer`, `dialogueTimeout`, `promptPresentItem`, `commitDialoguePresenting`, `submitPresentedItem`, `resolveDialogueSource`, `startDialogue`, `chooseDialogueOption`, `endDialogue` | narrative | фасад `GameEngine`; нижний `dialogueTimeout` подключается адаптером к тому же публичному prototype | прямые `dialogueRuntime.*.call(this, …)`; runtime-поля и типы `DialogueUI`/`DialogueHistoryEntry` объявлялись в engine |
| `stealthEnabled`, `isSneaking`, `isDetected`, `playerSkill`, `toggleSneak`, `detectCheck`, `consumeSurpriseFromSneak`, `rollEncounter`, `resolveEncounter`, `tickPursuit`, `generatorsEnabled`, `eventTableDef`, `eventTableActive`, `rollEventTable`, `tickEventTables`, `genPickWeighted`, `genDef`, `genValue`, `seedRand`, `composeGenName`, `expandGenTemplate` | narrative | фасад `GameEngine`, travel callback и tick callbacks | прямые `encounters.*.call(this, …)` |
| `heroPortraitStateKey`, `heroPortraitImages`, `heroCombatFigure`, `isNpcNameKnown`, `npcLabel`, `learnNpcName`, `descOf`, `setEntityDescription`, `slotUseOptions`, `useItemOnSlot`, `entityState`, `unlockCodex`, `unlockedCodexEntries`, `codexCategories`, `fmt`, `itemInteractable`, `itemInteractOptions`, `runItemInteract`, `interactWithSlot` | narrative | фасад `GameEngine` и UI | прямые `sceneSlots.*.call(this, …)` |
| `getDisposition`, `npcMood`, `changeNpcMood`, `changeDisposition`, `reputation`, `uiLabel`, `reputationEnabled`, `reputationLabel`, `changeReputation`, `wealthLevels`, `wealthLevel`, `wealthLevelLabel`, `changeWealth`, `passion`, `passionLabel`, `changePassion`, `allegiance`, `allegianceLabel`, `changeAllegiance`, `applyFall`, `crimeLabel`, `commitCrime`, `hasCrime`, `bountyTotal`, `priceEventsActive`, `setPriceEvent`, `priceEventMultiplier`, `campAvailable`, `tickNpcMood` | narrative | фасад `GameEngine`, UI и tick callbacks | прямые `social.*(this, …)` |
| `startQuest`, `advanceQuestTo`, `journalUpdate`, `checkQuestTransitions` | narrative | фасад `GameEngine`; `checkQuestTransitions` вызывает `effects.checkRules` | прямые `quests.*(this, …)` |
| `gameOver`, `restart`, `newGamePlusAvailable`, `newGamePlus` | narrative | фасад `GameEngine` и UI | прямые `roguelike.*.call(this, …)` |
| `effect:start_dialogue` | narrative | generic dispatcher `effects.applyEffect` по `effect:${e.type}` | собственный case в `effects`, который вызывал `startDialogue` |
| `effect:fail_quest` | narrative | generic dispatcher `effects.applyEffect` по `effect:${e.type}` | собственный case в `effects` с записью failed-статуса и сообщения; тело перенесено в адаптер без изменения результата |
| `initialStateFields`, `initialRunStats`, `initializeRuntime` | narrative | `GameEngine.newState` и конструктор | жанровые поля save/state и три runtime-поля инициализировались литералами в engine; состав, порядок и начальные значения сохранены |

`src/core/dialogue.ts` по-прежнему предоставляет Ink-примитивы для `dialogue-runtime`; сам runtime теперь вызывается через реестр. Его публичные UI-типы объявлены в module augmentation адаптера, поэтому сигнатуры `GameEngine` для подключённого UI не изменились. `SlotOccupant` сохранён как структурно эквивалентный export из `shared/types`, без обратного импорта `world` в facade.

## Что осталось generic в ядре и почему

- `PackOperationHost<Context>`: регистрация, перечисление, `has`, результат `call` и синхронный `invoke`. Он не содержит имён жанровых модулей и не выбирает поведение по pack id.
- `PackOperationRefusal` и `PackOperationError`: коды `PACK_OPERATION_REGISTER_FAILED`, `PACK_OPERATION_MISSING`, `PACK_OPERATION_FAILED`, `PACK_OPERATION_PAUSED`, а также persistent pause. Исключение из адаптера не выходит наружу как произвольная ошибка пака: вызывающий получает типизированный refusal, а host останавливает дальнейшие операции.
- `GameEngine`: прежний публичный фасад UI, save/load, campaign, RNG, audio и generic `runPackOperation`. Конструктор и методы UI не получили новых обязательных параметров.
- `effects`: общие правила и диспетчер расширения `effect:${e.type}`. Отсутствие зарегистрированного effect-handler означает обычный core case, а не ошибку; наличие handler никогда не вызывает legacy case вторично.
- `checks`: общие BRP/duration mechanics; только ранее жанровой источник dice rules делегируется через реестр.
- `PackHost` sim/view из NAR-2.11 не изменён. Синхронный реестр не подменяет событийный sim и не смешивает его состояние с `GameState`.
- Не-genre systems (`character`, `economy`, `inventory`, `equipment`, `needs`, `party`, `meta`, `combat` как публичный controller) остались прямыми: карточка не разрешала переписывать их и не относила их к девяти модулям.

## Типизированный отказ вместо fallback

`call` возвращает discriminated union `{ ok: true, value } | { ok: false, refusal }`. `invoke` преобразует refusal в `PackOperationError` для существующих синхронных фасадных методов. Promise вместо синхронного результата также становится `PACK_OPERATION_FAILED`. После ошибки persistent pause возвращает `PACK_OPERATION_PAUSED`; прямого или косвенного возврата к старой реализации нет.

Проба вызывает настоящий `currentScene` через фасад и получает `scene_gates_front`, затем вызывает `empty.echo` пака-пустышки именно через `GameEngine.runPackOperation`. Негативный `broken.fail` даёт `PACK_OPERATION_FAILED` и pause `broken-probe/broken.fail`; следующий вызов получает `PACK_OPERATION_PAUSED`.

## Неясно / решил / откат

### 1. Где разместить реестр при пределе 34 core-модулей

- **неясно** — отдельный `src/core/pack/operations.ts` был бы привычнее, но увеличил бы запрещённое число модулей.
- **решил** — расширить существующий `pack/host.ts`: там уже живут fail-fast host и generic pack contracts; новых core-файлов нет, host имеет 369 строк, engine — 594.
- **откат** — удалить блок `PackOperationHost` из `pack/host.ts` и возвратить прямые вызовы из diff NAR-2.12-Б; отдельного файла реестра и миграции данных нет.

### 2. Как сохранить публичные lower-camel поля и save shape при буквальном grep-оракуле

- **неясно** — удаление импортов недостаточно: oracle запрещает даже имена runtime-полей и жанровых ключей в трёх core-файлах, а менять их нельзя по API/совместимости.
- **решил** — перенести объявления и начальную инициализацию этих полей в narrative-адаптер; facade сохраняет прежние имена и типы через module augmentation, а `initialStateFields`/`initialRunStats` возвращают прежние значения.
- **откат** — убрать augmentation и три initialization-операции, затем вернуть прежние field declarations из `origin/main`; существующие saves не мигрируются, потому что формат не менялся.

### 3. Как подключать headless-потребителей без ветвления по pack id

- **неясно** — `new GameEngine` встречается не только в App, но и в отдельном editor playtest, CLI и smoke/probe entrypoint’ах; неявный core import пака запрещён.
- **решил** — сделать регистрацию идемпотентной и подключить адаптер одной side-effect строкой в каждом существующем executable composition root. Это единственная правка таких scripts; тестовые ожидания и fixtures не изменены.
- **откат** — удалить строки подключения и `packs/narrative/operations.ts`; после возврата прямых импортов дополнительных действий по данным или manifest’ам не требуется.

## Проверка решения

Обязательный оракул, полный NPM-список и сырые выводы находятся в отдельном Drive report-log. На финальном дереве: оба grep пусты; `probe:pack-operations` rc=0; Ash/adventure/FMV сохранили исходные числа; 54/54 smoke и 9/9 probe rc=0; TypeScript, 34 acyclic core modules, 41 contracts, brand/version/packs/campaign copies и playkit freshness проходят. Девять исходных модулей не входят в diff.
