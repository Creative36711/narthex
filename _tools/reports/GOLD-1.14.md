# GOLD-1.14 — warnings are fatal for `cf-play check`

**Verdict: PASS.** The single entry `npm run playthrough:golden` returned rc=0; the underlying golden campaign runner returned rc=0 and `npm run cf-play:negative` returned rc=0.

- Run ID: `3f2fa8d7-b731-4f94-9cf9-6057e90302f7`; golden-run ID: `11a4f556-927a-4681-92ec-cfca4eda1f3c`.
- Fixture: `_tools/fixtures/cf-play-warning/` (warning-only; no errors).
- Started: 2026-10-30T08:58:47.849Z; elapsed: 63.52 seconds.

## Imported clean campaign

- Human-readable source `cf-play check .golden/karkas`: rc=0; printed verdict=ok; errors=0; warnings=0; both counts printed=true.
- Source `cf-play check .golden/karkas`: rc=0; verdict=ok; errors=0; warnings=0.
- Unpacked AI-kit `cf-play check .golden/karkas`: rc=0; verdict=ok; errors=0; warnings=0; same result as source=true.

## Warning-only negative probe

- Fixture path: `_tools/fixtures/cf-play-warning/`.
- Source `cf-play check`: rc=1; verdict=failed; errors=0; warnings=1; `warning не допускается: 1`.
- Unpacked AI-kit `cf-play check`: rc=1; verdict=failed; errors=0; warnings=1; `warning не допускается: 1`.
- Source warning: scene_dead_end: сцена «warning fixture: dead-end start scene» без навигации, и из локации «location_test» нет дорог.
- Unpacked-kit warning: scene_dead_end: сцена «warning fixture: dead-end start scene» без навигации, и из локации «location_test» нет дорог.
- Both outputs contain the warning and the required text `warning не допускается`; the negative-probe npm command passes only when each actual cf-play check returns rc=1, reports 0 errors and exactly one warning.

## Wiring and bundle

- `npm run playthrough:golden` runs the existing golden campaign, then `npm run cf-play:negative`; `.github/workflows/golden.yml` also runs the negative script as an explicit adjacent CI step.
- `public/ai/cf-play.mjs` is the generated CLI shipped in the unpacked AI kit. It was rebuilt from `scripts/playkit/cli.mts` so the shipped command enforces the same warning-fatal verdict; the campaign and negative checks cover both source and bundle.
- No suppression flag, environment override, or warning filter was added.

## Scope and assumption

- `campaign-1`, `.golden/karkas`, `src/core/**`, and `src/player/**` were not edited; `.golden/**` remains uncommitted. The full golden run used an isolated test workspace.
- **Допущение:** the minimal fixture uses a reachable start scene with no navigation and no location roads, producing exactly one deterministic dead-end warning; a tiny FMV document preserves the normal narrative-pack entry event.

## CI

- Pull-request CI and the post-merge push check are recorded separately when available. This report records the exact local campaign and fixture return codes; the merge-push run must remain green.
