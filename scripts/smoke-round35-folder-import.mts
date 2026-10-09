import assert from 'node:assert/strict'
import { isAllowedCampaignFile, stripZipRootPrefix } from '../src/editor/newCampaign'
import { createAiTaskRepoKit } from '../src/editor/aiTask'
import { EditorStore } from '../src/editor/store'
import JSZip from 'jszip'

console.log('--- Smoke test: Folder import & AI Repo Kit ---')

// 1. Тест фильтрации файлов кампании
const forbiddenFiles = [
  '.git/HEAD',
  '.git/config',
  '.git/objects/01/abcdef',
  '.github/workflows/deploy.yml',
  'tools/build.py',
  'tools/c_entities.py',
  'tools/generate_all.sh',
  '_ai-temp/notes.txt',
  '_ai-temp/campaing/test.json',
  'test/my_test.json',
  '__pycache__/script.cpython-310.pyc',
  'scripts/generate.py',
  'setup.py',
  'run.sh',
  'node_modules/package.json',
]

for (const path of forbiddenFiles) {
  assert.strictEqual(
    isAllowedCampaignFile(path),
    false,
    `Файл ${path} обязан быть отфильтрован как служебный мусор/скрипт`,
  )
}
console.log('✓ Все 15 служебных файлов Git, tools и скриптов успешно отфильтрованы')

const allowedFiles = [
  'campaign.json',
  'world.json',
  'manifest.json',
  'scenes/scene_square.json',
  'entities/npc_merchant.json',
  'rules/core_rules.json',
  'encounters/goblin_ambush.json',
  'arenas/arena_cave.json',
  'quests/quest_main.json',
  'cutscenes/intro.json',
  'recipes/craft_potion.json',
  'codex/lore_city.json',
  'dialogues/merchant.dlg.json',
  'dialogues/merchant.ink',
  'assets/images/background.png',
  'assets/audio/bgm.ogg',
  'assets/icons/sword.png',
  'README.md',
  'DESIGN.md',
]

for (const path of allowedFiles) {
  assert.strictEqual(
    isAllowedCampaignFile(path),
    true,
    `Канонический файл кампании ${path} обязан быть разрешен`,
  )
}
console.log('✓ Все 19 канонических файлов кампании успешно разрешены')

// 2. Тест снятия префикса репозитория GitHub
const zipPaths = [
  'campaign-repo-main/campaign.json',
  'campaign-repo-main/scenes/start.json',
  'campaign-repo-main/assets/bg.jpg',
]
for (const p of zipPaths) {
  const stripped = stripZipRootPrefix(p)
  assert.ok(!stripped.startsWith('campaign-repo-main/'), `Префикс должен быть удален из ${p}`)
  assert.ok(isAllowedCampaignFile(stripped), `Срезанный путь ${stripped} должен быть валидным файлом кампании`)
}
console.log('✓ Префикс GitHub репозитория автоматически распознан и удален')

// 3. Тест сборки легковесного чемодана ИИ createAiTaskRepoKit
async function testRepoKit() {
  const store = new EditorStore('/campaigns/ash-of-caerden')
  const kitResult = await createAiTaskRepoKit(store, {
    mode: 'edit',
    task: 'Тестовое задание для проверки чемодана репозитория',
    outputFormat: 'chronicle',
  })

  assert.ok(kitResult.filename.includes('__chronicle_ai__-kit.zip'), 'Имя файла должно указывать на kit')
  assert.ok(kitResult.blob.size > 10000, 'Архив содержит файлы гайда и схем')
  assert.ok(kitResult.blob.size < 2 * 1024 * 1024, `Архив кита должен быть компактным (<2MB), получено: ${kitResult.blob.size} байт`)

  const zip = await JSZip.loadAsync(kitResult.blob)
  const files = Object.keys(zip.files)
  
  assert.ok(files.some((f) => f.includes('__chronicle_ai__/TASK.md')), 'Чемодан обязан содержать TASK.md')
  assert.ok(files.some((f) => f.includes('__chronicle_ai__/campaign-guide.md')), 'Чемодан обязан содержать campaign-guide.md')
  assert.ok(files.some((f) => f.includes('__chronicle_ai__/campaign.schema.json')), 'Чемодан обязан содержать campaign.schema.json')
  assert.ok(files.some((f) => f.includes('__chronicle_ai__/cutout-chromakey.py')), 'Чемодан обязан содержать cutout-chromakey.py')
  
  // Проверим, что нет дублирования папок assets/ в корне архива
  assert.ok(!files.some((f) => f.startsWith('assets/')), 'В легковесном чемодане не должно быть тяжелых медиафайлов assets/')
  
  console.log(`✓ Легковесный чемодан ИИ собран успешно (размер: ${(kitResult.blob.size / 1024).toFixed(1)} КБ)`)
}

testRepoKit()
  .then(() => {
    console.log('--- Все проверки импорта папок и легковесного чемодана пройдены успешно! ---')
  })
  .catch((err) => {
    console.error('Ошибка в смоук-тесте:', err)
    process.exit(1)
  })
