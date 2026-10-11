import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const campaignDir = '_ai-temp/campaing'

console.log('=== Аудит кампании сценариста из _ai-temp/campaing ===\n')

const manifestPath = join(campaignDir, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error('Манифест не найден!')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
const campaignMeta = JSON.parse(readFileSync(join(campaignDir, 'campaign.json'), 'utf-8'))
const world = JSON.parse(readFileSync(join(campaignDir, 'world.json'), 'utf-8'))

console.log(`Кампания: «${campaignMeta.title}» (${campaignMeta.id})`)
console.log(`Автор: ${campaignMeta.author}, версия: ${campaignMeta.version}`)
console.log(`Локаций: ${world.regions?.[0]?.locations?.length ?? 0}, Сцен: ${manifest.scenes?.length ?? 0}, Сущностей: ${manifest.entities?.length ?? 0}, Правил: ${manifest.rules?.length ?? 0}, Диалогов: ${manifest.dialogues?.length ?? 0}`)

// Проверка используемых механик
const usedMechanics = new Set<string>()
const itemsWithDecay: string[] = []
const itemsWithCarryBonus: string[] = []
const itemsWithDurability: string[] = []
const itemsWithEquipmentSlot: string[] = []

for (const entityFile of manifest.entities ?? []) {
  const p = join(campaignDir, 'entities', entityFile)
  if (!existsSync(p)) continue
  const ent = JSON.parse(readFileSync(p, 'utf-8'))
  if (ent.type === 'item') {
    if (ent.decay_ticks !== undefined) {
      usedMechanics.add('Порча предметов (decay_ticks)')
      itemsWithDecay.push(`${ent.id} (${ent.label}, decay: ${ent.decay_ticks} ч, action: ${ent.spoil_action ?? 'default'}, into: ${ent.spoil_into ?? 'none'})`)
    }
    if (ent.carry_bonus !== undefined || ent.carry_mult !== undefined) {
      usedMechanics.add('Бонус грузоподъёмности (carry_bonus/carry_mult)')
      itemsWithCarryBonus.push(`${ent.id} (${ent.label}, bonus: ${ent.carry_bonus ?? 0} кг, mult: ${ent.carry_mult ?? 1.0}x)`)
    }
    if (ent.weapon_data?.durability !== undefined || ent.armor_data?.durability !== undefined) {
      usedMechanics.add('Износ снаряжения (durability)')
      itemsWithDurability.push(ent.id)
    }
    if (ent.equip_slot) {
      usedMechanics.add('Слоты экипировки (equip_slot)')
      itemsWithEquipmentSlot.push(`${ent.id} -> ${ent.equip_slot}`)
    }
  }
}

// Проверка правил
let rulesWithWeather = 0
let rulesWithPursuit = 0
let rulesWithDispositions = 0
for (const ruleFile of manifest.rules ?? []) {
  const p = join(campaignDir, 'rules', ruleFile)
  if (!existsSync(p)) continue
  const r = JSON.parse(readFileSync(p, 'utf-8'))
  for (const eff of r.effects ?? []) {
    if (eff.type === 'change_disposition') rulesWithDispositions++
    if (eff.type === 'start_pursuit') rulesWithPursuit++
    if (eff.type === 'set_weather') rulesWithWeather++
  }
}
if (rulesWithWeather > 0) usedMechanics.add('Смена погоды (set_weather)')
if (rulesWithPursuit > 0) usedMechanics.add('Преследование (start_pursuit)')
if (rulesWithDispositions > 0) usedMechanics.add('Отношения с NPC (change_disposition)')

// Проверка сцен
let scenesWithIntro = 0
let scenesWithParticles = 0
for (const scFile of manifest.scenes ?? []) {
  const p = join(campaignDir, 'scenes', scFile)
  if (!existsSync(p)) continue
  const sc = JSON.parse(readFileSync(p, 'utf-8'))
  if (sc.narrative_intro?.length) scenesWithIntro++
  if (sc.particles && sc.particles !== 'none') scenesWithParticles++
}
if (scenesWithIntro > 0) usedMechanics.add(`Нарративные слайды входа (narrative_intro: ${scenesWithIntro} сцен)`)
if (scenesWithParticles > 0) usedMechanics.add(`Атмосферные частицы (particles: ${scenesWithParticles} сцен)`)

// Проверка перегруза в мета
if (campaignMeta.encumbrance) {
  usedMechanics.add('Кастомные правила перегруза (meta.encumbrance)')
}
if (campaignMeta.camping) {
  usedMechanics.add('Лагерь и ночлег (meta.camping)')
}
if (campaignMeta.hazards) {
  usedMechanics.add('Опасности высоты и падений (meta.hazards)')
}
if (campaignMeta.new_game_plus) {
  usedMechanics.add('New Game+ (meta.new_game_plus)')
}

console.log('\n--- Использованные механики сценаристом: ---')
for (const m of usedMechanics) console.log(`✓ ${m}`)

console.log('\nПредметы со сроком годности (порча):')
for (const it of itemsWithDecay) console.log(`  • ${it}`)

console.log('\nПредметы с бонусом грузоподъёмности:')
for (const it of itemsWithCarryBonus) console.log(`  • ${it}`)

console.log('\n--- Механики движка, которые сценарист НЕ использовал: ---')
const allPossible = [
  'Кастомные правила перегруза (meta.encumbrance)',
  'Лагерь и ночлег (meta.camping)',
  'Опасности высоты и падений (meta.hazards)',
  'New Game+ (meta.new_game_plus)',
  'Преследование (start_pursuit)',
  'Генераторы случайных событий (meta.generators)',
  'Карта переходов с дорожными событиями (encounters в travel_connections)',
  'Износ и починка оружия/брони рецептами (repair: true)',
  'Настройка слоев звука локаций и фонового шума сцен (ambient с фильтрами)',
  'Режиссура камеры в нарративе (camera pan/zoom)',
]

for (const m of allPossible) {
  if (!usedMechanics.has(m)) {
    console.log(`  ○ ${m}`)
  }
}
