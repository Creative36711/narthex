# STAB-1.4 · Player UI: prop `mode` у FmvScreen

Дата: 2026-10-30. Dispatch: `4096f0cf-5705-818c-b250-efeb82e0f6a3`; run: `3a1dac57-0477-465d-94c8-374fbb807ad8`.

## База и scope

- Свежая база `origin/main`: `eb153852edabe11d4df32ab9f696d707058036b2` (`STAB-1.6`, PR #169). Перед началом проверены чистое дерево, отсутствие несохранённых изменений, merge-base и пустой diff относительно базы.
- Использована закреплённая ветка сессии `arena/7958e0e9-narthex`, без создания/переключения на `nar/*`.
- Product diff: только `src/player/FmvScreen.tsx`, **3 insertions / 5 deletions**. Единственный дополнительный отслеживаемый файл — этот отчёт.
- `FmvCutsceneMode.tsx`, `src/core/**`, `src/shared/**`, `src/editor/**`, `packs/**`, `public/**`, контракты, goldens, workflows, конфигурация проверок и зависимости не изменены.
- Временный браузерный стенд, установленные отдельно browser-пакеты, скриншоты и логи находятся только в игнорируемом `node_modules/.cache/stab-1.4/`.

## Выбор: убрать передачу prop, а не расширять Props

Фактическая TS2322 возникала не на внешнем интерфейсе `FmvScreen`, а в его вызове общего slideshow-компонента `CutscenePlayer` с `mode="fmv"` и `fmv={view}`. Общий компонент не принимает **оба** этих prop и ожидает slideshow `cutscene`. Простое удаление `mode` оставило бы неправильный `fmv` и отсутствующие slideshow-аргументы. Добавление `mode` в публичные Props самого `FmvScreen` не исправило бы этот вызов.

Вместо этого `FmvScreen` напрямую вызывает уже существующий `FmvCutsceneMode` с его штатным `view={view}`. Удалены устаревшие `mode`/`fmv` и импорт slideshow-компонента. Сохранён ключ `${view.fragment}:${view.presentation}`; загрузка, PackHost, state, callbacks, public Props экрана и существующие визуальные ветки не переписаны. Визуальный FMV-компонент используется без каких-либо изменений.

Допущение: существующий типизированный контракт `FmvCutsceneMode({ view })` является целевым для FMV-представления. Нового общего контракта или ADR не требуется. Упомянутого в карточке `_tools/reports/STAB-1.2.md` на этой базе нет; решение проверено по фактическим исходникам и реальному браузеру.

Запрещённые подавления и обходы типов (`as any`, `@ts-ignore`, `@ts-expect-error`), ослабление оракулов и правки конфигурации не применялись.

## Проверки и коды возврата

`—` означает, что отдельный baseline-запуск данной команды не выполнялся, а не успешный результат.

| Команда / проверка | До | После | Результат |
|---|---:|---:|---|
| `npm ci --no-audit --no-fund` | 0 | — | Установка исходного lockfile; browser-пакеты установлены отдельно, версии основных зависимостей сверены с lockfile |
| `npx tsc -b` (baseline с `--pretty false`) | 2 | 2 | **13 → 12** диагностик; **FmvScreen 1 → 0**, остальные 12 дословно прежние |
| `npx oxlint src/player` | — | 0 | 41 warning, **0 errors** |
| `npm run lint` | 0 | 0 | Без изменений: 1515 warnings, **0 errors** |
| `npm run check:determinism` | 0 | 0 | Replay-пары, mutation sensitivity и browser/Node parity прошли; полный stdout до/после идентичен |
| `npm run check:module-size` | 1 | 1 | Те же **11** превышений, новых нет; FmvScreen **267 → 265 / 450** строк |
| `npm run probe:fmv` | 0 | 0 | `FMV_PROBE passed`; полный stdout до/после идентичен |
| `npm run probe:fmv-passport` | — | 0 | `FMV_PASSPORT_PROBE passed` |
| `npm run smoke:fmv-area` | 1¹ | 1 | Существующий D-072 в `migrateNavigation`, вне scope; см. ниже |
| `npm run build` | — | 2 | Останавливается на тех же 12 editor-диагностиках; до Vite/build:ai-bundle не доходит |
| Временные esbuild browser bundles до/после | 0 | 0 | Сборка реального экрана для изолированной браузерной проверки, не замена `tsc` или полного build |
| Browser probe, Chromium 131.0.6778.0 | 0² | 0 | После: 4/4 сценария, native video, нет page errors |
| Сравнение диагностик, 11 size failures и 47 scene SHA-256 | — | 0 | Ни одной новой внешней диагностики, size failure или изменённого scene hash |
| `git diff --check` | 0 | 0 | Ошибок whitespace нет |

¹ Дополнительный area-smoke после правки обнаружил `D-072 guard: area-less navigation must be normalized before SceneScreen reads nav.area.x`: фактическая `zone.area` — `undefined`, ожидается `{x:0,y:0,w:640,h:360}`. Та же ошибка и rc=1 воспроизведены запуском неизменённых исходников и fixture из **base SHA** в отдельной игнорируемой копии (`npx tsx .../area-baseline/scripts/fmv-area-smoke.mts`). Этот smoke не импортирует FmvScreen; миграция и fixture не менялись. Чужой дефект и оракул не исправлялись.

² Baseline browser probe успешно **зафиксировал дефект**, а не успешный FMV: `TypeError: Cannot read properties of undefined (reading 'slides')` из slideshow-компонента. После исправления этой ошибки нет.

### Полный список оставшихся TypeScript-диагностик (12)

```text
src/editor/DialoguePlaytest.tsx(3,36): error TS2307: Cannot find module '../core/dialogue' or its corresponding type declarations.
src/editor/PackCatalogPanel.tsx(7,72): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,22): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,51): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(12,101): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(13,13): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(25,62): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(31,56): error TS2339: Property 'project' does not exist on type 'EditorStore'.
src/editor/PackCatalogPanel.tsx(43,48): error TS2339: Property 'setCapabilityMode' does not exist on type 'EditorStore'.
src/editor/PackPanelWorkbench.tsx(48,28): error TS2339: Property 'packResolution' does not exist on type 'EditorStore'.
src/editor/PackPanelWorkbench.tsx(50,23): error TS2339: Property 'capabilityModes' does not exist on type 'EditorStore'.
src/editor/inkImport.ts(14,35): error TS2307: Cannot find module '../core/dialogue' or its corresponding type declarations.
```

Удалена единственная диагностика `src/player/FmvScreen.tsx(258,7) TS2322`, где `mode` отсутствовал в `IntrinsicAttributes & Props`. Относительно текущей базы исходных диагностик **13**, а не исторические 15 из карточки. `tsc` и общий build **не объявляются зелёными**.

### Существующие 11 превышений module-size

Все имеют лимит 450; список до/после побайтно совпал:

```text
src/App.tsx                       470
src/editor/AiWizard.tsx            636
src/editor/CampaignEditor.tsx     5199
src/editor/EditorApp.tsx          1368
src/editor/campaignAudit.ts        705
src/editor/inkImport.ts            883
src/editor/newCampaign.ts          690
src/editor/store.ts              1267
src/shared/CutscenePlayer.tsx      460
src/shared/compat.ts               496
src/shared/types.ts              3406
```

## Determinism и контент

- 5 seeds × turn/realtime × повторные прогоны; mutation probe действительно меняет fingerprint в обоих runtimes.
- Реальный Chromium 131.0.6778.0 ↔ cf-play Node: **10/10** совпадений, повторные хэши стабильны. Полный stdout baseline/after совпал.
- `probe:fmv`: 20/20 одинаковых прогонов, view on/off, `empty_frames=0`; state SHA-256 **`b9fc4ad08a0d74ab47eaa259d7c2a80bede40e276f8cccdb041477850cc939d8`** до и после.
- SHA-256 каждого из **47 tracked scene JSON** совпал до/после. SHA-256 файла baseline-инвентаря: **`64af8673c0904483c737bfb43f4f105992fd616b7b82cbbe30ac962ccdd0f61f`**.
- Медиа, сцены, кампании, packs и goldens не редактировались.

## Browser walkthrough (выполнен, не только план)

Из-за независимых editor-ошибок общего build проверялся **изолированно реальный FmvScreen**, собранный esbuild: исходные hooks/PackHost/preloader/renderers и `src/index.css`, неизменённые `public/campaigns/fmv-crossing` JSON/WebM/PNG. Минимальный engine adapter предоставляет campaign, seed, flags и setFlag; это не полный app/editor E2E. Использован Chromium 131.0.6778.0, viewport 1280×720. Воспроизведение — настоящее `<video>`, без подмены ended/timeupdate.

1. На baseline открыть fixture: React boundary ловит чтение `slides` у `undefined`, потому что FMV-view был передан slideshow-плееру.
2. После правки открыть `scene_fmv_crossing`: poster загружен, доступна штатная кнопка запуска, fragment A.
3. Нажать запуск A, дождаться native `currentTime > 0.1`; виден субтитр «У развилки гаснут огни». После реального окончания 4-секундного WebM видны два доступных выбора.
4. Выбрать «Идти на свет фонаря.»: fragment B, `chose_lantern=true`. Запустить реальное 5-секундное видео B, дождаться финала, нажать штатное продолжение. Callback вызван ровно один раз.
5. В новой странице повторить A и выбрать «Идти за вороном.»: fragment C, `chose_raven=true`. Реальное видео C завершается, продолжение вызывается ровно один раз. В обоих обычных маршрутах нет page errors, boundary errors или console errors.
6. Отдельно задержать HTTP-ответ документа FMV: loading-ветка показывает уже загруженный poster; после отпускания реального ответа экран переходит в ready.
7. Отдельно вернуть намеренный HTTP 503 только для первой загрузки video A: виден прежний error UI, текст HTTP 503 и poster. Нажать «Повторить загрузку»: вторая попытка загружает исходный WebM, экран возвращается в ready. Нет page/boundary errors; единственная console error — намеренный HTTP 503.

**4/4 after-сценария PASS.** Сняты и просмотрены screenshots choices/error; все временные screenshots: `01-ready-a.png`, `02-playing-a.png`, `03-choices.png`, `04-ending-b.png`, `05-ending-c.png`, `06-loading-poster.png`, `07-http-error.png`, `08-retry-ready.png` в игнорируемом cache. Устойчивая часть evidence сохранена здесь пошагово, бинарники в Git не добавлены.

## CI и границы результата

Ещё до создания этого PR проверены исходные CI runs PR #169: [golden-playthrough](https://github.com/Creative36711/narthex/actions/runs/41103890656/job/124227890813) и [screenshots](https://github.com/Creative36711/narthex/actions/runs/41103890503/job/124227890315). Обе failure-аннотации сообщают: `The job was not started because recent account payments have failed or your spending limit needs to be increased`. Это проверенная внешняя billing-причина, а не предположение по красному статусу. Конфигурация CI не менялась; фактический статус PR и squash merge сообщаются отдельно в результате.

D-4 устранён в пределах scope; остальные диагностированные editor/build, module-size и D-072 остаются работой соответствующих ролей. Итоговый `check=0` относится к выполнению **STAB-1.4** с явно разрешёнными существующими size failures, а не к утверждению, что весь репозиторий собирается без ошибок.
