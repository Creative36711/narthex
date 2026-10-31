# STAB-1.23 — воспроизводимость audit bundle и чистый checkout

**Дата:** 2026-10-31

**Исходная ревизия:** `66ea935013ec222bfe19f1c5cf7babc43c483039` (`HEAD` и `origin/main` совпадали; `git merge-base HEAD origin/main` дал тот же SHA).

**Статус:** реализовано и проверено; заключительный clean-checkout прогон §4 зафиксирован в таблице ниже.

## Итог

`check:audit-bundle` теперь строит артефакт дважды из текущего `scripts/campaign-audit.mts`, выводит пути и SHA-256 обоих билдов и опубликованного файла, запускает настоящий `cmp -s` для билдов и опубликованного bundle и требует код `0`. После этого сравниваются JSON-результаты исходника, временного bundle и опубликованного bundle. Сравнение размера не используется как доказательство равенства.

`public/ai/campaign-audit.mjs` пересобран штатной командой `npm run build:ai-bundle`; другие файлы `public/ai/**` не менялись. Каждый тест чемодана собирает его в системную временную директорию и удаляет её; `dist-ai/` не создаётся в корне checkout.

## Почему прежний опубликованный bundle был устаревшим

Исходный опубликованный файл имел **1 002 333 байта**, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`. Аудиторный исходник и его транзитивные зависимости в текущем checkout уже отличались от исторического снимка, закреплённого прежним checker'ом (commit `0a5abca49ff91daf4b642fb76272dec56a6a778e`). В частности, текущая граф-зависимость включает актуальное разбиение редакторского store на модули; опубликованный файл не был обновлён после этого изменения. Старый checker проверял исторический pin вместо обязательного равенства с текущей сборкой и потому возвращал `rc=0` при реальном расхождении.

Подтверждение: старый bundle и текущая сборка дают разные SHA-256 и `cmp=1`. В негативной пробе прежний опубликованный файл временно подставлялся обратно: новый checker завершился `rc=1`, вывел старый опубликованный hash, текущий hash и `cmp=1`. После восстановления пересобранного файла checker снова завершился `rc=0`.

## Повторяемость и опубликованный артефакт

Три итоговых файла: по два билда в отдельных свежих временных каталогах и опубликованный файл. Все имеют размер **1 006 226 байт** и SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`.

| Сравнение | Результат |
|---|---:|
| Независимый build A ↔ build B (`cmp -s`) | `0` |
| Build A ↔ `public/ai/campaign-audit.mjs` (`cmp -s`) | `0` |
| Build B ↔ `public/ai/campaign-audit.mjs` (`cmp -s`) | `0` |
| Source / временный build / published bundle: audit JSON на `stone-tablet-siege` | одинаковый результат, `rc=0` |

Предыдущий bundle `b7f271…` и итоговый `029880…` имеют `cmp=1`, как и должно быть для устаревшего артефакта.

## Сохранение brand-check strictness

Пересобранный bundle включает прежние legacy-строки из неизменённого кода зависимостей, поэтому `check:brand` обнаружил в нём пять строк, ранее скрытых точным hash pin старого bundle. Pin обновлён только для одного разрешённого generated path `public/ai/campaign-audit.mjs` — на SHA-256 `029880…`; регулярные выражения и исключения сканера не менялись. `smoke:protected-check-policy` дополнен проверкой: точная копия по этому пути принимается, изменение байтов или тот же файл по новому пути снова обнаруживает legacy-строки. После обновления `check:brand` и smoke проходят.

## Reference `cf-play check` и распакованный kit

- `npm run check:guide` проверил все шесть задокументированных команд на исходнике, bundle и после реальной сборки/распаковки kit. Референсный Ash `example` вернул ожидаемый `rc=1` с ровно тремя warnings, нулём ошибок и метриками `10/8/6/21`, пятью смертями и покрытием `6/10`; команды `explain` сохранили `rc=0`.
- `npm run check:strict-warning` проверил собственно `cf-play check` для обеих защищённых Ash-кампаний в source, bundle и распакованном kit. Все шесть строгих проверок дали ожидаемый `rc=1`, точные предупреждения и прежние метрики; narrative/adventure без предупреждений дали `rc=0` во всех трёх вариантах. Реальный adventure walk/take route также завершился `rc=0`.
- `npm run cf-play:negative` сохранил отрицательную проверку: warning-only fixture получает ожидаемый `rc=1` в source, bundle и распакованном kit.
- `check:guide`, `check:strict-warning` и `cf-play:negative` завершились без появления `dist-ai/` в корне.

## Полный §4

Первый прогон дошёл до `check:brand` и остановился только потому, что точный baseline ещё указывал на старый bundle; после точечного обновления pin и усиления policy smoke полный §4 повторён, все команды завершились с `rc=0`, все 71 ScriptCat-проб прошли.

| № | Команда / этап | Результат |
|---:|---|---:|
| 1 | `npm ci` | `rc=0` |
| 2 | `npm run check:audit-bundle` (до сборки) | `rc=0` |
| 3 | `npx tsc -b` | `rc=0` |
| 4 | Все `_tools/ScriptCat/tests/*.mjs` | `71/71` |
| 5 | `npm run check:contracts` | `rc=0` |
| 6 | `npm run check:core-graph` | `rc=0` |
| 7 | `npm run check:module-size` | `rc=0` |
| 8 | `npm run check:brand` | `rc=0` |
| 9 | `npm run check:version` | `rc=0` |
| 10 | `npm run check:guide` | `rc=0` |
| 11 | `npm run check:playkit-bundle` | `rc=0` |
| 12 | `npm run check:campaigns` | `rc=0` |
| 13 | `npm run check:compat-corpus` | `rc=0` |
| 14 | `npm run check:narrative-codes` | `rc=0` |
| 15 | `npm run smoke:core` | `rc=0` |
| 16 | `npm run smoke:mission` | `rc=0` |
| 17 | `npm run cf-play:negative` | `rc=0` |
| 18 | `npm run lint` | `rc=0` |
| 19 | `npm run build` | `rc=0` |
| 20 | `npm run check:audit-bundle` (после сборки) | `rc=0` |
| 21 | `npm run check:mission` | `rc=0` |

После повторного §4 на закоммиченном дереве проверено: `git status --porcelain` пуст, `dist-ai/` отсутствует (не tracked и не untracked). Отдельный `dist/`, если создан `npm run build`, удалён перед сдачей; он не коммитится.

## Scope / решения

Изменены только `package.json`, `_tools/reports/STAB-1.23.md`, `docs/decisions/STAB-1.23.md`, разрешённый generated `public/ai/campaign-audit.mjs` и инструменты под `scripts/**`. Эталонные кампании, packs, golden-пути и `docs/contracts/**` не менялись. Решение о новом контракте checker/bundle записано в `docs/decisions/STAB-1.23.md` со статусом и датой.
