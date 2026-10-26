/**
 * Единственный каталог диагностических кодов статического анализатора narrative.
 * `analyze.ts` выдаёт именно эти значения, а `cf-play explain` показывает эти же
 * записи. Не добавляйте сюда описания кодов движка или схемы: это каталог
 * находок `cf-play graph/check`.
 */
export const NARRATIVE_CODES = {
  inkMissingKnot: {
    code: 'ink_missing_knot',
    title: 'Ink-переход ведёт в несуществующий узел',
    why: 'В файле диалога есть переход `->`, но узел с таким именем не объявлен. Во время разговора переход не сможет продолжиться.',
    where: 'В указанном в отчёте файле `dialogues/*.ink`: рядом с `->` и среди заголовков `=== имя ===`.',
    fix: 'Исправьте имя цели перехода или добавьте узел с точно таким же именем.',
  },
  inkNoKnots: {
    code: 'ink_no_knots',
    title: 'В Ink-диалоге нет узлов',
    why: 'Файл не содержит ни одного заголовка Ink-узла, поэтому в нём нет точки входа для диалога.',
    where: 'В начале соответствующего `dialogues/*.ink` и далее по всему файлу.',
    fix: 'Добавьте хотя бы один узел в форме `=== имя ===` и поместите реплики или переходы внутрь него.',
  },
  inkSceneMissing: {
    code: 'ink_scene_missing',
    title: 'Ink ссылается на отсутствующую сцену',
    why: 'Вызов `go_to_scene` содержит id, которого нет среди сцен кампании.',
    where: 'В `dialogues/*.ink`, в вызове `go_to_scene`; цель должна совпадать с id файла из `scenes/`.',
    fix: 'Исправьте id сцены или добавьте сцену и перечислите её в `manifest.json`.',
  },
  inkArenaMissing: {
    code: 'ink_arena_missing',
    title: 'Ink ссылается на отсутствующую арену',
    why: 'Вызов `start_combat` содержит id арены, которого нет в кампании.',
    where: 'В `dialogues/*.ink`, в вызове `start_combat`; арены перечисляются в `manifest.json`.',
    fix: 'Укажите существующую арену либо добавьте файл арены и включите его в `manifest.json`.',
  },
  inkQuestMissing: {
    code: 'ink_quest_missing',
    title: 'Ink ссылается на отсутствующий квест',
    why: 'Вызов `advance_quest` указывает на квест, которого нет в кампании.',
    where: 'В `dialogues/*.ink`, в аргументах `advance_quest`; проверьте id файлов в `quests/` и `manifest.json`.',
    fix: 'Исправьте id квеста или добавьте квест в кампанию и её манифест.',
  },
  inkQuestStageMissing: {
    code: 'ink_quest_stage_missing',
    title: 'Ink ссылается на отсутствующую стадию квеста',
    why: 'Квест существует, но указанная в Ink стадия не объявлена в его списке стадий.',
    where: 'Вызов `advance_quest` в `dialogues/*.ink` и список `stages` соответствующего файла в `quests/`.',
    fix: 'Исправьте id стадии или добавьте эту стадию в нужный квест.',
  },
  travelTargetMissing: {
    code: 'travel_target_missing',
    title: 'Дорога ведёт в несуществующую локацию',
    why: 'Поле `to` у дорожного соединения указывает на id локации, которой нет в мире.',
    where: 'В `world.json`, в `travel_connections` локации, названной в сообщении.',
    fix: 'Исправьте id назначения или добавьте локацию в регион мира.',
  },
  locationSceneMissing: {
    code: 'location_scene_missing',
    title: 'Локация ссылается на отсутствующую сцену',
    why: 'В списке сцен локации или в её сцене прибытия указан неизвестный id.',
    where: 'В `world.json`, у поля `scenes` или `arrival_scene` соответствующей локации.',
    fix: 'Исправьте ссылку либо создайте сцену с этим id и включите её в `manifest.json`.',
  },
  sceneDeadEnd: {
    code: 'scene_dead_end',
    title: 'У сцены нет выхода',
    why: 'У сцены нет навигационных переходов, а у её локации нет дорог. Игрок может оказаться заперт.',
    where: 'В описанной сцене (`scenes/<id>.json`) и в `world.json` у её локации.',
    fix: 'Добавьте переход из сцены или дорогу из локации. Если это намеренный финальный тупик, проверьте, что игрок понимает, что забег завершён.',
  },
  sceneLocationMissing: {
    code: 'scene_location_missing',
    title: 'Сцена привязана к отсутствующей локации',
    why: 'Поле `location` сцены содержит id, которого нет среди локаций мира.',
    where: 'В `scenes/<id>.json`, поле `location`, и в `world.json`.',
    fix: 'Исправьте id локации или добавьте локацию в регион.',
  },
  navSceneMissing: {
    code: 'nav_scene_missing',
    title: 'Переход сцены ведёт на отсутствующую сцену',
    why: 'Зона навигации содержит `go_to_scene` с неизвестным id сцены.',
    where: 'В `scenes/<id>.json`, в элементе массива `navigation`.',
    fix: 'Исправьте целевой id или создайте сцену и перечислите её в манифесте.',
  },
  navInterceptMissing: {
    code: 'nav_intercept_missing',
    title: 'Перехват перехода ссылается на отсутствующую сущность',
    why: 'Поле `intercept_dialogue` у зоны навигации указывает на сущность, которой нет в кампании.',
    where: 'В `scenes/<id>.json`, в зоне `navigation` с перехватом диалога.',
    fix: 'Исправьте id сущности или добавьте её файл в `entities/` и `manifest.json`.',
  },
  navRuleMissing: {
    code: 'nav_rule_missing',
    title: 'Перехват перехода ссылается на отсутствующее правило',
    why: 'Поле `intercept_rule` у зоны навигации указывает на правило, которого нет в кампании.',
    where: 'В `scenes/<id>.json`, в зоне `navigation` с перехватом правила.',
    fix: 'Исправьте id правила или добавьте файл правила в `rules/` и `manifest.json`.',
  },
  slotEntityMissing: {
    code: 'slot_entity_missing',
    title: 'Слот сцены назначает отсутствующую сущность',
    why: 'Поле `default_entity` у слота содержит id, которого нет среди сущностей кампании.',
    where: 'В `scenes/<id>.json`, в слоте, указанном в отчёте.',
    fix: 'Исправьте id либо добавьте сущность в `entities/` и `manifest.json`.',
  },
  slotPersonEmpty: {
    code: 'slot_person_empty',
    title: 'Слот персонажа всегда пуст',
    why: 'У слота типа «персонаж» не задан персонаж по умолчанию или условие, и ни один NPC не приходит туда по расписанию.',
    where: 'В `scenes/<id>.json`, у слота, указанного в отчёте; расписания ищите в файлах NPC из `entities/`.',
    fix: 'Назначьте `default_entity`, задайте условие заполнения или добавьте NPC в расписание. Если пустой слот намеренный, заметку можно оставить без изменений.',
  },
  sceneUnreachable: {
    code: 'scene_unreachable',
    title: 'Сцена недостижима',
    why: 'Из стартовой точки до сцены не находится путь по навигации или эффектам перехода.',
    where: 'Проверьте id сцены из сообщения, массивы `navigation` в `scenes/` и эффекты правил/диалогов.',
    fix: 'Добавьте достижимый путь к сцене либо подтвердите, что она намеренно скрыта и не нужна в текущем маршруте.',
  },
  locationUnreachable: {
    code: 'location_unreachable',
    title: 'Локация недостижима',
    why: 'До локации нельзя добраться от стартовой точки по дорогам или эффектам телепортации.',
    where: 'В `world.json`, в дорожных соединениях; также проверьте эффекты `teleport_player` кампании.',
    fix: 'Соедините локацию с доступной частью мира либо подтвердите, что она намеренно изолирована.',
  },
  teleportLocationMissing: {
    code: 'teleport_location_missing',
    title: 'Телепортация указывает на отсутствующую локацию',
    why: 'Эффект `teleport_player` содержит id локации, которой нет в мире.',
    where: 'В правиле, диалоге или другом JSON-модуле, где задан `teleport_player`.',
    fix: 'Исправьте id локации либо добавьте локацию в `world.json`.',
  },
  teleportSceneMissing: {
    code: 'teleport_scene_missing',
    title: 'Телепортация указывает на отсутствующую сцену',
    why: 'Эффект `teleport_player` содержит id сцены, которой нет в кампании.',
    where: 'В модуле с эффектом `teleport_player`; проверьте `scene` и файлы в `scenes/`.',
    fix: 'Исправьте id сцены либо создайте её и добавьте в `manifest.json`.',
  },
  combatArenaMissing: {
    code: 'combat_arena_missing',
    title: 'Правило боя ссылается на отсутствующую арену',
    why: 'Эффект `start_combat` указывает на арену, которой нет в кампании.',
    where: 'В правиле или другом JSON-модуле с `start_combat`; арены — в `arenas/` и `manifest.json`.',
    fix: 'Укажите существующую арену либо добавьте файл арены в кампанию.',
  },
  dialogueEntityMissing: {
    code: 'dialogue_entity_missing',
    title: 'Диалог запускается для отсутствующей сущности',
    why: 'Эффект `start_dialogue` указывает на id сущности, которой нет в кампании.',
    where: 'В правиле или другом JSON-модуле с `start_dialogue`.',
    fix: 'Исправьте id или добавьте сущность в `entities/` и `manifest.json`.',
  },
  flagReadNeverWritten: {
    code: 'flag_read_never_written',
    title: 'Флаг читается, но нигде не устанавливается',
    why: 'Условие или Ink-развилка проверяет флаг, которому в кампании не соответствует ни одна запись.',
    where: 'Найдите id флага из сообщения в условиях, Ink-файлах, эффектах и реестре `campaign.json`.',
    fix: 'Исправьте опечатку или добавьте действие, которое устанавливает флаг до проверки.',
  },
  flagWrittenNeverRead: {
    code: 'flag_written_never_read',
    title: 'Флаг устанавливается, но нигде не читается',
    why: 'Кампания записывает флаг, но ни одно условие или Ink-развилка его не использует.',
    where: 'Поищите id флага из сообщения в `campaign.json`, эффектах и `dialogues/*.ink`.',
    fix: 'Добавьте задуманное условие-потребитель или удалите устаревшую запись. Если флаг зарезервирован на будущее, предупреждение можно оставить.',
  },
  questStageMissing: {
    code: 'quest_stage_missing',
    title: 'Эффект квеста ведёт в отсутствующую стадию',
    why: 'Эффект или диалог продвигает существующий квест в стадию, не объявленную в его данных.',
    where: 'В модуле с `advance_quest` и в `stages` соответствующего файла `quests/`.',
    fix: 'Исправьте id стадии или добавьте её в список стадий квеста.',
  },
  questStageUnreferenced: {
    code: 'quest_stage_unreferenced',
    title: 'Стадия квеста не имеет входящего продвижения',
    why: 'Стадия не упоминается как цель эффекта/Ink-перехода или перехода из другой стадии и не настроена как автоматическая.',
    where: 'В массиве `stages` файла квеста и среди `advance_quest`/`transitions` по всем модулям кампании.',
    fix: 'Добавьте входящее продвижение или настройте автоматическую стадию. Если это намеренная заготовка, заметку можно оставить.',
  },
  dialogueFileMissing: {
    code: 'dialogue_file_missing',
    title: 'Сущность ссылается на отсутствующий Ink-файл',
    why: 'NPC или запись встречи указывает на диалог, которого нет среди файлов Ink кампании.',
    where: 'Поле `dialogue` сущности NPC или запись диалога во встрече; сверьте имя с `manifest.json`.',
    fix: 'Исправьте ссылку либо добавьте диалоговый файл и укажите его в `manifest.json`.',
  },
  dialogueOrphan: {
    code: 'dialogue_orphan',
    title: 'Ink-файл диалога никем не используется',
    why: 'Файл присутствует в кампании, но на него не ссылается NPC или диалоговая встреча.',
    where: 'В `dialogues/*.ink` и ссылках `dialogue` сущностей/встреч.',
    fix: 'Подключите файл к нужному NPC или удалите неиспользуемый диалог.',
  },
  endingConditionDead: {
    code: 'ending_condition_dead',
    title: 'Условие концовки зависит от неустанавливаемого флага',
    why: 'Условие концовки проверяет флаг, который ни один эффект, Ink-команда или запись реестра не устанавливает.',
    where: 'В `campaign.json` в массиве `endings[].conditions` и во всех источниках записи этого флага.',
    fix: 'Добавьте установку флага до проверки либо исправьте условие на правильный флаг.',
  },
} as const

export type NarrativeCodeKey = keyof typeof NARRATIVE_CODES
export type NarrativeCodeExplanation = (typeof NARRATIVE_CODES)[NarrativeCodeKey]

export const NARRATIVE_CODE_LIST = Object.values(NARRATIVE_CODES)

export function findNarrativeCode(code: string): NarrativeCodeExplanation | undefined {
  return NARRATIVE_CODE_LIST.find((entry) => entry.code === code)
}
