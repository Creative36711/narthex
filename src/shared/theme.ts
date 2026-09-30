/**
 * Тема кампании (блок 2 ТЗ «Гибкий движок»): шрифты, фон меню/финала,
 * акцент и ограниченные тона поверхностей. Применяется ТОЛЬКО к Player Mode —
 * редактор остаётся в фирменном стиле. Для пользовательских поверхностей
 * контрастные текстовые роли вычисляются здесь и локально переопределяются CSS.
 *
 * Механика: шрифты подключаются `@font-face` в отдельном `<style>`,
 * CSS-переменные (`--cf-font-*`, `--gold`, `--cf-text-scale`) ставятся
 * инлайном на контейнер `.cf-themed` — редактор их не наследует.
 */

import type { CSSProperties } from 'react'
import type { CampaignData } from './types'
import { assetUrl, assetUrlOrNull } from '../core/loader'
import { resolveProfile } from './profiles'

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

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function luminance([r, g, b]: [number, number, number]): number {
  const linear = (channel: number) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrastRatio(a: number, b: number): number {
  const [light, dark] = a > b ? [a, b] : [b, a]
  return (light + 0.05) / (dark + 0.05)
}

/** Pick readable foregrounds for an author-supplied surface, including accent text. */
function surfaceColors(background: string, accent: string, accentBright: string): Record<string, string> | null {
  const rgb = parseHex(background)
  if (!rgb) return null
  const surfaceLuminance = luminance(rgb)
  const foregroundLuminance = (color: string) => {
    const value = parseHex(color)
    return value ? luminance(value) : 0
  }
  const textCandidates = ['#20232a', '#111318', '#f1f2f4', '#ffffff']
  const text = textCandidates.reduce((best, candidate) =>
    contrastRatio(surfaceLuminance, foregroundLuminance(candidate)) > contrastRatio(surfaceLuminance, foregroundLuminance(best))
      ? candidate
      : best,
  )
  const lightSurface = foregroundLuminance(text) < surfaceLuminance
  const muted = lightSurface ? '#4b515a' : '#b3bdcb'
  const faint = lightSurface ? '#686e78' : '#929dad'
  const readableAccent = (value: string) => {
    const source = parseHex(value)
    if (!source) return text
    const original = `#${source.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
    let best = original
    let bestRatio = contrastRatio(surfaceLuminance, luminance(source))
    let bestDistance = bestRatio >= 4.5 ? 0 : Number.POSITIVE_INFINITY
    for (const target of [0, 255]) {
      for (let step = 1; step <= 20; step += 1) {
        const amount = step / 20
        const candidateRgb = source.map((channel) => Math.round(channel + (target - channel) * amount)) as [number, number, number]
        const candidate = `#${candidateRgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
        const ratio = contrastRatio(surfaceLuminance, luminance(candidateRgb))
        const distance = source.reduce((sum, channel, index) => sum + (channel - candidateRgb[index]) ** 2, 0)
        if (ratio >= 4.5 && distance < bestDistance) {
          best = candidate
          bestDistance = distance
          bestRatio = ratio
        } else if (bestDistance === Number.POSITIVE_INFINITY && ratio > bestRatio) {
          best = candidate
          bestRatio = ratio
        }
      }
    }
    return best
  }
  return {
    text,
    muted: contrastRatio(surfaceLuminance, foregroundLuminance(muted)) >= 4.5 ? muted : text,
    faint: contrastRatio(surfaceLuminance, foregroundLuminance(faint)) >= 4.5 ? faint : muted,
    accent: readableAccent(accent),
    accentBright: readableAccent(accentBright),
    redBright: readableAccent('#d05252'),
    greenBright: readableAccent('#58b85c'),
    blueBright: readableAccent('#58a0e0'),
  }
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
  // Пользовательские поверхности могут быть светлыми даже в тёмном профиле.
  // Вычисляем контрастные роли отдельно для панелей, карточек, полей и журнала.
  const accent = theme?.accent ?? resolveProfile(campaign?.meta).swatches.accent
  const accentBright = theme?.accent ? brightenHex(theme.accent) : brightenHex(accent)
  const surfaces = [
    ['panel', tok?.panel],
    ['card', tok?.cards],
    ['inset', tok?.inset],
    ['log', tok?.log],
  ] as const
  for (const [surface, color] of surfaces) {
    if (!color) continue
    const readable = surfaceColors(color, accent, accentBright)
    if (!readable) continue
    vars[`--cf-${surface}-text`] = readable.text
    vars[`--cf-${surface}-muted`] = readable.muted
    vars[`--cf-${surface}-faint`] = readable.faint
    vars[`--cf-${surface}-accent`] = readable.accent
    vars[`--cf-${surface}-accent-bright`] = readable.accentBright
    if (readable.redBright) vars[`--cf-${surface}-red-bright`] = readable.redBright
    if (readable.greenBright) vars[`--cf-${surface}-green-bright`] = readable.greenBright
    if (readable.blueBright) vars[`--cf-${surface}-blue-bright`] = readable.blueBright
  }
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
  // пустая строка в theme.*.background — не URL (иначе <img src="">)
  return assetUrlOrNull(campaign, src) ?? ''
}
