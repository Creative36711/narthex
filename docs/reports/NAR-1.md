# NAR-1.10 · Регрессия и отчёт

> **Миссия:** `NAR-1 · Ядро под паки` (фаза 1), карточка `NAR-1.10`.  
> **Дата прогона:** 2026-10-24. **Стенд:** ветка `nar/1.10` от `origin/main`
> (`a077e4abe53cf570c08a0e113a7c2ee4b9a92a55`, PR #33 «1.9: add capability
> registry»), Node `v22.22.3`, npm `10.x`.  
> **Кода в этой карточке нет:** отчёт — это прогон и запись. Всё, что ниже,
> воспроизводится командами из §8 на том же коммите.

> **Статус документа на 2026-10-24 16:11 UTC.** §1–§10 — протокол прогона
> карточки 1.10 на коммите `a077e4a`: они сохранены как были, включая найденную
> тогда регрессию, и задним числом под новый результат не переписаны.
> **Актуальное состояние фазы — §11–§13** (после NAR-1.11 и NAR-1.12, коммит
> `ca826c4`). Где разделы расходятся, верен §11. Единственное исключение из
> «не править прошлое» — §1 и §4: там стояли два утверждения, которые прогон
> не подтвердил (детерминизм «4 из 4» и вердикт по гейтам); они переформулированы
> по месту и помечены, потому что оставлять их как факт нельзя (NAR-1.13,
> Проверки 2 и 3).

## 1. Итог прогона 1.10: эталон совпал, гейт на тот момент не был закрыт

| Проверка | Что требовалось | Факт | Статус |
|---|---|---|---|
| 1. Эталон §2 | 10 сцен · 8 локаций · 6 диалогов · 21 узел · 0 errors / 8 warnings · 5 смертей · покрытие 6/10 | совпало строка в строку | ✅ |
| 2. Детерминизм | два прогона с одним seed — одинаковый sha256 | два прогона подряд совпали по 4 файлам, но этого мало: 15 прогонов позже дали два разных `sha256 state.final.json` (§4). На момент 1.10 **не доказано**; закрыто в 1.12 → §12 | ⚠️ было не доказано |
| 3. Гейты фазы | `tsc -b`, `check:core-graph`, `check:contracts`, `check:brand`, `check:version`, 50 `smoke:*` — exit 0 | 5 из 5 проверок — 0; смоуков 49 из 50 (`smoke:dialogue-transitions` — 1) | ⚠️ одна регрессия; закрыта в 1.11 → §11 |
| 3a. Размер фасада | `wc -l src/core/engine.ts` ≤ 600 | `599` | ✅ |
| 3b. Направление зависимостей | `grep -r "from './engine'" src/core` — пусто | пусто (rc=1) | ✅ |
| 4. Отчёт | этот файл | — | ✅ |

**Главное (по состоянию на прогон 1.10).** Ядро осталось живым: 5146 строк
`engine.ts` распилены до 599, эталон §2 не сдвинулся ни в одной строке.
Два требования тогда закрыты не были, и оба — не про размер фасада:

- `smoke:dialogue-transitions` падал; падение — регрессия карточки NAR-1.9
  (PR #33), а не условие стенда. Разбор — §6, лечение — NAR-1.11/PR #35;
- детерминизм был подтверждён двумя прогонами подряд (`4 из 4` хэшей) и
  рассыпался на 15 прогонах: два разных `state.final.json` (§4). Утверждение
  «воспроизводится побайтно» этим прогоном не доказывалось; доказательство —
  §12.

Оба требования закрыты после 1.11 и 1.12: актуальное состояние — §11–§13.

## 2. Карточки фазы: PR и чем доказано

| Карточка | Что появилось | PR | Чем доказано (прогон 2026-10-24) |
|---|---|---|---|
| 1.1 Карта ядра | `docs/design/core-map.md` | #25 | файл на месте: 415 строк таблиц, 253 точки входа, 39 полей, сверка `81+5018+47=5146` |
| 1.2 Контекст и страж графа | `src/core/context.ts`, `scripts/core-graph.mts` | #26 | `npx tsc -b` = 0; `npm run check:core-graph` = 0 → «Core graph OK (31 modules; acyclic; no core imports of engine.ts)»; `smoke:core` = 0 |
| 1.3 Мир и сцены | `src/core/world.ts` (357 строк) | #27 | эталон §2 (6/10 сцен) + `smoke:core` = 0 |
| 1.4 Инвентарь, износ, экипировка, груз | `src/core/inventory.ts`, `src/core/equipment.ts` | #28 | `smoke:encumbrance` = 0, `smoke:core` = 0 + эталон §2 |
| 1.5 Время, потребности, статусы | `src/core/needs.ts` (367) | #29 | `smoke:time-semantics` = 0, `smoke:duration-actions` = 0, `smoke:breathe-toggle` = 0; матрица seed 1–5 даёт те же 5 смертей |
| 1.6 Квесты, напарники, репутация | `src/core/quests.ts`, `src/core/party.ts`, `src/core/social.ts` | #30 | `smoke:quest-journal` = 0, `smoke:quest-journal-runtime` = 0 (с dev-сервером, §7.4), `smoke:stranger` = 0 |
| 1.7 Эффекты, правила, слоты сцены | `src/core/effects.ts` (391), `src/core/scene-slots.ts` | #31 | `smoke:view-write` = 0, `smoke:patch` = 0, `smoke:engine-version` = 0 + все 50 смоуков (§5) |
| 1.8 Крафт, торговля, встречи, мета | `src/core/economy.ts` (396), `src/core/encounters.ts`, `src/core/meta.ts`, `director.ts`, `combat.ts`-делегаты | #32 | `wc -l src/core/engine.ts` = **599** ≤ 600; все 50 смоуков, кроме §6; эталон §2 |
| 1.9 Реестр `caps` | `src/core/caps.ts`, `docs/contracts/caps.json`, `check:contracts` | #33 | `npm run check:contracts` = 0 (39 проверок), `smoke:no-campaign` = 0 — **и это единственный след регрессии в фазе, см. §6; закрыт в 1.11** |
| 1.10 Регрессия и отчёт | `docs/reports/NAR-1.md` (этот файл) | #34 | §1–§5 этого отчёта |

Номера PR — из `gh pr list --state all`; все девять смержены squash
исполнителями в своих ходах (MERGED, не CLOSED).

## 3. Эталон §2 — построчно

Команда (ровно та, что зафиксирована в ТЗ §2, без правок и флагов):

```
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden
```

| № | Строка эталона (2026-10-22) | Факт (2026-10-24) | Вердикт |
|---|---|---|---|
| 1 | 10 сцен | 10 сцен | совпало |
| 2 | 8 локаций | 8 локаций | совпало |
| 3 | 6 диалогов | 6 диалогов | совпало |
| 4 | 21 узел ink | 21 узлов ink | совпало |
| 5 | 0 ошибок | ошибок 0 | совпало |
| 6 | 8 предупреждений, все `flag_written_never_read` | предупреждений 8, все 8 — `flag_written_never_read` | совпало (список ниже) |
| 7 | маршрутов нет — прогон по seed'ам | «маршрутов нет (…/routes) — прогон только по seed'ам» | совпало |
| 8 | seed 1–5: 5 смертей → 1 «истощение, жажда», 4 «пал в бою» | `{"death: Смерть от истощения: жажда на нуле.":1, "death: Вы пали в бою.":4}` | совпало до строки |
| 9 | покрытие 6 из 10 | посещено 6 из 10 достижимых сцен | совпало |
| 10 | не покрыты `scene_gates_guardroom`, `scene_mine_deep`, `scene_mine_entrance`, `scene_ravine_camp` | тот же список, тот же порядок | совпало |

Расхождений нет — объяснять построчно нечего. Полный вывод команды (exit 0),
дословно:

```
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

Проверка «эталон не дрогнул» поставлена дважды: команда
`node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` запущена
подряд, выводы сложены в `/tmp/nar110/check-1.txt` и `/tmp/nar110/check-2.txt`;
`diff` между ними пуст, `sha256` обоих — `f845c254…3804`.

## 4. Детерминизм: команда и её вывод

Один seed, один маршрут, два независимых прогона в разные каталоги:

```
node public/ai/cf-play.mjs explore public/campaigns/ash-of-caerden \
  --seed 7 --steps 300 --record /tmp/nar110/route-7.json
# ✓ Пепел Каэрдена: ok, шагов 23, seed 7
#   не посещено сцен: 5 из 10

node public/ai/cf-play.mjs run public/campaigns/ash-of-caerden \
  --seed 7 --script /tmp/nar110/route-7.json --out /tmp/nar110/run-a --debug
node public/ai/cf-play.mjs run public/campaigns/ash-of-caerden \
  --seed 7 --script /tmp/nar110/route-7.json --out /tmp/nar110/run-b --debug
# ✓ Пепел Каэрдена: ok, шагов 23, seed 7   (оба прогона, exit 0)

sha256sum /tmp/nar110/run-a/* /tmp/nar110/run-b/*
```

```
1d53dbd180e57433ee7695569fcf79b5833945acffe33af73e33a0ff98ea6169  run-a/result.json
6f945aa41e9a603df0c2b0346b3990a6f7c0bfba9638743e8fa754eba0b6bdae  run-a/run.json
3ea10dea5280e9247aecce20d4c6031e7d7b828eda51c00b85a98cb9c924390e  run-a/state.final.json
2751db3fe89738b3e8a00b28941e591d0832905c1ad5f285e4a7f1e6e0b12df3  run-a/transcript.md
1d53dbd180e57433ee7695569fcf79b5833945acffe33af73e33a0ff98ea6169  run-b/result.json
6f945aa41e9a603df0c2b0346b3990a6f7c0bfba9638743e8fa754eba0b6bdae  run-b/run.json
3ea10dea5280e9247aecce20d4c6031e7d7b828eda51c00b85a98cb9c924390e  run-b/state.final.json
2751db3fe89738b3e8a00b28941e591d0832905c1ad5f285e4a7f1e6e0b12df3  run-b/transcript.md
```

**Поправка 2026-10-24, вечер (NAR-1.13, Проверка 3).** Два прогона подряд
совпали — но как доказательство детерминизма это утверждение не годится, и
именно в такой формулировке оно стояло здесь до правки. Проверка на 15 прогонах
того же `seed 7` (бандл, закоммиченный на тот момент в `public/ai/cf-play.mjs`)
дала **два** разных хэша состояния:

| Файл | 13 прогонов | 2 прогона |
|---|---|---|
| `state.final.json` | `3ea10dea5280e9247aecce20d4c6031e7d7b828eda51c00b85a98cb9c924390e` | `82d76c1a0d0f98b5ba922d9d39573509382e7a17d40d79959e32bbb9d94ce117` |
| `run.json` | `6f945aa41e9a603df0c2b0346b3990a6f7c0bfba9638743e8fa754eba0b6bdae` | `5f1bf448d5e1e2762505733bdc62d15375f603bffcef2b1d6c272a6c5c91b948` |
| `transcript.md` | `3580bbaf54c1ee241395d6b4d014155ef25ccbeb51ac6caaf8cdeab8044c556d` | `5173d4f2b59535c6d6e178350f8262c47e62cc2be8645c21c5830e008d0d6f3e` |

Расходятся ровно два ключа состояния — порядок `fired_rules` и порядок `log`:
`rule_intro_cutscene` и `rule_gates_greeting` меняются местами
(`['rule_intro_cutscene', 'rule_gates_greeting', …]` против
`['rule_gates_greeting', 'rule_intro_cutscene', …]`), и вместе с ними
переставляются строки журнала «Катсцена: «Пролог: пепел на тракте»» и
«Кодекс пополнен: Долина Каэрден.». Причина — гонка загрузчика манифеста:
порядок правил определялся тем, чей `fetch` завершился раньше. Лечение —
NAR-1.12 (PR #36), повторный прогон — §12.

Совпадение двух прогонов остаётся фактом: `sha256` `run.json` и
`state.final.json` из этой таблицы совпадают с «удачными» прогонами выше.
Но факт «два прогона совпали» не равен факту «прогон детерминирован»:
для второго нужна серия, и она дала другой ответ.

## 5. Гейты фазы: команда → exit-код (снимок на прогон 1.10)

> Числа этого раздела — на коммите `a077e4a`: `check:contracts` давал тогда
> 39 проверок, смоуков было 50, `check:brand` видел 524 файла. Актуальные
> значения — §11.

| Команда | Код | Вывод (сокращённо) |
|---|---|---|
| `npx tsc -b` | **0** | пусто (чисто) |
| `npm run check:core-graph` | **0** | `Core graph OK (31 modules; acyclic; no core imports of engine.ts).` |
| `npm run check:contracts` | **0** | `контракты согласованы: 39 проверок` |
| `npm run check:brand` | **0** | `✓ старое имя не встречается (проверено файлов: 524)` |
| `npm run check:version` | **0** | `✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG` |
| `wc -l src/core/engine.ts` | **0** | `599 src/core/engine.ts` (порог 600) |
| `grep -rn "from './engine'" src/core` | **1** | пусто — ни один модуль ядра не тянет фасад (rc=1 здесь = «не найдено», это ожидаемый код) |
| `smoke:*` — 50 скриптов | **49×0, 1×1** | `smoke:dialogue-transitions` = 1, остальные 0 |

Все 50 смоуков, дословный код возврата каждого:

```
smoke:currency 0            smoke:engine-version 0        smoke:view-write 0
smoke:ink-import 0          smoke:hero-appearance 0       smoke:core 0
smoke:fingerprint 0         smoke:theme-contrast 0        smoke:dlg-script 0
smoke:book-md 0             smoke:dialogue-transitions 1  smoke:dlg-ui 0
smoke:campaign-index 0      smoke:dialogue-skip 0         smoke:folder-import 0
smoke:guide 0               smoke:travel-transition 0     smoke:narrative-builder 0
smoke:design-doc 0          smoke:stranger 0              smoke:patch 0
smoke:quest-journal 0       smoke:encumbrance 0           smoke:cutout 0
smoke:quest-journal-runtime 0  smoke:cutscene-queue 0     smoke:duration-actions 0
smoke:p2 0                  smoke:spoil 0                 smoke:craft-fail-time 0
smoke:ai-runtime 0          smoke:time-semantics 0        smoke:dialogue-speaker 0
smoke:ai-task 0             smoke:ai-diff 0               smoke:narthex-closed 0
smoke:char-templates 0      smoke:narthex-tech 0          smoke:no-campaign 0
smoke:chronicle-manifest 0  smoke:drive-gateway 0         smoke:dialogues-r31 0
smoke:dialogues-r32 0       smoke:breathe-toggle 0        smoke:scene-subtitles 0
smoke:scene-editor 0        smoke:editor-hotspot 0        smoke:voice-dedup 0
smoke:narrative-intro 0     smoke:encounters-loader 0
```

Состав гейтов не менялся: ни один смоук, контракт и эталон в этой карточке не
правился (диф — ровно один новый файл, этот).

## 6. Красный гейт: `smoke:dialogue-transitions` — регрессия NAR-1.9

```
$ npm run -s smoke:dialogue-transitions ; echo $?
Testing Dialogue Transitions (Scene, Combat, State, Endings)...
1. Проверка смены состояния сцены прямо из диалога...
✓ change_scene_state работает штатно!
2. Проверка перехода в другую сцену из диалога...
✓ go_to_scene работает штатно!
3. Проверка запуска боя из диалога...
AssertionError [ERR_ASSERTION]: Боевой режим успешно активирован
    at scripts/smoke-dialogue-transitions.mts:145:8
  actual: null, expected: null, operator: 'notStrictEqual'
1
```

Это не флак и не стенд: тест падает на чистой логике движка, без сети и браузера.

**Цепочка.** Смоук-кампания объявляет профиль механик массивом —
`features: ['combat']` (`scripts/smoke-dialogue-transitions.mts:92`). Фраза
диалога `start_combat("arena_alley")` доходит до
`director.startCombat`, а тот начинается с проверки
`if (!featureOn(this.campaign.meta, 'combat')) { … немедленная победа; return }`.
С NAR-1.9 `featureOn` — обёртка над реестром `caps`, и `campaignCaps()`
разбирает `meta.features` как объект: `Object.entries(['combat'])` даёт
`[['0','combat']]`, фильтр `=== true` не пропускает ничего → `caps = []` →
`featureOn('combat') === false` → бой подменяется логом «Конфликт разрешился без
боя», `engine.combat` остаётся `null`, ассерт на строке 145 падает.

**Доказательство причины** (тот же смоук, единственная правка в копии в `/tmp`:
`features: ['combat']` → `caps: ['combat']`):

```
$ npx tsx /tmp/dlg-probe.mts ; echo $?
3. Проверка запуска боя из диалога...
✓ start_combat работает штатно!
✓ Все 4 вида диалоговых переходов успешно верифицированы!
0
```

**Шире, чем один тест.** До 1.9 (`70a4291:src/shared/types.ts:605`) функция
была `meta.features?.[key] !== false`, то есть «ключа нет → механика включена».
Сейчас объектная форма профиля читается как «включено только перечисленное»:

```
$ npx tsx /tmp/caps-probe.mts
{
  "features={map:true} → caps": "map",
  "features={map:true} → featureOn(combat)": false,     ← было true
  "features=['combat'] → caps": "",
  "features=['combat'] → featureOn(combat)": false,     ← было true
  "features absent → featureOn(combat)": true
}
```

То есть старая кампания с `features: {"map": true}` (документированный legacy:
«отсутствующее поле означает, что механика ВКЛЮЧЕНА», `types.ts:578–583`)
после 1.9 теряет бой, инвентарь, потребности, навыки, отношения, торговлю и
время — молча, без единого предупреждения. Карточка 1.9 требовала обратного:
«проект со старым `features: { map: true }` читается как `caps: ["map"]`» — но
обещала совместимость, а получилась смена семантики. Оракул 1.9
(`check:contracts` + `smoke:no-campaign`) этого не ловил: `caps.json` согласован,
профиль механик в примерах не проверялся.

Почему эталон §2 при этом зелёный: `ash-of-caerden` не объявляет ни `features`,
ни `caps` (грепом — пусто), поэтому попадает в `LEGACY_DEFAULT_CAPS` и получает
все восемь механик. Регрессия видна только там, где профиль задан явно.

**Что делать.** По инварианту карточки — не правка здесь (`scripts/**` — чужая
зона и оракул), а новая карточка: **NAR-1.11 · `caps`: вернуть legacy-семантику
`features`**. Минимальный объём: сохранить «неперечисленное —
включено» для объектной формы, принимать массив как синоним `caps`, добавить в
`check:contracts` пробу профиля, вернуть зелёный `smoke:dialogue-transitions`
без правки самого смоука. Пока карточка не была сделана, гейт фазы оставался
незакрытым; сделана — PR #35, проверка в §11.

## 7. Расхождения с ТЗ, которые не являются регрессией (и почему)

1. **`check:brand`: 524 файла против 463 в ТЗ §2.** Порог не «количество», а
   «0 находок» — находок ноль. Число выросло потому, что за девять PR фазы
   появились новые файлы (`src/core/*.ts`, `docs/design/core-map.md`,
   `docs/agents/*`). Правки проверки не требовалось.
2. **`combat.ts` (1765 строк) и `savemigrate.ts` (788) длиннее порога 450.**
   Порог §1.2 относится к модулям, которые режет миссия. `savemigrate.ts`
   вынесен до фазы и его размер зафиксирован в ТЗ §0 («788 строк — уже
   вынесены»); `combat.ts` ни одна карточка 1.1–1.9 не трогала — он вынесен
   ещё в P2. Это долг, а не следствие рефакторинга; отдельная карточка — на
   усмотрение Координатора (в NAR-1.11 не входит, чтобы не смешивать причины).
3. **`engine.ts` = 599 при пороге 600.** Формально зелено, запаса — одна
   строка: любая правка фасада упрётся в порог. Это факт для следующей фазы,
   не нарушение.
4. **Шесть смоуков требуют dev-сервер на `:5173`.** `campaign-index`,
   `quest-journal-runtime`, `p2`, `ai-task`, `no-campaign`, `hero-appearance`
   ходят `fetch`-ем на `http://localhost:5173` (в шапке смоука это написано).
   Без сервера они дают `ECONNREFUSED` — это условие прогона, а не поломка:
   с `npx vite --host 0.0.0.0 --port 5173 --strictPort` все шесть — exit 0.
   Гейт нужно прогонять с поднятым сервером; в CI это отдельный шаг.
5. **`node_modules` в снапшоте нет.** Прогон начинается с
   `npm install --no-audit --no-fund` (70 пакетов, ~6 с). Без него не работают
   ни `tsc`, ни `tsx`-смоуки — это про воспроизводимость стенда, не про код.

## 8. Как воспроизвести (порядок)

```bash
npm install --no-audit --no-fund
npx vite --host 0.0.0.0 --port 5173 --strictPort &      # для шести смоуков из §7.4

npx tsc -b                                              # 0
npm run check:core-graph                                # 0
npm run check:contracts                                 # 0
npm run check:brand                                     # 0
npm run check:version                                   # 0
wc -l src/core/engine.ts                                # 599
grep -rn "from './engine'" src/core                     # пусто

node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden   # §3
for s in $(node -e "console.log(Object.keys(require('./package.json').scripts).filter(k=>k.startsWith('smoke:')).join(' '))"); do
  npm run -s "$s" >/dev/null 2>&1; echo "$s $?"
done                                                    # 49×0, dialogue-transitions 1
```

## 9. Решения (неясно / решил / откат)

Записаны здесь, а не в `docs/decisions/NAR-1.10.md`: Scope карточки —
единственный файл `docs/reports/NAR-1.md`, а правка путей вне Scope запрещена
инвариантом. Если Координатор захочет журнал отдельным файлом — строки ниже
переносятся дословно.

- **Неясно:** закрывать миссию при одном красном смоуке или ждать зелёного.
  **Решил:** сдать отчёт с честным статусом «гейт не закрыт» (на тот момент), не ослабляя и не
  правя смоук; причину (регрессия 1.9) вынести в карточку NAR-1.11.
  **Откат:** если Координатор решит иначе — блокируется мерж отчёта до фикса,
  текст §1 и §6 меняется на «зелено» после прогона.
- **Неясно:** где прогонять шесть смоуков, которым нужен `:5173`.
  **Решил:** поднимать `vite` в стенде и фиксировать это как условие прогона
  (§7.4), а не считать их «падениями окружения» и не исключать из гейта.
  **Откат:** добавить в CI шаг с dev-сервером; состав гейта не меняется.
- **Неясно:** куда писать журнал решений — в Scope-файл или в `docs/decisions/`.
  **Решил:** в отчёт (§9), потому что Scope — ровно один путь.
  **Откат:** перенести три строки в `docs/decisions/NAR-1.10.md` отдельной
  карточкой, содержимое уже готово.

## 10. Найденные по пути баги (отдельными карточками, не здесь)

- **NAR-1.11** — `caps`: legacy-семантика `features` сломана, `featureOn`
  выключает механики, которых нет в профиле; красный
  `smoke:dialogue-transitions`. Это единственная причина, по которой гейт фазы
  не закрыт. Карточка не создана автоматически: у токена сессии нет права
  `createIssue` (`GraphQL: Resource not accessible by integration`), поэтому
  текст готов к постановке Координатором как есть. **Закрыта:** PR #35
  (`139847f`), проверка — §11. Оракул карточки:
  `npm run smoke:dialogue-transitions && npm run smoke:no-campaign &&
  npm run check:contracts` = 0 + эталон §2; править сам смоук нельзя — он
  оракул.

---

## 11. После NAR-1.11: фактическое состояние гейтов

> **Прогон:** 2026-10-24 16:11 UTC · ветка `nar/1.13` от `origin/main`
> `ca826c4` («fix(core): preserve manifest rule and encounter order (#36)»,
> NAR-1.12). На этом коммите уже есть NAR-1.11 (PR #35, `139847f`).
> Node `v22.22.3`; перед прогоном — `npm install --no-audit --no-fund`;
> для шести смоуков, которым нужен `:5173`, поднят
> `npx vite --host 0.0.0.0 --port 5173 --strictPort` (§7.4).

| # | Гейт | Чем проверено | Код | Факт |
|---|---|---|---|---|
| 1 | `smoke:*` — весь набор | `for s in $(node -e "…scripts, начинающиеся с smoke:…"); do npm run -s "$s"; done` | **51×0** | **51 из 51** зелёные. Прежний набор — **50 из 50**: единственное падение прогона 1.10 (`smoke:dialogue-transitions`) закрыто, остальные 49 были зелены и до 1.11. Пятьдесят первый скрипт — `smoke:manifest-order`, добавленный NAR-1.12 |
| 2 | `smoke:dialogue-transitions` | `npm run -s smoke:dialogue-transitions` | **0** | все 4 перехода: `change_scene_state`, `go_to_scene`, `start_combat`, `game_over_death` — «✓ Все 4 вида диалоговых переходов успешно верифицированы!» |
| 3 | `smoke:manifest-order` | `npm run -s smoke:manifest-order` | **0** | «rules, encounters, and rule traversal follow manifest order under reversed fetch completion» |
| 4 | Типы | `npx tsc -b` | **0** | пусто (чисто) |
| 5 | Граф ядра | `npm run check:core-graph` | **0** | `Core graph OK (31 modules; acyclic; no core imports of engine.ts).` |
| 6 | Контракты | `npm run check:contracts` | **0** | `контракты согласованы: 41 проверок` (было 39: +2 пробы профиля механик из 1.11) |
| 7 | Бренд | `npm run check:brand` | **0** | `✓ старое имя не встречается (проверено файлов: 507)`; перепроверка после правки отчёта — `529` файлов, находок по-прежнему 0. Счётчик считает всё дерево, включая untracked-артефакты прогона (`public/campaigns/ash-of-caerden/.cf-play/`), поэтому он плавает; порог здесь — «0 находок», не число |
| 8 | Версия | `npm run check:version` | **0** | `✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG` |
| 9 | Размер фасада | `wc -l src/core/engine.ts` | **0** | `599` (порог 600, запас 1 строка) |
| 10 | Импорты фасада | `grep -rn "from './engine'" src/core` | **1** | пусто: ни один модуль ядра не тянет `engine.ts` (rc=1 здесь — ожидаемый «не найдено») |
| 11 | Эталон §2 | `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | **0** | 10 · 8 · 6 · 21; 0 errors / 8 warnings; 5 смертей (1 жажда, 4 бой); покрытие 6/10 — вывод тот же, что в блоке §3 (`sha256` вывода `f845c254…3804`, тот же, что у `check-1.txt`/`check-2.txt`); таблица эталона не менялась |

Оракул §2 прогнан дважды и на разных артефактах: на закоммиченном бандле
`public/ai/cf-play.mjs` и на сборке из текущего `src` (`/tmp/nar113/cf-play.mjs`).
Вывод совпал до символа — тот же `sha256` `f845c254…3804`, что зафиксирован
в §3. Значит правки 1.11 и 1.12 эталон не сдвинули.

Что изменилось относительно снимка §5: `check:contracts` — 39 → **41**
проверка, `check:brand` — 524 → **507** файлов на первом прогоне (529 после правки
отчёта; счётчик включает untracked-артефакты, проверка не ослаблена, находок
по-прежнему 0), смоуков 50 → **51**, а единственное падение
(`smoke:dialogue-transitions`) стало **exit 0**. Сам эталон §2 не правился ни
на строку — `public/campaigns/ash-of-caerden/**` в 1.11 и 1.12 не трогали.

**Допущение.** Карточка ждёт формулировку «`smoke:*` 50 из 50», но после
NAR-1.12 скриптов 51: набор вырос на `smoke:manifest-order`, и это не
ослабление, а усиление гейта. В отчёте поэтому стоят оба числа — 50 из 50 для
прежнего набора (это правда) и 51 из 51 для текущего (тоже правда); молча
подменять одно другим было бы подгонкой под ожидаемую строку.

## 12. Детерминизм после NAR-1.12: 20 из 20

Команды, дословно (каталог прогона — `/tmp/nar113`):

```
# 1. бандл собирается из текущего src: закоммиченный public/ai/cf-play.mjs
#    остался от #20 и правок 1.11/1.12 не содержит (§13, находка)
npx esbuild scripts/playkit/cli.mts --bundle --platform=node --format=esm \
  --target=node20 --legal-comments=none \
  --define:__CF_ENGINE_VERSION__='"0.9.0"' --outfile=/tmp/nar113/cf-play.mjs

# 2. маршрут записан один раз и переиспользован всеми прогонами
node /tmp/nar113/cf-play.mjs explore public/campaigns/ash-of-caerden \
  --seed 7 --steps 300 --record /tmp/nar113/route-7.json
# ✓ Пепел Каэрдена: ok, шагов 23, seed 7 · не посещено сцен: 5 из 10

# 3. двадцать прогонов одного seed по одному маршруту
for i in $(seq -w 1 20); do
  node /tmp/nar113/cf-play.mjs run public/campaigns/ash-of-caerden \
    --seed 7 --script /tmp/nar113/route-7.json --out /tmp/nar113/runs/run-$i --debug
done
# все 20 — rc=0

# 4. хэши
sha256sum /tmp/nar113/runs/run-*/state.final.json \
          /tmp/nar113/runs/run-*/run.json \
          /tmp/nar113/runs/run-*/transcript.md \
          /tmp/nar113/runs/run-*/result.json \
  | awk '{print $1}' | sort | uniq -c
```

| Файл прогона | `sha256` | Совпало |
|---|---|---|
| `state.final.json` | `3ea10dea5280e9247aecce20d4c6031e7d7b828eda51c00b85a98cb9c924390e` | **20 из 20** |
| `run.json` | `6f945aa41e9a603df0c2b0346b3990a6f7c0bfba9638743e8fa754eba0b6bdae` | **20 из 20** |
| `transcript.md` | `d150b040e696476e0d0f27a75be1aa7598e531bd539b5446c8afc62ca7badb6c` | **20 из 20** |
| `result.json` | `2b00da6d784001083e6edb4e15e917147bba2c9267448427ec7017cb50b7ac93` | **20 из 20** |

Второй батч из 20 прогонов того же seed в отдельный каталог
(`/tmp/nar113/runs2/run-1…run-20`) дал те же три хэша — **40 из 40** против
15 прогонов прежнего бандла, где стабильность не держалась (§4).

**Негативный контроль** (тот же маршрут, закоммиченный бандл до 1.12,
15 прогонов) — нестабильность воспроизводится, значит дело не в машине и не
в маршруте:

| Файл | 13 прогонов | 2 прогона |
|---|---|---|
| `state.final.json` | `3ea10dea…390e` | `82d76c1a…ce11` |
| `run.json` | `6f945aa4…bdae` | `5f1bf448…b948` |
| `transcript.md` | `3580bbaf…556d` | `5173d4f2…f3e` |

Тот же размен `rule_intro_cutscene` ↔ `rule_gates_greeting` в `fired_rules` и
в `log`. На сборке из текущего `src` (с `ruleOrder`/`encounterOrder`) —
0 расхождений на 40 прогонах.

Оговорка, без которой утверждение было бы слишком широким: проверен **один**
seed (7) на **одном** маршруте (23 шага). Это ровно тот оракул, который
требует карточка, и он пройден; детерминизм на других seed'ах и на длинных
fuzz-прогонах этой карточкой не измерялся.

## 13. Что изменилось с 1.10

- **NAR-1.11 · PR #35** (`139847f`) — «`caps`: вернуть legacy-семантику
  `features`». Массив `features` и `caps` читаются как точные списки;
  boolean-карта начинается со старых восьми включённых механик и применяет
  явные `true`/`false`; неизвестный формат или id даёт `TypeError`
  (`docs/decisions/NAR-1.11.md`). Следствие: `smoke:dialogue-transitions`
  снова зелёный, `check:contracts` — 41 проверка.
- **NAR-1.12 · PR #36** (`ca826c4`) — «manifest order is execution order».
  Загрузчик по-прежнему грузит файлы параллельно, но применяет результаты
  после `Promise.all` в порядке манифеста и пишет явные `ruleOrder` /
  `encounterOrder` (`docs/decisions/NAR-1.12.md`). Следствие: два хэша
  состояния вместо одного, `smoke:manifest-order` как 51-й смоук.
- **Этот документ** — §1, §4 и §5 больше не выдают себя за актуальные: в §1
  переформулированы два вердикта, в §4 снято утверждение о побайтном
  совпадении как доказательстве, §5 помечен как снимок. Добавлены §11–§13.
- **Не изменилось:** `engine.ts` = 599 строк, импортов `engine.ts` в
  `src/core` нет, эталон §2 тот же до строки, версия 0.9.0 согласована.

**Находка, не входящая в Scope** (код в карточке не меняется): закоммиченный
`public/ai/cf-play.mjs` собран из `src` до 1.11/1.12 — в нём нет `ruleOrder`
(`grep -c ruleOrder public/ai/cf-play.mjs` → `0`), последний коммит файла —
#20. Оракул §2 на нём совпадает (статика и матрица seed'ов те же), но
детерминизм на нём не проверить: он воспроизводит старую гонку. Пока бандл не
пересобран отдельной карточкой (зона Tools: `npm run build:playkit-bundle`),
команда оракула из ТЗ §2 и проверка детерминизма выполняются на разных
артефактах. Это стоит закрыть до того, как на `cf-play` начнут ссылаться как
на меру стабильности.

## 14. Решения карточки 1.13

Три строки «неясно / решил / откат» — в `docs/decisions/NAR-1.13.md`. Кратко:
прошлые разделы не переписаны под новый результат, кроме двух мест, где
стояли опровергнутые утверждения; число смоуков дано двумя значениями
(50 из 50 и 51 из 51) вместо подмены; детерминизм доказан серией из 40
прогонов, а не пересказом.
