# NAR-5.21 — переходы по хотспотам сцен

**Дата:** 2026-10-29  
**Ветка:** `arena/aeadef8e-narthex`  
**База:** свежий `origin/main`, `06453c2300e0375240eb6281f614ac10d447e000`  
**Цель:** публичная state-ui кампания `public/campaigns/stone-tablet-siege`.

## Итог

`cf-play` теперь выставляет навигационные зоны сцены в наблюдение, включая цель `go_to_scene`, и выполняет действие `move` через `engine.navigate(zone)`. В режиме `explore` сохраняется приоритет обхода карты; затем агент предпочитает новый target scene по хотспоту и исключает назначения в уже посещённые сцены. Покрытие отслеживается по ID сцены, не только по локации. Это предотвращает возвратный цикл между сценами, расположенными в одной локации. Повтор заблокированного перехода откладывается до изменения состояния, диалога или боя; изменения одного только журнала не считаются прогрессом.

Публичный `public/ai/cf-play.mjs` пересобран обычным `build:playkit-bundle`. В `docs/phases.md` обновлена только строка пункта 1 таблицы «Вердикт NAR-5»: теперь она фиксирует фактическое покрытие, исходы и sweep.

## Допущения

- `navigation[].go_to_scene` — ID целевой сцены для `move`; фактическую проверку условий, перехватчиков и переход выполняет pack через `engine.navigate`. Записи без существующей цели-сцены не предлагаются агенту.
- Ранее посещённой считается именно сцена. Это важно для целевого пакета: обе сцены находятся в одной локации, но переход между ними всё равно необходим для покрытия.
- В отчёте `victory` — тип `game_over`, а `ending_draw` и `ending_lesson` — ID концовок; CLI выводит типы исходов и ID концовок отдельно. Для sweep нулевой `open` выводится явно.
- `explore` и прямой `sweep` используют навигационные хотспоты для новых сцен. Чтобы сохранить существующие регрессионные ожидания у map-based кампаний, `check` по умолчанию оставляет прежний обход карты, если у кампании есть `travel_connections`; для mapless кампании (`stone-tablet-siege`) `check` включает scene navigation.

## Проверка 1 — `check`

Команда: `node public/ai/cf-play.mjs check public/campaigns/stone-tablet-siege`  
Код возврата: `0`  
Вывод stdout (дословно):

```text
# Проверка кампании · [DEV] Пепельный круг: последняя рука

✓ проверка пройдена

## Статика
2 сцен · 1 локаций · 1 диалогов · 8 узлов ink
ошибок 0 · предупреждений 0

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/stone-tablet-siege/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"victory":5}
концовки: ending_draw, ending_lesson

## Покрытие
посещено 2 из 2 достижимых сцен
сцены: scene_entry, scene_last_hand
```

## Проверка 2 — `sweep`

Команда: `node public/ai/cf-play.mjs sweep public/campaigns/stone-tablet-siege --seeds 1-30 --steps 400`  
Код возврата: `0`  
Вывод stdout (дословно):

```text
seed 1: ok, шагов 10, финал victory
seed 2: ok, шагов 11, финал victory
seed 3: ok, шагов 8, финал victory
seed 4: ok, шагов 17, финал victory
seed 5: ok, шагов 11, финал victory
seed 6: ok, шагов 9, финал victory
seed 7: ok, шагов 7, финал victory
seed 8: ok, шагов 9, финал victory
seed 9: ok, шагов 7, финал victory
seed 10: ok, шагов 8, финал victory
seed 11: ok, шагов 8, финал victory
seed 12: ok, шагов 6, финал victory
seed 13: ok, шагов 6, финал victory
seed 14: ok, шагов 10, финал victory
seed 15: ok, шагов 13, финал victory
seed 16: ok, шагов 8, финал victory
seed 17: ok, шагов 10, финал victory
seed 18: ok, шагов 9, финал victory
seed 19: ok, шагов 6, финал victory
seed 20: ok, шагов 14, финал victory
seed 21: ok, шагов 11, финал victory
seed 22: ok, шагов 9, финал victory
seed 23: ok, шагов 7, финал victory
seed 24: ok, шагов 15, финал victory
seed 25: ok, шагов 11, финал victory
seed 26: ok, шагов 8, финал victory
seed 27: ok, шагов 8, финал victory
seed 28: ok, шагов 6, финал victory
seed 29: ok, шагов 13, финал victory
seed 30: ok, шагов 9, финал victory
# Обзор прогонов · [DEV] Пепельный круг: последняя рука

seed'ов 30 · успешных 30 · проблемных 0 · движок 0.9.0

Посещено сцен: 2 · локаций: 1 · диалогов: 1 · концовок: 4
Сцены: scene_entry, scene_last_hand

## Исходы
- victory: 30
- open: 0

Концовки: ending_draw, ending_lesson, ending_crown, ending_perfect
```

## Регрессии и сборка

- `npm run build:playkit-bundle` — успешно.
- `npm run check:playkit-bundle` — успешно; bundle совпал с исходником, SHA-256 `87f77eadeef9ebf5a5f9149f733bfa6f88a07341ac65f7b1faa6e0cc03eb62df`.
- `npm run check:guide` — успешно; 6 CLI-команд, 28 narrative-code explain cases; golden reference 6/10 сохранён.
- `npm run smoke:mission` — успешно; все 55/55 смоуков зелёные.
- `npx oxlint scripts/playkit/cli.mts` — 0 предупреждений, 0 ошибок.
- `npm run check:campaigns` — успешно; 4/4 публичных копии кампаний сверены с пакетами.
- `npm run check:contracts` — успешно; согласованы 46 проверок, включая вложенные проверки пакетов и границ.
- `npm run check:determinism` — успешно; 10/10 replay-пар совпали, 10/10 browser ↔ cf-play fingerprints совпали.
- `npm run check:compat-corpus` — успешно; все 7/7 references прошли. Встроенный negative control ожидаемо получил gate rc=1; сама команда завершилась rc=0.

## Доставка

PR, merge commit и CI run будут добавлены после публикации ветки и завершения CI.
