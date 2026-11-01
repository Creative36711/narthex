# STAB-1.32 — ADR: точка проверки битых изображений и фильтр известных путей

- Статус: accepted
- Дата: 2026-11-01
- Baseline main: `fdc3246a6ede8fadb3e5cadeb13ec57d6b5370ae`
- Ответ Мастера: вариант A принят 2026-11-01 (run `a01bcd83-36c7-4c9e-9af0-47a1e95b4aee`).

## Неясно

- PR #192 (`c78bb16` → `fdc3246`) изменил защищённый `.github/workflows/golden.yml`: добавил `scripts/visual/playthrough.mjs` в path-фильтры и публикацию границ soak. Эти изменения workflow не являются проверкой момента снимка.
- Код изображения находится в `scripts/visual/playthrough.mjs`. PR #192 сменил ожидание `image.complete` на ожидание `image.complete && image.naturalWidth > 0`; оно может ждать fallback до 3000 ms и тем самым снимать состояние уже после удаления broken `<img>`.
- Предыдущий PR #193 также поставил animation frame перед снимком и убрал строгое ожидание успешной загрузки. Chromium 131 probe показал, что при fallback на следующем кадре снимок после кадра видит 0 broken `<img>` из 8, а снимок до кадра видит 8 из 8; поэтому кадр перед первым снимком теряет наблюдение.
- Ответы по известному D-076 пути нельзя разрешать только по path: HTTP 500 либо неверный MIME на том же пути не являются зарегистрированным отсутствием.

## Что именно меняет PR #192

Точный защищённый путь из списка PR #192: `.github/workflows/golden.yml`. Он не меняется в STAB-1.32. Судьба его path-фильтров/soak notice не утверждена ответом по этой ADR; отдельное решение — STAB-1.34.

Фактическая точка — `scripts/visual/playthrough.mjs`.

До PR #192:

```js
await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 3000 }).catch(() => {})
```

После PR #192:

```js
await page.waitForFunction(
  () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  undefined,
  { timeout: 3000 },
).catch(() => {})
```

Вариант PR #193 — снимок после animation frame без сохранения строгого ожидания — отклонён. Вариант A сохраняет старую точку счётчиков и добавляет строгое ожидание после неё в том же лимите:

```js
const imageObservation = await observeImageCheckpoint(page, {
  inspectImages: true,
  timeoutMs: IMAGE_CHECKPOINT_BUDGET_MS, // 3000 ms total
})
// observeImageCheckpoint: wait for image.complete → freeze checkpoint counters →
// wait for image.complete && image.naturalWidth > 0 using the remaining budget.
```

`checkpoint` хранит счётчики/URL до строгого ожидания; `settled` хранится отдельно и не перезаписывает ранние наблюдения. Между ними нет `requestAnimationFrame`. Общий бюджет обоих ожиданий — не более 3000 ms; второе ожидание получает только остаток.

## Решил — вариант A принят

1. Восстановить прежнюю временную точку: после `image.complete` снять и сохранить `brokenImages`, `emptySrcImages`, портреты и URL каждого наблюдения немедленно, до кадра и до ожидания `naturalWidth > 0`.
2. Сохранить дополнительное строгое ожидание `image.complete && image.naturalWidth > 0`, но отдать ему только остаток общего 3000-ms бюджета. Снимок/счётчики checkpoint остаются неизменны после fallback.
3. Разрешать переходный broken image как намеренное отсутствие только при точном совпадении фактического campaign/path/status/MIME/reason с `classification: allowed` в реестре и если image исчез/исправился к settled snapshot. Его исходный checkpoint-счётчик всё равно остаётся в отчёте. Нерегистрируемый transition и persistent broken image дают finding; пустой `src` всегда остаётся finding.
4. Для resource failures оставить fail-closed matcher: точный зарегистрированный ответ допустим, а несоответствие campaign/path/status/content-type/reason блокируется. Не фильтровать по одному пути.
5. Оставить seed, число шагов/повторов, image-пороги, browser/parity-набор, обработку ненулевого rc и `pipefail` без изменений.
6. `.github/workflows/golden.yml` и его изменения из PR #192 не менять; их решение относится к STAB-1.34.

### Рассмотренные варианты

- **A — вернуть прежнюю точку, сохранить строгий wait в остатке того же лимита. Принят.** Счётчики фиксируются до fallback; результат после fallback не может превратить сохранённый неожиданный FAIL в PASS.
- **B — принять ожидание `complete && naturalWidth > 0` как первую точку с обоснованием остаточного риска. Отклонён Мастером.** Оно может снять наблюдение после замены broken `<img>`.
- **C — оставить текущую точку без изменения. Отклонён Мастером.** Вариант не закрывает потерю раннего наблюдения.
- Сдвиг первого снимка на animation frame также отклонён: синтетическая проба показала потерю всех 8/8 временно битых image.

## Проверяемые пробы

`image-checkpoint-probe.mjs` использует тот же production helper, запускает Chromium и фиксирует оба снимка. Временный broken image, удалённый fallback на следующем кадре, должен остаться ранним FAIL; постоянный broken image и пустой `src` также должны дать FAIL; исправная картинка должна пройти. Таймаут каждой пробы подтверждает общий предел 3000 ms.

`response-filter-negative.mjs` запускает production partition отдельно для точной записи, HTTP 500 на известном пути и неверного MIME на том же пути. Код возврата вычисляется из `blocking.length`; для двух несовпадений ожидается `rc=1`, для точной записи — `rc=0`.

## Откат

Откат разрешён только отдельной принятой ADR. Возвратить freeze counters после `image.complete`, удалить strict `complete && naturalWidth > 0` или перенести первый снимок за animation frame можно лишь новым решением; при любом изменении сохранить лимит, исходные счётчики, negative probes и проверку persistent broken/empty-src. Не менять защищённый `.github/workflows/golden.yml` в рамках STAB-1.32.
