# NAR-2.6-А — паспорт пака `adventure`

неясно — как зарегистрировать тип проекта до появления самого пака, не включая его в installed registry и не добавляя зависимость `narrative` в `kind`.

решил — добавить только три записи данных в `docs/contracts/caps.json`: пак `adventure` (`turn`, `experimental`), одноимённую experimental-возможность с `probe:adventure` и kind, который требует только `adventure`. В runtime-реестр добавлена ровно одна строка литерала `CAPABILITY_REGISTRY`; поведение не меняется. Будущая зависимость от `narrative` останется в `requires.caps` манифеста пака. Проба использует общий resolver и отдельный uninstalled-view, чтобы негативный контроль `PACK_MISSING` продолжал работать и после будущей установки пака.

откат — удалить три записи контракта, одну строку runtime-реестра, `scripts/adventure-probe.mts`, регистрацию `probe:adventure` и эту запись; установленные паки, проекты, сейвы и поведение ядра не затрагиваются.

Допущение: `since: 2` соответствует фазе 2 («Шов движок / пак») из `docs/phases.md`; title и английский `enables` являются описательными данными и не участвуют в поведении.

---

## Отчёт приёмки

Ниже — объединённый stdout/stderr финальных команд и код возврата после каждого блока. Проба и контракты проверяют только паспорт; installed registry по-прежнему содержит два пака.

### `npm run probe:adventure`

```text

> narthex@0.9.0 probe:adventure
> tsx scripts/adventure-probe.mts

✓ паспорт пака adventure: runtime=turn · status=experimental
✓ возможность adventure: pack=adventure · status=experimental · probe=probe:adventure
✓ тип проекта adventure → пак adventure · requires=["adventure"]
✓ resolveProjectPack({kind:"adventure"}): PACK_MISSING · packId=adventure
  Установите каталог packs/adventure/ с pack.json, добавьте «adventure» в packs/registry.json и перезапустите студию.
ADVENTURE_PASSPORT_PROBE passed
```
rc=0

### `npm run check:contracts`

```text

> narthex@0.9.0 check:contracts
> tsx scripts/contracts-check.mts && npm run check:packs

  ✓ caps.json совпадает с runtime-реестром src/core/caps.ts
  ✓ синтетическое расхождение реестров отклоняется
  ✓ featureOn реализован в caps.ts, а не в types.ts
  ✓ у каждой возможности есть назначение и проба по статусу
  ✓ пробы возможностей существуют в npm scripts

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

пример проекта narrative
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

контракты согласованы: 41 проверок

> narthex@0.9.0 check:packs
> tsx scripts/check-packs.mts

pack grid-strategy: schema, registry, caps, local schemas, and import boundaries OK
pack narrative: schema, registry, caps, local schemas, and import boundaries OK
pack schema copy: in sync
registry: 2 pack manifests in manifest order
fixture cross-pack-import: PASS — rejected (checker exit 1): packs/fixtures/cross-pack-import/src/index.ts: imports another pack "grid-strategy" via "../../../grid-strategy/pack.json"
fixture full: PASS — accepted (checker exit 0)
fixture missing-probes: PASS — rejected (checker exit 1): packs/fixtures/missing-probes/pack.json: /provides must have required property 'probes'
fixture unknown-capability: PASS — rejected (checker exit 1): packs/fixtures/unknown-capability/pack.json: caps contains unknown capability "not-registered-capability"

check:packs passed
```
rc=0

### `npm run check:packs`

```text

> narthex@0.9.0 check:packs
> tsx scripts/check-packs.mts

pack grid-strategy: schema, registry, caps, local schemas, and import boundaries OK
pack narrative: schema, registry, caps, local schemas, and import boundaries OK
pack schema copy: in sync
registry: 2 pack manifests in manifest order
fixture cross-pack-import: PASS — rejected (checker exit 1): packs/fixtures/cross-pack-import/src/index.ts: imports another pack "grid-strategy" via "../../../grid-strategy/pack.json"
fixture full: PASS — accepted (checker exit 0)
fixture missing-probes: PASS — rejected (checker exit 1): packs/fixtures/missing-probes/pack.json: /provides must have required property 'probes'
fixture unknown-capability: PASS — rejected (checker exit 1): packs/fixtures/unknown-capability/pack.json: caps contains unknown capability "not-registered-capability"

check:packs passed
```
rc=0

### `node public/ai/cf-play.mjs explain --catalogue`

```text
narrative — Сюжет и ветвление · v1.1.0 · runtime turn
  capabilities: narrative, scenes, dialogue, map, inventory, needs, skills, relationships, trade, combat, quests, cutscenes, codex, crafting, time
  panels: scenes, dialogue, flow, map, quests
  validators: dangling-goto, unreachable-scene, dangling-ink-knot, dangling-quest-stage
  probes: reachability, dialogue-coverage, route-smoke, quest-transitions
  seams: narrative.sim (sim), narrative.view (view)
grid-strategy — Сетки, тактика, менеджмент · v0.1.0 · runtime turn
  capabilities: grid, pathfinding, units, economy, ai-director
  panels: grid-map, units, economy
  validators: grid-connectivity, unit-overflow, negative-income
  probes: path-exists, ai-turn
```
rc=0

### `npx tsc -b`

```text

```
rc=0

### `npm run check:core-graph`

```text

> narthex@0.9.0 check:core-graph
> tsx scripts/core-graph.mts

Core graph OK (34 modules; acyclic; no core imports of engine.ts).
```
rc=0

### `npm run check:brand`

```text

> narthex@0.9.0 check:brand
> tsx scripts/brand-guard.mts

✓ старое имя не встречается (проверено файлов: 816)
```
rc=0

### `npm run check:version`

```text

> narthex@0.9.0 check:version
> tsx scripts/version.mts check

✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG
```
rc=0

### `npm run probe:narrative-pack`

```text

> narthex@0.9.0 probe:narrative-pack
> tsx packs/narrative/probes/campaign.mts

✓ манифест и локальные схемы: 10 сцен, 8 локаций, 6 диалогов, 4 квеста
✓ catalogue из packs/registry.json и pack.json:
  narrative: narrative, scenes, dialogue, map, inventory, needs, skills, relationships, trade, combat, quests, cutscenes, codex, crafting, time
  grid-strategy: grid, pathfinding, units, economy, ai-director
✓ host + реальный маршрут: 20/20 детерминированы; view on/off sha256=4f42b2296e647c55ca3d54ae04e5af9e513f063ad046bf3c5c100749ca67b4fe
✓ сцены, 6 диалогов и 4 квеста прошли через sim; view использовал только draw-порт
✓ headless не вызывает view; исходное состояние не мутируется
# Проверка кампании · Пепел Каэрдена

✓ проверка пройдена

## Статика
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
- flag_written_never_read: флаг «guard_ration_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «herbs_gathered» выставляется, но нигде не читается
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается
- flag_written_never_read: флаг «medallion_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «skeleton_looted» выставляется, но нигде не читается
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается
- flag_written_never_read: флаг «wrench_taken» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/home/user/narthex/packs/narrative/data/ash-of-caerden/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp

✓ эталон §2.1 на данных пака совпал: 0 errors / 8 warnings, 5 смертей, покрытие 6/10
NARRATIVE_PACK_PROBE passed
```
rc=0

### `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure --out /tmp/nar-2-6-a-campaign-check`

```text
# Проверка кампании · Пепел Каэрдена

✓ проверка пройдена

## Статика
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
- flag_written_never_read: флаг «guard_ration_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «herbs_gathered» выставляется, но нигде не читается
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается
- flag_written_never_read: флаг «medallion_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «skeleton_looted» выставляется, но нигде не читается
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается
- flag_written_never_read: флаг «wrench_taken» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/ash-of-caerden-adventure/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp
```
rc=0

### `npm run check:campaigns`

```text

> narthex@0.9.0 check:campaigns
> tsx scripts/campaign-copies.mts

✓ narrative/ash-of-caerden: 99 файлов копии совпадают с паком
✓ narrative/ash-of-caerden → public/campaigns/ash-of-caerden-adventure: 99 файлов копии совпадают с паком
✓ публичные копии кампаний — артефакты паков: 2 из 2 сверены
```
rc=0

## Зарегистрированные smoke-пробы

В `package.json` зарегистрировано 53 `smoke:*` script-а. Каждый запущен отдельной командой `npm run`; вывод не сокращён. Известные пропуски `dialogues-r31/r32` сохранены как есть.

### 1/53 · `npm run smoke:currency`

```text

> narthex@0.9.0 smoke:currency
> tsx scripts/currency-smoke.mts

✓ Валюта: начальный баланс, траты и поступления синхронизированы с предметами в инвентаре
```
rc=0

### 2/53 · `npm run smoke:ink-import`

```text

> narthex@0.9.0 smoke:ink-import
> tsx scripts/ink-import-smoke.mts

✓ папка диалогов полигона на месте — 6 файлов
✓ aldric.ink: импорт без потерь — 3 узлов
✓ aldric.ink: тексты ответов сохранены (7)
✓ aldric.ink: пороги условий сохранены (1)
✓ aldric.ink: эффекты сохранены (5)
✓ aldric.ink: нет мусорных скобок в репликах
✓ bran.ink: импорт без потерь — 1 узлов
✓ bran.ink: тексты ответов сохранены (4)
✓ bran.ink: пороги условий сохранены (0)
✓ bran.ink: эффекты сохранены (5)
✓ bran.ink: нет мусорных скобок в репликах
✓ corvin.ink: импорт без потерь — 1 узлов
✓ corvin.ink: тексты ответов сохранены (5)
✓ corvin.ink: пороги условий сохранены (1)
✓ corvin.ink: эффекты сохранены (5)
✓ corvin.ink: нет мусорных скобок в репликах
✓ lena.ink: импорт без потерь — 1 узлов
✓ lena.ink: тексты ответов сохранены (3)
✓ lena.ink: пороги условий сохранены (1)
✓ lena.ink: эффекты сохранены (2)
✓ lena.ink: нет мусорных скобок в репликах
✓ maeva.ink: импорт без потерь — 3 узлов
✓ maeva.ink: тексты ответов сохранены (11)
✓ maeva.ink: пороги условий сохранены (3)
✓ maeva.ink: эффекты сохранены (13)
✓ maeva.ink: нет мусорных скобок в репликах
✓ yorek.ink: импорт без потерь — 3 узлов
✓ yorek.ink: тексты ответов сохранены (4)
✓ yorek.ink: пороги условий сохранены (1)
✓ yorek.ink: эффекты сохранены (6)
✓ yorek.ink: нет мусорных скобок в репликах
✓ повторный импорт пересборки стабилен (aldric)
✓ aldric.ink: round-trip посимвольный
✓ bran.ink: round-trip посимвольный
✓ corvin.ink: round-trip посимвольный
✓ lena.ink: round-trip посимвольный
✓ maeva.ink: round-trip посимвольный
✓ yorek.ink: round-trip посимвольный
✓ corvin: порог лечения hp ≥ 12 разобран — {"type":"hp_ge","value":12}
✓ aldric.dlg.json: визуальный исходник на месте
✓ aldric.dlg.json: название диалога по-русски — Алдрик, стражник ворот
✓ aldric.dlg.json: названия узлов по-русски
✓ bran.dlg.json: визуальный исходник на месте
✓ bran.dlg.json: название диалога по-русски — Бран, торговец с рынка
✓ bran.dlg.json: названия узлов по-русски
✓ corvin.dlg.json: визуальный исходник на месте
✓ corvin.dlg.json: название диалога по-русски — Отец Корвин, священник храма
✓ corvin.dlg.json: названия узлов по-русски
✓ lena.dlg.json: визуальный исходник на месте
✓ lena.dlg.json: название диалога по-русски — Лена, ночная осведомительница
✓ lena.dlg.json: названия узлов по-русски
✓ maeva.dlg.json: визуальный исходник на месте
✓ maeva.dlg.json: название диалога по-русски — Маэва, хозяйка «Дубового щита»
✓ maeva.dlg.json: названия узлов по-русски
✓ yorek.dlg.json: визуальный исходник на месте
✓ yorek.dlg.json: название диалога по-русски — Йорек, вожак банды
✓ yorek.dlg.json: названия узлов по-русски

все проверки зелёные
```
rc=0

### 3/53 · `npm run smoke:fingerprint`

```text

> narthex@0.9.0 smoke:fingerprint
> tsx scripts/fingerprint-smoke.mts

✓ канонический JSON не зависит от порядка ключей
✓ отпечаток стабилен при перемешивании ключей
✓ смена полей публикации (author/attribution/series) отпечаток НЕ меняет — вор не «заначит» чужую кампанию сменой титула
✓ смена контента отпечаток меняет
✓ отпечаток считается без author/attribution вообще

все проверки зелёные
```
rc=0

### 4/53 · `npm run smoke:book-md`

```text

> narthex@0.9.0 smoke:book-md
> tsx scripts/book-md-smoke.mts

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
```
rc=0

### 5/53 · `npm run smoke:campaign-index`

```text

> narthex@0.9.0 smoke:campaign-index
> tsx scripts/campaign-index-smoke.mts

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
✓ импорт .narthex обновляет подпись, сохраняя ID текущей папки
✓ в выпадающем списке редактора живое название открытой папки
✓ меню дописывает текущую кампанию в список из файла
✓ в приложении нет захардкоженной кампании по умолчанию
✓ выбор кампании идёт через реестр (pickCampaign)

все проверки зелёные
```
rc=0

### 6/53 · `npm run smoke:guide`

```text

> narthex@0.9.0 smoke:guide
> tsx scripts/guide-schema-guard.mts

✓ пример версии движка в гайде синхронизирован с ENGINE_VERSION
    ожидается 0.9.0; не путать с version кампании
✓ а) все JSON-литералы эффектов/условий в гайде валидны по схеме
✓ б) каждый тип из схемы (129) упомянут в гайде
    не упомянуты:
✓ в) поля в сниппетах «тип { … }» существуют у этого типа
✓ г) в бэктиках гайда нет несуществующих механик
    не нашли в схеме, в лексике полигона и в ENGINE_VOCABULARY:

гайд и схема согласованы
```
rc=0

### 7/53 · `npm run smoke:design-doc`

```text

> narthex@0.9.0 smoke:design-doc
> tsx scripts/design-doc-guard.mts

✓ бланк: все обязательные разделы на месте и по порядку
✓ бланк: сначала план, затем полный результат в том же ответе
✓ бланк: в теле нет технических идентификаторов вне приложения (§R7)
✓ инструкция: сначала дизайн-документ, затем полный результат в том же ответе
✓ инструкция: документ обновляется на каждой итерации
✓ инструкция: задача выполняется целиком без ожидания «ок» и вопросов
✓ бланк: дизайн-документ не используется как этап подтверждения
✓ инструкция: полный результат — .narthex, JSON оставлен для правок без медиа
✓ §0 гайда синхронизирован с docs/ai-start-instruction.md
✓ заголовок §0 — «С чего начать», без упоминания стартового txt
✓ манифест справочных файлов совпадает с public/ai
✓ задание ИИ собирает контекст кампании, бриф, руководство и отчёт проверки
✓ campaign.schema.json: design_doc есть в CampaignMeta и необязателен
    type=string

дизайн-документ согласован
```
rc=0

### 8/53 · `npm run smoke:quest-journal`

```text

> narthex@0.9.0 smoke:quest-journal
> tsx scripts/quest-journal-smoke.mts

✓ j_search resolves to Russian text and its publishing stage — Начало — Отец Корвин просит вернуть медальон Вечного Света: вор, укравший реликвию, сгинул в забро…
✓ j_found resolves to Russian text and its publishing stage — Реликвия найдена — Медальон у меня. Осталось вернуть его отцу Корвину в храм.
✓ j_completed resolves to Russian text and its publishing stage — Завершение — Реликвия вернулась в храм. Корвин благословил меня — рука теперь твёрже уходит от ударов,…
✓ new journal keys use their own namespace, not stage ids
✓ new journal keys avoid collisions
✓ unmapped record still gets a human-readable fallback
ALL GREEN
```
rc=0

### 9/53 · `npm run smoke:quest-journal-runtime`

```text

> narthex@0.9.0 smoke:quest-journal-runtime
> tsx scripts/quest-journal-runtime-smoke.mts

✓ starting stage publishes its independent j_search key
✓ found stage publishes its independent j_found key
✓ final stage publishes its independent j_completed key
✓ player journal contains prose, not internal keys
ALL GREEN
```
rc=0

### 10/53 · `npm run smoke:p2`

```text

> narthex@0.9.0 smoke:p2
> tsx scripts/p2-mechanics-smoke.mts

✓ 1 до правила состояние облика не задано
✓ 1 правило задало состояние облика
✓ 1 пустая строка снимает состояние
✓ 1 сцена спрашивает движок о состоянии облика
✓ 1 состояние движка сильнее свойства слота
✓ 1 портрет в диалоге берёт состояние движка
✓ 2 цепочка дошла до третьего звена
✓ 2 четвёртое звено отброшено ограничением глубины
✓ 2 в журнале сказано про глубину цепочки — е»
Кодекс пополнен: Долина Каэрден.
Правило не вызвано: превышена глубина цепочки вызовов.
✓ 2 условие once вызываемого правила соблюдено
✓ 3 закрытый рецепт не виден игроку — recipe_open_bread
✓ 3 открытый рецепт виден сразу
✓ 3 unlock_recipe открыл рецепт
✓ 3 внешняя команда Ink unlock_recipe есть
✓ 3 редактор умеет «Открыть по ходу игры»
✓ 4 первый забег: runs = 1 — 1
✓ 4 endings_seen = 0 до концовки
✓ 4 счётчик забега читается как есть — 3
✓ 4 концовка записана в хронику — ["ending_test"]
✓ 4 endings_seen = 1
✓ 4 victories = 1
✓ 4 мета-счётчик сложился с прошлым забегом — 3
✓ 4 runs = 2 после второго забега — 2
✓ 4 без metaprogress хроника на диск не пишется — narthex:meta:p2-smoke-chronicle, narthex:save:p2-smoke-chronicle
✓ 4 условие meta_counter исполняется
✓ 4 условие meta_counter умеет быть ложным
✓ 5 петля правил найдена с цепочкой — Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений)
✓ 5 в отчёте сказано про глубину 2
✓ 5 несуществующее правило в fire_rule найдено — Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений) | Правило «Вызов несуществующего правила»: эффект вызывает несуществующее правило «rule_no_such» | Правило «Открытие несуществующего рецепта»: открывается несуществующий рецепт «recipe_no_such» | Правило «Состояние облика не тому персонажу»: состояние облика назначается несуществующему персонажу «npc_no_such» | Правило «Состояние облика, которого нет»: состояние облика назначается несуществующему персонажу «npc_no_such» | Правило «Состояние облика, которого нет»: у персонажа «npc_maeva» нет состояния облика «withered» (есть: , neutral) | Кампания: стартовая локация «undefined» не найдена | Кампания: персонаж игрока «undefined» не найден
✓ 5 несуществующий рецепт в unlock_recipe найден
✓ 5 несуществующий персонаж в set_entity_state найден
✓ 5 несуществующее состояние облика найдено — Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений) | Правило «Вызов несуществующего правила»: эффект вызывает несуществующее правило «rule_no_such» | Правило «Открытие несуществующего рецепта»: открывается несуществующий рецепт «recipe_no_such» | Правило «Состояние облика не тому персонажу»: состояние облика назначается несуществующему персонажу «npc_no_such» | Правило «Состояние облика, которого нет»: состояние облика назначается несуществующему персонажу «npc_no_such» | Правило «Состояние облика, которого нет»: у персонажа «npc_maeva» нет состояния облика «withered» (есть: , neutral) | Кампания: стартовая локация «undefined» не найдена | Кампания: персонаж игрока «undefined» не найден
✓ 5 прямое самовызов правила найдено — Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений) | Правила вызывают друг друга по кругу: «Сам в себя» → «Сам в себя». Разорвите цепочку: вложенных вызовов правил может быть не больше 2, а правило не должно возвращаться в себя. | Кампания: стартовая локация «undefined» не найдена | Кампания: персонаж игрока «undefined» не найден
✓ 5 корректная ссылка unlock_recipe не ругается — Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений) | Кампания: стартовая локация «undefined» не найдена | Кампания: персонаж игрока «undefined» не найден
✓ 6 неизвестный рецепт создан закрытым — false
✓ 6 неизвестное состояние облика добавлено пустым
✓ 6 несуществующее правило вызова стало заглушкой — Правило «rule_ghost2» не найдено — создана заглушка
✓ 6 починка не падает
✓ 6 оба объекта с «одинаковым» именем файла сохранены — scene_old_map.json, scene_old_map_2.json
✓ 6 о совпадении имён сказано в отчёте — Сцена «scene_old_map»: имя файла scene_old_map.json уже занято другим объектом — записан как scene_old_map_2.json
✓ 6 id обоих объектов целы — scene_old-map, scene_old_map
✓ 7 28 повторов схлопнуты в одну строку — Сущность «item_шелка_1» не найдена — создана заглушка (таких 28: item_шелка_1, item_шелка_2, item_шелка_3, …)
✓ 7 в строке есть счётчик и имена — Сущность «item_шелка_1» не найдена — создана заглушка (таких 28: item_шелка_1, item_шелка_2, item_шелка_3, …)
✓ 7 подпись для мастера непустая
✓ 7 две одинаковые строки не схлопываются — 4
✓ 7 без повторов подпись пустая
✓ 7 чужие строки не слипаются — Сущность «item_шелка_1» не найдена — создана заглушка (таких 28: item_шелка_1, item_шелка_2, item_шелка_3, …) | Совсем другая проблема
✓ 7 окно отчёта схлопывает повторы

все проверки пройдены
```
rc=0

### 11/53 · `npm run smoke:ai-runtime`

```text

> narthex@0.9.0 smoke:ai-runtime
> tsx scripts/ai-runtime-smoke.mts

✓ 1 empty schedule[] → default_entity виден — got npc_term
✓ 1 непустой schedule → default НЕ дублируется — got undefined
✓ 2 EXTERNAL unlock_recipe
✓ 2 EXTERNAL unlock_codex
✓ 2 EXTERNAL apply_status
✓ 2 EXTERNAL set_weather
✓ 2 ink с unlock_* компилируется
✓ 3 firstInkKnot n_start
✓ 3 firstInkKnot main
✓ 3 диалог без main открывается через n_start
✓ 3 реплика из n_start — Привет из n_start.
✓ 3 флаг talked после входа
✓ 3 resolveDialogueSource по голому id
✓ 4 ошибка компиляции содержит id — Ink «dlg_broken»: ERROR: line 2: Expected closing ')' for function call but saw
✓ 5 assetUrlOrNull(null) → null
✓ 5 assetUrlOrNull("") → null
✓ 5 assetUrlOrNull("  ") → null
✓ 5 assetUrlOrNull(path) → url
✓ 5 пустая строка truthy в JS, но не URL
✓ 5 "" не годится как src
✓ 6 ash загрузился — ash-of-caerden
✓ 6 bran.ink (main) открывается
✓ 6 bran.schedule непустой (полигон-канон)
✓ 6 bran.dlg → ink компилируется
✓ 6 regen bran ink валиден
✓ 7 EXTERNAL get_player_name
✓ 7 ink с {имя} компилируется
✓ 8 personal на id NPC
✓ 8 faction отдельно
✓ 8 getDisposition = personal+faction+base — 15
✓ 9 без флага — не на sc
✓ 9 флаг → presence на sc — npc_p
✓ 11 tick_elapsed после advanceTicks
✓ 10 диалог открыт
✓ 10 game_over victory
✓ 10 ending по флагу — ending_flag
✓ 10 dialogue закрыт после game_over

all ok
```
rc=0

### 12/53 · `npm run smoke:ai-task`

```text

> narthex@0.9.0 smoke:ai-task
> tsx scripts/ai-task-smoke.mts

✓ медиа-аудит видит локальные ссылки, не только assets/
✓ полный пакет редактирования получает расширение .narthex — 69ea3f68-2eee-495e-9033-7f1660fa834d-full-task.narthex
✓ AI-пакет сохраняет структуру Campaign Package
✓ AI-пакет содержит единый brief и отчёт по категориям
✓ AI-пакет несёт руководство, схему и бланк
✓ плейтест/медиа/структура присутствуют в отчёте
✓ AI-пакет передаёт агенту существующий ID
✓ новая кампания получает пакет инструкций без фиктивного исходного проекта
✓ служебная папка AI не попадает в установленную кампанию
✓ повтор того же AI-пакета распознаётся как тот же пакет — {"id":"69ea3f68-2eee-495e-9033-7f1660fa834d","title":"AI Task Smoke","author":"","description":"Новая кампания. Опишите её в разделе «Кампания».","alreadyInstalled":true}
✓ AI-task smoke-test восстановил исходный реестр
ALL GREEN
```
rc=0

### 13/53 · `npm run smoke:char-templates`

```text

> narthex@0.9.0 smoke:char-templates
> tsx scripts/char-template-smoke.mts

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
```
rc=0

### 14/53 · `npm run smoke:no-campaign`

```text

> narthex@0.9.0 smoke:no-campaign
> tsx scripts/no-campaign-smoke.mts

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
✓ импорт .narthex спрашивает об обновлении/копии при конфликте
✓ пустой локальный реестр доступен — []
✓ отсутствующий каталог не считается кампанией
✓ атомарная резервация даёт ровно одному процессу владение ID
✓ ID, уже занятый папкой, не резервируется повторно
✓ новая кампания получает UUID независимо от названия — 79f82b06-fe05-4edd-81e5-1a4d5e899c6f / 262fc337-aab3-4974-8d3e-532390345682
✓ смена названия не связана с ID
✓ свободный .narthex сохраняет исходный стабильный ID
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
```
rc=0

### 15/53 · `npm run smoke:chronicle-manifest`

```text

> narthex@0.9.0 smoke:chronicle-manifest
> tsx scripts/chronicle-manifest-smoke.mts

chronicle-manifest-smoke: ALL GREEN
```
rc=0

### 16/53 · `npm run smoke:dialogues-r31`

```text

> narthex@0.9.0 smoke:dialogues-r31
> tsx scripts/dialogues-round31-smoke.mts


ПРОПУСК: нет фикстуры _ai-temp/campaing/campaign/dialogues
  не проверено: импорт шести ink-диалогов кампании сценариста без предупреждений
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.
```
rc=0

### 17/53 · `npm run smoke:dialogues-r32`

```text

> narthex@0.9.0 smoke:dialogues-r32
> tsx scripts/dialogues-round32-smoke.mts


ПРОПУСК: нет фикстуры _ai-temp/campaing
  не проверено: экипировка, диалоги, условия и починка сохранений на кампании сценариста
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.
```
rc=0

### 18/53 · `npm run smoke:breathe-toggle`

```text

> narthex@0.9.0 smoke:breathe-toggle
> tsx scripts/breathe-toggle-smoke.mts

--- Смоук-тест: Управление эффектом живого дыхания сущностей ---
✓ 1. Поле breathe добавлено в типы сущностей
✓ 2. Логика shouldBreathe корректна: NPC по умолчанию дышит, робот с breathe:false нет, предметы по умолчанию нет
✓ 3. Класс cf-breathe применяется к спрайту
✓ 4. Анимация cf-breathe объявлена в index.css с transform-origin: bottom center
✓ 5. В редакторе NPC есть переключатель дыхания (с возможностью отключить для роботов)
✓ 6. В редакторе предметов есть переключатель дыхания для живых артефактов
✓ 7. В руководстве ИИ зафиксировано требование отключать breathe для роботов и механизмов
breathe-toggle-smoke: ALL GREEN
```
rc=0

### 19/53 · `npm run smoke:scene-subtitles`

```text

> narthex@0.9.0 smoke:scene-subtitles
> tsx scripts/scene-subtitles-and-state-smoke.mts

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
```
rc=0

### 20/53 · `npm run smoke:scene-editor`

```text

> narthex@0.9.0 smoke:scene-editor
> tsx scripts/scene-editor-tabs-smoke.mts

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
```
rc=0

### 21/53 · `npm run smoke:editor-hotspot`

```text

> narthex@0.9.0 smoke:editor-hotspot
> tsx scripts/editor-and-hotspot-smoke.mts

--- Смоук-тест: Хотспоты окружения, превью в редакторе сущностей и спрайты в сценах ---
✓ Все проверки хотспотов окружения, спрайтов, превью редактора, синхронной камеры, ручных координат и локализации пройдены успешно!
```
rc=0

### 22/53 · `npm run smoke:voice-dedup`

```text

> narthex@0.9.0 smoke:voice-dedup
> tsx scripts/voice-dedup-smoke.mts

--- Смоук-тест: Voice Coordinator и защита от задваивания озвучки ---
✓ Все проверки Voice Coordinator и защиты от задваивания прошли успешно!
```
rc=0

### 23/53 · `npm run smoke:narrative-intro`

```text

> narthex@0.9.0 smoke:narrative-intro
> tsx scripts/narrative-intro-and-ai-features-smoke.mts

--- Смоук-тест: narrative_intro, сброс флагов и Ink binding ---
✓ Все проверки narrative_intro, сброса флагов и Ink binding прошли успешно!
```
rc=0

### 24/53 · `npm run smoke:encounters-loader`

```text

> narthex@0.9.0 smoke:encounters-loader
> tsx scripts/encounters-loader-smoke.mts


ПРОПУСК: нет фикстуры _ai-temp/campaing/campaign
  не проверено: загрузка кампании с таблицами встреч (encounters/ и rules/)
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.
```
rc=0

### 25/53 · `npm run smoke:manifest-order`

```text

> narthex@0.9.0 smoke:manifest-order
> tsx scripts/manifest-order-smoke.mts

✓ manifest-order smoke: rules, encounters, and rule traversal follow manifest order under reversed fetch completion
```
rc=0

### 26/53 · `npm run smoke:engine-version`

```text

> narthex@0.9.0 smoke:engine-version
> tsx scripts/engine-version-smoke.mts

engine-version-smoke: ALL GREEN (engine 0.9.0)
```
rc=0

### 27/53 · `npm run smoke:hero-appearance`

```text

> narthex@0.9.0 smoke:hero-appearance
> tsx scripts/hero-appearance-smoke.mts

✓ создание заранее выбирает по первому варианту каждого сегмента
✓ постоянный внешний вид сохраняется в состоянии игрока
✓ базовый портрет строится по слоям в заданном порядке
✓ черта внешности задаёт постоянную фигурку боя
✓ надетый предмет появляется поверх портрета героя
✓ смена экипировки не меняет боевую фигурку
✓ снятие слоя экипировки убирает его с портрета
ALL GREEN
```
rc=0

### 28/53 · `npm run smoke:theme-contrast`

```text

> narthex@0.9.0 smoke:theme-contrast
> tsx scripts/theme-contrast-smoke.mts

OK: контраст поверхностей, модальные окна и границы редактирования UI
```
rc=0

### 29/53 · `npm run smoke:dialogue-transitions`

```text

> narthex@0.9.0 smoke:dialogue-transitions
> tsx scripts/smoke-dialogue-transitions.mts

Testing Dialogue Transitions (Scene, Combat, State, Endings)...
1. Проверка смены состояния сцены прямо из диалога...
✓ change_scene_state работает штатно!
2. Проверка перехода в другую сцену из диалога...
✓ go_to_scene работает штатно!
3. Проверка запуска боя из диалога...
✓ start_combat работает штатно!
4. Проверка завершения игры (Bad End) из диалога...
✓ game_over_death работает штатно!
✓ Все 4 вида диалоговых переходов успешно верифицированы!
```
rc=0

### 30/53 · `npm run smoke:dialogue-skip`

```text

> narthex@0.9.0 smoke:dialogue-skip
> tsx scripts/smoke-dialogue-skip-and-item-modal.mts

--- Запуск smoke-dialogue-skip-and-item-modal ---
✓ smoke-dialogue-skip-and-item-modal: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!
```
rc=0

### 31/53 · `npm run smoke:travel-transition`

```text

> narthex@0.9.0 smoke:travel-transition
> tsx scripts/smoke-location-travel-transition.mts

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
```
rc=0

### 32/53 · `npm run smoke:stranger`

```text

> narthex@0.9.0 smoke:stranger
> tsx scripts/smoke-stranger-and-triggers.mts

Testing Stranger Mechanics and Event Triggers...
1. Проверка механики «Незнакомец»...
✓ Механика «Незнакомец» работает безошибочно!
2. Проверка условий перехода и блокировки...
✓ Блокировка и условия перехода работают корректно!
3. Проверка событийного триггера enter_scene...
✓ Событийный триггер enter_scene сработал штатно!
4. Проверка оклика-диалога перед выходом...
✓ Перехват перехода диалогом (оклик стража) работает корректно!
✓ Все тесты механики «Незнакомец» и событийных триггеров успешно пройдены!
```
rc=0

### 33/53 · `npm run smoke:encumbrance`

```text

> narthex@0.9.0 smoke:encumbrance
> tsx scripts/encumbrance-smoke.mts

--- Запуск encumbrance-smoke ---
✓ encumbrance-smoke: ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!
```
rc=0

### 34/53 · `npm run smoke:cutscene-queue`

```text

> narthex@0.9.0 smoke:cutscene-queue
> tsx scripts/smoke-cutscene-postcard-queue.mts

--- Запуск smoke:cutscene-postcard-queue ---
Проверяем, что во время катсцены открытка сохраняется и не исчезает...
✓ smoke:cutscene-postcard-queue: ВСЕ ПРОВЕРКИ ОЧЕРЕДИ КАТСЦЕН И ОТКРЫТОК ПРОЙДЕНЫ!
```
rc=0

### 35/53 · `npm run smoke:spoil`

```text

> narthex@0.9.0 smoke:spoil
> tsx scripts/spoil-smoke.mts

--- Запуск spoil-smoke ---
✓ spoil-smoke: ВСЕ ТЕСТЫ ПОРЧИ ПРЕДМЕТОВ ПРОЙДЕНЫ УСПЕШНО!
```
rc=0

### 36/53 · `npm run smoke:time-semantics`

```text

> narthex@0.9.0 smoke:time-semantics
> tsx scripts/time-semantics-smoke.mts

--- time-semantics-smoke ---
✓ time-semantics-smoke: все группы проверок зелёные
```
rc=0

### 37/53 · `npm run smoke:ai-diff`

```text

> narthex@0.9.0 smoke:ai-diff
> tsx scripts/ai-diff-smoke.mts

--- ai-diff-smoke ---
✓ ai-diff-smoke: все проверки зелёные
```
rc=0

### 38/53 · `npm run smoke:view-write`

```text

> narthex@0.9.0 smoke:view-write
> tsx scripts/view-write-smoke.mts

✓ статика: все вызовы .touch( в src/editor объяснены действием мастера (43 сайтов)
✓ динамика: загрузка эталонной кампании (95 файлов) не порождает ни одного ряда в diff
✓ двойная сериализация 89 JSON-документов стабильна

инвариант зелёный
```
rc=0

### 39/53 · `npm run smoke:core`

```text

> narthex@0.9.0 smoke:core
> tsx scripts/core-semantics-smoke.mts

✓ startTick читает starting_tick
✓ tick_elapsed сравнивает с абсолютным тиком (граница)
✓ elapsed_ge считает «прошло с начала забега» (tick − startTick)
✓ set_flag ставит флаг; flag_set/flag_not_set читают его
✓ clear_flag снимает флаг
✓ changeNeed клэмпит сверху к max
✓ changeNeed клэмпит снизу к 0 (смерть/правило нуля отдельно)
✓ рост потребности делится с напарником
✓ убыль потребности напарнику не передаётся
✓ без feature «needs» changeNeed — no-op
✓ changeHp клэмпит к max_hp
✓ HP ≤ 0 → game_over
✓ после game_over лечение забега не воскрешает
✓ цепочка A→B срабатывает, третий уровень (C) обрезан потолком вложенности

все якоря зелёные
```
rc=0

### 40/53 · `npm run smoke:pack-missing`

```text

> narthex@0.9.0 smoke:pack-missing
> tsx --tsconfig tsconfig.app.json scripts/smoke/pack-missing-smoke.mts

✓ cf-play check отказал кодом PACK_MISSING, без исключения; диагностический текст совпал со Studio
  PACK_MISSING: Тип проекта «narrative» не установлен: нужен пак «Narrative & Branching» (narrative). Установите каталог packs/narrative/ с pack.json, добавьте «narrative» в packs/registry.json и перезапустите студию.
✓ тот же проект с установленным паком: cf-play check rc=0, эталон §2.1 совпал
✓ Studio открыла проект в отказном экране с названием пака и инструкцией; сейв SHA-256 не изменился
✓ Studio открыла тот же проект обычным путём при установленном паке
PACK_MISSING_SMOKE passed · PACK_MISSING · save sha256=10c16c31885a133303544335a80870936fcd2969e5ecdd890a3763837084fc2f
```
rc=0

### 41/53 · `npm run smoke:capability-modes`

```text

> narthex@0.9.0 smoke:capability-modes
> tsx scripts/smoke/capability-modes-smoke.mts

CAPABILITY_MODES_SMOKE passed
```
rc=0

### 42/53 · `npm run smoke:dlg-script`

```text

> narthex@0.9.0 smoke:dlg-script
> tsx scripts/dlg-script-smoke.mts

✓ 1 пример разбирается без ошибок
✓ 1 узлы и название прочитаны
✓ 1 ремарка отделена от речи
✓ 1 условие с веткой «иначе» собрано
✓ 1 эффект «выдать» понят названием предмета
✓ 1 варианты и переходы на месте
✓ 1 флаг из реестра не пересоздан
✓ 2 повторная запись не теряет структуру
✓ 2 текст сценария стабилен
✓ 2 в тексте нет id и служебных слов ink
✓ 3 условия разобраны без ошибок
✓ 3 навык с порогом
✓ 3 отношение к NPC
✓ 3 предметов не меньше двух
✓ 3 счётчик хроники
✓ 3 два условия через «и»
✓ 3 «нет» — отрицание флага
✓ 4 проверка навыка собрана
✓ 4 ветки успеха и провала раздельны
✓ 4 новый флаг зарегистрирован сам
✓ 4 ветки переживают круг
✓ 5 опечатка в предмете — ошибка с подсказкой
✓ 5 «[иначе]» без условия — ошибка
✓ 5 вариант без текста — ошибка
✓ 5 переход в неизвестный узел — предупреждение
✓ 5 неизвестная команда — ошибка со списком команд
✓ 6 ремарка помечена
✓ 6 облик одной реплики
✓ 6 озвучка
✓ 6 пометки переживают круг
✓ 7 документ конструктора пишется словами
✓ 7 круг «формы → сценарий → формы» не теряет условия и таймер
✓ 8 ink собирается из сценария
✓ 8 ink читается обратно без замечаний
✓ 8 узлы после круга через ink те же

мастерский сценарий: все проверки зелёные
```
rc=0

### 43/53 · `npm run smoke:dlg-ui`

```text

> narthex@0.9.0 smoke:dlg-ui
> tsx --tsconfig tsconfig.app.json scripts/dlg-ui-smoke.mts

✓ U демо-кампания открыта в редакторе — Пепел Каэрдена
✓ U в кампании есть флаг и предмет для условий — Алдрик отказал в пайке / Бочка с водой
✓ U сценарий разобран без ошибок
✓ U ink собран из сценария
✓ U открывается вкладка «Сценарий»
✓ U текст сценария виден мастеру
✓ U есть кнопка проверки разговора
✓ U служебные команды ink в текст не попали
✓ U ошибка мастера видна строкой с номером
✓ U движок проверки открывает разговор
✓ U собеседник — владелец разговора — npc_guard_aldric
✓ U реплики пришли из сценария — Собеседник поднимает глаза от бумаг. / Приветствую. / Мы не знакомы.
✓ U ремарка отдана курсивом (action)
✓ U варианты на месте — ["Кто вы?","Уйти."]
✓ U условный вариант скрыт без флага
✓ U с флагом ветка открывается
✓ U ветка «иначе» сменилась на «если»
✓ U эффект из сценария выдан
✓ U разговор без владельца играет временный собеседник
✓ П оверлей проверки открывается
✓ П есть кнопки пересборки и панель проверки
✓ ИИ импорт: текст разобран в формы — 1
✓ ИИ импорт: ink собран из текста
✓ ИИ импорт: предупреждений о разговоре нет
✓ ИИ импорт: ошибка текста названа строкой — Диалог «maeva»: строка 2 — не понимаю команду «полетать: высоко». Команды: запомнить, забыть, выдать, забрать, сцена, бой, состояние сцены, гибель, победа, правило, отряд, торговля, изготовление, квес
✓ пакет: ink собран из текста разговора
✓ U сценарий переписывается теми же названиями

текстовый сценарий и проверка разговора: всё зелёное
```
rc=0

### 44/53 · `npm run smoke:folder-import`

```text

> narthex@0.9.0 smoke:folder-import
> tsx scripts/smoke-round35-folder-import.mts

--- Smoke test: Folder import & AI Repo Kit ---
✓ Все 15 служебных файлов Git, tools и скриптов успешно отфильтрованы
✓ Все 19 канонических файлов кампании успешно разрешены
✓ Префикс GitHub репозитория автоматически распознан и удален
✓ Симуляция 2828 файлов репозитория: успешно обработана, отфильтровано 2824 служебных файлов, сохранено файлов кампании: 5
✓ Легковесный чемодан ИИ собран успешно (размер: 291.8 КБ)
--- Все проверки импорта папок и легковесного чемодана пройдены успешно! ---
```
rc=0

### 45/53 · `npm run smoke:narrative-builder`

```text

> narthex@0.9.0 smoke:narrative-builder
> tsx scripts/smoke-narrative-builder-and-docs.mts

--- Smoke test: Narrative Builder, Camera & AI Guide ---
✓ Расширенные поля NarrativeIntroEntry типизированы корректно
✓ JSON-схема содержит спецификацию полей image, camera, duration
✓ Руководство ИИ содержит исчерпывающие инструкции по анимациям, камере и нарративу
--- Все проверки успешно пройдены! ---
```
rc=0

### 46/53 · `npm run smoke:patch`

```text

> narthex@0.9.0 smoke:patch
> tsx scripts/smoke-patch-export-and-import.mts

--- Smoke test: Patch Chronicle Export & Import ---
✓ Базовый снимок успешно зафиксирован, список изменений пуст
✓ Изменения и добавления точно отслежены: added: Предмет: Лечебное зелье, modified: Предмет: Меч мастера, modified: Манифест структуры
✓ Текстовая сводка для буфера сгенерирована корректно
✓ Пакет изменений содержит ТОЛЬКО изменённые файлы и исключает неизменённый контент
✓ Патч успешно применён поверх целевой кампании без потери нетронутых файлов
--- Все проверки пакета изменений (Diff Patch) успешно пройдены! ---
```
rc=0

### 47/53 · `npm run smoke:cutout`

```text

> narthex@0.9.0 smoke:cutout
> tsx scripts/smoke-chromakey-guide.mts

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
```
rc=0

### 48/53 · `npm run smoke:duration-actions`

```text

> narthex@0.9.0 smoke:duration-actions
> tsx scripts/smoke-duration-actions.mts

✓ campAvailable: даёт отдохнуть
✓ окно выбора открылось для лагеря
✓ границы окна = min_ticks..max_ticks
✓ ночлег 6 часов: tick +6
✓ лечение отдыха применилось (1d1 = +1 HP)
✓ запрос закрыт после подтверждения
✓ per_tick × N + restore разово
✓ окно выбора кастомного действия
✓ tick +6 (step=2 выровнял 5→6)
✓ per_tick 6×+4 = +24
✓ on_finish применён (флаг поставлен)
✓ прерывание после 1-го тика (Δtick=1)
✓ прожитый тик дал свою долю (+2)
✓ interrupt_rule сработал
✓ on_finish НЕ применён при прерывании
✓ break_when оборвал после 1 тика
✓ правило прерывания из break_when сработало
✓ on_finish не применён
✓ запрещённый эффект пропущен (переменная не появилась)
✓ разрешённый эффект пошёл 2×+1 HP
✓ в журнале есть предупреждение о белом списке
✓ эффект с ticks идёт сразу, +3
✓ длина клапится к max=4
✓ без ticks открывается окно выбора
✓ отмена окна работает
✓ available_when=false: действие не запустилось
✓ неизвестный id: запись в журнал

Все проверки длительных действий зелёные.
```
rc=0

### 49/53 · `npm run smoke:craft-fail-time`

```text

> narthex@0.9.0 smoke:craft-fail-time
> tsx scripts/smoke-craft-fail-time.mts

✓ промах возвращает false
✓ промах без поля не тратит время
✓ материалы целы после промаха
✓ промах возвращает false
✓ промах тратит fail_time_ticks=2
✓ материалы целы при платном промахе
✓ сообщение сообщает цену промаха
✓ успех возвращает true
✓ успех тратит time_ticks=4
✓ успех списал материалы и выдал результат
✓ аудит подсвечивает бесплатный промах
✓ аудит молчит при заданном fail_time_ticks

Все проверки времени промаха крафта зелёные.
```
rc=0

### 50/53 · `npm run smoke:dialogue-speaker`

```text

> narthex@0.9.0 smoke:dialogue-speaker
> tsx scripts/smoke-dialogue-speaker.mts

[парсер тегов движка]
  ✓ speaker извлекается
  ✓ эмоция рядом не страдает
  ✓ без тега спикера нет
[круговой обход документа]
  ✓ тег # speaker в ink
  ✓ ремарка лишена тега speaker (криминалистика)
  ✓ спикер пережил круговой обход
  ✓ у ремарки спикер не появился
[аудит]
  ✓ неведомый спикер — ошибка
  ✓ спикер у ремарки — ошибка
  ✓ без гейта присутствия — предупреждение
  ✓ с гейтом in_party предупреждения нет
  ✓ permadeath + слоты по умолчанию — предупреждение
  ✓ permadeath + save_slots: 0 — предупреждения нет
[якоря в коде и доке]
  ✓ призрачная кнопка лагеря (disabled по campAvailable)
  ✓ подсказка-причина на серой кнопке
  ✓ оверлей рисует спикера
  ✓ гайд: раздел про # speaker
  ✓ гайд: призрачная кнопка лагеря
  ✓ гайд: железный рогалик = save_slots 0
  ✓ тип DlgLine.speaker с аннотацией

Все проверки дз.22 (спикер, рогалик-слоты, призрачный лагерь) зелёные.
```
rc=0

### 51/53 · `npm run smoke:narthex-closed`

```text

> narthex@0.9.0 smoke:narthex-closed
> node _tools/ScriptCat/tests/narthex-closed-state-smoke.mjs

OK: narthex 1.4.57 — Merged / Closed / Timeout, Closed без мержа → Rework, шлюз 1.5
```
rc=0

### 52/53 · `npm run smoke:narthex-tech`

```text

> narthex@0.9.0 smoke:narthex-tech
> node _tools/ScriptCat/tests/narthex-tech-info-smoke.mjs

OK: техблок 1.4.57 — Executor получает ритуал main, Auditor только читает main, Coordinator без git
```
rc=0

### 53/53 · `npm run smoke:drive-gateway`

```text

> narthex@0.9.0 smoke:drive-gateway
> node _tools/ScriptCat/tests/drive-gateway-arena-smoke.mjs

OK: шлюз 1.5 — корень Диска не трогает, пишет только в Arena/{logs,payloads}
```
rc=0

## Diff ядра до коммита

### `git diff -- src/core`

```diff
diff --git a/src/core/caps.ts b/src/core/caps.ts
index d89b07c..a16b338 100644
--- a/src/core/caps.ts
+++ b/src/core/caps.ts
@@ -27,6 +27,7 @@ export const CAPABILITY_REGISTRY = [
   {"id": "codex", "title": "Кодекс и бестиарий", "pack": "narrative", "status": "stable", "since": 2, "enables": "codex entries and categories", "probe": "smoke:p2"},
   {"id": "crafting", "title": "Крафт и рецепты", "pack": "narrative", "status": "stable", "since": 2, "enables": "recipes and crafting actions", "probe": "smoke:craft-fail-time"},
   {"id": "time", "title": "Игровое время и календарь", "pack": "narrative", "status": "stable", "since": 2, "enables": "clock, calendar, and elapsed time", "probe": "smoke:time-semantics"},
+  {"id": "adventure", "title": "Point-and-click приключение", "pack": "adventure", "status": "experimental", "since": 2, "enables": "point-and-click adventure scenes and interactions", "probe": "probe:adventure"},
   {"id": "state-machine", "title": "Пошаговый автомат состояний", "pack": "state-ui", "status": "planned", "since": 3, "enables": "generic state-machine runtime", "probe": null},
   {"id": "cards", "title": "Карты, колоды, эффекты", "pack": "state-ui", "status": "planned", "since": 3, "enables": "card collections and effects", "probe": null},
   {"id": "auto-battle", "title": "Автобатлер и симуляция партии", "pack": "state-ui", "status": "planned", "since": 3, "enables": "automated battle simulation", "probe": null},
```
rc=0

### Scope diff

```text
$ git diff --stat -- src/core
 src/core/caps.ts | 1 +
 1 file changed, 1 insertion(+)
rc=0
$ git diff --stat -- src/core/pack src/core/turn src/core/engine.ts
rc=0
$ git diff --stat -- packs
rc=0
```

## Итог

- `probe:adventure`: rc=0; passport/capability/kind/PACK_MISSING подтверждены.
- Contracts: **41 проверок**, rc=0.
- Installed packs: **2 manifests**, rc=0; `adventure` в catalogue отсутствует.
- Core graph: **34 modules**, acyclic; `engine.ts` и forbidden core paths не изменены.
- Registered smokes: **53/53**, rc=0; два исторических пропуска выведены дословно.
- Эталон кампании: 10 сцен · 8 локаций · 6 диалогов · 21 узел ink; 0 errors / 8 warnings; 5 deaths; coverage 6/10.