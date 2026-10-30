

/**
 * Генераторы контента: таблицы, списки и слоты описаний.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */

import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { EditorStore } from './store'
import type { GenWeightedItem } from '../shared/types'
/**
 * Генераторы контента: таблицы, списки и слоты описаний.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */


export type GenBase = { id: string; label: string; description?: string; lists: Record<string, GenWeightedItem[]> }

/** Панель генератора одного вида (лица/места/приключения): заготовка + фабрика. */
export function GeneratorKindSection<T extends GenBase>({
  heading,
  hint,
  items,
  onChange,
  makeNew,
  fields,
  store,
  renderBody,
}: {
  /** прописано как heading, а не title: у секции нет нативного тултипа —
   *  весь смысл подписи виден в заголовке (правка фидбека №9) */
  heading: string
  hint: string
  items: T[]
  onChange: (next: T[]) => void
  makeNew: (existing: T[]) => T
  fields: React.ReactNode
  store: EditorStore
  renderBody: (gen: T, update: (g: T) => void, store: EditorStore) => React.ReactNode
}) {
  return (
    <div className="props-group" style={{ borderTop: '1px dashed var(--border-soft)', marginTop: 12, paddingTop: 10 }}>
      <h5 className="ce-subhead">{heading}</h5>
      <div className="muted small" style={{ marginBottom: 6 }}>{hint}</div>
      {items.map((gen, i) => (
        <div key={gen.id} className="panel" style={{ padding: 8, marginBottom: 8 }}>
          <div className="fld-row">
            <input value={gen.label} placeholder="Название генератора" style={{ flex: 1 }}
              onChange={(e) => { const arr = items.map((x, j) => j === i ? { ...x, label: e.target.value } : x); onChange(arr) }} />
            <button className="btn btn-small btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Ico n="trash" /></button>
          </div>
          <label className="fld">
            <span>Описание (для себя)</span>
            <input value={gen.description ?? ''} onChange={(e) => { const arr = items.map((x, j) => j === i ? { ...x, description: e.target.value || undefined } : x); onChange(arr) }} />
          </label>
          <div className="muted small" style={{ margin: '4px 0' }}>{fields}</div>
          {renderBody(gen, (g2) => { const arr = items.map((x, j) => j === i ? g2 : x); onChange(arr) }, store)}
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...items, makeNew(items)])}><Ico n="plus" /> {heading.toLowerCase()}</button>
    </div>
  )
}

/** Списки генератора: ключ → строки «значение | вес» (вес опционален). */
export function GenListsEditor({
  lists,
  onChange,
}: {
  lists: Record<string, GenWeightedItem[]>
  onChange: (next: Record<string, GenWeightedItem[]>) => void
}) {
  const addList = () => {
    let n = 1
    while (lists[`список_${n}`]) n++
    onChange({ ...lists, [`список_${n}`]: [] })
  }
  return (
    <>
      <span className="fld-label">Списки значений (вес через «|»: «Суровый | 2»)</span>
      {Object.entries(lists).map(([key, items]) => (
        <div key={key} className="panel" style={{ padding: 8, marginBottom: 6 }}>
          <div className="fld-row" style={{ alignItems: 'center' }}>
            <input
              value={key}
              data-tip="Ключ списка — в подстановках {список:ключ} и привязках полей"
              style={{ width: 170 }}
              onChange={(e) => {
                const nk = e.target.value.trim()
                const next: Record<string, GenWeightedItem[]> = {}
                for (const [k, v] of Object.entries(lists)) next[k === key && nk ? nk : k] = v
                onChange(next)
              }}
            />
            <button className="btn btn-small" onClick={() => { const next = { ...lists }; delete next[key]; onChange(next) }}><Ico n="close" /></button>
          </div>
          <textarea
            rows={Math.min(6, items.length + 1)}
            value={items.map((x) => (x.weight && x.weight !== 1 ? `${x.value} | ${x.weight}` : x.value)).join('\n')}
            placeholder="один вариант на строку; реже/чаще — «вариант | вес»"
            onChange={(e) => {
              const items: GenWeightedItem[] = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                const m = l.match(/^(.*?)\s*\|\s*(\d+)\s*$/)
                return m ? { value: m[1] ?? '', weight: Math.max(1, +m![2] || 1) } : { value: l }
              })
              onChange({ ...lists, [key]: items })
            }}
          />
        </div>
      ))}
      <button className="btn btn-small" onClick={addList}><Ico n="plus" /> список значений</button>
    </>
  )
}

/** Русские подписи технических полей лица (имена в данных не переименовываем) */

/** Добавление пары «поле → список» для лиц. */
export function GenFieldAdder({ existing, onAdd }: { existing: Record<string, GenWeightedItem[]>; onAdd: (field: string, key: string) => void }) {
  const [field, setField] = useState('')
  const keys = Object.keys(existing)
  const [key, setKey] = useState(keys[0] ?? '')
  return (
    <>
      <input
        value={field}
        placeholder="имя поля"
        data-tip="Техническое имя поля лица: description (описание), disposition_label (метка расположения), stats.STR, skills.stealth, item.weapon…"
        onChange={(e) => setField(e.target.value)}
      />
      <select value={keys.includes(key) ? key : keys[0] ?? ''} onChange={(e) => setKey(e.target.value)}>
        {keys.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <button className="btn btn-small" disabled={!field.trim() || !keys.length} onClick={() => onAdd(field.trim(), keys.includes(key) ? key : keys[0] ?? '')}><Ico n="plus" /> поле</button>
    </>
  )
}
export function GenSlotSelect({ slotId, store, onChange }: { slotId: string; store: EditorStore; onChange: (v: string) => void }) {
  const opts = collectSlotOptions(store)
  const known = opts.some((o) => o.id === slotId)
  return (
    <select value={slotId} onChange={(e) => onChange(e.target.value)} style={{ width: 200 }}>
      {!known && <option value={slotId}>{slotId}</option>}
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}
export function GenSlotAdder({ store, gen, onAdd }: { store: EditorStore; gen: { lists: Record<string, GenWeightedItem[]>; slots: Record<string, string> }; onAdd: (slotId: string, key: string) => void }) {
  const opts = collectSlotOptions(store).filter((o) => !(gen.slots ?? {})[o.id])
  const keys = Object.keys(gen.lists)
  const [slotId, setSlotId] = useState(opts[0]?.id ?? '')
  const [key, setKey] = useState(keys[0] ?? '')
  if (!opts.length || !keys.length) return null
  return (
    <div className="fld-row" style={{ alignItems: 'center' }}>
      <select value={opts.some((o) => o.id === slotId) ? slotId : opts[0]!.id} onChange={(e) => setSlotId(e.target.value)}>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <select value={keys.includes(key) ? key : keys[0]} onChange={(e) => setKey(e.target.value)}>
        {keys.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <button className="btn btn-small" onClick={() => onAdd(opts.some((o) => o.id === slotId) ? slotId : opts[0]!.id, keys.includes(key) ? key : keys[0]!)}><Ico n="plus" /> слот</button>
    </div>
  )
}



/** Все слоты всех сцен кампании: «сцена · слот» (значение — id слота). */
function collectSlotOptions(store: EditorStore): Array<{ id: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; label: string }> = []
  for (const p of store.scenePaths()) {
    const sc = store.scene(p)
    if (!sc) continue
    for (const sl of sc.slots ?? []) {
      if (seen.has(sl.id)) continue
      seen.add(sl.id)
      out.push({ id: sl.id, label: `${sc.label}: ${sl.label ?? sl.id}` })
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

/**
 * Реестр шаблонов видов существ (вместо встроенных пресетов движка):
 * мастер описывает виды своей кампании, редактор персонажа предлагает
 * «Применить вид» — перезаписывает статы/навыки/броню/оружие/мораль NPC.
 */
