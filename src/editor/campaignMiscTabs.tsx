/**
 * Небольшие вкладки паспорта: флаги, звуковая обвязка и монолитный JSON кампании.
 *
 * Вынесено из `CampaignEditor.tsx`: каждая вкладка короткая и не связана с
 * остальными реестрами, поэтому они собраны в один модуль «прочее».
 */

import { DEFAULT_EMOTION } from '../shared/types'
import { Ico } from '../shared/icons'
import { JsonField } from './Fields'
import { makeId } from './ids'
import { askText } from './prompt'
import { AudioRegistries } from './AudioSection'
import type { CampaignTabProps } from './campaignTabProps'

/** Вкладка «Флаги»: объявление и подписи флагов кампании. */
export function CampaignFlagsTab({ m, commit }: CampaignTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>Флаги</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Флаги — «память мира»: отметки о событиях (что сделано, о чём узнали).
          Здесь их реестр с понятными названиями; в правилах, сценах и диалогах флаг
          выбирается из списка (или создаётся на месте).
        </div>
        {(m.flags ?? []).map((f, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={f.label} onChange={(e) => ((f.label = e.target.value), commit())} />
            </label>
            <label className="fld" style={{ flex: 2 }} data-tip="Какое событие запоминает флаг и где он читается (правила, диалоги, квесты). Для ИИ-кампаний поле обязательное.">
              <span>Для чего нужен{!f.description?.trim() && <span className="fld-err"> — не заполнено</span>}</span>
              <input
                value={f.description ?? ''}
                placeholder="напр.: поднята, когда следователь нашёл квитанцию; читается в финале"
                onChange={(e) => {
                  if (e.target.value) f.description = e.target.value
                  else delete f.description
                  commit()
                }}
              />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить из реестра (контент, где флаг используется, не меняется)" onClick={() => (m.flags!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название нового флага', 'например «Мост разрушен»')
            if (!label) return
            if (!m.flags) m.flags = []
            m.flags.push({ id: makeId('', label, m.flags.map((x) => x.id)), label })
            commit()
          }}
        >
          + флаг
        </button>
      </div>

      <div className="props-group">
        <h4>Состояния портретов (настроения)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свой список состояний для портретов персонажей (ехидство, задумчивость…).
          Все состояния из списка можно переименовывать и удалять. Дефолтное состояние
          «{DEFAULT_EMOTION.label}» есть всегда — сюда попадает загруженная картинка, в список оно не входит.
          Состояния из списка предлагаются в конструкторе диалогов у всех персонажей.
        </div>
        {(m.emotions ?? []).map((em, i) => (
          <div key={em.id} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input
                value={em.label}
                onChange={(e) => ((em.label = e.target.value), commit())}
              />
            </label>
            <button
              className="btn btn-small ce-del"
              data-tip="Удалить из реестра (картинки у персонажей останутся)"
              onClick={() => (m.emotions!.splice(i, 1), commit())}
            >
              <Ico n="close" /> 
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название нового состояния', 'например «Ехидство»')
            if (!label) return
            if (!m.emotions) m.emotions = []
            m.emotions.push({ id: makeId('', label, m.emotions.map((x) => x.id)), label })
            commit()
          }}
        >
          + состояние
        </button>
      </div>


        </>
  )
}

/** Вкладка «Звук»: реестры звуков и музыкальных правил кампании. */
export function CampaignAudioTab({ store }: CampaignTabProps) {
  return (
        <>
      <AudioRegistries store={store} />
        </>
  )
}

/** Вкладка «JSON»: монолитный документ кампании для правки вручную. */
export function CampaignJsonTab({ store, m, commit }: CampaignTabProps) {
  return (
        <div className="advanced-json-page">
          <JsonField
            label=""
            rows={26}
            pretty
            fill
            value={m}
            onChange={(v) => {
              if (v !== undefined) {
                Object.assign(store, { meta: v })
                commit()
              }
            }}
          />
        </div>
  )
}
