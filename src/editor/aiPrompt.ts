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
    `Ты создаёшь или редактируешь кампанию Chronicle Forge в режиме MonolithDoc JSON. Обязательные ключи верхнего уровня: ${required}. Необязательные ключи: ${optional}.`,
    'Это компактный запасной формат для текстовых/структурных правок без бинарных медиа; для полной передачи используй .chronicle. СТРОГО следуй схеме MonolithDoc и выведи ТОЛЬКО JSON — без markdown-обёрток, комментариев и пояснений.',
    'Сначала заполни campaign.design_doc по бланку design-template.md, затем в этом же ответе выполни запрос целиком и верни готовый MonolithDoc. Не останавливайся на плане, не жди «ок» и не задавай уточняющих вопросов: при нехватке вводных прими разумные допущения и запиши их в design_doc. На следующих итерациях сначала обновляй design_doc, затем кампанию.',
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
    'Для этой задачи мастер выбрал JSON-режим: не выдавай .chronicle и не добавляй бинарные медиа. Перед выдачей проверь, что верхний уровень и каждое поле соответствуют MonolithDoc и его JSON Schema; не добавляй неописанных движком полей. Выведи ТОЛЬКО JSON.',
  ].join('\n')
}
