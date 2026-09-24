import { useState } from 'react'
import type { EditorStore } from './store'
import { makeId } from './ids'
import { askText } from './prompt'
import {
  generateInk,
  type DlgChoice,
  type DlgDoc,
  type DlgEffect,
  type DlgEmotion,
  type DlgLine,
  type DlgNode,
} from './dialogueDoc'

/**
 * Визуальный конструктор диалогов (фидбек №20): узлы, реплики и ответы —
 * формами; .ink генерируется автоматически при каждом изменении.
 */

const BASE_EMOTIONS: Array<{ id: DlgEmotion; label: string }> = [
  { id: 'neutral', label: 'спокойно' },
  { id: 'happy', label: 'радость' },
  { id: 'angry', label: 'гнев' },
]

const EMOTION_LABELS: Record<string, string> = {
  neutral: 'спокойно',
  happy: 'радость',
  angry: 'гнев',
  sad: 'печаль',
  fear: 'страх',
}

/** настроения для диалога: базовые + состояния портретов NPC, говорящего этим диалогом */
function emotionsFor(store: EditorStore, inkPath: string): Array<{ id: DlgEmotion; label: string }> {
  const out = [...BASE_EMOTIONS]
  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    if (e?.type !== 'npc' || e.dialogue !== inkPath) continue
    for (const key of Object.keys(e.portrait ?? {})) {
      if (!out.some((em) => em.id === key)) out.push({ id: key, label: EMOTION_LABELS[key] ?? key })
    }
  }
  return out
}

const EFFECT_TYPES: Array<{ id: DlgEffect['type']; label: string }> = [
  { id: 'set_flag', label: 'Поставить флаг' },
  { id: 'add_item', label: 'Дать предмет' },
  { id: 'remove_item', label: 'Забрать предмет' },
  { id: 'start_quest', label: 'Начать квест' },
  { id: 'fire_rule', label: 'Запустить правило (бой и т.п.)' },
  { id: 'join_party', label: 'НПС идёт с героем' },
  { id: 'open_trade', label: 'Открыть торговлю' },
  { id: 'advance_time', label: 'Потратить время' },
]

function blankEffect(type: DlgEffect['type']): DlgEffect {
  switch (type) {
    case 'set_flag': return { type, flag: '' }
    case 'add_item': return { type, item: '', qty: 1 }
    case 'remove_item': return { type, item: '', qty: 1 }
    case 'fire_rule': return { type, rule: '' }
    case 'join_party': return { type, npc: '' }
    case 'open_trade': return { type, npc: '' }
    case 'start_quest': return { type, quest: '' }
    case 'advance_time': return { type, ticks: 1 }
  }
}

export function DialogueBuilder({ store, path }: { store: EditorStore; path: string }) {
  const dlgPath = path.replace(/\.ink$/, '.dlg.json')
  const doc = store.jsonFiles.get(dlgPath) as DlgDoc | undefined
  const [nodeIdx, setNodeIdx] = useState(0)
  const [, force] = useState(0)
  if (!doc) return null

  const commit = () => {
    // пересобрать ink из документа
    store.textFiles.set(path, generateInk(doc))
    store.touch(dlgPath)
    store.touch(path)
    force((n) => n + 1)
  }

  const node = doc.nodes[Math.min(nodeIdx, doc.nodes.length - 1)]

  const addNode = async () => {
    const label = await askText('Название узла разговора', 'например «Расспросить о банде»')
    if (!label) return
    doc.nodes.push({
      id: makeId('node_', label, doc.nodes.map((n) => n.id)),
      label,
      lines: [{ text: '' }],
      choices: [{ text: 'Назад.', lines: [], effects: [], goto: doc.nodes[0]?.id ?? 'end' }],
    })
    setNodeIdx(doc.nodes.length - 1)
    commit()
  }

  return (
    <div className="dlg-builder">
      <div className="dlg-nodes">
        <div className="fld-caption">Узлы разговора</div>
        {doc.nodes.map((n, i) => (
          <button
            key={n.id}
            className={`editor-list-item ${i === nodeIdx ? 'on' : ''}`}
            onClick={() => setNodeIdx(i)}
          >
            {i === 0 ? '▶ ' : ''}{n.label}
          </button>
        ))}
        <div className="editor-list-tools">
          <button className="btn btn-small" onClick={addNode}>+ узел</button>
          {nodeIdx > 0 && (
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                if (!confirm(`Удалить узел «${node.label}»?`)) return
                doc.nodes.splice(nodeIdx, 1)
                setNodeIdx(0)
                commit()
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Разговор начинается с первого узла. Ответы ведут в другие узлы, остаются на месте или заканчивают разговор.
        </div>
      </div>

      <div className="dlg-node-form">
        {node && <NodeForm key={node.id} node={node} doc={doc} store={store} commit={commit} emotions={emotionsFor(store, path)} />}
      </div>
    </div>
  )
}

function NodeForm({
  node,
  doc,
  store,
  commit,
  emotions,
}: {
  node: DlgNode
  doc: DlgDoc
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
}) {
  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Узел: {node.label}</h4>
        <label className="fld">
          <span>Название узла (видно только мастеру)</span>
          <input value={node.label} onChange={(e) => ((node.label = e.target.value), commit())} />
        </label>
      </div>

      <div className="props-group">
        <h4>Реплики НПС</h4>
        {node.lines.map((l, i) => (
          <LineRow key={i} line={l} onRemove={node.lines.length > 1 ? () => (node.lines.splice(i, 1), commit()) : undefined} commit={commit} emotions={emotions} />
        ))}
        <button className="btn btn-small" onClick={() => (node.lines.push({ text: '' }), commit())}>+ реплика</button>
      </div>

      <div className="props-group">
        <h4>Ответы игрока</h4>
        {node.choices.map((c, i) => (
          <ChoiceForm
            key={i}
            choice={c}
            index={i}
            doc={doc}
            node={node}
            store={store}
            commit={commit}
            emotions={emotions}
            onRemove={() => (node.choices.splice(i, 1), commit())}
          />
        ))}
        <button
          className="btn btn-small"
          onClick={() => (node.choices.push({ text: 'Новый ответ', lines: [], effects: [], goto: 'stay' }), commit())}
        >
          + ответ
        </button>
        {!node.choices.some((c) => !c.once && !c.if_flag && !c.if_not_flag) && (
          <div className="muted small" style={{ marginTop: 6 }}>
            ⚠ Все ответы условные или одноразовые — в игру автоматически добавится вариант «Закончить разговор».
          </div>
        )}
      </div>
    </div>
  )
}

function LineRow({ line, onRemove, commit, emotions = BASE_EMOTIONS }: { line: DlgLine; onRemove?: () => void; commit: () => void; emotions?: Array<{ id: DlgEmotion; label: string }> }) {
  return (
    <div className="dlg-line-row">
      <textarea
        rows={2}
        value={line.text}
        placeholder="Текст реплики…"
        onChange={(e) => ((line.text = e.target.value), commit())}
      />
      <div className="dlg-line-opts">
        <select
          value={line.emotion ?? 'neutral'}
          title="Эмоция портрета"
          onChange={(e) => {
            const v = e.target.value as DlgEmotion
            if (v === 'neutral') delete line.emotion
            else line.emotion = v
            commit()
          }}
        >
          {!emotions.some((em) => em.id === (line.emotion ?? 'neutral')) && <option value={line.emotion}>{line.emotion}</option>}
          {emotions.map((em) => (
            <option key={em.id} value={em.id}>{em.label}</option>
          ))}
        </select>
        <label className="fld-check small" title="Ремарка — описание действия, выводится курсивом">
          <input
            type="checkbox"
            checked={!!line.action}
            onChange={(e) => {
              if (e.target.checked) line.action = true
              else delete line.action
              commit()
            }}
          />
          <span>ремарка</span>
        </label>
        {onRemove && <button className="btn btn-small ce-del" onClick={onRemove}>✕</button>}
      </div>
    </div>
  )
}

function ChoiceForm({
  choice: c,
  index,
  doc,
  node,
  store,
  commit,
  emotions,
  onRemove,
}: {
  choice: DlgChoice
  index: number
  doc: DlgDoc
  node: DlgNode
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
  onRemove: () => void
}) {
  const flags = store.knownFlags()
  const forcedEnd = c.effects.some((e) => e.type === 'open_trade' || e.type === 'fire_rule')
  return (
    <details className="dlg-choice" open={index === 0 && node.choices.length <= 2}>
      <summary>▸ {c.text || '(без текста)'}</summary>
      <label className="fld">
        <span>Текст ответа</span>
        <input value={c.text} onChange={(e) => ((c.text = e.target.value), commit())} />
      </label>

      <div className="fld-row">
        <label className="fld fld-check" title="Одноразовый вопрос: исчезает до конца текущего разговора">
          <input
            type="checkbox"
            checked={!!c.once}
            onChange={(e) => {
              if (e.target.checked) c.once = true
              else delete c.once
              commit()
            }}
          />
          <span>один раз за разговор</span>
        </label>
        <label className="fld">
          <span>Показывать, если стоит флаг</span>
          <input
            list="known-flags-dlg"
            value={c.if_flag ?? ''}
            placeholder="(всегда)"
            onChange={(e) => {
              if (e.target.value) c.if_flag = e.target.value
              else delete c.if_flag
              commit()
            }}
          />
        </label>
        <label className="fld">
          <span>…если флага НЕТ</span>
          <input
            list="known-flags-dlg"
            value={c.if_not_flag ?? ''}
            placeholder="(всегда)"
            onChange={(e) => {
              if (e.target.value) c.if_not_flag = e.target.value
              else delete c.if_not_flag
              commit()
            }}
          />
        </label>
      </div>
      <datalist id="known-flags-dlg">
        {flags.map((f) => <option key={f} value={f} />)}
      </datalist>

      <div className="fld-block">
        <span className="fld-caption">Ответ НПС</span>
        {c.lines.map((l, i) => (
          <LineRow key={i} line={l} onRemove={() => (c.lines.splice(i, 1), commit())} commit={commit} emotions={emotions} />
        ))}
        <button className="btn btn-small" onClick={() => (c.lines.push({ text: '' }), commit())}>+ реплика</button>
      </div>

      <div className="fld-block">
        <span className="fld-caption">Что происходит</span>
        {c.effects.map((e, i) => (
          <EffectRow key={i} effect={e} store={store} commit={commit} onRemove={() => (c.effects.splice(i, 1), commit())} onReplace={(ne) => ((c.effects[i] = ne), commit())} />
        ))}
        <button className="btn btn-small" onClick={() => (c.effects.push(blankEffect('set_flag')), commit())}>
          + событие
        </button>
      </div>

      <label className="fld">
        <span>Куда дальше</span>
        {forcedEnd ? (
          <span className="muted small">Торговля/правило сами закрывают разговор.</span>
        ) : (
          <select value={c.goto} onChange={(e) => ((c.goto = e.target.value), commit())}>
            <option value="stay">Остаться (те же варианты)</option>
            <option value="end">Закончить разговор</option>
            {doc.nodes.map((n) => (
              <option key={n.id} value={n.id}>Узел: {n.label}</option>
            ))}
          </select>
        )}
      </label>

      <button className="btn btn-small ce-del" onClick={onRemove}>✕ удалить ответ</button>
    </details>
  )
}

function EffectRow({
  effect: e,
  store,
  commit,
  onRemove,
  onReplace,
}: {
  effect: DlgEffect
  store: EditorStore
  commit: () => void
  onRemove: () => void
  onReplace: (e: DlgEffect) => void
}) {
  return (
    <div className="dlg-effect-row">
      <select value={e.type} onChange={(ev) => onReplace(blankEffect(ev.target.value as DlgEffect['type']))}>
        {EFFECT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      {e.type === 'set_flag' && (
        <input
          list="known-flags-dlg"
          value={e.flag}
          placeholder="имя флага"
          onChange={(ev) => ((e.flag = ev.target.value), commit())}
        />
      )}
      {(e.type === 'add_item' || e.type === 'remove_item') && (
        <>
          <InlineRef kind="item" store={store} value={e.item} onChange={(v) => ((e.item = v), commit())} />
          <input
            type="number"
            className="dlg-qty"
            value={e.qty}
            min={1}
            onChange={(ev) => ((e.qty = Number(ev.target.value)), commit())}
          />
        </>
      )}
      {e.type === 'fire_rule' && <InlineRef kind="rule" store={store} value={e.rule} onChange={(v) => ((e.rule = v), commit())} />}
      {(e.type === 'join_party' || e.type === 'open_trade') && (
        <InlineRef kind="npc" store={store} value={e.npc} onChange={(v) => ((e.npc = v), commit())} />
      )}
      {e.type === 'start_quest' && <InlineRef kind="quest" store={store} value={e.quest} onChange={(v) => ((e.quest = v), commit())} />}
      {e.type === 'advance_time' && (
        <input
          type="number"
          className="dlg-qty"
          value={e.ticks}
          min={1}
          onChange={(ev) => ((e.ticks = Number(ev.target.value)), commit())}
        />
      )}
      <button className="btn btn-small ce-del" onClick={onRemove}>✕</button>
    </div>
  )
}

function InlineRef({
  kind,
  store,
  value,
  onChange,
}: {
  kind: Parameters<EditorStore['options']>[0]
  store: EditorStore
  value: string
  onChange: (v: string) => void
}) {
  const options = store.options(kind)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {value === '' && <option value="">— выбрать —</option>}
      {!options.some((o) => o.id === value) && value !== '' && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}

/** есть ли у диалога визуальный исходник */
export function hasDlgDoc(store: EditorStore, inkPath: string): boolean {
  return store.jsonFiles.has(inkPath.replace(/\.ink$/, '.dlg.json'))
}
