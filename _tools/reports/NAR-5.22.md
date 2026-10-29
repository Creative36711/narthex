# NAR-5.22 — браузерный артефакт прохождения state-ui

**Цель:** заменить неподтверждённое словами свидетельство из NAR-5.5 воспроизводимой пробой настоящего браузера, которая играет `stone-tablet-siege` до результата, сохраняет текстовый лог и кадр финала.

- Dispatch: `4086f0cf-5705-81a1-bfe5-ffa1f219931a`.
- Run: `babb7dfe-a818-4c7f-84ed-eeead20fbe1b`.
- Кампания: `public/campaigns/stone-tablet-siege/`; source project указывает `kind: state-ui`.
- **Допущение:** внутренний fixture остаётся вне постоянного каталога; проба временно подменяет только HTTP-ответ `/campaigns/index.json`, чтобы реальный player мог его открыть. Это не изменяет публикацию или игровые данные; обратный вариант — убрать route intercept и запускать приложение только с опубликованным индексом.

## Изменение пробы

`packs/state-ui/probe.mts` сохраняет проверки state-machine, карт/колод и auto-battle. Последняя часть запускает `cf-play check` именно на `public/campaigns/stone-tablet-siege`, затем поднимает Vite на временном локальном порту, открывает приложение в Chromium и делает три пользовательских выбора. Щит (2) → Щит (1) → Выпад (0) приводит к `ending_draw`. `cf-play` отмечает structural runtime seam `narrative.sim`; он не используется как доказательство прохождения. Probe сверяет, что source project принадлежит `state-ui`, затем проверяет финал именно интерактивного браузерного маршрута, отсутствие page errors, делает PNG после появления `.end-overlay` и записывает лог. `npm run probe:state-ui` оставлен без изменения.

## Сохранённые артефакты

- Текстовый лог полного реального прогона: [`NAR-5.22-state-ui-browser.log`](NAR-5.22-state-ui-browser.log).
- Снимок экрана исхода `ending_draw` («Достойный соперник»): [`NAR-5.22-state-ui-ending.png`](NAR-5.22-state-ui-ending.png), PNG 1440×900, 604684 байт.
- Обе ссылки добавлены в утверждение о браузерном пути в [NAR-5.5](NAR-5.5.md) и в пункт 1 таблицы «Вердикт NAR-5» в [`docs/phases.md`](../../docs/phases.md).

Лог сообщает: target `public/campaigns/stone-tablet-siege`, data pack `state-ui`, Chromium `131.0.6778.0`, раундовые выборы, `ending id: ending_draw`, `page errors: 0`, `console errors: 0`, `result: PASS`. PNG записан после подтверждения этого финального экрана.

## Проверки

| Команда / проверка | Код | Результат |
|---|---:|---|
| `npm run probe:state-ui` | **0** | Existing data/card checks passed; real-player target printed as `public/campaigns/stone-tablet-siege`, data pack `state-ui`; browser ended `ending_draw`; both artifact paths printed; `STATE_UI_PROBE passed`. |
| `npm run check:contracts` | **0** | 46 contract checks passed; its nested pack, pack-boundary, campaign-format, schema-freeze, browser-gate, and media gates also passed. |
| `npm run check:packs` | **0** | All four package manifests, schemas, registry, and boundary fixtures passed. |
| `npm run check:pack-boundary` | **0** | 37 core source files; no pack-ID branches or imports from `packs/**`. |
| `git diff -- src/core` | **0 changed lines** | No core files are in the task scope. |
| PNG header/size check | **0** | Valid PNG signature and IHDR: 1440×900; 602356 bytes. |

## Инварианты

- Изменены только `packs/state-ui/probe.mts`, две нужные строки документации, отчёты и два артефакта. `package.json`, игровые данные, state-ui runtime-код и `src/core/**` не менялись.
- `git diff -- src/core` пуст; `npm run check:pack-boundary` зелёный.
- Проба использует тот же `npm run probe:state-ui`; отрицательные проверки и существующие state-ui проверки сохранены.
