/**
 * Вкладка «Предметы», вторая половина: финальные экраны (концовки) и категории
 * предметов.
 *
 * Вынесено из `CampaignEditor.tsx`: это продолжение вкладки предметов —
 * выходы игры и их категории.
 */

import { Ico } from '../shared/icons'
import { ConditionListEditor, ImageUpload } from './Fields'
import { makeId } from './ids'
import type { EndingDef } from '../shared/types'
import { askText } from './prompt'
import { SoundHookMapEditor } from './AudioSection'
import type { CampaignTabProps } from './campaignTabProps'

export function CampaignItemsExtras({ store, m, commit }: CampaignTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>Финальные экраны (концовки)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Сколько угодно финалов: движок берёт <strong>первую</strong> подходящую
          (исход + все условия). Ставьте узкие ветки (флаг/квест) выше, общие
          и без условий — в конец. Без подходящей — стандартный экран
          («Забег окончен» / «Победа»).
        </div>
        {(m.endings ?? []).map((en, i) => (
          <div key={i} className="prof-card">
            <div className="prof-card-head">
              <label className="fld"><span>Название (для редактора)</span>
                <input value={en.label} onChange={(e) => ((en.label = e.target.value), commit())} />
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить концовку" onClick={() => ((m.endings = m.endings!.filter((_, x) => x !== i)), commit())}><Ico n="close" /></button>
            </div>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld"><span>Заголовок экрана</span>
                <input value={en.title} onChange={(e) => ((en.title = e.target.value), commit())} />
              </label>
              <label className="fld"><span>Тон экрана</span>
                <select
                  value={en.tone ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) en.tone = v as EndingDef['tone']
                    else delete en.tone
                    commit()
                  }}
                >
                  <option value="">По исходу (гибель/победа)</option>
                  <option value="death">Гибель</option>
                  <option value="victory">Победа</option>
                  <option value="neutral">Нейтральный</option>
                </select>
              </label>
              <label className="fld"><span>К исходу</span>
                <select
                  value={en.on ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) en.on = v as EndingDef['on']
                    else delete en.on
                    commit()
                  }}
                >
                  <option value="">Любой исход</option>
                  <option value="death">Только гибель</option>
                  <option value="victory">Только победа</option>
                </select>
              </label>
            </div>
            <label className="fld"><span>Текст концовки</span>
              <textarea rows={3} value={en.text ?? ''} onChange={(e) => ((en.text = e.target.value || undefined), commit())} />
            </label>
            <ImageUpload
              label="Фон финала (необязательно)"
              value={en.image ?? ''}
              dir="assets/img/endings"
              store={store}
              onChange={(p) => {
                if (p) en.image = p
                else delete en.image
                commit()
              }}
            />
            <div className="prof-sec">Условия (все сразу; пусто — всегда):</div>
            <ConditionListEditor
              store={store}
              conditions={en.conditions ?? []}
              onChange={(v) => {
                if (v.length) en.conditions = v
                else delete en.conditions
                commit()
              }}
            />
          </div>
        ))}
        <button className="btn btn-small" onClick={async () => {
          const label = await askText('Название концовки', 'например «Банда разбита»')
          if (!label) return
          ;(m.endings ??= []).push({ id: makeId('ending_', label, m.endings?.map((x) => x.id) ?? []), label, title: label })
          commit()
        }}>+ концовка</button>
      </div>

      <div className="props-group">
        <h4>Категории предметов</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Категория определяет, что умеет предмет: восстанавливать здоровье или потребности,
          быть оружием или бронёй. Поля в форме предмета появляются по его категории.
        </div>
        {(m.item_categories ?? []).map((c, i) => (
          <div key={i} className="itemcat-card">
            <div className="fld-row need-row">
              <label className="fld">
                <span>Название</span>
                <input value={c.label} onChange={(e) => ((c.label = e.target.value), commit())} />
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.item_categories!.splice(i, 1), commit())}><Ico n="close" /> </button>
            </div>
            {/* галочки возможностей категории: сетка с переносом — без
                горизонтальной прокрутки, сколько бы их ни было */}
            <div className="itemcat-checks">
              <label className="fld fld-check" data-tip="Предметы категории можно использовать для лечения">
                <input type="checkbox" checked={!!c.restores_hp} onChange={(e) => {
                  if (e.target.checked) c.restores_hp = true
                  else delete c.restores_hp
                  commit()
                }} />
                <span>Лечит (HP)</span>
              </label>
              {m.needs.map((n) => (
                <label key={n.id} className="fld fld-check" data-tip={`Предметы категории восстанавливают «${n.label}»`}>
                  <input
                    type="checkbox"
                    checked={(c.restores_needs ?? []).includes(n.id)}
                    onChange={(e) => {
                      const set = new Set(c.restores_needs ?? [])
                      if (e.target.checked) set.add(n.id)
                      else set.delete(n.id)
                      if (set.size) c.restores_needs = [...set]
                      else delete c.restores_needs
                      commit()
                    }}
                  />
                  <span>{n.label}</span>
                </label>
              ))}
              <label className="fld fld-check">
                <input type="checkbox" checked={!!c.is_weapon} onChange={(e) => {
                  if (e.target.checked) c.is_weapon = true
                  else delete c.is_weapon
                  commit()
                }} />
                <span>Оружие</span>
              </label>
              <label className="fld fld-check">
                <input type="checkbox" checked={!!c.is_armor} onChange={(e) => {
                  if (e.target.checked) c.is_armor = true
                  else delete c.is_armor
                  commit()
                }} />
                <span>Броня</span>
              </label>
            </div>
            <details>
              <summary><Ico n="sound" />  Звуки действий предметов этой категории</summary>
              <SoundHookMapEditor
                store={store}
                value={c.sounds ?? (c.sounds = {})}
                onChange={commit}
                heading="Звуки действий (для категории)"
              />
            </details>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название категории предметов', 'например «Зелья»')
            if (!label) return
            if (!m.item_categories) m.item_categories = []
            m.item_categories.push({ id: makeId('cat_', label, m.item_categories.map((x) => x.id)), label })
            commit()
          }}
        >
          + категория
        </button>
      </div>


        </>
  )
}
