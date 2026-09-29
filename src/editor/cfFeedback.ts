/**
 * Конвенция `cf-feedback`: обратная связь ИИ-агента → разработчики платформы (Задача 7).
 * Никакой скрытой телеметрии: мастер видит содержимое блока, при желании вставляет
 * его в модалку «Инструменты → Заметки ИИ для разработчиков» и в один клик
 * открывает предзаполненный GitHub Issue.
 */

export type CfFeedbackKind =
  | 'missing_effect'
  | 'missing_condition'
  | 'doc_gap'
  | 'schema_gap'
  | 'validator_wrong'
  | 'other'

export type CfFeedbackSeverity = 'low' | 'mid' | 'high'

export interface CfFeedbackItem {
  id: string
  kind: CfFeedbackKind
  detail: string
  workaround?: string
  severity: CfFeedbackSeverity
}

const VALID_KINDS = new Set<CfFeedbackKind>([
  'missing_effect',
  'missing_condition',
  'doc_gap',
  'schema_gap',
  'validator_wrong',
  'other',
])

const VALID_SEVERITIES = new Set<CfFeedbackSeverity>(['low', 'mid', 'high'])

/**
 * Извлечь и нормализовать массив записей `cf-feedback` из вставленного текста
 * (поддерживает fenced-блок ```cf-feedback ... ```, ```json ... ``` или чистый JSON-массив,
 * склеивает дубли по полю `id`).
 */
export function parseCfFeedback(raw: string): { items: CfFeedbackItem[]; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { items: [] }

  // Ищем fenced-блок ```cf-feedback ... ``` или ```json ... ```
  const fenceMatch =
    trimmed.match(/```cf-feedback\s*([\s\S]*?)```/i) ??
    trimmed.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch (e) {
    return { items: [], error: `Не удалось разобрать JSON блока cf-feedback: ${(e as Error).message}` }
  }

  if (!Array.isArray(parsed)) {
    return { items: [], error: 'Ожидался JSON-массив записей cf-feedback: [{ "id": "...", "kind": "...", ... }]' }
  }

  const byId = new Map<string, CfFeedbackItem>()
  for (const [idx, entry] of parsed.entries()) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `item-${idx + 1}`
    const kindRaw = typeof obj.kind === 'string' ? (obj.kind.trim() as CfFeedbackKind) : 'other'
    const kind: CfFeedbackKind = VALID_KINDS.has(kindRaw) ? kindRaw : 'other'
    const sevRaw = typeof obj.severity === 'string' ? (obj.severity.trim() as CfFeedbackSeverity) : 'mid'
    const severity: CfFeedbackSeverity = VALID_SEVERITIES.has(sevRaw) ? sevRaw : 'mid'
    const detail = typeof obj.detail === 'string' ? obj.detail.trim() : ''
    const workaround = typeof obj.workaround === 'string' ? obj.workaround.trim() : ''
    if (!detail) continue
    // склейка дублей по стабильному id
    if (!byId.has(id)) {
      byId.set(id, { id, kind, detail, workaround, severity })
    }
  }

  return { items: [...byId.values()] }
}

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

/** Собрать предзаполненный GitHub Issue (заголовок, markdown-таблицу в body и URL). */
export function buildCfFeedbackIssue(items: CfFeedbackItem[], campaignTitle = ''): {
  title: string
  body: string
  url: string
} {
  const prefix = campaignTitle ? `[cf-feedback · ${campaignTitle}]` : '[cf-feedback]'
  const firstIds = items.slice(0, 3).map((x) => x.id).join(', ')
  const more = items.length > 3 ? ` (+${items.length - 3})` : ''
  const title = items.length
    ? `${prefix} ${firstIds}${more}`
    : `${prefix} Заметки ИИ-агента`

  const tableLines = [
    '| ID | Категория (`kind`) | Важность (`severity`) | Описание (`detail`) | Обходной путь (`workaround`) |',
    '| --- | --- | --- | --- | --- |',
    ...items.map(
      (it) =>
        `| \`${escapeMdCell(it.id)}\` | \`${it.kind}\` | **${it.severity}** | ${escapeMdCell(it.detail)} | ${escapeMdCell(it.workaround || '—')} |`,
    ),
  ]

  const body = [
    campaignTitle ? `**Кампания:** ${campaignTitle}` : '',
    `**Записей (после склейки по id):** ${items.length}`,
    '',
    '### Сводная таблица замечаний ИИ-агента',
    '',
    ...tableLines,
    '',
    '### Исходный блок `cf-feedback`',
    '',
    '```cf-feedback',
    JSON.stringify(items, null, 2),
    '```',
  ]
    .filter((line, idx, arr) => !(idx === 0 && line === '') && !(line === '' && arr[idx - 1] === ''))
    .join('\n')

  const url =
    `https://github.com/Creative36711/chronicle-forge/issues/new?labels=ai-feedback` +
    `&title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}`

  return { title, body, url }
}
