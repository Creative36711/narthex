# NAR-5.2 · Контракты формата v2: сверка примеров с оракулом и добор пробелов

Дата: 2026-10-28

## Сверка пунктов оракула §1 (3–5)

| Пункт оракула | Артефакт | Команда | Вывод |
|---|---|---|---|
| п.3 — `cap_options` в проекте с кодом в швах | `docs/contracts/examples/project.code-mode.json` | `npm run check:contracts` | ✓ проходит схему и семантику; `combat: {mode: code, version: 2}`, `quests: {mode: off}` |
| п.4 — локаль `de` | `docs/contracts/examples/locales.de.json` | `npm run check:contracts` | ✓ `schema: 1`, `language: de`, ключи — стабильные ID, у каждой строки хэш источника |
| п.5 — негативный пример `cap: off` для обязательного жанра | `docs/contracts/examples/invalid/project.cap-off-required.json` | `npm run check:contracts` | ✗ отклонён (семантика) — `narrative` выключен, но тип `narrative` требует его; `check:contracts` завершается с rc=0, так как negativa ожидаемо отвергнута |

## Добор покрытия

Добавлены два новых примера (только новые файлы, существующие правила не ослаблены, проверок не удалено):

1. `docs/contracts/examples/project.state-ui.json` — пример проекта с `kind: state-ui`, `cap_options` (`state-machine: code/1`, `cards: core`), код в шве (`code.entry`).
2. `docs/contracts/examples/pack.state-ui.json` — пример пака `state-ui` с `provides.seams` (`on_turn_begin` sim, `render_card` view), панелями, валидаторами и пробой.

## Результат проверки

`npm run check:contracts` — **rc=0**, **42 проверок** (как до добора, не уменьшилось).

`git diff --stat` — только `docs/contracts/examples/**` и `_tools/reports/NAR-5.2.md`; схемы ядра (`docs/contracts/*.schema.json` без изменений правил) и `packs/**` не тронуты.
