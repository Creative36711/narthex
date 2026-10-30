# cf-play — как агенту тестировать кампанию

`cf-play.mjs` — один файл, без зависимостей и без сети. Запускается `node` 18+.
Движок внутри уже собран, исходники не нужны и не выдаются.

Положи его рядом с кампанией:

```
campaign/
  campaign.json
  world.json
  scenes/ …
  __chronicle_ai__/
    cf-play.mjs
    campaign-audit.mjs
    campaign-guide.md
```

## Одна команда для приёмки

```bash
node __chronicle_ai__/cf-play.mjs check . --seeds 1-5 --steps 300 --out .cf-play/check
```

`check` делает всё: статический граф, все маршруты из `routes/*.json`,
матрицу seed'ов. Пишет `.cf-play/check/report.md` и `report.json`, печатает
вердикт. Код возврата `0` — чисто, `1` — есть проблемы, `2` — ошибка вызова.

Перед пушем агент обязан получить `0` и приложить `report.md` к отчёту.
Если `1` — читай `report.json`, там списком: `problems`, `graph.errors`,
`routes[].status`, `sweep.deaths`.

## Что проверять по отдельности

```bash
# 1. Статика, без игры. Битая ссылка, мёртвый флаг, недостижимая сцена.
node __chronicle_ai__/cf-play.mjs graph .

# 2. Все ветви одного диалога — без похода до NPC.
node __chronicle_ai__/cf-play.mjs dialogue . npc_brann --depth 3

# 3. Точечный прогон из нужного места. Это не приёмка: evidence=injected.
node __chronicle_ai__/cf-play.mjs run . --seed 7 --script routes/a.json \
  --scene scene_outpost_room --flag order_delivered --tick 40

# 4. Честный обход с записью маршрута.
node __chronicle_ai__/cf-play.mjs explore . --seed 7 --steps 300 --record routes/found.json

# 5. Матрица исходов по seed'ам.
node __chronicle_ai__/cf-play.mjs sweep . --seeds 1-10 --steps 300
```

Любой флаг из `--help` — отладочная правка состояния: `--set`, `--var`,
`--item`, `--currency`, `--skill`, `--tick`, `--scene`, `--hp`, `--god`,
`--entity id=state`, `--quest id=stage`, `--weather id`.

## Правила доказательств

- `evidence: honest` — состояние пришло только из игры.
- `evidence: injected` — были правки; они перечислены в транскрипте.
- `verify <прогон> --honest` отвергает второй вид.

Не выдавай прогон с правками за прохождение. Для отчёта «проверено» годится
только `honest`; `injected` годится, чтобы найти баг, но не чтобы закрыть задачу.

Маршрут, записанный `--record`, воспроизводится байт-в-байт по хэшу
транскрипта. Значит, найденный путь можно приложить и переиграть в CI.

## Формат маршрута

```json
{
  "name": "01-night-pass / smoke",
  "steps": [
    { "do": "travel", "to": "loc_serpentine" },
    { "do": "interact", "entity": "npc_brann" },
    { "do": "choose", "text": "Спросить про обморожение" },
    { "do": "expect", "scene": "scene_outpost_yard" },
    { "do": "expect", "has_item": "item_order" },
    { "do": "expect", "game_over": null }
  ]
}
```

Проверки: `scene`, `flag`, `no_flag`, `has_item`, `game_over` (`null` — забег
идёт), `tick_at_least`, `quest_at_stage`. `{"do":"snapshot","label":"…"}` —
метка в транскрипте. Если маршруту нужен свой seed, добавь `"seed": 7` рядом
с `"steps"` — `check` возьмёт его вместо общего.

Артефакты `check` пишет в `.cf-play/`, добавь это в `.gitignore` кампании.

## Что этот инструмент не проверяет

Вёрстку, переполнение текста, тайминг анимаций, звук, читаемость на маленьком
экране, вкус диалога. Это не «пока не сделали» — этого не может ни один
headless-прогон. В отчёте честно перечисли, что осталось непроверенным,
вместо того чтобы писать «кампания протестирована полностью».

`check` закрывает 100% **проверяемых инвариантов**: ссылки, достижимость,
ветви, флаги, стадии квестов, детерминизм, исходы по seed'ам. Это и есть
«полностью» в терминах, которые вообще можно проверить машиной.

## CI

```yaml
- run: node __chronicle_ai__/cf-play.mjs check . --seeds 1-5 --out .cf-play/check
```

Кампания с `error` в статике не должна мержиться. Артефакт `report.md`
прикладывается к PR.

## Что появится дальше

Команды `explain`, `example`, `schema`, `shoot` и `kit doctor` запланированы
(ADR 0011, фазы 2 и 9) и в текущем `cf-play.mjs` отсутствуют. Пока их нет,
пользуйся `graph`, `dialogue`, `run`, `sweep`, `check` и отчётом `report.json`:
в нём есть пути и коды находок.

Если кит и движок разошлись по мажорной версии, результаты прогона нельзя
считать доказательством: проверь `KIT.json` и запроси актуальный кит.
