# NAR-3.7 — строгий браузерный экзамен кампаний Ash

**Дата:** 2026-10-26  
**Проверка:** `npm run playthrough:exam -- http://localhost:4173 out/nar37-exam`  
**Браузер:** Chromium 131.0.6778.0  
**Итог:** **FAIL, exit code 1**. Это фактический результат; пороги не ослаблялись, отсутствующие изображения не восстанавливались и не подменялись.

## Результаты по пакетам

| Пак | Шаги | pageerror | Экраны ошибки | Битые `<img>` | Сырые NPC ID | Пустой каталог при старте | Невалидные image-ресурсы | Финальное состояние | Пак проходит |
|---|---:|---:|---:|---:|---:|---|---:|---|---|
| `ash-of-caerden` | 8 | 0 | 5 | 7 | 0 | нет | 4 | `ending_ashes` | нет |
| `ash-of-caerden-adventure` | 12 | 0 | 0 | 0 | 0 | нет | 2 | `ending_gate_unlocked` | нет |

`errorScreens` и `broken <img>` — число наблюдений по снятым шагам, поэтому один ресурс, видимый на нескольких кадрах, учитывается повторно. Для невалидного image-ресурса проверяется и `Content-Type`: локальный preview отдаёт для отсутствующего `.jpg` HTTP 200 с `text/html`, что иначе выглядело бы как успешный ответ.

### Фактические финалы и кадры

- **Ash:** достигнут итоговый экран `ending_ashes`. На последнем кадре видны заголовок **«Пепел принял ещё одного»**, текст концовки и статистика забега.

  ![Финальный экран Ash — ending_ashes](./NAR-3.7-ash-ending.png)

- **Adventure:** достигнут `ending_gate_unlocked`. На последнем кадре видны **«РАЗВЯЗКА»**, **«Механизм ворот открыт»** и текст об открытых воротах.

  ![Финальный экран adventure — ending_gate_unlocked](./NAR-3.7-adventure-ending.png)

## Находки, блокирующие закрытие

- В Ash-кадрах есть текст экрана ошибки сцены; обнаружены 7 наблюдений с битыми `<img>`. В частности, отсутствуют изображения портрета Алдрика и карты долины.
- На ресурсном уровне в Ash обнаружены 4 отсутствующих изображения: `assets/img/scenes/gates_front_day.jpg`, `assets/img/npc/aldric_neutral.jpg`, `assets/img/maps/caerden_valley.jpg`, `assets/img/scenes/forest_edge.jpg`.
- В Adventure видимый маршрут доходит до конца без pageerror, текста экрана ошибки, сломанных DOM-изображений и сырых NPC id. Но запрошенные `assets/img/scenes/gates_front_day.jpg` и `assets/img/npc/aldric_neutral.jpg` возвращают HTML вместо изображения; строгий asset oracle это фиксирует.
- В обоих пакетах стартует каталог кампаний, не текст «Кампаний пока нет»; шагов больше требуемых восьми.
- Эти отсутствующие изображения намеренны в текущих Ash-полигонах. В рамках NAR-3.7 они оставлены без изменений. Следовательно, требование нулевых ошибок/битых изображений **не выполнено**, и фазу 2 закрывать нельзя.

## Литеральный вывод экзамена

Команда завершилась с `exit code 1`. Ниже — stdout программы из `out/nar37-exam/exam.stdout.txt` без пересказа:

```text
NAR-3.7 strict real-browser exam
Base URL: http://localhost:4173
Browser: Chromium 131.0.6778.0
Fixture root: public/campaigns

--- ash-of-caerden ---
  ash-of-caerden / ash-of-caerden-01-home: Стартовое меню — кнопок 5, битых img 0
  ash-of-caerden / ash-of-caerden-02-selected: Пак выбран в меню кампаний — кнопок 5, битых img 0
  ash-of-caerden / ash-of-caerden-03-character: Создание героя перед новым забегом — кнопок 40, битых img 0
  ash-of-caerden / ash-of-caerden-04-new-run-scene: Сцена после «Нового забега» — кнопок 17, битых img 1
  ash-of-caerden / ash-of-caerden-05-gates-ready: Стартовая сцена и диалог закрыты — кнопок 13, битых img 1
  ash-of-caerden / ash-of-caerden-06-map: Карта долины из стартовой сцены — кнопок 23, битых img 2
  ash-of-caerden / ash-of-caerden-07-forest-encounter: Прибытие в лесную локацию / состояние боя — кнопок 23, битых img 2
  ash-of-caerden / ash-of-caerden-09-ending: Итоговый экран Ash: Пепел принял ещё одного — кнопок 13, битых img 1
FAIL ash-of-caerden: steps=8; pageerror=0; errorScreens=5; brokenImg=7; rawNpcIds=0; emptyStart=false
  finalState=ending_ashes
  finalFrame=/home/user/narthex/out/nar37-exam/ash-of-caerden/ash-of-caerden-09-ending.png
  finding=экранов ошибки: 5
  finding=битых <img>: 7; URL: http://localhost:4173/campaigns/ash-of-caerden/assets/img/npc/aldric_neutral.jpg, http://localhost:4173/campaigns/ash-of-caerden/assets/img/maps/caerden_valley.jpg, http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/gates_front_day.jpg
  finding=ошибки обязательных ресурсов кампании: 4; 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/gates_front_day.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/npc/aldric_neutral.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/maps/caerden_valley.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/forest_edge.jpg (expected image/*, received text/html)
  resource=200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/gates_front_day.jpg (expected image/*, received text/html)
  resource=200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/npc/aldric_neutral.jpg (expected image/*, received text/html)
  resource=200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/maps/caerden_valley.jpg (expected image/*, received text/html)
  resource=200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/forest_edge.jpg (expected image/*, received text/html)

--- ash-of-caerden-adventure ---
  ash-of-caerden-adventure / ash-of-caerden-adventure-01-home: Стартовое меню — кнопок 5, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-02-selected: Пак выбран в меню кампаний — кнопок 5, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-03-character: Создание героя adventure — кнопок 40, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-04-stage: Сцена adventure после нового забега — кнопок 23, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-05-walk: Ходьба к точке сцены — кнопок 22, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-06-inspect: Осмотр символов ворот — кнопок 22, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-07-items: Взяты два предмета — кнопок 23, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-08-combination: Два предмета соединены в мазь — кнопок 23, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-09-dialogue: Разговор со стражником — кнопок 27, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-10-riddle: Крупный план загадки ворот — кнопок 24, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-11-rejected-answer: Неверная последовательность отклонена — кнопок 24, битых img 0
  ash-of-caerden-adventure / ash-of-caerden-adventure-12-ending: Финал: ending_gate_unlocked — кнопок 20, битых img 0
FAIL ash-of-caerden-adventure: steps=12; pageerror=0; errorScreens=0; brokenImg=0; rawNpcIds=0; emptyStart=false
  finalState=ending_gate_unlocked
  finalFrame=/home/user/narthex/out/nar37-exam/ash-of-caerden-adventure/ash-of-caerden-adventure-12-ending.png
  finding=ошибки обязательных ресурсов кампании: 2; 200 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/scenes/gates_front_day.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/npc/aldric_neutral.jpg (expected image/*, received text/html)
  resource=200 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/scenes/gates_front_day.jpg (expected image/*, received text/html)
  resource=200 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/npc/aldric_neutral.jpg (expected image/*, received text/html)

RESULT: FAIL; packs=2; steps=20; findings=4
  finding=ash-of-caerden: экранов ошибки: 5
  finding=ash-of-caerden: битых <img>: 7; URL: http://localhost:4173/campaigns/ash-of-caerden/assets/img/npc/aldric_neutral.jpg, http://localhost:4173/campaigns/ash-of-caerden/assets/img/maps/caerden_valley.jpg, http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/gates_front_day.jpg
  finding=ash-of-caerden: ошибки обязательных ресурсов кампании: 4; 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/gates_front_day.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/npc/aldric_neutral.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/maps/caerden_valley.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden/assets/img/scenes/forest_edge.jpg (expected image/*, received text/html)
  finding=ash-of-caerden-adventure: ошибки обязательных ресурсов кампании: 2; 200 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/scenes/gates_front_day.jpg (expected image/*, received text/html) | 200 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/npc/aldric_neutral.jpg (expected image/*, received text/html)
```

## Мутационная проба во временной копии

Скопированы только два каталога кампаний во временный `$TMP/fixtures`. В копии `ash-of-caerden-adventure/scenes/scene_gates_front.json` список дневных `image.frames` заменён единственной ссылкой на отсутствующий `assets/img/scenes/nar37-missing-scene.png`. Рабочие файлы кампаний не менялись. Экзамен указал URL мутации и завершился с ненулевым кодом; временная копия удалена, Git working tree до/после пробы совпал.

Литеральный фрагмент вывода:

```text
FAIL ash-of-caerden-adventure: steps=12; pageerror=0; errorScreens=0; brokenImg=0; rawNpcIds=0; emptyStart=false
  finalState=ending_gate_unlocked
  finding=ошибки обязательных ресурсов кампании: 2; 404 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/scenes/nar37-missing-scene.png (HTTP 404) | 404 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/npc/aldric_neutral.jpg (HTTP 404)
  resource=404 http://localhost:4173/campaigns/ash-of-caerden-adventure/assets/img/scenes/nar37-missing-scene.png (HTTP 404)
RESULT: FAIL; packs=2; steps=21; findings=4
MUTATION_EXIT_CODE=1
WORKTREE_UNCHANGED=yes
TEMP_COPY_REMOVED=on-exit-trap
```

## Регрессия старого оракула

Старый вызов не менялся и после добавления отдельного режима дал прежний результат:

```text
$ npm run playthrough -- http://localhost:4173 out/play
✓ маршрут: 20 шагов, 0 находок
exit code: 0
```

Новый режим выделен в `npm run playthrough:exam`; workflow `visual.yml` сохраняет PNG и отчёты под `out/visual` в CI-артефакт `visual-report`.
