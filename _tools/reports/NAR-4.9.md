# NAR-4.9 — вердикт по закрытию фазы 3: не закрыта

- Дата проверки: **2026-10-27**.
- Dispatch: `4066f0cf-5705-81f7-8bf6-e7c605f152eb`.
- Run: `613ecf90-6e38-4322-a9c5-eeebb89758fc`.
- База: `origin/main` — `b8ca882a579f7e6cd707a132db2013594b045eba` (PR #94).

## Старт и ветка

Перед правками `git fetch origin main` завершился успешно, worktree был чистым.
`git merge-base HEAD origin/main` оказался пустым из-за shallow snapshot, поэтому
текущая закреплённая ветка Arena была сброшена на `origin/main`; после сброса
`HEAD` и `origin/main` совпали на `b8ca882`. Ветка сессии оставлена
`arena/35b377be-narthex`; ветка вне Arena не создавалась.

## Решение

**Фаза 3 не закрыта.** Дата выше — дата аудита, не дата закрытия. Оракул
NAR-4 не переписывался и не ослаблялся. На момент проверки есть успешные
локальные/CI-доказательства по отдельным пунктам, но визуальный CI не проверяет
полную пару эталонных проектов командой `cf-play cycles`, не запускает
`npm run check:mission`, а измерение бюджета кадра не является CI-шагом.
По правилу карточки незакрытый пункт означает, что записывать закрытие нельзя.
Принятое решение находится в [`docs/decisions/NAR-4.9.md`](../../docs/decisions/NAR-4.9.md).

## CI-свидетель и фактический состав workflow

[Visual run #40537871691](https://github.com/Creative36711/narthex/actions/runs/40537871691)
запущен для PR #94 на head `2ac69ac3d2feb378d356f324967a5e178b90fd65` и
завершился `success` до merge. Список шагов GitHub Actions показывает успешные
TypeScript (`npx tsc -b`), «Детерминизм циклов» (`npm run check:determinism`),
контракты/browser gate, 55 mission-smokes, оба `cf-play check`, сборку и
браузерную проверку.

При этом [.github/workflows/visual.yml](../../.github/workflows/visual.yml)
вызывает `npm run smoke:mission`, а не `npm run check:mission`; она также не
вызывает `node public/ai/cf-play.mjs cycles`. Два `cf-play check` в workflow —
это `ash-of-caerden` и `ash-of-caerden-adventure`, оба проекта `turn`. Локальный
`check:mission rc=0` из отчёта NAR-4.6 не является запуском этого wrapper в CI.

## Матрица оракула

| № | Критерий | Результат и источник | Подтверждение в CI |
|---:|---|---|---|
| 1 | Два эталонных проекта, по одному на рантайм, детерминированы по seed | [NAR-4.3](NAR-4.3.md) содержит локальные повторные прогоны Ash и стресс-нагрузки; [NAR-4.5](NAR-4.5.md) содержит локальный `cf-play cycles`: Ash (`turn`) и `realtime-wall-zone` (`realtime`), 2/2 проекта прошли маршрут. Повторяемость seed именно у этой пары вместе в CI не проверена. В run #40537871691 штатный `cf-play check` проверяет Ash и Adventure, оба `turn`; `cf-play cycles` отсутствует. | **Нет** — доказательства pair-cycles локальные, CI проверяет другую пару `cf-play check`. |
| 2 | Равенство браузера и `cf-play` — 10/10 | Run #40537871691: visual-шаг `npm run check:determinism` завершился успешно. Gate в `scripts/check-parity.mts` требует ровно 5 seeds × 2 runtimes, ноль несовпадений и стабильные повторы; pass возможен только при 10/10. Таблица fingerprints и повторов сохранена в [NAR-4.6](NAR-4.6.md). Проект этого parity gate — общая inline fixture `nar-4.4-determinism-fixture`, а не два отдельных эталонных проекта. | **Да** — run #40537871691; 10/10 следует из pass-условия gate. |
| 3 | `cf-play` проходит оба проекта без ветвлений по рантайму | Принятый [ADR 0014](../../docs/contracts/adr/0014-realtime-project-fixture.md) задаёт общий путь; [NAR-4.5](NAR-4.5.md) фиксирует локальное `cf-play cycles rc=0` и отсутствие найденных `if/switch` по `turn`/`realtime` (`[]`). В visual run нет вызова цикла или статической проверки этого критерия. | **Нет** — ADR и локальный отчёт есть, CI-проверки нет. |
| 4 | Медиана и p95 бюджета кадра, с машиной | [NAR-4.3](NAR-4.3.md), локальная проба: `real-campaign` — **0.158527 / 0.227084 мс**; `real-engine-20ms-ticks` — **0.186985 / 0.251383 мс** (медиана/p95). Машина, записанная в исходном отчёте: Linux x64, Intel(R) Xeon(R) @ 2.60 GHz, 2 видимых логических CPU, Node v22.22.3. Эти workloads не являются более поздней fixture `realtime-wall-zone`; в visual workflow бюджетная проба не запускается. | **Нет** — замер записан локально и не на эталонной realtime-fixture. |
| 5 | `npm run lint` — rc 0 | [NAR-4.8](NAR-4.8.md): локально **rc=0, 1505 warnings, 0 errors**; точные версии lock-файла — Node 22.22.3, React/React DOM 19.3.0, Oxlint 1.86.0, TypeScript 6.0.3. Исторический отчёт NAR-4.8 не назвал машину. Для воспроизводимой атрибуции результат повторно проверен в NAR-4.9 после `npm ci`: **rc=0, 1505 warnings, 0 errors**, Linux `6.1.158+` x86_64, Intel Xeon @ 2.60 GHz, 2 logical CPUs; фактически разрешённые версии совпали с lock-файлом. Это новая локальная проверка текущего дерева, не ретроспективное утверждение о машине NAR-4.8. В `visual.yml` шага lint нет. | **Локальная проверка — да; CI-шаг отсутствует** (как и указано в карточке). |
| 6 | `check:mission` проверяет два рантайма; удалённых проверок 0 | [NAR-4.6](NAR-4.6.md) сообщает локальный `npm run check:mission rc=0`, parity для `turn` и `realtime`, 55/55 smoke и два сохранённых turn-reference checks. Visual CI отдельно запускает `check:determinism`, `smoke:mission` и `cf-play check`, но не wrapper `check:mission` и не `cf-play cycles`. CI подтверждает 55/55; список smoke-команд не менялся. В NAR-4.9 код и проверки не менялись. | **Полный критерий — нет** (в CI нет команды/wrapper и цикла двух reference projects); **удалённых проверок 0**. |

### Вывод по матрице

Успех `check:determinism` в CI — сильное доказательство 10/10 parity для
выделенной fixture, но он не заменяет отдельный `cf-play cycles` на паре
эталонных проектов. Аналогично, успешные шаги `smoke:mission` и
`check:determinism` по отдельности не являются запуском `npm run check:mission`.
Бюджет кадра имеет численную локальную запись, но CI-источника у этих чисел
нет. Следовательно, оракул не подтверждён целиком — **Фаза 3 остаётся открытой**.

## Сохранение границ

- В `docs/phases.md` добавлен только вердикт и таблица доказательств внутри раздела Фазы 3; исходные критерии, раздел Фазы 2 и раздел Фазы 4 не редактировались.
- **Удалённых проверок 0**; новые проверки или ослабления порогов не вносились.
- Фаза 4 не объявляется начатой.
- Код, скрипты, workflow, кампании, fixtures, контракты и долги не менялись.
- `docs/decisions/NAR-4.md` не заменялся: он уже содержит принятое решение по Executor из NAR-4.2. Для вердикта создан `docs/decisions/NAR-4.9.md`.

## Связанные карточки, PR и отчёты

- ТЗ миссии: [docs/agents/tz-nar-4.md](../../docs/agents/tz-nar-4.md).
- [PR #86](https://github.com/Creative36711/narthex/pull/86), [#87](https://github.com/Creative36711/narthex/pull/87), [#88](https://github.com/Creative36711/narthex/pull/88), [#89](https://github.com/Creative36711/narthex/pull/89), [#90](https://github.com/Creative36711/narthex/pull/90), [#91](https://github.com/Creative36711/narthex/pull/91), [#92](https://github.com/Creative36711/narthex/pull/92), [#93](https://github.com/Creative36711/narthex/pull/93), [#94](https://github.com/Creative36711/narthex/pull/94) — все слиты в `main`.
- Существующие отчёты: [NAR-4.2](NAR-4.2.md), [NAR-4.3](NAR-4.3.md), [NAR-4.4](NAR-4.4.md), [NAR-4.5](NAR-4.5.md), [NAR-4.6](NAR-4.6.md), [NAR-4.7](NAR-4.7.md), [NAR-4.8](NAR-4.8.md). Отдельного `_tools/reports/NAR-4.1.md` в репозитории нет.
- Решение NAR-4.7: [docs/decisions/NAR-4.7.md](../../docs/decisions/NAR-4.7.md).

## Проверки NAR-4.9

| Команда | Результат |
|---|---|
| `npm ci` | rc=0; установлены зависимости по lock-файлу, tracked dependency-файлы не менялись |
| `npm run lint` | rc=0; 1505 warnings, 0 errors; детали среды — строка 5 матрицы |
| `npm run check:contracts` | rc=0; 42 contract checks и вся цепочка гейтов (packs, boundaries, decisions, module size, browser/dev campaign guards, formats, visibility/FMV/absence smokes) прошли |
| `git diff --check` | rc=0; ошибок пробелов нет |
