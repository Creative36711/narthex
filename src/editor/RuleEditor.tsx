import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { RuleDef } from '../shared/types'
import type { EditorStore } from './store'
import { ConditionListEditor, EffectListEditor, FileAdvancedJson, ChapterSelect } from './Fields'

/** Визуальный конструктор правил (ТЗ 5.2.4): условия + эффекты. */
export function RuleEditor({ store, path }: { store: EditorStore; path: string }) {
  const rule = store.rule(path)
  // защита от битых правил (импорт ИИ-кампании): массивы могут отсутствовать —
  // восстанавливаем до рендера, иначе `reading 'length'` роняет весь редактор
  if (!Array.isArray(rule.conditions)) rule.conditions = []
  if (!Array.isArray(rule.effects)) rule.effects = []
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
        <ChapterSelect store={store} value={rule.chapter} onChange={(v) => ((rule.chapter = v), commit())} />
        <label className="fld" data-tip="Когда движок должен проверять это правило">
          <span>Событийный триггер</span>
          <select
            value={rule.trigger ?? 'always'}
            onChange={(e) => {
              const v = e.target.value as RuleDef['trigger']
              if (!v || v === 'always') delete rule.trigger
              else rule.trigger = v
              commit()
            }}
          >
            <option value="always">При любом событии / изменении (по умолчанию)</option>
            <option value="enter_scene">При входе в сцену (enter_scene)</option>
            <option value="leave_scene">При выходе из сцены (leave_scene)</option>
            <option value="interact">При клике / взаимодействии (interact)</option>
            <option value="time_tick">При ходе / тике времени (time_tick)</option>
          </select>
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
        <h4>Группы «или» (хватает хотя бы одной)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Необязательно. Если групп нет — работают только условия выше. Если группы есть —
          правило сработает, когда верны все условия выше <b>и</b> хотя бы одна группа целиком.
          Внутри группы условия складываются по «И», между группами — по «или».
        </div>
        {(rule.conditions_any ?? []).map((group, gi) => (
          <div key={gi} className="panel" style={{ padding: 8, marginBottom: 8 }}>
            <div className="fld-row" style={{ alignItems: 'center', marginBottom: 6 }}>
              <b>
                Группа «или» №{gi + 1}
              </b>
              <span className="muted small">все условия группы должны выполниться</span>
              <button
                className="btn btn-small ce-del"
                style={{ marginLeft: 'auto' }}
                data-tip="Убрать группу целиком"
                onClick={() => {
                  rule.conditions_any = (rule.conditions_any ?? []).filter((_, j) => j !== gi)
                  if (!rule.conditions_any.length) delete rule.conditions_any
                  commit()
                }}
              >
                <Ico n="close" /> убрать
              </button>
            </div>
            <ConditionListEditor
              store={store}
              conditions={group}
              onChange={(c) => {
                rule.conditions_any = (rule.conditions_any ?? []).map((g, j) => (j === gi ? c : g))
                commit()
              }}
            />
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            rule.conditions_any = [...(rule.conditions_any ?? []), []]
            commit()
          }}
        >
          <Ico n="plus" /> Группа
        </button>
      </div>

      <div className="props-group">
        <h4>Эффекты (по порядку)</h4>
        <EffectListEditor store={store} effects={rule.effects} onChange={(e) => ((rule.effects = e), commit())} />
      </div>
    
      <FileAdvancedJson store={store} path={path} commit={() => store.touch(path)} />
</div>
  )
}

export function newRule(id: string): RuleDef {
  return { id, label: 'Новое правило', once: true, conditions: [], effects: [] }
}
