/**
 * Смоук-тест:
 * 1. Распознавание ссылок на аудио/озвучки без кавычек в .ink ремарках (# voice: assets/...).
 * 2. Каноническая папка encounters/ для таблиц встреч (устранение конфликта rules/encounters.json).
 * 3. Метод store.hasFile() для корректной дедупликации ассетов.
 */

import { collectCampaignMedia } from '../src/editor/campaignAudit.js'
import { EditorStore } from '../src/editor/store.js'
import { normalizeChronicleManifest } from '../src/editor/chronicleManifest.js'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    process.exit(1)
  }
}

console.log('--- 1. Проверка распознавания медиа-файлов и озвучек в ink без кавычек ---')
const store = new EditorStore()
store.meta = { id: 'test_camp', title: 'Test', author: '', version: '1.0.0', tick_label: 'час' } as any
store.world = { regions: [] } as any
store.manifest = { scenes: [], entities: [], rules: [], encounters: [], dialogues: ['hero.ink'] } as any

// Добавим ink-файл с тегом озвучки без кавычек
store.textFiles.set('dialogues/hero.ink', `
=== Start ===
# voice: assets/audio/voice/hero_intro.mp3
— Привет, путник!
# sfx: assets/audio/sfx/latch.ogg
-> END
`)

const media = collectCampaignMedia(store)
assert(media.local.includes('assets/audio/voice/hero_intro.mp3'), 'collectCampaignMedia должен находить # voice: без кавычек')
assert(media.local.includes('assets/audio/sfx/latch.ogg'), 'collectCampaignMedia должен находить # sfx: без кавычек')
console.log('✓ Озвучки и звуковые эффекты в Ink успешно извлекаются без кавычек!')

console.log('--- 2. Проверка канонической папки encounters/ ---')
const encountersPath = store.createFile('encounters', 'enc_streets.json', { encounter_tables: [] })
assert(encountersPath === 'encounters/enc_streets.json', `Файл встреч должен сохраняться в encounters/, получено: ${encountersPath}`)
assert(store.jsonFiles.has('encounters/enc_streets.json'), 'store.jsonFiles должен содержать encounters/enc_streets.json')
assert(store.hasFile('encounters/enc_streets.json'), 'store.hasFile должен подтверждать наличие файла')

// Проверка нормализации манифеста
const rawManifest = {
  scenes: [],
  encounters: ['enc_streets.json']
}
const jsonFiles = new Map<string, unknown>([['rules/enc_streets.json', { encounter_tables: [] }]])
const textFiles = new Map<string, string>()

normalizeChronicleManifest(rawManifest, jsonFiles, textFiles)
assert(jsonFiles.has('encounters/enc_streets.json'), 'Старые файлы встреч из rules/ должны перемещаться в encounters/')
console.log('✓ Таблицы встреч работают строго в папке encounters/, не ломая валидацию rules/!')

console.log('Все проверки encounters и извлечения ассетов пройдены успешно!')
