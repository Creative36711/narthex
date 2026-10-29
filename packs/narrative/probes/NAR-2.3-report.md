# NAR-2.3 — отчёт приёмки

Решения и допущения: `docs/decisions/NAR-2.3.md`. Ниже — дословный вывод команд; код возврата указан после каждого блока.

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
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается
- flag_written_never_read: флаг «guard_ration_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «herbs_gathered» выставляется, но нигде не читается
- flag_written_never_read: флаг «wrench_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «medallion_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «skeleton_looted» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается

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

### `npm run play -- explain --catalogue`

```text

> narthex@0.9.0 play
> tsx scripts/playkit/cli.mts explain --catalogue

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

### `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out /tmp/nar-2.3-report-public-check`

```text
# Проверка кампании · Пепел Каэрдена

✓ проверка пройдена

## Статика
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается
- flag_written_never_read: флаг «guard_ration_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «herbs_gathered» выставляется, но нигде не читается
- flag_written_never_read: флаг «medallion_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «skeleton_looted» выставляется, но нигде не читается
- flag_written_never_read: флаг «wrench_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/ash-of-caerden/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp

```

rc=0

### `npx tsc -b`

```text
```

rc=0

### `npx tsc --noEmit --ignoreConfig … packs/narrative/probes/campaign.mts`

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

### `npm run check:brand`

```text

> narthex@0.9.0 check:brand
> tsx scripts/brand-guard.mts

✓ старое имя не встречается (проверено файлов: 728)
```

rc=0

### `npm run check:version`

```text

> narthex@0.9.0 check:version
> tsx scripts/version.mts check

✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG
```

rc=0

### `npm run probe:pack-host`

```text

> narthex@0.9.0 probe:pack-host
> tsx scripts/pack-host-probe.mts

✓ пустышка зарегистрирована по manifest ID; хост не перечисляет ID паков
✓ sim вызван; headless view подавлен, обычный view прошёл через draw-порт
✓ 20/20 sim прогонов детерминированы; view on/off state sha256=12a3386dbe653e50393d9be678125beed635c41a7b51d37faad649dcbf37bc0b
✓ view write rejected by readonly type contract and runtime proxy
✓ ошибка sim/view возвращает pause с причиной и не выходит исключением в цикл
✓ sim registration rejects Date.now, Math.random, and I/O references
PACK_HOST_PROBE passed
```

rc=0

### `npx tsx scripts/saves-compat-smoke.mts`

```text
Кампания: Пепел Каэрдена v0.1.0 · движок 0.9.0 · формат пакета v1
✓ 1 версия движка не пустая — 0.9.0
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
✓ 2 сейв пишется в обёртке — envelope_version=1
✓ 2 в обёртке версия кампании — 0.1.0
✓ 2 в обёртке версия движка — 0.9.0
✓ 2 в обёртке формат состояния — save_version=4
✓ 2 в обёртке есть метки времени
✓ 2 peekSave читает обёртку
✓ 3 старый сейв без обёртки открыт
✓ 3 формат перенесён до текущего
✓ 3 в отчёте сказано про перенос — Формат сохранения перенесён: в3 → в4.
✓ 3 после открытия сейв в обёртке
✓ 3 создана резервная копия
✓ 3 резервная копия — исходник (без обёртки)
✓ 3 удаление чистит и резерв
✓ 4 предмет-призрак убран из инвентаря
✓ 4 экипировка снята (предмет удалён)
✓ 4 чужая потребность убрана
✓ 4 все потребности кампании на месте
✓ 4 чужой навык убран
✓ 4 отметка о чужом правиле убрана
✓ 4 чужая запись кодекса убрана
✓ 4 сцена заменена на существующую — scene_gates_front
✓ 4 стадия квеста существует — started
✓ 4 отчёт по-русски и непустой — 8 строк
✓ 4 в отчёте есть вид «починка»
   отчёт: 8 строк, пример — «Из инвентаря убрано: «item_short_sword», «item_которого_нет» — этих предметов больше нет в кампании.»
✓ 5 вердикт: сейв v0.1.0 не поддержится с базы v1.4.0 — {"kind":"unsupported","save_version":"0.1.0","base_version":"1.4.0","reason":"Сохранение сделано в версии кампании 0.1.0, а поддерживаются сохранения начиная с 1.4.0."}
✓ 5 вердикт: сейв v1.4.0 поддержится
✓ 5 вердикт: сейв v1.5.2 поддержится
✓ 5 сейв не открывается как годный
✓ 5 причина на русском — Сохранение сделано в версии кампании 0.1.0, а подд
✓ 5 сейв НЕ удалён (можно откатить версию кампании)
✓ 5 сейв НЕ перезаписан
✓ 5 «Продолжить» не предлагается
✓ 5 без save_base_version поддерживается всё
✓ 5 сейв без версии кампании принимается
✓ 5 preserveSave убирает сейв в резерв
✓ 5 активный ключ освобождён
✓ 5 резерв хранит прежнюю версию
✓ 5 повторный вызов без сейва — false
✓ 6 сейв новее движка — отказ — {"kind":"too_old","reason":"Сохранение сделано более новым д
✓ 6 сейв новее движка не перезаписан
✓ 7 экспорт сейва отдаёт текст
✓ 7 после удаления сейва нет
✓ 7 импорт возвращает сейв
✓ 7 импортированный сейв читается
✓ 7 битый текст не импортируется
✓ 8 меню продолжает забег через openSave (с вердиктом)
✓ 8 «Продолжить» учитывает кампанию
✓ 8 неподдержавшийся сейв уходит в резерв перед новым забегом
✓ 8 в меню видна версия движка, а не поля пакета
✓ 8 в меню видны версия и дата сохранения
✓ 8 предупреждение о движке показывается в меню
✓ 8 отчёт сейва объясняет причину и не удаляет файл
✓ 8 справка рассказывает про сохранения и обновления
✓ 8 переименование id отклоняется с объяснением

ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (saves-compat)
```

rc=0

### `diff -qr --exclude=.cf-play --exclude=project.json public/campaigns/ash-of-caerden packs/narrative/data/ash-of-caerden`

```text
```

rc=0

### `wc -l packs/narrative/*.ts packs/narrative/probes/campaign.mts src/core/engine.ts`

```text
   13 packs/narrative/hooks.ts
  296 packs/narrative/sim.ts
  128 packs/narrative/types.ts
   29 packs/narrative/view.ts
  242 packs/narrative/probes/campaign.mts
  599 src/core/engine.ts
 1307 total
```

rc=0

## Все зарегистрированные `smoke:*`

```text

===== npm run smoke:currency =====

> narthex@0.9.0 smoke:currency
> tsx scripts/currency-smoke.mts

✓ Валюта: начальный баланс, траты и поступления синхронизированы с предметами в инвентаре

===== npm run smoke:ink-import =====

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

===== npm run smoke:fingerprint =====

> narthex@0.9.0 smoke:fingerprint
> tsx scripts/fingerprint-smoke.mts

✓ канонический JSON не зависит от порядка ключей
✓ отпечаток стабилен при перемешивании ключей
✓ смена полей публикации (author/attribution/series) отпечаток НЕ меняет — вор не «заначит» чужую кампанию сменой титула
✓ смена контента отпечаток меняет
✓ отпечаток считается без author/attribution вообще

все проверки зелёные

===== npm run smoke:book-md =====

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

===== npm run smoke:campaign-index =====

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

===== npm run smoke:guide =====

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

===== npm run smoke:design-doc =====

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

===== npm run smoke:quest-journal =====

> narthex@0.9.0 smoke:quest-journal
> tsx scripts/quest-journal-smoke.mts

✓ j_search resolves to Russian text and its publishing stage — Начало — Отец Корвин просит вернуть медальон Вечного Света: вор, укравший реликвию, сгинул в забро…
✓ j_found resolves to Russian text and its publishing stage — Реликвия найдена — Медальон у меня. Осталось вернуть его отцу Корвину в храм.
✓ j_completed resolves to Russian text and its publishing stage — Завершение — Реликвия вернулась в храм. Корвин благословил меня — рука теперь твёрже уходит от ударов,…
✓ new journal keys use their own namespace, not stage ids
✓ new journal keys avoid collisions
✓ unmapped record still gets a human-readable fallback
ALL GREEN

===== npm run smoke:quest-journal-runtime =====

> narthex@0.9.0 smoke:quest-journal-runtime
> tsx scripts/quest-journal-runtime-smoke.mts

✓ starting stage publishes its independent j_search key
✓ found stage publishes its independent j_found key
✓ final stage publishes its independent j_completed key
✓ player journal contains prose, not internal keys
ALL GREEN

===== npm run smoke:p2 =====

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

===== npm run smoke:ai-runtime =====

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

===== npm run smoke:ai-task =====

> narthex@0.9.0 smoke:ai-task
> tsx scripts/ai-task-smoke.mts

✓ медиа-аудит видит локальные ссылки, не только assets/
✓ полный пакет редактирования получает расширение .narthex — 4a9daa78-aa62-4154-a04c-755e8e99e189-full-task.narthex
✓ AI-пакет сохраняет структуру Campaign Package
✓ AI-пакет содержит единый brief и отчёт по категориям
✓ AI-пакет несёт руководство, схему и бланк
✓ плейтест/медиа/структура присутствуют в отчёте
✓ AI-пакет передаёт агенту существующий ID
✓ новая кампания получает пакет инструкций без фиктивного исходного проекта
✓ служебная папка AI не попадает в установленную кампанию
✓ повтор того же AI-пакета распознаётся как тот же пакет — {"id":"4a9daa78-aa62-4154-a04c-755e8e99e189","title":"AI Task Smoke","author":"","description":"Новая кампания. Опишите её в разделе «Кампания».","alreadyInstalled":true}
✓ AI-task smoke-test восстановил исходный реестр
ALL GREEN

===== npm run smoke:char-templates =====

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

===== npm run smoke:no-campaign =====

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
✓ новая кампания получает UUID независимо от названия — 724ed379-de2d-44cf-afda-72d22f8cd574 / 1a9e83e3-1c0f-46fd-878b-8a8787ecee71
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

===== npm run smoke:chronicle-manifest =====

> narthex@0.9.0 smoke:chronicle-manifest
> tsx scripts/chronicle-manifest-smoke.mts

chronicle-manifest-smoke: ALL GREEN

===== npm run smoke:dialogues-r31 =====

> narthex@0.9.0 smoke:dialogues-r31
> tsx scripts/dialogues-round31-smoke.mts


ПРОПУСК: нет фикстуры _ai-temp/campaing/campaign/dialogues
  не проверено: импорт шести ink-диалогов кампании сценариста без предупреждений
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.


===== npm run smoke:dialogues-r32 =====

> narthex@0.9.0 smoke:dialogues-r32
> tsx scripts/dialogues-round32-smoke.mts


ПРОПУСК: нет фикстуры _ai-temp/campaing
  не проверено: экипировка, диалоги, условия и починка сохранений на кампании сценариста
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.


===== npm run smoke:breathe-toggle =====

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

===== npm run smoke:scene-subtitles =====

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

===== npm run smoke:scene-editor =====

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

===== npm run smoke:editor-hotspot =====

> narthex@0.9.0 smoke:editor-hotspot
> tsx scripts/editor-and-hotspot-smoke.mts

--- Смоук-тест: Хотспоты окружения, превью в редакторе сущностей и спрайты в сценах ---
✓ Все проверки хотспотов окружения, спрайтов, превью редактора, синхронной камеры, ручных координат и локализации пройдены успешно!

===== npm run smoke:voice-dedup =====

> narthex@0.9.0 smoke:voice-dedup
> tsx scripts/voice-dedup-smoke.mts

--- Смоук-тест: Voice Coordinator и защита от задваивания озвучки ---
✓ Все проверки Voice Coordinator и защиты от задваивания прошли успешно!

===== npm run smoke:narrative-intro =====

> narthex@0.9.0 smoke:narrative-intro
> tsx scripts/narrative-intro-and-ai-features-smoke.mts

--- Смоук-тест: narrative_intro, сброс флагов и Ink binding ---
✓ Все проверки narrative_intro, сброса флагов и Ink binding прошли успешно!

===== npm run smoke:encounters-loader =====

> narthex@0.9.0 smoke:encounters-loader
> tsx scripts/encounters-loader-smoke.mts


ПРОПУСК: нет фикстуры _ai-temp/campaing/campaign
  не проверено: загрузка кампании с таблицами встреч (encounters/ и rules/)
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.


===== npm run smoke:manifest-order =====

> narthex@0.9.0 smoke:manifest-order
> tsx scripts/manifest-order-smoke.mts

✓ manifest-order smoke: rules, encounters, and rule traversal follow manifest order under reversed fetch completion

===== npm run smoke:engine-version =====

> narthex@0.9.0 smoke:engine-version
> tsx scripts/engine-version-smoke.mts

engine-version-smoke: ALL GREEN (engine 0.9.0)

===== npm run smoke:hero-appearance =====

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

===== npm run smoke:theme-contrast =====

> narthex@0.9.0 smoke:theme-contrast
> tsx scripts/theme-contrast-smoke.mts

OK: контраст поверхностей, модальные окна и границы редактирования UI

===== npm run smoke:dialogue-transitions =====

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

===== npm run smoke:dialogue-skip =====

> narthex@0.9.0 smoke:dialogue-skip
> tsx scripts/smoke-dialogue-skip-and-item-modal.mts

--- Запуск smoke-dialogue-skip-and-item-modal ---
✓ smoke-dialogue-skip-and-item-modal: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!

===== npm run smoke:travel-transition =====

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

===== npm run smoke:stranger =====

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

===== npm run smoke:encumbrance =====

> narthex@0.9.0 smoke:encumbrance
> tsx scripts/encumbrance-smoke.mts

--- Запуск encumbrance-smoke ---
✓ encumbrance-smoke: ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!

===== npm run smoke:cutscene-queue =====

> narthex@0.9.0 smoke:cutscene-queue
> tsx scripts/smoke-cutscene-postcard-queue.mts

--- Запуск smoke:cutscene-postcard-queue ---
Проверяем, что во время катсцены открытка сохраняется и не исчезает...
✓ smoke:cutscene-postcard-queue: ВСЕ ПРОВЕРКИ ОЧЕРЕДИ КАТСЦЕН И ОТКРЫТОК ПРОЙДЕНЫ!

===== npm run smoke:spoil =====

> narthex@0.9.0 smoke:spoil
> tsx scripts/spoil-smoke.mts

--- Запуск spoil-smoke ---
✓ spoil-smoke: ВСЕ ТЕСТЫ ПОРЧИ ПРЕДМЕТОВ ПРОЙДЕНЫ УСПЕШНО!

===== npm run smoke:time-semantics =====

> narthex@0.9.0 smoke:time-semantics
> tsx scripts/time-semantics-smoke.mts

--- time-semantics-smoke ---
✓ time-semantics-smoke: все группы проверок зелёные

===== npm run smoke:ai-diff =====

> narthex@0.9.0 smoke:ai-diff
> tsx scripts/ai-diff-smoke.mts

--- ai-diff-smoke ---
✓ ai-diff-smoke: все проверки зелёные

===== npm run smoke:view-write =====

> narthex@0.9.0 smoke:view-write
> tsx scripts/view-write-smoke.mts

✓ статика: все вызовы .touch( в src/editor объяснены действием мастера (43 сайтов)
✓ динамика: загрузка эталонной кампании (95 файлов) не порождает ни одного ряда в diff
✓ двойная сериализация 89 JSON-документов стабильна

инвариант зелёный

===== npm run smoke:core =====

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

===== npm run smoke:pack-missing =====

> narthex@0.9.0 smoke:pack-missing
> tsx --tsconfig tsconfig.app.json scripts/smoke/pack-missing-smoke.mts

✓ cf-play check отказал кодом PACK_MISSING, без исключения; диагностический текст совпал со Studio
  PACK_MISSING: Тип проекта «narrative» не установлен: нужен пак «Narrative & Branching» (narrative). Установите каталог packs/narrative/ с pack.json, добавьте «narrative» в packs/registry.json и перезапустите студию.
✓ тот же проект с установленным паком: cf-play check rc=0, эталон §2.1 совпал
✓ Studio открыла проект в отказном экране с названием пака и инструкцией; сейв SHA-256 не изменился
✓ Studio открыла тот же проект обычным путём при установленном паке
PACK_MISSING_SMOKE passed · PACK_MISSING · save sha256=10c16c31885a133303544335a80870936fcd2969e5ecdd890a3763837084fc2f

===== npm run smoke:capability-modes =====

> narthex@0.9.0 smoke:capability-modes
> tsx scripts/smoke/capability-modes-smoke.mts

CAPABILITY_MODES_SMOKE passed

===== npm run smoke:dlg-script =====

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

===== npm run smoke:dlg-ui =====

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

===== npm run smoke:folder-import =====

> narthex@0.9.0 smoke:folder-import
> tsx scripts/smoke-round35-folder-import.mts

--- Smoke test: Folder import & AI Repo Kit ---
✓ Все 15 служебных файлов Git, tools и скриптов успешно отфильтрованы
✓ Все 19 канонических файлов кампании успешно разрешены
✓ Префикс GitHub репозитория автоматически распознан и удален
✓ Симуляция 2828 файлов репозитория: успешно обработана, отфильтровано 2824 служебных файлов, сохранено файлов кампании: 5
✓ Легковесный чемодан ИИ собран успешно (размер: 288.7 КБ)
--- Все проверки импорта папок и легковесного чемодана пройдены успешно! ---

===== npm run smoke:narrative-builder =====

> narthex@0.9.0 smoke:narrative-builder
> tsx scripts/smoke-narrative-builder-and-docs.mts

--- Smoke test: Narrative Builder, Camera & AI Guide ---
✓ Расширенные поля NarrativeIntroEntry типизированы корректно
✓ JSON-схема содержит спецификацию полей image, camera, duration
✓ Руководство ИИ содержит исчерпывающие инструкции по анимациям, камере и нарративу
--- Все проверки успешно пройдены! ---

===== npm run smoke:patch =====

> narthex@0.9.0 smoke:patch
> tsx scripts/smoke-patch-export-and-import.mts

--- Smoke test: Patch Chronicle Export & Import ---
✓ Базовый снимок успешно зафиксирован, список изменений пуст
✓ Изменения и добавления точно отслежены: added: Предмет: Лечебное зелье, modified: Предмет: Меч мастера, modified: Манифест структуры
✓ Текстовая сводка для буфера сгенерирована корректно
✓ Пакет изменений содержит ТОЛЬКО изменённые файлы и исключает неизменённый контент
✓ Патч успешно применён поверх целевой кампании без потери нетронутых файлов
--- Все проверки пакета изменений (Diff Patch) успешно пройдены! ---

===== npm run smoke:cutout =====

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

===== npm run smoke:duration-actions =====

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

===== npm run smoke:craft-fail-time =====

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

===== npm run smoke:dialogue-speaker =====

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

===== npm run smoke:narthex-closed =====

> narthex@0.9.0 smoke:narthex-closed
> node _tools/ScriptCat/tests/narthex-closed-state-smoke.mjs

OK: narthex 1.4.54 — Merged / Closed / Timeout, Closed без мержа → Rework, шлюз 1.5

===== npm run smoke:narthex-tech =====

> narthex@0.9.0 smoke:narthex-tech
> node _tools/ScriptCat/tests/narthex-tech-info-smoke.mjs

OK: техблок 1.4.54 — Executor получает ритуал main, Auditor только читает main, Coordinator без git

===== npm run smoke:drive-gateway =====

> narthex@0.9.0 smoke:drive-gateway
> node _tools/ScriptCat/tests/drive-gateway-arena-smoke.mjs

OK: шлюз 1.5 — корень Диска не трогает, пишет только в Arena/{logs,payloads}

ALL REGISTERED SMOKE SCRIPTS PASSED (53/53)
```
rc=0

## `git diff --cached --stat origin/main -- src/`

```text
```
rc=0

## `git diff --cached --stat origin/main`

```text
 docs/decisions/NAR-2.3.md                          |    9 +
 package.json                                       |    1 +
 .../data/ash-of-caerden/arenas/arena_camp.json     |   25 +
 .../data/ash-of-caerden/arenas/arena_cellar.json   |  213 +++
 .../ash-of-caerden/arenas/arena_forest_road.json   |   25 +
 .../ash-of-caerden/arenas/arena_gates_battle.json  |  129 ++
 .../data/ash-of-caerden/arenas/arena_market.json   |   97 +
 packs/narrative/data/ash-of-caerden/campaign.json  | 1867 ++++++++++++++++++++
 .../ash-of-caerden/codex/codex_kaerden_valley.json |    6 +
 .../ash-of-caerden/codex/codex_oaken_shield.json   |    6 +
 .../data/ash-of-caerden/codex/codex_rat_giant.json |    7 +
 .../ash-of-caerden/cutscenes/cutscene_intro.json   |  273 +++
 .../data/ash-of-caerden/dialogues/aldric.dlg.json  |  388 ++++
 .../data/ash-of-caerden/dialogues/aldric.ink       |   81 +
 .../data/ash-of-caerden/dialogues/bran.dlg.json    |  209 +++
 .../data/ash-of-caerden/dialogues/bran.ink         |   47 +
 .../data/ash-of-caerden/dialogues/corvin.dlg.json  |  283 +++
 .../data/ash-of-caerden/dialogues/corvin.ink       |   57 +
 .../data/ash-of-caerden/dialogues/lena.dlg.json    |  201 +++
 .../data/ash-of-caerden/dialogues/lena.ink         |   40 +
 .../data/ash-of-caerden/dialogues/maeva.dlg.json   |  437 +++++
 .../data/ash-of-caerden/dialogues/maeva.ink        |   91 +
 .../data/ash-of-caerden/dialogues/yorek.dlg.json   |  299 ++++
 .../data/ash-of-caerden/dialogues/yorek.ink        |   72 +
 .../data/ash-of-caerden/entities/item_bread.json   |   15 +
 .../ash-of-caerden/entities/item_chain_shirt.json  |   15 +
 .../ash-of-caerden/entities/item_claymore.json     |   21 +
 .../data/ash-of-caerden/entities/item_club.json    |   21 +
 .../ash-of-caerden/entities/item_dried_meat.json   |   15 +
 .../ash-of-caerden/entities/item_fur_coat.json     |   12 +
 .../ash-of-caerden/entities/item_gambeson.json     |   15 +
 .../ash-of-caerden/entities/item_guard_ration.json |   26 +
 .../ash-of-caerden/entities/item_guard_spear.json  |   21 +
 .../entities/item_healing_salve.json               |   22 +
 .../data/ash-of-caerden/entities/item_herb.json    |   18 +
 .../ash-of-caerden/entities/item_herb_bush.json    |   17 +
 .../entities/item_leather_jerkin.json              |   11 +
 .../ash-of-caerden/entities/item_locked_chest.json |    9 +
 .../ash-of-caerden/entities/item_medallion.json    |   16 +
 .../data/ash-of-caerden/entities/item_pump.json    |   13 +
 .../entities/item_secret_passage.json              |   35 +
 .../ash-of-caerden/entities/item_short_sword.json  |   18 +
 .../data/ash-of-caerden/entities/item_silver.json  |   12 +
 .../ash-of-caerden/entities/item_skeleton.json     |   17 +
 .../ash-of-caerden/entities/item_tavern_key.json   |   10 +
 .../entities/item_travel_lockpicks.json            |   12 +
 .../ash-of-caerden/entities/item_water_barrel.json |   15 +
 .../ash-of-caerden/entities/item_waterskin.json    |   15 +
 .../ash-of-caerden/entities/item_wool_cloak.json   |   12 +
 .../data/ash-of-caerden/entities/item_wrench.json  |   26 +
 .../data/ash-of-caerden/entities/npc_bandit.json   |   53 +
 .../data/ash-of-caerden/entities/npc_bran.json     |   74 +
 .../data/ash-of-caerden/entities/npc_corvin.json   |   36 +
 .../data/ash-of-caerden/entities/npc_guard.json    |   38 +
 .../ash-of-caerden/entities/npc_guard_aldric.json  |   77 +
 .../data/ash-of-caerden/entities/npc_lena.json     |   45 +
 .../data/ash-of-caerden/entities/npc_maeva.json    |   37 +
 .../ash-of-caerden/entities/npc_rat_giant.json     |   47 +
 .../data/ash-of-caerden/entities/npc_yorek.json    |   66 +
 .../ash-of-caerden/entities/player_mercenary.json  |   60 +
 packs/narrative/data/ash-of-caerden/manifest.json  |  111 ++
 packs/narrative/data/ash-of-caerden/project.json   |   29 +
 .../ash-of-caerden/quests/quest_bandit_threat.json |  179 ++
 .../data/ash-of-caerden/quests/quest_rats.json     |   51 +
 .../data/ash-of-caerden/quests/quest_relic.json    |   91 +
 .../ash-of-caerden/quests/quest_secret_path.json   |   50 +
 .../recipes/recipe_healing_salve.json              |   12 +
 .../ash-of-caerden/recipes/recipe_pump_water.json  |   15 +
 .../data/ash-of-caerden/rules/effect_collapse.json |   12 +
 .../ash-of-caerden/rules/encounter_camp_fight.json |   22 +
 .../rules/encounter_camp_fight_surprise.json       |   22 +
 .../rules/encounter_cellar_rats.json               |   34 +
 .../data/ash-of-caerden/rules/encounters.json      |   41 +
 .../ash-of-caerden/rules/gen_whisper_blessing.json |   18 +
 .../ash-of-caerden/rules/gen_whisper_chill.json    |   18 +
 .../ash-of-caerden/rules/gen_whisper_protest.json  |   37 +
 .../ash-of-caerden/rules/rule_city_assault.json    |   52 +
 .../ash-of-caerden/rules/rule_forest_ambush.json   |   39 +
 .../ash-of-caerden/rules/rule_forest_intro.json    |   21 +
 .../ash-of-caerden/rules/rule_gates_greeting.json  |   37 +
 .../ash-of-caerden/rules/rule_intro_cutscene.json  |   17 +
 .../ash-of-caerden/rules/rule_maeva_thanks.json    |   34 +
 .../ash-of-caerden/rules/rule_market_raid.json     |   54 +
 .../data/ash-of-caerden/rules/rule_mine_trap.json  |   20 +
 .../ash-of-caerden/rules/rule_raid_warning.json    |   21 +
 .../rules/rule_start_bandit_quest.json             |   11 +
 .../rules/rule_start_rats_quest.json               |    7 +
 .../rules/rule_start_secret_path.json              |    7 +
 .../ash-of-caerden/rules/rule_weather_ashfall.json |   21 +
 .../rules/rule_weather_ravine_rain.json            |   21 +
 .../data/ash-of-caerden/scenes/scene_barracks.json |   54 +
 .../ash-of-caerden/scenes/scene_forest_edge.json   |   58 +
 .../ash-of-caerden/scenes/scene_gates_front.json   |  100 ++
 .../scenes/scene_gates_guardroom.json              |   47 +
 .../data/ash-of-caerden/scenes/scene_market.json   |   68 +
 .../ash-of-caerden/scenes/scene_mine_deep.json     |  105 ++
 .../ash-of-caerden/scenes/scene_mine_entrance.json |   67 +
 .../ash-of-caerden/scenes/scene_ravine_camp.json   |   65 +
 .../ash-of-caerden/scenes/scene_tavern_hall.json   |  179 ++
 .../data/ash-of-caerden/scenes/scene_temple.json   |   54 +
 .../data/ash-of-caerden/smoke-fixture.json         |    3 +
 packs/narrative/data/ash-of-caerden/world.json     |  261 +++
 packs/narrative/hooks.ts                           |   13 +
 packs/narrative/pack.json                          |   81 +-
 packs/narrative/probes/NAR-2.3-report.md           | 1463 +++++++++++++++
 packs/narrative/probes/campaign.mts                |  242 +++
 packs/narrative/schema/dialogue.schema.json        |   21 +
 packs/narrative/schema/narrative.schema.json       |    9 +
 packs/narrative/schema/quest.schema.json           |   38 +
 packs/narrative/schema/scene.schema.json           |   17 +
 packs/narrative/schema/world.schema.json           |   32 +
 packs/narrative/sim.ts                             |  296 ++++
 packs/narrative/types.ts                           |  128 ++
 packs/narrative/view.ts                            |   29 +
 scripts/playkit/cli.mts                            |   25 +-
 scripts/playkit/project-pack.ts                    |   12 +
 116 files changed, 10375 insertions(+), 31 deletions(-)
```
rc=0
