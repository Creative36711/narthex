import { useMemo, useState, type MouseEvent } from 'react'
import type { GameEngine } from '../core/engine'
import type { AdventureEvent, AdventureHotspot } from '../../packs/adventure/types'
import type { AdventureSession } from './adventureRuntime'

type Draw = Record<string, unknown> & { type: string }

const MODE_LABELS = [
  { mode: 'walk', label: 'Идти' },
  { mode: 'look', label: 'Осмотреть' },
  { mode: 'take', label: 'Взять' },
  { mode: 'talk', label: 'Говорить' },
] as const

const SIGIL_LABELS: Record<string, string> = { ash: 'Пепел', oak: 'Дуб', sun: 'Солнце' }

export function AdventureScreen({ engine, session }: { engine: GameEngine; session: AdventureSession }) {
  const [revision, setRevision] = useState(0)
  const [combineSelection, setCombineSelection] = useState<string[]>([])
  const [sigilSelection, setSigilSelection] = useState<string[]>([])
  const commands = useMemo(() => session.draw() as Draw[], [session, revision])
  const runtime = session.state.adventure
  const currentScene = session.content.scenes[session.state.scene]
  const campaignScene = engine.campaign.scenes[session.state.scene]
  const sceneState = campaignScene ? engine.activeSceneState(campaignScene) : null
  const canvas = campaignScene?.canvas ?? { w: 1280, h: 720 }
  const avatar = commands.find((command) => command.type === 'adventure.avatar')
  const cursor = commands.find((command) => command.type === 'adventure.cursor')
  const message = commands.find((command) => command.type === 'adventure.message')
  const closeup = commands.find((command) => command.type === 'adventure.closeup')
  const ending = commands.find((command) => command.type === 'adventure.ending')
  const inventory = Object.entries(session.state.inventory).filter(([, quantity]) => quantity > 0)

  const dispatch = (event: AdventureEvent) => {
    session.dispatch(event)
    setRevision((value) => value + 1)
  }
  const pointFor = (hotspot: { x: number; y: number; w: number; h: number }) => ({
    x: hotspot.x + hotspot.w / 2,
    y: hotspot.y + hotspot.h / 2,
  })
  const clickStage = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    dispatch({
      type: 'adventure_click',
      x: Math.round((event.clientX - bounds.left) / bounds.width * canvas.w),
      y: Math.round((event.clientY - bounds.top) / bounds.height * canvas.h),
    })
  }
  const clickHotspot = (hotspot: AdventureHotspot) => {
    const point = pointFor(hotspot)
    dispatch({ type: 'adventure_click', ...point })
  }
  const selectItem = (item: string) => {
    if (combineSelection.length === 0) {
      setCombineSelection([item])
      return
    }
    const first = combineSelection[0]!
    setCombineSelection([])
    dispatch({ type: 'adventure_combine', first, second: item })
  }
  const submitSigils = () => {
    if (!closeup || sigilSelection.length === 0) return
    dispatch({
      type: 'adventure_solve_riddle',
      riddle: String(closeup.riddle),
      solution: sigilSelection,
    })
    setSigilSelection([])
  }
  const endingId = typeof ending?.ending === 'string' ? ending.ending : ''
  const endingLabel = endingId ? session.content.endings[endingId]?.label ?? 'Развязка открыта' : ''
  const sceneLabel = campaignScene?.label ?? sceneState?.label ?? 'Приключение'
  const readableMessage = Object.entries(engine.campaign.entities).reduce(
    (text, [id, entity]) => entity?.label ? text.replaceAll(id, entity.label) : text,
    typeof message?.text === 'string' ? message.text : '',
  )

  return (
    <section className="adventure-screen" data-adventure-ready data-adventure-scene={session.state.scene}>
      <header className="adventure-header">
        <div>
          <span className="adventure-eyebrow">Приключение · {session.manifest.title}</span>
          <h2>{sceneLabel}</h2>
        </div>
        <div className="adventure-tools" aria-label="Режим курсора">
          {MODE_LABELS.map(({ mode, label }) => (
            <button
              type="button"
              key={mode}
              className={`btn adventure-mode${cursor?.mode === mode ? ' is-active' : ''}`}
              aria-pressed={cursor?.mode === mode}
              data-adventure-cursor={mode}
              onClick={() => dispatch({ type: 'adventure_cursor', mode })}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="adventure-layout">
        <div className="adventure-stage-column">
          <div
            className={`adventure-stage${closeup ? ' is-closeup' : ''}`}
            data-adventure-stage
            data-cursor={cursor?.mode ?? 'walk'}
            style={{ aspectRatio: `${canvas.w} / ${canvas.h}` }}
            onClick={clickStage}
          >
            <div className={`adventure-paint adventure-paint-${session.state.scene}`} aria-hidden="true">
              <span className="adventure-moon" />
              <span className="adventure-ridge adventure-ridge-back" />
              <span className="adventure-ridge adventure-ridge-front" />
              <span className="adventure-ground" />
              <span className="adventure-gate" />
              <span className="adventure-embers" />
            </div>
            <div className="adventure-hotspots">
              {currentScene?.hotspots.map((hotspot) => {
                const isTaken = runtime.takenHotspots.includes(hotspot.id)
                return (
                  <button
                    type="button"
                    key={hotspot.id}
                    className={`adventure-hotspot${isTaken ? ' is-taken' : ''}${hotspot.dialogue ? ' is-character' : ''}`}
                    style={{
                      left: `${(hotspot.x / canvas.w) * 100}%`,
                      top: `${(hotspot.y / canvas.h) * 100}%`,
                      width: `${(hotspot.w / canvas.w) * 100}%`,
                      height: `${(hotspot.h / canvas.h) * 100}%`,
                    }}
                    aria-label={hotspot.label}
                    data-adventure-hotspot={hotspot.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      clickHotspot(hotspot)
                    }}
                  >
                    <span>{hotspot.label}</span>
                  </button>
                )
              })}
            </div>
            {avatar && (
              <div
                className="adventure-avatar"
                aria-label="Аватар героя"
                data-adventure-avatar
                style={{ left: `${(Number(avatar.x) / canvas.w) * 100}%`, top: `${(Number(avatar.y) / canvas.h) * 100}%` }}
              >
                <span className="adventure-avatar-cloak" />
                <span className="adventure-avatar-face" />
              </div>
            )}
            {readableMessage && (
              <div className="adventure-message" role="status" data-adventure-message>{readableMessage}</div>
            )}
            {closeup && (
              <div className="adventure-riddle" role="dialog" aria-modal="true" aria-labelledby="adventure-riddle-title" data-adventure-riddle onClick={(event) => event.stopPropagation()}>
                <h3 id="adventure-riddle-title">Знаки на механизме ворот</h3>
                <p>Выстройте три символа в верном порядке.</p>
                <div className="adventure-sigil-row">
                  {Object.entries(SIGIL_LABELS).map(([id, label]) => (
                    <button type="button" className="btn" key={id} onClick={() => setSigilSelection((items) => [...items, id])}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="adventure-sigil-choice" data-adventure-sigil-choice>
                  {sigilSelection.map((id) => SIGIL_LABELS[id] ?? id).join(' → ') || 'Выберите три символа'}
                </p>
                <div className="adventure-riddle-actions">
                  <button type="button" className="btn" onClick={() => setSigilSelection([])}>Сбросить</button>
                  <button type="button" className="btn btn-primary" disabled={sigilSelection.length !== 3} onClick={submitSigils}>Проверить порядок</button>
                </div>
              </div>
            )}
            {ending && (
              <div className="adventure-ending" role="status" data-adventure-ending={endingId}>
                <span className="adventure-ending-kicker">Развязка</span>
                <strong>{endingLabel}</strong>
                <span>Каменный механизм поддался — ворота открыты.</span>
              </div>
            )}
          </div>
          <div className="adventure-stage-footer">
            <span>Курсор: <strong>{MODE_LABELS.find(({ mode }) => mode === cursor?.mode)?.label ?? 'Идти'}</strong></span>
            {session.state.scene === session.content.startScene && (
              <button
                type="button"
                className="btn btn-small"
                data-adventure-open-riddle
                onClick={() => dispatch({ type: 'adventure_open_riddle', riddle: session.content.riddles[0]!.id })}
              >
                Подойти к механизму ворот
              </button>
            )}
            {!closeup && session.state.scene !== session.content.startScene && session.content.riddles[0] && (
              <button
                type="button"
                className="btn btn-small"
                data-adventure-open-riddle
                onClick={() => dispatch({ type: 'adventure_open_riddle', riddle: session.content.riddles[0]!.id })}
              >
                Осмотреть механизм
              </button>
            )}
          </div>
        </div>

        <aside className="adventure-inventory" aria-label="Инвентарь приключения">
          <h3>Вещи при себе</h3>
          {inventory.length === 0 ? (
            <p className="muted">Пока ничего не найдено.</p>
          ) : (
            <div className="adventure-items">
              {inventory.map(([id, quantity]) => {
                const label = engine.campaign.entities[id]?.label ?? 'Предмет'
                return (
                  <button
                    type="button"
                    className={`btn adventure-item${combineSelection[0] === id ? ' is-selected' : ''}`}
                    key={id}
                    aria-label={`Выбрать предмет: ${label}`}
                    data-adventure-item={id}
                    onClick={() => selectItem(id)}
                  >
                    <span>{label}</span><small>×{quantity}</small>
                  </button>
                )
              })}
            </div>
          )}
          <p className="adventure-inventory-hint">Выберите два одинаковых пучка трав, чтобы приготовить мазь.</p>
          {combineSelection.length > 0 && <p className="muted small">Выбрано: {engine.campaign.entities[combineSelection[0]!]?.label ?? 'предмет'} · выберите второй.</p>}
          {inventory.some(([id]) => id === session.content.combinations[0]?.output) && (
            <p className="adventure-crafted" data-adventure-crafted>Целебная мазь готова.</p>
          )}
        </aside>
      </div>
    </section>
  )
}
