# NAR-5.9 · реальный compatibility corpus и свежий cf-play

## Результат

`npm run check:compat-corpus` запускает собранный реальный player `public/ai/cf-play.mjs`, требует не менее семи разных путей-целей, проверяет ожидаемый project ID и нулевой код/вердикт CLI. Команда подключена к `check:mission` и `.github/workflows/visual.yml`. Внутренний негативный прогон проверяет, что сломанная копия существующего проекта делает тот же gate красным.

### Явное решение о размере корпуса

В разрешённых исходных корнях найдено только четыре project path: три каталога в `public/campaigns` и `_tools/projects/realtime-wall`. Чтобы не придумывать и не переписывать проекты, в конфигурацию добавлены три уже существующие pack-data copies только для чтения. Итого: **7 существующих путей-целей, 4 семантических project ID** (копии narrative/adventure/fmv имеют те же ID, что и опубликованные кампании). Это не скрывается как семь независимых проектов; для этого обратимого выбора создано трёхстрочное решение [NAR-5.9](../../docs/decisions/NAR-5.9.md). Ни один файл в `packs/**` не изменён.

Конфигурация: [`_tools/compat-corpus.json`](../compat-corpus.json).

| ref | project ID | путь | runner |
|---|---|---|---|
| `narrative-public` | `ash-of-caerden` | `public/campaigns/ash-of-caerden` | `cf-play check` |
| `adventure-public` | `ash-of-caerden-adventure` | `public/campaigns/ash-of-caerden-adventure` | `cf-play check` |
| `fmv-public` | `fmv-crossing` | `public/campaigns/fmv-crossing` | `cf-play check` |
| `narrative-pack-data` | `ash-of-caerden` | `packs/narrative/data/ash-of-caerden` | `cf-play check` |
| `adventure-pack-data` | `ash-of-caerden-adventure` | `packs/adventure/data/ash-of-caerden-adventure` | `cf-play check` |
| `fmv-pack-data` | `fmv-crossing` | `packs/narrative/data/fmv-crossing` | `cf-play check` |
| `realtime-wall` | `realtime-wall-zone` | `_tools/projects/realtime-wall` | `cf-play cycles --json` |

Команды кампаний запускаются с `--json` и временным `--out` вне репозитория; в таблице ниже приведена сводка, разобранная из фактического JSON stdout. `cycles` — штатный player runner для realtime-проекта; его JSON также подтверждает существующий turn reference `ash-of-caerden`. Для миссионных примеров `project.code-mode.json` и `locales.de.json` остаётся штатная проверка `npm run check:contracts` (42 проверки), они не считаются игровыми каталогами корпуса.

## Вывод корпуса после пересборки

`npm run check:compat-corpus` — **rc=0**, 7/7 путей-целей прошли. Вывод команды на каждую цель:

| ref | command | player rc | stdout summary |
|---|---|---:|---|
| `narrative-public` | `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --json --out <temporary-output>/narrative-public` | 0 | `{"campaignId":"ash-of-caerden","verdict":"ok","problems":0,"scenes":10,"graphErrors":0,"graphWarnings":8,"seeds":5,"finals":{"death":5},"coverage":{"visited":6,"total":10}}` |
| `adventure-public` | `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure --json --out <temporary-output>/adventure-public` | 0 | `{"campaignId":"ash-of-caerden-adventure","verdict":"ok","problems":0,"scenes":10,"graphErrors":0,"graphWarnings":8,"seeds":5,"finals":{"death":5},"coverage":{"visited":6,"total":10}}` |
| `fmv-public` | `node public/ai/cf-play.mjs check public/campaigns/fmv-crossing --json --out <temporary-output>/fmv-public` | 0 | `{"campaignId":"fmv-crossing","verdict":"ok","problems":0,"scenes":1,"graphErrors":0,"graphWarnings":0,"seeds":5,"finals":{"open":5},"coverage":{"visited":1,"total":1}}` |
| `narrative-pack-data` | `node public/ai/cf-play.mjs check packs/narrative/data/ash-of-caerden --json --out <temporary-output>/narrative-pack-data` | 0 | `{"campaignId":"ash-of-caerden","verdict":"ok","problems":0,"scenes":10,"graphErrors":0,"graphWarnings":8,"seeds":5,"finals":{"death":5},"coverage":{"visited":6,"total":10}}` |
| `adventure-pack-data` | `node public/ai/cf-play.mjs check packs/adventure/data/ash-of-caerden-adventure --json --out <temporary-output>/adventure-pack-data` | 0 | `{"campaignId":"ash-of-caerden-adventure","verdict":"ok","problems":0,"scenes":10,"graphErrors":0,"graphWarnings":8,"seeds":5,"finals":{"death":5},"coverage":{"visited":6,"total":10}}` |
| `fmv-pack-data` | `node public/ai/cf-play.mjs check packs/narrative/data/fmv-crossing --json --out <temporary-output>/fmv-pack-data` | 0 | `{"campaignId":"fmv-crossing","verdict":"ok","problems":0,"scenes":1,"graphErrors":0,"graphWarnings":0,"seeds":5,"finals":{"open":5},"coverage":{"visited":1,"total":1}}` |
| `realtime-wall` | `node public/ai/cf-play.mjs cycles --json` | 0 | `{"ok":true,"configuredRuntimes":["realtime","turn"],"usedRuntimes":["realtime","turn"],"missingRuntimes":[],"projects":[{"id":"ash-of-caerden","runtime":"turn","stepCalls":1,"clock":"28800000->32400000","finalFingerprint":"3e183cbc9ce9a358","ok":true},{"id":"realtime-wall-zone","runtime":"realtime","stepCalls":11,"clock":"0->220","finalFingerprint":"c585e2c26d21ed7e","ok":true}]}` |

`cycles` выполнил и подтвердил обе runtime assertions: turn — 1 шаг, tick 8→9; realtime-wall — 11 шагов, 0→220 ms, финальный fingerprint `c585e2c26d21ed7e`; `missingRuntimes=[]`.

## Негативный запуск — тот же gate становится красным

Команда ниже временно копирует существующую campaign в системный temp, повреждает только копию (`campaign.json` становится невалидным JSON), затем запускает все семь refs. Репозиторий и оригинальный проект не меняются.

```text
npm run check:compat-corpus -- --break-and-run narrative-public
rc=1 (ожидаемый красный gate)
✗ narrative-public (ash-of-caerden) — player rc=2
path: <temporary broken copy of public/campaigns/ash-of-caerden>
stdout: cf-play: Expected property name or '}' in JSON at position 2 (line 1 column 3)
detail: player rc=2
✓ остальные шесть refs
check:compat-corpus failed; refs=7; rc=1
```

Обычный `npm run check:compat-corpus` сам выполняет этот canary в дочернем процессе, требует от сломанного gate именно `rc=1` и завершается `rc=0` только если отрицательное доказательство сработало.

## Пересборка bundle и player-команды

До пересборки (состояние `origin/main`): `public/ai/cf-play.mjs` — **22,792 строк, 1,065,736 байт**, SHA-256 `566887cfc475a664e50c2f42b9599d1b9469e0f84355e1a54fc08a97180ad7cb`. До пересборки `npm run check:guide` вернул **rc=1**: bundle устарел; текущая сборка из `scripts/playkit/cli.mts` была 1,066,934 байт, SHA-256 `191167f1ffc66d6e96c5f3a6e3598b65b291e0027250e22b03256e4e2ea68085`; первое расхождение — байт 44,255.

Выполнена штатная команда, bundle вручную не редактировался:

```text
npm run build:playkit-bundle — rc=0
public/ai/cf-play.mjs  1.0mb
```

После пересборки: **22,863 строк, 1,066,934 байта**, SHA-256 `191167f1ffc66d6e96c5f3a6e3598b65b291e0027250e22b03256e4e2ea68085` (изменение: +71 строка, +1,198 байт). `npm run check:playkit-bundle` — rc=0, bundle побайтно совпадает со сборкой из текущего исходника.

После пересборки `npm run check:guide` — **rc=0**; 6 команд памятки, reference summary 10/8/6/21, 0 ошибок/8 предупреждений, 5 исходов смерти и coverage 6/10.

Дополнительные буквальные player-проверки после пересборки:

```text
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden         — rc=0; 10 сцен, ошибок 0, 5 seeds, coverage 6/10
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure — rc=0; 10 сцен, ошибок 0, 5 seeds, coverage 6/10
node public/ai/cf-play.mjs check public/campaigns/fmv-crossing             — rc=0; 1 сцена, ошибок 0, 5 seeds open, coverage 1/1
```

## Проверки

| Команда | Результат |
|---|---|
| `npm ci` | rc=0; npm сообщил об одной умеренной advisory в dependency tree, зависимости не обновлялись |
| `npx tsc -b` | rc=0 |
| `npm run check:contracts` | rc=0; 42 проверки, включая `project.code-mode.json` и `locales.de.json` |
| `npm run check:guide` | rc=0 после пересборки |
| `npm run check:compat-corpus` | rc=0; 7/7 path targets; внутренний negative gate rc=1 подтверждён |
| `npm run check:mission` | rc=0; mission smoke 55/55; determinism/parity 10/10; обе прямые reference-команды rc=0 |
| `npm run lint` | rc=0; 0 errors; 1,506 существующих warnings по репозиторию; новый gate-файл — 0 warnings/0 errors |
| `git diff --check` | rc=0 |

`src/core/**`, `docs/contracts/**` и содержимое `packs/**` не изменялись. В `visual.yml` добавлен отдельный шаг корпуса; в `check-mission` — такой же обязательный шаг.
