# NAR-5.14 · Возможности state-ui в experimental

## Изменения

В двух независимых ручных копиях реестра, docs/contracts/caps.json и
src/core/caps.ts, изменены только строки state-machine, cards, auto-battle:
status planned → experimental; probe null → probe:state-ui.
Обе копии входят в один PR. Генератор не добавлен, логика ядра не менялась.
Статус самого пака не менялся: карточка требует только три возможности.

## turn-validation

Оставлено planned с probe=null. На базе origin/main 81fd2fd проекта 5.5
ещё нет: public/campaigns содержит ash-of-caerden, ash-of-caerden-adventure,
fmv-crossing; отчёт NAR-5.5 отсутствует. Поэтому включение turn-validation
именно в caps проекта 5.5 не подтверждено. Объявление этой возможности в
packs/state-ui/pack.json — список пака, а не caps проекта 5.5.
Допущение: при отсутствии проекта соблюдаем минимальный явный Scope из
трёх строк; перевод turn-validation без свидетельства не производится.
Откат: вернуть status/probe в тех же трёх строках обоих файлов.

## Проверки

probe:state-ui уже объявлена в package.json; package.json не изменялся.
check:contracts проходит целиком, включая проверку независимых реестров,
метаданных и имён проб. Тесты, scripts, packs, public/campaigns и
format-v2.md не изменены. `git diff --check`: rc=0, пустой вывод.

### `npm run check:contracts` — rc=0

```text

> narthex@0.9.0 check:contracts
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

контракты согласованы: 42 проверок

> narthex@0.9.0 check:packs
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

> narthex@0.9.0 check:pack-boundary
> tsx scripts/check-pack-boundary.mts

fixture (a) branch on pack ID in src/core: PASS — rc=1, src/core/fixture-branch.ts:1
fixture (b) entry.pack filter in scripts probe: PASS — rc=0
fixture (c) registry diagnostic string literal: PASS — rc=0
fixture (d) import from packs/** in src/core: PASS — rc=1, src/core/fixture-import.ts:1
✓ core pack boundary: 37 source files; no pack-ID branches or imports from packs/**
check:pack-boundary passed

> narthex@0.9.0 check:decisions
> tsx scripts/check-decisions.mts

fixture (a) decision without Статус: remains valid: PASS — rc=0
fixture (b) unsupported status rejected: PASS — rc=1
fixture (c) accepted without Дата решения rejected: PASS — rc=1
fixture (d) rejected without Решил rejected: PASS — rc=1
fixture (e) proposed lists date and age without failing: PASS — rc=0, date=2026-10-20, age=5 days
fixture (f) proposed without date remains informational: PASS — rc=0, date=unknown, age=unknown
decision status check: 43 files; statusless=31; proposed=0; accepted=12; rejected=0; superseded=0
check:decisions passed

> narthex@0.9.0 check:module-size
> tsx scripts/check-module-size.mts

fixture (a) changed module 451 lines: PASS — rc=1, lines=451, limit=450
fixture (b) changed module 450 lines: PASS — rc=0, lines=450, limit=450
fixture (c) engine.ts 600 lines: PASS — rc=0, lines=600, limit=600
fixture (d) engine.ts 601 lines: PASS — rc=1, lines=601, limit=600
limit=450 facade=600
baseline source modules=166
changed source modules=31
module packs/state-ui/cards.ts: 192/450 lines (changed)
module packs/state-ui/cardsPanel.ts: 31/450 lines (changed)
module packs/state-ui/machine.ts: 22/450 lines (changed)
module packs/state-ui/panel.ts: 31/450 lines (changed)
module packs/state-ui/probe.mts: 128/450 lines (changed)
module packs/state-ui/types.ts: 105/450 lines (changed)
module packs/state-ui/validate.ts: 94/450 lines (changed)
module packs/state-ui/validateCards.ts: 85/450 lines (changed)
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
module src/player/DialogueOverlay.tsx: 387/450 lines (changed)
module src/player/GameView.tsx: 299/450 lines (changed)
module src/player/ItemInteractDialog.tsx: 61/450 lines (changed)
module src/player/MapScreen.tsx: 444/450 lines (changed)
module src/player/SceneForeground.tsx: 152/450 lines (changed)
module src/player/SceneIntroOverlay.tsx: 44/450 lines (changed)
module src/player/SceneNavigation.tsx: 39/450 lines (changed)
module src/player/SceneScreen.tsx: 414/450 lines (changed)
module src/player/useDialogueAudio.ts: 128/450 lines (changed)
external debt (non-blocking unless changed): src/core/combat.ts 1765; src/core/savemigrate.ts 2
check:module-size passed

> narthex@0.9.0 check:browser-gate
> tsx scripts/check-browser-gate.mts

Гейт браузера: ok — ложных формулировок 0, инфраструктура на месте, CI вызывает playthrough.

> narthex@0.9.0 check:dev-campaigns
> tsx scripts/check-dev-campaigns.mts

Гейт внутренних кампаний: ok — 3 полигона, 1 записей в реестре, сирот нет; объявленных отсутствий — ash-of-caerden: 27, ash-of-caerden-adventure: 27.

> narthex@0.9.0 check:campaign-formats
> tsx scripts/audit-campaign-formats.mts

✓ Проверена JSON Schema Draft 2020-12: 125 типов
✓ Проверены отдельные JSON/Ink-модули и ссылки: 192 файлов в 3 кампаниях
✓ Campaign Package ↔ MonolithDoc: round-trip без потерь и предупреждений
✓ Структура AI-руководства и копируемый промпт синхронизированы с MonolithDoc

> narthex@0.9.0 smoke:campaign-visibility
> tsx scripts/campaign-visibility-smoke.mts

✓ smoke:campaign-visibility — dev/release/отказ работают

> narthex@0.9.0 smoke:campaign-fmv-audit
> tsx scripts/campaign-fmv-audit-smoke.mts

  ✓ source FMV contract: rc=0; ERROR=0
  ✓ ordinary scene without FMV: rc=0; ERROR=0
  ✓ missing fragment src: rc=1; ERROR: Схема FMV fmv/fmv_crossing.json/fragments/0: must have required property 'src'
  ✓ unknown FMV mode: rc=1; ERROR: Схема FMV fmv/fmv_crossing.json/: must NOT have additional properties
  ✓ unknown choice field: rc=1; ERROR: Схема FMV fmv/fmv_crossing.json/fragments/0/choices/0: must NOT have additional properties
  ✓ unknown condition field: rc=1; ERROR: Схема FMV fmv/fmv_crossing.json/fragments/0/choices/0/conds/0: must NOT have additional properties
  ✓ standalone audit bundle: rc=0; ERROR=0
  ✓ standalone bundle rejects unknown mode: rc=1; ERROR: Схема FMV fmv/fmv_crossing.json/: must NOT have additional properties
✓ FMV audit smoke — source and bundle strict; missing src/unknown mode/unknown fields rejected; ordinary scene green

> narthex@0.9.0 smoke:absence-policy
> tsx scripts/absence-policy-smoke.mts

✓ smoke:absence-policy — объявления читаются из кампании, витрина остаётся строгой

> narthex@0.9.0 check:schema-freeze
> tsx scripts/schema-freeze.mts

Формат v2 не заморожен: манифеста docs/contracts/format-v2.freeze.json нет.
Это ожидаемо до фазы 4: гейт включится карточкой, которая принимает заморозку.

> narthex@0.9.0 media:check
> tsx scripts/media-check.mts

Медиа кампаний
  ash-of-caerden                 0 ассетов · 0 изображений · 0 аудио · 0 видео · 0.0 КБ · отсутствий объявлено 27
  ash-of-caerden-adventure       0 ассетов · 0 изображений · 0 аудио · 0 видео · 0.0 КБ · отсутствий объявлено 27
  fmv-crossing                   6 ассетов · 3 изображений · 0 аудио · 3 видео · 7.0 КБ · отсутствий объявлено 0

Находки
  (пусто)

Итого: 0 провалов, 0 предупреждений.
```

### `npx tsc -b` — rc=0

```text
(пустой вывод)
```

### `npm run probe:state-ui` — rc=0

```text

> narthex@0.9.0 probe:state-ui
> tsx packs/state-ui/probe.mts

✓ state-ui data: JSON Schema and semantic validator accept the declared turn-cycle machine
✓ deterministic simulation: begin → finish ⇒ ready → active → completed
✓ read-only state panel: active state and both available events are projected from the manifest data
✓ cards and decks: JSON Schema, reference validator, and read-only panel accept 4 cards / 2 decks
✓ deck setup and card move: explicit rolls shuffled counter, heavy, guard, jab; drew and played counter
✓ auto-battle: player after 4 rounds and 8 card plays
✓ negative validator control: duplicate (state, event) transition is rejected
✓ real player: cf-play check verdict=ok, pack=narrative, seam=narrative.sim, rc=0
STATE_UI_PROBE passed
```


## CI / PR

PR #127. CI run 40745819228 упал на проверке свежести бандла аудита
до сборки; последующие шаги пропущены. Полный CI не зелёный.
Локальный check:audit-bundle также rc=1 (вывод ниже). Бандл вне Scope,
не пересобирался; обязательные три проверки карточки прошли rc=0.
Merge выполняется по прямому требованию карточки, без изменения проверок.

```text

> narthex@0.9.0 check:audit-bundle
> tsx scripts/check-audit-bundle.mts

✗ public/ai/campaign-audit.mjs is stale relative to scripts/campaign-audit.mts
  committed: 1020401 bytes, sha256 28087d972e8a0040d02bf4a39d8e3cc24fedc045cd2576439678c558292f5a2b
  generated: 1020452 bytes, sha256 91b1e86ef03c62f0d7f1a5d88600a423f8507f1cf18c80c5b16c21b500426764
  first differing byte: 301154
  rebuild with: npm run build:ai-bundle
```
