# STAB-1.32 — итоговый отчёт Tools

- **Кодовый SHA, проверенный §4 и браузерным экзаменом:** `13cc4a55a7baccb10de5fd7375bf905beff8b172`.
- Исходный SHA ветки до этого изменения: `d07cbb8add85bc12c073c9ccb4d464ee9a726293`.
- Baseline `origin/main`: `fdc3246a6ede8fadb3e5cadeb13ec57d6b5370ae`.
- Ветка: `arena/e32b3b56-narthex`.
- ADR `docs/decisions/STAB-1.32.md`: **accepted**, дата `2026-11-01`; Мастер утвердил вариант A. B/C и первый снимок после animation frame отклонены.

## Итог

- Строгий exam сохраняет checkpoint images сразу после `image.complete`, до animation frame и до strict-success wait. Ранние counters/URL заморожены; settled-снимок хранится отдельно.
- Ожидание `image.complete && image.naturalWidth > 0` осталось и получает только остаток общего 3000-ms бюджета.
- Broken image разрешается как transient только при точном совпадении campaign/path/status/MIME/reason с разрешённым observation и исчезновении/исправлении к settled snapshot. Исходный checkpoint остаётся в отчёте. Persistent, неизвестный broken и любой empty `src` блокируют exam.
- Response filter проверяет точный зарегистрированный ответ; негативные пробы подтверждают блокировку и HTTP 500, и неверного MIME на том же известном пути.
- §4: **21/21 команд `rc=0`** на кодовом SHA `13cc4a5…`; все **71/71** ScriptCat test scripts завершились с `rc=0`.
- Строгий browser exam на двух маршрутах: **`rc=0`**, Chromium 131, 28 шагов, 0 findings.

## Before/after diff

Кодовый diff `d07cbb8…..13cc4a5…`: 5 файлов, 589 insertions, 80 deletions. Изменены только `scripts/visual/playthrough.mjs`, новые `scripts/visual/image-checkpoint.mjs` и `scripts/visual/image-checkpoint-probe.mjs`, `scripts/visual/response-filter-negative.mjs`, эта ADR. Эта evidence-версия отчёта добавлена отдельно. Защищённые и продуктовые пути не менялись.

| До | После |
|---|---|
| Первый счётчик в exam мог следовать за animation-frame barrier; fallback на следующем кадре мог убрать `<img>` до наблюдения. | Слушатели `load`/`error` фиксируют completed broken image до следующего кадра; checkpoint counters/URL неизменны после fallback. Strict-success ожидание идёт отдельно в остатке общего лимита. |
| Зелёный settled DOM мог затереть первоначальную ошибку. | Отчёт сохраняет checkpoint и settled отдельно; transient допускается только при точном разрешённом response и восстановлении. Иначе это finding. |
| Negative probe проверял только статусный mismatch. | Три отдельные реальные filter-пробы: зарегистрированный ответ, HTTP 500 и неверный MIME на том же path; exit code выводится из `blocking.length`. |

Ключевой кодовый переход в `step()`:

```js
const imageObservation = await observeImageCheckpoint(page, {
  inspectImages: true,
  timeoutMs: IMAGE_CHECKPOINT_BUDGET_MS, // общий предел 3000 ms
})
// imageObservation.checkpoint frozen до кадра; .settled — после strict wait.
```

`observeImageCheckpoint` сначала фиксирует состояние при `image.complete`; затем вызывает `waitForImagesSuccessful` с вычисленным остатком бюджета. Между этими точками нет `requestAnimationFrame`.

## Браузерные image-checkpoint пробы

Команда на финальном кодовом SHA: `node scripts/visual/image-checkpoint-probe.mjs all`. Chromium `131.0.6778.0`. Агрегатный процесс завершился `rc=1` **ожидаемо**: три синтетические неисправности должны дать production finding; healthy control — `rc=0`. Внутри probe все assertions прошли. Формат `checkpoint/settled` показывает, что следующий-кадр fallback не стирает ранний FAIL.

```text
IMAGE-CHECKPOINT-PROBE case=temporary attempts=8/8 browser=Chromium 131.0.6778.0 results=[1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true; 1/0 broken, empty=0/0, fallback=true] retained-findings=8/8 wait-budget=3000ms production-rc=1
IMAGE-CHECKPOINT-PROBE case=persistent attempts=1/1 browser=Chromium 131.0.6778.0 results=[1/1 broken, empty=0/0, fallback=true] retained-findings=1/1 wait-budget=3000ms production-rc=1
IMAGE-CHECKPOINT-PROBE case=empty-src attempts=1/1 browser=Chromium 131.0.6778.0 results=[1/0 broken, empty=1/0, fallback=true] retained-findings=1/1 wait-budget=3000ms production-rc=1
IMAGE-CHECKPOINT-PROBE case=healthy attempts=1/1 browser=Chromium 131.0.6778.0 results=[0/0 broken, empty=0/0, fallback=true] retained-findings=0/1 wait-budget=3000ms production-rc=0
```

- Temporary: каждый из 8 broken `<img>` был в checkpoint, удалён fallback следующего кадра, но остался finding (`1/0`, `8/8`, `rc=1`).
- Persistent: fallback отображён, broken image остался (`1/1`, `rc=1`).
- Empty `src`: он был сохранён в checkpoint до fallback (`empty=1/0`), finding не исчез (`rc=1`).
- Healthy control: fallback после load, broken/empty не обнаружены (`0/0`, `rc=0`).

## Production response-filter probes

Команда: `node scripts/visual/response-filter-negative.mjs <registered|status-500|wrong-mime>`. Все три сценария вызывают `splitCampaignResponseFailures()` production filter; `production-rc` и фактический process rc следуют из числа blocking failures.

| Сценарий | Фактический вывод | Фактический rc |
|---|---|---:|
| точный registry response `200 text/html` | `RESPONSE-FILTER-PROBE PASS case=registered pathOnlyWouldSuppress=true; blocking=0; nonBlocking=0; production-rc=0; record=200 text/html; path=ash-of-caerden/assets/img/arenas/camp_topdown.jpg` | 0 |
| тот же известный path, HTTP 500 | `RESPONSE-FILTER-PROBE PASS case=status-500 pathOnlyWouldSuppress=true; blocking=1; nonBlocking=0; production-rc=1; record=500 text/html; path=ash-of-caerden/assets/img/arenas/camp_topdown.jpg` | 1 |
| тот же известный path, неверный MIME | `RESPONSE-FILTER-PROBE PASS case=wrong-mime pathOnlyWouldSuppress=true; blocking=1; nonBlocking=0; production-rc=1; record=200 application/json; path=ash-of-caerden/assets/img/arenas/camp_topdown.jpg` | 1 |

`pathOnlyWouldSuppress=true` показывает исходную слепую зону: один path скрыл бы оба несовпадающих ответа. Ненулевые коды не задаются безусловно: для каждого несовпадения реальный filter вернул `blocking=1`, и это вычислило `rc=1`.

## Нормальный strict visual exam

Команда: `npm run playthrough:exam -- http://127.0.0.1:4173 /tmp/stab132-finalsha-playthrough-exam`.

- Финальный кодовый SHA `13cc4a5…`; UTC `03:56:15`–`03:57:20`; **`rc=0`**.
- Chromium 131.0.6778.0; `ash-of-caerden` — 12 шагов, `ash-of-caerden-adventure` — 16, всего 28.
- Оба маршрута: `PASS`; `pageerror=0`, `errorScreens=0`, `brokenImgBlocking=0`, `brokenImgCheckpoint=0`, `emptySrc=0/0`, `rawNpcIds=0`, `unexplained=0`.
- Реестр: absences `54/54`, console errors `18/18`, drift `0`; сохранение и восстановление narrative-маршрута прошли.
- Финалы: `ash-of-caerden → ending_ashes`; `ash-of-caerden-adventure → ending_gate_unlocked`.
- Итоговый вывод: `RESULT: PASS; packs=2; steps=28; findings=0`.

## §4 — полный прогон на кодовом SHA `13cc4a5…`

Node `v22.22.3`; команды из `docs/agents/tz-stab-1.md` §4 выполнялись в заданном порядке. Окно UTC `03:50:11`–`03:55:48`. Все команды — `rc=0`; ScriptCat loop включил все 71 файла `.mjs` и остановился бы на первом ненулевом rc.

| № | Команда | Начало UTC | Конец UTC | сек. | rc |
|---:|---|---|---|---:|---:|
| 1 | `npm ci` | 03:50:11 | 03:50:15 | 4 | 0 |
| 2 | `npm run check:audit-bundle` (до build) | 03:50:15 | 03:50:18 | 2 | 0 |
| 3 | `npx tsc -b` | 03:50:18 | 03:50:33 | 16 | 0 |
| 4 | `for t in _tools/ScriptCat/tests/*.mjs; do node "$t" || exit 1; done` (71 файла) | 03:50:33 | 03:50:44 | 11 | 0 |
| 5 | `npm run check:contracts` | 03:50:44 | 03:50:58 | 14 | 0 |
| 6 | `npm run check:core-graph` | 03:50:58 | 03:50:58 | 0 | 0 |
| 7 | `npm run check:module-size` | 03:50:58 | 03:50:58 | 0 | 0 |
| 8 | `npm run check:brand` | 03:50:58 | 03:50:59 | 0 | 0 |
| 9 | `npm run check:version` | 03:50:59 | 03:50:59 | 0 | 0 |
| 10 | `npm run check:guide` | 03:50:59 | 03:51:05 | 6 | 0 |
| 11 | `npm run check:playkit-bundle` | 03:51:05 | 03:51:05 | 0 | 0 |
| 12 | `npm run check:campaigns` | 03:51:05 | 03:51:06 | 0 | 0 |
| 13 | `npm run check:compat-corpus` | 03:51:06 | 03:51:11 | 5 | 0 |
| 14 | `npm run check:narrative-codes` | 03:51:11 | 03:51:11 | 0 | 0 |
| 15 | `npm run smoke:core` | 03:51:11 | 03:51:11 | 0 | 0 |
| 16 | `npm run smoke:mission` | 03:51:11 | 03:52:50 | 99 | 0 |
| 17 | `npm run cf-play:negative` | 03:52:50 | 03:52:52 | 2 | 0 |
| 18 | `npm run lint` | 03:52:52 | 03:52:53 | 1 | 0 |
| 19 | `npm run build` | 03:52:53 | 03:53:11 | 18 | 0 |
| 20 | `npm run check:audit-bundle` (после build) | 03:53:11 | 03:53:13 | 2 | 0 |
| 21 | `npm run check:mission` | 03:53:13 | 03:55:48 | 155 | 0 |

## Audit bundle и Golden

После §4 на финальном кодовом SHA выполнен дополнительный обычный `npm run build`:

- до build: SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`;
- после build: тот же SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`;
- `npm run build` — `rc=0`; `cmp=0`; `npm run check:audit-bundle` — `rc=0`.

**Часовой Golden не требуется в STAB-1.32; STAB-1.30 запускает его повторно.** Ручной hourly Golden в этой карточке не заявляется.

## Scope и финальное состояние

Изменены только `scripts/visual/**`, `docs/decisions/STAB-1.32.md` и `_tools/reports/STAB-1.32.md`. Не менялись `.github/workflows/golden.yml`, `.github/workflows/visual.yml`, `src/**`, `public/**`, `packs/**`, `.golden/**`, `public/campaigns/**`, `docs/contracts/**` и `_tools/visual/allowed-observations.json`. Browser packages установлены локально через `npm i --no-save @sparticuz/chromium@131 playwright-core@1.49.1`; `package.json` и lockfile не менялись.

Проверить при закрытии: worktree чистый, `dist-ai/` отсутствует. Скриншоты и browser probe logs находятся только в `/tmp`, не в Git.
