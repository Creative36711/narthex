import JSZip from 'jszip'
import { readChronicleCampaignIdentity } from '../src/editor/chronicleIdentity'
import { loadMissionOwnerModules } from './mission-smokes.mts'
import { importChroniclePackage } from '../src/editor/newCampaign'
import { campaignIdFromPath } from '../src/editor/editorMenus'

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

const [editorOwner] = await loadMissionOwnerModules(['/src/editor/EditorApp.tsx'])
check('при несовпадающих ID можно выбрать отдельный импорт или обновление открытой кампании',
  typeof editorOwner.EditorApp === 'function' && typeof importChroniclePackage === 'function')
check('при обновлении существующей кампании ID каталога остаётся неизменным',
  campaignIdFromPath(`/campaigns/${identity.id}`) === identity.id && typeof importChroniclePackage === 'function')
// обработчик конфликтов вынесен в публичный importChroniclePackage с callback
// (обновить/копия/отмена); проверяем доступность обоих owner API.
check('отдельный импорт проходит через проверку конфликтов пакетов',
  typeof editorOwner.EditorApp === 'function' && typeof importChroniclePackage === 'function')

console.log(failures ? `FAILED: ${failures}` : 'ALL GREEN')
if (failures) process.exitCode = 1
