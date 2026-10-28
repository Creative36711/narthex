# NAR-5.7 · D-02 часть 2

## Изменение

Перенесены без правок тела `repairState` и его приватные помощники
`listShort`, `entityLabel`, `slotLabel` в `src/core/save/repair.ts`.
`save/index.ts` экспортирует `repairState`; старый `savemigrate.ts` импортирует
и реэкспортирует ту же функцию. Слоты, конверт и их поведение не менялись.

- `savemigrate.ts`: 680 → 377 строк (−303).
- `save/repair.ts`: 308 строк; `save/index.ts`: 3 строки.
- Над лимитом 450 осталось **0** строк; запас 73 строки. Гейт уже зелёный.
- На 5.8 остаются выделение слотов/конверта и окончательная организация фасада.
  В этой миссии их код не переносился.
- Порог 450, конфигурация и скрипты проверки не менялись.

Допущение: приватные помощники ремонта перемещаются вместе с функцией;
общий `ReportCtx` остаётся в migrations.ts. Контракт не меняется.
Откат: вернуть блок и импорты в фасад, убрать реэкспорт repair из index.ts.

## Побайтовая проверка

Перенесённый блок совпадает с исходным HEAD побайтно, SHA-256:
`3d7a721a220d58584eb6b04140bb5a20eca6149a0faf2304bd448f2d054875c9`.
Временный сравнительный прогон исходного и нового repairState на повреждённом
состоянии сценария §4 smoke:saves-compat сравнил JSON состояния **и заметок**:
одинаковы; SHA-256 `e0aa2773a296cf5d0f2061825a537a5b355029392733fd93c54d2bd67481ca2d`.
Хэш относится к одному прогону: исходное состояние клонировано перед обоими вызовами.
Сравнительный прогон завершился rc=0. Временные файлы находятся вне репозитория.
Это дополнительное сравнение, не изменение golden-тестов или их ожиданий.

До/после smoke stdout побайтно одинаков (cmp rc=0):
- core: `21333c4320912a394c1dba9420c5318a8da65d3b0eaaae85e1f36ee414744f6d`;
- saves-compat: `5e8e2703014e2c31bbf0a23c905545a3efaa08d560e3788adc7474994df1eaeb`.

## Команды после переноса

`npx tsc -b`: rc=0, stdout/stderr пусты.
`git diff --check`: rc=0, вывод пуст.
До переноса module-size: rc=1, `savemigrate.ts: 680 lines exceeds limit=450`.
Остальные обязательные команды до переноса: rc=0.

### `npm run smoke:core` · rc=0

```text

> narthex@0.9.0 smoke:core
> tsx scripts/core-semantics-smoke.mts

✓ startTick читает starting_tick
✓ tick_elapsed сравнивает с абсолютным тиком (граница)
✓ elapsed_ge считает «прошло с начала забега» (tick − startTick)
✓ set_flag ставит флаг; flag_set/flag_not_set читают его
✓ clear_flag снимает флаг
✓ changeNeed клэмпит сверху к max
✓ changeNeed клэмпит снизу к 0 (смерть/правило нуля отдельно)
✓ рост потребности делится с напарником
✓ убыль потребности напарнику не передаётся
✓ без feature «needs» changeNeed — no-op
✓ changeHp клэмпит к max_hp
✓ HP ≤ 0 → game_over
✓ после game_over лечение забега не воскрешает
✓ цепочка A→B срабатывает, третий уровень (C) обрезан потолком вложенности

все якоря зелёные
```

### `npm run smoke:saves-compat` · rc=0

```text

> narthex@0.9.0 smoke:saves-compat
> tsx scripts/saves-compat-smoke.mts

Кампания: [DEV] Пепел Каэрдена — эталон narrative (полигон смоуков) v0.1.0 · движок 0.9.0 · формат пакета v1
✓ 1 версия движка не пустая — 0.9.0
✓ 1 формат пакета — целое ≥ 1 — 1
✓ 1 сравнение версий
✓ 1 предрелиз младше релиза
✓ 1 bump
✓ 1 разбор «мусора» не падает
✓ 1 движок подходит демо-кампании
✓ 1 слишком новый минимум — понятный отказ — Кампания рассчитана на движок 99.0.0 и н
✓ 1 свой формат пакета проходит
✓ 1 пакет новее движка — отказ с причиной
✓ 1 древний формат пакета — отказ
✓ 1 цепочка миграций непрерывна
✓ 2 сейв пишется в обёртке — envelope_version=1
✓ 2 в обёртке версия кампании — 0.1.0
✓ 2 в обёртке версия движка — 0.9.0
✓ 2 в обёртке формат состояния — save_version=4
✓ 2 в обёртке есть метки времени
✓ 2 peekSave читает обёртку
✓ 3 старый сейв без обёртки открыт
✓ 3 формат перенесён до текущего
✓ 3 в отчёте сказано про перенос — Формат сохранения перенесён: в3 → в4.
✓ 3 после открытия сейв в обёртке
✓ 3 создана резервная копия
✓ 3 резервная копия — исходник (без обёртки)
✓ 3 удаление чистит и резерв
✓ 4 предмет-призрак убран из инвентаря
✓ 4 экипировка снята (предмет удалён)
✓ 4 чужая потребность убрана
✓ 4 все потребности кампании на месте
✓ 4 чужой навык убран
✓ 4 отметка о чужом правиле убрана
✓ 4 чужая запись кодекса убрана
✓ 4 сцена заменена на существующую — scene_gates_front
✓ 4 стадия квеста существует — started
✓ 4 отчёт по-русски и непустой — 8 строк
✓ 4 в отчёте есть вид «починка»
   отчёт: 8 строк, пример — «Из инвентаря убрано: «item_short_sword», «item_которого_нет» — этих предметов больше нет в кампании.»
✓ 5 вердикт: сейв v0.1.0 не поддержится с базы v1.4.0 — {"kind":"unsupported","save_version":"0.1.0","base_version":"1.4.0","reason":"Сохранение сделано в версии кампании 0.1.0, а поддерживаются сохранения начиная с 1.4.0."}
✓ 5 вердикт: сейв v1.4.0 поддержится
✓ 5 вердикт: сейв v1.5.2 поддержится
✓ 5 сейв не открывается как годный
✓ 5 причина на русском — Сохранение сделано в версии кампании 0.1.0, а подд
✓ 5 сейв НЕ удалён (можно откатить версию кампании)
✓ 5 сейв НЕ перезаписан
✓ 5 «Продолжить» не предлагается
✓ 5 без save_base_version поддерживается всё
✓ 5 сейв без версии кампании принимается
✓ 5 preserveSave убирает сейв в резерв
✓ 5 активный ключ освобождён
✓ 5 резерв хранит прежнюю версию
✓ 5 повторный вызов без сейва — false
✓ 6 сейв новее движка — отказ — {"kind":"too_old","reason":"Сохранение сделано более новым д
✓ 6 сейв новее движка не перезаписан
✓ 7 экспорт сейва отдаёт текст
✓ 7 после удаления сейва нет
✓ 7 импорт возвращает сейв
✓ 7 импортированный сейв читается
✓ 7 битый текст не импортируется
✓ 8 меню продолжает забег через openSave (с вердиктом)
✓ 8 «Продолжить» учитывает кампанию
✓ 8 неподдержавшийся сейв уходит в резерв перед новым забегом
✓ 8 в меню видна версия движка, а не поля пакета
✓ 8 в меню видны версия и дата сохранения
✓ 8 предупреждение о движке показывается в меню
✓ 8 отчёт сейва объясняет причину и не удаляет файл
✓ 8 справка рассказывает про сохранения и обновления
✓ 8 переименование id отклоняется с объяснением

ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (saves-compat)
```

### `npm run check:module-size` · rc=0

```text

> narthex@0.9.0 check:module-size
> tsx scripts/check-module-size.mts

fixture (a) changed module 451 lines: PASS — rc=1, lines=451, limit=450
fixture (b) changed module 450 lines: PASS — rc=0, lines=450, limit=450
fixture (c) engine.ts 600 lines: PASS — rc=0, lines=600, limit=600
fixture (d) engine.ts 601 lines: PASS — rc=1, lines=601, limit=600
limit=450 facade=600
baseline source modules=166
changed source modules=17
module src/core/engine.ts: 594/600 lines (facade)
module src/core/executor.ts: 71/450 lines (changed)
module src/core/fingerprint.ts: 70/450 lines (changed)
module src/core/realtime/index.ts: 187/450 lines (changed)
module src/core/save/index.ts: 3/450 lines (changed)
module src/core/save/migrations.ts: 118/450 lines (changed)
module src/core/save/repair.ts: 308/450 lines (changed)
module src/core/savemigrate.ts: 377/450 lines (changed)
module src/core/turn/index.ts: 229/450 lines (changed)
module src/player/DialogueOverlay.tsx: 387/450 lines (changed)
module src/player/GameView.tsx: 299/450 lines (changed)
module src/player/ItemInteractDialog.tsx: 61/450 lines (changed)
module src/player/MapScreen.tsx: 444/450 lines (changed)
module src/player/SceneForeground.tsx: 152/450 lines (changed)
module src/player/SceneIntroOverlay.tsx: 44/450 lines (changed)
module src/player/SceneNavigation.tsx: 39/450 lines (changed)
module src/player/SceneScreen.tsx: 414/450 lines (changed)
module src/player/useDialogueAudio.ts: 128/450 lines (changed)
external debt (non-blocking unless changed): src/core/combat.ts 1765; src/core/savemigrate.ts 377
check:module-size passed
```

