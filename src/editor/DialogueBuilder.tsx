import { DEFAULT_EMOTION } from '../shared/types'
import { Ico } from '../shared/icons'
import { useRef, useState } from 'react'
import type { EditorStore } from './store'
import { makeId } from './ids'
import { askText, askConfirm } from './prompt'
import { FlagSelect, AudioUpload } from './Fields'
import {
  generateInk,
  migrateDlgDoc,
  parseTokens,
  tokenString,
  TOKEN_KINDS,
  type TokenKind,
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

/** настроения для диалога: общий реестр кампании (фидбек 9.14) + ключи портретов NPC */
function emotionsFor(store: EditorStore, inkPath: string): Array<{ id: DlgEmotion; label: string }> {
  const reg = store.meta.emotions ?? []
  const out: Array<{ id: DlgEmotion; label: string }> = [
    { id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label },
    ...reg.filter((e) => e.id !== DEFAULT_EMOTION.id).map((e) => ({ id: e.id, label: e.label })),
  ]
  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    if (e?.type !== 'npc' || e.dialogue !== inkPath) continue
    for (const key of Object.keys(e.portrait ?? {})) {
      if (!out.some((em) => em.id === key)) out.push({ id: key, label: key })
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
  { id: 'play_cutscene', label: 'Показать катсцену' },
  { id: 'set_description', label: 'Изменить описание' },
  { id: 'apply_status', label: 'Наложить статус' },
  { id: 'remove_status', label: 'Снять статус' },
  { id: 'set_weather', label: 'Сменить погоду' },
  { id: 'unlock_codex', label: 'Открыть запись кодекса' },
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
    case 'play_cutscene': return { type, cutscene: '' }
    case 'set_description': return { type, entity: '', text: '' }
    case 'apply_status': return { type, status: '' }
    case 'remove_status': return { type, status: '' }
    case 'set_weather': return { type, weather: '' }
    case 'unlock_codex': return { type, entry: '' }
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
  { id: 'has_status', label: 'Есть статус' },
  { id: 'has_status!', label: 'Статуса НЕТ' },
  { id: 'weather_is', label: 'Погода сейчас' },
  { id: 'weather_is!', label: 'Погода НЕ такая' },
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
    case 'has_status': return { type, status: '', not }
    case 'weather_is': return { type, weather: '', not }
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
            {i === 0 ? '' : ''}{n.label}
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
              <Ico n="close" /> 
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
      <details className="advanced-json">
        <summary>Ink-исходник (генерируется из конструктора автоматически)</summary>
        <textarea
          readOnly
          rows={14}
          spellCheck={false}
          value={store.textFiles.get(path) ?? generateInk(doc)}
          style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }}
        />
      </details>
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
              <Ico n="warn" />  Нет всегда доступного варианта — конструктор добавит «Закончить разговор» автоматически.
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
        <option value="end"><Ico n="stop" />  конец разговора</option>
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
          <button className="btn btn-small ce-del" onClick={() => onChange(conds.filter((_, j) => j !== i))}><Ico n="close" /> </button>
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
    case 'has_status':
      return <InlineRef kind="status" store={store} value={c.status} onChange={(v) => ((c.status = v), commit())} />
    case 'weather_is':
      return <InlineRef kind="weather" store={store} value={c.weather} onChange={(v) => ((c.weather = v), commit())} />
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
            <LineRow
              line={st.line}
              store={store}
              emotions={emotions}
              commit={commit}
              onRemove={() => onChange(steps.filter((_, j) => j !== i))}
            />
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
                <button className="btn btn-small ce-del" data-tip="Удалить блок" onClick={() => (sections.splice(i, 1), commit())}><Ico n="close" />  блок</button>
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
        <option value="end"><Ico n="stop" />  конец разговора</option>
        <option value="stay">↩ к вариантам ответа</option>
        {doc.nodes.map((n) => (
          <option key={n.id} value={n.id}>→ {n.label}</option>
        ))}
      </select>
    </label>
  )
}

// ─────────────── реплика и действие ───────────────

/**
 * Предпросмотр реплики: токены заменены русскими названиями
 * (мастер видит, как фраза будет выглядеть в игре) — итерация 8, блок B.
 */
function LinePreview({ text, store }: { text: string; store: EditorStore }) {
  const parts = parseTokens(text)
  if (!parts.some((p) => p.token)) return null
  const nameOf = (kind: TokenKind, id: string): string => {
    if (kind === 'count') return store.labelFor('item', id)
    if (kind === 'need') return store.labelFor('need', id)
    if (kind === 'skill') return store.labelFor('skill', id)
    return 'здоровье'
  }
  return (
    <div className="dlg-line-preview">
      <span className="muted small">В игре: </span>
      {parts.map((p, i) =>
        p.token ? (
          <b key={i} data-tip={p.text}>
            {nameOf(p.token.kind, p.token.id)}
          </b>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  )
}

/** Кнопка «{ } Вставить значение»: выбор типа и объекта → токен в позицию курсора. */
function TokenInserter({
  store,
  onInsert,
}: {
  store: EditorStore
  onInsert: (token: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<TokenKind>('count')
  const options = optionsForToken(store, kind)
  const [id, setId] = useState<string>('')
  const value = id || options[0]?.id || ''
  if (!open) {
    return (
      <button className="btn btn-small" data-tip="Вставить в реплику значение из игры (счётчик предмета, здоровье…)" onClick={() => setOpen(true)}>
        {'{ }'} Вставить значение
      </button>
    )
  }
  return (
    <div className="token-inserter">
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as TokenKind)
          setId('')
        }}
      >
        {TOKEN_KINDS.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      {options.length > 0 && (
        <select value={value} onChange={(e) => setId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
      <button
        className="btn btn-small btn-primary"
        onClick={() => {
          onInsert(tokenString(kind, options.length ? value : undefined))
          setOpen(false)
          setId('')
        }}
      >
        Вставить
      </button>
      <button className="btn btn-small" onClick={() => setOpen(false)}>Отмена</button>
      <span className="muted small">{TOKEN_KINDS.find((t) => t.id === kind)?.hint}</span>
    </div>
  )
}

function optionsForToken(store: EditorStore, kind: TokenKind): Array<{ id: string; label: string }> {
  if (kind === 'count') return store.options('item')
  if (kind === 'need') return store.options('need')
  if (kind === 'skill') return store.options('skill')
  if (kind === 'currency') return store.options('currency')
  if (kind === 'stat')
    return [
      { id: 'STR', label: 'Сила (СИЛ)' },
      { id: 'CON', label: 'Выносливость (ВЫН)' },
      { id: 'SIZ', label: 'Размер (РАЗ)' },
      { id: 'DEX', label: 'Ловкость (ЛОВ)' },
      { id: 'INT', label: 'Интеллект (ИНТ)' },
      { id: 'POW', label: 'Дух (ДУХ)' },
      { id: 'CHA', label: 'Харизма (ХАР)' },
    ]
  return []
}

function LineRow({
  line,
  store,
  onRemove,
  commit,
  emotions = [{ id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label }],
}: {
  line: DlgLine
  store: EditorStore
  onRemove?: () => void
  commit: () => void
  emotions?: Array<{ id: DlgEmotion; label: string }>
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(!!line.voice)
  const insert = (token: string) => {
    const el = areaRef.current
    const at = caret.current ?? el?.selectionStart ?? line.text.length
    line.text = line.text.slice(0, at) + token + line.text.slice(at)
    commit()
    requestAnimationFrame(() => {
      const pos = at + token.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
      caret.current = pos
    })
  }
  return (
    <div className="dlg-line-row">
      <textarea
        ref={areaRef}
        rows={2}
        value={line.text}
        placeholder="Текст реплики…"
        onChange={(e) => {
          line.text = e.target.value
          caret.current = e.target.selectionStart
          commit()
        }}
        onSelect={(e) => (caret.current = (e.target as HTMLTextAreaElement).selectionStart)}
      />
      <LinePreview text={line.text} store={store} />
      <div className="dlg-line-opts">
        <TokenInserter store={store} onInsert={insert} />
        <select
          value={line.emotion ?? 'neutral'}
          data-tip="Настроение (состояние портрета)"
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
        <label className="fld-check small" data-tip="Ремарка — описание действия, выводится курсивом">
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
        <button
          className={`btn btn-small ${line.voice ? 'btn-primary' : ''}`}
          data-tip={line.voice ? `Озвучка: ${line.voice} (нажмите, чтобы изменить)` : 'Озвучка реплики: файл или ссылка'}
          onClick={() => setVoiceOpen(!voiceOpen)}
        >
          <Ico n="mic" />{line.voice ? '' : ''}
        </button>
        {onRemove && (
          <button className="btn btn-small ce-del" onClick={onRemove}><Ico n="close" /> </button>
        )}
      </div>
      {voiceOpen && (
        <div className="dlg-line-voice">
          <AudioUpload
            label="Озвучка реплики (файл или ссылка; без неё возможен синтезатор в настройках игрока)"
            value={line.voice ?? ''}
            dir="assets/voice"
            store={store}
            onChange={(v) => {
              if (v) line.voice = v
              else delete line.voice
              commit()
            }}
          />
        </div>
      )}
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
      {e.type === 'set_description' && (
        <>
          <InlineRef kind="entity" store={store} value={e.entity} onChange={(v) => ((e.entity = v), commit())} />
          <input value={e.text} placeholder="Новое описание" onChange={(ev) => ((e.text = ev.target.value), commit())} />
        </>
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
      {e.type === 'play_cutscene' && (
        <InlineRef kind="cutscene" store={store} value={e.cutscene} onChange={(v) => ((e.cutscene = v), commit())} />
      )}
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
      {e.type === 'apply_status' && (
        <>
          <InlineRef kind="status" store={store} value={e.status} onChange={(v) => ((e.status = v), commit())} />
          <input
            type="number"
            min={0}
            value={e.duration ?? 0}
            data-tip="Длительность в тиках (0 — из реестра)"
            onChange={(ev) => {
              const v = Math.max(0, Number(ev.target.value) || 0)
              if (v > 0) e.duration = v
              else delete e.duration
              commit()
            }}
          />
          <span className="muted small">тиков (0 — из реестра)</span>
        </>
      )}
      {e.type === 'remove_status' && (
        <InlineRef kind="status" store={store} value={e.status} onChange={(v) => ((e.status = v), commit())} />
      )}
      {e.type === 'set_weather' && (
        <InlineRef kind="weather" store={store} value={e.weather} onChange={(v) => ((e.weather = v), commit())} />
      )}
      {e.type === 'unlock_codex' && (
        <InlineRef kind="codex" store={store} value={e.entry} onChange={(v) => ((e.entry = v), commit())} />
      )}
      <button className="btn btn-small ce-del" onClick={onRemove}><Ico n="close" /> </button>
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
      <summary>▸ {c.text || '(без текста)'}{c.check ? '' : ''}{c.conds?.length ? '' : ''}</summary>
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
          <span>проверка навыка <Ico n="dice" /> </span>
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
        <button className="btn btn-small ce-del" onClick={onRemove}><Ico n="close" />  удалить ответ</button>
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
        <label className="fld" data-tip="Сложность смещает шанс: 50 — нейтральная, больше — сложнее">
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
            <button className="btn btn-small ce-del" onClick={() => (check.mods!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            check.mods = [...(check.mods ?? []), { conds: [blankCond('flag')], value: typeof check.difficulty === 'number' ? check.difficulty - 20 : 30 }]
            commit()
          }}
        >
          + вариант сложности
        </button>
      </details>
      <div className="dlg-branch dlg-branch-ok">
        <span className="fld-caption"><Ico n="check" />  Успех</span>
        <SectionListEditor sections={check.success.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        <GotoSelect label="После успеха" doc={doc} value={check.success.goto} onChange={(v) => ((check.success.goto = v), commit())} />
      </div>
      <div className="dlg-branch dlg-branch-fail">
        <span className="fld-caption"><Ico n="close" />  Провал</span>
        <SectionListEditor sections={check.fail.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        <GotoSelect label="После провала" doc={doc} value={check.fail.goto} onChange={(v) => ((check.fail.goto = v), commit())} />
      </div>
    </div>
  )
}
