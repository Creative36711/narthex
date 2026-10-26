# NAR-3.5 — «Перекрёсток огней» в реестре игрока

Date: 2026-10-26. Branch: `arena/c6bbc316-narthex`. Base: `4fe2394492153cd5af4023e177e386421bdd9f66` (`origin/main`).

## Реализация

- `npm run campaign:release` добавил единственную запись `fmv-crossing` в `public/campaigns/index.json` с названием «Перекрёсток огней». Источник и публичная копия `campaign.json` имеют то же название без `[DEV]`; D-075 удалил оба `dev-fixture.json`.
- ID `fmv-crossing` и строка в `packs/publications.json` сохранены. `publish:campaigns`, карты публикаций, источники и публичные копии Ash не менялись.
- `scripts/no-campaign-smoke.mts` теперь использует in-memory API и пустой реестр `[]`; реальные файлы кампаний/index не записываются. Smoke сохраняет байты публичного index до/после и проверяет их равенство.
- Добавлен `smoke:campaign-start`: Chromium получает реальный сетевой `campaigns/index.json`, показывает проект в меню, выбирает карточку, нажимает штатную кнопку «Новый забег» и ждёт готовую FMV-сцену. В лог входят проверки query/hash, console/page errors и HTTP-ошибок файлов проекта. PNG и `run.log` находятся в `out/visual/campaign-start/`; CI прикладывает их через существующий artifact `out/visual`.
- `.github/workflows/visual.yml` вызывает отдельный изолированный `smoke:no-campaign` и новый браузерный `smoke:campaign-start`, сохраняя шаги снимков, playthrough и artifact.
- `docs/agents/dev-campaigns.md`: две кампании Ash остались в таблице dev-полигонов; `fmv-crossing` перенесён в отдельный раздел «Штатный проект».

## D-075 и legacy-аудит

Сначала была проверена обычная команда релиза:

```text
$ npm run campaign:release -- fmv-crossing --title 'Перекрёсток огней'
ERROR: Схема manifest.json/: must NOT have additional properties
ERROR: Схема scenes/scene_fmv_crossing.json/: must NOT have additional properties
✗ audit:campaign на источнике вернул rc=1; release отменён, файлы не изменены
rc=1
```

Причина — действующий `audit:campaign` не принимает используемые FMV-поля `fmv` в манифесте/сцене. FMV runtime их требует; менять oracle/schema или удалять поля нельзя. Отдельный штатный `cf-play check` прошёл, и D-075 подтвердил, что ссылки на ассеты существуют. Поэтому для переключения именно этого формата использован документированный `--no-audit`; прочие проверки/публикация D-075 не отключались.

Фактический переключатель, по порядку:

```text
npm run campaign:release -- fmv-crossing --title 'Перекрёсток огней' --no-audit  rc=0
  check:dev-campaigns: 3 полигона, 1 запись, сирот нет
  check:campaigns: все 3 публичные копии совпадают с паками

npm run campaign:dev -- fmv-crossing --reason 'NAR-3.5 toggle verification'  rc=0
  заголовок [DEV] Перекрёсток огней; реестр 1 → 0
  check:dev-campaigns: 3 полигона, 0 записей, сирот нет
  check:campaigns: все 3 публичные копии совпадают с паками

npm run campaign:release -- fmv-crossing --title 'Перекрёсток огней' --no-audit  rc=0
  заголовок Перекрёсток огней; реестр 0 → 1
  check:dev-campaigns: 3 полигона, 1 запись, сирот нет
  check:campaigns: все 3 публичные копии совпадают с паками
```

`npm run smoke:campaign-visibility` после финального release: rc=0 (`dev/release/отказ работают`). Реальный `index.json` изменён только командами `campaign:release`/`campaign:dev`, не вручную. Generic `check:dev-campaigns` не менялся и не содержит исключения для `fmv-crossing`.

## Smoke и артефакты

Изолированный smoke после релиза:

```text
$ npm run smoke:no-campaign
✓ изолированная фикстура начинается с пустого реестра
✓ пустой локальный реестр доступен — []
✓ после теста очищена изолированная фикстура
✓ реальный public index не изменён
ALL GREEN
rc=0
```

Это smoke доказывает неизменность index относительно его состояния непосредственно до запуска. В финальном git diff остаётся ожидаемое D-075 изменение доставки (одна запись проекта), а не побочный diff от пустого smoke.

Браузерный smoke на собранном preview (`Chromium 131.0.6778.0`):

```text
$ npm run smoke:campaign-start -- http://127.0.0.1:4173
✓ Страница открыта без query-параметров и hash
✓ Реальный index: HTTP 200, один проект fmv-crossing / «Перекрёсток огней»
✓ Главное меню показывает «Перекрёсток огней»
✓ Проект виден в обычном списке кампаний
✓ Выбор проекта не добавил query-параметры или hash
✓ Нажата штатная кнопка «Новый забег»
✓ Игровая сцена открыта: fmv_crossing, FMV playing, постер загружен
✓ Ошибок console нет
✓ Ошибок pageerror нет
✓ Ошибок HTTP для файлов кампании нет
RESULT: PASS
rc=0
```

Снимки: `out/visual/campaign-start/01-main-menu.png`, `02-campaign-list.png`, `03-game-scene.png`; лог: `out/visual/campaign-start/run.log`.

## Проверки

| Команда | Результат |
|---|---|
| `npm ci` | rc=0 |
| `npm run build` | rc=0; 1435 модулей, audit bundle не изменился |
| `npm run check:contracts` | rc=0; включая `check:dev-campaigns` и `smoke:campaign-visibility` |
| `npm run check:campaigns` | rc=0; 3/3 публичные копии совпадают с источниками паков |
| `npm run smoke:no-campaign` | rc=0; изолированный `[]`, байты реального index неизменны |
| `npm run smoke:campaign-visibility` | rc=0 |
| `npm run smoke:campaign-start -- http://127.0.0.1:4173` | rc=0; реальный index, меню, запуск и FMV-сцена |
| `node public/ai/cf-play.mjs check public/campaigns/fmv-crossing` | rc=0; 1 сцена, 5 seed, 0 ошибок/предупреждений |
| `npm run check:mission` | rc=0; TypeScript, contracts, остальные mission gates, 55/55 smoke, оба Ash oracle |
| `node scripts/visual/playthrough.mjs http://127.0.0.1:4173 out/visual/play` | rc=0; 20 шагов, 0 находок, включая FMV и adventure |
| `npm run pack:ai-kit`, распаковка ZIP и `node __chronicle_ai__/cf-play.mjs example` | rc=0; 110 файлов; пример эталона после распаковки: 10 сцен / 8 локаций / 6 диалогов / 21 Ink, 0 ошибок, 8 предупреждений, 5 смертей, покрытие 6/10 |

`check:mission` подтвердил идентичный контрактный результат для обоих эталонов Ash: по 10/8/6/21, 0 ошибок, 8 предупреждений, пять seed с исходом death и покрытие 6/10. 27 отсутствующих изображений не восстанавливались и не копировались; файлы Ash, решения и oracle/bundle `cf-play` не менялись.

Локальный вспомогательный `node scripts/visual/shots.mjs http://127.0.0.1:4173 out/visual` вернул rc=1: fallback Chromium сообщил о двух элементах без доступного имени на снимках `editor-desktop` и `editor-narrow`. Исходный `shots.mjs` и `src/` не менялись. Полный браузерный playthrough и новый campaign-start smoke на том же preview вернули rc=0. Итог GitHub Actions для PR будет добавлен после запуска.

## Pull request

Ожидает публикации ветки и результата GitHub Actions.
