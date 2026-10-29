# NAR-5.15 — Примеры state-ui под гейтом контрактов

## Изменение

В список именованных примеров `scripts/contracts-check.mts` добавлены `pack.state-ui.json` и `project.state-ui.json`. Оба проходят существующие проверки схемы и семантики (`packProblems` / `projectProblems`); сами функции и `registriesMatch` не менялись. На момент проверки `state-machine` и `cards` имеют статус `experimental`.

## Положительный прогон

`npm run check:contracts` — **rc=0**. В частности:

```text
пример пака state-ui (pack.state-ui.json)
  ✓ проходит схему
  ✓ проходит семантику

пример проекта state-ui (project.state-ui.json)
  ✓ проходит схему
  ✓ проходит семантику
```

## Негативный контроль

В отдельной временной копии репозитория в `/tmp` статус `state-machine` в `docs/contracts/caps.json` временно изменён с `experimental` на `planned`; проверялся тот же `scripts/contracts-check.mts`. `npm run check:contracts` дал **rc=1** и включил целевую ошибку по проектному примеру:

```text
пример проекта state-ui (project.state-ui.json)
  ✓ проходит схему
  ✗ проходит семантику — возможность state-machine в статусе planned, проект не может её включать
```

В том прогоне также ожидаемо сработали проверки совпадения `caps.json` с runtime-реестром и метаданных возможности: отрицательный контроль менял только временную копию `caps.json`. Временная копия удалена; в рабочем дереве `caps.json` и другие файлы `docs/contracts/**` не менялись.

## Границы изменений

Рабочий diff содержит только `scripts/contracts-check.mts` и этот отчёт. `projectProblems`, `registriesMatch`, `src/core/**`, `docs/contracts/**`, `packs/**` и `public/campaigns/**` не менялись.
