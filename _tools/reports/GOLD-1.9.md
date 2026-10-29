# GOLD-1.9 — Dynamic manifest pin validation in the golden browser runner

**Status:** implemented in the permitted pin-validation block of `scripts/golden/play.mjs`; local positive and negative checks completed. The runner now derives the expected archive URL from the manifest commit and validates the manifest’s repository, hash formats, size, archive/tree hash relationship, and imported campaign manifest file. No escape hatch or soft mode was added.

## Scope and starting state

- Branch: `arena/a450a2a4-narthex` (fixed active Arena branch); starting `HEAD`, `origin/main`, and merge-base: `53a14a509c3232aab39e11edf599bac7c6e04977`.
- Initial worktree was clean. `.golden/manifest.json` is not modified by this task.
- Only production-code path changed: `scripts/golden/play.mjs`, and only the pin-validation block. No files outside the card scope were changed.

## Implementation

The old literal commit/archive/tree comparisons have been removed. Validation now reads the fields from `.golden/manifest.json` and fails with named diagnostics unless all required conditions hold:

- `repository` is exactly `Creative36711/campaign-1`.
- `commit` is 40 hexadecimal characters, and `url` exactly equals the codeload prefix plus that commit.
- `sha256` is 64 hexadecimal characters; `tree.archive_sha256` exactly equals it; `tree.sha256` is 64 hexadecimal characters.
- `size_bytes` is a positive safe integer.
- `.golden/karkas/manifest.json` exists as a file.

The browser runner performs this guard before starting Vite/Chromium. The existing importer and `playthrough:golden` continue to verify that the extracted tree matches the manifest; neither was changed. There is no environment variable or flag that bypasses validation.

## Import and browser results

- `npm ci`: rc=0. npm reported 4 dependency audit findings (1 moderate, 1 high, 2 critical); no audit fix was applied.
- `npm run golden:import`: rc=0; imported commit `4783665b04b9ea703cbdfc0bd10cc2b1263caf83`; archive 188,670,372 bytes, SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; tree 1,291 files / 32 directories / 192,491,897 bytes, SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`. The importer left the manifest unchanged.
- `GOLDEN_TASK=GOLD-1.9 npm run golden:play`: **rc=0**; validation passed and Chromium `131.0.6778.0` started. The route completed through the first clue: 6 checkpoints; `projectJson404Count=0`; HTTP errors=0, page errors=0, console errors=0, request failures=0, empty backgrounds=0; clue found. At `03-gate`, HTTP errors=0 and optional `project.json` 404s=0. Reported game-time metric was 180 observed minutes against a 60-minute target.
- `npm run playthrough:golden`: **rc=1**, first failing step `06-before-save`: `No pre-save autosave found at narthex:save:b7305faa-8e10-4d26-96bb-f1b5ed5e493f` (the out-of-scope GOLD-1.6d save-state defect; not fixed here). Before that step, import rc=0 with verified tree-cache hit; audit rc=0 / 0 errors / 0 warnings / 3 info; source cf-play rc=0 / 0 errors / 0 warnings; unpacked-kit cf-play rc=0 and source-matching. The browser reached 7 checkpoints through the first clue with 0 observed HTTP/project.json 404s, 0 page errors, 0 console errors, and 0 empty backgrounds. The integrated runner did not emit a final browser summary because the save-state step failed; this run is recorded as failed, not passed.

## Negative validation cases

Disposable manifest copies in `/tmp` were tested against the same validation block; each returned rc=1 with a matching, specific diagnostic. No temporary manifest replaced the tracked `.golden/manifest.json`.

| Case | Result |
|---|---|
| Wrong repository | rc=1; reports required repository. |
| Valid 40-hex commit with a URL for a different commit | rc=1; reports URL must match `manifest.commit`. |
| Malformed commit | rc=1; reports 40-hex requirement. |
| Malformed archive SHA-256 | rc=1; reports 64-hex requirement. |
| `tree.archive_sha256` differs from `sha256` | rc=1; reports equality requirement. |
| Malformed `tree.sha256` | rc=1; reports 64-hex requirement. |
| `size_bytes=0` | rc=1; reports positive-integer requirement. |
| Fractional `size_bytes` | rc=1; reports positive-integer requirement. |
| Missing `.golden/karkas/manifest.json` | rc=1; reports missing imported manifest and directs to `npm run golden:import`. |

## cf-play and unpacked kit gate

- `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden`: rc=0; 10 scenes, 8 locations, 6 dialogues, 21 Ink nodes; 0 errors, 3 existing warnings.
- `npm run pack:ai-kit` completed; after extracting its ZIP, the packaged `cf-play.mjs check` on the same reference campaign returned rc=0 and byte-for-byte identical output to the published bundle check (same counts and warnings).
- `npm run check:playkit-bundle`: rc=0 after restoring lockfile-pinned dependencies with `npm ci`; bundle SHA-256 `d7e7973b397200492a8e764e0857d90fd37bd1db4a78f8bf46325a403172a908`. A first attempt while temporary browser packages were installed reported a mismatch; after `npm ci`, the check passed. No `public/ai` file was changed.

## Integrity and artifacts

- `rg` confirmed none of the old commit/archive/tree literals remain in `scripts/golden/play.mjs`.
- `git diff -- .golden/manifest.json` is empty; the importer-created `.golden/karkas/` remains ignored.
- The GOLD-1.9 log is JSONL at `_tools/reports/GOLD-1.9.log` (71 lines at report creation), including the route events, negative-case results, and integrated-run failure evidence.
## PR CI

- PR #155: https://github.com/Creative36711/narthex/pull/155; CI-tested head `7f6d92dfbcf031dba3674d43f351a2e4fc7674b0`, base `main`.
- `golden-playthrough` run [40958158084](https://github.com/Creative36711/narthex/actions/runs/40958158084/job/123743634100): **failure** in step “Run golden import, audit, playkit and browser save/load”; setup, project install, cache, and Chromium install passed; evidence-artifact upload passed. `gh run view --log` returned EOF from the Actions results host, so the exact substep is unavailable here. Local `playthrough:golden` result above identifies its first failed step as `06-before-save` (missing pre-save autosave).
- `visual` run [40958158126](https://github.com/Creative36711/narthex/actions/runs/40958158126/job/123743634564): **failure** at “Проверить свежесть бандла аудита до сборки”; later visual/browser checks were skipped. No `public/ai` file was changed.
- Both PR checks are recorded as failures, not passes. Post-merge push CI results are included in the final response.
