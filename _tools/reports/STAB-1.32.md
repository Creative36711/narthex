# STAB-1.32 — итоговый отчёт Tools

- Проверенный код SHA: `c4743d67ce7f41907ca99598c20d493b1a670cca`.
- Baseline `origin/main`: `fdc3246a6ede8fadb3e5cadeb13ec57d6b5370ae`.
- Ветка: `arena/e32b3b56-narthex`.
- Состояние ADR: `proposed`; рекомендация карточки — восстановить прежнюю точку проверки. Ответ Мастера ожидается.

## Итог

- Восстановлено ожидание `image.complete`; вместо ожидания успеха `naturalWidth > 0` harness даёт один animation frame на dispatch `error` и commit React fallback. Все прежние проверки оставшегося DOM, пороги `brokenImages`/`emptySrcImages`, шаги и конечные состояния сохранены.
- Путь-исключение заменён на fail-closed соответствие точному разрешённому observation из реестра: canonical campaign/path, статус, content-type, reason и ожидаемое единичное occurrence. HTTP 500 или любой другой mismatch на известном пути остаётся blocking.
- Строгий browser exam после изменений: `rc=0`, оба пака пройдены, 28 шагов, 0 findings.
- §4: `21/21 rc=0`; цикл ScriptCat прошёл `71/71`.
- Golden bundle до/после build: SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`, `cmp=0`.

## PR #192: защищённый путь и точка проверки

PR #192 (`STAB-1.27: stabilize strict visual image observations`, merge SHA `fdc3246…`) изменил три файла. Точный защищённый workflow-путь в diff: **`.github/workflows/golden.yml`**. PR добавил `scripts/visual/playthrough.mjs` в path-фильтры `pull_request` и `push` и добавил публикацию границ soak в summary/notice. `.github/workflows/golden.yml` не содержит проверки `<img>` и STAB-1.32 его не меняет.

Фактическая точка находится в `scripts/visual/playthrough.mjs`:

**До PR #192:**

```js
await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 3000 }).catch(() => {})
```

**После PR #192:**

```js
await page.waitForFunction(
  () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  undefined,
  { timeout: 3000 },
).catch(() => {})
```

Ожидание успешной загрузки могло занять все 3 секунды, пока React `onError` снимал намеренно отсутствующий `<img>` и ставил fallback. Это перемещало снимок на более позднее состояние и могло скрыть наблюдаемое broken image.

**После STAB-1.32:**

```js
await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 3000 }).catch(() => {})
await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(resolveFrame)))
```

Предикат `naturalWidth > 0` не используется. Один кадр — только граница commit обработчика ошибки, а не успешная загрузка или дополнительный grace period: если broken `<img>` остаётся в DOM после своего fallback-обработчика, существующий строгий подсчёт видит его и даёт finding. Пороговые значения не менялись.

Первый диагностический прогон сразу после возврата одного лишь `image.complete` завершился `rc=1`: снимок поймал один переходный `<img>` `gates_front_day.jpg` до React commit. Добавлен один frame barrier; итоговый строгий прогон ниже прошёл с теми же порогами. Это не скрывает persistent broken image и не меняет seed, число повторов/шагов, browser/parity-тесты, обработку ненулевых кодов возврата или `pipefail`.

## Фильтр известных путей и отрицательная проба

Вместо двух path-only проверок `knownAbsencePaths.has(failure.path)` `playthrough.mjs` использует `splitCampaignResponseFailures()` из `observation-policy.mjs`. Разрешено только точное совпадение ответа с зарегистрированным audit observation. Существующие исключения для legacy `project.json` и `encounters/encounters.json` сохранены; все остальные неподходящие и некорректные ответы fail closed.

Новый `scripts/visual/response-filter-negative.mjs` использует настоящий D-076 marker и observation registry для `ash-of-caerden/assets/img/arenas/camp_topdown.jpg`:

| Проба | Результат | Код |
|---|---|---:|
| Точный ожидаемый registered `200 text/html`, правильный reason/campaign/path | Разрешён; blocking = 0 | проверка пройдена |
| Посторонний `HTTP 500` на том же известном пути | Старый path-only predicate подавил бы его; новый production partition выдаёт `blocking = 1` | `rc=1`, ожидаемо |

Фактический вывод: `NEGATIVE-PROBE PASS: path-only-suppressed=true; exact-known=allowed; unrelated status=500 on ash-of-caerden/assets/img/arenas/camp_topdown.jpg => blocking=1; intentional exit rc=1`. Скрипт специально возвращает `1` после успешных assertions, чтобы отрицательный ответ действительно демонстрировал ожидаемый fail. Вызов проверен wrapper-ом: assertion-маркер присутствовал, фактический код `1`.

## Нормальный visual exam

Команда: `npm run playthrough:exam -- http://127.0.0.1:4173 /tmp/stab132/verified-c4743d6-playthrough-exam`.

- Время UTC: `2026-11-01T02:46:31Z`–`2026-11-01T02:47:36Z`; длительность 65 секунд; **`rc=0`**.
- Реальный Chromium 131.0.6778.0; narrative — 12 шагов, adventure — 16, всего 28.
- `pageErrors=0`, `errorScreens=0`, broken/empty-src images `0/0`, findings `0`.
- D-076 absences зарегистрированы `54/54`, console observations `18/18`, unexplained/drift `0/0`.
- Финалы: `ash-of-caerden → ending_ashes`; `ash-of-caerden-adventure → ending_gate_unlocked`.

## §4 — полный запуск на проверенном коде `c4743d6…`

Выполнено в порядке из `docs/agents/tz-stab-1.md` §4. Все 21 команды — `rc=0`. Время UTC; длительность округлена до секунд.

| № | Команда | Начало UTC | Конец UTC | сек. | rc |
|---:|---|---|---|---:|---:|
| 1 | `npm ci` | 02:40:56 | 02:41:00 | 4 | 0 |
| 2 | `npm run check:audit-bundle` (до build) | 02:41:00 | 02:41:02 | 2 | 0 |
| 3 | `npx tsc -b` | 02:41:02 | 02:41:17 | 15 | 0 |
| 4 | `for t in _tools/ScriptCat/tests/*.mjs; do node "$t" \|\| exit 1; done` (71 тест) | 02:41:17 | 02:41:27 | 10 | 0 |
| 5 | `npm run check:contracts` | 02:41:27 | 02:41:40 | 13 | 0 |
| 6 | `npm run check:core-graph` | 02:41:41 | 02:41:41 | 0 | 0 |
| 7 | `npm run check:module-size` | 02:41:41 | 02:41:41 | 0 | 0 |
| 8 | `npm run check:brand` | 02:41:41 | 02:41:41 | 0 | 0 |
| 9 | `npm run check:version` | 02:41:41 | 02:41:42 | 1 | 0 |
| 10 | `npm run check:guide` | 02:41:42 | 02:41:47 | 5 | 0 |
| 11 | `npm run check:playkit-bundle` | 02:41:47 | 02:41:48 | 1 | 0 |
| 12 | `npm run check:campaigns` | 02:41:48 | 02:41:48 | 0 | 0 |
| 13 | `npm run check:compat-corpus` | 02:41:48 | 02:41:52 | 4 | 0 |
| 14 | `npm run check:narrative-codes` | 02:41:52 | 02:41:53 | 1 | 0 |
| 15 | `npm run smoke:core` | 02:41:53 | 02:41:53 | 0 | 0 |
| 16 | `npm run smoke:mission` | 02:41:53 | 02:43:31 | 98 | 0 |
| 17 | `npm run cf-play:negative` | 02:43:31 | 02:43:33 | 2 | 0 |
| 18 | `npm run lint` | 02:43:33 | 02:43:34 | 1 | 0 |
| 19 | `npm run build` | 02:43:34 | 02:43:51 | 17 | 0 |
| 20 | `npm run check:audit-bundle` (после build) | 02:43:51 | 02:43:53 | 2 | 0 |
| 21 | `npm run check:mission` | 02:43:53 | 02:46:20 | 147 | 0 |

## Audit bundle и Golden

- До сборки `public/ai/campaign-audit.mjs`: SHA-256 `0298805c8c6c038155500fc4dd7b67fc0f0f51c5ead761dea32eb476ee2ca9b8`, размер 1 006 226 bytes.
- После `npm run build`: тот же SHA-256 и размер; `cmp=0`. `check:audit-bundle` до и после build — `rc=0`.
- **Часовой Golden не требуется в STAB-1.32; карточка STAB-1.30 запустит его повторно.** Здесь Golden не запускался и его результат не заявляется.

## Scope и финальное состояние

Изменены только `scripts/visual/playthrough.mjs`, `scripts/visual/observation-policy.mjs`, новый `scripts/visual/response-filter-negative.mjs`, `docs/decisions/STAB-1.32.md` и этот отчёт. `.github/workflows/golden.yml`, `.github/workflows/visual.yml`, `scripts/golden/**`, `_tools/visual/allowed-observations.json`, `scripts/check-determinism.mts`, `scripts/check-parity.mts`, `package.json`/lockfile и все запрещённые продуктовые/эталонные пути не менялись. Временные browser-пакеты установлены только локально по инструкции `docs/agents/browser.md`, без изменения manifest/lock.

После добавления отчёта он коммитится отдельно как evidence-only; проверенный код SHA остаётся `c4743d67ce7f41907ca99598c20d493b1a670cca`. После этого коммита финальная проверка: worktree чистый, `dist-ai/` отсутствует.
