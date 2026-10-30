/**
 * Вкладка «Оформление»: визуальный профиль, акцент, тоны поверхностей, авторский
 * CSS и надписи системных меню.
 *
 * Вынесено из `CampaignEditor.tsx`: вкладка держит своё состояние предпросмотра
 * и передаёт типографику отдельной секции.
 */

import { Ico } from '../shared/icons'
import type { EditorStore } from './store'
import { ImageUpload } from './Fields'
import type { CampaignMeta } from '../shared/types'
import { askConfirm } from './prompt'
import { ProfilePicker, ProfilePreview } from './campaignAppearance'
import { resolveProfile, contrastRatio } from '../shared/profiles'
import { ThemeTypographySection } from './campaignThemeTypography'

export function ThemeTab({ meta, store, commit }: { meta: CampaignMeta; store: EditorStore; commit: () => void }) {
  const fonts = meta.fonts ?? (meta.fonts = [])
  const theme = meta.theme ?? (meta.theme = {})
  const fontOpts = fonts.map((f) => ({ id: f.id, label: f.label || f.id }))
  const profile = resolveProfile(meta)
  const accent = theme.accent ?? profile.swatches.accent
  // контраст акцента к панели: ниже порога — предупреждаем, но не запрещаем
  const accentContrast = contrastRatio(accent, profile.swatches.panel)

  const setFont = (patch: Partial<NonNullable<CampaignMeta['theme']>['fonts'] & object>) => {
    theme.fonts = { ...(theme.fonts ?? {}), ...patch }
    commit()
  }

  const resetToProfile = async () => {
    if (!(await askConfirm(
      `Вернуть оформление профиля «${profile.label}» по умолчанию?`,
      'Сбросить',
    ))) return
    // сбрасываем только авторские переопределения — профиль и контент не трогаем
    delete theme.accent
    delete theme.fonts
    delete theme.menu
    delete theme.end
    delete theme.atmosphere
    commit()
  }

  return (
    <>
      <div className="props-group">
        <h4>Визуальный профиль</h4>
        <div className="muted small" style={{ marginBottom: 4 }}>
          Стартовый художественный набор игры: палитра, шрифты, стиль панелей и атмосферный эффект.
          Профиль не меняет механику и данные — только оформление. После выбора его можно
          докрутить: акцент, шрифты, фоны.
        </div>
        <ProfilePicker meta={meta} commit={commit} />
        <ProfilePreview meta={meta} />
        <div style={{ marginTop: 12 }}>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={theme.atmosphere !== false}
              onChange={(e) => {
                if (e.target.checked) delete theme.atmosphere
                else theme.atmosphere = false
                commit()
              }}
            />
            <span>Атмосферный эффект профиля ({profile.effectLabel})</span>
          </label>
        </div>
      </div>

      <div className="props-group">
        <h4>Акцентный цвет</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Переопределяет акцент профиля: кнопки, рамки, подсветки. Если контраст низкий —
          подсказка под полем.
        </div>
        <div className="fld-row">
          <label className="fld" data-tip="Цвет кнопок, рамок и подсветок. Слишком тёмный — пропадёт контраст.">
            <span>Цвет кнопок, рамок и подсветок</span>
            <input
              type="color"
              value={accent}
              onChange={(e) => {
                theme.accent = e.target.value
                commit()
              }}
            />
          </label>
          {theme.accent && (
            <button
              className="btn btn-small"
              onClick={() => {
                delete theme.accent
                commit()
              }}
            >
              Вернуть акцент профиля
            </button>
          )}
        </div>
        {accentContrast < 2.5 && (
          <div className="accent-contrast-warn" role="alert">
            <Ico n="warn" />  Низкий контраст с панелями ({accentContrast.toFixed(1)}:1). Подсветки и
            подписи на кнопках могут стать трудночитаемыми — выберите светлее.
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Тоны поверхностей и рамка-«кадр»</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Докрутка палитры профиля: панели, карточки и кнопки, колодцы полей, фон журнала.
          Пустое поле — тон профиля. Рамка-«кадр» обрамляет все панели игры: PNG с
          изображением-изображением (прозрачная сердцевина, орнамент по краям).
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {([
            ['panel', 'Панели'],
            ['cards', 'Карточки и кнопки'],
            ['inset', 'Колодцы полей'],
            ['log', 'Фон журнала'],
          ] as const).map(([key, label]) => (
            <label key={key} className="fld" data-tip="Пусто — тон визуального профиля">
              <span>{label}</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="color"
                  value={theme.tokens?.[key] ?? '#888888'}
                  onChange={(e) => {
                    theme.tokens = { ...(theme.tokens ?? {}), [key]: e.target.value }
                    commit()
                  }}
                  disabled={!theme.tokens?.[key]}
                />
                <input
                  type="checkbox"
                  checked={!!theme.tokens?.[key]}
                  data-tip={`Свой тон «${label}»`}
                  onChange={(e) => {
                    const next = { ...(theme.tokens ?? {}) }
                    if (e.target.checked) next[key] = '#2a2f3c'
                    else delete next[key]
                    theme.tokens = Object.keys(next).length ? next : undefined
                    commit()
                  }}
                />
              </span>
            </label>
          ))}
        </div>
        <ImageUpload
          label="Рамка-«кадр» для панелей (PNG, орнамент по краям)"
          value={theme.frame?.image ?? ''}
          dir="assets/img/ui"
          store={store}
          onChange={(path) => {
            if (path) theme.frame = { ...(theme.frame ?? {}), image: path }
            else if (theme.frame) { delete theme.frame.image; if (!theme.frame.image && !theme.frame.slice && !theme.frame.width) delete theme.frame }
            commit()
          }}
        />
        {theme.frame?.image && (
          <div className="fld-row">
            <label className="fld fld-num" data-tip="Какую часть картинки от края считать орнаментом (px, умолчание 30)">
              <span>Глубина среза, px</span>
              <input
                type="number" min={4} max={120}
                value={theme.frame.slice ?? 30}
                onChange={(e) => { theme.frame!.slice = Number(e.target.value) || undefined; commit() }}
              />
            </label>
            <label className="fld fld-num" data-tip="Видимая толщина рамки на панели (px, умолчание 20)">
              <span>Толщина рамки, px</span>
              <input
                type="number" min={4} max={60}
                value={theme.frame.width ?? 20}
                onChange={(e) => { theme.frame!.width = Number(e.target.value) || undefined; commit() }}
              />
            </label>
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Полный CSS мастера (продвинутое оформление)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свой CSS применяется <b>только к игре</b> (редактор остаётся в фирменном стиле).
          Пишите правила для селекторов внутри контейнера игры, например{' '}
          <code>.cf-themed .btn {'{ … }'}</code>. Движок не гарантирует стабильность классов между
          версиями — слой на совести мастера; сначала попробуйте токены и рамки выше,
          они почти всегда закрывают нужный наряд. Эта возможность готовится как отдельная опция —
          в будущем может стать платной «премиум-темой».
        </div>
        <label className="fld">
          <span>Свои CSS-правила</span>
          <textarea
            rows={10}
            style={{ fontFamily: 'monospace' }}
            placeholder={'.cf-themed .panel { box-shadow: 0 0 24px rgba(0,0,0,.5); }'}
            value={theme.custom_css ?? ''}
            onChange={(e) => {
              if (e.target.value.trim()) theme.custom_css = e.target.value
              else delete theme.custom_css
              commit()
            }}
          />
        </label>
        <div className="muted small">Проверить результат сразу можно через кнопку «Плейтест» — CSS подхватывается без перезапуска.</div>
      </div>

      <div className="props-group">
        <h4>Надписи системных меню и кнопок</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Задайте атмосферные названия системных элементов под мир вашей кампании (пусто — названия по умолчанию).
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {([
            ['inventory', 'Инвентарь', 'например «Сумка дознавателя»'],
            ['journal', 'Журнал', 'например «Дело № 137»'],
            ['map', 'Карта', 'например «Схема ярусов»'],
            ['camp', 'Лагерь / Отдых', 'например «Перекур»'],
            ['codex', 'Кодекс', 'например «Архив Надзора»'],
            ['craft', 'Ремесло', 'например «Верстак»'],
            ['character', 'Герой / Персонаж', 'например «Досье»'],
            ['pass_turn', 'Завершить ход в бою (чистая стилистика: игровое время в бою не течёт и защитного бонуса за пропуск нет)', 'например «Выждать»'],
            ['flee', 'Отступить из боя', 'например «Бежать»'],
          ] as const).map(([key, label, ph]) => {
            const u = meta.ui_labels ?? {}
            return (
              <label key={key} className="fld" style={{ minWidth: 200, flex: '1 1 200px' }}>
                <span>{label}</span>
                <input
                  value={u[key] ?? ''}
                  placeholder={ph}
                  onChange={(e) => {
                    const next = { ...(meta.ui_labels ?? {}) }
                    if (e.target.value.trim()) next[key] = e.target.value
                    else delete next[key]
                    if (Object.keys(next).length > 0) meta.ui_labels = next
                    else delete meta.ui_labels
                    commit()
                  }}
                />
              </label>
            )
          })}
        </div>
      </div>

      <ThemeTypographySection ctx={{ meta, store, commit, theme, fonts, fontOpts, profile, setFont, resetToProfile }} />

    </>
  )
}
