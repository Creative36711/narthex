# NAR-5.11 — Машинная граница заморозки format v2

## Результат

Манифест `docs/contracts/format-v2.freeze.json` создан только командой `npm run schema:freeze`; генератор `scripts/schema-freeze.mts` и `package.json` не менялись. Снимок от `2026-10-28` содержит 22 пути полей `project.schema.json` и 20 путей полей `pack.schema.json` (42 всего).

## Проверки

- `npm run schema:freeze` — **rc=0**; «Манифест заморозки записан: 42 полей в 2 схемах.»
- `npm run check:schema-freeze` — **rc=0**; проверено 42 поля, 0 добавлений относительно снимка, 0 нарушений; напечатано «Формат v2: замороженные поля на месте.»
- `npm run check:contracts` — **rc=0**; в состав команды уже входит `npm run check:schema-freeze`.
- `npx tsc -b` — **rc=0**.

## Негативный контроль

Во временной копии в `/tmp` удалено замороженное поле `kind` из `project.schema.json`; проверка `tsx scripts/schema-freeze.mts` вернула **rc=1** и назвала именно его: `project.schema.json: замороженное поле «kind» исчезло или переименовано`. Временная копия удалена после проверки; в рабочем дереве её следов нет.

## Аддитивный контроль

В отдельной временной копии добавлено новое необязательное поле `test_optional_added` в `project.schema.json`. Проверка вернула **rc=0** и сообщила: «добавлено с тех пор 1, нарушений 0». Временная копия удалена.

## Границы изменений

Изменены только `docs/contracts/format-v2.freeze.json` и этот отчёт. `scripts/schema-freeze.mts`, обе схемы, `caps.json`, `examples/**`, `docs/contracts/format-v2.md`, ADR 0015, `src/core/**`, `packs/**` и `public/**` не менялись.
