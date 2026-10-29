# NAR-2.15 — verification evidence

Date: 2026-10-25. Branch: `arena/3746435c-narthex`.

## Implemented

- Added one authoritative 28-entry narrative diagnostic catalog in `scripts/playkit/narrative-codes.ts`; analyzer findings use its IDs and `cf-play explain <code>` uses its explanations. Unknown IDs return 2 and print the sorted catalog.
- Added `cf-play example` with the Ash of Caerden benchmark. It uses the same fixed seeds and step count as the recorded reference and does not write a report into the campaign.
- Added `check:narrative-codes` and `check:guide`. The latter executes all six quickstart commands, validates benchmark output and every `explain` ID, checks the unknown-ID exit code/list, builds the AI kit, unpacks it, and repeats the checks there. Hidden `.cf-play` artifacts are excluded from the kit.
- Added `docs/guides/nar-2.15-playkit.md`, included as `CF-PLAY-TOOLS.md` in the kit, and made `pack:ai-kit` include a self-contained published benchmark copy. `sync:ai-kit` was exercised against a temporary destination and copied 109 files, including the nested example.
- Added `docs/decisions/NAR-2.15.md`: proposes 294,912 bytes for the full guide but explicitly leaves the 71,680-byte limit and its gate unchanged. Both full-guide copies remain byte-identical at 268,683 bytes.
- No changes to packs, registry, campaign data, engine/core, or the full campaign-guide source/copy.

## Required commands and exact results

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | exit 0; no diagnostics |
| `npm run build` | exit 0; Vite reported `✓ built in 2.88s` |
| `npm run build:playkit-bundle && npm run check:playkit-bundle` | exit 0; `✓ public/ai/cf-play.mjs совпадает со сборкой из src (0.9.0, sha256 5ac280bfc3ea9c5b937143249c6f114f7b59840c939e3741ba2c7b4669968945)` |
| `npm run check:narrative-codes` | exit 0; `✓ narrative explain: 28 кодов; валидатор использует тот же каталог, документация содержит только один исполняемый пример` |
| `npm run check:guide` | exit 0; `✓ check:guide: 6 команд (исходники, bundle, распакованный kit); explain=28; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10` |
| `npm run check:packs` | exit 0; `check:packs passed` |
| `npm run check:campaigns` | exit 0; adventure 100/100, narrative Ash of Caerden 99/99, fmv-crossing 12/12 files match; `3 из 3 сверены` |
| `npm run check:contracts` | exit 0; `контракты согласованы: 41 проверок`; nested `check:packs` also passed |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | exit 0; output excerpt below |

```text
✓ проверка пройдена
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
seed'ов 5 · исходы {"death":5}
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp
```

The complete run also reported five deaths, all eight existing `flag_written_never_read` warnings, and the same four uncovered scenes. `npm run play -- example` and the bundled `node public/ai/cf-play.mjs example` produced the same benchmark summary: `Эталон: 10 сцен · 8 локаций · 6 диалогов · 21 ink · ошибок 0 · предупреждений 8 · смертей 5 · покрытие 6 из 10`.

`node public/ai/cf-play.mjs explain ink_missing_knot` returned 0 and printed the explanation, cause, location, and fix. `check:guide` also invoked each of the 28 catalog IDs from the unpacked bundle and asserted rc 0; for `__unknown_narrative_code__` it asserted rc 2, the `Известные коды narrative (28):` heading, and presence of every catalog ID in the output.

## Smoke and probe evidence

A serial run invoked every script whose package name starts with `smoke:` or `probe:` using `npm run --silent <name>`, with the Vite dev server available for tests that exercise editor endpoints. Exact aggregate output: `SUMMARY 65/65 passed` (55 smoke scripts, 10 probes).

Smoke scripts: `smoke:currency`, `smoke:ink-import`, `smoke:fingerprint`, `smoke:book-md`, `smoke:campaign-index`, `smoke:guide`, `smoke:design-doc`, `smoke:quest-journal`, `smoke:quest-journal-runtime`, `smoke:p2`, `smoke:ai-runtime`, `smoke:ai-task`, `smoke:char-templates`, `smoke:no-campaign`, `smoke:chronicle-manifest`, `smoke:dialogues-r31`, `smoke:dialogues-r32`, `smoke:breathe-toggle`, `smoke:scene-subtitles`, `smoke:scene-editor`, `smoke:editor-hotspot`, `smoke:voice-dedup`, `smoke:narrative-intro`, `smoke:encounters-loader`, `smoke:manifest-order`, `smoke:engine-version`, `smoke:hero-appearance`, `smoke:theme-contrast`, `smoke:dialogue-transitions`, `smoke:dialogue-skip`, `smoke:travel-transition`, `smoke:stranger`, `smoke:encumbrance`, `smoke:cutscene-queue`, `smoke:spoil`, `smoke:time-semantics`, `smoke:ai-diff`, `smoke:view-write`, `smoke:core`, `smoke:saves-compat`, `smoke:pack-missing`, `smoke:pack-panels`, `smoke:capability-modes`, `smoke:dlg-script`, `smoke:dlg-ui`, `smoke:folder-import`, `smoke:narrative-builder`, `smoke:patch`, `smoke:cutout`, `smoke:duration-actions`, `smoke:craft-fail-time`, `smoke:dialogue-speaker`, `smoke:narthex-closed`, `smoke:narthex-tech`, `smoke:drive-gateway`.

Probe scripts: `probe:capability-modes`, `probe:pack-host`, `probe:pack-execution`, `probe:pack-operations`, `probe:pack-move`, `probe:narrative-pack`, `probe:fmv`, `probe:fmv-passport`, `probe:adventure`, `probe:adventure-mechanics`.

`smoke:cutout` returned 0 and reported `SKIP функциональных тестов: у интерпретатора [python3] нет Pillow`; its guide anchors, utility identity, and static checks passed. The AI-task smoke passed with the local dev server running and restored the campaign index.

## Additional checks and known unrelated baseline issues

- `npx oxlint scripts/pack-ai-kit.mts scripts/playkit/analyze.ts scripts/playkit/cli.mts scripts/playkit/narrative-codes.ts scripts/check-guide.mts scripts/check-narrative-codes.mts` returned 0: `Found 0 warnings and 0 errors.`
- `git diff --check` returned 0.
- The repository-wide `npm run lint` is not clean on the base: it returned 1 with 1,484 warnings and 5 errors, in unrelated existing application code. The changed files passed the targeted Oxlint command above; no lint rules were altered.
- Before task edits, `npm run audit:campaign-formats` returned 1 at `scripts/audit-campaign-formats.mts:76`: `Каталог campaigns/fmv-crossing не внесён в реестр и не помечен как полигон смоуков (smoke-fixture.json)`. This existing check was not edited or weakened.
- Before task edits, `npm run audit:campaign -- public/campaigns/ash-of-caerden` returned 1 because that published fixture is missing referenced image assets (27 missing-media errors, 16 warnings). It is not used as the runnable example; the checked example is `cf-play check` and preserves its 0-error/8-warning benchmark.
