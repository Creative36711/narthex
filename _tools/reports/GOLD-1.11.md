# GOLD-1.11 — Real-time browser soak

**Verdict:** PASS
**Branch:** arena/6a1ff206-narthex
**Run ID:** 01e9ccf4-1552-4c74-bee9-20c35b721dce
**Pinned campaign:** Creative36711/campaign-1@4783665b04b9ea703cbdfc0bd10cc2b1263caf83; tree SHA-256 d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68
**Browser:** Chromium 131.0.6778.0
**Vite:** one instance at http://127.0.0.1:4174; no restart
**Command:** npm run golden:import && npm run golden:soak

## Duration and acceptance

- Browser started: 2026-10-29T22:51:06.613Z; runner completed: 2026-10-29T23:51:27.175Z.
- Active gameplay: 2026-10-29T22:51:22.115Z → 2026-10-29T23:51:22.551Z.
- durationSeconds (browser start to runner finish): **3620.6**; active-game duration: **3600.4** (both required ≥ 3600).
- Checkpoints: **13** at minutes 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60 (required ≥ 12).
- Active-session actions: **211** (required ≥ 60); maximum action gap: **44.8s** (limit ≤ 60s).
- Scenes: **3** — scene_gate_hall, scene_pump_hall, scene_pump_shaft (required ≥ 3).
- HUD: initial День 1, 07:00; active start День 1, 08:00; active end День 1, 12:00; initial-to-end change 300 in-game minutes; active-window change 240 minutes.
- pageerror: **0**; empty-background count: **0** across 736 samples.
- console.error: **0**; HTTP errors: **0** (0 documented optional 404; 0 unclassified).
- Contexts/pages: 1/1; page.reload count: 1; Vite starts: 1.

## Five-minute timeline

| Minute | Timestamp UTC | Scene | HUD time | pageerror cumulative | empty backgrounds cumulative | Actions since prior | Actions cumulative |
|---:|---|---|---|---:|---:|---:|---:|
| 0 | 2026-10-29T22:51:22.502Z | scene_pump_hall | День 1, 08:00 | 0 | 0 | 0 | 30 |
| 5 | 2026-10-29T22:56:22.122Z | scene_pump_hall | День 1, 08:00 | 0 | 0 | 17 | 47 |
| 10 | 2026-10-29T23:01:22.124Z | scene_pump_hall | День 1, 08:00 | 0 | 0 | 15 | 62 |
| 15 | 2026-10-29T23:06:22.128Z | scene_pump_hall | День 1, 08:00 | 0 | 0 | 18 | 80 |
| 20 | 2026-10-29T23:11:22.128Z | scene_pump_hall | День 1, 08:00 | 0 | 0 | 17 | 97 |
| 25 | 2026-10-29T23:16:22.120Z | scene_pump_hall | День 1, 10:00 | 0 | 0 | 19 | 116 |
| 30 | 2026-10-29T23:21:22.634Z | scene_pump_hall | День 1, 10:00 | 0 | 0 | 18 | 134 |
| 35 | 2026-10-29T23:26:22.132Z | scene_pump_hall | День 1, 10:00 | 0 | 0 | 22 | 156 |
| 40 | 2026-10-29T23:31:22.120Z | scene_pump_hall | День 1, 10:00 | 0 | 0 | 15 | 171 |
| 45 | 2026-10-29T23:36:22.121Z | scene_pump_hall | День 1, 10:00 | 0 | 0 | 18 | 189 |
| 50 | 2026-10-29T23:41:22.124Z | scene_pump_hall | День 1, 12:00 | 0 | 0 | 19 | 208 |
| 55 | 2026-10-29T23:46:22.142Z | scene_pump_hall | День 1, 12:00 | 0 | 0 | 15 | 223 |
| 60 | 2026-10-29T23:51:22.550Z | scene_pump_hall | День 1, 12:00 | 0 | 0 | 18 | 241 |

## Save, reload, and Continue

- Manual save vs pre-save snapshot discrepancies: 0.
- Reload + Continue discrepancies (flags/time/scene/location): 0.
- Persisted flags before/after: case_opened, gate_intro_done, ira_story, met_ira, pump_seen / case_opened, gate_intro_done, ira_story, met_ira, pump_seen.
- Tick 10 → 10; HUD День 1, 10:00 → День 1, 10:00.
- Same context and Vite instance; the one permitted page.reload occurred at minute 30.

## Menu audio probes

| Phase | Asset bytes | Playback observed | Captured attempts |
|---|---:|---|---|
| start-before-user-gesture | 1980857 | true | [{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.072,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.338,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.822,"playingEvent":true,"playError":null,"paused":false,"volume":0.405,"loop":true,"readyState":4}] |
| start-after-user-gesture | 1980857 | true | [{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.072,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.338,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":3.435,"playingEvent":true,"playError":null,"paused":false,"volume":0.405,"loop":true,"readyState":4}] |
| end-after-60-minute-session | 1980857 | true | [{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.111,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.446,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":2.025,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.497,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.788,"playingEvent":true,"playError":null,"paused":false,"volume":0.405,"loop":true,"readyState":4}] |

The runner measured the pinned music_menu.mp3 file and observed actual media play/playing state; the probe does not suppress browser errors.

## Error accounting — events are not suppressed

### console.error

| Timestamp UTC | Message | Source URL |
|---|---|---|
| — | None observed; listener remained active and no console.error event was suppressed. | — |

### HTTP responses ≥ 400

| Status | URL | Classification / reason |
|---:|---|---|
| — | None observed. | — |

No optional project.json 404 was observed.

### Failed requests

| Timestamp UTC | Failure | URL |
|---|---|---|
| — | None observed. | — |

## Screenshots

- _tools/reports/GOLD-1.11/minute-00-session-start.png — 1440×900, 1917914 bytes
- _tools/reports/GOLD-1.11/minute-30-save-checkpoint.png — 1440×900, 1943104 bytes
- _tools/reports/GOLD-1.11/minute-60-session-end.png — 1440×900, 1939150 bytes

## Gates and CI

- `npm run golden:soak`: PASS, rc=0; run ID `01e9ccf4-1552-4c74-bee9-20c35b721dce`.
- `npm run playthrough:golden`: PASS, rc=0; run ID `7e1d9e0e-8e9a-4244-8620-10d0513a098c`; audit errors/warnings 0; cf-play 12 scenes, errors/warnings 0; clue=true; save/load=потерь нет; pageerror=0; emptyBackgrounds=0; duration=40.24s.
- `node --check scripts/golden/soak.mjs`, targeted lint, `git diff --check`, `npm run check:browser-gate`, and `npm run check:pack-boundary`: PASS.
- `npm run lint`: FAIL, rc=1, 1,514 repository warnings and 5 errors; the changed runner's targeted lint passes.
- `npm run check:module-size`: FAIL, rc=1, 15 existing modules exceed the configured limits; no such modules are changed in this task.
- `npm run check:decisions`: FAIL, rc=1, pre-existing unsupported status text in `docs/decisions/GOLD-1.6c.md`; that file is outside this change and remains unchanged.
- PR #158 checks for implementation commit `9702389`: `golden-playthrough` run **40976221554**, job **123804786935**, conclusion **success**; `visual`/`screenshots` run **40976221669**, job **123804787621**, conclusion **failure** at `Проверить свежесть бандла аудита до сборки`. The visual job stopped before its build/screenshot steps because the existing audit-bundle freshness gate failed; this task changes no audit bundle or workflow.
- Scope: only `package.json`, `scripts/golden/soak.mjs`, and the permitted GOLD-1.11 report/log/screenshots are included.

## Failures

- None.

## Artifacts

- _tools/reports/GOLD-1.11.md
- _tools/reports/GOLD-1.11.log
- Screenshots: _tools/reports/GOLD-1.11
