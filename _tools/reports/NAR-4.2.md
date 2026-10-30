# NAR-4.2 · Пошаговый цикл на контракте Executor

Дата: 2026-10-27

## Что появилось

Реализация — **`src/core/turn/index.ts`**, 229 строк при лимите 450:

- `TurnExecutor implements Executor<GameState>`;
- `createTurnExecutorFactory(campaign, GameEngine): ExecutorFactory<GameState>`;
- мс переводятся в тики через `86_400_000 / ticks_per_day`, остаток хранится в памяти цикла;
- события имеют `at` внутри шага и стабильно упорядочены; ввод делегируется существующим действиям или generic pack operation port;
- pause/resume, setSeed и fingerprint реализованы по ADR 0013;
- сохранённое состояние имеет приоритет над отдельным seed.

Конструктор движка передаётся фабрике снаружи. Поэтому `src/core/turn` не импортирует `engine.ts`, а **`src/core/engine.ts` не изменён вовсе**. Контракт `src/core/executor.ts`, browser, cf-play, saves, packs и package scripts также не менялись. Дополнительный npm-alias не потребовался.

Запись решения: `docs/decisions/NAR-4.md`.

## Эталон cf-play: до / после

Baseline снят с `9eff1f15bcedb3fd58686abcd8bfaf7b4decdfe2` до первой правки. Команды после выполнены на дереве NAR-4.2; unified diff stdout пуст для обеих кампаний.

| кампания | rc до / после | сцены до / после | локации до / после | диалоги до / после | Ink до / после | ошибки до / после | предупреждения до / после | diff |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `ash-of-caerden` | 0 / 0 | 10 / 10 | 8 / 8 | 6 / 6 | 21 / 21 | 0 / 0 | 8 / 8 | пуст |
| `ash-of-caerden-adventure` | 0 / 0 | 10 / 10 | 8 / 8 | 6 / 6 | 21 / 21 | 0 / 0 | 8 / 8 | пуст |

Дополнительно в обеих проверках до и после: 5 seeds → 5 deaths (1 exhaustion + 4 combat), покрытие 6/10 сцен.

Допущение: в тексте карточки один раз встречается `ash-of-caerdin-adventure`; использован существующий канонический каталог `ash-of-caerden-adventure`, который также вызывает `check:mission`.

## Браузер: до ожидания карточки / после

Команда после: `npm run playthrough:exam -- http://127.0.0.1:4173 out/play-exam` → **rc=0**.

| кампания | шаги ожидались / получено | финал ожидался / получен | findings |
|---|---:|---|---:|
| Ash | 8 / 8 | `ending_ashes` / `ending_ashes` | 0 |
| adventure | 12 / 12 | `ending_gate_unlocked` / `ending_gate_unlocked` | 0 |

Общий результат: `RESULT: PASS; packs=2; steps=20; findings=0`. Полные снимки и machine-readable отчёт: `out/play-exam/` (ignored test output, не добавляется в PR).

Первый запуск в чистом окружении вернул инфраструктурный rc=2 из-за отсутствия Chromium. После установки указанных самим oracle `@sparticuz/chromium@131` и `playwright-core@1.49.1` только в `node_modules` тот же вызов прошёл; package files не изменились.

## Доказательство неизменного поведения

**Прямой `GameEngine` и `TurnExecutor` на одном seed дали одинаковые canonical fingerprints на старте, после целого тика, после двух половин тика, после события внутри шага и после реальных `use`, `move`, `interact`, `startQuest`; параллельно эталон cf-play и browser exam остались численно неизменными.**

Проверка адаптера (rc=0):

| проверка | результат |
|---|---|
| initial | tick=8, clock=28 800 000, fingerprint=`5de27ad5b31fd309`; direct == Executor |
| один тик | tick=9, clock=32 400 000, fingerprint=`92d95aadbeb969d9`; direct == Executor |
| ½ + ½ тика | первая половина `changed=false`, затем tick=10, clock=36 000 000; direct == Executor |
| pause | `changed=false`, clock и fingerprint неизменны; ввод не выполнен |
| событие `wait` на ½ шага | tick=12, clock=43 200 000, fingerprint=`62cb4c91ddefff6d`; direct == Executor |
| `use` | direct == Executor, fingerprint=`76cbe5bc65179250` |
| `move` → `scene_gates_guardroom` | direct == Executor, fingerprint=`ade1759bf0bdbb6f` |
| `interact` → `slot_guard_left` | direct == Executor, fingerprint=`2abb3d428309fbbe` |
| pack action `startQuest` | direct == Executor, fingerprint=`cbafa37b0c1c08e7` |
| state / seed | state seed=`saved-seed` победил внешний `ignored-seed`; `setSeed('repeatable')` обновил существующее поле |

## Матрица обязательных проверок

| команда | результат |
|---|---|
| `npx tsc -b` | rc=0 |
| `npm run check:core-graph` | rc=0; 28 modules, acyclic, no core imports of engine.ts |
| `npm run check:module-size` | rc=0; `src/core/turn/index.ts` 229/450 |
| `npm run check:contracts` | rc=0; 42 contract checks и вся цепочка гейтов |
| оба `node public/ai/cf-play.mjs check …` | rc=0; таблица выше, diff пуст |
| `npm run playthrough:exam -- http://127.0.0.1:4173 out/play-exam` | rc=0; 8 + 12 шагов, 0 findings |
| `npm run smoke:mission` | rc=0; **55/55**, удалённых 0 |
| `npm run smoke:core` | rc=0 |
| `npm run smoke:saves-compat` | rc=0; save format и миграции не менялись |
| все NPM `probe:*` | 10/10 rc=0, включая narrative/adventure |
| `npx vite build` | rc=0; 1439 modules |

## Граница и откат

В PR входят только новая реализация, эта справка и `docs/decisions/NAR-4.md`. Существующие потребители не переподключены, поэтому удаление `src/core/turn/index.ts` полностью откатывает runtime-изменение без миграций и правок данных.
