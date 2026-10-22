/**
 * Смоук восьмого раунда фидбека, блок G — озвучка диалогов.
 * Запуск: npx tsx scripts/feedback8-G-smoke.mts
 *
 *   G1 DlgLine.voice + тег # voice в ink → движок (parseLineTags, drainStory)
 *   G2 проигрывание в диалоге: файл при показе, клик — повтор, TTS-фолбэк
 *   G3 настройки игрока: громкости, выкл, «Озвучивать синтезатором», выбор голоса
 *   G4 поле озвучки в конструкторе диалогов (файл или ссылка)
 *   G5 scripts/voice-gen.mts (Piper) с понятной инструкцией
 */
import { readFileSync, existsSync } from 'node:fs'
import { Compiler } from 'inkjs/full'
import { createStory, drainStory, parseLineTags } from '../src/core/dialogue'
import { generateInk, newDlgDoc, type DlgDoc } from '../src/editor/dialogueDoc'
import { DEFAULT_SETTINGS } from '../src/shared/settings'
import type { MonolithDialogue } from '../src/shared/types'
import { isRawInk } from '../src/editor/monolith'

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

// ── G1: тег voice: .dlg.json → ink → движок ──
{
  const doc: DlgDoc = newDlgDoc('Тест')
  doc.nodes[0].sections[0].steps.push(
    { kind: 'line', line: { text: 'Вторая реплика', voice: 'assets/voice/t_02.ogg' } },
    { kind: 'line', line: { text: 'Ремарка с озвучкой', action: true, voice: 'assets/voice/narration.ogg' } },
  )
  const ink = generateInk(doc)
  check('G1 generateInk пишет тег # voice', ink.includes('# voice: assets/voice/t_02.ogg'), ink.split('\n')[3] ?? '')
  check('G1 generateInk сохраняет озвучку ремарки', ink.includes('# action # voice: assets/voice/narration.ogg'))
  const story = new Compiler(ink).Compile()
  check('G1 ink с озвучкой компилируется', !!story)

  const parsed = parseLineTags(['emotion: happy', 'action', 'voice: https://cdn.example.com/a.mp3'])
  check('G1 parseLineTags читает voice/эмоцию/ремарку', parsed.voice === 'https://cdn.example.com/a.mp3' && parsed.emotion === 'happy' && parsed.action === true)

  const run = createStory(ink, `g-smoke-${Date.now()}`)
  run.ChoosePathString('main') // как движок при старте разговора
  const { lines } = drainStory(run)
  check('G1 drainStory доносит voice до UI', lines.some((l) => l.voice === 'assets/voice/t_02.ogg'), JSON.stringify(lines.map((l) => l.voice)))
  check('G1 drainStory сохраняет action + voice ремарки', lines.some((l) => l.action && l.voice === 'assets/voice/narration.ogg'))
  check('G1 у реплики без файла voice не заполнен', lines[0].voice === undefined)
}

// ── G2: проигрывание в оверлее ──
{
  const overlay = readFileSync('src/player/DialogueOverlay.tsx', 'utf8')
  check('G2 файл озвучки играет при показе реплики', overlay.includes('new Audio(assetUrl(engine.campaign, line.voice))'))
  check('G2 повтор реплики убран (фидбек 17)', !overlay.includes("'replay'") && !overlay.includes('прослушать ещё раз'))
  check('G2 фолбэк на синтезатор', overlay.includes('speak(line.text') && overlay.includes('tts_enabled'))
  check('G2 ремарка не исключается из озвучки (файл и TTS)', !overlay.includes('if (!line || line.action)') && overlay.includes('if (!line)'))
  check('G2 громкость из настроек', overlay.includes('voiceVolume(settings)'))
  check('G2 звук снимается при закрытии', overlay.includes('pause()') && overlay.includes('useEffect'))
  const player = readFileSync('src/shared/CutscenePlayer.tsx', 'utf8')
  check('G2 слайды катсцен тоже озвучиваются (из блока E)', player.includes('slide.voice'))
  const speech = readFileSync('src/shared/speech.ts', 'utf8')
  check('G2 Web Speech: выбор голоса из системных', speech.includes('getVoices') && speech.includes('SpeechSynthesisVoice'))
}

// ── G3: настройки игрока ──
{
  check('G3 синтезатор по умолчанию выключен', DEFAULT_SETTINGS.tts_enabled === false)
  const panel = readFileSync('src/shared/SettingsPanel.tsx', 'utf8')
  check('G3 громкость общая/музыка/эффекты/голос', ['volume', 'music_volume', 'sfx_volume', 'voice_volume'].every((k) => panel.includes(k)))
  check('G3 галочка «Озвучивать … синтезатором»', panel.includes('tts_enabled') && panel.includes('Озвучивать реплики, ремарки и подписи катсцен без файла'))
  check('G3 выбор голоса из доступных в системе', panel.includes('useTtsVoices') && panel.includes('tts_voice'))
  check('G3 выключатель озвучки', panel.includes('voice_muted'))
  const settings = readFileSync('src/shared/settings.ts', 'utf8')
  check('G3 настройки в localStorage', settings.includes('narthex:settings'))
  const menu = readFileSync('src/player/MainMenu.tsx', 'utf8')
  const hud = readFileSync('src/player/HUD.tsx', 'utf8')
  check('G3 настройки открываются из меню и из игры', menu.includes('SettingsPanel') && menu.includes('Настройки') && hud.includes('SettingsPanel'))
}

// ── G4: поле озвучки в конструкторе ──
{
  const builder = readFileSync('src/editor/DialogueBuilder.tsx', 'utf8')
  check('G4 у реплики есть озвучка (файл или ссылка)', builder.includes('AudioUpload') && builder.includes('assets/voice') && builder.includes('line.voice'))
  check('G4 кнопка 🎙 у реплики', builder.includes('n="mic"'))
  const fields = readFileSync('src/editor/Fields.tsx', 'utf8')
  check('G4 AudioUpload с предпросмотром и ссылкой', fields.includes('AudioUpload') && fields.includes('или вставьте ссылку'))
}

// ── G5: Piper-генератор ──
{
  check('G5 scripts/voice-gen.mts существует', existsSync('scripts/voice-gen.mts'))
  const gen = readFileSync('scripts/voice-gen.mts', 'utf8')
  check('G5 инструкция установки Piper', gen.includes('rhasspy/piper') && gen.includes('PIPER_BIN'))
  check('G5 русские голоса перечислены', ['irina', 'dmitri', 'denis', 'ruslan'].every((v) => gen.includes(v)))
  check('G5 wav → ogg в assets/voice/', gen.includes('assets/voice') && gen.includes('ffmpeg'))
  check('G5 voice прописывается в реплики, ink перегенерируется', gen.includes('step.line.voice') && gen.includes('generateInk'))
  check('G5 без Piper — понятное сообщение', gen.includes('Piper не найден') || gen.includes('Установите Piper'))
}

// ── монолитный JSON: voice переживает экспорт (тип MonolithDialogue) ──
{
  const d: MonolithDialogue = { version: 2, nodes: [] } as MonolithDialogue
  check('G1 типы: DlgLine.voice в shared/types.ts', readFileSync('src/shared/types.ts', 'utf8').includes('voice?: string'))
  check('isRawInk различает DlgDoc и сырой ink', isRawInk(d) === false && isRawInk({ ink: 'x' }) === true)
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
