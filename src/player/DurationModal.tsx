import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { formatTime } from '../core/time'

type DurationInfo = NonNullable<ReturnType<GameEngine['durationRequestInfo']>>

/**
 * Окно выбора длительного действия (dz.20): сон N часов, медитация, дежурство.
 * Рисуется, когда движок выставил engine.durationRequest (лагерь из HUD или
 * эффект start_duration_action из диалога/правила/interact_options).
 *
 * Честность — как в аудитах кампании: прогноз строится по данным движка
 * (per_tick × N и естественный тик потребностей), вероятность прерывания
 * показана накопленной за выбранные часы: 1 − (1−p)ⁿ.
 */
export function DurationModal({ engine }: { engine: GameEngine }) {
  const info = engine.durationRequestInfo()
  if (!info) return null
  // ключ-смена запроса = чистый выбор (без setState-в-эффекте)
  return <DurationDialog key={`${info.label}:${info.min}:${info.max}:${info.startTick}`} engine={engine} info={info} />
}

function DurationDialog({ engine, info }: { engine: GameEngine; info: DurationInfo }) {
  const [ticks, setTicks] = useState<number>(info.min)
  const meta = engine.campaign.meta
  const chosen = ticks
  const clamped = Math.min(info.max, Math.max(info.min, chosen))
  const tickLabel = meta.tick_label || 'ч'
  const range = info.max - info.min

  // эффекты действия (per_tick), выписанные построчно
  const effectLines: string[] = []
  for (const fx of info.perTick ?? []) {
    if (fx.type === 'change_need') {
      const need = meta.needs?.find((n) => n.id === fx.need)
      effectLines.push(`${need?.label ?? fx.need}: ${fx.delta > 0 ? '+' : ''}${fx.delta}/${tickLabel} × ${clamped} = ${fx.delta > 0 ? '+' : ''}${fx.delta * clamped}`)
    } else if (fx.type === 'change_hp') {
      effectLines.push(`ХП: ${fx.delta > 0 ? '+' : ''}${fx.delta}/${tickLabel} × ${clamped} = ${fx.delta > 0 ? '+' : ''}${fx.delta * clamped}`)
    } else if (fx.type === 'change_fatigue') {
      effectLines.push(`Усталость: ${fx.delta > 0 ? '+' : ''}${fx.delta}/${tickLabel} × ${clamped} = ${fx.delta > 0 ? '+' : ''}${fx.delta * clamped}`)
    } else if (fx.type === 'change_sanity') {
      effectLines.push(`Рассудок: ${fx.delta > 0 ? '+' : ''}${fx.delta}/${tickLabel} × ${clamped} = ${fx.delta > 0 ? '+' : ''}${fx.delta * clamped}`)
    } else {
      effectLines.push(`Эффект «${fx.type}» не входит в белый список — движок его пропустит`)
    }
  }
  // естественный расход потребностей за время (что отдых не отменяет)
  const decayLines: string[] = []
  if (meta.needs) {
    for (const n of meta.needs) {
      const d = (n as { decay_per_tick?: number }).decay_per_tick ?? 0
      if (d) decayLines.push(`${n.label}: ${d > 0 ? '−' : '+'}${Math.abs(d)}/${tickLabel}`)
    }
  }
  // вероятность прерывания за выбранные часы
  const p = info.interruptChance
  const cum = p > 0 ? 1 - Math.pow(1 - p, clamped) : 0

  return (
    <div className="modal-overlay" onClick={() => engine.cancelDurationRequest()}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{info.label}</div>
        <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
          <div>
            Длительность: <b>{clamped} {tickLabel}</b>
            {range > 0 && (
              <input
                type="range"
                min={info.min}
                max={info.max}
                step={info.step}
                value={clamped}
                onChange={(e) => setTicks(Number(e.target.value))}
                style={{ display: 'block', width: '100%', marginTop: 6 }}
                aria-label="Длительность действия"
              />
            )}
            <div style={{ opacity: 0.75, fontSize: '0.85em' }}>
              с {formatTime(info.startTick, meta)} → до {formatTime(info.startTick + clamped, meta)}
            </div>
          </div>
          {effectLines.length > 0 && (
            <div>
              <div style={{ fontSize: '0.85em', opacity: 0.75 }}>Эффект действия:</div>
              {effectLines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
          {decayLines.length > 0 && (
            <div style={{ opacity: 0.8, fontSize: '0.85em' }}>
              Естественный расход за это время: {decayLines.join('; ')}.
            </div>
          )}
          {cum > 0 && (
            <div style={{ color: 'var(--danger, #e07070)', fontSize: '0.9em' }}>
              Действие может прерваться: вероятность за {clamped} {tickLabel} ≈ {Math.round(cum * 100)}%.
            </div>
          )}
          <div className="modal-buttons" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => engine.confirmDurationRequest(clamped)}>Начать</button>
            <button className="btn" onClick={() => engine.cancelDurationRequest()}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  )
}
