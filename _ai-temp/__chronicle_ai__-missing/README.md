# __chronicle_ai__ — чемодан агента

Сначала читай `TASK.md`, `campaign-guide.md` и `PLAYKIT.md`.

- `campaign-audit.mjs` — схема, ссылки, медиа. Запуск: `node __chronicle_ai__/campaign-audit.mjs .`
- `cf-play.mjs` — движок как инструмент: граф, диалоги, прогоны, приёмка.
  Одна команда: `node __chronicle_ai__/cf-play.mjs check . --out .cf-play/check`
- `campaign.schema.json` — схема пакета.
- `campaign-guide.md` — правила контента.
- `design-template.md` — бланк дизайн-документа.
- `cutout-chromakey.py` — вырезание фона у арта.

Перед пушем: `check` вернул `0`, `report.md` приложен к отчёту.
Прогоны с отладочными правками (`evidence: injected`) не считаются приёмкой.
