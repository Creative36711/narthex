import type {
  ActiveStatus,
  ArenaDef,
  Effect,
  ItemDef,
  NpcDef,
  StatBlock,
  StatusDef,
  WeaponData,
} from '../shared/types'
import type { GameEngine } from './engine'
import { type Hex, hexKey, hexDistance, reachable, astar, hexToPixel } from './hex'
import { skillCheck, damageBonus, movement, derivedHP, type CheckResult } from './brp'
import { rollDice } from './dice'
import { playUi, playInteraction } from '../shared/audio'

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
  /** фигурка боя (вместо жетона); нет — рисуется круглый жетон (блок 3 ТЗ) */
  figure?: string
  /** как разворачивать фигурку; по умолчанию 'topdown' */
  figure_mode?: 'topdown' | 'side' | 'static'
  /** мягкая тень под фигуркой (по умолчанию включена) */
  figure_shadow?: boolean
  /** направление фигурки, градусы: 0 — вверх, по часовой (режим 'topdown') */
  facing: number
  /** зеркало по горизонтали (режим 'side') */
  flip: boolean
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
  /** активные статусы (блок 5 ТЗ); left — боевые раунды, в сейв не попадают */
  statuses: ActiveStatus[]
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

    const pw = e.playerWeapon()
    const pa = e.playerArmor()
    const weapon = pw.weapon
    const weaponLabel = pw.label
    const overloaded = e.isOverloaded()
    this.combatants.push({
      id: 'c_player',
      entityId: p.entity,
      label: playerDef.label,
      side: 'player',
      portrait: playerDef.token ?? playerDef.portrait?.neutral,
      figure: playerDef.combat_figure,
      figure_mode: playerDef.figure_mode ?? 'topdown',
      figure_shadow: playerDef.shadow,
      facing: 90,
      flip: false,
      stats: p.stats,
      skills: overloaded ? { ...p.skills, dodge: Math.max(0, (p.skills.dodge ?? 0) - 10) } : p.skills,
      weapon,
      weaponLabel,
      armor: pa.points,
      hp: p.hp,
      maxHp: p.max_hp,
      pos: this.takeSpawn(playerSpawns),
      mov: Math.max(2, movement(p.stats) - (overloaded ? 2 : 0)),
      movLeft: 0,
      statuses: [],
      attacked: false,
      defensesUsed: 0,
      dead: false,
    })
    if (overloaded) this.log.push('Вы перегружены: движение −2, уклонение −10.')

    // напарники (ТЗ 4.11)
    for (const comp of e.state.party) {
      const def = e.campaign.entities[comp.entity] as NpcDef | undefined
      if (!def || def.type !== 'npc') continue
      const w = this.resolveWeapon(def, def.skills)
      this.combatants.push({
        id: `c_ally_${comp.entity}`,
        entityId: comp.entity,
        label: def.label,
        side: 'player',
        portrait: def.token ?? def.portrait?.neutral,
        figure: def.combat_figure,
        figure_mode: def.figure_mode ?? 'topdown',
        figure_shadow: def.shadow,
        facing: 90,
        flip: false,
        stats: def.stats,
        skills: def.skills,
        weapon: w.weapon,
        weaponLabel: w.weaponLabel,
        armor: this.resolveArmor(def),
        hp: comp.hp,
        maxHp: comp.max_hp,
        pos: this.takeSpawn(playerSpawns),
        mov: movement(def.stats),
        movLeft: 0,
        statuses: [],
        attacked: false,
        defensesUsed: 0,
        dead: false,
      })
    }

    // временные союзники боя (напр. городская стража при штурме)
    let a = 0
    for (const grp of this.def.allies ?? []) {
      const def = e.campaign.entities[grp.entity] as NpcDef | undefined
      if (!def || def.type !== 'npc') continue
      for (let i = 0; i < grp.count; i++) {
        a++
        const hp = def.stats.HP ?? derivedHP(def.stats)
        const w = this.resolveWeapon(def, def.skills)
        this.combatants.push({
          id: `c_tally_${grp.entity}_${a}`,
          entityId: grp.entity,
          label: grp.count > 1 ? `${def.label} ${a}` : def.label,
          side: 'player',
          portrait: def.token ?? def.portrait?.neutral,
          figure: def.combat_figure,
          figure_mode: def.figure_mode ?? 'topdown',
          figure_shadow: def.shadow,
          facing: 90,
          flip: false,
          stats: def.stats,
          skills: def.skills,
          weapon: w.weapon,
          weaponLabel: w.weaponLabel,
          armor: this.resolveArmor(def),
          hp,
          maxHp: hp,
          pos: this.takeSpawn(playerSpawns),
          mov: movement(def.stats),
          movLeft: 0,
          statuses: [],
          attacked: false,
          defensesUsed: 0,
          dead: false,
        })
      }
    }

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
          portrait: def.token ?? def.portrait?.neutral,
          figure: def.combat_figure,
          figure_mode: def.figure_mode ?? 'topdown',
          figure_shadow: def.shadow,
          facing: -90,
          flip: true,
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
          statuses: [],
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
    return !this.result && this.active.id === 'c_player'
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

  /**
   * Разворот фигурки к точке (блок 3 ТЗ): 'topdown' — поворот по направлению,
   * 'side' — зеркало по горизонтали, 'static' и жетоны не трогаем.
   * Вращается только картинка — гекс-логика не меняется.
   */
  private faceTowards(c: Combatant, to: Hex): void {
    if (!c.figure || (c.figure_mode ?? 'topdown') === 'static') return
    const size = this.arena.hex_grid.hex_size
    const a = hexToPixel(c.pos, size, { x: 0, y: 0 })
    const b = hexToPixel(to, size, { x: 0, y: 0 })
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return
    if ((c.figure_mode ?? 'topdown') === 'side') c.flip = dx < 0
    else c.facing = (Math.atan2(dx, -dy) * 180) / Math.PI
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
    this.faceTowards(this.active, h)
    this.active.pos = { ...h }
    this.active.movLeft -= cost
    this.engine.notify()
  }

  playerAttack(targetId: string): void {
    if (!this.isPlayerTurn()) return
    const target = this.combatants.find((c) => c.id === targetId)
    if (!target || !this.canAttack(this.active, target)) return
    this.faceTowards(this.active, target.pos)
    this.resolveAttack(this.active, target)
    this.checkEnd()
    // атака завершает ход автоматически (фидбек №1 пятого раунда):
    // кнопка «Пропустить ход» нужна только чтобы закончить ход без атаки
    if (!this.result) {
      this.nextTurn()
      this.processUntilPlayer()
    }
    this.engine.notify()
  }

  /** Использование предмета в бою — тратит действие атаки (ТЗ 6.1). */
  playerUseItem(itemId: string): void {
    if (!this.isPlayerTurn() || this.active.attacked) return
    const item = this.engine.campaign.entities[itemId] as ItemDef | undefined
    if (!item || item.type !== 'item' || !item.on_use) return
    this.active.attacked = true
    this.engine.applyEffects(item.on_use.effects)
    if (item.on_use.consume !== false) this.engine.removeItem(itemId, 1)
    // синхронизация HP игрока (эффект мог лечить)
    const pc = this.combatants.find((x) => x.id === 'c_player')!
    pc.hp = Math.min(pc.maxHp, this.engine.state.player.hp)
    this.log.push(`${this.active.label} использует «${item.label}».`)
    playInteraction('use', { entity: item })
    this.engine.notify()
  }

  /** Предметы игрока, применимые в бою. */
  usableItems(): Array<{ id: string; label: string; quantity: number }> {
    return this.engine.state.player.inventory
      .map((e) => ({ e, def: this.engine.campaign.entities[e.item] as ItemDef | undefined }))
      .filter((x) => x.def?.type === 'item' && x.def.on_use)
      .map((x) => ({ id: x.e.item, label: x.def!.label, quantity: x.e.quantity }))
  }

  playerEndTurn(): void {
    if (!this.isPlayerTurn()) return
    this.nextTurn()
    this.processUntilPlayer()
    this.engine.notify()
  }

  // ─────────────── цикл раундов ───────────────

  private startRound(): void {
    this.tickStatuses()
    for (const c of this.combatants) {
      c.movLeft = Math.max(1, c.mov + this.statusMovMod(c))
      c.attacked = false
      c.defensesUsed = 0
    }
  }

  // ─────────────── статусы бойцов (блок 5 ТЗ) ───────────────

  private statusDef(id: string): StatusDef | undefined {
    return this.engine.campaign.meta.statuses?.find((s) => s.id === id)
  }

  /** название статуса для UI */
  statusLabel(id: string): string {
    return this.statusDef(id)?.label ?? id
  }

  /** наложить боевой статус на бойца (блок 6 будет звать из способностей) */
  applyStatusTo(combatantId: string, statusId: string, duration?: number): void {
    const def = this.statusDef(statusId)
    if (!def || def.scope === 'world') return
    const c = this.combatants.find((x) => x.id === combatantId)
    if (!c || c.dead) return
    const left = duration ?? def.duration
    if (left <= 0) return
    const existing = c.statuses.find((s) => s.id === statusId)
    if (existing) {
      existing.left = Math.max(existing.left, left)
    } else {
      c.statuses.push({ id: statusId, left })
      this.log.push(def.apply_message ?? `${c.label}: ${def.label.toLowerCase()}.`)
    }
    this.engine.notify()
  }

  removeStatusFrom(combatantId: string, statusId: string): void {
    const c = this.combatants.find((x) => x.id === combatantId)
    if (!c) return
    c.statuses = c.statuses.filter((s) => s.id !== statusId)
    this.engine.notify()
  }

  /** суммарный модификатор навыка бойца от его статусов */
  private statusSkillMod(c: Combatant, skill: string): number {
    let mod = 0
    for (const s of c.statuses) {
      const def = this.statusDef(s.id)
      for (const m of def?.skill_mods ?? []) if (m.skill === skill) mod += m.delta
    }
    return mod
  }

  private statusMovMod(c: Combatant): number {
    let mod = 0
    for (const s of c.statuses) mod += this.statusDef(s.id)?.mov_mod ?? 0
    return mod
  }

  /** тик статусов в начале раунда: DoT, декремент, истечение */
  private tickStatuses(): void {
    for (const c of this.combatants) {
      if (c.dead || !c.statuses.length) continue
      const expired: StatusDef[] = []
      for (const s of c.statuses) {
        const def = this.statusDef(s.id)
        if (!def) continue
        if (def.dot?.hp) {
          c.hp = Math.max(0, c.hp - def.dot.hp)
          this.log.push(`${c.label}: ${def.label.toLowerCase()} — −${def.dot.hp} HP.`)
          if (c.hp <= 0) {
            c.dead = true
            this.log.push(`${c.label} погибает от статуса «${def.label}».`)
            playUi('kill')
          }
        }
        if (!c.dead) s.left -= 1
        if (s.left <= 0) expired.push(def)
      }
      if (expired.length) {
        c.statuses = c.statuses.filter((s) => s.left > 0)
        for (const def of expired) this.log.push(`${c.label}: «${def.label}» заканчивается.`)
      }
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
        this.checkEnd() // DoT статусов мог добить последнюю сторону
      }
      guard++
    } while (!this.result && this.active.dead && guard < 100)
  }

  private processUntilPlayer(): void {
    let guard = 0
    // AI играет за врагов и за напарников (ТЗ 4.11)
    while (!this.result && this.active.id !== 'c_player' && guard < 200) {
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

    this.faceTowards(c, target.pos)
    if (this.canAttack(c, target)) {
      this.resolveAttack(c, target)
    }
  }

  // ─────────────── разрешение атаки (BRP) ───────────────

  private resolveAttack(attacker: Combatant, defender: Combatant): void {
    attacker.attacked = true
    const rng = this.engine.rng
    const skillVal = Math.max(1, (attacker.skills[attacker.weapon.skill] ?? 25) + this.statusSkillMod(attacker, attacker.weapon.skill))
    const atk = skillCheck(skillVal, rng, 0, this.engine.diceRules)
    this.log.push(
      `${attacker.label}: атака «${attacker.weaponLabel}» — d100=${atk.roll} против ${atk.target} → ${labelResult(atk.result)}`,
    )
    if (attacker.id === 'c_player' && atk.success) this.engine.markSkill(attacker.weapon.skill)
    if (RANK[atk.result] < 2) {
      playUi('miss')
      return
    }

    // защита: уклонение или парирование, повторные со штрафом −30
    const dodgeVal = Math.max(0, (defender.skills['dodge'] ?? 0) + this.statusSkillMod(defender, 'dodge'))
    const parryVal = defender.weapon.parry_capable
      ? Math.max(0, (defender.skills[defender.weapon.skill] ?? 0) + this.statusSkillMod(defender, defender.weapon.skill))
      : 0
    const useParry = parryVal > dodgeVal
    const defBase = useParry ? parryVal : dodgeVal
    if (defBase > 0) {
      const penalty = -30 * defender.defensesUsed
      defender.defensesUsed++
      const def = skillCheck(defBase, rng, penalty, this.engine.diceRules)
      this.log.push(
        `${defender.label}: ${useParry ? 'парирование' : 'уклонение'} — d100=${def.roll} против ${def.target} → ${labelResult(def.result)}`,
      )
      if (RANK[def.result] >= 2 && RANK[def.result] >= RANK[atk.result]) {
        this.log.push(`${defender.label} ${useParry ? 'отбивает удар' : 'уходит от удара'}.`)
        playUi('parry')
        if (defender.id === 'c_player') this.engine.markSkill(useParry ? defender.weapon.skill : 'dodge')
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
      playUi('crit')
    } else {
      const raw = rollDice(w.damage, rng) + rollSigned(dbNotation, rng)
      dmg = Math.max(0, raw - defender.armor)
      playUi('hit')
    }
    defender.hp -= dmg
    this.log.push(`${defender.label} получает ${dmg} урона (HP ${Math.max(0, defender.hp)}/${defender.maxHp}).`)

    if (defender.hp <= 0) {
      defender.dead = true
      this.log.push(`† ${defender.label} погибает.`)
      playUi('death')
      if (defender.side === 'enemy') {
        this.engine.state.dead_entities.push(defender.entityId)
      } else if (defender.id.startsWith('c_ally_')) {
        // напарник гибнет перманентно (ТЗ 4.11)
        this.engine.leaveParty(defender.entityId)
        this.engine.state.dead_entities.push(defender.entityId)
        this.engine.pushLog(`${defender.label} погибает в бою. Навсегда.`)
      }
    }

    // синхронизация HP игрока и напарников
    const pc = this.combatants.find((x) => x.id === 'c_player')
    if (pc) this.engine.state.player.hp = Math.max(0, pc.hp)
    for (const ally of this.combatants.filter((x) => x.id.startsWith('c_ally_') && !x.dead)) {
      const comp = this.engine.state.party.find((c) => c.entity === ally.entityId)
      if (comp) comp.hp = Math.max(0, ally.hp)
    }
  }

  // ─────────────── завершение ───────────────

  private checkEnd(): void {
    if (this.result) return
    const enemiesAlive = this.combatants.some((c) => c.side === 'enemy' && !c.dead)
    const playerAlive = this.combatants.some((c) => c.id === 'c_player' && !c.dead)
    if (!playerAlive) {
      this.result = 'defeat'
      playUi('defeat')
      this.engine.gameOver('death', 'Вы пали в бою.')
      return
    }
    if (!enemiesAlive) {
      this.result = 'victory'
      playUi('victory')
      this.rollLoot()
      this.log.push('Победа! Противники повержены.')
      // сообщения и флаги победы — сразу, пока игрок видит экран победы
      this.engine.onCombatVictory(this.def.on_victory ?? [])
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
      const def = this.engine.campaign.entities[item] as ItemDef | undefined
      playInteraction('pickup', { entity: def })
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
