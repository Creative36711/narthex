# STAB-1.6 · Подключение обязательных операций narrative

Дата: 2026-10-30
База: `22231ba71c34e69df5b0833d244baeec49a184a3` (`STAB-1.3`, #168).
Закреплённая Arena-ветка: `arena/37ebafdc-narthex`.

## Что изменено

Обязательные реализации уже находились в `packs/narrative/operations.ts` и
подключённых к нему модулях. Пробел был в entry points: потребитель
`packs/narrative/hooks.ts` или публичного `packs/narrative/index.ts` мог не
выполнить side-effect регистрацию и получить `PACK_OPERATION_MISSING`.

Добавлены только два подключения существующего идемпотентного регистратора:

```text
_tools/reports/STAB-1.6.md | 165 +++
packs/narrative/hooks.ts   |   2 ++
packs/narrative/index.ts   |   2 ++
3 files changed, 169 insertions(+)
```

Реализации операций, сценарии, saves, core, `src/core/turn`, adventure и
публичный набор экспортов barrel не менялись. Пустые fallback-значения и
подавление `PACK_OPERATION_MISSING` не добавлялись. Существующее
`initialStateFields → { quests: {} }` — прежняя реальная инициализация состояния,
а не новая подмена отсутствующей операции.

## Было / стало по перечню STAB-1.3

«Direct only» означает: регистрация происходила только при явном импорте
`packs/narrative/operations.ts`. «Hooks + barrel» означает: тот же набор теперь
подключается также через оба публичных entry point; обработчик не скопирован и
не заменён.

| Операция | Реализация | Было | Стало |
|---|---|---|---|
| `initialStateFields` | `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `initialRunStats` | `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `initializeRuntime` | `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `checkQuestTransitions` | `quests.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `gameOver` | `roguelike.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `tickNpcMood` | `social.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `tickPursuit` | `encounters.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `tickEventTables` | `encounters.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `playCutscene` | `director.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `heroPortraitImages` | `scene-slots.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `isNpcNameKnown` | `scene-slots.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `itemInteractOptions` | `scene-slots.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `travelCost` | `world.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `campAvailable` | `social.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `diceRules` | `world.ts` → `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `effect:start_dialogue` | `operations.ts` | direct only | hooks + barrel, прежний обработчик |
| `effect:fail_quest` | `operations.ts` | direct only | hooks + barrel, прежний обработчик |

Остальные строки перечня:

- `narrative.sim` уже возвращался из `createNarrativeHooks`; его чистая
  реализация не изменена;
- `effect:<type>` — необязательный override существующего core-эффекта, заглушка
  не нужна и не добавлена;
- generic `action` в `TurnExecutor` уже отклоняет неизвестный id через
  `TURN_INPUT_UNKNOWN`; `src/core/turn/index.ts` не потребовал изменений;
- adventure не получил чужих narrative-обработчиков: его composition root
  по-прежнему принимает narrative capability снаружи.

## Доказательство операций

Временный `/tmp/stab16/operation-probe.mts`, rc=0:

- через `createNarrativeHooks` зарегистрированы все 17/17 обязательных операций
  из таблицы, всего 129 narrative operations;
- настоящий `GameEngine` на `ash-of-caerden` создан без missing/pause;
- `quests={}`, прежний полный `stats_run`, dialogue/history/timer инициализированы;
- настоящий `gameOver` записал death/причину, host остался не paused.

Отдельный barrel probe: rc=0, side-effect регистрация работает без добавления
новых экспортов. Negative control в новом процессе без narrative:
`PACK_OPERATION_MISSING`, operation=`STAB_1_6_DEFINITELY_MISSING`, rc=0 для
пробы ожидаемого отказа. То есть отказ не глушится.

## Обязательные команды: было / стало

| Команда | База rc | После rc | Результат |
|---|---:|---:|---|
| `npm run smoke:core` | 1 | 1 | изолированный скрипт по-прежнему не импортирует пак: точный остаток `PACK_OPERATION_MISSING initialStateFields` |
| `npm run smoke:mission` | 1, 22/55 | 1, 22/55 | фактических переходов rc нет; см. ограничение ниже |
| `npm run check:core-graph` | 0 | 0 | 37 modules, acyclic, core не импортирует engine/packs |
| `npm run check:determinism` | 0 | 0 | 10/10 browser == cf-play; повторные hashes идентичны |
| `npm run lint` | 0 | 0 | 1515 warnings, **0 errors**; дельта ошибок 0 |
| `npm run check:module-size` | 1, 11 превышений | 1, те же 11 | новых превышений нет; hooks 16/450, index 12/450 |
| `npm run check:pack-boundary` | не запускался | 0 | 37 core files, нарушений нет |
| `npx tsc -b` | 2, 13 по STAB-1.3 | 2, те же 13 | новых diagnostics в изменённых файлах нет |
| operation/startup/gameOver probe | — | 0 | 17/17, настоящие handlers |
| barrel probe | — | 0 | подключение без смены exports |
| missing-operation negative control | — | 0 | ожидаемый `PACK_OPERATION_MISSING` сохранён |

### Почему npm mission не стал 38/55

Допущение: контрольные 38/55 в карточке не совпадают с воспроизведённой базой
`22231ba` — и независимый запуск, и отчёт STAB-1.3 дают 22/55.

`npm run smoke:core` и ещё 15 smoke создают голый `GameEngine` вообще без
импорта narrative. Код пака в таком процессе не исполняется и физически не может
зарегистрировать себя. Подключение этих composition roots находится в
`scripts/**` либо `src/core/**`, которые карточка запрещает менять. Я не стал
нарушать Scope, глушить отказ или подставлять пустые значения ради счётчика.

Дополнительная временная обёртка `.mts` сначала импортировала настоящий
`packs/narrative/operations.ts`, затем неизменённый smoke. Результат 14/16 rc=0:

- `smoke:currency`;
- `smoke:quest-journal-runtime`;
- `smoke:voice-dedup`;
- `smoke:hero-appearance`;
- `smoke:dialogue-transitions`;
- `smoke:dialogue-skip`;
- `smoke:stranger`;
- `smoke:encumbrance`;
- `smoke:cutscene-queue`;
- `smoke:spoil`;
- `smoke:time-semantics`;
- `smoke:core`;
- `smoke:duration-actions`;
- `smoke:craft-fail-time`.

Это доказывает работоспособность операций, но **не выдаётся за результат
`npm run smoke:mission`**. У двух оставшихся есть независимые отказы после
регистрации:

- `smoke:p2`: далее требует отсутствующий `src/core/dialogue.ts`, также есть
  прежняя проверка appearance state;
- `smoke:saves-compat`: далее остаётся одна проверка справки о saves/updates.

Следовательно даже вне-scope добавление imports в 16 скриптов дало бы на этой
базе 36/55, а не 38/55; два named residual тоже требуют отдельных владельцев.
Фактические 33 отказа npm mission после изменения: 16 с `initialStateFields`
(список выше + `p2`, `saves-compat`) и 17 прежних независимых:
`ink-import`, `design-doc`, `ai-runtime`, `ai-task`, `dialogues-r31`,
`dialogues-r32`, `breathe-toggle`, `narrative-intro`, `encounters-loader`,
`pack-missing`, `pack-panels`, `capability-modes`, `dlg-script`, `dlg-ui`,
`dialogue-speaker`, `narthex-closed`, `drive-gateway`.

## Pack probes

| Проба | База rc | После rc | Примечание |
|---|---:|---:|---|
| `probe:pack-move` | — | 0 | operations и negative control зелёные |
| `probe:pack-operations` | — | 0 | 129 operations, отказы работают |
| `probe:adventure` | — | 0 | passport зелёный |
| `probe:adventure-mechanics` | — | 0 | mechanics и cross-pack saves зелёные |
| `probe:narrative-pack` | 1 | 1 | одинаковый внешний cf-play остаток: 3 warnings не допускаются |
| `probe:pack-execution` | 1 | 1 | тот же cf-play check отказ на базе и после |
| `probe:capability-modes` | 1 | 1 | одинаковый `undefined != ready`, не связан с операциями |

Красные probes воспроизведены на отдельном неизменённом `git archive` базы;
их исправление требует чужих зон и не маскировалось.

## Неясно / решил / откат

- **Неясно:** как подключить операции без core/scripts и без смены их поведения.
- **Решил:** подключить существующий регистратор в narrative hooks и barrel;
  составной smoke использовать только как диагностику, не как подмену oracle.
- **Откат:** удалить два добавленных import; saves, данные и контракты не
  затрагиваются, откат тривиален.
