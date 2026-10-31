Статус: accepted
Дата решения: 2026-10-29

Решение Мастера: protected autosave/save-load в `src/core/**`, `src/player/**`, `assets/save/autosave/**`, golden harness `scripts/golden/**` и внешний `public/ai/campaign-audit.mjs` не менять в GOLD-1.6c; их красные проверки (`playthrough:golden` rc=1 на `06-before-save` без pre-save autosave, `check:audit-bundle` rc=1 из-за устаревшего bundle) задокументировать и считать разрешёнными, не блокирующими приёмку/мерж.
Решил: оставить CLI/PackHost adapter и пересобранный `cf-play` в указанном scope, не ослаблять проверки/пороги и слить PR #150 squash-мержем; повторно назначать владельца трёх защищённых проблем отдельной задачей.
Откат: при необходимости вернуть только изменения GOLD-1.6c обычным follow-up PR; перечисленные protected/out-of-scope пути не трогать без отдельного scope.
