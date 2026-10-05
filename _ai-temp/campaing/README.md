# «Колокол без имени»

Полностью новая кампания Chronicle Forge в жанре тёмного техно-фэнтези с расследованием и выживанием. Расчётное прохождение — **5–7 часов**.

- **Campaign ID:** `9fddf7e4-2333-4526-885b-8dea00c0b743`
- **Содержание:** 14 сцен, 8 NPC, 4 квеста, 5 концовок
- **Пакет:** [`kolokol-bez-imeni.chronicle`](kolokol-bez-imeni.chronicle)
- Развёрнутый русскоязычный дизайн-документ включён в поле `campaign.design_doc` внутри `campaign.json`.
- Сцены и катсцены используют встроенные ArtDoc-рисунки; звуковые эффекты и музыка — процедурную генерацию. Внешние медиа не используются.

## Пересборка

`.build_campaign.py` — воспроизводимый генератор Campaign Package. Он записывает промежуточные модули в `.campaign_build/` и создаёт архив `kolokol-bez-imeni.chronicle` в корне:

```bash
python -m py_compile .build_campaign.py
python .build_campaign.py
unzip -t kolokol-bez-imeni.chronicle
```

Архив содержит только файлы кампании: служебная папка `__chronicle_ai__/` в него не входит.
