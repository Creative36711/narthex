/**
 * Манифест «чемодана для ИИ-агента» — единственный список файлов набора.
 * Читают его три потребителя: сборщик архива (EditorApp.doExportAiKit),
 * аудит форматов (scripts/audit-campaign-formats.mts) и смоук
 * дизайн-документа (scripts/design-doc-guard.mts), поэтому состав не может
 * разъехаться (раньше файл лежал в public/ai, но не попадал в архив).
 *
 * `campaign.json` в манифест не входит: он генерируется на лету при экспорте,
 * в public/ai не лежит, но в архиве кладётся первой записью — итого в архиве
 * ровно 4 файла.
 */
export const AI_KIT_FILES = [
  { name: 'campaign-guide.md', title: 'Гайд по движку и формату кампании' },
  { name: 'campaign.schema.json', title: 'JSON Schema всех полей' },
  { name: 'design-template.md', title: 'Бланк дизайн-документа' },
] as const

/**
 * §0 гайда — инструкция, которую агент читает первым. Тот же текст копирует
 * кнопка «Скопировать инструкцию для ИИ» в окне после скачивания чемодана:
 * для чатов, которые не принимают архивы, мастер вставляет его первым
 * сообщением — иначе после удаления отдельного стартового файла у него не
 * осталось бы ничего, что можно дать агенту руками.
 */
export function startInstructionOf(guideText: string): string {
  const block = guideText.match(
    /<!-- START-INSTRUCTION:BEGIN -->\n?([\s\S]*?)\n?<!-- START-INSTRUCTION:END -->/,
  )
  if (block) return block[1].trim()
  // запасной случай (маркеры потеряны): первый раздел гайда до §0б/§1
  const section = guideText.match(/^## 0\. [\s\S]*?(?=^## 0б\.|^## 1\. )/m)
  return (section?.[0] ?? guideText).trim()
}
