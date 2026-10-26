# D-073 · Внутренние кампании-полигоны и порядок в Arena/reports

Статус: accepted
Дата: 2026-10-26
Дата решения: 2026-10-26
Решил: Мастер

## Неясно

26.10 при разборе вопроса «какие кампании есть у проекта» выяснилось:

1. В `Arena/logs` (папка шлюза для журналов ходов) лежали 5 файлов с именами
   `NAR-2.10/11/12/12b/12v_report_<dispatch>_<run>.md` — это отчёты карточек,
   а не журналы. `docs/agents/drive.md` прямо запрещает подмену одного другим
   (D-071: именно из-за такой подмены цикл вставал на паузу).
2. В `public/campaigns/` было три каталога, которых нет в реестре игрока
   (`index.json = []`). Два имели маркер `smoke-fixture.json`, третий
   (`fmv-crossing`) — нет. Из-за этого `npm run audit:campaign-formats`
   **падал с rc=1**, но проверка не входила в `check:contracts`, и никто этого
   не видел.
3. У `ash-of-caerden-adventure/campaign.json` внутри стоял
   `id: ash-of-caerden` — дубль narrative-кампании. В браузере выбор adventure
   из списка грузил narrative-сцену: приложение резолвило каталог по `id`.
4. Названия полигонов не отличались от названий играбельных кампаний. Агент,
   который увидит `Пепел Каэрдена` в списке, решит, что это игра.

## Решил

### Диск

- Созданы подпапки `Arena/reports/{screenshots,playtests,verdicts}`:
  `1zHhcOxor1AWTmYjElCo_bJWaj4ERU0Hp`, `1YAoNsqoBM1HvDZZ5IpvAcQroiEJIVeSV`,
  `1EFKb4LojmZ_vbEBUo34KioGpfwPou5mg`.
- 5 отчётов из `logs` перенесены в `reports`; 4 PNG ушли в `screenshots`,
  машинный отчёт прогона и дополнение D-072 — в `playtests`, вердикт NAR-2 —
  в `verdicts`. Журналы `<uuid>_<uuid>.md` остались в `logs`: шлюз ищет их
  по родителю, перенос ломает дозапись.
- `docs/agents/drive.md` дополнен структурой, ID папок и правилом переноса.
  ID файлов при переносе не меняются — ссылки в Notion остались валидными.

### Кампании

- **Каталоги не переименовываются.** Имена `ash-of-caerden`,
  `ash-of-caerden-adventure`, `fmv-crossing` — часть контракта: 129 ссылок
  в скриптах, оракул `cf-play check`, `packs/publications.json`, playkit `example`,
  ТЗ NAR-1/NAR-2. Переименование сломало бы принятый оракул.
- Вместо этого введена **явная маркировка**: префикс `[DEV] ` в `title`
  (виден в меню и любом отчёте) и маркер `dev-fixture.json` с полями
  `visibility: internal`, `reason`, `used_by`, `created_by`, `remove_rule`.
  Старое имя `smoke-fixture.json` принимается для совместимости.
- Создан реестр `docs/agents/dev-campaigns.md`: таблица полигонов, кто создал,
  какие смоуки используют, правила для агентов (создавать тестовые кампании
  с `[DEV]` и `__dev_*`, убирать в `finally`, не коммитить).
- Страж `check:dev-campaigns` (входит в `check:contracts`) проверяет маркеры,
  уникальность `id`, отсутствие `__dev_*` в git и чистоту реестра игрока.

### Починенные дефекты

- `id` у adventure-копии и её `project.json` исправлен на
  `ash-of-caerden-adventure` (в `public/` и в источнике пака синхронно).
- `fmv-crossing` приведён к валидному Campaign Package: `currencies: []`,
  `map_image: ''`, `condition: null` у состояния сцены, `area` у навигации,
  пустой инвентарь игрока, портрет на существующий постер. Это позволило
  `audit:campaign-formats` впервые пройти до конца.
- `audit:campaign-formats` теперь входит в `check:contracts` (долг F2 частично
  закрыт), понимает оба имени маркера, исключает служебные JSON
  (`dev-fixture`, `adventure.json`, `project.json`, `.cf-play/`) из сверки с
  manifest и явно обрабатывает FMV-расширения манифеста/сцены **без
  ослабления базовой схемы** narrative.
- Пересобрана `docs/campaign.schema.json`: в main она отставала от
  `src/shared/types.ts` (добавлен `CapabilityId`, `caps` в `CampaignMeta`).
- Исправлена рассинхронизация `public/ai/PLAYKIT.md` ↔ `docs/playkit-agent.md`.
- Синхронизированы `packs/*/data/fmv-crossing` и `public/campaigns/fmv-crossing`
  после правки `area` из D-072 (я внёс её только в публичную копию, из-за чего
  `check:campaigns` падал).

## Проверено

```
check:contracts (включая browser-gate, dev-campaigns, campaign-formats) rc=0
check:core-graph / guide / narrative-codes / version / brand / campaigns rc=0
smoke:navigation-area 3/3 · npx tsc -b rc=0 · npm run build rc=0
npm run playthrough — Chromium 131, 7 шагов, rc=0, 0 pageerror
в списке кампаний браузера видны 4 записи с [DEV], id уникальны
```

## Откат

- `docs/agents/{drive,dev-campaigns,README,tz-nar-3}.md`,
  `scripts/{check-dev-campaigns,audit-campaign-formats}.mts`,
  `package.json` (команды `check:dev-campaigns`, `check:campaign-formats`,
  цепочка `check:contracts`);
- `[DEV]`-префиксы и `dev-fixture.json` в `public/campaigns/*` и
  `packs/*/data/*`, `id`/`project.json` adventure-копии, правки FMV-пакета,
  `docs/campaign.schema.json`, `public/ai/PLAYKIT.md`;
- переносы на Диске: вернуть родителей через `files.update`.

_(следующая запись — D-074)_
