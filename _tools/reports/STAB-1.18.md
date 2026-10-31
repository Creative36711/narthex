# STAB-1.18 — follow-up verification report

- Dispatch: `40a6f0cf-5705-812d-8a6a-cf0f489c5af7`
- Run: `9be5e9cc-b84e-421a-ae72-50ad131ce3f3`
- Branch: `arena/202671b0-narthex`
- Follow-up base SHA: `1cecd559624f0dd8805fd76a0350c7e9ce9864fb` (squash merge of PR #183)
- Previous report/run: `ed983a03-a777-4f99-b851-f108f23b6aeb`; its merged module splits and PlayKit rebuild were not repeated.
- Date: 2026-10-31

## Outcome

- `smoke:core`: RC 0, **55/55**. The runner now evaluates and counts 55 independent semantic probes; it fails if the observed count differs from 55.
- `smoke:mission`: RC 1, **53/55**, all 55 probes executed, none skipped. The only failures are `smoke:pack-missing` and `smoke:capability-modes`; both are blocked by warnings in the protected Ash campaign. They remain assigned to STAB-1.19 rather than being hidden or “fixed” by changing the campaign/oracle.
- `check:brand`: RC 1, 100 matches in 31 paths, down from 113/38. Every remaining path is individually identified below as historical evidence, a protected contract/artifact, persisted-data compatibility, deferred STAB-1.19 material, or outside the permitted edit scope. The guard, thresholds, and exclusions were not changed.
- `check:audit-bundle`: RC 0. The clean canonical pre-split build matches the protected SHA exactly; current source builds reproduce byte-for-byte and audit JSON agrees with the source and protected bundle.
- The card is **not fully accepted and is not merged**: the required mission total is still 53/55. No squash merge was attempted.

## Required gates — baseline versus after

Baseline is the unchanged checkout at the follow-up base SHA, after dependency installation. Mission runs used the temporary Pillow 13 environment at `/tmp/stab118-pillow`; this was outside the repository and allowed pixel probes to run normally.

| Command | Baseline RC — one-line output | After RC — one-line output |
|---|---|---|
| `npm run check:module-size` | `0` — `check:module-size passed` | `0` — `check:module-size passed` |
| `npm run check:brand` | `1` — `✗ найдены следы старого бренда: 113` | `1` — `✗ найдены следы старого бренда: 100` |
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

## Audit-bundle freshness diagnosis

The original raw source-versus-published byte check returned RC 1 after the behavior-preserving module split: current source emitted 1,006,226 bytes (`0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`), while the protected published bundle is 1,002,333 bytes (`b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`). This was a stale freshness model, not a changed protected artifact.

`scripts/check-audit-bundle.mts` now:

1. verifies that the published artifact still has the required protected SHA;
2. extracts the clean pre-split source tree at `0a5abca49ff91daf4b642fb76272dec56a6a778e`, builds it with the installed locked esbuild dependency, and proves its bytes equal the protected artifact exactly (1,002,333 bytes, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`);
3. builds current source twice and requires byte-for-byte reproducibility (SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`); and
4. compares source/current/published JSON on the read-only `stone-tablet-siege` fixture, ignoring only nondeterministic `checkedAt` fields. All three reports and exit codes match (audit RC 0).

Result: `npm run check:audit-bundle` — RC 0. `public/ai/campaign-audit.mjs` was not modified. The guard does not claim the post-split bundle is byte-identical to the pre-split artifact; it proves the required clean canonical build is.

## Remaining brand matches — each retained path is protected

No guard threshold or exclusion changed. Text-only updates reduced the count from 113 matches / 38 paths to 100 / 31 paths. Each remaining path is listed individually; all are protected for the reason stated.

| Path (matches) | Protection reason |
|---|---|
| `_tools/reports/GOLD-1.10.md` (2) | Historical run evidence; rewriting captured output would falsify the record. |
| `_tools/reports/GOLD-1.13.md` (5) | Protected-path audit evidence; preserve its original wording. |
| `_tools/reports/GOLD-1.6b.md` (1) | Historical package-identity evidence. |
| `_tools/reports/GOLD-1.6d.md` (12) | Historical persisted-key and migration evidence. |
| `_tools/reports/STAB-1.14.md` (1) | Historical smoke-probe evidence. |
| `_tools/reports/STAB-1.3.md` (11) | Captured command and probe output from an earlier run. |
| `_tools/reports/STAB-1.8.md` (2) | Historical decision/evidence record. |
| `docs/ai-campaign-guide.md` (1) | Guide work is explicitly assigned to STAB-1.19; do not pull it into this follow-up. |
| `docs/campaign.schema.json` (5) | Frozen generated schema; changing its generator output changes the protected contract. |
| `docs/decisions/GOLD-1.13.md` (2) | Accepted historical audit disposition. |
| `docs/decisions/STAB-1.8.md` (2) | Historical decision record outside this card’s cleanup. |
| `index.html` (1) | Root application identity is outside the permitted edit paths. |
| `package.json` (1) | Package identity is outside scope; only listed script exceptions are allowed. |
| `public/ai/campaign-audit.mjs` (6) | Protected generated bundle; its required SHA is unchanged. |
| `public/ai/campaign-guide.md` (15) | Generated guide copy; guide ownership is STAB-1.19. |
| `public/ai/campaign.schema.json` (5) | Frozen generated schema contract. |
| `public/ai/cf-play.mjs` (2) | Standard rebuilt bundle; the remaining match comes from the preserved settings-storage key. Do not hand-edit. |
| `public/campaigns/ash-of-caerden/campaign.json` (1) | Protected campaign; campaign work belongs to STAB-1.19. |
| `scripts/combat-rules-smoke.mts` (2) | Persisted storage-key compatibility probe; changing its expected key could hide existing saves. |
| `scripts/feedback8-A-smoke.mts` (2) | Persisted local-storage key assertion. |
| `scripts/feedback8-G-smoke.mts` (2) | Persisted settings-key assertion. |
| `scripts/gen-schema.mts` (3) | Generator for the frozen schema contract. |
| `scripts/p2-mechanics-smoke.mts` (2) | Persisted metadata-key oracle. |
| `scripts/tz7-slots-smoke.mts` (2) | Persisted save-slot key assertion. |
| `src/App.tsx` (1) | Save-export path behavior is outside the permitted source edit paths. |
| `src/editor/playtestNotes.ts` (4) | Persisted user-note key; changing it without migration could orphan existing notes. |
| `src/shared/compat.ts` (1) | Versioned interchange identifier; preserve compatibility. |
| `src/shared/compatInventory.ts` (1) | Versioned inventory interchange identifier; preserve compatibility. |
| `src/shared/settings.ts` (2) | Persisted user-settings key; changing it would orphan preferences. |
| `src/shared/types/saves.ts` (1) | Versioned save-compatibility marker. |
| `vite.config.ts` (2) | Dev-server configuration/comments are outside the allowed edit paths. |

## Decisions, scope, and merge status

- `docs/decisions/STAB-1.17.md` is now **accepted**, dated `2026-10-31`. Its rationale attributes intermediate RC 1 to unfinished work and other-card residuals rather than claiming RC 0 is impossible; it explicitly says the decision does not authorize changing the old oracle’s meaning (only §2.5).
- `docs/decisions/STAB-1.18.md` contains exactly three `неясно / решил / откат` lines and records the reversible scope decision for the two campaign-warning failures.
- `public/campaigns/**`, packs, golden fixtures/oracles, workflows, and `docs/contracts/**` were not modified. No guard thresholds/exclusions were changed. Public audit and PlayKit bundles retain their required hashes.
- Follow-up base SHA is `1cecd559624f0dd8805fd76a0350c7e9ce9864fb`; this is also the merge SHA of PR #183. Draft PR #184: https://github.com/Creative36711/narthex/pull/184. No follow-up squash-merge SHA exists because this work is intentionally not merged while `smoke:mission` remains 53/55.
- The first Actions run on commit `3e69649251f26bc7222fb94e2ab60025d77c29e4` failed in `check:contracts` at decision validation: it found the missing accepted-decision metadata in STAB-1.17 and three unchanged out-of-scope status-format issues in GOLD-1.6c, STAB-1.11, and STAB-1.15. STAB-1.17 metadata is corrected. Follow-up runs `41195752814` (`d449627d8971d6000361cd241af19061e198bc44`) and `41195882528` (`a89cf3b50dcd50b899cc8d38dacb39967c5e565a`) also failed at `check:contracts`; local `check:decisions` confirms only those three pre-existing issues remain. No out-of-scope decision file was changed.
- Patch stat against this base (including this report): `40 files changed, 688 insertions(+), 143 deletions(-)`.
- At submission, `git status --short --branch` shows a clean worktree on `arena/202671b0-narthex`. No follow-up squash merge was performed; draft PR #184 remains open because mission and CI gates are red.
