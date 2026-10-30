

/**
 * Реестры паспорта: длящиеся действия и версии кампании.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */

import { Ico } from '../shared/icons'
import { useEffect, useState } from 'react'
import type { EditorStore } from './store'
import { ConditionListEditor, EffectListEditor, RefSelect } from './Fields'
import type { CampaignMeta } from '../shared/types'
import { askText } from './prompt'
import { showList, showAlert } from '../shared/modals'
import { applyPublish, loadCompat, planPublish, storeInventory } from './compatPublish'
import type { PublishPlan } from './compatPublish'
import { diffReportLines } from '../shared/compat'
import { ENGINE_VERSION, PACKAGE_FORMAT, bumpVersion } from '../shared/versions'
import type { CampaignCompat } from '../shared/types'
/**
 * Реестры паспорта: длящиеся действия и версии кампании.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */


export function DurationActionsRegistry({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
  const list = (m.duration_actions ??= [])
  return (
    <div className="props-group">
      <h4>Длительные действия (сон, медитация, дежурство)</h4>
      <p className="muted small">
        Действие занимает часы игрового времени (потребности тикают, смерть во сне честна);
        длину в пределах «минимум…максимум» игрок выбирает в окне с прогнозом.
        Почасовые эффекты (потребности/ХП/усталость/рассудок) идут за каждый прожитый час:
        прервали на 3-м часу — герой получил пользу за 3 часа. Вероятность прерывания почасовая:
        за n часов она накапливается как 1−(1−шанс)ⁿ (0,05/час → ≈34% за 8 часов).
        Запуск — эффектом «Начать длительное действие» из диалога, правила или точки взаимодействия.
      </p>
      {list.map((d, i) => (
        <details key={d.id || i} className="need-conds" open>
          <summary>
            {d.label || '(без названия)'} · {d.min_ticks ?? 1}–{d.max_ticks ?? d.min_ticks ?? 1} {m.tick_label || 'ч'}
            <button
              className="btn btn-small ce-del"
              data-tip="Удалить действие"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                list.splice(i, 1)
                commit()
              }}
            >
              <Ico n="close" />
            </button>
          </summary>
          <div className="fld-row">
            <label className="fld">
              <span>Название</span>
              <input value={d.label} onChange={(e) => ((d.label = e.target.value), commit())} />
            </label>
            <label className="fld" data-tip="Id — для ссылки из эффекта «Начать длительное действие». После создания не меняется">
              <span>Id</span>
              <input value={d.id} readOnly style={{ opacity: 0.7 }} />
            </label>
            <label className="fld fld-num" data-tip="Минимум часов (не меньше 1)">
              <span>Минимум, тиков</span>
              <input type="number" min={1} value={d.min_ticks ?? 1} onChange={(e) => ((d.min_ticks = Math.max(1, Number(e.target.value) || 1)), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Максимум часов; равен минимуму — действие фиксированной длины (окно выбора не открывается)">
              <span>Максимум, тиков</span>
              <input type="number" min={1} value={d.max_ticks ?? d.min_ticks ?? 1} onChange={(e) => ((d.max_ticks = Math.max(1, Number(e.target.value) || 1)), commit())} />
            </label>
            <label className="fld fld-num" data-tip="Шаг выбора в окне: 1 — любое число часов, 2 — только 2/4/6…">
              <span>Шаг</span>
              <input type="number" min={1} value={d.step ?? 1} onChange={(e) => ((d.step = Math.max(1, Number(e.target.value) || 1)), commit())} />
            </label>
          </div>
          <div className="fld" data-tip="За каждый прожитый час ДО тикания потребностей. Белый список: Нет нужды → Потребность, Урон+ХП, Усталость, Рассудок — остальное двигатель пропускает с записью в журнал (и аудит ругается)">
            <span>Почасовые эффекты (за тик)</span>
            <EffectListEditor
              store={store}
              effects={d.per_tick ?? []}
              onChange={(fx) => ((d.per_tick = fx.length ? fx : undefined), commit())}
            />
          </div>
          <div className="fld-row">
            <label className="fld fld-num" data-tip="Честная вероятность за ОДИН час (0..1). За n часов риск накапливается: 0,05/час → ≈34% за 8 часов сна">
              <span>Шанс прерывания/час</span>
              <input type="number" min={0} max={1} step={0.01} value={d.interrupt_chance_per_tick ?? 0} onChange={(e) => ((d.interrupt_chance_per_tick = Math.max(0, Math.min(1, Number(e.target.value) || 0)) || undefined), commit())} />
            </label>
            <RefSelect
              label="Правило при прерывании"
              kind="rule"
              store={store}
              value={d.interrupt_rule ?? ''}
              optional
              onChange={(v) => ((d.interrupt_rule = v || undefined), commit())}
            />
          </div>
          <div className="fld" data-tip="Проверяется после каждого часа; если исполнилось — действие прерывается (правило выше тоже стреляет). Например: «будить, когда бодрость полная»">
            <span>Условия досрочной остановки</span>
            <ConditionListEditor
              store={store}
              conditions={d.break_when ?? []}
              onChange={(conds) => ((d.break_when = conds.length ? conds : undefined), commit())}
            />
          </div>
          <div className="fld" data-tip="Срабатывают один раз, только если действие завершилось полностью (без прерывания)">
            <span>Эффекты нормального завершения</span>
            <EffectListEditor
              store={store}
              effects={d.on_finish ?? []}
              onChange={(fx) => ((d.on_finish = fx.length ? fx : undefined), commit())}
            />
          </div>
          <div className="fld" data-tip="Действие доступно, только если все условия выполнены: время суток, переменная, виза… Проверяется и перед стартом">
            <span>Условия доступности</span>
            <ConditionListEditor
              store={store}
              conditions={d.available_when ?? []}
              onChange={(conds) => ((d.available_when = conds.length ? conds : undefined), commit())}
            />
          </div>
        </details>
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          list.push({ id: `act_${Date.now()}`, label: 'Новое действие', min_ticks: 1, max_ticks: 8 })
          commit()
        }}
      >
        <Ico n="plus" /> действие
      </button>
    </div>
  )
}
export function VersionsTab({ store, commit }: { store: EditorStore; commit: () => void }) {
  const m = store.meta
  const [, force] = useState(0)
  const [compat, setCompat] = useState<CampaignCompat | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadCompat(store).then((c) => setCompat(c))
  }, [store])

  const publish = async () => {
    setBusy(true)
    try {
      const plan: PublishPlan = await planPublish(store)
      const lines = diffReportLines(plan.diff)
      await showList(
        plan.previous ? `Обновление ${plan.previous.version} → ${plan.suggestedVersion}` : 'Первая публикация версии',
        lines,
        plan.diff.breaking
          ? `Есть ломающие изменения: сохранения до версии ${plan.suggestedBase} поддерживаться не будут. Игрок увидит это до обновления кампании.`
          : 'Ломающих изменений нет: сохранения игроков продолжат работать.',
        { label: 'Скопировать отчёт', text: lines.join('\n') },
      )
      const nextVersion =
        (await askText(
          'Версия кампании',
          'например 1.5.0',
          plan.suggestedVersion,
          'Опубликовать',
        )) ?? ''
      if (!nextVersion.trim()) return
      const notes = (await askText('Что изменилось (видно игроку)', 'например «переписана глава 3»', plan.compat.notes ?? '', 'Записать')) ?? undefined
      const paths = applyPublish(store, plan, nextVersion.trim(), notes)
      await store.saveToDisk(paths)
      setCompat(await loadCompat(store))
      commit()
      force((n) => n + 1)
      await showAlert('Версия опубликована', `Записаны ${paths.join(', ')}. Сохраните кампанию, чтобы изменения попали на диск.`)
    } catch (e) {
      await showAlert('Не удалось опубликовать версию', String(e))
    } finally {
      setBusy(false)
    }
  }

  const inventory = storeInventory(store)

  return (
    <>
      <div className="props-group">
        <h4>Версии</h4>
        <p className="muted small">
          Версия кампании — для игрока и для совместимости сохранений. Версия движка
          и формат пакета подставляются сами: их задаёт движок, не мастер.
        </p>
        <div className="fld-row">
          <label className="fld">
            <span>Версия кампании</span>
            <input value={m.version} onChange={(e) => ((m.version = e.target.value), commit())} />
          </label>
          <label className="fld" data-tip="Минимальная версия движка, на которой кампания работает корректно">
            <span>Мин. движок</span>
            <input
              value={m.min_engine ?? ''}
              placeholder={ENGINE_VERSION}
              onChange={(e) => ((m.min_engine = e.target.value || undefined), commit())}
            />
          </label>
          <div className="fld">
            <span>Движок сейчас</span>
            <input value={ENGINE_VERSION} readOnly />
          </div>
          <div className="fld">
            <span>Формат пакета</span>
            <input value={`v${PACKAGE_FORMAT}`} readOnly />
          </div>
        </div>
        <div className="fld-row">
          <label className="fld" data-tip="Сохранения от какой версии кампании ещё поддерживаются. Заполняется при публикации обновления.">
            <span>Сохранения поддерживаются с версии</span>
            <input
              value={m.save_base_version ?? ''}
              placeholder="поддерживаются все"
              onChange={(e) => ((m.save_base_version = e.target.value || undefined), commit())}
            />
          </label>
          <div className="fld">
            <span>Быстро поднять версию</span>
            <span className="btn-row">
              <button className="btn btn-small" onClick={() => ((m.version = bumpVersion(m.version, 'patch')), commit())}>+_patch</button>
              <button className="btn btn-small" onClick={() => ((m.version = bumpVersion(m.version, 'minor')), commit())}>+minor</button>
              <button className="btn btn-small" onClick={() => ((m.version = bumpVersion(m.version, 'major')), commit())}>+major</button>
            </span>
          </div>
        </div>
      </div>

      <div className="props-group">
        <h4>Контракт совместимости (compat.json)</h4>
        {compat ? (
          <p className="muted small">
            Опубликована версия {compat.version}
            {compat.save_base_version ? `; сохранения поддерживаются с ${compat.save_base_version}` : '; поддерживаются все сохранения'}
            {compat.updated_at ? `; обновлено ${new Date(compat.updated_at).toLocaleString('ru-RU')}` : ''}
            {compat.breaks?.length ? `; ломающих изменений: ${compat.breaks.length}` : ''}.
          </p>
        ) : (
          <p className="muted small">
            Контракта ещё нет: кампания не публиковалась. При первой публикации
            редактор зафиксирует текущее состояние пакета как точку отсчёта.
          </p>
        )}
        <p className="muted small">
          Объектов в пакете: {Object.values(inventory.ids).reduce((n, list) => n + list.length, 0)} ·
          отпечаток инвентаризации: <code>{inventory.digest}</code>
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={() => void publish()}>
          {busy ? 'Сравнение…' : 'Проверить совместимость и опубликовать версию'}
        </button>
      </div>
    </>
  )
}


// ─────────────── генераторы: конструкторы без JSON (фидбек «без техно-форм») ───────────────
