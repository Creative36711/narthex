/**
 * Реестр кампаний (`public/campaigns/index.json`): чтение, гидратация подписей
 * из `campaign.json` и атомарное занятие id.
 *
 * Вынесено из `newCampaign.ts`, чтобы создание кампании и импорт пакетов не
 * смешивались с обслуживанием реестра и оставались в пределах лимита размера.
 */

import type { CampaignIndexEntry } from '../shared/types'

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
