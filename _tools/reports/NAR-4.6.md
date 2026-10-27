# NAR-4.6 — Headless browser / cf-play parity

Date: 2026-10-27. Dispatch: `4066f0cf-5705-817f-a36c-dc886ae4c83f`. Run: `32ec4a1b-1492-4b64-9a84-aedbe5bf10fe`.

## Result

The shared fixture in `scripts/parity-fixture.ts` provides one inline project, explicit initial state, five seeds, and the fixed input sequence `[7, 13, 20, 3, 17, 41, 19, 1, 39, 60]` ms. The Node baseline and browser bundle import this same fixture and compare the `fingerprint()` strings byte-for-byte, with no normalization or tolerance. The Node baseline runs the same `GameEngine` / `TurnExecutor` / `RealtimeExecutor` path used by cf-play. Chromium is launched headlessly through the existing `scripts/visual/local-browser.mjs` launcher; on this machine the runner bootstrapped its browser packages in a temporary npm prefix and removed the temporary links afterwards. No project dependency or lockfile was changed.

Both Executor runtimes are checked: `turn` and `realtime`. Each of the ten seed/runtime cases runs twice in Chromium and twice in Node. The parity gate was run independently twice (`npm run check:determinism`, and again inside `npm run check:mission`); the hashes matched on both invocations.

| seed | runtime | browser fingerprint | cf-play Node fingerprint | match |
|---|---|---|---|---|
| NAR-4.4-seed-01 | turn | `16345b13d05eb7b7` | `16345b13d05eb7b7` | yes |
| NAR-4.4-seed-01 | realtime | `ba7e8b854dd56fa9` | `ba7e8b854dd56fa9` | yes |
| NAR-4.4-seed-02 | turn | `d1c5a60f9b10edcb` | `d1c5a60f9b10edcb` | yes |
| NAR-4.4-seed-02 | realtime | `c3e35e2af27ebd56` | `c3e35e2af27ebd56` | yes |
| NAR-4.4-seed-03 | turn | `ee7028d7cfdf8dab` | `ee7028d7cfdf8dab` | yes |
| NAR-4.4-seed-03 | realtime | `fada6b1df5df11a9` | `fada6b1df5df11a9` | yes |
| NAR-4.4-seed-04 | turn | `7311f9155950a569` | `7311f9155950a569` | yes |
| NAR-4.4-seed-04 | realtime | `6aad22842555abc8` | `6aad22842555abc8` | yes |
| NAR-4.4-seed-05 | turn | `3f033f1c05fa6110` | `3f033f1c05fa6110` | yes |
| NAR-4.4-seed-05 | realtime | `8382bf962b9fbcca` | `8382bf962b9fbcca` | yes |

**Parity:** 10/10 matches, zero discrepancies. **Repeatability:** 10/10 browser and Node fingerprints stable across their second runs. Each complete gate invocation returned `rc=0`.

## `check:mission` integration

The existing `scripts/mission-smokes.mts` list remains unchanged at exactly 55 smoke scripts; the suite reports `55/55 passed; rc=0`. `scripts/check-mission.mts` adds the existing `check:determinism` command as an additional mission step, so it now runs the NAR-4.6 browser parity gate without removing any mission smoke or reference check. The check output separately identifies the second-runtime additions:

- Chromium `turn` executor vs cf-play Node `turn` executor: five seed cases, repeated.
- Chromium `realtime` executor vs cf-play Node `realtime` executor: five seed cases, repeated.

The two existing reference checks were retained and passed in `check:mission`:

| cf-play reference | rc | Result |
|---|---:|---|
| `public/campaigns/ash-of-caerden` | 0 | 10 scenes / 8 locations / 6 dialogues / 21 Ink knots; 0 errors, 8 warnings; five-seed check passed |
| `public/campaigns/ash-of-caerden-adventure` | 0 | Same 10/8/6/21 counts and 0 errors / 8 warnings; five-seed outcomes and coverage unchanged |

The kit was packed, unzipped to a temporary directory, and checked using only the extracted kit's `cf-play.mjs`: `node __chronicle_ai__/cf-play.mjs check __chronicle_ai__/examples/narrative` returned `rc=0` (110 files; 10/8/6/21; 0 errors, 8 warnings; five seeds). The temporary extraction was removed. `check:playkit-bundle` also returned `rc=0`; published bundle SHA-256: `566887cfc475a664e50c2f42b9599d1b9469e0f84355e1a54fc08a97180ad7cb`.

## Acceptance gates

| Gate | Result |
|---|---|
| `npx tsc -b` | rc=0 |
| Changed-script TypeScript check (Bundler resolution, `noEmit`) | rc=0 |
| `npm run check:module-size` | rc=0 |
| `npm run smoke:core` | rc=0 |
| `npx oxlint scripts/check-determinism.mts scripts/check-parity.mts scripts/parity-browser-entry.ts scripts/parity-fixture.ts scripts/check-mission.mts --quiet` | rc=0; 0 warnings and 0 errors |
| `npm run check:mission` | rc=0; all checks passed, including all 55 original smokes, both cf-play references, and NAR-4.6 parity |
| `npm run check:determinism` (standalone twice; also run inside `check:mission`) | rc=0 every time; same ten parity hashes, zero mismatches |
| `npm run pack:ai-kit` + unpacked-kit `cf-play check` | rc=0; 110 files; expected 10/8/6/21 reference results |
| `npm run check:playkit-bundle` | rc=0; fresh bundle |

## Scope and debt status

Changes are limited to the determinism/parity and mission-check scripts, their shared fixture/browser entry, and this report. No workflow, engine/player source, published AI bundle, dependencies, lockfile, oracle composition, or unrelated debt row was changed. D-05 remains **open** until the two-runtime parity check is green in GitHub CI; it will be closed with the date and PR link only after that CI result is observed. D-01, D-02, and D-03 remain unchanged.
