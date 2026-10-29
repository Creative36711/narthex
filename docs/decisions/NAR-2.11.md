# NAR-2.11 — narrative исполняется через PackHost

**Намерение.** Подключить уже объявленный шов к реальному исполнению из `GameEngine` и `cf-play`, не переписывая правила и не меняя эталон кампании. Это подготовка переноса кода в NAR-2.12, а не сам перенос.

## 1. Как подключён host

- В `src/core/pack/host.ts` добавлен только generic `PackSimBinding<State, Event, Frame>`: манифест, обязательный `sim` и начальное состояние пака. Правил сцен, диалогов и квестов здесь нет.
- `GameEngine.attachPackSim` в `src/core/engine.ts` создаёт `PackHost`, регистрирует код пака и возвращает host. `GameEngine.runPackSim` передаёт событие через host, сохраняет возвращённое паком состояние и считает успешные шаги. `packExecution` сообщает `packId`, id seam из манифеста и число шагов.
- `packs/narrative/runtime.ts` — connection-адаптер: читает неизменяемые данные Campaign Package, создаёт binding из существующих `createNarrativeHooks`/`createNarrativeState` и выбирает один реальный входной event для headless-проверки. `sim.ts`, `types.ts`, `hooks.ts`, `fmv.ts` и правила не изменены.
- `scripts/playkit/cli.mts` получает host от engine, проверяет `instanceof PackHost` и обязательно исполняет event для каждой статически валидной кампании. Для Ash это `goto`, для FMV — `fmv_ready`. JSON-отчёт содержит `pack: { packId: narrative, seam: narrative.sim, steps: 1, event, from, to }`; текстовый оракул не дополнен и не изменён.
- Новая команда `npm run probe:pack-execution` (`scripts/pack-execution-probe.mts`) доказывает путь `GameEngine → PackHost → narrative.sim` и отдельно проверяет bundled `cf-play check` на Ash и FMV. Маркер: `NARRATIVE_SIM_FROM_PACK=narrative.sim`.

Статический `analyzeCampaign` по-прежнему отвечает только за статику. Прежний sweep временно сохранён как эталонный оракул: подменять его числа результатом нового адаптера в карточке подключения означало бы скрытое изменение метрик. Теперь `check` — это не только campaign-audit: валидная кампания не может завершиться успешно без реального pack sim-шага.

## 2. Почему fallback невозможен

1. Binding без функции `sim` или без объявленного sim-seam отклоняется как `PACK_SIM_MISSING`.
2. Ошибка регистрации — `PACK_REGISTER_FAILED`; pause исполнения — `PACK_SIM_FAILED` с pack id, hook и причиной.
3. Вызов без binding — `PACK_RUNTIME_MISSING`; CLI также падает, если не получил `PackHost` или seam не исполнился ровно один раз.
4. Эти ошибки не перехватываются для возврата к legacy. Проба специально вызывает pause и получает `PACK_SIM_FAILED: narrative/sim: negative control`, при этом счётчик успешных шагов остаётся 0.
5. Статически невалидная кампания не запускает pack sim: она уже имеет точный статический diagnostic и failed verdict. Это не fallback, потому что успешный `check` без pack-шага невозможен.

## 3. Что пока остаётся в core и что уйдёт в 2.12

В NAR-2.11 core получил только generic host/adapter API. Новых genre-модулей в `src/core` нет; core graph по-прежнему содержит 34 модуля. `GameState` и прежние методы движка остаются эталонными на время подключения, поэтому состояние пака намеренно отделено и не подменяет save/state незаметно.

В core пока остаются прежние реализации `dialogue`, `dialogue-runtime`, `quests`, `scene-slots`, `encounters`, `world`, `social`, `director`, `roguelike` и связанные вызовы engine. В NAR-2.12 нужно переносить их в пак по одной контрактной границе, проецировать существующие saves/GameState в pack state, подключить browser call sites и заменить временный эталонный sweep на делегирование после побайтового parity. Только затем удаляются дублирующие genre-реализации core. Сам `packs/narrative/runtime.ts` не импортирует ни один из перечисленных genre-модулей.

## 4. «неясно / решил / откат»

### 4.1 Насколько полным должно быть делегирование в этой карточке

- **неясно** — «реально исполнять narrative» можно понять как немедленную замену всех методов engine, но `narrative.sim` пока не принимает часть переходов из core-эффектов и диалогов. Полная подмена изменила бы правила и эталон, что прямо запрещено.
- **решил** — сделать обязательный fail-fast host-boundary и исполнять настоящие события пака из engine и `cf-play`; не смешивать pack state с GameState и не трогать sweep-оракул до переноса. Это исполняемый код на основном пути `check`, а не probe-only файл или мёртвая декларация.
- **откат** — удалить `PackSimBinding`, методы `attachPackSim`/`runPackSim`, `packs/narrative/runtime.ts`, подключение в `cmdCheck`, новую пробу и этот ADR; пересобрать bundle штатной командой. Отдельный откат не потребуется для campaign data и genre rules: они не менялись.

### 4.2 Число 1/1 для adventure и расхождение D1

- **неясно** — формулировка приёмки связывает повторы adventure и FMV с «1 из 1», но существующий `ash-of-caerden-adventure` — копия 10-сценового Ash с обязательным покрытием 6/10. Подгонка под 1/1 была бы изменением оракула.
- **решил** — сохранить adventure 6/10 в обоих повторах; требование 1/1 применить к односценовому FMV-проекту, где оно относится к D1. Оба FMV-повтора дают 1/1. Причина исторического 0/0 — промежуточный лог до финального дерева PR #54, а не данные или финальный bundle: bundle из финального PR #54 на неизменных данных воспроизводит 1/1; bundle PR #53, PR #54 и squash-коммита побайтово совпадает; diff данных пуст. Текущие два прогона подтверждают это на одном SHA.
- **откат** — не применялся: изменение adventure на 1/1 потребовало бы запрещённой правки campaign data или oracle. Никакие ожидания не смягчены; противоречивая комбинация зафиксирована здесь явно.

## 5. Доказательство подключения

`npm run probe:pack-execution`, rc=0:

```text
NARRATIVE_SIM_FROM_PACK=narrative.sim
✓ GameEngine: PackHost + narrative.sim · event=goto · scene_gates_front → scene_gates_guardroom · steps=1
✓ fail-fast: без binding=PACK_RUNTIME_MISSING · pause=PACK_SIM_FAILED · legacy fallback не вызывается
✓ cf-play ash: seam=narrative.sim · event=goto · steps=1 · rc=0
✓ cf-play fmv: seam=narrative.sim · event=fmv_ready · steps=1 · rc=0
PACK_EXECUTION_PROBE passed
```

`grep -rn PackHost src/core/engine.ts scripts/playkit/cli.mts` находит и import/создание host в engine, и import/`instanceof` в CLI. Полный построчный вывод, diff по зонам и финальные rc собраны в Drive report-log.

## 6. Эталон Ash — полный вывод без сокращений

`node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden`, rc=0:

```text
# Проверка кампании · Пепел Каэрдена

✓ проверка пройдена

## Статика
10 сцен · 8 локаций · 6 диалогов · 21 узлов ink
ошибок 0 · предупреждений 8
- flag_written_never_read: флаг «guard_ration_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «herbs_gathered» выставляется, но нигде не читается
- flag_written_never_read: флаг «market_raid_repelled» выставляется, но нигде не читается
- flag_written_never_read: флаг «medallion_taken» выставляется, но нигде не читается
- flag_written_never_read: флаг «raid_rumors» выставляется, но нигде не читается
- flag_written_never_read: флаг «skeleton_looted» выставляется, но нигде не читается
- flag_written_never_read: флаг «tavern_chest_opened» выставляется, но нигде не читается
- flag_written_never_read: флаг «wrench_taken» выставляется, но нигде не читается

## Маршруты
маршрутов нет (/home/user/narthex/public/campaigns/ash-of-caerden/routes) — прогон только по seed'ам

## Матрица seed'ов
seed'ов 5 · исходы {"death":5}
смерти: {"death: Смерть от истощения: жажда на нуле.":1,"death: Вы пали в бою.":4}

## Покрытие
посещено 6 из 10 достижимых сцен
не покрыто: scene_gates_guardroom, scene_mine_deep, scene_mine_entrance, scene_ravine_camp
```

Вывод до и после подключения совпал (`diff rc=0`): 10 сцен, 8 локаций, 6 диалогов, 21 Ink knot, 0 ошибок, 8 предупреждений, пять смертей (1 истощение + 4 бой), покрытие 6/10.

## 7. Сводка гейтов

- `npx tsc -b` — rc=0.
- core graph — rc=0, 34 acyclic modules, no core imports of `engine.ts`.
- contracts — rc=0, 41 проверка; packs — три manifests; четыре исходные fixtures и добавленная в NAR-2.8 `panel-slot-collision` PASS.
- brand, version, campaign copies, playkit bundle freshness — rc=0.
- 54/54 существующих smokes — rc=0 (Vite на `:5173` для шести команд, которым он нужен).
- `pack-host`, `pack-execution`, `narrative-pack`, `fmv`, `adventure-mechanics`, `capability-modes` — все rc=0.
- Полный report-log с stdout/stderr и rc каждой команды выкладывается в Drive отдельно; ADR не заменяет его.
