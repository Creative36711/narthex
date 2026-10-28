# NAR-5.17 — bounded browser install for parity

Dispatch: `4076f0cf-5705-8116-baaa-c99f586d33ea`
Run: `c74f3e61-6412-4f06-87c7-01f3708a21d4`
Base: `73971f6ae1e825746c1728770ada19539d4e5472` (merged NAR-5.10 / PR #131).

## Change

- `scripts/check-parity.mts` prints the exact npm install command and lets npm output stream to the log (`stdio: 'inherit'`). The fallback `spawnSync` has `timeout: 120000`. Its failure message includes both `@sparticuz/chromium` and `playwright-core`, the timeout/error, and the complete install command.
- `.github/workflows/visual.yml` caches the installed parity package prefix with `actions/cache@v4`; the explicit install step runs only on a cache miss. The determinism step receives that prefix, does not install when the cached packages are present, and has `timeout-minutes: 5`. The install step is also limited to five minutes. The `screenshots` job timeout remains 20 minutes.
- `scripts/check-determinism.mts`, parity inputs/results, `package.json`, `src/core/**`, `public/**`, `docs/contracts/**`, and `packs/**` were not changed.

## Local checks

- `npm ci` — rc=0.
- `npx tsc -b` — rc=0.
- `npm run lint` — rc=0 (1,509 existing warnings, 0 errors).
- `npx oxlint scripts/check-parity.mts .github/workflows/visual.yml` — rc=0, 0 warnings / 0 errors.
- `git diff --check` — rc=0.
- Cold temporary prefix, with `NPM_CONFIG_CACHE` under `/tmp`: `npm run check:determinism` — rc=0 in 7.55 s. The visible install added 20 packages in 4 s; Chromium 131 parity passed 10/10 rows and repeated fingerprints were stable.
- Warm-prefix simulation: after installing those two packages to a temporary prefix, `NARTHEX_PARITY_BROWSER_PREFIX="$tmp/prefix" npm run check:determinism` — rc=0 in 4.78 s. Log states `using cached packages ...; no install`; 10/10 parity rows passed.

## Negative probes

1. Empty npm cache outside the repository, with npm offline (`NPM_CONFIG_CACHE="$tmp/npm-cache" NPM_CONFIG_OFFLINE=true npm run check:determinism`): expected rc=1 in 1 s. npm reported `ENOTCACHED`; the checker then reported both required packages and the full install command. It did not wait for the workflow timeout.
2. Timeout path, with no browser packages and a temporary npm cache outside the repository, using a controlled `npm` shim that stalls: `node_modules/.bin/tsx scripts/check-determinism.mts` — expected rc=1 in 120 s. Log includes `timed out after 120000 ms`, both package names, and the complete `npm install --prefix ...` command.

## Pull-request CI

PR #132 `screenshots` run [`40776654386`](https://github.com/Creative36711/narthex/actions/runs/40776654386) passed. In the job, the browser-package install step took 3 s and `Детерминизм циклов` took 3 s; the complete job took 4m36s. This is a green `pull_request` run, not the requested `workflow_dispatch` run.

## GitHub workflow dispatch

Attempted `gh workflow run visual.yml --ref arena/acab765a-narthex`. GitHub returned HTTP 403, `Resource not accessible by integration`; no workflow-dispatch run was created, so there is no run URL or green dispatch result to report. GitHub connection permissions need attention before the required branch and post-merge-main dispatch runs can be performed.
