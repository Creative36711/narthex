import { Ico } from '../shared/icons'
import { useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { DialogueLine } from '../core/dialogue'
import { assetUrl, assetUrlOrNull } from '../core/loader'
import { tipSeen, markTip } from './tips'
import { useSettings, voiceVolume } from '../shared/settings'
import { speak } from '../shared/speech'

interface Props {
  engine: GameEngine
}

const TYPE_MS = 24 // скорость печати, мс на символ (как в катсценах)
const LINE_PAUSE_MS = 420 // пауза между репликами

/** Страховка для аудиофайла реплики, если браузер не прислал onended/onerror. */
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
   * Озвучка реплики или ремарки — по образцу катсцены: одна строка звучит
   * одна (без накопления в очереди), а её окончание двигает диалог дальше.
   */
  const playLine = (line: DialogueLine | undefined) => {
    clearLineAudio()
    setLineDone(false)
    const done = () => setLineDone(true)
    if (!line) {
      done()
      return
    }
    const vol = voiceVolume(settings)
    if (line.voice && vol > 0) {
      // Страховка нужна файлу, но не TTS: синтезатор сам сообщает onEnd,
      // а его длинный watchdog находится в shared/speech.ts.
      fallbackRef.current = setTimeout(() => {
        fallbackRef.current = null
        done()
      }, fallbackReadMs(line.text))
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

  // эмоция реплики, но если правило задало состояние облика (set_entity_state) —
  // оно главнее: персонаж «злой» даже на нейтральной реплике
  const emotion = engine.entityState(d.npc.id) ?? activeLine?.emotion ?? 'neutral'
  // пустая строка portrait: '' — не URL (assetUrlOrNull → null)
  const portraitKey =
    d.npc.portrait?.[emotion] ??
    d.npc.portrait?.['neutral'] ??
    d.npc.portrait?.['default'] ??
    Object.values(d.npc.portrait ?? {})[0]
  const portraitSrc = assetUrlOrNull(engine.campaign, portraitKey)
  const hasChoices = d.choices.length > 0
  const allShown = revealed >= lines.length

  // ── дедлайн на раздумье (§9 дизайн-документа) ──
  // Отсчёт идёт с момента, когда реплики полностью показаны игроку.
  // Поддерживает как выбор вариантов (допрос), так и автотаймер одиночной
  // реплики (# timer: 3 или ~ set_dialogue_timer(3, "узел")).
  const timer = d.timer ?? (activeLine?.timer ? { seconds: activeLine.timer } : undefined)
  const [timerLeft, setTimerLeft] = useState(0)
  useEffect(() => {
    if (!timer || !allShown) return
    const total = Math.max(1, timer.seconds) * 1000
    const started = Date.now()
    setTimerLeft(timer.seconds)
    const id = window.setInterval(() => {
      const msLeft = total - (Date.now() - started)
      setTimerLeft(Math.max(0, Math.ceil(msLeft / 1000)))
      if (msLeft <= 0) {
        window.clearInterval(id)
        if (hasChoices || timer.knot) {
          engine.dialogueTimeout()
        } else if (d.finished) {
          engine.endDialogue()
        }
      }
    }, 120)
    return () => window.clearInterval(id)
  }, [engine, timer, allShown, hasChoices, d.finished])

  const timerPct = timer ? Math.max(0, Math.min(100, (timerLeft / Math.max(1, timer.seconds)) * 100)) : 0

  return (
    <div className="overlay dialogue-overlay">
      <div className={`dialogue-box${portraitSrc ? '' : ' dialogue-box-noportrait'}`} onClick={skip}>
        <div className={`dialogue-portrait${portraitSrc ? '' : ' dialogue-portrait-empty'}`}>
          {portraitSrc ? (
            <img src={portraitSrc} alt={d.npc.label} draggable={false} />
          ) : (
            <div className="dialogue-portrait-placeholder" aria-hidden>
              <Ico n="user" />
            </div>
          )}
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
          {allShown && timer && (
            <div className={`dialogue-timer${timerLeft <= 3 ? ' urgent' : ''}`}>
              <div className="dialogue-timer-bar">
                <div className="dialogue-timer-fill" style={{ width: `${timerPct}%` }} />
              </div>
              <span className="dialogue-timer-left" data-tip="Не тяните: собеседник может сам перевести разговор">
                {timerLeft > 0 ? `${timerLeft} с` : 'время вышло'}
              </span>
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
