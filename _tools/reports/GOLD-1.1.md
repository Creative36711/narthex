# GOLD-1.1 — импорт и первый замер «Каркаса»

**Дата:** 2026-10-29
**Ветка:** `arena/66d43846-narthex`
**База:** свежий `origin/main`, `59410b9ffd9e165cfd1cd0be818be907743f5897`
**Кампания:** внешний репозиторий `Creative36711/campaign-1`, каталог `.golden/karkas/`.

## Допущения и неизменённые данные

- Принято решение Мастера (вариант A): пин — полный commit SHA плюс SHA-256 codeload-архива; `campaign-1` не изменялся.
- Пин в `.golden/manifest.json`: commit `8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1`; URL `https://codeload.github.com/Creative36711/campaign-1/tar.gz/8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1`; SHA-256 `76787085add7aac55fd216d4d739a1edf48f1a250d66026f3b02164ded817a88`; размер архива `188668720` байт.
- Импортёр использует 15-минутный timeout на попытку и проверяет и размер, и SHA-256 до распаковки. Архив и staging находятся только под `.golden/`; после успешного импорта временный архив удаляется. Повторный запуск проверяет кэш распакованного дерева по SHA-256 и не скачивает архив.
- В `manifest.json` дополнительно записывается fingerprint дерева: `1287` файлов, `29` каталогов, `192491125` байт содержимого, tree SHA-256 `e8b3683443fca964fbc33d3aad2dda96c23c18153108d1d5151ef37e8bb99f75`. Файлы кампании после импорта не редактировались; временный `.cf-play` отчёт удалён, повторная проверка tree fingerprint прошла.
- В `.gitignore` заменено общее правило `.golden/` на единственное правило `.golden/karkas/`, чтобы игнорировать тяжёлую копию кампании, но оставить коммитируемым манифест. `src/core/**`, `packs/**`, `docs/contracts/**`, `public/campaigns/**` не изменялись.

## Проверка 1 — импорт

Команда: `npm run golden:import`
Код возврата: `0`
Вывод stdout (дословно):

```text
> narthex@0.9.0 golden:import
> tsx scripts/golden-import.mts

download: verified 188668720 bytes from https://codeload.github.com/Creative36711/campaign-1/tar.gz/8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1
GOLDEN import: complete
archive: commit=8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1 bytes=188668720 sha256=76787085add7aac55fd216d4d739a1edf48f1a250d66026f3b02164ded817a88
tree: files=1287 directories=29 bytes=192491125 sha256=e8b3683443fca964fbc33d3aad2dda96c23c18153108d1d5151ef37e8bb99f75
target: .golden/karkas/
manifest: unchanged
```

## Проверка 2 — повторный импорт

Команда: `npm run golden:import`
Код возврата: `0`; SHA-256 тот же, сеть/повторная загрузка не использовались.
Вывод stdout (дословно):

```text
> narthex@0.9.0 golden:import
> tsx scripts/golden-import.mts

GOLDEN import: extracted cache verified; download skipped
archive: commit=8edbaa385d77a88bfb2af8aad4fc4a93dbede8b1 bytes=188668720 sha256=76787085add7aac55fd216d4d739a1edf48f1a250d66026f3b02164ded817a88
tree: files=1287 directories=29 bytes=192491125 sha256=e8b3683443fca964fbc33d3aad2dda96c23c18153108d1d5151ef37e8bb99f75
target: .golden/karkas/
manifest: unchanged
```

### Контроль checksum

Негативная проба: в временной копии manifest SHA-256 заменён на 64 нуля; импортёр получил реальный архив, обнаружил несовпадение и вернул `rc=1`. Pin сразу восстановлен, дерево кампании не заменялось. Вывод ошибки:

```text
golden:import: archive sha256 mismatch: expected 0000000000000000000000000000000000000000000000000000000000000000, received 76787085add7aac55fd216d4d739a1edf48f1a250d66026f3b02164ded817a88
```

## Игнорирование и статус

`git check-ignore -v .golden/karkas` (дословно):

```text
.gitignore:38:.golden/karkas/	.golden/karkas
```

`git status --porcelain` по умолчанию сворачивает единственную незастейдженную запись в `?? .golden/`. Развёрнутый вывод `git status --porcelain --untracked-files=all` подтверждает, что под `.golden/` виден только манифест:

```text
 M .gitignore
 M package.json
?? .golden/manifest.json
?? _tools/reports/GOLD-1.1.md
?? scripts/golden-import.mts
```

## Проверка 3 — `audit:campaign`

Команда: `npm run audit:campaign -- .golden/karkas`
Код возврата: `0`; ошибок `0`, предупреждений `0`, заметок `3`.
Вывод stdout (дословно):

```text
> narthex@0.9.0 audit:campaign
> tsx scripts/campaign-audit.mts .golden/karkas

Headless-аудит кампании: /home/user/narthex/.golden/karkas
Файлов в покрытии: json 319, ink/md 11
Проверка Narthex — 10/29/2026, 10:59:11 AM

СТРУКТУРА И ССЫЛКИ
ПРОБЛЕМ НЕТ
МЕДИА И ФАЙЛЫ
INFO: Проверено ссылок на локальные медиа в контенте кампании: 887; все найдены. Проверка покрывает только упомянутые в данных пути — файлы на диске без ссылок не считаются и не удаляются.
ПЛЕЙТЕСТ
INFO: После текущей версии кампании плейтест не запускался.
INFO: Эта проверка не симулирует игровой маршрут. Для проверки взаимодействий используйте кнопку «Плейтест».
```

Вывод stderr (дословно):

```text
Итого: 0 ошибок, 0 предупреждений, 3 заметок
```

Находок аудита с путями нет: структура и все `887` ссылок на медиа прошли проверку.

## Проверка 4 — `cf-play check`

Команда: `node public/ai/cf-play.mjs check .golden/karkas`
Код возврата: `1` (зафиксированная находка, не исправлялась в этой карточке).
Вывод stdout (дословно):

```text
# Проверка кампании · Каркас: Дело о седьмой помпе

✗ проверка не пройдена

- ✗ статических ошибок: 2

## Статика
12 сцен · 5 локаций · 11 диалогов · 116 узлов ink
ошибок 2 · предупреждений 12
- ink_missing_knot: переход на несуществующий узел «звон»
- ink_missing_knot: переход на несуществующий узел «страж»
- flag_written_never_read: флаг «case_written» выставляется, но нигде не читается
- flag_written_never_read: флаг «case136_read» выставляется, но нигде не читается
- flag_written_never_read: флаг «charge_made» выставляется, но нигде не читается
- flag_written_never_read: флаг «final_ready» выставляется, но нигде не читается
- flag_written_never_read: флаг «hounds_past» выставляется, но нигде не читается
- flag_written_never_read: флаг «kast_brief» выставляется, но нигде не читается
- flag_written_never_read: флаг «ledger_shown_kast» выставляется, но нигде не читается
- flag_written_never_read: флаг «office_page_lost» выставляется, но нигде не читается
- flag_written_never_read: флаг «office_thief_caught» выставляется, но нигде не читается
- flag_written_never_read: флаг «shaft_roped» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/home/user/narthex/.golden/karkas/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
концовки: ending_death, ending_flood
смерти: {"death: Семьдесят два часа вышли. Восьмой ярус ушёл под тяжёлую воду.":4,"death: Вы пали в бою.":1}

## Покрытие
посещено 4 из 12 достижимых сцен
сцены: scene_dry_row, scene_gate_hall, scene_office, scene_pump_hall
не покрыто: scene_archive, scene_drift, scene_face, scene_flood_gallery, scene_gate_office, scene_pump_room, scene_pump_shaft, scene_sluice
```

Дополнение по диагностике `graph.json`: обе ошибки `ink_missing_knot` указывают на `dialogues/ira.ink` (переходы `страж` и `звон`). Всего зафиксировано `12` предупреждений `flag_written_never_read`; полный список флагов: `case_written`, `case136_read`, `charge_made`, `final_ready`, `hounds_past`, `kast_brief`, `ledger_shown_kast`, `office_page_lost`, `office_thief_caught`, `shaft_roped`, `vein_hidden`, `zhuk_dozh_price`. CLI показывает первые десять предупреждений.

## Проверка 5 — открытие в игре

В Chromium открыт dev-player; каталог кампаний был замокан на `.golden/karkas/` через Playwright, без добавления копии в `public/campaigns/`. Путь: главное меню → каталог «Кампании» → выбор «Каркас: Дело о седьмой помпе» → «Новый забег» → первая сцена `scene_gate_hall` («Шлюзовая камера»).

| Экран | `pageerror` |
|---|---:|
| Главное меню | 0 |
| Каталог кампаний | 0 |
| Каркас выбран | 0 |
| Создание персонажа | 0 |
| Первая игровая сцена | 0 |
| **Итого** | **0** |

В первой сцене зафиксированы ещё `2` console/resource ошибки — оба ответа `404` на один и тот же необязательный путь `/campaigns/b7305faa-8e10-4d26-96bb-f1b5ed5e493f/project.json`. `pageerror=0`, ошибка экрана не возникла, забег запустился. В архиве `project.json` отсутствует; находка не исправлялась.

## Проверка 6 — engine `0.8.0` → `0.9.0`

В `campaign.json`: `engine_version=0.8.0`, `min_engine=0.8.0`, `package_format=1`; player показывает движок `0.9.0`.

| Слой | Прочитано / прогнано | Ошибки и предупреждения | Не достигнуто / не прочитано в этом прогоне |
|---|---|---|---|
| `audit:campaign` | JSON `319`, Ink/Markdown `11`, media-ссылки `887`; все ссылки найдены | `0` ошибок, `0` предупреждений, `3` заметки | Аудит сам не моделирует игровой маршрут |
| Статика `cf-play` | `12` сцен, `5` локаций, `86` сущностей, `11` диалогов, `116` узлов Ink, `163` правил, `5` квестов, `9` концовок, `7` арен; `185` записываемых и `173` читаемых флага | `2` ошибки перехода на knot в `dialogues/ira.ink`; `12` предупреждений о флагах, которые выставляются, но не читаются | Ошибки и предупреждения перечислены выше; ничего не исправлялось |
| Seed-прогон `cf-play` | `5` seed; `5` исходов `death`; `ending_death` и `ending_flood`; причина — дедлайн `4` раза, бой `1` раз | `sweep.status=ok`; итоговая команда `check` всё равно `rc=1` из-за статических ошибок | Автопокрытие достигло `4/12`; не посещены `8` сцен: `scene_archive`, `scene_drift`, `scene_face`, `scene_flood_gallery`, `scene_gate_office`, `scene_pump_room`, `scene_pump_shaft`, `scene_sluice` |
| Браузер | Меню, карточка, создание героя и `scene_gate_hall`; `5` шагов | `0` `pageerror`; `2` console `404` для `project.json` на шаге первой сцены | Замечаний о падении приложения нет; маршрут закончен на первой сцене |

Необязательный `project.json` запрашивается player-ом, но не входит в архив. Это наблюдение отделено от `pageerror` и от headless-аудита.

## Регрессии

- `npm run check:contracts` — `rc=0`; `контракты согласованы: 46 проверок`.
- `npm run check:pack-boundary` — `rc=0`; 37 файлов `src/core`, pack-ID ветвлений и импортов из `packs/**` нет.
- `npm run check:campaigns` — `rc=0`; публичные копии совпали с пакетами `4/4`.
- `npm run check:guide` — `rc=0`; 6 команд, 28 explain cases; встроенный эталон сохранил `6/10`; AI-kit проверен после распаковки.
- `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --out .golden/.reference-check` — `rc=0`; эталон остался прежним: `10` сцен, `0` ошибок, `8` предупреждений, `5` смертей, покрытие `6/10`.
- `npx oxlint scripts/golden-import.mts` — `0` предупреждений и `0` ошибок.
- `npx tsc --ignoreConfig --noEmit --module nodenext --moduleResolution nodenext --target ES2022 --types node scripts/golden-import.mts` — `rc=0`.
- `git diff --stat origin/main -- src/core packs docs/contracts public/campaigns` — пусто, `0` файлов и `0` строк изменено.
- Контроль checksum выше подтвердил, что несовпадение SHA-256 завершает импорт ненулевым кодом.
