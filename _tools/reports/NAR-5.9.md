# NAR-5.9 · семь уникальных compatibility projects

## Результат

Корпус содержит **ровно 7 разных `projectId`**. Для игровых кампаний и realtime-проекта используется реальный собранный player `public/ai/cf-play.mjs`; для двух project examples используется существующий контрактный валидатор `scripts/contracts-check.mts`. Повторные ID запрещены проверкой конфигурации. Три `*-pack-data` копии удалены и из списка, и из `requiredReferences`.

| проект | путь | id | команда | rc |
|---|---|---|---|---:|
| ash-of-caerden | `public/campaigns/ash-of-caerden` | `ash-of-caerden` | `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --json --out <temporary-output>/ash-of-caerden` | 0 |
| ash-of-caerden-adventure | `public/campaigns/ash-of-caerden-adventure` | `ash-of-caerden-adventure` | `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure --json --out <temporary-output>/ash-of-caerden-adventure` | 0 |
| fmv-crossing | `public/campaigns/fmv-crossing` | `fmv-crossing` | `node public/ai/cf-play.mjs check public/campaigns/fmv-crossing --json --out <temporary-output>/fmv-crossing` | 0 |
| realtime-wall-zone | `_tools/projects/realtime-wall` | `realtime-wall-zone` | `node public/ai/cf-play.mjs cycles --json` | 0 |
| river-of-ash | `docs/contracts/examples/project.narrative.json` + `docs/contracts/examples/locales.de.json` | `river-of-ash` | `node node_modules/tsx/dist/cli.mjs scripts/contracts-check.mts` | 0 |
| ash-arena | `docs/contracts/examples/project.code-mode.json` | `ash-arena` | `node node_modules/tsx/dist/cli.mjs scripts/contracts-check.mts` | 0 |
| stone-tablet-siege | `public/campaigns/stone-tablet-siege` | `stone-tablet-siege` | `node public/ai/cf-play.mjs check public/campaigns/stone-tablet-siege --json --out <temporary-output>/stone-tablet-siege` | 0 |

Оба contract-example refs проверяются тем же существующим production checker, который используется `npm run check:contracts`; гейт дополнительно убеждается, что его вывод содержит соответствующие project/locale sections, а ID и связанные файлы совпадают с конфигурацией.

## Вывод команд по проектам

Фактические stdout summaries после выполнения `npm run check:compat-corpus`:

```text
ash-of-caerden: {"campaignId":"ash-of-caerden","verdict":"ok","problems":0,"scenes":10,"graphErrors":0,"graphWarnings":8,"seeds":5,"finals":{"death":5},"coverage":{"visited":6,"total":10}}
ash-of-caerden-adventure: {"campaignId":"ash-of-caerden-adventure","verdict":"ok","problems":0,"scenes":10,"graphErrors":0,"graphWarnings":8,"seeds":5,"finals":{"death":5},"coverage":{"visited":6,"total":10}}
fmv-crossing: {"campaignId":"fmv-crossing","verdict":"ok","problems":0,"scenes":1,"graphErrors":0,"graphWarnings":0,"seeds":5,"finals":{"open":5},"coverage":{"visited":1,"total":1}}
realtime-wall-zone: {"ok":true,"missingRuntimes":[],"project":{"id":"realtime-wall-zone","runtime":"realtime","stepCalls":11,"clock":"0->220","finalFingerprint":"c585e2c26d21ed7e","ok":true}}
river-of-ash: пример проекта narrative / ✓ проходит схему / ✓ проходит семантику; пример локали / ✓ схема локали = 1 / ✓ язык файла совпадает с именем; контракты согласованы: 42 проверок
ash-arena: пример проекта с кодом в швах / ✓ проходит схему / ✓ проходит семантику; контракты согласованы: 42 проверок
stone-tablet-siege: {"campaignId":"stone-tablet-siege","verdict":"ok","problems":0,"scenes":2,"graphErrors":0,"graphWarnings":0,"seeds":5,"finals":{"open":5},"coverage":{"visited":1,"total":2}}
check:compat-corpus passed; unique-projects=7; minimum=7; rc=0
```

`realtime-wall-zone` прошёл штатный `cycles` runner: 11 шагов, clock 0→220 ms, финальный fingerprint `c585e2c26d21ed7e`, runtime `realtime`, assertions зелёные.

## Негативный прогон

Сломана только временная копия существующей campaign; рабочие fixtures и проекты не изменялись.

```text
npm run check:compat-corpus -- --break-and-run ash-of-caerden
команда gate: rc=1 (ожидаемо)
project=ash-of-caerden; player rc=2
stdout: cf-play: Expected property name or '}' in JSON at position 2 (line 1 column 3)
check:compat-corpus failed; unique-projects=7; minimum=7; rc=1
```

Обычный `npm run check:compat-corpus` тоже выполняет этот negative canary во временном дочернем запуске и возвращает 0 только после подтверждения, что сломанный project даёт красный gate. Остальные шесть refs в negative run прошли.

## Bundle `cf-play`

`src/core/**` и `scripts/playkit/**` в этой карточке не менялись, поэтому bundle не пересобирался. Размер и SHA-256 до и после проверок одинаковы:

| замер | строк | байт | SHA-256 |
|---|---:|---:|---|
| до | 22,863 | 1,066,985 | `fa208b54c69f2597761630f6d3afa541dfe508c209c539795e6c9eed9678bade` |
| после | 22,863 | 1,066,985 | `fa208b54c69f2597761630f6d3afa541dfe508c209c539795e6c9eed9678bade` |

`npm run check:playkit-bundle` и `npm run check:audit-bundle` — оба rc=0; бандлы свежие.

## Проверки

| Команда | Результат |
|---|---|
| `npm ci` | rc=0 |
| `npx tsc -b` | rc=0 |
| `npm run check:contracts` | rc=0; 42 контрактные проверки, включая code-mode и locales.de |
| `npm run check:compat-corpus` | rc=0; 7/7 уникальных project IDs; внутренний negative canary доказал rc=1 для сломанного проекта |
| `npm run check:compat-corpus -- --break-and-run ash-of-caerden` | rc=1, ожидаемый красный gate |
| `npm run check:guide` | rc=0 |
| `npm run check:playkit-bundle` | rc=0 |
| `npm run check:audit-bundle` | rc=0 |
| `npm run check:mission` | rc=0; включает корпус; 55/55 mission smokes, determinism/browser parity 10/10, прямые reference checks rc=0 |
| `npm run lint` | rc=0; 0 errors; 1,509 warnings в репозитории; новый `check-compat-corpus.mts` — 0 warnings/0 errors |
| `git diff --check` | rc=0 |

В этой сдаче не изменялись `src/core/**`, `docs/contracts/**`, `packs/**`, `public/campaigns/**` или `public/ai/**`. Корпус и отчёт следуют решению Мастера от 2026-10-28, вариант A: только указанные реальные references, без pack copies и повторного подсчёта проекта под другой командой.

## GitHub CI

Первый PR-run `40762131033` был отменён по лимиту времени workflow (20 минут) на шаге «Детерминизм циклов»: `TypeScript` завершился успешно, последующие шаги, включая corpus, были пропущены. Это не считается зелёным CI; локальный `npm run check:mission` завершился rc=0. Результат повторного PR-run будет зафиксирован после его завершения.
