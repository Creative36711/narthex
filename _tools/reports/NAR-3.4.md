# NAR-3.4 — CI verification debt

Date: 2026-10-26. Baseline tree: `cfd94af963eb1f0f44227fd9d878a9dcf6a36329` (`origin/main`).

## Implemented

- Added `scripts/check-audit-bundle.mts` and `npm run check:audit-bundle`. The check invokes the exact esbuild arguments from `build:ai-bundle` into a temporary directory and byte-compares the result with `public/ai/campaign-audit.mjs`; it never repairs or writes the published bundle.
- Refactored `scripts/check-module-size.mts` to compare source hashes against an embedded, 166-file baseline from `cfd94af`. It no longer shells out to git, checks for `origin/main`, or needs repository history. The 450/600 limits, negative fixtures, engine facade check, and non-blocking-unless-changed treatment of the two existing debt modules remain.
- Made each mission gate and smoke-suite invocation explicit in `.github/workflows/visual.yml`. CI checks the audit bundle both before and after `npm run build`; the mission command set includes `check:core-graph`, `check:guide`, `check:narrative-codes`, and `npm run smoke:mission` (the 55 NAR-2.15 smoke scripts), plus the section-1 commands.
- Added this report. No schema, oracle, threshold, smoke-list, campaign-index, campaign-data, or `cf-play` bundle changes were made. The 27 missing-image fixtures in each Ash campaign were left intact.

Initial PR head `387b345` passed the `screenshots` Actions job, run `40351238004` (4m34s). This run included the complete 55-smoke list and visual playthrough.

## Freshness gate and mutation evidence

Clean bundle gate:

```text
$ npm run check:audit-bundle
> narthex@0.9.0 check:audit-bundle
> tsx scripts/check-audit-bundle.mts
✓ public/ai/campaign-audit.mjs matches scripts/campaign-audit.mts (1002930 bytes, sha256 f7f683d3e3a1c9883031c9ef2b53e6219e98c292ed899cbd7b59aabae50bb2dc)
rc=0
```

`npm run build` also completed with rc=0 and regenerated the audit bundle through its existing `build:ai-bundle` step. The post-build freshness check returned the same byte count and SHA-256 above.

For the negative check, I temporarily changed the runtime string in `scripts/campaign-audit.mts` from `Headless-аудит кампании: ${CAMPAIGN_ROOT}` to `Headless-аудит кампании: MUTATION ${CAMPAIGN_ROOT}` without rebuilding the committed bundle. The gate returned 1, then a shell trap restored the source. Literal gate output:

```text
✗ public/ai/campaign-audit.mjs is stale relative to scripts/campaign-audit.mts
  committed: 1002930 bytes, sha256 f7f683d3e3a1c9883031c9ef2b53e6219e98c292ed899cbd7b59aabae50bb2dc
  generated: 1002939 bytes, sha256 ea4b3ad86736d171596ca48eab532def2f7bebd1e53c6866d634ae1af6eaa1fe
  first differing byte: 1002156
  rebuild with: npm run build:ai-bundle
EXPECTED MUTATION FAILURE: check:audit-bundle exited 1 after source-only mutation; source restored by trap
```

Final tree has no mutation in `scripts/campaign-audit.mts`; the published bundle is the unmutated generated output.

## Module-size: history-independent verification

Exact normal output (rc=0):

```text
$ npm run check:module-size
fixture (a) changed module 451 lines: PASS — rc=1, lines=451, limit=450
fixture (b) changed module 450 lines: PASS — rc=0, lines=450, limit=450
fixture (c) engine.ts 600 lines: PASS — rc=0, lines=600, limit=600
fixture (d) engine.ts 601 lines: PASS — rc=1, lines=601, limit=600
limit=450 facade=600
baseline source modules=166
changed source modules=0
module src/core/engine.ts: 594/600 lines (facade)
external debt (non-blocking unless changed): src/core/combat.ts 1765; src/core/savemigrate.ts 788
check:module-size passed
```

Full-clone and shallow/no-remote comparison: cloned `main` once with full history and once with `--depth=1`; copied the working checker into both; removed `refs/remotes/origin/main` from the depth-1 clone and verified `origin/main^{commit}` could not resolve there. Ran `tsx scripts/check-module-size.mts` in both clones. Their complete output was byte-identical (`diff -u` rc=0), including the four fixture lines above and `check:module-size passed` (both rc=0).

Negative grown-module test in the depth-1 clone: temporarily added a new 451-line `src/__module_size_growth_fixture__.tsx` (unknown to the baseline), ran the checker, then removed the fixture. Literal result:

```text
changed source modules=1
module src/__module_size_growth_fixture__.tsx: 451/450 lines (changed)
✗ src/__module_size_growth_fixture__.tsx: 451 lines exceeds limit=450
check:module-size failed: 1 module(s) exceed their limit
EXPECTED GROWN-MODULE FAILURE: rc=1
```

The source tree's 450 and 600 limits were not raised or removed.

## CI wiring and all NAR-2.15 smoke scripts

Workflow: `.github/workflows/visual.yml`. It now has explicit steps at lines 30–73 for the bundle freshness check, `npx tsc -b`, `npm run check:contracts`, each of `check:core-graph`, `check:guide`, `check:narrative-codes`, `check:module-size`, `check:version`, `check:brand`, `smoke:core`, both campaign oracle commands, and `npm run build`; line 61 calls `npm run smoke:mission`. The latter asserts the required list length is exactly 55, verifies every npm entry exists, starts the dev server, runs those scripts serially, and reports per-script rc.

Literal smoke result from `npm run check:mission`:

```text
SUMMARY 55/55 passed; rc=0
check:mission passed; rc=0
```

All 55 NAR-2.15 smoke scripts called by CI (each returned rc=0):

1. `smoke:currency`  2. `smoke:ink-import`  3. `smoke:fingerprint`  4. `smoke:book-md`  5. `smoke:campaign-index`
6. `smoke:guide`  7. `smoke:design-doc`  8. `smoke:quest-journal`  9. `smoke:quest-journal-runtime`  10. `smoke:p2`
11. `smoke:ai-runtime`  12. `smoke:ai-task`  13. `smoke:char-templates`  14. `smoke:no-campaign`  15. `smoke:chronicle-manifest`
16. `smoke:dialogues-r31`  17. `smoke:dialogues-r32`  18. `smoke:breathe-toggle`  19. `smoke:scene-subtitles`  20. `smoke:scene-editor`
21. `smoke:editor-hotspot`  22. `smoke:voice-dedup`  23. `smoke:narrative-intro`  24. `smoke:encounters-loader`  25. `smoke:manifest-order`
26. `smoke:engine-version`  27. `smoke:hero-appearance`  28. `smoke:theme-contrast`  29. `smoke:dialogue-transitions`  30. `smoke:dialogue-skip`
31. `smoke:travel-transition`  32. `smoke:stranger`  33. `smoke:encumbrance`  34. `smoke:cutscene-queue`  35. `smoke:spoil`
36. `smoke:time-semantics`  37. `smoke:ai-diff`  38. `smoke:view-write`  39. `smoke:core`  40. `smoke:saves-compat`
41. `smoke:pack-missing`  42. `smoke:pack-panels`  43. `smoke:capability-modes`  44. `smoke:dlg-script`  45. `smoke:dlg-ui`
46. `smoke:folder-import`  47. `smoke:narrative-builder`  48. `smoke:patch`  49. `smoke:cutout`  50. `smoke:duration-actions`
51. `smoke:craft-fail-time`  52. `smoke:dialogue-speaker`  53. `smoke:narthex-closed`  54. `smoke:narthex-tech`  55. `smoke:drive-gateway`
```

The same local mission run returned rc=0 for `tsc -b`, contracts, core graph, guide, narrative codes, version, brand, core smoke, both `cf-play check` commands, and the complete smoke suite. Literal gate outputs:

```text
$ npm run check:core-graph
Core graph OK (25 modules; acyclic; no core imports of engine.ts).
rc=0
```

```text
$ npm run check:guide
fixture (a) guide size 268683: PASS — within limit 524288 bytes
fixture (b) guide size 524289: PASS — error includes actual 524289 and limit 524288 bytes
✓ campaign guide size: current=268683 bytes; mirror=268683 bytes; limit=524288 bytes
✓ check:guide: 6 команд (исходники, bundle, распакованный kit); explain=28; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10
rc=0
```

```text
$ npm run check:narrative-codes
✓ narrative explain: 28 кодов; валидатор использует тот же каталог, документация содержит только один исполняемый пример
rc=0
```

## Required NAR-3.4 full-audit observation: FMV fixture

Exact command and literal output:

```text
$ npm run audit:campaign -- public/campaigns/fmv-crossing
> narthex@0.9.0 audit:campaign
> tsx scripts/campaign-audit.mts public/campaigns/fmv-crossing
Headless-аудит кампании: /home/user/narthex/public/campaigns/fmv-crossing
Файлов в покрытии: json 2, ink/md 0
СТРУКТУРА И ССЫЛКИ
ERROR: Схема manifest.json/: must NOT have additional properties
ERROR: Схема scenes/scene_fmv_crossing.json/: must NOT have additional properties
МЕДИА И ФАЙЛЫ
INFO: Проверено ссылок на локальные медиа в контенте кампании: 1; все найдены.
Итого: 2 ошибок, 0 предупреждений, 3 заметок
rc=1
```

These are the two `fmv` extension fields in `manifest.json` and `scene_fmv_crossing.json`, rejected by the existing closed schemas. The FMV runtime requires those fields, so removing them would disable the FMV scene; changing campaign schemas is outside scope and explicitly forbidden. No data or schema was changed. This is recorded as a separate schema-contract follow-up; it is not misreported as missing media (the audit found the one referenced asset).

The intentional media-fixture audits were also run and remain unchanged:

```text
$ npm run audit:campaign -- public/campaigns/ash-of-caerden
Итого: 27 ошибок, 16 предупреждений, 2 заметок
rc=1

$ npm run audit:campaign -- public/campaigns/ash-of-caerden-adventure
Итого: 27 ошибок, 16 предупреждений, 2 заметок
rc=1
```

All 27 ERROR rows in each are missing-image findings; these remain intentional fixtures. No missing media was added or substituted.

## Section-1 oracle and retained gates

### TypeScript

```text
$ npx tsc -b
(no diagnostics)
rc=0
```

### Contracts, including browser gate and module threshold

```text
$ npm run check:contracts
контракты согласованы: 42 проверок
✓ core pack boundary: 25 source files; no pack-ID branches or imports from packs/**
check:module-size passed
Гейт браузера: ok — ложных формулировок 0, инфраструктура на месте, CI вызывает playthrough.
Гейт внутренних кампаний: ok — 3 полигона, 0 записей в реестре, сирот нет.
✓ Проверена JSON Schema Draft 2020-12: 125 типов
✓ Campaign Package ↔ MonolithDoc: round-trip без потерь и предупреждений
rc=0
```

### Brand, version, core smoke, build, and browser playthrough

```text
$ npm run check:brand
✓ старое имя не встречается (проверено файлов: 1197)
rc=0
```

```text
$ npm run check:version
✓ версия 0.9.0 согласована: package.json, lock, Cargo.toml, Tauri (../package.json), гайд, CHANGELOG
rc=0
```

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
rc=0
```

```text
$ npm run build
✓ 1435 modules transformed.
✓ built in 3.06s
stderr: public/ai/campaign-audit.mjs  979.4kb; ⚡ Done in 41ms
rc=0
```

```text
$ npm run playthrough -- http://localhost:4173 out/play
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
rc=0
```

`out/play/` contains 20 PNGs (uncommitted artifacts). Three visual-step descriptions: `out/play/01-fmv-project-open.png` is the FMV project opening; `out/play/04-fmv-post-fragment-choice.png` is the post-video choice; `out/play/07-fmv-ending.png` is the ending. The playthrough JSON records `pageErrors=0`, `errorScreens=0`, `brokenPortraitImages=0`, `rawNpcIds=0`, `steps=20`, `findings=[]`. The four baseline story screenshots with `битых img 1` are the existing generic missing-image fixture, not portrait images; all seven FMV screenshots report 0 broken images.

### Both cf-play reference oracles

```text
$ node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden
✓ проверка пройдена
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
seed'ов 5 · исходы {"death":5}
посещено 6 из 10 достижимых сцен
rc=0
```

```text
$ node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure
✓ проверка пройдена
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
seed'ов 5 · исходы {"death":5}
посещено 6 из 10 достижимых сцен
rc=0
```

Both exact outputs retain the required 10/8/6/21, 0 errors, 8 warnings, and coverage 6 of 10. `public/ai/cf-play.mjs` was not edited or regenerated.

## Re-measured external debt (not changed)

```text
$ wc -l src/core/combat.ts src/core/savemigrate.ts
  1765 src/core/combat.ts
   788 src/core/savemigrate.ts

$ npm run lint
Found 1504 warnings and 5 errors.
rc=1

$ wc -c docs/ai-campaign-guide.md public/ai/campaign-guide.md
268683 docs/ai-campaign-guide.md
268683 public/ai/campaign-guide.md
```

Comparison: `combat.ts` is 1765 lines (matches 1765); `savemigrate.ts` is 788 (matches 788); lint has 5 errors (matches the 5-error reference), while warnings are 1504, 20 more than the NAR-2.15 report's 1484; the repo-wide lint remains a known nonzero baseline and no lint rules were relaxed. The guide and mirror are both 268683/524288 bytes (match; 255605 bytes below the ceiling).
