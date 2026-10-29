# NAR-2.8 — панели пака в студии

**Намерение.** Вкладки паков в студии собираются из `pack.json`: id панели, заголовок, слот, порядок и условия показа приходят из манифеста. После 2.6 и 2.7 в манифестах три пака и двенадцать панелей — студия показывает их, не зная имён. Пункт §7 ТЗ «Студия знает пак» становится невозможной ошибкой: в коде студии нет ветвлений по id пака и нет списков id паков или панелей.

## Решения

**1. Где живёт правило «слот занят одним паком».**

неясно — карточка разрешает положить правило и в пакетный чекер, и в сборку вкладок; при этом живой проект всегда резолвится в один пак, то есть на реальных данных коллизия слотов недостижима.

решил — правило в сборке вкладок (`src/editor/packPanels.ts`), `scripts/check-packs.mts` не тронут. Коллизия — свойство рабочего полотна студии (несколько манифестов в одном наборе), а не отдельного манифеста, который проверяет чекер: одиночный `pack.json` со слотом `right` валиден, и это правильно. Владелец слота — первый пак в порядке переданных манифестов (порядок реестра); каждый следующий пак в том же слоте даёт ошибку сборки, а не тихую «последнюю победу». При любой диагностике сборка возвращает `tabs: []` и точный текст:

```text
Слот «Справа» (right) уже занят паком «Фикстура панелей» (adventure): пак «Фикстура-соперник» (fixture-rival)
добавляет в него панель «panel-rival». Слот может занимать только один пак.

```

(в выводе — одной строкой). Дополнительно ловятся дубль id панели между паками и панель без id/заголовка/слота.

откат — удалить `src/editor/packPanels.ts`, `src/editor/PackPanelWorkbench.tsx`, пункт «Панели пака» в `EditorApp.tsx`/`store.ts`, `scripts/pack-panels-smoke.mts`, каталог `packs/fixtures/panel-slot-collision/`, регистрацию `smoke:pack-panels` и этот отчёт. Проекты, данные, ядро и остальные смоуки не затрагиваются.

**2. Условия показа панели.**

неясно — что считать «включённой возможностью», если проект не объявляет `caps` (формат 1: `public/campaigns/ash-of-caerden` без `project.json`), и как показывать панель без `caps`.

решил — панель видна, если у неё нет `caps` (показывается всегда) или в проекте включена хотя бы одна из её возможностей. Если проект не объявляет `caps` (`activeCaps === null`), фильтра нет: показываются все панели — ровно как редактор вёл себя до миссии, старые кампании не теряют вкладок. Выключенная возможность (`cap_options[mode=off]`) убирает панель целиком; если скрылись все панели, полотно показывает объяснение, а не пустую вкладку. Источник возможностей — ядро (`resolveProjectCapabilityModes`), студия режимы не пересчитывает.

откат — заменить `panelVisible` на «показывать всё» и удалить фильтр в `buildPackPanelTabs`; тест `[5]` смоука станет красным, это и будет сигналом.

**3. Что показывает вкладка.**

неясно — содержимое панели принадлежит паку (бизнес-логика), а студии запрещено носить логику паков; при этом «пустых вкладок» быть не должно.

решил — студия показывает объявленную оболочку панели: заголовок, id панели, пак, слот, порядок, путь схемы данных и список возможностей. Тело вкладки всегда непустое (без схемы — строка «не указана в манифесте»). Так новый пак получает вкладки без единой строки в студии, а логика панели остаётся в паке. Действующие редакторы студии (сцены, диалоги, квесты) остаются в своих разделах и не переписаны — миссия вводит манифестный слой вкладок, а не перекладывает существующий UI.

откат — вернуть `EditorApp.tsx`/`store.ts` к состоянию до миссии и удалить компонент; вкладки паков исчезнут, остальное поведение не изменится.

**4. Пак без панелей.**

неясно — `pack.schema.json` требует у `provides.panels` минимум один элемент, значит установленный манифест без панелей не пройдёт `check:packs`; при этом сборка вкладок не должна падать.

решил — студия терпит `panels: []` и отсутствие `provides.panels`: список вкладок не меняется, ошибок нет. Схема не ослаблена: невалидный манифест по-прежнему не установится, но если он окажется в сборке, студия не упадёт. Это проверяется фикстурой `empty-pack.json` в составе каталога `panel-slot-collision`.

откат — удалить ветку `hiddenPanels`/пустого состояния и `empty-pack.json`; поведение сборки для непустых панелей не изменится.

**5. Остаточные упоминания `narrative` в `src/editor`.**

неясно — оракул §2 запрещает упоминания id пака, но `store.ts` уже содержит документированное умолчание формата 1: `kind: 'narrative'` (5 строк). `public/campaigns/ash-of-caerden` живёт **без** `project.json`, и именно это умолчание его открывает.

решил — оставить умолчание: это значение контракта формата 1 (`docs/contracts/format-v2.md`, строка «`kind` — всегда `narrative`»; `docs/platform.md`, ADR 0003: формат 1 читается бессрочно), а не знание пака. Убрать его — значит отправить эталонную кампанию в экран `PACK_MISSING`, то есть нарушить гейт роли Studio «проект открывается». Ветвлений по id пака нет (0 совпадений `pack ===`/`pack !==`/`switch (pack)`), в новых модулях нет ни одного id пака или панели, в `SceneEditor.tsx` совпадения — имена данных сцены (`narrative_intro`) и CSS-классы (`narrative-*`), в `CampaignEditor.tsx` — ключ `generators.adventures`. Полный разбор grep — в отчёте ниже.

откат — не требуется: откат миссии не меняет эти строки; если контракт формата 1 когда-нибудь получит мигратор, умолчание уйдёт вместе с ним отдельной карточкой.

## Допущения

- В карточке сказано «smoke 53/53, новый `smoke:pack-panels` в том числе». На `origin/main` было 53 смоук-скрипта; после добавления нового их 54. Ниже прогнаны все 54 отдельно, у каждой команды свой код возврата.
- `packs/fixtures/panel-slot-collision/` — один каталог на три манифеста, потому что `check:packs` требует в фикстуре `pack.json` + `expected.json`: `pack.json` (панель фикстуры, проходит чекер), `rival-pack.json` (второй пак в тот же слот) и `empty-pack.json` (пак без панелей) читает только новый смоук. `pack.json` обязан иметь id установленного пака, чтобы пройти семантику `check:contracts`; поэтому у фикстуры id `adventure`, а её панель — `panel-fixture`, которой нет ни в одном живом манифесте.
- Слоты сгруппированы в порядке контракта `left → center → right → bottom → modal`; внутри слота порядок — `order` из манифеста, затем id пака и id панели (детерминированно, без локали). Панель без `order` идёт после объявленных.
- `src/core/**` не менялся (0 строк), `engine.ts` не тронут; `public/ai/cf-play.mjs` не изменился — новый код студии в бандл `cf-play` не входит (sha256 прежний, см. §8).

## Отчёт приёмки NAR-2.8

Ниже — stdout/stderr обязательных команд и коды возврата. Полные логи всех 54 смоуков включены без сокращений.


## 1. Новый смоук `npm run smoke:pack-panels`

Три факта оракула видны в выводе: `[1]` id/слот/заголовок/order из манифеста, `[2]` список вкладок до и после пака без панелей, `[3]` точный текст ошибки, названный слот, два пака и `rc=1` дочернего процесса.

### `npm run smoke:pack-panels`

```text
$ npm run smoke:pack-panels
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
  src/editor sha256=7e0e4dce677649cd… (совпал: true)
  ✓ списки вкладок разные, src/editor не менялся
[5] выключенная возможность убирает панель
  проект пробы: kind=narrative · пак=narrative
  проверено выключаемых возможностей: 15 · скрывают панели: scenes→scenes, dialogue→dialogue, map→map, quests→quests, fmv→fmv
  выключено: scenes (off)
  вкладки всего: scenes(left,10), dialogue(center,20), flow(center,30), map(center,40), quests(center,50), fmv(center,60)
  после выключения: dialogue(center,20), flow(center,30), map(center,40), quests(center,50), fmv(center,60)
  скрыто панелей: 1 · ошибок сборки: 0 · пустых вкладок: 0
  ✓ панель выключенной возможности отсутствует, остальные на месте, вкладки не пустые
[6] живые манифесты: сборка вкладок для трёх паков
  narrative: 6 панелей · scenes · left · «Сцены» · order=10; dialogue · center · «Диалоги» · order=20; flow · center · «Граф ветвления» · order=30; map · center · «Карта мира» · order=40; quests · center · «Квесты» · order=50; fmv · center · «FMV-фрагменты» · order=60
  grid-strategy: 3 панелей · grid-map · center · «Карта сетки» · order=10; units · right · «Юниты» · order=20; economy · bottom · «Экономика» · order=30
  adventure: 3 панелей · adventure-stage · center · «Сцена приключения» · order=10; adventure-combinations · right · «Соединения предметов» · order=20; adventure-riddle · modal · «Крупный план-загадка» · order=30
  ✓ три пака, 12 панелей, коллизий слотов нет
[7] проект открывается и сохраняется без потерь полей
  открыт public/campaigns/ash-of-caerden: 98 файлов (92 JSON, 6 текстовых)
  сохранено и открыто заново: diff полей пуст
  ✓ проект открывается и сохраняется без потерь полей
[8] студия не знает имён паков и панелей
  pack === / pack !== / switch (pack) в src/editor: 0
  id паков в новых модулях студии (packPanels.ts, PackPanelWorkbench.tsx): 0
  id панелей в новых модулях студии: 0
  всего проверено файлов студии: 57 · панелей в живых манифестах: 12
  ✓ ни одного ветвления по id пака и ни одного списка id паков/панелей в коде студии

PACK_PANELS_SMOKE passed

```
rc=0

## 2. Доказательство, что студия не знает имён

```text
$ grep -rn "pack ===" src/editor
(пусто)

$ grep -rn "adventure\|grid-strategy\|narrative" src/editor | grep -v "^.*//" | wc -l
45

$ grep -rnE "===\s*.(adventure|grid-strategy|narrative).|.(adventure|grid-strategy|narrative).\s*===" src/editor
(пусто)

$ grep -rn "panel-fixture\|panel-rival\|scenes\|dialogue\|flow\|quests\|fmv" src/editor/packPanels.ts src/editor/PackPanelWorkbench.tsx
(пусто)

```
rc=0 (команды обёрнуты в `|| true`; сам `grep` без совпадений даёт 1, поэтому факт фиксируется по пустому выводу)

Ни одного ветвления по id пака: 0. Новые модули студии не называют ни пак, ни панель. 45 остаточных совпадений второго grep разложены по источникам:

- `src/editor/store.ts` — 5 строк: документированное умолчание формата 1 `kind: 'narrative'` (см. решение 5), не ветвление и не поиск пака;
- `src/editor/SceneEditor.tsx` — 37 строк: поле данных сцены `narrative_intro` / `seen_narrative_intros` (12) и CSS-классы конструктора вводного повествования `narrative-*` / строки режима (25);
- `src/editor/CampaignEditor.tsx` — 3 строки: ключ данных `generators.adventures` (не пак и не панель).

Полный вывод второго grep:

```text
$ grep -rn "adventure\|grid-strategy\|narrative" src/editor | grep -v "^.*//"
src/editor/CampaignEditor.tsx:3728:        const g = m.generators ?? { event_tables: [], npc: [], scenes: [], adventures: [] }
src/editor/CampaignEditor.tsx:3907:              items={g.adventures ?? []}
src/editor/CampaignEditor.tsx:3908:              onChange={(adventures) => setG({ ...g, adventures: adventures.length ? adventures : undefined })}
src/editor/store.ts:92:  project: ProjectPackInput = { kind: 'narrative' }
src/editor/store.ts:148:          kind: typeof this.project.kind === 'string' ? this.project.kind : 'narrative',
src/editor/store.ts:227:    this.project = { kind: 'narrative' }
src/editor/store.ts:242:          this.project = { kind: 'narrative' }
src/editor/store.ts:249:      this.project = { kind: 'narrative' }
src/editor/SceneEditor.tsx:687:  const rawEntries = scene.narrative_intro ?? []
src/editor/SceneEditor.tsx:702:      delete scene.narrative_intro
src/editor/SceneEditor.tsx:704:      scene.narrative_intro = newSlides
src/editor/SceneEditor.tsx:761:    <details className="spoiler-block" open={Boolean(scene.narrative_intro?.length)}>
src/editor/SceneEditor.tsx:762:      <summary>Вводное повествование (мысли при входе){(scene.narrative_intro?.length ?? 0) ? ` — ${scene.narrative_intro!.length}` : ''}</summary>
src/editor/SceneEditor.tsx:767:            checked={scene.narrative_intro_once !== false}
src/editor/SceneEditor.tsx:769:              scene.narrative_intro_once = e.target.checked ? undefined : false
src/editor/SceneEditor.tsx:780:              value={scene.narrative_intro_next_label ?? ''}
src/editor/SceneEditor.tsx:782:                scene.narrative_intro_next_label = e.target.value.trim() || undefined
src/editor/SceneEditor.tsx:791:              value={scene.narrative_intro_done_label ?? ''}
src/editor/SceneEditor.tsx:793:                scene.narrative_intro_done_label = e.target.value.trim() || undefined
src/editor/SceneEditor.tsx:800:        <div className="narrative-top-tabs">
src/editor/SceneEditor.tsx:805:            <div className="narrative-mode-btn-group">
src/editor/SceneEditor.tsx:808:                className={`narrative-mode-btn ${mode === 'text' ? 'on' : ''}`}
src/editor/SceneEditor.tsx:815:                className={`narrative-mode-btn ${mode === 'slides' ? 'on' : ''}`}
src/editor/SceneEditor.tsx:853:          <div className="narrative-builder">
src/editor/SceneEditor.tsx:860:                <div className="narrative-slide-card" key={idx}>
src/editor/SceneEditor.tsx:861:                  <div className="narrative-slide-head">
src/editor/SceneEditor.tsx:862:                    <span className="narrative-slide-badge">Слайд {idx + 1}</span>
src/editor/SceneEditor.tsx:863:                    <div className="narrative-slide-order-actions">
src/editor/SceneEditor.tsx:895:                    className="narrative-slide-text"
src/editor/SceneEditor.tsx:901:                  <div className="narrative-slide-row">
src/editor/SceneEditor.tsx:938:                  <div className="narrative-media-container">
src/editor/SceneEditor.tsx:940:                    <div className="narrative-media-box">
src/editor/SceneEditor.tsx:941:                      <span className="narrative-media-label">Озвучка</span>
src/editor/SceneEditor.tsx:942:                      <div className="narrative-media-btn-row">
src/editor/SceneEditor.tsx:945:                          className="narrative-media-input"
src/editor/SceneEditor.tsx:951:                        <label className="btn btn-small narrative-file-btn">
src/editor/SceneEditor.tsx:993:                    <div className="narrative-media-box">
src/editor/SceneEditor.tsx:994:                      <span className="narrative-media-label">Арт слайда (опционально)</span>
src/editor/SceneEditor.tsx:995:                      <div className="narrative-art-row">
src/editor/SceneEditor.tsx:996:                        <div className="narrative-art-thumb">
src/editor/SceneEditor.tsx:1003:                        <div className="narrative-art-actions">
src/editor/SceneEditor.tsx:1006:                            className="narrative-media-input"
src/editor/SceneEditor.tsx:1011:                          <div className="narrative-media-btn-row">
src/editor/SceneEditor.tsx:1012:                            <label className="btn btn-small narrative-file-btn">
src/editor/SceneEditor.tsx:1041:                  <div className="narrative-slide-footer">

```
rc=0

## 3. Панели меняются манифестом без правки кода

Смоук `[4]` собирает вкладки дважды: из фикстуры и из её копии с изменёнными `title`, `slot` и `order`, — и сверяет sha256 дерева `src/editor` до и после. Вывод — в §1 (`[4]`): `до правки: panel-fixture · right · «Панель фикстуры» · order=12`, `после правки манифеста: panel-fixture · center · «Панель из манифеста» · order=7`, `src/editor sha256=7e0e4dce677649cd… (совпал: true)`.

## 4. Выключенная возможность убирает панель

Смоук `[5]` перебирает все 15 выключаемых возможностей проекта, для каждой сверяет, что исчезают ровно её панели, затем собирает проект через настоящий `EditorStore` с `cap_options[mode=off]` и рендерит `PackPanelWorkbench` в статическую разметку: скрытой панели в разметке нет, остальные вкладки на месте, ошибок 0, пустых вкладок 0. Вывод — в §1 (`[5]`).

## 5. Живые манифесты трёх паков

Смоук `[6]`: `narrative` — 6 панелей, `adventure` — 3, `grid-strategy` — 3; у каждой панели назван слот и порядок; коллизий слотов нет (12 панелей). Вывод — в §1 (`[6]`).

## 6. Проект открывается и сохраняется без потерь полей

Смоук `[7]` открывает `public/campaigns/ash-of-caerden` (98 файлов), сохраняет все файлы и открывает заново: diff полей пуст. Дополнительно — гейтовые смоуки студии:

### `npm run smoke:view-write`

```text
$ npm run smoke:view-write
✓ статика: все вызовы .touch( в src/editor объяснены действием мастера (43 сайтов)
✓ динамика: загрузка эталонной кампании (95 файлов) не порождает ни одного ряда в diff
✓ двойная сериализация 89 JSON-документов стабильна

инвариант зелёный

```
rc=0

### `npm run smoke:scene-editor`

```text
$ npm run smoke:scene-editor
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

### `npm run smoke:editor-hotspot`

```text
$ npm run smoke:editor-hotspot
--- Смоук-тест: Хотспоты окружения, превью в редакторе сущностей и спрайты в сценах ---
✓ Все проверки хотспотов окружения, спрайтов, превью редактора, синхронной камеры, ручных координат и локализации пройдены успешно!

```
rc=0

## 7. Гейты

### `npx tsc -b`

```text
$ npx tsc -b

```
rc=0

### `npm run check:core-graph`

```text
$ npm run check:core-graph
Core graph OK (34 modules; acyclic; no core imports of engine.ts).

```
rc=0

### `npm run check:brand`

```text
$ npm run check:brand
✓ старое имя не встречается (проверено файлов: 1030)

```
rc=0

### `npm run check:version`

```text
$ npm run check:version
✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG

```
rc=0

### `npm run check:packs`

```text
$ npm run check:packs
pack adventure: schema, registry, caps, local schemas, and import boundaries OK
pack grid-strategy: schema, registry, caps, local schemas, and import boundaries OK
pack narrative: schema, registry, caps, local schemas, and import boundaries OK
pack schema copy: in sync
registry: 3 pack manifests in manifest order
fixture cross-pack-import: PASS — rejected (checker exit 1): packs/fixtures/cross-pack-import/pack.json: caps is missing registered capabilities: fmv
packs/fixtures/cross-pack-import/src/index.ts: imports another pack "grid-strategy" via "../../../grid-strategy/pack.json"
fixture full: PASS — accepted (checker exit 0)
fixture missing-probes: PASS — rejected (checker exit 1): packs/fixtures/missing-probes/pack.json: /provides must have required property 'probes'
packs/fixtures/missing-probes/pack.json: caps is missing registered capabilities: fmv
fixture panel-slot-collision: PASS — accepted (checker exit 0)
fixture unknown-capability: PASS — rejected (checker exit 1): packs/fixtures/unknown-capability/pack.json: caps contains unknown capability "not-registered-capability"
packs/fixtures/unknown-capability/pack.json: caps is missing registered capabilities: fmv

check:packs passed

```
rc=0

### `npm run check:contracts`

```text
$ npm run check:contracts
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
pack adventure: schema, registry, caps, local schemas, and import boundaries OK
pack grid-strategy: schema, registry, caps, local schemas, and import boundaries OK
pack narrative: schema, registry, caps, local schemas, and import boundaries OK
pack schema copy: in sync
registry: 3 pack manifests in manifest order
fixture cross-pack-import: PASS — rejected (checker exit 1): packs/fixtures/cross-pack-import/pack.json: caps is missing registered capabilities: fmv
packs/fixtures/cross-pack-import/src/index.ts: imports another pack "grid-strategy" via "../../../grid-strategy/pack.json"
fixture full: PASS — accepted (checker exit 0)
fixture missing-probes: PASS — rejected (checker exit 1): packs/fixtures/missing-probes/pack.json: /provides must have required property 'probes'
packs/fixtures/missing-probes/pack.json: caps is missing registered capabilities: fmv
fixture panel-slot-collision: PASS — accepted (checker exit 0)
fixture unknown-capability: PASS — rejected (checker exit 1): packs/fixtures/unknown-capability/pack.json: caps contains unknown capability "not-registered-capability"
packs/fixtures/unknown-capability/pack.json: caps is missing registered capabilities: fmv

check:packs passed

```
rc=0

### Все смоуки: 54 из 54

### `npm run smoke:currency`

```text
$ npm run smoke:currency
✓ Валюта: начальный баланс, траты и поступления синхронизированы с предметами в инвентаре

```
rc=0

### `npm run smoke:ink-import`

```text
$ npm run smoke:ink-import
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

### `npm run smoke:fingerprint`

```text
$ npm run smoke:fingerprint
✓ канонический JSON не зависит от порядка ключей
✓ отпечаток стабилен при перемешивании ключей
✓ смена полей публикации (author/attribution/series) отпечаток НЕ меняет — вор не «заначит» чужую кампанию сменой титула
✓ смена контента отпечаток меняет
✓ отпечаток считается без author/attribution вообще

все проверки зелёные

```
rc=0

### `npm run smoke:book-md`

```text
$ npm run smoke:book-md
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

### `npm run smoke:campaign-index`

```text
$ npm run smoke:campaign-index
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

### `npm run smoke:guide`

```text
$ npm run smoke:guide
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

### `npm run smoke:design-doc`

```text
$ npm run smoke:design-doc
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

### `npm run smoke:quest-journal`

```text
$ npm run smoke:quest-journal
✓ j_search resolves to Russian text and its publishing stage — Начало — Отец Корвин просит вернуть медальон Вечного Света: вор, укравший реликвию, сгинул в забро…
✓ j_found resolves to Russian text and its publishing stage — Реликвия найдена — Медальон у меня. Осталось вернуть его отцу Корвину в храм.
✓ j_completed resolves to Russian text and its publishing stage — Завершение — Реликвия вернулась в храм. Корвин благословил меня — рука теперь твёрже уходит от ударов,…
✓ new journal keys use their own namespace, not stage ids
✓ new journal keys avoid collisions
✓ unmapped record still gets a human-readable fallback
ALL GREEN

```
rc=0

### `npm run smoke:quest-journal-runtime`

```text
$ npm run smoke:quest-journal-runtime
✓ starting stage publishes its independent j_search key
✓ found stage publishes its independent j_found key
✓ final stage publishes its independent j_completed key
✓ player journal contains prose, not internal keys
ALL GREEN

```
rc=0

### `npm run smoke:p2`

```text
$ npm run smoke:p2
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

### `npm run smoke:ai-runtime`

```text
$ npm run smoke:ai-runtime
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

### `npm run smoke:ai-task`

```text
$ npm run smoke:ai-task
✓ медиа-аудит видит локальные ссылки, не только assets/
✓ полный пакет редактирования получает расширение .narthex — 795f4bba-9e94-42b0-90f4-114c0202c017-full-task.narthex
✓ AI-пакет сохраняет структуру Campaign Package
✓ AI-пакет содержит единый brief и отчёт по категориям
✓ AI-пакет несёт руководство, схему и бланк
✓ плейтест/медиа/структура присутствуют в отчёте
✓ AI-пакет передаёт агенту существующий ID
✓ новая кампания получает пакет инструкций без фиктивного исходного проекта
✓ служебная папка AI не попадает в установленную кампанию
✓ повтор того же AI-пакета распознаётся как тот же пакет — {"id":"795f4bba-9e94-42b0-90f4-114c0202c017","title":"AI Task Smoke","author":"","description":"Новая кампания. Опишите её в разделе «Кампания».","alreadyInstalled":true}
✓ AI-task smoke-test восстановил исходный реестр
ALL GREEN

```
rc=0

### `npm run smoke:char-templates`

```text
$ npm run smoke:char-templates
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

### `npm run smoke:no-campaign`

```text
$ npm run smoke:no-campaign
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
✓ новая кампания получает UUID независимо от названия — 01fe623f-3513-4886-9c04-20a047146a2d / bb5117c0-6e2a-4f08-a3cc-2b8bbff1f1f1
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

### `npm run smoke:chronicle-manifest`

```text
$ npm run smoke:chronicle-manifest
chronicle-manifest-smoke: ALL GREEN

```
rc=0

### `npm run smoke:dialogues-r31`

```text
$ npm run smoke:dialogues-r31

ПРОПУСК: нет фикстуры _ai-temp/campaing/campaign/dialogues
  не проверено: импорт шести ink-диалогов кампании сценариста без предупреждений
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.

```
rc=0

### `npm run smoke:dialogues-r32`

```text
$ npm run smoke:dialogues-r32

ПРОПУСК: нет фикстуры _ai-temp/campaing
  не проверено: экипировка, диалоги, условия и починка сохранений на кампании сценариста
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.

```
rc=0

### `npm run smoke:breathe-toggle`

```text
$ npm run smoke:breathe-toggle
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

### `npm run smoke:scene-subtitles`

```text
$ npm run smoke:scene-subtitles
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

### `npm run smoke:scene-editor`

```text
$ npm run smoke:scene-editor
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

### `npm run smoke:editor-hotspot`

```text
$ npm run smoke:editor-hotspot
--- Смоук-тест: Хотспоты окружения, превью в редакторе сущностей и спрайты в сценах ---
✓ Все проверки хотспотов окружения, спрайтов, превью редактора, синхронной камеры, ручных координат и локализации пройдены успешно!

```
rc=0

### `npm run smoke:voice-dedup`

```text
$ npm run smoke:voice-dedup
--- Смоук-тест: Voice Coordinator и защита от задваивания озвучки ---
✓ Все проверки Voice Coordinator и защиты от задваивания прошли успешно!

```
rc=0

### `npm run smoke:narrative-intro`

```text
$ npm run smoke:narrative-intro
--- Смоук-тест: narrative_intro, сброс флагов и Ink binding ---
✓ Все проверки narrative_intro, сброса флагов и Ink binding прошли успешно!

```
rc=0

### `npm run smoke:encounters-loader`

```text
$ npm run smoke:encounters-loader

ПРОПУСК: нет фикстуры _ai-temp/campaing/campaign
  не проверено: загрузка кампании с таблицами встреч (encounters/ и rules/)
  почему: одноразовая кампания удалена из репозитория (_ai-temp).
  как вернуть: положить кампанию по этому пути или переписать смоук на фикстуру в tests/fixtures.

```
rc=0

### `npm run smoke:manifest-order`

```text
$ npm run smoke:manifest-order
✓ manifest-order smoke: rules, encounters, and rule traversal follow manifest order under reversed fetch completion

```
rc=0

### `npm run smoke:engine-version`

```text
$ npm run smoke:engine-version
engine-version-smoke: ALL GREEN (engine 0.9.0)

```
rc=0

### `npm run smoke:hero-appearance`

```text
$ npm run smoke:hero-appearance
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

### `npm run smoke:theme-contrast`

```text
$ npm run smoke:theme-contrast
OK: контраст поверхностей, модальные окна и границы редактирования UI

```
rc=0

### `npm run smoke:dialogue-transitions`

```text
$ npm run smoke:dialogue-transitions
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

### `npm run smoke:dialogue-skip`

```text
$ npm run smoke:dialogue-skip
--- Запуск smoke-dialogue-skip-and-item-modal ---
✓ smoke-dialogue-skip-and-item-modal: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!

```
rc=0

### `npm run smoke:travel-transition`

```text
$ npm run smoke:travel-transition
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

### `npm run smoke:stranger`

```text
$ npm run smoke:stranger
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

### `npm run smoke:encumbrance`

```text
$ npm run smoke:encumbrance
--- Запуск encumbrance-smoke ---
✓ encumbrance-smoke: ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!

```
rc=0

### `npm run smoke:cutscene-queue`

```text
$ npm run smoke:cutscene-queue
--- Запуск smoke:cutscene-postcard-queue ---
Проверяем, что во время катсцены открытка сохраняется и не исчезает...
✓ smoke:cutscene-postcard-queue: ВСЕ ПРОВЕРКИ ОЧЕРЕДИ КАТСЦЕН И ОТКРЫТОК ПРОЙДЕНЫ!

```
rc=0

### `npm run smoke:spoil`

```text
$ npm run smoke:spoil
--- Запуск spoil-smoke ---
✓ spoil-smoke: ВСЕ ТЕСТЫ ПОРЧИ ПРЕДМЕТОВ ПРОЙДЕНЫ УСПЕШНО!

```
rc=0

### `npm run smoke:time-semantics`

```text
$ npm run smoke:time-semantics
--- time-semantics-smoke ---
✓ time-semantics-smoke: все группы проверок зелёные

```
rc=0

### `npm run smoke:ai-diff`

```text
$ npm run smoke:ai-diff
--- ai-diff-smoke ---
✓ ai-diff-smoke: все проверки зелёные

```
rc=0

### `npm run smoke:view-write`

```text
$ npm run smoke:view-write
✓ статика: все вызовы .touch( в src/editor объяснены действием мастера (43 сайтов)
✓ динамика: загрузка эталонной кампании (95 файлов) не порождает ни одного ряда в diff
✓ двойная сериализация 89 JSON-документов стабильна

инвариант зелёный

```
rc=0

### `npm run smoke:core`

```text
$ npm run smoke:core
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

### `npm run smoke:pack-missing`

```text
$ npm run smoke:pack-missing
✓ cf-play check отказал кодом PACK_MISSING, без исключения; диагностический текст совпал со Studio
  PACK_MISSING: Тип проекта «narrative» не установлен: нужен пак «Narrative & Branching» (narrative). Установите каталог packs/narrative/ с pack.json, добавьте «narrative» в packs/registry.json и перезапустите студию.
✓ тот же проект с установленным паком: cf-play check rc=0, эталон §2.1 совпал
✓ Studio открыла проект в отказном экране с названием пака и инструкцией; сейв SHA-256 не изменился
✓ Studio открыла тот же проект обычным путём при установленном паке
PACK_MISSING_SMOKE passed · PACK_MISSING · save sha256=10c16c31885a133303544335a80870936fcd2969e5ecdd890a3763837084fc2f

```
rc=0

### `npm run smoke:pack-panels`

```text
$ npm run smoke:pack-panels
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
  src/editor sha256=7e0e4dce677649cd… (совпал: true)
  ✓ списки вкладок разные, src/editor не менялся
[5] выключенная возможность убирает панель
  проект пробы: kind=narrative · пак=narrative
  проверено выключаемых возможностей: 15 · скрывают панели: scenes→scenes, dialogue→dialogue, map→map, quests→quests, fmv→fmv
  выключено: scenes (off)
  вкладки всего: scenes(left,10), dialogue(center,20), flow(center,30), map(center,40), quests(center,50), fmv(center,60)
  после выключения: dialogue(center,20), flow(center,30), map(center,40), quests(center,50), fmv(center,60)
  скрыто панелей: 1 · ошибок сборки: 0 · пустых вкладок: 0
  ✓ панель выключенной возможности отсутствует, остальные на месте, вкладки не пустые
[6] живые манифесты: сборка вкладок для трёх паков
  narrative: 6 панелей · scenes · left · «Сцены» · order=10; dialogue · center · «Диалоги» · order=20; flow · center · «Граф ветвления» · order=30; map · center · «Карта мира» · order=40; quests · center · «Квесты» · order=50; fmv · center · «FMV-фрагменты» · order=60
  grid-strategy: 3 панелей · grid-map · center · «Карта сетки» · order=10; units · right · «Юниты» · order=20; economy · bottom · «Экономика» · order=30
  adventure: 3 панелей · adventure-stage · center · «Сцена приключения» · order=10; adventure-combinations · right · «Соединения предметов» · order=20; adventure-riddle · modal · «Крупный план-загадка» · order=30
  ✓ три пака, 12 панелей, коллизий слотов нет
[7] проект открывается и сохраняется без потерь полей
  открыт public/campaigns/ash-of-caerden: 98 файлов (92 JSON, 6 текстовых)
  сохранено и открыто заново: diff полей пуст
  ✓ проект открывается и сохраняется без потерь полей
[8] студия не знает имён паков и панелей
  pack === / pack !== / switch (pack) в src/editor: 0
  id паков в новых модулях студии (packPanels.ts, PackPanelWorkbench.tsx): 0
  id панелей в новых модулях студии: 0
  всего проверено файлов студии: 57 · панелей в живых манифестах: 12
  ✓ ни одного ветвления по id пака и ни одного списка id паков/панелей в коде студии

PACK_PANELS_SMOKE passed

```
rc=0

### `npm run smoke:capability-modes`

```text
$ npm run smoke:capability-modes
CAPABILITY_MODES_SMOKE passed

```
rc=0

### `npm run smoke:dlg-script`

```text
$ npm run smoke:dlg-script
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

### `npm run smoke:dlg-ui`

```text
$ npm run smoke:dlg-ui
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

### `npm run smoke:folder-import`

```text
$ npm run smoke:folder-import
--- Smoke test: Folder import & AI Repo Kit ---
✓ Все 15 служебных файлов Git, tools и скриптов успешно отфильтрованы
✓ Все 19 канонических файлов кампании успешно разрешены
✓ Префикс GitHub репозитория автоматически распознан и удален
✓ Симуляция 2828 файлов репозитория: успешно обработана, отфильтровано 2824 служебных файлов, сохранено файлов кампании: 5
✓ Легковесный чемодан ИИ собран успешно (размер: 292.0 КБ)
--- Все проверки импорта папок и легковесного чемодана пройдены успешно! ---

```
rc=0

### `npm run smoke:narrative-builder`

```text
$ npm run smoke:narrative-builder
--- Smoke test: Narrative Builder, Camera & AI Guide ---
✓ Расширенные поля NarrativeIntroEntry типизированы корректно
✓ JSON-схема содержит спецификацию полей image, camera, duration
✓ Руководство ИИ содержит исчерпывающие инструкции по анимациям, камере и нарративу
--- Все проверки успешно пройдены! ---

```
rc=0

### `npm run smoke:patch`

```text
$ npm run smoke:patch
--- Smoke test: Patch Chronicle Export & Import ---
✓ Базовый снимок успешно зафиксирован, список изменений пуст
✓ Изменения и добавления точно отслежены: added: Предмет: Лечебное зелье, modified: Предмет: Меч мастера, modified: Манифест структуры
✓ Текстовая сводка для буфера сгенерирована корректно
✓ Пакет изменений содержит ТОЛЬКО изменённые файлы и исключает неизменённый контент
✓ Патч успешно применён поверх целевой кампании без потери нетронутых файлов
--- Все проверки пакета изменений (Diff Patch) успешно пройдены! ---

```
rc=0

### `npm run smoke:cutout`

```text
$ npm run smoke:cutout
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

### `npm run smoke:duration-actions`

```text
$ npm run smoke:duration-actions
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

### `npm run smoke:craft-fail-time`

```text
$ npm run smoke:craft-fail-time
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

### `npm run smoke:dialogue-speaker`

```text
$ npm run smoke:dialogue-speaker
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

### `npm run smoke:narthex-closed`

```text
$ npm run smoke:narthex-closed
OK: narthex 1.4.57 — Merged / Closed / Timeout, Closed без мержа → Rework, шлюз 1.5

```
rc=0

### `npm run smoke:narthex-tech`

```text
$ npm run smoke:narthex-tech
OK: техблок 1.4.57 — Executor получает ритуал main, Auditor только читает main, Coordinator без git

```
rc=0

### `npm run smoke:drive-gateway`

```text
$ npm run smoke:drive-gateway
OK: шлюз 1.5 — корень Диска не трогает, пишет только в Arena/{logs,payloads}

```
rc=0

```text
SMOKES total=54 passed=54 failed=0

```
rc=0

## 8. Бандл

### `npm run build:playkit-bundle`

```text
$ npm run build:playkit-bundle

  public/ai/cf-play.mjs  936.9kb

⚡ Done in 71ms

```
rc=0

### `sha256sum public/ai/cf-play.mjs`

```text
$ sha256sum public/ai/cf-play.mjs
3d6152036d547c6c83ef53df0ac15d0935640b016d553823f1986e9ae2942281  public/ai/cf-play.mjs

```
rc=0

### `npm run check:playkit-bundle`

```text
$ npm run check:playkit-bundle
✓ public/ai/cf-play.mjs совпадает со сборкой из src (0.9.0, sha256 3d6152036d547c6c83ef53df0ac15d0935640b016d553823f1986e9ae2942281)

```
rc=0
sha256 прежний: `3d6152036d547c6c83ef53df0ac15d0935640b016d553823f1986e9ae2942281`. Причина: `build:playkit-bundle` собирает `scripts/playkit/cli.mts` из ядра и манифестов паков; новый код лежит в `src/editor/**`, в бандл оракула не входит. `git diff --stat origin/main -- public/ai/cf-play.mjs` пуст.

## 9. Эталоны не сдвинуты

### `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden`

```text
$ node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden

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
маршрутов нет (/home/user/narthex/public/campaigns/ash-of-caerden/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp

```
rc=0

### `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure`

```text
$ node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure

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

### `node public/ai/cf-play.mjs check public/campaigns/fmv-crossing`

```text
$ node public/ai/cf-play.mjs check public/campaigns/fmv-crossing

# Проверка кампании · Перекрёсток огней — FMV

✓ проверка пройдена

## Статика
1 сцен · 1 локаций · 0 диалогов · 0 узлов ink
ошибок 0 · предупреждений 0

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/fmv-crossing/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":5}

## Покрытие
посещено 1 из 1 достижимых сцен

```
rc=0

### `npm run probe:narrative-pack`

```text
$ npm run probe:narrative-pack
✓ манифест и локальные схемы: 10 сцен, 8 локаций, 6 диалогов, 4 квеста
✓ эталон не включает experimental fmv автоматически: прежние 15 caps сохранены
✓ catalogue из packs/registry.json и pack.json:
  narrative: narrative, scenes, dialogue, map, inventory, needs, skills, relationships, trade, combat, quests, cutscenes, fmv, codex, crafting, time
  grid-strategy: grid, pathfinding, units, economy, ai-director
  adventure: adventure
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

### `npm run probe:adventure-mechanics`

```text
$ npm run probe:adventure-mechanics
✓ adventure.json: schema PASS · validators 4/4 · errors=0
✓ ходьба к точке клика: (320,560) → (520,560) · узлов пути=2 · длина=200
✓ режимы курсора: walk → take → look → talk → walk · переключение=adventure_cursor
✓ соединение предметов: item_herb + item_herb → item_healing_salve · inventory=1
✓ крупный план-загадка: gate_sigils → ash,oak,sun · solved=true · scene=scene_gates_guardroom
✓ маршрут: ending=ending_gate_unlocked · scenes=scene_gates_front,scene_gates_guardroom · steps=16
✓ детерминизм: 20/20 · view on/off один state sha256=cd45d13e29fad81404ee1a78dc33722373e5a86453685bd564a797e50ab5cab0
✓ сейв narrative → adventure: открыт без ошибок · narrative sha256=b0b2ef1b1146c95dbc8345ce16563990f203df8068657e11b33f8bfa86618835
✓ сейв adventure → narrative: открыт без ошибок · narrative sha256=c9e9fec8d9eddb04f95c8ebe8e45149a23809bd375667222f019ec2d4d3b9029 · travel=loc_market
✓ view: draw commands=43 · запись в состояние отклонена · sha256=cd45d13e29fad81404ee1a78dc33722373e5a86453685bd564a797e50ab5cab0
✓ project resolver: installed=ready · without adventure=PACK_MISSING · packId=adventure
ADVENTURE_MECHANICS_PROBE passed

```
rc=0

### `npm run probe:fmv`

```text
$ npm run probe:fmv
✓ FMV schema: document PASS · fragments 3/3 PASS · choices resolve
  фрагмент fragment_a: duration_ms=4000 · src=assets/video/fragment_a.webm
  фрагмент fragment_b: duration_ms=5000 · src=assets/video/fragment_b.webm
  фрагмент fragment_c: duration_ms=4000 · src=assets/video/fragment_c.webm
✓ предзагрузка: start:fragment_a bytes=1673 · after fragment_a ready, before choice:fragment_b bytes=1960 · after fragment_a ready, before choice:fragment_c bytes=1671
✓ fragment_a → choose_dialogue[0]=follow_lantern → fragment_b; ready(next)=true · usedChoices=fmv_crossing:fragment_a:0 · flag=chose_lantern:true
✓ условие перехода: runtime.ready.includes(choice.next) === true; кадры/position_ms не вызывают переход и не меняют state
✓ нет пустого кадра: empty_frames=0 · next_frame_in_draw_queue=1 · fragment=fragment_b · presentation=2
✓ детерминизм: 20/20 одинаковых прогонов · view on/off · state sha256=b9fc4ad08a0d74ab47eaa259d7c2a80bede40e276f8cccdb041477850cc939d8
✓ субтитры: 2 реплики (fragment_a + fragment_b) · journal=0 · audio/speech дублирования в лог=0
✓ ранний выбор: fragment_a/buffering → ready(fragment_b) → fragment_b; повторное применение=0
✓ эталон обычного narrative: event=choose_dialogue(0) в обоих случаях · flags/inventory/journal/usedChoices совпали · key=fmv_crossing:fragment_a:0
✓ view write rejected: view state for narrative is read-only; state writes are forbidden · sha256 before=after=b9fc4ad08a0d74ab47eaa259d7c2a80bede40e276f8cccdb041477850cc939d8
✓ оффлайн: code=FMV_OFFLINE · text=Загрузчик отключён: видео недоступно офлайн; проект сохранён, повторите позже. · host_paused=false · project_state=intact · poster=true
FMV_PROBE passed

```
rc=0

### `npm run probe:fmv-passport`

```text
$ npm run probe:fmv-passport
✓ возможность fmv: pack=narrative · status=experimental · probe=probe:fmv · registry=runtime
✓ packs/narrative/pack.json: fmv declared · caps 15 → 16
✓ docs/contracts/examples/pack.narrative.json: schema PASS · semantics PASS · caps=16
✓ пробы narrative: 16/16 возможностей имеют npm probe · fmv=probe:fmv
FMV_PASSPORT_PROBE passed

```
rc=0

## 10. Границы

```text
$ git diff --cached --stat origin/main -- src
 src/editor/EditorApp.tsx          |   5 +-
 src/editor/PackPanelWorkbench.tsx | 143 +++++++++++++++++++++++++++
 src/editor/editor.css             |  19 ++++
 src/editor/packPanels.ts          | 202 ++++++++++++++++++++++++++++++++++++++
 src/editor/store.ts               |   1 +
 5 files changed, 369 insertions(+), 1 deletion(-)

$ git diff --cached --name-only origin/main -- src
src/editor/EditorApp.tsx
src/editor/PackPanelWorkbench.tsx
src/editor/editor.css
src/editor/packPanels.ts
src/editor/store.ts

$ git diff --cached --stat origin/main -- src/core src/core/engine.ts
(пусто: ядро и engine.ts не тронуты)

$ git diff --cached --stat origin/main -- packs/narrative packs/adventure public/campaigns
(пусто: данные паков и эталонные кампании не тронуты)

$ git diff --cached --stat origin/main -- public/ai/cf-play.mjs
(пусто: бандл не изменился)

$ git diff --cached --stat origin/main
 package.json                                       |   1 +
 .../fixtures/panel-slot-collision/empty-pack.json  |  24 ++
 packs/fixtures/panel-slot-collision/expected.json  |   5 +
 packs/fixtures/panel-slot-collision/pack.json      |  49 +++
 .../fixtures/panel-slot-collision/rival-pack.json  |  32 ++
 .../schema/fixture.schema.json                     |   7 +
 scripts/pack-panels-smoke.mts                      | 418 +++++++++++++++++++++
 src/editor/EditorApp.tsx                           |   5 +-
 src/editor/PackPanelWorkbench.tsx                  | 143 +++++++
 src/editor/editor.css                              |  19 +
 src/editor/packPanels.ts                           | 202 ++++++++++
 src/editor/store.ts                                |   1 +
 12 files changed, 905 insertions(+), 1 deletion(-)

$ wc -l src/editor/packPanels.ts src/editor/PackPanelWorkbench.tsx scripts/pack-panels-smoke.mts
  202 src/editor/packPanels.ts
  143 src/editor/PackPanelWorkbench.tsx
  418 scripts/pack-panels-smoke.mts
  763 total

$ git diff --cached --check
(пусто)

```
rc=0 (каждая команда)

Модули студии: 202 и 143 строки (лимит 450). Смоук — 418 строк. Отчёт в диффе не участвует: он добавлен после снятия границ; полный `git diff --cached` перед коммитом включает ещё `docs/decisions/NAR-2.8.md`.
