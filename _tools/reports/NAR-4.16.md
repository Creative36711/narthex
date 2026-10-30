# NAR-4.16 — «Возврат-7»: свежий realtime-wall frame benchmark

- Дата замера: **2026-10-28**.
- Dispatch: `4076f0cf-5705-81b0-abaa-d540a937b685`.
- Run: `32e5a768-6d61-48dd-9ca6-70f681409fdb`.
- База: свежий `origin/main` = `9575bfa9c2f77f79117ccae03832ba4984f966e1`; `HEAD` и merge-base совпали.
- Ветка сессии: закреплённая `arena/782f8461-narthex`.
- Фикстура: [`_tools/projects/realtime-wall`](../projects/realtime-wall/); файлы проекта не изменялись.

## Результат

После **3000 warmup ticks** выполнены три измеренных прогона по **6000 ticks** каждый. Один sample — время `RealtimeExecutor.step(20)` на одном realtime tick, измеренное через `performance.now()`. Все значения — миллисекунды; сохранена точность чисел, которую вернул Node.

| Run | Samples | Median, ms | p95, ms | Max, ms | Инварианты после 6000 ticks |
|---:|---:|---:|---:|---:|---|
| 1 | 6000 | `0.017197999999964964` | `0.02731499999998732` | `0.2585380000000157` | `max_x=12`; `wall_contacts=817`; `zone_trigger_count=1`; `checkpoint-activated` |
| 2 | 6000 | `0.015811999999982618` | `0.0205850000000396` | `0.3120039999999449` | `max_x=12`; `wall_contacts=817`; `zone_trigger_count=1`; `checkpoint-activated` |
| 3 | 6000 | `0.015333500000025424` | `0.02000199999997676` | `0.21303999999997814` | `max_x=12`; `wall_contacts=817`; `zone_trigger_count=1`; `checkpoint-activated` |

**Единственный current-reference triple:** Run 1, заранее выбранный до запуска как reference run: median **`0.017197999999964964 ms`**, p95 **`0.02731499999998732 ms`**, max **`0.2585380000000157 ms`**. Это ровно одна измеренная тройка, без усреднения прогонов, сглаживания или выбора лучшего результата. Runs 2 и 3 оставлены в таблице, а не исключены из отчёта.

Median рассчитан как среднее двух центральных значений после сортировки 6000 samples; p95 — nearest-rank (5700-е значение); max — максимальный sample. Таймер и сортировка/расчёт статистик находятся вне измеряемого `step(20)`.

## Окружение

Замер проведён **2026-10-28** на **Intel(R) Xeon(R) Processor @ 2.60GHz**, **2 логических CPU**, **Debian GNU/Linux 12 (bookworm)**, Linux `6.1.158+` x86_64, Node **`v22.22.3`**. Машинная строка из benchmark: `{"cpu":"Intel(R) Xeon(R) Processor @ 2.60GHz","logicalCpus":2,"platform":"linux 6.1.158+","node":"v22.22.3"}`.

Перед прогонами выполнен `npm ci` (70 пакетов, rc=0; npm сообщил об одной moderate vulnerability). `package.json` и `package-lock.json` не изменялись.

## Oracle и воспроизводимость

Проверка дерева `origin/main` `9575bfa9c2f77f79117ccae03832ba4984f966e1` не обнаружила `scripts/bench-frame.*` или соответствующего npm-script в `package.json`. Поэтому точного штатного bench-frame entry point в этой базе нет. Чтобы не добавлять/менять код, скрипт, пороги, npm-script или fixture, использован одноразовый inline runner через существующие `loadCycleProject()` и `createRealtimeProjectSetup()`; проект, его manifest/world/route читаются на месте.

Runner сначала воспроизводит без изменений все 11 шагов `route.json`. После этого для достижения зафиксированного оракулом `wall_contacts=817` в 6000 тиках он выполняет четыре `move +1` тика, затем 815 циклов `[move -1, move +1, move +1, no-op × 4]`, 93 цикла `[move -1, move +1, no-op]` и один завершающий no-op. Это расписание только вход измерительного драйвера: ни один файл `_tools/projects/realtime-wall` не менялся. Каждый measured run получает новый executor от того же read-only project; warmup — отдельный executor. После каждого run проверяются также `triggered_zones.checkpoint === true`, `world_state === "checkpoint-activated"` и clock `120000 ms`.

Текущая штатная smoke-команда `npm run play -- cycles` отдельно завершилась **rc=0**: оригинальный маршрут `realtime-wall-zone` прошёл все manifest assertions, `11` шагов, состояние `max_x=12`, `wall_contacts=1`, `zone_trigger_count=1`, `checkpoint-activated`; вся команда подтвердила оба проекта и оба runtime (2/2). Она не подменяет benchmark, поскольку её маршрут содержит только 11 шагов.

Точная команда benchmark (один Node invocation, один прогрев и ровно три измеренных запуска):

```sh
node --import tsx --input-type=module - <<'NODE'
import assert from 'node:assert/strict'
import os from 'node:os'
import { performance } from 'node:perf_hooks'
import { loadCycleProject } from './scripts/playkit/cycle-check.ts'
import { createRealtimeProjectSetup } from './scripts/playkit/realtime-project.ts'

const warmupTicks = 3000
const measuredRuns = 3
const ticksPerRun = 6000
const targetWallContacts = 817
const project = await loadCycleProject('_tools/projects/realtime-wall')
assert.equal(project.id, 'realtime-wall-zone')
assert.equal(project.runtime, 'realtime')
const base = createRealtimeProjectSetup(project)
const routeLength = base.steps.length
const stepMs = project.manifest.step_ms
assert.equal(stepMs, 20)
assert.equal(routeLength, 11)

function tickAt(steps, tick) {
  if (tick < routeLength) return steps[tick]
  let offset = tick - routeLength
  if (offset < 4) return { dt: stepMs, input: [{ action: 'move', value: 1 }] }
  offset -= 4
  const repeatedTicks = (targetWallContacts - 2) * 7
  if (offset < repeatedTicks) {
    const phase = offset % 7
    const value = phase === 0 ? -1 : phase === 1 || phase === 2 ? 1 : null
    return { dt: stepMs, input: value === null ? [] : [{ action: 'move', value }] }
  }
  offset -= repeatedTicks
  if (offset < 279) {
    const phase = offset % 3
    const value = phase === 0 ? -1 : phase === 1 ? 1 : null
    return { dt: stepMs, input: value === null ? [] : [{ action: 'move', value }] }
  }
  return { dt: stepMs, input: [] }
}

function runTicks(executor, steps, count, collectSamples = false) {
  const samples = collectSamples ? new Array(count) : null
  for (let tick = 0; tick < count; tick += 1) {
    const step = tickAt(steps, tick)
    if (collectSamples) {
      const started = performance.now()
      executor.step(step.dt, step.input ?? [])
      samples[tick] = performance.now() - started
    } else {
      executor.step(step.dt, step.input ?? [])
    }
  }
  return samples
}

const warmup = createRealtimeProjectSetup(project)
runTicks(warmup.executor, warmup.steps, warmupTicks)
console.log('MACHINE', JSON.stringify({ cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, platform: `${os.platform()} ${os.release()}`, node: process.version }))
console.log('WORKLOAD', JSON.stringify({ project: project.id, fixture: '_tools/projects/realtime-wall', routePrefixTicks: routeLength, stepMs, warmupTicks, measuredRuns, ticksPerRun, referenceRun: 1 }))
console.log('WARMUP_COMPLETE', warmupTicks)

const results = []
for (let run = 1; run <= measuredRuns; run += 1) {
  const setup = createRealtimeProjectSetup(project)
  const samples = runTicks(setup.executor, setup.steps, ticksPerRun, true)
  const state = setup.executor.state
  assert.equal(setup.executor.clock, ticksPerRun * stepMs)
  assert.equal(state.max_x, 12)
  assert.equal(state.wall_contacts, targetWallContacts)
  assert.equal(state.zone_trigger_count, 1)
  assert.equal(state.triggered_zones.checkpoint, true)
  assert.equal(state.world_state, 'checkpoint-activated')
  const sorted = [...samples].sort((a, b) => a - b)
  const result = {
    run,
    samples: samples.length,
    medianMs: (sorted[(ticksPerRun / 2) - 1] + sorted[ticksPerRun / 2]) / 2,
    p95Ms: sorted[Math.ceil(0.95 * ticksPerRun) - 1],
    maxMs: sorted.at(-1),
    invariants: { max_x: state.max_x, wall_contacts: state.wall_contacts, zone_trigger_count: state.zone_trigger_count, world_state: state.world_state },
  }
  results.push(result)
  console.log('RUN', JSON.stringify(result))
}
console.log('REFERENCE', JSON.stringify(results[0]))
console.log('BENCHMARK_COMPLETE')
NODE
```

## Сырой вывод

```text
MACHINE {"cpu":"Intel(R) Xeon(R) Processor @ 2.60GHz","logicalCpus":2,"platform":"linux 6.1.158+","node":"v22.22.3"}
WORKLOAD {"project":"realtime-wall-zone","fixture":"_tools/projects/realtime-wall","routePrefixTicks":11,"stepMs":20,"warmupTicks":3000,"measuredRuns":3,"ticksPerRun":6000,"referenceRun":1}
WARMUP_COMPLETE 3000
RUN {"run":1,"samples":6000,"medianMs":0.017197999999964964,"p95Ms":0.02731499999998732,"maxMs":0.2585380000000157,"invariants":{"max_x":12,"wall_contacts":817,"zone_trigger_count":1,"world_state":"checkpoint-activated"}}
RUN {"run":2,"samples":6000,"medianMs":0.015811999999982618,"p95Ms":0.0205850000000396,"maxMs":0.3120039999999449,"invariants":{"max_x":12,"wall_contacts":817,"zone_trigger_count":1,"world_state":"checkpoint-activated"}}
RUN {"run":3,"samples":6000,"medianMs":0.015333500000025424,"p95Ms":0.02000199999997676,"maxMs":0.21303999999997814,"invariants":{"max_x":12,"wall_contacts":817,"zone_trigger_count":1,"world_state":"checkpoint-activated"}}
REFERENCE {"run":1,"samples":6000,"medianMs":0.017197999999964964,"p95Ms":0.02731499999998732,"maxMs":0.2585380000000157,"invariants":{"max_x":12,"wall_contacts":817,"zone_trigger_count":1,"world_state":"checkpoint-activated"}}
BENCHMARK_COMPLETE
```

Треугольник NAR-4.3 (`0.186985 / 0.251383 / 2.789207 ms`) относится к другому workload и **исторический, не current-reference**. Он не смешивался с текущими samples и не используется как измерение `_tools/projects/realtime-wall`. Порог производительности или критерий «проходит/не проходит» не вводился; Phase 4 не открывается этим обновлением.

## Репозиторные проверки

- `npx tsc -b` — **rc=0**.
- `npm run check:mission` — **rc=0**, **55/55** mission smoke scripts; все подгейты, включая `check:decisions`, прошли.
- `npm run lint` — **rc=0**, **1505 warnings, 0 errors**; предупреждения посчитаны отдельно и не менялись.
- `git diff --check` — **rc=0**.
