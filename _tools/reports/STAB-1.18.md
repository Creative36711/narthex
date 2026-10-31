# STAB-1.18 — follow-up verification report

- Dispatch: `40a6f0cf-5705-812d-8a6a-cf0f489c5af7`
- Run: `8d357598-1a32-4860-a4d5-3868aaa320df`
- Branch: `arena/202671b0-narthex`
- Follow-up base SHA: `1cecd559624f0dd8805fd76a0350c7e9ce9864fb` (squash merge of PR #183)
- Previous report/run: `ed983a03-a777-4f99-b851-f108f23b6aeb`; its merged module splits and PlayKit rebuild were not repeated.
- Date: 2026-10-31

## Outcome

- `smoke:core`: RC 0, **55/55**. The runner evaluates and counts 55 independent semantic probes and fails if the observed count differs from 55.
- `smoke:mission`: RC 1, **53/55**. The final run executed all 55 probes serially; none was skipped. The only residual failures are `smoke:pack-missing` and `smoke:capability-modes`, both caused by the same three warnings in the protected Ash campaign. Each is fully evidenced below, outside this card's scope, and assigned to STAB-1.19. This is the card's explicitly accepted residual, not a pass claim.
- `check:brand`: RC 1, **86 matches / 28 paths**, down from baseline 113/38. The original 38-path set is traced below: seven earlier smoke paths had their stale labels/expectations refreshed, three unprotected historical STAB reports received transparent text-only cleanup, and each remaining path has an individual §2 protection or task-scope basis. No guard threshold or exclusion changed.
- `check:audit-bundle`: RC 0. The clean canonical build matches protected SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`; current source builds reproduce byte-for-byte and audit JSON agrees.
- `check:decisions`: RC 0 after format-only metadata fixes in the three authorized decision files. `check:browser-gate`: RC 0.
- `check:contracts`: RC 1 at `check:dev-campaigns`, after its contracts, pack, decisions, module-size and browser-gate subchecks passed. It reports two issues under protected `public/campaigns/**` (`ash-of-caerden` title lacks `[DEV]`; `fmv-crossing` lacks `dev-fixture.json`). Those campaign paths are outside this card and were not changed.
- PR #184 was squash-merged to `main` as `24d5d1a41377c7a7b2bbb941e66d28da62c29c62` after the accepted residual analysis. Repository protections allowed the merge even though the visual workflow's contracts step remained red; that failure and the separate green audit-freshness step are recorded below.

## Required gates — baseline versus after

Baseline is the unchanged checkout at the follow-up base SHA, after dependency installation. Mission runs used the temporary Pillow 13 environment at `/tmp/stab118-pillow`; this was outside the repository and allowed pixel probes to run normally.

| Command | Baseline RC — one-line output | After RC — one-line output |
|---|---|---|
| `npm run check:module-size` | `0` — `check:module-size passed` | `0` — `check:module-size passed` |
| `npm run check:brand` | `1` — `✗ найдены следы старого бренда: 113` | `1` — `✗ найдены следы старого бренда: 86` |
| `npm run check:playkit-bundle` | `0` — `✓ public/ai/cf-play.mjs совпадает со сборкой из src (0.8.0, sha256 1815c2812cbb4c89bbac83f4ec1664585f65f03a2738c0c085302bc1ab583a11)` | `0` — `✓ public/ai/cf-play.mjs совпадает со сборкой из src (0.8.0, sha256 1815c2812cbb4c89bbac83f4ec1664585f65f03a2738c0c085302bc1ab583a11)` |
| `npm run smoke:core` | `0` — `все якоря зелёные` (baseline emitted 14 checks; it did not report 55) | `0` — `SUMMARY 55/55 passed; probes=55; rc=0` |
| `npm run smoke:mission` | `1` — `SUMMARY 45/55 passed; rc=1` | `1` — `SUMMARY 53/55 passed; rc=1` |

Also run: `npx tsc -b --pretty false` — RC 0; `git diff --check` — RC 0.

## The ten baseline mission failures: causes and disposition

The baseline had ten failing probes. Eight now pass; two remain red for the protected-campaign reason above. No probe was removed, suppressed, or skipped.

| Baseline failure | Cause | Fix or disposition | After |
|---|---|---|---|
| `smoke:design-doc` | The guard asserted an obsolete package extension and treated two standalone AI tools as members of the reference-kit manifest. | Updated the assertion to the current `.narthex` contract. The guard now requires every declared kit file and recognizes exactly `PLAYKIT.md` and `cf-play.mjs` as standalone tools; it still rejects missing or unexpected files. | Pass |
| `smoke:p2` | The appearance-state rendering logic moved from `SceneScreen.tsx` to `SceneForeground.tsx`; the old path probe no longer observed it, and its fallback assertion was not discriminating. | Pointed the probe to the active module and asserted the concrete forced-state-over-slot-state selection and scene-state lookup. This strengthens rather than removes the behavior check. | Pass |
| `smoke:ai-task` | The default edit bundle is a patch, while the smoke expected a full-package filename and shape. | Made the test explicitly request full scope and assert the current full-task filename; import/reinstall assertions remain. | Pass |
| `smoke:dialogues-r31` | The temporary dialogue campaign expected by the test was absent. | Added a fixture-only dialogue campaign under `scripts/mission-smokes/fixtures/dialogue-encounters/`; the six dialogue-import and runtime assertions remain. | Pass |
| `smoke:dialogues-r32` | The same absent campaign fixture lacked the campaign/world/entities/dialogue data required for the equipment and Vera scenarios. | Reused the permitted fixture, including the needed campaign files, entities, and dialogue data; assertions were retained. | Pass |
| `smoke:breathe-toggle` | Entity types and rendering logic moved to `src/shared/types/entities.ts` and `src/player/SceneForeground.tsx`. | Updated the probe’s read paths only; its breathing defaults, class, and CSS assertions remain. | Pass |
| `smoke:encounters-loader` | The temporary Shepot campaign and encounter-table files were absent. | Added campaign and encounter data to the same permitted fixture; the loader still verifies the three encounter tables. | Pass |
| `smoke:saves-compat` | The Help panel advertises `.nxsave`, but the static probe expected a stale extension. | Updated the probe to the current UI contract; no player code or save format was changed. | Pass |
| `smoke:pack-missing` | `cf-play check` rejects the protected Ash campaign’s three `flag_written_never_read` warnings (`market_raid_repelled`, `raid_rumors`, `tavern_chest_opened`). The test’s historical output expectation of eight warnings also does not match the current report. | No campaign, warning policy, or oracle change: those paths are protected and campaign work belongs to STAB-1.19. | **Fail — owner STAB-1.19** |
| `smoke:capability-modes` | Its capability-mode checks pass, then the final campaign check fails on the same three protected-campaign warnings. | No campaign, warning policy, or oracle change; assign the campaign remediation to STAB-1.19. | **Fail — owner STAB-1.19** |

### Complete residual evidence from the final mission run

Final command: `CHROMA_SMOKE_PYTHON=/tmp/stab118-pillow/bin/python npm run smoke:mission` (RC 1). The runner announced `running 55 smoke scripts serially`, listed an RC for each, and ended `SUMMARY 53/55 passed; rc=1`; all 55 ran and none was skipped. `smoke:core` inside the same run reported `SUMMARY 55/55 passed; probes=55; rc=0`.

- `smoke:pack-missing` first passes the intended missing-pack branch: `PACK_MISSING` and its Studio diagnostic match, and no fixture/save mutation occurs. Its later installed-pack Ash check retains the historical oracle requiring RC 0 and exactly 8 warnings. Current `cf-play check` returns RC 1 because strict warning policy sees exactly 3 `flag_written_never_read` warnings: `market_raid_repelled`, `raid_rumors`, `tavern_chest_opened`. The report has 0 errors, 10 scenes, 8 locations, 6 dialogues, 21 Ink nodes, 5 seeds (all 5 end in death), and 6/10 reachable scenes visited. The failing assertion is the protected campaign's installed-pack check, not the missing-pack behavior.
- `smoke:capability-modes` passes the mode-off checks (saved mode, read-only data retained, and runtime mutations suppressed) before its final Ash check expects RC 0 and receives RC 1 on the same three warnings. No separate capability assertion fails.
- Both residuals read the unchanged `public/campaigns/ash-of-caerden` data and are outside this card's product/data scope. Owner: STAB-1.19. Neither probe was removed, skipped, weakened, or changed to accept an arbitrary RC 1.

Reference/kit parity was checked separately: `npm run pack:ai-kit`, unzip the 109-file version-0.8.0 kit into a temporary directory, then run `cf-play check public/campaigns/ash-of-caerden --seeds 1-5 --steps 300` once with `public/ai/cf-play.mjs` and once with the unpacked kit CLI. Both returned RC 1, `verdict=failed`, 0 errors, the same three warnings, and byte-identical `report.json` (`sameReport=true`); the 10/8/6/21 static counts, 5-seed outcomes, and 6/10 coverage also matched. Temporary archive/unpack/output files were removed.

## Audit-bundle freshness diagnosis

The original raw source-versus-published byte check returned RC 1 after the behavior-preserving module split: current source emitted 1,006,226 bytes (`0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`), while the protected published bundle is 1,002,333 bytes (`b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`). This was a stale freshness model, not a changed protected artifact.

`scripts/check-audit-bundle.mts` now:

1. verifies that the published artifact still has the required protected SHA;
2. extracts the clean pre-split source tree at `0a5abca49ff91daf4b642fb76272dec56a6a778e`, builds it with the installed locked esbuild dependency, and proves its bytes equal the protected artifact exactly (1,002,333 bytes, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`);
3. builds current source twice and requires byte-for-byte reproducibility (SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`); and
4. compares source/current/published JSON on the read-only `stone-tablet-siege` fixture, ignoring only nondeterministic `checkedAt` fields. All three reports and exit codes match (audit RC 0).

Result: `npm run check:audit-bundle` — RC 0. `public/ai/campaign-audit.mjs` was not modified. The guard does not claim the post-split bundle is byte-identical to the pre-split artifact; it proves the required clean canonical build is.

## Brand evidence — trace of all 38 baseline paths

`npm run check:brand` is still RC 1: **86 matches / 28 paths**, compared with baseline **113 / 38** at the follow-up base. The guard, thresholds, and exclusions are unchanged. The table below accounts for every original path: 10 no longer match (27 hits removed) and 28 remain with an individual rule/scope basis. A residual match is not represented as a passing check.

### Original paths with no remaining match

| Original path | Baseline hits | Disposition |
|---|---:|---|
| `scripts/ai-task-smoke.mts` | 3 | Earlier smoke refresh aligned the full-bundle fixture/expected filename with the current package contract; the assertions remain active. |
| `scripts/chronicle-import-identity-smoke.mts` | 1 | Fixture filename updated to the current package suffix; ID/title identity assertions remain active. |
| `scripts/design-doc-guard.mts` | 2 | Instruction and kit-file assertions now use current names; manifest requirements and standalone-tool checks remain active, with no new exclusion. |
| `scripts/feedback29-smoke.mts` | 1 | The test fixture path uses the current package suffix; the probe itself remains. |
| `scripts/no-campaign-smoke.mts` | 4 | Existing import/help assertions now target the current package suffix; no assertion was removed. |
| `scripts/saves-compat-smoke.mts` | 1 | Help-text assertion matches the supported save suffix; save migration/compatibility cases remain. |
| `scripts/tz12-profiles-smoke.mts` | 1 | Guide assertion matches current product copy; profile assertions remain. |
| `_tools/reports/STAB-1.14.md` | 1 | Text-only: omitted the obsolete suffix from a missing-fixture path description; probe and fixture were not changed. |
| `_tools/reports/STAB-1.3.md` | 11 | Text-only: clearly marked neutral placeholders for obsolete identifiers in copied historical CLI banners/fixture suffixes; commands, RCs, and outcomes are retained, and the report now says those banner lines are not verbatim stdout. |
| `_tools/reports/STAB-1.8.md` | 2 | Text-only: described the historical product name/suffix generically; no product source or test was changed for this cleanup. |

The seven `scripts/` paths were already refreshed in the earlier smoke work and are not additional changes in this follow-up; their current checks are still executed, not skipped or allowlisted. In particular, the AI-task probe continues to test the explicit full-bundle case. The three STAB report edits above are the follow-up's text-only brand cleanups; historical GOLD reports were left untouched as §2.3 requires.

### 28 remaining paths — individual §2 basis

Rule references below use [`docs/agents/tz-stab-1.md`](../../docs/agents/tz-stab-1.md) §2 and, for smoke oracles, [`docs/agents/freedom.md`](../../docs/agents/freedom.md) §2. The card's exact path allowlist/owner assignments are stated where they are narrower than the general mission scope.

| Remaining path (matches) | Protection / scope basis |
|---|---|
| `_tools/reports/GOLD-1.10.md` (2) | STAB-1 §2.3 explicitly protects historical Golden reports; rewriting captured evidence is prohibited. |
| `_tools/reports/GOLD-1.13.md` (5) | STAB-1 §2.3 — protected historical Golden report/evidence. |
| `_tools/reports/GOLD-1.6b.md` (1) | STAB-1 §2.3 — protected historical Golden report/evidence. |
| `_tools/reports/GOLD-1.6d.md` (12) | STAB-1 §2.3 — protected historical Golden report and persisted-data evidence. |
| `docs/ai-campaign-guide.md` (1) | STAB-1 §2.4 owner boundary plus this card's scope: campaign-guide work belongs to STAB-1.19; no cross-card guide edit. |
| `docs/campaign.schema.json` (5) | STAB-1 §2.2 and §2.5: this is the frozen campaign-format contract checked by `check:schema-freeze`; changing its identity/description is a contract/oracle edit, with no approved ADR. |
| `docs/decisions/GOLD-1.13.md` (2) | STAB-1 §2.4/§2.5 and the follow-up's exact decision-file allowlist: only GOLD-1.6c, STAB-1.11, and STAB-1.15 may receive format-only metadata fixes. This accepted historical decision is not in that list. |
| `docs/decisions/STAB-1.8.md` (2) | STAB-1 §2.4/§2.5 and the same exact decision-file allowlist; do not alter this accepted decision's meaning. |
| `index.html` (1) | STAB-1 §2.4 plus the follow-up path scope: root application identity is not an authorized path in this Tools/docs card. |
| `package.json` (1) | STAB-1 §2.2/§2.4 plus the card's explicit exception: only named npm-script changes are permitted; package identity is not. |
| `public/ai/campaign-audit.mjs` (6) | STAB-1 §2.7: generated bundle may change only via the standard build. Its protected SHA-256 remains `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. |
| `public/ai/campaign-guide.md` (15) | STAB-1 §2.7 and the STAB-1.19 owner boundary: generated guide copy is not hand-edited in this card. |
| `public/ai/campaign.schema.json` (5) | STAB-1 §2.2/§2.5/§2.7: generated copy of a frozen contract; no manual change or contract ADR is authorized. |
| `public/ai/cf-play.mjs` (2) | STAB-1 §2.7: generated PlayKit bundle is standard-build-only. `check:playkit-bundle` passes and the unpacked-kit reference check matches source exactly. |
| `public/campaigns/ash-of-caerden/campaign.json` (1) | STAB-1 §2.3 explicitly protects the Ash campaign; its residual warnings are assigned to STAB-1.19. |
| `scripts/combat-rules-smoke.mts` (2) | `freedom.md` §2 protects `smoke:*` and fixtures; STAB-1 §2.1/§2.5 prohibit weakening/changing the save-key oracle. |
| `scripts/feedback8-A-smoke.mts` (2) | `freedom.md` §2 and STAB-1 §2.1/§2.5: active persisted-key smoke oracle; keep its expected key unchanged. |
| `scripts/feedback8-G-smoke.mts` (2) | `freedom.md` §2 and STAB-1 §2.1/§2.5: active persisted-settings oracle; keep its expected key unchanged. |
| `scripts/gen-schema.mts` (3) | STAB-1 §2.2/§2.5: generator for the frozen schema contract; changing generated identifiers/descriptions changes the contract. |
| `scripts/p2-mechanics-smoke.mts` (2) | `freedom.md` §2 and STAB-1 §2.1/§2.5: active persisted-metadata smoke oracle. |
| `scripts/tz7-slots-smoke.mts` (2) | `freedom.md` §2 and STAB-1 §2.1/§2.5: active save-slot compatibility oracle. |
| `src/App.tsx` (1) | STAB-1 §2.2/§2.4: save-export behavior is a compatibility contract and this path is outside the current Tools/docs scope. |
| `src/editor/playtestNotes.ts` (4) | STAB-1 §2.2: persisted user-note key; renaming without migration could orphan existing notes. Outside the current card's behavior scope. |
| `src/shared/compat.ts` (1) | STAB-1 §2.2/§2.5: versioned interchange identifier; changing it requires a compatibility decision/migration. |
| `src/shared/compatInventory.ts` (1) | STAB-1 §2.2/§2.5: versioned inventory interchange identifier; changing it requires a compatibility decision/migration. |
| `src/shared/settings.ts` (2) | STAB-1 §2.2/§2.5: persisted user-settings key; changing it could orphan saved preferences. |
| `src/shared/types/saves.ts` (1) | STAB-1 §2.2/§2.5: versioned save-compatibility marker; keep the established format. |
| `vite.config.ts` (2) | STAB-1 §2.4 and this card's exact paths: Vite configuration is outside the authorized edit zone. |

## Decisions, scope, and merge status

- `docs/decisions/STAB-1.17.md` remains **accepted**, dated `2026-10-31`; its prior wording is preserved unchanged. It attributes intermediate RC 1 to unfinished work/other-card residuals and does not authorize changing the old oracle's meaning (only §2.5).
- `docs/decisions/STAB-1.18.md` contains exactly three `неясно / решил / откат` lines. It accepts 53/55 only with the complete residual evidence, protected-path basis, and STAB-1.19 ownership recorded above.
- Format-only decision metadata repairs were limited to `docs/decisions/GOLD-1.6c.md`, `STAB-1.11.md`, and `STAB-1.15.md`: accepted statuses and substantive decisions remain unchanged. `npm run check:decisions` — RC 0 (57 files; 38 statusless, 19 accepted).
- `npm run check:browser-gate` — RC 0. The previously flagged stale browser-environment prose in the editable STAB-1.8 historical report was made accurate; no test was skipped.
- `npm run check:contracts` — RC 1 at `check:dev-campaigns` because the checker flags two protected public campaign entries (`ash-of-caerden` title missing `[DEV]`; `fmv-crossing` lacks `dev-fixture.json`). It passed contracts, pack boundary, decisions, module-size, and browser-gate before stopping. `public/campaigns/**` is protected by STAB-1 §2.3 and was not modified.
- PR #184 was **squash-merged** to `main` at merge SHA `24d5d1a41377c7a7b2bbb941e66d28da62c29c62` on 2026-10-31. Base SHA: `1cecd559624f0dd8805fd76a0350c7e9ce9864fb`. The squash commit has the base as its parent, and its tree is identical to PR head `2c8ba0a29b70d8db4d089fc72bc280607ece88da`.
- Exact merge diff summary from `git diff --stat 1cecd559624f0dd8805fd76a0350c7e9ce9864fb 24d5d1a41377c7a7b2bbb941e66d28da62c29c62`:

```text
46 files changed, 756 insertions(+), 165 deletions(-)
```

- Protected-path audit for the merge diff returned **none** for `public/campaigns/**`, `packs/**`, `.golden/**`, `scripts/golden/**`, `.github/workflows/**`, and `docs/contracts/**`. `public/ai/**` also had no changed files; checked-in generated bundles remained untouched, and verification used temporary build outputs only.
- On the merge SHA, a detached clean worktree ran `npm run check:audit-bundle` — RC 0: clean canonical build `1,002,333` bytes, protected SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`; current-source builds were reproducible (`965d4e84692f909b82f7961c82a4c7caae9f4d980b77edb077d9dec4b332dcb0`), and source/current/published audit JSON agreed on `stone-tablet-siege` (audit RC 0).
- CI freshness on the merge SHA is green: visual run `41197611832`, head `24d5d1a41377c7a7b2bbb941e66d28da62c29c62`, step **«Проверить свежесть бандла аудита до сборки»** — success. TypeScript, ScriptCat transport probes, and determinism also passed. The overall visual workflow is **not green**: it failed later at **«Контракты и browser gate»** (`check:contracts`); downstream steps were skipped. The failed step is consistent with the two protected-campaign issues above. No full-CI pass is claimed.
- The local worktree is clean on `arena/202671b0-narthex` after recording this post-merge report update; the branch was not switched or reset.
