# STAB-1.18 — verification report

- Dispatch: `40a6f0cf-5705-812d-8a6a-cf0f489c5af7`
- Run: `ed983a03-a777-4f99-b851-f108f23b6aeb`
- Branch: `arena/56653049-narthex`
- Base: `0a5abca49ff91daf4b642fb76272dec56a6a778e`

## Work completed

- Split the 3 oversized modules into bounded modules. All resulting files are at most 450 lines: shared types (largest 431), editor store (largest 336), campaign audit (largest 419). The public entry points remain in place.
- Kept the moved declarations and store/audit operations type-safe; `npx tsc -b --pretty false` returned RC 0.
- Rebuilt `public/ai/cf-play.mjs` with `npm run build:playkit-bundle`; its standard consistency check passes.
- Kept `public/ai/campaign-audit.mjs` unchanged at SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`.
- Updated user-facing brand text and package filename labels only; no guard thresholds or exclusions were changed. No smoke was disabled or weakened.

## Required gates — baseline versus final

| Command | Baseline RC and one-line output | Final RC and one-line output |
|---|---|---|
| `npm run check:module-size` | `1` — `check:module-size failed: 3 module(s) exceed their limit` | `0` — `check:module-size passed` |
| `npm run check:brand` | `1` — `✗ найдены следы старого бренда: 137` | `1` — `✗ найдены следы старого бренда: 113` |
| `npm run check:playkit-bundle` | `1` — `✗ public/ai/cf-play.mjs не совпадает со сборкой из src — бандл устарел.` | `0` — `✓ public/ai/cf-play.mjs совпадает со сборкой из src (0.8.0, sha256 1815c2812cbb4c89bbac83f4ec1664585f65f03a2738c0c085302bc1ab583a11)` |
| `npm run smoke:core` | `0` — `все якоря зелёные` | `0` — `все якоря зелёные` |
| `npm run smoke:mission` | `1` — `SUMMARY 45/55 passed; rc=1` | `1` — `SUMMARY 45/55 passed; rc=1` |

The core smoke emits 14 green anchors in both runs, not 55. Its RC is 0, but the requested 55/55 count is not evidenced; this discrepancy is recorded rather than inferred. The mission runner executed all 55 probes. The final run used a temporary Pillow install via `PYTHONPATH=/tmp/stab118-pillow`, so the optional pixel checks also ran; there were no skipped probes.

## Remaining brand matches

Final result: 113 matches in 38 paths, down from 137. Each remaining path is retained because it is protected evidence, a frozen contract, a persisted-data key, a generated artifact, or outside this card's permitted edit scope. No guard exception was added.

| Path | Reason retained |
|---|---|
| `_tools/reports/GOLD-1.10.md` | Historical run evidence; rewriting captured values would falsify the record. |
| `_tools/reports/GOLD-1.13.md` | Protected-path audit evidence; keep the original audit wording intact. |
| `_tools/reports/GOLD-1.6b.md` | Historical package-identity evidence. |
| `_tools/reports/GOLD-1.6d.md` | Historical storage-key and runtime evidence. |
| `_tools/reports/STAB-1.14.md` | Historical smoke-probe evidence. |
| `_tools/reports/STAB-1.3.md` | Verbatim prior command and probe output. |
| `_tools/reports/STAB-1.8.md` | Historical decision/evidence record. |
| `docs/ai-campaign-guide.md` | Guide and its consistency gate are assigned to STAB-1.19; changing it here would take that work out of scope. |
| `docs/campaign.schema.json` | Frozen generated schema; changing its source text would alter the protected schema contract. |
| `docs/decisions/GOLD-1.13.md` | Historical audit disposition; do not rewrite an accepted decision record. |
| `docs/decisions/STAB-1.8.md` | Historical decision record; not part of this card's decision cleanup. |
| `index.html` | Root application identity is outside the permitted source-edit paths. |
| `package.json` | Package identity is out of scope; no script change was justified. |
| `public/ai/campaign-audit.mjs` | Protected generated file; its required SHA-256 is unchanged. |
| `public/ai/campaign-guide.md` | Generated guide copy; guide ownership is STAB-1.19 and this card permits only standard generated rebuilds in `public/ai`. |
| `public/ai/campaign.schema.json` | Frozen generated schema contract. |
| `public/ai/cf-play.mjs` | Standard rebuilt bundle; its remaining match comes from the preserved settings-storage key in source. Do not hand-edit. |
| `public/campaigns/ash-of-caerden/campaign.json` | Protected campaign fixture; unchanged. |
| `scripts/ai-task-smoke.mts` | Standalone smoke oracle is outside the permitted fixture-only script path. |
| `scripts/chronicle-import-identity-smoke.mts` | Standalone legacy-import probe is outside this card's script scope. |
| `scripts/combat-rules-smoke.mts` | Standalone storage-contract probe is outside this card's script scope. |
| `scripts/design-doc-guard.mts` | Guide/design-doc oracle belongs to STAB-1.19. |
| `scripts/feedback29-smoke.mts` | Out-of-scope external fixture reference; do not rewrite the probe here. |
| `scripts/feedback8-A-smoke.mts` | Standalone storage-key assertion is outside this card's script scope. |
| `scripts/feedback8-G-smoke.mts` | Standalone settings-key assertion is outside this card's script scope. |
| `scripts/gen-schema.mts` | Schema generator for the frozen contract; not modified. |
| `scripts/no-campaign-smoke.mts` | Standalone legacy-import oracle is outside this card's script scope. |
| `scripts/p2-mechanics-smoke.mts` | Standalone metadata-key oracle is outside this card's script scope. |
| `scripts/saves-compat-smoke.mts` | Standalone player-help assertion is outside this card's script scope. |
| `scripts/tz12-profiles-smoke.mts` | Guide assertion belongs to STAB-1.19. |
| `scripts/tz7-slots-smoke.mts` | Standalone save-key assertion is outside this card's script scope. |
| `src/App.tsx` | Save-export path is outside the permitted source-edit paths. |
| `src/editor/playtestNotes.ts` | Persisted user notes use this key; changing it without migration could hide existing notes. |
| `src/shared/compat.ts` | Versioned interchange format; renaming it would change a compatibility contract. |
| `src/shared/compatInventory.ts` | Versioned inventory interchange format; preserve existing readers. |
| `src/shared/settings.ts` | Persisted user-settings key; changing it would orphan existing preferences. |
| `src/shared/types/saves.ts` | Type-level legacy interchange marker required for save compatibility. |
| `vite.config.ts` | Dev-server compatibility comments/config are outside the allowed edit paths. |

## Remaining mission-smoke failures and owners

All 55 probes ran; 45 passed and 10 remain red. These were not hidden, disabled, or skipped. Their remaining owners are:

| Probe | Remaining issue | Owner |
|---|---|---|
| `smoke:design-doc` | Guide format assertion and reference-file manifest mismatch; guide work is explicitly deferred. | STAB-1.19 |
| `smoke:p2` | One fixture scene checks engine-level appearance state. | STAB-1.19 |
| `smoke:ai-task` | Probe expects an older filename and full-package shape, while the default edit bundle is a patch; its script is outside the permitted script scope. | STAB-1.21 |
| `smoke:dialogues-r31`, `smoke:dialogues-r32` | Required temporary dialogue fixtures under `_ai-temp/campaing` are absent. | STAB-1.21 |
| `smoke:breathe-toggle` | Static probe still reads the old rendering module path; the active logic is in `SceneForeground.tsx`, outside this card's edit scope. | STAB-1.21 |
| `smoke:encounters-loader` | The temporary Shepot campaign fixture is absent and the protected campaign source returns 404. | STAB-1.19 |
| `smoke:saves-compat` | Player HelpPanel save-extension assertion is outside the permitted source-edit paths. | STAB-1.21 |
| `smoke:pack-missing`, `smoke:capability-modes` | Warnings originate in the protected Ash campaign fixture; campaign/oracle edits are forbidden here. | STAB-1.19 |

## Decision and scope record

The three-line ambiguity decision is in `docs/decisions/STAB-1.18.md`. Protected campaign/schema/audit files, `docs/contracts/**`, pack sources, golden oracles, and workflow files were not changed. `git diff --check` passed. Base SHA is recorded above; PR/merge metadata and final diff statistics are recorded in the completion response.
