import { useEffect, useState } from 'react'
import { Ico } from '../shared/icons'
import type { GameEngine } from '../core/engine'
import type { ItemDef } from '../shared/types'
import { derivedHP, derivedMP } from '../core/brp'
import { FlagAutocomplete } from './FlagAutocomplete'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="pt-debug-section" open><summary>{label}</summary><div>{children}</div></details>
}

const STAT_LABELS: Record<string, string> = {
  STR: 'Сила',
  CON: 'Выносливость',
  SIZ: 'Размер',
  DEX: 'Ловкость',
  INT: 'Интеллект',
  POW: 'Сила воли',
  CHA: 'Обаяние',
}

const EMOTION_RU: Record<string, string> = {
  neutral: 'Обычный',
  angry: 'Гнев',
  happy: 'Радость',
  sad: 'Грусть',
  fear: 'Страх',
  scared: 'Испуг',
  surprise: 'Удивление',
  shock: 'Шок',
  wounded: 'Ранен',
  hurt: 'Боль',
  tired: 'Усталость',
  down: 'Без сознания',
  dead: 'Мёртв',
  thinking: 'Раздумье',
  smile: 'Улыбка',
  disgust: 'Отвращение',
}

function getEmotionRuLabel(engine: GameEngine, key: string): string {
  if (!key) return 'Обычный'
  const fromMeta = engine.campaign.meta.emotions?.find((e) => e.id === key)?.label
  if (fromMeta) return fromMeta
  if (EMOTION_RU[key.toLowerCase()]) return EMOTION_RU[key.toLowerCase()]
  return key
}

function contentFlags(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => contentFlags(v, out))
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string' && /^(flag|not_flag|set_flag|toggle_flag|clear_flag)$/.test(key) && v) out.add(v)
    else contentFlags(v, out)
  }
  return out
}

function contentVariables(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((entry) => contentVariables(entry, out))
  else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) {
    if (key === 'var' && typeof entry === 'string' && entry) out.add(entry)
    else contentVariables(entry, out)
  }
  return out
}

import {
  getPlaytestNotes,
  savePlaytestNote,
  updatePlaytestNote,
  deletePlaytestNote,
  clearPlaytestNotes,
  shouldAutoClearNotes,
  setAutoClearNotes,
  formatPlaytestNotesSummary,
  type PlaytestNote,
} from './playtestNotes'

interface PlaytestDebugPanelProps {
  engine: GameEngine
  onClose: () => void
  notes?: string
  onSaveNotes?: (notes: string) => void
}

/** Читы доступны только внутри редакторского плейтеста. */
export function PlaytestDebugPanel({ engine, onClose, notes: _notes = '', onSaveNotes }: PlaytestDebugPanelProps) {
  const [noteList, setNoteList] = useState<PlaytestNote[]>(() => getPlaytestNotes(engine.campaign.meta.id))
  const [newNoteText, setNewNoteText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [autoClear, setAutoClear] = useState<boolean>(shouldAutoClearNotes)

  const syncNotesToAudit = (updated: PlaytestNote[]) => {
    setNoteList(updated)
    const summary = formatPlaytestNotesSummary(updated)
    if (onSaveNotes) onSaveNotes(summary)
  }

  const handleAddNote = () => {
    if (!newNoteText.trim()) return
    const currentScene = engine.campaign.scenes[engine.state.scene]
    savePlaytestNote(
      {
        sceneId: engine.state.scene,
        sceneLabel: currentScene?.label ?? engine.state.scene,
        text: newNoteText,
      },
      engine.campaign.meta.id,
    )
    const updated = getPlaytestNotes(engine.campaign.meta.id)
    syncNotesToAudit(updated)
    setNewNoteText('')
    setFeedback({ text: 'Заметка добавлена в журнал мастера.', serial: feedbackSerial + 1 })
  }

  const handleDeleteNote = (id: string) => {
    deletePlaytestNote(id, engine.campaign.meta.id)
    const updated = getPlaytestNotes(engine.campaign.meta.id)
    syncNotesToAudit(updated)
    setFeedback({ text: 'Заметка удалена.', serial: feedbackSerial + 1 })
  }

  const handleSaveEdit = (id: string) => {
    updatePlaytestNote(id, editingText, engine.campaign.meta.id)
    const updated = getPlaytestNotes(engine.campaign.meta.id)
    syncNotesToAudit(updated)
    setEditingId(null)
    setEditingText('')
    setFeedback({ text: 'Текст заметки обновлён.', serial: feedbackSerial + 1 })
  }

  const handleClearAllNotes = () => {
    if (!window.confirm('Очистить все заметки этого плейтеста?')) return
    clearPlaytestNotes(engine.campaign.meta.id)
    syncNotesToAudit([])
    setFeedback({ text: 'Все заметки плейтеста очищены.', serial: feedbackSerial + 1 })
  }

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
  const [feedback, setFeedback] = useState<{ text: string; serial: number } | null>(null)
  const [feedbackSerial, setFeedbackSerial] = useState(0)
  const [, refresh] = useState(0)
  useEffect(() => {
    const sc = engine.campaign.scenes[engine.state.scene]
    const occs = sc ? engine.slotOccupants(sc) : []
    console.log('[CF:Debug] PlaytestDebugPanel открыта. Текущая сцена:', engine.state.scene, {
      entities: occs.map(o => ({
        slot: o.slot.id,
        entity: o.entity?.id,
        label: o.entity?.label,
        type: o.entity?.type,
        desc: o.entity ? engine.descOf(o.entity.id) : null,
      }))
    })
    const unsubscribe = engine.subscribe(() => refresh((n) => n + 1))
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { unsubscribe(); window.removeEventListener('keydown', onKey) }
  }, [engine, onClose])
  const mutate = (fn: () => void, message: string | (() => string) = 'Отладочное действие выполнено.') => {
    fn()
    engine.notify()
    engine.autosave()
    const serial = feedbackSerial + 1
    setFeedbackSerial(serial)
    setFeedback({ text: typeof message === 'function' ? message() : message, serial })
  }
  const allRegions = engine.campaign.world.regions
  const selectedRegion = allRegions.find((r) => r.id === region)
  const allLocations = selectedRegion?.locations ?? []
  const locationScenes = Object.values(engine.campaign.scenes).filter((s) => s.location === location)
  const currentSceneDef = engine.campaign.scenes[engine.state.scene]
  const currentOccupants = currentSceneDef ? engine.slotOccupants(currentSceneDef) : []
  const sceneEntities = currentOccupants.filter((o) => o.entity != null)
  const flagOptions = new Map((engine.campaign.meta.flags ?? []).map((f) => [f.id, {
    id: f.id,
    label: f.label || f.id,
    active: !!engine.state.flags[f.id],
  }]))
  for (const id of [...Object.keys(engine.state.flags), ...contentFlags(engine.campaign)]) {
    if (!flagOptions.has(id)) flagOptions.set(id, { id, label: id, active: !!engine.state.flags[id] })
  }
  const allFlags = [...flagOptions.values()]
  const selectedFlag = allFlags.find((f) => f.id === flag || f.label.localeCompare(flag, 'ru-RU', { sensitivity: 'base' }) === 0)
  const selectedFlagId = selectedFlag?.id ?? flag
  const selectedFlagActive = !!engine.state.flags[selectedFlagId]
  const variableNames = [...new Set([...Object.keys(engine.state.variables), ...contentVariables(engine.campaign)])].sort((a, b) => a.localeCompare(b, 'ru-RU'))
  const quests = Object.entries(engine.campaign.quests)
  const entries = Object.values(engine.campaign.codex)
  return <aside className="pt-debug-panel" role="dialog" aria-label="Панель отладки">
    <header><b>Отладка</b><button className="btn btn-small" onClick={onClose}>Закрыть</button></header>
    {feedback && <div key={feedback.serial} className="pt-debug-feedback" role="status" aria-live="polite">{feedback.text}</div>}
    <Section label={`Журнал правок мастера (${noteList.length})`}>
      <p className="pt-debug-help">
        Заметки привязываются к текущей сцене и автоматически упаковываются в раздел «Заметки мастера из плейтеста» пакета задания для ИИ.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        <textarea
          style={{ width: '100%', minHeight: 56, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem', padding: 6 }}
          value={newNoteText}
          placeholder={`Заметка для текущей сцены (${currentSceneDef?.label ?? engine.state.scene}): что проверить или исправить…`}
          onChange={(e) => setNewNoteText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              handleAddNote()
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-small btn-primary"
            disabled={!newNoteText.trim()}
            onClick={handleAddNote}
          >
            + Добавить заметку
          </button>
          {noteList.length > 0 && (
            <button className="btn btn-small" onClick={handleClearAllNotes}>
              Очистить всё
            </button>
          )}
        </div>
      </div>

      {noteList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {noteList.map((n) => (
            <div
              key={n.id}
              style={{
                padding: 6,
                borderRadius: 4,
                background: 'var(--panel-2, rgba(0,0,0,0.15))',
                border: '1px solid var(--border-soft, #444)',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--gold-bright, #d4a359)' }}>
                  {n.sceneLabel ?? n.sceneId ?? 'Сцена'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-small"
                    style={{ padding: '1px 5px', fontSize: '11px' }}
                    onClick={() => {
                      if (editingId === n.id) {
                        setEditingId(null)
                      } else {
                        setEditingId(n.id)
                        setEditingText(n.text)
                      }
                    }}
                  >
                    {editingId === n.id ? 'Отмена' : 'Правка'}
                  </button>
                  <button
                    className="btn btn-small ce-del"
                    style={{ padding: '1px 5px', fontSize: '11px' }}
                    onClick={() => handleDeleteNote(n.id)}
                    data-tip="Удалить эту заметку"
                  >
                    <Ico n="close" />
                  </button>
                </div>
              </div>
              {editingId === n.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <textarea
                    style={{ width: '100%', minHeight: 48, fontSize: '0.82rem', padding: 4 }}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                  />
                  <button
                    className="btn btn-small btn-primary"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={() => handleSaveEdit(n.id)}
                  >
                    Сохранить
                  </button>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{n.text}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.8rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={autoClear}
          onChange={(e) => {
            setAutoClear(e.target.checked)
            setAutoClearNotes(e.target.checked)
          }}
        />
        <span>Очищать заметки после скачивания задания ИИ</span>
      </label>
    </Section>
    <Section label="Переход к сцене">
      <select value={region} onChange={(e) => { const next = allRegions.find((r) => r.id === e.target.value); setRegion(e.target.value); const loc = next?.locations[0]; if (loc) { setLocation(loc.id); setScene(Object.values(engine.campaign.scenes).find((s) => s.location === loc.id)?.id ?? '') } }}>
        {allRegions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <select value={location} onChange={(e) => { setLocation(e.target.value); setScene(Object.values(engine.campaign.scenes).find((s) => s.location === e.target.value)?.id ?? '') }}>
        {allLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
      <select value={scene} onChange={(e) => setScene(e.target.value)}>{locationScenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <button className="btn btn-small" disabled={!scene} onClick={() => mutate(() => engine.goToScene(scene), `Переход выполнен: ${engine.campaign.scenes[scene]?.label ?? scene}.`)}>Перейти</button>
    </Section>
    <Section label="Флаги">
      <FlagAutocomplete value={flag} flags={allFlags} onChange={setFlag} />
      <div className="pt-debug-flag-status" aria-live="polite">
        {selectedFlag ? <>
          <span>{selectedFlag.label}</span>
          <strong className={selectedFlagActive ? 'is-on' : 'is-off'}>{selectedFlagActive ? 'Включён' : 'Выключен'}</strong>
        </> : <span className="muted small">Выберите флаг, чтобы увидеть его состояние.</span>}
      </div>
      <button className="btn btn-small" disabled={!flag.trim() || selectedFlagActive} onClick={() => mutate(() => { engine.state.flags[selectedFlagId] = true }, `Флаг «${selectedFlag?.label ?? selectedFlagId}» включён.`)}>Включить</button>
      <button className="btn btn-small" disabled={!flag.trim() || !selectedFlagActive} onClick={() => mutate(() => { delete engine.state.flags[selectedFlagId] }, `Флаг «${selectedFlag?.label ?? selectedFlagId}» снят.`)}>Снять</button>
    </Section>
    <Section label="Переменные">
      <p className="pt-debug-help">
        Переменные — значения, которые сценарии и правила кампании проверяют или меняют. Используйте имя из правила; новая переменная сама по себе ничего не меняет, пока контент её не читает. Числовые значения подходят для сравнений и прибавления; текстовые — для сравнений «равно / не равно».
      </p>
      <div className="pt-debug-variable-list">
        {variableNames.length === 0 && <span className="muted small">Кампания пока не использует переменные.</span>}
        {variableNames.map((key) => {
          const isSet = Object.prototype.hasOwnProperty.call(engine.state.variables, key)
          const current = isSet ? engine.state.variables[key] : 0
          return <div className="pt-debug-row" key={key}>
            <span><b>{key}</b>: {isSet ? String(current) : '0 (по умолчанию)'}</span>
            <button className="btn btn-small" onClick={() => { setVariable(key); setValue(String(current)) }}>Изменить</button>
          </div>
        })}
      </div>
      <div className="pt-debug-row">
        <input value={variable} onChange={(e) => setVariable(e.target.value)} placeholder="Имя из правила кампании" aria-label="Имя переменной" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Число или текст" aria-label="Значение переменной" />
      </div>
      <button className="btn btn-small" disabled={!variable.trim()} onClick={() => mutate(() => { const key = variable.trim(); const n = Number(value); engine.state.variables[key] = value.trim() !== '' && Number.isFinite(n) ? n : value }, () => `Переменная «${variable.trim()}» задана: ${String(engine.state.variables[variable.trim()])}.`)}>Задать</button>
    </Section>
    <Section label="Предметы и валюта">
      <select value={item} onChange={(e) => setItem(e.target.value)}><option value="">Предмет…</option>{Object.values(engine.campaign.entities).filter((e) => e.type === 'item').map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
      <button className="btn btn-small" disabled={!item} onClick={() => mutate(() => engine.addItem(item, Math.max(1, amount)), () => `Выдан предмет «${engine.campaign.entities[item]?.label ?? item}» ×${Math.max(1, amount)}. В инвентаре: ${engine.itemCount(item)}.`)}>Выдать</button>
      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Количество" />
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{engine.campaign.meta.currencies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <button className="btn btn-small" onClick={() => mutate(() => engine.addItem(engine.currencyItemId(currency), Math.max(1, amount)), () => `${engine.campaign.meta.currencies.find((c) => c.id === currency)?.label ?? 'Валюта'}: добавлено ${Math.max(1, amount)}. Баланс: ${engine.currencyAmount(currency)}.`)}>Добавить валюту</button>
      {item && (() => {
        const it = engine.campaign.entities[item]
        if (!it) return null
        const desc = engine.descOf(item)
        const cat = it.type === 'item' ? (it as ItemDef).category : undefined
        const catLabel = cat ? (engine.campaign.meta.item_categories?.find((c) => c.id === cat)?.label ?? cat) : null
        return (
          <div className="pt-debug-item-card small" style={{ marginTop: 6, padding: '6px 8px', background: 'var(--cf-card-bg, rgba(0,0,0,0.2))', borderRadius: 4 }}>
            <div><b>{it.label}</b> {catLabel ? <span className="muted">· {catLabel}</span> : null} · в сумке: {engine.itemCount(item)} шт.</div>
            {desc ? (
              <div style={{ marginTop: 4, color: 'var(--text-main, #e0e0e0)' }}>{desc}</div>
            ) : (
              <div className="muted small" style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.7 }}>(описание не заполнено)</div>
            )}
          </div>
        )
      })()}
    </Section>
    <Section label={`Сущности сцены (${sceneEntities.length})`}>
      {sceneEntities.length === 0 ? <span className="muted small">В текущей сцене нет активных сущностей.</span> : (
        <div className="pt-debug-entity-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sceneEntities.map(({ slot, entity }) => {
            if (!entity) return null
            const isSelected = engine.inspectedEntityId === entity.id
            const desc = engine.descOf(entity.id)
            const curState = engine.entityState(entity.id) ?? ''
            const npc = entity.type === 'npc' ? entity : null
            const item = entity.type === 'item' ? (entity as ItemDef) : null
            const stateKeys = npc ? Object.keys(npc.portrait ?? {}) : []
            return (
              <div
                key={slot.id}
                className="pt-debug-entity-card small"
                onClick={() => engine.inspectEntity(entity.id)}
                style={{
                  padding: '8px 10px',
                  background: isSelected ? 'color-mix(in srgb, var(--gold, #d4af37) 12%, var(--cf-card-bg, rgba(0,0,0,0.3)))' : 'var(--cf-card-bg, rgba(0,0,0,0.2))',
                  border: isSelected ? '1px solid var(--gold, #d4af37)' : '1px solid var(--ed-line, rgba(255,255,255,0.08))',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: isSelected ? 'var(--gold-bright, #ffd700)' : 'inherit' }}>
                    {entity.label} {isSelected && <small style={{ fontWeight: 'normal', opacity: 0.8 }}>(выбрано)</small>}
                  </span>
                  <span className="muted">{entity.type === 'npc' ? 'Персонаж' : 'Предмет'}{slot.label ? ` · ${slot.label}` : ''}</span>
                </div>
                {desc ? (
                  <div style={{ marginTop: 6, color: 'var(--text-main, #f0f0f0)', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{desc}</div>
                ) : (
                  <div className="muted small" style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.7 }}>
                    (описание сущности не заполнено)
                  </div>
                )}
                {item && (item.interact_options?.length || item.on_interact) ? (
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Действия: {item.interact_options?.length ? `${item.interact_options.length} вар.` : 'прямое взаимодействие'}
                  </div>
                ) : null}
                {npc && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {stateKeys.length > 0 && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="muted">Облик:</span>
                        <select
                          value={curState}
                          onChange={(e) => mutate(() => engine.applyEffects([{ type: 'set_entity_state', entity: entity.id, state: e.target.value }]), `Облик ${entity.label}: ${getEmotionRuLabel(engine, e.target.value)}`)}
                        >
                          <option value="">Обычный</option>
                          {stateKeys.map((k) => (
                            <option key={k} value={k}>
                              {getEmotionRuLabel(engine, k)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {npc.dialogue && (
                      <button
                        className="btn btn-small"
                        onClick={() => {
                          onClose()
                          engine.startDialogue(entity.id)
                        }}
                      >
                        Запустить диалог
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Section>
    <Section label="Герой">
      <button className="btn btn-small" onClick={() => mutate(() => { engine.state.player.hp = engine.state.player.max_hp; engine.state.player.mp = engine.state.player.max_mp; for (const n of engine.campaign.meta.needs) engine.state.player.needs[n.id] = n.max }, 'Здоровье, магия и потребности восстановлены.')}>Вылечить и восстановить потребности</button>
      <div className="pt-debug-help">Персонаж не погибает от урона, истощения и других игровых причин. «Мгновенное поражение» в этой панели по-прежнему работает. Настройка действует только в плейтесте.</div>
      <label className="pt-debug-immortality"><input type="checkbox" checked={engine.debugInvincible} onChange={(e) => mutate(() => { engine.debugInvincible = e.target.checked }, e.target.checked ? 'Бессмертие персонажа включено.' : 'Бессмертие персонажа выключено.')} /><span>Бессмертие персонажа</span></label>
      <div className="pt-debug-setting">
        <label className="pt-debug-setting-label" htmlFor="pt-debug-skill">Навык героя</label>
        <div className="pt-debug-control-row">
          <select id="pt-debug-skill" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Навык героя">
            {Object.keys(engine.state.player.skills).map((s) => <option key={s} value={s}>{engine.campaign.meta.skills?.find((x) => x.id === s)?.label ?? s}</option>)}
          </select>
          <input type="number" min="0" max="100" value={engine.state.player.skills[skill] ?? 0} onChange={(e) => mutate(() => { engine.state.player.skills[skill] = Math.max(0, Math.min(100, Number(e.target.value))) }, `Навык изменён: ${engine.campaign.meta.skills?.find((x) => x.id === skill)?.label ?? skill}.`)} aria-label="Значение навыка, процентов" />
          <span>%</span>
        </div>
        <p className="pt-debug-help">Дубины, копья и кулачный бой — навыки. Число задаёт целевое значение броска d100: чем оно выше, тем легче пройти проверку. Изменение действует только в этом плейтесте.</p>
      </div>
      <div className="pt-debug-setting">
        <label className="pt-debug-setting-label" htmlFor="pt-debug-stat">Характеристика героя</label>
        <div className="pt-debug-control-row">
          <select id="pt-debug-stat" value={stat} onChange={(e) => setStat(e.target.value)} aria-label="Характеристика героя">
            {Object.keys(engine.state.player.stats).map((s) => <option key={s} value={s}>{STAT_LABELS[s] ? `${STAT_LABELS[s]} (${s})` : s}</option>)}
          </select>
          <input type="number" value={engine.state.player.stats[stat as keyof typeof engine.state.player.stats] ?? 0} onChange={(e) => mutate(() => {
            const stats = engine.state.player.stats
            stats[stat as keyof typeof stats] = Number(e.target.value)
            if (stat === 'CON' || stat === 'SIZ') { const max = derivedHP(stats); engine.state.player.max_hp = max; engine.state.player.hp = Math.min(engine.state.player.hp, max) }
            if (stat === 'POW') { const max = derivedMP(stats); engine.state.player.max_mp = max; engine.state.player.mp = Math.min(engine.state.player.mp, max) }
          }, `Характеристика ${STAT_LABELS[stat] ?? stat} изменена.`)} aria-label={`Значение ${STAT_LABELS[stat] ?? stat}`} />
        </div>
        <p className="pt-debug-help">CON + SIZ определяют максимум HP, POW — максимум MP, DEX влияет на порядок хода, STR + SIZ — на бонус урона, STR/SIZ/DEX — на движение. INT и CHA хранятся в листе героя, но пока не участвуют в автоматических проверках ядра. Изменения действуют только в плейтесте.</p>
      </div>
    </Section>
    <Section label="Бой">
      {engine.combat ? <>
        <button className="btn btn-small" disabled={!!engine.combat.result} onClick={() => mutate(() => {
          const combat = engine.combat!
          for (const c of combat.combatants) if (c.side === 'enemy') { c.hp = 0; c.dead = true; engine.state.dead_entities.push(c.entityId) }
          combat.result = 'victory'
          engine.onCombatResolve(combat.def.on_victory ?? [])
        }, 'В бою одержана мгновенная победа.')}>Мгновенная победа</button>
        <button className="btn btn-small" disabled={!!engine.combat.result} onClick={() => mutate(() => { engine.combat!.result = 'defeat'; engine.gameOver('death', 'Поражение в режиме отладки.', true) }, 'Плейтест завершён поражением.')}>Мгновенное поражение</button>
      </> : <span className="muted small">Сейчас бой не идёт.</span>}
    </Section>
    <Section label="Время и погода">
      <button className="btn btn-small" onClick={() => mutate(() => engine.advanceTicks(1), 'Время продвинуто на 1 тик.')}>+1 тик</button>
      <button className="btn btn-small" onClick={() => mutate(() => engine.advanceTicks(engine.campaign.meta.ticks_per_day), 'Время продвинуто на 1 день.')}>+1 день</button>
      <select value={engine.state.weather ?? ''} onChange={(e) => mutate(() => { engine.state.weather = e.target.value || undefined }, `Погода установлена: ${engine.campaign.meta.weathers?.find((w) => w.id === e.target.value)?.label ?? 'Ясно'}.`)}><option value="">Ясно</option>{(engine.campaign.meta.weathers ?? []).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
      {(['morning', 'day', 'evening', 'night'] as const).map((period) => <button key={period} className="btn btn-small" onClick={() => mutate(() => {
        const clock = engine.campaign.meta.time_of_day ?? { morning: 6, day: 10, evening: 18, night: 22 }
        const hour = clock[period]
        const baseTick = Math.floor(engine.state.tick / engine.campaign.meta.ticks_per_day) * engine.campaign.meta.ticks_per_day
        engine.state.tick = baseTick + hour
      }, `Время переключено: ${{ morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' }[period]}.`)}>{{ morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь' }[period]}</button>)}
    </Section>
    <Section label={`Квесты (${quests.length})`}>
      {quests.length === 0 ? <span className="muted small">В кампании нет квестов.</span> : (
        <div className="pt-debug-quest-list">
          {quests.map(([id, q]) => {
            const currentStageId = engine.state.quests[id]?.stage ?? ''
            const stageDef = q.stages.find((s) => s.id === currentStageId)
            return (
              <div className="pt-debug-quest-row" key={id} style={{ marginBottom: 6 }}>
                <label><span>{q.label}</span><select value={currentStageId} onChange={(e) => mutate(() => engine.advanceQuestTo(id, e.target.value), `Квест «${q.label}»: стадия «${q.stages.find((s) => s.id === e.target.value)?.label ?? e.target.value}».`)}>
                  <option value="">(не начат)</option>{q.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select></label>
                {stageDef && <div className="muted small" style={{ marginTop: 2, paddingLeft: 4 }}>Стадия: {stageDef.label || stageDef.id} {q.description ? `· ${q.description}` : ''}</div>}
              </div>
            )
          })}
        </div>
      )}
    </Section>
    <Section label={`Кодекс (${entries.length})`}>
      {entries.length === 0 ? <span className="muted small">В кампании нет записей кодекса.</span> : (
        <div className="pt-debug-codex-list">
          {entries.map((e) => {
            const unlocked = (engine.state.codex_unlocked ?? []).includes(e.id)
            return <button key={e.id} className="btn btn-small" disabled={unlocked} onClick={() => mutate(() => engine.unlockCodex(e.id), `Запись «${e.label}» добавлена в журнал.`)}>{unlocked ? `Уже в журнале: ${e.label}` : `Добавить в журнал: ${e.label}`}</button>
          })}
        </div>
      )}
    </Section>
  </aside>
}
