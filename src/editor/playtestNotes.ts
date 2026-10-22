export interface PlaytestNote {
  id: string
  sceneId?: string
  sceneLabel?: string
  text: string
  createdAt: number
}

const STORAGE_KEY = 'narthex:playtest-notes'
const AUTO_CLEAR_KEY = 'narthex:playtest-notes-autoclear'

function getKey(campaignId?: string): string {
  return campaignId ? `${STORAGE_KEY}:${campaignId}` : STORAGE_KEY
}

export function getPlaytestNotes(campaignId?: string): PlaytestNote[] {
  try {
    const raw = localStorage.getItem(getKey(campaignId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePlaytestNote(
  note: { sceneId?: string; sceneLabel?: string; text: string },
  campaignId?: string,
): PlaytestNote {
  const current = getPlaytestNotes(campaignId)
  const item: PlaytestNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sceneId: note.sceneId,
    sceneLabel: note.sceneLabel,
    text: note.text.trim(),
    createdAt: Date.now(),
  }
  const next = [item, ...current]
  try {
    localStorage.setItem(getKey(campaignId), JSON.stringify(next))
  } catch {
    // ignore quota error
  }
  return item
}

export function updatePlaytestNote(id: string, text: string, campaignId?: string): void {
  const current = getPlaytestNotes(campaignId)
  const next = current.map((n) => (n.id === id ? { ...n, text: text.trim() } : n))
  try {
    localStorage.setItem(getKey(campaignId), JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function deletePlaytestNote(id: string, campaignId?: string): void {
  const current = getPlaytestNotes(campaignId)
  const next = current.filter((n) => n.id !== id)
  try {
    localStorage.setItem(getKey(campaignId), JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function clearPlaytestNotes(campaignId?: string): void {
  try {
    localStorage.removeItem(getKey(campaignId))
  } catch {
    // ignore
  }
}

export function shouldAutoClearNotes(): boolean {
  try {
    const val = localStorage.getItem(AUTO_CLEAR_KEY)
    return val === null ? true : val === 'true'
  } catch {
    return true
  }
}

export function setAutoClearNotes(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_CLEAR_KEY, String(enabled))
  } catch {
    // ignore
  }
}

export function formatPlaytestNotesSummary(notes: PlaytestNote[]): string {
  if (!notes.length) return ''
  return notes
    .map((n, i) => {
      const loc = n.sceneLabel ? `[Сцена: ${n.sceneLabel}] ` : (n.sceneId ? `[Сцена: ${n.sceneId}] ` : '')
      return `${i + 1}. ${loc}${n.text}`
    })
    .join('\n')
}
