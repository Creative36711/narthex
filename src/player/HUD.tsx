import { Ico } from '../shared/icons'
import { useState } from 'react'
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
  onOpenCraft: () => void
  onOpenCodex: () => void
  onOpenSaves: () => void
  onOpenHelp: () => void
  onExitToMenu: () => void
}

export function HUD({ engine, onOpenMap, onOpenInventory, onOpenCharacter, onOpenLog, onOpenCraft, onOpenCodex, onOpenSaves, onOpenHelp, onExitToMenu }: Props) {
  const s = engine.state
  const meta = engine.campaign.meta
  const tod = timeOfDay(s.tick, meta)
  const [showSettings, setShowSettings] = useState(false)
  const needsOn = featureOn(meta, 'needs')
  const timeOn = featureOn(meta, 'time')

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-bar hp" data-tip="Здоровье">
          <div className="hud-bar-fill" style={{ width: `${(s.player.hp / s.player.max_hp) * 100}%` }} />
          <span>HP {s.player.hp}/{s.player.max_hp}</span>
        </div>
        {engine.campaign.meta.luck && engine.luckMax() > 0 && (
          <div
            className="hud-status-chip"
            data-tip={`Удача: ${engine.luck()}/${engine.luckMax()} (POW × множитель).\nНа провальном броске вне боя можно потратить удачу и перебросить.\nВосстанавливается на отдыхе (если мастер не отключил).`}
          >
            Удача {engine.luck()}
          </div>
        )}
        {engine.fatigueMax() > 0 && (
          <div
            className={`hud-bar need ${engine.fatigue() <= 0 ? 'critical' : ''}`}
            data-tip={`Усталость: ${engine.fatigue()}/${engine.fatigueMax()} (= (STR+CON)×множитель).\nТраты задаёт мастер (бег, тяжёлый труд, бессонница); на нуле — правила кампании решают последствия.\nВосстанавливается на отдыхе (если мастер не отключил).`}
          >
            <div className="hud-bar-fill" style={{ width: `${(engine.fatigue() / engine.fatigueMax()) * 100}%` }} />
            <span>Усталость {engine.fatigue()}</span>
          </div>
        )}
        {engine.sanityMax() > 0 && (
          <div
            className="hud-status-chip"
            data-tip={`Рассудок: ${engine.sanity()}/${engine.sanityMax()} (POW × множитель).\nПотери и исцеление — эффектами мастера; пороги (может, помешательство) — правилами на sanity_le.`}
          >
            Рассудок {engine.sanity()}
          </div>
        )}
        {engine.reputationEnabled() && (
          <div
            className="hud-status-chip"
            data-tip={`${engine.reputationLabel()}: ${engine.reputation()}.\nМеняется деяниями героя (эффекты мастера change_reputation).`}
          >
            {engine.reputationLabel()} {engine.reputation()}
          </div>
        )}
        {engine.progressionEnabled() && (
          <div
            className="hud-status-chip"
            data-tip={`Уровень ${engine.level()} — опыт ${engine.xp()}${engine.xpToNext() != null ? ` (до след. уровня ${engine.xpToNext()})` : ' (потолок)'}.\nОпыт — эффектом grant_xp; за уровень — черта к выбору в листе персонажа.`}
          >
            Ур. {engine.level()}{engine.pendingFeats() > 0 ? ` (+${engine.pendingFeats()})` : ''}
          </div>
        )}
        {needsOn && meta.needs.map((n) => {
          const val = s.player.needs[n.id] ?? 0
          const critical = val <= n.critical_threshold
          return (
            <div key={n.id} className={`hud-bar need ${critical ? 'critical' : ''}`} data-tip={n.label}>
              <div className="hud-bar-fill" style={{ width: `${(val / n.max) * 100}%` }} />
              <span>
                {n.label} {Math.round(val)}
              </span>
            </div>
          )
        })}
        {engine.stealthEnabled() && (
          <button
            className="hud-status-chip"
            data-tip={'Скрытность: крадущееся передвижение.\nПри входе и смене сцены — проверка против внимателей.\nБой из скрытности начинается внезапно (первый раунд за вами).'}
            onClick={() => engine.toggleSneak()}
          >
            {engine.isSneaking() ? (engine.isDetected() ? 'Замечен!' : 'Крадётесь') : 'Открыто'}
          </button>
        )}
        {(s.player.statuses ?? []).map((st) => {
          const def = engine.statusDef(st.id)
          if (!def) return null
          return (
            <div key={st.id} className="hud-status-chip" data-tip={`${def.label} — осталось ${st.left} ${meta.tick_label}${def.description ? `. ${def.description}` : ''}`}>
              {def.icon ? (
                <img className="hud-status-icon" src={assetUrl(engine.campaign, def.icon)} alt="" />
              ) : (
                def.label
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
          </>
        )}
      </div>
      <div className="hud-right">
        {featureOn(meta, 'map') && (
          <button className="hud-btn" onClick={onOpenMap} data-tip="Карта"><Ico n="map" />  Карта</button>
        )}
        {featureOn(meta, 'inventory') && (
          <button className="hud-btn" onClick={onOpenInventory} data-tip="Инвентарь"><Ico n="bag" />  Вещи</button>
        )}
        {featureOn(meta, 'inventory') && Object.keys(engine.campaign.recipes).length > 0 && (
          <button className="hud-btn" onClick={onOpenCraft} data-tip="Изготовление предметов по рецептам">
            <Ico n="hammer" />  Крафт
          </button>
        )}
        <button className="hud-btn" onClick={onOpenCharacter} data-tip="Лист персонажа"><Ico n="user" />  Герой</button>
        <button className="hud-btn" onClick={onOpenLog} data-tip="Журнал"><Ico n="scroll" />  Журнал</button>
        {engine.campAvailable().ok && (
          <button className="hud-btn" onClick={() => engine.campRest()} data-tip={`Разбить лагерь и переночевать (${engine.campaign.meta.camping?.ticks ?? 8} ${engine.campaign.meta.tick_label}): отдых лечит, навыки растут.${(engine.campaign.meta.camping?.ambush_chance ?? 0) > 0 ? ' Возможны ночные гости…' : ''}`}>
            <Ico n="flame" />  Лагерь
          </button>
        )}
        <button className="hud-btn" onClick={onOpenSaves} data-tip="Сохранения (слоты)" aria-label="Сохранения"><Ico n="download" /> </button>
        {(s.codex_unlocked ?? []).length > 0 && (
          <button className="hud-btn" onClick={onOpenCodex} data-tip="Разблокированные записи о мире"><Ico n="book" />  Кодекс</button>
        )}
        <button className="hud-btn" onClick={onOpenHelp} data-tip="Справка"><Ico n="help" /> </button>
        <button className="hud-btn" onClick={() => setShowSettings(true)} data-tip="Настройки (громкость, озвучка)"><Ico n="settings" /> </button>
        <button
          className="hud-btn"
          data-tip="Выйти в главное меню (прогресс сохранён)"
          onClick={async () => {
            if (await askConfirm('Выйти в главное меню?', 'Выйти')) onExitToMenu()
          }}
        >
          <Ico n="exit" />
        </button>
      </div>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
