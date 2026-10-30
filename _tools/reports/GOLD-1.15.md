# GOLD-1.15 — one-hour golden playthrough from fresh game to first clue

**Verdict:** PASS
**Branch:** arena/01751800-narthex
**Run ID:** 4978903d-3b15-4e7f-a82e-b8b9922df824
**Pinned campaign:** Creative36711/campaign-1@4783665b04b9ea703cbdfc0bd10cc2b1263caf83; tree SHA-256 d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68
**Browser:** Chromium 131.0.6778.0
**Vite:** one instance at http://127.0.0.1:4174; no restart
**Command:** npm run playthrough:golden
**Soak subcommand:** npm run golden:soak
**Orchestrator run ID:** e1adf545-750e-413f-979a-5db78575fc4d; base playthrough rc=0
**CI context:** event=local; run=n/a; attempt=n/a; sha=n/a

## Duration and acceptance

- Browser started: 2026-10-30T10:33:09.236Z; runner completed: 2026-10-30T11:33:21.836Z.
- Active gameplay: 2026-10-30T10:33:16.858Z → 2026-10-30T11:33:17.225Z.
- durationSeconds (active gameplay from fresh-game start through the one-hour soak): **3600.4**; activeDurationSeconds: **3600.4**; browser wall time: **3612.6** (all seconds; active duration must be ≥ 3600).
- First checkpoint: scene 1 `scene_gate_hall`; HUD **День 1, 07:00**; opening flags: case_opened, gate_intro_done; clue flags: none.
- First clue marker: `clue_glove=true` at t+10.4s; scene scene_pump_hall; HUD День 1, 09:00; attempt 1.
- HUD timeline regressions: **0**; no time was injected or rewound.
- **Explicit card discrepancy:** the card asks for HUD 08:00 and an empty flags object at the fresh-game checkpoint. The pinned campaign actually starts at `scene_gate_hall`, HUD 07:00, with `case_opened` and `gate_intro_done`; its clue flags are empty. The runner records that real state and does not change campaign data, clear flags, or jump time.
- Checkpoints: **13** at minutes 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60 (required ≥ 12).
- Active-session actions: **229** (required ≥ 60); maximum action gap: **44.7s** (limit ≤ 60s).
- Scenes: **3** — scene_gate_hall, scene_pump_hall, scene_pump_shaft (required ≥ 3).
- HUD: initial День 1, 07:00; active start День 1, 07:00; active end День 1, 13:00; change 360 in-game minutes.
- pageerror: **0**; empty-background count: **0** across 735 samples.
- console.error: **0**; HTTP errors: **0** (0 documented optional 404; 0 unclassified).
- Contexts/pages: 1/1; page.reload count: 1; Vite starts: 1.

## Timeline: fresh game → first clue → one-hour soak

| Minute / event | Timestamp UTC | Scene | HUD time | pageerror cumulative | empty backgrounds cumulative | Actions since prior | Actions cumulative |
|---|---|---|---|---:|---:|---:|---:|
| 0 | 2026-10-30T10:33:17.260Z | scene_gate_hall | День 1, 07:00 | 0 | 0 | 0 | 15 |
| first clue (t+10.4s) | 2026-10-30T10:33:27.218Z | scene_pump_hall | День 1, 09:00 | 0 | 0 | 18 | 33 |
| 5 | 2026-10-30T10:38:16.869Z | scene_pump_hall | День 1, 09:00 | 0 | 0 | 35 | 50 |
| 10 | 2026-10-30T10:43:16.872Z | scene_pump_hall | День 1, 09:00 | 0 | 0 | 15 | 65 |
| 15 | 2026-10-30T10:48:16.864Z | scene_pump_hall | День 1, 09:00 | 0 | 0 | 18 | 83 |
| 20 | 2026-10-30T10:53:16.867Z | scene_pump_hall | День 1, 09:00 | 0 | 0 | 17 | 100 |
| 25 | 2026-10-30T10:58:16.871Z | scene_pump_hall | День 1, 11:00 | 0 | 0 | 19 | 119 |
| 30 | 2026-10-30T11:03:17.228Z | scene_pump_hall | День 1, 11:00 | 0 | 0 | 18 | 137 |
| 35 | 2026-10-30T11:08:16.866Z | scene_pump_hall | День 1, 11:00 | 0 | 0 | 22 | 159 |
| 40 | 2026-10-30T11:13:16.870Z | scene_pump_hall | День 1, 11:00 | 0 | 0 | 15 | 174 |
| 45 | 2026-10-30T11:18:16.864Z | scene_pump_hall | День 1, 11:00 | 0 | 0 | 18 | 192 |
| 50 | 2026-10-30T11:23:16.863Z | scene_pump_hall | День 1, 13:00 | 0 | 0 | 19 | 211 |
| 55 | 2026-10-30T11:28:16.869Z | scene_pump_hall | День 1, 13:00 | 0 | 0 | 15 | 226 |
| 60 | 2026-10-30T11:33:17.224Z | scene_pump_hall | День 1, 13:00 | 0 | 0 | 18 | 244 |

## Save, reload, and Continue

- Manual save vs pre-save snapshot discrepancies: 0.
- Reload + Continue discrepancies (flags/time/scene/location): 0.
- Persisted flags before/after: case_opened, clue_glove, gate_intro_done, ira_story, met_ira, pump_seen / case_opened, clue_glove, gate_intro_done, ira_story, met_ira, pump_seen.
- Tick 11 → 11; HUD День 1, 11:00 → День 1, 11:00.
- Same context and Vite instance; the one permitted page.reload occurred at minute 30.

## Menu audio probes

| Phase | Asset bytes | Playback observed | Captured attempts |
|---|---:|---|---|
| start-before-user-gesture | 1980857 | true | [{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.469,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.552,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.791,"playingEvent":true,"playError":null,"paused":false,"volume":0.405,"loop":true,"readyState":4}] |
| start-after-user-gesture | 1980857 | true | [{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.469,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.552,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":3.4,"playingEvent":true,"playError":null,"paused":false,"volume":0.405,"loop":true,"readyState":4}] |
| end-after-60-minute-session | 1980857 | true | [{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.304,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.491,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.994,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.514,"playingEvent":true,"playError":null,"paused":true,"volume":0,"loop":true,"readyState":4},{"requestedSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","currentSource":"http://127.0.0.1:4174/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/assets/audio/music/music_menu.mp3","durationSeconds":165.042,"currentTimeSeconds":1.782,"playingEvent":true,"playError":null,"paused":false,"volume":0.405,"loop":true,"readyState":4}] |

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

- minute-00-game-start.png — 1440×900, 1771012 bytes (temporary, not committed)
- minute-30-save-checkpoint.png — 1440×900, 1937537 bytes (temporary, not committed)
- minute-60-session-end.png — 1440×900, 1942612 bytes (temporary, not committed)

## Gates and CI

- Local soak: PASS; base campaign/negative entry: rc=0.
- The common `npm run playthrough:golden` entry invokes the existing `npm run golden:soak`; the golden workflow runs on `push` to `main` without a conditional and gives the job at least 75 minutes.
- CI run ID and merge-push conclusion are supplied by the workflow; see the run summary uploaded with this report.

## Failures

- None.

## Artifacts

- _tools/reports/GOLD-1.15.md
- _tools/reports/GOLD-1.15.log
- Temporary screenshot output: /tmp/golden-soak-GOLD-1.15-e1adf545-750e-413f-979a-5db78575fc4d

## Combined entry result

- npm run playthrough:golden rc=0; base campaign/warning checks rc=0; npm run golden:soak rc=0.
- Orchestrator run ID: e1adf545-750e-413f-979a-5db78575fc4d; elapsed wall time: 3670.6 seconds.
