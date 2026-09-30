import JSZip from 'jszip'
import { createCampaignUuid } from './ids'
import { AI_KIT_FILES, AI_TASK_DIR } from './aiKit'
import { exportChronicle } from './chronicle'
import { formatCampaignAuditReport, validateCampaign, type CampaignAuditReport, type PlaytestRecord } from './campaignAudit'
import type { EditorStore } from './store'

export type AiTaskMode = 'new' | 'edit'
export type AiOutputFormat = 'chronicle' | 'json'

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
