/**
 * Типографика кампании: шрифты, их роли, размеры текста, экраны меню и финала,
 * сброс оформления к профилю.
 *
 * Вынесено из `CampaignEditor.tsx` вместе с вкладкой «Оформление»: это нижняя
 * половина вкладки, у неё свои подписи и предпросмотры.
 */

import { Ico } from '../shared/icons'
import { AssetUpload } from './Fields'
import { makeId } from './ids'
import { FONT_ROLES } from './campaignFonts'
import { FontSample } from './campaignAppearance'
import type { CampaignMeta, FontDef } from '../shared/types'
import type { EditorStore } from './store'
import { resolveProfile } from '../shared/profiles'

/** Общее оформление кампании, которое вкладка передаёт секции типографики. */
export interface ThemeTypographyContext {
  meta: CampaignMeta
  store: EditorStore
  commit: () => void
  theme: NonNullable<CampaignMeta['theme']>
  fonts: FontDef[]
  fontOpts: Array<{ id: string; label: string }>
  profile: ReturnType<typeof resolveProfile>
  setFont: (patch: Partial<NonNullable<CampaignMeta['theme']>['fonts'] & object>) => void
  resetToProfile: () => Promise<void>
}

/** Секции «Шрифты…Сброс» вкладки «Оформление». */
export function ThemeTypographySection({ ctx }: { ctx: ThemeTypographyContext }) {
  const { meta, store, commit, theme, fonts, fontOpts, profile, setFont, resetToProfile } = ctx
  return (
    <>
      <div className="props-group">
        <h4>Шрифты кампании</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Загруженные шрифты применяются ко всей игре: диалогам, панелям, меню. Редактор остаётся
          в фирменном стиле. Лучше всего подходят форматы <b>woff2/woff</b> — они весят меньше.
        </div>
        {fonts.map((f, i) => (
          <div key={f.id} className="props-group theme-font-row">
            <div className="fld-row">
              <label className="fld">
                <span>Название</span>
                <input value={f.label} onChange={(e) => ((f.label = e.target.value), commit())} />
              </label>
              <label className="fld">
                <span>Начертание</span>
                <select
                  value={f.weight || '400'}
                  onChange={(e) => {
                    if (e.target.value === '400') delete f.weight
                    else f.weight = e.target.value
                    commit()
                  }}
                >
                  <option value="400">Обычное</option>
                  <option value="700">Жирное</option>
                  <option value="300">Тонкое</option>
                </select>
              </label>
              <label className="fld">
                <span>Наклон</span>
                <select
                  value={f.style || 'normal'}
                  onChange={(e) => {
                    if (e.target.value === 'normal') delete f.style
                    else f.style = e.target.value as FontDef['style']
                    commit()
                  }}
                >
                  <option value="normal">Прямой</option>
                  <option value="italic">Курсив</option>
                </select>
              </label>
              <label className="fld" data-tip="Поправка размера шрифта: 100% — как есть, 90% — чуть уменьшить, 110% — увеличить">
                <span>Масштаб шрифта</span>
                <input
                  type="number"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  placeholder="1.0"
                  value={f.size_adjust ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined
                    if (val === 1 || !val) delete f.size_adjust
                    else f.size_adjust = val
                    commit()
                  }}
                />
              </label>
            </div>
            <AssetUpload
              label="Файл шрифта (.woff2, .woff, .ttf, .otf)"
              value={f.src}
              dir="assets/fonts"
              store={store}
              kind="font"
              onChange={(p) => ((f.src = p), commit())}
            />
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                fonts.splice(i, 1)
                // снять роли, что ссылались на удалённый шрифт
                if (theme.fonts) {
                  for (const k of ['body', 'display', 'hand'] as const) {
                    if (theme.fonts[k] === f.id) delete theme.fonts[k]
                  }
                }
                commit()
              }}
            >
              <Ico n="trash" />  Удалить шрифт
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            const id = makeId('font', String(fonts.length + 1), fonts.map((x) => x.id))
            fonts.push({ id, label: 'Новый шрифт', src: '' })
            commit()
          }}
        >
          <Ico n="plus" />  Добавить шрифт
        </button>
      </div>

      <div className="props-group">
        <h4>Куда какой шрифт</h4>
        {FONT_ROLES.map((role) => (
          <div key={role.key} className="theme-role">
            <label className="fld">
              <span>{role.label}</span>
              <select value={theme.fonts?.[role.key] ?? ''} onChange={(e) => setFont({ [role.key]: e.target.value || undefined })}>
                <option value="">Профиль (по умолчанию)</option>
                {fontOpts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <FontSample store={store} fontId={theme.fonts?.[role.key] ?? ''} meta={meta} role={role} />
          </div>
        ))}
      </div>

      <div className="props-group">
        <h4>Размеры текста и типографика</h4>
        <div className="fld-row">
          <label className="fld" data-tip="Общий масштаб текста всей кампании (80% .. 140%)">
            <span>Общий масштаб текста: {Math.round((theme.font_scale ?? 1) * 100)}%</span>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={theme.font_scale ?? 1}
              onChange={(e) => {
                theme.font_scale = Number(e.target.value) === 1 ? undefined : Number(e.target.value)
                commit()
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 4 }}>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = 0.9; commit() }}
            >
              90%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = undefined; commit() }}
            >
              100%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = 1.15; commit() }}
            >
              115%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = 1.25; commit() }}
            >
              125%
            </button>
          </div>
        </div>

        <div className="fld-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 8 }}>
          <label className="fld" data-tip="Размер основного текста, описаний сцен и предметов (в пикселях, по умолчанию 15)">
            <span>Основной текст</span>
            <input
              type="number"
              min={11}
              max={28}
              placeholder="15"
              value={theme.font_sizes?.body ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), body: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Размер реплик и вариантов ответов в диалогах (в пикселях, по умолчанию 16)">
            <span>Диалоги</span>
            <input
              type="number"
              min={12}
              max={30}
              placeholder="16"
              value={theme.font_sizes?.dialogue ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), dialogue: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Базовый размер заголовков локаций, сцен, панелей (в пикселях, по умолчанию 20)">
            <span>Заголовки</span>
            <input
              type="number"
              min={14}
              max={36}
              placeholder="20"
              value={theme.font_sizes?.display ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), display: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Размер кнопок, списков и элементов интерфейса (в пикселях, по умолчанию 13)">
            <span>Кнопки и интерфейс</span>
            <input
              type="number"
              min={10}
              max={22}
              placeholder="13"
              value={theme.font_sizes?.ui ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), ui: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
        </div>

        <div className="fld-row" style={{ marginTop: 8 }}>
          <label className="fld" data-tip="Межстрочный интервал (множитель 1.2 .. 2.0, по умолчанию 1.5)">
            <span>Межстрочный интервал: {theme.line_height ?? 1.5}</span>
            <input
              type="range"
              min={1.2}
              max={2.0}
              step={0.05}
              value={theme.line_height ?? 1.5}
              onChange={(e) => {
                const val = Number(e.target.value)
                theme.line_height = val === 1.5 ? undefined : val
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Межбуквенный интервал, например 0.02em (по умолчанию обычно)">
            <span>Межбуквенный интервал</span>
            <input
              type="text"
              placeholder="напр. 0.02em"
              value={theme.letter_spacing ?? ''}
              onChange={(e) => {
                theme.letter_spacing = e.target.value.trim() || undefined
                commit()
              }}
            />
          </label>
        </div>

        <div
          className="font-preview-box"
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid var(--ed-line)',
            borderRadius: 6,
            background: 'var(--ed-bg-2)',
          }}
        >
          <div style={{ fontSize: `${Math.round((theme.font_sizes?.display ?? 20) * (theme.font_scale ?? 1))}px`, fontWeight: 'bold', color: 'var(--gold, #d4af37)', marginBottom: 6 }}>
            Пример заголовка сцены
          </div>
          <div style={{ fontSize: `${Math.round((theme.font_sizes?.dialogue ?? 16) * (theme.font_scale ?? 1))}px`, color: 'var(--ed-text)', lineHeight: theme.line_height ?? 1.5, marginBottom: 6 }}>
            «Здравствуй, путник. Здесь каждый шаг отдаётся эхом в пустых шлюзах.»
          </div>
          <div style={{ fontSize: `${Math.round((theme.font_sizes?.body ?? 15) * (theme.font_scale ?? 1))}px`, color: 'var(--ed-text-muted, #aaa)', lineHeight: theme.line_height ?? 1.5 }}>
            Листы объявлений трепещут на ржавой доске под порывами сырого сквозняка.
          </div>
        </div>
      </div>

      <div className="props-group">
        <h4>Главное меню</h4>
        <AssetUpload
          label="Фоновая картинка меню"
          value={theme.menu?.background ?? ''}
          dir="assets/img"
          store={store}
          onChange={(p) => {
            theme.menu = { ...(theme.menu ?? {}), background: p || undefined }
            commit()
          }}
        />
        <div className="fld-row">
          <label className="fld" data-tip="Чем темнее фон, тем читаемее текст поверх картинки">
            <span>Затемнение фона</span>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={theme.menu?.dim ?? 0.5}
              onChange={(e) => {
                theme.menu = { ...(theme.menu ?? {}), dim: Number(e.target.value) }
                commit()
              }}
            />
          </label>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={!!theme.menu?.ken_burns}
              onChange={(e) => {
                theme.menu = { ...(theme.menu ?? {}), ken_burns: e.target.checked || undefined }
                commit()
              }}
            />
            <span>Медленный зум фона («кен-бёрнс»)</span>
          </label>
        </div>
        <AssetUpload
          label="Арт-заголовок кампании (лого над названием, необязательно)"
          value={theme.menu?.title_art ?? ''}
          dir="assets/img"
          store={store}
          onChange={(p) => {
            theme.menu = { ...(theme.menu ?? {}), title_art: p || undefined }
            commit()
          }}
        />
      </div>

      <div className="props-group">
        <h4>Экран финала</h4>
        <AssetUpload
          label="Фон экрана победы/смерти (нет — возьмётся фон меню)"
          value={theme.end?.background ?? ''}
          dir="assets/img"
          store={store}
          onChange={(p) => {
            theme.end = { background: p || undefined }
            if (!theme.end.background) delete theme.end
            commit()
          }}
        />
      </div>

      <div className="props-group">
        <h4>Сброс</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Убрать авторские переопределения (акцент, шрифты, фоны, атмосферу) и вернуть
          оформление выбранного профиля. Контент кампании и профиль не меняются.
        </div>
        <button className="btn btn-small" onClick={() => void resetToProfile()}>
          <Ico n="undo" />  Сбросить к профилю «{profile.label}»
        </button>
      </div>
    </>
  )
}
