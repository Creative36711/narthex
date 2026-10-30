# D-072 · Браузер в песочнице обязателен: приёмка без прохождения недействительна

Статус: accepted
Дата: 2026-10-26
Дата решения: 2026-10-26
Решил: Мастер

## Неясно

26.10 миссия NAR-2 была закрыта с вердиктом «принять»: 21 карточка Accepted,
оракул зелёный, PR #42–#67 слиты. Приёмка при этом **не открывала игру в
браузере** — проверялись контракты, CLI (`cf-play explore`) и прямой вызов
симуляции пака. В отчёте появилась фраза «браузера в песочнице нет», хотя в
репозитории с 24.10 лежит [`docs/agents/browser.md`](../agents/browser.md),
где тем же автором записано: «Прошлый вывод был неверным… браузер в песочнице
работает, проверено: Chromium 131.0.6778.0».

Противоречие жило в трёх местах: шапка `scripts/visual/shots.mjs` («В
песочнице агента браузер не запускается»), таблица и заголовок «Слой 3 —
пиксели (в песочнице невозможно)» в `docs/agents/visual.md`, фраза «браузер
живёт в CI, а не в песочнице» там же. Агент читал их и делал ложный вывод.

Проверка в настоящем Chromium (26.10, `main e77c95e`) сразу нашла то, чего не
видно в CLI:

1. FMV-проект `public/campaigns/fmv-crossing` **роняет приложение**:
   `TypeError: Cannot read properties of undefined (reading 'x')` — в
   `SceneScreen.tsx` читается `nav.area.x`, а в FMV-сцене у элемента
   `navigation` нет `area`. Экран «Игра столкнулась с ошибкой».
2. 27 изображений сцен и портретов отсутствуют — это **намеренная фикстура**
   коммита `60a2da5` (полигон смоуков), но игрок видит «Фон сцены не
   загрузился» и битые `<img>`. `npm run audit:campaign` возвращает rc=1.
3. Пак `adventure` и пак `fmv` не имеют потребителей в `src/`: клики по сцене
   не порождают `adventure_click`, `<video>` на FMV-экране нет (`videos: 0`).
   `PackPanelWorkbench.tsx` про adventure не знает.

По правилу `docs/phases.md` («Фаза не закрывается, пока на её паке нет
играбельного проекта») фаза 2 закрыта быть не может.

## Решил

1. **Браузер в песочнице — факт, зафиксированный в оракуле.** Любая приёмка
   фазы, карточки с UI или миссии обязана содержать браузерное прохождение:
   PNG ключевых экранов, текст экрана, список ошибок страницы и консоли.
   `cf-play explore`, прямой вызов симуляции и чтение JSX заменой не являются.
2. **Введён воспроизводимый маршрут** `scripts/visual/playthrough.mjs`
   (`npm run playthrough`): меню → кампания → новый забег → создание героя →
   сцена → диалог → выбор реплики → переход, плюс отдельный проход по
   FMV-проекту. Пишет `out/play/report.json`, `report.md` и PNG каждого шага.
   Возвращает 1 при экране ошибки или `pageerror`, 2 — если браузер не поднялся.
3. **Введён страж** `scripts/check-browser-gate.mts`
   (`npm run check:browser-gate`, входит в `check:contracts`): запрещает
   возврат ложных формулировок про недоступный браузер и требует, чтобы
   `visual.yml` вызывал `playthrough.mjs`. Ложь теперь ловится машинно, а не
   надеждой на внимательность агента.
4. **Старые противоречивые тексты исправлены**: `shots.mjs`, `visual.md`,
   `browser.md` (стал правилом, а не рекомендацией), `sandbox.md`, `roles.md`,
   `phases.md`, `docs/agents/README.md`. Добавлена короткая памятка
   `docs/agents/sandbox-browser-note.md`.
5. **Немедленно починен краш FMV**: `area` добавлена в
   `scene_fmv_crossing.json`, а `migrateNavigation()` в `src/shared/migrate.ts`
   (173 строки, внутри лимита) получил защиту — зона без координат получает
   `area` на всю сцену до отрисовки. `SceneScreen.tsx` (внешний долг 639 строк)
   не тронут, чтобы не включать лимит `check:module-size`. Регрессия закрыта
   смоуком `npm run smoke:navigation-area` (3/3).
6. **Миссия NAR-2 не переоткрывается**: 21 карточка и слитый код остаются
   принятыми. Вместо этого открывается **миссия NAR-3 «Играбельность»**
   ([`docs/agents/tz-nar-3.md`](../agents/tz-nar-3.md)), которая закрывает
   найденные разрывы и впервые закрывает фазу 2 по настоящему оракулу.
   Вердикт NAR-2 дополняется записью о дефекте приёмки.

## Откат

- `scripts/visual/playthrough.mjs`, `scripts/check-browser-gate.mts`, команды
  `playthrough` / `check:browser-gate` в `package.json`, цепочка
  `check:contracts`, шаг в `.github/workflows/visual.yml`;
- правки в `docs/agents/{browser,visual,sandbox,roles,README,sandbox-browser-note}.md`,
  `docs/phases.md`, `scripts/visual/shots.mjs`;
- `area` в `public/campaigns/fmv-crossing/scenes/scene_fmv_crossing.json`,
  защита в `src/shared/migrate.ts`, смоук `scripts/smoke-navigation-area.mts`.

Ослабление гейта (удаление `check:browser-gate` из `check:contracts` или
`playthrough.mjs` из CI) возможно только новым ADR со статусом `proposed` и
явным ответом Мастера.

_(следующая запись — D-073)_
