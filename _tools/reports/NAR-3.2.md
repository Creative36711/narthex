# NAR-3.2 — FMV playback and D-072 regression

## Result

Implemented FMV mode in the shared cutscene player and mounted it for FMV scenes. `fmv-crossing` plays from the initial poster through the first video, its post-fragment choice, the selected second fragment and the ending. The following behavior was verified in Chromium 131: next-fragment preload is complete before the choice is enabled; a poster/video frame remains behind the post-fragment choices; subtitles are visible over the video and outside the journal. The controls now show a presentation number rather than the fragment ID.

The actual-browser playthrough completed with exit code 0: 20 PNGs, 0 page errors, 0 error screens, 0 broken portrait images, 0 raw NPC IDs, and 0 findings. All seven FMV screenshots have 0 broken images. The unrelated narrative baseline route reports one existing generic broken image in its intentional missing-image fixture; its portrait-image count remains 0. No campaign data, pack sources, oracle files, thresholds, or `public/ai/cf-play.mjs` were changed.

## Browser playthrough

Exact command:

```text
npm run playthrough -- http://localhost:4173 out/play
```

Literal output (rc=0):

```text
> narthex@0.9.0 playthrough
> node scripts/visual/playthrough.mjs http://localhost:4173 out/play

  01-menu: проверено — кнопок 5, битых img 0
  02-character: проверено — кнопок 40, битых img 0
  03-scene: проверено — кнопок 13, битых img 1
  04-dialogue: проверено — кнопок 17, битых img 1
  05-choice: проверено — кнопок 15, битых img 1
  06-travel: проверено — кнопок 14, битых img 1
  01-fmv-project-open: Открыт проект «Перекрёсток огней» — кнопок 5, битых img 0
  02-fmv-poster: Постер первого видеофрагмента — кнопок 5, битых img 0
  03-fmv-video-fragment-a: Идёт первый видефрагмент, субтитры поверх видео — кнопок 4, битых img 0
  04-fmv-post-fragment-choice: Выбор после фрагмента без пустого кадра — кнопок 6, битых img 0
  05-fmv-poster-fragment-b: Постер выбранного второго фрагмента — кнопок 5, битых img 0
  06-fmv-video-fragment-b: Идёт второй видефрагмент — кнопок 4, битых img 0
  07-fmv-ending: Достигнут финал выбранной ветки — кнопок 5, битых img 0
  01-adventure-campaign-menu: Меню выбора проекта adventure — кнопок 5, битых img 0
  02-adventure-menu: Меню кампании adventure — кнопок 5, битых img 0
  03-adventure-character: Создание героя для adventure — кнопок 40, битых img 0
  04-adventure-stage: Сцена adventure, pack view подключён — кнопок 23, битых img 0
  05-adventure-walk: Ходьба к точке сцены — кнопок 22, битых img 0
  06-adventure-inspect: Осмотр символов ворот — кнопок 22, битых img 0
  07-adventure-items: Взяты два предмета — кнопок 23, битых img 0
  08-adventure-combination: Два предмета соединены в мазь — кнопок 23, битых img 0
  09-adventure-conversation: Разговор со стражником — кнопок 27, битых img 0
  10-adventure-riddle: Крупный план загадки gate sigils — кнопок 24, битых img 0
  11-adventure-riddle-rejected: Неверная последовательность отклонена — кнопок 24, битых img 0
  12-adventure-ending: Финал: ворота открыты — кнопок 20, битых img 0
  13-adventure-pack-panel: Панель пака adventure в Studio — кнопок 15, битых img 0

✓ маршрут: 20 шагов, 0 находок
```

Final browser JSON summary: `pageErrors=0`, `errorScreens=0`, `brokenPortraitImages=0`, `rawNpcIds=0`, `steps=20`, `findings=[]`. The 20 captured screenshots are uncommitted under `out/play/`.

### FMV screenshot review

| Screenshot | Visual description |
|---|---|
| `out/play/01-fmv-project-open.png` | The campaign title and description are visible on the project opening screen; no error text or IDs. |
| `out/play/02-fmv-poster.png` | First fragment poster remains as the stage background, with a clear “Смотреть фрагмент” action and on-screen subtitle. |
| `out/play/03-fmv-video-fragment-a.png` | First video is playing; subtitle is legible over the video and the presentation counter is positioned away from native controls. |
| `out/play/04-fmv-post-fragment-choice.png` | Both human-readable branch choices are visible over the retained media frame; this is not a blank transition frame. |
| `out/play/05-fmv-poster-fragment-b.png` | Selected branch’s poster is retained with its subtitle and play action while the next fragment is ready. |
| `out/play/06-fmv-video-fragment-b.png` | Second video is playing with readable on-screen subtitle; no journal-only subtitle or raw fragment ID. |
| `out/play/07-fmv-ending.png` | Ending card and Continue action are displayed over the final video frame. |

Visual review of all seven FMV PNGs found no “Фон сцены не загрузился”, “Игра столкнулась с ошибкой”, broken portrait, or raw ID. Subtitle text is rendered in the player overlay, not the journal. The tiny, solid-color media appearance is from the existing smoke fixture assets; no new video or campaign assets were added.

## Build and requested gates

### Build

Exact command:

```text
npm run build
```

Literal result lines (rc=0):

```text
> narthex@0.9.0 build
> tsc -b && npm run build:ai-bundle && vite build
✓ 1435 modules transformed.
✓ built in 2.50s
```

Build stderr:

```text
public/ai/campaign-audit.mjs  979.4kb
⚡ Done in 34ms
```

The AI campaign-audit bundle was regenerated by the existing build and is unchanged in the final working tree.

### TypeScript

```text
$ npx tsc -b
(no output)
rc=0
```

### Contracts and preserved boundaries

Exact command:

```text
npm run check:contracts
```

Literal output summary (rc=0):

```text
контракты согласованы: 42 проверок
check:packs passed
✓ core pack boundary: 25 source files; no pack-ID branches or imports from packs/**
check:pack-boundary passed
check:decisions passed
limit=450 facade=600
changed source modules=5
module src/core/engine.ts: 594/600 lines (facade)
module src/player/CutsceneYoutube.tsx: 92/450 lines (changed)
module src/player/FmvCutsceneMode.tsx: 168/450 lines (changed)
module src/player/FmvScreen.tsx: 267/450 lines (changed)
module src/player/GameView.tsx: 277/450 lines (changed)
module src/shared/CutscenePlayer.tsx: 389/450 lines (changed)
check:module-size passed
Гейт браузера: ok — ложных формулировок 0, инфраструктура на месте, CI вызывает playthrough.
Гейт внутренних кампаний: ok — 3 полигона, 0 записей в реестре, сирот нет.
✓ Проверена JSON Schema Draft 2020-12: 125 типов
✓ Проверены отдельные JSON/Ink-модули и ссылки: 192 файлов в 3 кампаниях
✓ Campaign Package ↔ MonolithDoc: round-trip без потерь и предупреждений
✓ Структура AI-руководства и копируемый промпт синхронизированы с MonolithDoc
```

The full `check:contracts` run also passed synthetic capability checks, pack manifests and schemas, import-boundary fixtures, decision-status fixtures, module-size 450/facade 600 negative fixtures, browser-gate, dev-campaign registry, and campaign format audits. No gate or threshold was edited.

### Brand

```text
$ npm run check:brand
> narthex@0.9.0 check:brand
> tsx scripts/brand-guard.mts
✓ старое имя не встречается (проверено файлов: 1210)
rc=0
```

### Version

```text
$ npm run check:version
> narthex@0.9.0 check:version
> tsx scripts/version.mts check
✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG
rc=0
```

### Core semantics

```text
$ npm run smoke:core
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
rc=0
```

### Core graph and guide-size thresholds

```text
$ npm run check:core-graph
> narthex@0.9.0 check:core-graph
> tsx scripts/core-graph.mts
Core graph OK (25 modules; acyclic; no core imports of engine.ts).
rc=0
```

```text
$ npm run check:guide
> narthex@0.9.0 check:guide
> tsx scripts/check-guide.mts
fixture (a) guide size 268683: PASS — within limit 524288 bytes
fixture (b) guide size 524289: PASS — error includes actual 524289 and limit 524288 bytes
✓ campaign guide size: current=268683 bytes; mirror=268683 bytes; limit=524288 bytes
✓ check:guide: 6 команд (исходники, bundle, распакованный kit); explain=28; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10
rc=0
```

## D-072 missing-area regression smoke

Added `scripts/fmv-area-smoke.mts` and only the `smoke:fmv-area` npm script entry. The smoke loads the actual `public/campaigns/fmv-crossing/scenes/scene_fmv_crossing.json`, removes `navigation.area`, passes that scene to `migrateNavigation`, asserts that the normalized area is `{ x: 0, y: 0, w: 640, h: 360 }`, and exercises the same coordinate reads used to render the navigation button. The assertion names the old `nav.area.x` failure it catches.

Normal command and literal output (rc=0):

```text
$ npm run smoke:fmv-area
> narthex@0.9.0 smoke:fmv-area
> tsx scripts/fmv-area-smoke.mts
✓ D-072: actual fmv-crossing scene submitted with navigation.area absent
✓ assertion `area-less navigation must be normalized before SceneScreen reads nav.area.x`: full-scene area restored; render geometry does not throw
✓ removing migrateNavigation’s no-area guard makes the area assertion fail (the old nav.area.x render then throws TypeError)
smoke:fmv-area: 3/3 PASS
```

Mutation evidence: temporarily removed only the `if (!nav.area)` fallback from `src/shared/migrate.ts`, ran `npx tsx scripts/fmv-area-smoke.mts`, observed its expected nonzero status, and restored the source with a shell exit trap. Literal failure:

```text
AssertionError [ERR_ASSERTION]: D-072 guard: area-less navigation must be normalized before SceneScreen reads nav.area.x
+ actual - expected
+ undefined
- {
-   h: 360,
-   w: 640,
-   x: 0,
-   y: 0
- }
EXPECTED MUTANT FAILURE: smoke exited 1 with D-072 guard removed
```

The mutation run exited 1 as expected. `src/shared/migrate.ts` has no final diff; the guard was not committed.

## Oracle checks

### FMV fixture

```text
$ node public/ai/cf-play.mjs check public/campaigns/fmv-crossing
# Проверка кампании · [DEV] Перекрёсток огней — проект FMV (полигон смоуков)

✓ проверка пройдена

## Статика
1 сцен · 1 локаций · 0 диалогов · 0 узлов ink
ошибок 0 · предупреждений 0

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/fmv-crossing/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"open":5}

## Покрытие
посещено 1 из 1 достижимых сцен
rc=0
```

### Narrative baseline

```text
$ node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden
# Проверка кампании · [DEV] Пепел Каэрдена — эталон narrative (полигон смоуков)

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
rc=0
```

### Adventure campaign baseline

```text
$ node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure
# Проверка кампании · [DEV] Пепел Каэрдена — проект adventure (полигон смоуков)

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
rc=0
```

Both legacy oracles retain 10 scenes / 8 locations / 6 dialogues / 21 Ink nodes / 0 errors / 8 warnings / coverage 6 of 10. `public/ai/cf-play.mjs` was not regenerated because its source did not change; deterministic playkit bundle checks passed under `check:guide`.
