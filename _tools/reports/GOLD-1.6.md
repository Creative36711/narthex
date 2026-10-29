# GOLD-1.6 — One-command golden playthrough

**Verdict: PASS.**

- Run ID: `bb1f6c22-4353-49cc-b97c-edc3cf94cb99`; branch: `arena/9c7e719f-narthex`; total command duration: **54.93 s**.
- Command: `npm run playthrough:golden`; importer: `npm run golden:import`.
- Archive: `188669895` bytes, SHA-256 `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`, commit `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`; URL: https://codeload.github.com/Creative36711/campaign-1/tar.gz/71dbbc1056fd34679cf9017ee7dc5ecff29d666c.
- Imported tree: `1290` files / `32` directories / `192491387` bytes; SHA-256 `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76`.
- Import mode: verified-extracted-tree-cache; importer rc=0; verified tree cache hit=true.

## Cold-import and cached-repeat runs

| Run ID | Archive path | Tree-cache hit | Audit errors | cf-play errors | Browser pageerrors / empty backgrounds | Verdict | Failure / detail |
|---|---|---:|---:|---:|---:|---|---|
| `5d3d999e-4e92-4b8e-b224-772a53dd1d69` | download | no | 0 | 0 | 0 / 0 | PASS | — |
| `3120fd3a-c661-476a-84a9-4bf7c11a6ff1` | verified-extracted-tree-cache | yes | 0 | 0 | 0 / 0 | PASS | — |
| `f0371258-3018-430d-bebc-1351a04baf2c` | verified-extracted-tree-cache | yes | 0 | 0 | 0 / 0 | PASS | — |
| `2e65b03e-2f33-4882-88ab-987f9c7353cd` | download | no | 0 | 0 | n/a / n/a | FAIL | Error: GOLD-1.6 browser route and save/load returned rc=124 (timeout) |
| `4bf7ebe6-aa2c-4c2f-bdb1-c39fcae5594e` | verified-extracted-tree-cache | yes | 0 | 0 | 0 / 0 | PASS | — |
| `bb1f6c22-4353-49cc-b97c-edc3cf94cb99` | verified-extracted-tree-cache | yes | 0 | 0 | 0 / 0 | PASS | — |

One additional cold-import attempt stalled at `browserContext.newPage` and hit the runner's 25-minute timeout before setup timeouts were added. The required first import and cached repeat both passed; the two subsequent cached runs also passed with browser context/page startup bounded and logged.

## Regression checks

- `npm run check:contracts`: rc=0 (includes its `check:pack-boundary` substep).
- `npm run check:pack-boundary`: rc=0 when run separately.
- Protected-path diff against `HEAD` and `origin/main` is zero for `src/core`, `packs`, `docs/contracts`, and `public/campaigns`.

## Audit and playkit checks

- `audit:campaign`: rc=0; errors=0; warnings=0; info=3.
- Audit warnings:
- (нет)
- Source `cf-play check`: rc=0; scenes=12; locations=5; dialogues=11; Ink nodes=118; errors=0; warnings=3.
- cf-play scene coverage: 4/12; seen: scene_dry_row, scene_gate_hall, scene_office, scene_pump_hall; uncovered: scene_archive, scene_drift, scene_face, scene_flood_gallery, scene_gate_office, scene_pump_room, scene_pump_shaft, scene_sluice.
- Browser route scene IDs: gate=scene_gate_hall, machine hall=scene_pump_hall, first clue=scene_pump_hall.
- Source cf-play warnings:
- warning: flag_written_never_read: флаг «case136_read» выставляется, но нигде не читается
- warning: flag_written_never_read: флаг «shaft_roped» выставляется, но нигде не читается
- warning: flag_written_never_read: флаг «vein_hidden» выставляется, но нигде не читается
- Unpacked AI kit cf-play: rc=0; same result as source=true; comparable={"verdict":"ok","scenes":12,"locations":5,"dialogues":11,"inkKnots":118,"errors":[],"warnings":["flag_written_never_read: флаг «case136_read» выставляется, но нигде не читается","flag_written_never_read: флаг «shaft_roped» выставляется, но нигде не читается","flag_written_never_read: флаг «vein_hidden» выставляется, но нигде не читается"]}.

## Browser route and persistence

Menu → hero → gate → machine hall → first clue, then save, page reload/Continue, and manual-slot load.

- First clue found: **yes** in 2 attempt(s); text: "Муфта срезана ровно, по метке: её снимали, а не рвало. А в масляном поддоне под приводом лежит сама рукавица — мазутная, с клеймом караульной партии, с чужой заплатой на большом пальце.\nОк"
- Save/load: **потерь нет**; discrepancies=0; slot=1; restored flags: {"case_opened":true,"gate_intro_done":true,"met_ira":true,"ira_story":true,"clue_glove":true}
- Browser duration: **43.66 s**.

- Browser: Chromium 131.0.6778.0; viewport 1440×900.
- pageerror=0; empty backgrounds=0 across 11 checkpoints.
- Console errors=5; HTTP errors=5 (optional project.json 404s=5; unclassified=0); request failures=0.
- Console error text:
- 03-gate: Failed to load resource: the server responded with a status of 404 (Not Found)
- 03-gate: Failed to load resource: the server responded with a status of 404 (Not Found)
- 07a-continue-autosave: Failed to load resource: the server responded with a status of 404 (Not Found)
- 07a-continue-autosave: Failed to load resource: the server responded with a status of 404 (Not Found)
- 08-load-manual-slot: Failed to load resource: the server responded with a status of 404 (Not Found)

### Screenshots

| Checkpoint | File | Dimensions | Bytes |
|---|---|---:|---:|
| menu | `_tools/reports/GOLD-1.6/01-menu.png` | 1440×900 | 1498751 |
| hero | `_tools/reports/GOLD-1.6/02-hero-creation.png` | 1440×900 | 1050425 |
| gate | `_tools/reports/GOLD-1.6/03-gate.png` | 1440×900 | 1769503 |
| map | `_tools/reports/GOLD-1.6/route-map.png` | 1440×900 | 2260515 |
| machine hall | `_tools/reports/GOLD-1.6/04-machine-hall.png` | 1440×900 | 1803841 |
| first clue | `_tools/reports/GOLD-1.6/05-first-clue.png` | 1440×900 | 1913923 |
| before save | `_tools/reports/GOLD-1.6/before-save.png` | 1440×900 | 1914408 |
| after reload menu | `_tools/reports/GOLD-1.6/after-reload-menu.png` | 1440×900 | 1498722 |
| after load | `_tools/reports/GOLD-1.6/after-load.png` | 1440×900 | 1942835 |

## SHA negative probe

- Probe run: `2e65b03e-2f33-4882-88ab-987f9c7353cd`; temporary copied manifest with tampered SHA; result: **PASS**, rc=1 (expected 1); SHA 0424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b did not match the archive; extractionStarted=false; campaign tree unchanged=true; .golden/manifest.json unchanged=true (SHA-256 d74c775a50400b3c9e9c707d65e26de63cb2f1f513a84b3163b141b1449f21aa).
- Diagnostic: `ARCHIVE VERIFY FAIL: archive sha256 mismatch: expected 0424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b, received d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`

## Artifacts

- Report: `_tools/reports/GOLD-1.6.md`
- Log: `_tools/reports/GOLD-1.6.log`
- Drive log: [`GOLD-1.6.log`](https://drive.google.com/file/d/1oF4N9eB2EkS1f6j1dF8bJv86dRjk6YX5/view?usp=drivesdk) (file ID `1oF4N9eB2EkS1f6j1dF8bJv86dRjk6YX5`).
- Screenshots: `_tools/reports/GOLD-1.6/`
## CI workflow

- Workflow file: `.github/workflows/golden.yml`.
- Triggers: pull requests to `main` and pushes to `main`, filtered to the workflow, pinned manifest, package/runtime, UI, engine, pack and test paths; also `workflow_dispatch`.
- Job: `golden-playthrough`; Ubuntu latest; timeout: 45 minutes.
- Cache: `.golden`, keyed by runner OS and `hashFiles('.golden/manifest.json')`.
- CI artifact: `GOLD-1.6-40924355797` (artifact ID `12920371071`; 15,717,082 bytes; SHA-256 `9a282ef243a3d1796f4eff30026f7cd7041fa9156d8f5e40d9864a5f664918aa`; expires 2026-11-12). [Workflow run](https://github.com/Creative36711/narthex/actions/runs/40924355797).
- CI run `40924355797`: job `golden-playthrough` **SUCCESS** in 1m58s; evidence upload passed.
- Separate PR check `visual` / `screenshots` [run `40924355622`](https://github.com/Creative36711/narthex/actions/runs/40924355622) is **FAILURE** at its `Пробы транспорта ScriptCat` step. The full GitHub run log could not be fetched (EOF from the Actions log endpoint), so the run-specific diagnosis is **unconfirmed**. The probe is outside GOLD-1.6's scope and was not modified. A similar prior failure reported expected userscript `1.4.86` versus actual `1.4.87`, but that mismatch is not verified for this run; this check is not counted as green.

### Workflow YAML

```yaml
name: golden-playthrough

on:
  pull_request:
    branches: [main]
    paths:
      - '.github/workflows/golden.yml'
      - '.golden/manifest.json'
      - 'package.json'
      - 'package-lock.json'
      - 'index.html'
      - 'vite.config.*'
      - 'src/**'
      - 'packs/**'
      - 'public/**'
      - 'scripts/golden/**'
      - 'scripts/golden-import.mts'
      - 'scripts/campaign-audit.mts'
      - 'scripts/campaign-fmv-audit.mts'
      - 'scripts/playkit/**'
      - 'scripts/pack-ai-kit.mts'
      - 'scripts/visual/local-browser.mjs'
  push:
    branches: [main]
    paths:
      - '.github/workflows/golden.yml'
      - '.golden/manifest.json'
      - 'package.json'
      - 'package-lock.json'
      - 'index.html'
      - 'vite.config.*'
      - 'src/**'
      - 'packs/**'
      - 'public/**'
      - 'scripts/golden/**'
      - 'scripts/golden-import.mts'
      - 'scripts/campaign-audit.mts'
      - 'scripts/campaign-fmv-audit.mts'
      - 'scripts/playkit/**'
      - 'scripts/pack-ai-kit.mts'
      - 'scripts/visual/local-browser.mjs'
  workflow_dispatch:

jobs:
  golden-playthrough:
    name: golden-playthrough
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - name: Check out
        uses: actions/checkout@v4

      - name: Set up Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install project dependencies
        run: npm ci

      - name: Cache verified golden archive and extracted campaign
        id: golden-cache
        uses: actions/cache@v4
        with:
          path: .golden
          key: golden-karkas-${{ runner.os }}-${{ hashFiles('.golden/manifest.json') }}

      - name: Install headless Chromium packages
        timeout-minutes: 8
        run: npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @sparticuz/chromium@131 playwright-core@1.49.1

      - name: Run golden import, audit, playkit and browser save/load
        timeout-minutes: 40
        run: npm run playthrough:golden

      - name: Upload GOLD-1.6 evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: GOLD-1.6-${{ github.run_id }}
          path: |
            _tools/reports/GOLD-1.6.md
            _tools/reports/GOLD-1.6.log
            _tools/reports/GOLD-1.6/
          retention-days: 14
          if-no-files-found: warn
```
