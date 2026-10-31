# STAB-1.19 — strict PlayKit, version pins, and import identity

## Summary and scope

- Dispatch: `40a6f0cf-5705-813d-a226-d3c9f170211a`; run: `2e72abff-79d6-4009-8ce4-59ad6ec32ebc`.
- Working branch: `arena/e01c875b-narthex`; base / merge-base SHA: `24d5d1a41377c7a7b2bbb941e66d28da62c29c62` (initial `HEAD`, shared with `main`).
- PR and GitHub squash-merge SHA: assigned after push/PR creation; no merge is claimed in this report before GitHub confirms it.
- Restored the executable `chronicle-import-identity` smoke: actual conflict callback exercised `update`, `copy`, and `cancel`; update saved the package under the existing campaign ID, copy reserved a distinct UUID, and cancel issued no writes. A callable `typeof`-only placeholder is rejected. The smoke prints the requested three-outcome table.
- Restored independent ScriptCat release checks for the 36 version-comparison regressions from PR #178: each pins expected `1.4.90` independently of `narthex.user.js`. `narthex-answer-smoke.mjs` also pins `1.4.90` and proves that deriving the expected version from a substituted manifest would self-accept `9.9.9`, while the independent oracle rejects it. The upstream PR file API enumerates 37 test paths (the answer smoke is the additional negative-control file); all listed test files were run.
- Added a shared strict Ash oracle without changing the existing §3 rules: both protected campaigns must return RC 1 with `verdict=failed`, the sole problem `warning не допускается: 3`, zero graph errors, and exactly the unchanged `market_raid_repelled`, `raid_rumors`, and `tavern_chest_opened` warnings. It asserts the documented 10 scenes / 8 locations / 6 dialogues / 21 Ink knots, 5 seeds with `{death:5}`, `ending_ashes`, one thirst death plus four combat deaths, and 6/10 coverage.
- The strict gate checks both campaigns in source, published bundle, and an actually unpacked AI kit (six RC-1 checks). Warning-free narrative and adventure controls return RC 0 in all three modes; the adventure control also executes and asserts a real walk/take route. The warning-only negative fixture is rejected with RC 1 in all three modes. `check:guide` executes all six documented commands in source, bundle, and unpacked-kit modes.
- `smoke:pack-missing` and `smoke:capability-modes` now match the documented protected-Ash state (RC 1 and the same three warnings) without weakening or skipping their probes. `smoke:mission` remains a 55-script suite and passed 55/55.
- Repaired the stale public AI-guide mirror using the canonical Narthex guide; `public/ai/campaign-guide.md` now matches `docs/ai-campaign-guide.md` and the existing §0 source check. No campaign/runtime data was changed.
- Applied the missing post-merge report update for STAB-1.18 from the verified PR #184 merge record.
- No changes to `public/campaigns/ash-of-caerden*`, `packs/**`, `.golden/**`, `scripts/golden/**`, `golden.yml`, `.github/workflows/**`, or `docs/contracts/**`. §3 warning names, seed/coverage limits, the 55-smoke count, and other guard thresholds are unchanged.

## Import identity outcomes

| Choice | Result | Campaign ID | Save requests |
|---|---|---|---:|
| `update` | package updated; existing ID preserved | `3b7f552a-a345-41dc-ae87-d6259cec7050` | 2 (campaign + index) |
| `copy` | package copied; fresh reserved UUID | distinct from existing ID | 2 (campaign + index) |
| `cancel` | cancelled; no state mutation | existing ID remains | 0 |

The `typeof`-only placeholder satisfies the old function-type check but is rejected by the behavior oracle; only the real import conflict flow passes all three outcome assertions.

## Gate outcomes

| Gate | Result |
|---|---|
| `npx tsc -b` | RC 0 |
| `npm run smoke:chronicle-import-identity` | RC 0; update/copy/cancel table and `typeof`-only negative control passed |
| `npm run smoke:narthex-answer` | RC 0; independent `1.4.90` pin and `9.9.9` substitution control passed |
| All 37 ScriptCat test files listed by PR #178 | RC 0, each run directly with Node; this includes the 36 comparison regressions and answer-smoke negative control |
| `npm run check:guide` | RC 0; six documented commands passed across source, bundle, and unpacked kit |
| `npm run check:strict-warning` | RC 0; six exact Ash rejections and six positive narrative/adventure controls passed |
| `npm run cf-play:negative` | RC 0; fixture produced expected RC 1 in source, bundle, and unpacked kit |
| `npm run check:compat-corpus` | RC 0; 7/7 references; its corrupted-copy negative proof correctly made the gate return RC 1 |
| `npm run smoke:pack-missing` | RC 0; protected Ash rejection is RC 1 with the exact three warnings |
| `npm run smoke:capability-modes` | RC 0; probe preserved data and verified the same expected Ash rejection |
| `PYTHONPATH=/tmp/narthex-pillow npm run smoke:cutout` | RC 0; functional Pillow fixtures ran, no optional skip |
| `npm run smoke:mission` with Pillow available to its subprocesses | **55/55, RC 0** |
| `npm run check:version` / `npm run check:decisions` | RC 0 |
| `npm run lint` | RC 0; 0 errors (2,287 warnings reported repository-wide) |
| `npm run check:dev-campaigns` | RC 1; protected public Ash title lacks `[DEV]`; `fmv-crossing` lacks `dev-fixture.json` and is not listed in the empty public index |
| `npm run check:contracts` | RC 1 only at `check:dev-campaigns`; the 46 contract assertions, packs, pack boundary, decisions, module-size and browser gate passed first |
| `npm run check:campaigns` | RC 1; one protected-file discrepancy: public Ash `campaign.json` title/author differ from `packs/narrative/data/ash-of-caerden/campaign.json`; the other three campaign copies match |
| `npm run check:brand` (standalone, with generated `dist-ai` removed) | RC 1; 72 pre-existing Chronicle Forge references in historical reports/schema/audit artifacts; no allowlist or threshold was changed. The orchestrated run reports 87 hits because it also scans the ignored kit generated by `check:guide`. |
| `PYTHONPATH=/tmp/narthex-pillow npm run check:mission` | RC 1 due to `check:contracts` and `check:brand`; every other listed step passed, including `check:guide`, 55/55 mission smokes, determinism/parity, strict-warning and negative-warning gates |

The remaining contracts/dev-campaigns/campaign-publication failures are data/index reconciliation, not a demonstrated checker defect. They are explicitly assigned in `docs/decisions/STAB-1.19.md` to **STAB-1.20 · Campaign publication/index reconciliation**, owner role Campaign Release / Build-Release, requiring separate authorization for protected campaign data. This card made no change to those paths.

## Decision, diff, and merge status

- `docs/decisions/STAB-1.19.md` contains exactly the three required `неясно / решил / откат` lines. The existing §3 oracle was preserved; any future change still requires a proposed ADR and a same-turn acceptance question.
- Staged diff stat (includes this report and the decision): **52 files changed, 768 insertions(+), 138 deletions(-)**.
- Base SHA is `24d5d1a41377c7a7b2bbb941e66d28da62c29c62`. The squash-merge SHA will be recorded in the final agent marker only if GitHub confirms a merge; this report does not assert one in advance.
