# STAB-1.3 · повторная сдача по уточнению Мастера

Dispatch: 4096f0cf-5705-8177-9a68-c6d2827020af
Run: 0c5c8f4f-823a-4540-ad5f-fa4e6878c054
База: `91c8729b0585b1e6d6704d799d3e3157254665b3`. Закреплённая ветка `arena/ad7fa2f7-narthex`.
Рабочее дерево до правок чистое, история общая с origin/main.

Этот отчёт заменяет выводы предыдущей сдачи #167. Полный набор проверок
не зелёный: ожидаемые отказы обязательных операций сохранены; есть также
внешний отказ check:decisions. Никакие проверки не ослаблены.

## Было / стало

| Пункт | База #167 | Эта сдача |
|---|---|---|
| CampaignData.ruleOrder/encounterOrder | optional string[] | сохранены без изменений |
| featureOn | реализация в types, реэкспорт из caps | одна реализация в caps, реэкспорт из types |
| флаги | registry + campaignCaps, приоритет caps | тот же контракт, поиск по Map как до #167 |
| startup | initialStateFields/initialRunStats → {} при отсутствии, initializeRuntime пропущен | все три обязательны; invoke и отказ не подавляются |
| tsc: core/shared diagnostics | 0 | 0 |
| tsc: остаток вне зоны | 13 | 13 |
| mission-smokes | 22/55 | 22/55, ни одного сменившего rc |
| прямой contracts-check | 1, расположение featureOn | 0, все 46 проверок |
| полная check:contracts | 1, featureOn | 1, внешний GOLD-1.6c.md status |
| core-graph / determinism / lint errors | 0 / 0 / 0 | 0 / 0 / 0 |
| module-size | 11 превышений | те же 11; types.ts меньше, новых превышений нет |

Д-1: optional поля не переписывались. Д-5: перенос только реализации и
реэкспорта, валидация неизвестного id/статусов/форматов и дефолты сохранены.
Убрана взаимная runtime-связь types → caps → types: caps больше не
реэкспортирует функцию из types. Д-6: все три предыдущие подстановки убраны.
В PackOperationHost.call/invoke/fail изменений нет, PACK_OPERATION_MISSING
по-прежнему приостанавливает host. В код не добавлены as any, ts-ignore,
ts-expect-error, eslint-disable, catch отсутствующих операций или пустые значения.

## Операции start/resolve — что обязательно

Все строки с паком narrative: владелец **Turn Runtime**, зона `packs/**`.
Файл регистрации/сборки операций — `packs/narrative/operations.ts`.
Операция обязательна на соответствующем пути, а не на каждом возможном ходе.
Подключение реального набора операций в composition root / смоуках передано
Turn Runtime; ядро не импортирует пак и не ветвится по его id.

| Операция | Путь | Статус для данного host | Файл реализации / регистрации | Что сделано |
|---|---|---|---|---|
| initialStateFields | newState | обязательная: инициализирует quests для потребителей | packs/narrative/operations.ts:75 | убрана подмена {}; missing не подавлен |
| initialRunStats | newState | обязательная: полный набор счётчиков, используются инкременты | packs/narrative/operations.ts:76 | убрана подмена {} |
| initializeRuntime | конструктор нового/загруженного GameEngine | обязательная: dialogue/history/timer | packs/narrative/operations.ts:83 | убран условный пропуск |
| checkQuestTransitions | start/checkRules, после изменения флагов/эффектов | обязательная | packs/narrative/quests.ts + operations.ts | без изменений, missing остаётся отказом |
| gameOver | resolve: HP/need до нуля | обязательная при данном исходе | packs/narrative/roguelike.ts + operations.ts | без изменений |
| tickNpcMood / tickPursuit | advanceTicks | обязательные при ходе времени | packs/narrative/social.ts / encounters.ts + operations.ts | без изменений |
| tickEventTables | advanceTicks | обязательная при ходе времени | packs/narrative/encounters.ts + operations.ts | без изменений |
| playCutscene | start/resolve эффекта катсцены | обязательная при запросе | packs/narrative/director.ts + operations.ts | без изменений |
| heroPortraitImages, isNpcNameKnown | проекция героя/NPC | обязательные при запросе | packs/narrative/scene-slots.ts + operations.ts | без изменений |
| itemInteractOptions | resolve взаимодействия | обязательная при запросе | packs/narrative/scene-slots.ts + operations.ts | без изменений |
| travelCost | resolve путешествия | обязательная при запросе | packs/narrative/world.ts + operations.ts | без изменений |
| campAvailable / diceRules | resolve отдыха/броска | обязательные при запросе | packs/narrative/social.ts / world.ts + operations.ts | без изменений |
| effect:<type> override | applyEffect | необязателен только override **существующего core-эффекта**: дальше исполняется реальный core-switch | src/core/effects.ts:87 | не менялся, пустая заглушка не добавлялась |
| effect:start_dialogue, effect:fail_quest | pack-only эффект | обязательны для соответствующей механики | packs/narrative/operations.ts | не менялись |
| sim | runPackSim | обязательный hook выбранного binding | src/core/pack/host.ts, реализация выбранного пака | отсутствие binding/hooks по-прежнему ошибка |
| action (id из TurnExecutor input) | resolve нестандартного ввода | необязательна поддержка произвольного id, но неизвестный запрос **отклоняется**, не игнорируется | src/core/turn/index.ts:216 | TURN_INPUT_UNKNOWN сохранён |

Никакая startup-операция не признана необязательной ради зелёного смоука.
В частности текущий legacy GameEngine без паковых операций честно не стартует;
подключение narrative не заменяется выдуманным состоянием. Это ограничение
соответствует уточнению «без глушения», а не старой цели пустого default-state.

### smoke:core: точный блокер

Фактически первым отсутствует `initialStateFields`, пак narrative,
`packs/narrative/operations.ts:75`, зона Turn Runtime. До остальных smoke
не доходит. На пути конструктора также обязательны `initialRunStats` и
`initializeRuntime` (тот же файл:76/83). После корректного старта семантика
смоука вызывает обязательные `gameOver` (roguelike.ts) и
`checkQuestTransitions` (quests.ts); их отсутствие нельзя маскировать.
В предыдущем прогоне с пустыми startup-подстановками smoke дошёл до gameOver
и упал. В этой сдаче это не используется как способ добиться зелёного.

## Regression probes без изменения тестов репозитория

Временная проба /tmp/stab13-r2/startup.mts, два отдельных процесса:
- без регистрации: assert.throws на PACK_OPERATION_MISSING initialStateFields
  и проверка paused host, rc=0;
- с импортом **реального** packs/narrative/operations.ts: GameEngine создаётся,
  quests={}, stats_run.travels=0, dialogue=null, host не paused, rc=0.
Проба не регистрирует пустые/фальшивые handlers и не меняет паки.

## Все mission-smokes: ни одного перехода rc

22 прошедших остались прошедшими; все 33 отказа ниже остались rc=1.
Для каждого выполнен дополнительный отдельный запуск; это не подсчёт по grep
одного прогона. PACK_OPERATION_MISSING initialStateFields — 16 сценариев.

| Smoke | rc до → после | Причина на базе #167 | Причина после правок |
|---|---:|---|---|
| smoke:currency | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:ink-import | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts |
| smoke:design-doc | 1 → 1 | ✗ манифест справочных файлов совпадает с public/ai / ПРОВАЛЕНО: 1 | ✗ манифест справочных файлов совпадает с public/ai |
| smoke:quest-journal-runtime | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:p2 | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:ai-runtime | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/ai-runtime-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/ai-runtime-smoke.mts |
| smoke:ai-task | 1 → 1 | ✗ пакет редактирования получает расширение .chronicle — 013423b1-b30b-4414-bbd4-01ae7181d126-patch-task.chronicle / ✗ AI-пакет сохраняет структуру Campaign Package / TypeError: Cannot read properties of undefined (reading 'async') | ✗ пакет редактирования получает расширение .chronicle — ff1598cf-fe0d-47a9-9dcb-9b2251aa3a17-patch-task.chronicle / ✗ AI-пакет сохраняет структуру Campaign Package |
| smoke:dialogues-r31 | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round31-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round31-smoke.mts |
| smoke:dialogues-r32 | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round32-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round32-smoke.mts |
| smoke:breathe-toggle | 1 → 1 | FAIL: 2. Логика shouldBreathe корректна: NPC по умолчанию дышит, робот с breathe:false нет, предметы по умолчанию нет | FAIL: 2. Логика shouldBreathe корректна: NPC по умолчанию дышит, робот с breathe:false нет, предметы по умолчанию нет |
| smoke:voice-dedup | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:narrative-intro | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/narrative-intro-and-ai-features-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/narrative-intro-and-ai-features-smoke.mts |
| smoke:encounters-loader | 1 → 1 | Error: Не удалось загрузить /campaigns/shepot-shesteren/campaign.json: 404 | Error: Не удалось загрузить /campaigns/shepot-shesteren/campaign.json: 404 |
| smoke:hero-appearance | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/heroPortraitImages: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:dialogue-transitions | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/checkQuestTransitions: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:dialogue-skip | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/itemInteractOptions: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:stranger | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/isNpcNameKnown: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:encumbrance | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/travelCost: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:cutscene-queue | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:spoil | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/tickEventTables: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:time-semantics | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/tickNpcMood: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:core | 1 → 1 | смоук упал целиком: PackOperationError: PACK_OPERATION_MISSING: (host)/gameOver: operation is not registered | смоук упал целиком: PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:saves-compat | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:pack-missing | 1 → 1 | AssertionError [ERR_ASSERTION]: # Проверка кампании · Пепел Каэрдена / ✗ проверка не пройдена / - ✗ warning не допускается: 3 | AssertionError [ERR_ASSERTION]: # Проверка кампании · Пепел Каэрдена / ✗ проверка не пройдена |
| smoke:pack-panels | 1 → 1 | AssertionError [ERR_ASSERTION]: проект пробы не открылся /   code: 'ERR_ASSERTION', | AssertionError [ERR_ASSERTION]: проект пробы не открылся |
| smoke:capability-modes | 1 → 1 | AssertionError [ERR_ASSERTION]: node:internal/modules/run_main:123 / AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: /   code: 'ERR_ASSERTION', | AssertionError [ERR_ASSERTION]: node:internal/modules/run_main:123 / AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| smoke:dlg-script | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts |
| smoke:dlg-ui | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/DialoguePlaytest.tsx /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/DialoguePlaytest.tsx |
| smoke:duration-actions | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/campAvailable: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:craft-fail-time | 1 → 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/diceRules: operation is not registered | PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered |
| smoke:dialogue-speaker | 1 → 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/smoke-dialogue-speaker.mts /   code: 'ERR_MODULE_NOT_FOUND', | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/smoke-dialogue-speaker.mts |
| smoke:narthex-closed | 1 → 1 | AssertionError [ERR_ASSERTION]: версия 1.4.86 /   code: 'ERR_ASSERTION', /     '   * Ошибка транспорта была второй и худшей: любой HTTP-ответ, включая 400,\n' + | AssertionError [ERR_ASSERTION]: версия 1.4.86 /     '   * Ошибка транспорта была второй и худшей: любой HTTP-ответ, включая 400,\n' + |
| smoke:drive-gateway | 1 → 1 | AssertionError [ERR_ASSERTION]: createLog выполняется /   code: 'ERR_ASSERTION', | AssertionError [ERR_ASSERTION]: createLog выполняется |

## Полный остаток TypeScript вне зоны

13 диагностик в 5 файлах: src/editor/DialoguePlaytest.tsx,
src/editor/PackCatalogPanel.tsx, src/editor/PackPanelWorkbench.tsx,
src/editor/inkImport.ts, src/player/FmvScreen.tsx.
Ни одной в src/core/** и src/shared/types.ts.

```text
src/editor/DialoguePlaytest.tsx(3,36): error TS2307: Cannot find module '../core/dialogue' or its corresponding type declarations.
src/editor/PackCatalogPanel.tsx(7,72): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,22): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,51): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,101): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(13,13): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(25,62): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(31,56): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(43,48): error TS2339: Property 'setCapabilityMode' does not exist on type 'EditorStore'.
src/editor/PackPanelWorkbench.tsx(48,28): error TS2339: Property 'packResolution' does not exist on type 'EditorStore'.
src/editor/PackPanelWorkbench.tsx(50,23): error TS2339: Property 'capabilityModes' does not exist on type 'EditorStore'.
src/editor/inkImport.ts(14,35): error TS2307: Cannot find module '../core/dialogue' or its corresponding type declarations.
src/player/FmvScreen.tsx(258,7): error TS2322: Type '{ key: string; mode: string; fmv: FmvCutsceneView; }' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'mode' does not exist on type 'IntrinsicAttributes & Props'.
```

## Audit drift — для Tools после merge (вариант A)

Bundle и .golden/manifest.json не изменялись. Свежий хэш **файла в дереве**:
`c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`.
Свежая временная сборка текущего source (только /tmp, с тем же renameAjvHelper):
`a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8`.
Размер 981858 → 994538 байт, первое расхождение byte offset 10262 (0-based).
Участок: перед прежним shared/types добавляется runtime-блок src/core/caps.ts
(assertEnableable, parseCapabilityList, campaignCaps, featureOn, реестр),
плюс init_caps в init_types. Прежняя встроенная простая features-проверка
заменяется общим registry-backed resolver. Это дрейф компоновки/зависимости,
не правка public/ai. Tools должен пересобрать после merge и сверить финальный main.
SHA .golden/manifest.json: `f6c7f98c87cf041fb7e46c9a1bb80f92f1950f4d43943148d988483f1b02d293`.

## Остаток check:contracts

Прямой scripts/contracts-check.mts: rc=0, 46 проверок, включая расположение
единственной featureOn, registriesMatch, метаданные, поведение caps/flags.
Полная npm-команда: rc=1 на следующем внешнем оракуле check:decisions:
`docs/decisions/GOLD-1.6c.md` содержит status с длинным пояснением вместо
одного из proposed/accepted/rejected/superseded. Этот файл не менялся.
Скрывать отказ, менять скрипт или чужой ADR вне Scope не стали. Это не
отказ featureOn; до module-size полная цепочка не доходит, он запущен отдельно.

## Выводы команд

### `npx tsc -b` — rc=2

```text
src/editor/DialoguePlaytest.tsx(3,36): error TS2307: Cannot find module '../core/dialogue' or its corresponding type declarations.
src/editor/PackCatalogPanel.tsx(7,72): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,22): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,51): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,101): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(13,13): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(25,62): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(31,56): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(43,48): error TS2339: Property 'setCapabilityMode' does not exist on type 'EditorStore'.
src/editor/PackPanelWorkbench.tsx(48,28): error TS2339: Property 'packResolution' does not exist on type 'EditorStore'.
src/editor/PackPanelWorkbench.tsx(50,23): error TS2339: Property 'capabilityModes' does not exist on type 'EditorStore'.
src/editor/inkImport.ts(14,35): error TS2307: Cannot find module '../core/dialogue' or its corresponding type declarations.
src/player/FmvScreen.tsx(258,7): error TS2322: Type '{ key: string; mode: string; fmv: FmvCutsceneView; }' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'mode' does not exist on type 'IntrinsicAttributes & Props'.
```

### `npm run smoke:core` — rc=1

```text

> chronicle-forge@0.8.0 smoke:core
> tsx scripts/core-semantics-smoke.mts

смоук упал целиком: PackOperationError: PACK_OPERATION_MISSING: (host)/initialStateFields: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.newState (/home/user/narthex/src/core/engine.ts:223:15)
    at new GameEngine (/home/user/narthex/src/core/engine.ts:114:25)
    at fresh (/home/user/narthex/scripts/core-semantics-smoke.mts:68:5)
    at main (/home/user/narthex/scripts/core-semantics-smoke.mts:72:17) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'initialStateFields',
    reason: 'operation is not registered'
  }
}
```

### `npm run smoke:mission` — rc=1

```text
Mission smoke results
command                               rc
npm run smoke:currency                1
npm run smoke:ink-import              1
npm run smoke:fingerprint             0
npm run smoke:book-md                 0
npm run smoke:campaign-index          0
npm run smoke:guide                   0
npm run smoke:design-doc              1
npm run smoke:quest-journal           0
npm run smoke:quest-journal-runtime   1
npm run smoke:p2                      1
npm run smoke:ai-runtime              1
npm run smoke:ai-task                 1
npm run smoke:char-templates          0
npm run smoke:no-campaign             0
npm run smoke:chronicle-manifest      0
npm run smoke:dialogues-r31           1
npm run smoke:dialogues-r32           1
npm run smoke:breathe-toggle          1
npm run smoke:scene-subtitles         0
npm run smoke:scene-editor            0
npm run smoke:editor-hotspot          0
npm run smoke:voice-dedup             1
npm run smoke:narrative-intro         1
npm run smoke:encounters-loader       1
npm run smoke:manifest-order          0
npm run smoke:engine-version          0
npm run smoke:hero-appearance         1
npm run smoke:theme-contrast          0
npm run smoke:dialogue-transitions    1
npm run smoke:dialogue-skip           1
npm run smoke:travel-transition       0
npm run smoke:stranger                1
npm run smoke:encumbrance             1
npm run smoke:cutscene-queue          1
npm run smoke:spoil                   1
npm run smoke:time-semantics          1
npm run smoke:ai-diff                 0
npm run smoke:view-write              0
npm run smoke:core                    1
npm run smoke:saves-compat            1
npm run smoke:pack-missing            1
npm run smoke:pack-panels             1
npm run smoke:capability-modes        1
npm run smoke:dlg-script              1
npm run smoke:dlg-ui                  1
npm run smoke:folder-import           0
npm run smoke:narrative-builder       0
npm run smoke:patch                   0
npm run smoke:cutout                  0
npm run smoke:duration-actions        1
npm run smoke:craft-fail-time         1
npm run smoke:dialogue-speaker        1
npm run smoke:narthex-closed          1
npm run smoke:narthex-tech            0
npm run smoke:drive-gateway           1
SUMMARY 22/55 passed; rc=1
```

### `npm run check:contracts` — rc=1

```text

> chronicle-forge@0.8.0 check:contracts
> tsx scripts/contracts-check.mts && npm run check:packs && npm run check:pack-boundary && npm run check:decisions && npm run check:module-size && npm run check:browser-gate && npm run check:dev-campaigns && npm run check:campaign-formats && npm run smoke:campaign-visibility && npm run smoke:campaign-fmv-audit && npm run smoke:absence-policy && npm run check:schema-freeze && npm run media:check

  ✓ caps.json совпадает с runtime-реестром src/core/caps.ts
  ✓ синтетическое расхождение реестров отклоняется
  ✓ featureOn реализован в caps.ts, а не в types.ts
  ✓ у каждой возможности есть назначение и проба по статусу
  ✓ пробы возможностей существуют в npm scripts
  ✓ гейт размеров модулей зарегистрирован в npm scripts

профили возможностей (compatibility report)
features: ["combat"] -> caps: ["combat"]; combat=true
features: {"map":true} -> caps: ["map","inventory","needs","skills","relationships","trade","combat","time"]; combat=true; map=true
caps: ["map"] -> caps: ["map"]; combat=false; map=true
features: "combat" -> rejected: Unsupported campaign.meta.features format: expected string[] or a boolean map, received string.
  ✓ features list maps to exactly its registered capabilities
  ✓ legacy features map preserves omitted=true semantics
  ✓ explicit caps list takes precedence and remains exact
  ✓ unrecognized profile format fails loudly instead of returning an empty caps list
  ✓ campaign without either profile keeps the pre-registry default

реестр возможностей
  ✓ ids возможностей уникальны
  ✓ ids паков уникальны
  ✓ ids типов проектов уникальны
  ✓ у каждой возможности валидный статус
  ✓ у каждой возможности известный рантайм
  ✓ kind ссылается на существующий пак
  ✓ kind требует только свои возможности
  ✓ зарезервированная возможность не принадлежит паку
  ✓ каждый пак владеет хотя бы одной возможностью
  ✓ реестр задаёт режимы возможностей

пример пака narrative
  ✓ проходит схему
  ✓ проходит семантику

пример пака grid-strategy
  ✓ проходит схему
  ✓ проходит семантику

пример пака state-ui (pack.state-ui.json)
  ✓ проходит схему
  ✓ проходит семантику

пример проекта narrative
  ✓ проходит схему
  ✓ проходит семантику

пример проекта state-ui (project.state-ui.json)
  ✓ проходит схему
  ✓ проходит семантику

пример проекта с кодом в швах
  ✓ проходит схему
  ✓ проходит семантику

пример локали
  ✓ схема локали = 1
  ✓ язык файла совпадает с именем
  ✓ ключи строк — стабильные ID по структуре
  ✓ у каждой строки есть хэш источника
  ✓ у каждого источника есть строка

негативные примеры обязаны падать
  ✓ project.cap-off-required.json: отклонён (семантика)
  ✓ project.code-missing.json: отклонён (семантика)
  ✓ project.default-language.json: отклонён (семантика)
  ✓ project.mixed-runtime.json: отклонён (семантика)
  ✓ project.unknown-cap.json: отклонён (семантика)
  ✓ семантика ловит то, что схема пропускает

полнота контрактов
  ✓ у каждого стабильного kind есть пример проекта
  ✓ у каждого стабильного пака есть манифест-пример

контракты согласованы: 46 проверок

> chronicle-forge@0.8.0 check:packs
> tsx scripts/check-packs.mts

pack adventure: schema, registry, caps, local schemas, and import boundaries OK
pack grid-strategy: schema, registry, caps, local schemas, and import boundaries OK
pack narrative: schema, registry, caps, local schemas, and import boundaries OK
pack state-ui: schema, registry, caps, local schemas, and import boundaries OK
pack schema copy: in sync
registry: 4 pack manifests in manifest order
fixture cross-pack-import: PASS — rejected (checker exit 1): packs/fixtures/cross-pack-import/pack.json: caps is missing registered capabilities: fmv
packs/fixtures/cross-pack-import/src/index.ts: imports another pack "grid-strategy" via "../../../grid-strategy/pack.json"
fixture full: PASS — accepted (checker exit 0)
fixture missing-probes: PASS — rejected (checker exit 1): packs/fixtures/missing-probes/pack.json: /provides must have required property 'probes'
packs/fixtures/missing-probes/pack.json: caps is missing registered capabilities: fmv
fixture panel-slot-collision: PASS — accepted (checker exit 0)
fixture unknown-capability: PASS — rejected (checker exit 1): packs/fixtures/unknown-capability/pack.json: caps contains unknown capability "not-registered-capability"
packs/fixtures/unknown-capability/pack.json: caps is missing registered capabilities: fmv

check:packs passed

> chronicle-forge@0.8.0 check:pack-boundary
> tsx scripts/check-pack-boundary.mts

fixture (a) branch on pack ID in src/core: PASS — rc=1, src/core/fixture-branch.ts:1
fixture (b) entry.pack filter in scripts probe: PASS — rc=0
fixture (c) registry diagnostic string literal: PASS — rc=0
fixture (d) import from packs/** in src/core: PASS — rc=1, src/core/fixture-import.ts:1
✓ core pack boundary: 37 source files; no pack-ID branches or imports from packs/**
check:pack-boundary passed

> chronicle-forge@0.8.0 check:decisions
> tsx scripts/check-decisions.mts

fixture (a) decision without Статус: remains valid: PASS — rc=0
fixture (b) unsupported status rejected: PASS — rc=1
fixture (c) accepted without Дата решения rejected: PASS — rc=1
fixture (d) rejected without Решил rejected: PASS — rc=1
fixture (e) proposed lists date and age without failing: PASS — rc=0, date=2026-10-20, age=5 days
fixture (f) proposed without date remains informational: PASS — rc=0, date=unknown, age=unknown
decision status check: 49 files; statusless=34; proposed=0; accepted=14; rejected=0; superseded=0
✗ docs/decisions/GOLD-1.6c.md: unsupported status "accepted (2026-10-29). Решение Мастера: protected autosave/save-load в `src/core/**`, `src/player/**`, `assets/save/autosave/**`, golden harness `scripts/golden/**` и внешний `public/ai/campaign-audit.mjs` не менять в GOLD-1.6c; их красные проверки (`playthrough:golden` rc=1 на `06-before-save` без pre-save autosave, `check:audit-bundle` rc=1 из-за устаревшего bundle) задокументировать и считать разрешёнными, не блокирующими приёмку/мерж."; allowed: proposed | accepted | rejected | superseded
check:decisions failed: 1 issue(s)
```

### `npm run check:core-graph` — rc=0

```text

> chronicle-forge@0.8.0 check:core-graph
> tsx scripts/core-graph.mts

Core graph OK (37 modules; acyclic; no core imports of engine.ts).
```

### `npm run check:determinism` — rc=0

```text

> chronicle-forge@0.8.0 check:determinism
> tsx scripts/check-determinism.mts

NAR-4.4 determinism check: 5 seeds × 2 runtimes × 2 replays.
Fixed dt sequence (ms): [7, 13, 20, 3, 17, 41, 19, 1, 39, 60]; realtime step=20 ms.
| seed | runtime | run 1 fingerprint | run 2 fingerprint | same |
|---|---|---|---|---|
| NAR-4.4-seed-01 | turn | 16345b13d05eb7b7 | 16345b13d05eb7b7 | yes |
| NAR-4.4-seed-01 | realtime | ba7e8b854dd56fa9 | ba7e8b854dd56fa9 | yes |
| NAR-4.4-seed-02 | turn | d1c5a60f9b10edcb | d1c5a60f9b10edcb | yes |
| NAR-4.4-seed-02 | realtime | c3e35e2af27ebd56 | c3e35e2af27ebd56 | yes |
| NAR-4.4-seed-03 | turn | ee7028d7cfdf8dab | ee7028d7cfdf8dab | yes |
| NAR-4.4-seed-03 | realtime | fada6b1df5df11a9 | fada6b1df5df11a9 | yes |
| NAR-4.4-seed-04 | turn | 7311f9155950a569 | 7311f9155950a569 | yes |
| NAR-4.4-seed-04 | realtime | 6aad22842555abc8 | 6aad22842555abc8 | yes |
| NAR-4.4-seed-05 | turn | 3f033f1c05fa6110 | 3f033f1c05fa6110 | yes |
| NAR-4.4-seed-05 | realtime | 8382bf962b9fbcca | 8382bf962b9fbcca | yes |
Mutation probe: final fixed dt sample +20 ms; seed=NAR-4.4-seed-01.
MUTATION MISMATCH: runtime=turn seed=NAR-4.4-seed-01 baseline=16345b13d05eb7b7 mutated=6a9b8dff787762ab tick=28->29 rngHits=1->1
MUTATION MISMATCH: runtime=realtime seed=NAR-4.4-seed-01 baseline=ba7e8b854dd56fa9 mutated=0e101ef14862e6dd tick=28->29 rngHits=3->3
PASS: all 10 replay pairs match; the mutation probe detects divergence in both runtimes.
NAR-4.6 installing @sparticuz/chromium and playwright-core (timeout=120000 ms):
> npm install --prefix "/tmp/narthex-parity-browser-9ofQ4M" --no-save --ignore-scripts --no-audit --no-fund @sparticuz/chromium@131 playwright-core@1.49.1

added 20 packages in 4s
Headless Chromium driver: installed in a temporary npm prefix for this check.
NAR-4.6 launching Chromium from the prepared browser packages.
NAR-4.6 Chromium launched: Chromium 131.0.6778.0.
NAR-4.6 parity: browser (Chromium 131.0.6778.0) ↔ cf-play Node; project=nar-4.4-determinism-fixture.
Same seed and dt input row: [7, 13, 20, 3, 17, 41, 19, 1, 39, 60] ms; 5 seeds × 2 runtimes.
| seed | runtime | browser hash | cf-play hash | match |
|---|---|---|---|---|
| NAR-4.4-seed-01 | turn | 16345b13d05eb7b7 | 16345b13d05eb7b7 | yes |
| NAR-4.4-seed-01 | realtime | ba7e8b854dd56fa9 | ba7e8b854dd56fa9 | yes |
| NAR-4.4-seed-02 | turn | d1c5a60f9b10edcb | d1c5a60f9b10edcb | yes |
| NAR-4.4-seed-02 | realtime | c3e35e2af27ebd56 | c3e35e2af27ebd56 | yes |
| NAR-4.4-seed-03 | turn | ee7028d7cfdf8dab | ee7028d7cfdf8dab | yes |
| NAR-4.4-seed-03 | realtime | fada6b1df5df11a9 | fada6b1df5df11a9 | yes |
| NAR-4.4-seed-04 | turn | 7311f9155950a569 | 7311f9155950a569 | yes |
| NAR-4.4-seed-04 | realtime | 6aad22842555abc8 | 6aad22842555abc8 | yes |
| NAR-4.4-seed-05 | turn | 3f033f1c05fa6110 | 3f033f1c05fa6110 | yes |
| NAR-4.4-seed-05 | realtime | 8382bf962b9fbcca | 8382bf962b9fbcca | yes |
Repeat run: browser and cf-play hashes are stable for 10/10 rows; cross-environment mismatches=0.
PASS: 10/10 browser hashes equal cf-play; repeated hashes are identical.
```

### `npm run lint` — rc=0

```text

> chronicle-forge@0.8.0 lint
> oxlint
[1515 предупреждений сокращены; полный локальный вывод /tmp/stab13-r2/npm_run_lint.log]

Found 1515 warnings and 0 errors.
Finished in 1.0s on 472 files with 116 rules using 2 threads.
```

### `npm run check:audit-bundle` — rc=1

```text

> chronicle-forge@0.8.0 check:audit-bundle
> tsx scripts/check-audit-bundle.mts

✗ public/ai/campaign-audit.mjs is stale relative to scripts/campaign-audit.mts
  committed: 981858 bytes, sha256 c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f
  generated: 994538 bytes, sha256 a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8
  first differing byte: 10262
  rebuild with: npm run build:ai-bundle
```

### `npm run check:module-size` — rc=1

```text

> chronicle-forge@0.8.0 check:module-size
> tsx scripts/check-module-size.mts

fixture (a) changed module 451 lines: PASS — rc=1, lines=451, limit=450
fixture (b) changed module 450 lines: PASS — rc=0, lines=450, limit=450
fixture (c) engine.ts 600 lines: PASS — rc=0, lines=600, limit=600
fixture (d) engine.ts 601 lines: PASS — rc=1, lines=601, limit=600
limit=450 facade=600
baseline source modules=166
changed source modules=56
module packs/state-ui/cards.ts: 192/450 lines (changed)
module packs/state-ui/cardsPanel.ts: 31/450 lines (changed)
module packs/state-ui/machine.ts: 22/450 lines (changed)
module packs/state-ui/panel.ts: 31/450 lines (changed)
module packs/state-ui/probe.mts: 270/450 lines (changed)
module packs/state-ui/types.ts: 105/450 lines (changed)
module packs/state-ui/validate.ts: 94/450 lines (changed)
module packs/state-ui/validateCards.ts: 85/450 lines (changed)
module src/App.tsx: 470/450 lines (changed)
module src/core/caps.ts: 141/450 lines (changed)
module src/core/engine.ts: 594/600 lines (facade)
module src/core/executor.ts: 71/450 lines (changed)
module src/core/fingerprint.ts: 70/450 lines (changed)
module src/core/realtime/index.ts: 187/450 lines (changed)
module src/core/save/envelope.ts: 41/450 lines (changed)
module src/core/save/index.ts: 8/450 lines (changed)
module src/core/save/keys.ts: 30/450 lines (changed)
module src/core/save/migrations.ts: 118/450 lines (changed)
module src/core/save/repair.ts: 308/450 lines (changed)
module src/core/save/service.ts: 223/450 lines (changed)
module src/core/save/slots.ts: 49/450 lines (changed)
module src/core/save/storage.ts: 17/450 lines (changed)
module src/core/savemigrate.ts: 2/450 lines (changed)
module src/core/turn/index.ts: 229/450 lines (changed)
module src/editor/AiWizard.tsx: 636/450 lines (changed)
module src/editor/CampaignEditor.tsx: 5199/450 lines (changed)
module src/editor/DialoguePlaytest.tsx: 289/450 lines (changed)
module src/editor/EditorApp.tsx: 1368/450 lines (changed)
module src/editor/aiKit.ts: 33/450 lines (changed)
module src/editor/aiPrompt.ts: 42/450 lines (changed)
module src/editor/aiTask.ts: 273/450 lines (changed)
module src/editor/assets.ts: 270/450 lines (changed)
module src/editor/campaignAudit.ts: 705/450 lines (changed)
module src/editor/chronicle.ts: 258/450 lines (changed)
module src/editor/inkImport.ts: 883/450 lines (changed)
module src/editor/newCampaign.ts: 690/450 lines (changed)
module src/editor/playtestNotes.ts: 101/450 lines (changed)
module src/editor/store.ts: 1267/450 lines (changed)
module src/player/DialogueOverlay.tsx: 387/450 lines (changed)
module src/player/GameView.tsx: 299/450 lines (changed)
module src/player/ItemInteractDialog.tsx: 61/450 lines (changed)
module src/player/MapScreen.tsx: 444/450 lines (changed)
module src/player/SceneForeground.tsx: 152/450 lines (changed)
module src/player/SceneIntroOverlay.tsx: 44/450 lines (changed)
module src/player/SceneNavigation.tsx: 39/450 lines (changed)
module src/player/SceneScreen.tsx: 414/450 lines (changed)
module src/player/useDialogueAudio.ts: 128/450 lines (changed)
module src/shared/CutscenePlayer.tsx: 460/450 lines (changed)
module src/shared/ErrorBoundary.tsx: 73/450 lines (changed)
module src/shared/compat.ts: 496/450 lines (changed)
module src/shared/icons.tsx: 112/450 lines (changed)
module src/shared/migrate.ts: 163/450 lines (changed)
module src/shared/profiles.ts: 271/450 lines (changed)
module src/shared/settings.ts: 101/450 lines (changed)
module src/shared/tauri.ts: 21/450 lines (changed)
module src/shared/types.ts: 3406/450 lines (changed)
module src/shared/versions.ts: 176/450 lines (changed)
external debt (non-blocking unless changed): src/core/combat.ts 1765; src/core/savemigrate.ts 2
✗ src/App.tsx: 470 lines exceeds limit=450
✗ src/editor/AiWizard.tsx: 636 lines exceeds limit=450
✗ src/editor/CampaignEditor.tsx: 5199 lines exceeds limit=450
✗ src/editor/EditorApp.tsx: 1368 lines exceeds limit=450
✗ src/editor/campaignAudit.ts: 705 lines exceeds limit=450
✗ src/editor/inkImport.ts: 883 lines exceeds limit=450
✗ src/editor/newCampaign.ts: 690 lines exceeds limit=450
✗ src/editor/store.ts: 1267 lines exceeds limit=450
✗ src/shared/CutscenePlayer.tsx: 460 lines exceeds limit=450
✗ src/shared/compat.ts: 496 lines exceeds limit=450
✗ src/shared/types.ts: 3406 lines exceeds limit=450
check:module-size failed: 11 module(s) exceed their limit
```

### `npx tsx scripts/contracts-check.mts` — rc=0

  ✓ у каждого стабильного пака есть манифест-пример

контракты согласованы: 46 проверок

## Scope / diff

Вне зоны не правил. Изменены только src/core/caps.ts, src/core/engine.ts,
src/shared/types.ts и этот отчёт. protected autosave/save-load не менялись.
Все исходные поля CampaignData и golden/bundle сохранены.
Допущение: приоритет имеет новое явное решение «БЕЗ ГЛУШЕНИЯ», поэтому
обязательные constructor hooks снова требуют реальную регистрацию.
Откат этой сдачи не нужен для runtime API: функция остаётся доступна по обоим
путям; возвращать пустые startup-значения нельзя без нового решения Мастера.
Нового контракта не вводится, ADR не создавался.

`git diff --check`: rc=0. Diff stat приведён в ответе и PR; merge SHA — в ответе после squash.
