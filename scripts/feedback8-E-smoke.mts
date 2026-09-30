/**
 * Смоук восьмого раунда фидбека, блок E — слайд-катсцены.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/feedback8-E-smoke.mts
 */
import { readFileSync } from 'node:fs'
import { Compiler } from 'inkjs/full'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { EditorStore } from '../src/editor/store'
import { generateInk, type DlgDoc } from '../src/editor/dialogueDoc'
import { autoDurationMs, youtubeId } from '../src/shared/CutscenePlayer'
import { cutsceneTtsEligible } from '../src/shared/cutsceneTts'
import { EFFECT_SCHEMAS } from '../src/editor/schemas'
import type { CampaignData, CutsceneDef } from '../src/shared/types'

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

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const campaign: CampaignData = await loadCampaign(base)

// ── формат и демо ──
{
  const intro = campaign.cutscenes['cutscene_intro']
  check('E катсцена загружается из cutscenes/', !!intro, Object.keys(campaign.cutscenes).join(','))
  check('E во вступлении 3–4 слайда', intro.slides.length >= 3 && intro.slides.length <= 4, String(intro.slides.length))
  check('E все слайды — ArtDoc (без единого файла картинки)', intro.slides.every((s) => !!s.art && !s.image && !s.video))
  check(
    'E в слайдах есть долина, караван и ворота',
    ['долина', 'кузов повозки', 'проём ворот'].every((l) => intro.slides.some((s) => s.art!.layers.some((x) => x.label === l))),
  )
  check('E у слайдов заданы переходы', intro.slides.every((s) => ['cut', 'fade', 'slide', 'panzoom'].includes(s.transition)))
  check('E есть «медленный наезд»', intro.slides.some((s) => s.transition === 'panzoom'))
  const rule = campaign.rules['rule_intro_cutscene']
  check('E правило вступления одноразовое', !!rule && rule.once && rule.effects.some((e) => e.type === 'play_cutscene'))
}

// ── движок ──
{
  const e = new GameEngine(campaign)
  e.start()
  check('E на старте нового забега запускается вступление', e.cutscene?.id === 'cutscene_intro', e.cutscene?.id ?? 'нет')
  check('E приветствие Алдрика ждёт своей очереди (диалог уже подготовлен)', !!e.dialogue)
  const key = e.cutsceneKey
  e.endCutscene()
  check('E после окончания катсцена снята', e.cutscene === null)
  check('E правило больше не срабатывает в этом забеге', (e.checkRules(), e.cutscene === null))
  check('E ключ показа уникален', key > 0)

  // очередь: две катсцены подряд
  const extra: CutsceneDef = { id: 'cs_test', label: 'Тест', slides: [{ text: 'Проверка', transition: 'cut' }] }
  campaign.cutscenes['cs_test'] = extra
  e.applyEffects([
    { type: 'play_cutscene', cutscene: 'cutscene_intro' },
    { type: 'play_cutscene', cutscene: 'cs_test' },
    { type: 'show_message', text: 'после ролика' },
  ])
  check('E очередь: первой идёт первая катсцена', e.cutscene?.id === 'cutscene_intro')
  check('E остальные эффекты применены (сообщение в очереди)', e.messages.some((m) => m.text === 'после ролика'))
  const k1 = e.cutsceneKey
  e.endCutscene()
  check('E очередь: затем вторая', e.cutscene?.id === 'cs_test' && e.cutsceneKey !== k1)
  e.endCutscene()
  check('E очередь пуста', e.cutscene === null)
  e.applyEffects([{ type: 'play_cutscene', cutscene: 'нет_такой' }])
  check('E несуществующая катсцена игнорируется', e.cutscene === null)

  // победа в бою: катсцена откладывается до «Продолжить», как смена экрана
  const src = readFileSync('src/core/engine.ts', 'utf8')
  check('E on_victory: play_cutscene — после «Продолжить»', /defer = new Set\([^)]*'play_cutscene'/.test(src))

  // рестарт: новый забег — вступление снова
  const fresh = e.restart()
  check('E рестарт показывает вступление снова', fresh.cutscene?.id === 'cutscene_intro')

  // сейв: загруженный забег вступление не повторяет
  const saved = JSON.parse(JSON.stringify(fresh.state))
  const loaded = new GameEngine(campaign, saved)
  loaded.start()
  check('E загрузка сейва не запускает вступление повторно', loaded.cutscene === null)
}

// ── диалоги: действие «Показать катсцену» ──
{
  const doc: DlgDoc = {
    version: 2,
    nodes: [
      {
        id: 'main',
        label: 'Начало',
        sections: [
          { steps: [{ kind: 'line', line: { text: 'Смотри!' } }, { kind: 'effect', effect: { type: 'play_cutscene', cutscene: 'cs_test' } }] },
        ],
        choices: [{ text: 'Ух ты.', sections: [], goto: 'end' }],
      },
    ],
  }
  const ink = generateInk(doc)
  check('E generateInk: EXTERNAL play_cutscene', ink.includes('EXTERNAL play_cutscene(id)'))
  check('E generateInk: вызов в теле', ink.includes('~ play_cutscene("cs_test")'))
  let compiles = true
  try {
    new Compiler(ink).Compile()
  } catch {
    compiles = false
  }
  check('E ink с катсценой компилируется', compiles)

  // запуск в движке через диалог
  const npcId = 'npc_maeva'
  const npc = campaign.entities[npcId] as any
  const oldDialogue = npc.dialogue
  campaign.dialogues['dialogues/cs_test.ink'] = ink
  npc.dialogue = 'dialogues/cs_test.ink'
  const e = new GameEngine(campaign)
  e.start()
  e.endCutscene()
  e.startDialogue(npcId)
  check('E диалог запускает катсцену', e.cutscene?.id === 'cs_test', e.cutscene?.id ?? 'нет')
  check('E диалог продолжается под катсценой', !!e.dialogue && e.dialogue.lines.some((l) => l.text === 'Смотри!'))
  npc.dialogue = oldDialogue
}

// ── проигрыватель ──
{
  check('E длительность по тексту', autoDurationMs({ text: 'x'.repeat(100), transition: 'fade' }) > autoDurationMs({ text: 'x', transition: 'fade' }))
  check('E длительность без текста — 4 с', autoDurationMs({ transition: 'cut' }) === 4000)
  check('E YouTube-ссылки распознаются', youtubeId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ')
  check('E mp4 — не YouTube', youtubeId('https://example.com/intro.mp4') === null)
  const player = readFileSync('src/shared/CutscenePlayer.tsx', 'utf8')
  check('E «Пропустить» появляется после первого слайда', player.includes('index >= 1') && player.includes('Пропустить'))
  check('E переходы: затемнение, сдвиг, наезд', ['cs-in-fade', 'cs-in-slide', 'cs-panzoom'].every((c) => player.includes(c)))
  check('E подпись печатается', player.includes('TYPE_MS') && player.includes('cs-caption'))
  check('E видео: YouTube через embed, mp4 через <video>', player.includes('youtube.com/embed') && player.includes('<video'))
  check('E музыка и озвучка', player.includes('cutscene.music') && player.includes('slide.voice'))
  const fixedTextSlide = { text: 'Тестовая подпись', duration: 12, transition: 'cut' } as const
  check('E TTS читает текстовый слайд даже с заданной длительностью', cutsceneTtsEligible(fixedTextSlide, { tts_enabled: true, voice_muted: false }, 0.8))
  check('E TTS соблюдает отключение, громкость и приоритет файла',
    !cutsceneTtsEligible(fixedTextSlide, { tts_enabled: false, voice_muted: false }, 0.8)
      && !cutsceneTtsEligible(fixedTextSlide, { tts_enabled: true, voice_muted: true }, 0.8)
      && !cutsceneTtsEligible(fixedTextSlide, { tts_enabled: true, voice_muted: false }, 0)
      && !cutsceneTtsEligible({ ...fixedTextSlide, voice: 'voice.ogg' }, { tts_enabled: true, voice_muted: false }, 0.8))
  const timerAudio = player.slice(player.indexOf('const hasFixedDuration'), player.indexOf('return () => {', player.indexOf('const hasFixedDuration')))
  check('E таймер не блокирует запуск TTS на слайде с duration', timerAudio.includes('if (hasFixedDuration) after(') && timerAudio.includes('cutsceneTtsEligible(slide, settings, vol)'))
  const view = readFileSync('src/player/GameView.tsx', 'utf8')
  check('E экран игры: катсцена поверх всего, прочие экраны ждут', view.includes('<CutscenePlayer') && view.includes('!cutscene && engine.dialogue'))
}

// ── редактор ──
{
  const store = new EditorStore(base)
  await store.load()
  check('E стор редактора грузит катсцены', store.cutscenePaths().length === 1 && store.options('cutscene')[0]?.label === 'Пролог: пепел на тракте')
  check('E эффект «Показать катсцену» в конструкторе правил', EFFECT_SCHEMAS.play_cutscene?.fields[0]?.kind === 'cutsceneRef')
  const rulePath = store.rulePaths().find((p) => store.rule(p)?.id === 'rule_intro_cutscene')!
  store.rule(rulePath).effects.push({ type: 'play_cutscene', cutscene: 'cutscene_missing' })
  check('E валидатор ловит ссылку на несуществующую катсцену', store.validateContent().some((i) => i.includes('cutscene_missing')))
  const editor = readFileSync('src/editor/CutsceneEditor.tsx', 'utf8')
  check('E редактор: слайды, порядок, переходы, длительность', ['SlideCard', 'onUp', 'onDown', 'Переход', 'Длительность'].every((w) => editor.includes(w)))
  check('E редактор: музыка и озвучка файлом или ссылкой', editor.includes('AudioUpload') && editor.includes('assets/voice'))
  check('E редактор: тест-прогон', editor.includes('Тест-прогон') && editor.includes('testMode'))
  check('E редактор: предупреждение про видео', editor.includes('работает только онлайн'))
  const app = readFileSync('src/editor/EditorApp.tsx', 'utf8')
  check('E раздел «Катсцены» в редакторе', app.includes("label: 'Катсцены'") && app.includes('<CutsceneEditor'))
  const builder = readFileSync('src/editor/DialogueBuilder.tsx', 'utf8')
  check('E действие «Показать катсцену» в диалогах', builder.includes("'play_cutscene'") && builder.includes('Показать катсцену'))
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
