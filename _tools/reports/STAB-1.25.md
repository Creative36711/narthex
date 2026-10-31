# STAB-1.25 — честный аудит known-absence и console-error

- **Дата:** 2026-10-31
- **Dispatch / run:** `40a6f0cf-5705-816d-87f5-ec69240076a6` / `9f39eae3-24f1-4cfb-ab61-14d260eae87b`
- **Baseline SHA:** `34e7326e84633f4d44b10dd6e05f9dba589cf236`
- **Проверенный код SHA:** `2e9865520653e2b383576f7991f653d94e8a3687`
- **Реестр допустимых наблюдений:** [`_tools/visual/allowed-observations.json`](../visual/allowed-observations.json)
- **Решение:** [`docs/decisions/STAB-1.25.md`](../../docs/decisions/STAB-1.25.md)

## Что было и что проверено заново

Локального отчёта Audit 1.22 в checkout нет, поэтому его SHA и run нельзя подтвердить. Числа не перенесены из старого NAR-3.7: до изменений строгий exam был повторно запущен на чистом baseline `34e7326e84633f4d44b10dd6e05f9dba589cf236` командой `npm run playthrough:exam -- http://localhost:4173 /tmp/stab125-baseline` (Chromium `131.0.6778.0`, Vite preview, `rc=0`). Свежий запуск воспроизвёл 54 известных отсутствия (27 + 27) и 18 `console.error` (9 + 9), при 28 шагах, тех же финалах и работающих save assertions.

До STAB-1.25 сами 54 пути уже находились в D-076 `known_absent_images`, но только как строки без по-путевых `reason` и `date`. 18 ошибок консоли записывались сырыми строками без классификации. Strict exam возвращал `rc=0`, не проверяя, объяснено ли каждое сообщение. Ни число наблюдений, ни текущий зелёный результат не доказывали полноту учёта.

| Тип наблюдения | Baseline: найдено | Baseline: аудитная запись с путём, источником, причиной и датой | После: найдено | После: разрешено реестром | После: необъяснено / дрейф |
|---|---:|---:|---:|---:|---:|
| known-absence | 54 (27 + 27) | 0; были только D-076 пути | 54 | 54 / 54 | 0 / 0 |
| console-error | 18 (9 + 9) | 0; были только строки | 18 | 18 / 18 | 0 / 0 |
| **Всего** | **72** | **0** | **72** | **72 / 72** | **0 / 0** |

Наблюдения не скрыты и не удалены: после изменения в журнале по-прежнему 54 `known-absence` и 18 `console-error`; к каждой записи прилагаются точный путь/шаблон, источник, причина и дата `2026-10-31`.

## Реестр и строгая классификация

В [`allowed-observations.json`](../visual/allowed-observations.json) находятся:

- **54 точные записи** `campaignId + path`, по одной на каждый путь каждого D-076 маркера. Источник каждой записи — соответствующий `public/campaigns/<id>/dev-fixture.json#known_absent_images`; причина опирается на предназначение внутренней непубликуемой фикстуры и D-076. Для preview зарегистрирован фактический единственный ответ `200 text/html`, а не изображение.
- **7 точных консольных сигнатур**, ожидающих ровно **18 появлений**. Ожидаемое число ограничено по кампании, пути и шаблону; новые пути/шаблоны, лишние и недостающие появления дают finding. Каждое реальное сообщение сохраняется в JSON- и Markdown-отчёте с классификацией, источником, причиной, датой и номером появления.

| Кампания | Шаблон и путь | Количество | Источник |
|---|---|---:|---|
| `ash-of-caerden` | `[сцена] фон не загрузился: {url}` — `assets/img/scenes/gates_front_day.jpg` | 2 | `src/player/SceneScreen.tsx#LiveImg.onError` |
| `ash-of-caerden` | `Failed to load resource: portrait fallback {url}` — `assets/img/npc/aldric_neutral.jpg` | 4 | `src/player/GameView.tsx#recoverBrokenPortrait` |
| `ash-of-caerden` | `Failed to load resource: map image fallback {url}` — `assets/img/maps/caerden_valley.jpg` | 1 | `src/player/MapScreen.tsx#noteImageFailure` |
| `ash-of-caerden` | `Failed to load resource: map image fallback {url}` — `assets/img/scenes/forest_edge.jpg` | 1 | `src/player/MapScreen.tsx#noteImageFailure` |
| `ash-of-caerden` | `[сцена] фон не загрузился: {url}` — `assets/img/scenes/forest_edge.jpg` | 1 | `src/player/SceneScreen.tsx#LiveImg.onError` |
| `ash-of-caerden-adventure` | `[сцена] фон не загрузился: {url}` — `assets/img/scenes/gates_front_day.jpg` | 3 | `src/player/SceneScreen.tsx#LiveImg.onError` |
| `ash-of-caerden-adventure` | `Failed to load resource: portrait fallback {url}` — `assets/img/npc/aldric_neutral.jpg` | 6 | `src/player/GameView.tsx#recoverBrokenPortrait` |
| **Итого** |  | **18** |  |

Для сцены D-076 намеренно сохраняет ошибку в консоли, а `LiveImg` переключает фон на предусмотренный `.scene-bg-fallback`. Портретный и картографический обработчики логируют точный URL и включают свои placeholder/fallback-представления. Визуальные оракулы по-прежнему проверяют ошибки экрана, битые/пустые изображения и финалы.

В строгом `--exam` классификация не использует общий фильтр по `/Failed to load resource|фон не загрузился/`: она требует точного совпадения `campaignId + path + template + expectedOccurrences`. По каждому D-076 пути также проверяются регистрация и точный ожидаемый HTTP-ответ. Это дополнение к D-076, а не расширение разрешённого списка.

## Финальный browser exam

Проверенный код SHA `2e9865520653e2b383576f7991f653d94e8a3687`, команда `npm run playthrough:exam -- http://localhost:4173 /tmp/stab125-final` завершилась **`rc=0`**.

| Пак | Шаги | Финал | known-absence | console-error | pageerror / экраны ошибки | Битые / пустые `<img>` | Необъяснено | Результат |
|---|---:|---|---:|---:|---:|---:|---:|---|
| `ash-of-caerden` | 12 | `ending_ashes` | 27 / 27 | 9 / 9 | 0 / 0 | 0 / 0 | 0 | PASS |
| `ash-of-caerden-adventure` | 16 | `ending_gate_unlocked` | 27 / 27 | 9 / 9 | 0 / 0 | 0 / 0 | 0 | PASS |
| **Всего** | **28** | оба маршрута завершены | **54 / 54** | **18 / 18** | **0 / 0** | **0 / 0** | **0** | **PASS** |

Сводка самого exam: `registeredAbsences=54/54`; `registeredConsoleErrors=18/18`; `unexplained=0`; `registry-drift=0`; `findings=0`.

### Save assertions (сохранены без изменений)

- `ash-of-caerden`: `narthex:save:ash-of-caerden@1`, **2479 Б**, `tick 8`, `scene_gates_front`, `hp 3/3`; после reload — 2479 Б побайтно; контрольный слот — 2479 Б; расхождений **0**.
- `ash-of-caerden-adventure`: `narthex:save:ash-of-caerden-adventure@1`, **2515 Б**, `tick 8`, `scene_gates_front`, `hp 10/10`; после reload — 2515 Б побайтно; контрольный слот — 2515 Б; расхождений **0**.

Шаги до/после финала и reload/restore остались в обоих маршрутах. §4 oracle не ослаблялся: любой отсутствующий незаявленный ресурс, устаревшая декларация, новый console-шаблон или дрейф количества остаются красными.

## Проверки

| Команда / проба | Результат |
|---|---|
| `npm run build` | `rc=0` |
| `npm run check:contracts` | `rc=0`; в том числе `check:decisions`, `check:dev-campaigns`, `smoke:absence-policy`; 0 провалов, 0 предупреждений media-check |
| `npm run playthrough:exam -- http://localhost:4173 /tmp/stab125-final` | `rc=0`; Chromium `131.0.6778.0`; 28 шагов; два финала; 0 находок и необъяснённых записей |
| `npm run playthrough -- http://localhost:4173 /tmp/stab125-legacy` | `rc=0`; 20 шагов, 0 находок |
| Mutation probes классификатора | `PASS`: изменённый статус, новый путь и лишнее console-появление не принимаются |
| `git diff --check`, `node --check` для обоих visual-модулей | `rc=0` |

Дополнительная проба `--fixture-root` на нетронутой временной копии не является положительным acceptance запуском: fixture-route для объявленных изображений возвращал SPA fallback, но также записал 9 дополнительных browser-generated 404 сообщений без URL в тексте от опциональных ресурсов. Они остались необъяснёнными и привели к `rc=1`; глобальные исключения для них не добавлялись. Это ограничение и обратимый выбор зафиксированы в [решении STAB-1.25](../../docs/decisions/STAB-1.25.md). Положительное acceptance evidence — обычный preview exam выше.

## Область изменений

Изменены только `scripts/visual/**`, этот отчёт, `_tools/visual/allowed-observations.json` и `docs/decisions/STAB-1.25.md`. `public/campaigns/**`, `packs/**`, `.golden/**`, `scripts/golden/**`, `golden.yml`, `docs/contracts/**`, рантайм и ассеты не затронуты.
