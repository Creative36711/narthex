# STAB-1.1 — Воспроизводимый audit bundle

- Dispatch: `4096f0cf-5705-8171-a701-db36beb0d346`
- Run: `432f7d70-5b5b-46fc-99e2-b87476499a1d`
- Branch: `arena/e984bc10-narthex`
- Assigned task checkout/base SHA: `7083686f08d3a160eb60195ed02312c88049c026`
- `main` tip / PR target at validation: `407a4c7e671f0f54948463ca8138a5b989fa19ab`; merge-base is the assigned base SHA above.
- PR: [#166](https://github.com/Creative36711/narthex/pull/166) (squash-merge SHA is post-merge metadata; it is recorded in the task Answer and Drive copy after the merge, not guessed here).
- Runtime: Node `v22.22.3`, npm `10.9.8`.

## Result

The committed `public/ai/campaign-audit.mjs` was stale. It was regenerated only by the repository command `npm run build:ai-bundle`; the generated file now matches `scripts/campaign-audit.mts` byte-for-byte. The second standard build reproduced the same SHA-256 and left the tracked bundle clean. The lint warning count stayed at the `297eaba` baseline while lint errors went from 2 to 0.

## Reproduction and validation

| Command / context | Exit code | Result |
|---|---:|---|
| `node --version` / `npm --version` | 0 / 0 | `v22.22.3` / `10.9.8` |
| `npm ci` on the clean assigned checkout at `7083686f08d3a160eb60195ed02312c88049c026` | 0 | Fresh install; no dependency changes |
| `npm run check:audit-bundle` before rebuilding | 1 (expected stale-bundle failure) | Committed bundle: 981,858 bytes, SHA-256 `1348888ef4974477e0b50f04833a6c1b11dfb1a8f3e7b53cc9e3b11071929a7a`; generated source output: 981,858 bytes, SHA-256 `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`; first differing byte: 145,633 |
| `npm run lint` before rebuilding at the assigned base | 1 | 1,515 warnings; 2 errors |
| `npm ci` at baseline commit `297eaba6833ad13bab52eb93a205046fed3f0cce` (Node `v22.22.3`) | 0 | Fresh baseline install |
| `npm run lint` at baseline `297eaba6833ad13bab52eb93a205046fed3f0cce` | 1 | 1,515 warnings; 2 errors |
| `npm run build:ai-bundle` (first build) | 0 | Standard build regenerated `public/ai/campaign-audit.mjs`; no hand edit |
| `npm run check:audit-bundle` after the first build | 0 | Byte-for-byte equality; 981,858 bytes, SHA-256 `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f` |
| `npm run lint` after the first build | 0 | 1,515 warnings; 0 errors (warnings unchanged vs `297eaba`) |
| `npm run build:ai-bundle` after committing the generated bundle as `aa00c641a2e3aa52542cdecc44598bba44de7c15` (repeat build) | 0 | SHA-256 before: `c857e5f4988fc33ef8d371c93a38617f81aedb32c1f7548b0f25a8a9895ea67f`; after: the same SHA-256 |
| `git status --porcelain -- public/ai/campaign-audit.mjs` after repeat build | 0 | Empty stdout |
| `npm run check:audit-bundle && npm run lint && npm run smoke:absence-policy` after repeat build | 0 | Audit-bundle equality passed; lint reported 1,515 warnings / 0 errors; absence-policy smoke passed |
| `git diff --check` | 0 | No whitespace errors |

Lint comparison: `297eaba` **2 errors / 1,515 warnings** → regenerated bundle **0 errors / 1,515 warnings**. Warning delta: **0**.

## Scope and bypass audit

The implementation change is only the standard-build output `public/ai/campaign-audit.mjs`. `scripts/campaign-audit.mts` and the audit/absence-policy behavior remain unchanged. No dependencies, lint configuration/rules, `check:audit-bundle`, `smoke:absence-policy`, their fixtures, source files, campaigns, protected baselines, golden scripts, or workflows were changed. No lint suppression, ignore, exception, or weakened check was introduced. The report itself is the only additional in-scope file.

PR three-dot diff stat (merge-base `7083686f08d3a160eb60195ed02312c88049c026`; `main` tip `407a4c7e671f0f54948463ca8138a5b989fa19ab`):

```text
_tools/reports/STAB-1.1.md   | 51 ++++++++++++++++++++++++++++++++++++++++++++
 public/ai/campaign-audit.mjs |  6 +++---
 2 files changed, 54 insertions(+), 3 deletions(-)
```

## Out of scope

The `tsc`, contracts, module-size, ScriptCat, guide, and campaigns gates were not run or certified by this task; no claim that they are green is made, and no fixes were attempted. `npm ci` reported 4 dependency advisories (1 moderate, 1 high, 2 critical); dependency changes are outside this task's scope.

The actual squash-merge SHA and merged PR state are added to the Notion Answer and the Drive report after GitHub completes the merge.
