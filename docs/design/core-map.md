# Карта ядра `GameEngine` (`src/core/engine.ts`)

> **Задача:** `NAR-1.1 · Карта ядра` (миссия `NAR-1 · Ядро под паки`, фаза 1 в `docs/platform.md` §12)  
> **Исследуемый файл:** `src/core/engine.ts` (`5146` строк, без правок кода)  
> **Назначение документа:** полная инвентаризация всех `5146` строк, `253` публичных точек входа, `44` внутренних (`constructor` + `private`) методов и `39` полей класса `GameEngine` с целевым разбиением на тонкий фасад `src/core/engine.ts`, контекст `src/core/context.ts` и `16` ацикличных модулей подсистем для карточек `NAR-1.2`–`NAR-1.10` и последующего выделения пака `narrative` (`NAR-2`).

---

## 1. Сводка метрик и сверка подсчётов

### 1.1. Ключевые цифры `src/core/engine.ts`

- **Общий объём файла:** **`5146` строк** (`wc -l < src/core/engine.ts` → `5146`):
  - **Шапка файла (`HEAD`, `L1–L81`):** **`81` строка** — импорты из `../shared/*`, `./*`, `inkjs` и экспортируемый интерфейс `SlotOccupant` (`L77–L80`).
  - **Тело класса `GameEngine` (`F0` + `M01`..`M16`, `L82–L5099`):** **`5018` строк** (`384` строки фасада `F0` + `4634` строки в `16` выносимых модулях `M01`..`M16`; размер каждого выносимого модуля — от **`61`** до **`379`** исходных строк, т.е. у каждого запас минимум **`+71` строка** под импорты до жёсткого потолка `≤ 450` строк).
  - **Экспорты нижнего блока (`EXP`, `L5100–L5146`):** **`47` строк** — реэкспорты `savemigrate`/`types` и 3 функции верхнего уровня (`loadSave`, `deleteSave`, `hasSave`).
  - **Точная проверка суммы:** **`81` (шапка) + `5018` (сумма строк по группам) + `47` (экспорты) = `5146` строк** (погрешность `0` строк).
- **Публичный API модуля (`253` точки входа — раздел §5):**
  - `246` публичных методов экземпляра `GameEngine`;
  - `4` публичных геттера `GameEngine` (`get cutscene`, `get cutsceneKey`, `get mainCurrency`, `get diceRules`);
  - `3` экспортируемые функции верхнего уровня (`loadSave`, `deleteSave`, `hasSave`);
  - **Итого публичных методов/точек входа в главной таблице §5:** **`246 + 4 + 3 = 253`**.
- **Внутренние члены `GameEngine` (приложение §6, выписаны отдельно, чтобы покрыть 100% кода при рефакторинге):**
  - `1` `constructor(campaign, state?)` (`L182–L199`);
  - `41` `private`-метод экземпляра + `2` `private static`-метода (`metaKey`, `blankMetaState`);
  - **Итого всех вызываемых объявлений AST файла:** `253 + 44 = 297`.
- **Поля класса `GameEngine` (раздел §3):** **`39` полей** (`23` `public` + `13` `private` поля экземпляра + `3` `private static` константы/поля; при этом `26` полей объявлены в шапке класса `L83–L180`, а ещё **`13` полей разбросаны внутри секций на строках `L419–L4834`** — все они учтены в §3).

### 1.2. Сверка `grep`-подсчётов на `src/core/engine.ts`

При проверке регулярных выражений из ТЗ `NAR-1.1` на исходном `src/core/engine.ts` зафиксировано точное соотношение двух шаблонов:

1. Расширенный шаблон публичного API файла (захватывающий методы `GameEngine`, `get`-аксессоры и `export function`):
   ```bash
   grep -cE '^(  (async |get )?[a-zA-Z_]+\(.*\):|export function )' src/core/engine.ts
   # -> 253 (246 public-методов + 4 public-геттера + 3 export function)
   ```
2. Буквальный шаблон `grep -cE '^  (async )?[a-zA-Z_]+\(' src/core/engine.ts` даёт **`248`** совпадений по двум синтаксическим причинам в исходном файле:
   - он не захватывает `4` публичных геттера (`  get cutscene():`, `  get cutsceneKey():`, `  get mainCurrency():`, `  get diceRules():`) и `3` верхнеуровневых `export function` (`loadSave`, `deleteSave`, `hasSave`) (`-7`);
   - одновременно он захватывает `  constructor(` на `L182` и вызов с отступом в два пробела `  removeSave(campaignId)` внутри тела `deleteSave` на `L5134` (`+2`): `253 - 7 + 2 = 248`.

Таким образом, число **`253`** в `tz.md` и карточке `NAR-1.1` — это **полный публичный контракт файла `src/core/engine.ts` (`246` публичных методов + `4` публичных геттера + `3` экспортируемые функции сохранений)**; именно эти **ровно `253` строки (`#1`–`#253`)** составляют основную таблицу §5, а все `44` приватных хелпера и `constructor` сведены в отдельное приложение §6 с буквенными кодами `P01`–`P44`.

### 1.3. Критерии классификации каждого метода (две оси)

- **Колонка «Группа» (`ядро` / `пак` / `фасад`):**
  - **`фасад`** (**`24`** методов в таблице §5; **`384`** строк тела класса + **`47`** строк экспортов) — внешний стор сессии `GameEngine`, подписка и уведомление UI (`subscribe`, `notify`), тосты/всплывающие сообщения/музыкальный оверлей, флаги состояния, жизненный цикл забега (`start`, `gameOver`, `restart`, `newGamePlus*`) и сохранения (`autosave`, `manualSave`, `loadSave`, `deleteSave`, `hasSave`). Остаётся в `src/core/engine.ts`, а для вынесенных модулей содержит однострочные делегаты.
  - **`ядро`** (**`42`** методов в таблице §5; **`1299`** строк модулей `M02`, `M07`, `M13`, `M16` + универсальная часть `M15`) — платформенные механизмы, общие для всех 5 направлений Narthex (`narrative`, `state-ui`, `grid-strategy`, `endless-2d`, `spatial-3d` согласно `docs/platform.md` §5 и §8): ход тиков/времени, базовое здоровье и временные статусы, машина длительных действий, броски и пул удачи, движок правил/условий/эффектов, межигровой мета-прогресс, таблицы случайных событий и детерминированные генераторы.
  - **`пак`** (**`187`** метода в таблице §5; **`3335`** строк модулей `M01`, `M03`–`M06`, `M08`–`M12`, `M14`, `M15`) — предметные возможности capability-паков из `docs/contracts/caps.json` (`scenes`, `dialogue`, `quests`, `party`, `inventory`, `equipment`, `needs`, `stats`, `social`, `stealth`, `trade`, `craft`, `combat`, `encounters`, `cutscenes`, `charcreate`). На фазе `NAR-1` выносятся в отдельные модули `src/core/*.ts`, а на фазе `NAR-2` переезжают в `src/packs/narrative/` (или переиспользуются соседними паками).
- **Колонка «Зависит от нарратива» (`да` / `нет`):**
  - **`да`** (**`125`** методов из `253`, в т.ч. `пак/да = 115`, `фасад/да = 6`, `ядро/да = 4`) — тело метода в текущем `src/core/engine.ts` напрямую читает или мутирует сущности сюжетно-сценовой модели (`regions`, `locations`, `scenes`, слоты и `SceneStateDef`, `NpcDef`, расписания и `presenceOverrides`, `inkjs`/`DialogueUI`, `quests`/журнал, `cutscenes`/`banners`/`postcard`, кодекс, фракции/страсти/репутацию/преступления, слои портрета или текстовую подстановку `{hero}`). Для методов `ядро/да` (`advanceTicks`, `applyEffects`, `applyEffect`, `checkAchievements`) и `фасад/да` (`start`, `gameOver`, `restart`, `newGamePlus`, `inspectEntity`, `inParty`) отметка `да` точно подсвечивает точки, где в `NAR-2` прямые вызовы нарративных веток заменятся на хуки `PackModule`.
  - **`нет`** (**`128`** методов из `253`, в т.ч. `пак/нет = 72`, `ядро/нет = 38`, `фасад/нет = 18`) — метод работает исключительно с абстрактными числовыми пулами, флагами, `PRNG`, формулами статов/навыков/веса/прочности/рецептов, `MetaStoreState` или слотами сейвов без привязки к графу сцен, NPC и диалогам.

---

## 2. Скрытые аномалии разметки `src/core/engine.ts` (памятка исполнителям `NAR-1.3`–`NAR-1.8`)

Разделители `// ─────────────── ... ───────────────` в текущем `src/core/engine.ts` **не совпадают** с реальным содержимым секций в семи местах. Резать файл «по заголовкам комментариев» нельзя — нужно идти по точным диапазонам из §4:

1. **Лимит `≤ 450` строк на инвентаре (`S10` + `S11`, `L895–L1326`):** секции `инвентарь` (`73` строки), `износ снаряжения` (`84`), `экипировка` (`108`) и `груз и перегруз` (`167`) суммарно дают **`432` строки без импортов** — с шапкой импортов единый файл перевалит за `450`. Поэтому в `NAR-1.4` их нужно сразу делить на **два** модуля: `src/core/inventory.ts` (`157` строк) и `src/core/equipment.ts` (`275` строк); вместе это убирает из `engine.ts` > `400` строк и выполняет оба инварианта `NAR-1.4`.
2. **Чужие методы посреди `JSDoc` в секции `репутация` (`L1346–L1422`):** прямо между `/** Настроение NPC... */` (`L1347`) и методом `npcMood` (`L1424`) вставлены 3 метода визуальных слоёв героя (`heroPortraitStateKey`, `heroPortraitImages`, `heroCombatFigure` — `75` строк). Их место — в `scene-slots.ts` (`M12`), а комментарий `L1347` принадлежит `npcMood` (`M05`).
3. **Проверки d100 и удача внутри секции `длительные действия` (`L2437–L2555`):** поле `luckOffer`, `resolveLuckOffer`, `statCheck`, `applyByCheck`, `playerCheckOutcome`, `augmentBonus`, `opposedCheck` (`119` строк) лежат под заголовком `длительные действия`, вдали от `luckMax/luck/changeLuck` (`L1715–L1739`) и `get diceRules` (`L3270–L3275`). Все они объединяются в `checks.ts` (`M07`).
4. **Вся торговля лежит внутри секции `предъявление предмета в диалоге` (`L2889–L3028`):** `priceModifier`, `mainCurrency`, `currency*`, `buyPrice`, `sellPrice`, `traderSells`, `traderItemStock`, `buyItem`, `sellItem` (`140` строк) идут без собственного заголовка сразу после `submitPresentedItem`, отдельно от `openTrade`/`closeTrade` (`L2691–L2734`) и `priceEvents*` (`L2167–L2205`). Торговля и крафт сводятся в `economy.ts` (`M10`).
5. **Внутри секции `мир` (`L3231–L3561`) смешаны 3 подсистемы:** геттер ядра `get diceRules` (`L3270–L3275` → `M07`), мосты переходов из диалога `goToSceneFromDialogue`/`startCombatFromDialogue` (`L3304–L3320`) и расписания/оверлеи NPC в слотах сцен (`L3322–L3398` → `M11`).
6. **Пролог секции `эффекты` (`L3648–L3736`):** до `applyEffects` там лежат `descOf` (`M12`), `tickNpcMood` (`M05`), `tickPursuit` (`M15`), `togglePreparedAbility` (`M06`) и `setEntityDescription` (`M12`) — `89` строк четырёх разных модулей.
7. **Разрезанный `JSDoc` в секции `предмет → слот сцены` (`L4093–L4215`) и перед `autosave` (`L5048–L5077`):** в `S40–S41` лежат рецепты (`unlockRecipe`, `recipeKnown`, `knownRecipes` → `M10`), кодекс (`unlockCodex*`), а метод `fmt` (`L4170–L4211`) вставлен между `/** Есть ли у предмета... */` (`L4166`) и `itemInteractable` (`L4212`); аналогично `difficultyDef` (`L5053–L5070`) вставлен между комментарием `autosave` (`L5048–L5052`) и самим `autosave` (`L5072`).

---

## 3. Поля класса `GameEngine` (`39` полей) и контракт `EngineCtx`

### 3.1. Полная таблица всех `39` полей `GameEngine`

Ниже перечислены все `39` `PropertyDeclaration` класса `GameEngine` (`23` `public` + `16` `private`), включая `13` полей, объявленных в середине файла (`L419–L4834`). Колонка «Внешних файлов» показывает точное число файлов репозитория вне `src/core/engine.ts` (`UI` плеера/редактора + смоки/тесты), обращающихся к `engine.<field>` напрямую.

| Код | Строки | Поле | Видимость и тип | Внешних файлов | Целевой владелец | Группа | Нарратив | Хранение и назначение |
|---|---|---|---|---:|---|---|---|---|
| F01 | L83 | `campaign` | `public` `CampaignData` | 53 (UI:23, тест:27) | F0 / EngineCtx | фасад | нет | Только чтение (конфиг мира). Полные данные кампании `CampaignData`; базовый источник определений для всех модулей |
| F02 | L84 | `state` | `public` `GameState` | 78 (UI:18, тест:53) | F0 / EngineCtx | фасад | да | Сериализуется в сейв. Мутабельное состояние текущего забега `GameState` (сегодня включает поля `narrative`-пака) |
| F03 | L85 | `rng` | `public` `PRNG` | 10 (UI:0, тест:7) | F0 / EngineCtx | ядро | нет | Seed хранится в `state.seed`. Детерминированный генератор случайных чисел `PRNG` текущего забега |
| F04 | L87 | `debugInvincible` | `public` `inferred` | 4 (UI:1, тест:3) | F0 / EngineCtx | фасад | нет | Транзитное (не в сейве). Отладочный флаг неуязвимости героя в бою и при уроне потребностей |
| F05 | L88 | `listeners` | `private` `inferred` | 1 (UI:1, тест:0) | F0 (`engine.ts`) | фасад | нет | Транзитное (подписчики UI). Множество колбэков `Set<() => void>` реактивной подписки `subscribe()` / `notify()` |
| F06 | L89 | `activeStory` | `private` `Story \| null` | 0 (UI:0, тест:0) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (сессия ink). Активный экземпляр `inkjs.Story` текущего разговора |
| F07 | L90 | `activeNpc` | `private` `NpcDef \| null` | 0 (UI:0, тест:0) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (сессия диалога). Определение `NpcDef` текущего собеседника в диалоге (или `null` для нарративного узла) |
| F08 | L92 | `dialogue` | `public` `DialogueUI \| null` | 33 (UI:14, тест:20) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (UI-проекция). Текущий кадр открытого диалога `DialogueUI \| null`, читаемый `DialoguePanel` |
| F09 | L94 | `dialogueHistory` | `public` `DialogueHistoryEntry[]` | 1 (UI:0, тест:1) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (история диалога). Накопленный лог реплик и выборов `DialogueHistoryEntry[]` текущего разговора |
| F10 | L102 | `dialogueTimer` | `public` `{ seconds: number; knot?: string } \| null` | 0 (UI:0, тест:0) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (таймер выбора). Активный дедлайн ответа в диалоге `{ seconds, knot }` для полосы обратного отсчёта |
| F11 | L104 | `pendingDialogueTimer` | `private` `{ seconds: number; knot?: string } \| null` | 0 (UI:0, тест:0) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (буфер ink). Отложенный дедлайн, выставленный внешней функцией ink до рендера вариантов выбора |
| F12 | L106 | `pendingDialoguePresenting` | `private` `{ ok: string; fail: string; required?: stri...` | 0 (UI:0, тест:0) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (буфер ink). Ожидающий запрос предъявления предмета `{ ok, fail, required }` из ink-скрипта |
| F13 | L107 | `combat` | `public` `CombatController \| null` | 25 (UI:6, тест:17) | M01 (`director.ts`) | пак | да | Транзитное (контроллер боя). Активный `CombatController \| null`, управляющий пошаговым боем на `CombatScreen` |
| F14 | L109 | `lastDialogueError` | `public` `string \| null` | 3 (UI:1, тест:3) | M14 (`dialogue-runtime.ts`) | пак | да | Транзитное (диагностика). Текст последней ошибки компиляции/запуска узла диалога для отладчика редактора и смоков |
| F15 | L111 | `trade` | `public` `NpcDef \| null` | 5 (UI:2, тест:2) | M10 (`economy.ts`) | пак | да | Транзитное (экран торговли). NPC-торговец `NpcDef \| null`, с которым сейчас открыта панель торговли |
| F16 | L117 | `craftRequest` | `public` `{ recipe?: string } \| null` | 2 (UI:1, тест:1) | M10 (`economy.ts`) | пак | да | Транзитное (экран крафта). Флаг открытия окна изготовления `{ recipe? } \| null` с опциональной подсветкой рецепта |
| F17 | L119 | `craftSourceEntity` | `public` `ItemDef \| null` | 1 (UI:1, тест:0) | M10 (`economy.ts`) | пак | да | Транзитное (экран крафта). Конкретная сущность верстака/плиты `ItemDef \| null`, через которую открыт крафт |
| F18 | L121 | `toasts` | `public` `{ id: number; text: string; kind: 'get' \| '...` | 1 (UI:1, тест:0) | F0 / EngineCtx | фасад | нет | Транзитное (очередь UI). Массив всплывающих уведомлений `{ id, text, kind }[]` для `GameView` |
| F19 | L122 | `toastSeq` | `private` `inferred` | 0 (UI:0, тест:0) | F0 (`engine.ts`) | фасад | нет | Транзитное (счётчик ID). Монотонный счётчик уникальных идентификаторов тостов |
| F20 | L125 | `inspectedEntityId` | `public` `string \| null` | 1 (UI:1, тест:1) | F0 (`engine.ts`) | фасад | да | Транзитное (инспектор). ID последней осмотренной сущности для `PlaytestDebugPanel` и инспектора |
| F21 | L133 | `musicOverride` | `public` `{ tracks: string[]; fade?: number } \| null` | 2 (UI:0, тест:1) | F0 (`engine.ts`) | фасад | нет | Транзитное (аудио-оверлей). Сюжетное переопределение музыкальных треков `{ tracks, fade }` поверх музыки сцены |
| F22 | L168 | `messages` | `public` `{ text: string; portrait?: string }[]` | 15 (UI:3, тест:12) | F0 / EngineCtx | фасад | нет | Транзитное (модальная очередь). Очередь всплывающих сообщений `show_message` (`{ text, portrait }[]`) |
| F23 | L175 | `cutsceneQueue` | `public` `Array<{ def: CutsceneDef; serial: number }>` | 1 (UI:0, тест:1) | M01 (`director.ts`) | пак | да | Транзитное (очередь роликов). FIFO-очередь поставленных к показу катсцен `{ def, serial }[]` |
| F24 | L176 | `cutsceneSerial` | `private` `inferred` | 0 (UI:0, тест:0) | M01 (`director.ts`) | пак | да | Транзитное (счётчик ключей). Монотонный счётчик `serial` для ключей монтирования `CutscenePlayer` |
| F25 | L178 | `freshRun` | `public` `boolean` | 2 (UI:1, тест:1) | F0 (`engine.ts`) | фасад | нет | Транзитное (флаг сессии). `true`, если движок создан без готового сейва (запускать стартовые правила в `start()`) |
| F26 | L180 | `envelope` | `public` `SaveEnvelope \| null` | 3 (UI:1, тест:0) | F0 (`engine.ts`) | фасад | нет | Метаданные обёртки сейва. Последний `SaveEnvelope \| null` с версиями кампании/движка и временем записи |
| F27 | L419–L428 | `banners` | `public` `Array<{ /** serial для ключей React */ seri...` | 2 (UI:1, тест:1) | M01 (`director.ts`) | пак | да | Транзитное (оверлей титров). Активные текстовые баннеры сцены/главы, отображаемые поверх `GameView` |
| F28 | L430–L437 | `postcard` | `public` `{ image?: string art?: ArtDoc text?: string...` | 5 (UI:2, тест:3) | M01 (`director.ts`) | пак | да | Транзитное (оверлей открытки). Активная полноэкранная художественная «открытка» с камерой и подписью |
| F29 | L438 | `postcardTimer` | `private` `ReturnType<typeof setTimeout> \| null` | 0 (UI:0, тест:0) | M01 (`director.ts`) | пак | да | Транзитное (`Timeout`). Дескриптор `setTimeout` автозакрытия текущей открытки |
| F30 | L439 | `postcardPendingSeconds` | `private` `inferred` | 0 (UI:0, тест:0) | M01 (`director.ts`) | пак | да | Транзитное (буфер таймера). Отложенная длительность показа открытки (в секундах), ждущая закрытия интро |
| F31 | L440 | `bannerSerial` | `private` `inferred` | 0 (UI:0, тест:0) | M01 (`director.ts`) | пак | да | Транзитное (счётчик ID). Монотонный счётчик React-ключей экранных баннеров |
| F32 | L441 | `bannerPendingTimers` | `private` `Array<{ serial: number; seconds: number }>` | 0 (UI:0, тест:0) | M01 (`director.ts`) | пак | да | Транзитное (очередь таймеров). Баннеры `{ serial, seconds }`, чьи таймеры заморожены до закрытия открытки/интро |
| F33 | L2230 | `durationRequest` | `public` `{ kind: 'camp' } \| { kind: 'action'; action...` | 1 (UI:1, тест:0) | M07 (`checks.ts`) | ядро | нет | Транзитное (`DurationModal`). Запрос подтверждения привала или длительного тикового действия |
| F34 | L2233–L2235 | `DURATION_TICK_EFFECTS` | `private static` `inferred` | 0 (UI:0, тест:0) | M07 (`checks.ts`) | ядро | нет | Статическая константа. `Set` типов эффектов (`change_need`, `change_hp`, `change_fatigue`, `change_sanity`), допустимых на каждом тике |
| F35 | L2437 | `luckOffer` | `public` `{ text: string; cost: number; decide: (rero...` | 3 (UI:1, тест:2) | M07 (`checks.ts`) | ядро | нет | Транзитное (диалог удачи). Активное предложение потратить очки удачи `{ text, cost, decide }` после броска d100 |
| F36 | L3746 | `FIRE_RULE_MAX_DEPTH` | `private static` `inferred` | 0 (UI:0, тест:0) | M13 (`effects.ts`) | ядро | нет | Статическая константа (`= 2`). Предел глубины вложенного рекурсивного вызова `fire_rule` из `applyEffect` |
| F37 | L4336 | `postCombatEffects` | `private` `Effect[]` | 0 (UI:0, тест:0) | M01 (`director.ts`) | пак | да | Транзитное (буфер боя). Эффекты, накопленные к исполнению сразу после расчёта исхода боя |
| F38 | L4709 | `metaState` | `private` `MetaStoreState \| null` | 0 (UI:0, тест:0) | M16 (`meta.ts`) | ядро | нет | Отдельный ключ `localStorage`. Кэш межигрового прогресса `MetaStoreState` кампании (валюты, достижения, анлоки) |
| F39 | L4834 | `unlockedThisRun` | `private` `string[]` | 0 (UI:0, тест:0) | M16 (`meta.ts`) | ядро | нет | Транзитное (итог забега). Список ID достижений, впервые полученных в ходе текущего забега |

### 3.2. Выводы по полям для фасада `GameEngine` и `EngineCtx` (`NAR-1.2`)

1. **`23` публичных поля читаются напрямую UI-компонентами (`src/player/*`, `src/editor/*`) и `33` smoke-скриптами** (лидеры: `state` — `78` файлов, `campaign` — `53`, `dialogue` — `33`, `combat` — `25`, `messages` — `15`, `rng` — `10`, `trade` — `5`, `postcard` — `5`). Переименовывать или убирать их с экземпляра `GameEngine` в миссии `NAR-1` нельзя.
2. **Ключевой приём для `NAR-1.2` (`export class GameEngine implements EngineCtx`):** если сам экземпляр `GameEngine` реализует интерфейс `EngineCtx` (либо хранит сгруппированные runtime-сумки `dialogueRuntime`, `directorRuntime`, `metaRuntime`, прокидывая наружу однострочные геттеры/поля), то:
   - вызовы вынесенных функций имеют минимальную форму `return world.goToScene(this, sceneId)` — **ровно 1 строка на метод** в фасаде `engine.ts` (`~420` строк на весь фасад при лимите `≤ 600` строк);
   - исключается рассинхронизация ссылок (`ctx.dialogue = ...`, `ctx.combat = ...`, `ctx.trade = ...`, `ctx.state = ...` мутируют непосредственно поля `GameEngine`, за которыми следит React через `subscribe`).
3. **Единственная внешняя утечка `private`-поля:** `src/editor/store.ts` обращается к `listeners` через обход типизации — в `NAR-1.2` подписка `listeners` штатно остаётся на фасаде `GameEngine` без поломки редактора.

### 3.3. Рекомендуемый эскиз `src/core/context.ts` для карточки `NAR-1.2`

```ts
// src/core/context.ts — Tier 0 (не импортирует ни один модуль подсистем src/core/*.ts)
export interface EngineCtx {
  // Базовые данные и состояние сессии
  campaign: CampaignData
  state: GameState
  rng: PRNG
  debugInvincible: boolean
  freshRun: boolean
  envelope: SaveEnvelope | null

  // Публичные UI-проекции экранов и оверлеев (читаются src/player/* и смоками)
  dialogue: DialogueUI | null
  dialogueHistory: DialogueHistoryEntry[]
  dialogueTimer: { seconds: number; knot?: string } | null
  lastDialogueError: string | null
  combat: CombatController | null
  trade: NpcDef | null
  craftRequest: { recipe?: string } | null
  craftSourceEntity: ItemDef | null
  toasts: { id: number; text: string; kind: 'get' | 'lose' | 'info' }[]
  messages: { text: string; portrait?: string }[]
  cutsceneQueue: Array<{ def: CutsceneDef; serial: number }>
  banners: Array<{ serial: number; text: string; preset?: string; enter?: string; seconds?: number; position?: string; accent?: string }>
  postcard: { image?: string; art?: ArtDoc; text?: string; preset?: string; seconds?: number; camera?: CameraDoc } | null
  durationRequest: { kind: 'camp' } | { kind: 'action'; action: DurationActionDef } | null
  luckOffer: { text: string; cost: number; decide: (reroll: boolean) => void } | null

  // Уведомления фасада и шина правил/переходов (разрывают все обратные связи M01..M16)
  notify(): void
  pushLog(text: string): void
  pushToast(text: string, kind?: 'get' | 'lose' | 'info'): void
  autosave(): void
  checkRules(): void
  applyEffect(effect: Effect, depth?: number): void
  applyEffects(effects: Effect[] | undefined, depth?: number): void
  fireRule(ruleId: string, depth?: number): void
  tryFireRule(rule: RuleDef, depth?: number): boolean
  fireTrigger(trigger: string, targetId?: string): void
  runLocationRules(): void
  startDialogue(npcOrDialogueId: string, knot?: string): void
  endDialogue(): void
  startCombat(encounterId: string): void
  gameOver(endingText: string, endingId?: string): void
}
```

---

## 4. Группы будущих модулей, баланс `5146` строк и ацикличность графа

### 4.1. Сводная таблица групп и будущих модулей (`81 + 5018 + 47 = 5146`)

Разбиение ниже покрывает **каждую строку `src/core/engine.ts` с `L1` по `L5146` без единого пропуска и пересечения**, ни один из `297` AST-методов не разрезан границей сегмента, а **каждый из `16` выносимых модулей (`M01`–`M16`) укладывается в `61..379` строк** (запас `71..389` строк до инварианта `≤ 450` строк на модуль).

| Код | Целевой файл | Слой | Карточка | Capabilities (`caps.json`) | Публ. (253) | Внутр. (44) | Диапазоны строк в `engine.ts` | Строк |
|---|---|---|---|---|---:|---:|---|---:|
| **HEAD** | `src/core/engine.ts (шапка)` | — | `NAR-1.2..1.8` | `—` | 0 | 0 | L1–L81 | **81** |
| **F0** | `src/core/engine.ts` | фасад | `NAR-1.2..1.8` | `core/facade` | 21 | 2 | L82–L216, L224–L279, L312–L353, L4601–L4697, L5046–L5099 | **384** |
| **M01** | `src/core/director.ts` | пак | `NAR-1.3 / NAR-1.8` | `cutscenes, combat, scenes` | 12 | 2 | L280–L311, L404–L537, L4333–L4417 | **251** |
| **M02** | `src/core/needs.ts` | ядро | `NAR-1.5` | `core/time + needs` | 9 | 5 | L538–L894 | **357** |
| **M03** | `src/core/inventory.ts` | пак | `NAR-1.4` | `inventory` | 11 | 0 | L895–L1051 | **157** |
| **M04** | `src/core/equipment.ts` | пак | `NAR-1.4` | `equipment, inventory` | 17 | 0 | L1052–L1326 | **275** |
| **M05** | `src/core/social.ts` | пак | `NAR-1.6` | `social` | 28 | 1 | L1327–L1347, L1423–L1452, L1800–L1905, L2098–L2223, L3655–L3681 | **310** |
| **M06** | `src/core/character.ts` | пак | `NAR-1.6 / NAR-1.8` | `stats, charcreate` | 28 | 1 | L354–L403, L1740–L1799, L1906–L2097, L2641–L2690, L3714–L3730 | **369** |
| **M07** | `src/core/checks.ts` | ядро | `NAR-1.5 / NAR-1.7` | `core/checks + stats` | 14 | 6 | L1715–L1739, L2224–L2555, L3270–L3275 | **363** |
| **M08** | `src/core/quests.ts` | пак | `NAR-1.6` | `quests` | 3 | 1 | L1453–L1513 | **61** |
| **M09** | `src/core/party.ts` | пак | `NAR-1.6` | `party` | 12 | 0 | L1514–L1714 | **201** |
| **M10** | `src/core/economy.ts` | пак | `NAR-1.8` | `trade, craft` | 22 | 1 | L2691–L2734, L2889–L3172, L4093–L4130 | **366** |
| **M11** | `src/core/world.ts` | пак | `NAR-1.3` | `scenes` | 16 | 4 | L3231–L3269, L3276–L3561 | **325** |
| **M12** | `src/core/scene-slots.ts` | пак | `NAR-1.7` | `scenes, stats` | 19 | 0 | L1348–L1422, L3613–L3654, L3731–L3736, L4060–L4092, L4131–L4332 | **358** |
| **M13** | `src/core/effects.ts` | ядро | `NAR-1.7` | `core/rules-effects` | 6 | 2 | L3562–L3612, L3737–L4059, L4418–L4422 | **379** |
| **M14** | `src/core/dialogue-runtime.ts` | пак | `NAR-1.7 / NAR-1.8` | `dialogue` | 8 | 3 | L217–L223, L2735–L2888, L4423–L4600 | **339** |
| **M15** | `src/core/encounters.ts` | пак | `NAR-1.8` | `stealth, encounters, core/rng` | 12 | 9 | L2556–L2640, L3173–L3230, L3682–L3713, L4898–L5045 | **323** |
| **M16** | `src/core/meta.ts` | ядро | `NAR-1.8` | `core/meta` | 12 | 7 | L4698–L4897 | **200** |
| **EXP** | `src/core/engine.ts (экспорты)` | — | `NAR-1.8` | `core/saves` | 3 | 0 | L5100–L5146 | **47** |
| **СУММА** | **Шапка (`81`) + Группы `F0, M01..M16` (`5018`) + Экспорты (`47`)** | **ядро `1299` / пак `3335` / фасад `384`** | **`NAR-1.1`..`1.10`** | — | **253** | **44** | **`L1–L5146` (сплошное покрытие)** | **5146** |

#### Контрольная сверка сумм строк:

- **По формуле оракула карточки `NAR-1.1`:**
  - Шапка файла (`HEAD`, `L1–L81`): **`81`** строка
  - Сумма строк по группам будущих модулей (`F0` + `M01`..`M16`, `L82–L5099`): `384 + 251 + 357 + 157 + 275 + 310 + 369 + 363 + 61 + 201 + 366 + 325 + 358 + 379 + 339 + 323 + 200` = **`5018`** строк
  - Сумма тех же `5018` строк по архитектурным группам: **`ядро` = `1299`** (`M02: 357 + M07: 363 + M13: 379 + M16: 200`) + **`пак` = `3335`** + **`фасад` = `384`** = **`5018`** строк
  - Экспорты нижнего блока (`EXP`, `L5100–L5146`): **`47`** строк
  - **Итого:** **`81 + 5018 + 47 = 5146` строк** (`81 + 1299 + 3335 + 384 + 47 = 5146`).

### 4.2. Полная карта непрерывных сегментов `S01`–`S49` (`L1–L5146`)

| Сегмент | Начало | Конец | Строк | Группа | Целевой модуль | Содержимое сегмента |
|---|---:|---:|---:|---|---|---|
| `S01` | `L1` | `L81` | 81 | `HEAD` | `src/core/engine.ts (шапка)` | Импорты модулей `shared/*`, `core/*` и `export interface SlotOccupant` |
| `S02` | `L82` | `L216` | 135 | `F0` | `src/core/engine.ts` | Поля `GameEngine`, `inspectEntity`, музыка, тосты, `constructor`, `subscribe`/`notify`/`pushLog` |
| `S03` | `L217` | `L223` | 7 | `M14` | `src/core/dialogue-runtime.ts` | Подпись спикера реплики `dlgSpeakerLabel` |
| `S04` | `L224` | `L279` | 56 | `F0` | `src/core/engine.ts` | Сборка начального состояния забега `newState` |
| `S05` | `L280` | `L311` | 32 | `M01` | `src/core/director.ts` | Вводный нарративный экран сцены (`shouldShowNarrativeIntro`, `isSceneIntroActive`, `markNarrativeIntroSeen`) |
| `S06` | `L312` | `L353` | 42 | `F0` | `src/core/engine.ts` | Флаги (`setFlag`, `clearFlag`), алиас `inParty` и запуск новой игры `start` |
| `S07` | `L354` | `L403` | 50 | `M06` | `src/core/character.ts` | Применение выбора экрана создания персонажа `applyCharCreation` |
| `S08` | `L404` | `L537` | 134 | `M01` | `src/core/director.ts` | Катсцены (`cutscene*`, `playCutscene`, `endCutscene`), баннеры и полноэкранные «открытки» |
| `S09` | `L538` | `L894` | 357 | `M02` | `src/core/needs.ts` | Игровое время, ход тиков `advanceTicks`, шкалы потребностей, выживание и статусы |
| `S10` | `L895` | `L1051` | 157 | `M03` | `src/core/inventory.ts` | Инвентарь героя и износ/поломка/ремонт предметов |
| `S11` | `L1052` | `L1326` | 275 | `M04` | `src/core/equipment.ts` | Экипировка по слотам, расходуемые предметы, расчёт нагрузки и ступени перегруза |
| `S12` | `L1327` | `L1347` | 21 | `M05` | `src/core/social.ts` | Итоговое отношение NPC/фракции `getDisposition` |
| `S13` | `L1348` | `L1422` | 75 | `M12` | `src/core/scene-slots.ts` | Ключ состояния портрета, слои облика и боевая фигура героя (`heroPortrait*`, `heroCombatFigure`) |
| `S14` | `L1423` | `L1452` | 30 | `M05` | `src/core/social.ts` | Самочувствие NPC (`npcMood`, `changeNpcMood`) и сдвиг отношения `changeDisposition` |
| `S15` | `L1453` | `L1513` | 61 | `M08` | `src/core/quests.ts` | Квесты, активные/завершённые стадии, журнал и `checkQuestTransitions` |
| `S16` | `L1514` | `L1714` | 201 | `M09` | `src/core/party.ts` | Отряд напарников, их потребности и «вторая сумка» (`companion_carry`) |
| `S17` | `L1715` | `L1739` | 25 | `M07` | `src/core/checks.ts` | Пул удачи игрока (`luckMax`, `luck`, `changeLuck`) |
| `S18` | `L1740` | `L1799` | 60 | `M06` | `src/core/character.ts` | Производные пулы B6: усталость (`fatigue*`) и рассудок (`sanity*`) |
| `S19` | `L1800` | `L1905` | 106 | `M05` | `src/core/social.ts` | Социальные шкалы B6: репутация, достаток, страсти, причастность фракциям и `uiLabel` |
| `S20` | `L1906` | `L2097` | 192 | `M06` | `src/core/character.ts` | Базовые/эффективные навыки, тренировка статов, уровни и черты B8, режимы движения |
| `S21` | `L2098` | `L2223` | 126 | `M05` | `src/core/social.ts` | Опасности B7 (`applyFall`), преступления/штрафы, ценовые события и доступность лагеря |
| `S22` | `L2224` | `L2555` | 332 | `M07` | `src/core/checks.ts` | Длительные действия (`dz.20`), отдых в лагере, дожим удачи и проверки d100/противоборство |
| `S23` | `L2556` | `L2640` | 85 | `M15` | `src/core/encounters.ts` | Режим скрытности, проверка обнаружения `detectCheck` и внезапность атаки |
| `S24` | `L2641` | `L2690` | 50 | `M06` | `src/core/character.ts` | Отметка использованных навыков и броски роста при отдыхе (`markSkill`..`restAndGrow`) |
| `S25` | `L2691` | `L2734` | 44 | `M10` | `src/core/economy.ts` | Открытие и закрытие экранов торговли и верстака (`openTrade`..`closeCraft`) |
| `S26` | `L2735` | `L2888` | 154 | `M14` | `src/core/dialogue-runtime.ts` | Таймер выбора реплики диалога и предъявление предмета собеседнику |
| `S27` | `L2889` | `L3172` | 284 | `M10` | `src/core/economy.ts` | Валюта, модификаторы цен, покупка/продажа у торговца и крафт/ремонт на верстаке |
| `S28` | `L3173` | `L3230` | 58 | `M15` | `src/core/encounters.ts` | Случайные встречи на маршрутах (`rollEncounter`, `resolveEncounter`) |
| `S29` | `L3231` | `L3269` | 39 | `M11` | `src/core/world.ts` | Поиск локации/региона, текущая сцена и точка прибытия (`arrivalSceneOf`) |
| `S30` | `L3270` | `L3275` | 6 | `M07` | `src/core/checks.ts` | Геттер правил бросков кампании (`get diceRules`) |
| `S31` | `L3276` | `L3561` | 286 | `M11` | `src/core/world.ts` | Состояния сцен, расписания NPC в слотах и переходы по сценам/локациям (`goToScene`, `travelTo`) |
| `S32` | `L3562` | `L3612` | 51 | `M13` | `src/core/effects.ts` | Проверка условий правил, триггеры и условный запуск правил |
| `S33` | `L3613` | `L3654` | 42 | `M12` | `src/core/scene-slots.ts` | Механика «Незнакомец» (`isNpcNameKnown`, `npcLabel`, `learnNpcName`) и чтение описания `descOf` |
| `S34` | `L3655` | `L3681` | 27 | `M05` | `src/core/social.ts` | Суточный сдвиг самочувствия NPC по расписанию `tickNpcMood` |
| `S35` | `L3682` | `L3713` | 32 | `M15` | `src/core/encounters.ts` | Периодическая тиковая проверка погони `tickPursuit` |
| `S36` | `L3714` | `L3730` | 17 | `M06` | `src/core/character.ts` | Подготовка способностей в ячейки памяти `togglePreparedAbility` |
| `S37` | `L3731` | `L3736` | 6 | `M12` | `src/core/scene-slots.ts` | Динамическая подмена описания сущности `setEntityDescription` |
| `S38` | `L3737` | `L4059` | 323 | `M13` | `src/core/effects.ts` | Диспетчер эффектов `applyEffects` и `applyEffect` (с защитой глубины `FIRE_RULE_MAX_DEPTH = 2`) |
| `S39` | `L4060` | `L4092` | 33 | `M12` | `src/core/scene-slots.ts` | Применение предметов из сумки к слотам сцены (`slotUseOptions`, `useItemOnSlot`) |
| `S40` | `L4093` | `L4130` | 38 | `M10` | `src/core/economy.ts` | Изучение и фильтрация рецептов (`unlockRecipe`, `recipeKnown`, `knownRecipes`) |
| `S41` | `L4131` | `L4332` | 202 | `M12` | `src/core/scene-slots.ts` | Состояние сущности, кодекс, подстановка `fmt` и интерактивные предметы/слоты сцены |
| `S42` | `L4333` | `L4417` | 85 | `M01` | `src/core/director.ts` | Мост пошагового боя (`postCombatEffects`, `onCombatResolve`, `startCombat`, `endCombat`) |
| `S43` | `L4418` | `L4422` | 5 | `M13` | `src/core/effects.ts` | Безусловный вызов правила `fireRule` |
| `S44` | `L4423` | `L4600` | 178 | `M14` | `src/core/dialogue-runtime.ts` | Движок ink-диалогов: загрузка узлов, теги, выбор реплики и выход из диалога |
| `S45` | `L4601` | `L4697` | 97 | `F0` | `src/core/engine.ts` | Сброс модального сообщения и цикл забега (`gameOver`, `restart`, `newGamePlus*`) |
| `S46` | `L4698` | `L4897` | 200 | `M16` | `src/core/meta.ts` | Мета-прогресс между забегами: чтение/запись `localStorage`, достижения и покупки улучшений |
| `S47` | `L4898` | `L5045` | 148 | `M15` | `src/core/encounters.ts` | Таблицы случайных событий и детерминированные генераторы имён/значений B9 |
| `S48` | `L5046` | `L5099` | 54 | `F0` | `src/core/engine.ts` | Пресет сложности `difficultyDef`, `autosave`, `manualSave`, `saveSlotsCount` и закрытие класса |
| `S49` | `L5100` | `L5146` | 47 | `EXP` | `src/core/engine.ts (экспорты)` | Реэкспорты `savemigrate`/`types` и функции `loadSave`, `deleteSave`, `hasSave` |

### 4.3. Строгий топологический порядок модулей `src/core/*` (`0` циклов для `check:core-graph`)

Чтобы `check:core-graph` (`NAR-1.9`) гарантированно не имел ни одного цикла импортов, модули `src/core/*` выстраиваются в **строгую иерархию рангов `Tier 0` → `Tier 6`** (каждый модуль вправе импортировать только файлы **строго меньшего ранга**, а обратные события идут исключительно через колбэки на `ctx: EngineCtx`):

1. **`Tier 0` — фундамент без зависимостей от подсистем:**
   - существующие чистые утилиты: `prng.ts`, `dice.ts`, `brp.ts`, `time.ts`, `conditions.ts`, `savemigrate.ts`, `charcreate.ts`, `combat.ts`, `dialogue.ts`;
   - новый `src/core/context.ts` (`NAR-1.2`): интерфейс `EngineCtx` + три микро-утилиты чтения конфига (`getDiceRules(ctx)`, `itemTitle(ctx, id)`, `fmt(ctx, text)`), убирающие все паразитные обратные ссылки из нижних слоёв.
2. **`Tier 1` — листовые подсистемы состояния:** `M03` `inventory.ts` (ранг 1, 0 внешних вызовов подсистем), `M06` `character.ts` (ранг 2), `M16` `meta.ts` (ранг 3).
3. **`Tier 2` — экипировка, квесты, отряд и социум:** `M04` `equipment.ts` (ранг 4), `M08` `quests.ts` (ранг 5), `M09` `party.ts` (ранг 6), `M05` `social.ts` (ранг 7).
4. **`Tier 3` — тики, проверки и экономика:** `M02` `needs.ts` (ранг 8), `M07` `checks.ts` (ранг 9), `M15` `encounters.ts` (ранг 10).
5. **`Tier 4` — пространственно-сценовой и экономический слой:** `M11` `world.ts` (ранг 11), `M10` `economy.ts` (ранг 12), `M12` `scene-slots.ts` (ранг 13).
6. **`Tier 5` — экранные сессии и шина правил/эффектов:** `M14` `dialogue-runtime.ts` (ранг 14), `M01` `director.ts` (ранг 15), `M13` `effects.ts` (ранг 16 — верхний диспетчер `applyEffect`, напрямую знающий все подсистемы `M01`–`M16`).
7. **`Tier 6` — единая входная точка фасада:** `F0` `src/core/engine.ts` (ранг 17 — собирает `EngineCtx`, регистрирует колбэки шины правил `checkRules` / `applyEffects` / `fireRule` / `fireTrigger`, переходов `startDialogue` / `endDialogue` / `startCombat` / `gameOver` и делегирует публичные методы). **Ни один модуль `src/core/*` не импортирует `./engine` (кроме `import type` при необходимости, хотя с `context.ts` даже `import type` из `./engine` не нужен).**

---

## 5. Полная таблица всех `253` публичных методов `GameEngine` и экспортов

Ниже в порядке следования в `src/core/engine.ts` перечислены **все `253` публичные точки входа** (`246` публичных методов `GameEngine` + `4` публичных геттера `get ...` + `3` экспортируемые функции сохранений `loadSave`, `deleteSave`, `hasSave`).

| № | Строки | Метод | Будущий модуль | Группа | Зависит от нарратива | Назначение |
|---:|---|---|---|---|---|---|
| 1 | L127–L130 | `inspectEntity` | `src/core/engine.ts` (F0) | фасад | да | Устанавливает `inspectedEntityId` для панели инспектора/отладки и уведомляет UI |
| 2 | L135–L138 | `setMusicOverride` | `src/core/engine.ts` (F0) | фасад | нет | Задаёт явный музыкальный оверлей `musicOverride` (`tracks`, `fade`) поверх музыки сцены |
| 3 | L140–L144 | `clearMusicOverride` | `src/core/engine.ts` (F0) | фасад | нет | Снимает активный музыкальный оверлей `musicOverride` и оповещает подписчиков |
| 4 | L148–L157 | `pushToast` | `src/core/engine.ts` (F0) | фасад | нет | Добавляет транзитный тост (`get` / `lose` / `info`), пишет в лог, проигрывает UI-звук и ставит автогашение |
| 5 | L160–L165 | `dismissToast` | `src/core/engine.ts` (F0) | фасад | нет | Удаляет всплывающий тост по `id` из массива `toasts` и уведомляет UI |
| 6 | L203–L206 | `subscribe` | `src/core/engine.ts` (F0) | фасад | нет | Регистрирует слушателя изменений `listeners` и возвращает функцию отписки |
| 7 | L208–L210 | `notify` | `src/core/engine.ts` (F0) | фасад | нет | Оповещает всех подписчиков UI после изменения состояния движка |
| 8 | L212–L215 | `pushLog` | `src/core/engine.ts` (F0) | фасад | нет | Добавляет запись в журнал `state.log` (ограничивая хвост последними 100 строками) |
| 9 | L281–L286 | `shouldShowNarrativeIntro` | `src/core/director.ts` (M01) | пак | да | Проверяет наличие непросмотренного вводного текста `narrativeIntro` у текущей локации |
| 10 | L289–L293 | `isSceneIntroActive` | `src/core/director.ts` (M01) | пак | да | Возвращает `true`, пока игрок ещё не закрыл вступительный нарративный экран текущей локации |
| 11 | L296–L311 | `markNarrativeIntroSeen` | `src/core/director.ts` (M01) | пак | да | Отмечает вводный экран локации просмотренным, запускает отложенные баннеры и уведомляет UI |
| 12 | L314–L322 | `setFlag` | `src/core/engine.ts` (F0) | фасад | нет | Записывает значение флага в `state.flags[key]`, вызывает `checkRules()` и `notify()` |
| 13 | L325–L329 | `clearFlag` | `src/core/engine.ts` (F0) | фасад | нет | Удаляет флаг `key` из `state.flags`, вызывает `checkRules()` и `notify()` |
| 14 | L332–L334 | `inParty` | `src/core/engine.ts` (F0) | фасад | да | Короткий публичный алиас к `isInParty(npcId)` для проверок членства NPC в отряде |
| 15 | L337–L352 | `start` | `src/core/engine.ts` (F0) | фасад | да | Стартует забег: для `freshRun` применяет бонусы меты, исполняет правила входа в стартовую локацию и делает `autosave()` |
| 16 | L359–L402 | `applyCharCreation` | `src/core/character.ts` (M06) | пак | нет | Применяет выбор экрана создания героя (`CharChoice`: имя, пол, статы, навыки, стартовые предметы и черты) |
| 17 | L407–L409 | `get cutscene` *(getter)* | `src/core/director.ts` (M01) | пак | да | Геттер текущей проигрываемой катсцены `CutsceneDef \| null` из головы `cutsceneQueue` |
| 18 | L412–L414 | `get cutsceneKey` *(getter)* | `src/core/director.ts` (M01) | пак | да | Геттер уникального `serial`-ключа активной катсцены для перемонтирования `CutscenePlayer` |
| 19 | L461–L476 | `showPostcard` | `src/core/director.ts` (M01) | пак | да | Открывает полноэкранную сюжетную «открытку» (`image`/`art`, `camera`, `text`) с автотаймером закрытия |
| 20 | L479–L489 | `hidePostcard` | `src/core/director.ts` (M01) | пак | да | Закрывает активную «открытку», сбрасывает таймер и запускает отложенные баннеры |
| 21 | L507–L515 | `playCutscene` | `src/core/director.ts` (M01) | пак | да | Ставит катсцену `CutsceneDef` в очередь `cutsceneQueue` (с проверкой `once` по `seenCutscenes`) |
| 22 | L518–L536 | `endCutscene` | `src/core/director.ts` (M01) | пак | да | Снимает завершённую катсцену из головы `cutsceneQueue`, проверяет правила и уведомляет UI |
| 23 | L563–L636 | `advanceTicks` | `src/core/needs.ts` (M02) | ядро | да | Продвигает время на `ticks`: крутит потребности, перегруз, порчу еды, статусы, погоню, таблицы событий, настроение NPC и правила |
| 24 | L741–L756 | `changeNeed` | `src/core/needs.ts` (M02) | пак | нет | Изменяет шкалу потребности героя (и синхронно спутников отряда) с зажимом `0..max` и проверкой краёв |
| 25 | L758–L763 | `changeHp` | `src/core/needs.ts` (M02) | ядро | нет | Изменяет `player.hp` в пределах `0..maxHp` (учитывая `debugInvincible`) |
| 26 | L787–L829 | `restHeal` | `src/core/needs.ts` (M02) | пак | нет | Восстанавливает HP, MP, усталость и удачу героя при сне/отдыхе пропорционально часам и качеству привала |
| 27 | L834–L836 | `statusDef` | `src/core/needs.ts` (M02) | ядро | нет | Находит определение статуса `StatusDef` в каталоге кампании по `id` |
| 28 | L839–L841 | `hasStatus` | `src/core/needs.ts` (M02) | ядро | нет | Проверяет наличие активного временного статуса `id` на герое |
| 29 | L847–L869 | `applyStatus` | `src/core/needs.ts` (M02) | ядро | нет | Накладывает или обновляет временный статус `id`, учитывая иммунитеты черт и применяя `onApply` |
| 30 | L872–L882 | `removeStatus` | `src/core/needs.ts` (M02) | ядро | нет | Снимает активный статус `id` с героя и уведомляет UI |
| 31 | L885–L893 | `statusSkillMod` | `src/core/needs.ts` (M02) | ядро | нет | Суммирует поправку всех активных статусов к навыку `skillId` |
| 32 | L897–L899 | `hasItem` | `src/core/inventory.ts` (M03) | пак | нет | Проверяет наличие хотя бы `minQty` экземпляров предмета `id` в инвентаре героя |
| 33 | L901–L905 | `itemCount` | `src/core/inventory.ts` (M03) | пак | нет | Возвращает точное количество экземпляров предмета `id` в инвентаре |
| 34 | L907–L929 | `addItem` | `src/core/inventory.ts` (M03) | пак | нет | Добавляет `qty` экземпляров предмета в инвентарь, инициализирует прочность и показывает тост получения |
| 35 | L931–L966 | `removeItem` | `src/core/inventory.ts` (M03) | пак | нет | Удаляет до `qty` предметов из инвентаря, чистит массив прочности и снимает предмет со слота экипировки при остатке `0` |
| 36 | L971–L975 | `itemMaxDurability` | `src/core/inventory.ts` (M03) | пак | нет | Возвращает максимальную прочность предмета `ItemDef` (или `null`, если предмет не изнашивается) |
| 37 | L978–L984 | `itemDurabilityOf` | `src/core/inventory.ts` (M03) | пак | нет | Возвращает текущую прочность лучшего/первого экземпляра предмета `id` у героя |
| 38 | L987–L991 | `isItemUsable` | `src/core/inventory.ts` (M03) | пак | нет | Проверяет, пригоден ли предмет к использованию в бою/экипировке (не сломан до `0`) |
| 39 | L994–L1001 | `durabilityEntries` | `src/core/inventory.ts` (M03) | пак | нет | Возвращает массив значений прочности всех индивидуальных экземпляров предмета `id` |
| 40 | L1008–L1024 | `damageItemDurability` | `src/core/inventory.ts` (M03) | пак | нет | Уменьшает прочность экземпляра предмета `id` на `loss`, логируя поломку при падении до `0` |
| 41 | L1030–L1043 | `repairItem` | `src/core/inventory.ts` (M03) | пак | нет | Восстанавливает прочность повреждённого экземпляра предмета `id` на `gain` единиц |
| 42 | L1046–L1050 | `hasDamaged` | `src/core/inventory.ts` (M03) | пак | нет | Проверяет, есть ли в инвентаре хотя бы один не полностью целый экземпляр предмета `id` |
| 43 | L1055–L1057 | `equipmentSlots` | `src/core/equipment.ts` (M04) | пак | нет | Возвращает список доступных слотов экипировки кампании (`equipmentSlots(campaign)`) |
| 44 | L1059–L1061 | `slotLabel` | `src/core/equipment.ts` (M04) | пак | нет | Возвращает локализованное название слота экипировки `slotId` |
| 45 | L1064–L1071 | `itemSlot` | `src/core/equipment.ts` (M04) | пак | нет | Определяет целевой слот экипировки для предмета `ItemDef` (или `null`, если предмет не надевается) |
| 46 | L1074–L1076 | `isEquipped` | `src/core/equipment.ts` (M04) | пак | нет | Проверяет, надет ли предмет `itemId` в какой-либо слот экипировки героя |
| 47 | L1079–L1083 | `equippedSlotOf` | `src/core/equipment.ts` (M04) | пак | нет | Находит идентификатор слота экипировки, в котором сейчас надет предмет `itemId` |
| 48 | L1086–L1098 | `equipItem` | `src/core/equipment.ts` (M04) | пак | нет | Надевает исправный предмет `itemId` из инвентаря в соответствующий слот экипировки |
| 49 | L1101–L1112 | `unequipItem` | `src/core/equipment.ts` (M04) | пак | нет | Снимает предмет из слота экипировки `slotId` |
| 50 | L1115–L1127 | `playerWeapon` | `src/core/equipment.ts` (M04) | пак | нет | Возвращает боевые параметры активного оружия героя `WeaponData` (либо безоружный удар при поломке/пустом слоте) |
| 51 | L1130–L1147 | `playerArmor` | `src/core/equipment.ts` (M04) | пак | нет | Суммирует броню всех надетых исправных элементов доспеха и бонус защиты от черт |
| 52 | L1149–L1158 | `useItem` | `src/core/equipment.ts` (M04) | пак | да | Применяет расходуемый предмет из сумки: списывает 1 шт., запускает `effects`, форматирует текст через `fmt` и вызывает `checkRules()` |
| 53 | L1162–L1169 | `currentLoad` | `src/core/equipment.ts` (M04) | пак | нет | Вычисляет суммарный вес всех предметов, переносимых лично героем |
| 54 | L1175–L1226 | `maxLoadDetails` | `src/core/equipment.ts` (M04) | пак | нет | Строит детальную разбивку грузоподъёмности (база, характеристики, надетые сумки/контейнеры, черты, статусы) |
| 55 | L1228–L1230 | `maxLoad` | `src/core/equipment.ts` (M04) | пак | нет | Возвращает итоговый предел носимого веса героя из `maxLoadDetails().total` |
| 56 | L1239–L1253 | `encumbranceStatus` | `src/core/equipment.ts` (M04) | пак | нет | Определяет ступень загруженности героя (`normal` / `heavy` / `overloaded` / `immobilized`) по отношению веса к `maxLoad` |
| 57 | L1255–L1312 | `encumbranceDebuffs` | `src/core/equipment.ts` (M04) | пак | нет | Вычисляет пакет штрафов перегруза (множитель времени пути, штраф навыков, расход усталости, запрет перехода) |
| 58 | L1314–L1316 | `isOverloaded` | `src/core/equipment.ts` (M04) | пак | нет | Проверяет, превышает ли текущий вес порог начала штрафов перегруза |
| 59 | L1321–L1325 | `isTravelBlockedByOverload` | `src/core/equipment.ts` (M04) | пак | нет | Проверяет, блокирует ли критический перегруз путешествия между локациями |
| 60 | L1335–L1345 | `getDisposition` | `src/core/social.ts` (M05) | пак | да | Считает итоговое отношение NPC к герою (`база + личный сдвиг + вклад фракций + настроение NPC`) |
| 61 | L1354–L1360 | `heroPortraitStateKey` | `src/core/scene-slots.ts` (M12) | пак | да | Определяет ключ визуального состояния портрета героя (`injured`, `exhausted` и т.п.) по порогам HP/потребностей |
| 62 | L1368–L1392 | `heroPortraitImages` | `src/core/scene-slots.ts` (M12) | пак | да | Собирает упорядоченный массив слоёв портрета героя (база + состояние + видимая экипировка) |
| 63 | L1395–L1422 | `heroCombatFigure` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает список слоёв боевой фигуры героя для рендера на поле пошагового боя |
| 64 | L1424–L1426 | `npcMood` | `src/core/social.ts` (M05) | пак | да | Возвращает текущий числовой сдвиг настроения NPC (`npcMood[npcId]`) |
| 65 | L1429–L1432 | `changeNpcMood` | `src/core/social.ts` (M05) | пак | да | Сдвигает настроение NPC `npcId` на `delta` в пределах `-100..100` |
| 66 | L1434–L1451 | `changeDisposition` | `src/core/social.ts` (M05) | пак | да | Изменяет личное отношение NPC/фракции к герою с каскадом на связанные фракции и уведомлением в тостах |
| 67 | L1455–L1464 | `startQuest` | `src/core/quests.ts` (M08) | пак | да | Активирует квест на начальной стадии, пишет уведомление в журнал и применяет входные эффекты |
| 68 | L1466–L1485 | `advanceQuestTo` | `src/core/quests.ts` (M08) | пак | да | Переводит квест на стадию `stageId` (или завершает/проваливает его), выдаёт награды и запускает эффекты стадии |
| 69 | L1487–L1496 | `journalUpdate` | `src/core/quests.ts` (M08) | пак | да | Добавляет текстовую заметку в дневник/журнал игрока с тостом уведомления |
| 70 | L1516–L1537 | `joinParty` | `src/core/party.ts` (M09) | пак | да | Добавляет NPC в отряд `state.party` (с проверкой лимита группы и инициализацией потребностей/сумки спутника) |
| 71 | L1542–L1548 | `companionNeed` | `src/core/party.ts` (M09) | пак | да | Возвращает текущее значение личной шкалы потребности спутника `npcId` |
| 72 | L1551–L1562 | `changeCompanionNeed` | `src/core/party.ts` (M09) | пак | да | Сдвигает шкалу потребности спутника `npcId` в границах `0..max` |
| 73 | L1565–L1569 | `companionNeedDefs` | `src/core/party.ts` (M09) | пак | да | Возвращает список определений потребностей `NeedDef[]`, отслеживаемых у спутников отряда |
| 74 | L1574–L1582 | `companionLoad` | `src/core/party.ts` (M09) | пак | да | Считает суммарный вес предметов, сложенных во «вторую сумку» спутника `npcId` |
| 75 | L1586–L1598 | `companionCapacity` | `src/core/party.ts` (M09) | пак | да | Вычисляет максимальную грузоподъёмность «второй сумки» спутника `npcId` |
| 76 | L1605–L1624 | `giveItemToCompanion` | `src/core/party.ts` (M09) | пак | да | Передаёт `qty` предметов из инвентаря героя в сумку спутника с проверкой его лимита веса |
| 77 | L1627–L1643 | `takeItemFromCompanion` | `src/core/party.ts` (M09) | пак | да | Забирает `qty` предметов из сумки спутника обратно в инвентарь героя |
| 78 | L1646–L1654 | `equipCompanionItem` | `src/core/party.ts` (M09) | пак | да | Экипирует или снимает предмет в слоте снаряжения спутника `npcId` |
| 79 | L1659–L1685 | `useItemOnCompanion` | `src/core/party.ts` (M09) | пак | да | Расходует предмет из сумки героя на спутника `npcId`, применяя лечение/потребности к спутнику |
| 80 | L1690–L1709 | `leaveParty` | `src/core/party.ts` (M09) | пак | да | Исключает NPC из отряда и переносит все переносимые им вещи обратно в сумку героя |
| 81 | L1711–L1713 | `isInParty` | `src/core/party.ts` (M09) | пак | да | Проверяет, состоит ли NPC `npcId` сейчас в `state.party` |
| 82 | L1718–L1723 | `luckMax` | `src/core/checks.ts` (M07) | ядро | нет | Вычисляет верхний предел пула удачи героя по формуле кампании |
| 83 | L1726–L1729 | `luck` | `src/core/checks.ts` (M07) | ядро | нет | Возвращает текущее количество очков удачи героя |
| 84 | L1732–L1738 | `changeLuck` | `src/core/checks.ts` (M07) | ядро | нет | Изменяет запас удачи героя на `delta` в пределах `0..luckMax` |
| 85 | L1743–L1748 | `fatigueMax` | `src/core/character.ts` (M06) | пак | нет | Вычисляет максимум пула усталости героя (`CON + SIZ` либо база кампании) |
| 86 | L1751–L1754 | `fatigue` | `src/core/character.ts` (M06) | пак | нет | Возвращает текущее накопленное значение усталости героя |
| 87 | L1757–L1772 | `changeFatigue` | `src/core/character.ts` (M06) | пак | нет | Сдвигает усталость героя на `delta`, накладывает эффекты обморока/истощения и вызывает `checkRules()` |
| 88 | L1775–L1780 | `sanityMax` | `src/core/character.ts` (M06) | пак | нет | Вычисляет потолок рассудка героя (`POW × 5` минус мифос/ограничения кампании) |
| 89 | L1783–L1786 | `sanity` | `src/core/character.ts` (M06) | пак | нет | Возвращает текущее значение рассудка героя |
| 90 | L1789–L1799 | `changeSanity` | `src/core/character.ts` (M06) | пак | нет | Изменяет рассудок героя на `delta` в пределах `0..sanityMax` и запускает `checkRules()` |
| 91 | L1802–L1804 | `reputation` | `src/core/social.ts` (M05) | пак | да | Возвращает значение репутации героя на шкале `trackId` |
| 92 | L1808–L1810 | `uiLabel` | `src/core/social.ts` (M05) | пак | да | Возвращает переопределённую в кампании подпись термина UI (`uiLabels[key] ?? fallback`) |
| 93 | L1812–L1814 | `reputationEnabled` | `src/core/social.ts` (M05) | пак | да | Проверяет, включена ли в кампании подсистема шкал репутации |
| 94 | L1816–L1819 | `reputationLabel` | `src/core/social.ts` (M05) | пак | да | Возвращает название шкалы репутации `trackId` |
| 95 | L1821–L1828 | `changeReputation` | `src/core/social.ts` (M05) | пак | да | Изменяет репутацию на шкале `trackId`, показывает тост и запускает `checkRules()` |
| 96 | L1831–L1833 | `wealthLevels` | `src/core/social.ts` (M05) | пак | да | Возвращает таблицу уровней достатка/благосостояния кампании |
| 97 | L1836–L1839 | `wealthLevel` | `src/core/social.ts` (M05) | пак | да | Возвращает текущий индекс уровня достатка героя |
| 98 | L1841–L1843 | `wealthLevelLabel` | `src/core/social.ts` (M05) | пак | да | Возвращает словесное звание текущего уровня достатка героя |
| 99 | L1846–L1855 | `changeWealth` | `src/core/social.ts` (M05) | пак | да | Сдвигает уровень достатка героя на `delta` ступеней и проверяет правила |
| 100 | L1858–L1860 | `passion` | `src/core/social.ts` (M05) | пак | да | Возвращает процентное значение страсти/убеждения героя `passionId` |
| 101 | L1862–L1864 | `passionLabel` | `src/core/social.ts` (M05) | пак | да | Возвращает отображаемое имя страсти `passionId` |
| 102 | L1867–L1877 | `changePassion` | `src/core/social.ts` (M05) | пак | да | Изменяет страсть `passionId` на `delta`, логирует сдвиг и проверяет правила |
| 103 | L1880–L1882 | `allegiance` | `src/core/social.ts` (M05) | пак | да | Возвращает очки причастности/служения высшей силе или ордену `id` |
| 104 | L1884–L1886 | `allegianceLabel` | `src/core/social.ts` (M05) | пак | да | Возвращает название силы/ордена `id` из настроек кампании |
| 105 | L1889–L1900 | `changeAllegiance` | `src/core/social.ts` (M05) | пак | да | Изменяет очки причастности силе `id`, обновляет статус адепта и проверяет правила |
| 106 | L1907–L1921 | `skillBaseChance` | `src/core/character.ts` (M06) | пак | нет | Вычисляет базовый процент навыка `SkillDef` по формуле характеристик героя |
| 107 | L1927–L1930 | `skillEffective` | `src/core/character.ts` (M06) | пак | нет | Возвращает эффективное значение навыка `skillId` с учётом базы, прокачки, черт, экипировки, статусов и усталости |
| 108 | L1936–L1962 | `trainStat` | `src/core/character.ts` (M06) | пак | нет | Повышает характеристику `stat` при обучении/тренировке с пересчётом производных HP/MP |
| 109 | L1965–L1967 | `statLabel` | `src/core/character.ts` (M06) | пак | нет | Возвращает локализованное имя характеристики `stat` из схемы кампании |
| 110 | L1972–L1974 | `progressionEnabled` | `src/core/character.ts` (M06) | пак | нет | Проверяет, включена ли в кампании уровневая прогрессия и система черт B8 |
| 111 | L1977–L1979 | `level` | `src/core/character.ts` (M06) | пак | нет | Возвращает текущий уровень героя (`player.level ?? 1`) |
| 112 | L1982–L1984 | `xp` | `src/core/character.ts` (M06) | пак | нет | Возвращает накопленный опыт `player.xp` |
| 113 | L1987–L1991 | `xpForLevel` | `src/core/character.ts` (M06) | пак | нет | Вычисляет суммарный опыт, необходимый для достижения уровня `lvl` |
| 114 | L1994–L1999 | `xpToNext` | `src/core/character.ts` (M06) | пак | нет | Возвращает количество опыта, необходимое для перехода на следующий уровень (или `null` на капе) |
| 115 | L2002–L2006 | `pendingFeats` | `src/core/character.ts` (M06) | пак | нет | Возвращает число нераспределённых выборов черт `featPoints` |
| 116 | L2009–L2027 | `grantXp` | `src/core/character.ts` (M06) | пак | нет | Начисляет `amount` опыта, повышает уровень при достижении порога, выдаёт очки черт и вызывает `checkRules()` |
| 117 | L2030–L2034 | `availableFeats` | `src/core/character.ts` (M06) | пак | нет | Возвращает список всех ещё не взятых черт `FeatDef[]` кампании |
| 118 | L2037–L2040 | `featEligible` | `src/core/character.ts` (M06) | пак | нет | Проверяет выполнение всех условий доступа к черте `FeatDef` (уровень, статы, навыки, флаги) |
| 119 | L2043–L2051 | `takeFeat` | `src/core/character.ts` (M06) | пак | нет | Тратит 1 очко `pendingFeats`, изучает черту `featId` и применяет её бонусы |
| 120 | L2054–L2062 | `grantFeat` | `src/core/character.ts` (M06) | пак | нет | Выдаёт черту `featId` вне очереди уровней (например, за сюжетный выбор или мету) |
| 121 | L2089–L2096 | `playerMovement` | `src/core/character.ts` (M06) | пак | нет | Вычисляет скорость движения героя с учётом расы/базы, ловкости, черт и перегруза |
| 122 | L2105–L2132 | `applyFall` | `src/core/social.ts` (M05) | пак | нет | Рассчитывает урон и травму при падении с высоты с проверкой спасброска `SkillCheck` |
| 123 | L2135–L2137 | `crimeLabel` | `src/core/social.ts` (M05) | пак | да | Возвращает локализованное название вида правонарушения `kind` |
| 124 | L2140–L2151 | `commitCrime` | `src/core/social.ts` (M05) | пак | да | Регистрирует преступление в регионе, увеличивает `bounty`, портит репутацию и проверяет правила |
| 125 | L2154–L2160 | `hasCrime` | `src/core/social.ts` (M05) | пак | да | Проверяет наличие непогашенных преступлений у героя (в регионе или вообще) |
| 126 | L2163–L2165 | `bountyTotal` | `src/core/social.ts` (M05) | пак | да | Суммирует активный розыск/штраф `bounty` (по региону или по всем регионам) |
| 127 | L2168–L2171 | `priceEventsActive` | `src/core/social.ts` (M05) | пак | да | Возвращает список активных региональных ценовых событий рынка |
| 128 | L2174–L2191 | `setPriceEvent` | `src/core/social.ts` (M05) | пак | да | Включает или снимает рыночное ценовое событие `id` (с длительностью в тиках) и проверяет правила |
| 129 | L2194–L2205 | `priceEventMultiplier` | `src/core/social.ts` (M05) | пак | да | Считает итоговый рыночный множитель цены для предмета `ItemDef` от активных ценовых событий |
| 130 | L2208–L2215 | `campAvailable` | `src/core/social.ts` (M05) | пак | да | Определяет, разрешено ли разбить лагерь в текущей локации (`campAllowed` / небезопасная зона) |
| 131 | L2300–L2336 | `durationRequestInfo` | `src/core/checks.ts` (M07) | ядро | нет | Собирает предпросмотр стоимости тиков, расхода потребностей и рисков для модального окна `DurationModal` |
| 132 | L2338–L2342 | `cancelDurationRequest` | `src/core/checks.ts` (M07) | ядро | нет | Закрывает модальное окно подтверждения длительного действия/привала без расхода времени |
| 133 | L2345–L2351 | `confirmDurationRequest` | `src/core/checks.ts` (M07) | ядро | нет | Подтверждает запрос в `DurationModal` и запускает `campRest()` либо `runDurationAction()` |
| 134 | L2354–L2359 | `requestCampRest` | `src/core/checks.ts` (M07) | пак | да | Открывает диалог подтверждения привала в лагере (если `campAvailable()` истинно) |
| 135 | L2367–L2381 | `requestDurationAction` | `src/core/checks.ts` (M07) | ядро | нет | Открывает `DurationModal` для длительного действия `actionId` или исполняет его сразу без подтверждения |
| 136 | L2384–L2401 | `runDurationAction` | `src/core/checks.ts` (M07) | ядро | нет | Прокручивает все тики длительного действия `DurationActionDef` и по завершении исполняет финальные эффекты |
| 137 | L2403–L2431 | `campRest` | `src/core/checks.ts` (M07) | пак | да | Выполняет привал в лагере: прокручивает тики сна, вызывает `restHeal()`, `restAndGrow()` и ночные правила |
| 138 | L2440–L2445 | `resolveLuckOffer` | `src/core/checks.ts` (M07) | ядро | нет | Принимает решение игрока в `luckOffer` (потратить очки удачи на переброс/дожим или принять провал) |
| 139 | L2448–L2454 | `statCheck` | `src/core/checks.ts` (M07) | ядро | нет | Выполняет процентную BRP-проверку характеристики (`stat × mult`) на `this.rng` |
| 140 | L2530–L2554 | `opposedCheck` | `src/core/checks.ts` (M07) | ядро | нет | Проводит встречную проверку навыка героя против навыка оппонента по ступеням успеха BRP |
| 141 | L2559–L2561 | `stealthEnabled` | `src/core/encounters.ts` (M15) | пак | нет | Проверяет, включена ли в кампании механика скрытности (`featureOn(campaign, 'stealth')`) |
| 142 | L2564–L2566 | `isSneaking` | `src/core/encounters.ts` (M15) | пак | нет | Возвращает `true`, если у героя сейчас активен режим скрытности |
| 143 | L2569–L2571 | `isDetected` | `src/core/encounters.ts` (M15) | пак | да | Возвращает `true`, если герой раскрыт наблюдателями в текущей сцене/локации |
| 144 | L2574–L2576 | `playerSkill` | `src/core/encounters.ts` (M15) | пак | нет | Возвращает итоговый процент навыка героя для проверок (`skillEffective + statusSkillMod − перегруз`) |
| 145 | L2583–L2599 | `toggleSneak` | `src/core/encounters.ts` (M15) | пак | нет | Переключает режим скрытности героя (с проверкой запретов) и уведомляет UI |
| 146 | L2606–L2632 | `detectCheck` | `src/core/encounters.ts` (M15) | пак | да | Проводит проверку скрытности героя против бдительности NPC, находящихся в слотах текущей сцены |
| 147 | L2635–L2639 | `consumeSurpriseFromSneak` | `src/core/encounters.ts` (M15) | пак | да | Списывает состояние нераскрытой скрытности и возвращает флаг внезапного первого хода при начале боя |
| 148 | L2643–L2646 | `markSkill` | `src/core/character.ts` (M06) | пак | нет | Отмечает навык `skillId` галочкой практического опыта для роста при следующем отдыхе |
| 149 | L2649–L2662 | `playerSkillCheck` | `src/core/character.ts` (M06) | пак | нет | Выполняет d100-проверку навыка `skillId`, при успехе автоматически вызывая `markSkill` |
| 150 | L2666–L2668 | `skillLabel` | `src/core/character.ts` (M06) | пак | нет | Возвращает отображаемое название навыка `skillId` (кампании или встроенного справочника) |
| 151 | L2670–L2689 | `restAndGrow` | `src/core/character.ts` (M06) | пак | нет | Разыгрывает броски повышения всех отмеченных навыков при отдыхе, пишет приросты в лог и чистит галочки |
| 152 | L2693–L2701 | `openTrade` | `src/core/economy.ts` (M10) | пак | да | Открывает панель торговли `trade` с выбранным NPC-торговцем `traderId` |
| 153 | L2703–L2707 | `closeTrade` | `src/core/economy.ts` (M10) | пак | да | Закрывает активное окно торговли `trade` и уведомляет UI |
| 154 | L2715–L2726 | `openCraft` | `src/core/economy.ts` (M10) | пак | да | Открывает окно ремесла `craftRequest` (привязывая `craftSourceEntity` верстака и подсвечивая рецепт) |
| 155 | L2728–L2733 | `closeCraft` | `src/core/economy.ts` (M10) | пак | да | Сбрасывает `craftRequest` и `craftSourceEntity`, закрывая окно ремесла |
| 156 | L2743–L2746 | `setDialogueTimer` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Регистрирует из ink-функции отложенный дедлайн `pendingDialogueTimer` на ближайший выбор реплик |
| 157 | L2760–L2806 | `dialogueTimeout` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Обрабатывает истечение таймера реплики: прыгает на узел `knot` либо завершает разговор молчанием |
| 158 | L2814–L2816 | `promptPresentItem` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Регистрирует из ink-функции запрос предъявления предмета `pendingDialoguePresenting` |
| 159 | L2829–L2887 | `submitPresentedItem` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Обрабатывает предъявленный собеседнику предмет `itemId`, переходя на ветку `ok`, `itemReactions` или `fail` |
| 160 | L2890–L2895 | `priceModifier` | `src/core/economy.ts` (M10) | пак | да | Вычисляет торговый коэффициент цен у `npc` по отношению `getDisposition` и навыку торговли героя |
| 161 | L2898–L2900 | `get mainCurrency` *(getter)* | `src/core/economy.ts` (M10) | пак | нет | Геттер основной валюты кампании (`CurrencyDef \| undefined`) |
| 162 | L2903–L2906 | `currencyItemId` | `src/core/economy.ts` (M10) | пак | нет | Определяет `itemId` физического предмета-монеты для указанной или основной валюты |
| 163 | L2909–L2911 | `currencyAmount` | `src/core/economy.ts` (M10) | пак | нет | Возвращает текущий запас денег героя в указанной валюте (через `itemCount` предмета-монеты) |
| 164 | L2913–L2919 | `buyPrice` | `src/core/economy.ts` (M10) | пак | да | Вычисляет цену покупки единицы товара у `npc` с учётом наценки торговца, отношения и `priceEvents` |
| 165 | L2921–L2928 | `sellPrice` | `src/core/economy.ts` (M10) | пак | да | Вычисляет цену скупки единицы товара торговцем `npc` с учётом износа и рыночных модификаторов |
| 166 | L2931–L2941 | `traderSells` | `src/core/economy.ts` (M10) | пак | да | Возвращает список товаров, выставленных на продажу у NPC-торговца с положительным остатком на складе |
| 167 | L2944–L2956 | `traderItemStock` | `src/core/economy.ts` (M10) | пак | да | Возвращает текущий товарный остаток `itemId` у торговца (учитывая дельты `traderStock` в `state`) |
| 168 | L2958–L2983 | `buyItem` | `src/core/economy.ts` (M10) | пак | да | Покупает товар у `this.trade`: списывает валюту, уменьшает склад торговца, выдаёт предмет и качает навык торговли |
| 169 | L2985–L3027 | `sellItem` | `src/core/economy.ts` (M10) | пак | да | Продаёт предмет торговцу `this.trade`: списывает предмет (начиная с целых/поношенных), пополняет склад и выдаёт валюту |
| 170 | L3037–L3039 | `allRecipes` | `src/core/economy.ts` (M10) | пак | нет | Возвращает полный список рецептов крафта `RecipeDef[]` кампании |
| 171 | L3042–L3094 | `isWorkbenchAvailable` | `src/core/economy.ts` (M10) | пак | да | Проверяет наличие требуемого верстака/источника огня в инвентаре, экипировке, у спутника или в слотах сцены |
| 172 | L3097–L3108 | `workbenchLabel` | `src/core/economy.ts` (M10) | пак | нет | Возвращает человекочитаемое название тега/предмета верстака для UI ремесла |
| 173 | L3111–L3129 | `recipeMissing` | `src/core/economy.ts` (M10) | пак | нет | Возвращает список недостающих ингредиентов, инструментов, навыка или верстака для рецепта `RecipeDef` |
| 174 | L3136–L3171 | `craft` | `src/core/economy.ts` (M10) | пак | нет | Исполняет рецепт `recipeId`: проверяет ресурсы и бросок навыка, списывает компоненты, чинит/создаёт предмет и тратит тики |
| 175 | L3233–L3243 | `allRegions` | `src/core/world.ts` (M11) | пак | да | Возвращает список всех регионов мира кампании `RegionDef[]` |
| 176 | L3245–L3247 | `findRegion` | `src/core/world.ts` (M11) | пак | да | Находит регион `RegionDef`, содержащий указанную локацию или совпадающий по `id` |
| 177 | L3249–L3255 | `findLocation` | `src/core/world.ts` (M11) | пак | да | Находит определение локации `LocationDef` по `id` во всех регионах мира |
| 178 | L3257–L3259 | `currentScene` | `src/core/world.ts` (M11) | пак | да | Возвращает объект текущей сцены `SceneDef` по `state.currentSceneId` |
| 179 | L3265–L3269 | `arrivalSceneOf` | `src/core/world.ts` (M11) | пак | да | Выбирает входную сцену локации (`arrivalScene` с условиями либо первую сцену локации) |
| 180 | L3272–L3274 | `get diceRules` *(getter)* | `src/core/checks.ts` (M07) | ядро | нет | Геттер правил градации бросков d100 кампании (`campaign.diceRules ?? DEFAULT_DICE_RULES`) |
| 181 | L3277–L3289 | `activeSceneState` | `src/core/world.ts` (M11) | пак | да | Возвращает активный визуально-звуковой пресет состояния сцены `SceneStateDef` по флагам/условиям |
| 182 | L3291–L3302 | `changeSceneState` | `src/core/world.ts` (M11) | пак | да | Переключает явное состояние сцены `sceneStates[sceneId]` и уведомляет UI |
| 183 | L3304–L3309 | `goToSceneFromDialogue` | `src/core/world.ts` (M11) | пак | да | Закрывает текущий диалог и переводит героя в сцену `sceneId` без двойного уведомления |
| 184 | L3311–L3320 | `startCombatFromDialogue` | `src/core/world.ts` (M11) | пак | да | Закрывает активный диалог и немедленно запускает бой `startCombat` |
| 185 | L3344–L3398 | `slotOccupants` | `src/core/world.ts` (M11) | пак | да | Вычисляет фактическое заполнение всех слотов сцены `SlotOccupant[]` с учётом расписаний, оверлеев, отряда и состояния |
| 186 | L3401–L3422 | `goToScene` | `src/core/world.ts` (M11) | пак | да | Переводит героя в сцену `sceneId`: крутит тики шага, проверяет обнаружение, триггеры входа и `checkRules()` |
| 187 | L3428–L3462 | `navigate` | `src/core/world.ts` (M11) | пак | да | Обрабатывает клик по навигационной зоне `NavigationZone`: сцена, путешествие, диалог или запуск правила |
| 188 | L3465–L3508 | `travelTo` | `src/core/world.ts` (M11) | пак | да | Выполняет переход между локациями карты: проверяет перегруз, крутит тики пути, встречу на дороге и вход в локацию |
| 189 | L3518–L3522 | `visibleLocations` | `src/core/world.ts` (M11) | пак | да | Возвращает список видимых на карте мира локаций региона (открытых или помеченных `alwaysVisible`) |
| 190 | L3527–L3551 | `travelCost` | `src/core/world.ts` (M11) | пак | да | Рассчитывает итоговую длительность маршрута `TravelConnection` в тиках с поправкой на перегруз и движение |
| 191 | L3556–L3560 | `travelBaseCost` | `src/core/world.ts` (M11) | пак | да | Возвращает базовую длительность связи `TravelConnection` между двумя локациями в тиках |
| 192 | L3573–L3580 | `checkRules` | `src/core/effects.ts` (M13) | ядро | нет | Прогоняет глобальные правила кампании и автопереходы квестов после изменений состояния |
| 193 | L3583–L3593 | `fireTrigger` | `src/core/effects.ts` (M13) | ядро | нет | Ищет и запускает все правила, подписанные на событие `trigger` с аргументом `targetId` |
| 194 | L3603–L3611 | `tryFireRule` | `src/core/effects.ts` (M13) | ядро | нет | Запускает правило `rule`, если соблюдены `once` и все условия `ruleConditionsOk` |
| 195 | L3616–L3621 | `isNpcNameKnown` | `src/core/scene-slots.ts` (M12) | пак | да | Проверяет, известно ли игроку настоящее имя NPC (`knownNpcs` либо флаг `nameHidden == false`) |
| 196 | L3624–L3630 | `npcLabel` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает отображаемое имя NPC: настоящее имя или заглушку незнакомца `unknownLabel` |
| 197 | L3633–L3645 | `learnNpcName` | `src/core/scene-slots.ts` (M12) | пак | да | Раскрывает настоящее имя NPC в `state.knownNpcs`, пишет тост знакомства и вызывает `checkRules()` |
| 198 | L3650–L3653 | `descOf` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает актуальное описание сущности (`state.descriptions[id] ?? entity.description`), отформатированное через `fmt` |
| 199 | L3715–L3729 | `togglePreparedAbility` | `src/core/character.ts` (M06) | пак | нет | Включает/снимает способность в ячейках подготовленных заклинаний/умений героя с проверкой лимита слотов |
| 200 | L3732–L3735 | `setEntityDescription` | `src/core/scene-slots.ts` (M12) | пак | да | Сохраняет динамическое описание сущности `state.descriptions[entityId]` |
| 201 | L3737–L3739 | `applyEffects` | `src/core/effects.ts` (M13) | ядро | да | Последовательно применяет массив `Effect[]` через `applyEffect` (сейчас включает ветки `narrative`-пака) |
| 202 | L3748–L4058 | `applyEffect` | `src/core/effects.ts` (M13) | ядро | да | Центральный `switch` по всем 50+ вариантам `Effect` (флаги, статы, предметы, квесты, сцены, диалоги, бой, мета) |
| 203 | L4065–L4073 | `slotUseOptions` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает доступные пары `(предмет из сумки, реакция SlotUseWith)` для применения к слоту сцены `slot` |
| 204 | L4076–L4091 | `useItemOnSlot` | `src/core/scene-slots.ts` (M12) | пак | да | Применяет выбранный предмет к слоту сцены: расходует предмет при `consume`, исполняет `effects` и `checkRules()` |
| 205 | L4097–L4109 | `unlockRecipe` | `src/core/economy.ts` (M10) | пак | нет | Добавляет `recipeId` в список изученных рецептов героя с уведомлением в тостах |
| 206 | L4112–L4122 | `recipeKnown` | `src/core/economy.ts` (M10) | пак | нет | Проверяет, открыт ли рецепт `RecipeDef` (доступен со старта либо изучен через `unlockedRecipes`) |
| 207 | L4125–L4129 | `knownRecipes` | `src/core/economy.ts` (M10) | пак | нет | Возвращает список всех доступных герою рецептов кампании (`allRecipes().filter(recipeKnown)`) |
| 208 | L4132–L4134 | `entityState` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает текущий ключ визуального/логического состояния сущности `state.entityStates[entityId]` |
| 209 | L4140–L4152 | `unlockCodex` | `src/core/scene-slots.ts` (M12) | пак | да | Открывает запись внутриигрового кодекса/бестиария `entryId` и показывает тост новой статьи |
| 210 | L4155–L4159 | `unlockedCodexEntries` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает все открытые игроком статьи кодекса `CodexEntryDef[]` (с опциональным фильтром по категории) |
| 211 | L4162–L4164 | `codexCategories` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает список категорий кодекса (встроенных и кастомных кампании) |
| 212 | L4176–L4210 | `fmt` | `src/core/scene-slots.ts` (M12) | пак | да | Подставляет в художественный текст плейсхолдеры героя `{hero.name}`, грамматический род, статы, флаги и предметы |
| 213 | L4212–L4214 | `itemInteractable` | `src/core/scene-slots.ts` (M12) | пак | да | Проверяет наличие у предмета `ItemDef` контекстных действий осмотра/чтения `interactions` |
| 214 | L4217–L4232 | `itemInteractOptions` | `src/core/scene-slots.ts` (M12) | пак | да | Возвращает отфильтрованные по условиям опции `ItemInteractOption[]` интерактивного предмета |
| 215 | L4235–L4264 | `runItemInteract` | `src/core/scene-slots.ts` (M12) | пак | да | Исполняет выбранное интерактивное действие предмета (сообщение, эффекты, расход предмета, запуск диалога/правила) |
| 216 | L4266–L4331 | `interactWithSlot` | `src/core/scene-slots.ts` (M12) | пак | да | Обрабатывает основное взаимодействие со слотом сцены: подбор предмета, старт диалога с NPC, осмотр или эффекты слота |
| 217 | L4344–L4349 | `onCombatResolve` | `src/core/director.ts` (M01) | пак | да | Применяет отложенные `postCombatEffects` сразу после расчёта исхода боя до закрытия экрана |
| 218 | L4351–L4374 | `startCombat` | `src/core/director.ts` (M01) | пак | да | Инициализирует `CombatController` для столкновения: собирает бойцов, отряд, бонус внезапности и стартовые эффекты |
| 219 | L4377–L4416 | `endCombat` | `src/core/director.ts` (M01) | пак | да | Закрывает `CombatController`, синхронизирует HP/расходники/износ брони с `GameState`, крутит тик и проверяет `gameOver` |
| 220 | L4419–L4421 | `fireRule` | `src/core/effects.ts` (M13) | ядро | нет | Безусловно запускает эффекты правила `ruleId` по идентификатору |
| 221 | L4430–L4451 | `resolveDialogueSource` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Находит скомпилированный ink-JSON и стартовый `knot` для разговора с NPC или автономного диалога |
| 222 | L4453–L4534 | `startDialogue` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Создаёт/восстанавливает `inkjs.Story`, привязывает внешние функции `bindExternals`, прогоняет текст до первого выбора и открывает `dialogue` |
| 223 | L4536–L4587 | `chooseDialogueOption` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Передаёт выбранный индекс реплики в `activeStory`, пишет реплику в `dialogueHistory`, собирает следующий кадр или закрывает диалог |
| 224 | L4589–L4600 | `endDialogue` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Завершает активный разговор, сбрасывает `dialogue`/`activeStory`/таймер и вызывает `checkRules()` |
| 225 | L4602–L4606 | `dismissMessage` | `src/core/engine.ts` (F0) | фасад | нет | Удаляет верхнее всплывающее окно из очереди `messages` и выпускает отложенные баннеры |
| 226 | L4610–L4634 | `gameOver` | `src/core/engine.ts` (F0) | фасад | да | Переводит забег в состояние поражения/концовки: закрывает диалог/бой, сохраняет концовку и начисляет итоги меты |
| 227 | L4637–L4646 | `restart` | `src/core/engine.ts` (F0) | фасад | да | Пересоздаёт чистый `GameState` нового забега, переинициализирует PRNG и вызывает `start()` |
| 228 | L4649–L4651 | `newGamePlusAvailable` | `src/core/engine.ts` (F0) | фасад | нет | Проверяет, включён ли режим NG+ в кампании и завершён ли хотя бы один победный забег |
| 229 | L4658–L4696 | `newGamePlus` | `src/core/engine.ts` (F0) | фасад | да | Запускает новый забег NG+, перенося разрешённые кампанией предметы, навыки, статы и флаги из завершённой игры |
| 230 | L4701–L4703 | `metaProgressEnabled` | `src/core/meta.ts` (M16) | ядро | нет | Проверяет, активна ли в кампании система мета-прогресса между забегами |
| 231 | L4716–L4727 | `metaStore` | `src/core/meta.ts` (M16) | ядро | нет | Лениво читает и кэширует `MetaStoreState` кампании из `localStorage` |
| 232 | L4737–L4739 | `metaCurrency` | `src/core/meta.ts` (M16) | ядро | нет | Возвращает баланс указанной мета-валюты в `MetaStoreState` |
| 233 | L4742–L4751 | `grantMetaCurrency` | `src/core/meta.ts` (M16) | ядро | нет | Изменяет баланс мета-валюты на `delta`, сохраняет `MetaStoreState` и уведомляет UI |
| 234 | L4754–L4756 | `metaAchievementDone` | `src/core/meta.ts` (M16) | ядро | нет | Проверяет, открыто ли уже достижение `id` в мета-профиле кампании |
| 235 | L4764–L4773 | `metaCounter` | `src/core/meta.ts` (M16) | ядро | нет | Возвращает значение накопительного мета-счётчика (забеги, победы, концовки) |
| 236 | L4784–L4795 | `achievementStates` | `src/core/meta.ts` (M16) | ядро | нет | Возвращает список всех достижений кампании со статусом открытия и текущим прогрессом счётчиков |
| 237 | L4808–L4831 | `checkAchievements` | `src/core/meta.ts` (M16) | ядро | да | Проверяет условия всех неоткрытых достижений кампании, выдаёт награды меты/XP и показывает тосты |
| 238 | L4835–L4841 | `achievementsUnlockedThisRun` | `src/core/meta.ts` (M16) | ядро | нет | Возвращает определения `AchievementDef[]` всех достижений, полученных в текущем забеге |
| 239 | L4874–L4876 | `metaUnlockOwned` | `src/core/meta.ts` (M16) | ядро | нет | Проверяет, приобретено ли постоянное улучшение `unlockId` в магазине меты |
| 240 | L4879–L4883 | `metaUnlockAffordable` | `src/core/meta.ts` (M16) | ядро | нет | Проверяет достаточность мета-валюты и условия открытия для покупки `MetaUnlockDef` |
| 241 | L4886–L4896 | `buyMetaUnlock` | `src/core/meta.ts` (M16) | ядро | нет | Списывает цену в мета-валюте, открывает постоянное улучшение `unlockId` и сохраняет `MetaStoreState` |
| 242 | L4901–L4904 | `generatorsEnabled` | `src/core/encounters.ts` (M15) | ядро | нет | Проверяет, включены ли в кампании процедурные таблицы событий и генераторы B9 |
| 243 | L4907–L4909 | `eventTableDef` | `src/core/encounters.ts` (M15) | ядро | нет | Возвращает определение таблицы случайных событий `EventTableDef` по `id` |
| 244 | L4925–L4943 | `rollEventTable` | `src/core/encounters.ts` (M15) | ядро | нет | Выбирает взвешенную запись из таблицы `tableId` с проверкой `when`/`once` и исполняет её эффекты/правило |
| 245 | L4957–L4968 | `genPickWeighted` | `src/core/encounters.ts` (M15) | ядро | нет | Детерминированно выбирает один элемент из взвешенного массива `GenWeightedItem[]` |
| 246 | L4986–L5004 | `genValue` | `src/core/encounters.ts` (M15) | ядро | нет | Генерирует детерминированное имя/шаблон/значение по генератору `genId` (с опциональным `seedKey`) |
| 247 | L5054–L5070 | `difficultyDef` | `src/core/engine.ts` (F0) | фасад | нет | Возвращает активный пресет сложности `DifficultyPreset` текущего забега |
| 248 | L5072–L5077 | `autosave` | `src/core/engine.ts` (F0) | фасад | нет | Записывает автосохранение в слот `auto` (если режим сохранений сложности это разрешает) |
| 249 | L5084–L5092 | `manualSave` | `src/core/engine.ts` (F0) | фасад | нет | Записывает ручное сохранение в слот `slot` с учётом ограничений `saveMode` сложности |
| 250 | L5095–L5097 | `saveSlotsCount` | `src/core/engine.ts` (F0) | фасад | нет | Возвращает число доступных ручных слотов сохранения для активной сложности |
| 251 | L5129–L5131 | `loadSave` *(export fn)* | `src/core/engine.ts (экспорты)` (EXP) | фасад | нет | Функция верхнего уровня: загружает и мигрирует автосохранение кампании `loadState(campaignId)` |
| 252 | L5133–L5135 | `deleteSave` *(export fn)* | `src/core/engine.ts (экспорты)` (EXP) | фасад | нет | Функция верхнего уровня: удаляет сохранение кампании через `removeSave(campaignId)` |
| 253 | L5142–L5146 | `hasSave` *(export fn)* | `src/core/engine.ts (экспорты)` (EXP) | фасад | нет | Функция верхнего уровня: проверяет наличие валидного сохранения кампании `inspectSave(...).verdict === 'ok'` |

---

## 6. Приложение: `constructor` и `43` приватных метода `GameEngine` (`P01`–`P44`)

Эти `44` метода не входят в число `253` публичных точек входа из §5, но занимают значительную долю тела `GameEngine` (включая `newState`, `runTicksFlow`, `applyByCheck`, `rollEncounter`, `resolveEncounter`, `tickNpcMood`, `tickPursuit`, `metaRunStart`, `seedRand`). При распиле в `NAR-1.3`–`NAR-1.8` **все `43` приватных метода уезжают внутрь своих целевых модулей как модульные функции и не требуют однострочных обёрток на фасаде `GameEngine`**, что экономит `~50` строк бюджета фасада `engine.ts` (`≤ 600` строк).

| Код | Строки | Внутренний метод | Вид | Будущий модуль | Группа | Зависит от нарратива | Назначение |
|---|---|---|---|---|---|---|---|
| P01 | L182–L199 | `constructor` | `constructor` | `src/core/engine.ts` (F0) | фасад | да | Создаёт `GameEngine`: принимает `campaign`, поднимает сейв (мигрируя валюту/экипировку) либо `newState()` и `PRNG` |
| P02 | L218–L222 | `dlgSpeakerLabel` | `private` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Определяет отображаемое имя говорящего в диалоге с учётом механики «Незнакомец» (`npcLabel`) |
| P03 | L226–L278 | `newState` | `private` | `src/core/engine.ts` (F0) | фасад | да | Собирает чистый `GameState` нового забега: статы, навыки, стартовая локация/сцена, инвентарь, пулы B6–B8 |
| P04 | L443–L459 | `showBanner` | `private` | `src/core/director.ts` (M01) | пак | да | Показывает экранный баннер (или откладывает его таймер, пока активна открытка либо интро локации) |
| P05 | L491–L505 | `flushPendingBannersIfClear` | `private` | `src/core/director.ts` (M01) | пак | да | Запускает таймеры автоскрытия отложенных баннеров, когда экран освободился от открытки и интро |
| P06 | L545–L561 | `needCondOk` | `private` | `src/core/needs.ts` (M02) | пак | нет | Проверяет условие модификатора расхода потребности (экипировка, наличие предмета, флаг) |
| P07 | L639–L676 | `tickPerishableItems` | `private` | `src/core/needs.ts` (M02) | пак | да | Списывает срок годности скоропортящихся предметов в сумке, заменяет испорченное и стреляет правило порчи |
| P08 | L679–L728 | `tickStatuses` | `private` | `src/core/needs.ts` (M02) | ядро | нет | Прокручивает активные статусы на `ticks` тиков, применяя периодические дельты и снимая истёкшие |
| P09 | L730–L739 | `onNeedZero` | `private` | `src/core/needs.ts` (M02) | пак | да | Обрабатывает падение шкалы потребности до `0` или `max`: запускает эффекты порога `zeroEffects` / `fullEffects` |
| P10 | L770–L780 | `tryBrpSurvival` | `private` | `src/core/needs.ts` (M02) | пак | нет | Делает процентный бросок выносливости `CON` при истощении, возвращая смягчение периодического урона |
| P11 | L1499–L1512 | `checkQuestTransitions` | `private` | `src/core/quests.ts` (M08) | пак | да | Автоматически продвигает активные квесты по условиям `autoNext` их текущих стадий |
| P12 | L2065–L2086 | `applyFeat` | `private` | `src/core/character.ts` (M06) | пак | нет | Применяет бонусы черты (`stats`, `skills`, `maxHp`, `abilities`) к `state.player` и вызывает `checkRules()` |
| P13 | L2237–L2249 | `applyTickEffects` | `private` | `src/core/checks.ts` (M07) | ядро | нет | Применяет разрешённые по-тиковые эффекты (`DURATION_TICK_EFFECTS`) одного тика длительного действия |
| P14 | L2258–L2290 | `runTicksFlow` | `private` | `src/core/checks.ts` (M07) | ядро | нет | Пошагово прокручивает тики длительного действия/отдыха, останавливаясь при срабатывании `interrupt`-правила |
| P15 | L2292–L2297 | `interruptTicksFlow` | `private` | `src/core/checks.ts` (M07) | ядро | нет | Обрабатывает прерывание потока тиков: стреляет правило прерывания и выводит сообщение игроку |
| P16 | L2461–L2492 | `applyByCheck` | `private` | `src/core/checks.ts` (M07) | ядро | нет | Разыгрывает проверку характеристики/навыка, при возможности открывает `luckOffer`, иначе применяет ветку исхода |
| P17 | L2495–L2499 | `playerCheckOutcome` | `private` | `src/core/checks.ts` (M07) | ядро | нет | Вычисляет подробный `SkillCheckOutcome` броска характеристики или навыка игрока с модификатором сложности |
| P18 | L2506–L2524 | `augmentBonus` | `private` | `src/core/checks.ts` (M07) | пак | да | Считает бонус усиления проверки (`augment`) от вспомогательного навыка или страсти героя |
| P19 | L2753–L2757 | `commitDialogueTimer` | `private` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Переносит `pendingDialogueTimer` в активный `dialogueTimer` при рендере набора реплик |
| P20 | L2818–L2824 | `commitDialoguePresenting` | `private` | `src/core/dialogue-runtime.ts` (M14) | пак | да | Активирует режим выбора предмета из сумки в `dialogue.presenting` на текущем узле |
| P21 | L3032–L3034 | `itemTitle` | `private` | `src/core/economy.ts` (M10) | пак | нет | Возвращает название сущности/предмета `entities[id]?.title ?? id` |
| P22 | L3175–L3194 | `rollEncounter` | `private` | `src/core/encounters.ts` (M15) | пак | да | Проверяет вероятность случайной встречи на маршруте путешествия и выбирает подходящую `EncounterEntry` |
| P23 | L3196–L3229 | `resolveEncounter` | `private` | `src/core/encounters.ts` (M15) | пак | да | Разрешает случайную встречу на дороге (проверка навыка откупа/побега, эффекты, старт боя или диалога) |
| P24 | L3323–L3328 | `activePresenceOverride` | `private` | `src/core/world.ts` (M11) | пак | да | Находит первое сработавшее по условиям правило переопределения позиции NPC (`PresenceOverride`) |
| P25 | L3335–L3337 | `npcHasSchedule` | `private` | `src/core/world.ts` (M11) | пак | да | Проверяет, задано ли у NPC суточное расписание перемещения по слотам сцен |
| P26 | L3339–L3341 | `npcHasPresenceOverrides` | `private` | `src/core/world.ts` (M11) | пак | да | Проверяет наличие у NPC условных сюжетных оверлеев присутствия `presenceOverrides` |
| P27 | L3510–L3515 | `onEnterLocation` | `private` | `src/core/world.ts` (M11) | пак | да | Отмечает локацию открытой (`visitedLocations`), запускает локационные правила и триггер `enter_location` |
| P28 | L3564–L3570 | `runLocationRules` | `private` | `src/core/effects.ts` (M13) | пак | да | Исполняет условные правила, привязанные к текущей локации `LocationDef.rules` |
| P29 | L3596–L3601 | `ruleConditionsOk` | `private` | `src/core/effects.ts` (M13) | ядро | нет | Проверяет не-пустой массив условий `RuleDef.when` с учётом флага однократности `once` |
| P30 | L3660–L3680 | `tickNpcMood` | `private` | `src/core/social.ts` (M05) | пак | да | Плавно возвращает самочувствие всех NPC `npcMood` к `0` с течением игровых часов |
| P31 | L3683–L3712 | `tickPursuit` | `private` | `src/core/encounters.ts` (M15) | пак | да | На тиках времени продвигает активные погони, проверяя навык ухода от преследования и запуская эффекты поимки/ухода |
| P32 | L4705–L4707 | `metaKey` | `private static` | `src/core/meta.ts` (M16) | ядро | нет | Возвращает ключ `localStorage` для мета-хранилища кампании (`narthex:meta:<id>`) |
| P33 | L4711–L4713 | `blankMetaState` | `private static` | `src/core/meta.ts` (M16) | ядро | нет | Создаёт пустой объект `MetaStoreState` для новой кампании |
| P34 | L4729–L4734 | `saveMetaStore` | `private` | `src/core/meta.ts` (M16) | ядро | нет | Записывает текущий кэш `metaState` кампании в `localStorage` |
| P35 | L4776–L4781 | `rememberEnding` | `private` | `src/core/meta.ts` (M16) | ядро | нет | Регистрирует открытую концовку `endingId` в `MetaStoreState` |
| P36 | L4797–L4802 | `achievementCounter` | `private` | `src/core/meta.ts` (M16) | ядро | да | Вычисляет текущее числовое значение отслеживаемой метрики достижения (уровень, богатство, квесты, локации, отряд) |
| P37 | L4844–L4854 | `finalizeRunMeta` | `private` | `src/core/meta.ts` (M16) | ядро | нет | Инкрементирует счётчики завершённых/победных забегов в `MetaStoreState` при финале игры |
| P38 | L4857–L4871 | `metaRunStart` | `private` | `src/core/meta.ts` (M16) | ядро | нет | Применяет бонусы всех купленных постоянных улучшений `MetaUnlockDef` на старте нового забега |
| P39 | L4912–L4917 | `eventTableActive` | `private` | `src/core/encounters.ts` (M15) | ядро | да | Проверяет активность периодической таблицы событий в текущей локации/регионе и по условиям `when` |
| P40 | L4946–L4954 | `tickEventTables` | `private` | `src/core/encounters.ts` (M15) | ядро | да | Прокручивает таймеры всех активных периодических таблиц событий на тиках времени |
| P41 | L4971–L4979 | `genDef` | `private` | `src/core/encounters.ts` (M15) | ядро | нет | Находит определение процедурного генератора `NpcGeneratorDef` по `id` |
| P42 | L5007–L5020 | `seedRand` | `private` | `src/core/encounters.ts` (M15) | ядро | нет | Создаёт детерминированный `PRNG` из строкового ключа `seedKey` и зерна забега `state.seed` |
| P43 | L5023–L5034 | `composeGenName` | `private` | `src/core/encounters.ts` (M15) | ядро | нет | Собирает составное имя из слоговых/словных пулов генератора `NpcGeneratorDef` |
| P44 | L5037–L5044 | `expandGenTemplate` | `private` | `src/core/encounters.ts` (M15) | ядро | нет | Разворачивает строковый шаблон генератора `{pool}` случайными выборами из пулов |

---

## 7. Принятые архитектурные решения в зоне свободы (`[РЕШЕНИЕ]`)

```text
[РЕШЕНИЕ] Разделить секции инвентаря/износа/экипировки/перегруза (L895–L1326, 432 строки) на два модуля: inventory.ts (157 строк) и equipment.ts (275 строк)
Почему: карточка NAR-1.4 требует одновременно (а) ≤ 450 строк в каждом новом модуле и (б) сокращения engine.ts минимум на 400 строк. Один общий файл с импортами превысит 450 строк (~465), а пара inventory.ts + equipment.ts даёт 157 и 275 строк (с большим запасом под импорты) и сокращает engine.ts более чем на 400 строк.
Альтернативы: (1) оставить один inventory.ts впритык к 450 за счёт сжатия форматирования; (2) вынести перегруз в needs.ts (увеличило бы needs.ts выше 450 строк).
Риск: минимальный — equipment.ts зависит от inventory.ts строго в одну сторону (Tier 2 -> Tier 1).
```

```text
[РЕШЕНИЕ] Выделить 16 выносимых модулей (M01..M16, от 61 до 379 строк) + тонкий фасад engine.ts (F0, 384 строки базы; ≤ 600 строк с однострочными делегатами)
Почему: совпадает с целевым ориентиром docs/platform.md §12 («16 модулей, тонкий фасад, без циклов»), даёт каждому модулю запас 71..389 строк под шапку импортов и позволяет переносить все 43 private-хелпера без обёрток на фасаде.
Альтернативы: более крупная нарезка на 7 файлов ровно по числу карточек NAR-1.3..1.8 (приводит к нарушению инварианта ≤ 450 строк в NAR-1.4, NAR-1.6, NAR-1.7 и NAR-1.8 — каждой из этих карточек следует создавать по 2–3 небольших модуля из таблицы §4.1).
Риск: если в фасаде engine.ts оставлять пустые строки между каждым из 250 делегатов, файл выйдет за 600 строк — делегаты в engine.ts нужно оформлять компактными однострочниками по группам.
```

```text
[РЕШЕНИЕ] Разрывать обратные связи нижних подсистем с шиной правил/экранов через EngineCtx (GameEngine implements EngineCtx) и строгие ранги Tier 0..Tier 6
Почему: AST-анализ показал 78 межмодульных рёбер вызовов внутри GameEngine, из которых 50 идут строго сверху вниз, а остальные обращаются к общей шине правил (checkRules/applyEffects/fireRule) и переключению экранов (startDialogue/endDialogue/startCombat). Передача этих хуков через EngineCtx даёт 0 циклов импортов между файлами src/core/*.
Альтернативы: взаимные импорты между world.ts, effects.ts, needs.ts и dialogue-runtime.ts (сломают будущий гейт check:core-graph в NAR-1.9).
Риск: нет; паттерн полностью совместим с переходом к реестру PackModule в NAR-2.
```
