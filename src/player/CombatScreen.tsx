import { Ico } from '../shared/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import type { Hex } from '../core/hex'
import { hexKey, hexToPixel, hexCorners, gridPixelSize, hexDistance } from '../core/hex'
import { assetUrl } from '../core/loader'
import { tipSeen, markTip } from './tips'
import { featureOn } from '../shared/types'

interface Props {
  engine: GameEngine
}

/** класс строки лога по содержимому — для читаемости */
function logLineClass(l: string): string {
  if (l.startsWith('— Раунд')) return 'log-round'
  if (l.startsWith('')) return 'log-death'
  if (l.startsWith('')) return 'log-win'
  if (l.includes('Промах') || l.includes('промах') || l.includes('уклоняется') || l.includes('парирует'))
    return 'log-miss'
  if (l.includes('урона') || l.includes('Крит')) return 'log-hit'
  return ''
}

/** Экран тактического боя: арена + гекс-сетка + токены (ТЗ 6.1 «Бой»). */
export function CombatScreen({ engine }: Props) {
  const combat = engine.combat!
  const arena = combat.arena
  const canvas = arena.canvas ?? { w: 1280, h: 720 }
  const size = arena.hex_grid.hex_size
  const [hoverHex, setHoverHex] = useState<string | null>(null)
  const campaignId = engine.campaign.meta.id
  const [showTutorial, setShowTutorial] = useState(() => !tipSeen('combat', campaignId))
  /** выбранная способность игрока: ждём клик по цели */
  const [pendingAbility, setPendingAbility] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const previousHp = useRef<Map<string, number> | null>(null)
  const [recentDamage, setRecentDamage] = useState<Set<string>>(() => new Set())
  const [damagePopups, setDamagePopups] = useState<Array<{ id: string; target: string; amount: number }>>([])
  const [rollFeedback, setRollFeedback] = useState<{ text: string; actor: string } | null>(null)
  const latestCombatLog = combat.log.at(-1) ?? ''
  const hpStamp = combat.combatants.map((c) => `${c.id}:${c.hp}`).join('|')

  useEffect(() => {
    const current = new Map(combat.combatants.map((c) => [c.id, c.hp]))
    const before = previousHp.current
    previousHp.current = current
    if (!before) return
    const changed = combat.combatants.flatMap((c) => {
      const amount = (before.get(c.id) ?? c.hp) - c.hp
      return amount ? [{ id: `${combat.log.length}-${c.id}`, target: c.id, amount }] : []
    })
    if (!changed.length) return
    const damaged = new Set(changed.filter((p) => p.amount > 0).map((p) => p.target))
    if (damaged.size) {
      setRecentDamage(damaged)
      window.setTimeout(() => setRecentDamage(new Set()), 180)
    }
    setDamagePopups((old) => [...old, ...changed])
    const popupIds = new Set(changed.map((p) => p.id))
    const timer = window.setTimeout(() => setDamagePopups((old) => old.filter((p) => !popupIds.has(p.id))), 700)
    return () => window.clearTimeout(timer)
  }, [hpStamp, combat])

  useEffect(() => {
    const match = latestCombatLog.match(/^(.+?): атака .*d100=(\d+)/)
    if (!match) return
    const actor = combat.combatants.find((c) => c.label === match[1])
    if (!actor) return
    setRollFeedback({ actor: actor.id, text: `d100 · ${match[2]}` })
    const timer = window.setTimeout(() => setRollFeedback(null), 600)
    return () => window.clearTimeout(timer)
  }, [latestCombatLog, combat])

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

  // автопрокрутка лога вниз
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [combat.log.length])

  // вне хода игрока выбор способности сбрасывается
  useEffect(() => {
    if (!playerTurn) setPendingAbility(null)
  }, [playerTurn])

  const hexes: Hex[] = []
  for (let row = 0; row < arena.hex_grid.rows; row++) {
    for (let col = 0; col < arena.hex_grid.cols; col++) {
      hexes.push({ col, row })
    }
  }

  const activePlayer = combat.active

  // цели выбранной способности (блок 6 ТЗ): подсвечиваются вместо дальности хода
  const abilityTargetIds = useMemo(() => {
    if (!pendingAbility || !playerTurn) return new Set<string>()
    return new Set(combat.abilityTargets(pendingAbility).map((t) => t.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAbility, playerTurn, combat.round, combat.active.pos.col, combat.active.pos.row])

  const onHexClick = (h: Hex) => {
    if (!playerTurn) return
    const occ = combat.occupantAt(h)
    if (pendingAbility && occ && abilityTargetIds.has(occ.id)) {
      combat.useAbility(pendingAbility, occ.id)
      setPendingAbility(null)
      return
    }
    if (pendingAbility) setPendingAbility(null) // клик мимо цели отменяет выбор
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
            <Ico n="sword" />  <b>{arena.label}</b> · Раунд {combat.round}
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
                const abilityTarget = !!pendingAbility && !!occ && abilityTargetIds.has(occ.id)
                const attackable =
                  playerTurn && occ && occ.side === 'enemy' && combat.canAttack(combat.active, occ)
                let cls = 'hex'
                if (blocked) cls += ' hex-blocked'
                else if (abilityTarget) cls += ' hex-ability'
                else if (attackable) cls += ' hex-attack'
                else if (inReach) cls += ' hex-reach'
                else if (difficult) cls += ' hex-difficult'
                if (hoverHex === k && (inReach || attackable || abilityTarget)) cls += ' hex-hover'
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
              const posStyle = {
                left: `${(px.x / canvas.w) * 100}%`,
                top: `${(px.y / canvas.h) * 100}%`,
                width: `${((size * 1.45) / canvas.w) * 100}%`,
              }
              const statusText = c.statuses.length
                ? '\n' + c.statuses.map((s) => `${combat.statusLabel(s.id)}: ещё ${s.left} раунд(а)`).join('\n')
                : ''
              const tip = `${c.label}${engine.descOf(c.entityId) ? `\n${engine.descOf(c.entityId)}` : ''}\nHP ${Math.max(0, c.hp)}/${c.maxHp}${statusText}${c.down && !c.dead ? '\nБЕЗ СОЗНАНИЯ (выбыл из боя, жив)' : ''}`
              // фигурка боя вместо жетона (блок 3 ТЗ): без круглой маски и
              // рамки стороны; разворот по направлению движения/атаки
              if (c.figure) {
                const mode = c.figure_mode ?? 'topdown'
                const transform =
                  mode === 'topdown'
                    ? `rotate(${c.facing}deg)`
                    : mode === 'side'
                      ? `scaleX(${c.flip ? -1 : 1})`
                      : undefined
                return (
                  <div
                    key={c.id}
                    className={`token-figure figure-${c.side} ${c.dead || c.down ? 'token-dead' : ''} ${c.id === combat.active.id && !c.dead && !c.down ? 'figure-active' : ''} ${recentDamage.has(c.id) ? 'token-hit' : ''} ${rollFeedback?.actor === c.id ? 'token-lunge' : ''}`}
                    style={posStyle}
                    data-tip={tip}
                    onClick={() => onHexClick(c.pos)}
                  >
                    {c.figure_shadow !== false && !c.dead && <span className="figure-shadow" />}
                    <img
                      src={assetUrl(engine.campaign, c.figure)}
                      alt={c.label}
                      draggable={false}
                      style={transform ? { transform } : undefined}
                    />
                    <div className="token-hp">
                      <div className="token-hp-fill" style={{ width: `${Math.max(0, (c.hp / c.maxHp) * 100)}%` }} />
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={c.id}
                  className={`token token-${c.side} ${c.dead || c.down ? 'token-dead' : ''} ${c.id === combat.active.id && !c.dead && !c.down ? 'token-active' : ''} ${recentDamage.has(c.id) ? 'token-hit' : ''} ${rollFeedback?.actor === c.id ? 'token-lunge' : ''}`}
                  style={posStyle}
                  data-tip={tip}
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

            {rollFeedback && <div className="combat-roll-feedback" aria-live="polite">{rollFeedback.text}</div>}
            {damagePopups.map((popup) => {
              const target = combat.combatants.find((c) => c.id === popup.target)
              if (!target) return null
              const point = hexToPixel(target.pos, size, origin)
              return <div key={popup.id} className={`combat-float-number ${popup.amount > 0 ? 'damage' : 'healing'}`} style={{ left: `${(point.x / canvas.w) * 100}%`, top: `${(point.y / canvas.h) * 100}%` }}>{popup.amount > 0 ? `−${popup.amount}` : `+${-popup.amount}`}</div>
            })}

            {showTutorial && !combat.result && (
              <div className="combat-tutorial">
                <h4><Ico n="info" />  Первый бой — подсказка по правилам движка</h4>
                <ol>
                  <li><b>Очередь.</b> Порядок ходов определяется Ловкостью (DEX); текущий ход и очередь показаны в интерфейсе боя.</li>
                  <li><b>Движение.</b> Перемещайтесь по подсвеченным гексам. Доступная дальность учитывает характеристики, эффекты и правила текущего боя.</li>
                  <li><b>Атака.</b> Выберите противника в пределах досягаемости. Движок проверит навык оружия персонажа броском d100 по правилам этой кампании.</li>
                  <li><b>Защита.</b> Движок автоматически проверяет уклонение или парирование, если у персонажа есть подходящий навык/оружие. Повторные защиты в раунде получают штраф.</li>
                  {featureOn(engine.campaign.meta, 'inventory') && combat.usableItems().length > 0 && <li><b>Предметы.</b> Предметы с боевым эффектом доступны в блоке действий; их использование расходует действие.</li>}
                </ol>
                <p className="muted small">Кнопки и доступные действия зависят от кампании. Броски и эффекты рассчитывает движок; подробности — в справке.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    markTip('combat', campaignId)
                    setShowTutorial(false)
                  }}
                >
                  Понятно, в бой!
                </button>
              </div>
            )}
          </div>

          <div className="combat-side">
            <div className="combat-actions">
              {playerTurn ? (
                <>
                  <div className="combat-hint">
                    Движение: <b>{activePlayer.movLeft}</b> гекс. · Атак: <b>{activePlayer.attacksLeft}</b>
                    {activePlayer.attacksLeft > 1 ? ' (следующая со штрафом)' : ''} · MP: <b>{activePlayer.mp}</b> ·{''}
                    {activePlayer.attacked ? ' действие израсходовано' : ` атака: «${activePlayer.weaponLabel}»`}
                  </div>
                  <div className="combat-hint muted">
                    {pendingAbility
                      ? 'Кликните по подсвеченной цели, чтобы применить способность (клик мимо — отмена).'
                      : 'Клик по подсвеченному гексу — движение, по врагу в досягаемости — атака.'}
                  </div>
                  {combat.playerAbilities().length > 0 && (
                    <div className="combat-abilities">
                      {combat.playerAbilities().map(({ def, usable, reason }) => (
                        <button
                          key={def.id}
                          className={`btn btn-small ability-btn ${pendingAbility === def.id ? 'ability-pending' : ''}`}
                          disabled={!usable && pendingAbility !== def.id}
                          data-tip={`${def.description ?? def.label}\nСтоимость: ${def.mp_cost} MP · дальность ${def.range} гекс.${def.cooldown_rounds ? ` · кулдаун ${def.cooldown_rounds} раунд.` : ''}${reason ? `\nНедоступно: ${reason}` : ''}`}
                          onClick={() => setPendingAbility(pendingAbility === def.id ? null : def.id)}
                        >
                          <Ico n="sparkle" />  {def.label} ({def.mp_cost} MP)
                        </button>
                      ))}
                    </div>
                  )}
                  {combat.companionOrders().length > 0 && (
                    <details className="combat-items">
                      <summary>Приказы отряду (аудит §5.6 п.11)</summary>
                      {combat.companionOrders().map((o) => (
                        <div key={o.entityId} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
                          <span className="small" style={{ flex: 1 }}>{o.label}</span>
                          <select
                            className="btn btn-small"
                            value={o.order}
                            data-tip={'Сам — действует как простой AI.\nСледовать — держится в паре гексов от вас, не нападает.\nДержать позицию — стоит, бьёт только в досягаемости.\nОтступать — держится подальше от врагов.'}
                            onChange={(e) => combat.setCompanionOrder(o.entityId, e.target.value as 'free' | 'follow' | 'hold' | 'retreat')}
                          >
                            <option value="free">Сам</option>
                            <option value="follow">Следовать</option>
                            <option value="hold">Позиция</option>
                            <option value="retreat">Отступать</option>
                          </select>
                        </div>
                      ))}
                    </details>
                  )}
                  {!activePlayer.attacked && featureOn(engine.campaign.meta, 'inventory') && combat.usableItems().length > 0 && (
                    <details className="combat-items">
                      <summary>Использовать предмет (действие)</summary>
                      {combat.usableItems().map((it) => (
                        <button key={it.id} className="btn btn-small" onClick={() => combat.playerUseItem(it.id)}>
                          {it.label} ×{it.quantity}
                        </button>
                      ))}
                    </details>
                  )}
                  {combat.canHide() && (
                    <button
                      className="btn"
                      disabled={activePlayer.attacked || activePlayer.hidden}
                      data-tip={'Скрытность (действие за ход).\nПроверка скрытности против лучшей внимательности врагов.\nСкрытый герой не выбирается целью; первая атака из скрытности бьёт без защиты.'}
                      onClick={() => combat.playerHide()}
                    >
                      {activePlayer.hidden ? 'Вы скрыты' : 'Скрыться'}
                    </button>
                  )}
                  {combat.canFlee() && (
                    <button
                      className="btn"
                      data-tip={'Отступление из боя.\nВраги в досягаемости ударят напоследок, затем проверка навыка отступления (уклонение или DEX×5).\nПровал — ход потерян.'}
                      onClick={() => combat.playerFlee()}
                    >
                      Бежать из боя
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    data-tip="Закончить ход без атаки (после атаки ход завершается сам)"
                    onClick={() => combat.playerEndTurn()}
                  >
                    Пропустить ход
                  </button>
                </>
              ) : combat.result === 'victory' ? (
                <div className="combat-victory">
                  <h3><Ico n="trophy" />  Победа!</h3>
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
                  {featureOn(engine.campaign.meta, 'skills') && !tipSeen('growth', campaignId) && (
                    <p className="combat-growth-tip">
                      <Ico n="info" /> Успешные атаки и защиты могут отметить использованный навык.
                      Когда сценарий кампании вызывает сон, движок проверяет отмеченные навыки: бросок d100 выше текущего значения даёт рост на 1d6.
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      markTip('growth', campaignId)
                      engine.endCombat()
                    }}
                  >
                    Продолжить
                  </button>
                </div>
              ) : combat.result === 'fled' ? (
                <div className="combat-victory">
                  <h3>Вы отступили</h3>
                  <p className="muted small">Бой позади. Противники остались на своих позициях.</p>
                  <button className="btn btn-primary" onClick={() => engine.endCombat()}>
                    Продолжить
                  </button>
                </div>
              ) : combat.result === 'defeat' ? (
                <div className="combat-defeat">
                  {engine.state.game_over ? (
                    <>
                      <h3><Ico n="skull" />  Вы пали в бою</h3>
                      <p className="muted small">Забег окончен…</p>
                    </>
                  ) : (
                    <>
                      <h3>Вы теряете сознание</h3>
                      <p className="muted small">Бой проигран — но герой жив.</p>
                      <button className="btn btn-primary" onClick={() => engine.endCombat()}>
                        Продолжить
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="combat-hint">Ход противника…</div>
              )}
            </div>
            <div className="combat-log" ref={logRef}>
              {combat.log.map((l, i) => (
                <div key={i} className={`combat-log-line ${logLineClass(l)}`}>{l}</div>
              ))}
            </div>
            <div className="combat-roster">
              {combat.combatants.map((c) => (
                <div key={c.id} className={`roster-row ${c.dead ? 'dead' : ''} side-${c.side}`}>
                  <span>
                    {c.label}
                    {c.down && !c.dead && <span className="roster-status" data-tip="Выбыл из боя, но жив">без сознания</span>}
                    {c.statuses.map((s) => (
                      <span key={s.id} className="roster-status" data-tip={combat.statusLabel(s.id)}>
                        {combat.statusLabel(s.id)} ({s.left})
                      </span>
                    ))}
                  </span>
                  <span>
                    {Math.max(0, c.hp)}/{c.maxHp}
                    {!c.dead && combat.active.id !== c.id ? '' : c.dead ? '' : '◂'}
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
