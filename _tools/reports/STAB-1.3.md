# STAB-1.3 · Kernel

## Статус: частично выполнено, оракул целиком НЕ достигнут

База: `4d4eb7e` (полный SHA ниже). Работа на закреплённой Arena-ветке,
чистый снимок синхронизирован с origin/main; новая ветка не создавалась.

## Изменения и было/стало

- Д-1: в CampaignData возвращены optional ruleOrder/encounterOrder: loader
  всегда отдаёт их, программные кампании могут обходиться без них; effects
  уже содержит fallback на Object.values. Данные не менялись.
  tsc: 15 диагностик → 13, в core/shared/types 2 → 0 (на этой базе не 15).
- Д-5: две реализации → одна в shared/types.ts; caps.ts — совместимый
  реэкспорт. Перенесена семантика прежней caps-функции: реестр, допустимые
  статусы, campaignCaps, ошибки неизвестного id, явные caps приоритетны.
  Тип аргумента CapabilityProfile сохранён. Для этого types импортирует
  реестр и resolver из caps; реэкспорт образует взаимную ESM-связь, но данные
  используются лишь при вызове функции, не в инициализаторе. core-graph rc=0.
  Контракт flags не упрощён до `features[id] !== false`.
- Д-6: отсутствующие initialStateFields/initialRunStats дают {}, отсутствующий
  initializeRuntime пропускается. Все три нужны для старта: исправление только
  первого вызова оставляло бы два следующих отказа. При зарегистрированной
  операции прежний invoke сохранён (включая ошибки/паузу), host не ослаблен.
  Временный отдельный тест стартует без операций и проверяет неприостановленный
  host, затем регистрирует три hooks и проверяет их значения/вызов: rc=0.
- mission-smokes: **22/55 → 22/55**, не 38/55. Все 16 прежних отказов
  initialStateFields устранены на этом месте, но те же прогоны падают дальше
  на незарегистрированных операциях пака. Восстанавливать narrative-поведение
  в core или подключать его неявно запрещено границей задачи; packs не менялись.
- contracts: rc=1. Все поведенческие проверки featureOn проходят; единственный
  отказ — scripts/contracts-check.mts:90 буквально требует реализацию в caps.ts
  и отсутствие её в types.ts. Это противоположно инварианту карточки. Скрипт
  не изменён и проверка не замаскирована.
- audit-bundle: исходно rc=0, после переноса реализации rc=1: types теперь
  зависит от runtime registry/resolver, что меняет сборку audit. Сам bundle
  НЕ менялся, SHA-256 остаётся
  `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`.
  Обновлять public/ai нельзя; отсутствие диффа бандла не означает свежесть.
- module-size: остаются 11 существующих превышений, новых модулей сверх
  11 нет, лимиты/исключения не менялись.
- core-graph rc=0; determinism rc=0 (10/10, повторяемые хэши); lint rc=0,
  0 errors. Полного зелёного результата не заявляем.

Вне зоны ничего не правил: только src/core/caps.ts, src/core/engine.ts,
src/shared/types.ts и собственный отчёт. Нет новых as any, ts-ignore,
ts-expect-error, eslint-disable, изменений тестов/конфигурации/паков.
Допущение: необязательность startup hooks распространяется на все три вызова
инициализации, а не только initialStateFields. Откат: вернуть три вызова.
Изменения выполняют заданный контракт, новый ADR не вводится.

## Каждый не оживший smoke

Все перечисленные ниже имели rc=1 до и после; остальные 22 — rc=0 до/после.
Причины получены отдельным запуском каждого после исправления.

| Smoke | После | Причина |
|---|---:|---|
| smoke:currency | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered |
| smoke:ink-import | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:design-doc | 1 | ✗ манифест справочных файлов совпадает с public/ai / ПРОВАЛЕНО: 1 |
| smoke:quest-journal-runtime | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered |
| smoke:p2 | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered |
| smoke:ai-runtime | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/ai-runtime-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:ai-task | 1 | ✗ пакет редактирования получает расширение .chronicle — 013423b1-b30b-4414-bbd4-01ae7181d126-patch-task.chronicle / ✗ AI-пакет сохраняет структуру Campaign Package / TypeError: Cannot read properties of undefined (reading 'async') |
| smoke:dialogues-r31 | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round31-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:dialogues-r32 | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round32-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:breathe-toggle | 1 | FAIL: 2. Логика shouldBreathe корректна: NPC по умолчанию дышит, робот с breathe:false нет, предметы по умолчанию нет |
| smoke:voice-dedup | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered |
| smoke:narrative-intro | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/narrative-intro-and-ai-features-smoke.mts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:encounters-loader | 1 | Error: Не удалось загрузить /campaigns/shepot-shesteren/campaign.json: 404 |
| smoke:hero-appearance | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/heroPortraitImages: operation is not registered |
| smoke:dialogue-transitions | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/checkQuestTransitions: operation is not registered |
| smoke:dialogue-skip | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/itemInteractOptions: operation is not registered |
| smoke:stranger | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/isNpcNameKnown: operation is not registered |
| smoke:encumbrance | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/travelCost: operation is not registered |
| smoke:cutscene-queue | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered |
| smoke:spoil | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/tickEventTables: operation is not registered |
| smoke:time-semantics | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/tickNpcMood: operation is not registered |
| smoke:core | 1 | смоук упал целиком: PackOperationError: PACK_OPERATION_MISSING: (host)/gameOver: operation is not registered |
| smoke:saves-compat | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered |
| smoke:pack-missing | 1 | AssertionError [ERR_ASSERTION]: # Проверка кампании · Пепел Каэрдена / ✗ проверка не пройдена / - ✗ warning не допускается: 3 |
| smoke:pack-panels | 1 | AssertionError [ERR_ASSERTION]: проект пробы не открылся /   code: 'ERR_ASSERTION', |
| smoke:capability-modes | 1 | AssertionError [ERR_ASSERTION]: node:internal/modules/run_main:123 / AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: /   code: 'ERR_ASSERTION', |
| smoke:dlg-script | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:dlg-ui | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/DialoguePlaytest.tsx /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:duration-actions | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/campAvailable: operation is not registered |
| smoke:craft-fail-time | 1 | PackOperationError: PACK_OPERATION_MISSING: (host)/diceRules: operation is not registered |
| smoke:dialogue-speaker | 1 | Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/smoke-dialogue-speaker.mts /   code: 'ERR_MODULE_NOT_FOUND', |
| smoke:narthex-closed | 1 | AssertionError [ERR_ASSERTION]: версия 1.4.86 /   code: 'ERR_ASSERTION', /     '   * Ошибка транспорта была второй и худшей: любой HTTP-ответ, включая 400,\n' + |
| smoke:drive-gateway | 1 | AssertionError [ERR_ASSERTION]: createLog выполняется /   code: 'ERR_ASSERTION', |

## Полный остаток TypeScript (Д-2/Д-3/Д-4, вне зоны)

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

## Startup regression probe

Временный файл вне Git; использована реальная кампания ash-of-caerden,
никакие операции narrative не импортировались. Проба возвращает rc=0:

```text
[narthex] Кампания рассчитана на движок 0.1.0 и новее, а запущен 0.0.0-dev. Обновите Chronicle Forge — иначе правила и механики кампании могут работать неверно.
PASS: no-pack startup leaves host unpaused; registered startup hooks retain their values and run
```

## Команды и вывод после правок (lint warnings сокращены)

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

✓ startTick читает starting_tick
✓ tick_elapsed сравнивает с абсолютным тиком (граница)
✓ elapsed_ge считает «прошло с начала забега» (tick − startTick)
✓ set_flag ставит флаг; flag_set/flag_not_set читают его
✓ clear_flag снимает флаг
✓ changeNeed клэмпит сверху к max
смоук упал целиком: PackOperationError: PACK_OPERATION_MISSING: (host)/gameOver: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.gameOver (/home/user/narthex/src/core/engine.ts:515:90)
    at Object.onNeedZero (/home/user/narthex/src/core/needs.ts:207:11)
    at Object.changeNeed (/home/user/narthex/src/core/needs.ts:228:37)
    at GameEngine.changeNeed (/home/user/narthex/src/core/engine.ts:288:59)
    at main (/home/user/narthex/scripts/core-semantics-smoke.mts:111:9) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'gameOver',
    reason: 'operation is not registered'
  }
}
```

### `npm run smoke:mission` — rc=1

```text

> chronicle-forge@0.8.0 smoke:mission
> tsx scripts/mission-smokes.mts

Vite dev server ready at http://127.0.0.1:5173; running 55 smoke scripts serially.
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.playCutscene (/home/user/narthex/src/core/engine.ts:285:48)
    at GameEngine.applyEffect (/home/user/narthex/src/core/effects.ts:386:14)
    at GameEngine.applyEffect (/home/user/narthex/src/core/engine.ts:486:77)
    at GameEngine.applyEffects (/home/user/narthex/src/core/effects.ts:83:35)
    at GameEngine.applyEffects (/home/user/narthex/src/core/engine.ts:485:87)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/effects.ts:78:10)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/engine.ts:476:85)
    at GameEngine.checkRules (/home/user/narthex/src/core/effects.ts:48:12) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'playCutscene',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
✓ канонический JSON не зависит от порядка ключей
✓ отпечаток стабилен при перемешивании ключей
✓ смена полей публикации (author/attribution/series) отпечаток НЕ меняет — вор не «заначит» чужую кампанию сменой титула
✓ смена контента отпечаток меняет
✓ отпечаток считается без author/attribution вообще

все проверки зелёные
✓ пункты оглавления не разваливаются (6 — один li)
✓ продолжение пункта («версии») внутри того же li
✓ маркированные пункты «О книге» без осиротевших строк
✓ файлы книги на месте — 10
✓ 01-quick-start.md: в параграфах нет <br/>
✓ 01-quick-start.md: за списками не болтаются обрывки
✓ 02-editor.md: в параграфах нет <br/>
✓ 02-editor.md: за списками не болтаются обрывки
✓ 03-content.md: в параграфах нет <br/>
✓ 03-content.md: за списками не болтаются обрывки
✓ 04-visual.md: в параграфах нет <br/>
✓ 04-visual.md: за списками не болтаются обрывки
✓ 05-mechanics.md: в параграфах нет <br/>
✓ 05-mechanics.md: за списками не болтаются обрывки
✓ 06-technical.md: в параграфах нет <br/>
✓ 06-technical.md: за списками не болтаются обрывки
✓ 07-ai.md: в параграфах нет <br/>
✓ 07-ai.md: за списками не болтаются обрывки
✓ 08-limits.md: в параграфах нет <br/>
✓ 08-limits.md: за списками не болтаются обрывки
✓ 09-license.md: в параграфах нет <br/>
✓ 09-license.md: за списками не болтаются обрывки
✓ README.md: в параграфах нет <br/>
✓ README.md: за списками не болтаются обрывки
✓ дизайн-документ отображает заголовки и inline Markdown
✓ дизайн-документ отображает списки, цитату, таблицу и fenced code
✓ форма задания ИИ ограничена высотой окна и имеет внутреннюю прокрутку
✓ чипы задания ИИ используют одну контрастную палитру во всех темах редактора

все проверки зелёные
✓ реестр кампаний отдаётся dev-сервером
✓ реестр — массив
✓ полигон смоуков не внесён в реестр
✓ в реестре нет битых записей (у каждой есть каталог)
✓ пустой реестр переживает гидратацию
✓ название берётся из campaign.json, а не из реестра — Пепел Каэрдена
✓ описание берётся из campaign.json (а не «захардкоженное»)
✓ в списке нет устаревшего текста про банду Серого Йорека
✓ id сохраняется
✓ несуществующая кампания отфильтровывается
✓ новая кампания кладёт описание в реестр
✓ есть функция долива строки реестра
✓ описание новой кампании не пустое
✓ редактор сохраняет кампанию под неизменным ID из папки
✓ импорт .chronicle обновляет подпись, сохраняя ID текущей папки
✓ в выпадающем списке редактора живое название открытой папки
✓ меню дописывает текущую кампанию в список из файла
✓ в приложении нет захардкоженной кампании по умолчанию
✓ выбор кампании идёт через реестр (pickCampaign)

все проверки зелёные
✓ пример версии движка в гайде синхронизирован с ENGINE_VERSION
    ожидается 0.8.0; не путать с version кампании
✓ а) все JSON-литералы эффектов/условий в гайде валидны по схеме
✓ б) каждый тип из схемы (129) упомянут в гайде
    не упомянуты: 
✓ в) поля в сниппетах «тип { … }» существуют у этого типа
✓ г) в бэктиках гайда нет несуществующих механик
    не нашли в схеме, в лексике полигона и в ENGINE_VOCABULARY: 

гайд и схема согласованы
✓ бланк: все обязательные разделы на месте и по порядку
✓ бланк: сначала план, затем полный результат в том же ответе
✓ бланк: в теле нет технических идентификаторов вне приложения (§R7)
✓ инструкция: сначала дизайн-документ, затем полный результат в том же ответе
✓ инструкция: документ обновляется на каждой итерации
✓ инструкция: задача выполняется целиком без ожидания «ок» и вопросов
✓ бланк: дизайн-документ не используется как этап подтверждения
✓ инструкция: полный результат — .chronicle, JSON оставлен для правок без медиа
✓ §0 гайда синхронизирован с docs/ai-start-instruction.md
✓ заголовок §0 — «С чего начать», без упоминания стартового txt
✗ манифест справочных файлов совпадает с public/ai
    лишние: PLAYKIT.md, cf-play.mjs; нет: —
✓ задание ИИ собирает контекст кампании, бриф, руководство и отчёт проверки
✓ campaign.schema.json: design_doc есть в CampaignMeta и необязателен
    type=string

ПРОВАЛЕНО: 1
✓ j_search resolves to Russian text and its publishing stage — Начало — Отец Корвин просит вернуть медальон Вечного Света: вор, укравший реликвию, сгинул в забро…
✓ j_found resolves to Russian text and its publishing stage — Реликвия найдена — Медальон у меня. Осталось вернуть его отцу Корвину в храм.
✓ j_completed resolves to Russian text and its publishing stage — Завершение — Реликвия вернулась в храм. Корвин благословил меня — рука теперь твёрже уходит от ударов,…
✓ new journal keys use their own namespace, not stage ids
✓ new journal keys avoid collisions
✓ unmapped record still gets a human-readable fallback
ALL GREEN
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.playCutscene (/home/user/narthex/src/core/engine.ts:285:48)
    at GameEngine.applyEffect (/home/user/narthex/src/core/effects.ts:386:14)
    at GameEngine.applyEffect (/home/user/narthex/src/core/engine.ts:486:77)
    at GameEngine.applyEffects (/home/user/narthex/src/core/effects.ts:83:35)
    at GameEngine.applyEffects (/home/user/narthex/src/core/engine.ts:485:87)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/effects.ts:78:10)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/engine.ts:476:85)
    at GameEngine.checkRules (/home/user/narthex/src/core/effects.ts:48:12) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'playCutscene',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.playCutscene (/home/user/narthex/src/core/engine.ts:285:48)
    at GameEngine.applyEffect (/home/user/narthex/src/core/effects.ts:386:14)
    at GameEngine.applyEffect (/home/user/narthex/src/core/engine.ts:486:77)
    at GameEngine.applyEffects (/home/user/narthex/src/core/effects.ts:83:35)
    at GameEngine.applyEffects (/home/user/narthex/src/core/engine.ts:485:87)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/effects.ts:78:10)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/engine.ts:476:85)
    at GameEngine.checkRules (/home/user/narthex/src/core/effects.ts:48:12) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'playCutscene',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/ai-runtime-smoke.mts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
✓ медиа-аудит видит локальные ссылки, не только assets/
✗ пакет редактирования получает расширение .chronicle — 19d74e10-c3e8-4321-808b-7290d0fb79b3-patch-task.chronicle
✗ AI-пакет сохраняет структуру Campaign Package
✓ AI-пакет содержит единый brief и отчёт по категориям
✓ AI-пакет несёт руководство, схему и бланк
✓ плейтест/медиа/структура присутствуют в отчёте
✓ AI-пакет передаёт агенту существующий ID
✓ новая кампания получает пакет инструкций без фиктивного исходного проекта
/home/user/narthex/scripts/ai-task-smoke.mts:58
  const campaignMeta = JSON.parse(await editedArchive.files['campaign.json'].async('text')) as Record<string, unknown>
                                                                             ^

TypeError: Cannot read properties of undefined (reading 'async')
    at <anonymous> (/home/user/narthex/scripts/ai-task-smoke.mts:58:78)

Node.js v22.22.3
✓ аудит находит все 3 неверных происхождения и все 9 сочетаний призваний — найдено 12
✓ аудит показывает перерасход характеристик на 22 очка
✓ аудит учитывает бесплатные бонусы профессии для навыков
✓ стартовый шаблон автоматически тратит ровно оба бюджета
✓ стартовый шаблон после нормализации можно запустить
✓ все 9 сочетаний происхождения и призвания соответствуют точным бюджетам — 9 сочетаний
✓ бесплатный бонус происхождения к запрещённому навыку не считается покупкой
INFO  _backlog/campaign.json нет — образец «Тишины Орфея» пропущен
✓ по умолчанию бриф не навязывает жанр, масштаб, акценты или боёвку
✓ соотношение добавляется в задачу только после явного выбора
✓ системная инструкция явно оставляет пропущенные настройки необязательными
✓ задание требует точного расхода бюджета для каждой пары шаблонов
ALL GREEN
✓ поставка начинается с пустого реестра
✓ демо-полигон не доступен игроку
✓ полигон смоуков на месте и помечен
✓ полигон не содержит тяжёлых файлов
✓ в полигоне нет экспортируемых изображений
✓ данные полигона сохраняют ссылки на изображения
✓ нет захардкоженной кампании по умолчанию
✓ выбор кампании идёт из реестра
✓ пустой реестр не грузит несуществующий путь
✓ движок показывает экран без кампаний
✓ экран пустого реестра предлагает создать и загрузить кампанию
✓ движок и редактор целы
✓ создание выдаёт UUID, а не slug названия
✓ JSON-импорт пустого редактора выдаёт приложением новый ID
✓ JSON-импорт существующей кампании сохраняет ID папки
✓ Save не переносит папку при попытке изменить ID
✓ редактор доступен без кампании
✓ из пустого редактора можно создать и импортировать кампанию
✓ ID инициализируется при пустом JSON-импорте
✓ импорт .chronicle спрашивает об обновлении/копии при конфликте
✓ пустой локальный реестр доступен — []
✓ отсутствующий каталог не считается кампанией
✓ атомарная резервация даёт ровно одному процессу владение ID
✓ ID, уже занятый папкой, не резервируется повторно
✓ новая кампания получает UUID независимо от названия — a862cbbc-a2d6-4f75-b507-9324c288a29d / ac6cbf2a-da7d-4b55-bba5-4526ad7f85e6
✓ смена названия не связана с ID
✓ свободный .chronicle сохраняет исходный стабильный ID
✓ повторный идентичный импорт распознаётся и не дублируется
✓ отсутствующий в архиве файл считается конфликтом содержимого
✓ без обработчика конфликта импорт безопасно отменяется
✓ обновление сохраняет исходный ID и просит явный выбор
✓ обновление заменило метаданные в существующей папке
✓ отдельная копия получает новый UUID
✓ копирование не перезаписывает исходную кампанию
✓ отмена конфликта не пишет пакет
✓ пакет без ID получает новый UUID, не slug из названия
✓ после теста реестр очищен

ALL GREEN
chronicle-manifest-smoke: ALL GREEN
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round31-smoke.mts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/dialogues-round32-smoke.mts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
--- Смоук-тест: Управление эффектом живого дыхания сущностей ---
✓ 1. Поле breathe добавлено в типы сущностей
FAIL: 2. Логика shouldBreathe корректна: NPC по умолчанию дышит, робот с breathe:false нет, предметы по умолчанию нет
--- Смоук-тест: Лайтбокс, приоритет состояний сцены и чистые подзаголовки ---
✓ 1. Лайтбокс картинок смонтирован через createPortal в document.body
✓ 2. Лайтбокс имеет zIndex 999999 и перекрывает сцену
✓ 3. Лайтбокс закрывается по Escape
✓ 4. В редакторе сцен по умолчанию открывается базовое состояние без условий
✓ 5. В движке состояния с условиями проверяются с приоритетом, а базовое служит фоллбэком
✓ 6. В руководстве ИИ зафиксирован регламент порядка состояний сцены
✓ 7. Реализована функция formatSceneSubtitle
✓ 8. Убрана конкатенация с техническими «Всегда» и «Днём»
scene-subtitles-and-state-smoke: ALL GREEN
--- Смоук-тест: Вкладки инспектора сцены и ручной ввод координат ---
✓ 1. Тип SceneTab объявлен с вкладками object / scene / states
✓ 2. Начальное состояние вкладки — object
✓ 3. Вкладки инспектора используют класс scene-inspector-tabs
✓ 4. Вкладки имеют понятные русские названия
✓ 5. Клик по объекту на холсте или создание переключает на вкладку object
✓ 6. Выбранный объект имеет верхнюю панель быстрого управления
✓ 7. Доступен быстрый возврат ко всем объектам и удаление
✓ 8. Когда объект не выбран, отображается удобный каталог объектов
✓ 9. Компонент RectCoordsEditor реализован
✓ 10. RectCoordsEditor подключен к слотам и переходам
✓ 11. Панель scene-props зафиксирована sticky для комфортной работы
✓ 12. Стили вкладок добавлены в editor.css
✓ 13. Элементы каталога объектов сцены оформлены
scene-editor-tabs-smoke: ALL GREEN
--- Смоук-тест: Хотспоты окружения, превью в редакторе сущностей и спрайты в сценах ---
✓ Все проверки хотспотов окружения, спрайтов, превью редактора, синхронной камеры, ручных координат и локализации пройдены успешно!
--- Смоук-тест: Voice Coordinator и защита от задваивания озвучки ---
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.playCutscene (/home/user/narthex/src/core/engine.ts:285:48)
    at <anonymous> (/home/user/narthex/scripts/voice-dedup-smoke.mts:116:8)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'playCutscene',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/narrative-intro-and-ai-features-smoke.mts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
--- Смоук-тест: Загрузка кампаний с таблицами встреч (encounters/ и rules/) ---
/home/user/narthex/src/core/loader.ts:31
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}: ${res.status}`)
                     ^

Error: Не удалось загрузить /campaigns/shepot-shesteren/campaign.json: 404
    at getJSON (/home/user/narthex/src/core/loader.ts:31:22)
    at async Promise.all (index 0)
    at async loadCampaign (/home/user/narthex/src/core/loader.ts:42:35)
    at async <anonymous> (/home/user/narthex/scripts/encounters-loader-smoke.mts:38:16)

Node.js v22.22.3
✓ manifest-order smoke: rules, encounters, and rule traversal follow manifest order under reversed fetch completion
engine-version-smoke: ALL GREEN (engine 0.8.0)
✓ создание заранее выбирает по первому варианту каждого сегмента
✓ постоянный внешний вид сохраняется в состоянии игрока
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/heroPortraitImages: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.heroPortraitImages (/home/user/narthex/src/core/engine.ts:327:52)
    at <anonymous> (/home/user/narthex/scripts/hero-appearance-smoke.mts:46:70)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'heroPortraitImages',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
OK: контраст поверхностей, модальные окна и границы редактирования UI
Testing Dialogue Transitions (Scene, Combat, State, Endings)...
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/checkQuestTransitions: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.checkRules (/home/user/narthex/src/core/effects.ts:50:20)
    at GameEngine.checkRules (/home/user/narthex/src/core/engine.ts:474:55)
    at GameEngine.start (/home/user/narthex/src/core/engine.ts:259:12)
    at <anonymous> (/home/user/narthex/scripts/smoke-dialogue-transitions.mts:119:8)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'checkQuestTransitions',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- Запуск smoke-dialogue-skip-and-item-modal ---
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/itemInteractOptions: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.itemInteractOptions (/home/user/narthex/src/core/engine.ts:498:74)
    at <anonymous> (/home/user/narthex/scripts/smoke-dialogue-skip-and-item-modal.mts:95:21)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'itemInteractOptions',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- Смоук-тест: Кинематографичный переход между локациями и открытка карты ---
✓ 1. MapScreen содержит стилизованную открытку-превью локации (travel-postcard, travel-postcard-img)
✓ 2. Открытка содержит бейдж назначения и кнопку закрытия карточки
✓ 3. Реализовано форматирование времени в пути со склонениями (час, часа, часов)
✓ 4. Реализован кинематографичный оверлей пути между локациями (travel-journey-overlay, travel-journey-card)
✓ 5. Оверлей пути содержит анимированный компас и полосу прогресса маршрута
✓ 6. Поддерживается пропуск пути кликом/клавишей и подсветка выбранного маркера на карте
✓ 7. Карточка подтверждения пути центрирована (translate: -50% 0) и ограничена по ширине min(440px)
✓ 8. Открытка локации зафиксирована по высоте (140px) с overflow: hidden для предотвращения расползания
✓ 9. Изображение открытки масштабируется пропорционально (object-fit: cover)
✓ 10. Оверлей пути оформлен атмосферным радиальным градиентом и размытием
✓ 11. Присутствуют ключевые кадры анимации полосы пути и стрелки компаса
✓ 12. Выбранный маркер локации выделяется золотым сиянием (.map-pin.is-selected)

smoke-location-travel-transition: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!
Testing Stranger Mechanics and Event Triggers...
1. Проверка механики «Незнакомец»...
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/isNpcNameKnown: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.isNpcNameKnown (/home/user/narthex/src/core/engine.ts:477:59)
    at <anonymous> (/home/user/narthex/scripts/smoke-stranger-and-triggers.mts:109:21)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'isNpcNameKnown',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- Запуск encumbrance-smoke ---
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/travelCost: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.travelCost (/home/user/narthex/src/core/engine.ts:471:63)
    at <anonymous> (/home/user/narthex/scripts/encumbrance-smoke.mts:148:21)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'travelCost',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- Запуск smoke:cutscene-postcard-queue ---
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.playCutscene (/home/user/narthex/src/core/engine.ts:285:48)
    at GameEngine.applyEffect (/home/user/narthex/src/core/effects.ts:386:14)
    at GameEngine.applyEffect (/home/user/narthex/src/core/engine.ts:486:77)
    at GameEngine.applyEffects (/home/user/narthex/src/core/effects.ts:83:35)
    at GameEngine.applyEffects (/home/user/narthex/src/core/engine.ts:485:87)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/effects.ts:78:10)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/engine.ts:476:85)
    at GameEngine.checkRules (/home/user/narthex/src/core/effects.ts:48:12) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'playCutscene',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- Запуск spoil-smoke ---
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/tickEventTables: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.tickEventTables (/home/user/narthex/src/core/engine.ts:537:49)
    at Object.tickEventTables (/home/user/narthex/src/core/engine.ts:287:179)
    at Object.advanceTicks (/home/user/narthex/src/core/needs.ts:105:11)
    at GameEngine.advanceTicks (/home/user/narthex/src/core/engine.ts:287:45)
    at <anonymous> (/home/user/narthex/scripts/spoil-smoke.mts:128:8)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'tickEventTables',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- time-semantics-smoke ---
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/tickNpcMood: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.tickNpcMood (/home/user/narthex/src/core/engine.ts:481:38)
    at Object.tickNpcMood (/home/user/narthex/src/core/engine.ts:287:136)
    at Object.advanceTicks (/home/user/narthex/src/core/needs.ts:98:78)
    at GameEngine.advanceTicks (/home/user/narthex/src/core/engine.ts:287:45)
    at <anonymous> (/home/user/narthex/scripts/time-semantics-smoke.mts:145:10)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'tickNpcMood',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
--- ai-diff-smoke ---
✓ ai-diff-smoke: все проверки зелёные
✓ статика: все вызовы .touch( в src/editor объяснены действием мастера (42 сайтов)
✓ динамика: загрузка эталонной кампании (95 файлов) не порождает ни одного ряда в diff
✓ двойная сериализация 89 JSON-документов стабильна

инвариант зелёный
✓ startTick читает starting_tick
✓ tick_elapsed сравнивает с абсолютным тиком (граница)
✓ elapsed_ge считает «прошло с начала забега» (tick − startTick)
✓ set_flag ставит флаг; flag_set/flag_not_set читают его
✓ clear_flag снимает флаг
✓ changeNeed клэмпит сверху к max
смоук упал целиком: PackOperationError: PACK_OPERATION_MISSING: (host)/gameOver: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.gameOver (/home/user/narthex/src/core/engine.ts:515:90)
    at Object.onNeedZero (/home/user/narthex/src/core/needs.ts:207:11)
    at Object.changeNeed (/home/user/narthex/src/core/needs.ts:228:37)
    at GameEngine.changeNeed (/home/user/narthex/src/core/engine.ts:288:59)
    at main (/home/user/narthex/scripts/core-semantics-smoke.mts:111:9) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'gameOver',
    reason: 'operation is not registered'
  }
}
Кампания: Пепел Каэрдена v0.1.0 · движок 0.8.0 · формат пакета v1
✓ 1 версия движка не пустая — 0.8.0
✓ 1 формат пакета — целое ≥ 1 — 1
✓ 1 сравнение версий
✓ 1 предрелиз младше релиза
✓ 1 bump
✓ 1 разбор «мусора» не падает
✓ 1 движок подходит демо-кампании
✓ 1 слишком новый минимум — понятный отказ — Кампания рассчитана на движок 99.0.0 и н
✓ 1 свой формат пакета проходит
✓ 1 пакет новее движка — отказ с причиной
✓ 1 древний формат пакета — отказ
✓ 1 цепочка миграций непрерывна
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/playCutscene: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.playCutscene (/home/user/narthex/src/core/engine.ts:285:48)
    at GameEngine.applyEffect (/home/user/narthex/src/core/effects.ts:386:14)
    at GameEngine.applyEffect (/home/user/narthex/src/core/engine.ts:486:77)
    at GameEngine.applyEffects (/home/user/narthex/src/core/effects.ts:83:35)
    at GameEngine.applyEffects (/home/user/narthex/src/core/engine.ts:485:87)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/effects.ts:78:10)
    at GameEngine.tryFireRule (/home/user/narthex/src/core/engine.ts:476:85)
    at GameEngine.checkRules (/home/user/narthex/src/core/effects.ts:48:12) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'playCutscene',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
✓ cf-play check отказал кодом PACK_MISSING, без исключения; диагностический текст совпал со Studio
  PACK_MISSING: Тип проекта «narrative» не установлен: нужен пак «Narrative & Branching» (narrative). Установите каталог packs/narrative/ с pack.json, добавьте «narrative» в packs/registry.json и перезапустите студию.
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: # Проверка кампании · Пепел Каэрдена

✗ проверка не пройдена

- ✗ warning не допускается: 3

## Статика
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 3
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/tmp/narthex-pack-missing-JXCEku/project/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
концовки: ending_ashes
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
сцены: scene_barracks, scene_forest_edge, scene_gates_front, scene_market, scene_tavern_hall, scene_temple
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp



1 !== 0

    at <anonymous> (/home/user/narthex/scripts/smoke/pack-missing-smoke.mts:91:10) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 1,
  expected: 0,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.22.3
[1] фикстурный пак с панелью
  из манифеста: id=panel-fixture · слот=right · заголовок=«Панель фикстуры» · order=12
  вкладка в разметке: <button type="button" role="tab" aria-selected="true" class="ce-tab on" data-panel-id="panel-fixture" data-slot="right" data-order="12" data-pack-id="adventure">
  ✓ панель, слот, заголовок и порядок пришли из манифеста (id, слот, заголовок, order)
[2] пак без панелей не ломает вкладки
  вкладки до: adventure:panel-fixture
  вкладки после: adventure:panel-fixture · панелей у пустого пака: 0
  ✓ полный список вкладок до и после совпадает
[3] два пака в один слот — ошибка сборки (негативная фикстура)
  текст сборки: Слот «Справа» (right) уже занят паком «Фикстура панелей» (adventure): пак «Фикстура-соперник» (fixture-rival) добавляет в него панель «panel-rival». Слот может занимать только один пак.
  дочерний процесс: rc=1
  ✓ ошибка сборки назвала слот и два пака, код возврата ненулевой
[4] панели меняются манифестом без правки кода студии
  до правки: panel-fixture · right · «Панель фикстуры» · order=12
  после правки манифеста: panel-fixture · center · «Панель из манифеста» · order=7
  src/editor sha256=9642988b324121e5… (совпал: true)
  ✓ списки вкладок разные, src/editor не менялся
[5] выключенная возможность убирает панель
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: проект пробы не открылся
+ actual - expected

+ undefined
- 'ready'

    at <anonymous> (/home/user/narthex/scripts/pack-panels-smoke.mts:281:10) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: 'ready',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.22.3
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ undefined
- 'ready'

    at <anonymous> (/home/user/narthex/scripts/probe-capability-modes.mts:96:10) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: 'ready',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.22.3


1 !== 0

    at <anonymous> (/home/user/narthex/scripts/smoke/capability-modes-smoke.mts:11:8)
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 1,
  expected: 0,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/inkImport.ts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/src/editor/DialoguePlaytest.tsx
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
--- Smoke test: Folder import & AI Repo Kit ---
✓ Все 15 служебных файлов Git, tools и скриптов успешно отфильтрованы
✓ Все 19 канонических файлов кампании успешно разрешены
✓ Префикс GitHub репозитория автоматически распознан и удален
✓ Симуляция 2828 файлов репозитория: успешно обработана, отфильтровано 2824 служебных файлов, сохранено файлов кампании: 5
✓ Легковесный чемодан ИИ собран успешно (размер: 86.0 КБ)
--- Все проверки импорта папок и легковесного чемодана пройдены успешно! ---
--- Smoke test: Narrative Builder, Camera & AI Guide ---
✓ Расширенные поля NarrativeIntroEntry типизированы корректно
✓ JSON-схема содержит спецификацию полей image, camera, duration
✓ Руководство ИИ содержит исчерпывающие инструкции по анимациям, камере и нарративу
--- Все проверки успешно пройдены! ---
--- Smoke test: Patch Chronicle Export & Import ---
✓ Базовый снимок успешно зафиксирован, список изменений пуст
✓ Изменения и добавления точно отслежены: added: Предмет: Лечебное зелье, modified: Предмет: Меч мастера, modified: Манифест структуры
✓ Текстовая сводка для буфера сгенерирована корректно
✓ Пакет изменений содержит ТОЛЬКО изменённые файлы и исключает неизменённый контент
✓ Патч успешно применён поверх целевой кампании без потери нетронутых файлов
--- Все проверки пакета изменений (Diff Patch) успешно пройдены! ---
✓ утилита существует: public/ai/cutout-chromakey.py
✓ утилита существует: scripts/cutout-chromakey.py
✓ обе копии утилиты идентичны
… SKIP функциональных тестов: у интерпретатора [python3] нет Pillow (установите python3-pil или задайте CHROMA_SMOKE_PYTHON)
✓ гайд ИИ: якоря хромакей, cutout-chromakey.py, #00FF00, шахматк, --heal, бирюз
✓ гайд чемодана: якоря хромакей, cutout-chromakey.py, #00FF00, --heal, бирюз
✓ книга мастера: якоря cutout-chromakey.py, Visual Continuity, #00FF00
✓ campaignAudit.ts советует cutout-chromakey.py при непрозрачных углах
✓ campaignAudit.ts проверяет рамку и атмосферные спрайты

хромакей: все проверки зелёные
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/campAvailable: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.runPackOperation (/home/user/narthex/src/core/engine.ts:155:27)
    at GameEngine.campAvailable (/home/user/narthex/src/core/engine.ts:399:66)
    at main (/home/user/narthex/scripts/smoke-duration-actions.mts:84:49)
    at async <anonymous> (/home/user/narthex/scripts/smoke-duration-actions.mts:235:1) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'campAvailable',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
/home/user/narthex/src/core/pack/host.ts:342
    if (!result.ok) throw new PackOperationError(result.refusal)
                          ^

PackOperationError: PACK_OPERATION_MISSING: (host)/diceRules: operation is not registered
    at PackOperationHost.invoke (/home/user/narthex/src/core/pack/host.ts:342:27)
    at GameEngine.diceRules (/home/user/narthex/src/core/checks.ts:351:72)
    at GameEngine.get diceRules (/home/user/narthex/src/core/engine.ts:460:56)
    at GameEngine.playerSkillCheck (/home/user/narthex/src/core/character.ts:332:89)
    at GameEngine.playerSkillCheck (/home/user/narthex/src/core/engine.ts:429:136)
    at GameEngine.craft (/home/user/narthex/src/core/economy.ts:306:24)
    at GameEngine.craft (/home/user/narthex/src/core/engine.ts:453:59)
    at main (/home/user/narthex/scripts/smoke-craft-fail-time.mts:75:20)
    at async <anonymous> (/home/user/narthex/scripts/smoke-craft-fail-time.mts:131:1) {
  code: 'PACK_OPERATION_MISSING',
  refusal: {
    code: 'PACK_OPERATION_MISSING',
    packId: '(host)',
    operation: 'diceRules',
    reason: 'operation is not registered'
  }
}

Node.js v22.22.3
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/user/narthex/src/core/dialogue' imported from /home/user/narthex/scripts/smoke-dialogue-speaker.mts
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:985:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:747:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:783:38)
    at nextStep (node:internal/modules/customization_hooks:189:26)
    at resolveBaseSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:11092)
    at resolveDirectorySync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:12398)
    at resolveTsPathsSync (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:13605)
    at resolve (file:///home/user/narthex/node_modules/tsx/dist/register-nyXW-TH3.mjs:2:16832) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/user/narthex/src/core/dialogue'
}

Node.js v22.22.3
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: версия 1.4.86
    at file:///home/user/narthex/_tools/ScriptCat/tests/narthex-closed-state-smoke.mjs:18:8
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: '// ==UserScript==\n' +
    '// @name         Narthex — передача хода между агентами\n' +
    '// @namespace    https://arena.ai/\n' +
    '// @version      1.4.90\n' +
    '// @description  Цикл Координатор → исполнитель → Координатор: агент сам коммитит, пушит и мержит PR; ScriptCat ждёт мерж и нажимает Continue.\n' +
    '// @match        https://arena.ai/*\n' +
    '// @match        https://www.arena.ai/*\n' +
    '// @run-at       document-idle\n' +
    '// @grant        GM_xmlhttpRequest\n' +
    '// @grant        GM_getValue\n' +
    '// @grant        GM_setValue\n' +
    '// @connect      api.notion.com\n' +
    '// @connect      script.google.com\n' +
    '// @connect      script.googleusercontent.com\n' +
    '// @connect      ntfy.sh\n' +
    '// @connect      api.github.com\n' +
    '// ==/UserScript==\n' +
    '\n' +
    '/**\n' +
    ' * Narthex dispatch — тонкий транспорт.\n' +
    ' *\n' +
    ' * Разделение труда (важно, иначе всё ломается):\n' +
    ' *  - АГЕНТ сам делает `git commit`, `git push`, `gh pr create`, `gh pr merge`\n' +
    ' *    и заканчивает ответ маркером результата.\n' +
    ' *  - SCRIPT ждёт состояние «PR merged», нажимает Continue и пишет ветку.\n' +
    ' *    Кнопки Create/Merge — только запасной путь, если агент не справился сам:\n' +
    ' *    каждая кнопка порождает ответ агента, то есть новый chat-message.\n' +
    ' *  - РЕШЕНИЯ о работе (какая задача, принята ли карточка) принимает\n' +
    ' *    Координатор. Конец миссии — не его решение: next:"done" передаёт миссию\n' +
    ' *    приёмке (роль с функцией Reviewer), и только её `accept` останавливает\n' +
    ' *    цикл. Больше трёх доработок не бывает: четвёртый возврат будит Мастера.\n' +
    ' *\n' +
    ' * Состояния PR, которые скрипт различает:\n' +
    ' *   Merged   — бейдж «Pull request merged»; мерж подтверждён интерфейсом.\n' +
    ' *   Closed   — бейдж «Pull request closed». Так выглядит и PR, слитый через\n' +
    ' *              GitHub, и PR, закрытый без мержа; что именно — решает маркер\n' +
    ' *              исполнителя (`merged: true`). Без заявки о мерже карточка\n' +
    ' *              уходит в Rework с причиной, а цикл продолжается.\n' +
    ' *   Timeout  — за prWaitMs мерж не появился: пауза, решение за человеком.\n' +
    ' *\n' +
    ' * Требует совместимого шлюза Drive с CF_DISPATCH, Notion-токена с доступом\n' +
    ' * к источникам и GitHub-токена на чтение PR: приватный репозиторий отвечает 404.\n' +
    ' */\n' +
    '\n' +
    '(() => {\n' +
    '  "use strict";\n' +
    '\n' +
    '  // ───────────────────────────── конфиг ─────────────────────────────\n' +
    '  const C = {\n' +
    '    notionV: "2025-09-03",\n' +
    '    roles: "ed076bfe-99dd-447d-9cac-55ca14661e99",\n' +
    '    missions: "c84a3f11-2dcf-414d-b4bf-35beaa7b2c0c",\n' +
    '    requests: "11b41fcc-7c84-406d-bc3b-5bf76ace79bb",\n' +
    '    // База «Вопросы»: вопросы агентов к Мастеру, которые не останавливают цикл.\n' +
    '    questions: "54ac1a79-fef2-4384-ac2c-c0f53379d3ab",\n' +
    '    questionsUrl: "https://app.notion.com/p/e00d99c8b526461ea7e900b9e988e149",\n' +
    '    questionHours: 24, // срок молчания по умолчанию: дальше действует вариант агента\n' +
    '    questionLineMax: 3, // сколько вопросов и ответов видно в одном промпте\n' +
    '    questionTextMax: 180, // столько влезает в заголовок «Вопрос» читаемо\n' +
    '    questionTextFull: 12000, // полный текст — в тело страницы вопроса, его не режем\n' +
    '    questionDefaultMax: 200,\n' +
    '    questionCheckMs: 600000, // как часто проверять сроки вопросов (10 минут)\n' +
    '    adrCheckMs: 600000, // как часто смотреть docs/decisions на proposed (10 минут)\n' +
    '    pageUrl: "https://app.notion.com/p/Narthex-4016f0cf570581f7a1f7c3661c608ffd",\n' +
    '    repo: "Creative36711/narthex", // для ссылки на PR из номера\n' +
    '    tickMs: 15000,\n' +
    '    mergeGraceMs: 90000, // сколько ждём мерж, прежде чем нажать кнопки за агента\n' +
    '    arenaResendMax: 1, // один минимальный повтор после ошибки Arena; второй отказ — пауза\n' +
    '    arenaRetryMs: 180000, // ошибка старше трёх минут уже не про нашу отправку\n' +
    '    maxReloadAttempts: 3, // максимум автоматических перезагрузок страницы при ошибке Arena\n' +
    '    reloadCountPrefix: "cf-auto-error-reload-count:", // префикс ключа счётчика перезагрузок\n' +
    '    continueWaitMs: 20000, // после Merged ждём Continue: без неё агент не получит новую ветку\n' +
    '    prCardWaitMs: 8000, // карточка PR может отрисоваться позже ответа\n' +
    '    prWaitMs: 300000, // общий предел ожидания мержа\n' +
    '    maxLog: 200, // журнал хранится в ScriptCat; панель показывает хвост\n' +
    '    markerIdleMs: 20000, // ответ стабилен столько — считаем, что маркера не будет\n' +
    '    markerReminders: 2, // напоминаний до паузы: дальше решает Мастер\n' +
    '    minAnswerChars: 200, // маркер без отчёта — не ответ: короче — просим отчёт заново\n' +
    '    draftLineMax: 6, // сколько черновиков Координатор видит списком в промпте\n' +
    '    readyLineMax: 6, // сколько карточек Ready Координатор видит списком в промпте\n' +
    '    insertRetries: 3, // с какой попытки вставки в редактор звать Мастера (раньше — сами)\n' +
    '    composerGraceMs: 8000, // сколько ждём возврата поля ввода, если оно исчезло при перерисовке\n' +
    '    sendRetries: 3, // сколько тиков ждём дорисовку страницы, прежде чем звать Мастера\n' +
    '    sendReadyMs: 20000, // столько ждём активную кнопку Send на дорисовывающейся странице\n' +
    '    clickReadyMs: 8000, // столько ждём кнопку, прежде чем считать её недоступной\n' +
    '    pendingTtlMs: 600000, // отправка старше 10 минут не досылается: адресат её не получил\n' +
    '    undeliveredTtlMs: 7200000, // неотправленное задание ждёт Мастера два часа, а не десять минут\n' +
    '    replyWaitMs: 1800000, // 30 минут без единого сообщения — повод остановиться\n' +
    '    pageWaitMs: 90000, // страница адресата не отрисовалась — это «нет связи», а не молчание агента\n' +
    '    pageReloadMs: 20000, // столько ждём отрисовку, прежде чем перечитать страницу один раз\n' +
    '    observeGraceMs: 30000, // сколько смотрим на отрисованную страницу, прежде чем судить о молчании\n' +
    '    sendVerifyMs: 6000, // сколько ждём своё сообщение в чате после нажатия Send\n' +
    '    captchaGuardMs: 8000, // сколько после «отправлено» ждём капчу: она всплывает с задержкой\n' +
    '    stalledMs: 2700000, // 45 минут — и только для карточки, по которой ход потерян\n' +
    '    orphanGraceMs: 120000, // столько ждём, прежде чем вернуть в Ready карточку без хода\n' +
    '    longWaitNoticeMs: 600000, // раз в 10 минут напоминаем, что долгое ожидание — норма\n' +
    '    pollPauseCount: 3, // столько опросов подряд — уже поломка промпта, а не случайность\n' +
    '    reworkLimit: 3, // доработок миссии больше этого — стоп и вызов Мастера\n' +
    '    retryWaits: [800, 2500, 6000], // выдержки перед повторами: 4 попытки, ~9 с\n' +
    '    linkProbeWaits: [5000, 15000], // зонды связи после обрыва: 5 и 15 с\n' +
    '    rolesCacheMs: 600000, // база «Роли» — настройка: кеш на 10 минут\n' +
    '  };\n' +
    '\n' +
    '  const K = {\n' +
    '    notion: "cfn-notion-token",\n' +
    '    gwUrl: "cfn-gw-url",\n' +
    '    gwKey: "cfn-gw-key",\n' +
    '    auto: "cfn-auto-enabled",\n' +
    '    paused: "cfn-paused",\n' +
    '    log: "cfn-console-log",\n' +
    '    pending: "cfn-pending",\n' +
    '    expect: "cfn-expect",\n' +
    '    mission: "cfn-mission-id",\n' +
    '    merged: "cfn-merged:",\n' +
    '    branch: "cfn-branch",\n' +
    '    pause: "cfn-pause-context",\n' +
    '    ntfyTopic: "cfn-ntfy-topic",\n' +
    '    ntfyToken: "cfn-ntfy-token",\n' +
    '    ghToken: "cfn-github-token",\n' +
    '    ghAsk: "cfn-github-ask",\n' +
    '    lastResult: "cfn-last-result",\n' +
    '    errSeen: "cfn-error-seen",\n' +
    '    step: "cfn-step-request",\n' +
    '    debug: "cfn-debug",\n' +
    '    lastSend: "cfn-last-send",\n' +
    '    deadSend: "cfn-dead-send",\n' +
    '    qQueue: "cfn-q-queue",\n' +
    '    answers: "cfn-answer-queue",\n' +
    '    collapsed: "cfn-panel-collapsed",\n' +
    '    stateV: "cfn-state-v",\n' +
    '    rolesCache: "cfn-roles-cache",\n' +
    '  };\n' +
    '\n' +
    '  const ui = {\n' +
    '    panel: "cfn-panel",\n' +
    '    log: "cfn-log",\n' +
    '    status: "cfn-status",\n' +
    '    toggle: "cfn-toggle",\n' +
    '    step: "cfn-step",\n' +
    '    setup: "cfn-setup",\n' +
    '    stop: "cfn-stop",\n' +
    '    clear: "cfn-clear",\n' +
    '    reset: "cfn-reset",\n' +
    '    ntfy: "cfn-ntfy",\n' +
    '    gh: "cfn-gh",\n' +
    '    questions: "cfn-questions",\n' +
    '    qBadge: "cfn-q-badge",\n' +
    '    adr: "cfn-adr",\n' +
    '    adrBadge: "cfn-adr-badge",\n' +
    '    collapse: "cfn-collapse",\n' +
    '    count: "cfn-log-count",\n' +
    '    debug: "cfn-debug-toggle",\n' +
    '  };\n' +
    '\n' +
    '  // ───────────────────────────── утилиты ─────────────────────────────\n' +
    '  /**\n' +
    '   * Момент последнего признака жизни шага. Объявлен здесь, а не рядом с циклом:\n' +
    '   * `sleep` нужен всем, и он же отмечает, что шаг жив.\n' +
    '   */\n' +
    '  let busyAt = 0;\n' +
    '\n' +
    '  /**\n' +
    '   * Пауза с отметкой «шаг жив». Сторож снимает блокировку по двухминутной\n' +
    '   * тишине, поэтому долгая, но честная работа не должна выглядеть зависанием:\n' +
    '   * 24.10 в 14:48 живого шага как раз и перезапустили поверх первого.\n' +
    '   */\n' +
    '  const sleep = (ms) => {\n' +
    '    busyAt = Date.now();\n' +
    '    return new Promise((r) => setTimeout(r, ms));\n' +
    '  };\n' +
    '  const norm = (x) => String(x || "").replace(/-/g, "").toLowerCase();\n' +
    '  /** Текст для сравнения: без разницы в регистре и пробелах. */\n' +
    '  const flat = (x) => String(x || "").replace(/[\\s\\u00a0]+/g, " ").trim().toLowerCase();\n' +
    '  const nowIso = () => new Date().toISOString();\n' +
    '  const rt = (p) => (p?.rich_text || p?.title || []).map((x) => x.plain_text || x.text?.content || "").join("");\n' +
    '\n' +
    '  /**\n' +
    '   * `rich_text` для поля Notion: один объект — не больше 2000 знаков.\n' +
    '   *\n' +
    '   * 28.10 в 22:00 цикл дважды подряд встал на записи ответа приёмки: Notion\n' +
    '   * ответил HTTP 400 «body.properties.Ответ.rich_text[0].text.content.length\n' +
    '   * should be ≤ 2000, instead was 2296». Ответ был верный и полный — длина\n' +
    '   * решения не порок, а предел одного объекта. Notion принимает до 100\n' +
    '   * объектов в массиве, поэтому длинный текст режется на части и уезжает\n' +
    '   * целиком, без потери второй половины решения.\n' +
    '   *\n' +
    '   * Ошибка транспорта была второй и худшей: любой HTTP-ответ, включая 400,\n' +
    '   * назывался «Notion не ответил: сеть или блокировка запроса» — сеть тут ни\n' +
    '   * при чём, Notion ответил и объяснил причину.\n' +
    '   */\n' +
    '  function richText(value, step = 1900) {\n' +
    '    const text = String(value == null ? "" : value);\n' +
    '    const parts = [];\n' +
    '    let at = 0;\n' +
    '    while (at < text.length && parts.length < 100) {\n' +
    '      let end = Math.min(text.length, at + step);\n' +
    '      // Суррогатная пара на границе: половина эмодзи ломает JSON запроса.\n' +
    '      const code = text.charCodeAt(end - 1);\n' +
    '      if (end < text.length && code >= 0xd800 && code <= 0xdbff) end -= 1;\n' +
    '      parts.push({ type: "text", text: { content: text.slice(at, end) } });\n' +
    '      at = end;\n' +
    '    }\n' +
    '    return parts;\n' +
    '  }\n' +
    '  const sel = (p) => p?.select?.name || "";\n' +
    '  const uid = () => crypto.randomUUID();\n' +
    '\n' +
    '  /**\n' +
    '   * Видимость по геометрии плюс computed style. Одного querySelector мало:\n' +
    '   * в DOM Arena остаются скрытые бейджи и кнопки прошлых'... 464072 more characters,
  expected: /@version\s+1\.4\.86/,
  operator: 'match',
  diff: 'simple'
}

Node.js v22.22.3
OK: техблок 1.4.63 — Executor получает ритуал main, Auditor только читает main, Coordinator без git
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: createLog выполняется

false !== true

    at file:///home/user/narthex/_tools/ScriptCat/tests/drive-gateway-arena-smoke.mjs:198:10 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.22.3

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
  ✗ featureOn реализован в caps.ts, а не в types.ts
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

ПРОВАЛЕНО: 1
  - featureOn реализован в caps.ts, а не в types.ts
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
> npm install --prefix "/tmp/narthex-parity-browser-q6G4uD" --no-save --ignore-scripts --no-audit --no-fund @sparticuz/chromium@131 playwright-core@1.49.1

added 20 packages in 2s
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


  ! eslint(no-unused-vars): Variable 'current' is declared but never used. Unused variables should start with a '_'.
     ,-[scripts/schema-freeze.mts:141:9]
 140 |   }
 141 |   const current = new Set(entry.paths)
     :         ^^^|^^^
     :            `-- 'current' is declared here
 142 |   for (const path of frozen) {
[Сокращено 115661 строк диагностик warnings; полный вывод сохранён локально /tmp/stab-npm_run_lint.log.]
  ! react(immutability): This value cannot be modified
    ,-[src/editor/AtmosEditors.tsx:63:18]
 62 |     <div>
 63 |       {list.map((a, i) => (
    :                  |
    :                  `-- `a` originates here
 64 |         <details key={a.id} className="need-conds" style={{ marginBottom: 6 }}>
    `----
     ,-[src/editor/AtmosEditors.tsx:150:105]
 149 |           <label className="fld fld-check" data-tip="Частицы возрождаются за краем экрана (умолчание — да)">
 150 |             <input type="checkbox" checked={a.loop !== false} onChange={(e) => { if (!e.target.checked) a.loop = false; else delete a.loop; commit() }} />
     :                                                                                                         |
     :                                                                                                         `-- `a` cannot be modified
 151 |             <span>Бесконечная атмосфера</span>
     `----
  help: Modifying a value used previously in JSX is not allowed. Consider moving the modification before the JSX
  note: React Compiler skipped optimizing this component or hook. Additional guidance: https://react.dev/reference/eslint-plugin-react-hooks/lints/immutability

Found 1515 warnings and 0 errors.
Finished in 828ms on 472 files with 116 rules using 2 threads.
```

### `npm run check:audit-bundle` — rc=1

```text

> chronicle-forge@0.8.0 check:audit-bundle
> tsx scripts/check-audit-bundle.mts

✗ public/ai/campaign-audit.mjs is stale relative to scripts/campaign-audit.mts
  committed: 981858 bytes, sha256 c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f
  generated: 994619 bytes, sha256 81cbb8833f3fb226381501c41ac2557e557fee73ddd4a10d82b3b8c211299261
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
changed source modules=57
module packs/state-ui/cards.ts: 192/450 lines (changed)
module packs/state-ui/cardsPanel.ts: 31/450 lines (changed)
module packs/state-ui/machine.ts: 22/450 lines (changed)
module packs/state-ui/panel.ts: 31/450 lines (changed)
module packs/state-ui/probe.mts: 270/450 lines (changed)
module packs/state-ui/types.ts: 105/450 lines (changed)
module packs/state-ui/validate.ts: 94/450 lines (changed)
module packs/state-ui/validateCards.ts: 85/450 lines (changed)
module src/App.tsx: 470/450 lines (changed)
module src/core/caps.ts: 137/450 lines (changed)
module src/core/engine.ts: 594/600 lines (changed)
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
module src/shared/types.ts: 3412/450 lines (changed)
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
✗ src/shared/types.ts: 3412 lines exceeds limit=450
check:module-size failed: 11 module(s) exceed their limit
```


## Diff stat (код; отчёт добавлен отдельно)

```text
 src/core/caps.ts    |  8 ++------
 src/core/engine.ts  |  6 +++---
 src/shared/types.ts | 14 +++++++++++---
 3 files changed, 16 insertions(+), 12 deletions(-)
```

Полный SHA базы: `4d4eb7e9a6423366957576af5c9e77e22d66f717`.
