# NAR-5.13 · ADR 0016: граница ядра для строки реестра возможностей

Дата: 2026-10-28
Тип: Architect · решение записано как ADR `proposed`

## Что сделано

Создан [ADR 0016](../docs/decisions/0016-capability-registry-boundary.md) со статусом
`proposed`: он называет противоречие, из-за которого встал пак `state-ui`, приводит
обе цитаты ТЗ дословно, разбирает три варианта с последствиями и содержит
рекомендацию Архитектора. Код, данные и контракты не менялись.

## Находка

| Что | Где | Почему важно |
|---|---|---|
| `state-machine` в статусе `planned` | `docs/contracts/caps.json:43` | контрактная копия реестра |
| та же строка литералом | `src/core/caps.ts:32` | рантайм-копия; `registriesMatch` (`scripts/contracts-check.mts:70-87`) сравнивает копии по семи полям |
| `probe` обязан меняться вместе со статусом | `scripts/contracts-check.mts:93-100` | у `experimental` проба непустая, у `planned` — ровно `null` |
| проба обязана быть npm-скриптом | `scripts/contracts-check.mts:101-103` | скрипта `probe:state-ui` в `package.json` **нет** — это третий файл, который требует перевод статуса |
| проект не может включать `planned`-возможность | `scripts/contracts-check.mts:151-160`, `src/core/caps.ts:77-86` | без перевода статуса игра на `state-ui` не запускается |

Замеры (в памяти, без правок файлов): перевод только `caps.json` даёт расхождение
реестров; добавление `probe: state-ui` без скрипта добавляет вторую ошибку; оба
файла согласованно — зелёный результат. Отдельный замер `check:pack-boundary` на
временной фикстуре: таблица `CAPABILITY_REGISTRY` с `"pack": "state-ui"` при
`state-ui` в `packs/registry.json` даёт `rc=0`, а ветвление `pack === 'state-ui'`
в `src/core` даёт `rc=1` и две находки. То есть гейт шва семантический, а оракул
«0 строк» — текстовый, и они расходятся именно на строке данных.

## Три варианта — по строке

- **A. Синхронизировать реестры внутри 5.3/5.4** — три файла (`caps.json:43`, `caps.ts:32`, скрипт в `package.json`) плюс узкая поправка к оракулу §1 п.2: 0 строк остаётся правилом, кроме строк таблицы `CAPABILITY_REGISTRY`, перечисленных в PR; обе копии реестра остаются независимыми, оба гейта остаются содержательными.
- **B. Один источник в данных** — отдельная карточка Kernel до 5.3 генерирует `CAPABILITY_REGISTRY` из `docs/contracts/caps.json`, после чего статус меняется одним файлом; цена — шаг сборки, и equality-проверка `registriesMatch` превращается в тавтологию, её приходится заменять гейтом «перегенерируй и покажи пустой diff».
- **C. Статус не двигать** — 5.3–5.4 дают честные 0 строк в `src/core/**`, но `state-machine` остаётся `planned`, поэтому проект не может её включить (семантика `projectProblems`) и оракул §1 п.1 «игра на `state-ui` играется от начала до конца» в фазе 4 не достигается без отдельной карточки перевода статуса.

Рекомендация — **A**: минимальная, обратимая, не ослабляет гейты и совпадает с
текстом самой карточки 5.3, который называет оба файла реестра.

## Вывод `check:decisions`

```text
> narthex@0.9.0 check:decisions
> tsx scripts/check-decisions.mts

fixture (a) decision without Статус: remains valid: PASS — rc=0
fixture (b) unsupported status rejected: PASS — rc=1
fixture (c) accepted without Дата решения rejected: PASS — rc=1
fixture (d) rejected without Решил rejected: PASS — rc=1
fixture (e) proposed lists date and age without failing: PASS — rc=0, date=2026-10-20, age=5 days
fixture (f) proposed without date remains informational: PASS — rc=0, date=unknown, age=unknown
decision status check: 43 files; statusless=31; proposed=1; accepted=11; rejected=0; superseded=0
proposed decisions (informational; never fail the check):
  docs/decisions/0016-capability-registry-boundary.md — proposed; date=2026-10-28; age=0 days
check:decisions passed
```

`rc=0`. Проверка не требует конкретного статуса: `proposed` только печатается в
информационном списке, обязательные метаданные (`Дата решения`, `Решил`)
требуются лишь для `accepted`/`rejected`.

## Проверки

| Команда | Результат |
|---|---|
| `npm run check:decisions` | rc=0; 43 файла, `proposed=1` (ADR 0016) |
| `npm run check:contracts` | rc=0; 42 проверки контрактов; `check:pack-boundary` — 37 файлов ядра, находок нет; `check:decisions` внутри — зелёный |
| `git diff --check` | rc=0 |

`check:schema-freeze` внутри `check:contracts` по-прежнему сообщает, что формат v2
не заморожен, — это ожидаемое состояние до карточки 5.10/5.11, к этой задаче
отношения не имеет.

## Границы карточки

`src/core/**` — 0 строк, `docs/contracts/**` — 0 строк, `packs/**` — 0 строк,
`public/campaigns/**` и `package.json` — 0 строк. Диф состоит только из:

- `docs/decisions/0016-capability-registry-boundary.md` (новый);
- `_tools/reports/NAR-5.13.md` (этот отчёт).

## Допущение

Допущение: ADR создаётся по пути из Scope карточки (`docs/decisions/`), хотя
действующие ADR 0001–0015 лежат в `docs/contracts/adr/`; три строки
`неясно / решил / откат` записаны в конце ADR, а не отдельным журналом
`docs/decisions/NAR-5.13.md`, чтобы диф остался из двух файлов, как требует
оракул п.4.

## Побочная находка (вне Scope, не исправлялась)

`docs/contracts/examples/project.state-ui.json` и `pack.state-ui.json`,
добавленные карточкой 5.2, не читает ни один скрипт: `scripts/contracts-check.mts`
перечисляет примеры поимённо (строки 288–333), и этих имён в списке нет. Замер
той же семантики: пример проекта даёт две ошибки — «возможность `state-machine` в
статусе `planned`, проект не может её включать» и то же для `cards`; после
перевода обеих возможностей в `experimental` ошибок нет. Значит `check:contracts`
зелен не потому, что пример валиден, а потому, что он не проверяется. Это дефект
покрытия 5.2/5.6; здесь он только записан, правки не вносились.
