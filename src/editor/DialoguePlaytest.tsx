import { useEffect, useMemo, useRef, useState } from 'react'
import { GameEngine } from '../core/engine'
import { clearDialogueCache } from '../../packs/narrative/dialogue'
import type { CampaignData, DlgDoc, NpcDef } from '../shared/types'
import { profileClass, atmosphereOn } from '../shared/profiles'
import { themeVars } from '../shared/theme'
import { DialogueOverlay } from '../player/DialogueOverlay'
import { Ico } from '../shared/icons'
import type { EditorStore } from './store'
import { exportMonolith } from './monolith'
import { campaignFromMonolith } from './playtest'
import { META_COUNTERS, humanize } from './dlgScript'

/**
 * Собрать движок для проверки одного разговора: кампания берётся из текущего
 * состояния редактора (включая несохранённые правки), собеседник — тот, чей
 * это разговор, иначе временный персонаж.
 *
 * Отдельная функция — чтобы её можно было прогнать без интерфейса (смоук).
 */
export function buildDialoguePlaytest(
  store: EditorStore,
  path: string,
  previous?: GameEngine | null,
): { engine: GameEngine; npcId: string; campaign: CampaignData } {
  const { doc: mono } = exportMonolith(store)
  const camp = campaignFromMonolith(mono)
  camp.basePath = `/${store.campaignRel()}`.replace(/\/+/g, '/')
  camp.meta.id = `${camp.meta.id}__dlgplay`
  const owner = store.npcForDialogue(path)
  let id = owner?.id
  if (!id) {
    id = 'npc__preview'
    camp.entities[id] = {
      id,
      type: 'npc',
      label: 'Собеседник',
      dialogue: path,
      description: 'Временный персонаж для проверки разговора в редакторе.',
    } as NpcDef
  } else {
    camp.entities[id] = { ...camp.entities[id], dialogue: path } as NpcDef
  }
  const engine = new GameEngine(camp)
  if (previous) {
    // переносим правки мастера: флаги, предметы, навыки, отношения
    engine.state.flags = { ...previous.state.flags }
    engine.state.player.skills = { ...previous.state.player.skills }
    engine.state.dispositions = { ...previous.state.dispositions }
    for (const it of previous.state.player.inventory ?? []) engine.addItem(it.item, it.quantity ?? 1, { silent: true })
  }
  engine.start()
  engine.startDialogue(id)
  return { engine, npcId: id, campaign: camp }
}

/**
 * Проверка одного разговора прямо в редакторе (фидбек 29, п.3).
 *
 * Собираем кампанию из текущего состояния редактора (со всеми несохранёнными
 * правками), поднимаем настоящий движок и открываем разговор. Панель отладки
 * позволяет включить флаги, выдать предметы и поднять навыки, чтобы пройти
 * каждую ветку, не переигрывая всю кампанию.
 */
export function DialoguePlaytest({
  store,
  path,
  doc,
  onClose,
}: {
  store: EditorStore
  path: string
  doc: DlgDoc
  onClose: () => void
}) {
  const [, force] = useState(0)
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [npcId, setNpcId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const engineRef = useRef<GameEngine | null>(null)

  // что показывать в панели: то, что реально проверяет разговор
  const usedFlags = useMemo(() => {
    const ids = new Set<string>()
    const walk = (conds?: Array<{ type: string; flag?: string }>) => {
      for (const c of conds ?? []) if (c.type === 'flag' && c.flag) ids.add(c.flag)
    }
    for (const n of doc.nodes) {
      for (const s of n.sections) walk(s.conds)
      for (const c of n.choices) {
        walk(c.conds)
        for (const s of c.sections) walk(s.conds)
        for (const s of c.check?.success.sections ?? []) walk(s.conds)
        for (const s of c.check?.fail.sections ?? []) walk(s.conds)
      }
    }
    return [...ids]
  }, [doc])

  const usedItems = useMemo(() => {
    const ids = new Set<string>()
    for (const n of doc.nodes) {
      for (const c of n.choices) {
        for (const cond of c.conds ?? []) if (cond.type === 'has_item' || cond.type === 'item_ge') ids.add(cond.item)
        for (const s of c.sections) for (const st of s.steps) if (st.kind === 'effect' && (st.effect.type === 'add_item' || st.effect.type === 'remove_item')) ids.add(st.effect.item)
      }
      for (const s of n.sections) for (const st of s.steps) if (st.kind === 'effect' && (st.effect.type === 'add_item' || st.effect.type === 'remove_item')) ids.add(st.effect.item)
    }
    return [...ids]
  }, [doc])

  const usedSkills = useMemo(() => {
    const ids = new Set<string>()
    for (const n of doc.nodes) {
      for (const c of n.choices) {
        if (c.check) ids.add(c.check.skill)
        for (const cond of c.conds ?? []) if (cond.type === 'skill_ge') ids.add(cond.skill)
      }
      for (const s of n.sections) for (const cond of s.conds ?? []) if (cond.type === 'skill_ge') ids.add(cond.skill)
    }
    return [...ids]
  }, [doc])

  const start = (keepState = false) => {
    const previous = keepState ? engineRef.current : null
    clearDialogueCache()
    setError(null)
    try {
      const built = buildDialoguePlaytest(store, path, previous)
      engineRef.current = built.engine
      setCampaign(built.campaign)
      setEngine(built.engine)
      setNpcId(built.npcId)
      if (!built.engine.dialogue) {
        setError(built.engine.lastDialogueError || 'Разговор сразу завершился: проверьте первый узел и эффекты, которые закрывают диалог (торговля, правило, конец).')
      }
    } catch (err) {
      setError(`Не удалось собрать кампанию для проверки: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!engine) return
    return engine.subscribe(() => force((n) => n + 1))
  }, [engine])

  const restart = () => {
    if (!engine || !npcId) return
    engine.startDialogue(npcId)
    force((n) => n + 1)
  }

  const allFlags = useMemo(() => {
    const list = (store.meta.flags ?? []).map((f) => ({ id: f.id, label: f.label || humanize(f.id) }))
    for (const id of usedFlags) if (!list.some((f) => f.id === id)) list.push({ id, label: humanize(id) })
    return list.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [store, usedFlags])

  const allItems = useMemo(() => {
    const list = store.options('item')
    for (const id of usedItems) if (!list.some((i) => i.id === id)) list.push({ id, label: humanize(id) })
    return list
  }, [store, usedItems])

  const playThemeClass = campaign ? `cf-themed ${profileClass(campaign.meta)}${atmosphereOn(campaign.meta) ? '' : ' cf-atmos-off'}` : ''
  const playThemeStyle = campaign ? themeVars(campaign, 1) : undefined
  const have = (id: string) => !!engine?.hasItem(id)

  return (
    <div className="dlg-playtest">
      <div className="dlg-playtest-bar">
        <b>Проверка разговора</b>
        <span className="muted small">{doc.label ?? store.dialogueLabel(path)}</span>
        <button className="btn btn-small" onClick={restart} data-tip="Начать разговор с начала с текущими флагами и предметами">
          <Ico n="play" /> Заново
        </button>
        <button className="btn btn-small" onClick={() => start(false)} data-tip="Собрать кампанию заново: подхватит правки форм, сценария и реестров">
          <Ico n="sparkle" /> Пересобрать
        </button>
        <button className={`btn btn-small ${panel ? 'btn-primary' : ''}`} onClick={() => setPanel((v) => !v)}>
          <Ico n="settings" /> Что проверить
        </button>
        <button className="btn btn-small" onClick={onClose}>
          <Ico n="close" /> Вернуться в редактор
        </button>
      </div>

      {error && <div className="dlg-playtest-error">{error}</div>}

      <div className="dlg-playtest-stage">
        {engine && campaign ? (
          <div className={playThemeClass} style={playThemeStyle}>
            <DialogueOverlay engine={engine} />
          </div>
        ) : (
          <div className="muted" style={{ padding: 24 }}>Собираю разговор…</div>
        )}
      </div>

      {panel && engine && (
        <div className="dlg-playtest-panel">
          <div className="props-group">
            <h4>Флаги разговора</h4>
            <div className="dlg-playtest-scroll">
              {allFlags.map((f) => (
                <label key={f.id} className="fld-check small" style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!engine.state.flags[f.id]}
                    onChange={(e) => {
                      engine.state.flags[f.id] = e.target.checked
                      restart()
                    }}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
              {!allFlags.length && <div className="muted small">В кампании ещё нет флагов.</div>}
            </div>
          </div>

          <div className="props-group">
            <h4>Предметы</h4>
            <div className="dlg-playtest-scroll">
              {allItems.map((it) => (
                <label key={it.id} className="fld-check small" style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={have(it.id)}
                    onChange={(e) => {
                      if (e.target.checked) engine.addItem(it.id, 1, { silent: true })
                      else engine.removeItem(it.id, 1, { silent: true })
                      restart()
                    }}
                  />
                  <span>{it.label}</span>
                </label>
              ))}
            </div>
          </div>

          {usedSkills.length > 0 && (
            <div className="props-group">
              <h4>Навыки героя</h4>
              {usedSkills.map((s) => (
                <label key={s} className="fld fld-num">
                  <span>{store.labelFor('skill', s)}</span>
                  <input
                    type="number"
                    min={0}
                    value={engine.state.player.skills[s] ?? 0}
                    onChange={(e) => {
                      engine.state.player.skills[s] = Math.max(0, Number(e.target.value) || 0)
                      restart()
                    }}
                  />
                </label>
              ))}
            </div>
          )}

          {npcId && (
            <div className="props-group">
              <h4>Как относится собеседник</h4>
              <div className="fld-row">
                <button className="btn btn-small" onClick={() => { engine.changeDisposition(npcId, -10); restart() }}>−10</button>
                <span className="dlg-playtest-mood">{engine.state.dispositions[npcId] ?? 0}</span>
                <button className="btn btn-small" onClick={() => { engine.changeDisposition(npcId, 10); restart() }}>+10</button>
              </div>
            </div>
          )}

          <div className="muted small">
            Правки панели действуют сразу: разговор начинается заново с новыми условиями.
            Счётчики хроники ({META_COUNTERS.map((c) => c.label.toLowerCase()).slice(0, 3).join(', ')}…) в проверке не меняются —
            они копятся между забегами.
          </div>
        </div>
      )}
    </div>
  )
}
