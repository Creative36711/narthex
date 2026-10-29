# NAR-3.7 — строгий браузерный экзамен Ash и Adventure

- **Обновлено:** 2026-10-27 после D-076.
- **Текущий экзамен:** `npm run playthrough:exam -- http://127.0.0.1:4173 out/play-exam`.
- **Браузер:** Chromium 131.0.6778.0.
- **Итог:** **PASS**, rc `0`; 2 пакета, 20 шагов, 0 находок.
- **История PR:** исходный NAR-3.7 — [#79](https://github.com/Creative36711/narthex/pull/79), merged; политика D-076 — [#80](https://github.com/Creative36711/narthex/pull/80), merged 2026-10-26.
- **CI NAR-3.7:** [run 40390859527](https://github.com/Creative36711/narthex/actions/runs/40390859527) — `screenshots: pass`; artifact [`visual-report`](https://github.com/Creative36711/narthex/actions/runs/40390859527/artifacts/12684830910).

## Итог строгого экзамена после D-076

| Пак | Шаги | pageerror | Экраны ошибки | Битые `<img>` | Пустые `src` | Raw NPC ID | Пустой каталог на старте | Объявления отсутствий | Другие image findings | Находки | Финал |
|---|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---|
| `ash-of-caerden` | 8 | 0 | 0 | 0 | 0 | 0 | нет | 27 | нет | 0 | `ending_ashes` |
| `ash-of-caerden-adventure` | 12 | 0 | 0 | 0 | 0 | 0 | нет | 27 | нет | 0 | `ending_gate_unlocked` |

Политика принадлежит фикстуре, а не маршруту: оба внутренних полигона объявляют по 27 путей через `known_absent_images` в `dev-fixture.json` (27 + 27). `scripts/visual/absence-policy.mjs` — общий источник для строгого экзамена, `check:dev-campaigns` и `smoke:absence-policy`. В этом запуске все 27 объявлений каждого пакета напечатаны с `path`, `status` и `content-type`; все получили ожидаемый SPA fallback `200` / `text/html`, что не считается успешно загруженным изображением. Объявленное отсутствие не является находкой; не объявленная кампанией ошибка и объявленный путь, который начинает отдаваться как `image/*`, остаются находками.

`console.error` не подавлялся: в ходе маршрутов записано 6 сообщений для Ash и 4 для Adventure. Причины загрузки остаются в консоли и отчёте; нейтральный фон не оставляет экран ошибки. На страницах нет сломанных или пустых `<img>`. Витринная кампания без внутреннего маркера остаётся строгой.

## Маршрут, финалы и размер модуля

Ash проходит реальный UI: выбор пакета, создание героя, стартовая сцена и диалог, карта, лесная локация и штатный итоговый экран **«Пепел принял ещё одного» / `ending_ashes`**. Для воспроизводимого маршрута harness использует фиксированный обычный seed и допустимые минимальные характеристики через штатные controls создания героя; кампания и боевая логика не меняются. Adventure достигает **`ending_gate_unlocked` / «Механизм ворот открыт»**.

`src/player/SceneScreen.tsx` в проверенном дереве — **414 строк из 450**, что подтверждено `check:module-size`. После D-076 код сцены уже вынесен в `SceneForeground`, `SceneNavigation`, `SceneIntroOverlay` и `ItemInteractDialog`; в NAR-3.8 повторное разбиение не понадобилось. Browser-oracles ниже прошли без изменений runtime-кода, поведения сцены или legacy oracle.

Кадры из первоначального PR #79 сохранены как исторические: [Ash — меню](./NAR-3.7-ash-home.png), [Ash — лес](./NAR-3.7-ash-forest.png), [Ash — финал](./NAR-3.7-ash-ending.png), [Adventure — меню](./NAR-3.7-adventure-home.png), [Adventure — диалог](./NAR-3.7-adventure-dialogue.png), [Adventure — финал](./NAR-3.7-adventure-ending.png). Текущий run создал отчёты и PNG в `out/play-exam/`; legacy run — в `out/play/`.

## Четыре старых feedback-smoke: до и после исправления селекторов

До правок каждый smoke сохранял прежнее число проверок, но падал на исходных путях/селекторах; после правок проверки читают фактические модули-владельцы. До добавления npm aliases baseline запускался по `npx tsx scripts/feedbackNN-smoke.mts`; повторная проверка выполнена через объявленные команды `npm run smoke:feedbackNN`.

| Smoke | До: rc | До: checks | До: failed | После: rc | После: checks | После: failed | Удалено checks |
|---|---:|---:|---:|---:|---:|---:|---:|
| `feedback16` | 1 | 15 | 2 | 0 | 15 | 0 | 0 |
| `feedback17` | 1 | 31 | 1 | 0 | 31 | 0 | 0 |
| `feedback25` | 1 | 63 | 6 | 0 | 63 | 0 | 0 |
| `feedback27` | 1 | 45 | 2 | 0 | 45 | 0 | 0 |

Исправлены только пути/селекторы и четыре команды `smoke:feedback16`, `smoke:feedback17`, `smoke:feedback25`, `smoke:feedback27` в `package.json`; количество проверок каждого smoke сохранено. Ни одно утверждение не удалялось и не ослаблялось.

## Historical mutation probe (initial NAR-3.7 / PR #79)

В исходном PR #79 временная копия кампаний Adventure получила несуществующую ссылку `assets/img/npc/nar37-missing-probe.png`. Строгий экзамен достиг `ending_gate_unlocked`, зарегистрировал неожиданный HTTP 404 как finding и вернул `1`; временная копия была удалена, рабочее дерево не менялось. Архивный вывод: [`NAR-3.7-mutation.stdout.txt`](./NAR-3.7-mutation.stdout.txt). Этот probe предшествует D-076; текущая policy отдельно проверена `smoke:absence-policy` и успешным экзаменом выше.

## Неизменённый legacy oracle

Запуск той же литеральной командой на production preview:

```text
$ npm run playthrough -- http://localhost:4173 out/play
✓ маршрут: 20 шагов, 0 находок
exit code: 0
```

Команда/скрипт legacy oracle не менялись. Строгий exam и legacy playthrough независимо завершились rc `0`.

## Проверки и базовые оракулы

| Проверка | Результат |
|---|---|
| `npx tsc -b` | rc `0` |
| `npm run check:contracts` | rc `0`; в том числе `check:module-size`, `check:dev-campaigns` и `smoke:absence-policy` |
| `npm run check:brand` | rc `0` |
| `npm run check:version` | rc `0` |
| `npm run smoke:core` | rc `0` |
| `npm run build` | rc `0` |
| `npm run check:mission` | rc `0`; 55/55 mission smokes, все 11 шагов зелёные |
| `npm run playthrough:exam -- http://127.0.0.1:4173 out/play-exam` | rc `0`; 2 пакета, 20 шагов, 0 находок; финалы `ending_ashes` и `ending_gate_unlocked` |
| `npm run playthrough -- http://localhost:4173 out/play` | rc `0`; 20 шагов, 0 находок |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc `0`; 10 сцен, 8 локаций, 6 диалогов, 21 Ink, 0 ошибок / 8 предупреждений |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure` | rc `0`; 10 сцен, 8 локаций, 6 диалогов, 21 Ink, 0 ошибок / 8 предупреждений |
| распакованный `__chronicle_ai__-kit.zip`: `cf-play check` по `examples/narrative` | rc `0`; 10 сцен, 8 локаций, 6 диалогов, 21 Ink, 0 ошибок / 8 предупреждений; временный каталог удалён |
| `npm run lint` | rc `1`; 5 ошибок — долг из PR #80, отложен как указано ниже |

## Долги, отмеченные в PR #80

| Долг PR #80 | Зафиксированное значение | Распоряжение |
|---|---:|---|
| `combat.ts` | 1 765 строк | **moved to NAR-3.9**; не менять в NAR-3.8 |
| `savemigrate.ts` | 788 строк | **moved to NAR-3.9**; не менять в NAR-3.8 |
| lint | 5 ошибок | **moved to NAR-3.9**; не расширять текущий scope |
| AI campaign guide | 268 683 / 524 288 байт | **done**; `check:guide` подтвердил размер ниже лимита с запасом 255 605 байт; руководство не менялось |

`check:module-size` считает `combat.ts` и `savemigrate.ts` отдельным внешним долгом; NAR-3.8 не менял эти файлы, lint baseline или руководство.

## Статические проверки и область NAR-3.8

- Поиск по старому идентификатору технической плашки во всём рабочем дереве — совпадений нет; устаревшая разметка не упоминается в актуальных файлах.
- `grep -R 'MutationObserver' src/` — совпадений нет.
- Поиск списка шести старых маршруто-зависимых путей в `_tools/reports/NAR-3.7.md` и `docs/decisions/NAR-3.7.md` — совпадений нет.
- Оба NAR-3.7 документа описывают `known_absent_images` (27 + 27) и называют `scripts/visual/absence-policy.mjs`.

NAR-3.8 изменил только smoke source paths/selectors, `package.json` aliases, этот отчёт и decision records. Кампании, `known_absent_images`, `public/campaigns/index.json`, `assets/img/**`, `src/player/SceneScreen.tsx`, combat/save modules, policy implementation, порог размера и legacy oracle не менялись. Фаза 3 не открывается.

## CI и закрытие фазы 2

Workflow [`.github/workflows/visual.yml`](../../.github/workflows/visual.yml) запускает обе браузерные проверки и сохраняет `out/visual` в CI artifact `visual-report`. Run [40390859527](https://github.com/Creative36711/narthex/actions/runs/40390859527) для исходного PR #79 завершился `success`; job `screenshots` — `pass`; артефакт: [`visual-report`](https://github.com/Creative36711/narthex/actions/runs/40390859527/artifacts/12684830910). D-076 и переход на `known_absent_images` были приняты отдельно в PR #80; полный текущий evidence приведён выше. Фаза 3 остаётся закрытой.
