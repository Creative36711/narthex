import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { QuestDef } from '../shared/types'
import type { EditorStore } from './store'
import { makeId } from './ids'
import { ConditionListEditor, EffectListEditor, FileAdvancedJson, ChapterSelect } from './Fields'
import { askText } from './prompt'
import { journalEntryStageLabels, nextJournalEntryKey } from './questJournal'

/** Визуальный конструктор квестов (ТЗ 5.2.5): стадии, переходы, журнал. */
export function QuestEditor({ store, path }: { store: EditorStore; path: string }) {
  const quest = store.quest(path)
  const [, force] = useState(0)
  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  if (!quest) {
    return (
      <div className="rule-editor">
        <div className="editor-empty-main">
          <h3 className="editor-empty-title">Квест не найден</h3>
          <p className="muted">Модуль «{path}» отсутствует в загруженной кампании или не указан корректно в manifest.json.</p>
        </div>
      </div>
    )
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
          Записи имеют собственные внутренние ключи. Стадии добавляют их в журнал эффектом; ключ записи
          не обязан совпадать с id стадии.
        </div>
        {Object.entries(quest.journal_entries).map(([key, text], index) => {
          const stages = journalEntryStageLabels(quest, key)
          return (
            <div key={key} className="journal-row">
              <div className="journal-entry-label" title={`Внутренний ключ: ${key}`}>
                <strong>Запись {index + 1}</strong>
                {stages.length > 0 && <span>{stages.join(' / ')}</span>}
              </div>
              <textarea
                rows={1}
                aria-label={`Текст журнальной записи ${index + 1}`}
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
          )
        })}
        <button
          className="btn btn-small"
          onClick={() => {
            quest.journal_entries[nextJournalEntryKey(quest.journal_entries)] = ''
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
                  {/* без глифов- dingbat'ов: цвет задаёт CSS по value (см. editor.css) */}
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
