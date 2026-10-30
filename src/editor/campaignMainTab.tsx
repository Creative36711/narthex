/**
 * Вкладка «Основное»: паспорт кампании — название, серия, время, отдых и удача,
 * производные опции.
 *
 * Вынесено из `CampaignEditor.tsx`: вкладка длинная, поэтому правила опыта,
 * лагеря и старта игры вынесены в соседнюю секцию.
 */

import { DiceRulesEditor } from './campaignDiceEditors'
import { RegistryRows } from './campaignRegistryParts'
import { AttributionEditor, ChaptersEditor } from './campaignChapterParts'
import type { CampaignMainTabProps } from './campaignTabProps'
import { CampaignMainRules } from './campaignMainRules'

export function CampaignMainTab({ store, m, commit, sceneOpts, locOpts, regionOpts, npcOpts }: CampaignMainTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>О кампании</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Название</span>
            <input value={m.title} onChange={(e) => ((m.title = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Автор</span>
            <input value={m.author} onChange={(e) => ((m.author = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Версия</span>
            <input value={m.version} onChange={(e) => ((m.version = e.target.value), commit())} />
          </label>
        </div>
        <label className="fld fld-block">
          <span>Описание (видно в главном меню)</span>
          <textarea rows={3} value={m.description} onChange={(e) => ((m.description = e.target.value), commit())} />
        </label>
      </div>

      <ChaptersEditor m={m} commit={commit} />

      <div className="props-group">
        <h4>Серия и дополнения</h4>
        <div className="fld-row">
          <label className="fld" data-tip="id базовой кампании (без него — эта кампания основная часть)">
            <span>Продолжает кампанию</span>
            <input
              value={m.series?.base ?? ''}
              placeholder="id базовой кампании (пусто — основная)"
              onChange={(e) => ((m.series = { ...(m.series ?? {}), base: e.target.value || undefined }), commit())}
            />
          </label>
          <label className="fld" data-tip="Основная игра — 1">
            <span>Номер части</span>
            <input
              type="number"
              min={1}
              value={m.series?.part ?? 1}
              onChange={(e) => ((m.series = { ...(m.series ?? {}), part: Number(e.target.value) || 1 }), commit())}
            />
          </label>
          <label className="fld">
            <span>Название части</span>
            <input
              value={m.series?.label ?? ''}
              placeholder="например «Пролог»"
              onChange={(e) => ((m.series = { ...(m.series ?? {}), label: e.target.value || undefined }), commit())}
            />
          </label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Как продавать «бесплатный пролог, дальше — платно»: пролог — первая часть без «Продолжает кампанию»,
          продолжение — второй пакет с указанием id пролога. Платёжный гейт появится с мастерской; здесь — только данные.
        </p>
      </div>

      <AttributionEditor m={m} commit={commit} store={store} />

      <div className="props-group">
        <h4>Время</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Название тика</span>
            <input value={m.tick_label} onChange={(e) => ((m.tick_label = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Тиков в сутках</span>
            <input type="number" value={m.ticks_per_day} onChange={(e) => ((m.ticks_per_day = Number(e.target.value)), commit())} />
          </label>
          {(['morning', 'day', 'evening', 'night'] as const).map((k) => (
            <label key={k} className="fld">
              <span>{{ morning: 'Утро с', day: 'День с', evening: 'Вечер с', night: 'Ночь с' }[k]}</span>
              <input type="number" value={m.time_of_day![k]} onChange={(e) => ((m.time_of_day![k] = Number(e.target.value)), commit())} />
            </label>
          ))}
        </div>
        <div className="fld-row">
          <label className="fld" data-tip="Дедлайн кампании: общее число тиков/часов до критического события (0 или пусто — без таймера)">
            <span>Дедлайн кампании (тиков)</span>
            <input
              type="number"
              min={0}
              placeholder="нет (0)"
              value={m.deadline_ticks ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                if (!val || val <= 0) delete m.deadline_ticks
                else m.deadline_ticks = val
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Подпись таймера дедлайна в HUD (например, «До затопления шахты», «До отбытия поезда»)">
            <span>Подпись дедлайна в HUD</span>
            <input
              placeholder="До срока"
              value={m.deadline_label ?? ''}
              onChange={(e) => {
                const val = e.target.value.trim()
                if (!val) delete m.deadline_label
                else m.deadline_label = val
                commit()
              }}
            />
          </label>
        </div>
      </div>

      <DiceRulesEditor value={m.dice_rules!} commit={commit} />

      <div className="props-group">
        <h4>Отдых и удача</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld" data-tip="Кости лечения HP за сон; «0» — сон не лечит">
            <span>Лечение за сон</span>
            <input
              value={m.rest?.hp ?? '1d3'}
              placeholder="1d3"
              onChange={(e) => {
                const r = { ...(m.rest ?? {}), hp: e.target.value || '1d3' }
                m.rest = r
                commit()
              }}
            />
          </label>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={m.rest?.mp_full !== false}
              onChange={(e) => ((m.rest = { ...(m.rest ?? {}), mp_full: e.target.checked || undefined }), commit())}
            />
            <span>Сон восстанавливает MP полностью</span>
          </label>
          <label className="fld fld-num" data-tip="Максимум удачи = POW × множитель. 0 — удача выключена">
            <span>Множитель удачи (×POW)</span>
            <input
              type="number" min={0}
              value={m.luck?.multiplier ?? 5}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0)
                m.luck = { ...(m.luck ?? {}), multiplier: v === 5 && !m.luck ? undefined : v }
                commit()
              }}
            />
          </label>
          <label className="fld fld-num" data-tip="Стоимость переброска провального броска вне боя">
            <span>Цена переброска</span>
            <input
              type="number" min={1}
              value={m.luck?.reroll_cost ?? 1}
              onChange={(e) => ((m.luck = { ...(m.luck ?? {}), reroll_cost: Math.max(1, Number(e.target.value) || 1) }), commit())}
            />
          </label>
          <label className="fld fld-check" data-tip="По книге удача не восстанавливается; для рогалика обычно мягче">
            <input
              type="checkbox"
              checked={m.luck?.rest_luck !== false}
              onChange={(e) => ((m.luck = { ...(m.luck ?? {}), rest_luck: e.target.checked || undefined }), commit())}
            />
            <span>Удача восстанавливается на отдыхе</span>
          </label>
        </div>
      </div>

      <div className="props-group">
        <h4>Производные опции (усталость, рассудок, слава, достаток, страсти, причастность)</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld fld-check" data-tip="Очки усталости = (STR+CON). Траты задаёте эффектами change_fatigue; на нуле срабатывают правила">
            <input
              type="checkbox"
              checked={!!m.vitals?.fatigue}
              onChange={(e) => {
                const v = { ...(m.vitals ?? {}) }
                if (e.target.checked) v.fatigue = true
                else delete v.fatigue
                if (Object.keys(v).length) m.vitals = v
                else delete m.vitals
                commit()
              }}
            />
            <span>Очки усталости (STR+CON)</span>
          </label>
          <label className="fld fld-check" data-tip="Рассудок = POW×5. Потери — change_sanity, пороги — правилами на sanity_le">
            <input
              type="checkbox"
              checked={!!m.vitals?.sanity}
              onChange={(e) => {
                const v = { ...(m.vitals ?? {}) }
                if (e.target.checked) v.sanity = true
                else delete v.sanity
                if (Object.keys(v).length) m.vitals = v
                else delete m.vitals
                commit()
              }}
            />
            <span>Рассудок (POW×5)</span>
          </label>
          <label className="fld fld-check" data-tip="Репутация героя — счётчик славы; чип в HUD и влияние на мир через условия reputation_ge">
            <input
              type="checkbox"
              checked={!!m.reputation}
              onChange={(e) => {
                if (e.target.checked) m.reputation = true
                else delete m.reputation
                commit()
              }}
            />
            <span>Репутация</span>
          </label>
          <label className="fld" data-tip="Названия ступеней достатка через запятую, от низшей к высшей: Нищий, Бедный, Свободный, Знатный. Пусто — системы нет">
            <span>Шкала достатка</span>
            <input
              value={(m.wealth_levels ?? []).join(', ')}
              onChange={(e) => {
                const arr = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
                if (arr.length) m.wealth_levels = arr
                else delete m.wealth_levels
                commit()
              }}
            />
          </label>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Страсти героя: их названия видит игрок, а в правилах и проверках они выбираются списком — писать ничего не нужно">
            <span>Страсти</span>
            <RegistryRows
              items={m.passions_list ?? []}
              onChange={(v) => ((m.passions_list = v.length ? v : undefined), commit())}
              addTitle="Название новой страсти"
              prefix="passion_"
            />
          </div>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Силы причастности: названия видит игрок, в эффектах и условиях они выбираются списком">
            <span>Причастность</span>
            <RegistryRows
              items={m.allegiances ?? []}
              onChange={(v) => ((m.allegiances = v.length ? v : undefined), commit())}
              addTitle="Название новой силы причастности"
              prefix="power_"
            />
          </div>
          <label className="fld" data-tip="Книжный уровень мощи кампании; для heroic+ используйте формулы 2d6+6 в генерации характеристик">
            <span>Уровень мощи</span>
            <select
              value={m.power_level ?? 'normal'}
              onChange={(e) => {
                if (e.target.value === 'normal') delete m.power_level
                else m.power_level = e.target.value as 'heroic' | 'epic' | 'superhuman'
                commit()
              }}
            >
              <option value="normal">Обычный (умолчание)</option>
              <option value="heroic">Героический</option>
              <option value="epic">Эпический</option>
              <option value="superhuman">Сверхчеловеческий</option>
            </select>
          </label>
          <label className="fld fld-num" data-tip="Порог страсти/навыка-союзника для аугмента (умолчание 50; книжно +20 при ≥50)">
            <span>Порог аугмента</span>
            <input
              type="number" min={1}
              value={m.augments?.threshold ?? 50}
              onChange={(e) => ((m.augments = { ...(m.augments ?? {}), threshold: Math.max(1, Number(e.target.value) || 50) }), commit())}
            />
          </label>
          <label className="fld fld-num" data-tip="Прибавка к броску при аугменте/подмоге (умолчание +20)">
            <span>Бонус аугмента</span>
            <input
              type="number" min={0}
              value={m.augments?.bonus ?? 20}
              onChange={(e) => ((m.augments = { ...(m.augments ?? {}), bonus: Math.max(0, Number(e.target.value) || 20) }), commit())}
            />
          </label>
        </div>
      </div>
      <CampaignMainRules store={store} m={m} commit={commit} sceneOpts={sceneOpts} locOpts={locOpts} regionOpts={regionOpts} npcOpts={npcOpts} />
        </>
  )
}
