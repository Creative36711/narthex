/**
 * Смоук редизайна 2026 — каталог игровых визуальных профилей (13 штук).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz12-profiles-smoke.mts
 *
 *  1. обратная совместимость: кампания без theme — фирменный дефолт,
 *     старые id fantasy/horror/survival сопоставляются с новыми,
 *     переменные темы не ставятся, механики не тронуты;
 *  2. реестр: 13 профилей, группы, именованные эффекты, шрифтовые роли;
 *  3. переопределения: акцент ведёт за собой «яркий» акцент, атмосфера
 *     выключается;
 *  4. редактор: профиль прогоняет монолит (экспорт/импорт) без потерь и
 *     без изменения игровых данных (dice_rules, квесты);
 *  5. схема, гайд, плеер и редактор знают каталог; у каждого профиля —
 *     свой блок токенов и свой характер в CSS (не просто цвет).
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { themeVars } from '../src/shared/theme'
import {
  VISUAL_PROFILES,
  PROFILE_GROUPS,
  LEGACY_PROFILE_IDS,
  DEFAULT_PROFILE,
  resolveProfile,
  profileClass,
  normalizeProfileId,
  atmosphereOn,
  contrastRatio,
} from '../src/shared/profiles'
import type { CampaignMeta, VisualProfileId } from '../src/shared/types'

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

// ── 1. обратная совместимость ──
{
  check('1 дефолт — фирменный профиль Narthex', DEFAULT_PROFILE === 'forge' && resolveProfile(null).id === 'forge')
  const noTheme = { ...campaign, meta: { ...campaign.meta, theme: undefined } }
  check('1 кампания без theme: фирменный профиль, атмосфера вкл', resolveProfile(noTheme.meta).id === 'forge' && atmosphereOn(noTheme.meta) === true)
  const vars = themeVars(noTheme) as Record<string, string>
  check('1 без переопределений переменные темы не ставятся', Object.keys(vars).length === 0)
  check('1 демо «Пепел Каэрдена» держит тёмное фэнтези', resolveProfile(campaign.meta).id === 'dark-fantasy')
  // старые id аккуратно сопоставляются
  check('1 legacy: fantasy → dark-fantasy', normalizeProfileId('fantasy') === 'dark-fantasy')
  check('1 legacy: horror → gothic-horror', normalizeProfileId('horror') === 'gothic-horror')
  check('1 legacy: survival → wilderness', normalizeProfileId('survival') === 'wilderness')
  check('1 legacy: неизвестное значение — дефолт', normalizeProfileId('nope') === DEFAULT_PROFILE)
  // механики не тронуты
  check('1 dice_rules на месте', campaign.meta.dice_rules?.fumble_from === 96)
  check('1 квесты загружены', campaign.quests && Object.keys(campaign.quests).length > 0)
}

// ── 2. реестр ──
{
  const ids = VISUAL_PROFILES.map((p) => p.id)
  check('2 каталог из 13 профилей', VISUAL_PROFILES.length === 13, ids.join(', '))
  const expected: VisualProfileId[] = [
    'forge', 'epic-fantasy', 'dark-fantasy', 'myth-folklore',
    'gothic-horror', 'cosmic-horror', 'noir', 'historical',
    'wilderness', 'postapocalypse', 'scifi', 'cyberpunk', 'modern',
  ]
  check('2 id каталога совпадают с ТЗ', ids.join(',') === expected.join(','))
  check('2 каждый профиль в своей группе', PROFILE_GROUPS.every((g) => VISUAL_PROFILES.some((p) => p.group === g.id)))
  const withMeta = (profile: string): CampaignMeta => ({ ...campaign.meta, theme: { profile: profile as VisualProfileId } })
  for (const p of VISUAL_PROFILES) {
    check(`2 «${p.label}»: разрешение, класс, эффект, шрифты`,
      resolveProfile(withMeta(p.id)).id === p.id
      && profileClass(withMeta(p.id)) === `cf-profile-${p.id}`
      && !!p.effect && p.effectLabel.length > 5
      && !!p.fonts.body && !!p.fonts.display)
  }
  check('2 профили различаются палитрой', new Set(VISUAL_PROFILES.map((p) => p.swatches.bg)).size === 13)
  check('2 профили различаются дисплейными шрифтами', new Set(VISUAL_PROFILES.map((p) => p.fonts.display)).size >= 6)
  check('2 профили различаются эффектами', new Set(VISUAL_PROFILES.map((p) => p.effect)).size >= 6)
}

// ── 3. переопределения ──
{
  const meta = { ...campaign.meta, theme: { profile: 'cyberpunk', accent: '#7a2a2a', atmosphere: false } }
  const vars = themeVars({ ...campaign, meta }) as Record<string, string>
  check('3 акцент переопределяет --gold', vars['--gold'] === '#7a2a2a')
  check('3 «яркий» акцент выведен из авторского', !!vars['--gold-bright'] && vars['--gold-bright'] !== '#7a2a2a')
  check('3 атмосфера выключается', atmosphereOn(meta) === false)
  check('3 контраст: тёмный акцент к панели — низкий', contrastRatio('#1a1410', '#211a14') < 2.5)
  check('3 контраст: золото к панели — читаемый', contrastRatio('#c9a45c', '#211a14') >= 2.5)
}

// ── 4. редактор: монолит и данные ──
{
  const { EditorStore } = await import('../src/editor/store')
  const { exportMonolith, importMonolith, parseMonolith } = await import('../src/editor/monolith')
  const store = new EditorStore(base)
  await store.load()
  const diceBefore = JSON.stringify(store.meta.dice_rules)
  const questCountBefore = store.questPaths().length

  store.meta.theme = { profile: 'cosmic-horror' }
  store.touch('campaign.json')
  const { doc } = exportMonolith(store)
  check('4 профиль в экспорте монолита', (doc.campaign as CampaignMeta).theme?.profile === 'cosmic-horror')
  check('4 dice_rules не изменились экспортом', JSON.stringify(doc.campaign.dice_rules) === diceBefore)

  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  check('4 импорт возвращает профиль', store2.meta.theme?.profile === 'cosmic-horror')
  const questCountAfter = store2.questPaths().length
  check('4 квесты не изменились', questCountAfter === questCountBefore, `${questCountAfter} = ${questCountBefore}`)
  check('4 dice_rules не изменились импортом', JSON.stringify(store2.meta.dice_rules) === diceBefore)

  // «сброс к профилю»: переопределения убрали, профиль и данные на месте
  store2.meta.theme = { profile: 'noir', accent: '#111111', menu: { dim: 0.7 } }
  delete store2.meta.theme!.accent
  delete store2.meta.theme!.menu
  check('4 сброс оставил профиль', store2.meta.theme?.profile === 'noir' && !store2.meta.theme?.accent)
}

// ── 5. схема, гайд, плеер, редактор, CSS ──
{
  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('5 схема знает VisualProfileId', schema.includes('VisualProfileId'))
  check('5 схема знает все id каталога', VISUAL_PROFILES.every((p) => schema.includes(`"${p.id}"`)))
  const guide = readFileSync('docs/ai-campaign-guide.md', 'utf8')
  check('5 гайд ИИ объясняет фирменный профиль', guide.includes('"forge"') && guide.includes('Narthex') && guide.includes('по умолчанию'))
  check('5 гайд перечисляет каталог', ['epic-fantasy', 'gothic-horror', 'cyberpunk', 'historical'].every((id) => guide.includes(id)))
  const app = readFileSync('src/App.tsx', 'utf8')
  check('5 плеер применяет класс профиля', app.includes('profileClass') && app.includes('cf-themed'))
  check('5 профиль на <html> (модалки совпадают)', app.includes('root.classList.add(profileClass'))
  const ed = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('5 редактор: каталог сгруппирован', ed.includes('ProfilePicker') && ed.includes('PROFILE_GROUPS') && ed.includes('profile-group'))
  check('5 редактор: подпись эффекта из реестра', ed.includes('profile.effectLabel'))
  const play = readFileSync('src/editor/EditorApp.tsx', 'utf8')
  check('5 плейтест обёрнут в тему кампании', play.includes('profileClass(testCampaign.meta)'))
  // каждый профиль — цельное направление в CSS: блок токенов + именованный эффект
  const css = readFileSync('src/index.css', 'utf8')
  const allBlocks = VISUAL_PROFILES.every((p) => css.includes(`.cf-profile-${p.id} {`))
  check('5 CSS: блок токенов у каждого из 13 профилей', allBlocks)
  const allFx = VISUAL_PROFILES.every((p) => {
    const i = css.indexOf(`.cf-profile-${p.id} {`)
    const j = css.indexOf('}', i)
    return css.slice(i, j).includes('--fx-vignette') && css.slice(i, j).includes('--fx-grain-opacity')
  })
  check('5 CSS: именованный эффект у каждого профиля', allFx)
  const allFonts = VISUAL_PROFILES.every((p) => {
    const i = css.indexOf(`.cf-profile-${p.id} {`)
    const j = css.indexOf('}', i)
    return css.slice(i, j).includes('--cf-font-body') && css.slice(i, j).includes('--cf-font-display')
  })
  check('5 CSS: шрифтовые роли у каждого профиля', allFonts)
  // «характер»: характерные правила типографики/декора вне палитры
  const character =
    css.includes('.cf-profile-cosmic-horror h1')
    && css.includes('.cf-profile-epic-fantasy .scene-stage')
    && css.includes('.cf-profile-cyberpunk h1')
    && css.includes('.cf-profile-forge .panel')
    && css.includes('.cf-profile-historical h1')
  check('5 CSS: характер (типграфика/декор), а не только палитра', character)
}

console.log(failed === 0 ? 'ALL GREEN (tz12-profiles)' : `FAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
