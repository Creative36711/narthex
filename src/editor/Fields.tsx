import { useId, useState } from 'react'
import type { Condition, Effect } from '../shared/types'
import type { EditorStore } from './store'
import {
  CONDITION_SCHEMAS,
  EFFECT_SCHEMAS,
  conditionSummary,
  effectSummary,
  type FieldSpec,
} from './schemas'

/**
 * Универсальные поля форм + визуальные конструкторы списков условий и эффектов.
 */

// ─────────────── одно поле по схеме ───────────────

export function Field({
  spec,
  value,
  onChange,
  store,
}: {
  spec: FieldSpec
  value: unknown
  onChange: (v: unknown) => void
  store: EditorStore
}) {
  const listId = useId()
  const refKinds: Record<string, Parameters<EditorStore['ids']>[0]> = {
    entityRef: 'entity',
    npcRef: 'npc',
    itemRef: 'item',
    locationRef: 'location',
    sceneRef: 'scene',
    questRef: 'quest',
    arenaRef: 'arena',
    ruleRef: 'rule',
  }

  if (spec.kind === 'number') {
    return (
      <label className="fld">
        <span>{spec.label}</span>
        <input
          type="number"
          value={value === undefined || value === null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </label>
    )
  }
  if (spec.kind === 'boolean') {
    return (
      <label className="fld fld-check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{spec.label}</span>
      </label>
    )
  }
  if (spec.kind === 'select') {
    return (
      <label className="fld">
        <span>{spec.label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(spec.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (spec.kind === 'json') {
    return <JsonField label={spec.label} value={value} onChange={onChange} placeholder={spec.placeholder} />
  }
  if (spec.kind === 'conditions') {
    return (
      <div className="fld fld-block">
        <span>{spec.label}</span>
        <ConditionListEditor
          store={store}
          conditions={(value as Condition[]) ?? []}
          onChange={(v) => onChange(v)}
        />
      </div>
    )
  }
  if (spec.kind === 'effects') {
    return (
      <div className="fld fld-block">
        <span>{spec.label}</span>
        <EffectListEditor store={store} effects={(value as Effect[]) ?? []} onChange={(v) => onChange(v)} />
      </div>
    )
  }
  // string и все *Ref
  const refKind = refKinds[spec.kind]
  const options = refKind ? store.ids(refKind) : []
  return (
    <label className="fld">
      <span>{spec.label}</span>
      <input
        type="text"
        list={refKind ? listId : undefined}
        value={String(value ?? '')}
        placeholder={spec.placeholder}
        onChange={(e) => onChange(e.target.value === '' && spec.optional ? undefined : e.target.value)}
      />
      {refKind && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </label>
  )
}

export function JsonField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string
  value: unknown
  onChange: (v: unknown) => void
  placeholder?: string
  rows?: number
}) {
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value)))
  const [err, setErr] = useState(false)
  return (
    <label className="fld fld-block">
      <span>
        {label} {err && <em className="fld-err">← некорректный JSON</em>}
      </span>
      <textarea
        rows={rows}
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          if (e.target.value.trim() === '') {
            setErr(false)
            onChange(undefined)
            return
          }
          try {
            onChange(JSON.parse(e.target.value))
            setErr(false)
          } catch {
            setErr(true)
          }
        }}
      />
    </label>
  )
}

// ─────────────── форма по схеме типа ───────────────

function SchemaForm({
  fields,
  obj,
  onChange,
  store,
}: {
  fields: FieldSpec[]
  obj: Record<string, unknown>
  onChange: (obj: Record<string, unknown>) => void
  store: EditorStore
}) {
  return (
    <div className="schema-form">
      {fields.map((f) => (
        <Field
          key={f.key}
          spec={f}
          value={obj[f.key]}
          store={store}
          onChange={(v) => {
            const next = { ...obj }
            if (v === undefined) delete next[f.key]
            else next[f.key] = v
            onChange(next)
          }}
        />
      ))}
      {fields.length === 0 && <div className="muted small">Без параметров</div>}
    </div>
  )
}

// ─────────────── список условий ───────────────

export function ConditionListEditor({
  store,
  conditions,
  onChange,
}: {
  store: EditorStore
  conditions: Condition[]
  onChange: (c: Condition[]) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const types = Object.keys(CONDITION_SCHEMAS) as Condition['type'][]
  return (
    <div className="ce-list">
      {conditions.map((c, i) => {
        const schema = CONDITION_SCHEMAS[c.type]
        return (
          <div key={i} className="ce-item">
            <div className="ce-head" onClick={() => setOpen(open === i ? null : i)}>
              <span className="ce-summary">{conditionSummary(c)}</span>
              <button
                className="btn btn-small ce-del"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(conditions.filter((_, j) => j !== i))
                }}
              >
                ✕
              </button>
            </div>
            {open === i && (
              <div className="ce-body">
                <label className="fld">
                  <span>Тип</span>
                  <select
                    value={c.type}
                    onChange={(e) => {
                      const t = e.target.value as Condition['type']
                      const next = [...conditions]
                      next[i] = { type: t, ...CONDITION_SCHEMAS[t].blank } as Condition
                      onChange(next)
                    }}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {CONDITION_SCHEMAS[t].label}
                      </option>
                    ))}
                  </select>
                </label>
                <SchemaForm
                  fields={schema.fields}
                  obj={c as unknown as Record<string, unknown>}
                  store={store}
                  onChange={(obj) => {
                    const next = [...conditions]
                    next[i] = { ...obj, type: c.type } as Condition
                    onChange(next)
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
      <button
        className="btn btn-small"
        onClick={() => {
          onChange([...conditions, { type: 'flag_set', flag: '' } as Condition])
          setOpen(conditions.length)
        }}
      >
        + условие
      </button>
    </div>
  )
}

// ─────────────── список эффектов ───────────────

export function EffectListEditor({
  store,
  effects,
  onChange,
}: {
  store: EditorStore
  effects: Effect[]
  onChange: (e: Effect[]) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const types = Object.keys(EFFECT_SCHEMAS) as Effect['type'][]
  return (
    <div className="ce-list">
      {effects.map((ef, i) => {
        const schema = EFFECT_SCHEMAS[ef.type]
        return (
          <div key={i} className="ce-item">
            <div className="ce-head" onClick={() => setOpen(open === i ? null : i)}>
              <span className="ce-summary ce-effect">{effectSummary(ef)}</span>
              <span className="ce-tools" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-small"
                  disabled={i === 0}
                  title="Выше"
                  onClick={() => {
                    const next = [...effects]
                    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                    onChange(next)
                  }}
                >
                  ↑
                </button>
                <button
                  className="btn btn-small ce-del"
                  onClick={() => onChange(effects.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </span>
            </div>
            {open === i && (
              <div className="ce-body">
                <label className="fld">
                  <span>Тип</span>
                  <select
                    value={ef.type}
                    onChange={(e) => {
                      const t = e.target.value as Effect['type']
                      const next = [...effects]
                      next[i] = { type: t, ...EFFECT_SCHEMAS[t].blank } as Effect
                      onChange(next)
                    }}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {EFFECT_SCHEMAS[t].label}
                      </option>
                    ))}
                  </select>
                </label>
                <SchemaForm
                  fields={schema.fields}
                  obj={ef as unknown as Record<string, unknown>}
                  store={store}
                  onChange={(obj) => {
                    const next = [...effects]
                    next[i] = { ...obj, type: ef.type } as Effect
                    onChange(next)
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
      <button
        className="btn btn-small"
        onClick={() => {
          onChange([...effects, { type: 'show_message', text: '' } as Effect])
          setOpen(effects.length)
        }}
      >
        + эффект
      </button>
    </div>
  )
}
