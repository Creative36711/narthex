# NAR-4.11 — Возврат-2: равенство сред браузера и `cf-play`

Дата: 2026-10-28
Dispatch: `4076f0cf-5705-817b-975b-c0d0826fa572`
Run: `38db70d4-735b-4897-bafc-a12a12e11295`
База проверки: `origin/main` = `50c315f259f6d43941bc113095c7403e969ef0fc`.

## Ответ

**Замечание 2 закрыто.** `npm run check:parity` вернул rc=0: 5 seed'ов × 2 runtime, 10/10 совпадений полных browser/`cf-play` fingerprints, 0 расхождений. Повторы внутри NAR-4.6 runner идентичны. `npm run check:determinism`, `npx tsc -b`, эталонный `cf-play check` и проверка kit после распаковки тоже завершились с rc=0.

## Старт и границы

В начале этого прогона выполнен `git fetch origin main`. Рабочая ветка — закреплённая Arena `arena/40e6e676-narthex`; `HEAD=9d63f466dcd9d965a182ff889ffd6b167d457783`, `origin/main=50c315f259f6d43941bc113095c7403e969ef0fc`, общий предок — `origin/main`, `git status --short` был чистым. Сессия платформенно закреплена на этой ветке, поэтому ветка `nar/NAR-4.11` не создавалась и переключения не было. Существующий PR #101 обновляется этим прогоном.

Единственная правка runtime-конфигурации — один npm script в `package.json`:

```json
"check:parity": "tsx scripts/check-parity.mts"
```

`package-lock.json` не менялся. `scripts/check-parity.mts`, `scripts/parity-fixture.ts`, `scripts/parity-browser-entry.ts`, fixture, seed-набор, логика, пороги и проверки не редактировались. Новые/обновлённые evidence-файлы: этот отчёт и `docs/decisions/NAR-4.11.md`.

## `npm run check:parity`

Точная команда вернула rc=0. Матрица использует одну общую fixture `nar-4.4-determinism-fixture`, пять seed'ов и оба runtime. Fingerprints записаны полностью в формате runner'а (16 hex-символов); ни одна среда не объявлена заранее авторитетной.

| Seed | Runtime | Хэш браузера | Хэш `cf-play` | Совпало |
|---|---|---|---|---|
| `NAR-4.4-seed-01` | turn | `16345b13d05eb7b7` | `16345b13d05eb7b7` | да |
| `NAR-4.4-seed-01` | realtime | `ba7e8b854dd56fa9` | `ba7e8b854dd56fa9` | да |
| `NAR-4.4-seed-02` | turn | `d1c5a60f9b10edcb` | `d1c5a60f9b10edcb` | да |
| `NAR-4.4-seed-02` | realtime | `c3e35e2af27ebd56` | `c3e35e2af27ebd56` | да |
| `NAR-4.4-seed-03` | turn | `ee7028d7cfdf8dab` | `ee7028d7cfdf8dab` | да |
| `NAR-4.4-seed-03` | realtime | `fada6b1df5df11a9` | `fada6b1df5df11a9` | да |
| `NAR-4.4-seed-04` | turn | `7311f9155950a569` | `7311f9155950a569` | да |
| `NAR-4.4-seed-04` | realtime | `6aad22842555abc8` | `6aad22842555abc8` | да |
| `NAR-4.4-seed-05` | turn | `3f033f1c05fa6110` | `3f033f1c05fa6110` | да |
| `NAR-4.4-seed-05` | realtime | `8382bf962b9fbcca` | `8382bf962b9fbcca` | да |

Полный сырой stdout команды:

```text

> narthex@0.9.0 check:parity
> tsx scripts/check-parity.mts

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

`npm run check:parity` запускает штатный NAR-4.6 wrapper. Если browser tooling отсутствует в `node_modules`, он ставится только во временный npm prefix полной командой `npm install --prefix <temporary-prefix> --no-save --ignore-scripts --no-audit --no-fund @sparticuz/chromium@131 playwright-core@1.49.1`; package/lock files от установки не меняются. `scripts/visual/local-browser.mjs` распаковывает Chromium и AL2023 library layer в `/tmp/cf-browser`, затем запускает headless Chromium через Playwright с аргументами `--no-sandbox --disable-dev-shm-usage --hide-scrollbars --font-render-hinting=none` и соответствующим `LD_LIBRARY_PATH`. Версия браузера: Chromium `131.0.6778.0`.

## `npm run check:determinism`

Команда вернула rc=0, stderr пустой. Полный stdout:

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

Строки `MUTATION MISMATCH` выше относятся только к намеренно изменённому dt mutation probe; это ожидаемое подтверждение обнаружения мутации. Все 10 обычных replay pairs и 10 browser/Node parity rows совпали.

## TypeScript, reference check и kit

- `npx tsc -b` — rc=0, stdout/stderr пустые.
- `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out /tmp/nar411-final-check-ash` — rc=0; 10 сцен, 8 локаций, 6 диалогов, 21 Ink knot, 0 errors, 8 warnings, 5 seed'ов → death, coverage 6/10. Все восемь warnings — `flag_written_never_read`, те же значения, что в полном stdout ниже.
- `node public/ai/cf-play.mjs cycles --json` — rc=0; оба эталонных проекта прошли: `ash-of-caerden` / turn final fingerprint `3e183cbc9ce9a358`; `realtime-wall-zone` / realtime final fingerprint `c585e2c26d21ed7e`. Используемые штатные seeds: `NAR-4.5-cycle-check` и `realtime-wall-zone:NAR-4.5`. `cf-play cycles` не переписывался.
- `npm run pack:ai-kit` — rc=0; 110 файлов / 2.83 MB, ZIP 0.60 MB. Integrity test прошёл; архив распакован (122 entries включая каталоги), `cf-play check` запущен из распакованного `examples/narrative` и вернул rc=0 с тем же результатом 10/8/6/21, 0 errors / 8 warnings, пять seed'ов → death, coverage 6/10.
- `npm run check:decisions` — rc=0 после записи решения.

Raw stdout эталонного Ash `cf-play check`:

```text
# Проверка кампании · [DEV] Пепел Каэрдена — эталон narrative (полигон смоуков)

✓ проверка пройдена

## Статика
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
- flag_written_never_read: флаг «guard_ration_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «herbs_gathered» выставляется, но нигде не читается
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается
- flag_written_never_read: флаг «medallion_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «skeleton_looted» выставляется, но нигде не читается
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается
- flag_written_never_read: флаг «wrench_taken» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/ash-of-caerden/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp
```

## Проверки и состояние PR

| Команда | Код | Результат |
|---|---:|---|
| `npm run check:parity` | 0 | 10/10; 0 parity mismatches; повторные hashes стабильны. |
| `npm run check:determinism` | 0 | 10/10 replay pairs; mutation probe обнаружен в обоих runtimes. |
| `npx tsc -b` | 0 | TypeScript build check passed. |
| `cf-play check` на Ash | 0 | 0 errors; исходные 8 warnings; 5 seed'ов проверены. |
| Kit ZIP integrity + распакованный `cf-play check` | 0 | Kit проверен после распаковки, результат эталона сохранён. |

PR #101 обновляется из закреплённой ветки; он будет слит squash-мержем после прохождения GitHub checks.
