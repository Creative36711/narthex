# GOLD-1.7 — recognize simple scene flag reads

**Date:** 2026-10-29
**Branch:** `arena/30abd3ef-narthex`
**Base:** `93a749699de92104162a14b946558c77d7375ca4` (`origin/main` at preflight)

## Scope and implementation

`walkCampaign` now counts non-empty simple `condition.flag` and `condition.not_flag` fields as reads, but only on scene states and slots, where `evalSceneCondition` consumes those fields. Existing typed reads (`flag_set`, `flag_not_set`) remain supported. No campaign author text or engine code changed.

Added `scripts/playkit/analyze-flags.smoke.mts` to cover positive simple and typed reads and a negative write-only flag. Updated the three Ash expected-warning outputs in `scripts/check-guide.mts` from 8 to 3 because the analyzer now recognizes five genuine reads; the remaining three unread flags still warn. Regenerated only `public/ai/cf-play.mjs` with `npm run build:playkit-bundle`.

## Baseline and result

Pre-change measurements from this checkout:

| Campaign | Errors | Warnings | Scenes / locations / dialogues / Ink knots | Flags written/read | Coverage |
|---|---:|---:|---|---|---|
| `.golden/karkas` | 0 | 3 | 12 / 5 / 11 / 118 | 176 / 173 | 4 / 12 |
| `public/campaigns/ash-of-caerden` | 0 | 8 | 10 / 8 / 6 / 21 | 29 / 21 | 6 / 10 |

After the change, source and rebuilt bundle agree:

| Campaign | Errors | Warnings | Scenes / locations / dialogues / Ink knots | Flags written/read | Coverage |
|---|---:|---:|---|---|---|
| `.golden/karkas` | 0 | 0 | 12 / 5 / 11 / 118 | 176 / 176 | 4 / 12 |
| `public/campaigns/ash-of-caerden` | 0 | 3 | 10 / 8 / 6 / 21 | 29 / 26 | 6 / 10 |

The three Karkas false positives resolved are `case136_read` (`scenes/scene_archive.json#/states/1/condition/flag`), `shaft_roped` (`scenes/scene_pump_shaft.json#/states/1/condition/flag`), and `vein_hidden` (`scenes/scene_face.json#/slots/1/condition/not_flag`). Ash's five newly recognized reads are `guard_ration_taken`, `herbs_gathered`, `medallion_taken`, `skeleton_looted`, and `wrench_taken`, each in a scene/slot simple condition. Its remaining warnings are `market_raid_repelled`, `raid_rumors`, and `tavern_chest_opened` (`flag_written_never_read`). No errors were introduced; Ash coverage remains 6/10.

The smoke test passes and confirms the negative write-only fixture still reports: `флаг «write_only_fixture» выставляется, но нигде не читается` (`flag_written_never_read`).

## Checks

- `npx tsx scripts/playkit/analyze-flags.smoke.mts`: **rc=0**.
- `npm run build:playkit-bundle`: **rc=0**.
- `npm run check:playkit-bundle`: **rc=0**, rebuilt bundle is 1,231,022 bytes; SHA-256 `d7e7973b397200492a8e764e0857d90fd37bd1db4a78f8bf46325a403172a908`.
- Source and bundle Karkas checks: **rc=0**, 0 errors / 0 warnings for both.
- Source and bundle Ash checks: **rc=0**, 0 errors / 3 warnings for both.
- `npm run check:guide`: **rc=0**; 6 commands, explain=28, Ash 10/8/6/21, 0/3, 5 deaths, coverage 6/10. Its expected warning count was updated to match the corrected analyzer output.
- `npm run check:pack-boundary`: **rc=0**.
- `npm run check:narrative-codes`: **rc=0**, 28 codes.
- `npm run check:contracts`: **rc=1**, with one existing unrelated assertion: `featureOn реализован в caps.ts, а не в types.ts`. The protected `src/core/**` and shared types were not changed.
- `npm run check:audit-bundle`: **rc=1** on the separate, frozen `public/ai/campaign-audit.mjs`: committed 981,858 bytes / SHA-256 `1348888ef4974477e0b50f04833a6c1b11dfb1a8f3e7b53cc9e3b11071929a7a`; generated 981,858 bytes / SHA-256 `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`; first difference byte 145,633. It was not rebuilt or changed, per the accepted GOLD-1.6c freeze.

The frozen audit-bundle check cannot be made rc=0 without changing a specifically protected artifact. The separate contracts assertion also predates this analyzer-only diff. Both actual rc=1 results are recorded as failures, not passes; no thresholds/checks were weakened. Per the previously accepted scope decision, preserve the freeze and carry these unrelated red checks transparently into the PR evidence.

## Golden and protected-path audit

- `.golden/manifest.json` SHA-256 remains `d74c775a50400b3c9e9c707d65e26de63cb2f1f513a84b3163b141b1449f21aa`; `.golden/karkas` remains 1,290 files. Analyzer output was directed to temporary paths and generated `.cf-play` sidecars were removed.
- No changes to `src/core/**`, `src/player/**`, `packs/**`, `docs/contracts/**`, `public/campaigns/**`, `.golden/**`, `.golden/manifest.json`, or `public/ai/campaign-audit.mjs`.
- Actual starting `public/ai/cf-play.mjs` in this checkout was 1,230,196 bytes, SHA-256 `fe1e70c5c8efae8dbd5181ecca0bfcf4752ea1188131c4fe88794ce53ff2befa`. The task note's starting size/hash (`1,070,995` / `87f77ead…`) did not match this checkout. Likewise, pre-change `npm run check:guide` actually returned rc=0 here, rather than the noted rc=1. The observed checkout values are reported without rewriting the original note.

## PR and merge

Pending. Update this section with the explicit PR number, actual CI results, merge SHA, and main-push run before finalizing.

## Artifacts

- Report: `_tools/reports/GOLD-1.7.md`
- JSONL log: `_tools/reports/GOLD-1.7.log` (at least 20 valid records)
- Related GOLD-1.6c report: `_tools/reports/GOLD-1.6c.md`
