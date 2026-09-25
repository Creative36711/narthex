import { Ico } from '../shared/icons'
import { useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { DialogueLine } from '../core/dialogue'
import { assetUrl } from '../core/loader'
import { tipSeen, markTip } from './tips'
import { useSettings, voiceVolume } from '../shared/settings'
import { speak } from '../shared/speech'

interface Props {
  engine: GameEngine
}

/** Диалоговое окно: портрет (emotion tag из Ink) + текст + варианты (ТЗ 4.5). */
export function DialogueOverlay({ engine }: Props) {
  const d = engine.dialogue
  const [showTip, setShowTip] = useState(() => !tipSeen('dialogue'))
  const settings = useSettings()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTtsRef = useRef<(() => void) | null>(null)

  const lastSpeech = d ? ([...d.lines].reverse().find((l) => !l.action) as DialogueLine | undefined) : undefined

  /** озвучка реплики: файл (тег # voice:) или синтезатор; клик по реплике — повтор */
  const playLine = (line: DialogueLine | undefined) => {
    audioRef.current?.pause()
    audioRef.current = null
    stopTtsRef.current?.()
    stopTtsRef.current = null
    if (!line || line.action) return
    const vol = voiceVolume(settings)
    if (line.voice && vol > 0) {
      const a = new Audio(assetUrl(engine.campaign, line.voice))
      a.volume = vol
      void a.play().catch(() => undefined)
      audioRef.current = a
    } else if (settings.tts_enabled && vol > 0) {
      stopTtsRef.current = speak(line.text, { voice: settings.tts_voice, rate: settings.tts_rate, volume: vol })
    }
  }

  // новая реплика — озвучить; закрытие/смена — снять звук
  const lineKey = lastSpeech ? `${lastSpeech.text}|${lastSpeech.voice ?? ''}` : ''
  useEffect(() => {
    playLine(lastSpeech)
    return () => {
      audioRef.current?.pause()
      stopTtsRef.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey])

  if (!d) return null

  const emotion = lastSpeech?.emotion ?? 'neutral'
  const portrait = d.npc.portrait[emotion] ?? d.npc.portrait['neutral']
  const hasCheckChoice = d.choices.some((c) => /\((Убеждение|Торговля|проверка)/i.test(c.text))

  return (
    <div className="overlay dialogue-overlay">
      <div className="dialogue-box">
        <div className="dialogue-portrait">
          {portrait && <img src={assetUrl(engine.campaign, portrait)} alt={d.npc.label} />}
          <div className="dialogue-npc-name">{d.npc.label}</div>
        </div>
        <div className="dialogue-content">
          <div className="dialogue-lines">
            {d.lines.map((l, i) => (
              <p
                key={i}
                className={`${l.action ? 'action' : ''} ${i === d.lines.length - 1 ? 'current' : 'past'}`}
                data-tip={l.action || (!l.voice && !settings.tts_enabled) ? undefined : 'Клик — прослушать ещё раз'}
                onClick={() => {
                  if (i === d.lines.length - 1) playLine(l)
                }}
              >
                {l.action ? <>✦ {l.text}</> : l.text}
              </p>
            ))}
          </div>
          {showTip && hasCheckChoice && (
            <div className="dialogue-tip">
              <div className="dialogue-tip-text">
                <p><Ico n="info" />  Ответы с пометкой — например <b>«(Убеждение)»</b> — это проверка навыка.</p>
                <p>Бросается кость d100: выпало не больше навыка — успех. Чем выше навык, тем лучше шанс. Итог броска записывается в журнал <Ico n="scroll" /> .</p>
              </div>
              <button
                className="btn btn-small"
                onClick={() => {
                  markTip('dialogue')
                  setShowTip(false)
                }}
              >
                Понятно
              </button>
            </div>
          )}
          <div className="dialogue-choices">
            {d.choices.map((c) => (
              <button key={c.index} className="choice-btn" onClick={() => engine.chooseDialogueOption(c.index)}>
                ▸ {c.text}
              </button>
            ))}
            {d.finished && (
              <button className="choice-btn end" onClick={() => engine.endDialogue()}>
                [Закончить разговор]
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
