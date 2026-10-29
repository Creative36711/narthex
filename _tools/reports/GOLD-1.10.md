# GOLD-1.10 — Campaign ending reachability

**Verdict: PASS.** Three distinct ending data IDs were reached consecutively in one Chromium browser context; no flags, scenes, or ending states were set by the runner.

- Branch: `arena/ed3556b6-narthex`
- Campaign: Каркас: Дело о седьмой помпе (`b7305faa-8e10-4d26-96bb-f1b5ed5e493f`)
- Pin: `Creative36711/campaign-1@4783665b04b9ea703cbdfc0bd10cc2b1263caf83`; archive URL: https://codeload.github.com/Creative36711/campaign-1/tar.gz/4783665b04b9ea703cbdfc0bd10cc2b1263caf83
- Archive: 188670372 bytes; SHA-256: `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; tree SHA-256: `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`
- Browser: Chromium 131.0.6778.0; viewport: 1440×900; same tab/context for all three runs
- Imported ending data: 9; reached: 3; distinct reached IDs: 3

## Reached endings

| Ending ID | Scene | UI action reaching ending | Step count | Elapsed time | Final dialogue |
|---|---|---|---:|---:|---|
| `ending_pump` | `scene_pump_hall` | `start_pump_attempt_1` (step 22) | 22 | 56.30 s | **Затвор держит. Теперь отдай сердцевину.** — “Слышал, как он сел, — по трубам слышно. Ладно. Бери сердцевину и ключ от схрона. Только не торопи воду: она помнит, кто её торопил.” |
| `ending_vein` | `scene_face` | `dialogue_choice` (step 19; runtime:npc_vein#Начало[2]) | 19 | 52.64 s | **Вложить сердцевину в стену.** — “Ты кладёшь ладонь на камень. Он тёплый и отвечает на пульс.” “Бери. И помни: я помню всех, кто брал, — и всех, кто вернул.” |
| `ending_closed` | `scene_office` | `dialogue_choice` (step 25; runtime:npc_kast#Гроссбух[0]) | 25 | 68.41 s | **Отдать гроссбух и закрыть дело.** — “Вот и хорошо. Дело закрыто, виновный установлен, город спит.” |

## All campaign endings

| Ending ID | Status | Reason / title |
|---|---|---|
| `ending_pump` | reached | Runtime meta store contains data ID ending_pump; final screen title matched. |
| `ending_silence_kell` | unreached | Не запускался маршрут взрыва затвора с гибелью Келла; в этом прогоне выбраны другие три финала. |
| `ending_silence_stood` | unreached | Не запускался финальный разговор/проверка убеждения Келла у затвора. |
| `ending_silence_rigged` | unreached | Не собирался заряд и не выполнялся маршрут установки на замедлитель. |
| `ending_silence` | unreached | Базовая ветка «Тишина» не выбиралась; выполнены помпа, Жила и закрытие дела. |
| `ending_vein` | reached | Runtime meta store contains data ID ending_vein; final screen title matched. |
| `ending_closed` | reached | Runtime meta store contains data ID ending_closed; final screen title matched. |
| `ending_flood` | unreached | Срок 72 часа намеренно не выжидался; финал потопа не запускался. |
| `ending_death` | unreached | Смерть героя намеренно не вызывалась; это не один из трёх проверяемых маршрутов. |

## Browser diagnostics

- pageerror: **0**
- Empty-background samples: **0** / 55
- Console errors: **0**
- None.
- HTTP error responses: 0 (optional project.json 404s: 0)
- Failed requests: 1

## Final frames

- `_tools/reports/GOLD-1.10/ending_pump.png` — 1440×900, 1006032 bytes
- `_tools/reports/GOLD-1.10/ending_vein.png` — 1440×900, 1151977 bytes
- `_tools/reports/GOLD-1.10/ending_closed.png` — 1440×900, 1039920 bytes

## Dialogue-choice ID convention

The pinned DlgDoc choice objects have no native stable IDs. For each intended choice, the runner resolves an auxiliary source reference in the pinned data, matches it uniquely against the currently rendered choices, records the live 0-based runtime ID as `runtime:<npc>#<node>[<live-index>]`, rechecks the indexed button text, and clicks that exact button. Selected runtime IDs and source references are in the run log; the reversible convention is documented in `docs/decisions/GOLD-1.5.md`.

## Import and manifest-pin validation

- `npm ci` — rc=0.
- `npm run golden:import` — rc=0; downloaded archive size **188,670,372 bytes**, archive SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; importer reported `manifest: unchanged`.
- Imported tree: **1,291 files**, **32 directories**, **192,491,897 bytes**, SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`; `endings.mjs` independently recomputed and verified the same values before starting Vite.
- `node scripts/golden/manifest-pin-smoke.mjs` — rc=0 (harness PASS). On disposable copies, the endings runner itself returned rc=1 for a commit-only mutation and for a `sha256`-only mutation. Both errors identify the violated URL/tree-archive constraint, and both rejections happen before report-directory, server, or browser startup.
- The tracked `.golden/manifest.json` remained byte-for-byte unchanged; SHA-256 `f6c7f98c87cf041fb7e46c9a1bb80f92f1950f4d43943148d988483f1b02d293`.
- Search of `scripts/golden/**` for `71dbbc10`, `d424a914`, and `132a5c09` returned no matches.

## Regression check — `npm run playthrough:golden`

- rc=0; local run ID `f26baba7-4bef-4cfd-91d7-04681185295e`.
- `audit:campaign`: **0 errors, 0 warnings**. Source `cf-play`: **12 scenes, 0 errors, 0 warnings**; packed-kit parity check completed successfully.
- Browser route found the first clue; save/load verdict: **потерь нет** (no losses); `pageerror=0`; empty backgrounds **0**; browser duration **42.73 s**.
- The test wrote the pre-existing GOLD-1.6 report/log/screenshots while running; all tracked GOLD-1.6 artifacts were restored to their original contents afterwards.

## Runner iteration notes

- The first local attempt exposed stale storage-key assumptions in the ending runner; it now reads the active runtime's `chronicle-forge:save` and `chronicle-forge:meta` keys. No game/runtime source files were changed.
- A subsequent attempt reached all three endings but sampled two still-loading animated backgrounds. The runner now waits for the active background image to have non-zero natural dimensions before sampling. The final run passed with **0/55** empty-background samples, `pageerror=0`, zero console/HTTP errors, and one canceled animated-background request (`net::ERR_ABORTED`) during scene transition.
