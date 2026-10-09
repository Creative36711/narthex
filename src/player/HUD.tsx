import { Ico } from '../shared/icons'
import { useEffect, useRef, useState } from 'react'
import { askConfirm } from '../shared/modals'
import { SettingsPanel } from '../shared/SettingsPanel'
import type { GameEngine } from '../core/engine'
import { formatDate, formatTime, timeOfDay, TIME_OF_DAY_LABEL } from '../core/time'
import { featureOn } from '../shared/types'
import { assetUrl } from '../core/loader'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
  onOpenInventory: () => void
  onOpenCharacter: () => void
  onOpenLog: () => void
  onOpenMeta?: () => void
  onOpenCraft: () => void
  onOpenCodex: () => void
  onOpenSaves: () => void
  onOpenHelp: () => void
  onExitToMenu: () => void
}

export function HUD({ engine, onOpenMap, onOpenInventory, onOpenCharacter, onOpenLog, onOpenCraft, onOpenCodex, onOpenSaves, onOpenHelp, onOpenMeta, onExitToMenu }: Props) {
  const s = engine.state
  const meta = engine.campaign.meta
  const tod = timeOfDay(s.tick, meta)
  const [showSettings, setShowSettings] = useState(false)
  const needsOn = featureOn(meta, 'needs')
  const timeOn = featureOn(meta, 'time')

  const [floatingDeltas, setFloatingDeltas] = useState<Array<{ id: number; text: string; isPositive: boolean }>>([])
  const prevHpRef = useRef(s.player.hp)
  const prevSanityRef = useRef(engine.sanity())

  useEffect(() => {
    const diffHp = s.player.hp - prevHpRef.current
    if (diffHp !== 0 && prevHpRef.current !== undefined) {
      const id = Date.now() + Math.random()
      const text = `${diffHp > 0 ? '+' : '−'}${Math.abs(diffHp)} HP`
      setFloatingDeltas((prev) => [...prev.slice(-3), { id, text, isPositive: diffHp > 0 }])
      setTimeout(() => {
        setFloatingDeltas((prev) => prev.filter((d) => d.id !== id))
      }, 1600)
    }
    prevHpRef.current = s.player.hp
  }, [s.player.hp])

  useEffect(() => {
    const currentSanity = engine.sanity()
    const diffSanity = currentSanity - prevSanityRef.current
    if (diffSanity !== 0 && prevSanityRef.current !== undefined && engine.sanityMax() > 0) {
      const id = Date.now() + Math.random()
      const text = `${diffSanity > 0 ? '+' : '−'}${Math.abs(diffSanity)} Рассудок`
      setFloatingDeltas((prev) => [...prev.slice(-3), { id, text, isPositive: diffSanity > 0 }])
      setTimeout(() => {
        setFloatingDeltas((prev) => prev.filter((d) => d.id !== id))
      }, 1600)
    }
    prevSanityRef.current = currentSanity
  }, [engine.state.player.sanity, engine])

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-bar hp" data-tip="Здоровье">
          <div className="hud-bar-fill" style={{ width: `${(s.player.hp / s.player.max_hp) * 100}%` }} />
          <span>HP {s.player.hp}/{s.player.max_hp}</span>
          {floatingDeltas.length > 0 && (
            <div className="hud-floating-deltas" aria-hidden="true">
              {floatingDeltas.map((d) => (
                <span key={d.id} className={`floating-delta ${d.isPositive ? 'delta-heal' : 'delta-damage'}`}>
                  {d.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="hud-group hud-group-statuses">
          {engine.campaign.meta.luck && engine.luckMax() > 0 && (
            <div
              className="hud-status-chip"
              data-tip={`Удача: ${engine.luck()}/${engine.luckMax()}.\nНа провальном броске вне боя можно потратить удачу и перебросить.\nВосстанавливается на отдыхе.`}
            >
              Удача {engine.luck()}
            </div>
          )}
          {engine.reputationEnabled() && (
            <div
              className="hud-status-chip"
              data-tip={`${engine.reputationLabel()}: ${engine.reputation()}.\nМеняется деяниями героя.`}
            >
              {engine.reputationLabel()} {engine.reputation()}
            </div>
          )}
          {engine.progressionEnabled() && (
            <div
              className="hud-status-chip"
              data-tip={`Уровень ${engine.level()} — опыт ${engine.xp()}${engine.xpToNext() != null ? ` (до след. уровня ${engine.xpToNext()})` : ' (потолок)'}.\nОпыт начисляется за ход событий; за каждый уровень — новая черта в листе персонажа.`}
            >
              Ур. {engine.level()}{engine.pendingFeats() > 0 ? ` (+${engine.pendingFeats()})` : ''}
            </div>
          )}
          {engine.stealthEnabled() && engine.isSneaking() && engine.isDetected() && (
            <div
              className="hud-status-chip hud-status-detected"
              data-tip="Вас заметили! Покиньте режим скрытности или попробуйте снова."
            >
              Замечен!
            </div>
          )}
        </div>
        {engine.sanityMax() > 0 && (
          <div
            className="hud-status-chip"
            data-tip={`Рассудок: ${engine.sanity()}/${engine.sanityMax()}.\nПотери и исцеление — по ходу кампании; на низком уровне возможны последствия.`}
          >
            Рассудок {engine.sanity()}
          </div>
        )}
        {engine.fatigueMax() > 0 && (
          <div
            className={`hud-bar need ${engine.fatigue() <= 0 ? 'critical' : ''}`}
            data-tip={`Усталость: ${engine.fatigue()}/${engine.fatigueMax()}.\nТраты — от бега, тяжёлого труда, бессонницы; на нуле — последствия по правилам кампании.\nВосстанавливается на отдыхе.`}
          >
            <div className="hud-bar-fill" style={{ width: `${(engine.fatigue() / engine.fatigueMax()) * 100}%` }} />
            <span>Усталость {engine.fatigue()}</span>
          </div>
        )}
        {needsOn && meta.needs.map((n) => {
          const val = s.player.needs[n.id] ?? 0
          const critical = val <= n.critical_threshold
          const tip = n.description ? `${n.label}: ${n.description}` : n.label
          const displayLabel = n.short_label ?? n.label
          return (
            <div key={n.id} className={`hud-bar need ${critical ? 'critical' : ''}`} data-tip={tip} aria-label={`${n.label}: ${Math.round(val)}`}>
              <div className="hud-bar-fill" style={{ width: `${(val / n.max) * 100}%` }} />
              <span className="hud-bar-text">
                <span className="hud-need-label">{displayLabel}</span>
                <b className="hud-need-value">{Math.round(val)}</b>
              </span>
            </div>
          )
        })}
        {engine.stealthEnabled() && (
          <button
            className={`hud-stealth-toggle stealth-${engine.isDetected() ? 'detected' : engine.isSneaking() ? 'sneaking' : 'open'}`}
            data-tip={`Скрытность: крадущееся передвижение.\nВаш навык: ${engine.playerSkill('stealth')}.\nПри смене сцены — автоматическая проверка против лучшей внимательности NPC.\nБой из скрытности: первый раунд за вами!`}
            onClick={() => engine.toggleSneak()}
            role="button"
            aria-label={`Скрытность: ${engine.isSneaking() ? (engine.isDetected() ? 'Замечен!' : 'Крадётесь') : 'Открыто'}`}
          >
            {engine.isSneaking() ? (engine.isDetected() ? 'Замечен!' : 'Крадётесь') : 'Открыто'}
          </button>
        )}
        {(s.player.statuses ?? []).map((st) => {
          const def = engine.statusDef(st.id)
          if (!def) return null
          const displayLabel = def.short_label ?? def.label
          return (
            <div key={st.id} className="hud-status-chip" data-tip={`${def.label} — осталось ${st.left} ${meta.tick_label}${def.description ? `. ${def.description}` : ''}`}>
              {def.icon ? (
                <img className="hud-status-icon" src={assetUrl(engine.campaign, def.icon)} alt="" />
              ) : (
                displayLabel
              )}
              <span className="hud-status-left">{st.left}</span>
            </div>
          )
        })}
      </div>
      <div className="hud-center">
        {timeOn && (
          <>
            <div className="hud-time">{formatTime(s.tick, meta)}</div>
            <div className={`hud-tod tod-${tod}`}>{TIME_OF_DAY_LABEL[tod]}</div>
            {meta.calendar && <div className="hud-date">{formatDate(meta, s.tick)}</div>}
            {(() => {
              const w = meta.weathers?.find((x) => x.id === s.weather)
              return w ? <div className="hud-weather">{w.label}</div> : null
            })()}
            {meta.deadline_ticks !== undefined && meta.deadline_ticks > 0 && (() => {
              const start = meta.starting_tick ?? 0
              const elapsed = s.tick - start
              const left = Math.max(0, meta.deadline_ticks - elapsed)
              const unit = meta.tick_label || 'ч'
              const urgent = left <= (meta.ticks_per_day || 24)
              const expired = left === 0
              return (
                <div
                  className={`hud-deadline ${urgent ? 'hud-deadline-urgent' : ''} ${expired ? 'hud-deadline-expired' : ''}`}
                  data-tip={`${meta.deadline_label || 'Дедлайн'}: прошло ${elapsed} из ${meta.deadline_ticks} ${unit}`}
                >
                  <Ico n="clock" /> {meta.deadline_label ? `${meta.deadline_label}: ` : ''}{expired ? 'Срок истёк!' : `${left} ${unit}`}
                </div>
              )
            })()}
          </>
        )}
      </div>
      <div className="hud-right">
        {featureOn(meta, 'map') && (
          <button className="hud-btn" onClick={onOpenMap} data-tip={engine.uiLabel('map_tip', 'Карта')}>
            <Ico n="map" />  {engine.uiLabel('map', 'Карта')}
          </button>
        )}
        {featureOn(meta, 'inventory') && (
          <button className="hud-btn" onClick={onOpenInventory} data-tip={engine.uiLabel('inventory_tip', 'Инвентарь')}>
            <Ico n="bag" />  {engine.uiLabel('inventory_btn', engine.uiLabel('inventory', 'Вещи'))}
          </button>
        )}
        {featureOn(meta, 'inventory') && engine.knownRecipes().length > 0 && (
          <button className="hud-btn" onClick={onOpenCraft} data-tip={engine.uiLabel('craft_tip', 'Изготовление предметов по рецептам')}>
            <Ico n="hammer" />  {engine.uiLabel('craft', 'Крафт')}
          </button>
        )}
        <button className="hud-btn" onClick={onOpenCharacter} data-tip={engine.uiLabel('character_tip', 'Лист персонажа')}>
          <Ico n="user" />  {engine.uiLabel('character', 'Герой')}
        </button>
        <button className="hud-btn" onClick={onOpenLog} data-tip={engine.uiLabel('journal_tip', 'Журнал')}>
          <Ico n="scroll" />  {engine.uiLabel('journal', 'Журнал')}
        </button>
        {engine.metaProgressEnabled() && onOpenMeta && (
          <button className="hud-btn" onClick={onOpenMeta} data-tip="Хроника: достижения, метавалюта и постоянные усиления между забегами">
            <Ico n="star" />  {engine.uiLabel('meta', 'Хроника')}
          </button>
        )}
        {engine.campAvailable().ok && (
          <button
            className="hud-btn"
            onClick={async () => {
              const ticks = engine.campaign.meta.camping?.ticks ?? 8
              const label = engine.campaign.meta.tick_label || 'ч'
              const ambush = (engine.campaign.meta.camping?.ambush_chance ?? 0) > 0 ? ' Возможна ночная засада!' : ''
              if (await askConfirm(`Разбить лагерь и отдохнуть?\nСон займёт ${ticks} ${label}.${ambush}`, 'Отдохнуть', 'Отмена')) {
                engine.campRest()
              }
            }}
            data-tip={`Разбить лагерь и переночевать (${engine.campaign.meta.camping?.ticks ?? 8} ${engine.campaign.meta.tick_label}): отдых лечит, навыки растут.${(engine.campaign.meta.camping?.ambush_chance ?? 0) > 0 ? ' Возможны ночные гости…' : ''}`}
          >
            <Ico n="flame" />  {engine.uiLabel('camp', 'Лагерь')}
          </button>
        )}
        {(s.codex_unlocked ?? []).length > 0 && (
          <button className="hud-btn" onClick={onOpenCodex} data-tip="Разблокированные записи о мире">
            <Ico n="book" />  {engine.uiLabel('codex', 'Кодекс')}
          </button>
        )}
        <button className="hud-btn" onClick={onOpenSaves} data-tip="Сохранения (слоты)" aria-label="Сохранения"><Ico n="download" /> </button>
        <button className="hud-btn" onClick={onOpenHelp} data-tip="Справка"><Ico n="help" /> </button>
        <button className="hud-btn" onClick={() => setShowSettings(true)} data-tip="Настройки (громкость, озвучка)"><Ico n="settings" /> </button>
        <button
          className="hud-btn"
          data-tip="Выйти в главное меню (прогресс сохранён)"
          onClick={async () => {
            if (await askConfirm('Выйти в главное меню?', 'Выйти')) {
              try {
                engine.autosave()
              } catch (err) {
                console.error('autosave on hud exit failed', err)
              }
              onExitToMenu()
            }
          }}
        >
          <Ico n="exit" />
        </button>
      </div>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
