import type { EngineCtx } from './context'
import type { AchievementDef, MetaStoreState, MetaUnlockDef } from '../shared/types'
import { evalCondition } from './conditions'

// ─────────────── мета-прогресс между забегами (аудит B8b) ───────────────

  /** мета-прогресс включён мастером (блок meta.metaprogress) */
function metaProgressEnabled(this: EngineCtx): boolean {
    return !!this.campaign.meta.metaprogress
  }

function metaKey(campaignId: string): string {
    return `narthex:meta:${campaignId}`
  }

/** снимок мета-хранилища (ленивая загрузка из localStorage) */
function metaStore(this: EngineCtx): MetaStoreState {
    if (this.metaState) return this.metaState
    let loaded: MetaStoreState
    try {
      const raw = localStorage.getItem(metaKey(this.campaign.meta.id))
      loaded = raw ? { ...blankMetaState(), ...(JSON.parse(raw) as Partial<MetaStoreState>) } : blankMetaState()
    } catch {
      loaded = blankMetaState()
    }
    this.metaState = loaded
    return loaded
  }

function blankMetaState(): MetaStoreState {
    return { runs: 0, deaths: 0, victories: 0, currencies: {}, achievements: {}, unlocks: [], counters: {} }
  }

function saveMetaStore(this: EngineCtx): void {
    if (!this.metaProgressEnabled() || !this.metaState) return
    try {
      localStorage.setItem(metaKey(this.campaign.meta.id), JSON.stringify(this.metaState))
    } catch { /* хранилище переполнено/недоступно — мета-прогресс терпимо */ }
  }

/** баланс метавалюты */
function metaCurrency(this: EngineCtx, id: string): number {
    return this.metaStore().currencies[id] ?? 0
  }

/** начислить метавалюту (эффект/награда достижения) */
function grantMetaCurrency(this: EngineCtx, id: string, amount: number): void {
    if (!this.metaProgressEnabled() || amount === 0) return
    const def = this.campaign.meta.metaprogress?.currencies?.find((c) => c.id === id)
    if (!def) return
    const st = this.metaStore()
    st.currencies[id] = Math.max(0, (st.currencies[id] ?? 0) + amount)
    this.pushLog(`${def.label}: ${amount > 0 ? '+' : ''}${amount} (всего ${st.currencies[id]}).`)
    saveMetaStore.call(this)
    this.notify()
  }

/** открыто ли достижение */
function metaAchievementDone(this: EngineCtx, id: string): boolean {
    return !!this.metaStore().achievements[id]
  }

/**
   * Счётчик хроники для условия meta_counter: «сколько раз это уже было»
   * между забегами. Служебные ключи (runs/deaths/victories/endings_seen)
   * читаются из хранилища как есть; любой другой ключ — накопленный счётчик
   * stats_run плюс вклад текущего забега (как у достижений).
   */
function metaCounter(this: EngineCtx, key: string): number {
    const st = this.metaStore()
    switch (key) {
      case 'runs': return st.runs
      case 'deaths': return st.deaths
      case 'victories': return st.victories
      case 'endings_seen': return (st.endings ?? []).length
      default: return (st.counters[key] ?? 0) + (this.state.stats_run[key as keyof typeof this.state.stats_run] ?? 0)
    }
  }

/** записать концовку в хронику (истина — впервые увидена) */
function rememberEnding(this: EngineCtx, endingId: string): void {
    const st = this.metaStore()
    st.endings ??= []
    if (st.endings.includes(endingId)) return
    st.endings.push(endingId)
  }

/** достижения с состоянием (для экрана) */
function achievementStates(this: EngineCtx): { def: AchievementDef; done: boolean; progress?: number; target?: number }[] {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg) return []
    const st = this.metaStore()
    return (cfg.achievements ?? [])
      .filter((a) => !a.hidden || st.achievements[a.id])
      .map((a) => ({
        def: a,
        done: !!st.achievements[a.id],
        ...(a.counter ? { progress: achievementCounter.call(this, a), target: a.counter.target } : {}),
      }))
  }

function achievementCounter(this: EngineCtx, a: AchievementDef): number {
    if (!a.counter) return 0
    const st = this.metaStore()
    const total = st.counters[a.counter.stat] ?? 0
    return total + (this.state.stats_run[a.counter.stat] ?? 0)
  }

/**
   * Проверка всех закрытых достижений (тики, эффекты, конец забега вызывают).
   * Защёлкивает открывшиеся: лог, награда, сохранение.
   */
function checkAchievements(this: EngineCtx): void {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg?.achievements?.length) return
    const st = this.metaStore()
    let dirty = false
    for (const a of cfg.achievements) {
      if (st.achievements[a.id]) continue
      const ok = a.counter
        ? achievementCounter.call(this, a) >= a.counter.target
        : (a.conditions ?? []).length > 0 && (a.conditions ?? []).every((c) => evalCondition(c, this))
      if (!ok) continue
      st.achievements[a.id] = new Date().toISOString()
      dirty = true
      this.unlockedThisRun.push(a.id)
      this.pushLog(`Достижение: «${a.label}»!`)
      if (a.reward?.currency && a.reward.amount) {
        st.currencies[a.reward.currency] = Math.max(0, (st.currencies[a.reward.currency] ?? 0) + a.reward.amount)
        const curLabel = cfg.currencies?.find((c) => c.id === a.reward!.currency)?.label ?? a.reward.currency
        this.pushLog(`${curLabel}: +${a.reward.amount}.`)
      }
      if (a.reward?.xp) this.grantXp(a.reward.xp)
    }
    if (dirty) saveMetaStore.call(this)
  }

function achievementsUnlockedThisRun(this: EngineCtx): AchievementDef[] {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg) return []
    return this.unlockedThisRun
      .map((id: string) => cfg.achievements?.find((a) => a.id === id))
      .filter((x: AchievementDef | undefined): x is AchievementDef => !!x)
  }

/** вклад статистики текущего забега в суммарные счётчики + исход */
function finalizeRunMeta(this: EngineCtx, won: boolean): void {
    if (!this.metaProgressEnabled()) return
    const st = this.metaStore()
    if (won) st.victories += 1
    else st.deaths += 1
    for (const [k, v] of Object.entries(this.state.stats_run)) {
      st.counters[k] = (st.counters[k] ?? 0) + (v ?? 0)
    }
    this.checkAchievements() // награда «за весь забег» тоже получает шанс
    saveMetaStore.call(this)
  }

/** старт нового забега: счётчик и гранты купленных усилений */
function metaRunStart(this: EngineCtx): void {
    const cfg = this.campaign.meta.metaprogress
    if (!cfg) return
    const st = this.metaStore()
    st.runs += 1
    saveMetaStore.call(this)
    if (st.runs > 1) this.pushLog(`Хроника продолжает писаться — забег №${st.runs}.`)
    for (const uid of st.unlocks) {
      const u = cfg.unlocks?.find((x) => x.id === uid)
      if (!u) continue
      this.pushLog(`Усиление из хроники: «${u.label}».`)
      this.applyEffects(u.grants)
    }
    this.checkAchievements()
  }

/** куплено ли усиление */
function metaUnlockOwned(this: EngineCtx, id: string): boolean {
    return this.metaStore().unlocks.includes(id)
  }

/** можно ли купить усиление (валюты хватает, требования истинны) */
function metaUnlockAffordable(this: EngineCtx, u: MetaUnlockDef): boolean {
    if (this.metaUnlockOwned(u.id)) return false
    if (u.requires?.length && !u.requires.every((c) => evalCondition(c, this))) return false
    return u.cost.every((c) => this.metaCurrency(c.currency) >= c.amount)
  }

/** купить постоянное усиление (экран хроники/финала) */
function buyMetaUnlock(this: EngineCtx, id: string): boolean {
    const u = this.campaign.meta.metaprogress?.unlocks?.find((x) => x.id === id)
    if (!u || !this.metaUnlockAffordable(u)) return false
    const st = this.metaStore()
    for (const c of u.cost) st.currencies[c.currency] = (st.currencies[c.currency] ?? 0) - c.amount
    st.unlocks.push(id)
    saveMetaStore.call(this)
    this.pushLog(`В хронику записано усиление «${u.label}» — будет действовать каждом новом забеге.`)
    this.notify()
    return true
  }

export const meta = {
  metaProgressEnabled,
  metaKey,
  metaStore,
  blankMetaState,
  saveMetaStore,
  metaCurrency,
  grantMetaCurrency,
  metaAchievementDone,
  metaCounter,
  rememberEnding,
  achievementStates,
  achievementCounter,
  checkAchievements,
  achievementsUnlockedThisRun,
  finalizeRunMeta,
  metaRunStart,
  metaUnlockOwned,
  metaUnlockAffordable,
  buyMetaUnlock,
}
