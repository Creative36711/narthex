# STAB-1.33 — отчёт: совместная доставка отчёта и проверка его наличия в main

Дата проверки: **2026-11-01**.

Базовый SHA `main` и неизменённого продуктового кода: `3bd9239ead29393c2eda4abf571d7de6a6bef0b3`.

Среда: Node `v22.22.3`, npm `10.9.8`.

Отчёт и решение `docs/decisions/STAB-1.33.md` включены в тот же PR, что и `scripts/check-reports-in-main.mjs`. Решение принято Координатором: проверочный отчёт коммитится тем же PR, что и проверяемая работа.

## Диагностика 1.29

`_tools/reports/STAB-1.29.md` фиксирует диагноз дословно и содержит свидетельства из run-ов `aa91547b`, `a51439d0` и `023bd5d2`. Отсутствующие отчёты 1.26/1.27 не реконструировались.

## Guard

Guard читает только Git tree локального ref `main` и проверяет наличие переданных путей. Содержимое и качество отчётов не оцениваются. Проверка не включена в §4, `package.json` или `check:mission`.

Обязательная отрицательная проба на базовом `main`:

```text
$ node scripts/check-reports-in-main.mjs _tools/reports/STAB-1.26.md
Missing from main: _tools/reports/STAB-1.26.md
rc=1
```

Контрольный положительный вызов для уже существующего в базовом `main` отчёта:

```text
$ node scripts/check-reports-in-main.mjs _tools/reports/STAB-1.31.md
All 1 requested path(s) exist in main.
rc=0
```

Положительная проба новых отчётов выполняется после их появления в `main`.

## Дерево отчётов

До merge, на базовом `main` `3bd9239`, выполнена запрошенная команда:

```text
$ git ls-tree main -- _tools/reports
040000 tree 6f54ddcc134443cb390f27a9a8bf4576ed3c4afa	_tools/reports
```

Команда без `-r` показывает только объект каталога, поэтому отдельные имена проверяются рекурсивно. В дереве PR присутствуют оба добавляемых отчёта:

```text
$ git ls-tree -r --name-only HEAD -- _tools/reports | grep -E '^_tools/reports/STAB-1\.(29|33)\.md$'
_tools/reports/STAB-1.29.md
_tools/reports/STAB-1.33.md
```

После merge положительная проба повторно проверяет пути в `main`.

## §4 — полный прогон

Команды §4 из `docs/agents/tz-stab-1.md` выполнены в исходном порядке **2026-11-01 11:39:00–11:45:06 UTC**. Все **21/21** завершились с `rc=0`; шаг 4 выполнил все 71 скрипт ScriptCat. Добавленный guard в §4 не включался.

| № | Команда §4 | Начало UTC | Конец UTC | сек. | rc |
|---:|---|---|---|---:|---:|
| 1 | `npm ci` | 11:39:00 | 11:39:06 | 6 | 0 |
| 2 | `npm run check:audit-bundle` (до build) | 11:39:06 | 11:39:08 | 2 | 0 |
| 3 | `npx tsc -b` | 11:39:08 | 11:39:26 | 18 | 0 |
| 4 | `for t in _tools/ScriptCat/tests/*.mjs; do node "$t" || exit 1; done` (71 файлов) | 11:39:26 | 11:39:37 | 11 | 0 |
| 5 | `npm run check:contracts` | 11:39:37 | 11:39:54 | 17 | 0 |
| 6 | `npm run check:core-graph` | 11:39:54 | 11:39:54 | 0 | 0 |
| 7 | `npm run check:module-size` | 11:39:54 | 11:39:54 | 0 | 0 |
| 8 | `npm run check:brand` | 11:39:54 | 11:39:55 | 1 | 0 |
| 9 | `npm run check:version` | 11:39:55 | 11:39:55 | 0 | 0 |
| 10 | `npm run check:guide` | 11:39:55 | 11:40:02 | 7 | 0 |
| 11 | `npm run check:playkit-bundle` | 11:40:02 | 11:40:02 | 0 | 0 |
| 12 | `npm run check:campaigns` | 11:40:02 | 11:40:03 | 1 | 0 |
| 13 | `npm run check:compat-corpus` | 11:40:03 | 11:40:08 | 5 | 0 |
| 14 | `npm run check:narrative-codes` | 11:40:08 | 11:40:08 | 0 | 0 |
| 15 | `npm run smoke:core` | 11:40:08 | 11:40:09 | 1 | 0 |
| 16 | `npm run smoke:mission` | 11:40:09 | 11:41:55 | 106 | 0 |
| 17 | `npm run cf-play:negative` | 11:41:55 | 11:41:57 | 2 | 0 |
| 18 | `npm run lint` | 11:41:57 | 11:41:58 | 1 | 0 |
| 19 | `npm run build` | 11:41:58 | 11:42:17 | 19 | 0 |
| 20 | `npm run check:audit-bundle` (после build) | 11:42:17 | 11:42:19 | 2 | 0 |
| 21 | `npm run check:mission` | 11:42:19 | 11:45:06 | 167 | 0 |

## Bundle и итоговое состояние

`public/ai/campaign-audit.mjs` до и после `npm run build`:

- SHA-256 до build: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`;
- SHA-256 после build: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`;
- `cmp=0`; `npm run check:audit-bundle` до и после build — `rc=0`.

Итог: §4 сохранён без новых обязательных шагов; `check:mission` и `package.json` не менялись. После commit/merge `git status --porcelain` пуст, `dist-ai` отсутствует.
