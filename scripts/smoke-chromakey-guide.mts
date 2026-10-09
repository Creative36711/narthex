import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

console.log('Testing Chromakey Cutout Tool and AI Guide Enhancements...')

// 1. Проверка утилиты cutout-chromakey.py
if (!existsSync('scripts/cutout-chromakey.py')) {
  throw new Error('scripts/cutout-chromakey.py must exist')
}

// 2. Проверка работы скрипта на тестовом изображении через ImageMagick/Pillow
try {
  execSync('convert -size 80x80 xc:"#00FF00" -fill "#FF7800" -draw "rectangle 20,20 60,60" /tmp/test_chroma_smoke.png')
  execSync('python3 scripts/cutout-chromakey.py /tmp/test_chroma_smoke.png /tmp/test_chroma_smoke_out.png --color "#00FF00"')
  const cornerPixel = execSync('convert /tmp/test_chroma_smoke_out.png[1x1+0+0] -format "%[pixel:p{0,0}]" info:').toString()
  const centerPixel = execSync('convert /tmp/test_chroma_smoke_out.png[1x1+40+40] -format "%[pixel:p{0,0}]" info:').toString()
  if (!cornerPixel.includes(',0)') && !cornerPixel.includes(',0]')) {
    throw new Error(`Corner must be transparent, got: ${cornerPixel}`)
  }
  if (centerPixel.includes(',0)') || centerPixel.includes(',0]')) {
    throw new Error(`Center must remain opaque, got: ${centerPixel}`)
  }
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
  if (!content.includes('Visual Continuity') || !content.includes('визуальные якоря')) {
    throw new Error(`${name} must contain Visual Continuity rules and visual anchors guidance`)
  }
}
console.log('✓ 2. В руководствах ИИ подробно описан регламент хромакея (#00FF00), вырезания, ловушки фейковой шахматки и визуальной преемственности')

// 4. Проверка aiTask.ts
const aiTask = readFileSync('src/editor/aiTask.ts', 'utf-8')
if (!aiTask.includes('cutout-chromakey.py') || !aiTask.includes('solid plain vivid green background #00FF00 chromakey')) {
  throw new Error('src/editor/aiTask.ts must include chromakey cutout instructions for AI scenarios')
}
if (!aiTask.includes('ВИЗУАЛЬНАЯ ПРЕЕМСТВЕННОСТЬ') || !aiTask.includes('vision')) {
  throw new Error('src/editor/aiTask.ts must include visual continuity and vision inspection instructions')
}
console.log('✓ 3. В инструкцию для ИИ-сценариста (aiTask.ts) внедрены строгие правила хромакея и визуальной преемственности (vision inspection)')

// 5. Проверка campaignAudit.ts и book
const audit = readFileSync('src/editor/campaignAudit.ts', 'utf-8')
const bookVisual = readFileSync('docs/book/04-visual.md', 'utf-8')
if (!audit.includes('cutout-chromakey.py')) {
  throw new Error('campaignAudit.ts must advise running cutout-chromakey.py when opaque corners are found')
}
if (!audit.includes('frame') || !audit.includes('atmospherics')) {
  throw new Error('campaignAudit.ts must inspect frame and atmospherics in alpha roles')
}
if (!bookVisual.includes('Visual Continuity') || !bookVisual.includes('cutout-chromakey.py')) {
  throw new Error('docs/book/04-visual.md must include Visual Continuity and cutout-chromakey advice')
}
console.log('✓ 4. Аудит кампании и книга мастера дополнены проверками и советами по визуальной преемственности')

console.log('\nAll chromakey and continuity smoke tests passed successfully!')
