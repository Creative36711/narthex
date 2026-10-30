/**
 * Подписи полей генераторов контента и их человекочитаемый вид.
 *
 * Вынесено из `CampaignEditor.tsx` в отдельную таблицу: подписи нужны и
 * редактору генераторов, и паспорту кампании, а компоненты — нет.
 */

export const GEN_FIELD_LABELS: Record<string, string> = {
  description: 'описание',
  disposition_label: 'метка расположения',
}
/** «описание (description)» — по-русски, с техническим именем рядом */
export function genFieldLabel(field: string): string {
  return GEN_FIELD_LABELS[field] ? `${GEN_FIELD_LABELS[field]} (${field})` : field
}
