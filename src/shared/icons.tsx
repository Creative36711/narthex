/**
 * Кастомный набор иконок (фидбек 3): никаких системных эмодзи в интерфейсе —
 * везде наши SVG-иконки. `<Ico n="play" />`, размер наследует шрифт-контекст.
 */
export type IcoName =
  | 'close' | 'play' | 'stop' | 'sound' | 'dice' | 'image' | 'settings' | 'map'
  | 'sword' | 'scroll' | 'music' | 'palette' | 'edit' | 'user' | 'bag' | 'trash'
  | 'globe' | 'film' | 'book' | 'doc' | 'download' | 'plus' | 'check' | 'warn'
  | 'up' | 'down' | 'left' | 'right' | 'chevron' | 'chevronRight' | 'sparkle'
  | 'coin' | 'mic' | 'star' | 'heart' | 'flame' | 'ghost' | 'lock' | 'help'
  | 'message' | 'move' | 'flag' | 'clock' | 'skull' | 'trophy' | 'info' | 'panel' | 'shield' | 'exit'

const P: Record<IcoName, string> = {
  // крестик
  close: 'M6 6l12 12M18 6L6 18',
  // play (треугольник)
  play: 'M8 5.5v13l11-6.5z',
  stop: 'M7 7h10v10H7z',
  // динамик + волна
  sound: 'M4 10v4h3l5 4V6L7 10H4zM16 9c1.2 1.2 1.2 4.8 0 6M18.5 7c2.2 2 2.2 8 0 10',
  // кубик
  dice: 'M4 7l8-4 8 4v10l-8 4-8-4V7zM4 7l8 4m0 0l8-4m-8 4v10',
  // картинка
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4',
  // шестерёнка
  // шестерёнка (чистый контур)
  settings: 'M10.3 4.3c.4-1.8 2.9-1.8 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.6c1.8.4 1.8 2.9 0 3.3a1.7 1.7 0 00-1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-2.9 1.8-3.4 0a1.7 1.7 0 00-2.6-1.1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-2.9 0-3.3a1.7 1.7 0 001-2.6c-.9-1.5.8-3.3 2.4-2.4a1.7 1.7 0 002.6-1zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  // карта
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14',
  // мечи
  sword: 'M4 20l7-7M14 4h6v6l-9 9-4-2-2-4 9-9zM6 18l-2 2M18 18l2 2',
  // свиток
  scroll: 'M6 4h12v14a2 2 0 002 2H8a2 2 0 01-2-2V4zM6 4a2 2 0 00-2 2v2h4M9 8h6M9 12h6',
  // нота
  music: 'M9 18a3 3 0 11-2-2.8V6l10-2v9.2A3 3 0 1115 11V6',
  // палитра
  palette: 'M12 3a9 9 0 000 18c1.7 0 2-1.3 1.2-2.2-.8-1 .1-2.3 1.3-2.3H16a5 5 0 005-5c0-4.4-4-8.5-9-8.5zM7.5 12.5h.01M10 8.5h.01M15 8h.01',
  // карандаш
  edit: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 5l3 3',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  bag: 'M8 8V7a4 4 0 118 0v1M5 8h14l-1 12H6L5 8z',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v5M14 11v5',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  film: 'M4 5h16v14H4zM4 9h16M4 15h16M8 5v14M16 5v14',
  book: 'M5 5a2 2 0 012-2h11v16H7a2 2 0 00-2 2V5zM9 8h7M9 12h5',
  doc: 'M7 3h7l4 4v14H7V3zM14 3v5h5M9 12h7M9 16h7',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 13l4 4L19 7',
  warn: 'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
  up: 'M12 19V5m0 0l-6 6m6-6l6 6',
  down: 'M12 5v14m0 0l-6-6m6 6l6-6',
  left: 'M19 12H5m0 0l6-6m-6 6l6 6',
  right: 'M5 12h14m0 0l-6-6m6 6l-6 6',
  chevron: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.7-2.5 1.7-2.5.8-2.5 1.8 1 1.8 2.5 1.8 2.5-.8 2.5-1.8',
  mic: 'M12 4a2.5 2.5 0 012.5 2.5v5a2.5 2.5 0 01-5 0v-5A2.5 2.5 0 0112 4zM6 11a6 6 0 0012 0M12 17v3M9 20h6',
  star: 'M12 3l2.7 6.3 6.8.6-5.2 4.5 1.6 6.6L12 17.5 6.1 21l1.6-6.6L2.5 9.9l6.8-.6L12 3z',
  heart: 'M12 20s-7-4.3-7-9a4 4 0 017-2.5A4 4 0 0119 11c0 4.7-7 9-7 9z',
  flame: 'M12 3c3 4 6 5 6 9a6 6 0 01-12 0c0-2 1-3.5 2.5-5 .2 1.3 1 2 2 2 .5-2 .5-4 1.5-6z',
  ghost: 'M12 3a7 7 0 017 7v11l-2.5-2-2.5 2-2-2-2 2-2.5-2L5 21V10a7 7 0 017-7zM9 10h.01M15 10h.01',
  lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14v9H5v-9zM12 15v2',
  help: 'M3.5 12a8.5 8.5 0 1017 0 8.5 8.5 0 10-17 0M9.6 9.5a2.5 2.5 0 014.9.7c0 1.7-2.5 2.3-2.5 4.3M12 17.5h.01',
  // выход — дверь со стрелкой
  exit: 'M13 4h6a1 1 0 011 1v14a1 1 0 01-1 1h-6M10 8l-4 4 4 4M6 12h9',
  message: 'M4 5h16v11H9l-5 4V5z',
  move: 'M12 3v18m0 0l-5-5m5 5l5-5M3 12h18m0 0l-5-5m5 5l-5 5',
  flag: 'M6 21V4h12l-3 4 3 4H6',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2',
  skull: 'M12 3a8 8 0 018 8c0 2.5-1.2 4-2.5 5V18h-3v2h-5v-2h-3v-2C5.2 15 4 13.5 4 11a8 8 0 018-8zM9 11h.01M15 11h.01M11 15h2',
  trophy: 'M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a4 4 0 004 4M17 6h3v1a4 4 0 01-4 4M9 20h6M12 14v6',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8h.01M12 11v5',
  panel: 'M4 5h16v14H4zM4 9h16M8 9v10',
  shield: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z',
}

export function Ico({ n, className = '' }: { n: IcoName; className?: string }) {
  const filled = n === 'play' || n === 'stop'
  return (
    <svg
      className={`ico ${className}`}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={P[n]} />
    </svg>
  )
}
