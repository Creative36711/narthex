/**
 * Целостность сохранений (фидбек 27, п.7 — самый тяжёлый баг).
 *
 * Сценарий игрока: новая игра → пропуск катсцены → выход → «Продолжить» →
 * игра дальше → снова «Продолжить». Раньше при открытии сейва `repairState`
 *  — «снимал» с героя шаблонную экипировку (её нет в инвентаре),
 *  — стирал личные расположения NPC (ключи — id персонажей, не фракций).
 * Инвариант: сразу после нормальной игры сейв открывается БЕЗ замечаний,
 * а экипировка, инвентарь и расположения идентичны сохранённым.
 *
 * Прогоняется: «Шестерни и пепел» (все сочетания профессия × призвание) —
 * если пакет лежит в _ai-temp — и кампании из public/campaigns.
 *
 * Запуск: npx tsx scripts/save-integrity-smoke.mts   (dev-сервер не нужен)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => void mem.set(k, v),
  removeItem: (k) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const PKG_DIR = '_ai-temp/campaing/campaign_package'
{
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input)
    const pfx = 'http://localhost:5173/'
    if (u.startsWith(pfx)) {
      const rel = decodeURIComponent(new URL(u).pathname).replace(/^\/+/, '')
      const file = rel.startsWith('__pkg__/') ? `${PKG_DIR}/${rel.slice('__pkg__/'.length)}` : `public/${rel}`
      try {
        return new Response(await readFile(file), { status: 200 })
      } catch {
        return new Response('not found', { status: 404 })
      }
    }
    return orig(input, init)
  }) as typeof fetch
}

const { GameEngine } = await import('../src/core/engine')
const { openSave, slotKey } = await import('../src/core/savemigrate')
const { loadCampaign } = await import('../src/core/loader')
const { newCharChoice, withProfession, withCalling } = await import('../src/core/charcreate')
import type { CampaignData, NpcDef } from '../src/shared/types'

let failed = 0
let checks = 0
const ok = (cond: boolean, label: string, extra = '') => {
  checks++
  if (!cond) {
    failed++
    console.log(`✗ ${label}${extra ? `\n    ${extra}` : ''}`)
  }
}
const j = (v: unknown) => JSON.stringify(v ?? null)

/** открыть сейв как «Продолжить» и сравнить срез с эталоном */
function reopen(campaign: CampaignData, tag: string, expected: { equipment: string; inventory: string; dispositions: string }, slot: 'auto' | number = 'auto') {
  const opened = openSave(campaign.meta.id, campaign, slot)
  ok(!!opened && opened.verdict.kind === 'ok', `${tag}: сейв открывается`)
  if (!opened || opened.verdict.kind !== 'ok') return null
  const notes = opened.report.notes.map((n) => n.text)
  ok(notes.length === 0, `${tag}: «Продолжить» без замечаний (модалки «починено» быть не должно)`, notes.join(' | '))
  const p = opened.state.player
  ok(j(p.equipment) === expected.equipment, `${tag}: экипировка не тронута`, `${expected.equipment} → ${j(p.equipment)}`)
  ok(j(p.inventory) === expected.inventory, `${tag}: инвентарь не тронут`)
  ok(j(opened.state.dispositions) === expected.dispositions, `${tag}: расположения не тронуты`, `${expected.dispositions} → ${j(opened.state.dispositions)}`)
  return opened
}

const snap = (s: { player: { equipment?: unknown; inventory: unknown }; dispositions: unknown }) => ({
  equipment: j(s.player.equipment),
  inventory: j(s.player.inventory),
  dispositions: j(s.dispositions),
})

async function scenario(campaign: CampaignData, label: string, mk: () => InstanceType<typeof GameEngine>) {
  mem.clear()
  const tag = label
  const eng = mk()
  eng.start()
  // пропуск катсцены (как кнопка «Пропустить»: endCutscene до пустой очереди)
  let guard = 0
  while (eng.cutsceneQueue.length && guard++ < 50) eng.endCutscene()
  eng.autosave() // «выход из игры»
  ok(mem.has(slotKey(campaign.meta.id, 'auto')), `${tag}: автосейв записан`)

  const hadEquipment = Object.keys(eng.state.player.equipment ?? {}).length > 0
  const first = reopen(campaign, `${tag} / продолжить 1`, snap(eng.state))
  if (!first) return { hadEquipment }

  // игра дальше: персональный сдвиг отношения NPC, время, предмет, ручной слот
  const eng2 = new GameEngine(campaign, first.state)
  eng2.start()
  const npcs = Object.values(campaign.entities).filter((e) => e.type === 'npc' && e.id !== campaign.meta.default_player)
  const target = npcs[0]?.id
  if (target) eng2.changeDisposition(target, 7)
  eng2.advanceTicks(3)
  const anyItem = Object.values(campaign.entities).find((e) => e.type === 'item')
  if (anyItem) eng2.addItem(anyItem.id, 1, { silent: true })
  eng2.autosave()
  const second = reopen(campaign, `${tag} / продолжить 2 (после игры)`, snap(eng2.state))
  if (second && target) {
    ok(second.state.dispositions[target] === 7, `${tag}: личное расположение «${target}» пережило загрузку`, `${j(second.state.dispositions[target])}`)
  }
  if (eng2.manualSave(1)) reopen(campaign, `${tag} / ручной слот 1`, snap(eng2.state), 1)
  return { hadEquipment }
}

// ───── 1) «Шестерни и пепел»: все профессии × призвания ─────
if (existsSync(`${PKG_DIR}/campaign.json`)) {
  const campaign = await loadCampaign('http://localhost:5173/__pkg__')
  const cc = campaign.meta.char_creation
  const tmpl = campaign.entities[campaign.meta.default_player] as NpcDef
  const combos: Array<[string, string]> = []
  for (const p of cc?.professions ?? [{ id: '' }]) for (const c of cc?.callings ?? [{ id: '' }]) combos.push([p.id, c.id])
  let withGear = 0
  for (const [prof, calling] of combos) {
    const r = await scenario(campaign, `Шестерни: ${prof || '—'} × ${calling || '—'}`, () => {
      const e = new GameEngine(campaign)
      if (cc) {
        let ch = newCharChoice(cc, tmpl, campaign.meta)
        if (prof) ch = withProfession(cc, ch, prof)
        if (calling) ch = withCalling(cc, ch, calling)
        e.applyCharCreation({ ...ch, name: 'Тест' })
      }
      return e
    })
    if (r.hadEquipment) withGear++
  }
  // защита от «пустого» теста: на кампании реально есть надетое снаряжение
  ok(withGear > 0, 'Шестерни: у героя есть шаблонная экипировка (иначе проверка не имеет смысла)')
  console.log(`Шестерни и пепел: сочетаний ${combos.length}, с экипировкой ${withGear}`)
} else {
  console.log('(пакет «Шестерни и пепел» не найден — часть 1 пропущена)')
}

// ───── 2) кампании из public/campaigns ─────
for (const id of existsSync('public/campaigns') ? readdirSync('public/campaigns').filter((d) => existsSync(`public/campaigns/${d}/campaign.json`)) : []) {
  const campaign = await loadCampaign(`http://localhost:5173/campaigns/${id}`)
  await scenario(campaign, `public/${id}`, () => new GameEngine(campaign))
}

// ───── 3) контроль: настоящая порча по-прежнему чинится ─────
{
  const campaign = await loadCampaign(existsSync(`${PKG_DIR}/campaign.json`) ? 'http://localhost:5173/__pkg__' : 'http://localhost:5173/campaigns/ash-of-caerden')
  mem.clear()
  const eng = new GameEngine(campaign)
  eng.start()
  eng.state.player.equipment = { ...(eng.state.player.equipment ?? {}), [Object.keys(campaign.meta.equipment_slots ?? { weapon: 1 })[0] ?? 'weapon']: 'item_нет_такого_предмета' }
  eng.state.dispositions['npc_нет_такого'] = 5
  eng.autosave()
  const opened = openSave(campaign.meta.id, campaign)
  ok(!!opened && opened.report.notes.length > 0, 'контроль: ссылка на несуществующий предмет и NPC по-прежнему чинится и сообщается')
  ok(!!opened && !('npc_нет_такого' in opened.state.dispositions), 'контроль: расположение к несуществующему NPC удалено')
}

if (failed) {
  console.error(`\nsave-integrity-smoke: провалено ${failed} из ${checks} проверок`)
  process.exit(1)
}
console.log(`\nsave-integrity-smoke: всё хорошо (${checks} проверок)`)
