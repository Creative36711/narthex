# GOLD-1.8b — Re-pin `.golden/manifest.json` to the campaign-1 release with `project.json`

**Status: not done — blocked on GOLD-1.8 (Sequence 612, role `campaign-1`).**
There is nothing to re-pin yet: the head of `Creative36711/campaign-1` is still the
commit already pinned in `.golden/manifest.json`, and the archive still has no
`project.json`, so the 404 target of the card cannot be removed by the platform side.
`.golden/manifest.json` is **unchanged** in this PR; the only diff is this report and
`_tools/reports/GOLD-1.8b.log`.

## 1. Why blocked (numbers)

| Fact | Value |
| --- | --- |
| `campaign-1` `main` | `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`, committed `2026-10-29T13:51:09Z` |
| `.golden/manifest.json` `commit` | `71dbbc1056fd34679cf9017ee7dc5ecff29d666c` (same commit) |
| Open PRs in `campaign-1` | 0 (last: PR #3 merged `2026-10-29T13:51:10Z`) |
| `project.json` inside `.golden/karkas` | 0 (`campaign.json` — 1) |
| `project.json` requests still served | `GET /campaigns/<id>/project.json` has no file to resolve → the 404s of card item 5 stay |

The campaign side has not published a new head commit or a release archive with
`sha256` since GOLD-1.3b (`71dbbc10`). Re-pinning to the same commit would be a
no-op diff, and inventing a `sha256` for an archive that does not exist is not
acceptable — so the manifest stays as it is.

## 2. What was actually measured on the current pin (`71dbbc10`)

Commands and full output: `_tools/reports/GOLD-1.8b.log` (73 lines).

| Step | Result |
| --- | --- |
| `npm run golden:import`, run 1 (fresh download) | rc=0 · `188669895` B · sha256 `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b` · `manifest: unchanged` |
| `npm run golden:import`, run 2 (independent fresh download after `rm -rf .golden/karkas`) | rc=0 · `188669895` B · sha256 `d424a914…3cf4b` — identical to run 1 and to the manifest |
| Tree both runs | files `1290` · directories `32` · `192491387` B · sha256 `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76` |
| `npm run audit:campaign -- .golden/karkas` | rc=0 · **0 errors, 0 warnings**, 3 notes; coverage `json 319`, `ink/md 11`; 887 media links, all present |
| `node public/ai/cf-play.mjs check .golden/karkas` | rc=0 · **0 errors, 0 warnings**; 12 scenes · 5 locations · 11 dialogues · 118 ink nodes; 5 seeds → `ending_death`, `ending_flood`; coverage 4/12 scenes |
| `git status --porcelain` (`.golden` and repo) | 0 lines — nothing generated leaks into git |

So oracle items 2 and 3 of GOLD-1 hold on the current pin; oracles 1 and 4–6 are not
touched by this card.

## 3. Not measured, and why

- **Browser run to `scene_gate_hall` (card item 5, 404 count `2 → 0` on entry and
  `5 → 0` per run).** Not executed: this sandbox has no chromium binary and no
  `playwright`/`puppeteer` dependency (browser download hosts are not reachable
  here). More importantly it is not the moment: `project.json` does not exist in the
  archive, so the count cannot go to 0 before GOLD-1.8 lands. The numbers `2` and `5`
  from the card stay as the pre-fix baseline.
- **New `url` / `size_bytes` / `sha256` / `tree.*`.** Depend on the GOLD-1.8 release
  archive; nothing to compute.

## 4. What unblocks this card

1. GOLD-1.8 merges `project.json` (plus whatever `cf-play`/`audit` deflections it
   owns) into `campaign-1` and publishes a release/commit with a downloadable
   archive.
2. Tools then, in one pass: `url = https://codeload.github.com/Creative36711/campaign-1/tar.gz/<new commit>`
   (HTTP 200, `application/x-gzip`), `repository` / `commit` / `size_bytes` /
   `sha256` / `tree.*` — **by the fact of the download**, not from the answer log.
3. `npm run golden:import` twice with identical `sha256`/size, then
   `audit:campaign` → 0 errors, `cf-play check` → 0/0, then the browser run to
   `scene_gate_hall` counting 404s (expect 0 on entry and 0 per run), and only then
   the report + squash merge.

## 5. Assumption

- **Допущение:** GOLD-1.8 has not produced a new campaign-1 head commit by
  `2026-10-29T20:22Z`; if a release appears later, this card is re-run from step 2
  above. No manifest bytes were touched in the meantime.

## 6. Zone check

`git diff --stat origin/main` for this branch: `_tools/reports/GOLD-1.8b.md` and
`_tools/reports/GOLD-1.8b.log` only. No `.golden/manifest.json`, `src/core/**`,
`src/player/**`, `packs/**`, `docs/contracts/**`, `public/campaigns/**`,
`scripts/golden/**` changes.
