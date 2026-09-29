import type { CampaignIndexEntry } from './types'

/**
 * Общие помощники списка кампаний (фидбек 29-09, п.1–2).
 *
 * Реестр `public/campaigns/index.json` — удобный, но производный: его
 * дописывают и редактор, и импорт, и мастер. Единственный источник истины об
 * описании кампании — `campaign.json` самого пакета (campaign.description).
 * Поэтому описание в меню и в списке кампаний читается из пакета, а запись
 * реестра остаётся резервом (если файл недоступен, например в проде без
 * dev-эндпоинтов).
 */

/** базовая директория кампании (без слэша на конце) */
export function campaignDir(id: string): string {
  return `/campaigns/${id}`
}

/**
 * Описание кампании: сначала `campaign.json` пакета, затем запись реестра.
 * Пустая строка означает «описания нет» — тогда в интерфейсе блок скрывается,
 * а не подставляется чужой текст.
 */
export async function campaignDescription(id: string, entry?: CampaignIndexEntry): Promise<string> {
  try {
    const res = await fetch(`${campaignDir(id)}/campaign.json?t=${Date.now()}`)
    if (res.ok) {
      const meta = (await res.json()) as { campaign?: { description?: string }; description?: string }
      const d = meta.campaign?.description ?? meta.description
      if (typeof d === 'string' && d.trim()) return d.trim()
    }
  } catch {
    /* файл недоступен — берём запись реестра */
  }
  return entry?.description?.trim() ?? ''
}
