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

const TYPE_MS = 24 // скорость печати, мс на символ (как в катсценах)
const LINE_PAUSE_MS = 420 // пауза между репликами

/**
 * страховка на случай «немого» синтезатора: сколько максимум ждать озвучку
 * реплики, прежде чем диалог пойдёт дальше сам (как в катсценах)
 */
function fallbackReadMs(text: string): number {
  return Math.min(30000, text.length * 70 + 4000)
}

/** Диалоговое окно: портрет + постепенная выдача текста (как в катсценах) + варианты (ТЗ 4.5). */
export function DialogueOverlay({ engine }: Props) {
  const d = engine.dialogue
  const campaignId = engine.campaign.meta.id
  const [showTip, setShowTip] = useState(() => !tipSeen('dialogue', campaignId))
  const settings = useSettings()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTtsRef = useRef<(() => void) | null>(null)
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** строк показано полностью */
  const [revealed, setRevealed] = useState(0)
  /** набрано символов текущей строки */
  const [typed, setTyped] = useState(0)
  /** озвучка текущей реплики закончилась (или её нет) — как в катсценах,
   *  диалог не идёт дальше, пока фраза не договорена (фидбек 21) */
  const [lineDone, setLineDone] = useState(true)

  const clearLineAudio = () => {
    audioRef.current?.pause()
    audioRef.current = null
    stopTtsRef.current?.()
    stopTtsRef.current = null
    if (fallbackRef.current !== null) {
      clearTimeout(fallbackRef.current)
      fallbackRef.current = null
    }
  }

  // закрытие диалога (размонтирование) — снять звук: это делает cleanup
  // эффекта озвучки ниже (он же переживает дев-режим, см. комментарий там)

  // Фидбек 22: `dialogue` заменяется ЦЕЛИКОМ на ответ реплику (новый объект,
  // только новые строки). Сброс прогресса в useEffect происходил ПОСЛЕ коммита,
  // и в промежуточном рендере `revealed` указывал в середину нового списка —
  // озвучка начинала со средней фразы, а первые молча пропускались.
  // Поэтому сбрасываем состояние СИНХРОННО в фазе рендера (штатный паттерн
  // «корректировка состояния при рендере»): коммит уже видит revealed=0.
  const lastDRef = useRef<unknown>(d)
  if (lastDRef.current !== d) {
    lastDRef.current = d
    clearLineAudio()
    if (revealed !== 0) setRevealed(0)
    if (typed !== 0) setTyped(0)
    if (!lineDone) setLineDone(true)
  }

  const lines: DialogueLine[] = d?.lines ?? []
  const current = lines[revealed]
  const full = current ? (current.action ? `→ ${current.text}` : current.text) : ''
  const activeLine = current ?? lines[revealed - 1]

  /**
   * Озвучка реплики — по образцу катсцены (фидбек 21): одна фраза звучит
   * одна (без накопления в очереди), а её окончание двигает диалог дальше.
   */
  const playLine = (line: DialogueLine | undefined) => {
    clearLineAudio()
    setLineDone(false)
    const done = () => setLineDone(true)
    if (!line || line.action) {
      done()
      return
    }
    // страховочный таймер: если звук так и не отчитался — диалог не виснет
    fallbackRef.current = setTimeout(() => {
      fallbackRef.current = null
      done()
    }, fallbackReadMs(line.text))
    const vol = voiceVolume(settings)
    if (line.voice && vol > 0) {
      const a = new Audio(assetUrl(engine.campaign, line.voice))
      a.volume = vol
      a.onended = done
      a.onerror = done
      void a.play().catch(done)
      audioRef.current = a
    } else if (settings.tts_enabled && vol > 0) {
      stopTtsRef.current = speak(line.text, {
        voice: settings.tts_voice,
        rate: settings.tts_rate,
        volume: vol,
        onEnd: done,
      })
    } else {
      done()
    }
  }

  // новая реплика появилась — озвучить её. Эффект идемпотентен: в дев-режиме
  // (StrictMode) эффекты гоняются «настройка → уборка → настройка», и уборка
  // снимает звук строки, а повторная настройка заводит его заново. Поэтому
  // ПЕРВАЯ фраза диалога больше не умирает молча и диалог не зависает
  // (фидбек 23). При смене строки/диалога уборка глушит предыдущий звук.
  useEffect(() => {
    if (!d || !current) return
    playLine(current)
    return () => clearLineAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, revealed])

  // печать по буквам — как в катсценах
  useEffect(() => {
    if (!current || typed >= full.length) return
    const t = setTimeout(() => setTyped((n) => n + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [current, typed, full.length])

  // строка дописана И озвучка договорена — пауза и следующая реплика
  // (катсценный подход: голос управляет темпом, а не таймер печати)
  useEffect(() => {
    if (!current || typed < full.length || !lineDone) return
    const t = setTimeout(() => {
      setTyped(0)
      setRevealed((n) => n + 1)
    }, LINE_PAUSE_MS)
    return () => clearTimeout(t)
  }, [current, typed, full.length, lineDone])

  if (!d) return null

  /**
   * Клик мыши по окну: пока текст ещё печатается — показать ВЕСЬ оставшийся
   * текст сразу, без ожидания; любой клик прерывает текущую озвучку
   * (файл или синтезатор). Кнопка пропуска не нужна.
   */
  const skip = () => {
    clearLineAudio()
    setLineDone(true)
    if (revealed < lines.length) {
      setTyped(0)
      setRevealed(lines.length)
    }
  }

  const emotion = activeLine?.emotion ?? 'neutral'
  const portrait = d.npc.portrait[emotion] ?? d.npc.portrait['neutral']
  const hasChoices = d.choices.length > 0
  const allShown = revealed >= lines.length

  return (
    <div className="overlay dialogue-overlay">
      <div className="dialogue-box" onClick={skip}>
        <div className="dialogue-portrait">
          {portrait && <img src={assetUrl(engine.campaign, portrait)} alt={d.npc.label} />}
          <div className="dialogue-npc-name">
            {d.npc.label}
            {(() => {
              // самочувствие собеседника (выспался/устал) — мягкая подсказка игроку
              const mood = engine.npcMood(d.npc.id)
              if (mood >= 70) return <span className="muted small dlg-mood"> · бодр и расположен</span>
              if (mood <= 25) return <span className="muted small dlg-mood"> · измотан и раздражён</span>
              return null
            })()}
          </div>
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
          {showTip && hasChoices && allShown && (
            <div className="dialogue-tip">
              <div className="dialogue-tip-text">
                <p><Ico n="info" /> Выберите реплику, чтобы продолжить разговор. Доступные варианты задаёт автор кампании.</p>
                <p>Если вариант запускает проверку, движок использует навык персонажа и правила броска этой кампании. Результат появится в журнале <Ico n="scroll" />.</p>
              </div>
              <button
                className="btn btn-small"
                onClick={() => {
                  markTip('dialogue', campaignId)
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
                <button key={c.index} className="choice-btn" onClick={(e) => { e.stopPropagation(); engine.chooseDialogueOption(c.index) }}>
                  ▸ {c.text}
                </button>
              ))}
              {d.finished && (
                <button className="choice-btn end" onClick={(e) => { e.stopPropagation(); engine.endDialogue() }}>
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
