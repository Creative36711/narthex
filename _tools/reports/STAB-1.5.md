# STAB-1.5 — Published campaign-audit bundle refresh

## Result and scope

- Base: `origin/main` / `788dbc8e8e1ecab9448eca3b719e59f85e79deb8`.
- Bundle-refresh commit: `a2bce5a6d15fb8a8395e8e4aeffdfe470bbf1d5d`.
- Runtime: Node `v22.22.3`; npm `10.9.8`.
- Only generated artifact changed by the refresh: `public/ai/campaign-audit.mjs`. No source, pack, golden, contract, or workflow paths were changed.
- Before: 981,858 bytes; SHA-256 `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`.
- After: 994,538 bytes; SHA-256 `a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8`.
- Why: the checked-in bundle predated the current capability implementation. `src/shared/types.ts` now re-exports `../core/caps`, which supplies the canonical feature-capability registry/resolver instead of the older local `featureOn` logic. The audit source was not modified; running the authorized generator brought the published bundle into agreement with it. The normal post-build helper rename reported three non-React Ajv `useKeyword` references renamed.

## Commands and return codes

| Command / check | Result |
|---|---|
| `npm ci` | rc 0 (Node 22.22.3, npm 10.9.8; npm reported 4 dependency advisories) |
| Initial `npm run check:audit-bundle` | rc 1; stale bundle detected (old size/hash above) |
| `npm run build:ai-bundle` | rc 0; regenerated only the audit bundle |
| Post-build `npm run check:audit-bundle` | rc 0; exact match, 994,538 bytes and new SHA-256 above |
| `npm run lint` | rc 0; 0 errors, 1,515 warnings |
| `npm run smoke:absence-policy` | rc 0 |
| Second `npm run build:ai-bundle` | rc 0; SHA-256 remained `a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8` |
| `git diff --exit-code -- public/ai/campaign-audit.mjs` after second build | rc 0; regeneration made no changes |
| Final `npm run check:audit-bundle` | rc 0 |
| Final `npm run lint` | rc 0; 0 errors, 1,515 warnings |
| Final `npm run smoke:absence-policy` | rc 0 |
| `npm run pack:ai-kit` and unpacking the resulting ZIP | both rc 0; the generated `dist-ai/` output was removed after testing |
| `npm run cf-play:negative` | rc 0; negative warning-fixture behavior was correctly detected |
| `git diff --check` | rc 0 |

The authorized validation was the narrower `npm run build:ai-bundle`. However, during the first PR-creation attempt, Markdown backticks in a shell double-quoted body were accidentally treated as command substitutions, which inadvertently invoked `npm run build`. That broad command's status cannot be isolated from the failed `gh pr create` shell invocation (rc 126, argument list too long). The audit bundle retained its expected SHA-256, the repository working tree remained clean, and no default Vite output directory (`dist`) remained. The unintended full-build invocation is disclosed here; it is not counted as an acceptance check.

## Source/bundle and packed-kit behavior

Comparisons below use normalized reports (excluding the timestamp field where applicable); source and generated outputs matched on the listed cases.

| Tool / case | Source | Built or unpacked output | Comparison |
|---|---:|---:|---|
| `campaign-audit`, positive `stone-tablet-siege` | rc 0 | bundle and unpacked kit rc 0 | Identical; 0 errors, 0 warnings, 3 notes |
| `campaign-audit`, negative `fmv-crossing` | rc 1 | bundle and unpacked kit rc 1 | Identical; 2 errors, 0 warnings, 3 notes |
| `cf-play check`, positive `stone-tablet-siege` | rc 0 | unpacked kit rc 0 | Identical; verdict `ok`, 0 errors, 0 warnings |
| `cf-play check`, `_tools/fixtures/cf-play-warning` | rc 1 | unpacked kit rc 1 | Identical; verdict `failed`, 0 errors, 1 warning, fatal diagnostic `warning не допускается: 1` |

The warning fixture was exercised through source cf-play and the unpacked AI kit. `npm run cf-play:negative` also compared source behavior with the checked-in standalone `public/ai/cf-play.mjs`; both rejected the fixture with the same failed verdict and warning diagnostic.

## Known failures and refusals (not reported as passes)

- `npm run smoke:campaign-fmv-audit`: rc 1. Its copied `fmv-crossing` fixture is not accepted by current source: `manifest.json/: must NOT have additional properties` and `scenes/scene_fmv_crossing.json/: must NOT have additional properties`. The rebuilt audit bundle returns the same negative result as source; the smoke's expected-positive assertion therefore remains failing. No fixture, source, or check was changed.
- `npm run check:playkit-bundle`: rc 1; the neighboring, out-of-scope `public/ai/cf-play.mjs` remains stale. Checked-in file: 1,072,558 bytes, SHA-256 `b06f8c18bf016a718345bebc677353822993576d5a05a7ad071ea6fa5695d9e1`; generated source: 1,072,575 bytes, SHA-256 `b468dd4de1836b04b898e40a1ac19a4848e3c8357a80ae6a667d95f0bf752e2e`; first difference at byte 30,373. Its behavior parity on the warning fixture passed, but its freshness check did not. It was not rebuilt because the authorized artifact is only the campaign-audit bundle.
- Exploratory `npm run audit:campaign -- public/campaigns/ash-of-caerden`: rc 1 (27 missing-image errors and 16 warnings); not used as the positive parity case. `stone-tablet-siege` is the clean positive case.
- Exploratory `cf-play example` returned rc 1 on source and unpacked kit with matching summary (3 warnings, 5 deaths, coverage 6/10); it is not counted as a passing positive check. The positive `cf-play check` case above returned rc 0.

No goldens, checks, fixtures, or unrelated bundles were altered to mask these results.

## Pull request status

- PR #171 was created successfully (`gh pr create` rc 0) from `arena/1b9e5cb0-narthex` to `main` and squash-merged successfully (`gh pr merge 171 --squash --delete-branch` rc 0) at `175e1bc0b1c58002ad813b1ac21568f98a8acebb`. PR URL: https://github.com/Creative36711/narthex/pull/171. The base before merge was `788dbc8e8e1ecab9448eca3b719e59f85e79deb8.
- `gh pr checks 171` returned rc 1: `golden-playthrough` and `screenshots` concluded failure before any job steps ran. Both check annotations state that the jobs were not started because recent account payments have failed or the spending limit needs to be increased. This is an external GitHub Actions billing gate, not a test result for the patch. Attempting to retrieve failed-job logs returned rc 1 with an EOF from the Actions log endpoint.
- The first `gh pr create` attempt returned rc 126 (`Argument list too long`) because shell quoting treated Markdown backticks as command substitutions. The submission was retried safely and succeeded; the accidental broad-build invocation is disclosed above.

## Final-main verification after squash merge

- Base SHA: `788dbc8e8e1ecab9448eca3b719e59f85e79deb8`.
- PR #171 squash-merge SHA / final main SHA for the bundle change: `175e1bc0b1c58002ad813b1ac21568f98a8acebb`.
- The PR's `git diff --stat` was:

  ```text
   _tools/reports/STAB-1.5.md   |  60 +++++++++++++++++++++++
   public/ai/campaign-audit.mjs | 112 +++++++++++++++++++++++++++++++++++++++++--
   2 files changed, 169 insertions(+), 3 deletions(-)
  ```

- Fresh `npm ci` on Node `v22.22.3` / npm `10.9.8`: rc 0.
- On that merged-main tree, `npm run check:audit-bundle` before `npm run build`: rc 0. The post-build check: rc 0.
- `npm run build`: rc 2, stopped at `tsc -b` before `build:ai-bundle` and Vite. All 12 diagnostics were in out-of-scope `src/editor/**` paths:
  1. `src/editor/DialoguePlaytest.tsx(3,36)`: TS2307, cannot find module `../core/dialogue` or its corresponding type declarations.
  2. `src/editor/PackCatalogPanel.tsx(7,72)`: TS2339, `project` does not exist on type `EditorStore`.
  3. `src/editor/PackCatalogPanel.tsx(12,22)`: TS2339, `project` does not exist on type `EditorStore`.
  4. `src/editor/PackCatalogPanel.tsx(12,51)`: TS2339, `project` does not exist on type `EditorStore`.
  5. `src/editor/PackCatalogPanel.tsx(12,101)`: TS2339, `project` does not exist on type `EditorStore`.
  6. `src/editor/PackCatalogPanel.tsx(13,13)`: TS2339, `project` does not exist on type `EditorStore`.
  7. `src/editor/PackCatalogPanel.tsx(25,62)`: TS2339, `project` does not exist on type `EditorStore`.
  8. `src/editor/PackCatalogPanel.tsx(31,56)`: TS2339, `project` does not exist on type `EditorStore`.
  9. `src/editor/PackCatalogPanel.tsx(43,48)`: TS2339, `setCapabilityMode` does not exist on type `EditorStore`.
  10. `src/editor/PackPanelWorkbench.tsx(48,28)`: TS2339, `packResolution` does not exist on type `EditorStore`.
  11. `src/editor/PackPanelWorkbench.tsx(50,23)`: TS2339, `capabilityModes` does not exist on type `EditorStore`.
  12. `src/editor/inkImport.ts(14,35)`: TS2307, cannot find module `../core/dialogue` or its corresponding type declarations.
- After that failed full build, `npm run build:ai-bundle`: rc 0; `git diff --exit-code -- public/ai/campaign-audit.mjs`: rc 0; final `npm run check:audit-bundle`: rc 0. Bundle remains 994,538 bytes with SHA-256 `a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8`.
- Final `npm run lint`: rc 0, 0 errors and 1,515 warnings. Final `npm run smoke:absence-policy`: rc 0.
- The full build diagnostics were not repaired because all are outside this task's scope; they are not described as a successful full build.
