# NAR-5.3 — state-ui: пошаговый автомат

## Состав пака

- `packs/state-ui/pack.json` — манифест, объявляющий автомат состояний, read-only панель, семантический валидатор, пробу и pure sim-шов `state-machine.step`.
- `schema/state-machine.schema.json` — строгая JSON Schema Draft 2020-12.
- `data/turn-cycle.json` — демонстрационный цикл `ready → active → completed` с альтернативным завершением `cancelled`.
- `machine.ts` — чистый детерминированный переход по одному событию.
- `validate.ts` — проверка ссылок, уникальности переходов и событий, достижимости, терминальных и тупиковых состояний.
- `panel.ts` — read-only проекция текущего состояния, списка состояний и доступных событий.
- `types.ts` — типы данных автомата и модели панели.
- `probe.mts` — проверка схемы, валидатора, симулятора и панели плюс запуск настоящего проигрывателя.
- `packs/registry.json` — добавлен только идентификатор `state-ui`.
- `package.json` — добавлен только npm-скрипт `probe:state-ui`.

**Допущение:** события выбирают ровно один переход из пары `(текущее состояние, событие)`; неоднозначные пары запрещаются валидатором. Панель является read-only моделью для редакторского UI; она не меняет данные автомата.

## Вывод проверок

1. `npm ci` — **rc=0**.
2. `npm run probe:state-ui` — **rc=0**:
   - схема и семантический валидатор приняли данные автомата;
   - повтор одного сценария дал последовательность `ready → active → completed`;
   - панель показала `active` и события `finish`, `cancel`;
   - негативная проверка отвергла дублирующий переход;
   - `public/ai/cf-play.mjs check public/campaigns/ash-of-caerden --json --seeds 1-1 --steps 80` завершился `verdict=ok`, `pack=narrative`, `seam=narrative.sim`, **rc=0**. Проба вызывает настоящий собранный проигрыватель, не мок.
3. `npx tsc --ignoreConfig --noEmit --target ES2023 --module ESNext --moduleResolution bundler --skipLibCheck --types node packs/state-ui/types.ts packs/state-ui/machine.ts packs/state-ui/validate.ts packs/state-ui/panel.ts packs/state-ui/probe.mts` — **rc=0**.
4. `npm run check:packs` — **rc=0**; проверены 4 пака, включая `state-ui`.
5. `npm run check:pack-boundary` — **rc=0**; 37 файлов ядра, нарушений границы нет.
6. `npm run check:contracts` — **rc=0**; проверки контрактов и вложенные гейты прошли. Статусы `state-machine`, `cards`, `auto-battle` остаются `planned`, их `probe` остаются `null`; `docs/contracts/**` не менялся.
7. `git diff origin/main...HEAD -- src/core` и `git diff origin/main...HEAD -- docs/contracts` — **rc=0**, оба diff пусты.

## Дополнительная проверка интеграции

`npm run smoke:mission` — **rc=1**, 54/55 смоуков прошли. Сбой — существующее фиксированное ожидание в `scripts/pack-panels-smoke.mts:329–330`: `installedPacks.length === 3` и `livePanels === 12`; с новым зарегистрированным паком реально 4 манифеста. В workflow это шаг «Все 55 смоуков миссии NAR-2.15», поэтому GitHub check `screenshots` завершился failure. Исправление ожиданий потребует правки `scripts/pack-panels-smoke.mts`, файла вне Scope этой карточки; он не менялся. PR оставлен открытым до решения по Scope, мержа при красном CI не выполнял.

## Шов ядра

Шов ядра не потребовался: переход автомата реализован как чистая функция в паке; данные и тесты не требуют ветвления по `pack === 'state-ui'` в `src/core`. Реальный проигрыватель прошёл контрольный пошаговый прогон без изменений ядра, narrative или adventure.
