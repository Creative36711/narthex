import { useMemo, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { Hex } from '../core/hex'
import { hexKey, hexToPixel, hexCorners, gridPixelSize, hexDistance } from '../core/hex'
import { assetUrl } from '../core/loader'

interface Props {
  engine: GameEngine
}

/** Экран тактического боя: арена + гекс-сетка + токены (ТЗ 6.1 «Бой»). */
export function CombatScreen({ engine }: Props) {
  const combat = engine.combat!
  const arena = combat.arena
  const canvas = arena.canvas ?? { w: 1280, h: 720 }
  const size = arena.hex_grid.hex_size
  const [hoverHex, setHoverHex] = useState<string | null>(null)

  const origin = useMemo(() => {
    if (arena.hex_grid.origin) return arena.hex_grid.origin
    const g = gridPixelSize(arena.hex_grid.cols, arena.hex_grid.rows, size)
    return {
      x: (canvas.w - g.w) / 2 + (size * Math.sqrt(3)) / 2,
      y: (canvas.h - g.h) / 2 + size,
    }
  }, [arena, canvas.w, canvas.h, size])

  const playerTurn = combat.isPlayerTurn()
  const reach = useMemo(
    () => (playerTurn ? combat.reachableHexes() : new Map<string, number>()),
    // пересчёт при каждом уведомлении движка — combat мутирует
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerTurn, combat.active.movLeft, combat.active.pos.col, combat.active.pos.row, combat.round],
  )

  const hexes: Hex[] = []
  for (let row = 0; row < arena.hex_grid.rows; row++) {
    for (let col = 0; col < arena.hex_grid.cols; col++) {
      hexes.push({ col, row })
    }
  }

  const activePlayer = combat.active

  const onHexClick = (h: Hex) => {
    if (!playerTurn) return
    const occ = combat.occupantAt(h)
    if (occ && occ.side === 'enemy') {
      if (combat.canAttack(combat.active, occ)) combat.playerAttack(occ.id)
      return
    }
    if (reach.has(hexKey(h))) combat.playerMoveTo(h)
  }

  return (
    <div className="overlay combat-overlay">
      <div className="combat-panel">
        <div className="combat-header">
          <div>
            <b>{arena.label}</b> · Раунд {combat.round}
          </div>
          <div className="combat-turn">
            Ход: <b className={playerTurn ? 'gold' : ''}>{combat.active.label}</b>
          </div>
        </div>

        <div className="combat-main">
          <div className="combat-stage" style={{ aspectRatio: `${canvas.w} / ${canvas.h}` }}>
            <img className="combat-bg" src={assetUrl(engine.campaign, arena.image)} alt={arena.label} draggable={false} />
            <svg
              className="combat-grid"
              viewBox={`0 0 ${canvas.w} ${canvas.h}`}
              preserveAspectRatio="none"
            >
              {hexes.map((h) => {
                const k = hexKey(h)
                const c = hexToPixel(h, size, origin)
                const blocked = combat.isBlocked(h)
                const difficult = combat.isDifficult(h)
                const inReach = reach.has(k)
                const occ = combat.occupantAt(h)
                const attackable =
                  playerTurn && occ && occ.side === 'enemy' && combat.canAttack(combat.active, occ)
                let cls = 'hex'
                if (blocked) cls += ' hex-blocked'
                else if (attackable) cls += ' hex-attack'
                else if (inReach) cls += ' hex-reach'
                else if (difficult) cls += ' hex-difficult'
                if (hoverHex === k && (inReach || attackable)) cls += ' hex-hover'
                return (
                  <polygon
                    key={k}
                    className={cls}
                    points={hexCorners(c, size - 1)}
                    onMouseEnter={() => setHoverHex(k)}
                    onMouseLeave={() => setHoverHex(null)}
                    onClick={() => onHexClick(h)}
                  />
                )
              })}
            </svg>

            {combat.combatants.map((c) => {
              const px = hexToPixel(c.pos, size, origin)
              return (
                <div
                  key={c.id}
                  className={`token token-${c.side} ${c.dead ? 'token-dead' : ''} ${c.id === combat.active.id && !c.dead ? 'token-active' : ''}`}
                  style={{
                    left: `${(px.x / canvas.w) * 100}%`,
                    top: `${(px.y / canvas.h) * 100}%`,
                    width: `${((size * 1.45) / canvas.w) * 100}%`,
                  }}
                  title={`${c.label} — HP ${Math.max(0, c.hp)}/${c.maxHp}`}
                  onClick={() => onHexClick(c.pos)}
                >
                  {c.portrait ? (
                    <img src={assetUrl(engine.campaign, c.portrait)} alt={c.label} draggable={false} />
                  ) : (
                    <span className="token-fallback">{c.label[0]}</span>
                  )}
                  <div className="token-hp">
                    <div
                      className="token-hp-fill"
                      style={{ width: `${Math.max(0, (c.hp / c.maxHp) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="combat-side">
            <div className="combat-actions">
              {playerTurn ? (
                <>
                  <div className="combat-hint">
                    Движение: <b>{activePlayer.movLeft}</b> гекс. ·{' '}
                    {activePlayer.attacked ? 'действие израсходовано' : `атака: «${activePlayer.weaponLabel}»`}
                  </div>
                  <div className="combat-hint muted">
                    Клик по подсвеченному гексу — движение, по врагу в досягаемости — атака.
                  </div>
                  {!activePlayer.attacked && combat.usableItems().length > 0 && (
                    <details className="combat-items">
                      <summary>Использовать предмет (действие)</summary>
                      {combat.usableItems().map((it) => (
                        <button key={it.id} className="btn btn-small" onClick={() => combat.playerUseItem(it.id)}>
                          {it.label} ×{it.quantity}
                        </button>
                      ))}
                    </details>
                  )}
                  <button className="btn btn-primary" onClick={() => combat.playerEndTurn()}>
                    Завершить ход
                  </button>
                </>
              ) : combat.result === 'victory' ? (
                <div className="combat-victory">
                  <h3>🏆 Победа!</h3>
                  {combat.loot.length > 0 && (
                    <div className="combat-loot">
                      <b>Добыча:</b>
                      <ul>
                        {combat.loot.map((l, i) => (
                          <li key={i}>{l.label} ×{l.quantity}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={() => engine.endCombat()}>
                    Продолжить
                  </button>
                </div>
              ) : (
                <div className="combat-hint">Ход противника…</div>
              )}
            </div>
            <div className="combat-log">
              {combat.log.slice(-14).map((l, i) => (
                <div key={i} className="combat-log-line">{l}</div>
              ))}
            </div>
            <div className="combat-roster">
              {combat.combatants.map((c) => (
                <div key={c.id} className={`roster-row ${c.dead ? 'dead' : ''} side-${c.side}`}>
                  <span>{c.label}</span>
                  <span>
                    {Math.max(0, c.hp)}/{c.maxHp}
                    {!c.dead && combat.active.id !== c.id ? '' : c.dead ? ' ☠' : ' ◂'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function distanceHint(a: Hex, b: Hex): number {
  return hexDistance(a, b)
}
