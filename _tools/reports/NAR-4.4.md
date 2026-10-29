# NAR-4.4 · Детерминированный повтор циклов

Дата: 2026-10-27. База: `4f4160c` (`origin/main`).

## Реализация и границы

Внесены только четыре разрешённых изменения: `scripts/check-determinism.mts`,
один новый alias `check:determinism` в `package.json`, шаг в
`.github/workflows/visual.yml` и этот отчёт. Существующие npm-команды, включая
`check:mission`, `smoke:*` и playkit/cf-play, не менялись. `src/core/**`,
`src/player/**`, `public/ai/**`, кампании, композиция oracle, пороги и Phase 4
не тронуты. Нового решения в `docs/decisions/` не требуется: обе реализации
циклов и канонический `Executor.fingerprint()` уже существуют.

Runner создаёт inline-фикстуру и передаёт `GameEngine` явный стартовый
`GameState`; ни загрузчика кампаний, сети, системного времени, случайного seed
по умолчанию, ожиданий/повторов, сортировки результатов или округления перед
хешированием в пробе нет. Каждый прогон проходит один и тот же фиксированный
ряд `dt` в исходном порядке:

```text
[7, 13, 20, 3, 17, 41, 19, 1, 39, 60] ms
```

У фикстуры `ticks_per_day = 4 320 000`, то есть один игровой тик равен
фиксированному шагу realtime в 20 мс. Начальный tick — 17; штатный ряд
продвигает оба цикла до tick 28. Правило `random_chance` с seed-управляемым
PRNG записывает результаты в состояние, поэтому fingerprints охватывают не
только seed и время, но и эффекты seeded RNG. Каждый hash получен напрямую из
`Executor.fingerprint()` / существующего canonical state fingerprint.
Сравниваются два независимых повтора **внутри каждого runtime**; cross-runtime
равенство не является условием проверки.

## Нормальный запуск и матрица fingerprints

Команда: `npm run check:determinism` — **rc=0**.

```text
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
```

## Mutation mode

`npm run check:determinism -- --mutate` intentionally adds 20 ms to the final
fixed `dt` sample. It prints both hash mismatches and **returns rc=1 by design**;
the normal command runs the same probe and fails unless both runtimes diverge.

```text
Mutation probe: final fixed dt sample +20 ms; seed=NAR-4.4-seed-01.
MUTATION MISMATCH: runtime=turn seed=NAR-4.4-seed-01 baseline=16345b13d05eb7b7 mutated=6a9b8dff787762ab tick=28->29 rngHits=1->1
MUTATION MISMATCH: runtime=realtime seed=NAR-4.4-seed-01 baseline=ba7e8b854dd56fa9 mutated=0e101ef14862e6dd tick=28->29 rngHits=3->3
--mutate: deliberate divergence detected; expected exit code 1.
```

Observed direct mutation-mode exit status: **1**. No retries or hash adjustments.

## Проверки

| Команда | Результат |
|---|---|
| `npm run check:determinism` | rc=0; 10/10 replay pairs equal; both mutation comparisons diverge |
| `npm run check:determinism -- --mutate` | rc=1 intentionally; explicit `MUTATION MISMATCH` for turn and realtime |
| `npx tsc -b` | rc=0 |
| standalone TypeScript check of `scripts/check-determinism.mts` | rc=0 |
| `npm run check:module-size` | rc=0 |
| `npx oxlint scripts/check-determinism.mts --quiet` | rc=0; runner has no lint errors |
| `npm run lint` | **rc=1, pre-existing/out-of-scope:** 5 `react-hooks/rules-of-hooks` errors in `public/ai/campaign-audit.mjs` (2) and `src/player/DialogueOverlay.tsx` (3); neither file is changed or permitted by this task. `oxlint --quiet` confirms the same five errors. Остальные 1507 lint findings — warnings. |
| `npm run smoke:core` | rc=0 |
| `npm run smoke:mission` | rc=0; 55/55 |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; 10 scenes, 8 locations, 6 dialogues, 21 Ink nodes, 0 errors, 8 warnings |
| `npm run pack:ai-kit` | rc=0; 110 files packed |
| unpacked kit: `node __chronicle_ai__/cf-play.mjs check __chronicle_ai__/examples/narrative` | rc=0; same 10/8/6/21, 0 errors, 8 warnings; temporary extraction removed |
| `npm run check:playkit-bundle` | rc=0; published bundle is fresh |

The global lint gate is the only required local gate that does not pass. Its
five errors originate in files explicitly outside this task's write scope; the
runner itself is clean. They are reported, not suppressed or fixed by changing
unrelated runtime, generated bundle, lint configuration, or existing oracles.
