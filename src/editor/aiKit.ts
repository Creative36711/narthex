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
  { name: 'cutout-chromakey.py', title: 'Инструмент вырезания хромакея' },
  // собирается из scripts/campaign-audit.mts командой build:ai-bundle (один
  // файл, ноль зависимостей, поведение = «Проверке кампании» в редакторе)
  { name: 'campaign-audit.mjs', title: 'Аудит кампании из командной строки: node campaign-audit.mjs <папка> (без репозитория движка)' },
  // движок как инструмент: граф, диалоги, прогоны, приёмка — один файл, ноль
  // зависимостей; собирается командой build:playkit-bundle из scripts/playkit
  { name: 'cf-play.mjs', title: 'Плейкит: check/graph/dialogue/run/explore/fuzz/sweep/verify без репозитория движка' },
  { name: 'PLAYKIT.md', title: 'Инструкция агенту: как проверять кампанию плейкитом и что считается приёмкой' },
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
