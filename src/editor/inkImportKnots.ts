/**
 * Узлы ink-диалога: дедлайн на раздумье и русские названия узлов.
 *
 * Вынесено из `inkImport.ts`: подписи и таймер — отдельная тема, документ
 * собирается без них.
 */

/**
 * Дедлайн на раздумье генератор пишет первой строкой узла-развилки:
 * `~ set_dialogue_timer(15, "узел")`. Импорт снимает её с потока реплик
 * (иначе она выглядит «строкой вне ответа») и переносит в поле узла;
 * пустой второй аргумент означает «разговор заканчивается» (§9).
 */
export function extractDialogueTimer(lines: string[]): { seconds: number; node?: string } | null {
  const re = /^\s*~\s*set_dialogue_timer\s*\(\s*(\d+)\s*(?:,\s*"([^"]*)"\s*)?\)\s*$/
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i])
    if (!m) continue
    const seconds = Math.max(0, Math.round(Number(m[1]) || 0))
    const knot = (m[2] ?? '').trim()
    lines.splice(i, 1)
    return seconds > 0 ? { seconds, node: knot && knot !== 'end' ? knot : undefined } : null
  }
  return null
}

const KNOT_TRANSLATIONS: Record<string, string> = {
  main: 'Начало разговора',
  hub: 'Варианты ответов',
  start: 'Начало разговора',
  intro: 'Вступление',
  talk: 'Разговор',
  heart: 'Сердце',
  brant: 'Брант',
  dara: 'Дарья',
  grim: 'Гримм',
  vera: 'Вера Сокол',
  klim: 'Клим',
  mila: 'Мила',
  tika: 'Тика',
  zoya: 'Зойя',
  guard: 'Охрана / Стража',
  fight: 'Стычка / Бой',
  choice: 'Выбор',
  hesitate: 'Колебания',
  dead: 'Гибель',
  hide: 'Укрытие',
  rescued: 'Спасение',
  rescue: 'Спасение',
  knife: 'Угроза ножом',
  silence: 'Молчание',
  hurry: 'Спешка',
  price: 'Цена и оплата',
  trade: 'Торговля',
  deal: 'Сделка',
  refuse: 'Отказ',
  agree: 'Согласие',
  leave: 'Уход',
  exit: 'Завершение',
  end: 'Конец разговора',
  wait: 'Ожидание',
  wait_talk: 'Ожидание',
  wait_hub: 'Варианты ожидания',
  body: 'Осмотр тела',
  body_talk: 'Осмотр тела',
  body_hub: 'Варианты осмотра',
  ledger_paths: 'Пути гроссбуха',
  ledger_choice: 'Судьба гроссбуха',
  klein_dead: 'Гибель Кляйна',
  klein_argue: 'Спор с Кляйном',
  klein_hub: 'Разговор с Кляйном',
  question: 'Вопрос',
  answers: 'Ответы',
}

export function humanizeKnotLabel(knotName: string, lines?: string[]): string {
  const clean = knotName.toLowerCase()
  if (KNOT_TRANSLATIONS[clean]) return KNOT_TRANSLATIONS[clean]
  const base = clean.replace(/(_hub|_talk)$/, '')
  if (KNOT_TRANSLATIONS[base]) return KNOT_TRANSLATIONS[base]
  if (lines) {
    for (const l of lines.slice(0, 3)) {
      const cm = /^\/\/\s*(.+)$/.exec(l.trim())
      if (cm && cm[1].length <= 50 && !cm[1].startsWith('EXTERNAL') && !cm[1].includes('{') && !cm[1].includes('->')) {
        const text = cm[1].trim()
        return text[0].toUpperCase() + text.slice(1)
      }
    }
  }
  let res = knotName.replace(/_/g, ' ')
  for (const [en, ru] of Object.entries(KNOT_TRANSLATIONS)) {
    if (en.length > 3 && res.toLowerCase().includes(en)) {
      res = res.replace(new RegExp(en, 'gi'), ru)
    }
  }
  return res[0].toUpperCase() + res.slice(1)
}
