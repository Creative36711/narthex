# NAR-4.9 — итоговый вердикт: Фаза 3 закрыта

- Дата закрытия: **2026-10-27**.
- Dispatch: `4066f0cf-5705-81f7-8bf6-e7c605f152eb`.
- Run: `b20a92da-0010-4ec5-96bf-7aebf45f709f`.
- База: свежий `origin/main` — `dde46df25215bc007f0889118dddf3ad42377d0a`.
- Ветка сессии: `arena/b029053a-narthex`.

## Старт и применённое уточнение

Перед правками `git fetch origin main` завершился успешно; worktree был чистым.
`HEAD`, `origin/main` и merge-base совпали на `dde46df25215bc007f0889118dddf3ad42377d0a`;
ветка `arena/b029053a-narthex` не была snapshot-веткой, поэтому reset или switch
не требовались и не выполнялись.

Этот прогон повторно подтверждает закрытие Фазы 3, записанное в принятом
решении NAR-4.9; первоначальный промежуточный вердикт «не закрыта» из PR #95
остаётся superseded. Уточнённая карточка принимает локальные источники для
команд, которых нет в visual workflow. Все указанные ниже пробы выполнены;
отсутствие команды в CI не считается невыполнением критерия.

## Итог по шести пунктам оракула

| № | Критерий | Результат и фактический источник |
|---:|---|---|
| 1 | Детерминизм по seed на двух эталонных проектах | Локально `node public/ai/cf-play.mjs cycles` запущен дважды подряд: оба rc=0; строки, clocks и состояния `ash-of-caerden` (`turn`) и `realtime-wall-zone` (`realtime`) совпали строка в строку; `diff -u` rc=0. Дополнительно два последовательных `cycles --json` дали rc=0 и идентичный JSON (`diff=0`): Ash initial/final fingerprint `ed2cd114d72ab278` / `3e183cbc9ce9a358`; realtime `9910f683b96eba27` / `c585e2c26d21ed7e`; обе пары совпали между запусками. Visual CI не запускает `cycles`; фактический источник критерия — локальные прогоны в окружении, указанном ниже. Сопутствующие пробы — [NAR-4.3](NAR-4.3.md), [NAR-4.4](NAR-4.4.md), [NAR-4.5](NAR-4.5.md). |
| 2 | Равенство браузера и `cf-play` | Локально `npm run check:determinism` rc=0: 10/10 replay-пар, 10/10 browser↔Node fingerprints, ноль несовпадений, повторы стабильны. Visual CI содержит тот же шаг; он успешен в [run #40553785519](https://github.com/Creative36711/narthex/actions/runs/40553785519). Числовая матрица — [NAR-4.6](NAR-4.6.md). |
| 3 | Общий путь `cf-play`, без ветвлений по рантайму | Локальный read-only scan трёх файлов `scripts/playkit/{cli.mts,cycle-check.ts,realtime-project.ts}` проверял условия `if` на `runtime ===/!== turn|realtime` и `switch(runtime)`; результат **`[]`**, stdout и среда в ignored `out/nar-4.9/runtime-branch-scan.log`. `runCycleProjects()` выбирает адаптер по `adapters[project.runtime]` и использует общий цикл step/evaluator. Visual CI не содержит отдельного scan; источники — текущая локальная проверка, общий runner, принятый [ADR 0014](../../docs/contracts/adr/0014-realtime-project-fixture.md) и [NAR-4.5](NAR-4.5.md). |
| 4 | Регрессия пошагового мира не сдвинулась; браузерный экзамен `check = 0` | Оба локальных `cf-play check` завершились rc=0: 10 сцен / 8 локаций / 6 диалогов / 21 Ink-узел, 0 ошибок / 8 предупреждений; пять seeds, пять смертей, покрытие 6/10 — те же значения, что в baseline NAR-4.2 (сравнение в [NAR-4.3](NAR-4.3.md)). Локальный `npm run playthrough:exam -- http://127.0.0.1:4173 out/nar-4.9/playthrough`: rc=0, 2 packs, 20 шагов, findings=0; Ash → `ending_ashes`, Adventure → `ending_gate_unlocked`. Все эти команды есть в visual workflow; run #40553785519 прошёл оба `cf-play check` и browser exam. |
| 5 | Бюджет кадра: медиана и p95, машина указана | Локальный benchmark из [NAR-4.3](NAR-4.3.md), workload `real-engine-20ms-ticks`: median **0.186985 ms**, p95 **0.251383 ms**, max **2.789207 ms**. Машина из NAR-4.3: Linux x64, Intel(R) Xeon(R) @ 2.60 GHz, 2 видимых логических CPU, Node v22.22.3. В эту запись перенесена одна тройка медиана/p95/max для realtime workload; visual.yml не запускает бюджетное измерение, поэтому источник — локальный NAR-4.3. |
| 6 | Долг D-01: `npm run lint` — 0 ошибок | Локально `npm run lint` rc=0: **1505 warnings, 0 errors**; raw output и снимок среды — ignored `out/nar-4.9/lint.log`. Машина и lockfile-версии атрибутированы именно этому локальному прогону. В `.github/workflows/visual.yml` шага lint нет, поэтому источник критерия — локальный вывод, а не отсутствие CI. |

## Окружение локальных источников

Локальные команды NAR-4.9 выполнены после `npm ci` в этом прогоне. Машина:
**Linux 6.1.158+ x86_64**, Intel(R) Xeon(R) Processor @ 2.60 GHz,
**2 logical CPUs**. Версии из `package-lock.json`: **Node v22.22.3**,
React **19.3.0**, React DOM **19.3.0**, Oxlint **1.86.0**, TypeScript
**6.0.3**. Эта среда относится к текущим локальным прогонам `cycles`, scan,
`check:determinism`, `check:mission`, lint, regression и browser exam.
Criterion 5 отдельно атрибутирован к локальному машинному описанию в NAR-4.3.
Raw stdout snapshots текущего прогона сохранены в ignored `out/nar-4.9/`, в
том числе `npm-ci.log`, `check-contracts.log`, `tsc.log`,
`check-determinism.log`, `check-mission.log`, `lint.log`,
`playthrough-exam.log`, оба `cf-play-check-*.log`,
`runtime-branch-scan.log`, `cycles-1.log` и `cycles-2.log`.
CI-пункты дополнительно атрибутированы run #40553785519 выше.
Для локального browser exam отсутствовавшие драйверы временно установлены
`--no-save --package-lock=false` (`@sparticuz/chromium@131`,
`playwright-core@1.49.1`); затем `npm ci` восстановил lock-зависимости.

## Источник критерия 5: frame budget из NAR-4.3

Для этого пункта использована одна сохранённая realtime-workload тройка из
[отчёта NAR-4.3](NAR-4.3.md): `real-engine-20ms-ticks`, 3000 × 20 ms;
median **0.186985 ms**, p95 **0.251383 ms**, max **2.789207 ms**. Машина,
зафиксированная в NAR-4.3: Linux x64, Intel(R) Xeon(R) Processor @ 2.60 GHz,
2 видимых логических CPU, Node v22.22.3. В NAR-4.9 перенесена именно эта одна
тройка; другая workload-строка из NAR-4.3 сюда не дублируется, и свежий замер
не подменяет зафиксированный источник. В `visual.yml` бюджетного CI-шага нет;
источник критерия — локальный benchmark и машинная запись NAR-4.3.

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
| `npm ci` | rc=0; установлено 70 пакетов из lock-файла; tracked dependency-файлы не изменены. npm audit сообщил об одной moderate vulnerability. | NAR-4.9, локально; `out/nar-4.9/npm-ci.log` и `npm-ci-restore.log` |
| `npm run check:contracts` | rc=0; 42 контрактные проверки, пакеты, границы, решения, размеры, browser/dev guards, форматы и смоуки прошли. Raw stdout + environment: ignored `out/nar-4.9/check-contracts.log`. | NAR-4.9, локально; также visual run #40553785519 |
| `npx tsc -b` | rc=0; stdout + environment: `out/nar-4.9/tsc.log`. | NAR-4.9, локально; также visual run #40553785519 |
| `npm run check:determinism` | rc=0; все 10 replay-пар совпали, mutation probe обнаружил расхождение в обоих рантаймах, parity 10/10. Raw stdout + environment: `out/nar-4.9/check-determinism.log`. | NAR-4.9, локально; visual run #40553785519 |
| `npm run check:mission` | **rc=0**; финальная строка `check:mission passed; rc=0`; `SUMMARY 55/55 passed; rc=0`; проверены turn/realtime parity и оба cf-play references. Raw stdout + machine/lockfile versions: ignored `out/nar-4.9/check-mission.log`. `visual.yml` запускает `smoke:mission`, но не wrapper `check:mission`; wrapper подтверждён локально. | NAR-4.9, локально |
| `npm run smoke:mission` | 55/55 passed; список не сокращён. | Visual run #40553785519 и локальный `check:mission` |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; 10/8/6/21; errors=0, warnings=8; 5 seeds. | NAR-4.9, локально (`out/nar-4.9/cf-play-check-ash.log`); visual run #40553785519 |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure` | rc=0; 10/8/6/21; errors=0, warnings=8; 5 seeds. | NAR-4.9, локально (`out/nar-4.9/cf-play-check-adventure.log`); visual run #40553785519 |
| `npm run playthrough:exam -- http://127.0.0.1:4173 out/nar-4.9/playthrough` | rc=0; PASS, packs=2, steps=20, findings=0; `ending_ashes` и `ending_gate_unlocked`; raw stdout: `out/nar-4.9/playthrough-exam.log`. | NAR-4.9, локально; visual run #40553785519 |

Для browser exam выполнен `npx vite build` (rc=0, только ignored `dist`).
Так как в lock-зависимостях отсутствовал browser driver, до экзамена временно
установлены `@sparticuz/chromium@131` и `playwright-core@1.49.1` только в
ignored `node_modules` (`--no-save --package-lock=false`). Экзамен прошёл;
затем `npm ci` восстановил зависимости строго по lock-файлу. `package.json` и
`package-lock.json` не изменены.

## CI, решение и сохранение оракула

Visual CI [run #40553785519](https://github.com/Creative36711/narthex/actions/runs/40553785519)
прошёл на PR #97 до merge. GitHub показывает success для шагов `npx tsc -b`,
`npm run check:determinism`, `npm run check:contracts`, `npm run smoke:mission`,
обоих `cf-play check` и браузерного экзамена. Для команд, которых нет в visual
workflow, в этом отчёте приведены именно локальные результаты, машина и версии;
отсутствие CI-шага не считается отрицательным результатом.

**Удалённых проверок 0.** В NAR-4.9 критерии, пороги, проверки, код, workflow,
fixtures, контракты и кампании не менялись. В `docs/phases.md` изменён только
вердикт внутри раздела фазы 3; фаза 2 и раздел фазы 4 не редактировались,
Фаза 4 не объявляется начатой. `docs/decisions/NAR-4.md` (Executor) не изменён.

Эта редакция supersedes no-close запись из [PR #95](https://github.com/Creative36711/narthex/pull/95)
после уточнения карточки: локальные пробы, явно названные источниками оракула,
принимаются независимо от наличия одноимённого CI-шага.

## Связанные карточки, PR и отчёты

- Исходное ТЗ: [docs/agents/tz-nar-4.md](../../docs/agents/tz-nar-4.md).
- PR [#86](https://github.com/Creative36711/narthex/pull/86), [#87](https://github.com/Creative36711/narthex/pull/87), [#88](https://github.com/Creative36711/narthex/pull/88), [#89](https://github.com/Creative36711/narthex/pull/89), [#90](https://github.com/Creative36711/narthex/pull/90), [#91](https://github.com/Creative36711/narthex/pull/91), [#92](https://github.com/Creative36711/narthex/pull/92), [#93](https://github.com/Creative36711/narthex/pull/93), [#94](https://github.com/Creative36711/narthex/pull/94) — ссылки из decision record.
- Отчёты: [NAR-4.2](NAR-4.2.md), [NAR-4.3](NAR-4.3.md), [NAR-4.4](NAR-4.4.md), [NAR-4.5](NAR-4.5.md), [NAR-4.6](NAR-4.6.md), [NAR-4.7](NAR-4.7.md), [NAR-4.8](NAR-4.8.md). Отдельного отчёта NAR-4.1 в репозитории нет.
- Решение NAR-4.7: [docs/decisions/NAR-4.7.md](../../docs/decisions/NAR-4.7.md).
- Ранее слитая промежуточная запись NAR-4.9: [PR #95](https://github.com/Creative36711/narthex/pull/95); заменяется этим вердиктом.
