# Чек-лист создания релиза campaign-1

## 1. Запушьте правки

```bash
cd campaign-1
git push origin main
```

## 2. Создайте релиз в GitHub

Перейдите на https://github.com/Creative36711/campaign-1/releases → «Create a new release»

| Поле | Значение |
|------|----------|
| Tag version | `v1.0.0-golden-fix` (или другой) |
| Release title | «GOLD-1: исправления контента каркаса» |
| Describe this release | Исправлены 2 ошибки ink_missing_knot, удалены 9 неиспользуемых флагов. cf-play rc=0, audit 0/0. |
| Attach binaries | Прикрепите архив кампании (tarball, zip или tar.gz) |

## 3. Скопируйте три значения

После публикации релиза скопируйте и передайте Warden:

1. **Commit SHA** — хеш коммита с правками (из `git log -1` или страницы коммита в GitHub)
2. **URL архива** — прямая ссылка на прикреплённый tarball в релизе (например, `https://github.com/Creative36711/campaign-1/releases/download/v1.0.0-golden-fix/campaign-1.tar.gz`)
3. **SHA-256 архива** — `sha256sum campaign-1.tar.gz` (или хеш из GitHub релиза)

## 4. Передайте Warden

Warden подставит эти значения в `.golden/manifest.json` в репозитории narthex и запушит. После этого цикл GOLD-1 продолжится: импорт по новому пину, `audit:campaign → 0`, `cf-play check → 0`.
