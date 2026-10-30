неясно / В разрешённых roots найдены 4 project paths (3 campaigns и realtime-wall), требование карточки — 7; можно ли считать неизменённые pack-data copies отдельными compatibility targets?
решил / Включить три существующих pack-data copies read-only; корпус содержит 7 уникальных paths, но только 4 семантических project IDs — ограничение явно отмечается в отчёте.
откат / Удалить записи `*-pack-data` из `_tools/compat-corpus.json` и заменить их только при появлении трёх новых distinct projects в разрешённых roots.
