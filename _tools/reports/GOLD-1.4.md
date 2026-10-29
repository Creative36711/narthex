# GOLD-1.4 — сохранение и загрузка «Каркаса»

**Дата:** 2026-10-29 · **Narthex:** `0.9.0`, ветка `arena/e69b820b-narthex` · **Оракул:** текущий pinned-пакет campaign-1, без изменений `src/core/**` и содержимого кампании.

## Итог

**Вердикт: потерь нет.** После записи в ручной слот 1, перезагрузки страницы, продолжения автосохранения и отдельной загрузки слота 1 сохранены сцена, локация, игровой тик и все пять установленных флагов. На стадиях сериализации, перезагрузки/rehydration и загрузки ручного слота обнаружено **0 расхождений**.

Повторяемая команда: `npm run golden:save-load`. Она автоматически проходит маршрут и все UI-действия; ручные клики не требуются. Команда успешно завершилась дважды. Бросок расследования случаен, поэтому число попыток может меняться; раннер повторяет осмотр до первой улики (лимит 8 попыток). В последнем прогоне улика найдена со второй попытки.

## Источник и целостность импорта

- Pin из неизменённого `.golden/manifest.json`: commit `71dbbc1056fd34679cf9017ee7dc5ecff29d666c`.
- Архив: `188669895` байт; SHA-256 `d424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b`.
- Импортированное дерево: `1290` файлов, `32` каталога, `192491387` байт; SHA-256 `132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76`.
- `npm run golden:import` завершился с **rc=0**: архив скачан и проверен по размеру и SHA. Повторный запуск завершился с **rc=0** и подтвердил извлечённый кэш без повторной загрузки. После браузерных прогонов контрольный хэш дерева и все показатели снова совпали с manifest; `.golden/manifest.json` не изменён.
- В исходном `package.json` отсутствует `golden:import`. Для проверки использован временный alias `tsx scripts/golden-import.mts`, после импорта alias удалён. В итоговом diff `package.json` добавлена только разрешённая строка `golden:save-load`; `package-lock.json` не менялся.

## Повторение прогона

Начальная установка и проверка выполнялись так:

```sh
npm ci --no-audit --no-fund
npm pkg set 'scripts.golden:import=tsx scripts/golden-import.mts'
npm run golden:import
npm run golden:import
npm pkg delete 'scripts.golden:import'
npm install --no-save --package-lock=false --no-audit --no-fund @sparticuz/chromium@131 playwright-core@1.49.1
npm run golden:save-load
npm run golden:save-load
npm run check:contracts
npm run check:pack-boundary
```

Временный alias импорта не входит в итоговый `package.json`. Браузерные пакеты установлены только для локального запуска и не добавлены в зависимости проекта.

## Маршрут и точка сохранения

- Сценарий повторяет маршрут GOLD-1.2: создание героя (`Дознаватель Надзора` + `Сыскарь`), старт в `scene_gate_hall`, карта и переход в машинный зал `scene_pump_hall`.
- В `scene_pump_hall`, шаг `04a-dialogue-choice`, автоматизированно выбрана реплика Иры «Расскажи, что случилось в ночь тринадцатого.» Она установила `met_ira=true` и `ira_story=true`; игровой тик не изменился от диалога.
- На шаге `05-first-clue` осмотр привода дал один промах и затем успех. Найден предмет «Рукавица с привода», установлен `clue_glove=true`.
- Последний прогон: шлюз — **День 1, 07:00**, машинный зал — **08:00**, улика и точка сохранения — **10:00**. Это `tick=10` / `600` минут от начала отображаемого календаря; маршрут занял `180` игровых минут из-за часа пути и двух попыток расследования.
- Записан ручной слот **1** (`save_version=4`, `campaign_version=1.0.0`). После `page.reload()` раннер нажал «Продолжить», затем открыл панель сохранений и загрузил именно слот 1. После загрузки автосохранение было обновлено новым запущенным движком; сравнение выполнялось с данными этого runtime-снимка, а не только с исходным текстом слота.

## Флаги до сохранения и после загрузки

Все значения ниже взяты из полного `state.flags` сохранённого состояния. В колонке «шаг установки» указан первый шаг маршрута, на котором флаг наблюдался установленным.

| Флаг | Сцена / шаг установки | Перед сохранением | Ручной слот 1 | После reload и загрузки слота 1 | Потеря |
|---|---|---:|---:|---:|---:|
| `case_opened` | `scene_gate_hall` / `03-gate` | `true` | `true` | `true` | `0` |
| `gate_intro_done` | `scene_gate_hall` / `03-gate` | `true` | `true` | `true` | `0` |
| `met_ira` | `scene_pump_hall` / `04a-dialogue-choice` | `true` | `true` | `true` | `0` |
| `ira_story` | `scene_pump_hall` / выбранная реплика, `04a-dialogue-choice` | `true` | `true` | `true` | `0` |
| `clue_glove` | `scene_pump_hall` / успешный осмотр, `05-first-clue` | `true` | `true` | `true` | `0` |

Установленные до сохранения флаги: `case_opened=true`, `clue_glove=true`, `gate_intro_done=true`, `ira_story=true`, `met_ira=true`. После загрузки набор и значения совпали полностью.

Отдельное наблюдение, **не являющееся потерей при сохранении/загрузке**: `pump_seen` имел значение `null` на входе/в шаге `04-machine-hall` в `scene_pump_hall`, перед записью, в слоте и после загрузки (`null → null → null`). Раннер не устанавливает этот флаг вручную и не включает его в набор установленных флагов.

## Сравнение сериализации, перезагрузки и rehydration

| Проверяемый переход | Сцена | Локация | Игровое время | Разница флагов | Расхождения |
|---|---|---|---|---:|---:|
| Runtime autosave → сериализованный ручной слот 1 | `scene_pump_hall` → `scene_pump_hall` | `loc_pump7` → `loc_pump7` | `tick 10 → 10`, `День 1, 10:00 → День 1, 10:00`, `Δtick=0`, `Δминут=0` | `0` | `0` |
| Reload страницы → «Продолжить» | `scene_pump_hall` → `scene_pump_hall` | `loc_pump7` → `loc_pump7` | `tick 10 → 10`, `10:00 → 10:00`, `Δtick=0`, `Δминут=0` | `0` | `0` |
| Слот 1 → загруженный runtime после rehydration | `scene_pump_hall` → `scene_pump_hall` | `loc_pump7` → `loc_pump7` | `tick 10 → 10`, `10:00 → 10:00`, `Δtick=0`, `Δминут=0` | `0` | `0` |

Сравнение в логе включает объединение всех ключей `flags`, а не только известных маршрутных флагов. Итоговая discrepancy table пуста: `discrepancyCount=0`; потерь на стадиях `save`, `reload/rehydration` и `manual slot load/rehydration` не выявлено.

## Браузер, ошибки и изображения

- Chromium `131.0.6778.0`, viewport **1440×900**.
- `pageerror=0`; `requestFailures=0`; пустых фонов **0** на `11` контрольных точках.
- Зафиксировано **5 console errors** и **5 HTTP 404**. Текст каждой ошибки: `Failed to load resource: the server responded with a status of 404 (Not Found)`. Все относятся к одному необязательному отсутствующему `project.json`: 2 на `03-gate`, 2 при reload/«Продолжить», 1 при загрузке слота 1. URL и полный текст событий записаны в JSONL-логе; ошибка не скрывалась и ресурс кампании не добавлялся.
- Все PNG в `_tools/reports/GOLD-1.4/` проверены по заголовкам и имеют размер **1440×900**:
  - `01-menu.png`
  - `02-hero-creation.png`
  - `03-gate.png`
  - `route-map.png`
  - `04-machine-hall.png`
  - `05-first-clue.png`
  - `before-save.png`
  - `after-reload-menu.png`
  - `after-load.png`

## Регрессии и границы изменений

- `npm run check:contracts` — **rc=0**, 46 проверок контрактов; все включённые подгейты прошли.
- `npm run check:pack-boundary` отдельно — **rc=0**, 37 исходников `src/core`, граница паков соблюдена.
- `git diff --check` — **rc=0**.
- `npx oxlint scripts/golden/play.mjs scripts/golden/save-load.mjs` — **0 warnings, 0 errors**.
- Diff защищённых путей пуст: `src/core/**`, `packs/**`, `docs/contracts/**`, `public/campaigns/**`, `.golden/manifest.json`. Дерево `.golden/karkas/` не менялось и соответствует зафиксированному SHA.
- Изменения ограничены `scripts/golden/**`, одной разрешённой строкой `package.json`, этим отчётом, JSONL-логом и PNG в `_tools/reports/GOLD-1.4/`. Движок и контент кампании не исправлялись.

## Артефакты

- Раннер: `scripts/golden/save-load.mjs` (использует маршрут и общее browser tooling из `scripts/golden/play.mjs`).
- Команда: `npm run golden:save-load`.
- Лог последнего успешного прогона: `_tools/reports/GOLD-1.4.log`.
- Снимки: `_tools/reports/GOLD-1.4/*.png`.
