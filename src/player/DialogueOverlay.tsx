import { Ico } from '../shared/icons'
import { useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { DialogueLine } from '../core/dialogue'
import { assetUrl } from '../core/loader'
import { tipSeen, markTip } from './tips'
import { useSettings, voiceVolume } from '../shared/settings'
import { speak, stopSpeaking } from '../shared/speech'

interface Props {
  engine: GameEngine
}

const TYPE_MS = 24 // скорость печати, мс на символ (как в катсценах)
const LINE_PAUSE_MS = 420 // пауза между репликами

/** Диалоговое окно: портрет + постепенная выдача текста (как в катсценах) + варианты (ТЗ 4.5). */
export function DialogueOverlay({ engine }: Props) {
  const d = engine.dialogue
  const [showTip, setShowTip] = useState(() => !tipSeen('dialogue'))
  const settings = useSettings()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTtsRef = useRef<(() => void) | null>(null)
  const spokenRef = useRef(-1)
  /** строк показано полностью */
  const [revealed, setRevealed] = useState(0)
  /** набрано символов текущей строки */
  const [typed, setTyped] = useState(0)

  // новая сессия диалога — сброс прогресса чтения; закрытие — снять звук
  useEffect(() => {
    setRevealed(0)
    setTyped(0)
    spokenRef.current = -1
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
      stopTtsRef.current?.()
      stopTtsRef.current = null
    }
  }, [d])

  const lines: DialogueLine[] = d?.lines ?? []
  const current = lines[revealed]
  const full = current ? (current.action ? `→ ${current.text}` : current.text) : ''
  const activeLine = current ?? lines[revealed - 1]

  /** озвучка реплики: файл (тег # voice:) или синтезатор (последовательная очередь) */
  const playLine = (line: DialogueLine | undefined) => {
    if (!line || line.action) return
    const vol = voiceVolume(settings)
    if (line.voice && vol > 0) {
      if (audioRef.current) audioRef.current.pause()
      const a = new Audio(assetUrl(engine.campaign, line.voice))
      a.volume = vol
      void a.play().catch(() => undefined)
      audioRef.current = a
    } else if (settings.tts_enabled && vol > 0) {
      speak(line.text, {
        voice: settings.tts_voice,
        rate: settings.tts_rate,
        volume: vol,
        queue: true,
      })
      stopTtsRef.current = stopSpeaking
    }
  }

  // новая реплика появилась — озвучить её (каждую, а не только последнюю)
  useEffect(() => {
    if (!d || !current || spokenRef.current >= revealed) return
    spokenRef.current = revealed
    playLine(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, revealed, current])

  // печать по буквам — как в катсценах
  useEffect(() => {
    if (!current || typed >= full.length) return
    const t = setTimeout(() => setTyped((n) => n + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [current, typed, full.length])

  // строка дописана — пауза и следующая; typed обязательно сбрасываем —
  // иначе следующая строка либо проскакивает целиком, либо печатается с середины
  useEffect(() => {
    if (!current || typed < full.length) return
    const t = setTimeout(() => {
      setTyped(0)
      setRevealed((n) => n + 1)
    }, LINE_PAUSE_MS)
    return () => clearTimeout(t)
  }, [current, typed, full.length])

  if (!d) return null

  /**
   * Клик мыши по окну: пока текст ещё печатается — показать ВЕСЬ оставшийся
   * текст сразу, без ожидания; любой клик прерывает текущую озвучку
   * (файл или синтезатор, включая очередь). Кнопка пропуска не нужна.
   */
  const skip = () => {
    if (revealed < lines.length) {
      setTyped(0)
      setRevealed(lines.length)
    }
    audioRef.current?.pause()
    audioRef.current = null
    stopTtsRef.current?.()
    stopTtsRef.current = null
  }

  const emotion = activeLine?.emotion ?? 'neutral'
  const portrait = d.npc.portrait[emotion] ?? d.npc.portrait['neutral']
  const hasCheckChoice = d.choices.some((c) => /\((Убеждение|Торговля|проверка)/i.test(c.text))
  const allShown = revealed >= lines.length

  return (
    <div className="overlay dialogue-overlay">
      <div className="dialogue-box" onClick={skip}>
        <div className="dialogue-portrait">
          {portrait && <img src={assetUrl(engine.campaign, portrait)} alt={d.npc.label} />}
          <div className="dialogue-npc-name">{d.npc.label}</div>
        </div>
        <div className="dialogue-content">
          <div className="dialogue-lines">
            {lines.slice(0, revealed).map((l, i) => (
              <p key={i} className={`${l.action ? 'action ' : ''}past`}>
                {l.action ? <>→ {l.text}</> : l.text}
              </p>
            ))}
            {current && <p className={`${current.action ? 'action ' : ''}current`}>{full.slice(0, typed)}</p>}
          </div>
          {showTip && hasCheckChoice && allShown && (
            <div className="dialogue-tip">
              <div className="dialogue-tip-text">
                <p>
                  <Ico n="info" />  Ответы с пометкой — например <b>«(Убеждение)»</b> — это проверка навыка.
                </p>
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
          {allShown && (
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
          )}
        </div>
      </div>
    </div>
  )
}
