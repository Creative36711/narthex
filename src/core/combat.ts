import type {
  AbilityDef,
  ActiveStatus,
  ArenaDef,
  Effect,
  ImageValue,
  ItemDef,
  NpcDef,
  StatBlock,
  StatusDef,
  WeaponData,
} from '../shared/types'
import type { EngineCtx } from './context'
import type { PRNG } from './prng'
import { type Hex, hexKey, hexDistance, reachable, astar, hexToPixel } from './hex'
import { skillCheck, damageBonus, movement, derivedHP, derivedMP, type CheckResult } from './brp'
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
  /** фигурка боя (вместо жетона); нет — рисуется круглый жетон (блок 3 ТЗ).
   *  Может быть циклом кадров (ImageValue) — «живая» фигурка. */
  figure?: ImageValue
  /** как разворачивать фигурку; по умолчанию 'topdown' */
  figure_mode?: 'topdown' | 'side' | 'static'
  /** мягкая тень под фигуркой (по умолчанию включена) */
  figure_shadow?: boolean
  /** направление фигурки, градусы: 0 — вверх, по часовой (режим 'topdown') */
  facing: number
  /** зеркало по горизонтали (режим 'side') */
  flip: boolean
  /** сдвиг разворота арта фигурки, градусы по часовой (режим 'topdown'):
   *  прибавляется к `facing` только при отрисовке; на логику не влияет */
  facing_offset?: number
  stats: StatBlock
  skills: Record<string, number>
  weapon: WeaponData
  weaponLabel: string
  /** id предмета-оружия (нет — кулаки/природное); для износа (аудит §5.6 п.10) */
  weaponItemId: string | null
  armor: number
  hp: number
  maxHp: number
  /** износ предмета-оружия напарника/врага (id предмета → сколько осталось); аудит §5.6 п.10 */
  wear?: Record<string, number>
  pos: Hex
  mov: number
  movLeft: number
  attacked: boolean
  defensesUsed: number
  dead: boolean
  /** активные статусы (блок 5 ТЗ); left — боевые раунды, в сейв не попадают */
  statuses: ActiveStatus[]
  /** мана (производная от POW); тратится на способности (блок 6 ТЗ) */
  mp: number
  maxMp: number
  /** id способностей из реестра кампании */
  abilities: string[]
  /** оставшийся кулдаун по способностям, раунды */
  cooldowns: Record<string, number>
  /** сбежал по морали / игрок отступил: не считается убитым, лута нет */
  fled?: boolean
  /** атак осталось в этом раунде (attacks_per_round оружия; аудит §5.6 п.1) */
  attacksLeft: number
  /** без сознания (тяжёлая рана/спасбросок BRP): выбыл из боя, но жив */
  down?: boolean
  /** скрыт от врагов (аудит §5.6 п.12): не выбирается целью; атака выдаёт */
  hidden?: boolean
  /** прицелился: бонус к следующей атаке (аудит B5, meta.combat.aim) */
  aimBonus?: number
  /** пропустить следующий ход (захват, осечка оружия из таблицы провалов) */
  skipNext?: boolean
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

function rollSigned(notation: string, rng: PRNG): number {
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
  readonly engine: EngineCtx
  readonly arena: ArenaDef
  readonly def: StartCombatEffect
  combatants: Combatant[] = []
  round = 1
  activeIndex = 0
  log: string[] = []
  result: 'victory' | 'defeat' | 'fled' | null = null
  /** внезапное начало боя (аудит §5.6 п.12): сторона, начавшая внезапно */
  readonly surprise?: 'player' | 'enemy'
  loot: CombatLootEntry[] = []
  private blocked: Set<string>
  private difficult: Set<string>
  /** гексы-укрытия арены (мастерская разметка cover_hexes), «c,r» */
  private coverHexes: Set<string>

  constructor(engine: EngineCtx, def: StartCombatEffect) {
    this.engine = engine
    this.def = def
    const arena = engine.campaign.arenas[def.arena]
    if (!arena) throw new Error(`Арена не найдена: ${def.arena}`)
    this.arena = arena
    this.blocked = new Set((arena.hex_grid.blocked_hexes ?? []).map(([c, r]) => `${c},${r}`))
    this.difficult = new Set((arena.hex_grid.difficult_terrain ?? []).map(([c, r]) => `${c},${r}`))
    this.coverHexes = new Set((arena.hex_grid.cover_hexes ?? []).map(([c, r]) => `${c},${r}`))
    this.surprise = def.surprise
    this.setup()
    // погода ложится на бой (аудит B7): общий статус, если назначен
    const wStatus = this.weatherCombat?.status
    if (wStatus) {
      for (const c of this.combatants) this.applyStatusTo(c.id, wStatus)
      this.log.push(`Погода: «${this.statusLabel(wStatus)}» действует на всех.`)
    }
    if (def.intro) this.log.push(def.intro)
    if (this.surprise) {
      const side = this.surprise === 'player' ? 'героя' : 'врагов'
      this.log.push(`Внезапность! Враги${this.surprise === 'player' ? ' застигнуты врасплох' : ' застают вас врасплох'} — сторона ${side} не действует в первом раунде и не защищается.`)
    }
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
    // опорные точки переполнения зоны: разумная «домашняя» точка каждой стороны
    // (первая точка зоны; пустая зона — центр арены)
    const center: Hex = {
      col: Math.floor(this.arena.hex_grid.cols / 2),
      row: Math.floor(this.arena.hex_grid.rows / 2),
    }
    const playerAnchor: Hex = playerSpawns.length ? { col: playerSpawns[0][0], row: playerSpawns[0][1] } : center
    const enemyAnchor: Hex = enemySpawns.length ? { col: enemySpawns[0][0], row: enemySpawns[0][1] } : center

    const pw = e.playerWeapon()
    const pa = e.playerArmor()
    const appearanceFigure = e.heroCombatFigure()
    const weapon = pw.weapon
    const weaponLabel = pw.label
    const encDebuffs = e.encumbranceDebuffs()
    const overloaded = encDebuffs.status !== 'normal'

    let playerSkills = p.skills
    if (overloaded) {
      playerSkills = { ...p.skills }
      if (encDebuffs.dodgePenalty > 0) {
        playerSkills.dodge = Math.max(0, (playerSkills.dodge ?? 0) - encDebuffs.dodgePenalty)
      }
      if (encDebuffs.skillPenalty > 0) {
        if (playerSkills.stealth !== undefined) {
          playerSkills.stealth = Math.max(0, playerSkills.stealth - encDebuffs.skillPenalty)
        }
        if (playerSkills.athletics !== undefined) {
          playerSkills.athletics = Math.max(0, playerSkills.athletics - encDebuffs.skillPenalty)
        }
      }
    }

    this.combatants.push({
      id: 'c_player',
      entityId: p.entity,
      label: playerDef.label,
      side: 'player',
      portrait: [playerDef.token, playerDef.portrait?.neutral].map(s => (s ?? '').trim()).find(Boolean) || undefined,
      figure: appearanceFigure.figure ?? playerDef.combat_figure,
      figure_mode: appearanceFigure.mode ?? playerDef.figure_mode ?? 'topdown',
      figure_shadow: playerDef.shadow,
      facing: 90,
      flip: false,
      facing_offset: appearanceFigure.offset ?? playerDef.facing_offset,
      stats: p.stats,
      skills: playerSkills,
      weapon,
      weaponLabel,
      weaponItemId: pw.itemId,
      armor: pa.points,
      hp: p.hp,
      maxHp: p.max_hp,
      pos: this.takeSpawn(playerSpawns, playerAnchor),
      mov: Math.max(1, movement(p.stats) - encDebuffs.movPenalty),
      movLeft: 0,
      statuses: [],
      mp: p.mp,
      maxMp: p.max_mp,
      abilities: playerDef.abilities ?? [],
      cooldowns: {},
      attacksLeft: 0,
      attacked: false,
      defensesUsed: 0,
      dead: false,
    })
    if (overloaded) {
      const parts = []
      if (encDebuffs.movPenalty > 0) parts.push(`движение −${encDebuffs.movPenalty}`)
      if (encDebuffs.dodgePenalty > 0) parts.push(`уклонение −${encDebuffs.dodgePenalty}%`)
      if (encDebuffs.skillPenalty > 0) parts.push(`ловкость −${encDebuffs.skillPenalty}%`)
      this.log.push(`Вы перегружены (${encDebuffs.label}): ${parts.join(', ')}.`)
    }

    // напарники (ТЗ 4.11)
    for (const comp of e.state.party) {
      const def = e.campaign.entities[comp.entity] as NpcDef | undefined
      if (!def || def.type !== 'npc') continue
      if (comp.hp <= 0) continue // погибший/выбывший напарник в строй не встаёт
      // снаряжение из «второй сумки» напарника замещает equipment карточки NPC
      const battleDef: NpcDef =
        comp.equipment && Object.keys(comp.equipment).length
          ? { ...def, equipment: { ...(def.equipment ?? {}), ...comp.equipment } }
          : def
      const w = this.resolveWeapon(battleDef, def.skills ?? {})
      // истощение: любая отслеживаемая потребность (companion_needs) на/ниже
      // critical_threshold — мягкий штраф навыков −10% на этот бой
      let allySkills = def.skills ?? {}
      const exhausted = Object.entries(comp.needs ?? {}).some(([id, v]) => {
        const nd = e.campaign.meta.needs.find((n) => n.id === id)
        return nd != null && v <= nd.critical_threshold
      })
      if (exhausted) {
        allySkills = Object.fromEntries(Object.entries(allySkills).map(([k, v]) => [k, Math.max(0, Math.round(v * 0.9))]))
        this.log.push(`${def.label} истощён(а): навыки −10%.`)
      }
      this.combatants.push({
        id: `c_ally_${comp.entity}`,
        entityId: comp.entity,
        label: def.label,
        side: 'player',
        portrait: [def.token, def.portrait?.neutral].map(s => (s ?? '').trim()).find(Boolean) || undefined,
        figure: def.combat_figure,
        figure_mode: def.figure_mode ?? 'topdown',
        figure_shadow: def.shadow,
        facing: 90,
        flip: false,
        facing_offset: def.facing_offset,
        stats: def.stats,
        skills: allySkills,
        weapon: w.weapon,
        weaponLabel: w.weaponLabel,
        weaponItemId: w.weaponItemId,
        armor: this.resolveArmor(battleDef),
        hp: comp.hp,
        maxHp: comp.max_hp,
        pos: this.takeSpawn(playerSpawns, this.combatants[0]?.pos ?? playerAnchor),
        mov: movement(def.stats),
        movLeft: 0,
        statuses: [],
        mp: derivedMP(def.stats),
        maxMp: derivedMP(def.stats),
        abilities: def.abilities ?? [],
        cooldowns: {},
        attacksLeft: 0,
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
        const w = this.resolveWeapon(def, def.skills ?? {})
        this.combatants.push({
          id: `c_tally_${grp.entity}_${a}`,
          entityId: grp.entity,
          label: grp.count > 1 ? `${def.label} ${a}` : def.label,
          side: 'player',
          portrait: [def.token, def.portrait?.neutral].map(s => (s ?? '').trim()).find(Boolean) || undefined,
          figure: def.combat_figure,
          figure_mode: def.figure_mode ?? 'topdown',
          figure_shadow: def.shadow,
          facing: 90,
          flip: false,
          facing_offset: def.facing_offset,
          stats: def.stats,
          skills: def.skills ?? {},
          weapon: w.weapon,
          weaponLabel: w.weaponLabel,
          weaponItemId: w.weaponItemId,
          armor: this.resolveArmor(def),
          hp,
          maxHp: hp,
          pos: this.takeSpawn(playerSpawns, this.combatants[0]?.pos ?? playerAnchor),
          mov: movement(def.stats),
          movLeft: 0,
          statuses: [],
          mp: derivedMP(def.stats),
          maxMp: derivedMP(def.stats),
          abilities: def.abilities ?? [],
          cooldowns: {},
          attacksLeft: 0,
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
        const w = this.resolveWeapon(def, def.skills ?? {})
        this.combatants.push({
          id: `c_enemy_${n}`,
          entityId: def.id,
          label: grp.count > 1 ? `${def.label} ${i + 1}` : def.label,
          side: 'enemy',
          portrait: [def.token, def.portrait?.neutral].map(s => (s ?? '').trim()).find(Boolean) || undefined,
          figure: def.combat_figure,
          figure_mode: def.figure_mode ?? 'topdown',
          figure_shadow: def.shadow,
          facing: -90,
          flip: true,
          facing_offset: def.facing_offset,
          stats: def.stats,
          skills: def.skills ?? {},
          weapon: w.weapon,
          weaponLabel: w.weaponLabel,
          weaponItemId: w.weaponItemId,
          armor: this.resolveArmor(def),
          hp,
          maxHp: hp,
          pos: this.takeSpawn(enemySpawns, enemyAnchor),
          mov: movement(def.stats),
          movLeft: 0,
          statuses: [],
          mp: derivedMP(def.stats),
          maxMp: derivedMP(def.stats),
          abilities: def.abilities ?? [],
          cooldowns: {},
          attacksLeft: 0,
          attacked: false,
          defensesUsed: 0,
          dead: false,
        })
      }
    }

    // инициатива: DEX от высокого к низкому
    this.combatants.sort((a, b) => b.stats.DEX - a.stats.DEX || (this.engine.rng.chance(0.5) ? -1 : 1))
  }

  private takeSpawn(spawns: Array<[number, number]>, anchor: Hex): Hex {
    // зона спавна: выдаём только свободные и ПРОХОДИМЫЕ гексы —
    // пометка спавна поверх стены больше не телепортирует бойца в препятствие
    while (spawns.length) {
      const [col, row] = spawns.shift()!
      const h = { col, row }
      if (this.inBounds(h) && !this.isBlocked(h) && !this.occupantAt(h)) return h
    }
    // зоны не хватило (например, гексов меньше, чем бойцов в отряде):
    // встаём в ближайший к anchor свободный проходимый гекс, а не в [0,0]
    return this.nearestFreeHex(anchor)
  }

  /** ближайший к anchor свободный и проходимый гекс сетки (кольцевой обход) */
  private nearestFreeHex(anchor: Hex): Hex {
    let best: Hex | null = null
    let bestD = Infinity
    for (let row = 0; row < this.arena.hex_grid.rows; row++) {
      for (let col = 0; col < this.arena.hex_grid.cols; col++) {
        const h = { col, row }
        if (this.isBlocked(h) || this.occupantAt(h)) continue
        const d = hexDistance(anchor, h)
        if (d < bestD) {
          bestD = d
          best = h
        }
      }
    }
    return best ?? anchor
  }

  private resolveWeapon(def: NpcDef, skills: Record<string, number>): { weapon: WeaponData; weaponLabel: string; weaponItemId: string | null } {
    const weaponItemId = def.equipment?.weapon
    if (weaponItemId) {
      const item = this.engine.campaign.entities[weaponItemId] as ItemDef | undefined
      if (item?.weapon_data) return { weapon: item.weapon_data, weaponLabel: item.label, weaponItemId }
    }
    if (def.natural_weapon) return { weapon: def.natural_weapon, weaponLabel: def.natural_weapon.label ?? 'Атака', weaponItemId: null }
    void skills
    return { weapon: FISTS, weaponLabel: FISTS.label!, weaponItemId: null }
  }

  private resolveArmor(def: NpcDef): number {
    if (def.armor != null) return def.armor
    // броня — сумма очков всех надетых предметов с бронёй (блок 7 ТЗ)
    let points = 0
    for (const itemId of Object.values(def.equipment ?? {})) {
      const item = this.engine.campaign.entities[itemId] as ItemDef | undefined
      if (item?.armor_data) points += item.armor_data.points
    }
    return points
  }

  // ─────────────── доступ ───────────────

  get active(): Combatant {
    return this.combatants[this.activeIndex]
  }

  isPlayerTurn(): boolean {
    return !this.result && this.active.id === 'c_player'
  }

  occupantAt(h: Hex): Combatant | undefined {
    return this.combatants.find((c) => !c.dead && !c.down && c.pos.col === h.col && c.pos.row === h.row)
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

  /** гекс-укрытие? (мастерская разметка cover_hexes на арене) */
  isCover(h: Hex): boolean {
    return this.coverHexes.has(hexKey(h))
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
      attacker.attacksLeft > 0 &&
      !attacker.dead &&
      !attacker.down &&
      !target.dead &&
      !target.down &&
      !target.fled &&
      !(target.hidden && attacker.side === 'enemy') &&
      attacker.side !== target.side &&
      !this.outOfAmmo(attacker) &&
      hexDistance(attacker.pos, target.pos) <= this.weaponRange(attacker)
    )
  }

  /** нет боеприпасов к оружию (аудит B5: weapon.ammo_item) — только для игрока */
  private outOfAmmo(attacker: Combatant): boolean {
    const ammo = attacker.weapon.ammo_item
    if (!ammo || attacker.id !== 'c_player') return false
    return this.engine.itemCount(ammo) <= 0
  }

  /**
   * Может ли герой прятаться в этом бою (аудит §5.6 п.12):
   * мастер включил скрытность кампании, бой не запретил ukрытие.
   */
  canHide(): boolean {
    if (this.def.no_hide) return false
    return !!this.engine.campaign.meta.stealth
  }

  /**
   * Действие «скрыться» (тратит действие за ход): проверка скрытности героя
   * против лучшей внимательности живых врагов. Успех — `hidden`, враги
   * теряют вас из виду до следующей вашей атаки.
   */
  playerHide(): void {
    if (!this.isPlayerTurn() || this.active.attacked || !this.canHide()) return
    const pc = this.active
    const st = this.engine.campaign.meta.stealth!
    const foes = this.combatants.filter((c) => c.side === 'enemy' && !c.dead && !c.fled && !c.down)
    const best = foes
      .map((c) => {
        const def = this.engine.campaign.entities[c.entityId] as import('../shared/types').NpcDef | undefined
        const v = def?.perception ?? Math.max(1, (c.skills[st.perception_skill ?? 'perception'] ?? 0) || c.stats.INT * 2)
        return { label: def?.label ?? c.entityId, value: v }
      })
      .sort((a, b) => b.value - a.value)[0]
    this.spendAction(pc)
    if (!best) return
    const mine = skillCheck(
      Math.max(1, (pc.skills[st.skill ?? 'stealth'] ?? 0) + this.statusSkillMod(pc, st.skill ?? 'stealth')),
      this.engine.rng,
      0,
      this.engine.diceRules,
    )
    const theirs = skillCheck(best.value, this.engine.rng, 0, this.engine.diceRules)
    const RANK: Record<string, number> = { fumble: 0, fail: 1, success: 2, hard: 3, critical: 4 }
    const wins = (RANK[mine.result] ?? 1) >= (RANK[theirs.result] ?? 1)
    this.log.push(
      `${pc.label}: скрытность — ${mine.roll}/${mine.target} против «${best.label}» ${theirs.roll}/${theirs.target} → ${wins ? 'вы скрылись' : 'вас держат в поле зрения'}`,
    )
    if (wins) {
      pc.hidden = true
      this.log.push(`${pc.label} исчезает из виду.`)
    }
    if (!this.result && pc.attacksLeft <= 0) {
      this.nextTurn()
      this.processUntilPlayer()
    }
    this.engine.notify()
  }

  // ─────────────── боевые правила кампании (мастер; аудит §5.6) ───────────────

  /** настройки боя из campaign.json (meta.combat) — всё с умолчаниями */
  private combatRules() {
    return this.engine.campaign.meta.combat
  }

  /** погодные боевые модификаторы (аудит B7): настройки в meta.weathers[].combat */
  private get weatherCombat() {
    return this.engine.campaign.meta.weathers?.find((w) => w.id === this.engine.state.weather)?.combat
  }

  /** сдвиг навыка от погоды */
  private weatherSkillMod(skill: string): number {
    let mod = 0
    for (const m of this.weatherCombat?.skill_mods ?? []) if (m.skill === skill) mod += m.delta
    return mod
  }

  /** дальность оружия с погодным ограничением (минимум 1) */
  weaponRange(c: Combatant): number {
    const pen = Math.max(0, this.weatherCombat?.range_penalty ?? 0)
    return Math.max(1, c.weapon.range - pen)
  }

  /** штраф следующей атаки в раунде (умолчание −20, BRP-разделение) */
  private get multiAttackPenalty(): number {
    return this.combatRules()?.multi_attack_penalty ?? -20
  }

  /** правила гибели героя: instant (умолчание) | brp */
  private get deathMode(): 'instant' | 'brp' {
    return this.combatRules()?.death?.mode ?? 'instant'
  }

  /** действие израсходовано не-атакой (предмет/способность) */
  private spendAction(c: Combatant): void {
    c.attacked = true
    c.attacksLeft = 0
  }

  /** бонус прицельной атаки (meta.combat.aim; умолчание вкл., +20) */
  aimEnabled(): boolean {
    return this.combatRules()?.aim !== false
  }

  /** прицеливание: тратит одну атаку, следующая — с бонусом */
  playerAim(): void {
    if (!this.isPlayerTurn() || !this.aimEnabled()) return
    const pc = this.active
    if (pc.attacked || pc.attacksLeft <= 0 || (pc.aimBonus ?? 0) > 0) return
    pc.attacksLeft -= 1
    if (pc.attacksLeft <= 0) pc.attacked = true
    const cfg = this.combatRules()?.aim
    pc.aimBonus = typeof cfg === 'object' && cfg?.bonus != null ? cfg.bonus : 20
    this.log.push(`${pc.label} прицеливается… (следующая атака +${pc.aimBonus}%)`)
    if (!this.result && pc.attacksLeft <= 0) {
      this.nextTurn()
      this.processUntilPlayer()
    }
    this.engine.notify()
  }

  // ─────────────── действия игрока ───────────────

  playerMoveTo(h: Hex): void {
    if (!this.isPlayerTurn()) return
    const r = this.reachableHexes()
    const cost = r.get(hexKey(h))
    if (cost == null) return
    const from = { ...this.active.pos }
    this.faceTowards(this.active, h)
    this.active.pos = { ...h }
    this.active.movLeft -= cost
    this.triggerOpportunity(this.active, from)
    this.checkEnd()
    this.engine.notify()
  }

  /**
   * Атаки возможности (аудит B5): уход из зоны контроля врага — враг бьёт
   * напоследок бесплатно. Умолчание вкл.; meta.combat.opportunity_attacks.
   */
  private triggerOpportunity(mover: Combatant, from: Hex): void {
    if (this.combatRules()?.opportunity_attacks === false) return
    if (hexDistance(from, mover.pos) === 0) return
    for (const foe of this.combatants) {
      if (this.result || mover.dead || mover.down) return
      if (foe.side === mover.side || foe.dead || foe.down || foe.fled) continue
      if (foe.hidden && mover.side === 'enemy') continue
      // был в зоне удара, а теперь ушёл
      if (hexDistance(foe.pos, from) > this.weaponRange(foe)) continue
      if (hexDistance(foe.pos, mover.pos) <= this.weaponRange(foe)) continue
      if (this.outOfAmmo(foe)) continue
      this.log.push(`${foe.label} рубит вслед уходящему ${mover.label}!`)
      this.faceTowards(foe, mover.pos)
      this.resolveAttack(foe, mover, { free: true })
    }
  }

  playerAttack(targetId: string): void {
    if (!this.isPlayerTurn()) return
    const target = this.combatants.find((c) => c.id === targetId)
    if (!target || !this.canAttack(this.active, target)) return
    this.faceTowards(this.active, target.pos)
    this.resolveAttack(this.active, target)
    this.checkEnd()
    // ход завершается сам, когда атаки исчерпаны (attacks_per_round);
    // атаки остались — игрок может бить дальше, двигаться или закончить ход
    if (!this.result && this.active.attacksLeft <= 0) {
      this.nextTurn()
      this.processUntilPlayer()
    }
    this.engine.notify()
  }

  /**
   * Предпросмотр шансов атаки (Combat Forecast) для подсказок и плашек игрока.
   */
  estimateAttack(attacker: Combatant, defender: Combatant): {
    hitChance: number
    target: number
    damage: string
    armor: number
    penalty: number
    aim: number
    cover: number | null
    fromBehind: boolean
    fromShadow: boolean
  } {
    const apr = Math.max(1, attacker.weapon.attacks_per_round ?? 1)
    const penalty = (apr - attacker.attacksLeft) * this.multiAttackPenalty
    const aim = attacker.aimBonus ?? 0
    const fromShadow = !!attacker.hidden
    const flank = this.flankRules()
    const fromBehind = !!flank && this.isRearArc(defender, attacker.pos, flank.arc)
    const skillVal = Math.max(
      1,
      (attacker.skills[attacker.weapon.skill] ?? 25) +
        this.statusSkillMod(attacker, attacker.weapon.skill) +
        this.weatherSkillMod(attacker.weapon.skill) +
        aim,
    )
    const coverP = attacker.weapon.range > 1 && this.coverHexes.has(hexKey(defender.pos)) ? this.coverPenalty() : null
    const target = Math.max(1, Math.min(95, skillVal + penalty + (coverP ?? 0)))
    const dbNotation = attacker.weapon.damage_bonus ? damageBonus(attacker.stats) : ''
    const dbStr = dbNotation && dbNotation !== '0' ? (dbNotation.startsWith('+') || dbNotation.startsWith('-') ? dbNotation : `+${dbNotation}`) : ''
    const damage = `${attacker.weapon.damage}${dbStr}`
    const armor = defender.armor
    return {
      hitChance: target,
      target,
      damage,
      armor,
      penalty,
      aim,
      cover: coverP,
      fromBehind,
      fromShadow,
    }
  }

  /**
   * Предпросмотр применения способности по цели.
   */
  estimateAbility(caster: Combatant, ab: AbilityDef, _target: Combatant): {
    hitChance: number
    targetVal: number
    effectLabel: string
  } {
    if (ab.kind === 'heal') {
      return { hitChance: 100, targetVal: 100, effectLabel: `Лечение: ${ab.heal ?? '1d6'}` }
    }
    const skill = ab.skill ?? 'magic'
    const base = caster.skills[skill] ?? 25
    const mod = this.statusSkillMod(caster, skill) + this.weatherSkillMod(skill)
    const targetVal = Math.max(1, Math.min(95, base + mod))
    const parts: string[] = []
    if (ab.damage) parts.push(`Урон: ${ab.damage}`)
    if (ab.status) parts.push(`Статус: «${this.statusLabel(ab.status)}» (${ab.status_duration ?? 2} р.)`)
    return {
      hitChance: targetVal,
      targetVal,
      effectLabel: parts.join(' · ') || 'Воздействие',
    }
  }

  /** Может ли игрок бежать из этого боя (аудит §5.6 п.2). */
  canFlee(): boolean {
    if (this.def.no_flee) return false
    return this.combatRules()?.flee !== false
  }

  /**
   * Отступление: враги в досягаемости бьют напоследок (бесплатные атаки),
   * затем проверка навыка отступления (умолчание dodge, иначе DEX×5).
   * Успех — бой окончен бегством (`on_fled` эффекта start_combat);
   * провал — ход потерян.
   */
  playerFlee(): void {
    if (!this.isPlayerTurn() || !this.canFlee()) return
    const pc = this.active
    const foes = this.combatants.filter(
      (c) => c.side === 'enemy' && !c.dead && !c.fled && !c.down && hexDistance(c.pos, pc.pos) <= this.weaponRange(c),
    )
    if (foes.length) this.log.push('Вы бросаетесь прочь — враги рубят вслед!')
    for (const foe of foes) {
      this.resolveAttack(foe, pc, { free: true })
      if (pc.dead || pc.down) break
    }
    this.checkEnd()
    if (this.result) {
      this.engine.notify()
      return
    }
    const cfg = this.combatRules()?.flee
    const skill = (typeof cfg === 'object' && cfg?.skill) || 'dodge'
    const known = pc.skills[skill]
    const base = known != null ? known + this.statusSkillMod(pc, skill) : pc.stats.DEX * 5
    const out = skillCheck(Math.max(1, base), this.engine.rng, foes.length ? -20 : 0, this.engine.diceRules)
    this.log.push(
      `${pc.label}: отступление — ${known != null ? `навык «${this.engine.skillLabel(skill)}»` : 'DEX×5'}, d100=${out.roll} против ${out.target} → ${labelResult(out.result)}`,
    )
    if (out.success) {
      pc.fled = true
      this.result = 'fled'
      this.log.push('Вы вырываетесь из боя!')
      playUi('flee')
      this.engine.onCombatResolve(this.def.on_fled ?? [])
      if (out.result === 'critical') this.engine.markSkill(skill)
    } else {
      this.log.push('Отступить не вышло — ход потерян.')
      this.spendAction(pc)
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
    this.spendAction(this.active)
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
      if (c.down || c.fled || c.dead) {
        c.movLeft = 0
        c.attacksLeft = 0
        c.attacked = true
        continue
      }
      c.movLeft = Math.max(1, c.mov + this.statusMovMod(c) - Math.max(0, this.weatherCombat?.mov_penalty ?? 0))
      // край атак за раунд — attacks_per_round оружия (аудит §5.6 п.1)
      c.attacksLeft = Math.max(1, c.weapon.attacks_per_round ?? 1)
      c.defensesUsed = 0
      c.attacked = false
      // захват/осечка: боец пропускает ход целиком (аудит B5)
      if (c.skipNext) {
        c.skipNext = false
        c.movLeft = 0
        c.attacksLeft = 0
        c.attacked = true
      }
      // внезапность (аудит §5.6 п.12): застигнутая сторона теряет первый раунд
      if (this.round === 1 && this.surprise) {
        const ambusher = this.surprise === 'player' ? 'player' : 'enemy'
        if (c.side !== ambusher) {
          c.movLeft = 0
          c.attacksLeft = 0
          c.attacked = true
        }
      }
      // кулдауны способностей тикают на границе раунда
      for (const k of Object.keys(c.cooldowns)) {
        c.cooldowns[k] -= 1
        if (c.cooldowns[k] <= 0) delete c.cooldowns[k]
      }
    }
  }

  /** определение способности из реестра кампании */
  abilityDef(id: string): AbilityDef | undefined {
    return this.engine.campaign.meta.abilities?.find((a) => a.id === id)
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
          if (c.hp <= 0 && !c.down) {
            if (c.id === 'c_player' && this.deathMode === 'brp' && this.conSave(c, `статус «${def.label}»`)) {
              c.hp = 1
              c.down = true
              this.log.push(`${c.label} падает без сознания от статуса — но дышит. (1 HP)`)
            } else {
              c.dead = true
              this.log.push(`${c.label} погибает от статуса «${def.label}».`)
              playUi('kill')
            }
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
    } while (!this.result && (this.active.dead || this.active.down || this.active.fled) && guard < 100)
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
    if (!this.result && (this.active.dead || this.active.down || this.active.fled) && this.active.id !== 'c_player')
      this.nextTurn()
  }

  // ─────────────── AI (базовый: к ближайшему, атаковать) ───────────────

  /** шаг отступления: уйти на максимально дальний гекс в радиусе хода (приказ 'retreat') */
  private stepAway(c: Combatant, foe: Combatant): void {
    const reach = reachable(c.pos, c.movLeft, this.passable, this.moveCost)
    let bestKey: string | null = null
    let bestScore = hexDistance(c.pos, foe.pos)
    for (const [k, cost] of reach) {
      const [col, row] = k.split(',').map(Number)
      const d = hexDistance({ col, row }, foe.pos)
      if (d > bestScore) {
        bestScore = d
        bestKey = k
        void cost
      }
    }
    if (bestKey) {
      const [col, row] = bestKey.split(',').map(Number)
      c.movLeft -= reach.get(bestKey) ?? 0
      c.pos = { col, row }
    }
  }

  /** приказы отряду для UI (аудит §5.6 п.11) */
  companionOrders(): Array<{ entityId: string; label: string; order: 'free' | 'follow' | 'hold' | 'retreat' }> {
    const out: Array<{ entityId: string; label: string; order: 'free' | 'follow' | 'hold' | 'retreat' }> = []
    for (const comp of this.engine.state.party) {
      const c = this.combatants.find((x) => x.id === `c_ally_${comp.entity}`)
      if (!c || c.dead) continue
      const def = this.engine.campaign.entities[comp.entity] as NpcDef | undefined
      out.push({ entityId: comp.entity, label: def?.label ?? comp.entity, order: comp.order ?? 'free' })
    }
    return out
  }

  /** смена приказа напарнику */
  setCompanionOrder(entityId: string, order: 'free' | 'follow' | 'hold' | 'retreat'): void {
    const comp = this.engine.state.party.find((x) => x.entity === entityId)
    if (!comp) return
    comp.order = order === 'free' ? undefined : order
    this.engine.notify()
  }

  private aiTurn(c: Combatant): void {
    if (c.fled || c.down || c.dead) return
    // приказы напарникам (аудит §5.6 п.11): follow/hold/retreat меняют поведение AI
    if (c.side === 'player' && c.id !== 'c_player') {
      const comp = this.engine.state.party.find((x) => x.entity === c.entityId)
      const order = comp?.order ?? 'free'
      const hero = this.combatants.find((x) => x.id === 'c_player')!
      if (order === 'hold') {
        // стоять: только атаковать в досягаемости
        const near = this.combatants.find((x) => x.side === 'enemy' && !x.dead && !x.fled && !x.down && hexDistance(c.pos, x.pos) <= this.weaponRange(c))
        if (near) this.resolveAttack(c, near)
        return
      }
      if (order === 'retreat') {
        // держаться подальше: отойти от ближайшего врага, не атаковать
        const foes = this.combatants.filter((x) => x.side === 'enemy' && !x.dead && !x.fled && !x.down)
        if (foes.length && c.movLeft > 0) {
          const nearest = foes.sort((a, b) => hexDistance(c.pos, a.pos) - hexDistance(c.pos, b.pos))[0]
          if (hexDistance(c.pos, nearest.pos) <= 2) {
            const from = { ...c.pos }
            this.stepAway(c, nearest)
            this.triggerOpportunity(c, from)
          }
        }
        return
      }
      if (order === 'follow') {
        // идти за героем: держаться в паре гексов, без атак
        if (hexDistance(c.pos, hero.pos) > 2 && c.movLeft > 0) {
          const path = astar(c.pos, hero.pos, this.passable, this.moveCost)
          if (path) {
            for (const step of path) {
              if (this.occupantAt(step)) break
              const cost = this.moveCost(step)
              if (c.movLeft < cost) break
              if (hexDistance(step, hero.pos) <= 2) break
              c.pos = { ...step }
              c.movLeft -= cost
            }
          }
        }
        return
      }
    }
    // мораль (блок 6 ТЗ): раненый враг в начале хода может сбежать
    if (c.side === 'enemy') {
      const npcDef = this.engine.campaign.entities[c.entityId] as NpcDef | undefined
      const morale = npcDef?.morale
      if (morale && (c.hp / c.maxHp) * 100 < morale.below_hp_pct) {
        if (this.engine.rng.next() * 100 < morale.flee_chance) {
          c.fled = true
          this.log.push(`${c.label} падает духом и обращается в бегство!`)
          playUi('flee')
          return
        }
      }
    }
    // скрытые бойцы игнорируются AI — противник вас потерял (аудит §5.6 п.12)
    const targets = this.combatants.filter((x) => !x.dead && !x.fled && !x.down && !x.hidden && x.side !== c.side)
    if (!targets.length) {
      if (c.side === 'enemy' && this.combatants.some((x) => x.hidden && !x.dead && x.side !== c.side)) {
        this.log.push(`${c.label} озирается — цель потеряна из виду.`)
      }
      return
    }
    targets.sort((a, b) => hexDistance(c.pos, a.pos) - hexDistance(c.pos, b.pos))
    let target = targets[0]

    // способность вместо атаки — если применима (шанс 50%, детерминизм через rng)
    if (this.tryUseAiAbility(c, target)) return

    if (hexDistance(c.pos, target.pos) > this.weaponRange(c)) {
      const from = { ...c.pos }
      const path = astar(c.pos, target.pos, this.passable, this.moveCost)
      if (path) {
        // идём по пути, не заходя в гекс цели
        for (const step of path) {
          if (this.occupantAt(step)) break
          const cost = this.moveCost(step)
          if (c.movLeft < cost) break
          if (hexDistance(c.pos, target.pos) <= this.weaponRange(c)) break
          c.pos = { ...step }
          c.movLeft -= cost
        }
      }
      // ушёл из зоны контроля противника (например, сбежавший моралью) — удар вслед
      this.triggerOpportunity(c, from)
    }

    // мультиатаки (аудит §5.6 п.1): бьём, пока есть атаки и живая цель рядом
    let guard = 0
    while (!this.result && guard++ < 8) {
      if (target.dead || target.down || target.fled || hexDistance(c.pos, target.pos) > this.weaponRange(c)) {
        const rest = this.combatants
          .filter((x) => !x.dead && !x.fled && !x.down && x.side !== c.side)
          .sort((a, b) => hexDistance(c.pos, a.pos) - hexDistance(c.pos, b.pos))
        if (!rest.length || hexDistance(c.pos, rest[0].pos) > this.weaponRange(c)) break
        target = rest[0]
      }
      if (!this.canAttack(c, target)) break
      this.faceTowards(c, target.pos)
      this.resolveAttack(c, target)
      this.checkEnd()
    }
  }

  // ─────────────── способности (блок 6 ТЗ «Гибкий движок») ───────────────

  /** ИИ: шанс 50% применить готовую способность вместо атаки. */
  private tryUseAiAbility(c: Combatant, target: Combatant): boolean {
    if (!c.abilities.length) return false
    const usable = c.abilities
      .map((id) => this.abilityDef(id))
      .filter((a): a is AbilityDef => !!a && a.kind !== 'heal' && a.mp_cost <= c.mp && (c.cooldowns[a.id] ?? 0) <= 0)
      .filter((a) => hexDistance(c.pos, target.pos) <= a.range)
    if (!usable.length) return false
    if (this.engine.rng.next() >= 0.5) return false
    const ab = usable[this.engine.rng.int(0, usable.length - 1)]
    this.resolveAbility(c, ab, target)
    return true
  }

  /** Применение способности: расход MP, кулдаун, проверка навыка, эффект. */
  private resolveAbility(caster: Combatant, ab: AbilityDef, target: Combatant): void {
    this.spendAction(caster)
    caster.mp = Math.max(0, caster.mp - ab.mp_cost)
    if (ab.cooldown_rounds) caster.cooldowns[ab.id] = ab.cooldown_rounds
    this.faceTowards(caster, target.pos)
    const rng = this.engine.rng

    if (ab.kind === 'heal') {
      const amount = rollDice(ab.heal ?? '1d6', rng)
      target.hp = Math.min(target.maxHp, target.hp + amount)
      this.log.push(`${caster.label}: «${ab.label}» — ${target.label} восстанавливает ${amount} HP.`)
      playUi('heal')
      this.syncParty()
      return
    }

    // проверка попадания (если навык задан); цель защищается как от атаки
    if (ab.skill) {
      const skillVal = Math.max(1, (caster.skills[ab.skill] ?? 25) + this.statusSkillMod(caster, ab.skill))
      const atk = skillCheck(skillVal, rng, 0, this.engine.diceRules)
      this.log.push(
        `${caster.label}: способность «${ab.label}» — d100=${atk.roll} против ${atk.target} → ${labelResult(atk.result)}`,
      )
      if (caster.id === 'c_player' && atk.success) this.engine.markSkill(ab.skill)
      if (RANK[atk.result] < 2) {
        this.log.push(`${target.label} избегает эффекта.`)
        playUi('miss')
        // критический провал силы — магический откат по мастерской таблице (backlash_table)
        if (atk.result === 'fumble' && ab.backlash_table?.length) this.applyBacklash(caster, ab)
        return
      }
      if (this.defenderSaves(target, RANK[atk.result])) return
    }

    if (ab.kind === 'damage') {
      let dmg = Math.max(0, rollDice(ab.damage ?? '1d6', rng) - target.armor)
      if (caster.side === 'enemy' && target.id === 'c_player') dmg = Math.round(dmg * this.enemyDamageMult(caster))
      this.log.push(`${caster.label}: «${ab.label}» попадает.`)
      playUi('hit')
      this.finishDamage(target, dmg)
    } else if (ab.kind === 'status' && ab.status) {
      this.log.push(`${caster.label}: «${ab.label}» — на «${target.label}» действует «${this.statusLabel(ab.status)}».`)
      this.applyStatusTo(target.id, ab.status, ab.status_duration)
    }
  }

  /** множитель урона врагов по герою (мастерской пресет сложности, выбранный игроком) */
  private enemyDamageMult(from: Combatant): number {
    return from.side === 'enemy' ? (this.engine.difficultyDef()?.enemy_damage ?? 1) : 1
  }

  /** магический откат (backlash_table способности): бросок по весам, действует на заклинателя */
  private applyBacklash(caster: Combatant, ab: AbilityDef): void {
    const table = ab.backlash_table!
    const total = table.reduce((s, e) => s + Math.max(0, e.weight), 0)
    if (total <= 0) return
    let roll = this.engine.rng.int(1, total)
    const entry = table.find((e) => (roll -= Math.max(0, e.weight)) <= 0) ?? table[table.length - 1]
    this.log.push(`${caster.label}: НАРУШЕНИЕ СИЛЫ!${entry.text ? ` ${entry.text}` : ''}`)
    if (entry.hp_delta) {
      if (entry.hp_delta < 0) this.finishDamage(caster, -entry.hp_delta)
      else caster.hp = Math.min(caster.maxHp, caster.hp + entry.hp_delta)
    }
    if (entry.mp_delta) caster.mp = Math.max(0, Math.min(caster.maxMp, caster.mp + entry.mp_delta))
    if (entry.status) this.applyStatusTo(caster.id, entry.status, entry.status_duration)
  }

  /** Способности игрока и готовность каждой на этом ходу. */
  playerAbilities(): Array<{ def: AbilityDef; usable: boolean; reason: string }> {
    const c = this.combatants.find((x) => x.id === 'c_player')
    if (!c) return []
    const out: Array<{ def: AbilityDef; usable: boolean; reason: string }> = []
    // слоты магии: способность с prepare действует только подготовленная (лист персонажа)
    const magicSlots = this.engine.campaign.meta.magic?.slots
    const prepared = this.engine.state.player.prepared_abilities ?? []
    for (const id of c.abilities) {
      const def = this.abilityDef(id)
      if (!def) continue
      let reason = ''
      if (!this.isPlayerTurn() || c.attacked) reason = 'сейчас не ваш ход'
      else if (magicSlots && def.prepare && !prepared.includes(id)) reason = 'не подготовлена — занесите в слоты в листе персонажа (вне боя)'
      else if (c.mp < def.mp_cost) reason = `не хватает MP (${def.mp_cost})`
      else if ((c.cooldowns[id] ?? 0) > 0) reason = `кулдаун ещё ${c.cooldowns[id]} раунд(а)`
      out.push({ def, usable: reason === '', reason })
    }
    return out
  }

  /** Допустимые цели способности из текущей позиции игрока. */
  abilityTargets(abilityId: string): Combatant[] {
    const ab = this.abilityDef(abilityId)
    const c = this.combatants.find((x) => x.id === 'c_player')
    if (!ab || !c || c.dead) return []
    const pool =
      ab.kind === 'heal'
        ? this.combatants.filter((x) => x.side === c.side && !x.dead)
        : this.combatants.filter((x) => x.side !== c.side && !x.dead && !x.fled)
    return pool.filter((t) => hexDistance(c.pos, t.pos) <= ab.range)
  }

  /** Игрок применяет способность — ход завершается, как после атаки. */
  useAbility(abilityId: string, targetId: string): void {
    if (!this.isPlayerTurn() || this.active.attacked) return
    const c = this.active
    const ab = this.abilityDef(abilityId)
    if (!ab || !c.abilities.includes(abilityId)) return
    if (c.mp < ab.mp_cost || (c.cooldowns[abilityId] ?? 0) > 0) return
    const target = this.combatants.find((x) => x.id === targetId)
    if (!target || target.dead || target.fled) return
    if (ab.kind === 'heal' ? target.side !== c.side : target.side === c.side) return
    if (hexDistance(c.pos, target.pos) > ab.range) return
    this.resolveAbility(c, ab, target)
    this.checkEnd()
    if (!this.result) {
      this.nextTurn()
      this.processUntilPlayer()
    }
    this.engine.notify()
  }

  // ─────────────── разрешение атаки (BRP) ───────────────

  /**
   * Удар по цели. `opts.free` — бесплатная атака (рубеж вслед убегающему):
   * не тратит атаку хода и не получает штрафа мультиатаки.
   */
  private resolveAttack(attacker: Combatant, defender: Combatant, opts?: { free?: boolean }): void {
    let penalty = 0
    if (!opts?.free) {
      const apr = Math.max(1, attacker.weapon.attacks_per_round ?? 1)
      penalty = (apr - attacker.attacksLeft) * this.multiAttackPenalty
      attacker.attacksLeft -= 1
      if (attacker.attacksLeft <= 0) this.spendAction(attacker)
      // боеприпасы (аудит B5): каждая атака игрока тратит 1 шт.
      if (attacker.id === 'c_player' && attacker.weapon.ammo_item) {
        this.engine.removeItem(attacker.weapon.ammo_item, 1)
        const left = this.engine.itemCount(attacker.weapon.ammo_item)
        if (left === 0) this.log.push(`Боеприпасы к «${attacker.weaponLabel}» кончились!`)
      }
    }
    const rng = this.engine.rng
    const fromShadow = !!attacker.hidden
    // удар в спину/фланг (мастерское правило combat.flank): цель в задней дуге не защищается
    const flank = this.flankRules()
    const fromBehind = !!flank && this.isRearArc(defender, attacker.pos, flank.arc)
    // прицельная атака: бонус прицеливания на следующую атаку (аудит B5)
    const aim = attacker.aimBonus ?? 0
    attacker.aimBonus = 0
    const skillVal = Math.max(
      1,
      (attacker.skills[attacker.weapon.skill] ?? 25) + this.statusSkillMod(attacker, attacker.weapon.skill) + this.weatherSkillMod(attacker.weapon.skill) + aim,
    )
    // укрытие (мастерское правило combat.cover): штраф дальнобойной атаки по цели на гексе укрытия
    const coverP = attacker.weapon.range > 1 && this.coverHexes.has(hexKey(defender.pos)) ? this.coverPenalty() : null
    const atk = skillCheck(skillVal, rng, penalty + (coverP ?? 0), this.engine.diceRules)
    this.log.push(
      `${attacker.label}: ${fromShadow ? 'ВНЕЗАПНАЯ атака' : 'атака'} «${attacker.weaponLabel}»${penalty ? ` (повторная, ${penalty}%)` : ''}${aim ? ` (прицельная, +${aim}%)` : ''}${coverP ? ` (укрытие, ${coverP}%)` : ''} — d100=${atk.roll} против ${atk.target} → ${labelResult(atk.result)}`,
    )
    attacker.hidden = false // атака выдаёт позицию
    if (attacker.id === 'c_player' && atk.success) this.engine.markSkill(attacker.weapon.skill)
    if (RANK[atk.result] < 2) {
      playUi('miss')
      // критический провал — износ оружия + таблица осложнений мастера
      if (atk.result === 'fumble' && !opts?.free) {
        this.wearWeapon(attacker)
        this.applyFumble(attacker)
      }
      return
    }

    // внезапная атака из скрытности — защита невозможна (аудит §5.6 п.12)
    if (fromShadow) {
      this.log.push(`${defender.label} не видит нападающего — защита невозможна!`)
    } else if (fromBehind) {
      this.log.push(`${attacker.label} бьёт ${defender.label} в спину — защита невозможна!`)
    } else if (this.defenderSaves(defender, RANK[atk.result])) {
      return
    }

    // урон
    const w = attacker.weapon
    const dbNotation = w.damage_bonus ? damageBonus(attacker.stats) : '0'
    const harmless = w.traits?.includes('push_harmless')
    // таблица критических успехов мастера (meta.combat.crit_table)
    const critEntry = atk.result === 'critical' ? this.rollCritEntry() : null
    // хит-локации (мастерское правило combat.hit_locations, по умолчанию выключены)
    const loc = this.rollHitLocation(rng)
    if (loc) this.log.push(`${loc.text ?? `Попадание: ${loc.label}.`}`)
    const locMult = loc?.damage_mult ?? 1
    /** броня в точке попадания: локальная (у локации — своё значение), иначе общая */
    const locArmor = loc?.armor ?? defender.armor
    let dmg: number
    if (atk.result === 'critical' && critEntry?.kind === 'double_damage') {
      dmg = harmless ? 0 : Math.max(0, Math.round(2 * (rollDice(w.damage, rng) + Math.max(0, rollSigned(dbNotation, rng))) * locMult) - locArmor)
      this.log.push(`Критический удар — урон удвоен!${critEntry.text ? ` ${critEntry.text}` : ''}`)
      playUi('crit')
    } else if (atk.result === 'critical') {
      // книжный крит: максимум костей, броня не спасает; локация добавляет множитель и локальную броню
      dmg = harmless ? 0 : Math.max(0, Math.round((maxOf(w.damage) + Math.max(0, maxOf(dbNotation))) * locMult) - (loc ? locArmor : 0))
      this.log.push(`Критический удар! ${loc ? 'Броня только у локации.' : 'Броня не спасает.'}${critEntry?.text ? ` ${critEntry.text}` : ''}`)
      playUi('crit')
    } else if (harmless) {
      dmg = 0
      playUi('hit')
    } else {
      const raw = rollDice(w.damage, rng) + rollSigned(dbNotation, rng)
      dmg = Math.max(0, Math.round(raw * locMult) - locArmor)
      playUi('hit')
    }
    // бонус урона за удар в спину (мастерское правило combat.flank.damage_bonus)
    if (fromBehind && flank?.bonus && !harmless) {
      const extra = rollDice(flank.bonus, rng)
      if (extra > 0) {
        dmg += extra
        this.log.push(`Удар в спину: +${extra} урона.`)
      }
    }
    if (attacker.side === 'enemy' && defender.id === 'c_player') dmg = Math.round(dmg * this.enemyDamageMult(attacker))
    this.finishDamage(defender, dmg)
    // последствия критической записи мастера: разоружение и статус цели
    if (critEntry && !defender.dead && !defender.down) {
      if (critEntry.kind === 'disarm') this.disarm(defender, attacker)
      if (critEntry.kind === 'status' && critEntry.status) this.applyStatusTo(defender.id, critEntry.status, critEntry.duration)
    }
    // последствия локации попадания: статусы при ранении и при крите
    if (loc && !defender.dead && !defender.down) {
      if (atk.result === 'critical' && loc.status_on_crit) this.applyStatusTo(defender.id, loc.status_on_crit)
      else if (dmg > 0 && loc.status_on_hit) this.applyStatusTo(defender.id, loc.status_on_hit)
    }
    // удар прошёл — износ брони защитника (аудит §5.6 п.10)
    if (dmg > 0) this.wearArmor(defender)
    // особые удары оружия (аудит B5) — с уверенного успеха и критического
    if (!defender.dead && !defender.down && RANK[atk.result] >= RANK.hard) {
      this.applyWeaponTraits(attacker, defender)
    }
  }

  /** таблица критических успехов мастера (meta.combat.crit_table) — бросок по весам */
  private rollCritEntry() {
    const table = this.combatRules()?.crit_table
    if (!table?.length) return null
    const total = table.reduce((s, e) => s + Math.max(0, e.weight), 0)
    if (total <= 0) return null
    let roll = this.engine.rng.int(1, total)
    return table.find((e) => (roll -= Math.max(0, e.weight)) <= 0) ?? table[table.length - 1]
  }

  /** хит-локации мастера (combat.hit_locations): бросок d100 по диапазонам; механика выкл. — null */
  private rollHitLocation(rng: PRNG) {
    const rule = this.combatRules()?.hit_locations
    if (!rule?.table?.length) return null
    const roll = rng.int(1, 100)
    return rule.table.find((t) => roll >= t.from && roll <= t.to) ?? null
  }

  /** штраф укрытия (combat.cover); null — механика выключена */
  private coverPenalty(): number | null {
    const c = this.combatRules()?.cover
    if (!c) return null
    return typeof c === 'object' ? (c.penalty ?? -20) : -20
  }

  /** настройка удара в спину (combat.flank); null — механика выключена */
  private flankRules(): { arc: number; bonus: string | null } | null {
    const f = this.combatRules()?.flank
    if (!f) return null
    return {
      arc: typeof f === 'object' ? (f.arc ?? 120) : 120,
      bonus: typeof f === 'object' ? (f.damage_bonus ?? null) : null,
    }
  }

  /** стоит ли `from` в задней дуге цели (за её взглядом); дуга arcDeg с центром строго сзади */
  private isRearArc(defender: Combatant, from: Hex, arcDeg: number): boolean {
    const size = this.arena.hex_grid.hex_size
    const a = hexToPixel(defender.pos, size, { x: 0, y: 0 })
    const b = hexToPixel(from, size, { x: 0, y: 0 })
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false
    const dir = (Math.atan2(dx, -dy) * 180) / Math.PI
    const diff = Math.abs((((dir - defender.facing) % 360) + 540) % 360 - 180)
    return diff >= 180 - arcDeg / 2
  }

  /** особые удары оружия: пронзание, отброс, разоружение, захват */
  private applyWeaponTraits(attacker: Combatant, defender: Combatant): void {
    const traits = attacker.weapon.traits
    if (!traits?.length) return
    const rng = this.engine.rng
    if (traits.includes('impale')) {
      const extra = rollDice(attacker.weapon.damage, rng)
      this.log.push(`Пронзание! «${attacker.weaponLabel}» впивается глубоко: +${extra} урона без брони.`)
      this.finishDamage(defender, extra)
      if (defender.dead || defender.down) return
    }
    if (traits.includes('knockback') || traits.includes('push_harmless')) {
      const dc = defender.pos.col - attacker.pos.col
      const dr = defender.pos.row - attacker.pos.row
      const step: Hex = { col: defender.pos.col + Math.sign(dc), row: defender.pos.row + Math.sign(dr) }
      if (this.passable(step)) {
        defender.pos = step
        this.log.push(`${defender.label} отброшен назад.`)
      }
    }
    if (traits.includes('disarm')) {
      this.disarm(defender, attacker)
      if (defender.dead || defender.down) return
    }
    if (traits.includes('grapple')) {
      defender.skipNext = true
      this.log.push(`${attacker.label} захватывает ${defender.label} — тот пропустит следующий ход!`)
    }
  }

  /** разоружение: игрок теряет оружие в инвентарь, NPC — навсегда */
  private disarm(defender: Combatant, attacker: Combatant): void {
    if (!defender.weaponItemId) return
    const label = defender.weaponLabel
    if (defender.id === 'c_player') {
      const eq = this.engine.state.player.equipment
      if (eq.weapon === defender.weaponItemId) delete eq.weapon
      this.log.push(`${attacker.label} выбивает «${label}» из рук ${defender.label}! Оружие отлетело в рюкзак.`)
    } else {
      this.log.push(`${attacker.label} выбивает «${label}» из рук ${defender.label}!`)
    }
    defender.weapon = { ...FISTS }
    defender.weaponLabel = FISTS.label!
    defender.weaponItemId = null
    defender.attacksLeft = Math.min(defender.attacksLeft, 1)
  }

  /** таблица критических провалов мастера (meta.combat.fumble_table) */
  private applyFumble(attacker: Combatant): void {
    const table = this.combatRules()?.fumble_table
    if (!table?.length) return
    const total = table.reduce((s, e) => s + Math.max(0, e.weight), 0)
    if (total <= 0) return
    let roll = this.engine.rng.int(1, total)
    const entry = table.find((e) => (roll -= Math.max(0, e.weight)) <= 0) ?? table[table.length - 1]
    const note = entry.text ? ` ${entry.text}` : ''
    switch (entry.kind) {
      case 'drop_weapon':
        this.log.push(`${attacker.label} роняет оружие!${note}`)
        this.disarm(attacker, attacker)
        break
      case 'stuck':
        attacker.skipNext = true
        this.log.push(`${attacker.label}: оружие застряло — следующий ход уйдёт на извлечение.${note}`)
        break
      case 'self_hit': {
        const dmg = Math.max(0, rollDice(attacker.weapon.damage, this.engine.rng) - attacker.armor)
        this.log.push(`${attacker.label} ранит себя!${note}`)
        this.finishDamage(attacker, dmg)
        break
      }
      case 'skip_next':
        attacker.skipNext = true
        this.log.push(`${attacker.label} спотыкается — следующий ход потерян.${note}`)
        break
    }
  }

  /** износ оружия атакующего при критическом провале; слом — переход на кулаки */
  private wearWeapon(attacker: Combatant): void {
    if (!attacker.weaponItemId) return
    if (attacker.id === 'c_player') {
      const broke = this.engine.damageItemDurability(attacker.weaponItemId, 1)
      if (broke) {
        attacker.weapon = { ...FISTS }
        attacker.weaponLabel = FISTS.label!
        attacker.weaponItemId = null
        this.log.push(`${attacker.label}: оружие сломалось — дальше кулаками.`)
      }
      return
    }
    const item = this.engine.campaign.entities[attacker.weaponItemId] as ItemDef | undefined
    const max = item?.weapon_data?.durability
    if (max === undefined) return
    attacker.wear ??= {}
    const left = (attacker.wear[attacker.weaponItemId] ?? max) - 1
    attacker.wear[attacker.weaponItemId] = left
    if (left <= 0) {
      attacker.weapon = { ...FISTS }
      attacker.weaponLabel = FISTS.label!
      attacker.weaponItemId = null
      this.log.push(`${attacker.label}: «${item?.label ?? 'оружие'}» сломано — дальше голыми.`)
    }
  }

  /** износ брони защитника после пробившего удара */
  private wearArmor(defender: Combatant): void {
    if (defender.id === 'c_player') {
      for (const id of Object.values(this.engine.state.player.equipment)) {
        if (!id) continue
        const item = this.engine.campaign.entities[id] as ItemDef | undefined
        if (item?.armor_data?.durability === undefined || !this.engine.isItemUsable(id)) continue
        const broke = this.engine.damageItemDurability(id, 1)
        if (broke) {
          defender.armor = this.engine.playerArmor().points
          this.log.push(`${defender.label}: «${item.label}» разбита насмерть — броня ${defender.armor}.`)
        }
        return
      }
      return
    }
    const def = this.engine.campaign.entities[defender.entityId] as NpcDef | undefined
    if (!def) return
    for (const itemId of Object.values(def.equipment ?? {})) {
      const item = this.engine.campaign.entities[itemId] as ItemDef | undefined
      const max = item?.armor_data?.durability
      if (max === undefined || !item) continue
      defender.wear ??= {}
      const left = (defender.wear[itemId] ?? max) - 1
      defender.wear[itemId] = left
      if (left <= 0) {
        defender.armor = Math.max(0, defender.armor - item.armor_data!.points)
        this.log.push(`${defender.label}: доспех «${item.label}» разбит — броня ${defender.armor}.`)
      }
      return
    }
  }

  /** Защита от удара: уклонение/парирование. Истина — атака отражена. */
  private defenderSaves(defender: Combatant, atkRank: number): boolean {
    // внезапность: застигнутые врасплох не защищаются в первом раунде
    if (this.round === 1 && this.surprise) {
      const ambusher = this.surprise === 'player' ? 'player' : 'enemy'
      if (defender.side !== ambusher) return false
    }
    const rng = this.engine.rng
    const dodgeVal = Math.max(0, (defender.skills['dodge'] ?? 0) + this.statusSkillMod(defender, 'dodge') + this.weatherSkillMod('dodge'))
    const parryVal = defender.weapon.parry_capable
      ? Math.max(0, (defender.skills[defender.weapon.skill] ?? 0) + this.statusSkillMod(defender, defender.weapon.skill) + this.weatherSkillMod(defender.weapon.skill))
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
      if (RANK[def.result] >= 2 && RANK[def.result] >= atkRank) {
        this.log.push(`${defender.label} ${useParry ? 'отбивает удар' : 'уходит от удара'}.`)
        playUi('parry')
        if (defender.id === 'c_player') this.engine.markSkill(useParry ? defender.weapon.skill : 'dodge')
        return true
      }
    }
    return false
  }

  /** Урон бойцу: лог, смерть, синхронизация с состоянием партии. */
  private finishDamage(defender: Combatant, dmg: number): void {
    if (defender.id === 'c_player' && this.engine.debugInvincible) {
      this.log.push(`${defender.label}: урон отменён режимом отладки.`)
      return
    }
    defender.hp -= dmg
    this.log.push(`${defender.label} получает ${dmg} урона (HP ${Math.max(0, defender.hp)}/${defender.maxHp}).`)

    // режим combat.death.mode='brp' (аудит §5.6 п.4): тяжёлые раны и потеря
    // сознания вместо мгновенной смерти — только для героя
    if (defender.id === 'c_player' && this.deathMode === 'brp' && !defender.dead && !defender.down) {
      // тяжёлая рана: единичный удар от половины максимума HP — провал CON роняет в нокаут
      if (defender.hp > 0 && dmg >= Math.ceil(defender.maxHp / 2) && !this.conSave(defender, 'тяжёлая рана')) {
        defender.down = true
        this.log.push(`${defender.label} теряет сознание от тяжёлой раны.`)
      }
      // последний спасбросок при HP ≤ 0: успех — выжить без сознания (1 HP), провал — смерть
      if (!defender.down && defender.hp <= 0 && this.conSave(defender, 'смертельный удар')) {
        defender.hp = 1
        defender.down = true
        this.log.push(`${defender.label} падает без сознания — но дышит. (1 HP)`)
      }
    }

    if (defender.hp <= 0 && !defender.down) {
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

    this.syncParty()
    if (defender.down || defender.dead) this.checkEnd()
  }

  /**
   * Спасбросок CON×con_multiplier при критическом состоянии героя (режим
   * 'brp'): тяжёлая рана — успех удерживает в сознании; смертельный удар —
   * успех оставляет жить (без сознания). Истина — спасбросок пройден.
   */
  private conSave(c: Combatant, cause: string): boolean {
    const mult = this.combatRules()?.death?.con_multiplier ?? 5
    const out = skillCheck(c.stats.CON * mult, this.engine.rng, 0, this.engine.diceRules)
    this.log.push(
      `${c.label}: грань сознания (${cause}) — CON×${mult}, d100=${out.roll} против ${out.target} → ${labelResult(out.result)}`,
    )
    return out.success
  }

  /** синхронизация HP/MP игрока и напарников с состоянием боя */
  private syncParty(): void {
    const pc = this.combatants.find((x) => x.id === 'c_player')
    if (pc) {
      this.engine.state.player.hp = Math.max(0, pc.hp)
      this.engine.state.player.mp = Math.max(0, Math.min(pc.mp, this.engine.state.player.max_mp))
    }
    for (const ally of this.combatants.filter((x) => x.id.startsWith('c_ally_'))) {
      const comp = this.engine.state.party.find((c) => c.entity === ally.entityId)
      if (comp) comp.hp = Math.max(0, ally.hp)
    }
  }

  // ─────────────── завершение ───────────────

  private checkEnd(): void {
    if (this.result) return
    const enemiesAlive = this.combatants.some((c) => c.side === 'enemy' && !c.dead && !c.fled && !c.down)
    const pc = this.combatants.find((c) => c.id === 'c_player')
    const playerActive = !!pc && !pc.dead && !pc.down && !pc.fled
    if (!playerActive) {
      this.result = 'defeat'
      playUi('defeat')
      // режим 'brp': герой выжил без сознания — последствия задаёт мастер
      // (on_defeat start_combat); не заданы — смерть, как в режиме 'instant'
      if (this.deathMode === 'brp' && pc?.down && !pc.dead && (this.def.on_defeat?.length ?? 0) > 0) {
        this.log.push('Бой проигран, но вы живы. Сознание гаснет…')
        this.engine.onCombatResolve(this.def.on_defeat ?? [])
      } else {
        this.engine.gameOver('death', 'Вы пали в бою.')
      }
      return
    }
    if (!enemiesAlive) {
      this.result = 'victory'
      playUi('victory')
      this.rollLoot()
      this.log.push('Победа! Противники повержены.')
      // сообщения и флаги победы — сразу, пока игрок видит экран победы
      this.engine.onCombatResolve(this.def.on_victory ?? [])
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
