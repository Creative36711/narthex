/**
 * Манифест документации, которая вкладывается в единый пакет задания для
 * внешнего ИИ. Пакет дополнительно содержит файлы кампании, brief и отчёт
 * проверки в AI_TASK_DIR; список справочных файлов остаётся централизованным.
 */
export const AI_TASK_DIR = '__chronicle_ai__/'

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
