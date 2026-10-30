# NAR-4.14 — Возврат-5: бюджет кадра, один измеренный workload

- Дата: **2026-10-28**.
- Dispatch: `4076f0cf-5705-81dd-b2f5-d3f9902bcc03`.
- Run: `8b94e757-32c4-41b2-8860-dcaf3795c253`.
- База: свежий `origin/main` = `4852e76c94e86b1714eca597a9384b31d97548d7`; `HEAD` и merge-base совпали.
- Ветка сессии: закреплённая Arena `arena/2a65bc58-narthex`.

## Ответ

**Замечание 5 закрыто.** Единственный текущий benchmark record: workload `real-engine-20ms-ticks`, 3000 кадров × 20 мс, seed `NAR-4.3/4066f0cf`: **median `0.21211249999987558` мс; p95 `0.2986430000000837` мс; max `2.202897000000121` мс**.

Машина: **Intel(R) Xeon(R) Processor @ 2.60GHz, 2 logical CPU, Debian GNU/Linux 12 (bookworm), Linux `6.1.158+` x86_64, Node `v22.22.3`, npm `10.9.8`**. Это один прогон; выбросы не отбрасывались. Порогов и вердикта «проходит/не проходит» по времени не вводилось. Фаза 4 не начинается.

## База, установка и среда

До правок выполнен `git fetch origin main`; `HEAD`, `origin/main` и `merge-base` совпали на `4852e76c94e86b1714eca597a9384b31d97548d7`, worktree был чистым. Текущий прогон и TypeScript проверка выполнены локально на этой базе.

При первом вызове `npx tsc -b` (до установки зависимостей) локального компилятора не было: **rc=1**, `npx` предложил посторонний пакет `tsc@2.0.4`. Он не был сохранён в manifest/lock. Затем `npm ci --ignore-scripts` завершился **rc=0** (70 пакетов; audit сообщил одну moderate vulnerability), после чего требуемый `npx tsc -b` завершился **rc=0**. Lock-файл не менялся.

Проверяемая машина совпадает с опубликованным описанием NAR-4.3 по CPU, числу видимых CPU и Node: Intel Xeon @ 2.60GHz, 2 CPU, Node v22.22.3. В NAR-4.3 дистрибутив/ядро и npm не записаны; поэтому их тождество задним числом не предполагается.

## Одиночный прогон

В NAR-4.3 не было постоянного runner: воспроизводимый TypeScript probe сохранён code block'ом в [_tools/reports/NAR-4.3.md](NAR-4.3.md). Из него создан временный `_tools/NAR-4.14-probe.mts`: оставлен ровно один timed case `real-engine-20ms-ticks`; цикл измерения `RealtimeExecutor.step(20)`, 3000 samples, seed, in-memory stress fixture, `performance.now()` и формулы median/p95/max сохранены. Второй timed workload `real-campaign`, post-benchmark long-frame замеры и старые performance threshold assertions из временной копии исключены. Исходный NAR-4.3 отчёт/код, tracked source, workload данные и пороги не изменялись. Весь временный probe удалён после прогона.

Подготовка временной копии и команда запуска:

````sh
python3 - <<'PY'
from pathlib import Path
text = Path('_tools/reports/NAR-4.3.md').read_text()
source = text.split('```typescript\n', 1)[1].split('\n```', 1)[0]
old = "for (const [label, make] of [['real-campaign', factory], ['real-engine-20ms-ticks', stressFactory]] as const) {"
new = "for (const [label, make] of [['real-engine-20ms-ticks', stressFactory]] as const) {"
assert source.count(old) == 1
source = source.replace(old, new)
for line in (
    "  assert.ok(sorted[Math.ceil(0.95 * sorted.length) - 1] <= 4)\n",
    "  assert.ok(peakHeap - before.heapUsed <= 64 * 1024 ** 2)\n",
    "  assert.ok(retained.heapUsed - before.heapUsed <= 2 * 1024 ** 2)\n",
    "  assert.ok(peakRss <= 256 * 1024 ** 2)\n",
):
    assert source.count(line) == 1
    source = source.replace(line, '')
source = source[:source.index('\nconst long = factory({ seed })')] + "\nconsole.log('BENCHMARK_COMPLETE')\n"
Path('_tools/NAR-4.14-probe.mts').write_text(source + '\n')
PY
node --expose-gc --import tsx _tools/NAR-4.14-probe.mts > /tmp/nar-4.14-bench.stdout 2> /tmp/nar-4.14-bench.stderr
````

Синтаксис временной копии проверен до прогона без исполнения; diagnostics=0. Непосредственно перед запуском 5-секундный `/proc/stat` sample показал **99.90% CPU idle**, load average `0.03 0.13 0.07`; в process snapshot не было dev server, тест-раннера или другого benchmark. После этого запущен ровно один Node benchmark invocation, без параллельных локальных задач. Машинная строка из самой пробы: `MACHINE {"cpu":"Intel(R) Xeon(R) Processor @ 2.60GHz","arch":"x64","platform":"linux","node":"v22.22.3","cpus":2}`.

Код возврата benchmark: **rc=0**. Исходный stderr (не скрывался):

```
[narthex] Кампания рассчитана на движок 0.1.0 и новее, а запущен 0.0.0-dev. Обновите Narthex — иначе правила и механики кампании могут работать неверно.
```

Это предупреждение ожидаемо для исходного probe без bundler version define; такое же предупреждение описано в NAR-4.3. Оно не изменило прогон и не было подавлено.

### Сравнение «тогда / сейчас»

| Метрика | Тогда: NAR-4.3, `real-engine-20ms-ticks` | Сейчас: NAR-4.14, один прогон | Изменение |
|---|---:|---:|---:|
| median, мс | 0.186985 | 0.21211249999987558 | +0.02512749999987558 мс (+13.43824370932191352247506484%) |
| p95, мс | 0.251383 | 0.2986430000000837 | +0.0472600000000837 мс (+18.79999840883580035245024524%) |

Единственная полная текущая тройка — median `0.21211249999987558`, p95 `0.2986430000000837`, max `2.202897000000121` мс. Точность чисел сохранена как в JSON stdout; отдельного округления/обрезки нет. Median — среднее 1500-го и 1501-го отсортированных samples; p95 — nearest-rank, 2850-й из 3000; max — максимальный sample. В workload выполнено 60,000 мс и 3000 мировых ticks.

Рост median/p95 не приписываю смене CPU/Node: в опубликованных полях машина та же. Сверка tree между merge commit NAR-4.3 `4f4160cfb8664d4a827f6f60f2ab81aeea842f94` и текущим `HEAD` не нашла изменений в `src/core/**`, `packs/narrative/**`, canonical `public/campaigns/ash-of-caerden/**` или `package-lock.json`; package.json между ними менял scripts, не lock-зависимости. Текущий probe также дал прежние stress fingerprint `300c70a2497bcd16` и размеры JSON snapshot 1989 → 2160 байт. Следовательно, измеренный runtime/source/data здесь не объясняет рост. NAR-4.3 не сохраняет kernel/distro/npm, поэтому эти факторы для старого замера неизвестны; текущий pre-run sample подтверждает локальный простой, но не состояние хоста в 2026-10-27. При заданном ограничении «один прогон» отделить межзапусковую/виртуализационную вариацию от малого временного сдвига нельзя. Значения оставлены как измерены — без повторного прогона, усреднения или удаления max.

## Сырой stdout одного benchmark invocation

Ниже stdout из `/tmp/nar-4.14-bench.stdout` без сокращения. В нём ровно одна строка `BENCH`, и она относится к указанному workload.

```text
MACHINE {"cpu":"Intel(R) Xeon(R) Processor @ 2.60GHz","arch":"x64","platform":"linux","node":"v22.22.3","cpus":2}
SEED 1 NAR-4.3/4066f0cf d4a80bc31e5ad537 3000 60000 0
SEED 2 NAR-4.3/4066f0cf d4a80bc31e5ad537 3000 60000 0
SEED 3 NAR-4.3/4066f0cf d4a80bc31e5ad537 3000 60000 0
SEED 4 NAR-4.3/4066f0cf d4a80bc31e5ad537 3000 60000 0
SEED 5 NAR-4.3/4066f0cf d4a80bc31e5ad537 3000 60000 0
HZ 30 60000 7.275957614183426e-12
HZ 60 60000 7.275957614183426e-12
HZ 144 60000 0
INVARIANTS: PASS (seed, schedules, 30/60/144 Hz, input, boundary, pause, interpolation, snapshot isolation, invalid input atomicity)
GAME_SEED 1 NAR-4.3/4066f0cf dfd316f6a78c88aa 60000 8
GAME_SEED 2 NAR-4.3/4066f0cf dfd316f6a78c88aa 60000 8
GAME_SEED 3 NAR-4.3/4066f0cf dfd316f6a78c88aa 60000 8
GAME_SEED 4 NAR-4.3/4066f0cf dfd316f6a78c88aa 60000 8
GAME_SEED 5 NAR-4.3/4066f0cf dfd316f6a78c88aa 60000 8
STRESS_SEED 1 NAR-4.3/4066f0cf 300c70a2497bcd16 60000 3000
STRESS_SEED 2 NAR-4.3/4066f0cf 300c70a2497bcd16 60000 3000
STRESS_SEED 3 NAR-4.3/4066f0cf 300c70a2497bcd16 60000 3000
STRESS_SEED 4 NAR-4.3/4066f0cf 300c70a2497bcd16 60000 3000
STRESS_SEED 5 NAR-4.3/4066f0cf 300c70a2497bcd16 60000 3000
BENCH {"label":"real-engine-20ms-ticks","steps":3000,"stepMs":20,"medianMs":0.21211249999987558,"p95Ms":0.2986430000000837,"maxMs":2.202897000000121,"totalMs":687.5239350000047,"clockDelta":60000,"tickDelta":3000,"hash":"300c70a2497bcd16","snapshotBytes":1989,"finalSnapshotBytes":2160,"before":{"rss":152756224,"heapTotal":59023360,"heapUsed":20347176,"external":6798403,"arrayBuffers":2181934},"after":{"rss":152756224,"heapTotal":59023360,"heapUsed":36975984,"external":6066162,"arrayBuffers":2181934},"retained":{"rss":153026560,"heapTotal":57188352,"heapUsed":20327520,"external":6066162,"arrayBuffers":2181934},"peakHeap":36982896,"peakRss":152756224,"retainedHeapDelta":-19656,"peakHeapDelta":16635720}
BENCHMARK_COMPLETE
```

## Сверка результатов и инвентаризация исторических троек

`npx tsc -b` — **rc=0**.

Обязательный Tools reference gate также пройден: `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out /tmp/nar414-source-check` вернул **rc=0**, 10 сцен / 8 локаций / 6 диалогов / 21 Ink, 0 ошибок / 8 предупреждений, 5 seed → death, покрытие 6/10. `npm run pack:ai-kit` — **rc=0**, 110 файлов; ZIP integrity **PASS** (122 entries), после распаковки `cf-play check` эталона из `__chronicle_ai__/examples/narrative` также **rc=0** с теми же числами. Архив/распаковка — временные, в Git не добавлены.

Аудит исходного `origin/main` до этой записи нашёл исторические значения только в NAR-4.3 (его таблица содержит старую отдельную строку `real-campaign` и целевой `real-engine-20ms-ticks`), а также копии целевой NAR-4.3 медианы/p95 в NAR-4.9 и `docs/phases.md`. Эти источники существовали до NAR-4.14 и оставлены неизменными: карточка одновременно требует сравнить с NAR-4.3 и ограничивает scope текущими evidence-файлами; переписывать baseline означало бы выйти за scope и стереть историю. NAR-4.14 добавляет ровно один новый current `BENCH` record для единственного требуемого workload; второй current workload/triple не добавлен. Поэтому «других троек» в буквальном смысле среди исторических файлов репозитория нет оснований объявлять отсутствующими; единственной авторитетной текущей тройкой является указанная выше NAR-4.14 запись.

Фаза 4 не начинается; исходники, probe постоянного назначения, пороги и phase state не менялись. Временный probe, zip и распакованный kit удалены. В tracked дереве оставлены только `_tools/reports/NAR-4.14.md` и [решение NAR-4.14](../../docs/decisions/NAR-4.14.md).
