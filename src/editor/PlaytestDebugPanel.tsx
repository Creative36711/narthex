import { useEffect, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { derivedHP, derivedMP } from '../core/brp'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="pt-debug-section" open><summary>{label}</summary><div>{children}</div></details>
}

function contentFlags(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => contentFlags(v, out))
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string' && /^(flag|not_flag|set_flag|toggle_flag|clear_flag)$/.test(key) && v) out.add(v)
    else contentFlags(v, out)
  }
  return out
}

/** Читы доступны только внутри редакторского плейтеста. */
export function PlaytestDebugPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const startPlace = engine.findLocation(engine.state.location)
  const [region, setRegion] = useState(startPlace?.region.id ?? engine.campaign.world.regions[0]?.id ?? '')
  const [location, setLocation] = useState(engine.state.location)
  const [scene, setScene] = useState(engine.state.scene)
  const [flag, setFlag] = useState('')
  const [variable, setVariable] = useState('')
  const [value, setValue] = useState('0')
  const [item, setItem] = useState('')
  const [currency, setCurrency] = useState(engine.campaign.meta.currencies[0]?.id ?? '')
  const [amount, setAmount] = useState(1)
  const [skill, setSkill] = useState(Object.keys(engine.state.player.skills)[0] ?? '')
  const [stat, setStat] = useState(Object.keys(engine.state.player.stats)[0] ?? 'STR')
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const mutate = (fn: () => void) => { fn(); engine.notify(); engine.autosave() }
  const allRegions = engine.campaign.world.regions
  const selectedRegion = allRegions.find((r) => r.id === region)
  const allLocations = selectedRegion?.locations ?? []
  const locationScenes = Object.values(engine.campaign.scenes).filter((s) => s.location === location)
  const allFlags = [...new Set([...Object.keys(engine.state.flags), ...(engine.campaign.meta.flags ?? []).map((f) => f.id), ...contentFlags(engine.campaign)])]
  const quests = Object.entries(engine.campaign.quests)
  const entries = Object.values(engine.campaign.codex)
  return <aside className="pt-debug-panel" role="dialog" aria-label="Панель отладки">
    <header><b>Отладка</b><button className="btn btn-small" onClick={onClose}>Закрыть</button></header>
    <Section label="Переход к сцене">
      <select value={region} onChange={(e) => { const next = allRegions.find((r) => r.id === e.target.value); setRegion(e.target.value); const loc = next?.locations[0]; if (loc) { setLocation(loc.id); setScene(Object.values(engine.campaign.scenes).find((s) => s.location === loc.id)?.id ?? '') } }}>
        {allRegions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <select value={location} onChange={(e) => { setLocation(e.target.value); setScene(Object.values(engine.campaign.scenes).find((s) => s.location === e.target.value)?.id ?? '') }}>
        {allLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
      <select value={scene} onChange={(e) => setScene(e.target.value)}>{locationScenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <button className="btn btn-small" disabled={!scene} onClick={() => mutate(() => engine.goToScene(scene))}>Перейти</button>
    </Section>
    <Section label="Флаги">
      <input list="pt-flags" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="Выберите или введите флаг" />
      <datalist id="pt-flags">{allFlags.map((f) => <option key={f} value={f} />)}</datalist>
      <button className="btn btn-small" disabled={!flag} onClick={() => mutate(() => { engine.state.flags[flag] = true })}>Включить</button>
      <button className="btn btn-small" disabled={!flag} onClick={() => mutate(() => { delete engine.state.flags[flag] })}>Снять</button>
    </Section>
    <Section label="Переменные">
      {Object.entries(engine.state.variables).map(([k, v]) => <div className="pt-debug-row" key={k}><span>{k}: {String(v)}</span><button className="btn btn-small" onClick={() => { setVariable(k); setValue(String(v)) }}>Изменить</button></div>)}
      <div className="pt-debug-row"><input value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="Имя переменной" /><input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Значение" /></div>
      <button className="btn btn-small" disabled={!variable} onClick={() => mutate(() => { const n = Number(value); engine.state.variables[variable] = value.trim() !== '' && Number.isFinite(n) ? n : value })}>Задать</button>
    </Section>
    <Section label="Предметы и валюта">
      <select value={item} onChange={(e) => setItem(e.target.value)}><option value="">Предмет…</option>{Object.values(engine.campaign.entities).filter((e) => e.type === 'item').map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
      <button className="btn btn-small" disabled={!item} onClick={() => mutate(() => engine.addItem(item, Math.max(1, amount)))}>Выдать</button>
      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Количество" />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{engine.campaign.meta.currencies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <button className="btn btn-small" onClick={() => mutate(() => { engine.state.player.currencies[currency] = (engine.state.player.currencies[currency] ?? 0) + amount })}>Добавить валюту</button>
    </Section>
    <Section label="Герой">
      <button className="btn btn-small" onClick={() => mutate(() => { engine.state.player.hp = engine.state.player.max_hp; engine.state.player.mp = engine.state.player.max_mp; for (const n of engine.campaign.meta.needs) engine.state.player.needs[n.id] = n.max })}>Вылечить и восстановить потребности</button>
      <label className="fld-check small"><input type="checkbox" checked={engine.debugInvincible} onChange={(e) => mutate(() => { engine.debugInvincible = e.target.checked })} /><span>Бессмертие</span></label>
      <select value={skill} onChange={(e) => setSkill(e.target.value)}>{Object.keys(engine.state.player.skills).map((s) => <option key={s} value={s}>{engine.campaign.meta.skills?.find((x) => x.id === s)?.label ?? s}</option>)}</select>
      <input type="number" min="0" max="100" value={engine.state.player.skills[skill] ?? 0} onChange={(e) => mutate(() => { engine.state.player.skills[skill] = Number(e.target.value) })} aria-label="Значение навыка" />
      <select value={stat} onChange={(e) => setStat(e.target.value)}>{Object.keys(engine.state.player.stats).map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <input type="number" value={engine.state.player.stats[stat as keyof typeof engine.state.player.stats] ?? 0} onChange={(e) => mutate(() => {
        const stats = engine.state.player.stats
        stats[stat as keyof typeof stats] = Number(e.target.value)
        if (stat === 'CON' || stat === 'SIZ') { const max = derivedHP(stats); engine.state.player.max_hp = max; engine.state.player.hp = Math.min(engine.state.player.hp, max) }
        if (stat === 'POW') { const max = derivedMP(stats); engine.state.player.max_mp = max; engine.state.player.mp = Math.min(engine.state.player.mp, max) }
      })} aria-label="Значение характеристики" />
    </Section>
    <Section label="Бой">
      {engine.combat ? <>
        <button className="btn btn-small" disabled={!!engine.combat.result} onClick={() => mutate(() => {
          const combat = engine.combat!
          for (const c of combat.combatants) if (c.side === 'enemy') { c.hp = 0; c.dead = true; engine.state.dead_entities.push(c.entityId) }
          combat.result = 'victory'
          engine.onCombatVictory(combat.def.on_victory ?? [])
        })}>Мгновенная победа</button>
        <button className="btn btn-small" disabled={!!engine.combat.result} onClick={() => mutate(() => { engine.combat!.result = 'defeat'; engine.gameOver('death', 'Поражение в режиме отладки.') })}>Мгновенное поражение</button>
      </> : <span className="muted small">Сейчас бой не идёт.</span>}
    </Section>
    <Section label="Время и погода">
      <button className="btn btn-small" onClick={() => mutate(() => engine.advanceTicks(1))}>+1 тик</button>
      <button className="btn btn-small" onClick={() => mutate(() => engine.advanceTicks(engine.campaign.meta.ticks_per_day))}>+1 день</button>
      <select value={engine.state.weather ?? ''} onChange={(e) => mutate(() => { engine.state.weather = e.target.value || undefined })}><option value="">Ясно</option>{(engine.campaign.meta.weathers ?? []).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
      {(['morning', 'day', 'evening', 'night'] as const).map((period) => <button key={period} className="btn btn-small" onClick={() => mutate(() => {
        const clock = engine.campaign.meta.time_of_day ?? { morning: 6, day: 10, evening: 18, night: 22 }
        const hour = clock[period]
        const baseTick = Math.floor(engine.state.tick / engine.campaign.meta.ticks_per_day) * engine.campaign.meta.ticks_per_day
        engine.state.tick = baseTick + hour
      })}>{{ morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь' }[period]}</button>)}
    </Section>
    <Section label="Квесты">
      {quests.map(([id, q]) => <div className="pt-debug-row" key={id}><label>{q.label}<select defaultValue={engine.state.quests[id]?.stage ?? ''} onChange={(e) => mutate(() => engine.advanceQuestTo(id, e.target.value))}><option value="">Стадия…</option>{q.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>)}
    </Section>
    <Section label="Кодекс">
      {entries.map((e) => <button key={e.id} className="btn btn-small" disabled={(engine.state.codex_unlocked ?? []).includes(e.id)} onClick={() => mutate(() => engine.unlockCodex(e.id))}>{e.label}</button>)}
    </Section>
  </aside>
}
