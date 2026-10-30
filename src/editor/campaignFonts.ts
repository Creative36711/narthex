/**
 * Роли шрифтов кампании: тело, заголовки и рукописный акцент.
 *
 * Вынесено из `CampaignEditor.tsx` в таблицу данных: её читают вкладка
 * «Оформление» и образец шрифта, а сами компоненты живут отдельно.
 */

export const FONT_ROLES: Array<{ key: 'body' | 'display' | 'hand'; label: string; sample: string; cls: string }> = [
  { key: 'body', label: 'Основной текст', sample: 'Съешь же ещё этих мягких французских булок, да выпей чаю.', cls: 'font-sample-body' },
  { key: 'display', label: 'Заголовки', sample: 'Пепел Каэрдена', cls: 'font-sample-display' },
  { key: 'hand', label: 'Рукописный (журнал, записки)', sample: 'День третий. Дождь не утихает…', cls: 'font-sample-hand' },
]
