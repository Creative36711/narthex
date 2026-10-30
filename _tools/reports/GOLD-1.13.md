# GOLD-1.13 — Protected-path audit against `59410b9`

**Disposition:** 13 unauthorized protected-path changes reverted to the exact baseline; 9 existing changes retained under the applicable freeze/sanction recorded below. The unchanged golden playthrough passes with the retained save adapter. The retained adapter is an explicit decision-interpretation assumption, not a new Master decision.

- **Branch:** `arena/e3143b46-narthex`
- **Baseline:** `59410b9ffd9e165cfd1cd0be818be907743f5897`
- **Audited starting HEAD:** `177cbfed0d39d1870b9e39f98a294d81367ecc84`
- **Pinned campaign (read-only):** `Creative36711/campaign-1@4783665b04b9ea703cbdfc0bd10cc2b1263caf83`

## Inventory and diff result

The protected-path comparison before rollback contained **22 changed files** and `18,917` insertions / `9,595` deletions. Final counts: **changed: 22; reverted: 13; retained as sanctioned/frozen: 9**. Of those:

- **13 reverted** to the `59410b9` versions: 5 `src/core` files, all 7 changed `src/player` files, and `packs/state-ui/probe.mts`.
- **9 retained unchanged as sanctioned/frozen exceptions:** `src/core/savemigrate.ts` plus the 7 frozen `scripts/golden/**` files and frozen `public/ai/campaign-audit.mjs` (1 path in the rollback surface; 8 additionally frozen paths).
- No changed files were present under `assets/save/autosave/**` or `docs/contracts/**`.

The resulting protected-scope diff is **not literally empty**: `git diff 59410b9 HEAD -- src/core src/player assets/save/autosave packs docs/contracts` contains only `src/core/savemigrate.ts` (788 additions / 2 deletions versus baseline). This is the sole exception, retained under the documented GOLD-1.6c interpretation below. Every other path in that command's scope is byte-for-byte at baseline. The 8 additionally frozen paths were not edited.

## Decision interpretation

**Explicit assumption applied for this audit:** I treat the accepted Master decision [`docs/decisions/GOLD-1.6c.md`](../../docs/decisions/GOLD-1.6c.md) as a valid sanction to preserve the existing `src/core/savemigrate.ts` state. That decision explicitly freezes protected autosave/save-load code in `src/core/**` and directs that the protected-path golden failure be documented rather than “fixed” by changing frozen runtime code. The later GOLD-1.6d report is cited only as evidence of the harness/runtime key alignment; it is not treated as an independent Master sanction. The assumption is limited to this save/load implementation and does not sanction the unrelated engine, loader, UI, or pack changes reverted below. No new approval or norm is created in this report.

The strict-baseline control confirms the consequence: with `savemigrate.ts` restored to `59410b9`, the unchanged runner exits 1 at `06-before-save`, looking for `chronicle-forge:save:b7305faa-8e10-4d26-96bb-f1b5ed5e493f`, while the baseline save adapter emits `narthex:save:*`. With `savemigrate.ts` left unchanged from the audited branch, the frozen runner passes. The runner/oracle was not altered to obtain that result.

## Why introduced

Commit `2344bcf` is titled “GOLD-1: ScriptCat 1.4.88 + import/campaign-1 + .gitignore” and bundles the runtime/UI changes listed below with the importer/pin work. The specific rationale for most of those runtime/UI rewrites is not recorded in that commit message. GOLD-1.1 variant A authorizes the campaign pin/archive checksum only; it is not relied on as authorization for these code changes. The state-ui probe rewrite arrived in merge commit `492399f`; no applicable sanction was found for that probe change. These changes were therefore rolled back.

The later golden-harness changes have distinct recorded purposes: GOLD-1.2 added the first-clue browser route; GOLD-1.4 added save/load verification; GOLD-1.6 assembled the playthrough; GOLD-1.6d aligned its expected storage key; GOLD-1.9 read the pin from the manifest; GOLD-1.10 validated the pin and proved three endings; and GOLD-1.11 added the real-time soak. The current task and the accepted GOLD-1.6c freeze prohibit rewriting those probes or the external audit bundle, so they remain unchanged. Their prior reports remain the evidence for those earlier probes.

## Per-file audit

| File | Commit(s) introducing the baseline diff | Change relative to `59410b9` | Verdict | Sanction / basis |
|---|---|---|---|---|
| `src/core/combat.ts` | `2344bcf` | Replaced the `EngineCtx`/`PRNG` boundaries with concrete `GameEngine` references. | **Reverted** | No sanction found for this refactor; GOLD-1.1 variant A is pin-only. |
| `src/core/conditions.ts` | `2344bcf` | Changed condition evaluators from `EngineCtx` to concrete `GameEngine`. | **Reverted** | No sanction found for this runtime change. |
| `src/core/dialogue.ts` | `2344bcf` | Added a 441-line Ink/dialogue runtime module. | **Reverted** | No sanction found for adding this implementation in the protected path. |
| `src/core/engine.ts` | `2344bcf` | Replaced the modular `GameEngine`/`PackHost` implementation with a large inlined engine; removed module and pack-host integration. | **Reverted** | No sanction found for this engine rewrite; the campaign-pin decision does not cover it. |
| `src/core/loader.ts` | `2344bcf` | Removed explicit manifest-order arrays and changed rule/encounter loading and warning handling. | **Reverted** | No sanction found; baseline loader semantics restored. |
| `src/core/savemigrate.ts` | `2344bcf` | Replaced the save-module barrel export with a 788-line migration/repair implementation, including `chronicle-forge:save:*` keys and manual-slot handling. | **Retained — sanctioned under the stated assumption** | Accepted Master decision `GOLD-1.6c` explicitly freezes protected autosave/save-load in `src/core/**`. GOLD-1.6d records the runner-key alignment, but is not relied upon as a separate sanction. Strict rollback fails at `06-before-save`; see control run in the log. |
| `src/player/DialogueOverlay.tsx` | `2344bcf` | Replaced the shared dialogue-audio hook with locally managed audio/TTS playback and timing. | **Reverted** | No sanction found for this UI/runtime rewrite. |
| `src/player/GameView.tsx` | `2344bcf` | Removed player-pack/FMV session integration and the asset-failure fallback handler. | **Reverted** | No sanction found for removing these integrations. |
| `src/player/HelpPanel.tsx` | `2344bcf` | Rebranded the help text and changed the advertised save extension from `.nxsave` to `.cfsave`. | **Reverted** | No sanction found for this product/UI change. |
| `src/player/MainMenu.tsx` | `2344bcf` | Rebranded the menu and narrowed accepted campaign/save extensions to Chronicle Forge formats. | **Reverted** | No sanction found for this product/UI change. |
| `src/player/MapScreen.tsx` | `2344bcf` | Changed the map-label storage key and removed failed-image fallback handling. | **Reverted** | No sanction found for these runtime/UI changes. |
| `src/player/NoCampaignScreen.tsx` | `2344bcf` | Rebranded the empty-campaign screen and narrowed import extensions. | **Reverted** | No sanction found for this product/UI change. |
| `src/player/SceneScreen.tsx` | `2344bcf` | Inlined scene foreground/navigation/item/intro UI and changed the missing-background notice behavior. | **Reverted** | No sanction found for this UI rewrite. |
| `packs/state-ui/probe.mts` | `492399f` | Replaced the existing Ash-of-Caerden state-ui probe with a Stone Tablet Siege/Chromium route and a shorter `cf-play` assertion. | **Reverted** | No applicable Master sanction found; GOLD-1.1 variant A does not authorize pack-probe changes. |
| `public/ai/campaign-audit.mjs` | `2344bcf` | Rebuilt/replaced the checked-in external campaign-audit bundle (8,182 additions / 8,802 deletions). | **Retained unchanged — frozen** | Explicitly named by accepted Master freeze `GOLD-1.6c` and additionally frozen for this task; no bundle refresh performed. |
| `scripts/golden/endings.mjs` | `8b3793b`, `3443e53` | Added the three-ending browser proof, then extended it with manifest-pin validation. | **Retained unchanged — frozen** | `GOLD-1.6c` names `scripts/golden/**` as protected, and this task explicitly freezes the path; preserve the GOLD-1.10 proof and its prior report. |
| `scripts/golden/manifest-pin-smoke.mjs` | `3443e53` | Added negative/smoke coverage for manifest pin validation. | **Retained unchanged — frozen** | `GOLD-1.6c` protected-path freeze plus this task's no-write scope; GOLD-1.10 evidence. |
| `scripts/golden/manifest-pin.mjs` | `3443e53` | Added manifest-pin validation helpers. | **Retained unchanged — frozen** | `GOLD-1.6c` protected-path freeze plus this task's no-write scope; GOLD-1.10 evidence. |
| `scripts/golden/play.mjs` | `3071605`, `e27beb9`, `c1d7a6f`, `1159858`, `853e05d` | Added the browser route, save/load assertions, manifest pin, and the `chronicle-forge:save:*` harness expectation. | **Retained unchanged — frozen** | `GOLD-1.6c` protected-path freeze plus this task's no-write scope; prior GOLD-1.2/1.4/1.6/1.6d/1.9 records. |
| `scripts/golden/playthrough-golden.mjs` | `c1d7a6f` | Orchestrates import, audit, source/kit `cf-play`, and browser save/load. | **Retained unchanged — frozen** | `GOLD-1.6c` protected-path freeze plus this task's no-write scope; prior GOLD-1.6 record. |
| `scripts/golden/save-load.mjs` | `e27beb9` | Added the save/load runner entry point. | **Retained unchanged — frozen** | `GOLD-1.6c` protected-path freeze plus this task's no-write scope; prior GOLD-1.4 record. |
| `scripts/golden/soak.mjs` | `177cbfe` | Added the one-hour real-time browser soak with checkpoints and persistence checks. | **Retained unchanged — frozen** | `GOLD-1.6c` protected-path freeze and this task's explicit GOLD-1.11 no-rewrite constraint; prior GOLD-1.11 record. |

## Verification

`npm run playthrough:golden` passed in an isolated detached worktree with the 13-file rollback applied and `src/core/savemigrate.ts` unchanged from branch HEAD. The source patch was hash-compared with the audited checkout; the source-diff SHA-256 was `5ea3f7831549249cffc59cbf594ffeb4e0f3f7eefa3b1196516288814f82c7af`. The isolated worktree was used so the importer would not leave `.golden/karkas` in the primary checkout; the primary checkout's `.golden/` contains only its original manifest.

- Run ID: `48aa5feb-aad5-4728-9fe1-8828c9f17260`; command exit code **0**; total duration **49.316 s**.
- Audit: **0 errors / 0 warnings**.
- Source and unpacked-kit `cf-play`: **12 scenes**, **0 errors / 0 warnings**, parity matched.
- Browser route: first clue found at **120 in-game minutes** against the unchanged **60-minute minimum**; required flags survived save, reload/Continue, and manual-slot load with **0 discrepancies** (`потерь нет`). Browser duration **39.89 s**; page errors **0**, console errors **0**, HTTP errors **0**, request failures **0**, empty backgrounds **0**.
- The strict-baseline control (run `c33783f0-65ec-45ec-ad0d-e9d5b981e6df`) failed at `06-before-save` on the key mismatch documented above. It did not change the frozen runner or oracle.
- The 12-scene expectation, the three-ending proof, and the 60-minute soak/route thresholds were not edited. The existing GOLD-1.10 and GOLD-1.11 evidence remains intact; no oracle value changed, so no Rework request was made.
- Archive SHA-256: `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; verified tree SHA-256: `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`.

Full structured runner evidence (including the strict-baseline control) is in [`_tools/reports/GOLD-1.13.log`](GOLD-1.13.log). No `docs/decisions/GOLD-1.13.md` was created: this report records the stated interpretation of existing `GOLD-1.6c`; it does not create a new decision. No §2, ADR GOLD-1.6c, campaign source, manifest, Notion card, or Drive content was modified.
