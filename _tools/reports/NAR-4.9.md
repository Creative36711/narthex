# NAR-4.9 — итоговый вердикт: Фаза 3 закрыта

- Дата закрытия: **2026-10-27**.
- Дата повторной проверки: **2026-10-28**.
- Dispatch: `4066f0cf-5705-81f7-8bf6-e7c605f152eb`.
- Run: `db39b16f-fc91-4bf4-b5fd-4a794fb69def`.
- Свежая база `origin/main`: `e0af6cc868af502e3f1ed4472e40500b243b5fe6`.
- Ветка сессии: `arena/c2aad157-narthex`.

## Старт и применённое уточнение

Перед проверками `git fetch origin main` завершился успешно. До восстановления
snapshot worktree был чистым: `HEAD` — `ab2f484cd768cf9fb911934ed5b4be57340c6b4d`,
`origin/main` — `e0af6cc868af502e3f1ed4472e40500b243b5fe6`, merge-base отсутствовал.
Оставаясь на фиксированной ветке `arena/c2aad157-narthex`, выполнил
`git reset --hard origin/main`. После reset `HEAD`, `origin/main` и merge-base
совпали на `e0af6cc868af502e3f1ed4472e40500b243b5fe6`; worktree был чистым.

Этот прогон повторно подтверждает закрытие Фазы 3, записанное в принятом
датированном решении [NAR-4.9](../../docs/decisions/NAR-4.9.md); промежуточный вердикт
«не закрыта» из PR #95 остаётся superseded. Принятое датированное решение и
`docs/phases.md` уже содержат дату закрытия и все шесть пунктов оракула; в
этом повторном прогоне они проверены заново, а текущие метаданные и результаты
записаны в этом отчёте. Уточнённая карточка
принимает локальные источники для команд, которых нет в visual workflow.
Отсутствие команды в CI не считается невыполнением критерия.

## Итог по шести пунктам оракула

| № | Критерий | Результат и фактический источник |
|---:|---|---|
| 1 | Детерминизм по seed на двух эталонных проектах | В локальном run `db39b16f-fc91-4bf4-b5fd-4a794fb69def` `node public/ai/cf-play.mjs cycles` запущен дважды подряд: оба rc=0; строки, clocks и состояния `ash-of-caerden` (`turn`) и `realtime-wall-zone` (`realtime`) совпали строка в строку; `diff -u` rc=0. Дополнительно два последовательных `cycles --json` дали rc=0 и идентичный JSON: Ash initial/final fingerprint `ed2cd114d72ab278` / `3e183cbc9ce9a358`; realtime `9910f683b96eba27` / `c585e2c26d21ed7e`; обе пары совпали между запусками. Raw outputs — ignored `out/nar-4.9/cycles-1.log`, `cycles-2.log`, `cycles-json-1.log`, `cycles-json-2.log`; окружение и lockfile версии приведены ниже. Visual CI не запускает `cycles`; источник критерия — эти локальные прогоны, а не отсутствие CI. Сопутствующие пробы — [NAR-4.3](NAR-4.3.md), [NAR-4.4](NAR-4.4.md), [NAR-4.5](NAR-4.5.md). |
| 2 | Равенство браузера и `cf-play` | Локально в run `db39b16f-fc91-4bf4-b5fd-4a794fb69def` `npm run check:determinism` rc=0: 10/10 replay-пар, 10/10 browser↔Node fingerprints, ноль несовпадений, повторы стабильны. Visual CI содержит тот же шаг; он успешен в [run #40666511377](https://github.com/Creative36711/narthex/actions/runs/40666511377) на PR #105. Числовая матрица — [NAR-4.6](NAR-4.6.md). |
| 3 | Общий путь `cf-play`, без ветвлений по рантайму | В локальном run `db39b16f-fc91-4bf4-b5fd-4a794fb69def` read-only scan трёх файлов `scripts/playkit/{cli.mts,cycle-check.ts,realtime-project.ts}` проверил условия `if` на `runtime ===/!== turn|realtime` и `switch(runtime)`; результат **`[]`**, stdout и среда в ignored `out/nar-4.9/runtime-branch-scan.log`. `runCycleProjects()` выбирает адаптер по `adapters[project.runtime]` и использует общий цикл step/evaluator. Visual CI не содержит отдельного scan; источники — текущая локальная проверка, общий runner, принятый [ADR 0014](../../docs/contracts/adr/0014-realtime-project-fixture.md) и [NAR-4.5](NAR-4.5.md). |
| 4 | Регрессия пошагового мира не сдвинулась; браузерный экзамен `check = 0` | В run `db39b16f-fc91-4bf4-b5fd-4a794fb69def` оба локальных `cf-play check` завершились rc=0: 10 сцен / 8 локаций / 6 диалогов / 21 Ink-узел, 0 ошибок / 8 предупреждений; пять seeds, пять смертей, покрытие 6/10 — те же значения, что в baseline NAR-4.2 (сравнение в [NAR-4.3](NAR-4.3.md)). Локальный `npm run playthrough:exam -- http://127.0.0.1:4173 out/nar-4.9/playthrough`: rc=0, PASS, 2 packs, 20 шагов, findings=0; Ash → `ending_ashes`, Adventure → `ending_gate_unlocked`. Visual run #40666511377 прошёл шаги обоих `cf-play check` и экранов/экзамена. |
| 5 | Бюджет кадра: медиана и p95, машина указана | Свежий reference NAR-4.16 от **2026-10-28**, `_tools/projects/realtime-wall`, Run 1 из 3 (после 3000 warmup ticks; каждый прогон — 6000 ticks): median **0.017197999999964964 мс**, p95 **0.02731499999998732 мс**, max **0.2585380000000157 мс**; Intel(R) Xeon(R) Processor @ 2.60GHz, 2 логических CPU, Debian GNU/Linux 12 (bookworm), Linux `6.1.158+` x86_64, Node `v22.22.3`. Все три прогона и точная команда: [NAR-4.16](NAR-4.16.md); тройка NAR-4.3 больше не является текущим reference. |
| 6 | Долг D-01: `npm run lint` — 0 ошибок | Локально в run `db39b16f-fc91-4bf4-b5fd-4a794fb69def` `npm run lint` rc=0: **1505 warnings, 0 errors**; raw output и снимок среды — ignored `out/nar-4.9/lint.log`. Машина и lockfile-версии атрибутированы этому локальному прогону. В `.github/workflows/visual.yml` шага lint нет; источник критерия — локальный вывод, а не отсутствие CI. |

## Окружение локальных источников

Все локальные команды run `db39b16f-fc91-4bf4-b5fd-4a794fb69def` выполнены
после `npm ci` на свежем `origin/main` `e0af6cc868af502e3f1ed4472e40500b243b5fe6`.
Машина: **Linux 6.1.158+ x86_64**, Intel(R) Xeon(R) Processor @ 2.60 GHz,
**2 logical CPUs**. Зафиксированные lockfile/runtime версии: **Node v22.22.3**,
React **19.3.0**, React DOM **19.3.0**, Oxlint **1.86.0**, TypeScript
**6.0.3**. Эти данные относятся к локальным `cycles`, JSON fingerprints,
scan, `check:determinism`, `check:mission`, lint, обоим `cf-play check` и
browser exam. `npm ci` установил 70 пакетов (rc=0); npm сообщил об одной
moderate vulnerability. После локального browser exam временные no-save
драйверы удалены повторным `npm ci` (rc=0); `package.json` и
`package-lock.json` не изменялись. Criterion 5 отдельно атрибутирован к
локальному машинному описанию в NAR-4.3.

Сырые outputs текущего run сохранены в ignored `out/nar-4.9/`: `env.txt`,
`npm-ci.log`, `npm-ci-restore.log`, `lint.log`, `tsc.log`,
`check-contracts.log`, `check-contracts-postreport.log`, `check-determinism.log`, `check-mission.log`,
`cf-play-check-ash.log`, `cf-play-check-adventure.log`,
`runtime-branch-scan.log`, `cycles-1.log`, `cycles-2.log`, `cycles.diff`,
`cycles-json-1.log`, `cycles-json-2.log`, `cycles-json-summary.log`,
`vite-build.log`, `browser-deps.log`, `vite-preview.log`, `wait-on.log` и
`playthrough-exam.log`; PNG экзамена сохранены в `out/nar-4.9/playthrough/`.
Visual CI источники и точные успешные шаги — run #40666511377 ниже.
Для локального browser exam отсутствовавшие драйверы временно установлены
`--no-save --package-lock=false` (`@sparticuz/chromium@131`,
`playwright-core@1.49.1`); после экзамена восстановлены только lock-зависимости.

## Источник критерия 5: актуальный frame budget NAR-4.16

Текущий reference — локальный benchmark NAR-4.16 от **2026-10-28** на
`_tools/projects/realtime-wall`: Run 1 из трёх после 3000 warmup ticks,
6000 ticks в каждом прогоне; median **0.017197999999964964 ms**, p95
**0.02731499999998732 ms**, max **0.2585380000000157 ms**. Машина: Intel(R)
Xeon(R) Processor @ 2.60GHz, 2 логических CPU, Debian GNU/Linux 12
(bookworm), Linux `6.1.158+` x86_64, Node `v22.22.3`. Подробные значения всех
трёх прогонов, oracle и способ воспроизведения: [NAR-4.16](NAR-4.16.md).

Тройка NAR-4.3 — median `0.186985 ms`, p95 `0.251383 ms`, max `2.789207 ms`
для иного workload `real-engine-20ms-ticks` — **историческая, не reference**;
она не является измерением realtime-wall и не используется в текущем пункте 5.
В `visual.yml` бюджетного CI-шага нет; текущий источник — локальный benchmark
и машинная запись NAR-4.16.

## Дополнительная проверка хэшей `cf-play cycles --json`

После двух обязательных текстовых запусков выполнены ещё два последовательных
`node public/ai/cf-play.mjs cycles --json`; оба rc=0. Сырые JSON: ignored
`out/nar-4.9/cycles-json-1.log` и `cycles-json-2.log`; сравнение JSON дало
`diff=0`. Для одинаковых project seeds (`NAR-4.5-cycle-check` для Ash и
`realtime-wall-zone:NAR-4.5` для realtime) initial/final fingerprints
совпали: Ash `ed2cd114d72ab278` → `3e183cbc9ce9a358`; realtime
`9910f683b96eba27` → `c585e2c26d21ed7e`.

## Повторные выводы `cf-play cycles` — проба пункта 1

Команда: `node public/ai/cf-play.mjs cycles`.

Первый запуск: **rc=0**.

```text
cf-play cycles

✓ ash-of-caerden [turn]: 1 step calls, clock 28800000 → 32400000 ms, state {"tick":9,"scene":"scene_gates_front","location":"loc_gates"}
  ✓ the turn executor advances exactly one campaign tick: 9
✓ realtime-wall-zone [realtime]: 11 step calls, clock 0 → 220 ms, state {"position.x":6,"position.y":10,"max_x":12,"wall_contact":true,"wall_contacts":1,"zone_trigger_count":1,"triggered_zones.checkpoint":true,"world_state":"checkpoint-activated"}
  ✓ movement input changes the player position: 6
  ✓ the wall was contacted: 1
  ✓ the player never passes through the wall: 12
  ✓ the checkpoint changes state exactly once: 1
  ✓ the checkpoint state is recorded: true
  ✓ the zone's state transition is visible: "checkpoint-activated"

Coverage: 2/2 runtimes; 2/2 projects passed; 0 runtimes missing.
```

Второй запуск сразу после первого: **rc=0**.

```text
cf-play cycles

✓ ash-of-caerden [turn]: 1 step calls, clock 28800000 → 32400000 ms, state {"tick":9,"scene":"scene_gates_front","location":"loc_gates"}
  ✓ the turn executor advances exactly one campaign tick: 9
✓ realtime-wall-zone [realtime]: 11 step calls, clock 0 → 220 ms, state {"position.x":6,"position.y":10,"max_x":12,"wall_contact":true,"wall_contacts":1,"zone_trigger_count":1,"triggered_zones.checkpoint":true,"world_state":"checkpoint-activated"}
  ✓ movement input changes the player position: 6
  ✓ the wall was contacted: 1
  ✓ the player never passes through the wall: 12
  ✓ the checkpoint changes state exactly once: 1
  ✓ the checkpoint state is recorded: true
  ✓ the zone's state transition is visible: "checkpoint-activated"

Coverage: 2/2 runtimes; 2/2 projects passed; 0 runtimes missing.
```

Сырые копии сохранены в ignored-артефактах
`out/nar-4.9/cycles-1.log` и `out/nar-4.9/cycles-2.log`; сравнение
`diff -u` завершилось **rc=0**, stdout совпал полностью.

## Проверки миссии и регрессии

| Команда | Результат | Источник |
|---|---|---|
| `npm ci` и восстановление после browser exam | Оба rc=0; каждый раз установлено 70 lockfile-пакетов; `package.json` и `package-lock.json` не изменены. npm audit сообщил об одной moderate vulnerability. | NAR-4.9, локально; `out/nar-4.9/npm-ci.log`, `npm-ci-restore.log` |
| `npm run check:contracts` | rc=0; 42 контрактные проверки, пакеты, границы, решения, размеры, browser/dev guards, форматы и смоуки прошли. Повторно запущен после обновления отчёта, также rc=0. Raw stdout + environment: ignored `out/nar-4.9/check-contracts.log` и `check-contracts-postreport.log`. | NAR-4.9, локально; также visual run #40666511377 |
| `npx tsc -b` | rc=0; stdout + environment: `out/nar-4.9/tsc.log`. | NAR-4.9, локально; также visual run #40666511377 |
| `npm run check:determinism` | rc=0; все 10 replay-пар совпали, mutation probe обнаружил расхождение в обоих рантаймах, parity 10/10. Raw stdout + environment: `out/nar-4.9/check-determinism.log`. | NAR-4.9, локально; visual run #40666511377 |
| `npm run check:mission` | **rc=0**; финальная строка `check:mission passed; rc=0`; `SUMMARY 55/55 passed; rc=0`; проверены turn/realtime parity и оба cf-play references. Raw stdout + machine/lockfile versions: ignored `out/nar-4.9/check-mission.log`. Visual run #40666511377 отдельно прошёл CI-шаг `smoke:mission`; workflow не запускает wrapper `check:mission`, который подтверждён локально. | NAR-4.9, локально |
| `npm run smoke:mission` | 55/55 passed; список не сокращён. | Visual run #40666511377 и локальный `check:mission` |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; 10/8/6/21; errors=0, warnings=8; 5 seeds. | NAR-4.9, локально (`out/nar-4.9/cf-play-check-ash.log`); visual run #40666511377 |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure` | rc=0; 10/8/6/21; errors=0, warnings=8; 5 seeds. | NAR-4.9, локально (`out/nar-4.9/cf-play-check-adventure.log`); visual run #40666511377 |
| `npm run playthrough:exam -- http://127.0.0.1:4173 out/nar-4.9/playthrough` | rc=0; PASS, packs=2, steps=20, findings=0; `ending_ashes` и `ending_gate_unlocked`; raw stdout: `out/nar-4.9/playthrough-exam.log`. | NAR-4.9, локально; visual run #40666511377 |

Для browser exam выполнен `npx vite build` (rc=0, только ignored `dist`).
Так как в lock-зависимостях отсутствовал browser driver, до экзамена временно
установлены `@sparticuz/chromium@131` и `playwright-core@1.49.1` только в
ignored `node_modules` (`--no-save --package-lock=false`). Экзамен прошёл;
затем `npm ci` восстановил зависимости строго по lock-файлу. `package.json` и
`package-lock.json` не изменены.

## CI, решение и сохранение оракула

Visual CI [run #40666511377](https://github.com/Creative36711/narthex/actions/runs/40666511377)
успешно прошёл на PR #105 («NAR-4.15: record lint and two-runtime mission
evidence»), который вошёл в базу текущего прогона. Успешны шаги TypeScript,
детерминизма, контрактов/browser gate, все 55 smoke-проверок, оба `cf-play
check`, сборка и экранный/browser exam. Этот run подтверждает именно те
команды, которые присутствуют в `.github/workflows/visual.yml`. Отдельных
CI-шагов `npm run lint`, `npm run check:mission`, `cf-play cycles`, read-only
runtime scan и frame-budget измерения там нет: первые четыре подтверждены
соответствующими локальными данными выше, а frame budget ссылается только на
NAR-4.3. Отсутствие CI-шага не трактуется как отрицательный результат или
причина не закрывать критерий. После обновления отчёта `git diff --check`
завершился rc=0; `npm run check:contracts` повторно пройден (42 проверки,
`check-contracts-postreport.log`).

**Удалённых проверок 0.** Критерии, пороги, проверки, код, workflow, fixtures,
контракты и кампании не менялись. При исходном закрытии NAR-4.9 в
`docs/phases.md` был изменён только вердикт внутри раздела Фазы 3; в этом
повторном run обновлён только отчёт. Фаза 2 и раздел Фазы 4 не редактировались,
Фаза 4 не объявляется начатой. Принятое `docs/decisions/NAR-4.9.md` и
`docs/decisions/NAR-4.md` (Executor) не изменялись.

Эта редакция supersedes no-close запись из [PR #95](https://github.com/Creative36711/narthex/pull/95)
после уточнения карточки: локальные пробы, явно названные источниками оракула,
принимаются независимо от наличия одноимённого CI-шага.

## Связанные карточки, PR и отчёты

- Исходное ТЗ: [docs/agents/tz-nar-4.md](../../docs/agents/tz-nar-4.md).
- PR [#86](https://github.com/Creative36711/narthex/pull/86), [#87](https://github.com/Creative36711/narthex/pull/87), [#88](https://github.com/Creative36711/narthex/pull/88), [#89](https://github.com/Creative36711/narthex/pull/89), [#90](https://github.com/Creative36711/narthex/pull/90), [#91](https://github.com/Creative36711/narthex/pull/91), [#92](https://github.com/Creative36711/narthex/pull/92), [#93](https://github.com/Creative36711/narthex/pull/93), [#94](https://github.com/Creative36711/narthex/pull/94) — ссылки из decision record.
- Предыдущие NAR-4.9: [PR #97](https://github.com/Creative36711/narthex/pull/97) (принятый вердикт) и [PR #99](https://github.com/Creative36711/narthex/pull/99) (уточнённые evidence и frame-budget citation); текущая visual CI — [PR #105](https://github.com/Creative36711/narthex/pull/105), run #40666511377.
- Отчёты: [NAR-4.2](NAR-4.2.md), [NAR-4.3](NAR-4.3.md), [NAR-4.4](NAR-4.4.md), [NAR-4.5](NAR-4.5.md), [NAR-4.6](NAR-4.6.md), [NAR-4.7](NAR-4.7.md), [NAR-4.8](NAR-4.8.md). Отдельного отчёта NAR-4.1 в репозитории нет.
- Решение NAR-4.7: [docs/decisions/NAR-4.7.md](../../docs/decisions/NAR-4.7.md).
- Ранее слитая промежуточная запись NAR-4.9: [PR #95](https://github.com/Creative36711/narthex/pull/95); заменяется этим вердиктом.
