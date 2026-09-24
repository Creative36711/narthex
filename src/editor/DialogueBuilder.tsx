import { useState } from 'react'
import type { EditorStore } from './store'
import { makeId } from './ids'
import { askText, askConfirm } from './prompt'
import { FlagSelect } from './Fields'
import {
  generateInk,
  migrateDlgDoc,
  type DlgCheck,
  type DlgChoice,
  type DlgCond,
  type DlgDoc,
  type DlgEffect,
  type DlgEmotion,
  type DlgLine,
  type DlgNode,
  type DlgSection,
  type DlgStep,
} from './dialogueDoc'

/**
 * Визуальный конструктор диалогов: узлы, реплики, условия, проверки навыков
 * и ответы — формами; .ink генерируется автоматически. Никакого кода.
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
  { id: 'change_need', label: 'Изменить потребность' },
  { id: 'change_hp', label: 'Изменить здоровье' },
  { id: 'change_disposition', label: 'Изменить отношение' },
  { id: 'advance_time', label: 'Промотать время' },
  { id: 'sleep', label: 'Сон (время + отдых)' },
  { id: 'start_quest', label: 'Начать квест' },
  { id: 'join_party', label: 'Взять в отряд' },
  { id: 'open_trade', label: 'Открыть торговлю (завершает разговор)' },
  { id: 'fire_rule', label: 'Запустить правило (завершает разговор)' },
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
    case 'change_need': return { type, need: '', delta: 10 }
    case 'change_hp': return { type, delta: 5 }
    case 'sleep': return { type, ticks: 8 }
    case 'change_disposition': return { type, target: '', delta: 5 }
  }
}

const COND_TYPES: Array<{ id: string; label: string }> = [
  { id: 'flag', label: 'Флаг установлен' },
  { id: 'flag!', label: 'Флага НЕТ' },
  { id: 'item_ge', label: 'Предметов не меньше' },
  { id: 'item_ge!', label: 'Предметов меньше' },
  { id: 'has_item', label: 'Есть предмет' },
  { id: 'has_item!', label: 'Нет предмета' },
  { id: 'disp_ge', label: 'Отношение не ниже' },
  { id: 'disp_ge!', label: 'Отношение ниже' },
  { id: 'quest', label: 'Квест на стадии' },
  { id: 'quest!', label: 'Квест НЕ на стадии' },
  { id: 'in_party', label: 'В отряде' },
  { id: 'in_party!', label: 'НЕ в отряде' },
  { id: 'hp_ge', label: 'Здоровье не ниже' },
  { id: 'hp_ge!', label: 'Здоровье ниже' },
]

function blankCond(key: string): DlgCond {
  const not = key.endsWith('!') || undefined
  const type = key.replace(/!$/, '') as DlgCond['type']
  switch (type) {
    case 'flag': return { type, flag: '', not }
    case 'item_ge': return { type, item: '', count: 1, not }
    case 'has_item': return { type, item: '', not }
    case 'disp_ge': return { type, target: '', value: 10, not }
    case 'quest': return { type, quest: '', stage: '', not }
    case 'in_party': return { type, npc: '', not }
    case 'hp_ge': return { type, value: 10, not }
  }
}

function condKey(c: DlgCond): string {
  return c.not ? `${c.type}!` : c.type
}

// ─────────────── корень конструктора ───────────────

export function DialogueBuilder({ store, path }: { store: EditorStore; path: string }) {
  const dlgPath = path.replace(/\.ink$/, '.dlg.json')
  const raw = store.jsonFiles.get(dlgPath)
  const [nodeIdx, setNodeIdx] = useState(0)
  const [, force] = useState(0)
  if (!raw) return null
  const doc = migrateDlgDoc(raw)
  if (doc !== raw) store.jsonFiles.set(dlgPath, doc) // миграция v1 → v2 на месте

  const commit = () => {
    store.textFiles.set(path, generateInk(doc))
    store.touch(dlgPath)
    store.touch(path)
    force((n) => n + 1)
  }

  const node = doc.nodes[Math.min(nodeIdx, doc.nodes.length - 1)]
  const emotions = emotionsFor(store, path)

  const addNode = async () => {
    const label = await askText('Название узла разговора', 'например «Расспросить о банде»')
    if (!label) return
    doc.nodes.push({
      id: makeId('node_', label, doc.nodes.map((n) => n.id)),
      label,
      sections: [{ steps: [{ kind: 'line', line: { text: '' } }] }],
      choices: [{ text: 'Назад.', sections: [], goto: doc.nodes[0]?.id ?? 'end' }],
    })
    setNodeIdx(doc.nodes.length - 1)
    commit()
  }

  return (
    <div className="dlg-builder">
      <div className="dlg-nodes">
        <label className="fld" style={{ marginBottom: 10 }}>
          <span>Название диалога</span>
          <input
            value={doc.label ?? ''}
            placeholder="например «Алдрик, стражник ворот»"
            onChange={(e) => {
              doc.label = e.target.value || undefined
              commit()
            }}
          />
        </label>
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
              onClick={async () => {
                if (!(await askConfirm(`Удалить узел «${node.label}»?`, 'Удалить'))) return
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
        {node && <NodeForm key={node.id} node={node} doc={doc} store={store} commit={commit} emotions={emotions} />}
      </div>
    </div>
  )
}

/** есть ли у ink визуальный исходник конструктора */
export function hasDlgDoc(store: EditorStore, inkPath: string): boolean {
  return store.jsonFiles.has(inkPath.replace(/\.ink$/, '.dlg.json'))
}

/** название диалога (для списков): из документа конструктора или имя файла */
export function dialogueTitle(store: EditorStore, inkPath: string): string {
  const raw = store.jsonFiles.get(inkPath.replace(/\.ink$/, '.dlg.json')) as { label?: string } | undefined
  if (raw?.label) return raw.label
  return inkPath.replace('dialogues/', '').replace(/\.ink$/, '')
}

// ─────────────── узел ───────────────

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
        <SectionListEditor sections={node.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        {node.choices.length === 0 && (
          <GotoSelect
            label="После реплик"
            doc={doc}
            value={node.goto ?? 'end'}
            allowStay={false}
            onChange={(v) => ((node.goto = v), commit())}
          />
        )}
      </div>

      <div className="props-group">
        <h4>Варианты ответа игрока</h4>
        {node.choices.length > 0 &&
          !node.choices.some((c) => !c.once && (!c.conds || c.conds.length === 0)) && (
            <div className="dlg-warn">
              ⚠ Нет всегда доступного варианта — конструктор добавит «Закончить разговор» автоматически.
            </div>
          )}
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
          onClick={() => (node.choices.push({ text: 'Новый ответ', sections: [], goto: 'stay' }), commit())}
        >
          + ответ
        </button>
      </div>
    </div>
  )
}

// ─────────────── куда дальше ───────────────

function GotoSelect({
  label,
  doc,
  value,
  allowStay = true,
  onChange,
}: {
  label: string
  doc: DlgDoc
  value: string
  allowStay?: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowStay && <option value="stay">↩ остаться (те же варианты)</option>}
        <option value="end">■ конец разговора</option>
        {doc.nodes.map((n) => (
          <option key={n.id} value={n.id}>→ {n.label}</option>
        ))}
      </select>
    </label>
  )
}

// ─────────────── условия ───────────────

function CondListEditor({
  conds,
  store,
  commit,
  onChange,
}: {
  conds: DlgCond[]
  store: EditorStore
  commit: () => void
  onChange: (c: DlgCond[]) => void
}) {
  return (
    <div className="dlg-conds">
      {conds.map((c, i) => (
        <div key={i} className="journal-row">
          <select
            className="journal-key"
            value={condKey(c)}
            onChange={(e) => {
              conds[i] = blankCond(e.target.value)
              commit()
            }}
          >
            {COND_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <CondFields cond={c} store={store} commit={commit} />
          <button className="btn btn-small ce-del" onClick={() => onChange(conds.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...conds, blankCond('flag')])}>
        + условие
      </button>
    </div>
  )
}

function CondFields({ cond: c, store, commit }: { cond: DlgCond; store: EditorStore; commit: () => void }) {
  switch (c.type) {
    case 'flag':
      return <FlagSelect label="" store={store} value={c.flag} onChange={(f) => ((c.flag = f ?? ''), commit())} />
    case 'item_ge':
      return (
        <>
          <InlineRef kind="item" store={store} value={c.item} onChange={(v) => ((c.item = v), commit())} />
          <input type="number" className="journal-key" min={1} value={c.count} onChange={(e) => ((c.count = Math.max(1, Number(e.target.value))), commit())} />
          <span className="muted small">шт.</span>
        </>
      )
    case 'has_item':
      return <InlineRef kind="item" store={store} value={c.item} onChange={(v) => ((c.item = v), commit())} />
    case 'disp_ge':
      return (
        <>
          <InlineRef kind="disposition" store={store} value={c.target} onChange={(v) => ((c.target = v), commit())} />
          <input type="number" className="journal-key" value={c.value} onChange={(e) => ((c.value = Number(e.target.value)), commit())} />
        </>
      )
    case 'quest':
      return (
        <>
          <InlineRef kind="quest" store={store} value={c.quest} onChange={(v) => ((c.quest = v), commit())} />
          <QuestStageSelect store={store} questId={c.quest} value={c.stage} onChange={(v) => ((c.stage = v), commit())} />
        </>
      )
    case 'in_party':
      return <InlineRef kind="npc" store={store} value={c.npc} onChange={(v) => ((c.npc = v), commit())} />
    case 'hp_ge':
      return (
        <>
          <input type="number" className="journal-key" value={c.value} onChange={(e) => ((c.value = Number(e.target.value)), commit())} />
          <span className="muted small">HP</span>
        </>
      )
  }
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
    <select className="journal-key" value={value} onChange={(e) => onChange(e.target.value)}>
      {!options.some((o) => o.id === value) && <option value={value}>{value || '— выбрать —'}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}

function QuestStageSelect({
  store,
  questId,
  value,
  onChange,
}: {
  store: EditorStore
  questId: string
  value: string
  onChange: (v: string) => void
}) {
  const quest = store.questPaths().map((p) => store.quest(p)).find((q) => q?.id === questId)
  return (
    <select className="journal-key" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(не начат)</option>
      {quest?.stages.map((st) => (
        <option key={st.id} value={st.id}>{st.label ?? st.id}</option>
      ))}
      {value !== '' && !quest?.stages.some((st) => st.id === value) && <option value={value}>{value}</option>}
    </select>
  )
}

// ─────────────── шаги и блоки ───────────────

function StepListEditor({
  steps,
  store,
  commit,
  emotions,
  onChange,
}: {
  steps: DlgStep[]
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
  onChange: (s: DlgStep[]) => void
}) {
  return (
    <div className="dlg-steps">
      {steps.map((st, i) => (
        <div key={i} className="dlg-step">
          {st.kind === 'line' ? (
            <LineRow line={st.line} emotions={emotions} commit={commit} onRemove={() => onChange(steps.filter((_, j) => j !== i))} />
          ) : (
            <EffectRow
              effect={st.effect}
              store={store}
              commit={commit}
              onRemove={() => onChange(steps.filter((_, j) => j !== i))}
              onReplace={(ne) => {
                steps[i] = { kind: 'effect', effect: ne }
                commit()
              }}
            />
          )}
        </div>
      ))}
      <div className="dlg-step-tools">
        <button className="btn btn-small" onClick={() => onChange([...steps, { kind: 'line', line: { text: '' } }])}>
          + реплика
        </button>
        <button className="btn btn-small" onClick={() => onChange([...steps, { kind: 'effect', effect: blankEffect('set_flag') }])}>
          + действие
        </button>
      </div>
    </div>
  )
}

function SectionListEditor({
  sections,
  doc,
  store,
  commit,
  emotions,
}: {
  sections: DlgSection[]
  doc: DlgDoc
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
}) {
  return (
    <div className="dlg-sections">
      {sections.map((sec, i) => {
        const hasConds = !!sec.conds && sec.conds.length > 0
        return (
          <div key={i} className={`dlg-section ${hasConds ? 'dlg-section-cond' : ''}`}>
            <div className="dlg-section-head">
              <label className="fld-check small">
                <input
                  type="checkbox"
                  checked={hasConds}
                  onChange={(e) => {
                    if (e.target.checked) sec.conds = [blankCond('flag')]
                    else {
                      delete sec.conds
                      delete sec.else_steps
                      delete sec.else_goto
                    }
                    commit()
                  }}
                />
                <span>показывать при условии</span>
              </label>
              <span className="editor-spacer" />
              {sections.length > 1 && (
                <button className="btn btn-small ce-del" title="Удалить блок" onClick={() => (sections.splice(i, 1), commit())}>✕ блок</button>
              )}
            </div>
            {hasConds && (
              <CondListEditor conds={sec.conds!} store={store} commit={commit} onChange={(c) => ((sec.conds = c), commit())} />
            )}
            <StepListEditor steps={sec.steps} store={store} commit={commit} emotions={emotions} onChange={(s) => ((sec.steps = s), commit())} />
            {hasConds && (
              <details className="dlg-else" open={!!sec.else_steps?.length}>
                <summary>Иначе (условие не выполнено)</summary>
                <StepListEditor
                  steps={sec.else_steps ?? []}
                  store={store}
                  commit={commit}
                  emotions={emotions}
                  onChange={(s) => {
                    if (s.length) sec.else_steps = s
                    else delete sec.else_steps
                    commit()
                  }}
                />
                <GotoSelectOptional label="Иначе — куда дальше" doc={doc} value={sec.else_goto} onChange={(v) => {
                  if (v) sec.else_goto = v
                  else delete sec.else_goto
                  commit()
                }} />
              </details>
            )}
            <GotoSelectOptional label={hasConds ? 'При условии — куда дальше' : 'После блока — куда дальше'} doc={doc} value={sec.goto} onChange={(v) => {
              if (v) sec.goto = v
              else delete sec.goto
              commit()
            }} />
          </div>
        )
      })}
      <button className="btn btn-small" onClick={() => (sections.push({ steps: [] }), commit())}>
        + блок реплик
      </button>
    </div>
  )
}

/** необязательный переход: пусто = продолжить по порядку */
function GotoSelectOptional({
  label,
  doc,
  value,
  onChange,
}: {
  label: string
  doc: DlgDoc
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  return (
    <label className="fld fld-inline dlg-goto-opt">
      <span className="muted small">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— продолжить дальше —</option>
        <option value="end">■ конец разговора</option>
        <option value="stay">↩ к вариантам ответа</option>
        {doc.nodes.map((n) => (
          <option key={n.id} value={n.id}>→ {n.label}</option>
        ))}
      </select>
    </label>
  )
}

// ─────────────── реплика и действие ───────────────

function LineRow({
  line,
  onRemove,
  commit,
  emotions = BASE_EMOTIONS,
}: {
  line: DlgLine
  onRemove?: () => void
  commit: () => void
  emotions?: Array<{ id: DlgEmotion; label: string }>
}) {
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
          title="Настроение (состояние портрета)"
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
        {onRemove && (
          <button className="btn btn-small ce-del" onClick={onRemove}>✕</button>
        )}
      </div>
    </div>
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
        <FlagSelect label="" store={store} value={e.flag} onChange={(f) => ((e.flag = f ?? ''), commit())} />
      )}
      {(e.type === 'add_item' || e.type === 'remove_item') && (
        <>
          <InlineRef kind="item" store={store} value={e.item} onChange={(v) => ((e.item = v), commit())} />
          <input type="number" min={1} value={e.qty} onChange={(ev) => ((e.qty = Math.max(1, Number(ev.target.value))), commit())} />
        </>
      )}
      {e.type === 'fire_rule' && <InlineRef kind="rule" store={store} value={e.rule} onChange={(v) => ((e.rule = v), commit())} />}
      {(e.type === 'join_party' || e.type === 'open_trade') && (
        <InlineRef kind="npc" store={store} value={e.npc} onChange={(v) => ((e.npc = v), commit())} />
      )}
      {e.type === 'start_quest' && <InlineRef kind="quest" store={store} value={e.quest} onChange={(v) => ((e.quest = v), commit())} />}
      {(e.type === 'advance_time' || e.type === 'sleep') && (
        <>
          <input type="number" min={1} value={e.ticks} onChange={(ev) => ((e.ticks = Math.max(1, Number(ev.target.value))), commit())} />
          <span className="muted small">{store.meta.tick_label ?? 'тик'}</span>
        </>
      )}
      {e.type === 'change_need' && (
        <>
          <InlineRef kind="need" store={store} value={e.need} onChange={(v) => ((e.need = v), commit())} />
          <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
        </>
      )}
      {e.type === 'change_hp' && (
        <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
      )}
      {e.type === 'change_disposition' && (
        <>
          <InlineRef kind="disposition" store={store} value={e.target} onChange={(v) => ((e.target = v), commit())} />
          <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
        </>
      )}
      <button className="btn btn-small ce-del" onClick={onRemove}>✕</button>
    </div>
  )
}

// ─────────────── вариант ответа ───────────────

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
  const skills = store.options('skill')
  return (
    <details className="dlg-choice" open={index === 0 && node.choices.length <= 2}>
      <summary>▸ {c.text || '(без текста)'}{c.check ? ' 🎲' : ''}{c.conds?.length ? ' 🔒' : ''}</summary>
      <label className="fld">
        <span>Текст ответа игрока</span>
        <input value={c.text} onChange={(e) => ((c.text = e.target.value), commit())} />
      </label>
      <div className="fld-row">
        <label className="fld-check small">
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
        <label className="fld-check small">
          <input
            type="checkbox"
            checked={!!c.conds}
            onChange={(e) => {
              if (e.target.checked) c.conds = [blankCond('flag')]
              else delete c.conds
              commit()
            }}
          />
          <span>показывать при условии</span>
        </label>
        <label className="fld-check small">
          <input
            type="checkbox"
            checked={!!c.check}
            onChange={(e) => {
              if (e.target.checked)
                c.check = {
                  skill: skills[0]?.id ?? 'persuade',
                  difficulty: 50,
                  success: { sections: [{ steps: [] }], goto: 'stay' },
                  fail: { sections: [{ steps: [] }], goto: 'stay' },
                }
              else delete c.check
              commit()
            }}
          />
          <span>проверка навыка 🎲</span>
        </label>
      </div>
      {c.conds && (
        <div className="fld-block">
          <span className="fld-caption">Условия показа варианта</span>
          <CondListEditor conds={c.conds} store={store} commit={commit} onChange={(v) => {
            if (v.length) c.conds = v
            else delete c.conds
            commit()
          }} />
        </div>
      )}

      <div className="fld-block">
        <span className="fld-caption">Ответ НПС</span>
        <SectionListEditor sections={c.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
      </div>

      {c.check && <CheckEditor check={c.check} doc={doc} store={store} commit={commit} emotions={emotions} />}

      {!c.check && (
        <GotoSelect label="Куда дальше" doc={doc} value={c.goto} onChange={(v) => ((c.goto = v), commit())} />
      )}
      <div className="dlg-choice-tools">
        <button className="btn btn-small ce-del" onClick={onRemove}>✕ удалить ответ</button>
      </div>
    </details>
  )
}

function CheckEditor({
  check,
  doc,
  store,
  commit,
  emotions,
}: {
  check: DlgCheck
  doc: DlgDoc
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
}) {
  const skills = store.options('skill')
  return (
    <div className="dlg-check">
      <div className="fld-row">
        <label className="fld">
          <span>Навык</span>
          <select value={check.skill} onChange={(e) => ((check.skill = e.target.value), commit())}>
            {!skills.some((s) => s.id === check.skill) && <option value={check.skill}>{check.skill}</option>}
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="fld" title="Сложность смещает шанс: 50 — нейтральная, больше — сложнее">
          <span>Сложность</span>
          <input type="number" value={check.difficulty} onChange={(e) => ((check.difficulty = Number(e.target.value)), commit())} />
        </label>
      </div>
      <details className="dlg-else" open={!!check.mods?.length}>
        <summary>Изменённая сложность при условиях ({check.mods?.length ?? 0})</summary>
        {(check.mods ?? []).map((m, i) => (
          <div key={i} className="dlg-check-mod">
            <CondListEditor conds={m.conds} store={store} commit={commit} onChange={(v) => ((m.conds = v), commit())} />
            <label className="fld fld-inline">
              <span>Сложность</span>
              <input type="number" value={m.value} onChange={(e) => ((m.value = Number(e.target.value)), commit())} />
            </label>
            <button className="btn btn-small ce-del" onClick={() => (check.mods!.splice(i, 1), commit())}>✕</button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            check.mods = [...(check.mods ?? []), { conds: [blankCond('flag')], value: check.difficulty - 20 }]
            commit()
          }}
        >
          + вариант сложности
        </button>
      </details>
      <div className="dlg-branch dlg-branch-ok">
        <span className="fld-caption">✔ Успех</span>
        <SectionListEditor sections={check.success.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        <GotoSelect label="После успеха" doc={doc} value={check.success.goto} onChange={(v) => ((check.success.goto = v), commit())} />
      </div>
      <div className="dlg-branch dlg-branch-fail">
        <span className="fld-caption">✘ Провал</span>
        <SectionListEditor sections={check.fail.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        <GotoSelect label="После провала" doc={doc} value={check.fail.goto} onChange={(v) => ((check.fail.goto = v), commit())} />
      </div>
    </div>
  )
}
