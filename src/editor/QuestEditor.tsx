import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { QuestDef } from '../shared/types'
import type { EditorStore } from './store'
import { makeId } from './ids'
import { ConditionListEditor, EffectListEditor, FileAdvancedJson, ChapterSelect } from './Fields'
import { askText } from './prompt'

/** Визуальный конструктор квестов (ТЗ 5.2.5): стадии, переходы, журнал. */
export function QuestEditor({ store, path }: { store: EditorStore; path: string }) {
  const quest = store.quest(path)
  const [, force] = useState(0)
  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Квест</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Название</span>
            <input value={quest.label} onChange={(e) => ((quest.label = e.target.value), commit())} />
          </label>
            <ChapterSelect store={store} value={quest.chapter} onChange={(v) => ((quest.chapter = v), commit())} />
        </div>
        <label className="fld fld-block">
          <span>Описание</span>
          <textarea
            rows={2}
            value={quest.description}
            onChange={(e) => ((quest.description = e.target.value), commit())}
          />
        </label>
      </div>

      <div className="props-group">
        <h4>Журнальные записи</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Каждая запись привязана к стадии: когда квест доходит до стадии, текст появляется
          в журнале игрока.
        </div>
        {Object.entries(quest.journal_entries).map(([key, text]) => (
          <div key={key} className="journal-row">
            <select
              className="journal-key"
              value={key}
              onChange={(e) => {
                const entries = Object.entries(quest.journal_entries)
                quest.journal_entries = Object.fromEntries(
                  entries.map(([k, v]) => (k === key ? [e.target.value, v] : [k, v])),
                )
                commit()
              }}
            >
              {!quest.stages.some((st) => st.id === key) && <option value={key}>{key}</option>}
              {quest.stages.map((st) => (
                <option key={st.id} value={st.id} disabled={st.id !== key && quest.journal_entries[st.id] !== undefined}>
                  {st.label ?? st.id}
                </option>
              ))}
            </select>
            <textarea
              rows={1}
              value={text}
              onChange={(e) => ((quest.journal_entries[key] = e.target.value), commit())}
            />
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                delete quest.journal_entries[key]
                commit()
              }}
            >
              <Ico n="close" /> 
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            const free = quest.stages.find((st) => quest.journal_entries[st.id] === undefined)
            quest.journal_entries[free?.id ?? `entry_${Object.keys(quest.journal_entries).length + 1}`] = ''
            commit()
          }}
        >
          + запись
        </button>
      </div>

      <div className="props-group">
        <h4>Стадии</h4>
        {quest.stages.map((stage, si) => (
          <div key={si} className="stage-card">
            <div className="stage-head">
              <input
                className="stage-id"
                value={stage.label ?? stage.id}
                placeholder="Название стадии"
                onChange={(e) => ((stage.label = e.target.value), commit())}
              />
              <label className="fld fld-check">
                <input
                  type="checkbox"
                  checked={!!stage.final}
                  onChange={(e) => {
                    if (e.target.checked) stage.final = true
                    else {
                      delete stage.final
                      delete stage.outcome
                    }
                    commit()
                  }}
                />
                <span>финальная</span>
              </label>
              {stage.final && (
                <select
                  className={`sel-outcome ${stage.outcome ?? 'success'}`}
                  value={stage.outcome ?? 'success'}
                  onChange={(e) => ((stage.outcome = e.target.value as 'success' | 'failure'), commit())}
                >
                  <option value="success" className="sel-outcome-success">успех</option>
                  <option value="failure" className="sel-outcome-failure">провал</option>
                </select>
              )}
              <button
                className="btn btn-small ce-del"
                onClick={() => {
                  quest.stages.splice(si, 1)
                  commit()
                }}
              >
                <Ico n="close" /> 
              </button>
            </div>

            <details>
              <summary>Эффекты при входе ({stage.on_enter_effects?.length ?? 0})</summary>
              <EffectListEditor
                store={store}
                effects={stage.on_enter_effects ?? []}
                onChange={(e) => ((stage.on_enter_effects = e), commit())}
              />
            </details>

            <details open={!!stage.transitions?.length}>
              <summary>Переходы ({stage.transitions?.length ?? 0})</summary>
              {(stage.transitions ?? []).map((tr, ti) => (
                <div key={ti} className="transition-card">
                  <div className="fld-row">
                    <label className="fld">
                      <span>→ стадия</span>
                      <select value={tr.to} onChange={(e) => ((tr.to = e.target.value), commit())}>
                        {!quest.stages.some((st) => st.id === tr.to) && <option value={tr.to}>{tr.to || '— выбрать —'}</option>}
                        {quest.stages.map((st) => (
                          <option key={st.id} value={st.id}>{st.label ?? st.id}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn btn-small ce-del"
                      onClick={() => {
                        stage.transitions!.splice(ti, 1)
                        commit()
                      }}
                    >
                      <Ico n="close" /> 
                    </button>
                  </div>
                  <ConditionListEditor
                    store={store}
                    conditions={tr.conditions}
                    onChange={(c) => ((tr.conditions = c), commit())}
                  />
                </div>
              ))}
              <button
                className="btn btn-small"
                onClick={() => {
                  ;(stage.transitions ?? (stage.transitions = [])).push({ to: '', conditions: [] })
                  commit()
                }}
              >
                + переход
              </button>
            </details>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название стадии', 'например «Поговорить с торговцем»')
            if (!label) return
            quest.stages.push({ id: makeId('', label, quest.stages.map((st) => st.id)), label })
            commit()
          }}
        >
          + стадия
        </button>
      </div>
    
      <FileAdvancedJson store={store} path={path} commit={() => store.touch(path)} />
</div>
  )
}

export function newQuest(id: string): QuestDef {
  return {
    id,
    label: 'Новый квест',
    description: '',
    journal_entries: { started: 'Квест начат.' },
    stages: [
      { id: 'started', on_enter_effects: [], transitions: [] },
      { id: 'completed', final: true, outcome: 'success' },
    ],
  }
}
