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

// 4. Тест устойчивости импорта папки с тысячами файлов Git (.git/) и глубоким campaign.json
async function testLargeFolderImport() {
  const { importCampaignFromDirectory } = await import('../src/editor/newCampaign')
  
  // Имитируем 2828 файлов, из которых 2800 — служебные файлы репозитория Git
  const fakeFiles: File[] = []
  
  // Корневая папка репозитория: MyRepo/
  const repoRoot = 'MyRepo/'
  
  // 1. Полезные файлы кампании
  const campaignMeta = {
    id: 'smoke-large-repo',
    title: 'Большая кампания из Git',
    version: '1.0.0',
    min_engine: '0.8.0',
    package_format: 1,
  }
  
  fakeFiles.push(new File([JSON.stringify(campaignMeta)], `${repoRoot}campaign.json`, { type: 'application/json' }))
  Object.defineProperty(fakeFiles[fakeFiles.length - 1], 'webkitRelativePath', { value: `${repoRoot}campaign.json` })
  
  fakeFiles.push(new File(['{"id": "w1"}'], `${repoRoot}world.json`, { type: 'application/json' }))
  Object.defineProperty(fakeFiles[fakeFiles.length - 1], 'webkitRelativePath', { value: `${repoRoot}world.json` })

  fakeFiles.push(new File(['{"version": 1, "scenes": ["scenes/start.json"]}'], `${repoRoot}manifest.json`, { type: 'application/json' }))
  Object.defineProperty(fakeFiles[fakeFiles.length - 1], 'webkitRelativePath', { value: `${repoRoot}manifest.json` })

  fakeFiles.push(new File(['{"id": "start", "label": "Старт"}'], `${repoRoot}scenes/start.json`, { type: 'application/json' }))
  Object.defineProperty(fakeFiles[fakeFiles.length - 1], 'webkitRelativePath', { value: `${repoRoot}scenes/start.json` })

  // 2. Имитируем 2800 файлов .git/ (коммиты, объекты, индексы)
  for (let i = 0; i < 2800; i++) {
    const gitFile = new File(['git-dummy-data'], `${repoRoot}.git/objects/${i.toString(16).padStart(2, '0')}/abc${i}`, { type: 'application/octet-stream' })
    Object.defineProperty(gitFile, 'webkitRelativePath', { value: `${repoRoot}.git/objects/${i.toString(16).padStart(2, '0')}/abc${i}` })
    fakeFiles.push(gitFile)
  }

  // 3. Имитируем 24 скрипта и временных файлов tools/
  for (let i = 0; i < 24; i++) {
    const toolFile = new File(['# python script'], `${repoRoot}tools/script_${i}.py`, { type: 'text/x-python' })
    Object.defineProperty(toolFile, 'webkitRelativePath', { value: `${repoRoot}tools/script_${i}.py` })
    fakeFiles.push(toolFile)
  }

  assert.strictEqual(fakeFiles.length, 2828, 'Общее количество файлов в симуляции должно быть ровно 2828')

  // Заглушим сетевые fetch-запросы для сохранения в смоук-тесте
  const savedFiles: string[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(url)
    if (urlStr.includes('/__editor/save')) {
      const body = JSON.parse(String(init?.body)) as { path: string }
      savedFiles.push(body.path)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (urlStr.includes('/campaigns/index.json')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (urlStr.includes('/__editor/reserve')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }

  try {
    const result = await importCampaignFromDirectory(fakeFiles)
    assert.strictEqual(result.id, 'smoke-large-repo', 'ID кампании должен быть извлечен из campaign.json')
    assert.strictEqual(result.title, 'Большая кампания из Git', 'Название должно совпадать')
    
    // Проверим, что сохранились только канонические файлы кампании
    assert.ok(savedFiles.some((f) => f.includes('campaign.json')), 'campaign.json обязан быть сохранен')
    assert.ok(savedFiles.some((f) => f.includes('world.json')), 'world.json обязан быть сохранен')
    assert.ok(savedFiles.some((f) => f.includes('manifest.json')), 'manifest.json обязан быть сохранен')
    assert.ok(savedFiles.some((f) => f.includes('scenes/start.json')), 'scenes/start.json обязан быть сохранен')
    
    // Проверим, что НИ ОДИН из 2800 файлов .git/ или tools/ НЕ был сохранен
    assert.ok(!savedFiles.some((f) => f.includes('.git')), 'Ни один файл .git не должен сохраняться')
    assert.ok(!savedFiles.some((f) => f.includes('tools/')), 'Ни один файл tools/ не должен сохраняться')
    
    console.log(`✓ Симуляция 2828 файлов репозитория: успешно обработана, отфильтровано 2824 служебных файлов, сохранено файлов кампании: ${savedFiles.length}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

Promise.all([testRepoKit(), testLargeFolderImport()])
  .then(() => {
    console.log('--- Все проверки импорта папок и легковесного чемодана пройдены успешно! ---')
  })
  .catch((err) => {
    console.error('Ошибка в смоук-тесте:', err)
    process.exit(1)
  })
