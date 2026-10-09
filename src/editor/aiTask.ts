import JSZip from 'jszip'
import { createCampaignUuid } from './ids'
import { AI_KIT_FILES, AI_TASK_DIR } from './aiKit'
import { exportChronicle } from './chronicle'
import { formatCampaignAuditReport, validateCampaign, type CampaignAuditReport, type PlaytestRecord } from './campaignAudit'
import type { EditorStore } from './store'

export type AiTaskMode = 'new' | 'edit'
export type AiOutputFormat = 'chronicle' | 'json'

export interface AiTaskBriefOptions {
  mode: AiTaskMode
  idea?: string
  genre?: string
  tone?: string
  scaleHint?: string
  battle?: number | null
  accents?: string[]
  must?: string
  mustNot?: string
}

/** Собирает бриф только из явно заданных мастером параметров. */
export function buildAiTaskBrief(options: AiTaskBriefOptions): string {
  const battle = options.battle
  const battleLine = battle == null ? ''
    : battle <= 20 ? 'Акцент на диалоги и историю, боёвки мало или нет.'
      : battle >= 80 ? 'Акцент на боёвку и тактику, диалогов минимум.'
        : 'Примерный баланс диалогов и боёвки.'
  const lines = options.mode === 'edit'
    ? [
        options.idea?.trim() || 'Проведи аккуратную проверку текущей кампании и предложи небольшие улучшения.',
        options.must?.trim() && `Обязательно: ${options.must.trim()}`,
        options.mustNot?.trim() && `Не добавлять: ${options.mustNot.trim()}`,
      ]
    : [
        options.idea?.trim() || 'Создай интересную законченную кампанию и заполни все необходимые разделы.',
        options.genre?.trim() && `Жанр/сеттинг: ${options.genre.trim()}`,
        options.tone?.trim() && `Тон: ${options.tone.trim()}`,
        options.scaleHint?.trim() && `Масштаб: ${options.scaleHint.trim()}`,
        battleLine,
        options.accents?.length ? `Акценты: ${options.accents.join('; ')}` : '',
        options.must?.trim() && `Обязательно: ${options.must.trim()}`,
        options.mustNot?.trim() && `Не добавлять: ${options.mustNot.trim()}`,
      ]
  return lines.filter((line): line is string => typeof line === 'string' && !!line.trim()).join('\n')
}

export interface AiTaskBundle {
  blob: Blob
  filename: string
  assignedCampaignId: string
  report: CampaignAuditReport
}

export function buildAiTaskPrompt(mode: AiTaskMode, task: string, campaignId: string, report: string, outputFormat: AiOutputFormat = 'chronicle'): string {
  const identity = mode === 'new'
    ? outputFormat === 'json'
      ? 'Это MonolithDoc для новой кампании. Не назначай slug/авторский ID: редактор выдаст UUID при импорте JSON.'
      : `Приложение заранее назначило новой кампании ID «${campaignId}». Используй его без изменений.`
    : `Это обновление существующей кампании. Сохрани ID «${campaignId}» без изменений.`
  return [
    'Ты работаешь над кампанией Chronicle Forge по приложенному пакету задания.',
    'Сначала прочитай __chronicle_ai__/README.md, __chronicle_ai__/TASK.md и __chronicle_ai__/campaign-guide.md; схема, бланк и отчёт проверки лежат в той же папке.',
    'Настройки брифа необязательны: учитывай только явно заданные мастером параметры. Пропущенный аспект не является требованием — выбери его сам или не задавай вовсе; никогда не выводи баланс диалогов и боёвки по умолчанию.',
    'Если задано создание персонажа, каждый шаблон происхождения должен содержать все семь характеристик и распределять ровно total_points, а каждый шаблон призвания — ровно skill_points для каждого происхождения. Считай от минимальных порогов, обязательных навыков и бесплатных skill_bonus происхождения; соблюдай skill_cap и не оставляй ни перерасхода, ни остатка.',
    'Подписи потребностей, статусов и кнопок видны в компактном HUD: делай их короткими (для потребностей желательно до 18 знаков), не включай число/счётчик в подпись. Визуальные надписи внутри арта держи в безопасных полях и не дублируй заголовок сцены крупным текстом; не закрывай большую часть сцены однотонной плашкой — крупные объекты должны читаться как часть локации и не перекрывать важные точки.',
    'Файлы таблиц встреч (`encounter_tables`) перечисляй только в manifest.encounters, а в manifest.rules — только файлы правил с обязательными массивами conditions и effects (пустые допустимы). Файл встреч в manifest.rules становится «правилом» без условий и ломает старт забега.',
    'У каждого флага реестра meta.flags обязательно заполняй description — «для чего нужен»: какое событие запоминает и где читается (правило, диалог, квест). Флаги без пояснения аудит помечает предупреждением.',
    'Генерация спрайтов и фигурок без фона: нейросети НЕ умеют делать настоящий альфа-канал и рисуют псевдо-шахматку серыми пикселями. НИКОГДА не пиши в промпт «transparent background». Заказывай генерацию на однородном хромакее («solid plain vivid green background #00FF00 chromakey, perfectly flat single color background, no floor, no shadows, no checkerboard») и вырезай фон утилитой чемодана: `python3 scripts/cutout-chromakey.py path/to/img.png --color "#00FF00"`. Строго без фона обязаны быть: фигурки боя (combat_figure), спрайты сцен (scene_sprite), эмблема меню (theme.menu.title_art) и рамка (theme.frame). С полным фоном делай только сцены, арены, катсцены и меню.',
    'Ремарки (описания действий) помечай в сыром Ink тегом «# action» в конце строки, а в конструкторе — галочкой «ремарка»: без пометки игрок видит описание действия как реплику собеседника. Эмоция реплики — «# emotion: angry», озвучка — «# voice: assets/voice/x.mp3»; смена облика по ходу разговора — «~ set_entity_state(\"npc_ira\", \"angry\")» (пустая строка состояния возвращает обычный облик).',
    'Узел с вариантами ответов пиши как «=== <узел>_hub ===» (так делает редактор); допустим и отдельный узел под своим именем («=== hub ===»), если варианты возвращают к нему через «-> hub». Внутри узла-ответов до первого варианта можно ставить эффекты и «~ set_dialogue_timer(…)» — импорт перенесёт их в начало узла, а строки «+ [текст]» / «* {условие} [текст]» станут вариантами.',
    'В режиме JSON (MonolithDoc) разговор можно отдать текстом: «"dialogues": { "имя": { "version": 2, "label": "…", "script": "=== Начало ===\\n— Привет!", "nodes": [] } }» — редактор разберёт текст в формы и соберёт ink. В .chronicle-пакете так нельзя: движок исполняет ink, и он в пакете обязателен.',
    'ПРАВИЛО ФОРМАТА ВЫГРУЗКИ: если ты работаешь в текстовом чате (ChatGPT, Claude, DeepSeek) и не формируешь бинарный ZIP напрямую, отдавай результат как единый MonolithDoc JSON либо чистый архив файлов манифеста. Никогда не пытайся эмулировать бинарный zip-файл псевдотекстом в чате. Мастер загрузит монолит в редактор в один клик через «Файл → Импорт из JSON», и редактор сам соберёт чистый .chronicle.',
    'В сыром Ink условия выбора пиши только ПЕРЕД квадратными скобками («+ { условие } [текст]»), а условные текстовые блоки — в одну строку («{ cond: текст }»): запись условия после скобок и многострочные блоки часть сборок inkjs печатает служебной строкой («true») посреди разговора или теряет реплики.',
    'Действия «по месту» делай доступными из сцены и реплик, а не только кнопкой в интерфейсе: ремонт и изготовление открывает эффект open_craft (в диалоге — «~ open_craft(\"recipe_id\")», с id нужный рецепт подсвечен), торговлю — open_trade. Для сцен, где молчание — часть напряжения (погоня, допрос, «Тихая» у двери), ставь дедлайн на раздумье: в конструкторе диалога поле «Таймер на раздумье», в рукописном ink — «~ set_dialogue_timer(15, \"узел_молчания\")»; короче 5–8 секунд не бери.',
    identity,
    mode === 'edit'
      ? 'Не создавай новую кампанию с нуля и не удаляй существующий контент, если задача явно этого не требует.'
      : 'Создай новую кампанию целиком. В корне пакета пока нет исходной кампании.',
    outputFormat === 'json'
      ? 'Верни полный MonolithDoc JSON для импорта через «Файл → Импорт из JSON». Это режим только для текстовых/структурных изменений: JSON не переносит бинарные медиа. Не меняй campaign.id.'
      : 'Верни один готовый файл .chronicle: валидный Campaign Package с campaign.json, world.json, manifest.json и всеми модулями/медиа. Не включай в результат папку __chronicle_ai__. Не ограничивайся JSON, если задача требует медиа.',
    outputFormat === 'chronicle'
      ? 'Медиа храни отдельными файлами в пакете и ссылайся на них относительными путями. Не используй случайные временные ссылки. Для скачанных материалов укажи источники и условия использования; не приписывай права, которых нет.'
      : 'Не добавляй медиафайлы, если мастер явно не переключил задачу на .chronicle. Не меняй ссылки на существующие медиа без необходимости.',
    mode === 'new' && outputFormat === 'json'
      ? 'Для новой кампании не назначай технический ID: редактор выдаст новый ID при импорте JSON.'
      : '',
    '',
    'ЗАДАЧА МАСТЕРА',
    task.trim() || (mode === 'new' ? 'Создай небольшую законченную кампанию по приложенному брифу.' : 'Проведи аккуратную проверку и предложи исправления только найденных проблем.'),
    '',
    'ПОСЛЕДНИЙ ОТЧЁТ ПРОВЕРКИ',
    report || 'Отчёт отсутствует.',
  ].join('\n')
}

async function loadAiDocs(): Promise<Map<string, string>> {
  const docs = new Map<string, string>()
  for (const { name } of AI_KIT_FILES) {
    const response = await fetch(`ai/${encodeURIComponent(name)}`)
    if (!response.ok) throw new Error(`Не найден файл набора: ai/${name} (${response.status})`)
    docs.set(name, await response.text())
  }
  return docs
}

export async function createAiTaskBundle(
  store: EditorStore,
  options: {
    mode: AiTaskMode
    task: string
    lastPlaytest?: PlaytestRecord | null
    assignedCampaignId?: string
    outputFormat?: AiOutputFormat
    previousReport?: string
  },
): Promise<AiTaskBundle> {
  const mode = options.mode
  const hasCampaign = !!store.basePath && !!store.meta.id
  if (mode === 'edit' && !hasCampaign) throw new Error('Для режима редактирования сначала откройте кампанию.')

  const outputFormat = options.outputFormat ?? 'chronicle'
  const assignedCampaignId = mode === 'edit' ? store.meta.id : outputFormat === 'json' ? '' : options.assignedCampaignId || createCampaignUuid()
  const report: CampaignAuditReport = mode === 'edit'
    ? await validateCampaign(store, options.lastPlaytest)
    : {
        checkedAt: Date.now(),
        structure: [{ severity: 'info', message: 'Новая кампания: исходные данные ещё не созданы.' }],
        media: [{ severity: 'info', message: 'Для новой кампании локальные медиафайлы ещё не приложены.' }],
        playtest: [{ severity: 'info', message: 'Плейтест будет доступен после импорта готовой кампании.' }],
      }
  const reportText = options.previousReport?.trim() || formatCampaignAuditReport(report)
  const prompt = buildAiTaskPrompt(options.mode, options.task, assignedCampaignId, reportText, outputFormat)
  const zip = new JSZip()

  if (mode === 'edit') {
    // В AI-пакет включаем весь рабочий Campaign Package: JSON/Ink и бинарные
    // файлы. Битые ссылки пропускаются, но явно попадают в приложенный отчёт.
    const campaign = await JSZip.loadAsync(await exportChronicle(store, { allowMissingMedia: true }))
    for (const [path, file] of Object.entries(campaign.files)) {
      if (file.dir) continue
      const content = await file.async('uint8array')
      zip.file(path, content, { compression: /\.(?:json|ink|md)$/i.test(path) ? 'DEFLATE' : 'STORE' })
    }
  }

  const aiDir = (name: string) => `${AI_TASK_DIR}${name}`
  const resultNote = outputFormat === 'json'
    ? 'Верни полный MonolithDoc JSON. Для новой кампании приложение выдаст ID при импорте.'
    : 'Верни готовую кампанию отдельным `.chronicle` архивом и не добавляй в него эту папку.'
  zip.file(aiDir('README.md'), [
    '# Chronicle Forge — пакет задания для ИИ',
    '',
    'Прочитай `TASK.md`, затем руководство, схему и бланк дизайн-документа.',
    'При редактировании файлы кампании находятся в корне архива; `__chronicle_ai__/` — только инструкции и отчёт, не часть кампании.',
    resultNote,
    '',
    assignedCampaignId ? `Назначенный ID кампании: ${assignedCampaignId}` : 'ID новой кампании выдаст редактор при импорте.',
    '',
  ].join('\n'))
  zip.file(aiDir('TASK.md'), prompt)
  zip.file(aiDir('validation-report.md'), reportText)
  const docs = await loadAiDocs()
  for (const [name, text] of docs) zip.file(aiDir(name), text)

  const suffix = mode === 'edit' ? '-ai-task.chronicle' : '-ai-task.zip'
  const filename = `${assignedCampaignId || 'new-campaign'}${suffix}`
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename,
    assignedCampaignId,
    report,
  }
}
