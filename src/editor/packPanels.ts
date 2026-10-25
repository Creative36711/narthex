import type { PackManifest, PackPanel } from '../core/pack/registry'

/**
 * Вкладки паков в студии. Единственный источник панелей — манифест пака:
 * id, заголовок, слот, порядок и условия показа приходят из данных.
 * В этом модуле нет ни одного id пака или панели: добавленный пак даёт
 * вкладки без правки студии.
 */

export type PackPanelSlot = PackPanel['slot']

/** Порядок слотов на рабочем полотне. Это перечисление контракта, не список паков. */
export const PACK_PANEL_SLOTS: readonly PackPanelSlot[] = ['left', 'center', 'right', 'bottom', 'modal']

const SLOT_TITLES: Readonly<Record<PackPanelSlot, string>> = {
  left: 'Слева',
  center: 'Центр',
  right: 'Справа',
  bottom: 'Снизу',
  modal: 'Модальное окно',
}

const SLOT_SET: ReadonlySet<string> = new Set(PACK_PANEL_SLOTS)

export function packPanelSlotTitle(slot: PackPanelSlot): string {
  return SLOT_TITLES[slot]
}

/** Одна вкладка: панель конкретного пака, готовая к показу. */
export interface PackPanelTab {
  /** устойчивый ключ вкладки: пак + панель */
  key: string
  packId: string
  packTitle: string
  panelId: string
  title: string
  slot: PackPanelSlot
  /** порядок из манифеста; отсутствие order — вкладка идёт последней */
  order?: number
  caps: readonly string[]
  schema?: string
}

export interface PackPanelBuildOptions {
  /**
   * Возможности, включённые в проекте. `null` (или отсутствие) — проект не
   * объявляет caps: показываем все панели, как и раньше показывал редактор.
   */
  activeCaps?: readonly string[] | null
}

export type PackPanelDiagnosticCode = 'PANEL_SLOT_TAKEN' | 'PANEL_ID_DUPLICATED' | 'PANEL_INVALID'

export interface PackPanelDiagnostic {
  code: PackPanelDiagnosticCode
  message: string
  /** паки, которых касается диагностика (занявший слот и претендент) */
  packIds: string[]
  slot?: PackPanelSlot
  panelId?: string
}

export interface PackPanelBuildResult {
  ok: boolean
  tabs: PackPanelTab[]
  diagnostics: PackPanelDiagnostic[]
  /** точный текст ошибки сборки; пусто, если сборка удалась */
  message: string
  /** сколько панелей скрыто выключенными возможностями */
  hiddenPanels: number
}

export interface PackPanelSlotGroup {
  slot: PackPanelSlot
  title: string
  tabs: PackPanelTab[]
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const orderOf = (tab: PackPanelTab): number => tab.order ?? Number.POSITIVE_INFINITY

function panelVisible(panel: PackPanel, activeCaps: readonly string[] | null): boolean {
  if (!activeCaps) return true
  const caps = Array.isArray(panel.caps) ? panel.caps : []
  if (caps.length === 0) return true
  return caps.some((cap) => activeCaps.includes(cap))
}

/**
 * Собрать вкладки из манифестов. Манифесты передаются в порядке реестра:
 * первый пак в слоте — его владелец. Если в слот претендует второй пак,
 * сборка отказывает — тихой «последней победы» не бывает.
 */
export function buildPackPanelTabs(
  manifests: readonly PackManifest[],
  options: PackPanelBuildOptions = {},
): PackPanelBuildResult {
  const activeCaps = options.activeCaps ?? null
  const diagnostics: PackPanelDiagnostic[] = []
  const collected: PackPanelTab[] = []
  const panelOwners = new Map<string, string>()
  let hiddenPanels = 0

  for (const manifest of Array.isArray(manifests) ? manifests : []) {
    const packId = typeof manifest?.id === 'string' ? manifest.id.trim() : ''
    const packTitle = typeof manifest?.title === 'string' && manifest.title.trim() ? manifest.title.trim() : packId
    if (!packId) {
      diagnostics.push({
        code: 'PANEL_INVALID',
        message: 'Манифест пака без id не может дать вкладки: панели должны быть приписаны паку.',
        packIds: [],
      })
      continue
    }
    const declared: readonly PackPanel[] = Array.isArray(manifest.provides?.panels) ? manifest.provides.panels : []
    for (const panel of declared) {
      const panelId = typeof panel?.id === 'string' ? panel.id.trim() : ''
      const title = typeof panel?.title === 'string' ? panel.title.trim() : ''
      const slot = panel?.slot
      if (!panelId || !title || typeof slot !== 'string' || !SLOT_SET.has(slot)) {
        diagnostics.push({
          code: 'PANEL_INVALID',
          message: `Пак «${packTitle}» (${packId}): панель «${panelId || '(без id)'}» должна иметь id, заголовок и слот из контракта (left, center, right, bottom, modal).`,
          packIds: [packId],
          panelId: panelId || undefined,
        })
        continue
      }
      const caps = Array.isArray(panel.caps) ? panel.caps.filter((cap): cap is string => typeof cap === 'string' && cap.length > 0) : []
      if (!panelVisible(panel, activeCaps)) {
        hiddenPanels += 1
        continue
      }
      const owner = panelOwners.get(panelId)
      if (owner && owner !== packId) {
        diagnostics.push({
          code: 'PANEL_ID_DUPLICATED',
          message: `Панель «${panelId}» объявлена дважды: пак «${owner}» и пак «${packId}». У панелей студии должен быть общий уникальный id.`,
          packIds: [owner, packId],
          panelId,
        })
        continue
      }
      if (!owner) panelOwners.set(panelId, packId)
      collected.push({
        key: `${packId}:${panelId}`,
        packId,
        packTitle,
        panelId,
        title,
        slot: slot as PackPanelSlot,
        ...(Number.isInteger(panel.order) ? { order: panel.order as number } : {}),
        caps,
        ...(typeof panel.schema === 'string' && panel.schema ? { schema: panel.schema } : {}),
      })
    }
  }

  // Слот принадлежит одному паку. Владелец — тот, кто встретился первым.
  const slotOwners = new Map<PackPanelSlot, { packId: string; packTitle: string }>()
  const reported = new Set<string>()
  for (const tab of collected) {
    const owner = slotOwners.get(tab.slot)
    if (!owner) {
      slotOwners.set(tab.slot, { packId: tab.packId, packTitle: tab.packTitle })
      continue
    }
    if (owner.packId === tab.packId) continue
    const pair = `${tab.slot}\u0000${owner.packId}\u0000${tab.packId}`
    if (reported.has(pair)) continue
    reported.add(pair)
    diagnostics.push({
      code: 'PANEL_SLOT_TAKEN',
      message: `Слот «${packPanelSlotTitle(tab.slot)}» (${tab.slot}) уже занят паком «${owner.packTitle}» (${owner.packId}): пак «${tab.packTitle}» (${tab.packId}) добавляет в него панель «${tab.panelId}». Слот может занимать только один пак.`,
      packIds: [owner.packId, tab.packId],
      slot: tab.slot,
      panelId: tab.panelId,
    })
  }

  if (diagnostics.length > 0) {
    return {
      ok: false,
      tabs: [],
      diagnostics,
      message: diagnostics.map((diagnostic) => diagnostic.message).join('\n'),
      hiddenPanels,
    }
  }

  const tabs = collected.sort(
    (a, b) => orderOf(a) - orderOf(b) || compare(a.packId, b.packId) || compare(a.panelId, b.panelId),
  )
  return { ok: true, tabs, diagnostics: [], message: '', hiddenPanels }
}

/** Сгруппировать вкладки по слотам в порядке контракта; пустые слоты не попадают в вывод. */
export function groupPackPanelTabs(tabs: readonly PackPanelTab[]): PackPanelSlotGroup[] {
  return PACK_PANEL_SLOTS
    .map((slot) => ({ slot, title: packPanelSlotTitle(slot), tabs: tabs.filter((tab) => tab.slot === slot) }))
    .filter((group) => group.tabs.length > 0)
}
