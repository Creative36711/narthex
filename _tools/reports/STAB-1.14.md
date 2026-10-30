# STAB-1.14 — editor smoke probes use owner APIs

## Summary and scope

- Base / merge-base SHA: `b68ffd22275cb248419b61b449e2332de9b476b4` (same as initial `HEAD` and `origin/main`).
- PR: [#179](https://github.com/Creative36711/narthex/pull/179) (`arena/776ab2df-narthex` → `main`).
- Squash-merge SHA: `cffe79765b52aad42dc666f24d66b9fcd5cc1b16` (PR #179, merged 2026-10-30).
- 35 existing candidate probes were modified; no probe was added, removed, renamed, skipped, or early-returned. `scripts/mission-smokes.mts` is the shared loader/runner support change, making 36 changed script files total. The required report and decision record are the only new non-probe files.
- No changes to `src/**`, `public/**`, `packs/**`, `package.json`, `.golden/**`, `scripts/golden/**`, `golden.yml`, or `docs/contracts/**`.
- `scripts/mission-smokes/**` is absent. Per the scope decision in `docs/decisions/STAB-1.14.md`, candidate probes were found across `scripts/*`; unrelated assertions, path-only existence checks, and the `check-module-size.mts` hash pins remain intact.
- Residual target-path references are only Vite owner-module IDs (for `ssrLoadModule`) plus the retained path-only `existsSync('src/editor/EditorApp.tsx')` check. No probe reads either target module's source text for fragments. `feedback8-A` A5 is still a `WorldEditor` check and was left unchanged; only CampaignEditor-owned A3/A7 were migrated.

## Affected probes, fragments, and owners

| Probe | Migrated fragment/assertion | Owner public API used |
|---|---|---|
| `campaign-index-smoke.mts` | Stable folder ID on save; Chronicle update preserves the open folder ID; live campaign title in the menu | `editorMenus.campaignIdFromPath`, `editorMenus.navLabelOf`; `newCampaign.syncIndexEntry`, `newCampaign.importChroniclePackage`, `newCampaign.hydrateCampaignIndex` |
| `chronicle-import-identity-smoke.mts` | Import/copy/update conflict flow; stable catalog ID | Vite-loaded `EditorApp`; `newCampaign.importChroniclePackage`; `editorMenus.campaignIdFromPath`; `chronicleIdentity.readChronicleCampaignIdentity` |
| `feedback10-smoke.mts` | Editor menu click propagation; exit-button icon | Vite-loaded `EditorApp`; `editorMenus.MENUS`/`navLabelOf`; rendered `shared/icons.Ico` exit icon |
| `feedback11-smoke.mts` | No built-in emotion registry; default state remains hidden; portrait states remain deletable; empty custom registry | `CampaignEditor`; rendered `campaignSpeciesEditors.HeroPortraitsEditor`; `EditorStore`; `DEFAULT_EMOTION` |
| `feedback12-smoke.mts` | Campaign JSON full-height field; all/npc/item filters | `Fields.JsonField`; `CampaignEditor`; `EditorStore.options`; Vite-loaded `EditorApp` |
| `feedback14-smoke.mts` | Campaign JSON/editor tabs and absence of the old currency/meta-progress section | Rendered `CampaignEditor` plus campaign editor CSS |
| `feedback16-smoke.mts` | NPC template description in the editor | Vite-loaded `EditorApp`; `newCampaign` and `monolith` public modules |
| `feedback17-smoke.mts` | Scene-slot defaults; campaign weather-layer registry; fill-mode JSON; item-category grid; profession/stat editor data | `slotTypesFor(EditorStore)`; `CampaignEditor`; rendered `Fields.JsonField`; demo campaign metadata |
| `feedback18-smoke.mts` | Editor keyboard owner; mandatory/forbidden skills; profession cards; endings; weather registry and selection data | Vite-loaded `EditorApp`; `CampaignEditor`; demo `char_creation`, `endings`, `overlay_layers`, and `weathers` |
| `feedback19-smoke.mts` | Weather labels/ID generation/add control; visible skill-budget allocation | `CampaignEditor`; `ids.makeId`; `charcreate.skillPointsUsed` and campaign choice data |
| `feedback24-smoke.mts` | Editor theme selector, persistence owner, and root theme class | Vite-loaded `EditorApp`; existing editor theme CSS assertions |
| `feedback25-smoke.mts` | Entity type/grouping; global undo and text/Monaco key handling owner | Vite-loaded `EditorApp`; `EditorStore.options` and `EditorStore.undo` |
| `feedback26-smoke.mts` | Structured damage/healing/formula/natural-weapon inputs; HP/MP backlash fields; flag purpose warning; weather picker | Rendered `Fields.DiceNotationInput`; `CampaignEditor`; actual campaign `backlash_table`; `campaignAudit.validateCampaign`; `EditorStore.options('weather')` |
| `feedback27-smoke.mts` | Date input; registry rows; feat labels/modifiers/requirements; crimes/prices/rules/categories; need descriptions; weather skill deltas | Rendered `CampaignEditor`; `EditorStore.options`; campaign metadata records |
| `feedback29-smoke.mts` | Registry labels, chapter IDs, feat fields and code-field presentation | `CampaignEditor` public component paired with the campaign's chapter/registry/feat data |
| `feedback7-smoke.mts` | Hidden faction editor; conditional need decay/restoration | `CampaignEditor`; demo faction and `NeedDef.decay_when` data |
| `feedback8-A-smoke.mts` | A3 need-condition chip selector; A7 dice-rule presets | Rendered `campaignDiceEditors.ChipMultiSelect` and `DiceRulesEditor`; `CampaignEditor` |
| `feedback8-BC-smoke.mts` | External-link embed checkbox/export flow | `chronicle.exportChronicle`; `assets.embedExternalAssets`/`collectExternalUrls`; `EditorStore` |
| `feedback8-E-smoke.mts` | Cutscenes editor menu entry | `editorMenus.MENUS`; `CutsceneEditor` |
| `feedback8-F-smoke.mts` | JSON import/export controls, warning report, textarea modal, no browser prompts | Vite-loaded `EditorApp`; `monolith.importMonolithText`/`exportMonolith`/`importMonolith`; `modals.askTextArea` |
| `feedback8-H-smoke.mts` | Audio registries inside the campaign editor | Rendered `AudioRegistries`; `CampaignEditor`; `EditorStore` |
| `feedback9-smoke.mts` | Editor entity filters/search; campaign tabs; emotion registry; ambient-audio toggle/playtest restore; AI report | `editorMenus.MENUS`; rendered `CampaignEditor`; `EditorStore.options('emotion')`; `audio.setAmbientAudioEnabled`; `AiWizard.aiFixReport`; Vite-loaded `EditorApp` |
| `no-campaign-smoke.mts` | Empty editor UI, ID creation/import, folder-ID preservation, Chronicle conflict flow | Rendered Vite-loaded `EditorApp`; `newCampaign` public functions; `editorMenus.campaignIdFromPath`; `EditorStore` |
| `release-ui-smoke.mts` | Book panel navigation; File/Tools menus, undo control, dropdown behavior | Vite-loaded `EditorBookPanel` rendered to markup and Vite-loaded `EditorApp` |
| `smoke-round34-import-chroma-combat.mts` | Editor busy-overlay owner | Vite-loaded `EditorApp` public component |
| `tz1-features-smoke.mts` | Mechanics tab and feature toggles | `CampaignEditor`; `shared/types.featureOn` against enabled/disabled campaign metadata |
| `tz10-codex-smoke.mts` | Codex editor menu item | `editorMenus.MENUS`; `CodexEditor` |
| `tz11-charcreate-smoke.mts` | Character-creation editor block | `CampaignEditor`; campaign profession/template data |
| `tz12-profiles-smoke.mts` | Profile groups/effect labels and playtest profile class | Rendered `ProfilePicker`/`ProfilePreview`; `shared/profiles`; Vite-loaded `EditorApp` |
| `tz2-theme-smoke.mts` | Theme tab, font roles, preview | Rendered `CampaignEditor`, `FontSample`, `ProfilePicker`, `ProfilePreview`; `campaignFonts.FONT_ROLES` |
| `tz4-craft-smoke.mts` | Recipe menu and recipe creation | `editorMenus.MENUS`; `RecipeEditor.newRecipe` |
| `tz5-statuses-smoke.mts` | Status/ability tab and status field data | Rendered `CampaignEditor`; status registry data and `withStatuses` fixture |
| `tz6-abilities-smoke.mts` | Ability constructor values | `CampaignEditor`; campaign ability registry including numeric MP/range values |
| `tz7-slots-smoke.mts` | Equipment-slot registry; no-default scene-slot registry | `equipmentSlots(editorStore.meta)` compared to `meta.equipment_slots`; separately `slotTypesFor(emptySceneSlotsStore)` with `meta.slot_types = []` |
| `tz9-weather-smoke.mts` | Calendar forms and campaign weather registry | `CampaignEditor`; calendar, weather, and overlay metadata |

`mission-smokes.mts` exports `loadMissionOwnerModules()` for Vite SSR and only runs the 55-probe runner when invoked directly. This lets probes load TSX/CSS owners without reading source fragments and avoids starting the whole suite when the helper is imported.

## Equivalent before/after examples

1. **Equipment slots (`tz7-slots-smoke.mts`)**
   - Before: read `CampaignEditor.tsx`, require the “Слоты экипировки” text, and reject `BUILTIN_EQUIPMENT_SLOTS`.
   - After: compare `equipmentSlots(editorStore.meta)` IDs/labels with the campaign's declared `meta.equipment_slots`. Separately assert `slotTypesFor(emptySceneSlotsStore).length === 0` for an empty `meta.slot_types`. These registries are intentionally distinct.

2. **Stable campaign identity (`campaign-index-smoke.mts`)**
   - Before: search `EditorApp.tsx` for `const stableId = campaignIdFromPath(base)`, `saveToDisk()`, and `pushIndex()`.
   - After: call `campaignIdFromPath('/campaigns/ash-of-caerden')` and require the stable ID, while checking the `syncIndexEntry` and `importChroniclePackage` owner APIs. Hydration compares the actual campaign title to the loaded fixture title.

3. **A3/A7 owner components (`feedback8-A-smoke.mts`)**
   - Before: search `CampaignEditor.tsx` for `ChipMultiSelect`/“Герой в любой из локаций” and the dice-rule preset labels.
   - After: render `ChipMultiSelect` and `DiceRulesEditor` through their public exports and assert the location chip and preset labels in the rendered markup. A5 remains unchanged because it reads `WorldEditor`.

## `smoke:mission` RC comparison

Baseline was captured at base SHA `b68ffd22275cb248419b61b449e2332de9b476b4`; final run was after the latest probe edits. Every one of the 55 probe return codes is unchanged: `changed=[]`, `new_nonzero=[]`, no rows added or missing. Both runner summaries are `41/55 passed; rc=1`; the nonzero rows below are the same baseline failures.

| Probe | Before RC | After RC |
|---|---:|---:|
| `smoke:ai-diff` | 0 | 0 |
| `smoke:ai-runtime` | 1 | 1 |
| `smoke:ai-task` | 1 | 1 |
| `smoke:book-md` | 0 | 0 |
| `smoke:breathe-toggle` | 1 | 1 |
| `smoke:campaign-index` | 0 | 0 |
| `smoke:capability-modes` | 1 | 1 |
| `smoke:char-templates` | 0 | 0 |
| `smoke:chronicle-manifest` | 0 | 0 |
| `smoke:core` | 0 | 0 |
| `smoke:craft-fail-time` | 0 | 0 |
| `smoke:currency` | 0 | 0 |
| `smoke:cutout` | 0 | 0 |
| `smoke:cutscene-queue` | 0 | 0 |
| `smoke:design-doc` | 1 | 1 |
| `smoke:dialogue-skip` | 0 | 0 |
| `smoke:dialogue-speaker` | 1 | 1 |
| `smoke:dialogue-transitions` | 0 | 0 |
| `smoke:dialogues-r31` | 1 | 1 |
| `smoke:dialogues-r32` | 1 | 1 |
| `smoke:dlg-script` | 0 | 0 |
| `smoke:dlg-ui` | 0 | 0 |
| `smoke:drive-gateway` | 1 | 1 |
| `smoke:duration-actions` | 0 | 0 |
| `smoke:editor-hotspot` | 0 | 0 |
| `smoke:encounters-loader` | 1 | 1 |
| `smoke:encumbrance` | 0 | 0 |
| `smoke:engine-version` | 0 | 0 |
| `smoke:fingerprint` | 0 | 0 |
| `smoke:folder-import` | 0 | 0 |
| `smoke:guide` | 0 | 0 |
| `smoke:hero-appearance` | 0 | 0 |
| `smoke:ink-import` | 0 | 0 |
| `smoke:manifest-order` | 0 | 0 |
| `smoke:narrative-builder` | 0 | 0 |
| `smoke:narrative-intro` | 1 | 1 |
| `smoke:narthex-closed` | 0 | 0 |
| `smoke:narthex-tech` | 0 | 0 |
| `smoke:no-campaign` | 0 | 0 |
| `smoke:p2` | 1 | 1 |
| `smoke:pack-missing` | 1 | 1 |
| `smoke:pack-panels` | 0 | 0 |
| `smoke:patch` | 0 | 0 |
| `smoke:quest-journal` | 0 | 0 |
| `smoke:quest-journal-runtime` | 0 | 0 |
| `smoke:saves-compat` | 1 | 1 |
| `smoke:scene-editor` | 0 | 0 |
| `smoke:scene-subtitles` | 0 | 0 |
| `smoke:spoil` | 0 | 0 |
| `smoke:stranger` | 0 | 0 |
| `smoke:theme-contrast` | 0 | 0 |
| `smoke:time-semantics` | 0 | 0 |
| `smoke:travel-transition` | 0 | 0 |
| `smoke:view-write` | 0 | 0 |
| `smoke:voice-dedup` | 0 | 0 |

## Targeted probe evidence

Fully green targeted probes: `feedback7-smoke.mts` (RC 0), `feedback12-smoke.mts` (RC 0), `feedback19-smoke.mts` (RC 0), `feedback24-smoke.mts` (RC 0), `chronicle-import-identity-smoke.mts` (RC 0), `tz1-features-smoke.mts` (RC 0), and `tz6-abilities-smoke.mts` (RC 0).

For other executed candidates, the migrated assertions were green even when unrelated portions of the standalone probe failed: `feedback8-A` A3/A7; `feedback10` menu/icon owner; `feedback11` emotion/portrait owner; `feedback17` slot/weather registry, JSON fill, categories, and creation data; `feedback18` creation/endings/weather data; `feedback25` entity-filter/undo APIs; `feedback26` dice-field and flag-audit checks; `feedback8-H` rendered audio registries; `feedback9` menus/tabs/emotion API; `release-ui` rendered book navigation; `tz2` theme controls; `tz7` both slot-registry assertions; and `tz12` profile groups/effect labels. These scripts have independent unrelated failures (for example existing localStorage/theme checks, audio hooks, player overlay logic, or legacy save fixtures); they were not suppressed or counted as mission-suite results. `tz5`/`tz9`/`feedback26` hit the existing missing `src/core/dialogue.ts` read after earlier checks; `feedback27`'s standalone script imports that absent module, so its date/registry assertions were exercised through direct owner SSR/API probes instead. `feedback29`'s standalone probe is blocked by the absent `_ai-temp/campaing/karkas_mednoe_serdce.chronicle` fixture; its changed checks use the public component plus that fixture's chapter/registry/feat data when available.

## Required gates and package checks

| Gate | Result |
|---|---|
| `npx tsc -b` | RC 0 |
| `npm run lint` | RC 0; 1,510 warnings, 0 errors |
| `npm run check:audit-bundle` | RC 0; existing `public/ai/campaign-audit.mjs` matches source at 1,002,333 bytes, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d` |
| `git diff --check` | RC 0 |
| `npm run cf-play:negative` | RC 0; source and extracted-kit negative fixture both correctly return `verdict=failed`, 0 errors, 1 expected warning; harness reports `ok=true` |
| `npm run pack:ai-kit` + unzip + extracted `cf-play check public/campaigns/fmv-crossing --seeds 1-5 --steps 300` | Pack RC 0; unpacked check RC 0, verdict OK, 0 errors/warnings, 5 seeds, 1/1 reachable scenes |

No bundle was rebuilt. The kit check packages the existing `public/ai` contents; generated `dist-ai/` and temporary unpack/check directories were removed after verification.

GitHub PR checks `screenshots` (runs `41142469289` / job `124359766262` and `41142601284` / job `124360188062`) concluded failure before any workflow step started. Their GitHub annotations say the job was not started because recent account payments failed or the spending limit needs an increase. This external billing block is not counted as a passing CI check; all local gates above completed as recorded. PR #179 was nevertheless squash-merged after local verification.

## Diff stat

```text
 _tools/reports/STAB-1.14.md                    | 194 ++++++++++++++++++++++++
 docs/decisions/STAB-1.14.md                    |   8 +
 scripts/campaign-index-smoke.mts               |  15 +-
 scripts/chronicle-import-identity-smoke.mts    |  19 ++-
 scripts/feedback10-smoke.mts                   |  17 ++-
 scripts/feedback11-smoke.mts                   |  26 +++-
 scripts/feedback12-smoke.mts                   |  18 ++-
 scripts/feedback14-smoke.mts                   |  12 +-
 scripts/feedback16-smoke.mts                   |   4 +-
 scripts/feedback17-smoke.mts                   |  28 ++--
 scripts/feedback18-smoke.mts                   |  21 +--
 scripts/feedback19-smoke.mts                   |  16 +-
 scripts/feedback24-smoke.mts                   |   9 +-
 scripts/feedback25-smoke.mts                   |  27 ++--
 scripts/feedback26-smoke.mts                   |  45 ++++--
 scripts/feedback27-smoke.mts                   |  69 +++++++--
 scripts/feedback29-smoke.mts                   |  40 ++++-
 scripts/feedback7-smoke.mts                    |   7 +-
 scripts/feedback8-A-smoke.mts                  |  19 ++-
 scripts/feedback8-BC-smoke.mts                 |   6 +-
 scripts/feedback8-E-smoke.mts                  |   5 +-
 scripts/feedback8-F-smoke.mts                  |  15 +-
 scripts/feedback8-H-smoke.mts                  |  13 +-
 scripts/feedback9-smoke.mts                    |  37 +++--
 scripts/mission-smokes.mts                     | 198 ++++++++++++++-----------
 scripts/no-campaign-smoke.mts                  |  38 +++--
 scripts/release-ui-smoke.mts                   |  23 ++-
 scripts/smoke-round34-import-chroma-combat.mts |   5 +-
 scripts/tz1-features-smoke.mts                 |   9 +-
 scripts/tz10-codex-smoke.mts                   |   5 +-
 scripts/tz11-charcreate-smoke.mts              |   4 +-
 scripts/tz12-profiles-smoke.mts                |  17 ++-
 scripts/tz2-theme-smoke.mts                    |  21 ++-
 scripts/tz4-craft-smoke.mts                    |   7 +-
 scripts/tz5-statuses-smoke.mts                 |  13 +-
 scripts/tz6-abilities-smoke.mts                |   4 +-
 scripts/tz7-slots-smoke.mts                    |  15 +-
 scripts/tz9-weather-smoke.mts                  |   7 +-
 38 files changed, 758 insertions(+), 278 deletions(-)
```
