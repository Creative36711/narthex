# NAR-5.4 — state-ui: карты, колоды и автобой

## Реализация

Всё поведение добавлено в `packs/state-ui/` как функции над данными без импорта из ядра и без ветвлений по ID пака:

- `schema/cards.schema.json` и `data/card-game.json` задают карты, типизированные эффекты `damage`/`block`, две колоды и параметры автобоя.
- `cards.ts` содержит перемешивание Фишера—Йетса с явным потоком значений `[0, 1)`, настройку снимка боя, взятие/розыгрыш карты и детерминированный автобой. Функции не используют скрытый RNG, часы, движок или мутации исходного состояния; автобой ограничен числом раундов.
- `validateCards.ts` проверяет корректность эффектов, уникальность ID и ссылки карт, колод и параметров автобоя.
- `cardsPanel.ts` строит read-only проекцию карт, эффектов, колод и настроек боя; манифест объявляет панель «Карты и колоды».
- `probe.mts` проверяет схему и ссылки, воспроизводимость shuffle, переход карты из draw pile в руку и discard после розыгрыша, применение эффекта и повторяемый результат автобоя. Ранее существующие проверки автомата и настоящий `cf-play` сохранены.
- Добавлены pure sim-швы `cards.play` и `auto-battle.resolve`; статусы контрактов для `state-machine`, `cards`, `auto-battle` не менялись.

## Вывод обязательных проверок

1. `npm run probe:state-ui` — **rc=0**. Существенные строки вывода:
   - `cards and decks: JSON Schema, reference validator, and read-only panel accept 4 cards / 2 decks`;
   - `deck setup and card move: explicit rolls shuffled counter, heavy, guard, jab; drew and played counter`;
   - `auto-battle: player after 4 rounds and 8 card plays`;
   - `real player: cf-play check verdict=ok, pack=narrative, seam=narrative.sim, rc=0`;
   - `STATE_UI_PROBE passed`.
2. `npm run check:packs` — **rc=0**; все четыре манифеста прошли schema/registry/caps/local-schema/import-boundary проверки; `check:packs passed`.
3. `npm run check:pack-boundary` — **rc=0**; для 37 файлов ядра подтверждено отсутствие ветвлений по ID пака и импортов из `packs/**`; `check:pack-boundary passed`.
4. `npm run smoke:view-write` — **rc=0**; вывод завершился `инвариант зелёный`.
5. `npm run check:contracts` — **rc=0** при последовательном запуске; `контракты согласованы: 42 проверок`, вложенные проверки паков и границы ядра также прошли. Первый запуск одновременно с `smoke:mission` вернул временный `ENOENT` для fixture-пути; повтор после завершения smoke прошёл. В `docs/contracts/caps.json` состояния `state-machine`, `cards`, `auto-battle` — `planned`; `docs/contracts/**` не менялся.
6. `git diff origin/main...HEAD -- src/core` — пусто; `git diff origin/main...HEAD -- docs/contracts` — пусто. `src/core/**` и `docs/contracts/**` не изменялись.

## Дополнительные проверки

- `npm run smoke:mission` — **rc=0**, `SUMMARY 55/55 passed`; панельный smoke завершился `PACK_PANELS_SMOKE passed`, обнаружил 4 пака и 14 панелей.
- `npx tsc --ignoreConfig --noEmit --target ES2023 --module ESNext --moduleResolution Bundler --strict --skipLibCheck --types node packs/state-ui/cards.ts packs/state-ui/cardsPanel.ts packs/state-ui/machine.ts packs/state-ui/panel.ts packs/state-ui/types.ts packs/state-ui/validate.ts packs/state-ui/validateCards.ts packs/state-ui/probe.mts` — **rc=0**, 0 предупреждений и ошибок.
- `npx oxlint packs/state-ui/cards.ts packs/state-ui/cardsPanel.ts packs/state-ui/probe.mts packs/state-ui/types.ts packs/state-ui/validateCards.ts` — **rc=0**.
- `npm run lint` — **rc=0**, 0 ошибок; репозиторный запуск сообщил 1509 предупреждений на 443 файлах.
- `npm ci` — **rc=0**.

В `scripts/pack-panels-smoke.mts` изменены только фиксированное равенство `livePanels` (`13 → 14`), подпись общего числа панелей и устаревший комментарий секции 6 («трёх» → «четырёх» паков). Проверки сохранены как строгие равенства; динамического расчёта ожиданий и изменений пункта 8 нет. Число паков остаётся 4.

## PR

**PR:** #126 — https://github.com/Creative36711/narthex/pull/126.
