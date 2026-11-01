# STAB-1.36 — strengthen `narthex-log-answer-smoke`

**Status:** implemented; negative control reproduced and rejected; full §4 passed.

## Change

`_tools/ScriptCat/tests/narthex-log-answer-smoke.mjs` now extracts and executes the actual `submitExecutor` function from `narthex.user.js` with test stubs up to the `appendToJournal` boundary. The test intercepts the actual five arguments and asserts that the fifth argument contains the assembled report, the marker message, and the multi-message `partsNote`. The interception throws a sentinel before any Drive or Notion write.

All prior assertions remain. The probe is stronger, not weaker; no production source, other ScriptCat test, protected campaign, bundle, or §4 command was edited.

## Negative-control proof

Before the test change, I copied the userscript and smoke to `/tmp/stab136-before.C5FwKy/` and changed only that temporary userscript: the formatted journal template was retained in an unused `unusedEntry` variable while the fifth argument to `appendToJournal` was changed to `""`. No temporary mutation was made in the repository.

**Before the fix**, that broken variant passed the old test:

```text
$ node /tmp/stab136-before.C5FwKy/_tools/ScriptCat/tests/narthex-log-answer-smoke.mjs
OK: narthex 1.4.90 — журнал хода собирается из всех ответов, маркер без отчёта не считается ответом, напоминание требует отчёт целиком
rc=0
```

**After the fix**, the same temporary broken userscript was tested with the strengthened smoke. It failed on the actual captured fifth argument, not on a source-text warning:

```text
$ node /tmp/stab136-before.C5FwKy/_tools/ScriptCat/tests/narthex-log-answer-smoke.mjs
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: appendToJournal actual entry argument must contain the assembled report body (not an unused template)
    at file:///tmp/stab136-before.C5FwKy/_tools/ScriptCat/tests/narthex-log-answer-smoke.mjs:206:10 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v22.22.3
rc=1
```

The positive control on the unmodified, correct userscript passed:

```text
$ node _tools/ScriptCat/tests/narthex-log-answer-smoke.mjs
OK: narthex 1.4.90 — журнал хода собирается из всех ответов, маркер без отчёта не считается ответом, напоминание требует отчёт целиком
rc=0
```

Thus the before/after negative-control runs differ by return code (`0` → `1`), and the correct variant remains `rc=0`.

## Full ScriptCat suite

The §4 ScriptCat loop executed all **71** `_tools/ScriptCat/tests/*.mjs` files: **71 passed, 0 failed** (`rc=0`). The new failure is an assertion failure, not a warning or residual allowance.

## §4 run

Full §4 was run in the required order on tested code/test SHA **`2ee9a61cdfd54dd7bd8aa6b44cb7a534ed615967`**, branch `arena/de66f7eb-narthex`, on 2026-11-01 UTC. Environment: Node `v22.22.3`, npm `10.9.8`. All **21/21** commands returned `rc=0`.

| # | §4 command | Start UTC | End UTC | Seconds | rc |
|---:|---|---:|---:|---:|---:|
| 1 | `npm ci` | 12:21:54 | 12:22:01 | 7 | 0 |
| 2 | `npm run check:audit-bundle` (pre-build) | 12:22:01 | 12:22:04 | 3 | 0 |
| 3 | `npx tsc -b` | 12:22:04 | 12:22:21 | 17 | 0 |
| 4 | `for t in _tools/ScriptCat/tests/*.mjs; do node "$t" || exit 1; done` (71 files) | 12:22:21 | 12:22:32 | 11 | 0 |
| 5 | `npm run check:contracts` | 12:22:32 | 12:22:49 | 17 | 0 |
| 6 | `npm run check:core-graph` | 12:22:49 | 12:22:49 | 0 | 0 |
| 7 | `npm run check:module-size` | 12:22:49 | 12:22:49 | 0 | 0 |
| 8 | `npm run check:brand` | 12:22:49 | 12:22:50 | 1 | 0 |
| 9 | `npm run check:version` | 12:22:50 | 12:22:50 | 0 | 0 |
| 10 | `npm run check:guide` | 12:22:50 | 12:22:57 | 7 | 0 |
| 11 | `npm run check:playkit-bundle` | 12:22:57 | 12:22:58 | 1 | 0 |
| 12 | `npm run check:campaigns` | 12:22:58 | 12:22:58 | 0 | 0 |
| 13 | `npm run check:compat-corpus` | 12:22:58 | 12:23:03 | 5 | 0 |
| 14 | `npm run check:narrative-codes` | 12:23:03 | 12:23:03 | 0 | 0 |
| 15 | `npm run smoke:core` | 12:23:03 | 12:23:04 | 1 | 0 |
| 16 | `npm run smoke:mission` | 12:23:04 | 12:24:51 | 107 | 0 |
| 17 | `npm run cf-play:negative` | 12:24:51 | 12:24:53 | 2 | 0 |
| 18 | `npm run lint` | 12:24:53 | 12:24:54 | 1 | 0 |
| 19 | `npm run build` | 12:24:54 | 12:25:15 | 21 | 0 |
| 20 | `npm run check:audit-bundle` (post-build) | 12:25:15 | 12:25:17 | 2 | 0 |
| 21 | `npm run check:mission` | 12:25:17 | 12:28:09 | 172 | 0 |

### Standard-build bundle audit

The tracked `public/ai/campaign-audit.mjs` matched the required baseline before and after the standard build:

- Baseline and pre-build SHA-256: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`.
- Post-build SHA-256: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`.
- `check:audit-bundle`: pre-build `rc=0`; post-build `rc=0`.
- `cmp` pre/post: `0`; post-build bundle against the tracked baseline: `0`.

No §4 command was added, removed, reordered, or weakened.

## PR and SHA interpretation

**PR:** pending creation; this field will be updated with the actual PR number before merge.

The card requires both that this report be in the same PR and that it name the squash merge SHA. Those requirements conflict: GitHub creates the squash commit only after merging, and the report is part of the tree whose SHA would need to be written into itself. Within the authorized scope (one PR, this report plus the single test change, and no manual Notion-field edits), I interpret the card's “merge SHA” as the tested PR-head/code SHA selected for merge: **`2ee9a61cdfd54dd7bd8aa6b44cb7a534ed615967`**. This is the SHA where §4 actually ran; it is not represented as the eventual GitHub-generated squash commit SHA. The actual squash SHA will be reported in the completion response from GitHub PR metadata, rather than falsely asserted here or requiring a second/out-of-scope PR.

The intended PR diff is limited to `_tools/ScriptCat/tests/narthex-log-answer-smoke.mjs` and `_tools/reports/STAB-1.36.md`.
