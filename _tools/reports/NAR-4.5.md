# NAR-4.5 · Realtime fixture and cf-play cycle check

Дата: 2026-10-27. База: `5b76b399aacc454a20845bcd19f1be9ee59c4e99`.

## Решение о размещении

Проект хранится внутри репозитория как внутренняя fixture: `_tools/projects/realtime-wall/` (`project.json`, `world.json`, `route.json`). Решение записано в [ADR 0014](../../docs/contracts/adr/0014-realtime-project-fixture.md). Проект не является опубликованной кампанией или новым pack: `public/campaigns/index.json`, реестр packs, caps и Phase 4 не менялись.

`cf-play cycles` проверяет `public/campaigns/ash-of-caerden` и `realtime-wall-zone`. Общий загрузчик `loadCycleProject()` читает цикл из manifest проекта; у Ash он разрешается через manifest установленного narrative pack. Общий `runCycleProjects()` выбирает адаптер по значению данных, выполняет упорядоченный цикл шагов через одну общую точку вызова `Executor.step` и проверяет результат одинаковым evaluator. В CLI нет ветвей `if/switch` по `turn` или `realtime`: проверка трёх runtime-specific branch-паттернов по `scripts/playkit/cli.mts` вернула `[]`.

Realtime-маршрут задаёт вход движения вправо, упор в стену, возврат через зону и повторный вход. Стена не пропускает игрока (`max_x=12` при безопасной границе 12), положение меняется от ввода; состояние checkpoint устанавливается один раз (`zone_trigger_count=1`) и остаётся включённым после повторного входа.

## Прогон обоих циклов

`node public/ai/cf-play.mjs cycles` — **rc=0**:

```text
✓ ash-of-caerden [turn]: 1 step calls, clock 28800000 → 32400000 ms, state {"tick":9,"scene":"scene_gates_front","location":"loc_gates"}
  ✓ the turn executor advances exactly one campaign tick: 9
✓ realtime-wall-zone [realtime]: 11 step calls, clock 0 → 220 ms, state {"position.x":6,"position.y":10,"max_x":12,"wall_contact":true,"wall_contacts":1,"zone_trigger_count":1,"triggered_zones.checkpoint":true,"world_state":"checkpoint-activated"}
  ✓ movement input changes the player position: 6
  ✓ the wall was contacted: 1
  ✓ the player never passes through the wall: 12
  ✓ the checkpoint changes state exactly once: 1
  ✓ the checkpoint state is recorded: true
  ✓ the zone's state transition is visible: "checkpoint-activated"

Coverage: 2/2 runtimes; 2/2 projects passed; 0 runtimes missing.
```

## Проверки

| Команда | Результат |
|---|---|
| `npx tsc -b` | rc=0 |
| `npm run check:module-size` | rc=0 |
| `npm run smoke:core` | rc=0 |
| `npx oxlint scripts/playkit/cli.mts scripts/playkit/cycle-check.ts scripts/playkit/realtime-project.ts public/ai/cf-play.mjs --quiet` | rc=0; 0 ошибок (предупреждения не блокируют scoped lint) |
| `node public/ai/cf-play.mjs cycles` | rc=0; оба проекта и оба цикла прошли |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | rc=0; 10 сцен, 8 локаций, 6 диалогов, 21 Ink-узел, 0 ошибок, 8 предупреждений |
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden-adventure` | rc=0; прежние counts/results сохранены: 10/8/6/21, 0 ошибок, 8 предупреждений; 5 seed-прогонов, те же исходы и покрытие |
| `npm run pack:ai-kit` + `cf-play check` из распакованного комплекта | rc=0; 110 файлов; эталонный kit даёт те же 10/8/6/21, 0 ошибок и 8 предупреждений |
| `npm run check:playkit-bundle` | rc=0; bundle свежий, SHA-256 `566887cfc475a664e50c2f42b9599d1b9469e0f84355e1a54fc08a97180ad7cb` |
| `npm run playthrough:exam` | rc=0; PASS, 2 packs, 20 шагов, 0 findings |

Изменения ограничены ADR, отчётом, внутренним проектом, соседними модулями и сгенерированным `public/ai/cf-play.mjs`. Существующие кампании, core/player, Phase 4 и публичный индекс не изменялись. Глобальный `npm run lint` не запускался: выполнен требуемый lint только изменённых/новых файлов.