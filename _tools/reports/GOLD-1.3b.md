# GOLD-1.3b — Перепин «Каркаса» и проверки после импорта

Дата проверки: 2026-10-29. Source-of-truth кампании — уже слитый PR [Creative36711/campaign-1#3](https://github.com/Creative36711/campaign-1/pull/3), merge commit `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`.

## Pin и архив

| Поле | Предыдущий pin | Новый pin |
|---|---|---|
| Commit | `8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1` | `71dbbc1056fd34679cf9017ee7dc5ecff29d666c` |
| Archive URL | `https://codeload.github.com/Creative36711/campaign-1/tar.gz/8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1` | `https://codeload.github.com/Creative36711/campaign-1/tar.gz/71dbbc1056fd34679cf9017ee7dc5ecff29d666c` |
| HTTP / MIME | baseline archive | `200` / `application/x-gzip` |
| Archive size | `188668720` bytes | `188669895` bytes |
| Archive SHA-256 | `76787085add7aac55fd216d4d739a1edf48f1a250d66026f3b02164ded817a88` | `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b` |
| Imported-tree SHA-256 | `e8b3683443fca964fbc33d3aad2dda96c23c18153108d1d5151ef37e8bb99f75` | `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76` |
| Imported tree: files / directories / bytes | `1287 / 29 / 192491125` | `1290 / 32 / 192491387` |

The new URL was downloaded directly from codeload; the measured size and SHA-256 above are the bytes supplied to the importer. The manifest keeps its existing GOLD-1.1 shape; the previous pin is retained here for rollback traceability.

## До / после

| Проверка | До (старый pin) | После (импорт нового pin) |
|---|---|---|
| `cf-play check` | `rc=1`; 2 errors (`ink_missing_knot`), 12 unread-flag warnings; 12 scenes, 5 locations, 11 dialogues, 116 Ink knots; 1 informational `slot_person_empty` | `rc=0`; 0 errors, 3 warnings; 12 scenes, 5 locations, 11 dialogues, 118 Ink knots |
| `npm run audit:campaign -- .golden/karkas` | baseline not captured for this follow-up | `rc=0`; 0 errors, 0 warnings, 3 notes; 319 JSON and 11 Ink/Markdown files covered; 887 media references found |
| `npm run golden:import` | — | Required consecutive run 1: `rc=0`, download verified; run 2: `rc=0`, extracted cache verified and tree unchanged. Both report archive `188669895` bytes / SHA-256 `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`, tree `1290` files / `32` directories / `192491387` bytes / SHA-256 `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76`. |

`cf-play`'s three remaining warnings are not suppressed; campaign-wide inspection confirmed these real scene-condition reads, which the scanner does not count as flag reads:

- `case136_read` — `scenes/scene_archive.json#/states/1/condition/flag` (`state_opened`).
- `shaft_roped` — `scenes/scene_pump_shaft.json#/states/1/condition/flag` (`state_roped`).
- `vein_hidden` — `scenes/scene_face.json#/slots/1/condition/not_flag` (`slot_vein`).

Final `cf-play` invocation used `--out /tmp/gold-1.3b-cf-after`, so it did not add generated checker output to the imported campaign directory. The importer was run once more afterward to restore the pristine imported tree; it again verified the archive and produced the same tree hash and counts. No manual edits were made to `.golden/karkas/`.

## Manifest diff and scope

Only the pin fields and importer-managed `tree.*` values changed in `.golden/manifest.json`: commit, URL, archive SHA-256, archive byte size, and tree metadata. The `.golden/karkas/` path is ignored by `.gitignore` (`.golden/`); it has no tracked files. No changes were made under `src/core/**`, `packs/**`, `docs/contracts/**`, or `public/campaigns/index.json`; `.gitignore` and the importer/oracle were not changed.

Execution note: upstream `492399f43c73443403cddd690410a4d6f7c829e5` no longer defines the `golden:import` npm alias, although `scripts/golden-import.mts` remains. To execute the card's required `npm run golden:import` command without a persistent out-of-scope package change, the exact alias `tsx scripts/golden-import.mts` was added temporarily for the required runs and tree restoration, then `package.json` was restored byte-for-byte. The importer implementation was unchanged.
