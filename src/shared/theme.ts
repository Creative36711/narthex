/**
 * Тема кампании (блок 2 ТЗ «Гибкий движок»): шрифты, фон меню/финала,
 * акцентный цвет. Применяется ТОЛЬКО к Player Mode — редактор остаётся
 * в фирменном стиле.
 *
 * Механика: шрифты подключаются `@font-face` в отдельном `<style>`,
 * CSS-переменные (`--cf-font-*`, `--gold`, `--cf-text-scale`) ставятся
 * инлайном на контейнер `.cf-themed` — редактор их не наследует.
 */

import type { CSSProperties } from 'react'
import type { CampaignData } from './types'
import { assetUrl } from '../core/loader'

/** осветлить hex (для пары «акцент / яркий акцент», когда автор меняет акцент) */
export function brightenHex(hex: string, amount = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const STYLE_ID = 'cf-campaign-fonts'

/** имя семейства для @font-face: по id шрифта из реестра кампании */
export function fontFamily(fontId: string): string {
  return `cf-font-${fontId}`
}

/**
 * Вставить (или заменить) `@font-face`-правила шрифтов кампании.
 * Вызывается при загрузке/смене кампании; пустой реестр очищает стиль.
 */
export function injectCampaignFonts(campaign: CampaignData | null): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  const fonts = campaign?.meta.fonts ?? []
  el.textContent = fonts
    .filter((f) => f.id && f.src)
    .map((f) => {
      const url = assetUrl(campaign!, f.src)
      return `@font-face { font-family: '${fontFamily(f.id)}'; src: url('${url}'); font-weight: ${f.weight || '400'}; font-style: ${f.style || 'normal'}; font-display: swap; }`
    })
    .join('\n')
}

const CUSTOM_CSS_ID = 'cf-campaign-custom-css'

/**
 * Вставить (или заменить) полный CSS мастера (theme.custom_css).
 * Зона видимости — только игра: селекторы автора работают внутри `.cf-themed`
 * в браузере естественным образом; редактор не покрывается. Пустой — стиль
 * удаляется.
 */
export function injectCampaignCustomCss(campaign: CampaignData | null): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById(CUSTOM_CSS_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = CUSTOM_CSS_ID
    document.head.appendChild(el)
  }
  el.textContent = campaign?.meta.theme?.custom_css ?? ''
}

/** найти шрифт реестра по id */
function fontById(campaign: CampaignData | null, id?: string) {
  return campaign?.meta.fonts?.find((f) => f.id === id)
}

/** CSS-переменные темы для контейнера `.cf-themed` */
export function themeVars(campaign: CampaignData | null, textScale = 1): CSSProperties {
  const theme = campaign?.meta.theme
  const vars: Record<string, string> = {}
  const body = fontById(campaign, theme?.fonts?.body)
  const display = fontById(campaign, theme?.fonts?.display)
  const hand = fontById(campaign, theme?.fonts?.hand)
  if (body) vars['--cf-font-body'] = `'${fontFamily(body.id)}', Georgia, 'Times New Roman', serif`
  if (display) vars['--cf-font-display'] = `'${fontFamily(display.id)}', Georgia, serif`
  if (hand) vars['--cf-font-hand'] = `'${fontFamily(hand.id)}', 'Segoe Script', cursive`
  // акцент кампании переопределяет профильный акцент; «яркий» вариант
  // выводится, чтобы пара gold/gold-bright не расцветалась
  if (theme?.accent) {
    vars['--gold'] = theme.accent
    vars['--gold-bright'] = brightenHex(theme.accent)
  }
  // тоны поверхностей (мастерская докрутка): панели/карточки/колодцы/журнал
  const tok = theme?.tokens
  if (tok?.panel) vars['--panel'] = tok.panel
  if (tok?.cards) vars['--panel-2'] = tok.cards
  if (tok?.inset) vars['--inset'] = tok.inset
  if (tok?.log) vars['--log-bg'] = tok.log
  // рамка-«кадр» вокруг панелей (9-срез изображения)
  if (theme?.frame?.image && campaign) {
    vars['--cf-frame-src'] = `url('${assetUrl(campaign, theme.frame.image)}')`
    vars['--cf-frame-slice'] = String(theme.frame.slice ?? 30)
    vars['--cf-frame-w'] = `${theme.frame.width ?? 20}px`
  }
  if (textScale !== 1) vars['--cf-text-scale'] = String(textScale)
  return vars as CSSProperties
}

/** у темы задана рамка-«кадр»? (класс cf-has-frame на контейнере) */
export function themeHasFrame(campaign: CampaignData | null): boolean {
  return !!campaign?.meta.theme?.frame?.image
}

/** фон меню/финала как CSS-значение (или пусто) */
export function themeBackgroundUrl(campaign: CampaignData, which: 'menu' | 'end'): string {
  const theme = campaign.meta.theme
  const src = which === 'end' ? (theme?.end?.background ?? theme?.menu?.background) : theme?.menu?.background
  return src ? assetUrl(campaign, src) : ''
}
