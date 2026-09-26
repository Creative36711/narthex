import { useState } from 'react'
import { Ico } from '../shared/icons'
import type { RecipeDef } from '../shared/types'
import type { EditorStore } from './store'
import { ConditionListEditor, FileAdvancedJson, RefSelect } from './Fields'

export function newRecipe(id: string, label: string): RecipeDef {
  return { id, label, inputs: [], output: { item: '', quantity: 1 } }
}

/**
 * Редактор рецепта крафта (блок 4 ТЗ «Гибкий движок»):
 * компоненты, инструменты, проверка навыка, время, результат.
 */
export function RecipeEditor({ store, path }: { store: EditorStore; path: string }) {
  const recipe = store.recipe(path)
  const [, force] = useState(0)
  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Рецепт</h4>
        <label className="fld">
          <span>Название</span>
          <input value={recipe.label} onChange={(e) => ((recipe.label = e.target.value), commit())} />
        </label>
        <label className="fld">
          <span>Описание (видно игроку)</span>
          <textarea value={recipe.description ?? ''} onChange={(e) => ((recipe.description = e.target.value || undefined), commit())} />
        </label>
      </div>

      <div className="props-group">
        <h4>Компоненты (расходуются)</h4>
        {(recipe.inputs ?? []).map((inp, i) => (
          <div className="fld-row" key={i}>
            <RefSelect
              label="Предмет"
              kind="item"
              store={store}
              value={inp.item}
              onChange={(v) => ((recipe.inputs[i].item = v ?? ''), commit())}
            />
            <label className="fld fld-num">
              <span>Кол-во</span>
              <input
                type="number"
                min={1}
                value={inp.quantity}
                onChange={(e) => ((recipe.inputs[i].quantity = Math.max(1, Number(e.target.value) || 1)), commit())}
              />
            </label>
            <button
              className="btn btn-small ce-del"
              onClick={() => ((recipe.inputs = recipe.inputs.filter((_, j) => j !== i)), commit())}
            >
              <Ico n="trash" />
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => (((recipe.inputs ??= []).push({ item: '', quantity: 1 })), commit())}
        >
          <Ico n="plus" />  Добавить компонент
        </button>
      </div>

      <div className="props-group">
        <h4>Инструменты (не расходуются)</h4>
        {(recipe.tools ?? []).map((t, i) => (
          <div className="fld-row" key={i}>
            <RefSelect
              label="Инструмент"
              kind="item"
              store={store}
              value={t}
              onChange={(v) => ((recipe.tools![i] = v ?? ''), commit())}
            />
            <button
              className="btn btn-small ce-del"
              onClick={() => ((recipe.tools = recipe.tools!.filter((_, j) => j !== i)), commit())}
            >
              <Ico n="trash" />
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => (((recipe.tools ??= []).push('')), commit())}
        >
          <Ico n="plus" />  Добавить инструмент
        </button>
      </div>

      <div className="props-group">
        <h4>Изготовление</h4>
        <label className="fld fld-check">
          <input
            type="checkbox"
            checked={!!recipe.skill}
            onChange={(e) => {
              if (e.target.checked) recipe.skill = { id: store.options('skill')[0]?.id ?? '', difficulty: 40 }
              else delete recipe.skill
              commit()
            }}
          />
          <span>Проверка навыка при изготовлении</span>
        </label>
        {recipe.skill && (
          <div className="fld-row">
            <RefSelect
              label="Навык"
              kind="skill"
              store={store}
              value={recipe.skill.id}
              onChange={(v) => ((recipe.skill!.id = v ?? ''), commit())}
            />
            <label className="fld fld-num">
              <span>Сложность</span>
              <input
                type="number"
                min={5}
                max={95}
                value={recipe.skill.difficulty}
                onChange={(e) => ((recipe.skill!.difficulty = Number(e.target.value) || 40), commit())}
              />
            </label>
          </div>
        )}
        {recipe.skill && (
          <div className="muted small">Провал проверки сохраняет материалы. Успех ставит «галочку» роста навыка.</div>
        )}
        <label className="fld fld-num">
          <span>Время (тиков, 0 — мгновенно)</span>
          <input
            type="number"
            min={0}
            value={recipe.time_ticks ?? 0}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0)
              if (v > 0) recipe.time_ticks = v
              else delete recipe.time_ticks
              commit()
            }}
          />
        </label>
        <label className="fld">
          <span>Сообщение об успехе (пусто — стандартное)</span>
          <input value={recipe.message ?? ''} onChange={(e) => ((recipe.message = e.target.value || undefined), commit())} />
        </label>
      </div>

      <div className="props-group">
        <h4>Результат</h4>
        <RefSelect
          label="Предмет"
          kind="item"
          store={store}
          value={recipe.output?.item ?? ''}
          onChange={(v) => (((recipe.output ??= { item: '', quantity: 1 }).item = v ?? ''), commit())}
        />
        <label className="fld fld-num">
          <span>Количество</span>
          <input
            type="number"
            min={1}
            value={recipe.output?.quantity ?? 1}
            onChange={(e) => (((recipe.output ??= { item: '', quantity: 1 }).quantity = Math.max(1, Number(e.target.value) || 1)), commit())}
          />
        </label>
      </div>

      <div className="props-group">
        <h4>Условия доступности (все должны выполниться)</h4>
        <ConditionListEditor
          store={store}
          conditions={recipe.requires ?? []}
          onChange={(c) => ((recipe.requires = c.length ? c : undefined), commit())}
        />
      </div>

      <FileAdvancedJson store={store} path={path} commit={commit} />
    </div>
  )
}
