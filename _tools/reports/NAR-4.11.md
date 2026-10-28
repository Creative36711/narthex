# NAR-4.11 — Возврат-2: browser / `cf-play` parity

Дата: 2026-10-28
Dispatch: `4076f0cf-5705-817b-975b-c0d0826fa572`
Run: `ad27c306-766e-45cd-bf17-c8c768f9f53f`
Проверенная база: `origin/main` = `50c315f259f6d43941bc113095c7403e969ef0fc`.

## Итог

Проверки, доступные в неизменённом репозитории, пройдены: прямой NAR-4.6 runner дал 10/10 совпадений для общей NAR-4.4 fixture; `check:determinism`, TypeScript, `cf-play check` эталонной Ash-кампании и проверка kit после распаковки вернули rc=0. Текущие `cf-play cycles --json` для двух reference projects тоже прошли.

При этом обязательный `npm run check:parity` возвращает rc=1, потому что такого npm script нет. А существующий `scripts/check-parity.mts` проверяет NAR-4.4 fixture и две runtime-ветки, но не пять seed'ов на проектах `ash-of-caerden` и `realtime-wall-zone`. Поэтому требуемая project-level browser/`cf-play` матрица 10/10 **не подтверждена**. Верификационный scope соблюдён: alias, runner, проверки и пороги не менялись; несовпадение в области проверки не замаскировано.

## Среда и границы

- Runner: `e2b.local` (Arena sandbox); `Linux 6.1.158+ x86_64 GNU/Linux`.
- Node `v22.22.3`; npm `10.9.8`.
- Headless browser: Chromium `131.0.6778.0`.
- Начальные условия: после `git fetch origin main` рабочее дерево было чистым; `HEAD`, `origin/main` и общий предок совпадали на `50c315f259f6d43941bc113095c7403e969ef0fc`.
- Работа велась на закреплённой платформой ветке `arena/40e6e676-narthex`; ветку `nar/NAR-4.11` не создавал и не переключал.
- Единственные новые tracked-файлы этой задачи — этот отчёт и `docs/decisions/NAR-4.11.md`. `npm ci --ignore-scripts`, проверки и сборка kit tracked-файлы не изменили; `node_modules/` и `dist-ai/` игнорируются.

`npm ci --ignore-scripts` вернул rc=0 (70 пакетов). npm сообщил об одной moderate vulnerability; `npm audit fix` не запускался, чтобы не менять зависимости вне задачи.

## Расхождение команды и матрицы

`package.json` содержит `check:determinism`, но не содержит `check:parity`. Точный обязательный вызов:

```text
$ npm run check:parity
rc=1
stderr: npm error Missing script: "check:parity"
```

Скрипт `scripts/check-parity.mts` существует, и `scripts/check-determinism.mts` импортирует его `runParity()`. Но `scripts/parity-fixture.ts` жёстко создаёт проект `nar-4.4-determinism-fixture`, пять `NAR-4.4-seed-*` и runtimes `turn`/`realtime`. Это не те же project rows, что `public/campaigns/ash-of-caerden` и `_tools/projects/realtime-wall` (`realtime-wall-zone`). `cf-play cycles` действительно загружает эти два проекта, но текущая команда использует по одному фиксированному seed на проект и не сравнивает браузерные fingerprints. Это разные проверки; их результаты ниже не названы project-level parity.

Не добавлял npm alias и не менял runner, как запрещено scope задачи. Вместо этого запустил имеющийся NAR-4.6 runner непосредственно; его результат — самостоятельное доказательство только для указанной fixture.

## NAR-4.6 browser / Node runner

Команда: `npx tsx scripts/check-parity.mts` — rc=0. Полные fingerprints сохранены ровно в том виде, как их выдаёт runner (16 hex-символов); ни сортировки, ни округления, ни выборочного повтора после mismatch не делалось.

| Project / runtime | Seed | Browser hash | `cf-play` hash | Match |
|---|---|---|---|---|
| `nar-4.4-determinism-fixture` / turn | `NAR-4.4-seed-01` | `16345b13d05eb7b7` | `16345b13d05eb7b7` | yes |
| `nar-4.4-determinism-fixture` / realtime | `NAR-4.4-seed-01` | `ba7e8b854dd56fa9` | `ba7e8b854dd56fa9` | yes |
| `nar-4.4-determinism-fixture` / turn | `NAR-4.4-seed-02` | `d1c5a60f9b10edcb` | `d1c5a60f9b10edcb` | yes |
| `nar-4.4-determinism-fixture` / realtime | `NAR-4.4-seed-02` | `c3e35e2af27ebd56` | `c3e35e2af27ebd56` | yes |
| `nar-4.4-determinism-fixture` / turn | `NAR-4.4-seed-03` | `ee7028d7cfdf8dab` | `ee7028d7cfdf8dab` | yes |
| `nar-4.4-determinism-fixture` / realtime | `NAR-4.4-seed-03` | `fada6b1df5df11a9` | `fada6b1df5df11a9` | yes |
| `nar-4.4-determinism-fixture` / turn | `NAR-4.4-seed-04` | `7311f9155950a569` | `7311f9155950a569` | yes |
| `nar-4.4-determinism-fixture` / realtime | `NAR-4.4-seed-04` | `6aad22842555abc8` | `6aad22842555abc8` | yes |
| `nar-4.4-determinism-fixture` / turn | `NAR-4.4-seed-05` | `3f033f1c05fa6110` | `3f033f1c05fa6110` | yes |
| `nar-4.4-determinism-fixture` / realtime | `NAR-4.4-seed-05` | `8382bf962b9fbcca` | `8382bf962b9fbcca` | yes |

Полный raw stdout команды:

```text
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

Headless launch method: `scripts/check-parity.mts` uses `scripts/visual/local-browser.mjs`. If browser packages are absent, the wrapper installs them into a temporary npm prefix with the full arguments `npm install --prefix <temporary-prefix> --no-save --ignore-scripts --no-audit --no-fund @sparticuz/chromium@131 playwright-core@1.49.1`, links them for that process, then removes the temporary links/prefix. `local-browser.mjs` decompresses the Chromium and AL2023 library layers into `/tmp/cf-browser` and launches Playwright Chromium with `--no-sandbox --disable-dev-shm-usage --hide-scrollbars --font-render-hinting=none`, setting `LD_LIBRARY_PATH` to the extracted libraries. No browser download from Playwright CDN or system package installation was used.

## `npm run check:determinism`

Команда вернула rc=0, stderr пустой. Ниже полный stdout. Строки `MUTATION MISMATCH` — ожидаемый результат намеренно изменённого dt mutation probe, а не browser/Node mismatch; итоговые PASS-строки подтверждают, что мутация обнаружена в обоих runtimes.

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

## Reference-project checks

Команда `node public/ai/cf-play.mjs cycles --json` была вызвана дважды; оба вызова вернули rc=0 и обе project assertion-группы прошли. В обоих выводах current final fingerprints равны:

| Project | Runtime | Seed configured by existing CLI | Initial fingerprint | Final fingerprint |
|---|---|---|---|---|
| `ash-of-caerden` | turn | `NAR-4.5-cycle-check` | `ed2cd114d72ab278` | `3e183cbc9ce9a358` |
| `realtime-wall-zone` | realtime | `realtime-wall-zone:NAR-4.5` | `9910f683b96eba27` | `c585e2c26d21ed7e` |

Это повторяемость штатных `cf-play cycles` на двух референсах с текущими конфигурационными seed'ами; это **не** пять seed'ов на проект и не browser/`cf-play` parity.

Также выполнено `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out /tmp/nar411-check-ash` — rc=0. Полный stdout:

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

## AI-kit после распаковки

`npm run pack:ai-kit` вернул rc=0: 110 файлов / 2.83 MB; ZIP — 0.60 MB. ZIP integrity test прошёл, архив распакован во временный каталог (122 archive entries, включая directory entries), затем выполнено:

```text
node <temporary-unpack>/__chronicle_ai__/cf-play.mjs check <temporary-unpack>/__chronicle_ai__/examples/narrative --out /tmp/nar411-kit-check
rc=0
```

Распакованный kit сообщил тот же результат, что и Ash: `10 сцен · 8 локаций · 6 диалогов · 21 узлов ink`, 0 ошибок / 8 предупреждений, пять seed с исходом death, покрытие 6/10. ZIP и временная папка не добавлены в Git.

## TypeScript и сводка кодов

| Проверка | Код | Результат |
|---|---:|---|
| `npm run check:parity` (обязательная npm-команда) | 1 | Script отсутствует в `package.json`; stderr указан выше. |
| `npx tsx scripts/check-parity.mts` (существующий NAR-4.6 runner напрямую) | 0 | 10/10 browser/Node совпадений только для `nar-4.4-determinism-fixture`; 0 cross-environment mismatches. |
| `npm run check:determinism` | 0 | 10/10 replay pairs; mutation обнаружена в обоих runtimes; parity fixture 10/10. |
| `npx tsc -b` | 0 | stderr/stdout пустые. |
| `npm run check:decisions` | 0 | Fixtures прошли; 36 решений просмотрены, 26 legacy/statusless; check passed. |
| `node public/ai/cf-play.mjs cycles --json` | 0 × 2 | Оба reference projects прошли с текущими фиксированными seeds; не пятиseedовая browser parity. |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden ...` | 0 | 0 errors, 8 unchanged warnings; five-seed check passed. |
| AI-kit pack + unzip + extracted `cf-play check` | 0 | ZIP цел; unpacked example check passed. |

**Заключение по приёмке:** исходная проверка и TypeScript зелёные, но acceptance `npm run check:parity = 0` невыполним без изменения `package.json`, а фактическая матрица двух reference projects отсутствует в текущем NAR-4.6 runner. Из-за запрета менять scripts/checks не заявляю полное закрытие project-level parity. `check` для этого отчёта — **1** (обязательная npm-команда завершилась ошибкой отсутствующего script). См. трёхстрочное решение в [`docs/decisions/NAR-4.11.md`](../../docs/decisions/NAR-4.11.md).
