# NAR-2.19 — отчёт проверки гейтов

Дата: 2026-10-25. Рабочая ветка: `arena/bedf1be9-narthex`.

## Изменения

- Добавлен `scripts/check-decisions.mts` и команда `npm run check:decisions`; она включена в `npm run check:contracts`. Все Markdown-журналы `docs/decisions/*.md` без `Статус:` остаются допустимыми. Если статус указан, разрешены только `proposed`, `accepted`, `rejected`, `superseded`; для `accepted` и `rejected` обязательны корректная `Дата решения: YYYY-MM-DD` и непустое `Решил:`. `proposed` информационен и выводится с датой/возрастом, если дата есть.
- В `scripts/check-guide.mts` удалены проверки, закреплявшие статус `proposed`, предложение `294 912` и текст о действии `71 680`. Вместо них функция проверяет UTF-8 размер обоих зеркал руководства с реальным лимитом `524288` байт и имеет фикстуры для `268683` и `524289` байт. Побайтная сверка зеркал и прежние проверки CLI, bundle и распакованного AI-kit сохранены.
- В `docs/decisions/NAR-2.15.md` зафиксировано решение Мастера: `accepted`, дата `2026-10-25`, решивший — Мастер; предложение `294 912` отклонено, `71 680` не было гейтом и отменено, предел `524288` действует, превышение требует разбиения по темам, новый предел — только отдельным ADR.
- Добавлены `docs/guides/nar-2.19-gates.md` и трёхстрочная запись `docs/decisions/NAR-2.19.md` о расчёте возраста. `src/**`, `packs/**`, оба файла содержания руководства и оракул кампании не менялись.

## Проверки и коды возврата

| Команда | Результат |
|---|---|
| `npm run check:decisions` | rc=0; фикстуры статусов прошли; из 22 журналов 20 без статуса (19 прежних плюс эта трёхстрочная запись), 1 `proposed`, 1 `accepted`; `check:decisions passed` |
| `npm run check:guide` | rc=0; `current=268683 bytes; mirror=268683 bytes; limit=524288 bytes`; шесть команд, bundle и распакованный kit проверены |
| `npm run check:contracts` | rc=0; `контракты согласованы: 41 проверок`, `check:packs passed`, `check:pack-boundary passed`, `check:decisions passed` |
| `npm run build` | rc=0; `✓ 1421 modules transformed`, `✓ built in 2.40s`; TypeScript build без ошибок |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; 10 сцен, 8 локаций, 6 диалогов, 21 узел Ink; 0 ошибок, 8 прежних предупреждений; 5 seed'ов, покрытие 6/10 |
| `npx oxlint scripts/check-decisions.mts scripts/check-guide.mts` | rc=0; 0 warnings, 0 errors |
| `git diff --check` | rc=0 |

Фактический фрагмент фикстур `check:decisions`:

```text
fixture (a) decision without Статус: remains valid: PASS — rc=0
fixture (b) unsupported status rejected: PASS — rc=1
fixture (c) accepted without Дата решения rejected: PASS — rc=1
fixture (d) rejected without Решил rejected: PASS — rc=1
fixture (e) proposed lists date and age without failing: PASS — rc=0, date=2026-10-20, age=5 days
fixture (f) proposed without date remains informational: PASS — rc=0, date=unknown, age=unknown
decision status check: 22 files; statusless=20; proposed=1; accepted=1; rejected=0; superseded=0
  docs/decisions/NAR-2.14.md — proposed; date=2026-10-25; age=0 days
check:decisions passed
```

Фактический фрагмент фикстур и измерения в `check:guide`:

```text
fixture (a) guide size 268683: PASS — within limit 524288 bytes
fixture (b) guide size 524289: PASS — error includes actual 524289 and limit 524288 bytes
✓ campaign guide size: current=268683 bytes; mirror=268683 bytes; limit=524288 bytes
✓ check:guide: 6 команд (исходники, bundle, распакованный kit); explain=28; эталон 10/8/6/21, 0/8, 5 смертей, покрытие 6/10
```

Дополнительные точные проверки: `grep -n 'Статус: proposed' scripts/check-guide.mts` и `grep -rn '71 680' scripts` не нашли совпадений (каждый grep вернул 1); `cmp -s docs/ai-campaign-guide.md public/ai/campaign-guide.md` вернул 0; `wc -c` показал `268683` байта для каждого зеркала.

Допущение: возраст `proposed` считается разницей календарных дат UTC; при отсутствующей или неверной дате запись остаётся неблокирующей и выводится как `unknown`. Открытый `docs/decisions/NAR-2.14.md` оставлен `proposed` по умолчанию и показывается проверкой; вопрос Мастеру вынесен в поле `question` маркера.
