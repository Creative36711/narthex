# NAR-4.3 · Realtime: фиксированный шаг, накопитель, интерполяция

Дата: 2026-10-27. База: `ed230b7` (NAR-4.2, PR #88).

## Результат и границы

Новый `src/core/realtime/index.ts` — **187 строк**, лимит 450.
`RealtimeExecutor<State>` реализует неизменённый `Executor<State>`;
`createRealtimeExecutorFactory` совместима с `ExecutorFactory<State>`.

Это отдельный fixed-step scheduler: он принимает реальные интервалы кадров,
но вызывает переданную симуляцию **только с dt=20 мс** (настраиваемый целый шаг),
хранит остаток, два снимка и очередь ещё не исполненного ввода. У него нет
таймеров, импорта `engine.ts`, ветвления по виду runtime, копии игровых правил
или импорта `turn`. В composition root можно передать существующую фабрику
Turn как порт настоящего GameEngine; можно передать любую другую фабрику
Executor. Поэтому не потребовалось дублировать адаптер действий из 4.2.

```ts
const realtimeFactory = createRealtimeExecutorFactory(
  createTurnExecutorFactory(campaign, GameEngine), { stepMs: 20 },
)
const executor = realtimeFactory({ seed: 'example' })
executor.step(dtFromOutside)
// Пример для State с числовым position, не для GameState:
const position = executor.interpolate((previous, current, alpha) =>
  previous.position + (current.position - previous.position) * alpha)
```

Существующие потребители не переподключены. `src/core/executor.ts`,
`src/core/turn/**`, `src/core/engine.ts`, `src/player/**`, `scripts/**`,
`public/ai/**`, package files и кампании **не менялись**.
В PR только новый runtime и этот отчёт. Постоянный probe/alias оставлен NAR-4.4;
полный исходник временной пробы сохранён ниже, а не отдельным скриптом в PR.

### Семантика времени, ввода и представления

- `clock = initialSimulationClock + completedSteps * stepMs` — шкала
  fixed-step цикла. `state` и `fingerprint()` — авторитетное состояние порта.
  При композиции с Turn игровые `state.tick` по-прежнему дискретны по кампании:
  цикл не переписывает tick, стоимость действий или сохранения.
- **Допущение:** время realtime-цикла — миллисекунды его симуляции,
  не число игровых часов, потраченных конкретным действием. В Ash один мировой
  тик = 3 600 000 мс; за 60 000 мс без действий tick закономерно остаётся 8.
  Отдельная стресс-фикстура ниже доказывает продвижение и реального tick.
- Накопление использует компенсированное сложение IEEE-754 (Kahan), чтобы не
  терять малые dt при многократном вычитании шага. **Нет epsilon, Math.round,
  квантования входного dt, сортировки событий или повторов до совпадения хэша.**
  Честный остаток при 30/60 Гц — `7.275957614183426e-12` мс, при 144 Гц — 0;
  он не обнулён для отчёта. Все три режима дают ровно 3000 шагов / 60 000 мс.
- Ввод принимается в хронологическом порядке; равные at сохраняют порядок
  поступления. Весь пакет валидируется до изменения времени/очереди; ошибочные
  dt/at и неупорядоченный ввод отклоняются. Интервалы шагов полуоткрытые:
  событие ровно на правой границе остаётся для следующего шага с `at=0`.
  Ввод неполного кадра не теряется и передаётся с локальным at внутри fixed step.
- Pause не принимает время/ввод, но сохраняет прежние остаток и очередь.
  Resume продолжает их. `setSeed` делегирован симуляции и обновляет снимки,
  но не притворяется перезапуском мира/сбросом timeline.
- `frame` возвращает защитные копии previous/current и `alpha=остаток/шаг`.
  `interpolate(project)` даёт внешней проекции эти снимки и alpha. Это
  интерполяция на один шаг позади симуляции, без экстраполяции. Универсальный
  runtime не угадывает, можно ли интерполировать HP, id, инвентарь или флаги;
  числовые координаты интерполирует проекция представления. Она не может
  изменить внутренние снимки или authoritative fingerprint.
- Длинный кадр **не обрезается**: исполняются все полные шаги. Соответственно
  p95 ≤4 мс — бюджет **одного шага**, а не всей пачки catch-up. Синхронный
  кадр длиной 60 с блокирует вызывающего примерно на полсекунды на этой машине;
  скрытого maxSteps/drop-time здесь нет.

Неясно: карточка не задаёт форму интерполированного State и численный лимит памяти.
Решил: отдельная проекция над защитными снимками, а не изменение Executor/сейва;
локальные лимиты памяти перечислены ниже. Изменений замороженного контракта нет.
Откат: удалить `src/core/realtime/index.ts`; прочие потребители от него не зависят.

## Детерминизм: один seed, пять независимых запусков

Seed во всех строках: **`NAR-4.3/4066f0cf`**. Искусственный ряд dt повторяется
до 60 000 мс, последний кадр ограничен точным оставшимся временем:
`[0, 7, 13, 41, 3, 2500, 0.5, 19.5, 333, 1082.5]`.
Каждый запуск создаёт новое состояние и новый PRNG; сравниваются существующие
canonical fingerprints без дополнительной нормализации. Пять запусков — сама
проверка, не поиск удачного прогона; все строки сохранены.

| запуск | seed | симуляция с PRNG на каждом шаге и вводом | GameEngine / Ash | GameEngine / stress |
|---:|---|---|---|---|
| 1 | `NAR-4.3/4066f0cf` | `d4a80bc31e5ad537` | `dfd316f6a78c88aa` | `300c70a2497bcd16` |
| 2 | `NAR-4.3/4066f0cf` | `d4a80bc31e5ad537` | `dfd316f6a78c88aa` | `300c70a2497bcd16` |
| 3 | `NAR-4.3/4066f0cf` | `d4a80bc31e5ad537` | `dfd316f6a78c88aa` | `300c70a2497bcd16` |
| 4 | `NAR-4.3/4066f0cf` | `d4a80bc31e5ad537` | `dfd316f6a78c88aa` | `300c70a2497bcd16` |
| 5 | `NAR-4.3/4066f0cf` | `d4a80bc31e5ad537` | `dfd316f6a78c88aa` | `300c70a2497bcd16` |

- Во всех трёх сериях по 3000 фиксированных шагов и +60 000 мс clock.
- Тестовая симуляция использует настоящий `PRNG`, накапливает его результат
  в state и записывает ввод на 0, 7, 20, 35, 60, 59 999 мс вместе с номером
  fixed step и локальным at. Другой seed даёт другой fingerprint.
- Настоящий Ash загружен существующим `loadCampaign`, выполняются настоящие
  `GameEngine` и `TurnExecutor`. При дефолтной длительности игрового часа
  состояние времени не меняется (tick=8), что не выдано за стресс-нагрузку.
- **Дополнительная стресс-фикстура:** копия Ash только в памяти с
  `ticks_per_day=4 320 000` (мировой тик 20 мс); начальные запасы потребностей
  героя = 1 000 000, чтобы не умереть до конца замера. Decay, правила,
  event tables, combat и проверки движка не отключены. Пройдено **3000 реальных
  мировых тиков**, а не несколько тиков до смерти и затем холостые вызовы.
  Кампания на диске и обязательные оракулы не изменены.
- Смена разбивки на `[20]`, `[16,17,17]`, смешанный ряд, `[0.5,33.5,8,8]`
  или единственный `[60000]` даёт одинаковый hash тестовой симуляции с вводом.
  Реальные 30/60/144 Гц также проверены: clock=60 000, ticks=3000.
- Одиночный `step(60000)` на настоящем GameEngine даёт тот же hash, что
  смешанный ряд, и на Ash, и на стресс-фикстуре. Последняя проходит все 3000
  мировых тиков, без потери шагов.
- Дополнительно: остаток 19+6 мс, alpha=0.25 и числовая интерполяция 0→20 = 5;
  изоляция снимков от пишущей проекции; границы ввода; сохранение очереди при
  pause; игнорирование paused input; защита от мутации принятого события;
  atomic validation dt/at; reseed и приоритет сохранённого seed — PASS.

## Бюджет шага и памяти

**Машина:** Linux, Intel(R) Xeon(R) Processor @ 2.60GHz, x64,
2 видимых логических CPU; **Node v22.22.3**. Это sandbox, не обещание
такой же задержки на другой машине.

Метод: `performance.now()` **снаружи runtime**, вокруг полного
`RealtimeExecutor.step(20)`; 3000 последовательных измерений = 60 с
симулированного времени на строку. Включены вложенный Executor, fingerprint
состояния внутри Turn и structuredClone нового снимка. Рендер-проекция,
инициализация, загрузка кампании, `memoryUsage()` и финальный fingerprint —
вне тайминга. Пять серий детерминизма перед этим прогревают код; специального
подбора лучшего замера, удаления выбросов или повторов до прохождения нет.
Медиана — среднее 1500-го и 1501-го отсортированных измерений; p95 —
nearest-rank, 2850-е из 3000. Сортируются только **замеры**, не состояние.
Таблица округляет только отображение измерений, не данные/хэши симуляции.
Зафиксирован полный замер из `out/NAR-4.3/probe.log`, не лучший из запусков.

| нагрузка | шагов × шаг | медиана, мс | p95, мс | max, мс | сумма шагов, мс | Δ мирового tick | гейт p95 ≤4 мс |
|---|---|---:|---:|---:|---:|---:|---|
| `real-campaign` | 3000 × 20 мс | 0.158527 | 0.227084 | 0.609288 | 512.165 | 0 | PASS |
| `real-engine-20ms-ticks` | 3000 × 20 мс | 0.186985 | 0.251383 | 2.789207 | 606.190 | 3000 | PASS |

Один catch-up вызов `step(60000)` (все 3000 шагов): Ash — **486.885 мс**,
stress — **576.949 мс**. Это реальное ограничение синхронного catch-up,
не обещание укладывать произвольный длинный кадр в 4 мс.

**Допущение о памяти:** карточка требует число, но не задаёт порог. Локальные
assert-гейты для пробы: прирост пикового heap ≤64 MiB; прирост retained heap
после GC ≤2 MiB; пиковый RSS всего процесса ≤256 MiB. Это бюджет этой
нагрузки, не ограничитель выделений произвольного State в библиотеке.

Замеры `process.memoryUsage()` между шагами; GC перед/после каждой серии
(`node --expose-gc`), не принудительно внутри измеряемых шагов. Retained delta
включает массив 3000 замеров, а RSS — весь процесс с loader/tsx и предыдущими
пробами, поэтому эти цифры не приписаны одному runtime.

| нагрузка | heap до, MiB | пик heap, MiB | прирост пика, MiB | retained Δ, байт | пик RSS, MiB | state JSON старт→финиш, байт | гейты памяти |
|---|---:|---:|---:|---:|---:|---:|---|
| `real-campaign` | 19.293 | 35.138 | 15.845 | -41632 | 142.094 | 1973→1973 | PASS |
| `real-engine-20ms-ticks` | 19.191 | 35.061 | 15.870 | 62712 | 141.305 | 1989→2160 | PASS |

Runtime хранит только два снимка и ожидающий ввод: O(|State| + |pending input|),
без истории кадров и без массива измерений. Две копии JSON финального состояния
для оценки полезных данных — 3946 / 4320 байт; это **не** эквивалент объёма
объектов в V8. Пиковые замеры дискретны по шагам, не heap-profiler tracing.

## Регрессия: те же числа, что в NAR-4.2

| кампания | rc 4.2 / 4.3 | сцен | локаций | диалогов | Ink | ошибок | предупреждений | seed / смерти | покрытие |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| `ash-of-caerden` | 0 / 0 | 10 / 10 | 8 / 8 | 6 / 6 | 21 / 21 | 0 / 0 | 8 / 8 | 5 / 5 → 5 / 5 | 6/10 → 6/10 |
| `ash-of-caerden-adventure` | 0 / 0 | 10 / 10 | 8 / 8 | 6 / 6 | 21 / 21 | 0 / 0 | 8 / 8 | 5 / 5 → 5 / 5 | 6/10 → 6/10 |

В каждой кампании состав смертей прежний: 1 exhaustion + 4 combat.
Источник baseline — `_tools/reports/NAR-4.2.md` на `ed230b7`;
файлы/команды оракулов не изменены.

| команда на финальном runtime | rc / результат |
|---|---|
| `npx tsc -b` | 0 |
| `npm run check:core-graph` | 0; 29 modules, acyclic, no core imports of engine.ts |
| `npm run check:module-size` | 0; realtime 187/450; прежний external debt не менялся |
| `node --expose-gc --import tsx _tools/NAR-4.3-probe.mts` | 0; ORACLE: PASS, гейты времени/памяти и assertions |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | 0; числа выше |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure` | 0; числа выше |
| `npm run smoke:core` | 0 |
| `npm run smoke:mission` | 0; **55/55**, удалённых 0 |

Временные полные stdout: `out/NAR-4.3/{probe,tsc,graph,size,ash,adventure,core,mission}.log`
(ignored, не входят в PR). В source-пробе loader предупреждает о версии
`0.0.0-dev`, поскольку она запущена без bundler version define; ошибка не
подавляется, официальный cf-play bundle check проходит с rc=0.

## Воспроизведение временной пробы

Полный исходник ниже — артефакт отчёта, не постоянный runner NAR-4.4.
Из корня репозитория после `npm ci` извлечь единственный блок `typescript`
в `_tools/NAR-4.3-probe.mts`, выполнить команду из таблицы, затем удалить
временный файл. Проба читает canonical Ash из `public/campaigns/`, не меняя
его, без сервера и сети; временная подмена fetch восстанавливается после загрузки.

```sh
python3 - <<'PY'
from pathlib import Path
text = Path('_tools/reports/NAR-4.3.md').read_text()
source = text.split('```typescript\n', 1)[1].split('\n```', 1)[0]
Path('_tools/NAR-4.3-probe.mts').write_text(source + '\n')
PY
node --expose-gc --import tsx _tools/NAR-4.3-probe.mts
# После проверки удалить только временный _tools/NAR-4.3-probe.mts.
```

```typescript
import assert from 'node:assert/strict'
import { cpus, arch, platform } from 'node:os'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import '../packs/narrative/operations'
import { RealtimeExecutor, createRealtimeExecutorFactory } from '../src/core/realtime/index'
import { createTurnExecutorFactory } from '../src/core/turn/index'
import type { Executor, ExecutorInput } from '../src/core/executor'
import { fingerprintOf } from '../src/core/executor'
import { PRNG } from '../src/core/prng'
import { GameEngine } from '../src/core/engine'
import { loadCampaign } from '../src/core/loader'

class Simulation implements Executor<Model> {
  state: Model = { seed: '', x: 0, noise: 0, ticks: 0, events: [] }
  paused = false
  private rng = new PRNG('initial')
  constructor(seed = 'NAR-4.3') { this.setSeed(seed) }
  get clock() { return this.state.ticks * 20 }
  step(dt: number, input: readonly ExecutorInput[] = []) {
    assert.equal(dt, 20)
    this.state.x += dt
    this.state.noise += this.rng.next()
    this.state.ticks++
    for (const e of input) this.state.events.push(`${this.state.ticks}:${e.at}:${e.value}`)
    return { changed: true, clock: this.clock }
  }
  setSeed(seed: string) { this.rng = new PRNG(seed); this.state.seed = seed }
  pause() { this.paused = true }
  resume() { this.paused = false }
  fingerprint() { return fingerprintOf(this.state) }
}
type Model = { seed: string; x: number; noise: number; ticks: number; events: string[] }
const seed = 'NAR-4.3/4066f0cf'
const mixed = [0, 7, 13, 41, 3, 2500, 0.5, 19.5, 333, 1082.5]
const eventTimes = [0, 7, 20, 35, 60, 59999]
function drive(executor: RealtimeExecutor<unknown>, pattern: number[], withEvents = false) {
  let elapsed = 0, frame = 0
  while (elapsed < 60000) {
    const dt = Math.min(pattern[frame++ % pattern.length], 60000 - elapsed)
    const input = withEvents ? eventTimes.filter(t => t >= elapsed && t < elapsed + dt)
      .map(t => ({ action: 'record', value: t, at: t - elapsed })) : []
    executor.step(dt, input)
    elapsed += dt
  }
  assert.equal(executor.clock, 60000)
}
console.log('MACHINE', JSON.stringify({ cpu: cpus()[0].model, arch: arch(), platform: platform(), node: process.version, cpus: cpus().length }))
for (let run = 1; run <= 5; run++) {
  const e = new RealtimeExecutor(new Simulation(seed))
  drive(e, mixed, true)
  console.log('SEED', run, seed, e.fingerprint(), e.state.ticks, e.clock, e.accumulatorMs)
}
const reference = new RealtimeExecutor(new Simulation(seed))
drive(reference, [20], true)
for (const pattern of [[16, 17, 17], mixed, [60000], [0.5, 33.5, 8, 8]]) {
  const e = new RealtimeExecutor(new Simulation(seed))
  drive(e, pattern, true)
  assert.equal(e.fingerprint(), reference.fingerprint())
  assert.equal(e.state.events.length, 6)
}
for (const hz of [30, 60, 144]) {
  const e = new RealtimeExecutor(new Simulation(seed))
  for (let i = 0; i < hz * 60; i++) e.step(1000 / hz)
  assert.equal(e.clock, 60000)
  assert.equal(e.state.ticks, 3000)
  console.log('HZ', hz, e.clock, e.accumulatorMs)
}
const other = new RealtimeExecutor(new Simulation('another-seed'))
drive(other, mixed, true)
assert.notEqual(other.fingerprint(), reference.fingerprint())
const e = new RealtimeExecutor(new Simulation(seed))
assert.deepEqual(e.step(19), { changed: false, clock: 0 })
assert.equal(e.accumulatorMs, 19)
e.step(6)
assert.equal(e.alpha, 0.25)
assert.equal(e.interpolate((a, b, alpha) => a.x + (b.x - a.x) * alpha), 5)
const beforeView = e.fingerprint()
e.interpolate((a, b) => { a.x = -500; b.x = -100; return b })
assert.equal(e.frame.current.x, 20)
assert.equal(e.fingerprint(), beforeView)
e.pause()
e.step(60000, [{ action: 'record', value: 'ignored' }])
assert.equal(e.clock, 20)
assert.equal(e.accumulatorMs, 5)
e.resume()
e.step(15)
assert.equal(e.clock, 40)
assert.equal(e.state.events.length, 0)
for (const dt of [-1, NaN, Infinity]) assert.throws(() => e.step(dt), RangeError)
for (const input of [
  [{ action: 'record', at: -1 }], [{ action: 'record', at: 21 }],
  [{ action: 'record', at: NaN }], [{ action: '' }],
  [{ action: 'record', at: 10 }, { action: 'record', at: 5 }],
]) {
  const saved = [e.clock, e.accumulatorMs, e.fingerprint()]
  assert.throws(() => e.step(20, input), RangeError)
  assert.deepEqual([e.clock, e.accumulatorMs, e.fingerprint()], saved)
}
for (const stepMs of [0, -1, 0.1, NaN, Infinity]) {
  assert.throws(() => new RealtimeExecutor(new Simulation(), { stepMs }), RangeError)
}
assert.throws(() => e.step(Number.MAX_VALUE), RangeError)
const boundary = new RealtimeExecutor(new Simulation(seed))
boundary.step(20, [{ action: 'record', value: 'end', at: 20 }])
assert.equal(boundary.state.events.length, 0)
boundary.step(0, [{ action: 'record', value: 'next', at: 0 }])
boundary.step(20)
assert.deepEqual(boundary.state.events, ['2:0:end', '2:0:next'])
const deferred = new RealtimeExecutor(new Simulation(seed))
const event = { action: 'record', value: 'copied', at: 5 }
deferred.step(10, [event]); event.value = 'mutated'
deferred.pause(); deferred.step(100); deferred.resume(); deferred.step(10)
assert.deepEqual(deferred.state.events, ['1:5:copied'])
deferred.setSeed('changed')
assert.equal(deferred.state.seed, 'changed')
assert.equal(deferred.frame.current.seed, 'changed')
assert.equal(deferred.clock, 20)
console.log('INVARIANTS: PASS (seed, schedules, 30/60/144 Hz, input, boundary, pause, interpolation, snapshot isolation, invalid input atomicity)')

// Real loader, without a dev server or network. Restore fetch after loading.
const originalFetch = globalThis.fetch
const base = 'https://fixture.invalid'
globalThis.fetch = async (url) => {
  const pathname = new URL(String(url), base).pathname
  try { return new Response(await readFile(resolve('public/campaigns/ash-of-caerden', '.' + pathname))) }
  catch { return new Response('', { status: 404 }) }
}
const campaign = await loadCampaign(base)
globalThis.fetch = originalFetch
const factory = createRealtimeExecutorFactory(createTurnExecutorFactory(campaign, GameEngine))
const gameHashes: string[] = []
for (let run = 1; run <= 5; run++) {
  const game = factory({ seed })
  const initialClock = game.clock
  let elapsed = 0, frame = 0
  while (elapsed < 60000) {
    const dt = Math.min(mixed[frame++ % mixed.length], 60000 - elapsed)
    game.step(dt)
    elapsed += dt
  }
  assert.equal(game.clock - initialClock, 60000)
  gameHashes.push(game.fingerprint())
  console.log('GAME_SEED', run, seed, game.fingerprint(), game.clock - initialClock, game.state.tick)
}
assert.equal(new Set(gameHashes).size, 1)
const saved = structuredClone(factory({ seed: 'saved-seed' }).state)
assert.equal(factory({ seed: 'ignored', state: saved }).state.seed, 'saved-seed')

// Stress fixture: same real campaign/rules, one campaign tick per 20 ms.
const stressCampaign = structuredClone(campaign)
stressCampaign.meta.ticks_per_day = 4320000
const stressBase = createRealtimeExecutorFactory(createTurnExecutorFactory(stressCampaign, GameEngine))
const stressFactory: typeof factory = (initial = {}) => {
  const state = structuredClone(stressBase(initial).state)
  // Explicit stress fixture reserves: keep the hero alive for all 3000 ticks,
  // without disabling any need/rule checks or modifying canonical campaigns.
  for (const id of Object.keys(state.player.needs)) state.player.needs[id] = 1000000
  return stressBase({ state })
}
const stressHashes: string[] = []
for (let run = 1; run <= 5; run++) {
  const game = stressFactory({ seed })
  const startClock = game.clock, startTick = game.state.tick
  let elapsed = 0, frame = 0
  while (elapsed < 60000) {
    const dt = Math.min(mixed[frame++ % mixed.length], 60000 - elapsed)
    game.step(dt); elapsed += dt
  }
  assert.equal(game.clock - startClock, 60000)
  assert.equal(game.state.tick - startTick, 3000)
  stressHashes.push(game.fingerprint())
  console.log('STRESS_SEED', run, seed, game.fingerprint(), game.clock - startClock, game.state.tick - startTick)
}
assert.equal(new Set(stressHashes).size, 1)
for (const [label, make] of [['real-campaign', factory], ['real-engine-20ms-ticks', stressFactory]] as const) {
  const game = make({ seed })
  const initialClock = game.clock
  const initialTick = game.state.tick
  const snapshotBytes = Buffer.byteLength(JSON.stringify(game.state))
  globalThis.gc?.()
  const before = process.memoryUsage()
  let peakHeap = before.heapUsed, peakRss = before.rss
  const samples: number[] = []
  for (let i = 0; i < 3000; i++) {
    const start = performance.now()
    game.step(20)
    samples.push(performance.now() - start)
    const mem = process.memoryUsage()
    peakHeap = Math.max(peakHeap, mem.heapUsed)
    peakRss = Math.max(peakRss, mem.rss)
  }
  assert.equal(game.clock - initialClock, 60000)
  const after = process.memoryUsage()
  globalThis.gc?.()
  const retained = process.memoryUsage()
  // Sorting measurements is statistical analysis, never a state/hash operation.
  const sorted = [...samples].sort((a, b) => a - b)
  console.log('BENCH', JSON.stringify({ label, steps: samples.length, stepMs: 20,
    medianMs: (sorted[1499] + sorted[1500]) / 2, p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1],
    maxMs: sorted.at(-1), totalMs: samples.reduce((a, b) => a + b, 0),
    clockDelta: game.clock - initialClock, tickDelta: game.state.tick - initialTick,
    hash: game.fingerprint(), snapshotBytes, finalSnapshotBytes: Buffer.byteLength(JSON.stringify(game.state)),
    before, after, retained, peakHeap, peakRss,
    retainedHeapDelta: retained.heapUsed - before.heapUsed, peakHeapDelta: peakHeap - before.heapUsed }))
  assert.ok(sorted[Math.ceil(0.95 * sorted.length) - 1] <= 4)
  assert.ok(peakHeap - before.heapUsed <= 64 * 1024 ** 2)
  assert.ok(retained.heapUsed - before.heapUsed <= 2 * 1024 ** 2)
  assert.ok(peakRss <= 256 * 1024 ** 2)
}
const long = factory({ seed })
const initialClock = long.clock
const start = performance.now()
long.step(60000)
console.log('LONG_FRAME', performance.now() - start, long.clock - initialClock)
assert.equal(long.clock - initialClock, 60000)
assert.equal(long.fingerprint(), gameHashes[0])
const stressLong = stressFactory({ seed })
const stressClock = stressLong.clock, stressTick = stressLong.state.tick
const stressStart = performance.now()
stressLong.step(60000)
console.log('STRESS_LONG_FRAME', performance.now() - stressStart, stressLong.clock - stressClock, stressLong.state.tick - stressTick)
assert.equal(stressLong.state.tick - stressTick, 3000)
assert.equal(stressLong.fingerprint(), stressHashes[0])
console.log('ORACLE: PASS')
```
