/**
 * Смоук-тест:
 * 1. Блокирующий оверлей при импорте кампании (в MainMenu, NoCampaignScreen и EditorApp).
 * 2. Наличие инструмента cutout-chromakey.py в AI_KIT_FILES и public/ai.
 * 3. Регламент различия ракурсов: вид сверху для combat_figure и вырезание полостей хромакея в гайде.
 */

import { readFileSync, existsSync } from 'node:fs'
import { AI_KIT_FILES } from '../src/editor/aiKit.js'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    process.exit(1)
  }
}

console.log('--- Проверка оверлея блокировки интерфейса при импорте ---')
const mainMenuCode = readFileSync('src/player/MainMenu.tsx', 'utf-8')
assert(mainMenuCode.includes('import-busy-overlay'), 'MainMenu должен содержать import-busy-overlay')
assert(mainMenuCode.includes('disabled={!!importBusy}'), 'MainMenu должен отключать кнопки во время импорта')

const noCampaignCode = readFileSync('src/player/NoCampaignScreen.tsx', 'utf-8')
assert(noCampaignCode.includes('import-busy-overlay'), 'NoCampaignScreen должен содержать import-busy-overlay')

const editorAppCode = readFileSync('src/editor/EditorApp.tsx', 'utf-8')
assert(editorAppCode.includes('editor-busy-overlay'), 'EditorApp должен содержать editor-busy-overlay')

console.log('✓ Блокирующие оверлеи интерфейса внедрены во все экраны импорта!')

console.log('--- Проверка инструмента cutout-chromakey.py ---')
assert(existsSync('scripts/cutout-chromakey.py'), 'Скрипт scripts/cutout-chromakey.py должен существовать')
assert(existsSync('public/ai/cutout-chromakey.py'), 'Скрипт public/ai/cutout-chromakey.py должен существовать в чемодане ИИ')
assert(AI_KIT_FILES.some((f) => f.name === 'cutout-chromakey.py'), 'cutout-chromakey.py должен быть в AI_KIT_FILES')
console.log('✓ Инструмент вырезания хромакея включён в репозиторий и чемодан ИИ!')

console.log('--- Проверка гайда и инструкций ИИ ---')
const guideText = readFileSync('docs/ai-campaign-guide.md', 'utf-8')
assert(guideText.includes('combat_figure') && guideText.includes('видом сверху'), 'Гайд должен содержать требования вида сверху для combat_figure')
assert(guideText.includes('cutout-chromakey.py'), 'Гайд должен ссылаться на cutout-chromakey.py')
assert(guideText.includes('зачистка полостей') || guideText.includes('полостей'), 'Гайд должен описывать проблему замкнутых полостей')

const aiTaskText = readFileSync('src/editor/aiTask.ts', 'utf-8')
assert(aiTaskText.includes('ВИД СВЕРХУ'), 'Задание ИИ должно явно указывать ВИД СВЕРХУ для combat_figure')
assert(aiTaskText.includes('cutout-chromakey.py'), 'Задание ИИ должно упоминать cutout-chromakey.py')

console.log('✓ Все инструкции для ИИ и проверки успешно пройдены!')
