# GOLD-1.13 — execution record for the protected-path audit

This file records implementation of the GOLD-1.13 audit task. It is **not a new Master sanction**, does not change §2 or ADR GOLD-1.6c, and does not establish a continuing exception for any protected path.

- Dispatch: `4096f0cf-5705-8168-afb1-f12b695c3b7c`
- Run: `223c2400-5c6c-485b-aead-3d73923ff2b1`
- Baseline: `59410b9ffd9e165cfd1cd0be818be907743f5897`
- Follow-up branch base: `b07728e09c0ba8f67411b04c231bc235ef2b75c2`

## Audit disposition

The original protected/frozen audit set contained 22 changed files. Fourteen were restored to the exact baseline: 13 had already been restored by PR #159, and this follow-up restored the remaining `src/core/savemigrate.ts`. Eight pre-existing diffs remain frozen: the seven `scripts/golden/**` files and `public/ai/campaign-audit.mjs`.

The surviving baseline diffs are permitted by the accepted Master decision `GOLD-1.6c`, which explicitly freezes the golden harness and external audit bundle. `GOLD-1.6c` is **not** used as permission to retain `src/core/savemigrate.ts`; this task restores that file to `59410b9` as expressly required.

## Narrow harness correction

The baseline engine uses `narthex:save:*` and `narthex:meta:*` (`src/core/save/keys.ts`, `src/core/meta.ts`); the baseline `src/core/savemigrate.ts` is the save-module barrel. Three pre-existing harness scripts expected `chronicle-forge:*`. Under the specific GOLD-1.13 Scope permission for harness-key repair, only those constants were aligned:

- `scripts/golden/play.mjs`: autosave and manual-slot key prefixes.
- `scripts/golden/endings.mjs`: save and meta key prefixes.
- `scripts/golden/soak.mjs`: runtime save key prefix.

No scenario/probe logic, assertion, route, flag, timeout, threshold, or oracle value changed. The harness edits do not expand the GOLD-1.6c freeze and do not authorize further edits to these paths.

## Verification

`npm run playthrough:golden` exited 0 in an isolated temporary worktree. Run `682298b5-494c-4d9d-8207-34a8530c7e72`: audit 0/0; source and unpacked-kit `cf-play` 12 scenes, 0/0; browser clue found; save/load `потерь нет`; page errors 0; empty backgrounds 0. The required console output is in `_tools/reports/GOLD-1.13.log`.

The per-file provenance, sanctions, complete test result, and merge-push CI record are maintained in `_tools/reports/GOLD-1.13.md`.
