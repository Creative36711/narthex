# GOLD-1.6d — исправление ключа autosave в golden harness

## Результат

`npm run playthrough:golden` проходит с `rc=0`. Дефект находился на стороне harness: игра сохраняла состояние, но проверка искала другой префикс localStorage. Код игры и модулей сохранения не менялся.

## Диагноз и подтверждение

- В `src/core/engine.ts:340-351` `GameEngine.start()` вызывает `this.autosave()`; в `src/core/engine.ts:5072-5076` автосохранение вызывает `writeSave(this.campaign.meta.id, ...)` (кроме game-over и сложности с `no_autosave`).
- `src/core/engine.ts:50-56` импортирует `writeSave` из `./savemigrate`. Фактический `saveKey` в `src/core/savemigrate.ts:39-41` возвращает `chronicle-forge:save:${campaignId}`; ручной слот в `:59-62` использует `chronicle-forge:save:${campaignId}@${slot}`.
- До исправления `scripts/golden/play.mjs:414-415` ожидал `narthex:save:${campaign.id}` и `narthex:save:${campaign.id}@1`. Следовательно, `06-before-save` проверял не тот ключ, а не отсутствие записи игры.
- Базовый прогон `9582212d-f67a-4c57-ac2b-90bc3dc92d5d`: `localStorage` на `http://127.0.0.1:4173` содержал 2 записи. Ожидаемого `narthex:save:b7305faa-8e10-4d26-96bb-f1b5ed5e493f` не было; фактический `chronicle-forge:save:b7305faa-8e10-4d26-96bb-f1b5ed5e493f` был, длина значения 3,784 символа. Снимок на `06-before-save` разбирается в `scene_pump_hall`, `loc_pump7`, tick `9`, с флагами `case_opened`, `gate_intro_done`, `met_ira`, `ira_story`, `clue_glove` = `true`; `updated_at=2026-10-29T21:44:48.435Z`. Полный снимок обеих записей сохранён в JSONL-событии `baseline_localstorage_snapshot` файла `_tools/reports/GOLD-1.6d.log`.
- Это подтверждает несовпадение ключа harness/runtime. Не требовалось менять `src/core/**` или ослаблять проверки.

## Изменение

В `scripts/golden/play.mjs` изменены только два ожидаемых ключа:

- autosave: `narthex:save:${campaign.id}` → `chronicle-forge:save:${campaign.id}`;
- ручной слот 1: `narthex:save:${campaign.id}@1` → `chronicle-forge:save:${campaign.id}@1`.

Порядок шагов playthrough, проверки ошибок, пустых фонов, флагов, времени, сохранения и загрузки не менялись.

## Проверки

- `npm run golden:import` — **rc=0**; архив 188,670,372 байта, SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`; дерево 1,291 файлов / 32 каталога, SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`; manifest unchanged.
- До изменения `npm run playthrough:golden` — **rc=1** на `06-before-save`, потому что harness искал отсутствующий `narthex:save:*`, хотя фактический autosave находился под `chronicle-forge:save:*`.
- До и после правки маршрут меню → герой → шлюз → машинный зал → первая улика сохранил `pageerror=0` и `emptyBackgrounds=0`; первая улика найдена. Базовый прогон остановился только на неправильном ключе.
- После изменения `npm run playthrough:golden` — **rc=0**, run `ae4e24ac-51fb-485e-ba0b-7259b7563655`. Import `rc=0`; audit `rc=0`, 0 ошибок / 0 предупреждений; cf-play исходника `rc=0`, 0 ошибок / 0 предупреждений; cf-play распакованного AI-kit `rc=0`, результат совпал с исходным.
- Браузер: 11 checkpoints, `pageerror=0`, console/http/request failures `0`, `emptyBackgrounds=0`; первая улика найдена. `06-before-save` читает существующий ключ `chronicle-forge:save:*`; ручной слот — `chronicle-forge:save:*@1`.
- Сохранение, reload + Continue и загрузка слота 1: все обязательные флаги `case_opened`, `gate_intro_done`, `met_ira`, `ira_story`, `clue_glove` остались `true`; сцена `scene_pump_hall`, локация `loc_pump7`, tick `9`, HUD `День 1, 09:00` совпали на всех снимках. Все три сравнения — 0 расхождений.
- Детали, включая исходный и итоговый snapshots, числовые метрики и run IDs, находятся в `_tools/reports/GOLD-1.6d.log` (36 JSONL-строк на момент локального прогона).

## Границы и CI

- Изменённый runtime/test path: только `scripts/golden/play.mjs`; добавлены отчёт `_tools/reports/GOLD-1.6d.md` и лог `_tools/reports/GOLD-1.6d.log`.
- `src/core/**`, `src/player/**`, `assets/save/autosave/**`, `public/ai/*.mjs`, `.golden/manifest.json`, `.golden/karkas/` вручную, `campaign-1`, workflow-файлы и защищённые контрактные пути не редактировались.
- Для CI отдельно фиксируются PR и push merge: run ID, job и первый упавший шаг `golden-playthrough`, а также статус `visual`. В итоговом ответе зелёными называются только jobs со статусом `success`; неизвестная внутренняя причина failure не предполагается.
