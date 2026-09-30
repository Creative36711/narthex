import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { CampaignData } from '../src/shared/types'
import { themeVars } from '../src/shared/theme'

function luminance(hex: string): number {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const srgb = channel / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const campaign = {
  meta: {
    theme: {
      profile: 'modern',
      accent: '#c9845d',
      tokens: {
        panel: '#f1e5d2',
        cards: '#e6d2b5',
        inset: '#d8c2a3',
        log: '#f5eddf',
      },
    },
  },
} as CampaignData
const vars = themeVars(campaign)
for (const [surface, background] of [
  ['panel', '#f1e5d2'],
  ['card', '#e6d2b5'],
  ['inset', '#d8c2a3'],
  ['log', '#f5eddf'],
] as const) {
  const text = vars[`--cf-${surface}-text`]
  const accent = vars[`--cf-${surface}-accent`]
  const accentBright = vars[`--cf-${surface}-accent-bright`]
  assert.equal(typeof text, 'string', `${surface}: contrast-aware text token exists`)
  assert.equal(typeof accent, 'string', `${surface}: contrast-aware accent token exists`)
  assert.equal(typeof accentBright, 'string', `${surface}: contrast-aware bright accent token exists`)
  assert.ok(contrast(background, String(text)) >= 4.5, `${surface}: body text meets 4.5:1 contrast`)
  assert.ok(contrast(background, String(accent)) >= 4.5, `${surface}: accent text meets 4.5:1 contrast`)
  assert.ok(contrast(background, String(accentBright)) >= 4.5, `${surface}: bright accent text meets 4.5:1 contrast`)
  for (const state of ['red-bright', 'green-bright', 'blue-bright']) {
    assert.ok(contrast(background, String(vars[`--cf-${surface}-${state}`])) >= 4.5, `${surface}: ${state} meets 4.5:1 contrast`)
  }
}
assert.ok(contrast('#f1e5d2', String(vars['--cf-panel-red-bright'])) >= 4.5, 'status colors remain readable on paper panels')

const darkCampaign = {
  meta: { theme: { profile: 'modern', tokens: { panel: '#1d2026', cards: '#262a32' } } },
} as CampaignData
const darkVars = themeVars(darkCampaign)
assert.ok(contrast('#1d2026', String(darkVars['--cf-panel-text'])) >= 4.5, 'dark panel text remains readable')
assert.equal(themeVars(null)['--cf-panel-text'], undefined, 'campaigns without custom surfaces keep profile tokens')

const css = readFileSync('src/index.css', 'utf8')
assert.match(css, /\.campaigns-overlay\s*\{[\s\S]*?position:\s*fixed;/, 'campaign overlay remains viewport-fixed')
assert.doesNotMatch(css, /\.main-menu\.with-bg[^{}]*campaigns-overlay[^{}]*position:\s*relative/, 'menu layering does not redefine overlay positioning')
assert.match(css, /\.char-create-inner[^\n]*max-height:\s*calc\(100vh - 48px\)/, 'character creation scrolls within short screens')
assert.match(css, /\.campaigns-box \.campaign-list\s*\{[^}]*width:\s*100%/, 'campaign rows use the available modal width')
assert.match(css, /\.main-menu\.with-bg \.main-menu-inner\s*\{[^}]*backdrop-filter:\s*blur/, 'campaign menu content is separated from busy artwork')
const mainMenu = readFileSync('src/player/MainMenu.tsx', 'utf8')
assert.match(mainMenu, /titleArt !== menuBg/, 'same menu image is not rendered twice as title art')

const instructions = readFileSync('docs/ai-start-instruction.md', 'utf8')
assert.match(instructions, /надписи, состав или расположение системного\s+интерфейса/, 'AI instructions distinguish engine UI from campaign data')
for (const field of ['meta.title', 'meta.description', 'theme.menu.background', 'theme.menu.title_art', 'theme.end.background']) {
  assert.ok(instructions.includes(field), `AI instructions name editable campaign field ${field}`)
}

console.log('OK: контраст поверхностей, модальные окна и границы редактирования UI')
