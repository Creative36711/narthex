# NAR-2.20 — отчёт гейта размера модулей

Дата: 2026-10-26. Рабочая ветка: `arena/7f08fc71-narthex`.

## Реализация

- Добавлен `scripts/check-module-size.mts` и `npm run check:module-size`. Скрипт читает изменения относительно `origin/main` (и неотслеживаемые файлы) в `src/**` и `packs/**`, измеряет число строк модулей-кода и проверяет изменённые/созданные модули по константе `MODULE_LIMIT = 450`. Фасад `src/core/engine.ts` проверяется при каждом запуске по `FACADE_LIMIT = 600`. Пороги не берутся из окружения или конфигурации.
- Непереписанные внешние долги печатаются отдельно и не блокируют несвязанные PR; если `combat.ts` или `savemigrate.ts` меняются, они попадают в обычную проверку лимита 450.
- Добавлена одна проверка регистрации команды в `scripts/contracts-check.mts`; `check:module-size` добавлен в `npm run check:contracts` после `check:decisions`.
- Добавлена краткая инструкция `docs/guides/nar-2.20-module-size.md`. Файлы `src/**`, `packs/**`, `public/**` не менялись.

## Проверки

| Команда | Результат |
|---|---|
| `npm run check:module-size` | rc=0; вывод содержит `limit=450 facade=600`; engine 594/600; внешний долг `combat.ts 1765`, `savemigrate.ts 788`; `check:module-size passed` |
| `npm run check:contracts` | rc=0; `контракты согласованы: 42 проверок`; `check:packs passed`; проверки границы и решений passed; затем `check:module-size passed` |
| `npm run build` | rc=0; TypeScript без ошибок; `✓ 1421 modules transformed`, `✓ built in 2.71s` |
| `npm run check:guide` | rc=0; руководство 268683/524288 байт; 6 команд, bundle и распакованный AI-kit проверены; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10 |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; 10 сцен, 8 локаций, 6 диалогов, 21 Ink; 0 ошибок, 8 прежних предупреждений; 5 seed'ов, покрытие 6/10 |
| `npx oxlint scripts/check-module-size.mts scripts/contracts-check.mts` | rc=0; 0 warnings, 0 errors |
| `npm run lint` | **rc=1 на базовых ошибках вне Scope:** 1484 warnings и 5 errors. Те же 5 errors были на чистом `origin/main` до реализации. Два React Hooks error — в сгенерированном `public/ai/campaign-audit.mjs`, три — в `src/player/DialogueOverlay.tsx`. Эти файлы запрещено менять карточкой; существующий lint-гейт не ослаблялся. |
| `git diff --check` | rc=0 |

Фактический вывод фикстур `check:module-size`:

```text
fixture (a) changed module 451 lines: PASS — rc=1, lines=451, limit=450
fixture (b) changed module 450 lines: PASS — rc=0, lines=450, limit=450
fixture (c) engine.ts 600 lines: PASS — rc=0, lines=600, limit=600
fixture (d) engine.ts 601 lines: PASS — rc=1, lines=601, limit=600
limit=450 facade=600
changed source modules=0
module src/core/engine.ts: 594/600 lines (facade)
external debt (non-blocking unless changed): src/core/combat.ts 1765; src/core/savemigrate.ts 788
check:module-size passed
```

`grep -nE '450|600' scripts/check-module-size.mts` находит обе константы; `grep -n 'process.env' scripts/check-module-size.mts` не находит совпадений. В `docs/guides/` всего 9 881 байт. `docs/ai-campaign-guide.md` и `public/ai/campaign-guide.md` остаются равными по 268683 байта.

Допущение: «модулем» для этого гейта считается файл исходного кода под `src/**` или `packs/**`, отличающийся от `origin/main`; line count считает логические строки, не добавляя пустую строку после завершающего newline. `engine.ts` проверяется независимо от списка изменений. Результат lint зафиксирован, а не скрыт: успешный `npm run lint` потребовал бы исправлений в двух запрещённых деревьях либо ослабления существующего гейта.
