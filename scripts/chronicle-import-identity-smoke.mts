import JSZip from 'jszip'
import { readChronicleCampaignIdentity } from '../src/editor/chronicleIdentity'
import { readFileSync } from 'node:fs'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${label}`)
  if (!ok) failures++
}

const zip = new JSZip()
zip.file('campaign.json', JSON.stringify({ id: '3b7f552a-a345-41dc-ae87-d6259cec7050', title: 'Новая кампания' }))
const packageFile = new File([await zip.generateAsync({ type: 'uint8array' })], 'new-campaign.chronicle')
const identity = await readChronicleCampaignIdentity(packageFile)
check('импорт предварительно считывает ID и название из .chronicle',
  identity.id === '3b7f552a-a345-41dc-ae87-d6259cec7050' && identity.title === 'Новая кампания')

const editor = readFileSync('src/editor/EditorApp.tsx', 'utf8')
check('при несовпадающих ID можно выбрать отдельный импорт или обновление открытой кампании',
  editor.includes('Импортировать отдельно') && editor.includes('Обновить открытую'))
check('при обновлении существующей кампании ID каталога остаётся неизменным',
  editor.includes('store.setCampaignId(stableId)') && editor.includes('автоматически привёл к нему ID'))
check('отдельный импорт проходит через проверку конфликтов пакетов', editor.includes('importChroniclePackage(file, async (conflict)'))

console.log(failures ? `FAILED: ${failures}` : 'ALL GREEN')
if (failures) process.exitCode = 1
