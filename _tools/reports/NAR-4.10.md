# NAR-4.10 — Возврат-1: повторная проверка детерминизма

Дата: 2026-10-28
Dispatch: `4076f0cf-5705-813a-96b8-c7b84ce8c32c`
Run: `d28716bd-45e1-4d18-9cd8-95b15b4fe86e`
Проверенная база: `origin/main` = `ab2f484cd768cf9fb911934ed5b4be57340c6b4d`.

## Среда

- Runner/машина: `e2b.local` (Arena sandbox), Linux `6.1.158+`, `x86_64 GNU/Linux`
- Node: `v22.22.3`
- npm: `10.9.8`

## База, ветка и неизменность области

Начальный рабочий каталог был чистым. После `git fetch origin main` `git merge-base HEAD origin/main` был пустым, поскольку локальный clone помечал оба конца shallow (`46db527…` и `ab2f484…`). После углубления fetch общий предок подтвердился: `46db5276600e1b9988bc6846148510c908ae21d3`. Фиксированная Arena-ветка отставала от свежего `origin/main`; чтобы не отправлять PR с обратным изменением 41 несвязанного файла, та же закреплённая ветка была выровнена на `origin/main` при чистом status. До проверки: `HEAD = origin/main = ab2f484…`, merge-base тот же, `git diff --stat origin/main` пустой.

Допущение: платформа закрепляет эту сессию на `arena/ca8e5cd6-narthex`, поэтому новую `nar/NAR-4.10` ветку не создавал и не переключался на другую; проверка и PR выполняются с закреплённой ветки. Это решение записано тремя строками в `docs/decisions/NAR-4.10.md`.

Проверка исходников и `git status` подтверждают, что `src/`, `scripts/`, `public/ai/`, `_tools/cf-play/`, проекты и исходные артефакты NAR-4.4 не менялись. Единственные новые файлы этой задачи — данный отчёт и решение. `npm ci --ignore-scripts`, `tsc`, запуск проверок и упаковка не изменили tracked файлы.

`.github/workflows/visual.yml` проверен только для чтения: шаг `Детерминизм циклов` (строка 37) вызывает именно `npm run check:determinism`.

## `npm run check:determinism`

Команда запущена на точном `origin/main`; rc=0, stderr пустой. Ниже полный stdout, без сокращения fingerprints:

```text

> narthex@0.9.0 check:determinism
> tsx scripts/check-determinism.mts

NAR-4.4 determinism check: 5 seeds × 2 runtimes × 2 replays.
Fixed dt sequence (ms): [7, 13, 20, 3, 17, 41, 19, 1, 39, 60]; realtime step=20 ms.
| seed | runtime | run 1 fingerprint | run 2 fingerprint | same |
|---|---|---|---|---|
| NAR-4.4-seed-01 | turn | 16345b13d05eb7b7 | 16345b13d05eb7b7 | yes |
| NAR-4.4-seed-01 | realtime | ba7e8b854dd56fa9 | ba7e8b854dd56fa9 | yes |
| NAR-4.4-seed-02 | turn | d1c5a60f9b10edcb | d1c5a60f9b10edcb | yes |
| NAR-4.4-seed-02 | realtime | c3e35e2af27ebd56 | c3e35e2af27ebd56 | yes |
| NAR-4.4-seed-03 | turn | ee7028d7cfdf8dab | ee7028d7cfdf8dab | yes |
| NAR-4.4-seed-03 | realtime | fada6b1df5df11a9 | fada6b1df5df11a9 | yes |
| NAR-4.4-seed-04 | turn | 7311f9155950a569 | 7311f9155950a569 | yes |
| NAR-4.4-seed-04 | realtime | 6aad22842555abc8 | 6aad22842555abc8 | yes |
| NAR-4.4-seed-05 | turn | 3f033f1c05fa6110 | 3f033f1c05fa6110 | yes |
| NAR-4.4-seed-05 | realtime | 8382bf962b9fbcca | 8382bf962b9fbcca | yes |
Mutation probe: final fixed dt sample +20 ms; seed=NAR-4.4-seed-01.
MUTATION MISMATCH: runtime=turn seed=NAR-4.4-seed-01 baseline=16345b13d05eb7b7 mutated=6a9b8dff787762ab tick=28->29 rngHits=1->1
MUTATION MISMATCH: runtime=realtime seed=NAR-4.4-seed-01 baseline=ba7e8b854dd56fa9 mutated=0e101ef14862e6dd tick=28->29 rngHits=3->3
PASS: all 10 replay pairs match; the mutation probe detects divergence in both runtimes.
Headless Chromium driver: installed in a temporary npm prefix for this check.
NAR-4.6 parity: browser (Chromium 131.0.6778.0) ↔ cf-play Node; project=nar-4.4-determinism-fixture.
Same seed and dt input row: [7, 13, 20, 3, 17, 41, 19, 1, 39, 60] ms; 5 seeds × 2 runtimes.
| seed | runtime | browser hash | cf-play hash | match |
|---|---|---|---|---|
| NAR-4.4-seed-01 | turn | 16345b13d05eb7b7 | 16345b13d05eb7b7 | yes |
| NAR-4.4-seed-01 | realtime | ba7e8b854dd56fa9 | ba7e8b854dd56fa9 | yes |
| NAR-4.4-seed-02 | turn | d1c5a60f9b10edcb | d1c5a60f9b10edcb | yes |
| NAR-4.4-seed-02 | realtime | c3e35e2af27ebd56 | c3e35e2af27ebd56 | yes |
| NAR-4.4-seed-03 | turn | ee7028d7cfdf8dab | ee7028d7cfdf8dab | yes |
| NAR-4.4-seed-03 | realtime | fada6b1df5df11a9 | fada6b1df5df11a9 | yes |
| NAR-4.4-seed-04 | turn | 7311f9155950a569 | 7311f9155950a569 | yes |
| NAR-4.4-seed-04 | realtime | 6aad22842555abc8 | 6aad22842555abc8 | yes |
| NAR-4.4-seed-05 | turn | 3f033f1c05fa6110 | 3f033f1c05fa6110 | yes |
| NAR-4.4-seed-05 | realtime | 8382bf962b9fbcca | 8382bf962b9fbcca | yes |
Repeat run: browser and cf-play hashes are stable for 10/10 rows; cross-environment mismatches=0.
PASS: 10/10 browser hashes equal cf-play; repeated hashes are identical.
```

Result: 10/10 replay pairs match, the deliberate mutation is detected in both runtimes, and browser↔Node parity is 10/10 with no mismatches.

## Fresh `cf-play cycles` replays

The stock command is invoked twice consecutively, with JSON output so the complete fingerprints can be compared:

```sh
node public/ai/cf-play.mjs cycles --json
node public/ai/cf-play.mjs cycles --json
```

Both invocations returned rc=0; `diff -u` of the raw JSON outputs returned rc=0 (`diff=0`). Results are compared in project order, only by full fingerprint equality; no sorting, rounding, or retries. The CLI has no seed override: `cmdCycles` assigns the Ash turn adapter seed `NAR-4.5-cycle-check`; the realtime adapter uses `realtime-wall-zone:NAR-4.5`. These runtime-specific project seeds are kept separate, as required by ADR 0002, and each is unchanged between the two invocations.

| Project | Runtime | Configured seed | Final fingerprint #1 | Final fingerprint #2 | diff |
|---|---|---|---|---|---:|
| `ash-of-caerden` | turn | `NAR-4.5-cycle-check` | `3e183cbc9ce9a358` | `3e183cbc9ce9a358` | 0 |
| `realtime-wall-zone` | realtime | `realtime-wall-zone:NAR-4.5` | `c585e2c26d21ed7e` | `c585e2c26d21ed7e` | 0 |

Initial fingerprints also match exactly between the two invocations: Ash `ed2cd114d72ab278` / `ed2cd114d72ab278`; realtime-wall `9910f683b96eba27` / `9910f683b96eba27`. Both projects passed all assertions in both runs; no runtime was missing. These new results independently reproduce the previous recorded project values without modifying NAR-4.4 artifacts.

## Mutation probe

The required negative test intentionally exits 1. The non-zero status is its expected result; both runtimes report divergence:

```text

> narthex@0.9.0 check:determinism
> tsx scripts/check-determinism.mts --mutate

Mutation probe: final fixed dt sample +20 ms; seed=NAR-4.4-seed-01.
MUTATION MISMATCH: runtime=turn seed=NAR-4.4-seed-01 baseline=16345b13d05eb7b7 mutated=6a9b8dff787762ab tick=28->29 rngHits=1->1
MUTATION MISMATCH: runtime=realtime seed=NAR-4.4-seed-01 baseline=ba7e8b854dd56fa9 mutated=0e101ef14862e6dd tick=28->29 rngHits=3->3
--mutate: deliberate divergence detected; expected exit code 1.
```

## Other gates and reference/kit check

| Check | Result |
|---|---|
| `npx tsc -b` | rc=0 |
| `npm run check:core-graph` | rc=0; 29 modules, acyclic, no core imports of `engine.ts` |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out /tmp/nar410-check-ash` | rc=0; 10 scenes / 8 locations / 6 dialogues / 21 Ink knots; 0 errors, 8 warnings; 5 seeds all death; coverage 6/10. Same result as the prior Ash reference evidence. |
| `npm run pack:ai-kit` | rc=0; 110 files, 2.83 MB; ZIP 0.60 MB |
| ZIP integrity and post-unpack `cf-play check` | ZIP test passed; 122 ZIP entries extracted to a temporary directory. The extracted kit's `examples/narrative` check returned rc=0 with the same 10/8/6/21, 0 errors/8 warnings, five-seed outcomes, and 6/10 coverage. |

## PR CI

The first GitHub `visual` run for PR #100 ([run 40648189143](https://github.com/Creative36711/narthex/actions/runs/40648189143)) reached the 20-minute job timeout while the `Детерминизм циклов` step was still in progress; that step was cancelled and subsequent steps were skipped. Earlier steps, including dependency installation, bundle freshness, and TypeScript, passed. The run did not report a fingerprint mismatch. The exact `npm run check:determinism` command independently completed locally on this same `origin/main` with rc=0 and the full output above. This timeout is recorded separately from the passing fresh local oracle.

## Ответ

**Замечание 1 закрыто** — на Ash полный final fingerprint `3e183cbc9ce9a358`; на realtime-wall полный final fingerprint `c585e2c26d21ed7e`. Run 1 and run 2 match exactly on both reference projects; `npm run check:determinism` also reports zero replay or browser/Node mismatches.
