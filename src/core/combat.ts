import type {
  ArenaDef,
  Effect,
  ItemDef,
  NpcDef,
  StatBlock,
  WeaponData,
} from '../shared/types'
import type { GameEngine } from './engine'
import { type Hex, hexKey, hexDistance, reachable, astar } from './hex'
import { skillCheck, damageBonus, movement, derivedHP, type CheckResult } from './brp'
import { rollDice } from './dice'

/**
 * Тактический бой на гексах (ТЗ 4.3, Фаза 1).
 * Цикл: инициатива (DEX) → движение (MOV, сложная местность ×2) →
 * атака (навык оружия) → защита (уклонение/парирование, повторные −30%) →
 * урон (кости + damage bonus − броня).
 */

export interface Combatant {
  id: string
  entityId: string
  label: string
  side: 'player' | 'enemy'
  portrait?: string
  stats: StatBlock
  skills: Record<string, number>
  weapon: WeaponData
  weaponLabel: string
  armor: number
  hp: number
  maxHp: number
  pos: Hex
  mov: number
  movLeft: number
  attacked: boolean
  defensesUsed: number
  dead: boolean
}

type StartCombatEffect = Extract<Effect, { type: 'start_combat' }>

const RANK: Record<CheckResult, number> = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 }

const FISTS: WeaponData = {
  skill: 'brawl',
  damage: '1d3',
  damage_bonus: true,
  range: 1,
  attacks_per_round: 1,
  parry_capable: false,
  label: 'Кулаки',
}

function rollSigned(notation: string, rng: GameEngine['rng']): number {
  const n = notation.trim()
  if (n === '0' || n === '') return 0
  if (n.startsWith('-')) return -rollDice(n.slice(1), rng)
  if (n.startsWith('+')) return rollDice(n.slice(1), rng)
  return rollDice(n, rng)
}

function maxOf(notation: string): number {
  const n = notation.trim().replace(/^[+]/, '')
  const neg = n.startsWith('-')
  const body = neg ? n.slice(1) : n
  const m = body.match(/^(\d*)[dD](\d+)([+-]\d+)?$/)
  if (!m) return Number(body) || 0
  const v = (m[1] ? parseInt(m[1], 10) : 1) * parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) : 0)
  return neg ? -v : v
}

export interface CombatLootEntry {
  label: string
  quantity: number
}

export class CombatController {
  readonly engine: GameEngine
  readonly arena: ArenaDef
  readonly def: StartCombatEffect
  combatants: Combatant[] = []
  round = 1
  activeIndex = 0
  log: string[] = []
  result: 'victory' | 'defeat' | null = null
  loot: CombatLootEntry[] = []
  private blocked: Set<string>
  private difficult: Set<string>

  constructor(engine: GameEngine, def: StartCombatEffect) {
    this.engine = engine
    this.def = def
    const arena = engine.campaign.arenas[def.arena]
    if (!arena) throw new Error(`Арена не найдена: ${def.arena}`)
    this.arena = arena
    this.blocked = new Set(arena.hex_grid.blocked_hexes.map(([c, r]) => `${c},${r}`))
    this.difficult = new Set(arena.hex_grid.difficult_terrain.map(([c, r]) => `${c},${r}`))
    this.setup()
    if (def.intro) this.log.push(def.intro)
    this.log.push(`— Раунд 1 —`)
    this.startRound()
    this.processUntilPlayer()
  }

  // ─────────────── подготовка ───────────────

  private setup(): void {
    const e = this.engine
    const p = e.state.player
    const playerDef = e.campaign.entities[p.entity] as NpcDef
    const playerSpawns = [...this.arena.spawn_zones.player.hexes]
    const enemySpawns = [...this.arena.spawn_zones.enemy.hexes]

    const { weapon, weaponLabel } = this.resolveWeapon(playerDef, p.skills)
    this.combatants.push({
      id: 'c_player',
      entityId: p.entity,
      label: playerDef.label,
      side: 'player',
      portrait: playerDef.portrait?.neutral,
      stats: p.stats,
      skills: p.skills,
      weapon,
      weaponLabel,
      armor: this.resolveArmor(playerDef),
      hp: p.hp,
      maxHp: p.max_hp,
      pos: this.takeSpawn(playerSpawns),
      mov: movement(p.stats),
      movLeft: 0,
      attacked: false,
      defensesUsed: 0,
      dead: false,
    })

    let n = 0
    for (const grp of this.def.enemies) {
      const def = e.campaign.entities[grp.entity] as NpcDef
      if (!def) continue
      for (let i = 0; i < grp.count; i++) {
        n++
        const hp = def.stats.HP ?? derivedHP(def.stats)
        const w = this.resolveWeapon(def, def.skills)
        this.combatants.push({
          id: `c_enemy_${n}`,
          entityId: def.id,
          label: grp.count > 1 ? `${def.label} ${i + 1}` : def.label,
          side: 'enemy',
          portrait: def.portrait?.neutral,
          stats: def.stats,
          skills: def.skills,
          weapon: w.weapon,
          weaponLabel: w.weaponLabel,
          armor: this.resolveArmor(def),
          hp,
          maxHp: hp,
          pos: this.takeSpawn(enemySpawns),
          mov: movement(def.stats),
          movLeft: 0,
          attacked: false,
          defensesUsed: 0,
          dead: false,
        })
      }
    }

    // инициатива: DEX от высокого к низкому
    this.combatants.sort((a, b) => b.stats.DEX - a.stats.DEX || (this.engine.rng.chance(0.5) ? -1 : 1))
  }

  private takeSpawn(spawns: Array<[number, number]>): Hex {
    while (spawns.length) {
      const [col, row] = spawns.shift()!
      if (!this.occupantAt({ col, row })) return { col, row }
    }
    return { col: 0, row: 0 }
  }

  private resolveWeapon(def: NpcDef, skills: Record<string, number>): { weapon: WeaponData; weaponLabel: string } {
    const weaponItemId = def.equipment?.weapon
    if (weaponItemId) {
      const item = this.engine.campaign.entities[weaponItemId] as ItemDef | undefined
      if (item?.weapon_data) return { weapon: item.weapon_data, weaponLabel: item.label }
    }
    if (def.natural_weapon) return { weapon: def.natural_weapon, weaponLabel: def.natural_weapon.label ?? 'Атака' }
    void skills
    return { weapon: FISTS, weaponLabel: FISTS.label! }
  }

  private resolveArmor(def: NpcDef): number {
    if (def.armor != null) return def.armor
    const armorItemId = def.equipment?.armor
    if (armorItemId) {
      const item = this.engine.campaign.entities[armorItemId] as ItemDef | undefined
      if (item?.armor_data) return item.armor_data.points
    }
    return 0
  }

  // ─────────────── доступ ───────────────

  get active(): Combatant {
    return this.combatants[this.activeIndex]
  }

  isPlayerTurn(): boolean {
    return !this.result && this.active.side === 'player'
  }

  occupantAt(h: Hex): Combatant | undefined {
    return this.combatants.find((c) => !c.dead && c.pos.col === h.col && c.pos.row === h.row)
  }

  inBounds(h: Hex): boolean {
    return h.col >= 0 && h.row >= 0 && h.col < this.arena.hex_grid.cols && h.row < this.arena.hex_grid.rows
  }

  isBlocked(h: Hex): boolean {
    return this.blocked.has(hexKey(h))
  }

  isDifficult(h: Hex): boolean {
    return this.difficult.has(hexKey(h))
  }

  passable = (h: Hex): boolean =>
    this.inBounds(h) && !this.isBlocked(h) && !this.occupantAt(h)

  moveCost = (h: Hex): number => (this.isDifficult(h) ? 2 : 1)

  /** Гексы, куда может дойти активный боец. */
  reachableHexes(): Map<string, number> {
    const a = this.active
    return reachable(a.pos, a.movLeft, this.passable, this.moveCost)
  }

  canAttack(attacker: Combatant, target: Combatant): boolean {
    return (
      !attacker.attacked &&
      !attacker.dead &&
      !target.dead &&
      attacker.side !== target.side &&
      hexDistance(attacker.pos, target.pos) <= attacker.weapon.range
    )
  }

  // ─────────────── действия игрока ───────────────

  playerMoveTo(h: Hex): void {
    if (!this.isPlayerTurn()) return
    const r = this.reachableHexes()
    const cost = r.get(hexKey(h))
    if (cost == null) return
    this.active.pos = { ...h }
    this.active.movLeft -= cost
    this.engine.notify()
  }

  playerAttack(targetId: string): void {
    if (!this.isPlayerTurn()) return
    const target = this.combatants.find((c) => c.id === targetId)
    if (!target || !this.canAttack(this.active, target)) return
    this.resolveAttack(this.active, target)
    this.checkEnd()
    this.engine.notify()
  }

  playerEndTurn(): void {
    if (!this.isPlayerTurn()) return
    this.nextTurn()
    this.processUntilPlayer()
    this.engine.notify()
  }

  // ─────────────── цикл раундов ───────────────

  private startRound(): void {
    for (const c of this.combatants) {
      c.movLeft = c.mov
      c.attacked = false
      c.defensesUsed = 0
    }
  }

  private nextTurn(): void {
    let guard = 0
    do {
      this.activeIndex++
      if (this.activeIndex >= this.combatants.length) {
        this.activeIndex = 0
        this.round++
        this.log.push(`— Раунд ${this.round} —`)
        this.startRound()
      }
      guard++
    } while (this.active.dead && guard < 100)
  }

  private processUntilPlayer(): void {
    let guard = 0
    while (!this.result && this.active.side === 'enemy' && guard < 100) {
      this.aiTurn(this.active)
      this.checkEnd()
      if (this.result) break
      this.nextTurn()
      guard++
    }
    if (!this.result && this.active.dead) this.nextTurn()
  }

  // ─────────────── AI (базовый: к ближайшему, атаковать) ───────────────

  private aiTurn(c: Combatant): void {
    const targets = this.combatants.filter((x) => !x.dead && x.side !== c.side)
    if (!targets.length) return
    targets.sort((a, b) => hexDistance(c.pos, a.pos) - hexDistance(c.pos, b.pos))
    const target = targets[0]

    if (hexDistance(c.pos, target.pos) > c.weapon.range) {
      const path = astar(c.pos, target.pos, this.passable, this.moveCost)
      if (path) {
        // идём по пути, не заходя в гекс цели
        for (const step of path) {
          if (this.occupantAt(step)) break
          const cost = this.moveCost(step)
          if (c.movLeft < cost) break
          if (hexDistance(c.pos, target.pos) <= c.weapon.range) break
          c.pos = { ...step }
          c.movLeft -= cost
        }
      }
    }

    if (this.canAttack(c, target)) {
      this.resolveAttack(c, target)
    }
  }

  // ─────────────── разрешение атаки (BRP) ───────────────

  private resolveAttack(attacker: Combatant, defender: Combatant): void {
    attacker.attacked = true
    const rng = this.engine.rng
    const skillVal = attacker.skills[attacker.weapon.skill] ?? 25
    const atk = skillCheck(skillVal, rng)
    this.log.push(
      `${attacker.label}: атака «${attacker.weaponLabel}» — d100=${atk.roll} против ${atk.target} → ${labelResult(atk.result)}`,
    )
    if (RANK[atk.result] < 2) return

    // защита: уклонение или парирование, повторные со штрафом −30
    const dodgeVal = defender.skills['dodge'] ?? 0
    const parryVal = defender.weapon.parry_capable ? (defender.skills[defender.weapon.skill] ?? 0) : 0
    const useParry = parryVal > dodgeVal
    const defBase = useParry ? parryVal : dodgeVal
    if (defBase > 0) {
      const penalty = -30 * defender.defensesUsed
      defender.defensesUsed++
      const def = skillCheck(defBase, rng, penalty)
      this.log.push(
        `${defender.label}: ${useParry ? 'парирование' : 'уклонение'} — d100=${def.roll} против ${def.target} → ${labelResult(def.result)}`,
      )
      if (RANK[def.result] >= 2 && RANK[def.result] >= RANK[atk.result]) {
        this.log.push(`${defender.label} ${useParry ? 'отбивает удар' : 'уходит от удара'}.`)
        return
      }
    }

    // урон
    const w = attacker.weapon
    const dbNotation = w.damage_bonus ? damageBonus(attacker.stats) : '0'
    let dmg: number
    if (atk.result === 'critical') {
      dmg = maxOf(w.damage) + Math.max(0, maxOf(dbNotation))
      this.log.push(`Критический удар! Броня не спасает.`)
    } else {
      const raw = rollDice(w.damage, rng) + rollSigned(dbNotation, rng)
      dmg = Math.max(0, raw - defender.armor)
    }
    defender.hp -= dmg
    this.log.push(`${defender.label} получает ${dmg} урона (HP ${Math.max(0, defender.hp)}/${defender.maxHp}).`)

    if (defender.hp <= 0) {
      defender.dead = true
      this.log.push(`☠ ${defender.label} погибает.`)
      if (defender.side === 'enemy') {
        this.engine.state.dead_entities.push(defender.entityId)
      }
    }

    // синхронизация HP игрока
    const pc = this.combatants.find((x) => x.side === 'player' && x.entityId === this.engine.state.player.entity)
    if (pc) this.engine.state.player.hp = Math.max(0, pc.hp)
  }

  // ─────────────── завершение ───────────────

  private checkEnd(): void {
    if (this.result) return
    const enemiesAlive = this.combatants.some((c) => c.side === 'enemy' && !c.dead)
    const playerAlive = this.combatants.some((c) => c.side === 'player' && !c.dead)
    if (!playerAlive) {
      this.result = 'defeat'
      this.engine.gameOver('death', 'Вы пали в бою.')
      return
    }
    if (!enemiesAlive) {
      this.result = 'victory'
      this.rollLoot()
      this.log.push('🏆 Победа! Противники повержены.')
    }
  }

  private rollLoot(): void {
    const rng = this.engine.rng
    const counts = new Map<string, number>()
    for (const c of this.combatants) {
      if (c.side !== 'enemy' || !c.dead) continue
      const def = this.engine.campaign.entities[c.entityId] as NpcDef
      for (const entry of def.loot_table ?? []) {
        if (!rng.chance(entry.chance)) continue
        const qty = entry.min != null && entry.max != null ? rng.int(entry.min, entry.max) : 1
        counts.set(entry.item, (counts.get(entry.item) ?? 0) + qty)
      }
    }
    for (const [item, qty] of counts) {
      this.engine.addItem(item, qty)
      const label = this.engine.campaign.entities[item]?.label ?? item
      this.loot.push({ label, quantity: qty })
    }
  }
}

function labelResult(r: CheckResult): string {
  switch (r) {
    case 'critical': return 'КРИТ'
    case 'hard': return 'уверенный успех'
    case 'success': return 'успех'
    case 'fail': return 'промах'
    case 'fumble': return 'ПРОВАЛ'
  }
}
