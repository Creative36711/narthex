import { MONOLITH_OPTIONAL_KEYS, MONOLITH_REQUIRED_KEYS } from '../shared/types'

export interface AiCampaignBrief {
  genre?: string
  tone?: string
  scale?: string
  accents?: string[]
  must?: string
  mustNot?: string
  idea?: string
}

/** Сборка именно того текста, который копирует мастер: проверяется тестом на синхронность с MonolithDoc. */
export function buildAiCampaignPrompt(brief: AiCampaignBrief, guide: string): string {
  const required = MONOLITH_REQUIRED_KEYS.join(', ')
  const optional = MONOLITH_OPTIONAL_KEYS.join(', ')
  const requirements = [
    brief.genre && `- Сеттинг/жанр: ${brief.genre}`,
    brief.tone && `- Тон: ${brief.tone}`,
    brief.scale && `- Масштаб: ${brief.scale}`,
    brief.accents?.length && `- Акценты: ${brief.accents.join('; ')}`,
    brief.must?.trim() && `- Обязательно должно быть: ${brief.must.trim()}`,
    brief.mustNot?.trim() && `- Чего быть не должно: ${brief.mustNot.trim()}`,
  ].filter(Boolean) as string[]

  return [
    `Ты создаёшь кампанию Chronicle Forge в формате MonolithDoc. Обязательные ключи верхнего уровня: ${required}. Необязательные ключи: ${optional}.`,
    'СТРОГО следуй техническому руководству ниже и схеме MonolithDoc. Выведи ТОЛЬКО JSON — без markdown-обёрток, комментариев и пояснений.',
    '',
    '=== ТЕХНИЧЕСКОЕ РУКОВОДСТВО (ai-campaign-guide.md) ===',
    guide.trim(),
    '',
    '=== ЖЁСТКИЕ ТРЕБОВАНИЯ МАСТЕРА ===',
    requirements.length ? requirements.join('\n') : '- (не заданы — действуй по руководству)',
    '',
    '=== ТВОРЧЕСКОЕ НАПРАВЛЕНИЕ МАСТЕРА ===',
    brief.idea?.trim() || '(нет — придумай интересную камерную историю сам)',
    '',
    'Перед выдачей проверь, что верхний уровень и каждое поле соответствуют MonolithDoc и его JSON Schema; не добавляй неописанных движком полей. Выведи ТОЛЬКО JSON.',
  ].join('\n')
}
