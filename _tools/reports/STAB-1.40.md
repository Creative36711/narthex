# STAB-1.40 — Replace brand SHA bypass with pointwise rules

## Outcome

- Changed the browser title in `index.html` to `Narthex`.
- Replaced the hash-based exception path in `scripts/brand-guard.mts` with exact occurrence rules keyed by repository-relative file, 1-based line, 1-based column, exact matched marker, and a reason.
- Removed the hash/baseline skip, all whole-file exceptions, and both generic line exemptions. The 33-entry `scripts/protected-legacy-baselines.json` remains untouched but is no longer imported or used by the guard.
- Added `scripts/brand-guard-probes.mts` and the single invocation `npm run check:brand:probes`.
- No §5 semantics or unrelated oracle thresholds/results were changed. Existing protected runtime/campaign sources were not edited; the current compatibility occurrences are documented individually below.
- Preserved the pre-existing untracked STAB-1.35 and STAB-1.38 reports; neither is part of this change.

## Verification

| Check | Result |
|---|---|
| `npm run build` | rc=0; TypeScript and Vite production build completed. |
| Built `dist/index.html` | Title is `Narthex`; former-title count is 0. |
| `npm run check:brand` | rc=0; 1337 text files scanned; 76 exact compatibility occurrences; 0 unaddressed hits. |
| `npm run check:brand:probes` | Positive full scan and negative probes A, B, and C all passed. |
| Positive inventory coverage | 33/33 former SHA-list paths are in the scanner's checked-path set; all 76 live point rules matched once. |
| Rule integrity | Each rule has a non-empty rationale, a unique address, and an exact live token at that address. |

The probe command verifies the full repository and then uses temporary fixtures: A permits only the exact prior occurrence in a former SHA-list file while rejecting a second occurrence in that same file; B rejects a marker on a line with an `accept` attribute; C independently rejects insertions in `index.html` and `public/ai/**`.

## Before / after coverage for all 33 former SHA-list files

Before this change, the old gate reported 1,331 candidate files and 33 SHA-matched files; each of the 33 files below was counted but its contents were skipped. After this change, every path is scanned and only the exact occurrences listed in the next section are allowed. The count is per-file matched point rule, not a file-level bypass.

| File | Before | After coverage | Exact point occurrences |
|---|---|---|---:|
| `_tools/reports/GOLD-1.10.md` | Counted; content skipped after SHA match | Scanned | 2 |
| `_tools/reports/GOLD-1.13.md` | Counted; content skipped after SHA match | Scanned | 4 |
| `_tools/reports/GOLD-1.6b.md` | Counted; content skipped after SHA match | Scanned | 1 |
| `_tools/reports/GOLD-1.6d.md` | Counted; content skipped after SHA match | Scanned | 8 |
| `_tools/reports/STAB-1.19.md` | Counted; content skipped after SHA match | Scanned | 1 |
| `docs/ai-campaign-guide.md` | Counted; content skipped after SHA match | Scanned | 1 |
| `docs/campaign.schema.json` | Counted; content skipped after SHA match | Scanned | 4 |
| `docs/decisions/GOLD-1.13.md` | Counted; content skipped after SHA match | Scanned | 1 |
| `docs/decisions/STAB-1.8.md` | Counted; content skipped after SHA match | Scanned | 2 |
| `index.html` | Counted; content skipped after SHA match | Scanned | 0 |
| `public/ai/campaign-audit.mjs` | Counted; content skipped after SHA match | Scanned | 4 |
| `public/ai/campaign-guide.md` | Counted; content skipped after SHA match | Scanned | 1 |
| `public/ai/campaign.schema.json` | Counted; content skipped after SHA match | Scanned | 4 |
| `public/ai/cf-play.mjs` | Counted; content skipped after SHA match | Scanned | 1 |
| `public/campaigns/ash-of-caerden/campaign.json` | Counted; content skipped after SHA match | Scanned | 1 |
| `scripts/combat-rules-smoke.mts` | Counted; content skipped after SHA match | Scanned | 1 |
| `scripts/feedback8-A-smoke.mts` | Counted; content skipped after SHA match | Scanned | 1 |
| `scripts/feedback8-G-smoke.mts` | Counted; content skipped after SHA match | Scanned | 1 |
| `scripts/gen-schema.mts` | Counted; content skipped after SHA match | Scanned | 3 |
| `scripts/p2-mechanics-smoke.mts` | Counted; content skipped after SHA match | Scanned | 1 |
| `scripts/tz7-slots-smoke.mts` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/App.tsx` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/editor/editorAppChrome.tsx` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/editor/editorAppGuard.tsx` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/editor/playtestNotes.ts` | Counted; content skipped after SHA match | Scanned | 2 |
| `src/player/MainMenu.tsx` | Counted; content skipped after SHA match | Scanned | 2 |
| `src/player/NoCampaignScreen.tsx` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/shared/compat.ts` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/shared/compatInventory.ts` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/shared/modals.tsx` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/shared/settings.ts` | Counted; content skipped after SHA match | Scanned | 1 |
| `src/shared/types/saves.ts` | Counted; content skipped after SHA match | Scanned | 1 |
| `vite.config.ts` | Counted; content skipped after SHA match | Scanned | 2 |

## Remaining exact compatibility occurrences

The marker spelling column is HTML-entity-escaped so this evidence does not create new raw matches: `&#45;` represents a hyphen, `&#46;` a dot, and `&#32;` a space. Each row corresponds to one exact matcher occurrence in the guard; locations use 1-based line and column. No rule exempts a complete file or line.

| File | Location | Specific occurrence | Reason retained |
|---|---:|---|---|
| `CHANGELOG.md` | 10:52 | `former display title` / `Chronicle&#32;Forge` | Historical release note; retained only at this exact occurrence. |
| `CHANGELOG.md` | 36:16 | `package identifier` / `chronicle&#45;forge` | Historical release note; retained only at this exact occurrence. |
| `_tools/reports/GOLD-1.10.md` | 71:122 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.10 evidence describing the legacy save/settings keys. |
| `_tools/reports/GOLD-1.10.md` | 71:149 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.10 evidence describing the legacy save/settings keys. |
| `_tools/reports/GOLD-1.13.md` | 25:255 | `package identifier` / `chronicle&#45;forge` | Archived GOLD-1.13 diff/audit evidence; not current product copy. |
| `_tools/reports/GOLD-1.13.md` | 45:142 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.13 diff/audit evidence; not current product copy. |
| `_tools/reports/GOLD-1.13.md` | 48:125 | `save extension` / `&#46;cfsave` | Archived GOLD-1.13 diff/audit evidence; not current product copy. |
| `_tools/reports/GOLD-1.13.md` | 49:112 | `former display title` / `Chronicle&#32;Forge` | Archived GOLD-1.13 diff/audit evidence; not current product copy. |
| `_tools/reports/GOLD-1.6b.md` | 12:12 | `package identifier` / `chronicle&#45;forge` | Archived package-lock compatibility note. |
| `_tools/reports/GOLD-1.6d.md` | 10:142 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 10:214 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 12:204 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 19:46 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 20:53 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 27:175 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 30:165 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/GOLD-1.6d.md` | 30:205 | `storage-key prefix` / `chronicle&#45;forge:` | Archived GOLD-1.6d save/load evidence; key literals are evidence, not new product branding. |
| `_tools/reports/STAB-1.19.md` | 48:96 | `former display title` / `Chronicle&#32;Forge` | Archived STAB-1.19 diagnostic of historical scan findings. |
| `docs/ai-campaign-guide.md` | 461:46 | `former display title` / `Chronicle&#32;Forge` | Canonical guide documents the historical label for the existing forge style ID. |
| `docs/campaign.schema.json` | 3:19 | `package identifier` / `chronicle&#45;forge` | Canonical schema retains its historical schema metadata and persisted-key documentation. |
| `docs/campaign.schema.json` | 4:13 | `former display title` / `Chronicle&#32;Forge` | Canonical schema retains its historical schema metadata and persisted-key documentation. |
| `docs/campaign.schema.json` | 5:35 | `former display title` / `Chronicle&#32;Forge` | Canonical schema retains its historical schema metadata and persisted-key documentation. |
| `docs/campaign.schema.json` | 6363:161 | `storage-key prefix` / `chronicle&#45;forge:` | Canonical schema retains its historical schema metadata and persisted-key documentation. |
| `docs/contracts/adr/0001-platform-name.md` | 9:42 | `former display title` / `Chronicle&#32;Forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 11:2 | `former display title` / `Chronicle&#32;Forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 33:46 | `package identifier` / `chronicle&#45;forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 41:32 | `package identifier` / `chronicle&#45;forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 42:23 | `package identifier` / `chronicle&#45;forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 43:42 | `application identifier` / `app&#46;chronicleforge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 43:23 | `former display title` / `Chronicle&#32;Forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 44:27 | `storage-key prefix` / `chronicle&#45;forge:` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 45:21 | `compatibility-format identifier` / `chronicle&#45;compat` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 45:43 | `inventory-format identifier` / `chronicle&#45;inventory` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 46:21 | `archive extension` / `&#46;chronicle` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 47:22 | `save extension` / `&#46;cfsave` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 48:27 | `former display title` / `Chronicle&#32;Forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0001-platform-name.md` | 49:20 | `package identifier` / `chronicle&#45;forge` | Ratified platform-name ADR records the former identifier and its replacement. |
| `docs/contracts/adr/0005-versioning.md` | 5:27 | `former display title` / `Chronicle&#32;Forge` | Historical versioning ADR records the rebrand context. |
| `docs/decisions/GOLD-1.13.md` | 18:222 | `storage-key prefix` / `chronicle&#45;forge:` | Historical GOLD-1.13 decision records the prior storage-key behavior. |
| `docs/decisions/STAB-1.8.md` | 62:64 | `former display title` / `Chronicle&#32;Forge` | Historical STAB-1.8 decision records a prior review observation. |
| `docs/decisions/STAB-1.8.md` | 63:4 | `archive extension` / `&#46;chronicle` | Historical STAB-1.8 decision records a prior review observation. |
| `package.json` | 2:12 | `package identifier` / `chronicle&#45;forge` | Exact npm package ID retained to match the locked dependency identity. |
| `public/ai/campaign-audit.mjs` | 10195:21 | `package identifier` / `chronicle&#45;forge` | Generated audit artifact embeds canonical schema metadata and legacy key documentation. |
| `public/ai/campaign-audit.mjs` | 10196:15 | `former display title` / `Chronicle&#32;Forge` | Generated audit artifact embeds canonical schema metadata and legacy key documentation. |
| `public/ai/campaign-audit.mjs` | 10197:87 | `former display title` / `Chronicle&#32;Forge` | Generated audit artifact embeds canonical schema metadata and legacy key documentation. |
| `public/ai/campaign-audit.mjs` | 16555:638 | `storage-key prefix` / `chronicle&#45;forge:` | Generated audit artifact embeds canonical schema metadata and legacy key documentation. |
| `public/ai/campaign-guide.md` | 461:46 | `former display title` / `Chronicle&#32;Forge` | Published guide documents the historical label for the existing forge style ID. |
| `public/ai/campaign.schema.json` | 3:19 | `package identifier` / `chronicle&#45;forge` | Published schema retains its stable identifier and persisted-key documentation. |
| `public/ai/campaign.schema.json` | 4:13 | `former display title` / `Chronicle&#32;Forge` | Published schema retains its stable identifier and persisted-key documentation. |
| `public/ai/campaign.schema.json` | 5:35 | `former display title` / `Chronicle&#32;Forge` | Published schema retains its stable identifier and persisted-key documentation. |
| `public/ai/campaign.schema.json` | 6363:161 | `storage-key prefix` / `chronicle&#45;forge:` | Published schema retains its stable identifier and persisted-key documentation. |
| `public/ai/cf-play.mjs` | 3789:12 | `storage-key prefix` / `chronicle&#45;forge:` | Runtime compatibility reads settings written under the pre-migration storage key. |
| `public/campaigns/ash-of-caerden/campaign.json` | 8:14 | `former display title` / `Chronicle&#32;Forge` | Frozen campaign author metadata; exact source value preserved outside this task scope. |
| `scripts/combat-rules-smoke.mts` | 1025:20 | `storage-key prefix` / `chronicle&#45;forge:` | Regression smoke retains the legacy metadata key as a test fixture. |
| `scripts/feedback8-A-smoke.mts` | 159:62 | `storage-key prefix` / `chronicle&#45;forge:` | Regression smoke retains the legacy map-label key as a test fixture. |
| `scripts/feedback8-G-smoke.mts` | 80:59 | `storage-key prefix` / `chronicle&#45;forge:` | Regression smoke retains the legacy settings key as a test fixture. |
| `scripts/gen-schema.mts` | 221:17 | `package identifier` / `chronicle&#45;forge` | Schema generator retains the canonical schema identifier and historical descriptive text. |
| `scripts/gen-schema.mts` | 222:11 | `former display title` / `Chronicle&#32;Forge` | Schema generator retains the canonical schema identifier and historical descriptive text. |
| `scripts/gen-schema.mts` | 224:22 | `former display title` / `Chronicle&#32;Forge` | Schema generator retains the canonical schema identifier and historical descriptive text. |
| `scripts/p2-mechanics-smoke.mts` | 216:15 | `storage-key prefix` / `chronicle&#45;forge:` | Regression smoke asserts the old metadata key is absent from the no-meta fixture. |
| `scripts/tz7-slots-smoke.mts` | 36:16 | `storage-key prefix` / `chronicle&#45;forge:` | Regression smoke uses a named legacy save-key fixture. |
| `src/App.tsx` | 401:53 | `save extension` / `&#46;cfsave` | Existing save-export extension compatibility; protected runtime file is unchanged. |
| `src/editor/editorAppChrome.tsx` | 126:28 | `archive extension` / `&#46;chronicle` | Existing campaign-import extension compatibility; protected runtime file is unchanged. |
| `src/editor/editorAppGuard.tsx` | 74:32 | `archive extension` / `&#46;chronicle` | Existing campaign-import extension compatibility; protected runtime file is unchanged. |
| `src/editor/playtestNotes.ts` | 9:22 | `storage-key prefix` / `chronicle&#45;forge:` | Existing playtest-note persistence keys remain readable; protected runtime file is unchanged. |
| `src/editor/playtestNotes.ts` | 10:25 | `storage-key prefix` / `chronicle&#45;forge:` | Existing playtest-note persistence keys remain readable; protected runtime file is unchanged. |
| `src/player/MainMenu.tsx` | 286:33 | `save extension` / `&#46;cfsave` | Existing save/campaign import filter compatibility; protected runtime file is unchanged. |
| `src/player/MainMenu.tsx` | 297:34 | `archive extension` / `&#46;chronicle` | Existing save/campaign import filter compatibility; protected runtime file is unchanged. |
| `src/player/NoCampaignScreen.tsx` | 125:28 | `archive extension` / `&#46;chronicle` | Existing campaign-import extension compatibility; protected runtime file is unchanged. |
| `src/shared/compat.ts` | 32:31 | `compatibility-format identifier` / `chronicle&#45;compat` | Existing legacy interchange-format compatibility; protected runtime file is unchanged. |
| `src/shared/compatInventory.ts` | 11:34 | `inventory-format identifier` / `chronicle&#45;inventory` | Existing legacy inventory-format compatibility; protected runtime file is unchanged. |
| `src/shared/modals.tsx` | 263:34 | `archive extension` / `&#46;chronicle` | Existing campaign JSON import-extension compatibility; protected runtime file is unchanged. |
| `src/shared/settings.ts` | 48:14 | `storage-key prefix` / `chronicle&#45;forge:` | Existing persisted settings remain readable; protected runtime file is unchanged. |
| `src/shared/types/saves.ts` | 85:12 | `compatibility-format identifier` / `chronicle&#45;compat` | Existing legacy save-format compatibility type; protected runtime file is unchanged. |
| `vite.config.ts` | 13:53 | `archive extension` / `&#46;chronicle` | Historical compatibility-extension documentation; protected build config is unchanged. |
| `vite.config.ts` | 91:60 | `archive extension` / `&#46;chronicle` | Historical compatibility-extension documentation; protected build config is unchanged. |

**Inventory total:** 76 unique point rules across 36 files. In the 33 former baseline files, 58 point rules remain; the other per-file rows above document 18 exact occurrences outside that former SHA inventory. The exception set has no wildcard paths or line-pattern rules.
