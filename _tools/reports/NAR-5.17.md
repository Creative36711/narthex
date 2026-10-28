# NAR-5.17 — bounded browser install for parity

Dispatch: `4076f0cf-5705-8116-baaa-c99f586d33ea`
Run: `4f76548f-792f-4f1b-b850-ac579a075a1d`
Base: `73971f6ae1e825746c1728770ada19539d4e5472` (merged NAR-5.10 / PR #131).

## Change

- `scripts/check-parity.mts` prints the exact npm install command and lets npm output stream to the log (`stdio: 'inherit'`). The fallback `spawnSync` has `timeout: 120000`. Its failure message includes both `@sparticuz/chromium` and `playwright-core`, the timeout/error, and the complete install command.
- Chromium's displayed version now comes from the already-launched Playwright browser (`browser.version()`), not a second unbounded synchronous browser process; the log label and parity fingerprints are unchanged.
- `.github/workflows/visual.yml` keeps `pull_request` and `workflow_dispatch`, adds `push: { branches: [main] }`, and caches both the installed parity package prefix and extracted Chromium runtime with `actions/cache@v4`. The explicit install step runs only on a cache miss. The determinism step receives the package prefix and sets `TMPDIR` to the cached runtime path, so a cache hit skips reinstall and unpacking. Its timeout is five minutes; the install step also has a five-minute limit. The `screenshots` job timeout remains 20 minutes.
- `scripts/check-determinism.mts`, parity inputs/results, `package.json`, `src/core/**`, `public/**`, `docs/contracts/**`, and `packs/**` were not changed.

## Local checks

- `npm ci` — rc=0.
- `npx tsc -b` — rc=0.
- `npm run lint` — rc=0 (1,509 existing warnings, 0 errors).
- `npx oxlint scripts/check-parity.mts .github/workflows/visual.yml` — rc=0, 0 warnings / 0 errors.
- `git diff --check` — rc=0.
- Cold temporary prefix, with `NPM_CONFIG_CACHE` under `/tmp`: `npm run check:determinism` — rc=0 in 7.55 s. The visible install added 20 packages in 4 s; Chromium 131 parity passed 10/10 rows and repeated fingerprints were stable.
- Warm-prefix simulation: after installing those two packages to a temporary prefix, `NARTHEX_PARITY_BROWSER_PREFIX="$tmp/prefix" npm run check:determinism` — rc=0 in 4.78 s. Log states `using cached packages ...; no install`; 10/10 parity rows passed.
- Cached extracted-runtime simulation: with `NARTHEX_PARITY_BROWSER_PREFIX` and `TMPDIR` both under a disposable `/tmp` directory, two consecutive `npm run check:determinism` runs passed. The first (unpack/cache fill) took 7 s; the second used the same Chromium runtime and took 1 s. Both preserved the same 10/10 fingerprints.

## Negative probes

1. Empty npm cache outside the repository, with npm offline (`NPM_CONFIG_CACHE="$tmp/npm-cache" NPM_CONFIG_OFFLINE=true npm run check:determinism`): expected rc=1 in 1 s. npm reported `ENOTCACHED`; the checker then reported both required packages and the full install command. It did not wait for the workflow timeout.
2. Timeout path, with no browser packages and a temporary npm cache outside the repository, using a controlled `npm` shim that stalls: `node_modules/.bin/tsx scripts/check-determinism.mts` — expected rc=1 in 120 s. Log includes `timed out after 120000 ms`, both package names, and the complete `npm install --prefix ...` command.

## Pull-request CI

PR #132 `screenshots` run [`40776654386`](https://github.com/Creative36711/narthex/actions/runs/40776654386) passed. The browser-package install step took 3 s and `Детерминизм циклов` took 3 s; the complete job took 4m36s.

A second green PR run [`40777415310`](https://github.com/Creative36711/narthex/actions/runs/40777415310) verified the warm-cache path: `Установить браузерные пакеты для parity` was skipped (exact cache hit), while `Детерминизм циклов` passed in 3 s; the complete job took 5m33s. Both are `pull_request` runs; per the updated card, no manual `workflow_dispatch` API request is made.

A later PR run [`40778228954`](https://github.com/Creative36711/narthex/actions/runs/40778228954) timed out at the 5-minute `Детерминизм циклов` limit on a cache hit. This was treated as a code defect, not dismissed as a flake. The parity path also made an unnecessary synchronous `chromium --version` call through `local-browser.mjs`; `check-parity.mts` now gets the same `Chromium 131.0.6778.0` label from the already-running Playwright browser, avoiding that extra unbounded process. The updated local warm-prefix run passed in 4.72 s with identical 10/10 fingerprints. Follow-up PR run [`40779434375`](https://github.com/Creative36711/narthex/actions/runs/40779434375) then passed: the parity package install step was skipped on an exact cache hit, `Детерминизм циклов` completed in 4 s, and `screenshots` completed in 5m1s.

The latest pre-trigger-change PR run [`40780151281`](https://github.com/Creative36711/narthex/actions/runs/40780151281) also passed: exact cache hit, installer skipped, `Детерминизм циклов` in 4 s, `screenshots` in 5m21s.

After adding the main push trigger, PR run [`40781799874`](https://github.com/Creative36711/narthex/actions/runs/40781799874) timed out at the 5-minute determinism step even though the package installer was skipped. Together with `40778228954`, this is treated as a repeated defect, not a flake. The packages were cached but `local-browser.mjs` still unpacked Chromium under the runner's default temporary directory each job. This follow-up caches that extracted runtime too and sets `TMPDIR` for the determinism step to the cached runtime path (new cache key v2). The fresh v2-cache PR run [`40782750401`](https://github.com/Creative36711/narthex/actions/runs/40782750401) passed: cache-miss package installation took 2 s, `Детерминизм циклов` completed in 3 s, and the complete `screenshots` job took 5m25s. This run cached the extracted runtime for the subsequent exact-cache-hit run.

The exact-cache-hit PR run [`40783512116`](https://github.com/Creative36711/narthex/actions/runs/40783512116) passed with the installer skipped, `Детерминизм циклов` in 2 s, and `screenshots` in 5m22s.

## Main verification strategy

A `workflow_dispatch` API attempt in the previous submission returned HTTP 403, `Resource not accessible by integration`. Per the current card, no manual API dispatch is repeated. The new `push: { branches: [main] }` trigger will run `screenshots` after the merge; `pull_request` and `workflow_dispatch` remain enabled.

Допущение: если push-run не появится в течение 15 минут после мержа, зелёный `pull_request` run PR #132 на финальном rebased head будет доказательством для main: `refs/pull/132/merge` даёт то же итоговое дерево после squash-мержа. Повторный workflow dispatch не запускается.
