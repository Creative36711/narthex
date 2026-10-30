# STAB-1.7 — smoke:mission loads the narrative composition root

Date: 2026-10-30
Base: `origin/main` SHA `4121b0b6d76876654a4f18ef3761ea775b10b887` (STAB-1.8).
Working branch: `arena/4bf7482f-narthex`.

## Change

`smoke:mission` now loads the actual public narrative composition root, `packs/narrative/index.ts`, in both the wrapper and each isolated smoke process. The barrel registers the existing `packs/narrative/operations.ts`; no operation implementation or smoke assertion was copied or changed.

The wrapper validates that the manifest's pack ID is registered and that `initialStateFields`, `initialRunStats`, and `initializeRuntime` exist, then prints a visible line such as:

```text
MISSION_COMPOSITION_ROOT pack=narrative operations=129 source=packs/narrative/index.ts
```

Importing the root only in the wrapper would not reach the 55 child npm processes. The wrapper therefore appends `--import=tsx --import=<absolute packs/narrative/index.ts>` to `NODE_OPTIONS` for each child. The children remain separate and serial, preserving the existing process isolation. The 55-entry list, per-command RC collection, summary rule, and all smoke assertions are unchanged. No smoke is skipped, xfailed, or weakened; no empty assertion was added. `package.json`, `packs/**`, `src/**`, `.golden/**`, and public bundles were not edited.

**Допущение:** the public narrative barrel is the appropriate real composition root for this headless suite. Its existing source comment describes the same idempotent registration used by direct composition roots; runtime verification found the manifest ID `narrative` and all 129 registered operations.

## Results

The task prompt cites the older `22/55` result. On the fresh base SHA above, after `npm ci`, the measured no-composition-root baseline was **25/55**, `npm run smoke:mission` rc 1. I report the observed current-main baseline rather than carrying forward the older count.

A temporary, untracked negative-control preload registered the `narrative` ID with only one sentinel `emptyControl` operation and no real narrative operations. All 55 probes still ran; the result was **24/55**, rc 1. The control was outside the repository and is not used by the normal wrapper.

With the real narrative composition root, the final `npm run smoke:mission` run reported **40/55**, rc 1. This exceeds the 38/55 floor, but is not reported as a green suite: 15 existing probes still return rc 1. Exactly 15 previously failing probes were revived by loading the pack:

- `smoke:currency`
- `smoke:quest-journal-runtime`
- `smoke:voice-dedup`
- `smoke:hero-appearance`
- `smoke:dialogue-transitions`
- `smoke:dialogue-skip`
- `smoke:stranger`
- `smoke:encumbrance`
- `smoke:cutscene-queue`
- `smoke:spoil`
- `smoke:time-semantics`
- `smoke:core`
- `smoke:dlg-ui`
- `smoke:duration-actions`
- `smoke:craft-fail-time`

The complete per-probe RC comparison is below (`0` means that probe exited successfully; `1` means it did not).

| Probe | Before | After composition root |
|---|---:|---:|
| `smoke:currency` | 1 | 0 |
| `smoke:ink-import` | 0 | 0 |
| `smoke:fingerprint` | 0 | 0 |
| `smoke:book-md` | 0 | 0 |
| `smoke:campaign-index` | 0 | 0 |
| `smoke:guide` | 0 | 0 |
| `smoke:design-doc` | 1 | 1 |
| `smoke:quest-journal` | 0 | 0 |
| `smoke:quest-journal-runtime` | 1 | 0 |
| `smoke:p2` | 1 | 1 |
| `smoke:ai-runtime` | 1 | 1 |
| `smoke:ai-task` | 1 | 1 |
| `smoke:char-templates` | 0 | 0 |
| `smoke:no-campaign` | 0 | 0 |
| `smoke:chronicle-manifest` | 0 | 0 |
| `smoke:dialogues-r31` | 1 | 1 |
| `smoke:dialogues-r32` | 1 | 1 |
| `smoke:breathe-toggle` | 1 | 1 |
| `smoke:scene-subtitles` | 0 | 0 |
| `smoke:scene-editor` | 0 | 0 |
| `smoke:editor-hotspot` | 0 | 0 |
| `smoke:voice-dedup` | 1 | 0 |
| `smoke:narrative-intro` | 1 | 1 |
| `smoke:encounters-loader` | 1 | 1 |
| `smoke:manifest-order` | 0 | 0 |
| `smoke:engine-version` | 0 | 0 |
| `smoke:hero-appearance` | 1 | 0 |
| `smoke:theme-contrast` | 0 | 0 |
| `smoke:dialogue-transitions` | 1 | 0 |
| `smoke:dialogue-skip` | 1 | 0 |
| `smoke:travel-transition` | 0 | 0 |
| `smoke:stranger` | 1 | 0 |
| `smoke:encumbrance` | 1 | 0 |
| `smoke:cutscene-queue` | 1 | 0 |
| `smoke:spoil` | 1 | 0 |
| `smoke:time-semantics` | 1 | 0 |
| `smoke:ai-diff` | 0 | 0 |
| `smoke:view-write` | 0 | 0 |
| `smoke:core` | 1 | 0 |
| `smoke:saves-compat` | 1 | 1 |
| `smoke:pack-missing` | 1 | 1 |
| `smoke:pack-panels` | 0 | 0 |
| `smoke:capability-modes` | 1 | 1 |
| `smoke:dlg-script` | 0 | 0 |
| `smoke:dlg-ui` | 1 | 0 |
| `smoke:folder-import` | 0 | 0 |
| `smoke:narrative-builder` | 0 | 0 |
| `smoke:patch` | 0 | 0 |
| `smoke:cutout` | 0 | 0 |
| `smoke:duration-actions` | 1 | 0 |
| `smoke:craft-fail-time` | 1 | 0 |
| `smoke:dialogue-speaker` | 1 | 1 |
| `smoke:narthex-closed` | 1 | 1 |
| `smoke:narthex-tech` | 0 | 0 |
| `smoke:drive-gateway` | 1 | 1 |

Remaining rc-1 probes after root load: `smoke:design-doc`, `smoke:p2`, `smoke:ai-runtime`, `smoke:ai-task`, `smoke:dialogues-r31`, `smoke:dialogues-r32`, `smoke:breathe-toggle`, `smoke:narrative-intro`, `smoke:encounters-loader`, `smoke:saves-compat`, `smoke:pack-missing`, `smoke:capability-modes`, `smoke:dialogue-speaker`, `smoke:narthex-closed`, and `smoke:drive-gateway`. They were not muted or changed under this scope.

## Commands and return codes

| Command | RC | Result |
|---|---:|---|
| `git fetch origin main` | 0 | Fetched current main. |
| Initial `git merge-base HEAD origin/main` | 1 | Empty result: the assigned Arena branch was a grafted snapshot. |
| Initial `git status --short` | 0 | Clean; no uncommitted changes to preserve. |
| `git reset --hard origin/main` | 0 | Reset in place to the fresh base SHA above while retaining the assigned Arena branch name. |
| Post-reset `git diff --stat origin/main` | 0 | Empty, as expected for the clean base. |
| `npm ci` | 0 | Node `v22.22.3`, npm `10.9.8`; 4 dependency advisories were reported. |
| Baseline `npm run smoke:mission` | 1 | `SUMMARY 25/55 passed; rc=1`. |
| Empty-pack negative-control `npm run smoke:mission` | 1 | `SUMMARY 24/55 passed; rc=1`; only the temporary sentinel operation was registered. |
| Final `npm run smoke:mission` | 1 | `SUMMARY 40/55 passed; rc=1`; 55/55 probes executed, 15 remain red. |
| `npx tsc -b` | 0 | TypeScript build succeeded on the current base and wrapper change. |
| `npm run lint` | 0 | 0 errors, 1,515 warnings. |
| `npm run check:audit-bundle` | 1 | Existing out-of-scope audit bundle is stale: committed 994,538 bytes / SHA-256 `a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8`; generated 1,002,333 bytes / SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`; first differing byte 10,267. It was not rebuilt because `public/**` is outside this task's scope. The check itself was not changed. |
| `git diff --check` | 0 | No whitespace errors. |

The audit bundle mismatch is recorded as a failure, not a pass; neither `public/ai/**` nor its oracle was changed. The final patch is limited to `scripts/mission-smokes.mts` and this report.
