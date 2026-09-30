# Плейтест: «Тишина Орфея» (`_backlog/campaign.json`)

**Дата:** 2026-09-30  
**Ветка:** `arena/01a0f15a-chronicle-forge`  
**Кампания:** `tishina_orfeya` v1.1.0  
**Движок:** 0.7.0  
**Правило:** баги кампании не трогаем; чиним только движок.

## Цель

Пройти кампанию headless-раннером «как человек» (ускоренно): сцены → слоты →
диалоги → карта → бой → крафт → финал. Фиксировать падения/некорректное
поведение движка, чинить `src/core` / `src/editor` / рантайм.

## Инструменты

| Файл | Назначение |
| --- | --- |
| `scripts/play-tishina.mts` | полный прогон монолита «как человек» |
| `scripts/tishina-engine-smoke.mts` | регрессии найденных багов движка |
| `docs/playtest/tishina-orfeya-run-log.txt` | последний лог прогона |

```bash
npx tsx scripts/tishina-engine-smoke.mts
npx tsx scripts/play-tishina.mts
# или: npx tsx scripts/play-tishina.mts _backlog/campaign.json
```

## Сюжетный маршрут (канон design_doc)

1. **Шлюз** — табличка, баллон, карта → жилой отсек  
2. **Коридор** — питание, ОРИОН, планшет, автомат (мультитул)  
3. **Каюты** — тело Лин (жетон), шкафчик, ЭХО  
4. **Медотсек** — аптечка, записка (сон жжёт тики — опасно)  
5. **Шлюз рубки** — жетон/резак → рубка  
6. **Рубка** — чёрный ящик, журнал, ОРИОН  
7. **Машинный коридор** — погоня/дрон, течь, ящик  
8. **Реактор** — Кастор, ядро, ТЭХ-4, пульт (финал)

### Концовки

| Флаг | Концовка |
| --- | --- |
| `finale_burn` | Пепел в атмосфере |
| `finale_network` | Сигнал вышел в сеть |
| `finale_silence` | Немая ноша (нужен `item_drive_seal`) |
| `finale_remember` | Тот, кто помнит (meta `endings_seen` ≥ 2) |
| `merged` | Слияние (смерть) |
| (пусто) | Холодный судовой журнал |

### Жёсткий таймер (кампания)

- `starting_tick = 3`, `rule_clock_warn` @ tick≥6, `rule_clock_critical` @ tick≥9  
- Критический тик телепортирует в реактор и ставит `finale_forced`  
- Воздух −8/тик, энергия −3/тик — без баллонов/пайков забег умирает

## Результат прогона (2026-09-30)

**`RESULT: victory / ending_silence`** («Немая ноша»)

Полный маршрут:

- intro cutscene + `quest_comms`  
- hab: питание, ОРИОН (ключ шифра), вендор (мультитул), планшет  
- quarters: жетон Лин, шкафчик, ЭХО (`echo_met`, sanity −3)  
- med: аптечка  
- bridge: жетон → шлюз, чёрный ящик, `truth_known`, квесты comms+blackbox done  
- engineering: critical teleport @tick10, Кастор, рецепты, ядро, бой ТЭХ-4 (победа)  
- craft `recipe_seal_drive`, финал `finale_silence`  
- все 3 квеста `completed`

Лог: `docs/playtest/tishina-orfeya-run-log.txt`.

## Баги движка (исправлены)

### E1. `schedule: []` прячет NPC из `default_entity`

**Симптом.** ОРИОН, ПС-9, ЭХО стоят в слотах как `default_entity`, но
`slotOccupants()` возвращал `entity: null`. Игрок не мог кликнуть терминал.

**Причина.** Редактор/ИИ часто пишут `"schedule": []`. Движок считал
`!!def.schedule === true` → NPC «занят расписанием где-то ещё» → default
слот пустой. То же для пустого `presence_overrides`.

**Фикс.** `src/core/engine.ts`: `npcHasSchedule` / `npcHasPresenceOverrides`
требуют **непустой** массив. Пустой `[]` = «расписания нет».

### E2. `generateInk` не объявлял EXTERNAL для новых эффектов

**Симптом.** Диалог Кастора (`unlock_recipe`) → `Compilation failed` →
падение `startDialogue` валило весь рантайм.

**Причина.** `inkEffect()` уже эмитил `~ unlock_recipe(...)`,
`unlock_codex`, `apply_status`, `set_weather`, `set_description`, но список
`EXTERNAL` в `generateInk` их не включал. inkjs отказывался компилировать.

**Фикс.** `src/editor/dialogueDoc.ts` — полный список EXTERNAL + сигнатуры.

### E3. Точка входа диалога только `main`

**Симптом.** После E2 диалог «открывался» без реплик: ChoosePathString('main')
молча падал на dlg с узлом `n_start` (типичный ИИ-id).

**Фикс.** `src/core/engine.ts` + `firstInkKnot()` в `dialogue.ts`:
`knot ?? main ?? первый === knot ===` в исходнике.

### E4. Битый ink валил игру исключением

**Фикс.** `createStory` оборачивает ошибку с id диалога и preview;
`startDialogue` ловит, пишет сообщение игроку, не бросает наружу.

### E5. Хрупкий lookup `campaign.dialogues[npc.dialogue]`

**Симптом.** Ссылка `dlg_orion` vs ключ `dialogues/dlg_orion.ink` — мимо
(repairMonolith нормализует, но прямой monлит/ручные правки — нет).

**Фикс.** `resolveDialogueSource(ref)` — канон, bare id, суффиксы.

## Замечания по кампании (не чиним)

1. **Таймер 9 тиков** очень жёсткий: airlock→hab(2) + bridge(2) + eng(3) = tick 10
   уже на входе в машинное → `finale_forced` телепорт, погоня в коридоре
   часто скипается. Баланс контента, не движок.  
2. **`quest_core` никто не стартует правилом** — только вручную/из эффектов.
   Раннер зовёт `startQuest`; без этого стадии квеста не ведутся (флаги
   финала всё равно работают через rules).  
3. **Мультитул** только у вендора (40 кр) / лут ТЭХ-4 / meta-unlock.  
4. **Сон на койке +4 тика** при таймере 9 — ловушка.  
5. **Карман Лин** не даёт жетон (только журнал); жетон — spot-проверка
   «Осмотреть тело». Дизайн ок, но неочевидно.  
6. Пустые `schedule: []` у всех NPC — артефакт генерации; после E1 безобидны.

## Чеклист

- [x] Старт / intro / quest_comms  
- [x] Жилой: питание, ОРИОН, торговля  
- [x] Каюты + медотсек  
- [x] Рубка + blackbox  
- [x] Engineering (forced) + Кастор  
- [x] Core + heavy drone combat  
- [x] Craft seal + финал silence  
- [x] Регрессионный smoke  
- [ ] Повторный забег / `finale_remember` (опц., meta)  
- [ ] Концовка burn / network отдельно (опц.)  

## Изменённые файлы движка

- `src/core/engine.ts` — schedule[], dialogue resolve/fallback, soft-fail ink  
- `src/core/dialogue.ts` — `firstInkKnot`, rich compile errors  
- `src/editor/dialogueDoc.ts` — EXTERNAL unlock_*/status/weather/description  
- `scripts/play-tishina.mts` — headless-прогон  
- `scripts/tishina-engine-smoke.mts` — регрессии  
- `docs/playtest/*` — этот отчёт + лог  
