import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { RuleDef } from '../shared/types'
import type { EditorStore } from './store'
import { ConditionListEditor, EffectListEditor } from './Fields'

/** Визуальный конструктор правил (ТЗ 5.2.4): условия + эффекты. */
export function RuleEditor({ store, path }: { store: EditorStore; path: string }) {
  const rule = store.rule(path)
  const [, force] = useState(0)
  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Правило</h4>
        <label className="fld">
          <span>Название</span>
          <input value={rule.label} onChange={(e) => ((rule.label = e.target.value), commit())} />
        </label>
        <div className="fld-row">
          <label className="fld fld-check">
            <input type="checkbox" checked={rule.once} onChange={(e) => ((rule.once = e.target.checked), commit())} />
            <span>Срабатывает один раз</span>
          </label>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={!!rule.manual}
              onChange={(e) => {
                if (e.target.checked) rule.manual = true
                else delete rule.manual
                commit()
              }}
            />
            <span data-tip="Правило не проверяется само — его запускает эффект «Запустить правило» или диалог">Только ручной запуск</span>
          </label>
        </div>
        {!rule.manual && rule.conditions.length === 0 && !rule.once && (
          <div className="fld-err small">
            <Ico n="warn" />  Правило без условий, не однократное и не ручное — сработает при каждой проверке!
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Условия (все должны выполниться)</h4>
        <ConditionListEditor
          store={store}
          conditions={rule.conditions}
          onChange={(c) => ((rule.conditions = c), commit())}
        />
      </div>

      <div className="props-group">
        <h4>Эффекты (по порядку)</h4>
        <EffectListEditor store={store} effects={rule.effects} onChange={(e) => ((rule.effects = e), commit())} />
      </div>
    </div>
  )
}

export function newRule(id: string): RuleDef {
  return { id, label: 'Новое правило', once: true, conditions: [], effects: [] }
}
