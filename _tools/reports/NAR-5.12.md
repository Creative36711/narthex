Повторная сверка оракула §1, 2026-10-29, база ddc7362; вердикты аудита - Диск 14PIvGspcJO (FAIL) и 1QLgRH; исходного текста отчёта не существовало

# NAR-5.12 — повторная сверка оракула миссии NAR-5

Сверка выполнена по переизданной карточке NAR-5.18: dispatch `4086f0cf-5705-8129-ab34-ec3f3c23829f`, run `25a4b987-7efe-446b-a96f-d0ff782fcead`.

Это новый отчёт по фактическим повторным прогонам на базе `ddc73621bf8974143aad687c8ffa5bcc8ab10855` (`ddc7362`), а не исходный текст Spec Auditor и не его реконструкция. Файл-отчёт с матрицей в Git или Drive не найден: вердикт Drive `14PIvGspcJO__FLLpR_lvFEwz3RQDw8bH` сообщает о несостоявшейся доставке, журнал `1QLgRH-lIzrzJon2itEiBNd7Cqo1Bl_UJ` содержит задачу и ответы, но не матрицу. Все выводы ниже относятся к повторным проверкам, перечисленным здесь.

Рабочая ветка: `arena/ed167b34-narthex`. До создания этого файла рабочее дерево было чистым. Все команды исполнялись на закреплённой базе `ddc7362`; в PR включён только этот отчёт.

## Оракул §1

### 1. Проект state-ui проходит полный `cf-play check`

Команда:

```text
node public/ai/cf-play.mjs check public/campaigns/stone-tablet-siege
```

Результат: **rc=0**.

```text
✓ проверка пройдена
2 сцен · 1 локаций · 1 диалогов · 8 узлов ink
ошибок 0 · предупреждений 0
seed'ов 5 · исходы {"open":5}
посещено 1 из 2 достижимых сцен
```

### 2. В PR NAR-5.3–5.5 нет изменений `src/core/**`; граница паков зелёная

Проверены файлы трёх смёрженных PR через GitHub API (`gh api repos/Creative36711/narthex/pulls/{125,126,129}` и `/files`):

| PR | merged | merge commit | файлы `src/core/**` |
|---:|:---:|---|---|
| #125 | true | `39af34386e3908ae7d6b5c15e99fb7d27f5b0fa8` | `[]` |
| #126 | true | `81fd2fd16fdd797130140a29560d132800ff9d75` | `[]` |
| #129 | true | `5d4e55db7fd681af1c4d18da5f353a4096930d09` | `[]` |

Команда `npm run check:pack-boundary`: **rc=0**. Фактический итог: `core pack boundary: 37 source files; no pack-ID branches or imports from packs/**`; `check:pack-boundary passed`.

### 3. Контрактный пример с `cap_options` проходит

Команда: `npm run check:contracts` — **rc=0**; итог — `контракты согласованы: 46 проверок`.

`docs/contracts/examples/project.narrative.json` и `project.code-mode.json` содержат `cap_options`; скрипт `scripts/contracts-check.mts` загрузил проектные примеры и для `project.code-mode.json` вывел:

```text
пример проекта с кодом в швах
  ✓ проходит схему
  ✓ проходит семантику
```

### 4. Примеры `project.code-mode.json` и `locales.de.json` проходят

Команда: `npm run check:contracts` — **rc=0** (те же 46 проверок).

Для `project.code-mode.json` прошли схема и семантика (вывод приведён в п. 3). Для `locales.de.json` команда отметила все пять проверок:

```text
пример локали
  ✓ схема локали = 1
  ✓ язык файла совпадает с именем
  ✓ ключи строк — стабильные ID по структуре
  ✓ у каждой строки есть хэш источника
  ✓ у каждого источника есть строка
```

### 5. Проект с выключенной обязательной возможностью отклоняется

Команда: `npm run check:contracts` — **rc=0** для гейта; отрицательный пример отклонён семантически, а не принят с предупреждением:

```text
✓ project.cap-off-required.json: отклонён (семантика)
```

### 6. Формат v2 принят и заморожен

Проверка файлов на базе:

- `docs/contracts/adr/0015-format-freeze.md`: `Статус: accepted`, дата решения `2026-10-28`.
- `docs/contracts/format-v2.md`: статус `принят` с `2026-10-28`.
- `docs/contracts/format-v2.freeze.json`: файл существует; `frozenAt` — `2026-10-28`.

Команда `npm run check:schema-freeze`: **rc=0**.

```text
Заморозка от 2026-10-28: проверено 42 полей, добавлено с тех пор 0, нарушений 0.
Формат v2: замороженные поля на месте.
```

### 7. Корпус совместимости содержит и проходит семь эталонов

Команда `npm run check:compat-corpus`: **rc=0**.

Фактический заголовок: `7 references; unique project IDs=7; minimum=7`. Все семь положительных записей получили `rc=0`: `ash-of-caerden`, `ash-of-caerden-adventure`, `fmv-crossing`, `realtime-wall-zone`, `river-of-ash`, `ash-arena`, `stone-tablet-siege`. Итог: `check:compat-corpus passed; unique-projects=7; minimum=7; rc=0`.

Встроенный negative control испортил временную копию и получил ожидаемый отказ гейта: `expected gate rc=1; observed gate rc=1`; сам compatibility gate при обычном запуске остался зелёным.

### 8. Фасад миграции сейвов не превышает 450 строк; golden-выводы совпали

```text
wc -l src/core/savemigrate.ts
2 src/core/savemigrate.ts
```

`npm run check:module-size`: **rc=0**; строка в отчёте команды: `module src/core/savemigrate.ts: 2/450 lines (changed)`; итог `check:module-size passed`.

Повторно выполнены `npm run smoke:core` и `npm run smoke:saves-compat`; обе команды завершились с **rc=0**. SHA-256 их полного stdout (включая npm-заголовок):

| Команда | Текущий stdout SHA-256 | Контрольный SHA-256 из `_tools/reports/NAR-5.8.md` |
|---|---|---|
| `npm run smoke:core` | `21333c4320912a394c1dba9420c5318a8da65d3b0eaaae85e1f36ee414744f6d` | `21333c4320912a394c1dba9420c5318a8da65d3b0eaaae85e1f36ee414744f6d` |
| `npm run smoke:saves-compat` | `5e8e2703014e2c31bbf0a23c905545a3efaa08d560e3788adc7474994df1eaeb` | `5e8e2703014e2c31bbf0a23c905545a3efaa08d560e3788adc7474994df1eaeb` |

Обе контрольные суммы совпали полностью. Предыдущий отчёт NAR-5.8 фиксирует старый/новый `cmp` stdout как `rc=0`; в этой повторной сверке хэши текущих полных выводов сопоставлены с записанными там golden-хэшами. Временные файлы вывода удалены после расчёта.

### 9. Браузерный экзамен проходит; оба эталона доходят до финалов

Собран production build (`npm run build`, **rc=0**), запущен preview и выполнена команда:

```text
npm run playthrough:exam -- http://localhost:4173 out/nar-5.18-playthrough-exam
```

Браузер: Chromium `131.0.6778.0`. Фактический итог: **rc=0**, `RESULT: PASS; packs=2; steps=20; findings=0`.

| Эталон | Шагов | pageerror / errorScreens / brokenImg / emptySrcImg / rawNpcIds | Финальное состояние |
|---|---:|---|---|
| `ash-of-caerden` | 8 | `0 / 0 / 0 / 0 / 0` | `ending_ashes` |
| `ash-of-caerden-adventure` | 12 | `0 / 0 / 0 / 0 / 0` | `ending_gate_unlocked` |

По 27 известных намеренных отсутствий изображений на проект были распознаны как объявленные отсутствия; они не дали findings и не помешали прохождению. Для дополнительной сверки GitHub Actions run `40789160369` на `main`, commit `ddc73621bf8974143aad687c8ffa5bcc8ab10855`, тоже имеет `conclusion=success`: workflow `visual`, job `screenshots` и шаги «Снять экраны и проверить утверждения» / «Сохранить снимки и отчёт» завершились успешно. Основное доказательство финалов выше — свежий локальный прогон с полным выводом.

## Обязательные общие гейты

`npm run check:mission`: **rc=0**, `check:mission passed; rc=0`; smoke-миссия — `SUMMARY 55/55 passed; rc=0`. Включённая проверка детерминизма вывела `PASS: 10/10 browser hashes equal cf-play; repeated hashes are identical.`; оба вызова `cf-play check` для `ash-of-caerden` и `ash-of-caerden-adventure` вернули `rc=0`.

`npm run lint`: **rc=0**, **0 ошибок**; линтер вывел 1 509 предупреждений.

`npx tsc -b`: **rc=0** (также выполнен внутри `check:mission` и `npm run build`). `npm run build`: **rc=0**, 1 449 модулей трансформировано, Vite завершил сборку. `check:core-graph`, `check:brand` и `check:version` прошли как в `check:mission`, так и в отдельных локальных проверках; `check:contracts`, `check:schema-freeze`, `check:compat-corpus`, `smoke:core`, `smoke:saves-compat` и `check:module-size` завершились с `rc=0`.

## Граница изменения

Повторная сверка не потребовала правок кода, схем, паков, документации, карточек или решений. Единственный предполагаемый tracked-файл изменения этого задания — `_tools/reports/NAR-5.12.md`.
