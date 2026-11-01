# STAB-1.30 — five-minute cycle determinism budget

**Result:** The requested timeout-only change is merged and verified on the final implementation SHA. Local final-SHA verification passed, including the pinned Golden run, `cf-play:negative`, and a 3,600.3-second active soak. **The GitHub `golden-playthrough` workflow did not run:** its manual dispatch was rejected with HTTP 403 (`Resource not accessible by integration`). The local Golden evidence below is an explicitly identified fallback, not a successful Actions run. Therefore the Actions Golden acceptance item remains blocked by repository integration permissions.

## Scope and merged implementation

- Final code SHA tested: `94d5eca87be9fbc893fc8605ceb225e236756c97` (squash merge of [PR #194](https://github.com/Creative36711/narthex/pull/194), merged 2026-11-01 07:26:41 UTC).
- Only workflow change: `.github/workflows/visual.yml`, step **Детерминизм циклов**, `timeout-minutes: 10` → `timeout-minutes: 5`.
- No seeds, repeats, browser/parity checks, failure handling, or pipes were disabled or changed. The step still runs `npm run check:determinism 2>&1 | tee out/visual/check-determinism.log` under `set -o pipefail`, so a nonzero test exit is not hidden by `tee`. `scripts/check-determinism.mts` retains five seeds × two runtimes × two replays; the NAR-4.6 parity gate still compares Chromium with cf-play/Node and repeats both runs, and missing Chromium or mismatches remain hard failures.
- No checking contract changed, so no `docs/decisions/STAB-1.30.md` was required.

## Visual workflow evidence

- **Accepted post-merge run:** [41284804428](https://github.com/Creative36711/narthex/actions/runs/41284804428), `success`, `head_sha=94d5eca87be9fbc893fc8605ceb225e236756c97`.
- GitHub job-step metadata records **Детерминизм циклов** from `2026-11-01T07:27:21Z` to `2026-11-01T07:27:22Z` (1 second), success; comfortably below the five-minute step timeout. The whole visual job took 5m17s; that job duration is not the determinism-step duration.
- GitHub's artifact/log downloads returned EOF in this environment. The successful run conclusion and step timestamps are from the GitHub Actions REST run/job metadata; local final-SHA determinism/parity checks are also included in §4 below.

### Runs deliberately excluded from acceptance evidence

- [41271352629](https://github.com/Creative36711/narthex/actions/runs/41271352629) is a successful visual run on `c4f4e5af296816d99fe8ccd0bb9e374e298aef09`, before PR #194. That SHA still configured `timeout-minutes: 10`; its green step (1 second) does not validate the restored five-minute limit.
- [41284364313](https://github.com/Creative36711/narthex/actions/runs/41284364313) is a successful visual run on PR head `c67c6c9df0877c857c941d8bd2cdca0586bb5213`, not the post-merge `main` SHA. It is not used as final-SHA evidence.
- [41271352573](https://github.com/Creative36711/narthex/actions/runs/41271352573) is a successful `golden-playthrough` run on the earlier SHA `c4f4e5af296816d99fe8ccd0bb9e374e298aef09`; it also predates PR #194 and is not same-final-SHA evidence.

## §4 checks on final `main` SHA

Executed in detached worktree `/tmp/narthex-stab130-main-94d5eca` at `94d5eca87be9fbc893fc8605ceb225e236756c97`, 2026-11-01 07:28:46–07:33:52 UTC. **All 21/21 command rows returned `rc=0`.** The full command/time ledger is in `/tmp/stab130-section4-main-summary.tsv`; captured output is `/tmp/stab130-section4-main.log`.

| # | Command | UTC start–end | rc |
|---:|---|---|---:|
| 1 | `npm ci` | 07:28:46–07:28:51 | 0 |
| 2 | `npm run check:audit-bundle` (before build) | 07:28:51–07:28:53 | 0 |
| 3 | `npx tsc -b` | 07:28:53–07:29:06 | 0 |
| 4 | ScriptCat tests (all `.mjs`; 71 tests) | 07:29:06–07:29:16 | 0 |
| 5 | `npm run check:contracts` | 07:29:16–07:29:29 | 0 |
| 6 | `npm run check:core-graph` | 07:29:29–07:29:29 | 0 |
| 7 | `npm run check:module-size` | 07:29:29–07:29:29 | 0 |
| 8 | `npm run check:brand` | 07:29:29–07:29:30 | 0 |
| 9 | `npm run check:version` | 07:29:30–07:29:30 | 0 |
| 10 | `npm run check:guide` | 07:29:30–07:29:35 | 0 |
| 11 | `npm run check:playkit-bundle` | 07:29:35–07:29:36 | 0 |
| 12 | `npm run check:campaigns` | 07:29:36–07:29:36 | 0 |
| 13 | `npm run check:compat-corpus` | 07:29:36–07:29:40 | 0 |
| 14 | `npm run check:narrative-codes` | 07:29:40–07:29:41 | 0 |
| 15 | `npm run smoke:core` | 07:29:41–07:29:41 | 0 |
| 16 | `npm run smoke:mission` (55 scripts) | 07:29:41–07:31:13 | 0 |
| 17 | `npm run cf-play:negative` | 07:31:13–07:31:16 | 0 |
| 18 | `npm run lint` | 07:31:16–07:31:16 | 0 |
| 19 | `npm run build` | 07:31:16–07:31:32 | 0 |
| 20 | `npm run check:audit-bundle` (after build) | 07:31:32–07:31:34 | 0 |
| 21 | `npm run check:mission` | 07:31:34–07:33:52 | 0 |

- `npm run check:audit-bundle` SHA-256 before build: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`; after build: the same digest. `cmp=0`.
- `check:mission` passed, including the determinism/parity and warning-negative checks. The expected negative fixture reports a failing child check (`rc=1`) for a fixture with one warning and zero errors; the enclosing negative-test command returns `rc=0` when that rejection is observed.
- `npm run build` generated the untracked `dist-ai/` output in the detached test worktree. After all evidence was collected, that generated directory was removed; `dist-ai` is absent from both the test and submitted worktrees at closeout.

## Browser exam on final SHA

`npm run playthrough:exam -- http://127.0.0.1:4173 /tmp/stab130-mainsha-playthrough-exam` returned `rc=0` at 2026-11-01 07:35:14 UTC. Result: **PASS; 2 packs, 28 steps, 0 findings**.

- Ash of Caerden reached `ending_ashes`.
- Ash of Caerden Adventure reached `ending_gate_unlocked`.
- Both save/reload checks passed with byte-identical state and zero discrepancies.
- Full captured log: `/tmp/stab130-mainsha-playthrough-exam.log`.

## Local pinned Golden fallback on final SHA

This is local evidence from the detached final-SHA worktree, not GitHub Actions evidence.

- Top-level `npm run playthrough:golden` orchestrator began at `2026-11-01T07:36:15.856Z`; its base Golden playthrough completed at `07:37:22.575Z` with `rc=0` before invoking the soak.
- Pinned import/GOLD-1.6 run ID: `a54a9070-64f4-4f33-8f15-0fd3cccb63a6`. Full GOLD-1.6 run started `07:36:15.928Z` and completed `07:37:18.722Z`, verdict PASS. The manifest was verified at `07:36:15.931Z`; cold archive download verified at `07:36:24.109Z`; importer completed at `07:36:27.653Z`, `rc=0`. Pinned campaign commit `4783665b04b9ea703cbdfc0bd10cc2b1263caf83`; archive SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; imported-tree SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`. Tree verified; audit, source cf-play, and unpacked-kit cf-play had `rc=0`, zero errors and zero warnings.
- Browser playthrough began `07:36:35.230Z` and completed `07:37:18.722Z`, PASS. First clue found in 2 attempts; save, reload/Continue, and manual-slot load all had zero discrepancies. Evidence checkpoints/screenshots include `01-menu`, `02-hero-creation`, `03-gate`, `route-map`, `04-machine-hall`, `05-first-clue`, `before-save`, `after-reload-menu`, and `after-load`.
- Golden output files: `/tmp/narthex-stab130-main-94d5eca/_tools/reports/GOLD-1.6.md`, `GOLD-1.6.log`, and `GOLD-1.6/` screenshots.

### `cf-play:negative`

The final-SHA §4 invocation ran `2026-11-01T07:31:13Z`–`07:31:16Z` and returned `rc=0`. The Golden negative wrapper run ID `4256a199-165c-4613-b3ce-11fa808f9b20` ran `07:36:15.885Z`–`07:37:22.569Z`, verdict PASS, `negativeScriptRc=0`. The warning-only source, bundle, and unpacked-kit fixtures each correctly returned child `rc=1` with zero errors and one warning; this expected negative proof is not a suite failure. Evidence: `/tmp/narthex-stab130-main-94d5eca/_tools/reports/GOLD-1.14.md` and `GOLD-1.14.log`.

### GOLD-1.15 active soak — complete

- Run ID: `85e6c91a-d865-4369-a466-7ae4ae18f4fd`; orchestrator run ID: `467ddeee-4cfd-4505-9a62-4ead03e0f909`.
- Required active duration: 3,600 seconds. Actual active interval from the JSONL log: **`2026-11-01T07:37:31.107Z` → `2026-11-01T08:37:31.428Z` = 3,600.321 seconds**. The `active_session_end` record reports 3,600.3 seconds; the minute-60 checkpoint at `08:37:31.426Z` also reports 3,600.3 seconds. `run_complete` at `08:37:36.163Z` is **PASS**, `activeDurationSeconds=3600.3`, `failures=[]`.
- Full top-level `npm run playthrough:golden` interval: orchestrator start `2026-11-01T07:36:15.856Z` → orchestrator complete `2026-11-01T08:37:41.144Z`; `playthroughRc=0`, `basePlaythroughRc=0`, `soakRc=0`, process exit code `0`.
- First clue: `2026-11-01T07:37:42.865Z`, t+11.8s, first attempt, `scene_pump_hall`, `clue_glove=true`. The minute-0 checkpoint was `scene_gate_hall` at `07:37:31.511Z`.
- Checkpoints: **13/13**, at minutes 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, and 60. No page errors, console errors, HTTP errors, or empty backgrounds; zero failures. 229 actions; maximum gap 44.7 seconds.
- Minute-30 save/reload: checkpoint `08:07:31.396Z`; `save_reload_verified` at `08:07:34.186Z`; manual save and reload+Continue discrepancies both `0` (scene, location, tick, HUD time, and flags matched).
- Named screenshot evidence: `minute-00-game-start.png`, `minute-30-save-checkpoint.png`, `minute-60-session-end.png` in the temporary GOLD-1.15 screenshot directory. Full timeline, checks, and persistence evidence: `/tmp/narthex-stab130-main-94d5eca/_tools/reports/GOLD-1.15.log` and `GOLD-1.15.md`.
- This is local fallback evidence; `ciRunId=null`, `ciSha=94d5eca87be9fbc893fc8605ceb225e236756c97`. It is not an Actions workflow success.

## GitHub Golden Actions limitation

No successful `golden-playthrough` Actions run exists for final SHA `94d5eca87be9fbc893fc8605ceb225e236756c97`. The most recent prior successful Golden Actions run, [41271352573](https://github.com/Creative36711/narthex/actions/runs/41271352573), ran on the earlier SHA `c4f4e5af296816d99fe8ccd0bb9e374e298aef09`, so it is not final-SHA evidence. The manual dispatch (`gh workflow run 400919893 --ref main`) was rejected on 2026-11-01 with **HTTP 403 — `Resource not accessible by integration`**. Local pinned Golden, `cf-play:negative`, and soak evidence are recorded separately above and are not represented as an Actions success. Repository integration permissions must be restored before the missing Actions acceptance can be completed.

## Scope closeout

- Workflow-file implementation diff was only the five-minute timeout value in `.github/workflows/visual.yml`; Golden workflow, test scripts, and product/fixture files were not modified.
- The evidence report is the only report artifact added by this follow-up; no decision record was added because the checking contract did not change.
