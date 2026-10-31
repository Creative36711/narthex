# STAB-1.20 — экзамен в браузере: оба маршрута до финалов и до сохранений

Карточка: `40a6f0cf-5705-8195-accc-f8ebe4b5412f`, run `956a6819-9ff8-44b8-becf-6927d09237d3`.
База: `df93c7b` (main, «Merge pull request #185 from Creative36711/arena/e01c875b-narthex»).
Проверяется: `scripts/visual/playthrough.mjs` (`npm run playthrough:exam -- <url> <outDir>`).

## 1. «До» (`df93c7b`, база без правок)

`npm run playthrough:exam -- http://localhost:4173 /tmp/stab/exam-base` → **rc 1**, 13 шагов, 3 находки:

| Пак | Шагов | Финал | Ошибка маршрута |
| --- | --- | --- | --- |
| `ash-of-caerden` | 1 | нет | `locator.waitFor: Timeout 8000ms exceeded.` |
| `ash-of-caerden-adventure` | 12 | `ending_gate_unlocked` | — |

Находки базы: «ошибка маршрута: `locator.waitFor: Timeout 8000ms exceeded.`», «снято 1 шагов,
требуется не менее 8», «финальный экран не достигнут». Шагов проверки сохранений в базовом
маршруте не было вовсе — поэтому «проверки сохранений не выполнились» на базе означает и
отсутствие маршрута до финала, и отсутствие самих шагов сохранения.

## 2. Причина таймаута (таймауты не поднимались)

`chooseCampaign()` ждал карточку кампании по тексту `/эталон narrative/i`:

```js
const row = page.locator('.campaign-row').filter({ hasText: definition.card }).first()
await row.waitFor({ state: 'visible', timeout: 8000 })
```

В браузере отдаётся `public/campaigns/ash-of-caerden/campaign.json`, где название — «Пепел Каэрдена».
Строка «[DEV] … эталон narrative» есть только в исходных данных пака
(`packs/narrative/data/ash-of-caerden/campaign.json`), которых страница не видит. Отсюда:

* `.campaign-row` по `/эталон narrative/i` не совпал ни с одной строкой (проверено пробой
  `/tmp/stab/probe-rows.mjs`: `/эталон narrative/` → 0 строк, реальные заголовки — «Пепел Каэрдена»,
  «[DEV] Пепел Каэрдена — проект adventure»);
* `.waitFor({ state: 'visible', timeout: 8000 })` на пустом локаторе и выдал
  «Timeout 8000ms exceeded» — это симптом, а не причина: сообщение Playwright не называет,
  что именно искалось.

**Правка.** Селектор карточки берётся из фактических данных меню: `card` — название кампании,
`cardNot` — отсечение adventure-полигона того же пака, и диагностика вместо «немого» таймаута:

```js
let rows = page.locator('.campaign-row').filter({ hasText: definition.card })
if (definition.cardNot) rows = rows.filter({ hasNotText: definition.cardNot })
if ((await rows.count()) === 0) {
  const titles = await page.locator('.campaign-card-title').allInnerTexts()
  throw new Error(`карточка кампании ${definition.id} не найдена по тексту ${definition.card}: в меню …`)
}
```

Ни один `timeout` в существующих ожиданиях не изменён; `git diff` не трогает числа таймаутов
(все `timeout:` в диффе принадлежат новым шагам сохранений). Защищённые кампании
(`public/campaigns/ash-of-caerden*`) не редактировались — правился только экзамен.

## 3. Почему «сохранение после финала» — это ручной слот

Финал в narrative-паке стирает автосохранение намеренно: `gameOver()` в
`packs/narrative/roguelike.ts` вызывает `removeSave` (то же в `restart` и `newGamePlus`);
в `src/player/SavesPanel.tsx` кнопка «Записать» заперта при `game_over`, а текст панели
обещает, что ручные слоты переживают смерть. Поэтому:

* маршрут пишет **ручной слот 1** (`narthex:save:<id>@1`) до финала;
* после финала проверяется, что слот на месте и не изменился;
* после `reload` — что запись побайтово та же;
* затем игрок загружает слот и записывает **восстановленный забег в соседний слот 2**,
  и данные слота 2 сравниваются с данными слота 1.

Автосейв для сравнения не годится: при сложности «Железный человек» движок его не пишет
(`difficulty.no_autosave`), а у обычного забега автосейв мог остаться от забега, открытого
до загрузки (так и вышло в прогоне `exam-12`: `hp 3 → 8`). Запись в соседний слот — тот же
путь игрока через панель «Сохранения», а не вызов внутренних функций.

## 4. Ещё две причины, найденные по ходу (обе в экзамене, не в игре)

1. **Перекрытый HUD.** В прогоне загрузки слота клик по `button[aria-label="Сохранения"]`
   уходил в таймаут 30 с: в точке кнопки лежал `DIV.overlay dialogue-overlay` — новый забег
   начинается со вступления и стартового диалога (`elementFromPoint` в `exam-7`). Лечится
   не таймаутом, а теми же шагами, что и в начале маршрута: закрыть вступление, ответить
   на реплику, «Закончить разговор», закрыть сообщения.
2. **Регекс строки слота.** `hasText: /Слот 1\b/` не совпадал в занятом слоте: в `textContent`
   заголовок `<b>Слот 1</b>` склеивается с описанием, начинающимся с цифры
   («31.10, 16:26 …»), и `\b` между `1` и `3` не срабатывает. Теперь строка ищется по точному
   заголовку: `filter({ has: page.getByText('Слот 1', { exact: true }) })`.

Обе причины видны в логах `exam-5`…`exam-12` (`/tmp/stab/*.log`) и подтверждены шагами без
повышения таймаутов.

## 5. «После»

`npm run playthrough:exam -- http://localhost:4173 /tmp/stab/exam-13` → **rc 0**,
`RESULT: PASS; packs=2; steps=28; findings=0`.
Повтор для устойчивости: `/tmp/stab/exam-14` → **rc 0**, тот же результат
(два зелёных прогона подряд).

### 5.1 Ash, narrative-маршрут — 12 шагов, финал `ending_ashes`

`01-home` → `02-selected` → `03-character` → `04-new-run-scene` → `05-gates-ready` →
`05b-save-slot` → `06-map` → `07-forest-encounter` → `09-ending` («Пепел принял ещё одного»,
`ending_ashes`) → `13-save-after-final` → `14-reload-save` → `15-save-restored`.

### 5.2 Adventure-маршрут — 16 шагов, финал `ending_gate_unlocked`

`01-home` → `02-selected` → `03-character` → `04-stage` → `05-walk` → `06-inspect` → `07-items` →
`08-combination` → `09-dialogue` → `09b-save-slot` → `10-riddle` → `11-rejected-answer` →
`12-ending` (`ending_gate_unlocked`) → `13-save-after-final` → `14-reload-save` → `15-save-restored`.

### 5.3 Сохранения (из лога `exam-14`)

```
[save] ash-of-caerden: narthex:save:ash-of-caerden@1 2479 Б · tick 8 · scene scene_gates_front · hp 3/3 ·
       после reload 2479 Б (байт в байт) · контрольный слот 2479 Б · расхождений 0
[save] ash-of-caerden-adventure: narthex:save:ash-of-caerden-adventure@1 2515 Б · tick 8 ·
       scene scene_gates_front · hp 10/10 · после reload 2515 Б (байт в байт) · контрольный слот 2515 Б · расхождений 0
```

Сравниваются поля `seed, tick, scene, location, region, hp, max_hp, inventory, flags,
fired_rules, log, game_over`; отдельно фиксируются заголовок конверта
(`envelope_version, save_version, campaign_id, campaign_version, engine_version, updated_at`)
и адрес сцены в интерфейсе. Побайтовое равенство после `reload` проверяется на сырой строке
`localStorage`, а не на разметке.

Прочие счётчики прогонов 13/14: `pageErrors 0`, `errorScreens 0`, `brokenImg 0`, `rawNpcIds 0`.
28 отсутствующих картинок кампании — заявленные в `dev-fixture.json` отсутствия
(`knownAbsences`, D-076), превью отдаёт на них SPA `index.html`; они не считаются поломкой.

## 6. Проверки

| Команда | rc | Замечание |
| --- | --- | --- |
| `npm run playthrough:exam -- http://localhost:4173 /tmp/stab/exam-14` | 0 | PASS, 28 шагов, 0 находок |
| `npx tsc -b` | 0 | — |
| `npm run lint` | 0 | 0 ошибок, 1512 предупреждений — столько же на базе (`git stash` + прогон) |
| `npm run check:campaigns` | 1 | **база красная, не наша**: `public/campaigns/ash-of-caerden/campaign.json` против `packs/narrative/data/ash-of-caerden`; защищённые пути |
| `npm run check:dev-campaigns` | 1 | **база красная, не наша**: название без `[DEV]` и `fmv-crossing` без `dev-fixture.json` |

Диф: `scripts/visual/playthrough.mjs`, +223/−6.

## 7. Допущения

1. «Сохранение после финала» не может быть автосейвом: `gameOver → removeSave` стирает его на
   каждом финале по замыслу (фидбек #10). Проверка идёт по ручному слоту, снятому до финала, —
   так карточка проверяет и обещание панели «ручные слоты сохраняются».
2. Чтобы дойти до финала `ending_ashes` на narrative-маршруте, выбран «Железный человек»:
   лесная засада воспроизводимо смертельна для слабого, но валидного героя из маршрута.
   Сложность запрещает автосейв, на ручные слоты это не влияет.
3. `cf_last_campaign` после `reload` не поднимает забег (App не читает ключ при старте) —
   это дефект вне зоны; экзамен возвращает игрока в кампанию через «Кампании», как это
   делает человек, и не выдаёт это за потерю сохранения.
