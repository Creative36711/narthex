# STAB-1.21 — проверки защищённых путей и воспроизводимости

## Область и ограничения

- Основа работы: `df93c7be3d455e917f00a1d5fa0506ef4a434350` (`main` до изменений). Работа ведётся на закреплённой за этой сессией ветке `arena/f3a64ae4-narthex`.
- `public/campaigns/**`, `packs/**`, `.golden/**`, `scripts/golden/**`, `golden.yml`, `docs/contracts/**` не изменялись. Зафиксированные три Ash warnings, пороги и §3 oracle не менялись.
- Базовые digest-значения сохранены в `scripts/protected-legacy-baselines.json`; проверки не принимают новые пути и не допускают изменения байтов в разрешённых исторических снимках.

## Причина и исправления

1. Проверки campaign metadata и внутреннего набора теперь используют точные SHA-256 для полного дерева/индекса и конкретных Ash metadata blobs. Крошечное изменение названия или автора больше не маскируется общим исключением.
2. FMV проверяется отдельной `auditCampaignFmv()` до передачи проекции без FMV-расширения legacy-схеме. Вспомогательные JSON и оба допустимых имени fixture-маркера учитываются при полноте набора.
3. Предыдущие совпадения проверки брендовых литералов ограничены 33 точными хэшами уже существовавших файлов; разрешённое имя npm-пакета — только точная строка. Только корневой временный `dist-ai/`, создаваемый guide-check, отделён от исходников; вложенный одноимённый каталог снова проверяется. Негативные пробы проверяют, что новый или изменённый файл не получает исключение.
4. Обычная сборка больше не пересобирает закреплённый AI audit bundle; отдельная команда его генерации остаётся доступна. SHA-256 `public/ai/campaign-audit.mjs`: `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`.
5. Ash browser-exam ищет фактический заголовок карточки. Экзамен Chromium прошёл для Ash (`ending_ashes`, 8 шагов) и Adventure (`ending_gate_unlocked`, 12 шагов), без ошибок страниц, error screens, пустых стартов, raw NPC IDs или битых/пустых изображений.

## Негативные контроли

`smoke:protected-check-policy` принимает точные снимки и отклоняет изменённые Ash metadata, FMV campaign, индекс, дерево, новый путь и неподтверждённое различие. Brand smoke пропускает только закреплённые исходные файлы и отклоняет новый файл с запрещённой строкой. FMV smoke проверяет действительный extension, схему, неизвестные поля, некорректные переходы и признаки отсутствующего/неполного набора.

## Локальная проверка

После `npm ci` (70 lockfile-пакетов) все команды §4 завершились с RC 0: pre-build `check:audit-bundle`; `npx tsc -b`; 71/71 ScriptCat tests; `check:contracts`, `check:core-graph`, `check:module-size`, `check:brand`, `check:version`, `check:guide`, `check:playkit-bundle`, `check:campaigns`, `check:compat-corpus`, `check:narrative-codes`, `smoke:core`, `smoke:mission`, `cf-play:negative`, `lint`, `build`, post-build `check:audit-bundle` и финальный `check:mission`.

- До и после сборки `public/ai/campaign-audit.mjs`: 1,002,333 bytes, SHA-256 `b7f271bf7eebb863fe685480337f0de33dbb8d48048b044d9390e70ced7e422d`; current-source reproducibility SHA: `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`.
- `check:brand`: 1,302 файлов, 33 точных baseline-файла; `check:campaigns`: 4/4; `check:guide` сохранил точные три Ash warnings без ошибок.
- `lint`: RC 0, 2,285 предупреждений, 0 ошибок.
- `check:mission` после сборки: RC 0; 55/55 mission smokes, детерминизм и Chromium↔Node parity, strict-warning, `cf-play:negative`.
- `playthrough:exam` после сборки, Chromium 131: Ash — 8 шагов до `ending_ashes`; Adventure — 12 шагов до `ending_gate_unlocked`; обе кампании: 0 ошибок страниц, error screens, битых изображений, raw NPC IDs и пустых стартов.

## GitHub Actions — диагностика

- Visual run `41174282594` упал до запуска job steps; run `41182714025` не прошёл на ScriptCat probe; base-SHA run `41203918231` остановился на `check:contracts` / browser gate. PR run `41209243709` выявил, что `smoke:no-campaign` требует Vite на :5173, но workflow его не запускал. Без сервера сбой воспроизведён как `ECONNREFUSED`; workflow теперь запускает временный Vite, ждёт готовности и гарантированно его останавливает. Локальный smoke с сервером прошёл. PR run `41209618814` прошёл этот smoke, но bare `cf-play check` трактовал ожидаемый rc=1 от трёх Ash warnings как сбой; заменил его `check:strict-warning`, который проверяет точный warning set и положительные контроли. PR run `41210261562` прошёл оба изменения, сборку и проверки bundle, но упал в `smoke:campaign-start`: production index намеренно пуст, а smoke требует один FMV проект. Теперь smoke запускается на изолированной копии `dist` с одной временной записью, не редактируя `public`; этот точный маршрут локально прошёл. Следующий CI rerun ещё ожидается.
- Golden run `41203918145` завершился `success` на базовом SHA `df93c7be3d455e917f00a1d5fa0506ef4a434350`. Job API фиксирует шаг обязательного golden playthrough/soak с `2026-10-31T13:05:04Z` по `14:06:20Z` — 3,676 секунд фактического runner time; следующий шаг `cf-play:negative` и загрузка GOLD-1.15 timeline также успешны. Run использовал закреплённый `.golden/manifest.json`: `Creative36711/campaign-1` commit `4783665b04b9ea703cbdfc0bd10cc2b1263caf83`, archive SHA-256 `7c2172a7c1582cf269b2035ea952c989ffa4fad5ce8c238528fca7545d527cb2`, tree SHA-256 `d645ea0b79385b6a478f3e17108245ff5f4b057553ec4ad765f4387bb3d79d68`. Это подтверждает базовый soak, но не итоговый SHA.
- Job/artifact download и log retrieval завершились EOF на Actions result host; подробные таймстампы получены через GitHub Actions jobs API. Проверка endpoint permissions вернула HTTP 403 (`Resource not accessible by integration`), но это не была попытка dispatch. Golden run завершился без видимой billing-блокировки.
- Успешные visual и golden результаты на одном и том же итоговом `main` SHA должны быть подтверждены после merge; более ранние запуски не засчитываются.
