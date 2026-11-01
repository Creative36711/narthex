# STAB-1.32 — ADR: точка проверки битых изображений и фильтр известных путей

- Статус: proposed
- Дата: 2026-11-01
- Baseline main: `fdc3246a6ede8fadb3e5cadeb13ec57d6b5370ae`

## Неясно

- В PR #192 (`c78bb16` → `fdc3246`) изменён защищённый workflow-файл `.github/workflows/golden.yml`: в `pull_request.paths` и `push.paths` добавлен `scripts/visual/playthrough.mjs`, а после golden-проверок добавлена публикация границ soak. Эти строки сами по себе не меняют временную точку проверки изображения.
- Проверка времени находится в другом файле того же PR — `scripts/visual/playthrough.mjs`. Изменение `step()` может отложить снимок до тех пор, пока React fallback удалит неудачный `<img>` из DOM; тогда данная ситуация уже не попадёт в подсчёт `brokenImages`.
- Фильтр `blockingResourceFailures` пропускает все ошибки, если совпал только `failure.path` с D-076 путём. Он не проверяет статус, content-type или reason конкретного ответа; посторонний HTTP 500 на том же пути поэтому мог исчезнуть из результата.

## Что именно изменено в PR #192

### Защищённый путь из diff

Точный защищённый путь из списка PR #192: `.github/workflows/golden.yml`. В нём PR добавил путь `scripts/visual/playthrough.mjs` в оба списка запуска workflow и шаг публикации уже существующих времён soak. Файл не содержит изменённой точки проверки `<img>`; в STAB-1.32 его содержимое не меняется.

### Фактическая временная точка в `scripts/visual/playthrough.mjs`

Фрагмент до PR #192:

```js
await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 3000 }).catch(() => {})
```

Фрагмент, добавленный PR #192:

```js
await page.waitForFunction(
  () => [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  undefined,
  { timeout: 3000 },
).catch(() => {})
```

Итоговый фрагмент STAB-1.32 возвращает старое условие `image.complete` и после его завершения даёт ровно один animation frame для доставки `error`-события и commit React fallback:

```js
await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 3000 }).catch(() => {})
await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(resolveFrame)))
```

PR #192 ждал успешной загрузки всех оставшихся изображений; для broken image ожидание могло дойти до 3-секундного таймаута, за который React `onError` успевал убрать `<img>` в пользу fallback. Следующий снимок проверял уже суженный набор ситуаций. STAB-1.32 не использует `naturalWidth > 0` как условие ожидания: после одной frame все оставшиеся `<img>` всё ещё проверяются прежними `brokenImages`/`emptySrcImages` порогами. Frame не является 3-секундным grace period для загрузки: если broken `<img>` не удалён fallback-ом после своего `error`-обработчика, он остаётся в DOM и экзамен проваливается. Seed, число шагов/повторов, browser/parity-команды, non-zero rc handling и `pipefail` не изменяются.

## Варианты

Точка проверки рассматривается отдельно от обязательного исправления фильтра ответов: при любом варианте ниже посторонний ответ на D-076 пути должен остаться blocking.

1. **Вернуть прежнюю точку** — ждать `image.complete` с прежним пределом 3000 ms, дать один animation frame на commit `onError` fallback и зафиксировать все оставшиеся `<img>`. Сохранить все проверки `brokenImages`/`emptySrcImages` и закрыть path-only исключение фильтра. **Default этой ADR и вариант, применённый в STAB-1.32.**
2. **Принять новую точку** — оставить ожидание `image.complete && image.naturalWidth > 0` только с явным решением Мастера и обоснованием остаточного риска: broken image, заменённый fallback до снимка, не будет учтён как broken `<img>` в этой точке.
3. **Оставить точку как есть** — сохранить поведение PR #192 и описанный выше риск; это не закрывает исходную находку о полноте наблюдения.

До ответа Мастера запись остаётся `proposed`. Вопрос и три варианта передаются в поле `question` маркера этой сдачи; предложенное карточкой действие по умолчанию — вариант 1. Исправление фильтра независимо от выбора временной точки остаётся обязательным: исключать ответ только по пути нельзя.

## Откат

Если Мастер выберет вариант 2 или 3, возвратить в `scripts/visual/playthrough.mjs` соответственно условие `complete && naturalWidth > 0` либо точное поведение PR #192; не удалять подсчёт и провал по `brokenImages`/`emptySrcImages`. Сохранить `splitCampaignResponseFailures`: любое отличие от единственного зарегистрированного статуса, content-type, reason или canonical campaign/path остаётся blocking. Не менять seed, повторы, browser/parity-набор, ненулевые коды возврата или `pipefail`.
