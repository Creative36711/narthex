

/**
 * Кубики и множественный выбор: редактор бросков и чипы.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */

import { Ico } from '../shared/icons'
import type { DiceRules } from '../shared/types'
import { CLASSIC_DICE_RULES, DEFAULT_DICE_RULES } from '../shared/types'
/**
 * Кубики и множественный выбор: редактор бросков и чипы.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */


export function ChipMultiSelect({
  options,
  value,
  onChange,
  emptyLabel,
  className = '',
}: {
  options: Array<{ id: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
  emptyLabel: string
  className?: string
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className={`chips chip-multi ${className}`}>
      {options.length === 0 && <span className="muted small">{emptyLabel}</span>}
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip ${value.includes(o.id) ? 'chip-on' : ''}`}
          onClick={() => toggle(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Секция «Правила бросков (d100)» (итерация 8, А7): пресеты + ручная подстройка. */
export function DiceRulesEditor({
  value,
  commit,
}: {
  value: DiceRules
  commit: () => void
}) {
  const set = (patch: Partial<DiceRules>) => {
    Object.assign(value, patch)
    commit()
  }
  const preset = (p: 'generous' | 'classic') => {
    const r = p === 'classic' ? CLASSIC_DICE_RULES : DEFAULT_DICE_RULES
    Object.assign(value, { ...r })
    commit()
  }
  const isClassic =
    value.critical_divisor === CLASSIC_DICE_RULES.critical_divisor &&
    value.special_divisor === CLASSIC_DICE_RULES.special_divisor
  const isGenerous =
    value.critical_divisor === DEFAULT_DICE_RULES.critical_divisor &&
    value.special_divisor === DEFAULT_DICE_RULES.special_divisor &&
    !value.fumble_low_skill
  return (
    <div className="props-group">
      <h4>Правила бросков</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Пороги успеха и провала для проверок навыков. Показываются игроку в справке,
        поэтому менять их стоит до начала забега.
      </div>
      <div className="fld-row">
        <button
          className={`btn btn-small ${isGenerous ? 'btn-primary' : ''}`}
          onClick={() => preset('generous')}
          data-tip="Критический успех ≤ навык/5, особый ≤ навык/2, крит-провал 96–100"
        >
          <Ico n="dice" />  Хроника (по умолчанию)
        </button>
        <button
          className={`btn btn-small ${isClassic ? 'btn-primary' : ''}`}
          onClick={() => preset('classic')}
          data-tip="Критический успех ≤ навык/20, особый ≤ навык/5, крит-провал 00 или 96–100 при навыке ниже 30"
        >
          <Ico n="book" />  Классический BRP
        </button>
      </div>
      <div className="fld-row">
        <label className="fld" data-tip="Критический успех: бросок не больше «навык ÷ делитель»">
          <span>Крит: навык ÷</span>
          <input
            type="number"
            min={1}
            max={100}
            value={value.critical_divisor}
            onChange={(e) => set({ critical_divisor: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="fld" data-tip="Особый (хороший) успех: бросок не больше «навык ÷ делитель»">
          <span>Особый успех: навык ÷</span>
          <input
            type="number"
            min={1}
            max={100}
            value={value.special_divisor}
            onChange={(e) => set({ special_divisor: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="fld" data-tip="Критический провал начинается с этого броска">
          <span>Крит-провал с</span>
          <input
            type="number"
            min={2}
            max={100}
            value={value.fumble_from}
            onChange={(e) => set({ fumble_from: Math.min(100, Math.max(2, Number(e.target.value) || 96)) })}
          />
        </label>
      </div>
      <label className="fld fld-check" data-tip="Классический BRP: при низком навыке весь хвост 96–99 — тоже крит-провал">
        <input
          type="checkbox"
          checked={value.fumble_low_skill != null}
          onChange={(e) => {
            if (e.target.checked) value.fumble_low_skill = 30
            else delete value.fumble_low_skill
            commit()
          }}
        />
        <span>
          Весь хвост {value.fumble_from}–99 — провал при навыке ниже{''}
          <input
            type="number"
            min={1}
            max={100}
            disabled={value.fumble_low_skill == null}
            value={value.fumble_low_skill ?? 30}
            onChange={(e) => set({ fumble_low_skill: Number(e.target.value) || 30 })}
            style={{ width: 64 }}
          />
        </span>
      </label>
      <div className="muted small">
        Пример при навыке 45: крит ≤ {Math.floor(45 / (value.critical_divisor || 1))}, особый успех ≤{''}
        {Math.floor(45 / (value.special_divisor || 1))}, успех ≤ 45, крит-провал{''}
        {value.fumble_low_skill != null && 45 < value.fumble_low_skill
          ? `${value.fumble_from}–100`
          : `100${value.fumble_from < 100 ? ` и ${value.fumble_from}–99 при промахе выше навыка` : ''}`}
        .
      </div>
    </div>
  )
}
