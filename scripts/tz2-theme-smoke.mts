/**
 * Смоук блока 2 ТЗ «Гибкий движок» — тема кампании (шрифты, меню, финал).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz2-theme-smoke.mts
 *
 *  1. типы и рантайм темы: themeVars собирает CSS-переменные по ролям;
 *  2. фон меню/финала резолвится через assetUrl (файл и ссылка);
 *  3. плеер: меню рендерит фон/затемнение/арт, финал — фон;
 *  4. настройки: размер текста (масштаб);
 *  5. редактор: вкладка «Оформление» с ролями и предпросмотром;
 *  6. монолит гоняет fonts/theme без потерь; схема знает типы.
 */
import { readFileSync } from 'node:fs'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadCampaign } from '../src/core/loader'
import { CampaignEditor } from '../src/editor/CampaignEditor'
import { EditorStore } from '../src/editor/store'
import { FONT_ROLES } from '../src/editor/campaignFonts'
import { FontSample, ProfilePicker, ProfilePreview } from '../src/editor/campaignAppearance'
import { themeVars, themeBackgroundUrl, fontFamily } from '../src/shared/theme'
import { DEFAULT_SETTINGS } from '../src/shared/settings'
import type { CampaignData, CampaignMeta } from '../src/shared/types'

;(globalThis as any).React = React
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const campaign = await loadCampaign(base)

function withTheme(theme: CampaignMeta['theme'], fonts: CampaignMeta['fonts'] = []): CampaignData {
  return { ...campaign, meta: { ...campaign.meta, theme, fonts } }
}

// ── 1. рантайм темы ──
{
  const c = withTheme(
    { fonts: { body: 'font_g', display: 'font_d' }, menu: { background: 'assets/img/menu.jpg', dim: 0.6 }, accent: '#884422' },
    [
      { id: 'font_g', label: 'Готика', src: 'assets/fonts/g.woff2', weight: '400' },
      { id: 'font_d', label: 'Дисплей', src: 'assets/fonts/d.woff2', weight: '700' },
    ],
  )
  const vars = themeVars(c, 1.15) as Record<string, string>
  check('1 роли шрифтов → переменные', String(vars['--cf-font-body']).includes(fontFamily('font_g')) && String(vars['--cf-font-display']).includes(fontFamily('font_d')))
  check('1 акцент переопределяет --gold', vars['--gold'] === '#884422')
  check('1 масштаб текста → переменная', vars['--cf-text-scale'] === '1.15')
  check('1 без темы переменные не ставятся', Object.keys(themeVars(campaign)).length === 0)
}

// ── 2. фоны меню и финала ──
{
  const c = withTheme({ menu: { background: 'assets/img/menu.jpg' } })
  check('2 фон меню из файла пакета', themeBackgroundUrl(c, 'menu').includes('assets/img/menu.jpg'))
  check('2 фон финала падает на фон меню', themeBackgroundUrl(c, 'end').includes('assets/img/menu.jpg'))
  const c2 = withTheme({ menu: { background: 'assets/img/m.jpg' }, end: { background: 'https://cdn.example.com/end.png' } })
  check('2 фон финала — своя ссылка', themeBackgroundUrl(c2, 'end') === 'https://cdn.example.com/end.png')
  check('2 без темы фона нет', themeBackgroundUrl(campaign, 'menu') === '')
}

// ── 3. плеер ──
{
  const menu = readFileSync('src/player/MainMenu.tsx', 'utf8')
  check('3 меню: фон и затемнение', menu.includes('themeBackgroundUrl') && menu.includes('menu-dim'))
  check('3 меню: кен-бёрнс и арт-заголовок', menu.includes('ken-burns') && menu.includes('title_art'))
  const end = readFileSync('src/player/EndScreen.tsx', 'utf8')
  check('3 финал: фон темы', end.includes('themeBackgroundUrl') && end.includes('end-bg'))
  const app = readFileSync('src/App.tsx', 'utf8')
  check('3 плеер обёрнут в .cf-themed (редактор — нет)', app.includes('cf-themed') && app.includes('injectCampaignFonts'))
}

// ── 4. настройки: размер текста ──
{
  check('4 настройка масштаба текста', DEFAULT_SETTINGS.text_scale === 1)
  const panel = readFileSync('src/shared/SettingsPanel.tsx', 'utf8')
  check('4 селектор размера текста', panel.includes('text_scale') && panel.includes('Размер текста'))
}

// ── 5. редактор ──
{
  const store = new EditorStore('/campaigns/theme-api')
  store.meta = campaign.meta
  const editorMarkup = renderToStaticMarkup(createElement(CampaignEditor, { store }))
  const profileMarkup = renderToStaticMarkup(createElement(ProfilePicker, { meta: campaign.meta, commit: () => undefined }))
  const fontMarkup = renderToStaticMarkup(createElement(FontSample, { store, fontId: 'font_missing', meta: campaign.meta, role: FONT_ROLES[0] }))
  check('5 вкладка «Оформление»', typeof CampaignEditor === 'function' && editorMarkup.includes('Оформление') && typeof ProfilePicker === 'function')
  check('5 реестр шрифтов и роли', FONT_ROLES.length >= 3 && FONT_ROLES.every((role) => role.key && role.label && role.sample) && profileMarkup.includes('profile-group'))
  check('5 живой предпросмотр (@font-face)', typeof FontSample === 'function' && typeof ProfilePreview === 'function' && fontMarkup.includes(FONT_ROLES[0].label))
  const fields = readFileSync('src/editor/Fields.tsx', 'utf8')
  check('5 AssetUpload принимает шрифты', fields.includes('.woff2,.woff,.ttf,.otf'))
}

// ── 6. монолит и схема ──
{
  const { exportMonolith, importMonolith, parseMonolith } = await import('../src/editor/monolith')
  const store = new EditorStore(base)
  await store.load()
  store.meta.fonts = [{ id: 'font_test', label: 'Тест', src: 'assets/fonts/t.woff2' }]
  store.meta.theme = { fonts: { body: 'font_test' }, menu: { background: 'assets/img/bg.jpg', dim: 0.4 } }
  const { doc } = exportMonolith(store)
  check('6 монолит: шрифты и тема в экспорте', doc.campaign.fonts?.[0].id === 'font_test' && doc.campaign.theme?.menu?.dim === 0.4)
  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  check('6 монолит: импорт возвращает тему', store2.meta.fonts?.[0].id === 'font_test' && store2.meta.theme?.fonts?.body === 'font_test')
  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('6 схема знает FontDef и ThemeDoc', schema.includes('FontDef') && schema.includes('ThemeDoc'))
  check('6 гайд ИИ обновлён', readFileSync('docs/ai-campaign-guide.md', 'utf8').includes('theme'))
}

console.log(failed === 0 ? 'ALL GREEN (tz2-theme)' : `FAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
