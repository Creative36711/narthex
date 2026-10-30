# NAR-4.16 · «Возврат-7» — current frame-budget reference

Статус: accepted
Дата: 2026-10-28
Дата решения: 2026-10-28
Решил: Tools
Проект: `_tools/projects/realtime-wall` (`realtime-wall-zone`, runtime `realtime`)
Параметры: **3000 warmup ticks**, затем **3 × 6000 ticks**, `step_ms = 20`
Машина: **Intel(R) Xeon(R) Processor @ 2.60GHz**, 2 логических CPU, Debian GNU/Linux 12 (bookworm), Linux `6.1.158+` x86_64, Node **`v22.22.3`**
Отчёт: [`_tools/reports/NAR-4.16.md`](../../_tools/reports/NAR-4.16.md)
База: `origin/main` / merge-base `9575bfa9c2f77f79117ccae03832ba4984f966e1`.

## Решение

Текущим эталоном пункта 5 принимается **Run 1** из трёх заранее запланированных прогонов: median **`0.017197999999964964 ms`**, p95 **`0.02731499999998732 ms`**, max **`0.2585380000000157 ms`**. Run 1 назначен reference до измерения; тройка не является усреднением, сглаживанием или выбором лучшего результата. Все три per-run тройки и инварианты сохранены в отчёте.

Все три измеренных прогона завершились с `max_x=12`, `wall_contacts=817`, `zone_trigger_count=1` и событием `checkpoint-activated`. Устаревшие значения NAR-4.3 (`0.186985 / 0.251383 / 2.789207 ms`, workload `real-engine-20ms-ticks`) остаются только исторической записью и не являются current reference. В `docs/phases.md` и пункте 5 `_tools/reports/NAR-4.9.md` использована одна и та же свежая тройка, машина и дата замера.

В текущем `origin/main` не обнаружены `scripts/bench-frame.*` и соответствующий npm-script. Поэтому benchmark выполнен одноразовой inline-командой через имеющиеся `loadCycleProject()` и `createRealtimeProjectSetup()`, с read-only доступом к fixture; выбранный способ, продолжение route, точный oracle и результат описаны в отчёте. Не менялись runtime/source, fixture, тесты, пороги, package scripts или зависимости. Правка остаётся docs-only и не меняет статус фаз; Phase 4 этим решением не начинается.

## Неясно / решил / откат

**Неясно:** требуемый карточкой `scripts/bench-frame.*` отсутствует в свежем `origin/main`, поэтому штатная команда из этого entry point недоступна.

**Решил:** не добавлять постоянный benchmark script и не трогать код; провести один воспроизводимый inline-прогон на существующем realtime project adapter, сохранить все три запуска и явно зафиксировать эту оговорку.

**Откат:** если выбранный reference, любой invariant или точность результата окажутся неверными, вернуть пункт 5 в статус «не подтверждён» и исправить только эти docs evidence; не ослаблять oracle и не менять runtime, fixture, thresholds или tests.
