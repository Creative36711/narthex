# NAR-1.10 · Регрессия и отчёт

> **Миссия:** `NAR-1 · Ядро под паки` (фаза 1), карточка `NAR-1.10`.  
> **Дата прогона:** 2026-10-24. **Стенд:** ветка `nar/1.10` от `origin/main`
> (`a077e4abe53cf570c08a0e113a7c2ee4b9a92a55`, PR #33 «1.9: add capability
> registry»), Node `v22.22.3`, npm `10.x`.  
> **Кода в этой карточке нет:** отчёт — это прогон и запись. Всё, что ниже,
> воспроизводится командами из §8 на том же коммите.

## 1. Итог: фаза закрыта по эталону, но не по гейтам

| Проверка | Что требовалось | Факт | Статус |
|---|---|---|---|
| 1. Эталон §2 | 10 сцен · 8 локаций · 6 диалогов · 21 узел · 0 errors / 8 warnings · 5 смертей · покрытие 6/10 | совпало строка в строку | ✅ |
| 2. Детерминизм | два прогона с одним seed — одинаковый sha256 | 4 файла прогона совпали побайтно; `check` дважды дал идентичный вывод | ✅ |
| 3. Гейты фазы | `tsc -b`, `check:core-graph`, `check:contracts`, `check:brand`, `check:version`, 50 `smoke:*` — exit 0 | 5 из 5 проверок и **49 из 50** смоуков — 0; `smoke:dialogue-transitions` — **1** | ⚠️ **красный** |
| 3a. Размер фасада | `wc -l src/core/engine.ts` ≤ 600 | `599` | ✅ |
| 3b. Направление зависимостей | `grep -r "from './engine'" src/core` — пусто | пусто (rc=1) | ✅ |
| 4. Отчёт | этот файл | — | ✅ |

**Главное.** Ядро осталось живым: 5146 строк `engine.ts` распилены до 599,
эталон §2 не сдвинулся ни в одной строке, состояние воспроизводится побайтно.
Но гейт фазы **красный**: `smoke:dialogue-transitions` падает, и падение —
регрессия, принесённая карточкой NAR-1.9 (PR #33), а не условиями стенда.
По инварианту карточки красный гейт не правится на месте: он вынесен в новую
карточку **NAR-1.11** (формулировка — §10, создать issue из этой сессии токен не дал:
`createIssue` вернул «Resource not accessible by integration»), разбор — в §6. Поэтому миссию нельзя объявить закрытой «по всем пунктам»:
четыре из пяти требований §1 ТЗ выполнены, пятое (все `smoke:*` зелены) — нет.

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
| 1.9 Реестр `caps` | `src/core/caps.ts`, `docs/contracts/caps.json`, `check:contracts` | #33 | `npm run check:contracts` = 0 (39 проверок), `smoke:no-campaign` = 0 — **и это единственный красный след фазы, см. §6** |
| 1.10 Регрессия и отчёт | этот файл | PR, в котором лежит `docs/reports/NAR-1.md` | §1–§5 этого отчёта |

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

Проверка «эталон не дрогнул» поставлена дважды: второй прогон дал побайтно тот
же вывод (`diff` пуст, `sha256` обоих выводов `f845c254…3804`).

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

Четыре из четырёх хэшей совпали: различие только в пути каталога, а путь в
хэшируемые файлы не входит (`run.json` — `sha256` от `{config:{seed,route,mode},
steps}`). Значит детерминизм держится не «на глаз», а на состоянии:
`state.final.json` — это полный слепок `engine.state` после последнего шага.

## 5. Гейты фазы: команда → exit-код

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
без правки самого смоука. Пока карточка не сделана, гейт фазы красный и миссия
не закрывается.

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
  **Решил:** сдать отчёт с честным статусом «гейт красный», не ослабляя и не
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
  текст готов к постановке Координатором как есть. Оракул карточки:
  `npm run smoke:dialogue-transitions && npm run smoke:no-campaign &&
  npm run check:contracts` = 0 + эталон §2; править сам смоук нельзя — он
  оракул.
