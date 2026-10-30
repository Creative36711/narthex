# NAR-3.0 — единый экзамен фазы и безисторический module-size

Дата: 2026-10-26. Основа: `b20269708fef83f345120769f7c4f4c8f7b3575c`. Рабочая ветка: `arena/3c94fd1f-narthex`.

## Что добавлено

- `npm run check:mission` последовательно запускает `tsc -b`, `check:contracts`, `check:core-graph`, `check:guide`, `check:narrative-codes`, `check:version`, `check:brand`, `smoke:core`, весь набор из 55 смоуков и `cf-play check` для narrative и adventure. В конце печатает таблицу `command → rc` и общий rc.
- `npm run smoke:mission` запускает 55 зафиксированных smoke-команд последовательно, поднимая и останавливая Vite dev server для smoke-проверок, которым нужен `:5173`.
- `.github/workflows/visual.yml` вызывает `npm run check:mission` до `npm run build`. Последующие build, браузерный playthrough, PNG и `report.md` в `out/visual` и upload artifact оставлены.
- `check:module-size` больше не делает fetch. В git worktree он проверяет изменения относительно `origin/main`; в архиве без пригодной git-истории явно сообщает `changed modules: unavailable, checked facade` и проверяет `engine.ts`.
- П. 3.4 в `docs/agents/tz-nar-3.md` помечен как поглощаемый NAR-3.0; в README добавлена ссылка на `check:mission`.

## `check:contracts` на чистой базе и в ветке

На чистом дереве commit `b202697` сначала потребовался `npm ci` (70 пакетов, rc=0): первая попытка до установки зависимостей завершилась `tsx: not found`, rc=127. После установки зависимостей команда на той же чистой базе прошла, rc=0. Повторный запуск на ветке также rc=0.

Фрагменты фактического вывода обоих успешных запусков:

```text
> tsx scripts/contracts-check.mts && npm run check:packs && npm run check:pack-boundary && npm run check:decisions && npm run check:module-size && npm run check:browser-gate && npm run check:dev-campaigns && npm run check:campaign-formats
контракты согласованы: 42 проверок
check:packs passed
check:pack-boundary passed
check:decisions passed
check:module-size passed
Гейт браузера: ok — ложных формулировок 0, инфраструктура на месте, CI вызывает playthrough.
Гейт внутренних кампаний: ok — 3 полигона, 0 записей в реестре, сирот нет.
✓ Проверена JSON Schema Draft 2020-12: 125 типов
✓ Проверены отдельные JSON/Ink-модули и ссылки: 192 файлов в 3 кампаниях
✓ Campaign Package ↔ MonolithDoc: round-trip без потерь и предупреждений
✓ Структура AI-руководства и копируемый промпт синхронизированы с MonolithDoc
```

## Единая команда

Фактический вывод итоговой таблицы `npm run check:mission`:

```text
Mission check results
command                                                                     rc
tsc -b                                                                      0
npm run check:contracts                                                     0
npm run check:core-graph                                                    0
npm run check:guide                                                         0
npm run check:narrative-codes                                               0
npm run check:version                                                       0
npm run check:brand                                                         0
npm run smoke:core                                                          0
npm run smoke:mission (55 scripts)                                          0
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden            0
node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure  0
check:mission passed; rc=0
```

Оба `cf-play check` вывели одинаковый эталон: `10 сцен · 8 локаций · 6 диалогов · 21 узлов ink`, `ошибок 0 · предупреждений 8`, `seed'ов 5 · исходы {"death":5}`, покрытие `6 из 10`.

## 55 смоуков

`npm run smoke:mission` — rc=0. Ниже фактическая таблица вывода; все команды запущены в одном serial run, `SUMMARY 55/55 passed; rc=0`.

```text
Mission smoke results
command                               rc
npm run smoke:currency                0
npm run smoke:ink-import              0
npm run smoke:fingerprint             0
npm run smoke:book-md                 0
npm run smoke:campaign-index          0
npm run smoke:guide                   0
npm run smoke:design-doc              0
npm run smoke:quest-journal           0
npm run smoke:quest-journal-runtime   0
npm run smoke:p2                      0
npm run smoke:ai-runtime               0
npm run smoke:ai-task                  0
npm run smoke:char-templates           0
npm run smoke:no-campaign              0
npm run smoke:chronicle-manifest       0
npm run smoke:dialogues-r31            0
npm run smoke:dialogues-r32            0
npm run smoke:breathe-toggle           0
npm run smoke:scene-subtitles          0
npm run smoke:scene-editor             0
npm run smoke:editor-hotspot           0
npm run smoke:voice-dedup              0
npm run smoke:narrative-intro          0
npm run smoke:encounters-loader        0
npm run smoke:manifest-order           0
npm run smoke:engine-version           0
npm run smoke:hero-appearance          0
npm run smoke:theme-contrast           0
npm run smoke:dialogue-transitions     0
npm run smoke:dialogue-skip            0
npm run smoke:travel-transition        0
npm run smoke:stranger                 0
npm run smoke:encumbrance              0
npm run smoke:cutscene-queue           0
npm run smoke:spoil                    0
npm run smoke:time-semantics           0
npm run smoke:ai-diff                  0
npm run smoke:view-write               0
npm run smoke:core                     0
npm run smoke:saves-compat             0
npm run smoke:pack-missing             0
npm run smoke:pack-panels              0
npm run smoke:capability-modes         0
npm run smoke:dlg-script               0
npm run smoke:dlg-ui                   0
npm run smoke:folder-import            0
npm run smoke:narrative-builder        0
npm run smoke:patch                    0
npm run smoke:cutout                   0
npm run smoke:duration-actions         0
npm run smoke:craft-fail-time          0
npm run smoke:dialogue-speaker         0
npm run smoke:narthex-closed           0
npm run smoke:narthex-tech             0
npm run smoke:drive-gateway            0
SUMMARY 55/55 passed; rc=0
```

## Git archive без сети

После `git archive --format=tar HEAD | tar -xf - -C "$tmp"` в распакованный временный каталог был подключён symlink на уже установленные `node_modules`; `.git` отсутствовал. Запуск сделан с `GIT_TERMINAL_PROMPT=0`, отключёнными system/global Git config и `npm_config_offline=true`:

```text
archive has no .git: yes
> narthex@0.9.0 check:module-size
> tsx scripts/check-module-size.mts
fixture (a) changed module 451 lines: PASS — rc=1, lines=451, limit=450
fixture (b) changed module 450 lines: PASS — rc=0, lines=450, limit=450
fixture (c) engine.ts 600 lines: PASS — rc=0, lines=600, limit=600
fixture (d) engine.ts 601 lines: PASS — rc=1, lines=601, limit=600
limit=450 facade=600
changed modules: unavailable, checked facade
module src/core/engine.ts: 594/600 lines (facade)
external debt (non-blocking unless changed): src/core/combat.ts 1765; src/core/savemigrate.ts 788
check:module-size passed
git archive command: npm run check:module-size
archive rc=0; check rc=0
```

## Прочее и допущение

- `npm run check:module-size` в git worktree: rc=0; `changed source modules=0`, `engine.ts 594/600`, внешний долг `combat.ts 1765` и `savemigrate.ts 788`; fixtures проверяют границы 450/451 и 600/601.
- `npx oxlint scripts/check-module-size.mts scripts/check-mission.mts scripts/mission-smokes.mts`: rc=0, 0 warnings / 0 errors. `git diff --check`: rc=0. Проверены изменённые пути: нет `src/**`, `packs/**`, `public/campaigns/**`, `public/ai/**` или `docs/decisions/**`.
- Допущение: «55 прежних смоуков» — это явный список из отчёта NAR-2.15, а не динамический glob; более новый `smoke:navigation-area` в этот исторический набор не включён. Это закреплено массивом из 55 имён и проверкой длины массива.
