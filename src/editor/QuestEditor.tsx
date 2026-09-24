import { useState } from 'react'
import type { QuestDef } from '../shared/types'
import type { EditorStore } from './store'
import { ConditionListEditor, EffectListEditor } from './Fields'

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
            <span>id</span>
            <input value={quest.id} onChange={(e) => ((quest.id = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Название</span>
            <input value={quest.label} onChange={(e) => ((quest.label = e.target.value), commit())} />
          </label>
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
        {Object.entries(quest.journal_entries).map(([key, text]) => (
          <div key={key} className="journal-row">
            <input
              className="journal-key"
              value={key}
              onChange={(e) => {
                const entries = Object.entries(quest.journal_entries)
                quest.journal_entries = Object.fromEntries(
                  entries.map(([k, v]) => (k === key ? [e.target.value, v] : [k, v])),
                )
                commit()
              }}
            />
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
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            quest.journal_entries[`entry_${Object.keys(quest.journal_entries).length + 1}`] = ''
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
                value={stage.id}
                onChange={(e) => ((stage.id = e.target.value), commit())}
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
                  value={stage.outcome ?? 'success'}
                  onChange={(e) => ((stage.outcome = e.target.value as 'success' | 'failure'), commit())}
                >
                  <option value="success">успех</option>
                  <option value="failure">провал</option>
                </select>
              )}
              <button
                className="btn btn-small ce-del"
                onClick={() => {
                  quest.stages.splice(si, 1)
                  commit()
                }}
              >
                ✕
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
                      <input
                        list={`stages-${quest.id}`}
                        value={tr.to}
                        onChange={(e) => ((tr.to = e.target.value), commit())}
                      />
                    </label>
                    <button
                      className="btn btn-small ce-del"
                      onClick={() => {
                        stage.transitions!.splice(ti, 1)
                        commit()
                      }}
                    >
                      ✕
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
        <datalist id={`stages-${quest.id}`}>
          {quest.stages.map((s) => (
            <option key={s.id} value={s.id} />
          ))}
        </datalist>
        <button
          className="btn btn-small"
          onClick={() => {
            quest.stages.push({ id: `stage_${quest.stages.length + 1}` })
            commit()
          }}
        >
          + стадия
        </button>
      </div>
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
