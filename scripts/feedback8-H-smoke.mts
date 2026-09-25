/**
 * Смоук восьмого раунда фидбека, блок H — звук и музыка.
 * Запуск: npx tsx scripts/feedback8-H-smoke.mts   (нужен dev-сервер :5173)
 *
 *   H1 реестры music_tracks/sounds (файл/ссылка/MusicDoc/SoundDoc, вариативность)
 *   H2 музыка локаций «условия → треки» + миграция легаси-строки
 *   H3 цепочка звуков взаимодействий (сущность → категория → слот → тема)
 *   H4 тема интерфейса ui_sounds + playUi(hook) в точках рантайма
 *   H5 синтез: SoundDoc (zzfx) и MusicDoc (генеративный луп)
 *   H6 редактор: реестры, SoundSelect с ▶, правила музыки, звуки действий
 *   H7 демо-звуковая тема ash-of-caerden
 *   H8 схема и документация обновлены
 */
import { readFileSync, existsSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { migrateMusicRules } from '../src/shared/migrate'
import { isMusicDoc } from '../src/shared/synth'
import { isSoundDoc, setAudioCampaign, playSoundId, playUi, playInteraction } from '../src/shared/audio'
import { refreshMusic, setMenuMode, applyMusicVolume, stopMusic, startTrackSource } from '../src/shared/music'
import type { MusicDoc, MusicRule, SoundDoc } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')

// ── H1: реестры и источники ──
{
  const m = campaign.meta
  check('H1 реестр треков music_tracks заполнен', (m.music_tracks?.length ?? 0) >= 6, `${m.music_tracks?.length}`)
  check('H1 реестр звуков sounds заполнен', (m.sounds?.length ?? 0) >= 10, `${m.sounds?.length}`)

  const trackIds = new Set((m.music_tracks ?? []).map((t) => t.id))
  const soundIds = new Set((m.sounds ?? []).map((s) => s.id))
  const allSources = [
    ...(m.music_tracks ?? []).map((t) => t.src),
    ...(m.sounds ?? []).flatMap((s) => (Array.isArray(s.src) ? s.src : [s.src])),
  ]
  const badDoc = allSources.find((src) => {
    if (typeof src === 'string') return false
    return !(isSoundDoc(src) || isMusicDoc(src))
  })
  check('H1 источники — файл/ссылка ИЛИ валидные SoundDoc/MusicDoc', !badDoc, JSON.stringify(badDoc ?? ''))

  const docs20 = (m.sounds ?? []).flatMap((s) => (Array.isArray(s.src) ? s.src : [s.src])).filter((x) => typeof x === 'object')
  const badZzfx = (docs20 as SoundDoc[]).find((d) => !Array.isArray(d.zzfx) || d.zzfx.length > 20 || d.zzfx.some((n) => typeof n !== 'number'))
  check('H1 SoundDoc: zzfx — массив чисел не длиннее 20', !badZzfx, JSON.stringify(badZzfx ?? ''))

  const musicDocs = (m.music_tracks ?? []).map((t) => t.src).filter((x) => typeof x === 'object') as MusicDoc[]
  const badMusic = musicDocs.find(
    (d) => !isMusicDoc(d) || !['спокойная', 'тревожная', 'боевая', 'торжественная', 'таинственная'].includes(d.mood),
  )
  check('H1 MusicDoc: настроение/слои валидны', musicDocs.length >= 6 && !badMusic, `${musicDocs.length} синтез-треков`)

  const door = m.sounds?.find((s) => s.id === 'snd_door')
  check('H1 вариативность: три скрипа двери под одним id', Array.isArray(door?.src) && door.src.length === 3)
  check('H1 isSoundDoc определяет SoundDoc', isSoundDoc({ zzfx: [1] }) && !isSoundDoc({ mood: 'боевая', layers: [] }))
  check('H1 isMusicDoc определяет MusicDoc', isMusicDoc({ mood: 'боевая', layers: ['бас'] }))

  // ссылки реестров не битые
  for (const [hook, id] of Object.entries(m.ui_sounds ?? {})) {
    const ok = hook === 'menu_music' ? trackIds.has(id) : soundIds.has(id)
    check(`H1 ui_sounds.${hook} ссылается на существующий id`, ok, id)
  }
  for (const locRule of [m.default_music ?? [], m.combat_music ?? []].flat()) {
    check('H1 default/combat_music ссылаются на треки', trackIds.has(locRule))
  }
}

// ── H2: правила музыки и миграция ──
{
  const migrated = migrateMusicRules('track_forest')
  check('H2 migrateMusicRules: строка → [{tracks:[id]}]', !!migrated && migrated[0].tracks[0] === 'track_forest')
  const rules: MusicRule[] = [{ tracks: ['a', 'b'], shuffle: true, conditions: [{ time_of_day: 'day' }] }]
  check('H2 migrateMusicRules не трогает массив правил', migrateMusicRules(rules) === rules)
  check('H2 migrateMusicRules(undefined) → undefined', migrateMusicRules(undefined) === undefined)

  const tavern = campaign.world.regions.flatMap((r) => r.locations).find((l) => l.id === 'loc_tavern')
  const tRules = Array.isArray(tavern?.music) ? tavern!.music : []
  check('H2 таверна: днём/вечером разные плейлисты (2+ правила)', tRules.length >= 2)
  check(
    'H2 условие по времени суток',
    tRules.some((r) => r.conditions?.some((c) => Array.isArray(c.time_of_day) ? c.time_of_day.includes('day') : c.time_of_day === 'day')),
  )
  const forest = campaign.world.regions.flatMap((r) => r.locations).find((l) => l.id === 'loc_forest')
  check('H2 у локации леса своя музыка', !!forest?.music && (Array.isArray(forest.music) ? forest.music[0].tracks[0] === 'track_forest' : forest.music === 'track_forest'))
}

// ── H5: синтез не падает без браузера, структура верна ──
{
  const track = campaign.meta.music_tracks!.find((t) => t.id === 'track_combat')
  check('H5 боевой трек — MusicDoc', isMusicDoc(track?.src), JSON.stringify(track?.src).slice(0, 60))
  // генерация в Node не должна падать (AudioContext отсутствует — no-op)
  let ok = true
  try {
    playSoundId('snd_door')
    playUi('click')
    playInteraction('open', { entity: campaign.entities['item_secret_passage'], slotType: 'container' })
    stopMusic()
  } catch (e) {
    ok = false
  }
  check('H5 вызовы звука безопасны в headless (no-op)', ok)
}

// ── H3/H4: хуки в рантайме ──
{
  const engineSrc = readFileSync('src/core/engine.ts', 'utf8')
  const combatSrc = readFileSync('src/core/combat.ts', 'utf8')
  for (const [where, src, needle] of [
    ['hit/miss', combatSrc, "playUi('hit')"],
    ['miss', combatSrc, "playUi('miss')"],
    ['crit', combatSrc, "playUi('crit')"],
    ['parry', combatSrc, "playUi('parry')"],
    ['death', combatSrc, "playUi('death')"],
    ['victory', combatSrc, "playUi('victory')"],
    ['defeat', combatSrc, "playUi('defeat')"],
    ['pickup', combatSrc, "playInteraction('pickup'"],
    ['combat_start', engineSrc, "playUi('combat_start')"],
    ['use', engineSrc, "playInteraction('use'"],
    ['open/use слота', engineSrc, "playInteraction(isOpen ? 'open' : 'use'"],
    ['talk', engineSrc, "playInteraction('talk'"],
    ['travel (зона)', engineSrc, "playInteraction('travel')"],
    ['travel_depart', engineSrc, "playUi('travel_depart')"],
    ['travel_arrive', engineSrc, "playUi('travel_arrive')"],
    ['coin', engineSrc, "playUi('coin')"],
    ['quest_started', engineSrc, "playUi('quest_started')"],
    ['quest_completed', engineSrc, "playUi('quest_completed')"],
    ['skill_up', engineSrc, "playUi('skill_up')"],
  ] as Array<[string, string, string]>) {
    check(`H4 хук ${where}`, src.includes(needle))
  }
  const panels = readFileSync('src/player/Panels.tsx', 'utf8')
  check('H3 хук drop (выбросить)', panels.includes("playInteraction('drop'"))
  const gv = readFileSync('src/player/GameView.tsx', 'utf8')
  check('H4 панели: panel_open/panel_close', gv.includes("playUi('panel_open')") && gv.includes("playUi('panel_close')"))
  check('H4 сообщения: message', gv.includes("playUi('message')"))
  check('H4 GameView поддерживает музыку (refreshMusic)', gv.includes('refreshMusic(engine)'))
  const app = readFileSync('src/App.tsx', 'utf8')
  check('H4 клики по кнопкам: click + разблокировка AudioContext', app.includes("playUi('click'") && app.includes('unlockAudio'))
  const menu = readFileSync('src/player/MainMenu.tsx', 'utf8')
  check('H4 музыка меню (setMenuMode + refreshMusic)', menu.includes('setMenuMode(true)') && menu.includes('refreshMusic(null)'))
  const cut = readFileSync('src/shared/CutscenePlayer.tsx', 'utf8')
  check('H2 музыка катсцены резолвится как id трека', cut.includes('resolveTrack') && cut.includes('startTrackSource'))
  const audioSrc = readFileSync('src/shared/audio.ts', 'utf8')
  check('H3 цепочка: сущность → категория → слот → тема', audioSrc.includes('meta.item_categories') && audioSrc.includes('meta.slot_types') && audioSrc.includes('meta.ui_sounds'))
  check('H3 alias travel → scene_transition (без двойного звука)', audioSrc.includes('scene_transition'))
}

// ── движок со звуком не падает в Node ──
{
  let ok = true
  try {
    setAudioCampaign(campaign)
    const e = new GameEngine(campaign)
    refreshMusic(e)
    e.goToScene('scene_tavern_hall', 0)
    e.travelTo('loc_forest')
    applyMusicVolume()
    setMenuMode(true)
    refreshMusic(null)
    setMenuMode(false)
    refreshMusic(e)
    stopMusic()
  } catch (err) {
    ok = false
    console.log('  (ошибка:', String(err), ')')
  }
  check('H4 refreshMusic/движок со звуком работают в headless', ok)
}

// ── H6: редактор ──
{
  const audio = readFileSync('src/editor/AudioSection.tsx', 'utf8')
  check('H6 реестры треков и звуков', audio.includes('AudioRegistries') && audio.includes('+ трек') && audio.includes('+ звук'))
  check('H6 предпрослушивание ▶', audio.includes('▶') && audio.includes('previewMusicSource'))
  check('H6 вариативность звуков в редакторе', audio.includes('+ вариант'))
  check('H6 конструктор SoundDoc (параметры zzfx)', audio.includes('SoundDocEditor') && audio.includes('ZZFX_LABELS'))
  check('H6 конструктор MusicDoc (настроение/гамма/слои)', audio.includes('MusicDocEditor') && audio.includes('МОOD_DEFAULTS'.replace('О', 'O')) || audio.includes('MOODS'))
  check('H6 правила музыки', audio.includes('MusicRulesEditor') && audio.includes('condLabel'))
  check('H6 карта звуков действий', audio.includes('SoundHookMapEditor'))
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('H6 секция звука в редакторе кампании', ce.includes('<AudioRegistries'))
  const we = readFileSync('src/editor/WorldEditor.tsx', 'utf8')
  check('H6 музыка локации в WorldEditor', we.includes('MusicRulesEditor') && we.includes('Музыка локации'))
  const se = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  check('H6 музыка сцены в SceneEditor', se.includes('MusicRulesEditor'))
  const ee = readFileSync('src/editor/EntityEditor.tsx', 'utf8')
  check('H6 звуки действий у предмета/персонажа', ee.includes('SoundHookMapEditor'))
  const cse = readFileSync('src/editor/CutsceneEditor.tsx', 'utf8')
  check('H6 музыка катсцены: трек реестра ИЛИ файл', cse.includes('MusicTrackSelect') && cse.includes('AudioUpload'))
}

// ── H7: демо-тема по ТЗ ──
{
  const m = campaign.meta
  const ids = (m.music_tracks ?? []).map((t) => t.id)
  for (const need of ['track_menu', 'track_tavern_day', 'track_tavern_night', 'track_forest', 'track_mine', 'track_combat']) {
    check(`H7 демо-трек ${need}`, ids.includes(need))
  }
  check('H7 меню слушает track_menu', m.ui_sounds?.['menu_music'] === 'track_menu')
  check('H7 бой слушает track_combat', (m.combat_music ?? []).includes('track_combat'))
  const passage = campaign.entities['item_secret_passage'] as { sounds?: Record<string, string> }
  check('H7 тайный лаз скрипит дверью (snd_door)', passage?.sounds?.['open'] === 'snd_door')
}

// ── H8: схема и документация ──
{
  check('H8 схема обновлена', existsSync('docs/campaign.schema.json'))
  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('H8 схема знает MusicDoc/SoundDoc/music_tracks', schema.includes('MusicDoc') && schema.includes('SoundDoc') && schema.includes('music_tracks'))
  const guide = readFileSync('docs/ai-campaign-guide.md', 'utf8')
  check('H8 AI-гайд описывает звук (§15)', /## 15/.test(guide) && guide.includes('MusicDoc') && guide.includes('SoundDoc'))
  const arch = readFileSync('ARCHITECTURE.md', 'utf8')
  check('H8 ARCHITECTURE описывает звук', arch.includes('music_tracks') && arch.includes('SoundDoc'))
}

if (failed) {
  console.log(`\n✗ FAILURES: ${failed}`)
  process.exit(1)
}
console.log('\n✓ Блок H готов.')
