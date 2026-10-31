# STAB-1.24 — повторный §4 и GitHub Actions на новом SHA

**Дата:** 2026-10-31
**Проверяемый SHA кода:** `22f1c80cb0358a5de81d3dd69500fb2fb4a9f182` (squash-merge STAB-1.23; на момент запуска совпал с `origin/main`).
**Часовой пояс:** все приведённые времена — UTC.

## Решение о финальном SHA

`docs/decisions/STAB-1.24.md` фиксирует допущение: final/test SHA — SHA исполняемого кода `22f1c80…`; evidence-only commit с этим отчётом и решением создаётся после завершения §4 и Actions, потому что run IDs и ссылки появляются только после запусков. Источники, опубликованный bundle и оракулы в этом доказательном коммите не меняются.

## Audit bundle до/после build

До и после `npm run build` опубликованный `public/ai/campaign-audit.mjs` имел одинаковый SHA-256: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8` (1 006 226 bytes). Проверка `check:audit-bundle` до и после штатной сборки: `rc=0`.

Два независимых билда из текущего исходника на проверяемом SHA дали по 1 006 226 bytes, SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`; `cmp` build A ↔ build B = `0`, build A ↔ published = `0`, build B ↔ published = `0`. Это совпадает с результатом STAB-1.23.

## §4 — 21 команда на `22f1c80…`

Все 21 команды завершились `rc=0`; цикл из 71 `_tools/ScriptCat/tests/*.mjs` прошёл `71/71`. Начало полного прогона: `2026-10-31T18:58:46Z`; окончание: `2026-10-31T19:04:19Z`. `git status --porcelain` после прогона был пуст; `dist-ai/` отсутствовал.

| № | Команда | Начало UTC | Конец UTC | Время, сек | rc |
|---:|---|---|---|---:|---:|
| 1 | `npm ci` | 18:58:46 | 18:58:52 | 6 | 0 |
| 2 | `npm run check:audit-bundle` (до build) | 18:58:52 | 18:58:54 | 2 | 0 |
| 3 | `npx tsc -b` | 18:58:54 | 18:59:09 | 15 | 0 |
| 4 | `_tools/ScriptCat/tests/*.mjs` (71 probes) | 18:59:09 | 18:59:20 | 11 | 0 |
| 5 | `npm run check:contracts` | 18:59:20 | 18:59:34 | 14 | 0 |
| 6 | `npm run check:core-graph` | 18:59:34 | 18:59:35 | 1 | 0 |
| 7 | `npm run check:module-size` | 18:59:35 | 18:59:35 | 0 | 0 |
| 8 | `npm run check:brand` | 18:59:35 | 18:59:35 | 0 | 0 |
| 9 | `npm run check:version` | 18:59:35 | 18:59:36 | 1 | 0 |
| 10 | `npm run check:guide` | 18:59:36 | 18:59:42 | 6 | 0 |
| 11 | `npm run check:playkit-bundle` | 18:59:42 | 18:59:43 | 1 | 0 |
| 12 | `npm run check:campaigns` | 18:59:43 | 18:59:43 | 0 | 0 |
| 13 | `npm run check:compat-corpus` | 18:59:43 | 18:59:48 | 5 | 0 |
| 14 | `npm run check:narrative-codes` | 18:59:48 | 18:59:48 | 0 | 0 |
| 15 | `npm run smoke:core` | 18:59:48 | 18:59:49 | 1 | 0 |
| 16 | `npm run smoke:mission` | 18:59:49 | 19:01:25 | 96 | 0 |
| 17 | `npm run cf-play:negative` | 19:01:25 | 19:01:28 | 3 | 0 |
| 18 | `npm run lint` | 19:01:28 | 19:01:28 | 0 | 0 |
| 19 | `npm run build` | 19:01:28 | 19:01:45 | 17 | 0 |
| 20 | `npm run check:audit-bundle` (после build) | 19:01:45 | 19:01:47 | 2 | 0 |
| 21 | `npm run check:mission` | 19:01:47 | 19:04:19 | 152 | 0 |

Хеш audit bundle до и после `npm run build` совпал: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`.

## GitHub Actions

### Visual

- Workflow run **41231548139** — `completed / success`, `head_sha=22f1c80cb0358a5de81d3dd69500fb2fb4a9f182`.
- Run: https://github.com/Creative36711/narthex/actions/runs/41231548139
- Job `screenshots`: `2026-10-31T18:53:04Z`–`2026-10-31T18:59:23Z`, `success`; browser shots, playthrough, exam, campaign-start smoke, and the strict-warning check all passed.
- Artifact `visual-report`, ID `13054310548`, 25 664 045 bytes, digest `sha256:76628b2eb10ecd1526018db66fd85dd59a86858e63628dc7b00d86a0c281531e`; URL: https://github.com/Creative36711/narthex/actions/runs/41231548139/artifacts/13054310548
- API подтвердил артефакт и SHA. Скачивание zip в sandbox не удалось из-за недоступности внешнего blob-host из среды (EOF); это не ошибка workflow и не отсутствие артефакта.

### Golden

- Workflow run **41231548143** — `completed / success`, `head_sha=22f1c80cb0358a5de81d3dd69500fb2fb4a9f182`; run создан `2026-10-31T18:53:01Z`. Job `golden-playthrough` (ID `124626628230`) шёл `18:53:05Z`–`19:54:59Z` (**1h 1m 54s**).
- Run: https://github.com/Creative36711/narthex/actions/runs/41231548143
- Этап `Run golden checks, first clue, and mandatory one-hour soak`: `18:53:31Z`–`19:54:47Z` (**61m 16s**), `success`. Это полный pinned golden + GOLD-1.15 soak entry; его строгий active-duration gate требует не менее 3600 секунд. Точные `Active gameplay` start/end и `activeDurationSeconds` записаны в linked GOLD-1.15 timeline artifact. Страница artifact API недоступна для чтения из sandbox: signed download перенаправляет на заблокированный egress host; ниже оставлена прямая ссылка, а timestamps этапа доступны в GitHub API.
- `Prove cf-play rejects a warning-only fixture`: `19:54:47Z`–`19:54:50Z`, `success`.
- Manifest pinned campaign: commit `4783665b04b9ea703cbdfc0bd10cc2b1263caf83`; archive SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; verified tree SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`, 1 291 files.
- Артефакты и ссылки:
  - `GOLD-1.6-41231548143` — ID `13055936689`, 15 705 980 bytes, digest `sha256:b9f8c39b3f6c84b45641be2cb556e974e375fa9a0b6ea88abb63a2caac805533`; https://github.com/Creative36711/narthex/actions/runs/41231548143/artifacts/13055936689 (API: https://api.github.com/repos/Creative36711/narthex/actions/artifacts/13055936689).
  - `GOLD-1.14-41231548143` — ID `13056380302`, 3 283 bytes, digest `sha256:edbb47ed1cd359737d921121dea22abff52a9a0caea60549a4dd1b2e73016e74`; https://github.com/Creative36711/narthex/actions/runs/41231548143/artifacts/13056380302 (API: https://api.github.com/repos/Creative36711/narthex/actions/artifacts/13056380302).
  - `GOLD-1.15-41231548143` — ID `13056116232`, https://github.com/Creative36711/narthex/actions/runs/41231548143/artifacts/13056116232 (API: https://api.github.com/repos/Creative36711/narthex/actions/artifacts/13056116232); 12 099 bytes, digest `sha256:cf320ac03f000e674a7cfada19a51456b4b3da79ba9207b3b27bd3d1a875828c`.

## История старых прогонов

Старые runs `41222290769` и `41222290806` имеют `head_sha=66ea935013ec222bfe19f1c5cf7babc43c483039` и не засчитываются. В этом отчёте учитываются только Visual и Golden с `head_sha=22f1c80…`.

## Scope

В репозитории добавлены только этот отчёт и `docs/decisions/STAB-1.24.md`. Проверочные пути, исходники, bundle и оракулы не менялись. `git status --porcelain` был пуст непосредственно после полного §4 на проверяемом SHA; после этого начата запись evidence-документов.
