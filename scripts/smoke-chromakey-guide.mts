import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

console.log('Testing Chromakey Cutout Tool and AI Guide Enhancements...')

// 1. Проверка утилиты cutout-chromakey.py
if (!existsSync('scripts/cutout-chromakey.py')) {
  throw new Error('scripts/cutout-chromakey.py must exist')
}

// 2. Проверка работы скрипта на тестовом изображении
try {
  execSync(`python3 -c "from PIL import Image, ImageDraw; img = Image.new('RGB', (80, 80), (0, 255, 0)); d = ImageDraw.Draw(img); d.rectangle([20, 20, 60, 60], fill=(255, 120, 0)); img.save('/tmp/test_chroma_smoke.png')"` )
  execSync('python3 scripts/cutout-chromakey.py /tmp/test_chroma_smoke.png /tmp/test_chroma_smoke_out.png --color "#00FF00"')
  execSync(`python3 -c "from PIL import Image; res = Image.open('/tmp/test_chroma_smoke_out.png'); assert res.getpixel((0, 0))[3] == 0; assert res.getpixel((40, 40))[3] == 255"` )
  console.log('✓ 1. Утилита scripts/cutout-chromakey.py успешно вырезает хромакей и сохраняет альфа-канал')
} catch (e) {
  throw new Error(`Chromakey cutout script test failed: ${e}`)
}

// 3. Проверка руководства для ИИ (docs/ai-campaign-guide.md и public/ai/campaign-guide.md)
const guide = readFileSync('docs/ai-campaign-guide.md', 'utf-8')
const pubGuide = readFileSync('public/ai/campaign-guide.md', 'utf-8')

for (const [name, content] of [['docs guide', guide], ['public guide', pubGuide]]) {
  if (!content.includes('хромакей') || !content.includes('cutout-chromakey.py')) {
    throw new Error(`${name} must contain chromakey and cutout-chromakey.py instructions`)
  }
  if (!content.includes('фейковая шахматка') && !content.includes('шахматную клетку')) {
    throw new Error(`${name} must explain fake checkerboard pattern pitfall`)
  }
  if (!content.includes('#00FF00')) {
    throw new Error(`${name} must specify #00FF00 green chromakey prompt`)
  }
}
console.log('✓ 2. В руководствах ИИ подробно описан регламент хромакея (#00FF00), вырезания и ловушки фейковой шахматки')

// 4. Проверка aiTask.ts
const aiTask = readFileSync('src/editor/aiTask.ts', 'utf-8')
if (!aiTask.includes('cutout-chromakey.py') || !aiTask.includes('solid plain vivid green background #00FF00 chromakey')) {
  throw new Error('src/editor/aiTask.ts must include chromakey cutout instructions for AI scenarios')
}
console.log('✓ 3. В инструкцию для ИИ-сценариста (aiTask.ts) внедрены строгие правила хромакея вместо transparent-промптов')

// 5. Проверка campaignAudit.ts
const audit = readFileSync('src/editor/campaignAudit.ts', 'utf-8')
if (!audit.includes('cutout-chromakey.py')) {
  throw new Error('campaignAudit.ts must advise running cutout-chromakey.py when opaque corners are found')
}
if (!audit.includes('frame') || !audit.includes('atmospherics')) {
  throw new Error('campaignAudit.ts must inspect frame and atmospherics in alpha roles')
}
console.log('✓ 4. Аудит кампании дополнен проверкой рамки/частиц и подсказкой запуска скрипта хромакея')

console.log('\nAll chromakey guide smoke tests passed successfully!')
