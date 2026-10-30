# STAB-1.8 — Studio: `tsc -b` green (12 diagnostics in `src/editor`)

## Result and scope

- Mission: STAB-1, step 1 of the repair order (`docs/agents/tz-stab-1.md` §5, card «Редактор, player и общие модули (Studio)»).
- Base: `origin/main` = `6a98572cdb31d08fadd5d764e26a0a6a2c43bc98` (`STAB-1.5: record final main verification (#172)`). The session branch started as a snapshot without shared history, so it was reset to `origin/main` (`git merge-base` empty → `git reset --hard origin/main`); `git diff --stat main` was empty before any edit.
- Runtime: Node `v22.22.3`, npm `10.9.8`; `npm ci --no-audit --no-fund` rc 0.
- Write zone honoured: only `src/editor/**`, this report, and the ambiguity record `docs/decisions/STAB-1.8.md`. No `tsconfig*`, `package.json`, `src/core/**`, `src/shared/**`, `packs/**`, `public/**`, `.golden/**`, `docs/contracts/**`, `.github/**` changes.
- Result: `npx tsc -b` rc 0 with **zero diagnostics** (was rc 2 with exactly the 12 listed ones); `npm run build` rc 0; `npm run lint` rc 0 / 0 errors; three previously red smokes turned green and none regressed.
- One oracle item cannot be met inside the card and is reported as a blocker instead of being papered over: `npm run check:audit-bundle` rc 1, because `src/editor/store.ts` is inside the audit-bundle graph and the card forbids rebuilding `public/ai/*`. Details in «Known failures and refusals».

Working-tree diff (only `src/editor`, before the report/decision commit):

```
 src/editor/DialoguePlaytest.tsx |   2 +-
 src/editor/EditorApp.tsx        |  40 +++++++++--
 src/editor/inkImport.ts         |   2 +-
 src/editor/store.ts             | 148 ++++++++++++++++++++++++++++++++++++++--
 4 files changed, 179 insertions(+), 13 deletions(-)
```

Merged state additionally contains `_tools/reports/STAB-1.8.md` and `docs/decisions/STAB-1.8.md`.

## Root cause

`2344bcf` (GOLD-1, «green oracle lock») restored an older revision of `src/editor/` and, in doing so, deleted the editor↔pack plumbing from `src/editor/store.ts` and `src/editor/EditorApp.tsx` and moved `src/core/dialogue.ts` to `packs/narrative/dialogue.ts` (−277 lines across `src/editor`). The pack panels (`PackCatalogPanel.tsx`, `PackPanelWorkbench.tsx`) and the dialogue consumers were **not** reverted, so they kept calling an API that no longer existed:

- `EditorStore` lost `project`, `packResolution`, `capabilityModes`, `setCapabilityMode`, the optional ctor resolvers, and all `project.json` load/save/undo/`fileText`/`hasFile`/`allPaths` handling.
- Two modules still imported `../core/dialogue`, a file that no longer exists.

`c501d32` (NAR-2.8, the commit immediately before `2344bcf`) is the last state in which these panels and the store worked together, so the store/EditorApp API was restored from it (`git checkout c501d32 -- src/editor/store.ts`, then re-applied by hand into `EditorApp.tsx`) and merged with every later non-editor change.

## How each of the 12 diagnostics was fixed

| # | Diagnostic | Fix |
|---|---|---|
| 1 | `DialoguePlaytest.tsx(3,36)` TS2307 `Cannot find module '../core/dialogue'` | Import `clearDialogueCache` from the module's real home `../../packs/narrative/dialogue` (same source the `packs/narrative/index` barrel re-exports; `src/player/{DialogueOverlay,useDialogueAudio}.tsx` already import from that barrel). |
| 2 | `inkImport.ts(14,35)` TS2307 `Cannot find module '../core/dialogue'` | Same: `cleanDialogueLine` imported from `../../packs/narrative/dialogue`. |
| 3–9 | `PackCatalogPanel.tsx` (7,72) (12,22) (12,51) (12,101) (13,13) (25,62) (31,56) TS2339 `Property 'project' does not exist on type 'EditorStore'` | Restored `project: ProjectPackInput`, `projectOriginal`, `projectOriginalText`, `projectFileExists`, the optional `resolvePack`/`resolveModes` constructor arguments, and the `project.json` lifecycle: load (parse, 404 ⇒ format-1 default `{kind:'narrative'}`, HTML fallback, damaged-file error), `setJson`/`fileText`/`hasFile`/`allPaths`/`undo`/`categorizePath`/`titleForPath`. |
| 10 | `PackCatalogPanel.tsx(43,48)` TS2339 `setCapabilityMode` | Restored `EditorStore.setCapabilityMode(capabilityId, mode, availableCaps, requiredCaps)` including the pack-membership and required-capability refusals, the format-2 manifest bootstrap, the original-mode restoration, and the invalid-resolution error from `core/pack/capability-modes`. |
| 11–12 | `PackPanelWorkbench.tsx(48,28)` TS2339 `packResolution`, `(50,23)` TS2339 `capabilityModes` | Restored `packResolution: ProjectPackResolution \| null` and `capabilityModes: CapabilityModesResolution \| null`, resolved in `load()` through the injected resolvers; a `missing` pack stops the load early, an `invalid` resolution throws its own message. |

No `@ts-ignore`, `@ts-expect-error`, `any` cast, file rename, file deletion or probe weakening was added: the diff contains 0 added lines matching `as any|@ts-ignore|@ts-expect-error`. `tsconfig*` is untouched. The two panels themselves are byte-identical to the `check-module-size` baseline (`263d4934…`, `58c6e41c…`), i.e. the probes were not changed to match a broken API — the API was restored.

`src/editor/EditorApp.tsx` had to be re-wired for the restored API, otherwise the panels are unreachable and the store never receives resolvers:

- imports of `PackCatalogPanel`, `PackPanelWorkbench`, `PackMissingNotice`, `resolveProjectPackForStudio`, `resolveProjectModesForStudio`;
- menu items `{ id: 'packs', label: 'Каталог паков' }` and `{ id: 'panels', label: 'Панели пака' }` in «Проект»; both sections render their panel in the main pane and are excluded from the document auto-select and from the file list, exactly like `campaign`/`world`/`combat`/`design`;
- `new EditorStore(base, resolveProjectPackForStudio, resolveProjectModesForStudio)`;
- `PackMissingNotice` gate when `store.packResolution.status === 'missing'`;
- playtest carries the project caps into the runtime profile the way `src/core/caps.ts` reads it (`meta.caps` from `activeCaps`, `meta.project_cap_options` from `project.cap_options`) and reports an invalid resolution as a playtest problem;
- `questsOff` read-only gating for the quests section (button disabling + read-only document view), driven by `store.capabilityModes.modes.quests === 'off'` — no hardcoded pack or panel ids.

Behaviour was not redesigned: every restored branch is the `c501d32` branch. Two deliberate, documented deviations are listed in the next section.

## Assumptions (неясно / решил / откат)

1. **Bundle rebuild vs. bundle prohibition.** *Неясно:* the card requires `npm run check:audit-bundle` rc 0 **and** forbids rebuilding `public/ai/*`, but `scripts/campaign-audit.mts:353` does `await import('../src/editor/store')`, so `store.ts` is bundled into `public/ai/campaign-audit.mjs`; any honest restore of the store makes the checked-in bundle stale. *Решил:* keep the published artifact untouched (the explicit prohibition wins, and the mission assigns bundle coherence to the Tools «Согласованность сборки» card), report rc 1 with exact figures. *Откат:* `npm run build:ai-bundle` in a build/tools card — nothing to revert, the file is untouched.
2. **`panels` and auto-select.** *Неясно:* `c501d32` excluded `packs` but not `panels` from the document auto-select effect although its file list excluded both. *Решил:* exclude both (a section whose main pane is a workbench must not silently change the selected document). *Откат:* delete `'panels'` from the array at `EditorApp.tsx` (one token).
3. **`setCapabilityMode` write path.** *Неясно:* `c501d32` wrote `project.json` with a private field assignment plus `this.touch('project.json')`; `scripts/view-write-smoke.mts` rejects any new `.touch(` call site outside its whitelist (and the whitelist file is out of zone). *Решил:* route the write through the existing internal `setJson('project.json', …)`, which performs exactly the same sequence (`project`/`projectFileExists`/`capabilityModes` update, then `touch`), so the invariant «просмотр ≠ запись» stays green without editing the smoke. *Откат:* replace the `setJson` call with the three field assignments plus `touch` and add the whitelist entry in the same change.
4. **Brand strings.** *Неясно:* the same GOLD-1 revision left `Chronicle Forge` / `.chronicle` in `EditorApp.tsx` even though `scripts/brand-guard.mts` now treats those as the old brand. *Решил:* do not rename product text in a `tsc`-repair card — `npm run check:brand` is red on `main` with 298 hits before and after this patch, and the brand file list belongs to the «Согласованность сборки и проверок» card. *Откат:* re-run `npm run check:brand` and hand the file list to the brand card.

## Commands and return codes

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | rc 0 |
| `npx tsc -b` before the fix | rc 2, exactly 12 diagnostics (2× TS2307, 8× TS2339 in `PackCatalogPanel`, 2× TS2339 in `PackPanelWorkbench`) |
| `npx tsc -b` after the fix | rc 0, 0 bytes of output |
| `npx tsc -b --force` (clean, no incremental cache) | rc 0, 0 bytes of output |
| `npm run build` (`tsc -b && build:ai-bundle && vite build`) | rc 0; `✓ built in 4.29s`; `EditorApp-*.js` 1,438.32 kB emitted |
| `npm run lint` | rc 0; **0 errors**, 1,515 warnings (identical count to the pre-edit baseline) |
| `npx oxlint` on the four changed files | 0 errors, 3 warnings (all pre-existing hook-rule notes) |
| `npm run -s check:audit-bundle` | **rc 1** — see blocker below (was rc 0 before the fix) |
| `npm run -s check:module-size` | rc 1, the same 11 over-limit modules as the baseline; `store.ts` 1267→1407, `EditorApp.tsx` 1368→1396 (debt assigned to the «Пределы модулей» card) |
| `npm run -s check:core-graph` | rc 0 (`Core graph OK (37 modules; acyclic)`) |
| `npm run -s check:pack-boundary` | rc 0 (37 source files; no pack-id branches) |
| `npm run -s check:contracts` | rc 1 before and after: `docs/decisions/GOLD-1.6c.md: unsupported status "accepted (2026-10-29)…"` — pre-existing, untouched file |
| `npm run -s check:brand` | rc 1 before and after: 298 legacy-brand hits (unchanged) — pre-existing, other card |
| `npm run -s smoke:view-write` | rc 0 (`все вызовы .touch( в src/editor объяснены действием мастера (42 сайтов)`) |

### Smoke baseline (all 73 `npm run -s smoke:*`)

The sweep was run twice — once on the untouched base (`/tmp/base`) and once with the patch (`/tmp/after`) — because 47 of the 73 fail on `main` for reasons unrelated to this card (engine `PACK_OPERATION_MISSING`, the deleted `src/core/dialogue`, strict audit warnings on the Ash fixture, missing ScriptCat fixtures, no browser in the sandbox).

| | base | after |
|---|---:|---:|
| green | 26 | **29** |
| red | 47 | 44 |

Flipped by this patch (no other smoke changed state, none regressed):

| Smoke | base | after |
|---|---:|---:|
| `smoke:ink-import` | rc 1 (`ERR_MODULE_NOT_FOUND … src/core/dialogue`) | rc 0 (`все проверки зелёные`) |
| `smoke:dlg-script` | rc 1 | rc 0 (`мастерский сценарий: все проверки зелёные`) |
| `smoke:pack-panels` | rc 1 | rc 0 (`PACK_PANELS_SMOKE passed`, incl. «проект открывается и сохраняется без потерь полей» — 98 files, `diff полей пуст`, and «студия не знает имён паков и панелей» — 0 id branches) |

`smoke:capability-modes` and `smoke:pack-missing` are still rc 1 but now progress further: they pass the capability/`PACK_MISSING` sections restored here and stop at the unchanged pre-existing strict-warning assertion of `Проверка кампании · Пепел Каэрдена` (`✗ warning не допускается: 3`, three `flag_written_never_read` findings) — the same assertion that fails on the untouched base. `smoke:campaign-start` rc 2 = `Chromium не запустился: Не найден пакет @sparticuz/chromium` (no browser in the sandbox, pre-existing).

## Known failures and refusals (not reported as passes)

- **`npm run check:audit-bundle` rc 1 — blocker, needs the Tools bundle card.** `public/ai/campaign-audit.mjs` is untouched (still 994,538 bytes, SHA-256 `a175060b65e1ae13e567c2c0c73664c994a33738b0f9023b95c6b8ff18d1dce8`); the generator now produces 1,002,333 bytes, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`, first differing byte 10,267. Proof of cause: with only `src/editor/store.ts` reverted to `HEAD`, `check:audit-bundle` returns rc 0, and with the patch restored the generated/committed delta is 16 hunks / 134 lines, every one of them the restored `project`/`capabilityModes`/`packResolution`/`projectCapabilityMode` code (`setCapabilityMode`, `project.json`, `cap_options`, `resolveModes`, …). Fix belongs to the owner of `public/ai/*`: run `npm run build:ai-bundle` after this merge (the `npm run build` target already does it; this repository's `build` regenerated the file during verification and the artifact was restored with `git checkout -- public/ai/campaign-audit.mjs` to keep the PR inside its zone).
- `10` `_tools/ScriptCat/tests/*.mjs` and 44 smokes remain red for the pre-existing reasons listed above; they were neither «fixed» by weakening them nor counted as passes.
- Module-size debt (`store.ts` 1407, `EditorApp.tsx` 1396, 9 other files) was left untouched. Splitting those modules is a separate card in the same mission and cannot be done inside a `tsc`-repair step without moving files the card forbids renaming.

## Pull request status

- Work branch: `arena/7bce56fb-narthex`, reset to `origin/main` `6a98572cdb31d08fadd5d764e26a0a6a2c43bc98` before the first edit (the session branch started as a snapshot with no shared history); it carries the STAB-1.8 commit and is the only branch pushed.
- PR #173 → `main` (https://github.com/Creative36711/narthex/pull/173), squash-merged with `gh pr merge 173 --squash --delete-branch`; the merge SHA is reported in the session answer together with `gh pr view 173 --json mergeCommit`.
