# NAR-4.9 · Вердикт о закрытии фазы 3

Статус: accepted
Дата: 2026-10-27
Дата решения: 2026-10-27
Основание: оракул фазы 3 в [ТЗ NAR-4](../agents/tz-nar-4.md) и неизменённый раздел [«Фаза 3»](../phases.md).

## Решение

На дату проверки **фазу 3 не закрывать**. Статус `accepted` относится к этому
вердикту, а не означает, что фаза закрыта. Доказательств недостаточно для
закрытия по собственному правилу оракула: visual CI подтверждает успешные
шаги `npx tsc -b`, `check:determinism`, `smoke:mission` и два `cf-play check`,
но не запускает `npm run check:mission` и `cf-play cycles`. Кроме того, замер
бюджета кадра записан локально, не в CI и не на эталонной realtime-fixture.
Локальный успех команды или наличие
чисел в отчёте не подменяют требуемое CI-доказательство.

Подробная матрица источников, включая проходящие пункты и пробелы, находится в
[отчёте NAR-4.9](../../_tools/reports/NAR-4.9.md). Критерии фазы 3, пороги и
проверки не изменены; удалённых проверок 0. Фаза 2 не пересматривается, Фаза 4
не объявляется начатой. Повторная оценка возможна после появления CI-доказательств
для фактической пары проектов и полного `check:mission`, а также CI-источника
бюджета кадра.

## CI-свидетель

[Visual run #40537871691](https://github.com/Creative36711/narthex/actions/runs/40537871691)
прошёл на PR #94 перед merge. В нём успешны TypeScript, «Детерминизм циклов»,
контракты/browser gate, 55 smoke-проверок, оба `cf-play check`, сборка и
браузерный шаг. Состав workflow виден в
[`.github/workflows/visual.yml`](../../.github/workflows/visual.yml): он
запускает `npm run smoke:mission` и `npm run check:determinism`, но не
`npm run check:mission` и не `node public/ai/cf-play.mjs cycles`.

## Трассировка миссии и PR

- [ТЗ NAR-4](../agents/tz-nar-4.md) — исходный оракул; он не менялся.
- [PR #86](https://github.com/Creative36711/narthex/pull/86) — контракт Executor (NAR-4.1).
- [PR #87](https://github.com/Creative36711/narthex/pull/87) — роли и карточки инструментальных миссий.
- [PR #88](https://github.com/Creative36711/narthex/pull/88) — пошаговый Executor (NAR-4.2).
- [PR #89](https://github.com/Creative36711/narthex/pull/89) — realtime и измерения (NAR-4.3).
- [PR #90](https://github.com/Creative36711/narthex/pull/90) — детерминизм циклов (NAR-4.4).
- [PR #91](https://github.com/Creative36711/narthex/pull/91) — fixture и `cf-play cycles` (NAR-4.5).
- [PR #92](https://github.com/Creative36711/narthex/pull/92) — browser parity (NAR-4.6).
- [PR #93](https://github.com/Creative36711/narthex/pull/93) — NAR-4.7.
- [PR #94](https://github.com/Creative36711/narthex/pull/94) — NAR-4.8.

Отчёты, существующие в репозитории: [NAR-4.2](../../_tools/reports/NAR-4.2.md),
[NAR-4.3](../../_tools/reports/NAR-4.3.md),
[NAR-4.4](../../_tools/reports/NAR-4.4.md),
[NAR-4.5](../../_tools/reports/NAR-4.5.md),
[NAR-4.6](../../_tools/reports/NAR-4.6.md),
[NAR-4.7](../../_tools/reports/NAR-4.7.md),
[NAR-4.8](../../_tools/reports/NAR-4.8.md). Решение для NAR-4.7:
[`docs/decisions/NAR-4.7.md`](./NAR-4.7.md). Файл
[`docs/decisions/NAR-4.md`](./NAR-4.md) уже содержит принятое решение по
Executor из NAR-4.2 и оставлен без изменений.

## Неясно / решил / откат

Неясно: `NAR-4.md` уже занят решением NAR-4.2; заменить его записью о вердикте NAR-4.9 означало бы потерять историю Executor.

Решил: записать этот вердикт в свободном `NAR-4.9.md` и оставить фазу открытой до полного подтверждения оракула в CI.

Откат: удалить `NAR-4.9.md` и добавленный в `phases.md` блок вердикта; критерии, код, данные и проверки останутся нетронутыми.
