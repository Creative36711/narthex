# GOLD-1.8b — Re-pin the golden campaign to the campaign-1 release

**Status:** manifest repinned; two imports, audit, cf-play, and unpacked-kit checks passed. Post-repin browser 404 counts remain **unmeasured**: the existing `golden:play` runner rejects the new pin at a hard-coded legacy manifest guard before starting Chromium. No protected script was changed. This is an explicit measurement limitation, not a claim that the 404s are zero.

## Pin and archive evidence

- Working branch: `arena/c5133465-narthex`; base `main` / starting `HEAD`: `86edcd8234103261d59e90e33537bae159a73e72`.
- Target campaign commit: `4783665b04b9ea703cbdfc0bd10cc2b1263caf83` (parent `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`).
- URL: `https://codeload.github.com/Creative36711/campaign-1/tar.gz/4783665b04b9ea703cbdfc0bd10cc2b1263caf83`.
- A fresh GET returned HTTP `200`, content type `application/x-gzip`, and `188670372` downloaded bytes. The downloaded archive SHA-256 is `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; a second direct download matched the first byte-for-byte.
- The importer measured the extracted tree as 1,291 files, 32 directories, 192,491,897 bytes, tree SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`. These measured values are now in `.golden/manifest.json`.
- Extracted `project.json`: 510 bytes; SHA-256 `489cf44da06347eede87db3df5472cf80afea8d02d6c7ec83dbb90d100efa5dd`. The task card listed a different SHA-256 (`509cf44da06347eede87db3df5472cf80afea8d02d6c7ec83dbb90d100efa5dd`) for the same stated size. The manifest follows the bytes actually downloaded and extracted; archive content was not modified.

## Import and validation

| Check | Result |
|---|---|
| `npm run golden:import` — run 1 | rc=0; downloaded and verified 188,670,372 bytes with SHA-256 `7c2172a7…5d527cb2`; extracted tree 1,291 files / 32 directories / 192,491,897 bytes / SHA-256 `d645ea0b…3d79d68`; manifest updated. |
| `npm run golden:import` — run 2 | rc=0; verified the extracted cache and skipped the download; reported the same archive size/SHA and tree size/SHA; manifest unchanged. |
| Extracted campaign / ignore status | `.golden/karkas/project.json` exists with the measured 510-byte size and SHA above. `git status --porcelain -- .golden/karkas` is empty; generated campaign files remain ignored. `.golden/manifest.json` is the intended tracked modification. |
| `npm run audit:campaign -- .golden/karkas` | rc=0; **0 errors, 0 warnings, 3 notes**; coverage: 319 JSON and 11 Ink/Markdown files; 887 referenced local media links found. |
| `node public/ai/cf-play.mjs check .golden/karkas` | rc=0; **0 errors, 0 warnings**; 12 scenes, 5 locations, 11 dialogues, 118 Ink nodes; 5 seeds; 4/12 reachable scenes visited. |
| AI kit after unpack | `npm run pack:ai-kit` rc=0; unpacked kit `cf-play.mjs check` on `.golden/karkas` rc=0 with matching counts and 0 errors / 0 warnings. The packed/unpacked kit also checked `public/campaigns/ash-of-caerden`: 10 scenes, 8 locations, 6 dialogues, 21 Ink nodes, 0 errors, 3 warnings. The repository bundle and unpacked kit reported the same reference-campaign result. Generated `dist-ai/` output was removed after the check. |
| `npm run check:playkit-bundle` | rc=0; committed `public/ai/cf-play.mjs` matches the source build; SHA-256 `d7e7973b397200492a8e764e0857d90fd37bd1db4a78f8bf46325a403172a908`. |

The audit and cf-play produced no errors, so there were none to suppress or fix.

## Browser 404 evidence

- **Before repin (recorded baseline):** 2 `/project.json` 404s at first scene entry (`03-gate`); 5 over the complete route (2 at scene entry, 2 during Continue/autosave, 1 during manual-slot load). This is the prior measured run in `_tools/reports/GOLD-1.6.log`.
- **After repin:** **not measured**; no post-repin 0/0 claim is made. `npm run golden:play` was attempted and returned rc=1 before starting the browser with: `Pinned GOLD-1 campaign tree/manifest is missing or does not match .golden/manifest.json`. `scripts/golden/play.mjs` hard-codes the prior commit `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`, archive SHA `d424a914…ad3cf4b`, and tree SHA `132a5c09…ce62c76`; the new correct values therefore hit that guard. `.github/workflows/golden.yml` invokes `playthrough:golden`, whose browser step calls the same runner. The browser stage cannot measure the new campaign until that out-of-scope legacy pin guard is updated; this task does not change `scripts/golden/**` or weaken checks.

## PR and CI

- PR #154: https://github.com/Creative36711/narthex/pull/154, head `dec4f7ed38443df24abe1c02b9bbb749f0aa1129`, base `main`.
- `golden-playthrough` run [40954610209](https://github.com/Creative36711/narthex/actions/runs/40954610209/job/123731338091): **failure** in the combined “Run golden import, audit, playkit and browser save/load” step; the evidence-artifact upload succeeded. Job metadata confirms the step failed, but `gh run view --log` and `gh run download` both returned EOF from GitHub’s external Actions results/blob hosts, so the exact substep is not independently visible here. The local `npm run golden:play` attempt does confirm the runner's legacy-pin guard and remains the concrete reason no post-repin browser count is claimed.
- `visual` run [40954610101](https://github.com/Creative36711/narthex/actions/runs/40954610101/job/123731337498): **failure** at “Проверить свежесть бандла аудита до сборки”; later browser/visual steps were skipped. No audit bundle or code was changed in this task.
- Both failures are recorded, not reclassified as passes. PR #154 is open; squash merge is not yet recorded in this report.

## Scope

The tracked diff is limited to `.golden/manifest.json`, `_tools/reports/GOLD-1.8b.md`, and `_tools/reports/GOLD-1.8b.log`. No generated campaign files, campaign source, player/core code, pack code, contracts, importer, or `public/ai/*.mjs` were changed. The import-created `.golden/karkas/` remains ignored.
