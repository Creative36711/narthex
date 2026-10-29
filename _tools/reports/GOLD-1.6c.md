# GOLD-1.6c — Align cf-play with the current PackHost API

**Status:** the in-scope CLI/adapter fix is implemented and verified on both datasets. Full `npm run playthrough:golden` is **not accepted**: it reaches the first clue with `pageerror=0`, then exits rc=1 because the browser runner finds no pre-save autosave (not a `project.json` 404). `npm run check:audit-bundle` is also rc=1 because the separate, out-of-scope campaign-audit bundle is stale. Protected files remain unchanged; proposed scope decision: `docs/decisions/GOLD-1.6c.md`.

- Dispatch: `4086f0cf-5705-813a-9321-c57b69b398ff`
- Run: `05030ef4-ef13-44dd-9962-9ab75f9a97ef`
- Working branch: `arena/af4be5fa-narthex`
- Starting `HEAD`, `origin/main`, and merge-base: `1726d27ef45665f957de4bae7c28d7ca66554100`.
- The golden archive was imported using the repository importer. Import rc=0; manifest unchanged. Pinned archive commit `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`, archive SHA-256 `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`; verified tree: 1,290 files / 32 directories, SHA-256 `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76`. `.golden/manifest.json` remained unchanged, SHA-256 `d74c775a50400b3c9e9c707d65e26de63cb2f1f513a84b3163b141b1449f21aa`.

## Baseline

| Check | Before change |
|---|---|
| Source `npx tsx scripts/playkit/cli.mts check .golden/karkas` | rc=2: `engine.attachPackSim is not a function`. |
| Source check of `public/campaigns/ash-of-caerden` | rc=2 for the same removed `GameEngine` method. |
| Existing bundled check of `.golden/karkas` | rc=0 but bundle was stale and still contained the removed engine API; counts 12 scenes / 5 locations / 11 dialogues / 118 Ink nodes, errors=0, warnings=3. |
| Existing bundled check of `public/campaigns/ash-of-caerden` | rc=0; 10 scenes / 8 locations / 6 dialogues / 21 Ink nodes, errors=0, warnings=8. |

## In-scope change

- `scripts/playkit/cli.mts` now delegates the narrative check to `scripts/playkit/pack-check.ts` instead of invoking removed `GameEngine.attachPackSim`, `runPackSim`, and `packExecution` APIs.
- The adapter constructs `PackHost` with the installed narrative manifest/hooks, runs the declared `narrative.sim` seam once using the selected entry event, and returns the same pack evidence fields (`packId`, `seam`, `steps`, event, before/after snapshot). The engine and its player-facing API are untouched.
- With `--json`, `[CF:Debug]` messages emitted by the engine are routed to stderr so stdout remains parseable JSON for the golden runner. This fixes the source-check JSON parsing failure without changing the protected engine logger.
- `public/ai/cf-play.mjs` was regenerated only via `npm run build:playkit-bundle`.

## Checks after the change

| Command / evidence | Result |
|---|---|
| `npm ci` | rc=0. |
| `npm run golden:import` | rc=0; verified pinned archive/tree; `.golden/manifest.json` unchanged. |
| `npm run build:playkit-bundle` | rc=0. |
| `npm run check:playkit-bundle` | rc=0; generated bundle matches source with lockfile-pinned dependencies, SHA-256 `fe1e70c5c8efae8dbd5181ecca0bfcf4752ea1188131c4fe88794ce53ff2befa`. |
| Source and rebuilt bundle, `.golden/karkas` | Both rc=0; 12 scenes / 5 locations / 11 dialogues / 118 Ink nodes; errors=0, warnings=3; `narrative/narrative.sim`, one step. Warnings are the allowed `flag_written_never_read` entries: `case136_read`, `shaft_roped`, `vein_hidden`. |
| Source and rebuilt bundle, `public/campaigns/ash-of-caerden` | Both rc=0; 10 scenes / 8 locations / 6 dialogues / 21 Ink nodes; errors=0, warnings=8; `narrative/narrative.sim`, one step. Counts and warning total are unchanged from the pre-change bundled baseline. |
| `npm run check:audit-bundle` | **rc=1, out of scope:** unchanged `public/ai/campaign-audit.mjs` is stale relative to unchanged `scripts/campaign-audit.mts` (committed 981,858 bytes, SHA-256 `1348888ef4974477e0b50f04833a6c1b11dfb1a8f3e7b53cc9e3b11071929a7a`; generated 981,858 bytes, SHA-256 `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`; first differing byte 145,633). The task scope authorizes only rebuilding `public/ai/cf-play.mjs`, not the separate audit bundle. **Assumption:** this is the same pre-existing audit-bundle debt allowed for visual/screenshots; it is not reported as a passing check. |
| `npm run playthrough:golden`, run `14a3b119-e8d3-4747-b960-7736f8158391` | **rc=1; acceptance not met.** Import rc=0, `audit:campaign` rc=0/errors=0/warnings=0, source cf-play rc=0/errors=0/warnings=3, unpacked AI-kit cf-play rc=0 and source-matching. Browser reached menu → hero → gate → map → machine hall → first clue; at the first-clue checkpoint pageerror=0, empty backgrounds=0, console errors=0, HTTP errors=0, request failures=0. It then failed at `06-before-save`: `No pre-save autosave found at narthex:save:b7305faa-8e10-4d26-96bb-f1b5ed5e493f`. This is not the permitted 404 case. Resolving it may require protected `src/core/**` / `src/player/**` or the out-of-scope `scripts/golden/**` runner, so no such change was made. |

## Protected-path and scope audit

- Diff for `src/core/**`, `src/player/**`, `packs/**`, `docs/contracts/**`, `public/campaigns/**`, `.golden/**`, `.github/workflows/**`, and `Creative36711/campaign-1` is zero.
- `.golden/manifest.json` stayed unchanged; the officially imported archive remains ignored/untracked. No campaign/archive data was committed.
- The task acceptance requiring `npm run check:audit-bundle` rc=0 and full golden playthrough rc=0 is therefore **not satisfied**. The explicit blockers and reversible decision are in `docs/decisions/GOLD-1.6c.md`; the proposed question is carried in the final result marker.

## PR and CI

- No merge was performed while the required golden playthrough is red for a non-404 failure and the scope decision is proposed.
- PR/CI details will be appended after submitting the in-scope change; no main-push run exists for this task yet.

## Artifacts

- Report: `_tools/reports/GOLD-1.6c.md`
- JSONL log: `_tools/reports/GOLD-1.6c.log` (at least 20 valid records; include baseline, importer, bundle, checks and golden-run evidence).
- Decision: `docs/decisions/GOLD-1.6c.md`.
