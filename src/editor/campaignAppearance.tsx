

/**
 * Оформление кампании: визуальный профиль, шрифты, фоны и акцент.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */

import { Ico } from '../shared/icons'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EditorStore } from './store'
import { FONT_ROLES } from './campaignFonts'
import type { CampaignMeta } from '../shared/types'
import { brightenHex } from '../shared/theme'
import { PROFILE_GROUPS, VISUAL_PROFILES, resolveProfile } from '../shared/profiles'
/**
 * Оформление кампании: визуальный профиль, шрифты, фоны и акцент.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */



/** живой предпросмотр шрифта: ставит временный @font-face и показывает образец */
export function FontSample({ store, fontId, meta, role }: { store: EditorStore; fontId: string; meta: CampaignMeta; role: (typeof FONT_ROLES)[number] }) {
  const [family, setFamily] = useState<string | null>(null)
  const font = (meta.fonts ?? []).find((f) => f.id === fontId)
  useEffect(() => {
    if (!font?.src) {
      setFamily(null)
      return
    }
    const fam = `cf-preview-${font.id}`
    const el = document.createElement('style')
    el.textContent = `@font-face { font-family: '${fam}'; src: url('${store.assetSrc(font.src)}'); font-weight: ${font.weight || '400'}; font-style: ${font.style || 'normal'}; font-display: swap; }`
    document.head.appendChild(el)
    setFamily(fam)
    return () => {
      document.head.removeChild(el)
    }
  }, [font?.src, font?.weight, font?.style, store])
  const theme = meta.theme ?? {}
  const assigned = theme.fonts?.[role.key]
  return (
    <div className={`font-sample ${role.cls}`}>
      <span className="muted small">{role.label}: </span>
      {assigned && family ? (
        <span style={{ fontFamily: `'${family}', Georgia, serif` }}>{role.sample}</span>
      ) : assigned ? (
        <span className="muted">{role.sample}</span>
      ) : (
        <span className="muted small">— шрифт профиля —</span>
      )}
    </div>
  )
}

/** живой мини-предпросмотр: та же композиция, что в игре (сцена + панель HUD) */
export function ProfilePreview({ meta }: { meta: CampaignMeta }) {
  const profile = resolveProfile(meta)
  const accent = meta.theme?.accent ?? profile.swatches.accent
  const accentBright = meta.theme?.accent ? brightenHex(meta.theme.accent) : brightenHex(profile.swatches.accent)
  const style = {
    '--pv-bg': profile.swatches.bg,
    '--pv-panel': profile.swatches.panel,
    '--pv-text': profile.swatches.text,
    '--pv-accent': accent,
    '--pv-accent-bright': accentBright,
    '--pv-frame': profile.swatches.frame,
    '--pv-font': profile.fonts.body,
    '--pv-display': profile.fonts.display,
  } as CSSProperties
  return (
    <div className="profile-preview" style={style} aria-label={`Предпросмотр: профиль ${profile.label}`}>
      <div className="profile-preview-scene">
        <span className="profile-preview-loc">Городские ворота — вид снаружи</span>
      </div>
      <div className="profile-preview-panel">
        <span className="pp-bar"><i style={{ width: '64%' }} /></span>
        <span className="pp-bar" style={{ opacity: 0.7 }}><i style={{ width: '38%' }} /></span>
        <span className="pp-btn solid">Действие</span>
        <span className="pp-btn">Открыть</span>
        <span className="pp-text">Текст интерфейса</span>
      </div>
    </div>
  )
}

/** карточки визуальных профилей: автор видит названия и свотчи, не id;
    каталог сгруппирован (фирменный / фэнтези / хоррор / детектив / выживание / фантастика) */
export function ProfilePicker({ meta, commit }: { meta: CampaignMeta; commit: () => void }) {
  const current = resolveProfile(meta).id
  const set = (id: string) => {
    meta.theme = { ...(meta.theme ?? {}), profile: id as NonNullable<CampaignMeta['theme']>['profile'] }
    commit()
  }
  return (
    <div className="profile-catalog" role="radiogroup" aria-label="Визуальный профиль игры">
      {PROFILE_GROUPS.map((g) => {
        const cards = VISUAL_PROFILES.filter((p) => p.group === g.id)
        if (!cards.length) return null
        return (
          <div key={g.id} className="profile-group">
            <span className="profile-group-label">{g.label}</span>
            <div className="profile-cards">
              {cards.map((p) => {
                const on = p.id === current
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`profile-card ${on ? 'on' : ''}`}
                    onClick={() => {
                      if (!on) set(p.id)
                    }}
                  >
                    <span className="profile-check" aria-hidden="true"><Ico n="check" /></span>
                    <span className="profile-swatch" aria-hidden="true">
                      <i style={{ background: p.swatches.bg }} />
                      <i style={{ background: p.swatches.panel }} />
                      <i style={{ background: p.swatches.text }} />
                      <i style={{ background: p.swatches.accent }} />
                      <i className="sw-frame" style={{ background: p.swatches.frame }} />
                    </span>
                    <span className="profile-card-title">{p.label}</span>
                    <span className="profile-card-tag">{p.tagline}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** вкладка «Оформление»: визуальный профиль, атмосфера, шрифты, фоны, акцент (редизайн 2026 + блок 2 ТЗ) */


/** Редактор глав кампании: id получаются автоматически (переименовывать не надо), мастер задаёт название/порядок/описание. */
