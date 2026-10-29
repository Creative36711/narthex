import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const p = '_ai-temp/campaing/campaign.json'
const camp = JSON.parse(readFileSync(p, 'utf-8'))
console.log('Campaign title:', camp.meta.title)
console.log('Campaign id:', camp.meta.id)
console.log('Starting scene:', camp.meta.starting_scene)
console.log('Starting location:', camp.meta.starting_location)

// Проверим наличие файлов картинок и звуков, на которые ссылается кампания
let missingAssets = 0
function checkAsset(path: string | undefined, label: string) {
  if (!path) return
  if (path.startsWith('http')) return
  const full = join('_ai-temp/campaing', path)
  if (!existsSync(full)) {
    console.warn(`[MISSING ASSET] ${label}: ${path}`)
    missingAssets++
  }
}

// Проверим фон меню
checkAsset(camp.meta.theme?.menu?.background, 'menu background')
checkAsset(camp.meta.theme?.end?.background, 'end background')

// Проверим сцены
for (const [scId, sc] of Object.entries(camp.scenes || {})) {
  for (const st of (sc as any).states || []) {
    if (st.image) checkAsset(st.image, `scene ${scId} state ${st.id} image`)
  }
}

console.log('Missing assets count:', missingAssets)
