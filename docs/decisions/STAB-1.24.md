# STAB-1.24 — финальный SHA для повторного §4 и Actions

**Статус:** accepted
**Дата решения:** 2026-10-31

- **Неясно:** включает ли «окончательный SHA» последующий docs-only commit с отчётом и решением; точные active-soak timestamps находятся в GOLD-1.15 artifact, подписанный download host которого недоступен из sandbox.
- **Решил:** целевой SHA проверяемого кода — `22f1c80cb0358a5de81d3dd69500fb2fb4a9f182` (merge SHA STAB-1.23); все 21 команды и оба Actions проверяются на нём. В отчёте указываются точные GitHub step timestamps и ссылка на authoritative GOLD-1.15 timeline artifact; внутренний active interval не выдумывается. Evidence-only commit добавляется после и не меняет исходники, bundle или оракулы.
- **Откат:** если результат относится к другому SHA, docs-only diff меняет исполняемые пути или Master требует копию active-soak timestamps, не выдавать step window за active interval — получить timeline в среде с разрешённым artifact access, дополнить отчёт и повторить проверки только при изменении тестируемого SHA.
