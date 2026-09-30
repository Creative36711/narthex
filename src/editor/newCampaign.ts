import { createCampaignUuid, normalizeCampaignId } from './ids'
import { canonicalJson } from '../shared/fingerprint'
import type JSZip from 'jszip'
import { ENGINE_VERSION, PACKAGE_FORMAT, checkEngine, checkPackage } from '../shared/versions'
import type { CampaignIndexEntry } from '../shared/types'
export type { CampaignIndexEntry } from '../shared/types'

/**
 * Создание новой кампании (ТЗ 5.1): минимальный рабочий Campaign Package
 * записывается на диск через dev-эндпоинт, кампания попадает в реестр
 * public/campaigns/index.json.
 */

export async function fetchCampaignIndex(): Promise<CampaignIndexEntry[]> {
  try {
    const res = await fetch(`/campaigns/index.json?t=${Date.now()}`)
    if (!res.ok) return []

    const payload: unknown = await res.json()
    if (!Array.isArray(payload)) return []

    // Старый/повреждённый index.json может содержать мусор. Для выбора кампании
    // достаточно записи с id; подписи восстановятся из campaign.json ниже.
    const index: CampaignIndexEntry[] = payload.filter(isCampaignIndexEntry).map((entry) => ({
      id: entry.id,
      title: typeof entry.title === 'string' ? entry.title : entry.id,
      author: typeof entry.author === 'string' ? entry.author : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined,
    }))
    return await hydrateCampaignIndex(index)
  } catch {
    // Некоторые статические хостинги отдают index.html (200) вместо отсутствующего
    // index.json. Это пустой реестр, а не повод показывать SyntaxError игроку.
    return []
  }
}

function isCampaignIndexEntry(value: unknown): value is CampaignIndexEntry {
  return typeof value === 'object' && value !== null
    && typeof (value as { id?: unknown }).id === 'string'
    && !!(value as { id: string }).id.trim()
}

/** Проверить каталог напрямую, чтобы учитывать и не зарегистрированные папки. */
export async function campaignFolderExists(id: string): Promise<boolean> {
  const res = await fetch(`/__editor/campaign-exists?id=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Не удалось проверить id кампании: ${res.status} ${await res.text()}`)
  const result = await res.json() as { exists?: unknown }
  return result.exists === true
}

/** Атомарно занять свободное имя каталога, закрывая гонку двух окон редактора. */
export async function reserveCampaignId(id: string): Promise<boolean> {
  const response = await fetch('/__editor/reserve-campaign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (response.status === 409) return false
  if (!response.ok) throw new Error(`Не удалось занять ID кампании: ${response.status} ${await response.text()}`)
  return true
}

/** Новый ID не выводится из названия; UUID плюс локальная проверка реестра/каталога. */
export async function newAvailableCampaignId(registeredIds: string[]): Promise<string> {
  const used = new Set(registeredIds.map(normalizeCampaignId))
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = createCampaignUuid()
    if (used.has(candidate)) continue
    if (await reserveCampaignId(candidate)) return candidate
  }
  throw new Error('Не удалось подобрать свободный UUID кампании.')
}

/**
 * Реестр кампаний — это список id, а названия и описания берём из самих
 * файлов `campaign.json`. Иначе index.json со временем расходится с кампанией
 * (после импорта чужой версии в списке остаётся старое название), и мастер
 * видит в меню чужой текст. Здесь title/author/description всегда актуальны.
 */
export async function hydrateCampaignIndex(index: CampaignIndexEntry[]): Promise<CampaignIndexEntry[]> {
  const hydrated: Array<CampaignIndexEntry | null> = await Promise.all(
    index.map(async (entry): Promise<CampaignIndexEntry | null> => {
      try {
        const res = await fetch(`/campaigns/${entry.id}/campaign.json?t=${Date.now()}`)
        if (!res.ok) return null

        // Не оставляем запись реестра, если сервер вместо отсутствующего
        // campaign.json вернул SPA index.html с кодом 200.
        const meta: unknown = await res.json()
        if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null
        const campaignMeta = meta as { id?: unknown; title?: unknown; author?: unknown; description?: unknown }
        if (campaignMeta.id !== entry.id) return null

        return {
          id: entry.id,
          title: typeof campaignMeta.title === 'string' && campaignMeta.title ? campaignMeta.title : entry.title || entry.id,
          author: typeof campaignMeta.author === 'string' ? campaignMeta.author : entry.author,
          description: typeof campaignMeta.description === 'string' ? campaignMeta.description : entry.description,
        }
      } catch {
        // Запись без читаемого campaign.json не является доступной кампанией.
        return null
      }
    }),
  )
  return hydrated.filter((entry): entry is CampaignIndexEntry => entry !== null)
}

function scaffold(id: string, title: string, author: string) {
  const campaign = {
    id,
    title,
    version: '0.1.0',
    // кампания создаётся под текущий движок: он же и минимальный поддерживаемый
    engine_version: ENGINE_VERSION,
    min_engine: ENGINE_VERSION,
    package_format: PACKAGE_FORMAT,
    author,
    description: 'Новая кампания. Опишите её в разделе «Кампания».',
    tick_label: 'час',
    ticks_per_day: 24,
    time_of_day: { morning: 6, day: 10, evening: 18, night: 22 },
    starting_region: 'region_start',
    starting_location: 'loc_start',
    starting_scene: 'scene_start',
    starting_tick: 8,
    skills: [
      { id: 'sword', label: 'Мечи' },
      { id: 'brawl', label: 'Кулачный бой' },
      { id: 'dodge', label: 'Уклонение' },
      { id: 'stealth', label: 'Скрытность' },
      { id: 'spot', label: 'Наблюдательность' },
      { id: 'persuade', label: 'Убеждение' },
      { id: 'bargain', label: 'Торговля' },
      { id: 'first_aid', label: 'Первая помощь' },
    ],
    needs: [
      { id: 'need_hunger', label: 'Голод', max: 100, decay_per_tick: 1.2, critical_threshold: 25 },
      { id: 'need_thirst', label: 'Жажда', max: 100, decay_per_tick: 1.8, critical_threshold: 25 },
      { id: 'need_energy', label: 'Энергия', max: 100, decay_per_tick: 1.0, critical_threshold: 20 },
    ],
    item_categories: [
      { id: 'food', label: 'Еда', restores_needs: ['need_hunger'] },
      { id: 'drink', label: 'Питьё', restores_needs: ['need_thirst'] },
      { id: 'medicine', label: 'Лекарства', restores_hp: true },
      { id: 'weapon', label: 'Оружие', is_weapon: true },
      { id: 'armor', label: 'Броня', is_armor: true },
      { id: 'quest', label: 'Квестовые предметы' },
      { id: 'currency', label: 'Валюта' },
      { id: 'misc', label: 'Разное' },
    ],
    currencies: [{ id: 'silver', label: 'Серебро', symbol: 'SM', item_id: 'item_silver' }],
    factions: [],
    default_player: 'player_hero',
    max_companions: 2,
    roguelike: { permadeath: true, meta_progress: [], randomize_on_restart: ['seed'] },
  }

  const world = {
    regions: [
      {
        id: 'region_start',
        label: 'Стартовый регион',
        map_image: '',
        map_size: { w: 1280, h: 720 },
        parent_region: null,
        locations: [
          {
            id: 'loc_start',
            label: 'Первая локация',
            position: { x: 640, y: 360 },
            travel_connections: [],
            scenes: ['scene_start'],
          },
        ],
      },
    ],
  }

  const scene = {
    id: 'scene_start',
    label: 'Первая сцена',
    location: 'loc_start',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_default', label: 'Обычное', image: 'scenes/img/scene_start.jpg', condition: null }],
    slots: [],
    navigation: [],
  }

  const player = {
    id: 'player_hero',
    type: 'npc',
    label: 'Герой',
    description: '',
    portrait: {},
    stats: { STR: 11, CON: 11, SIZ: 11, DEX: 11, INT: 11, POW: 11, CHA: 11 },
    skills: { dodge: 30, spot: 30, persuade: 30, brawl: 30 },
    inventory: [],
    equipment: {},
  }

  const currencyItem = {
    id: 'item_silver',
    type: 'item',
    category: 'currency',
    label: 'Серебро',
    description: 'Денежная единица кампании.',
    weight: 0,
    stackable: true,
  }

  const manifest = {
    scenes: ['scene_start.json'],
    entities: ['player_hero.json', 'item_silver.json'],
    rules: [],
    arenas: [],
    quests: [],
    encounters: [],
    cutscenes: [],
    dialogues: [],
  }

  return {
    'campaign.json': campaign,
    'world.json': world,
    'manifest.json': manifest,
    'scenes/scene_start.json': scene,
    'entities/player_hero.json': player,
    'entities/item_silver.json': currencyItem,
  } as Record<string, unknown>
}

async function saveFile(rel: string, text: string): Promise<void> {
  const res = await fetch('/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: rel, text }),
  })
  if (!res.ok) throw new Error(`${rel}: ${res.status} ${await res.text()}`)
}

async function saveFileBase64(rel: string, base64: string): Promise<void> {
  const res = await fetch('/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: rel, base64 }),
  })
  if (!res.ok) throw new Error(`${rel}: ${res.status} ${await res.text()}`)
}

/**
 * Заглушка фона первой сцены, чтобы новая кампания сразу отрисовывалась
 * (правка «первая сцена новой кампании должна отображаться»). Копируется
 * из общего шаблона и потом заменяется артом мастера.
 */
async function starterImageBase64(): Promise<string> {
  try {
    const res = await fetch('/__starter/scene_start.jpg')
    if (!res.ok) return ''
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(bin)
  } catch {
    return ''
  }
}

/** создать кампанию на диске и вернуть её id */
export async function createCampaign(title: string, author = ''): Promise<string> {
  const index = await fetchCampaignIndex()
  const id = await newAvailableCampaignId(index.map((entry) => entry.id))
  try {
    const files = scaffold(id, title, author)
    for (const [rel, data] of Object.entries(files)) {
      await saveFile(`campaigns/${id}/${rel}`, JSON.stringify(data, null, 2))
    }
    // фон первой сцены, чтобы кампания сразу отрисовывалась
    const img = await starterImageBase64()
    if (img) await saveFileBase64(`campaigns/${id}/scenes/img/scene_start.jpg`, img)
    const meta = files['campaign.json'] as { description?: string }
    index.push({ id, title, author, description: meta.description })
    await saveFile('campaigns/index.json', JSON.stringify(index, null, 2))
    return id
  } catch (error) {
    await deleteCampaignFolder(id).catch(() => undefined)
    throw error
  }
}

/**
 * Обновить строку реестра у уже существующей кампании (после правки названия
 * или описания в редакторе). Без этого список кампаний в меню и в редакторе
 * продолжает показывать то, что было записано при создании.
 */
export async function syncIndexEntry(entry: CampaignIndexEntry): Promise<void> {
  const index = await fetchCampaignIndex()
  const i = index.findIndex((c) => c.id === entry.id)
  if (i >= 0) index[i] = { ...index[i], ...entry }
  else index.push(entry)
  await saveFile('campaigns/index.json', JSON.stringify(index, null, 2))
}

/** Освободить папку, зарезервированную для операции, которая не завершилась. */
export async function deleteCampaignFolder(id: string): Promise<void> {
  const res = await fetch('/__editor/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: id }),
  })
  if (!res.ok) throw new Error(`Не удалось удалить старую папку кампании: ${res.status} ${await res.text()}`)
}


export type ChronicleIdConflictAction = 'update' | 'copy' | 'cancel'

export interface ChronicleIdConflict {
  id: string
  existingTitle: string
  incomingTitle: string
  identicalPackage: boolean
}

export type ChronicleImportResult = CampaignIndexEntry & {
  idWarning?: string
  alreadyInstalled?: boolean
  cancelled?: boolean
}

async function packageMatchesInstalled(zip: JSZip, campaignId: string): Promise<boolean> {
  const files = Object.entries(zip.files).filter(([, file]) => !file.dir)
  try {
    const response = await fetch(`/__editor/campaign-files?id=${encodeURIComponent(campaignId)}`)
    if (!response.ok) return false
    const result = await response.json() as { files?: unknown }
    if (!Array.isArray(result.files) || result.files.some((path) => typeof path !== 'string')) return false
    const installedPaths = (result.files as string[]).slice().sort()
    const packagePaths = files.map(([path]) => path).sort()
    if (installedPaths.length !== packagePaths.length || installedPaths.some((path, index) => path !== packagePaths[index])) return false
  } catch {
    return false
  }
  for (const [path, file] of files) {
    let response: Response
    try {
      response = await fetch(`/campaigns/${campaignId}/${path}?t=${Date.now()}`)
    } catch {
      return false
    }
    if (!response.ok) return false
    if (path.endsWith('.json')) {
      try {
        const [incoming, installed] = await Promise.all([
          file.async('text').then((text) => canonicalJson(JSON.parse(text))),
          response.json().then((value) => canonicalJson(value)),
        ])
        if (incoming !== installed) return false
      } catch {
        return false
      }
    } else if (path.endsWith('.ink')) {
      if ((await file.async('text')) !== (await response.text())) return false
    } else {
      const [incoming, installed] = await Promise.all([
        file.async('uint8array'),
        response.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      ])
      if (incoming.length !== installed.length || incoming.some((byte, i) => byte !== installed[i])) return false
    }
  }
  return files.length > 0
}

/**
 * Импорт .chronicle сохраняет ID пакета, если он свободен. При совпадении
 * одинаковый пакет распознаётся как уже установленный; отличающиеся данные
 * требуют явного решения — обновить кампанию или импортировать отдельной копией.
 */
export async function importChroniclePackage(
  file: File,
  resolveConflict?: (conflict: ChronicleIdConflict) => Promise<ChronicleIdConflictAction>,
): Promise<ChronicleImportResult> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)
  const metaFile = zip.files['campaign.json']
  if (!metaFile) throw new Error('в архиве нет campaign.json — это не пакет кампании')
  const meta = JSON.parse(await metaFile.async('text')) as {
    id?: string; title?: string; author?: string; description?: string
    package_format?: number; min_engine?: string; engine_version?: string; version?: string
  }
  for (const path of Object.keys(zip.files)) {
    if (path.startsWith('/') || path.split('/').includes('..')) throw new Error(`Недопустимый путь в архиве: ${path}`)
  }

  const pkg = checkPackage(meta.package_format)
  if (!pkg.ok) throw new Error(pkg.message)
  const engine = checkEngine(meta.min_engine ?? meta.engine_version)
  if (!engine.ok) console.warn(`[chronicle] ${engine.message}`)

  const index = await fetchCampaignIndex()
  const rawId = typeof meta.id === 'string' ? meta.id.trim() : ''
  const safeId = !!rawId && /^[a-z0-9][a-z0-9_-]*$/i.test(rawId)
  let id = safeId ? normalizeCampaignId(rawId) : await newAvailableCampaignId(index.map((entry) => entry.id))
  let idReserved = !safeId
  let idWarning = !safeId
    ? `Пакет не содержал безопасного ID; редактор назначил новый UUID «${id}».`
    : rawId !== id
      ? `ID пакета нормализован: «${rawId}» → «${id}».`
      : undefined

  const existingEntry = index.find((entry) => entry.id === id)
  let folderExists = idReserved ? false : existingEntry ? true : await campaignFolderExists(id)
  if (safeId && !folderExists) {
    idReserved = await reserveCampaignId(id)
    folderExists = !idReserved
  }

  if (folderExists) {
    const identicalPackage = await packageMatchesInstalled(zip, id)
    if (identicalPackage) {
      const entry: CampaignIndexEntry = existingEntry ?? {
        id,
        title: meta.title || id,
        author: meta.author,
        description: meta.description,
      }
      if (!existingEntry) await syncIndexEntry(entry)
      return { ...entry, alreadyInstalled: true, idWarning }
    }

    let existingTitle = existingEntry?.title ?? id
    if (!existingEntry) {
      try {
        const response = await fetch(`/campaigns/${id}/campaign.json?t=${Date.now()}`)
        if (response.ok) {
          const installedMeta = await response.json() as { title?: string }
          existingTitle = installedMeta.title || existingTitle
        }
      } catch {
        // Orphaned folder: the conflict prompt still names it by id.
      }
    }
    const action = resolveConflict
      ? await resolveConflict({ id, existingTitle, incomingTitle: meta.title || id, identicalPackage: false })
      : 'cancel'
    if (action === 'cancel') return { id, title: meta.title || id, cancelled: true }
    if (action === 'copy') {
      id = await newAvailableCampaignId(index.map((entry) => entry.id))
      idReserved = true
      idWarning = `ID «${rawId || 'без ID'}» уже занят; отдельная копия импортирована под новым UUID «${id}».`
    } else {
      idReserved = false
      idWarning = `Существующая кампания «${existingTitle}» обновлена из пакета; её ID «${id}» сохранён.`
    }
  }

  const importedMeta = { ...meta, id }
  try {
    for (const [path, entryFile] of Object.entries(zip.files)) {
      if (entryFile.dir) continue
      if (path.endsWith('.json') || path.endsWith('.ink')) {
        const text = path === 'campaign.json' ? JSON.stringify(importedMeta, null, 2) : await entryFile.async('text')
        await saveFile(`campaigns/${id}/${path}`, text)
      } else {
        const base64 = await entryFile.async('base64')
        const response = await fetch('/__editor/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: `campaigns/${id}/${path}`, base64 }),
        })
        if (!response.ok) throw new Error(`${path}: ${response.status}`)
      }
    }

    const result: CampaignIndexEntry = {
      id,
      title: meta.title || id,
      author: meta.author,
      description: meta.description,
    }
    const next = index.filter((entry) => entry.id !== id)
    next.push(result)
    await saveFile('campaigns/index.json', JSON.stringify(next, null, 2))
    return { ...result, idWarning }
  } catch (error) {
    if (idReserved) await deleteCampaignFolder(id).catch(() => undefined)
    throw error
  }
}
