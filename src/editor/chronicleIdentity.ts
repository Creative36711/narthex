import JSZip from 'jszip'

/** Read the package identity before deciding whether to update or add a campaign. */
export async function readChronicleCampaignIdentity(file: File): Promise<{ id: string; title: string }> {
  const zip = await JSZip.loadAsync(file)
  const campaignFile = zip.files['campaign.json']
  if (!campaignFile) throw new Error('В архиве нет campaign.json — это не пакет кампании.')
  const meta = JSON.parse(await campaignFile.async('text')) as { id?: unknown; title?: unknown }
  return {
    id: typeof meta.id === 'string' ? meta.id.trim() : '',
    title: typeof meta.title === 'string' ? meta.title : 'Кампания без названия',
  }
}
