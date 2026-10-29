# GOLD-1.6b — Restore package scripts and remove `_ai-temp`

**Status for dispatch `4086f0cf-5705-8120-b50e-db3877602b32`, run `266adde0-27a9-4648-bc62-13caa79eed1e`: PR #148 was squash-merged into `main` at `94044ee19e3a535cefb07d924d2018ebf3573539`. Its post-merge `golden-playthrough` push run `40934895116` completed with **failure** for the documented, permitted source mismatch; details and the visual external-debt assumption are recorded below.

## Baseline and changes

- Starting `main` / branch base: `e3891bcb91be01b27d5e108495631ca7c54865e4`.
- Script reference: `c1d7a6f21438ae4b48fe706b31e0783d6e52573b`.
- Commit on `arena/d6a159aa-narthex`: `45c1eeea3911c9028abecf972c72de9a49691fa0` (`GOLD-1.6b: restore package scripts and prune temp tree`).
- `package.json`: declared script keys went from **56 to 135**, restoring the **79 missing keys**; the existing `build:ai-bundle` command was restored to its reference value. The exact `scripts` object now matches `c1d7a6f`.
- **Count discrepancy:** the task text says 57→136, but direct parsing of the checked-in JSON objects gives 56→135 (a delta of 79). I treated the exact `c1d7a6f` object as the source of truth and did not invent a 136th key.
- `name` (`chronicle-forge`) and `version` (`0.8.0`) were retained so they continue matching the unchanged `package-lock.json`. Thus `git diff c1d7a6f HEAD -- package.json` contains only those two known top-level identity lines; `package-lock.json` was not changed.

### Restored script keys (79)

```text
build:playkit-bundle, campaign:dev, campaign:release, check:audit-bundle,
check:brand, check:browser-gate, check:campaign-formats, check:campaigns,
check:compat-corpus, check:contracts, check:core-graph, check:decisions,
check:determinism, check:dev-campaigns, check:guide, check:mission,
check:module-size, check:narrative-codes, check:pack-boundary, check:packs,
check:parity, check:playkit-bundle, check:schema-freeze, check:version,
doctor, media:check, pack:ai-kit, play, playthrough, playthrough:adventure,
playthrough:exam, playthrough:golden, probe:adventure, probe:state-ui,
probe:adventure-mechanics, probe:capability-modes, probe:fmv, probe:fmv-passport,
probe:narrative-pack, probe:pack-execution, probe:pack-host, probe:pack-move,
probe:pack-operations, publish:campaigns, schema:freeze, shot,
smoke:absence-policy, smoke:campaign-fmv-audit, smoke:campaign-start,
smoke:campaign-visibility, smoke:capability-modes, smoke:drive-gateway,
smoke:feedback16, smoke:feedback17, smoke:feedback25, smoke:feedback27,
smoke:fmv-area, smoke:manifest-order, smoke:mission, smoke:narthex-answer,
smoke:narthex-closed, smoke:narthex-fresh-branch, smoke:narthex-notion-retry,
smoke:narthex-question, smoke:narthex-redispatch, smoke:narthex-review,
smoke:narthex-rich-text, smoke:narthex-tech, smoke:navigation-area,
smoke:pack-missing, smoke:pack-panels, smoke:saves-compat, sync:ai-kit,
version:bump, visual:shots, golden:save-load, golden:import, golden:play,
golden:endings
```

All specifically requested aliases are present: `golden:import`, `golden:play`, `golden:save-load`, `golden:endings`, `playthrough:golden`, `playthrough`, `playthrough:adventure`, `playthrough:exam`, `play`, `build:playkit-bundle`, `campaign:release`, `check:contracts`, `check:pack-boundary`, `check:guide`, `check:audit-bundle`, `check:playkit-bundle`, `check:packs`, `check:schema-freeze`, and `probe:state-ui`.

- `.gitignore` was not changed; it still contains `.golden/` and `.cf-play/`.
- `_ai-temp/**`: the starting Git tree contained **1,276 tracked files** under that path (32 directories in the checkout). All 1,276 files were removed from the index with `git rm -r --cached` and from the local working copy; `git ls-tree` at the task commit reports zero `_ai-temp` paths. The task's stated count of 1,305 was not reproduced by counting the tracked file entries. The historical blobs remain reachable through `2344bcfa7e11947e01b189258c10a63d7b5352b7`; history was not rewritten.
- `.golden/manifest.json` was not modified (SHA-256 `d74c775a50400b3c9e9c707d65e26de63cb2f1f513a84b3163b141b1449f21aa`); `.golden/karkas` and the archive are not tracked.
- `_tools/ScriptCat/narthex.user.js` remains version `1.4.88`.
- No task changes were made to `scripts/**`, `.github/workflows/**`, `src/core/**`, `packs/**`, `docs/contracts/**`, `public/campaigns/**`, or the pinned `Creative36711/campaign-1` content.

## Validation

| Command | Result |
|---|---|
| `npm ci` | rc=0 |
| `npm run check:contracts` | **rc=1** — existing source inconsistency: `contracts-check.mts` says `featureOn` must be in `src/core/caps.ts`, but it is also exported from `src/shared/types.ts`. Those code paths are outside this task's permitted edits and were left unchanged. |
| `npm run check:pack-boundary` | rc=0 |
| `npm run playthrough:golden` (local run `4f06831d-85eb-447a-82aa-f884e202340f`) | **rc=1** — verified import rc=0; `audit:campaign` rc=0, errors=0, warnings=0; negative SHA probe returned expected rc=1 with `extractionStarted=false`; source `cf-play check` returned rc=2 with `engine.attachPackSim is not a function`; browser phase not reached. |

The local `cf-play` failure comes from the current source engine/CLI mismatch (`scripts/playkit/cli.mts` calls `engine.attachPackSim`, which the current `src/core/engine.ts` does not provide). The golden CI run failed at the same combined playthrough step. Fixing this would require out-of-scope code changes, which were not made.

## CI and PR

- PR [#148](https://github.com/Creative36711/narthex/pull/148) is **MERGED** by squash; merged at `2026-10-29T18:52:33Z` with main commit `94044ee19e3a535cefb07d924d2018ebf3573539` (PR head `cff99a505e327def995c66f45563f0de0e2c7088`).
- PR `golden-playthrough` run [40933018389](https://github.com/Creative36711/narthex/actions/runs/40933018389), job ID `123656150471`, failed at `Run golden import, audit, playkit and browser save/load`. Local `npm run playthrough:golden` exited rc=1; nested source `cf-play check` exited rc=2 with `engine.attachPackSim is not a function`. This is the mismatch between `scripts/playkit/cli.mts` and current `src/core/engine.ts`; both are outside this task's scope and unchanged.
- **Post-merge main push:** [`golden-playthrough` run 40934895116](https://github.com/Creative36711/narthex/actions/runs/40934895116) completed with **failure** on merge commit `94044ee19e3a535cefb07d924d2018ebf3573539`; job ID `123662717856`, failed step 7 `Run golden import, audit, playkit and browser save/load`. The local full-command rc=1 and nested `cf-play check` rc=2 / `engine.attachPackSim is not a function` cause above are the permitted source mismatch; no protected files were changed. Artifact upload step succeeded.
- The PR golden artifact is `GOLD-1.6-40933018389` (ID `12923018602`, 15,705,750 bytes, SHA-256 `3e97f8eead8dfb85233328258b9ea41907d6d8f79cb5f88b80a059d8f927ac14`; expires 2026-11-12). Earlier PR run `40931990660` also failed at the same step and uploaded `GOLD-1.6-40931990660` (ID `12922887848`).
- PR visual run `40933018472` and post-merge main push visual run [`40934895167`](https://github.com/Creative36711/narthex/actions/runs/40934895167) both failed at `Проверить свежесть бандла аудита до сборки`; on the main push, job ID `123662717754`, step 5 failed and `Пробы транспорта ScriptCat` was skipped. The same visual failure was present on baseline `main` run `40929415978` (`e3891bc`). **Assumption:** accept this pre-existing audit-bundle freshness issue as the visual external debt allowed by the task; it is not reported as green.
- Earlier main push `40929321273` on `2344bcf` also failed `golden-playthrough`; its precise diagnostic was not established, so it is not used to infer the current failure cause.
- **Decision:** PR #148 was squash-merged under the clarified acceptance. Reported the failed step, its local equivalent rc=1, nested source check rc=2 and exact cause; no out-of-scope engine/CLI fix was attempted.

## Log and report artifacts

- Report: `_tools/reports/GOLD-1.6b.md`
- JSONL log: `_tools/reports/GOLD-1.6b.log` (26 valid records; includes merge and both post-merge push-check results).
- Drive log: [GOLD-1.6b.log](https://drive.google.com/file/d/1BI6uVD-n81MvWKr89AxubMdh2oVYg4t8/view?usp=drivesdk) (file ID `1BI6uVD-n81MvWKr89AxubMdh2oVYg4t8`, in the existing `logs` folder).
