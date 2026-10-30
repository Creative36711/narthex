# GOLD-1.13 — protected-path audit against `59410b9`

**Disposition:** Reverted every unauthorized change in the rollback surface to the exact `59410b9` tree. The seven `scripts/golden/**` files and `public/ai/campaign-audit.mjs` remain under the explicit GOLD-1.6c freeze; only three golden-runner storage-key constants were corrected as permitted by this task. No save/load runtime change or probe/oracle change is retained.

- **Branch:** `arena/59fabbd4-narthex`
- **Starting HEAD for this follow-up:** `b07728e09c0ba8f67411b04c231bc235ef2b75c2` (merged PR #159)
- **Baseline:** `59410b9ffd9e165cfd1cd0be818be907743f5897`
- **Original audited snapshot:** `177cbfed0d39d1870b9e39f98a294d81367ecc84`
- **Pinned campaign (read-only):** `Creative36711/campaign-1@4783665b04b9ea703cbdfc0bd10cc2b1263caf83`
- **Current run:** dispatch `4096f0cf-5705-8168-afb1-f12b695c3b7c`; run `223c2400-5c6c-485b-aead-3d73923ff2b1`

## Inventory and final diff

The original protected/frozen-path audit at `177cbfe` contained **22 changed files** (18,917 insertions / 9,595 deletions). The previous follow-up PR #159 had already restored 13 of them before this branch started. At `b07728e`, only `src/core/savemigrate.ts` still differed within the rollback surface; this run restored it byte-for-byte from `59410b9`.

| Count | Result |
|---|---|
| Protected files changed in the original audit set | **22** |
| Restored to `59410b9` (13 by PR #159; `savemigrate.ts` in this PR) | **14** |
| Retained by an explicit existing freeze/sanction | **8** — seven `scripts/golden/**` files and `public/ai/campaign-audit.mjs` |
| Final diff in `src/core`, `src/player`, `assets/save/autosave`, `packs`, `docs/contracts` | **0 files** |
| Additional frozen-path diff remaining versus `59410b9` | **8 files**, individually described below |
| Golden harness files with the current, scope-authorized key-only repair | **3** (`play.mjs`, `endings.mjs`, `soak.mjs`) |

Confirmed at current `HEAD`: `git diff 59410b9 HEAD -- src/core src/player assets/save/autosave packs docs/contracts` is empty. None of the eight additionally frozen paths was rolled back; the three harness edits only change the storage-key prefix from `chronicle-forge` to the baseline engine's `narthex` keys. The original table below records the introduced protected-path changes and the current disposition of each.

`package.json` differs from the baseline because of earlier project metadata and golden-command additions. It is outside the protected-path count, was not changed in this follow-up, and already provides `playthrough:golden`; no package edit was needed.

## Why introduced

- Commit `2344bcf` (“GOLD-1: ScriptCat 1.4.88 + import/campaign-1 + .gitignore”) bundled the protected core/player rewrites and the external campaign-audit bundle with importer/pin work. Its message does not record a distinct rationale for the runtime/UI rewrites. GOLD-1.1 variant A authorizes the campaign pin/archive checksum only, not these code changes. Those changes without an applicable sanction were restored to baseline.
- The `packs/state-ui/probe.mts` rewrite arrived in merge commit `492399f`; no applicable Master sanction was found, so it was restored too.
- The historical golden harness files were introduced for their named proofs: GOLD-1.2 first-clue route; GOLD-1.4 save/load; GOLD-1.6 end-to-end orchestration; GOLD-1.6d save-key expectation; GOLD-1.9 manifest pin; GOLD-1.10 manifest validation and three endings; GOLD-1.11 real-time soak. Their retained baseline diffs are covered by the accepted GOLD-1.6c freeze. This follow-up changes only three key constants because the current GOLD-1.13 Scope explicitly allows harness-key repair to match the engine after rollback. Route steps, persistence assertions, thresholds, flags, and oracle values were not changed.
- The earlier `savemigrate.ts` implementation was part of the GOLD-1 bundle, but GOLD-1.6c is **not** treated here as a sanction to keep it different from `59410b9`. GOLD-1.6c's no-touch direction applied to that task; this follow-up explicitly orders baseline restoration in `src/core/**`. The source is restored, not retained by exception.

## Per-file audit

| File | Commit(s) introducing the baseline diff | Change relative to `59410b9` | Verdict | Sanction / basis |
|---|---|---|---|---|
| `src/core/combat.ts` | `2344bcf` | Replaced the `EngineCtx`/`PRNG` boundaries with concrete `GameEngine` references. | **Rolled back** (PR #159) | No sanction found; GOLD-1.1 variant A is pin-only. Verified at baseline in this follow-up. |
| `src/core/conditions.ts` | `2344bcf` | Changed condition evaluators from `EngineCtx` to concrete `GameEngine`. | **Rolled back** (PR #159) | No sanction found for this runtime change; verified at baseline. |
| `src/core/dialogue.ts` | `2344bcf` | Added a 441-line Ink/dialogue runtime module. | **Rolled back** (PR #159) | No sanction found for this protected-path implementation; verified at baseline. |
| `src/core/engine.ts` | `2344bcf` | Replaced the modular `GameEngine`/`PackHost` implementation with a large inlined engine and removed module/pack-host integration. | **Rolled back** (PR #159) | No sanction found for this engine rewrite; verified at baseline. |
| `src/core/loader.ts` | `2344bcf` | Removed explicit manifest-order arrays and changed rule/encounter loading and warning handling. | **Rolled back** (PR #159) | No sanction found; baseline loader semantics restored. |
| `src/core/savemigrate.ts` | `2344bcf` | Replaced the save-module barrel export with a 788-line migration/repair implementation, including `chronicle-forge:save:*` keys and manual-slot handling. | **Rolled back to `59410b9` in this PR** | No permission to retain this source diff. GOLD-1.6c is not cited as a sanction; the current GOLD-1.13 scope requires the exact baseline. |
| `src/player/DialogueOverlay.tsx` | `2344bcf` | Replaced the shared dialogue-audio hook with locally managed audio/TTS playback and timing. | **Rolled back** (PR #159) | No sanction found for this UI/runtime rewrite; verified at baseline. |
| `src/player/GameView.tsx` | `2344bcf` | Removed player-pack/FMV session integration and the asset-failure fallback handler. | **Rolled back** (PR #159) | No sanction found for removing these integrations; verified at baseline. |
| `src/player/HelpPanel.tsx` | `2344bcf` | Rebranded help text and changed the advertised save extension from `.nxsave` to `.cfsave`. | **Rolled back** (PR #159) | No sanction found for this product/UI change; verified at baseline. |
| `src/player/MainMenu.tsx` | `2344bcf` | Rebranded the menu and narrowed accepted campaign/save extensions to Chronicle Forge formats. | **Rolled back** (PR #159) | No sanction found for this product/UI change; verified at baseline. |
| `src/player/MapScreen.tsx` | `2344bcf` | Changed the map-label storage key and removed failed-image fallback handling. | **Rolled back** (PR #159) | No sanction found for these runtime/UI changes; verified at baseline. |
| `src/player/NoCampaignScreen.tsx` | `2344bcf` | Rebranded the empty-campaign screen and narrowed import extensions. | **Rolled back** (PR #159) | No sanction found for this product/UI change; verified at baseline. |
| `src/player/SceneScreen.tsx` | `2344bcf` | Inlined scene foreground/navigation/item/intro UI and changed missing-background notice behavior. | **Rolled back** (PR #159) | No sanction found for this UI rewrite; verified at baseline. |
| `packs/state-ui/probe.mts` | `492399f` | Replaced the Ash-of-Caerden state-ui probe with a Stone Tablet Siege/Chromium route and a shorter `cf-play` assertion. | **Rolled back** (PR #159) | No applicable Master sanction found; GOLD-1.1 variant A does not authorize a pack-probe change. |
| `public/ai/campaign-audit.mjs` | `2344bcf` | Rebuilt/replaced the checked-in external campaign-audit bundle (8,182 additions / 8,802 deletions). | **Retained, unchanged — sanctioned/frozen** | Accepted Master decision `GOLD-1.6c` explicitly names this bundle. It was not edited or refreshed in this follow-up. |
| `scripts/golden/endings.mjs` | `8b3793b`, `3443e53` | Added the three-ending browser proof and manifest-pin validation. Current repair changes only `SAVE_KEY` / `META_KEY` to `narthex:*`. | **Retained — sanctioned/frozen; key-only repair** | Existing diff: accepted `GOLD-1.6c` freeze. Key constants only: explicitly allowed by current `GOLD-1.13` Scope; no ending route or assertion change. |
| `scripts/golden/manifest-pin-smoke.mjs` | `3443e53` | Added negative/smoke coverage for manifest-pin validation. | **Retained, unchanged — sanctioned/frozen** | Accepted `GOLD-1.6c` freeze and task's additional frozen-path scope; no edit in this follow-up. |
| `scripts/golden/manifest-pin.mjs` | `3443e53` | Added manifest-pin validation helpers. | **Retained, unchanged — sanctioned/frozen** | Accepted `GOLD-1.6c` freeze and task's additional frozen-path scope; no edit in this follow-up. |
| `scripts/golden/play.mjs` | `3071605`, `e27beb9`, `c1d7a6f`, `1159858`, `853e05d` | Added browser route, save/load assertions, and manifest pin. Current repair changes only autosave/manual-slot key prefixes to `narthex:save:*`. | **Retained — sanctioned/frozen; key-only repair** | Existing diff: accepted `GOLD-1.6c` freeze. Key constants only: explicitly allowed by current `GOLD-1.13` Scope; no route, persistence assertion, or oracle change. |
| `scripts/golden/playthrough-golden.mjs` | `c1d7a6f` | Orchestrates import, audit, source/kit `cf-play`, and browser save/load. | **Retained, unchanged — sanctioned/frozen** | Accepted `GOLD-1.6c` freeze; GOLD-1.6 evidence. No edit in this follow-up. |
| `scripts/golden/save-load.mjs` | `e27beb9` | Added the save/load runner entry point. | **Retained, unchanged — sanctioned/frozen** | Accepted `GOLD-1.6c` freeze; GOLD-1.4 evidence. No edit in this follow-up. |
| `scripts/golden/soak.mjs` | `177cbfe` | Added the one-hour real-time browser soak with checkpoints and persistence checks. Current repair changes only the runtime save-key prefix to `narthex:save:*`. | **Retained — sanctioned/frozen; key-only repair** | Existing diff: accepted `GOLD-1.6c` freeze and GOLD-1.11 no-rewrite constraint. Key-only correction is allowed by current `GOLD-1.13` Scope; no soak duration, checkpoint, route, or threshold change. |

## Verification

The exact command `npm run playthrough:golden` exited **0** in an isolated temporary worktree carrying this follow-up's source rollback and key-only harness repair. Isolation kept `.golden/karkas` out of the assigned checkout; the root `.golden` remained unchanged. The runner reported:

- **Run:** `682298b5-494c-4d9d-8207-34a8530c7e72`; total **53.603 s**; browser **42.336 s**.
- **Audit:** **0 errors / 0 warnings**.
- **Source and unpacked-kit `cf-play`:** **12 scenes**, **0 errors / 0 warnings**, parity matched.
- **Browser:** clue found; unchanged target remains **60 in-game minutes** (observed **180**); save/reload/Continue/manual-slot load verdict `потерь нет`, **0 discrepancies**; `pageerror=0`, `consoleError=0`, `httpError=0`, `requestFailure=0`, `emptyBackgrounds=0`.
- **Pinned input:** archive SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; verified tree SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`.
- No oracle value changed: the 60-minute threshold, 12-scene expectation, three-ending probe, and one-hour soak duration remain unchanged. The independent GOLD-1.10/1.11 probes were not run or rewritten in this task.

Full console output for the required command is saved at [`_tools/reports/GOLD-1.13.log`](GOLD-1.13.log).

### Ancillary decision check

`npm run check:decisions` was also tried in the isolated worktree. It remains red on the pre-existing `Статус:` line in frozen `docs/decisions/GOLD-1.6c.md` (the validator parses `accepted (2026-10-29)...` as an unsupported status). That ADR is unchanged and explicitly out of this task's write scope, so it was not rewritten. The new GOLD-1.13 execution record is statusless and introduced no additional validator issue. This ancillary check is not part of the card's acceptance checks.

## GitHub CI and PR

- **PR:** [#160](https://github.com/Creative36711/narthex/pull/160), from `arena/59fabbd4-narthex` to `main`.
- **PR `golden-playthrough`:** [run 41025938217](https://github.com/Creative36711/narthex/actions/runs/41025938217), event `pull_request`, job `golden-playthrough` **passed** in 1m48s. This is recorded for provenance only; PR-only green does **not** satisfy merge-push acceptance.
- **Separate visual check:** [run 41025938551](https://github.com/Creative36711/narthex/actions/runs/41025938551) failed in `screenshots` at step `Проверить свежесть бандла аудита до сборки` (`npm run check:audit-bundle`). The failed-step log endpoint returned EOF, so no further diagnostic is asserted. This is the already documented frozen-bundle freshness issue under `GOLD-1.6c`; the frozen external bundle was not edited. This check is outside the GOLD-1.13 golden-playthrough acceptance. GitHub currently reports the PR as `UNSTABLE` because of this separate failure.
- **Actual merge-commit push:** pending. It will be checked after squash merge; no PR result or local replay is substituted for that push run.

No §2 text, ADR GOLD-1.6c, campaign source, manifest, external audit bundle, Notion card, or Drive content was modified. `docs/decisions/GOLD-1.13.md` is an execution record only; it does not create a new sanction or amend an existing decision.
