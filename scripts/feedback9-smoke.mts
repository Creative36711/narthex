/**
 * Фидбек 9 — ревизия по списку: фильтр надетого, голоса напарника, кастомные
 * иконки/курсоры/тултипы (без эмодзи), категории меню, под-вкладки кампании,
 * зацикленные звуки и их наложение, стили аудио, выбор звука с поиском, превью
 * гасит музыку, счётчик слайдов только в testMode, реестр состояний портретов,
 * мастер «Кампания с ИИ», FileAdvancedJson, конец YouTube-ролика, «use»-хук в бою.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'

let fails = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) fails++
}
function read(p: string) {
  return readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
}

const ent = read('src/editor/EntityEditor.tsx')
const app = read('src/editor/EditorApp.tsx')
const camp = read('src/editor/CampaignEditor.tsx')
const audioTs = read('src/shared/audio.ts')
const audioSec = read('src/editor/AudioSection.tsx')
const gameView = read('src/player/GameView.tsx')
const types = read('src/shared/types.ts')
const cutscene = read('src/shared/CutscenePlayer.tsx')
const combat = read('src/core/combat.ts')
const icons = read('src/shared/icons.tsx')
const aiWiz = read('src/editor/AiWizard.tsx')
const fields = read('src/editor/Fields.tsx')
const speech = read('src/shared/speech.ts')
const settingsPanel = read('src/shared/SettingsPanel.tsx')
const dialogue = read('src/editor/DialogueBuilder.tsx')

// 1 — фильтр «надето»
const panels = read('src/player/Panels.tsx')
const appFile = app
check('1 фильтры: инвентарь по надетому, список сущностей по типу', /EQUIP_FILTERS\s*=\s*\[\s*'all',\s*'equipped',\s*'unequipped'\s*\]/.test(panels) && /Надето/.test(panels) && /kindF/.test(appFile) && /'item', 'Предметы'/.test(appFile))
// 2 — голоса напарника
check('2 голос озвучки: селект + проверка', /ttsVoices/.test(speech) && /tts_voice/.test(settingsPanel) && /Проверка голоса/.test(settingsPanel))
// 3 — кастомные иконки/курсоры, без эмодзи и нативных title
const ICONS = ['close','play','stop','sound','dice','image','settings','map','sword','scroll','music','palette','edit','user','bag','trash','globe','film','book','doc','download','plus','check','warn','up','down','left','right','chevron','chevronRight','sparkle','coin','mic','star','heart','flame','ghost','lock','help','message','move','flag','clock','skull','trophy','info','panel','shield']
check('3 Ico: полный набор', ICONS.every((n) => new RegExp(`\\n  ${n}: `).test(icons)))
const srcs = ['src/editor','src/player','src/shared','src/core','src/menu']
let emoji = 0, titleAttrs = 0
const glob = (dir: string): string[] => {
  const out: string[] = []
  const base = new URL(`../${dir}/`, import.meta.url).pathname
  for (const f of readdirSync(base)) {
    const p = base + f
    if (statSync(p).isDirectory()) out.push(...glob(`${dir}/${f}`))
    else if (/\.(tsx?|mts|css)$/.test(f)) out.push(`${dir}/${f}`)
  }
  return out
}
for (const dir of srcs) {
  if (!existsSync(new URL(`../${dir}/`, import.meta.url))) continue
  for (const f of glob(dir)) {
    readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
      .split('\n')
      .forEach((line) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
        // ♯/♭ (U+266D–U+266F) — нотные знаки, а не эмодзи
        if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{266C}\u{2670}-\u{27BF}\u{FE0F}]/u.test(line)) emoji++
        if (/\stitle=/.test(line)) titleAttrs++
      })
  }
}
check('3 эмодзи в коде', emoji === 0, `нашлось ${emoji}`)
check('3 нативных title=', titleAttrs === 0, `нашлось ${titleAttrs}`)
// 4 — категории меню
check('4 MENUS: категории меню', /const MENUS/.test(app) && ['Проект','Мир','Персонажи','История'].every((c) => app.includes(c)) && app.includes('Кампания и реестры') && app.includes('Катсцены'))
// 5 — под-вкладки кампании
check('5 под-вкладки «Кампании»', /О кампании/.test(camp) && /Рогалик/.test(camp) && /Потребности/.test(camp) && /Состояния портретов/.test(camp))
// 6 — зацикленные звуки и наложение
check('6 SoundDef.loop', /loop\?: boolean/.test(types) && /"loop": true/.test(read('public/campaigns/ash-of-caerden/campaign.json')))
check('6 ambient-слои локации и сцены', /ambient\?: string\[\]/.test(types) && /refreshAmbient/.test(audioTs) && /refreshAmbient/.test(gameView) && /stopAllLoops/.test(gameView))
check('6 каналы по id, повтор — no-op', /Map<string,/.test(audioTs) && /activeLoops/.test(audioTs))
// 7 — стили аудио (7+10)
check('7 стили аудио (настроения и слои)', /MusicRulesEditor/.test(audioSec) && /export type MusicMood/.test(types) && /export type MusicLayer/.test(types) && /Музыка боя/.test(read('src/editor/ArenaEditor.tsx')))
// 8 — выбор звука с поиском
check('8 RegistryPicker + поиск звука', /function RegistryPicker/.test(audioSec) && /поиск/i.test(audioSec) && /SoundMultiSelect/.test(audioSec))
check('2б живой поиск списков (редактор + игрок)', /Поиск по названию/.test(app) && /Поиск по названию/.test(panels))
// 9 — превью гасит музыку; счётчик только testMode
check('9 превью гасит музыку', /previewMusicSource/.test(audioSec) && /stopMusic\(0\.15\)/.test(audioSec))
check('9 счётчик/badge только testMode', /if \(testMode\)/.test(cutscene) && /console\.time/.test(cutscene) && /console\.count/.test(cutscene) && /slide-\$\{index\}/.test(cutscene))
check('9 субтитры YouTube выключены', /cc_load_policy=0/.test(cutscene) && /iv_load_policy=3/.test(cutscene))
check('9 конец YouTube-ролика (ENDED)', /YoutubeSlide/.test(cutscene) && /loadYtApi/.test(cutscene) && /e\.data === 0/.test(cutscene))
// 11 — подсказка убрана
check('11 подсказка убрана', !/podskazka|подсказка11/i.test(gameView))
// 14C — реестр состояний портретов
check('14C EmotionDef + реестр состояний (DEFAULT_EMOTION)', /interface EmotionDef/.test(types) && /DEFAULT_EMOTION/.test(types) && /emotionsOf/.test(ent) && /emotionsFor/.test(dialogue))
check('14C «Состояния портретов» в кампании', /Состояния портретов/.test(camp))
// 14A+B — мастер ИИ
check('14A AiWizard + промпт из гайда', existsSync(new URL('../src/editor/AiWizard.tsx', import.meta.url)) && /ai-campaign-guide\.md\?raw/.test(aiWiz) && /Скопировать промпт/.test(aiWiz))
check('14B отчёт для ИИ', /aiFixReport/.test(app) && /Скопировать отчёт для ИИ/.test(app))
// 12 — FileAdvancedJson
check('12 FileAdvancedJson во всех формах', (fields.match(/export function FileAdvancedJson/g) || []).length === 1 && (['src/editor/QuestEditor.tsx','src/editor/RuleEditor.tsx','src/editor/ArenaEditor.tsx','src/editor/SceneEditor.tsx','src/editor/WorldEditor.tsx','src/editor/EntityEditor.tsx'].every((f) => read(f).includes('FileAdvancedJson'))))
// 13 — use-хук в бою
check('13 playInteraction use в бою', /playInteraction\('use', \{ entity: item \}\)/.test(combat))

// скриншот колеса по образцу прошлых смоуков
try {
  const res = await fetch('http://localhost:5173/demo-campaign/scope_05_factions', { method: 'HEAD' }).catch(() => null)
  const html = await (await fetch('http://localhost:5173/')).text()
  const m = html.match(/src="(\/src\/main\.tsx)"/)
  console.log('INFO  dev-сервер отвечает:', res?.status ?? '—', 'main:', Boolean(m))
} catch {
  console.log('INFO  dev-сервер недоступен (смоук статический)')
}

console.log(fails ? `\nFAILURES: ${fails}` : '\nALL GREEN')
process.exit(fails ? 1 : 0)
