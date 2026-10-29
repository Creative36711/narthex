# NAR-4.13 — Возврат-4: эталонные числа пошагового мира не сдвинулись

- Дата: **2026-10-28**
- Dispatch: `4076f0cf-5705-8172-a127-e69f3602b0cf`
- Run: `991f82dc-4916-4e1c-9450-b5e3b6a4fd20`
- Проверенная база: свежий `origin/main` = `8f1553b5073de252f5c74a48fab7dd2cb0d50b2a`.
- Ветка сессии: `arena/d8a1eee2-narthex`.

## Итог

**Замечание 4 закрыто.** Эталонные показатели Ash и realtime из [NAR-4.9](NAR-4.9.md) совпали с текущими; поддерживаемый `cf-play cycles` подтвердил все realtime assertions. `npm run playthrough:exam` прошёл на обоих паках. Все перечисленные локальные проверки завершились с rc=0.

Есть одна ограниченная CLI-оговорка: буквальный `cf-play check _tools/projects/realtime-wall` возвращает rc=2, потому что `check` принимает каталог кампании с `campaign.json`, тогда как realtime fixture — проект с `project.json`, `route.json` и `world.json`. Это не замалчивается и не считается успешным `check`; assertions fixture проверены штатным `cf-play cycles` (rc=0).

Фаза 4 **не начинается**. Исходники, тесты, пороги и состояние фаз не менялись; единственные tracked-изменения этой карточки — этот отчёт и [решение NAR-4.13](../../docs/decisions/NAR-4.13.md).

## База и среда

Перед проверками `git fetch origin main` завершился успешно; `HEAD`, `origin/main` и `merge-base` совпали на `8f1553b5073de252f5c74a48fab7dd2cb0d50b2a`, worktree был чистым. Все проверки выполнены локально на этой базе до документальных правок.

- Машина: `e2b.local`, Intel(R) Xeon(R) Processor @ 2.60 GHz, 2 видимых logical CPU.
- ОС: Debian GNU/Linux 12 (bookworm), Linux `6.1.158+`, x86_64.
- Node: `v22.22.3`; npm: `10.9.8`.
- `npm ci --ignore-scripts`: rc=0, установлено 70 пакетов из lock-файла; tracked dependency-файлы не изменились. npm audit сообщил об одной moderate vulnerability.
- Для локального браузерного прогона временно установлены без сохранения в manifest/lock `@sparticuz/chromium@131` и `playwright-core@1.49.1`; после exam выполнен `npm ci --ignore-scripts` (rc=0), чтобы вернуть lock-зависимости. Браузер: Chromium `131.0.6778.0`.

## Сравнение с NAR-4.9

| Эталон | NAR-4.9 | Текущий прогон | Сверка |
|---|---|---|---|
| Ash, `cf-play check`: сцены / локации / диалоги / Ink knots | 10 / 8 / 6 / 21 | 10 / 8 / 6 / 21 | Совпало |
| Ash, статические ошибки / предупреждения | 0 / 8 | 0 / 8 | Совпало |
| Ash, seed-матрица / покрытие | 5 seeds → 5 death; 6/10 сцен | 5 seeds → 5 death; 6/10 сцен | Совпало |
| Ash, `cycles`: step calls; clock; итог | 1; 28,800,000 → 32,400,000 ms; tick 9, `scene_gates_front`, `loc_gates` | 1; 28,800,000 → 32,400,000 ms; tick 9, `scene_gates_front`, `loc_gates` | Совпало |
| Ash fingerprints (initial → final) | `ed2cd114d72ab278` → `3e183cbc9ce9a358` | `ed2cd114d72ab278` → `3e183cbc9ce9a358` | Совпало |
| Realtime, `cycles`: calls; clock; позиция; стена; checkpoint | 11; 0 → 220 ms; x=6, y=10; max_x=12; wall contacts=1; zone triggers=1; checkpoint activated | 11; 0 → 220 ms; x=6, y=10; max_x=12; wall contacts=1; zone triggers=1; checkpoint activated | Совпало |
| Realtime fingerprints (initial → final) | `9910f683b96eba27` → `c585e2c26d21ed7e` | `9910f683b96eba27` → `c585e2c26d21ed7e` | Совпало |
| `playthrough:exam` | PASS; 2 packs, 20 steps, 0 findings; Ash → `ending_ashes`, Adventure → `ending_gate_unlocked` | PASS; 2 packs, 20 steps, 0 findings; те же два ending ID | Совпало |

Для fingerprint-сверки текущий `cycles --json` был дополнительно сопоставлен с указанными значениями NAR-4.9 программно: `reference_comparison=MATCH`; задействованы `realtime,turn`, пропущенных runtime нет.

## Выполненные команды и результаты

`rc` — фактический код возврата команды. Команды проверок запущены локально; `out/` и браузерные скриншоты — игнорируемые временные результаты, не deliverables.

| Команда | rc | Ключевые значения |
|---|---:|---|
| `node public/ai/cf-play.mjs check public/campaigns/ash-of-caerden` | 0 | 10 сцен; 8 локаций; 6 диалогов; 21 Ink knot; 0 ошибок; 8 предупреждений; 5/5 seed исхода death; покрытие 6/10. Совпадает с NAR-4.9. |
| `node public/ai/cf-play.mjs check _tools/projects/realtime-wall --out /tmp/nar413-check-realtime` | 2 | Ограничение CLI: «нет campaign.json — это не папка кампании». Не засчитано как прошедшая проверка; realtime fixture не является кампанией. |
| `node public/ai/cf-play.mjs cycles` | 0 | Поддерживаемый runner загрузил `_tools/projects/realtime-wall`; 2/2 проекта и 2/2 runtime прошли, 0 отсутствующих runtime. Realtime `realtime-wall-zone`: 11 calls, 0→220 ms, x=6/y=10, max_x=12, контакты стены=1, триггер checkpoint=1, `checkpoint-activated`. Ash: 1 call, clock 28,800,000→32,400,000 ms, tick=9. |
| `node public/ai/cf-play.mjs cycles --json` + сравнение с NAR-4.9 | 0 | Ash fingerprints `ed2cd114d72ab278` → `3e183cbc9ce9a358`; realtime `9910f683b96eba27` → `c585e2c26d21ed7e`; `reference_comparison=MATCH`. Assertions проекта все `ok=true`. |
| `npm run playthrough:exam` | 0 | Chromium 131.0.6778.0; `PASS`; packs=2; steps=20; findings=0. Ash: 8 шагов, ending=`ending_ashes`; Adventure: 12 шагов, ending=`ending_gate_unlocked`; pageerror=0, broken/empty img=0, raw NPC IDs=0. |
| `npx tsc -b` | 0 | TypeScript build check без ошибок. |
| `npm run check:contracts` | 0 | 42 контрактные проверки; pack, boundary, decisions, module-size, browser/dev guards, campaign formats и входящие contract smokes прошли. |
| `npm run check:brand` | 0 | Старое имя не найдено; проверено 1,103 файла. |
| `npm run check:version` | 0 | Версия `0.9.0` согласована между package, lock, Cargo/Tauri, guide и changelog. |
| `npm run check:core-graph` | 0 | 29 модулей; граф ацикличен; core не импортирует `engine.ts`. |
| `npm run check:module-size` | 0 | Пределы 450 / facade 600 соблюдены; `src/core/engine.ts` — 594/600 строк. |
| `npm run smoke:core` | 0 | Все semantic anchors зелёные (tick, flags, needs, HP/game-over, depth cap и др.). |
| `npm run build` | 0 | `tsc -b`, AI bundle и Vite production build завершились; преобразовано 1,440 модулей. |

## Вывод

Числа пошагового мира и realtime fixture не сдвинулись относительно NAR-4.9; браузерный экзамен и все перечисленные локальные инструменты прошли. Единственная команда с rc=2 — буквальный `cf-play check` на realtime project directory; её типовое ограничение явно зафиксировано выше, а проектные assertions прошли штатный `cycles`. Это закрытие Возврата-4 не открывает Фазу 4.
