# NAR-2.17 — отчёт выполнения

Дата: 2026-10-25. Ветка: `arena/e0e21a1e-narthex`.

## Реализация

- Добавлен `scripts/check-pack-boundary.mts`: офлайн-проверка AST для всех TypeScript/JavaScript-файлов в `src/core/**`. Зарегистрированные ID читаются из `packs/registry.json`; проверка выявляет сравнения и управляющие условия с зарегистрированным ID, а также статические, динамические и CommonJS-импорты из `packs/**`. Для каждого нарушения выводятся путь и строка. Сканер не содержит исключений по именам файлов или каталогов, а вывод сортируется детерминированно.
- Команда `npm run check:pack-boundary` добавлена в `package.json` и включена последним этапом в `npm run check:contracts` после существующих контрактов и `check:packs`.
- При каждом запуске создаются, проверяются и удаляются четыре временные фикстуры: запрещённая ветка по ID и импорт из `packs/**` должны завершиться кодом 1 с точным путём/строкой; фильтр по `entry.pack` в пробе и строковый диагностический литерал должны завершиться кодом 0.
- Две прежние grep-команды в `scripts/pack-move-probe.mts` сохранены как видимые диагностики. Их exit code и совпадения печатаются, но больше не блокируют probe; структурные и API-проверки probe сохранены.
- Добавлена инструкция `docs/guides/nar-2.17-pack-boundary.md`. Исходники `src/core/**`, реестр паков и содержимое паков не менялись.

## Проверки и результаты

| Команда | Результат |
|---|---|
| `npm run check:pack-boundary` | rc=0; все четыре фикстуры дали ожидаемые результаты; production scan: `25 source files; no pack-ID branches or imports from packs/**` |
| `npm run check:contracts` | rc=0; `контракты согласованы: 41 проверок`, `check:packs passed`, затем `check:pack-boundary passed` |
| `npm run build` | rc=0; TypeScript build прошёл, Vite: `✓ 1421 modules transformed`, `✓ built in 2.14s` |
| `npm run check:guide` | rc=0; `6 команд (исходники, bundle, распакованный kit); explain=28; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10` |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; `10 сцен · 8 локаций · 6 диалогов · 21 узлов ink`; ошибок 0, предупреждений 8; seed'ов 5, все исходы — смерть; покрытие 6/10 |
| `npm run probe:pack-move` | rc=0; `PACK_MOVE_PROBE passed`; обе старые grep-диагностики напечатали `exit=1 matches=0`, не блокируя probe |
| `npm run probe:fmv-passport` | rc=0; `FMV_PASSPORT_PROBE passed` |
| `npm run smoke:pack-panels` | rc=0; `PACK_PANELS_SMOKE passed` |
| `npx oxlint scripts/check-pack-boundary.mts scripts/pack-move-probe.mts` | rc=0; 0 warnings, 0 errors |
| `npx tsc --ignoreConfig --noEmit --target ES2023 --module ESNext --moduleResolution Bundler --types node --skipLibCheck scripts/check-pack-boundary.mts scripts/pack-move-probe.mts` | rc=0; диагностик нет |
| `git diff --check` | rc=0 |

Фрагмент вывода четырёх фикстур:

```text
fixture (a) branch on pack ID in src/core: PASS — rc=1, src/core/fixture-branch.ts:1
fixture (b) entry.pack filter in scripts probe: PASS — rc=0
fixture (c) registry diagnostic string literal: PASS — rc=0
fixture (d) import from packs/** in src/core: PASS — rc=1, src/core/fixture-import.ts:1
✓ core pack boundary: 25 source files; no pack-ID branches or imports from packs/**
check:pack-boundary passed
```

Production CF-play проверка сохранила известные восемь предупреждений `flag_written_never_read`; ошибок нет. Полный `npm run build` пересоздал `public/ai/campaign-audit.mjs`; сгенерированное изменение восстановлено, в diff оставлены только файлы реализации, guide и этот отчёт.

Существенных неоднозначностей, требующих отдельной записи в `docs/decisions/NAR-2.17.md`, не осталось.
