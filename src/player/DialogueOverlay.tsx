import { Ico } from '../shared/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { DialogueLine } from '../../packs/narrative/index'
import type { NpcDef } from '../shared/types'
import { assetUrlOrNull } from '../core/loader'
import { tipSeen, markTip } from './tips'
import { useDialogueAudio } from './useDialogueAudio'
import { itemImageSrc } from './Panels'

interface Props {
  engine: GameEngine
}

const TYPE_MS = 24 // скорость печати, мс на символ (как в катсценах)
const LINE_PAUSE_MS = 750 // естественная дыхательная пауза между репликами

/** Диалоговое окно: портрет + постепенная выдача текста (как в катсценах) + варианты (ТЗ 4.5). */
export function DialogueOverlay({ engine }: Props) {
  const d = engine.dialogue
  const campaignId = engine.campaign.meta.id
  const [showTip, setShowTip] = useState(() => !tipSeen('dialogue', campaignId))
  const [showBacklog, setShowBacklog] = useState(false)
  /** строк показано полностью */
  const [revealed, setRevealed] = useState(0)
  /** набрано символов текущей строки */
  const [typed, setTyped] = useState(0)
  /** озвучка текущей реплики закончилась (или её нет) — как в катсценах,
   *  диалог не идёт дальше, пока фраза не договорена (фидбек 21) */
  const [lineDone, setLineDone] = useState(true)

  const clearLineAudio = useDialogueAudio(engine, d, revealed, setLineDone)

  // Фидбек 22: `dialogue` заменяется ЦЕЛИКОМ на ответ реплику (новый объект,
  // только новые строки). Сброс прогресса в useEffect происходил ПОСЛЕ коммита,
  // и в промежуточном рендере `revealed` указывал в середину нового списка —
  // озвучка начинала со средней фразы, а первые молча пропускались.
  // Поэтому сбрасываем состояние СИНХРОННО в фазе рендера (штатный паттерн
  // «корректировка состояния при рендере»): коммит уже видит revealed=0.
  const [lastDialogue, setLastDialogue] = useState(d)
  if (lastDialogue !== d) {
    setLastDialogue(d)
    if (revealed !== 0) setRevealed(0)
    if (typed !== 0) setTyped(0)
    if (!lineDone) setLineDone(true)
  }

  const lines: DialogueLine[] = d?.lines ?? []
  const current = lines[revealed]
  const full = current ? (current.action ? `→ ${current.text}` : current.text) : ''
  const activeLine = current ?? lines[revealed - 1]

  // печать по буквам — как в катсценах
  useEffect(() => {
    if (!current || typed >= full.length) return
    const t = setTimeout(() => setTyped((n) => n + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [current, typed, full.length])

  // строка дописана И озвучка договорена — комфортная пауза и следующая реплика
  // (катсценный подход: голос управляет темпом, а не таймер печати)
  useEffect(() => {
    if (!current || typed < full.length || !lineDone) return
    const t = setTimeout(() => {
      setTyped(0)
      setRevealed((n) => n + 1)
    }, LINE_PAUSE_MS)
    return () => clearTimeout(t)
  }, [current, typed, full.length, lineDone])

  /**
   * Клик мыши, пробел или кнопка «Далее ▶»:
   * 1) Если текущая фраза ещё печатается — сразу допечатываем её (показываем предложение целиком).
   * 2) Если фраза завершена — переходим строго к следующему предложению/реплике.
   */
  const skipOrAdvance = useCallback(() => {
    clearLineAudio()
    setLineDone(true)
    if (current && typed < full.length) {
      setTyped(full.length)
      return
    }
    if (revealed + 1 < lines.length) {
      setTyped(0)
      setRevealed((n) => n + 1)
    } else {
      setRevealed(lines.length)
      setTyped(0)
    }
  }, [clearLineAudio, current, typed, full.length, revealed, lines.length])

  /**
   * Кнопка «Пропустить» (или клавиша Esc):
   * Скипает ВЕСЬ монолог НПС целиком прямо до вариантов ответа игрока.
   * Озвучка останавливается, все фразы моментально раскрываются и становятся видимыми.
   */
  const skipAllLines = useCallback(() => {
    clearLineAudio()
    setLineDone(true)
    setRevealed(lines.length)
    setTyped(0)
  }, [clearLineAudio, lines.length])

  const hasChoices = (d?.choices.length ?? 0) > 0
  const allShown = revealed >= lines.length

  // Перелистывание реплик по Space / Enter (одно предложение), скип всего монолога по Escape
  useEffect(() => {
    if (!d) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        skipOrAdvance()
      } else if (e.key === 'Escape' && !allShown) {
        e.preventDefault()
        skipAllLines()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [d, allShown, skipOrAdvance, skipAllLines])

  // ── дедлайн на раздумье (§9 дизайн-документа) ──
  // Отсчёт идёт с момента, когда реплики полностью показаны игроку.
  // Поддерживает как выбор вариантов (допрос), так и автотаймер одиночной
  // реплики (# timer: 3 или ~ set_dialogue_timer(3, "узел")).
  const timer = useMemo(
    () => d?.timer ?? (activeLine?.timer ? { seconds: activeLine.timer } : undefined),
    [d, activeLine],
  )
  const finished = d?.finished ?? false
  const countdown = useMemo(
    () => ({ engine, timer, allShown, lineDone, hasChoices, finished }),
    [engine, timer, allShown, lineDone, hasChoices, finished],
  )
  const [timerTick, setTimerTick] = useState<{ countdown: typeof countdown; left: number } | null>(null)
  // Новый отсчёт сразу показывает полную длительность, без setState в эффекте;
  // тики предыдущего отсчёта больше не могут менять его начальное значение.
  const timerLeft = timerTick?.countdown === countdown ? timerTick.left : timer?.seconds ?? 0
  useEffect(() => {
    const { engine, timer, allShown, lineDone, hasChoices, finished } = countdown
    if (!timer || !allShown) return
    const total = Math.max(1, timer.seconds) * 1000
    const started = Date.now()
    const id = window.setInterval(() => {
      const msLeft = total - (Date.now() - started)
      setTimerTick({ countdown, left: Math.max(0, Math.ceil(msLeft / 1000)) })
      if (msLeft <= 0) {
        if (!lineDone) return
        window.clearInterval(id)
        if (hasChoices || timer.knot) {
          engine.dialogueTimeout()
        } else if (finished) {
          engine.endDialogue()
        }
      }
    }, 120)
    return () => window.clearInterval(id)
  }, [countdown])

  if (!d) return null

  // спикер реплики (# speaker): третье лицо в разговоре — портрет/имя его;
  // ремарки (повествование) спикера не имеют — показываем собеседника диалога
  const displayedNpc: NpcDef = (!activeLine?.action && activeLine?.speaker
    ? (engine.campaign.entities[activeLine.speaker] as NpcDef | undefined)
    : undefined) ?? d.npc
  // эмоция реплики, но если правило задало состояние облика (set_entity_state) —
  // оно главнее: персонаж «злой» даже на нейтральной реплике
  const emotion = engine.entityState(displayedNpc.id) ?? activeLine?.emotion ?? 'neutral'
  // пустая строка portrait: '' — не URL (assetUrlOrNull → null)
  const portraitSrc = assetUrlOrNull(
    engine.campaign,
    displayedNpc.portrait?.[emotion] ??
    displayedNpc.portrait?.['neutral'] ??
    displayedNpc.portrait?.['default'] ??
    Object.values(displayedNpc.portrait ?? {})[0],
  )

  const timerPct = timer ? Math.max(0, Math.min(100, (timerLeft / Math.max(1, timer.seconds)) * 100)) : 0

  return (
    <div className="overlay dialogue-overlay">
      <div className={`dialogue-box${portraitSrc ? '' : ' dialogue-box-noportrait'}`} onClick={skipOrAdvance}>
        <div className={`dialogue-portrait${portraitSrc ? '' : ' dialogue-portrait-empty'}`}>
          {portraitSrc ? (
            <img src={portraitSrc} alt={displayedNpc.label} draggable={false} />
          ) : (
            <div className="dialogue-portrait-placeholder" aria-hidden>
              <Ico n="user" />
            </div>
          )}
          <div className="dialogue-npc-name">
            {displayedNpc.label}
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
          <div className="dialogue-top-bar">
            {!allShown && (
              <button
                type="button"
                className="dlg-skip-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  skipAllLines()
                }}
                data-tip="Пропустить весь монолог до вариантов ответа (Esc)"
              >
                <Ico n="chevronRight" /> Пропустить
              </button>
            )}
            <button
              type="button"
              className="dlg-backlog-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowBacklog(true)
              }}
              data-tip="История реплик и сделанных выборов (Backlog)"
            >
              <Ico n="scroll" /> История
            </button>
          </div>
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
          {allShown && d.presenting && (
            <div className="dialogue-presenting">
              <div className="dialogue-presenting-title">
                <Ico n="bag" /> Выберите предмет или улику для предъявления:
              </div>
              <div className="dialogue-present-grid">
                {engine.state.player.inventory.map((inv) => {
                  const item = engine.campaign.entities[inv.item]
                  if (!item || item.type !== 'item') return null
                  const imgSrc = itemImageSrc(engine, item)
                  return (
                    <button
                      key={inv.item}
                      type="button"
                      className="present-item-card"
                      onClick={(e) => {
                        e.stopPropagation()
                        engine.submitPresentedItem(inv.item)
                      }}
                    >
                      <div className="present-item-thumb-box">
                        {imgSrc ? (
                          <img className="present-item-thumb" src={imgSrc} alt="" />
                        ) : (
                          <div className="present-item-placeholder">
                            <Ico n="bag" />
                          </div>
                        )}
                        {inv.quantity > 1 && <span className="present-item-qty">×{inv.quantity}</span>}
                      </div>
                      <div className="present-item-info">
                        <span className="present-item-name">{item.label}</span>
                        {item.description && (
                          <span className="present-item-desc muted small">{item.description}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="dialogue-choices" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="choice-btn end"
                  onClick={(e) => {
                    e.stopPropagation()
                    engine.submitPresentedItem(null)
                  }}
                >
                  [Ничего не предъявлять]
                </button>
              </div>
            </div>
          )}
          {allShown && !d.presenting && (
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
          {!allShown && (
            <div className="dialogue-advance-bar">
              <button
                type="button"
                className="btn btn-small dlg-advance-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  skipOrAdvance()
                }}
                data-tip="Следующее предложение (или клик мышью / Пробел)"
              >
                Далее ▶
              </button>
              <button
                type="button"
                className="btn btn-small dlg-skip-all-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  skipAllLines()
                }}
                data-tip="Пропустить весь монолог до вариантов ответа (Esc)"
              >
                Пропустить ⏭
              </button>
            </div>
          )}
        </div>
      </div>
      {showBacklog && (
        <div className="overlay dlg-backlog-overlay" onClick={(e) => { e.stopPropagation(); setShowBacklog(false); }}>
          <div className="panel dlg-backlog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h3><Ico n="scroll" /> История разговора</h3>
              <button className="btn btn-small" onClick={() => setShowBacklog(false)}><Ico n="close" /></button>
            </div>
            <div className="dlg-backlog-list">
              {(d.history && d.history.length > 0) ? (
                d.history.map((h, i) => (
                  <div key={i} className={`dlg-backlog-entry ${h.isChoice ? 'dlg-backlog-choice' : ''} ${h.action ? 'dlg-backlog-action' : ''}`}>
                    {h.speaker && <b className="dlg-backlog-speaker">{h.speaker}:</b>}
                    <span className="dlg-backlog-text">{h.action ? `→ ${h.text}` : h.text}</span>
                  </div>
                ))
              ) : (
                <div className="muted small">Разговор только начался.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
