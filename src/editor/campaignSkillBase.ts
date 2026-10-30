/**
 * Формула базового значения навыка: «стат×множитель + число» одной строкой.
 *
 * Вынесено из `campaignChapterParts.tsx`: файл с компонентами не должен
 * экспортировать функции, иначе страница редактора теряет fast refresh.
 */

export function parseSkillBase(base: string | number | undefined): { fixedNum: number | undefined; statKey: string; mult: number } {
  if (typeof base === 'number') {
    return { fixedNum: base, statKey: '', mult: 1 }
  }
  if (typeof base === 'string') {
    let fixedNum: number | undefined
    let statKey = ''
    let mult = 1
    const parts = base.split('+').map((p) => p.trim())
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        fixedNum = parseInt(part, 10)
      } else {
        const m = part.match(/^([A-Za-z]+)(?:\s*[×x*]\s*(\d+))?$/)
        if (m) {
          statKey = m[1].toUpperCase()
          mult = m[2] ? parseInt(m[2], 10) : 1
        }
      }
    }
    return { fixedNum, statKey, mult }
  }
  return { fixedNum: undefined, statKey: '', mult: 1 }
}

export function buildSkillBase(fixedNum: number | undefined, statKey: string, mult: number): string | number | undefined {
  const cleanStat = statKey.trim().toUpperCase()
  if (cleanStat) {
    const statPart = mult > 1 ? `${cleanStat}×${mult}` : cleanStat
    if (fixedNum != null && !isNaN(fixedNum) && fixedNum > 0) {
      return `${fixedNum}+${statPart}`
    }
    return statPart
  }
  if (fixedNum != null && !isNaN(fixedNum)) {
    return fixedNum
  }
  return undefined
}
