# Пакет для загрузки правок в campaign-1

Этот каталог подготавлен Warden для миссии GOLD-1. Возьмите всё содержимое папки `import/campaign-1/` и загрузите в репозиторий `https://github.com/Creative36711/campaign-1`.

## Что внутри

| Путь | Назначение |
|------|------------|
| `corrections/` | Куда положить исправленные файлы кампании (ink, флаги и т.д.) |
| `apply-corrections.md` | Чек-лист правок контента для campaign-1 |
| `release-checklist.md` | Чек-лист создания релиза с архивом |
| `manifest-for-narthex.json` | Шаблон `.golden/manifest.json` (после релиза подставьте значения и передайте Warden) |

## Порядок действий (для Мастера)

1. **Примените правки в campaign-1** — см. `corrections/apply-corrections.md`
   - Закрыть 2 ошибки `ink_missing_knot` в `dialogues/ira.ink` (условные блоки)
   - Удалить 9 неиспользуемых флагов
   - Проверить: `cf-play check` rc=0, `audit:campaign` 0/0

2. **Создайте релиз в campaign-1** — см. `release-checklist.md`
   - Прикрепите архив campaigns (tarball)
   - Скопируйте: commit SHA, URL архива, sha256 архива

3. **Передайте Warden** три значения: commit SHA, URL архива, sha256
   — Warden подставит в `.golden/manifest.json` и запушит в narthex

## Граница зон

- **campaign-1** — ваш репозиторий, пуш правок делаете вы
- **narthex** — только `.golden/manifest.json` (в `.gitignore`), правит Warden
- **Не смешивайте**: файлы кампании не коммитятся в narthex
