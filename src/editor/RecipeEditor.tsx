import { useState, useMemo } from 'react'
import { Ico } from '../shared/icons'
import type { RecipeDef, ItemDef } from '../shared/types'
import type { EditorStore } from './store'
import { ConditionListEditor, FileAdvancedJson, RefSelect } from './Fields'
import { SoundSelect } from './AudioSection'

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

  const allItemEntities = useMemo(() => {
    return store.entityPaths()
      .map((p) => store.entity(p))
      .filter((e): e is ItemDef => e?.type === 'item')
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [store])

  const workbenchEntities = useMemo(() => {
    return allItemEntities.filter((e) =>
      e.category === 'workbench' ||
      e.id === 'item_bench' ||
      e.id.includes('bench') ||
      e.id.includes('table') ||
      e.id.includes('stove') ||
      e.id.includes('forge') ||
      e.id.includes('anvil') ||
      e.interact_options?.some((o) => o.effects?.some((ef) => ef.type === 'open_craft')),
    )
  }, [allItemEntities])

  const otherItemEntities = useMemo(() => {
    const wbSet = new Set(workbenchEntities.map((w) => w.id))
    return allItemEntities.filter((e) => !wbSet.has(e.id))
  }, [allItemEntities, workbenchEntities])

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
        <label className="fld fld-check" data-tip="Результат — не новый предмет, а полная прочность изношенного экземпляра. Нужен изношенный экземпляр результата.">
          <input
            type="checkbox"
            checked={!!recipe.repair}
            onChange={(e) => ((recipe.repair = e.target.checked || undefined), commit())}
          />
          <span>Рецепт починки (восстанавливает прочность)</span>
        </label>
        <label className="fld" data-tip="Какое рабочее место требуется герою для изготовления. Если выбрано «Не требуется», предмет можно сделать прямо на ходу в сумке.">
          <span>Рабочее место / верстак</span>
          <select
            value={
              recipe.workbench === true
                ? '__any_workbench__'
                : typeof recipe.workbench === 'string'
                  ? recipe.workbench
                  : ''
            }
            onChange={(e) => {
              const val = e.target.value
              if (!val) {
                delete recipe.workbench
              } else if (val === '__any_workbench__') {
                recipe.workbench = true
              } else {
                recipe.workbench = val
              }
              commit()
            }}
          >
            <option value="">🎒 Не требуется (крафт на ходу в сумке / на коленке)</option>
            <option value="__any_workbench__">⚒ Любой верстак / мастерская общего типа</option>
            {workbenchEntities.length > 0 && (
              <optgroup label="Оборудование и станки кампании">
                {workbenchEntities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.label}
                  </option>
                ))}
              </optgroup>
            )}
            {otherItemEntities.length > 0 && (
              <optgroup label="Другие предметы и мебель">
                {otherItemEntities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="fld fld-check" data-tip="Пока рецепт не открыт по ходу игры (правилом, разговором или событием), его нет во вкладке «Изготовление». Так делают редкие рецепты: герой сначала находит знание.">
          <input
            type="checkbox"
            checked={recipe.known === false}
            onChange={(e) => {
              if (e.target.checked) recipe.known = false
              else delete recipe.known
              commit()
            }}
          />
          <span>Открыть по ходу игры (находится героем)</span>
        </label>
        <label className="fld">
          <span>Сообщение об успехе (пусто — стандартное)</span>
          <input value={recipe.message ?? ''} onChange={(e) => ((recipe.message = e.target.value || undefined), commit())} />
        </label>
        <div className="audio-row" style={{ padding: '4px 0' }} data-tip="Индивидуальный звук крафта: звон наковальни, бульканье зелья, шитьё и т.д.">
          <span className="audio-label">Звук создания</span>
          <SoundSelect
            store={store}
            value={recipe.sound}
            onChange={(snd) => {
              if (snd) recipe.sound = snd
              else delete recipe.sound
              commit()
            }}
          />
        </div>
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
