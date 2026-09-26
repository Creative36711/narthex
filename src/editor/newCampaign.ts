import { slugify } from './ids'
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
    return (await res.json()) as CampaignIndexEntry[]
  } catch {
    return []
  }
}

function scaffold(id: string, title: string, author: string) {
  const campaign = {
    id,
    title,
    version: '0.1.0',
    engine_version: '1.0',
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
  let id = slugify(title)
  if (index.some((c) => c.id === id)) {
    let n = 2
    while (index.some((c) => c.id === `${id}_${n}`)) n++
    id = `${id}_${n}`
  }
  const files = scaffold(id, title, author)
  for (const [rel, data] of Object.entries(files)) {
    await saveFile(`campaigns/${id}/${rel}`, JSON.stringify(data, null, 2))
  }
  // фон первой сцены, чтобы кампания сразу отрисовывалась
  const img = await starterImageBase64()
  if (img) await saveFileBase64(`campaigns/${id}/scenes/img/scene_start.jpg`, img)
  index.push({ id, title, author })
  await saveFile('campaigns/index.json', JSON.stringify(index, null, 2))
  return id
}

/**
 * Импорт пакета .chronicle из главного меню: распаковывает архив прямо
 * в public/campaigns/<id>/ через dev-эндпоинт и регистрирует кампанию
 * в index.json. Если кампания с таким id уже есть — файлы обновляются.
 */
export async function importChroniclePackage(file: File): Promise<CampaignIndexEntry> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)
  const metaFile = zip.files['campaign.json']
  if (!metaFile) throw new Error('в архиве нет campaign.json — это не пакет кампании')
  const meta = JSON.parse(await metaFile.async('text')) as { id: string; title: string; author?: string; description?: string }
  const id = meta.id
  for (const [p, f] of Object.entries(zip.files)) {
    if (f.dir) continue
    if (p.endsWith('.json') || p.endsWith('.ink')) {
      await saveFile(`campaigns/${id}/${p}`, await f.async('text'))
    } else {
      const b64 = await f.async('base64')
      const res = await fetch('/__editor/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `campaigns/${id}/${p}`, base64: b64 }),
      })
      if (!res.ok) throw new Error(`${p}: ${res.status}`)
    }
  }
  const index = await fetchCampaignIndex()
  const entry: CampaignIndexEntry = { id, title: meta.title || id, author: meta.author, description: meta.description }
  const i = index.findIndex((c) => c.id === id)
  if (i >= 0) index[i] = entry
  else index.push(entry)
  await saveFile('campaigns/index.json', JSON.stringify(index, null, 2))
  return entry
}
